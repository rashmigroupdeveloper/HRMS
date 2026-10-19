#!/usr/bin/env bash
# Production-readiness pass end to end: fresh empty DB -> servers on it -> E2E_PROD=1 suite -> servers back on hrms_e2e.
set -uo pipefail
cd "$(dirname "$0")/.."
bash scripts/stop-servers.sh >/dev/null 2>&1
E2E_DB=${E2E_PROD_DB:-hrms_e2e_prod} bash scripts/prod-reset.sh || exit $?
rm -f .logs/prod-state.json
( export E2E_DB=${E2E_PROD_DB:-hrms_e2e_prod}; source scripts/env.sh; E2E_WORKER=1 E2E_KENT_SIM=1 bash scripts/start-servers.sh >/dev/null &&
  E2E_PROD=1 E2E_WORKERS=1 npx playwright test --reporter=line "$@" ); rc=$?
bash scripts/stop-servers.sh >/dev/null 2>&1
( export E2E_DB=hrms_e2e; source scripts/env.sh; bash scripts/start-servers.sh >/dev/null )
exit $rc
