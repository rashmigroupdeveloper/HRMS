# QA seeded users (box-local test DB `hrms` only)

Password for ALL accounts: `Rashmi#Test2026`
Login: POST http://localhost:5100/api/auth/login {"identifier": "<email>", "password": "..."}  (UI: http://localhost:5173)

| Email | Ecode | Emp id / user id | Roles (core.user_roles) | Notes |
|---|---|---|---|---|
| employee@rashmi.test | RML000008 | 8 / 8 | employee | Debajit Roy, reports to RML000007; has leave/attendance/OT/salary(G1 structure) data |
| employee2@rashmi.test | RML000009 | 9 / 9 | employee | Priya Sharma (female, ESIC applicable, low-wage structure) reports to RML000007 |
| manager@rashmi.test | RML000007 | 7 / 7 | employee (+manager derived) | Amit Kumar Singh |
| srmanager@rashmi.test | RML000006 | 6 / 6 | employee (+manager, senior_manager derived) | Kinjal Roy |
| planthead@rashmi.test | RML000005 | 5 / 5 | employee, plant_head (scope org_unit 1) (+derived mgr/sr mgr) | Sapikul Ali |
| hrops@rashmi.test | RML000003 | 3 / 3 | employee, hr_ops (scope org_unit 1 = RML Kharagpur) | Rachna Das |
| hrhead@rashmi.test | RML000002 | 2 / 2 | employee, hr_head | Chaitanya Paila |
| payroll@rashmi.test | RML000004 | 4 / 4 | employee, payroll_admin | Subhasis Panda |
| ceo@rashmi.test | RML000001 | 1 / 1 | employee, ceo_cell | Arun Gupta (top of tree) |
| itadmin@rashmi.test | RML000010 | 10 / 10 | employee, it_admin | Sharique Khan |
| admin@rashmi.test | — | — / 12 | super_admin | no employee record |
| rgh.employee@rashmi.test | RGH000001 | 11 / 11 | employee | other company (RGH, org_unit 2) — use for cross-entity scope tests |

Org masters created: company RML(1)/RGH(2) (pre-seeded by migrations), locations Kharagpur(1)/Kharagpur RGH(2), plant KGP1, org units "RML Kharagpur"(1), "RGH Unit"(2), cost centre CC100, grade M1.
Seed script: /workspace/hrms-test/seed/qa-seed.ts (uses app's importEmsSeed + importGreythrEnrich, then sets status=active and org placement).
Also ran: npm run migrate, seed:rbac, seed:workflows, seed:settings.

Environment notes:
- Backend running on :5100 with RATE_LIMIT_AUTH_PER_IDENTIFIER=10000 RATE_LIMIT_AUTH_PER_ADDRESS=10000 RATE_LIMIT_GLOBAL_PER_ADDRESS=100000 (default auth limiter of 5/min keyed by IP|identifier made /auth/me return 429 after 5 calls — see bug report).
- Synthetic Kent swipes inserted into att.swipe_events for RML employees 1–16 Oct 2026 (door KGP-GATE1); recompute done for emp 7,8,9.
- Data already created by alpha worker: leave apps 1–4 (emp 8), AR/OD/permission requests, OT entry 1 approved, salary structures 1–3, salary assignments (emp 7,8,9,11), payroll runs 1 (Oct, inputs_locked) and 2 (Sep, inputs_locked) — compute currently returns 500.
- NOTE: alpha worker created separations for RGH000001 (emp 11) via IDOR test (filed by employee@). Travel trip 1 (emp 9) has an itinerary + advance added by emp 8 (IDOR test).
- NOTE: loan id 1 (₹5 crore, 0%, ACTIVE) created for emp 8 by self-apply test.
