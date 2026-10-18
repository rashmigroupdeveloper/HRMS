#!/usr/bin/env bash
# Rebuild the e2e DB: tester snapshot (incl. June-2026 payroll cohort) + fixer migrations + seeds + recon prep.
set -euo pipefail
source "$(dirname "$0")/env.sh"
psql -h localhost -U hrms -d postgres -qc "DROP DATABASE IF EXISTS $E2E_DB WITH (FORCE)" -c "CREATE DATABASE $E2E_DB"
pg_restore -h localhost -U hrms -d $E2E_DB --no-owner "$E2E_SNAPSHOT" 2>&1 | tail -3 || true
cd $FIX_REPO/backend
export DATABASE_URL=$E2E_DATABASE_URL
npm run -s migrate > $E2E_LOGS/migrate.log 2>&1
npm run -s seed:rbac > $E2E_LOGS/seed.log 2>&1
npm run -s seed:workflows >> $E2E_LOGS/seed.log 2>&1
npm run -s seed:settings >> $E2E_LOGS/seed.log 2>&1
# Undo the payroll tester's SQL workarounds (same as fixer's recon round) so June runs recompute cleanly.
psql -h localhost -U hrms -d $E2E_DB -q -f /workspace/hrms-test/fix-verify/recon/prep.sql
[ -f scripts/recon-maternity-replay.ts ] && npx tsx scripts/recon-maternity-replay.ts >> $E2E_LOGS/seed.log 2>&1 || true
psql -h localhost -U hrms -d $E2E_DB -q -f $E2E_ROOT/scripts/e2e-prep.sql
echo "$E2E_DB ready"
