# Running fix-build instance (for /workspace/hrms-e2e)
- Frontend: http://localhost:5183  (Vite dev, proxies /api → backend)
- Backend:  http://localhost:5110  (health: GET /health; API under /api)
- Database: postgres://hrms:hrms_local_dev@localhost:5432/hrms_fix  (seeded demo data)
- Code: /workspace/hrms-fix (only the fix worker edits it)
- Test logins: <role>@rashmi.test / Rashmi#Test2026 (payroll, hrops, hrhead, itadmin, admin, ceo, planthead, ...)
- Restart: /workspace/hrms-test/fix-verify/env/start-servers.sh ; reset DB: reset-fix-db.sh (please don't reset without need — shared)
- Note: backend is plain tsx (no watch); the fix worker restarts it after each commit (brief ~5s gap).
- HOD test login: rml033904@qa-payroll.rashmi.test / Rashmi#Test2026 (derived hod for RML Production; seed: env/hod-seed.sql)
