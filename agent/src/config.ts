// Paths and knobs. Everything comes from the environment so the same code runs
// on a laptop or inside a Slurm job. The Nebius key is read by Mastra's model
// router from NEBIUS_API_KEY; this file never touches it.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO = process.env.SEANCE_REPO ?? path.resolve(here, '..', '..');
export const WORK = process.env.SEANCE_WORK ?? path.join(REPO, 'work');
export const GHOSTS = process.env.SEANCE_GHOSTS ?? path.join(REPO, 'results', 'ghosts.json');
export const RUNS = process.env.SEANCE_RUNS ?? path.join(REPO, 'results', 'runs');
export const LEDGER = process.env.SEANCE_LEDGER ?? path.join(REPO, 'ledger', 'spend.jsonl');
export const PY313 = process.env.SEANCE_PY313 ?? path.join(REPO, 'envs', 'py313', 'bin', 'python');
export const PY38 = process.env.SEANCE_PY38 ?? path.join(REPO, 'envs', 'py38', 'bin', 'python');
export const PYTHON = process.env.SEANCE_HOST_PYTHON ?? 'python3';
export const TASK_QUEUE = process.env.SEANCE_QUEUE ?? 'seance';

// Money. The whole project may spend at most TOTAL_CAP on Nebius; a single
// seance is cut off the moment its metered cost reaches RUN_CAP.
export const TOTAL_CAP = Number(process.env.SEANCE_TOTAL_CAP ?? '1.00');
export const RUN_CAP = Number(process.env.SEANCE_RUN_CAP ?? '0.04');
export const MAX_STEPS = Number(process.env.SEANCE_MAX_STEPS ?? '40');

// Open-weight models on Nebius Token Factory, addressed through Mastra's model
// router ("nebius/<model id>"). Prices are fetched live from /v1/models.
export const MODELS: Record<string, string> = {
  'deepseek-v4-flash': 'deepseek-ai/DeepSeek-V4-Flash-0731',
  'gemma-3-27b': 'google/gemma-3-27b-it',
  'qwen3-30b-a3b': 'Qwen/Qwen3-30B-A3B-Instruct-2507',
  'minimax-m3.1-flash': 'MiniMaxAI/MiniMax-M3.1-Flash',
  'glm-5.3-flash': 'zai-org/GLM-5.3-Flash',
  'gpt-oss-120b': 'openai/gpt-oss-120b',
};
