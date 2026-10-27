// The medium: a Mastra agent on an open-weight model that talks to one ghost.
import { Agent } from '@mastra/core/agent';
import fs from 'node:fs';
import path from 'node:path';
import { MAX_STEPS, MODELS, RUN_CAP, TOTAL_CAP } from './config.js';
import { prices, record, total } from './ledger.js';
import { makeTools } from './tools.js';

export const INSTRUCTIONS = `You are reviving an abandoned Python package. Its own test suite passed on Python 3.8.
On Python 3.13 some of those tests now fail, usually because the library uses something newer
Python removed (distutils, imp, collections.Mapping, inspect.getargspec, asyncio.coroutine,
old unittest or configparser names, invalid escape sequences, vendored six.moves, ...).

Your job: edit the LIBRARY code (never the tests) until every target test passes on Python 3.13.
Rules:
- Tests, conftest.py and pytest/tox/setup config are read-only. They are the judge.
- Fix the cause, not the symptom. Never special-case tests, skip work, or detect pytest.
- Keep the change small and keep it working on Python 3.8 too (use try/except imports
  or version checks where an old name and a new name differ).
- Do not add dependencies; only the standard library, pytest, mock and six are installed.
- Work in a loop: run_tests, read the traceback, inspect the code (search, read_file), edit, run_tests again.
- When all target tests pass, stop and reply with two short lines:
  CAUSE OF DEATH: <what newer Python removed or changed>
  REMEDY: <what you changed>`;

export type SeanceResult = {
  run: string; model: string; steps: number; input_tokens: number; output_tokens: number; usd: number;
  stopped: 'finished' | 'step_limit' | 'cost_cap' | 'error'; final_text: string; error?: string;
  last_test?: { targets: number; targets_passing: number };
};

export async function summon(opts: {
  run: string; modelAlias: string; project: string; root: string; runDir: string; brief: string;
  attempt: number; heartbeat?: (d: unknown) => void; signal?: AbortSignal;
}): Promise<SeanceResult> {
  const modelId = MODELS[opts.modelAlias];
  if (!modelId) throw new Error(`unknown model alias ${opts.modelAlias}`);
  const spent = total();
  if (spent + RUN_CAP > TOTAL_CAP) throw new Error(`budget: ledger at $${spent.toFixed(4)}, cap $${TOTAL_CAP}`);
  const price = (await prices())[modelId];
  if (!price) throw new Error(`no live price for ${modelId}`);

  fs.mkdirSync(opts.runDir, { recursive: true });
  const transcript = path.join(opts.runDir, 'transcript.jsonl');
  let lastTest: { targets: number; targets_passing: number } | undefined;
  let step = 0, inTok = 0, outTok = 0, usd = 0;
  const tools = makeTools(opts.root, opts.project, (r) => { lastTest = r as typeof lastTest; },
    () => (usd >= RUN_CAP ? `Budget exhausted ($${usd.toFixed(4)} of $${RUN_CAP}). Stop now: reply with your two-line summary.` : null));
  const agent = new Agent({
    id: 'medium',
    name: 'medium',
    instructions: INSTRUCTIONS,
    model: `nebius/${modelId}`,
    tools,
  });

  const abort = new AbortController();
  opts.signal?.addEventListener('abort', () => abort.abort());
  let stopped: SeanceResult['stopped'] = 'finished';

  const prompt = (opts.attempt > 1
    ? `NOTE: an earlier attempt at this seance was interrupted (the worker died). The workspace still holds whatever edits it made. Continue from the current state; start with run_tests.\n\n`
    : '') + opts.brief;

  try {
    const res = await agent.generate(prompt, {
      maxSteps: MAX_STEPS,
      // The bench showed abort() from onStepFinish does not end Mastra's loop
      // (one run went 2.4x over its cap), so the cap is also a stop condition.
      stopWhen: [({ steps }: { steps: unknown[] }) => steps.length >= MAX_STEPS, () => usd >= RUN_CAP] as any,
      abortSignal: abort.signal,
      modelSettings: { temperature: 0.2, maxOutputTokens: 4096 },
      onStepFinish: (s: any) => {
        step += 1;
        const i = s.usage?.inputTokens ?? 0, o = s.usage?.outputTokens ?? 0;
        const cost = i * price.prompt + o * price.completion;
        inTok += i; outTok += o; usd += cost;
        record({ run: opts.run, model: modelId, step, input_tokens: i, output_tokens: o, usd: cost, note: `attempt ${opts.attempt}` });
        const calls = (s.toolCalls ?? []).map((c: any) => ({ tool: c.payload?.toolName ?? c.toolName, args: c.payload?.args ?? c.args }));
        const results = (s.toolResults ?? []).map((r: any) => {
          const out = JSON.stringify(r.payload?.result ?? r.result ?? null);
          return { tool: r.payload?.toolName ?? r.toolName, result: out.length > 1500 ? out.slice(0, 1500) + '…' : out };
        });
        fs.appendFileSync(transcript, JSON.stringify({ attempt: opts.attempt, step, text: s.text ?? '', calls, results, usage: { i, o, usd: cost } }) + '\n');
        opts.heartbeat?.({ step, usd });
        if (usd >= RUN_CAP) { stopped = 'cost_cap'; abort.abort(); }
      },
    });
    if (stopped === 'finished' && step >= MAX_STEPS && !(res.text ?? '').includes('CAUSE OF DEATH')) stopped = 'step_limit';
    return { run: opts.run, model: modelId, steps: step, input_tokens: inTok, output_tokens: outTok, usd, stopped, final_text: res.text ?? '', last_test: lastTest };
  } catch (e) {
    if ((stopped as SeanceResult['stopped']) === 'cost_cap') {
      return { run: opts.run, model: modelId, steps: step, input_tokens: inTok, output_tokens: outTok, usd, stopped, final_text: '', last_test: lastTest };
    }
    if (opts.signal?.aborted) throw e; // Temporal cancelled us: let it propagate
    return { run: opts.run, model: modelId, steps: step, input_tokens: inTok, output_tokens: outTok, usd, stopped: 'error', final_text: '', error: String((e as Error)?.message ?? e).slice(0, 500), last_test: lastTest };
  }
}
