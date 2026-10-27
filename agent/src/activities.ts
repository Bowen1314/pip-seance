// Temporal activities: everything with side effects lives here.
import { activityInfo, cancellationSignal, heartbeat } from '@temporalio/activity';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { GHOSTS, LEDGER, PY313, PY38, PYTHON, REPO, RUNS, WORK } from './config.js';
import { summon, type SeanceResult } from './medium.js';

const run = promisify(execFile);

export type Ghost = {
  project: string; version: string; last_upload: string; downloads_30d: number; test_files: string[];
  alive_38: string[]; lost_on_313: string[]; py38: any; py313: any; py313_tail: string;
};

export function loadGhost(project: string): Ghost {
  const g = JSON.parse(fs.readFileSync(GHOSTS, 'utf8')).ghosts.find((x: Ghost) => x.project === project);
  if (!g) throw new Error(`${project} is not in ${GHOSTS}`);
  return g;
}

export async function prepare(a: { project: string; run: string }) {
  const g = loadGhost(a.project);
  const pristine = path.join(WORK, 'pristine', a.project);
  const root = path.join(WORK, 'revive', a.run);
  if (!fs.existsSync(path.join(root, '.seance-ok'))) {
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(root), { recursive: true });
    fs.cpSync(pristine, root, { recursive: true });
  }
  const brief = [
    `Package: ${g.project} ${g.version} (last upload to PyPI ${g.last_upload.slice(0, 10)}, still downloaded ${g.downloads_30d.toLocaleString('en-US')} times in the last 30 days).`,
    `On Python 3.8, ${g.alive_38.length} tests passed. On Python 3.13, ${g.lost_on_313.length} of them fail or are not collected.`,
    `First error line in pytest's output on 3.13 (it may come from a test that is not a target; run_tests lists each failing target with its own error): ${g.py313.first_error ?? '(none parsed)'}`,
    `End of pytest output on 3.13:\n${g.py313_tail.slice(-1500)}`,
    `The package source is your workspace root. Start with run_tests.`,
  ].join('\n');
  return { root, pristine, brief };
}

export async function seance(a: { project: string; run: string; model: string; root: string; brief: string }): Promise<SeanceResult> {
  const info = activityInfo();
  const runDir = path.join(RUNS, a.run);
  fs.mkdirSync(runDir, { recursive: true });
  fs.appendFileSync(path.join(runDir, 'attempts.log'), `${new Date().toISOString()} attempt ${info.attempt} started (pid ${process.pid})\n`);
  const beat = setInterval(() => heartbeat({ alive: true }), 20_000);
  try {
    return await summon({
      run: a.run, modelAlias: a.model, project: a.project, root: a.root, runDir, brief: a.brief,
      attempt: info.attempt, heartbeat: (d) => heartbeat(d), signal: cancellationSignal(),
    });
  } finally {
    clearInterval(beat);
  }
}

export async function countAttempts(a: { run: string }) {
  const f = path.join(RUNS, a.run, 'attempts.log');
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).length : 0;
}

async function verifyOn(python: string, a: { project: string; root: string; pristine: string }) {
  const { stdout } = await run(PYTHON, [path.join(REPO, 'seance', 'verify.py'), '--ghost', GHOSTS, '--project', a.project,
    '--root', a.root, '--python', python, '--pristine', a.pristine], { maxBuffer: 64 << 20, timeout: 400_000 });
  return JSON.parse(stdout);
}

export async function verify(a: { project: string; run: string; root: string; pristine: string }) {
  const now = await verifyOn(PY313, a);
  const then = await verifyOn(PY38, a);
  let diff = '';
  try {
    await run('diff', ['-ruN', '-x', '__pycache__', '-x', '.pytest_cache', a.pristine, a.root], { maxBuffer: 64 << 20 });
  } catch (e: any) {
    if (e.code !== 1) throw e;
    diff = String(e.stdout);
  }
  diff = diff.split(a.pristine).join(`a/${a.project}`).split(a.root).join(`b/${a.project}`);
  const runDir = path.join(RUNS, a.run);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, 'revival.diff'), diff);
  const changed = diff.split('\n').filter((l) => /^[+-](?![+-])/.test(l)).length;
  return {
    py313: { targets: now.targets, passing: now.targets_passing, missing: now.missing_targets, first_error: now.first_error },
    py38: { targets: then.targets, passing: then.targets_passing, missing: then.missing_targets },
    protected_changed: now.protected_changed as string[],
    diff_lines_changed: changed,
    files_changed: (diff.match(/^diff -ruN/gm) ?? []).length,
  };
}

function ledgerTotal(run: string) {
  if (!fs.existsSync(LEDGER)) return 0;
  return fs.readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    .filter((r) => r.run === run).reduce((t, r) => t + (r.usd ?? 0), 0);
}

export async function epitaph(a: { project: string; run: string; model: string; seance: SeanceResult; verdict: any; attempts: number }) {
  const g = loadGhost(a.project);
  const v = a.verdict;
  const revived = v.py313.passing === v.py313.targets && v.protected_changed.length === 0;
  const status = revived ? 'REVIVED' : v.py313.passing > g.py313.passed ? 'STIRRED' : 'STILL DEAD';
  const runDir = path.join(RUNS, a.run);
  const md = [
    `# ${a.project} ${g.version}: ${status}`,
    '',
    `| | |`, `|---|---|`,
    `| last upload | ${g.last_upload.slice(0, 10)} |`,
    `| downloads, last 30 days | ${g.downloads_30d.toLocaleString('en-US')} |`,
    `| medium (model) | ${a.seance.model} |`,
    `| target tests (passed on 3.8, pristine) | ${v.py313.targets} |`,
    `| passing on 3.13 before | ${v.py313.targets - g.lost_on_313.length} |`,
    `| passing on 3.13 after | ${v.py313.passing} |`,
    `| passing on 3.8 after (did we break the past?) | ${v.py38.passing}/${v.py38.targets} |`,
    `| protected files changed | ${v.protected_changed.length ? v.protected_changed.join(', ') : 'none'} |`,
    `| files / lines changed | ${v.files_changed} / ${v.diff_lines_changed} |`,
    `| model steps, tokens in/out (this attempt) | ${a.seance.steps}, ${a.seance.input_tokens.toLocaleString('en-US')} / ${a.seance.output_tokens.toLocaleString('en-US')} |`,
    `| cost, this attempt | $${a.seance.usd.toFixed(4)} |`,
    `| cost, all attempts (ledger) | $${ledgerTotal(a.run).toFixed(4)} |`,
    `| activity attempts | ${a.attempts} |`,
    `| stopped because | ${a.seance.stopped}${a.seance.error ? ` (${a.seance.error})` : ''} |`,
    '',
    `## Cause of death on Python 3.13`, '', '```', g.py313.first_error ?? '(not parsed)', '```', '',
    `## The medium's last words`, '', '```', (a.seance.final_text || '(none)').trim().slice(0, 2000), '```', '',
    `Diff: [revival.diff](revival.diff) · transcript: [transcript.jsonl](transcript.jsonl)`, '',
  ].join('\n');
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, 'EPITAPH.md'), md);
  const summary = { project: a.project, run: a.run, model: a.seance.model, status, attempts: a.attempts, seance: { ...a.seance, final_text: undefined }, verdict: v };
  fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify(summary, null, 1));
  return summary;
}
