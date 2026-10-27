// The seance as a Temporal workflow. Deterministic glue only; the agent, the
// tests and the file system all live in activities. If the worker dies in the
// middle of the agent loop, the heartbeat stops, Temporal times the attempt out
// and hands the seance to the next worker, which continues on the same
// workspace (edits already made are kept, the spend already made is in the ledger).
import { proxyActivities } from '@temporalio/workflow';
import type * as acts from './activities.js';

const quick = proxyActivities<typeof acts>({
  startToCloseTimeout: '15 minutes',
  retry: { maximumAttempts: 3 },
});

const medium = proxyActivities<typeof acts>({
  startToCloseTimeout: '40 minutes',
  heartbeatTimeout: '90 seconds',
  retry: { maximumAttempts: 3, initialInterval: '5 seconds' },
});

export async function seanceWorkflow(a: { project: string; model: string; run: string }) {
  const prep = await quick.prepare({ project: a.project, run: a.run });
  const result = await medium.seance({ project: a.project, run: a.run, model: a.model, root: prep.root, brief: prep.brief });
  const verdict = await quick.verify({ project: a.project, run: a.run, root: prep.root, pristine: prep.pristine });
  const attempts = await quick.countAttempts({ run: a.run });
  return await quick.epitaph({ project: a.project, run: a.run, model: a.model, seance: result, verdict, attempts });
}
