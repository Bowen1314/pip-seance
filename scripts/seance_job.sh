#!/usr/bin/env bash
# One self-contained seance session: Temporal dev server (state in a SQLite
# file, so a later session can resume unfinished workflows), one worker, one
# client. Expects NEBIUS_API_KEY in the environment.
#   scripts/seance_job.sh --models deepseek-v4-flash --projects money --tag smoke
set -euo pipefail
cd "$(dirname "$0")/.."
: "${NEBIUS_API_KEY:?NEBIUS_API_KEY not set}"
export OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 OPENCV_FOR_THREADS_NUM=1
export MASTRA_TELEMETRY_DISABLED=1
export SEANCE_CONCURRENCY=${SEANCE_CONCURRENCY:-3}
PORT=${SEANCE_TEMPORAL_PORT:-$((17000 + RANDOM % 2000))}
export TEMPORAL_ADDRESS=127.0.0.1:$PORT
TEMPORAL=${TEMPORAL:-tools/temporal}
mkdir -p work logs
$TEMPORAL server start-dev --headless --ip 127.0.0.1 --port "$PORT" --ui-port $((PORT + 1000)) \
  --db-filename work/temporal.db --log-level error >logs/temporal.log 2>&1 &
SERVER=$!
trap 'kill $WORKER $SERVER 2>/dev/null || true' EXIT
for i in $(seq 60); do $TEMPORAL operator cluster health --address "$TEMPORAL_ADDRESS" >/dev/null 2>&1 && break; sleep 1; done
(cd agent && exec npx tsx src/worker.ts) >>logs/worker.log 2>&1 &
WORKER=$!
cd agent && npx tsx src/client.ts "$@"
