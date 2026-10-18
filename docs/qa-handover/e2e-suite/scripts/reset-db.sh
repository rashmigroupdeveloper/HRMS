#!/usr/bin/env bash
# Rebuild the e2e DB: base snapshot (QA users + June-2026 payroll cohort) + app migrations + seeds + recon prep + e2e personas.
# Base: first existing template DB in $E2E_TEMPLATE_DBS (CREATE DATABASE … TEMPLATE), else restore $E2E_SNAPSHOT.
set -euo pipefail
source "$(dirname "$0")/env.sh"
PSQL="psql -h $E2E_PGHOST -p $E2E_PGPORT -U $E2E_PGUSER"
$PSQL -d postgres -qc "DROP DATABASE IF EXISTS $E2E_DB WITH (FORCE)"
BASE=""
for t in $E2E_TEMPLATE_DBS; do
  [ "$($PSQL -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname='$t'")" = 1 ] && { BASE=$t; break; }
done
if [ -n "$BASE" ]; then
  # CREATE … TEMPLATE needs no other sessions on the template.
  $PSQL -d postgres -qc "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$BASE' AND pid<>pg_backend_pid()" >/dev/null
  $PSQL -d postgres -qc "CREATE DATABASE $E2E_DB TEMPLATE $BASE"
  echo "base: template $BASE"
elif [ -f "$E2E_SNAPSHOT" ]; then
  $PSQL -d postgres -qc "CREATE DATABASE $E2E_DB"
  pg_restore -h $E2E_PGHOST -p $E2E_PGPORT -U $E2E_PGUSER -d $E2E_DB --no-owner "$E2E_SNAPSHOT" 2>&1 | tail -3 || true
  echo "base: dump $E2E_SNAPSHOT"
else
  echo "no base: none of [$E2E_TEMPLATE_DBS] exists and no $E2E_SNAPSHOT"; exit 2
fi
cd "$APP_REPO/backend"
export DATABASE_URL=$E2E_DATABASE_URL
npm run -s migrate > $E2E_LOGS/migrate.log 2>&1
npm run -s seed:rbac > $E2E_LOGS/seed.log 2>&1
npm run -s seed:workflows >> $E2E_LOGS/seed.log 2>&1
npm run -s seed:settings >> $E2E_LOGS/seed.log 2>&1
# Undo the payroll tester's SQL workarounds (same as the fixer's recon round) so June runs recompute cleanly.
[ -f "$E2E_RECON_PREP" ] && $PSQL -d $E2E_DB -q -f "$E2E_RECON_PREP"
[ -f scripts/recon-maternity-replay.ts ] && npx tsx scripts/recon-maternity-replay.ts >> $E2E_LOGS/seed.log 2>&1 || true
$PSQL -d $E2E_DB -q -f $E2E_ROOT/scripts/e2e-prep.sql
echo "$E2E_DB ready"
