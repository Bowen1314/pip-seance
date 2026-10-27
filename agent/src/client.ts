// Start seances and wait for them.
//   npx tsx src/client.ts --models deepseek-v4-flash,gemma-3-27b [--projects money,kafka] [--tag bench]
// Workflow ids are deterministic (<tag>-<model>-<project>), so re-running the
// client after a crash attaches to the existing workflows instead of paying twice.
import { Client, Connection, WorkflowExecutionAlreadyStartedError } from '@temporalio/client';
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { GHOSTS, MODELS, TASK_QUEUE } from './config.js';
import { seanceWorkflow } from './workflows.js';

const { values } = parseArgs({
  options: { models: { type: 'string' }, projects: { type: 'string' }, tag: { type: 'string', default: 'bench' }, out: { type: 'string' } },
});
const models = (values.models ?? 'deepseek-v4-flash').split(',');
for (const m of models) if (!MODELS[m]) throw new Error(`unknown model ${m}`);
const ghosts: { project: string }[] = JSON.parse(fs.readFileSync(GHOSTS, 'utf8')).ghosts;
const projects = values.projects ? values.projects.split(',') : ghosts.map((g) => g.project);

const client = new Client({ connection: await Connection.connect({ address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233' }) });
const handles = [];
for (const model of models) {
  for (const project of projects) {
    const run = `${values.tag}-${model}-${project}`.replace(/[^A-Za-z0-9._-]/g, '_');
    try {
      handles.push(await client.workflow.start(seanceWorkflow, { taskQueue: TASK_QUEUE, workflowId: run, args: [{ project, model, run }] }));
      console.log(`started ${run}`);
    } catch (e) {
      if (!(e instanceof WorkflowExecutionAlreadyStartedError)) throw e;
      handles.push(client.workflow.getHandle(run));
      console.log(`attached ${run}`);
    }
  }
}
const results = [];
for (const h of handles) {
  try {
    const r: any = await h.result();
    console.log(`${r.status.padEnd(10)} ${r.run}  3.13 ${r.verdict.py313.passing}/${r.verdict.py313.targets}  3.8 ${r.verdict.py38.passing}/${r.verdict.py38.targets}  $${r.seance.usd.toFixed(4)}  steps ${r.seance.steps}  attempts ${r.attempts}`);
    results.push(r);
  } catch (e) {
    console.log(`FAILED     ${h.workflowId}: ${(e as Error).message}`);
    results.push({ run: h.workflowId, status: 'WORKFLOW_FAILED', error: String((e as Error).message) });
  }
}
if (values.out) fs.writeFileSync(values.out, JSON.stringify(results, null, 1));
