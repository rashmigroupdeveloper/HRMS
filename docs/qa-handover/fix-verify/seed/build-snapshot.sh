#!/usr/bin/env bash
# Rebuild the June-2026 payroll QA state (the tester's hrms_snapshot.dump was not shipped) into DB $1 (default hrms_recon)
# from a fresh migrated + seeded DB. Needs a backend from this worktree on $BASE (default http://localhost:5103/api) pointing at $1.
# Stage 1 (base): migrations, rbac/workflow/settings seeds, USERS.md users, 33-employee cohort, HOD.
# Stage 2 (june): salaries, leave, separations, swipes → day records, week-offs, OT, loan, holds, 80C, manager sign-off, month lock, runs + inputs (inputs_locked).
set -euo pipefail
DBN=${1:-hrms_recon}
HERE=$(cd "$(dirname "$0")" && pwd); BE=$HERE/../../../../backend
export PATH=/opt/node24/bin:$PATH PGPASSWORD=hrms_local_dev DB=$DBN API_LOG=${API_LOG:-/tmp/seed-api-$DBN.jsonl}
URL=postgres://hrms:hrms_local_dev@localhost:5432/$DBN
P="psql -h localhost -U hrms -v ON_ERROR_STOP=1 -q"
if [ "${SKIP_BASE:-0}" != 1 ]; then
  $P -d postgres -c "DROP DATABASE IF EXISTS $DBN WITH (FORCE)" -c "CREATE DATABASE $DBN OWNER hrms"
  (cd "$BE" && DATABASE_URL=$URL npm run -s migrate >/dev/null && DATABASE_URL=$URL npm run -s seed:rbac >/dev/null && DATABASE_URL=$URL npm run -s seed:workflows >/dev/null && DATABASE_URL=$URL npm run -s seed:settings >/dev/null)
  (cd "$BE" && DATABASE_URL=$URL npx tsx "$HERE/01-base-users.ts" >/dev/null && DATABASE_URL=$URL npx tsx "$HERE/02-cohort.ts" >/dev/null)
  $P -d "$DBN" -f "$HERE/03-cohort-roles.sql" -f "$HERE/../env/hod-seed.sql"
  echo "stage 1 (base) done"
fi
cd "$HERE"
python3 04_salaries.py >/dev/null
python3 05_leave.py >/dev/null
$P -d "$DBN" -f 05b-separations.sql
(cd "$BE" && DATABASE_URL=$URL npx tsx "$HERE/06-swipes.ts" | tail -1)
python3 07_recompute.py | tail -1
python3 08_june_close.py | grep -E "^lock|^loan|^hold|^ot" 
python3 09_runs.py | tail -1
echo "stage 2 (june) done"
