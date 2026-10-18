#!/usr/bin/env bash
# Full payroll reconciliation round: fresh snapshot of the tester's DB 'hrms'
# (read-only pg_dump) → hrms_fix_recon → migrations → undo workarounds →
# replay P-07 maternity → recompute/finalize/pay runs 4,5 with the fixed code
# → independent reconcile (44 employees, incl. RML033625 = 59,124).
set -euo pipefail
export PATH=/opt/node24/bin:$PATH PGPASSWORD=hrms_local_dev
HERE=/workspace/hrms-test/fix-verify/recon
BE=/workspace/hrms-fix/backend
URL=postgres://hrms:hrms_local_dev@localhost:5432/hrms_fix_recon
psql -h localhost -U hrms -d postgres -qc "DROP DATABASE IF EXISTS hrms_fix_recon" -c "CREATE DATABASE hrms_fix_recon"
[ -f "$HERE/hrms_snapshot.dump" ] || pg_dump -h localhost -U hrms -d hrms -Fc -f "$HERE/hrms_snapshot.dump"
pg_restore -h localhost -U hrms -d hrms_fix_recon --no-owner "$HERE/hrms_snapshot.dump"
cd "$BE"
DATABASE_URL=$URL npm run -s migrate >/dev/null
psql -h localhost -U hrms -d hrms_fix_recon -q -f "$HERE/prep.sql"
DATABASE_URL=$URL npx tsx scripts/recon-maternity-replay.ts
DATABASE_URL=$URL npx tsx scripts/recon-rerun.ts 4,5 12 4 2 > "$HERE/rerun.json"
python3 "$HERE/reconcile_fix.py" hrms_fix_recon 4,5 "$HERE/reconciliation.json" | tee "$HERE/reconcile.txt"
