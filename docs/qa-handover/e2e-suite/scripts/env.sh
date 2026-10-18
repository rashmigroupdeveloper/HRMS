# Shared env for the e2e instance (sourced by other scripts).
export PATH=/opt/node24/bin:$PATH PGPASSWORD=hrms_local_dev
export E2E_ROOT=/workspace/hrms-e2e
export FIX_REPO=${FIX_REPO:-/workspace/hrms-fix}
export E2E_DB=${E2E_DB:-hrms_e2e}
export E2E_BACKEND_PORT=${E2E_BACKEND_PORT:-5130}
export E2E_FRONTEND_PORT=${E2E_FRONTEND_PORT:-5193}
export E2E_DATABASE_URL=postgres://hrms:hrms_local_dev@localhost:5432/$E2E_DB
export E2E_SNAPSHOT=${E2E_SNAPSHOT:-/workspace/hrms-test/fix-verify/recon/hrms_snapshot.dump}
export E2E_LOGS=$E2E_ROOT/.logs
mkdir -p $E2E_LOGS
