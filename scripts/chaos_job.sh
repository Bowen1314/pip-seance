#!/usr/bin/env bash
# Kill the worker in the middle of a seance and see whether the seance survives.
#   scripts/chaos_job.sh <model> <project> [kill-after-steps]
# 1. Temporal dev server + worker A + client start one seance.
# 2. After the agent has finished N model steps, worker A gets SIGKILL (no cleanup).
# 3. 10 s later worker B starts. Temporal notices the missing heartbeat
#    (90 s timeout), retries the activity on worker B, which picks up the same
#    workspace. The event history is saved next to the run.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${NEBIUS_API_KEY:?NEBIUS_API_KEY not set}"
MODEL=$1; PROJECT=$2; N=${3:-4}
export OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 OPENCV_FOR_THREADS_NUM=1 MASTRA_TELEMETRY_DISABLED=1
PORT=${SEANCE_TEMPORAL_PORT:-$((19000 + RANDOM % 900))}
export TEMPORAL_ADDRESS=127.0.0.1:$PORT
TEMPORAL=${TEMPORAL:-tools/temporal}
RUN="chaos-$MODEL-$PROJECT"
RUNDIR=results/runs/$RUN
EV=$RUNDIR/chaos-events.log
mkdir -p work logs "$RUNDIR"
log() { echo "$(date -u +%FT%TZ) $*" | tee -a "$EV"; }
$TEMPORAL server start-dev --headless --ip 127.0.0.1 --port "$PORT" --ui-port $((PORT + 1000)) \
  --db-filename work/temporal-chaos.db --log-level error >logs/temporal-chaos.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true; pkill -P $$ 2>/dev/null || true' EXIT
for i in $(seq 60); do $TEMPORAL operator cluster health --address "$TEMPORAL_ADDRESS" >/dev/null 2>&1 && break; sleep 1; done
(cd agent && exec npx tsx src/worker.ts) >logs/chaos-workerA.log 2>&1 &
for i in $(seq 120); do grep -q 'worker pid' logs/chaos-workerA.log && break; sleep 1; done
PID_A=$(grep -o 'worker pid [0-9]*' logs/chaos-workerA.log | awk '{print $3}')
log "worker A up (pid $PID_A)"
(cd agent && exec npx tsx src/client.ts --models "$MODEL" --projects "$PROJECT" --tag chaos) >logs/chaos-client.log 2>&1 &
CLIENT=$!
until [ -f "$RUNDIR/transcript.jsonl" ] && [ "$(wc -l <"$RUNDIR/transcript.jsonl")" -ge "$N" ]; do sleep 1; done
log "agent finished step $(wc -l <"$RUNDIR/transcript.jsonl"); sending SIGKILL to worker A (pid $PID_A)"
kill -9 "$PID_A"
sleep 10
(cd agent && exec npx tsx src/worker.ts) >logs/chaos-workerB.log 2>&1 &
for i in $(seq 120); do grep -q 'worker pid' logs/chaos-workerB.log && break; sleep 1; done
log "worker B up (pid $(grep -o 'worker pid [0-9]*' logs/chaos-workerB.log | awk '{print $3}'))"
wait $CLIENT || true
cat logs/chaos-client.log
log "client returned"
$TEMPORAL workflow show -w "$RUN" --address "$TEMPORAL_ADDRESS" >"$RUNDIR/history.txt" 2>&1 || true
$TEMPORAL workflow show -w "$RUN" --address "$TEMPORAL_ADDRESS" -o json >"$RUNDIR/history.json" 2>&1 || true
python3 seance/decode_history.py "$RUNDIR/history.json" || true
