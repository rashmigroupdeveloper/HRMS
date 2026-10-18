# Shared env for the e2e instance (sourced by other scripts). Every path/port is overridable.
# Defaults: the app under test is the repo this suite lives in (docs/qa-handover/e2e-suite → ../../..).
export PATH=/opt/node24/bin:$PATH PGPASSWORD=${PGPASSWORD:-hrms_local_dev}
export E2E_ROOT=${E2E_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}
export APP_REPO=${APP_REPO:-${FIX_REPO:-$(cd "$E2E_ROOT/../../.." && pwd)}}
export E2E_DB=${E2E_DB:-hrms_e2e}
export E2E_BACKEND_PORT=${E2E_BACKEND_PORT:-5104}
export E2E_FRONTEND_PORT=${E2E_FRONTEND_PORT:-5176}
export E2E_PGHOST=${E2E_PGHOST:-localhost} E2E_PGPORT=${E2E_PGPORT:-5432} E2E_PGUSER=${E2E_PGUSER:-hrms}
export E2E_DATABASE_URL=${E2E_DATABASE_URL:-postgres://$E2E_PGUSER:$PGPASSWORD@$E2E_PGHOST:$E2E_PGPORT/$E2E_DB}
# Base DB dump (QA users + June-2026 payroll cohort). Not in git (size); the payroll job publishes it.
export E2E_SNAPSHOT=${E2E_SNAPSHOT:-/workspace/STATE/hrms_base.dump}
export E2E_RECON_PREP=${E2E_RECON_PREP:-$APP_REPO/docs/qa-handover/fix-verify/recon/prep.sql}
export E2E_BASE_URL=${E2E_BASE_URL:-http://localhost:$E2E_FRONTEND_PORT}
export E2E_API_URL=${E2E_API_URL:-http://localhost:$E2E_BACKEND_PORT}
export E2E_OUT=${E2E_OUT:-$E2E_ROOT/reports/results}
export E2E_LOGS=$E2E_ROOT/.logs
mkdir -p "$E2E_LOGS"
