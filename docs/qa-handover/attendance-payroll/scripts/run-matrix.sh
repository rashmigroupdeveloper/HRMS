#!/usr/bin/env bash
# Attendance → payroll scenario matrix (handover item 4) against the code in THIS checkout.
#   1. rebuilds scenario-matrix.json from build_matrix.py (independent hand-computed expectations)
#   2. runs backend/tests/payroll-scenario-matrix.integration.test.ts against a pristine scratch DB
#      (empty + this checkout's migrations + rbac/workflows/settings seeds; every case rolls back)
#   3. prints one line per case and "MATRIX PASS n/n" or "MATRIX FAIL".
# Usage: run-matrix.sh [db=hrms_matrix_test]
set -euo pipefail
export PATH=/opt/node24/bin:$PATH PGPASSWORD=hrms_local_dev
HERE=$(cd "$(dirname "$0")" && pwd)
BE=$HERE/../../../../backend
DB=${1:-hrms_matrix_test}   # must end in _test (tests/test-database-target.ts)
URL=postgres://hrms:hrms_local_dev@localhost:5432/$DB
P="psql -h localhost -U hrms -v ON_ERROR_STOP=1 -q"
python3 "$HERE/build_matrix.py" >/dev/null
$P -d postgres -c "DROP DATABASE IF EXISTS $DB WITH (FORCE)" -c "CREATE DATABASE $DB OWNER hrms"
cd "$BE"
DATABASE_URL=$URL npm run -s migrate >/dev/null
for s in seed:rbac seed:workflows seed:settings; do DATABASE_URL=$URL npm run -s $s >/dev/null; done
OUT=${MATRIX_OUT:-$HERE/out}; mkdir -p "$OUT"
set +e
NODE_ENV=test DATABASE_URL=$URL TEST_DATABASE_URL=$URL LOCAL_TEST_DATABASE_NAME=$DB npx vitest run tests/payroll-scenario-matrix.integration.test.ts --reporter=json --outputFile="$OUT/matrix.json" >"$OUT/matrix.log" 2>&1
set -e
python3 - "$OUT/matrix.json" <<'PY'
import json, sys
r = json.load(open(sys.argv[1]))
tests = [t for f in r['testResults'] for t in f['assertionResults']]
ok = sum(t['status'] == 'passed' for t in tests)
for t in tests:
    print(('PASS ' if t['status'] == 'passed' else 'FAIL ') + t['title'] + ('' if t['status'] == 'passed' else '  :: ' + ' '.join(m.splitlines()[0] for m in t['failureMessages'])))
print(f"MATRIX {'PASS' if ok == len(tests) and tests else 'FAIL'} {ok}/{len(tests)}")
sys.exit(0 if ok == len(tests) and tests else 1)
PY
