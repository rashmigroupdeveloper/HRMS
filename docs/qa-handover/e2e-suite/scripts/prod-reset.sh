#!/usr/bin/env bash
# Production-readiness base: a FRESH EMPTY database (no snapshot, no demo data) -> migrations -> the app's own seeds
# (run twice: must be idempotent) -> break-glass super_admin via backend/scripts/create-admin.ts.
# Everything else (org masters, employees, logins, salary, punches, payroll) is created through the product by
# tests/prod/production-readiness.spec.ts. Usage: E2E_DB=hrms_e2e_prod scripts/prod-reset.sh
set -euo pipefail
export E2E_DB=${E2E_DB:-hrms_e2e_prod}
source "$(dirname "$0")/env.sh"
PSQL="psql -h $E2E_PGHOST -p $E2E_PGPORT -U $E2E_PGUSER"
$PSQL -d postgres -qc "DROP DATABASE IF EXISTS $E2E_DB WITH (FORCE)" -qc "CREATE DATABASE $E2E_DB"
cd "$APP_REPO/backend"
export DATABASE_URL=$E2E_DATABASE_URL
npm run -s migrate > "$E2E_LOGS/prod-migrate.log" 2>&1
for pass in 1 2; do
  for s in seed:rbac seed:workflows seed:settings; do npm run -s $s >> "$E2E_LOGS/prod-seed.log" 2>&1 || { echo "$s failed on pass $pass"; exit 3; }; done
done
PW=$(npx tsx scripts/create-admin.ts "${E2E_PROD_ADMIN:-admin@rashmi.prod}" 2>&1 | sed -n 's/^ *password: *//p')
[ -n "$PW" ] || { echo "create-admin printed no password"; exit 4; }
printf '{"email":"%s","password":"%s","migrations":%s}\n' "${E2E_PROD_ADMIN:-admin@rashmi.prod}" "$PW" \
  "$(ls migrations | grep -cv '\.md$')" > "$E2E_LOGS/prod-admin.json"
echo "$E2E_DB: empty -> migrated -> seeded x2 -> admin ready ($E2E_LOGS/prod-admin.json)"
