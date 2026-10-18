# DEPLOY — Rashmi HRMS production runbook

## 1. Prerequisites
Linux server, Node 24, PostgreSQL 17, nginx (TLS), a backup disk + off-site copy. One DB user that owns the HRMS database.

## 2. Configuration (`backend/.env`, mode 600)
| Variable | Notes |
|---|---|
| `NODE_ENV=production` | enables secure cookies and production logging |
| `DATABASE_URL` | `postgres://hrms:…@db:5432/hrms` |
| `JWT_SECRET` | ≥ 32 random chars (`openssl rand -hex 32`); rotate = all users re-login |
| `APP_BASE_URL` | public https URL (links in mail) |
| `SMTP_HOST/PORT/SECURE/USER/PASS/FROM` | mail delivery; unset = mail is logged, not sent |
| `STORAGE_DIR` | document store (letters, payslips, proofs) — include in backups |
| `KENT_*` | attendance feed — see docs/integrations/KENT.md |
| `PAYROLL_SUPER_ADMIN_COSIGN` | default `false` (client decision CD-1) |
| `RATE_LIMIT_*` | leave defaults in production |
Frontend: `npm run build` → serve `frontend/dist` from nginx; proxy `/api` and `/health` to the backend port.

## 3. First install (empty database)
```
cd backend && npm ci
npm run migrate                      # schema from empty DB (also seeds the 13 group legal entities)
npm run seed:rbac && npm run seed:workflows && npm run seed:settings   # idempotent
MASTERS_FILE=/etc/hrms/masters.json npm run seed:masters               # client's real org units, locations, cost centres, departments, designations, grades (docs/deploy/masters.example.json) — no demo data
npx tsx scripts/create-admin.ts admin@rashmigroup.com                  # first super_admin; change password at first login
```
Then load employees through Admin → Data imports (employee master template), salaries, opening leave balances.
Do **not** run anything under `docs/qa-handover/fix-verify/seed` in production — that is QA demo data.

## 4. Processes
- API: `node dist/index.js` (systemd, restart=always). Worker: `node dist/jobs/worker.js` (one instance — runs kent-sync, recompute, accruals, reminders).
- Health: `GET /health` (liveness), `GET /health/ready` (DB reachable; use for the load balancer). Every response and error log carries a request id.
- Logs: JSON (pino) on stdout → journald/your collector. No PII in logs (see PII_ENCRYPTION_PLAN.md).

## 5. Upgrades
`scripts/deploy.sh` (pull → install → typecheck/test → migrate → build → reload). Deploys are blocked while `/var/hrms/DEPLOY_FREEZE` exists (payroll days).

## 6. Backup and restore
Nightly: `DATABASE_URL=… STORAGE_DIR=… BACKUP_DIR=/srv/hrms-backups scripts/backup.sh` (pg_dump custom format + document store + SHA-256 manifest, 30-day retention). Copy off-site, encrypted.
Restore drill (monthly): `PGHOST=… PGUSER=… scripts/restore.sh /srv/hrms-backups/hrms-<stamp> hrms_restore_test` — restores only into a new database; evidence of the last drill: docs/qa-handover/fix-verify/backup/EVIDENCE.md.

## 7. Security defaults
HTTPS only; secure, httpOnly cookies in production; account lockout and password policy from settings (`auth.*`); RBAC with entity-scoped grants (hr_ops / payroll_admin / plant_head must be granted per org unit); it_admin can view and revoke sessions (Admin → Users & Roles → Sessions); CSV/Excel exports are formula-injection safe; audit log for every grant, override and payroll action.
