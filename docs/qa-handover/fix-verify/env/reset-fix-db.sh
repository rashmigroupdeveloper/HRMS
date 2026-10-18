#!/usr/bin/env bash
# hrms_fix = tester snapshot of 'hrms' + all fix migrations + idempotent seeds.
set -euo pipefail
export PATH=/opt/node24/bin:$PATH PGPASSWORD=hrms_local_dev
psql -h localhost -U hrms -d postgres -qc "DROP DATABASE IF EXISTS hrms_fix WITH (FORCE)" -c "CREATE DATABASE hrms_fix"
pg_restore -h localhost -U hrms -d hrms_fix --no-owner /workspace/hrms-test/fix-verify/recon/hrms_snapshot.dump
cd /workspace/hrms-fix/backend
export DATABASE_URL=postgres://hrms:hrms_local_dev@localhost:5432/hrms_fix
npm run -s migrate >/dev/null && npm run -s seed:rbac >/dev/null && npm run -s seed:workflows >/dev/null && npm run -s seed:settings >/dev/null
echo "hrms_fix ready"
