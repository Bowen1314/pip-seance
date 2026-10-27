import { NativeConnection, Worker } from '@temporalio/worker';
import { createRequire } from 'node:module';
import * as activities from './activities.js';
import { TASK_QUEUE } from './config.js';

const require = createRequire(import.meta.url);

const connection = await NativeConnection.connect({ address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233' });
const worker = await Worker.create({
  connection,
  taskQueue: TASK_QUEUE,
  workflowsPath: require.resolve('./workflows.ts'),
  activities,
  maxConcurrentActivityTaskExecutions: Number(process.env.SEANCE_CONCURRENCY ?? '2'),
});
console.log(`worker pid ${process.pid} listening on ${TASK_QUEUE}`);
await worker.run();
