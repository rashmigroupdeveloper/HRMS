#!/usr/bin/env bash
# HRMS deploy — build → migrate → reload (docs/02 §2 rule 3).
# Run ON the server from the repo root. Aborts on any error.
#
# HARD RULE: deploys are FROZEN during payroll run days (docs/02 §2, NFR-06).
# The freeze is a file so HR/payroll can set it without shell access to CI.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FREEZE_FILE="${HRMS_FREEZE_FILE:-/var/hrms/DEPLOY_FREEZE}"

if [[ -f "$FREEZE_FILE" ]]; then
  echo "✖ DEPLOY FROZEN: $FREEZE_FILE exists (payroll window?). Remove it to deploy." >&2
  exit 1
fi

echo "── Pulling latest main…"
git -C "$REPO_ROOT" pull --ff-only origin main

echo "── Backend: install, verify, migrate, build…"
cd "$REPO_ROOT/backend"
npm ci
npm run typecheck
npm run test
npm run migrate          # forward-only, expand/contract (migrations/README.md)
npm run build

echo "── Frontend: install, build (served as static files by the vhost)…"
cd "$REPO_ROOT/frontend"
npm ci
npm run build

echo "── Reloading PM2 (zero-downtime)…"
cd "$REPO_ROOT"
pm2 reload ecosystem.config.cjs --update-env
pm2 save

echo "✔ Deployed. Rollback: 'git checkout <prev-sha> && bash scripts/deploy.sh' (schema is expand/contract-safe)."
