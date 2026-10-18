#!/usr/bin/env bash
# Start the e2e instance from $APP_REPO: backend :$E2E_BACKEND_PORT (DB $E2E_DB), Vite frontend :$E2E_FRONTEND_PORT (proxy /api → backend).
set -uo pipefail
source "$(dirname "$0")/env.sh"
bash "$(dirname "$0")/stop-servers.sh" >/dev/null 2>&1
# Run through a symlink so other jobs' `pkill -f "<repo>/backend…"` restarts never hit this instance.
ln -sfn "$APP_REPO" "$E2E_ROOT/.app"
cd "$E2E_ROOT/.app/backend"
PORT=$E2E_BACKEND_PORT DATABASE_URL=$E2E_DATABASE_URL CORS_ORIGIN=http://localhost:$E2E_FRONTEND_PORT \
  STORAGE_DIR=$E2E_ROOT/.storage E2E_INSTANCE=1 \
  RATE_LIMIT_AUTH_PER_IDENTIFIER=${RATE_LIMIT_AUTH_PER_IDENTIFIER:-10000} RATE_LIMIT_AUTH_PER_ADDRESS=100000 RATE_LIMIT_GLOBAL_PER_ADDRESS=1000000 \
  nohup node --import tsx ./src/index.ts > $E2E_LOGS/backend.log 2>&1 &
echo $! > $E2E_LOGS/backend.pid
# E2E_WORKER=1: also run the pg-boss worker (recompute queue, accruals, Kent sync) as production does.
if [ "${E2E_WORKER:-0}" = 1 ]; then
  DATABASE_URL=$E2E_DATABASE_URL STORAGE_DIR=$E2E_ROOT/.storage E2E_INSTANCE=1 nohup node --import tsx ./src/jobs/worker.ts > $E2E_LOGS/worker.log 2>&1 &
  echo $! > $E2E_LOGS/worker.pid
fi
cd "$E2E_ROOT/.app/frontend"
VITE_API_TARGET=http://localhost:$E2E_BACKEND_PORT nohup node "$E2E_ROOT/.app/frontend/node_modules/vite/bin/vite.js" --port $E2E_FRONTEND_PORT --strictPort > $E2E_LOGS/frontend.log 2>&1 &
echo $! > $E2E_LOGS/frontend.pid
for i in $(seq 1 90); do
  b=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$E2E_BACKEND_PORT/api/auth/me); f=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$E2E_FRONTEND_PORT/)
  [ "$b" != "000" ] && [ "$f" = "200" ] && { echo "backend :$E2E_BACKEND_PORT ($b) frontend :$E2E_FRONTEND_PORT ($f)"; exit 0; }
  sleep 1
done
echo "servers failed to start"; tail -n 20 $E2E_LOGS/backend.log; exit 1
