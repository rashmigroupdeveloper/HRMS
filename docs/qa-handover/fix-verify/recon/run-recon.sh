#!/usr/bin/env bash
# Full payroll reconciliation round against the code in THIS checkout.
#   fresh copy of the June-2026 QA snapshot (template DB hrms_snapshot, or the dump file) → $DB
#   → this checkout's migrations + idempotent seeds → reopen/recompute/review/approve/finalize/payslips/bank/paid
#   runs 4 (RML) and 5 (RGH) through the real services → F&F for the June leavers → independent reconcile
#   (44 employees; RML033625 must net 59,124). Prints "RECON PASS" on success.
# Usage: run-recon.sh [db=hrms_recon]     Env: SNAPSHOT_DB (hrms_snapshot) | SNAPSHOT_DUMP (/workspace/STATE/hrms_snapshot.dump)
# The snapshot is rebuilt from scratch by ../seed/build-snapshot.sh (+ ../seed/10_finalize.py); the tester's own dump was not shipped.
# History: the tester's snapshot needed prep.sql (undo workarounds) and the P-07 maternity replay; the rebuilt snapshot needs neither.
set -euo pipefail
export PATH=/opt/node24/bin:$PATH PGPASSWORD=hrms_local_dev
HERE=$(cd "$(dirname "$0")" && pwd)
BE=$HERE/../../../../backend
DB=${1:-hrms_recon}
SNAP=${SNAPSHOT_DB:-hrms_snapshot}
DUMP=${SNAPSHOT_DUMP:-/workspace/STATE/hrms_snapshot.dump}
URL=postgres://hrms:hrms_local_dev@localhost:5432/$DB
P="psql -h localhost -U hrms -v ON_ERROR_STOP=1 -q"
$P -d postgres -c "DROP DATABASE IF EXISTS $DB WITH (FORCE)"
if $P -d postgres -Atc "select 1 from pg_database where datname='$SNAP'" | grep -q 1; then
  $P -d postgres -c "CREATE DATABASE $DB TEMPLATE $SNAP OWNER hrms"
else
  $P -d postgres -c "CREATE DATABASE $DB OWNER hrms"; pg_restore -h localhost -U hrms -d "$DB" --no-owner "$DUMP"
fi
cd "$BE"
DATABASE_URL=$URL npm run -s migrate >/dev/null
for s in seed:rbac seed:workflows seed:settings; do DATABASE_URL=$URL npm run -s $s >/dev/null; done
OUT=${RECON_OUT:-$HERE/out}; mkdir -p "$OUT"
DATABASE_URL=$URL npx tsx scripts/recon-rerun.ts 4,5 12 4 2 > "$OUT/rerun.json"
python3 "$HERE/reconcile_fix.py" "$DB" 4,5 "$OUT/reconciliation.json" | tee "$OUT/reconcile.txt"
if grep -q "Counter({'MATCH': 44})" "$OUT/reconcile.txt" && grep -Eq "^4 RML033625 +MATCH .* net 59124/59124" "$OUT/reconcile.txt"; then
  echo "RECON PASS: MATCH 44, RML033625 net 59124"
else
  echo "RECON FAIL"; exit 1
fi
