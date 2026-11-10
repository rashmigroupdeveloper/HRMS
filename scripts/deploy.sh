#!/usr/bin/env bash
# HRMS deploy — build → migrate → reload (docs/02 §2 rule 3).
# Run ON the server from the repo root. Aborts on any error.
#
# Branch model (P0-T11): production is the live track. CI verifies on main;
# merging main → production triggers GitHub Actions → this script.
#
# HARD RULE: deploys are FROZEN during payroll run days (docs/02 §2, NFR-06).
# The freeze is a file so HR/payroll can set it without shell access to CI.
# Override path with HRMS_FREEZE_FILE when /var/hrms is unavailable.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FREEZE_FILE="${HRMS_FREEZE_FILE:-/var/hrms/DEPLOY_FREEZE}"
DEPLOY_BRANCH="${HRMS_DEPLOY_BRANCH:-production}"
PUBLIC_HTML="${HRMS_PUBLIC_HTML:-$HOME/public_html}"

if [[ -f "$FREEZE_FILE" ]]; then
  echo "✖ DEPLOY FROZEN: $FREEZE_FILE exists (payroll window?). Remove it to deploy." >&2
  exit 1
fi

# W1-T04: fail before pulling, installing or touching the database.
if [[ "$(node -p 'process.versions.node.split(".")[0]')" != "24" ]]; then
  echo "Node 24 is required (.nvmrc / docs/14). Activate it before deploying." >&2
  exit 1
fi

echo "── Pulling latest ${DEPLOY_BRANCH}…"
git -C "$REPO_ROOT" fetch --prune origin
git -C "$REPO_ROOT" checkout "$DEPLOY_BRANCH"
git -C "$REPO_ROOT" pull --ff-only origin "$DEPLOY_BRANCH"

echo "── Backend: install, migrate, build…"
# Full verify (typecheck/tests) runs in GitHub Actions CI on main / PRs.
# Production deploy keeps migrate + build only (docs/02 §2 rule 3).
cd "$REPO_ROOT/backend"
npm ci
npm run migrate          # forward-only, expand/contract (migrations/README.md)
npm run build

echo "── Frontend: install, build (served as static files by the vhost)…"
cd "$REPO_ROOT/frontend"
npm ci
npm run build

if [[ -d "$PUBLIC_HTML" ]]; then
  echo "── Syncing frontend/dist → ${PUBLIC_HTML} (preserve .well-known)…"
  rsync -a --delete \
    --exclude '.well-known' \
    --exclude '.htaccess' \
    --exclude 'cgi-bin' \
    "$REPO_ROOT/frontend/dist/" "$PUBLIC_HTML/"
fi

echo "── Reloading PM2 (zero-downtime)…"
cd "$REPO_ROOT"
if pm2 describe hrms-api >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save

echo "✔ Deployed. Rollback: 'git checkout <prev-sha> && bash scripts/deploy.sh' (schema is expand/contract-safe)."
