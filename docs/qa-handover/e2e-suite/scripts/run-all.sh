#!/usr/bin/env bash
# One command: fresh DB → own servers on :5130/:5193 → every Playwright project → E2E_RESULTS.md / FAILURES.md.
# Extra args go to `playwright test` (e.g. --project=api, -g "P5").
set -uo pipefail
cd "$(dirname "$0")/.."
source scripts/env.sh
export E2E_FIX_HEAD="$(git -C "$APP_REPO" log -1 --format='%h %s (%ci)')"
echo "▶ build under test: $APP_REPO @ $E2E_FIX_HEAD"
[ "${E2E_SKIP_RESET:-0}" = 1 ] || bash scripts/reset-db.sh > "$E2E_LOGS/reset.log" 2>&1 || { echo "DB reset failed — see $E2E_LOGS/reset.log"; exit 2; }
[ "${E2E_SKIP_SERVERS:-0}" = 1 ] || bash scripts/start-servers.sh || { echo "servers failed to start"; exit 2; }
rm -rf reports/artifacts
npx playwright test "$@"; RC=$?
npx tsx scripts/build-results.ts
echo "HTML report: $PWD/reports/html/index.html"
exit $RC
