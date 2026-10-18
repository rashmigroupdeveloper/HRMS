# Rashmi HRMS — Alpha + Beta Test Report
_Generated 18 Oct 2026 21:54 IST on the QA box (not the user laptop). Source: `/workspace/hrms.tgz` → `/workspace/hrms`._

## 1. Overall verdict

**NOT READY for UAT sign-off or production.** Recommended status: *internal QA / fix cycle*, then UAT.

Reasoning:
- **Build quality is good**: typecheck, lint, knip, depcruise and build pass in both projects; frontend 298/298 tests; backend 660 tests. But backend `npm run verify` is **non-deterministic** — first run failed (1 failing integration test + branch coverage 79.69% < 80% gate), second run passed (80.02%).
- **Critical authorization holes (IDOR)** in Resignation, Travel & Expense and Loans: any logged-in employee can resign on behalf of any other employee, read/modify other employees' trips and raise advances on them, and self-activate a ₹5 crore 0 % loan with no approval.
- **Payroll cannot be run end-to-end** on a fresh setup: compute is blocked (returns HTTP 500) until an attendance month lock exists, and the salary-snapshot statutory maths is wrong vs docs/10 (ESIC charged above the ₹21,000 ceiling and on a partial gross; employer EPF wrong; PT missing). CTC templates cannot derive BASIC from CTC. (The standalone `/payroll/statutory/estimate` engine does match all docs/10 golden cases G1–G5; the defect is in the seeded salary-structure formulas that drive the employee-visible breakup.) These match the client's own open complaints in “Pending Implementation (28 Aug)” (PF/ESIC/PT calc, probation 70/80/90 %, loan workflow).
- **UI payroll is fake**: the Payroll console, Parallel Run and My Pay pages are hard-coded mock data (no API calls) — every employee sees the same fake payslip. F&F settlement is ~100× too high (paise/rupee mix-up). Delegation lets an approver's report approve her own leave.
- **No notification delivery** (dev-log transport only; prod worker commented out) — every SOW “automated alert/reminder” item is effectively not delivered.
- Core daily flows that DO work well: login/logout/lockout, leave apply → approve/reject/send-back/resubmit/cancel with balance restoration, attendance processing from swipes (P/A/HD/late/OT), AR/OD/permission approvals, OT approval, manager-cannot-override rule, HR scoped override, month-lock checklist, audit chain.

## 2. Summary counts

| Severity | **Consolidated unique issues** | Alpha/code + API raw (A-xx) | Beta/UI raw (B-xx) |
|---|---|---|---|
| Critical | **8** | 4 | 6 |
| High | **13** | 7 | 12 |
| Medium | **15** | 10 | 12 |
| Low | **12** | 10 | 5 |
| **Total** | **48** | 31 | 35 |

The two workers independently found 14 of the same issues; the consolidated list (§5) merges duplicates and takes the higher severity.

SOW coverage (176 scored rows of “SOW Tracker .xlsx”): **Done 8 · Partial 106 · Broken 8 · Missing 16 · N/A vendor-service 38**. Software-applicable rows: 138; verified Done = 8 (6 %).

## 3. Test environment and config changes (no app source modified)

- Debian 13 box; Node **24.22.0** (per `.nvmrc`=24) at `/opt/node24`; PostgreSQL **17.11** (docs ask 16+). `npm ci` both projects.
- `backend/.env` rewritten for the box (laptop copy saved as `backend/.env.laptop.bak`): `DATABASE_URL=postgres://hrms:***@localhost:5432/hrms`, same `JWT_SECRET`, `TEST_DATABASE_URL` → dedicated `hrms_test` DB, removed `LOCAL_TEST_DATABASE_NAME` (laptop value makes the test runner throw — see A-29). Extra DB `hrms_migration_test` for `verify:migrations`.
- Ran `npm run migrate` (54 migrations), `seed:rbac`, `seed:workflows`, `seed:settings` on `hrms` and `hrms_test`.
- No seed for org/employees exists → QA seed `/workspace/hrms-test/seed/qa-seed.ts` (uses the app's own `importEmsSeed`/`importGreythrEnrich`), 12 users covering all 10 roles. Credentials: `/workspace/hrms-test/seed/USERS.md`.
- Backend dev server on :5100 started with `RATE_LIMIT_AUTH_PER_IDENTIFIER/ADDRESS/GLOBAL` raised, because the default auth limiter blocks normal multi-user use from one IP (bug A-05, reproduced on a separate default-config instance on :5101). Frontend dev server on :5173 (beta worker).
- Synthetic Kent swipes inserted into `att.swipe_events` (1–16 Oct 2026) since no biometric feed exists; recompute triggered via API.

## 4. Alpha results (build / static / tests)

| Project | Step | Result | Notes |
|---|---|---|---|
| backend | typecheck | PASS |  |
| backend | lint (type-aware) | PASS | 0 problems |
| backend | knip | PASS | 11 config hints only |
| backend | depcruise | PASS | 244 modules, 0 violations |
| backend | test:coverage (run 1) | **FAIL** | 659/660 pass; `workflow-scope.integration.test.ts` “rejects approval for a closed company-month…” found unexpected day_record; branches 79.69 % < 80 % threshold |
| backend | test:coverage (run 2, via `npm run verify`) | PASS | 660/660; statements 83.7 %, branches 80.02 % (knife-edge); flaky/state-dependent |
| backend | build | PASS |  |
| backend | verify:migrations | PASS | up→up→down-all→up on 54 migrations (needs MIGRATION_TEST_DATABASE_URL) |
| backend | npm audit (prod deps) | PASS | 0 vulnerabilities |
| frontend | typecheck / lint / knip | PASS |  |
| frontend | test | PASS | 32 files, 298 tests |
| frontend | build | PASS (warning) | single 950 kB JS chunk |
| frontend | npm run verify | PASS |  |
| frontend | npm audit | WARN | 17 dev-only advisories (2 critical vitest/tinypool, 12 high); no runtime deps |
| backend | tests with laptop .env | **FAIL** | globalSetup throws: LOCAL_TEST_DATABASE_NAME requires NODE_ENV=test; laptop config also targets the dev DB |

Logs: `/workspace/hrms-test/alpha/` (`summary.txt`, `be-*.log`, `fe-*.log`, `be-verify-full.log`, `fe-verify-full.log`).

## 5. Consolidated issue list (deduplicated, priority order)

| ID | Sev | Issue | Source IDs (details in §6 / §11) |
|---|---|---|---|
| C-01 | Critical | IDOR: any employee can file a resignation for any colleague (incl. other company); duplicates allowed; no resignation workflow; HR-head step 500; employee cannot view/withdraw own | B-04, B-10, A-01 |
| C-02 | Critical | IDOR in Travel & Expense and loan ledger: read/modify other employees' trips, advances, claims, wallet, loan ledger across companies | B-14, A-02, A-20 |
| C-03 | Critical | Loans: ineligible ₹1–5 Cr loans accepted, employee-chosen 0 % interest, status active immediately, no approval chain | B-06, A-03 |
| C-04 | Critical | Salary-structure statutory maths wrong (ESI above ₹21k ceiling, ER EPF wrong, PT missing); visible to employees. Standalone /statutory/estimate engine is correct | B-17, A-04 |
| C-05 | Critical | Payroll console & Parallel Run pages are hard-coded mocks — payroll cannot be run from UI; visible to employees | B-01 |
| C-06 | Critical | My Pay shows the same fake ₹57,999 payslip (RML035384) to every employee | B-02 |
| C-07 | Critical | Delegation to anyone incl. own report → delegate approves own leave (SoD break) | B-03, A-16 |
| C-08 | Critical | F&F settlement ~100× too high (paise/rupee mix-up) | B-05 |
| C-09 | High | Payroll compute/approve/finalize → 500; runs created without attendance lock | B-07, A-07 |
| C-10 | High | Loans & Claims mounted at /api/api/*; UI uses bare fetch without token → pages 404/empty | B-08, A-06 |
| C-11 | High | Claims submit 500 for every case; no document-upload endpoint → claims unusable | B-09 |
| C-12 | High | Probation: RM can take HR-head final decision; non-idempotent (duplicate letters) | B-11 |
| C-13 | High | Cancelling approved leave marks future days Absent | B-12, A-14 |
| C-14 | High | CEO cell sees individual salary history/breakup (should be aggregate only) | B-13, A-09 |
| C-15 | High | Travel: end<start trips, out-of-range items accepted; RM cannot approve advance (needs payroll perm); draft claim settled | B-15, A-21 |
| C-16 | High | hr_ops org-unit scope bypass in lifecycle (sees/acts on RGH separations, transfers) | B-16 |
| C-17 | High | Transfer: future-dated transfer applied immediately; RM steps skipped, HR ops alone completes | B-18 |
| C-18 | High | Auth rate limiter: /auth/me and /auth/refresh share an IP-wide 5/min bucket → normal use from shared office IP gets 429 | A-05 |
| C-19 | High | CTC templates: amount_rule ignored, no CTC variable (preview 500), probation-% assignment 500 | A-08 |
| C-20 | High | Unhandled 500s are never logged; business-rule violations surface as 500 (scope checks, settings, claims, payroll, lifecycle) | A-10, B-20, A-11, A-13 |
| C-21 | High | No e-mail transport (dev-log only) and prod worker/scheduler commented out in PM2 config → no alerts, accruals, snapshots | A-12 |
| C-22 | Medium | Pending leave cannot be withdrawn (only approved leave cancellable) | B-19 |
| C-23 | Medium | Onboarding reference data empty → convert form unusable in UI | B-21 |
| C-24 | Medium | Candidate duplicate check never flags; duplicate candidates created | B-22 |
| C-25 | Medium | Pre-join accepts invalid PAN / Aadhaar / IFSC | B-23 |
| C-26 | Medium | Attendance override allowed on future dates | B-24 |
| C-27 | Medium | Reports R29 helpdesk / R21 offers crash (JS TypeError, blank page) | B-25 |
| C-28 | Medium | CEO dashboard Manpower TOTAL 0, table overflow; empty until snapshot job runs | B-26 |
| C-29 | Medium | Leavers/attrition include pending/unapproved separations | B-27 |
| C-30 | Medium | it_admin cannot complete its own onboarding/exit tasks or IT clearance | B-28 |
| C-31 | Medium | Recruitment/ATS module not implemented (placeholder page, no backend) | B-29 |
| C-32 | Medium | super_admin without employee record: ESS pages 400/404, travel wallet 500 | B-30, A-22 |
| C-33 | Medium | Policy settings, salary structures/components/preview readable by every user | B-31, A-17 |
| C-34 | Medium | No password change/reset, no admin user lifecycle (forgot-password is a mailto link) | B-32, A-15 |
| C-35 | Medium | hr_ops has no access to probation board | A-18 |
| C-36 | Medium | Backend test suite flaky and branch coverage at 80 % edge → `npm run verify` non-deterministic | A-19 |
| C-37 | Low | Dates without year / raw ISO strings (probation reviews, travel table) | B-33 |
| C-38 | Low | plant_head nav shows Lifecycle, every call 403 | B-34 |
| C-39 | Low | 401 refresh + 404 console error on every cold load | B-35 |
| C-40 | Low | Raw Postgres error text leaked to client | A-23 |
| C-41 | Low | LWP balance shows available = -1 | A-24 |
| C-42 | Low | 5-minute OT displayed on normal days | A-25 |
| C-43 | Low | Permission requests labelled “regularization / full_day” in inbox | A-26 |
| C-44 | Low | Refresh-token reuse does not revoke family; login timing oracle for unknown users | A-27 |
| C-45 | Low | Frontend dev-dependency audit: 17 advisories (2 critical, dev-only) | A-28 |
| C-46 | Low | Laptop .env makes backend test runner throw | A-29 |
| C-47 | Low | Single 950 kB frontend bundle | A-30 |
| C-48 | Low | Employee importer sets status onboarding, no org assignment; no import/org-master UI | A-31 |

## 6. Alpha/code-review bug table (A-xx, full detail)

Evidence files: `/workspace/hrms-test/evidence/readonly-evidence.txt` (API responses), `A-05-auth-me-429.txt`, `early-beta-findings.md`; scripts in `/workspace/hrms-test/api/`; GET permission matrix `/workspace/hrms-test/api/get-matrix.tsv`.

| ID | Sev | Role | Module | Steps to reproduce | Expected | Actual | Evidence | Likely file / cause |
|---|---|---|---|---|---|---|---|---|
| A-01 | Critical | employee (any) | Lifecycle / Separation | As employee@ POST /api/lifecycle/separations/apply {"employeeId":11,"reason":"...","requestedLwd":"2027-03-31"} | 403 — employee may only resign for self; one open resignation; workflow started | 200, separation id 1 created for another company's employee; duplicate id 2 also accepted; workflowRequestId=null so approval chain never starts (HR head inbox empty) | /workspace/hrms-test/api/ (API log in report §Role results); DB core.separations ids 1,2 | separation.router.ts:86 uses `authed` and trusts body employeeId; separation.service.ts:69-115 has no ownership/duplicate check and never creates wf request |
| A-02 | Critical | employee (any) | Travel & Expense | As employee@: GET /api/travel/trips?employeeId=9; as RGH employee GET /api/travel/trips/1; as employee@ POST /travel/trips/1/itineraries and POST /travel/advances {"tripId":1,"amountPaise":5000000}; GET /travel/wallet?employeeId=9 | Only own trips/wallet; cannot modify or claim against others' trips | All 200: read other employees' trips/wallet across companies, added flight to another employee's trip, raised ₹50,000 advance on another employee's trip; super_admin list returns all trips | /workspace/hrms-test/api/t_idor.py output | travel.router.ts: every procedure is `authed` only, employeeId taken from query, no owner/scope check in TravelService |
| A-03 | Critical | employee | Loans | POST /api/api/loans/apply {"loanType":"loan_diminishing","principalRupees":50000000,"annualInterestRate":0,"tenureMonths":60} | Loan request routed RM→HR Head→Payroll (wf def "loan"), eligibility capped (SOW: linked to Basic), interest per policy | 200 {"loanId":1,"monthlyEmiRupees":833333.33}; loan status "active" immediately, employee chose 0% interest, no limit, no approval | /workspace/hrms-test/api/ (API) ; GET /api/api/loans/my | loans.router.ts apply → LoansService creates active loan; workflow "loan" never used; no eligibility rule |
| A-04 | Critical | payroll_admin | Payroll statutory calc | POST /payroll/structures/preview (or salary assign) for G1 baseline (Basic 32,286; gross ≈64,303) and low-wage (Basic 9,000; gross 18,436) | Per docs/10: ESIC 0 above ₹21,000 gross; ESIC EE 0.75%/ER 3.25% of FULL gross (139/600 for 18,436); ER EPF = 12%×PF wages − EPS (2,624 for G1); PT per WB slab (₹200) | G1: ESI_EE 395, ESI_ER 1,709 (charged above ceiling); PF_ER 1,185. Low wage: ESI_EE 102, ESI_ER 439 (computed on Basic+HRA only, before SPECIAL_ALLOW). PT absent from snapshot. Same wrong values persisted in pay.employee_salaries snapshot | /workspace/hrms-test/api/t_pay2.py, t_pay3.py output | dag-evaluator.ts resolveSalaryStructure: GROSS evaluated mid-DAG before SPECIAL_ALLOW balancing; component formulas ESI "GROSS*0.0075" with no ceiling gate; PF_ER "PF_WAGES*0.0367" instead of 12%−EPS |
| A-05 | High | all | Auth / rate limiting | Call GET /api/auth/me 6+ times within a minute from one IP (any users) | Per-user/session limit for authenticated calls | 6th call → 429 "Too many attempts for this account" — /auth/me and /auth/refresh share one bucket "IP\|<none>" for ALL users behind same IP (plants behind NAT ⇒ mass logouts) | /workspace/hrms-test/api/get-matrix.tsv (first sweep showed 429 on /auth/me) | app.ts:161-165 applies login limiter (5/min, identifierKey) to whole /api/auth incl. me/refresh/logout |
| A-06 | High | employee / payroll | Loans & Claims UI + API routing | Open My Pay → Loans / My Claims, or GET /api/loans/my | Pages load own loans/claims | Backend serves these at /api/api/loans/* and /api/api/claims/* (procedure paths start with /api); /api/loans/my → 404 HTML. Frontend uses raw fetch() without Authorization header → would 401 even at right path | /workspace/hrms-test/api/get-matrix.tsv rows /api/claims/*, /api/loans/* | loans.router.ts / claims.router.ts route paths prefixed "/api"; LoansPage.tsx:125-283, ClaimsPage.tsx:120-271 use fetch() not apiFetch() |
| A-07 | High | payroll_admin | Payroll run | Create run (no attendance lock) → lockInputs → compute | Clear 400 "Attendance month must be locked first" (and create should require/attach lock) | create & lockInputs succeed; compute returns HTTP 500 "Internal server error" with no message; nothing logged | /workspace/hrms-test/diag/compute.ts output | run-compute.service.ts:42 throws plain Error → oRPC 500; run.router create does not require attendance_lock_id |
| A-08 | High | payroll_admin | Compensation structuring | Create structure with BASIC amount_rule "CTC_MONTHLY * 0.40" / formula "CTC*0.4" and preview | BASIC derived from CTC (template-based auto CTC structuring, SOW 3.2b; probation 70/80/90%) | amount_rule silently ignored; no CTC variable in formula context → preview 500; only hard-coded BASIC works, i.e. one structure per salary. Salary assign with phase=probation,probation_percent=80 → 500 | t_pay1/t_pay2/t_pay3 output | structure.service.ts assembleComponentNodes drops amount_rule; dag-evaluator evalContext lacks CTC |
| A-09 | High | ceo_cell | Compensation privacy | As ceo@ GET /payroll/salaries/history/8 | docs/08: ceo_cell compensation = aggregate only | 200 with full individual monthly component breakup | t_pay3 output | salary router allows compensation.read scope regardless of "agg only" note |
| A-10 | High | all | Observability / error handling | Trigger any server error (e.g. A-07, A-11) | Error logged with stack + request id; business errors as 4xx | No log line at all for oRPC 500s; many business-rule violations surface as 500 | backend.log has no level 50 entries after multiple 500s | api/handler.ts OpenAPIHandler has no onError interceptor; services throw plain Error |
| A-12 | High | ops | Notifications / jobs | Inspect notification transport and PM2 config | SMTP delivery for alerts (absence, probation, policy nag, approvals) and scheduled worker in production | Only DevLogTransport exists (no SMTP); ecosystem.config.cjs has hrms-worker/scheduler commented out ⇒ accrual, escalations, OT lapse, absence scan, KPI snapshot never run in prod | notifications.service.ts:2-31; ecosystem.config.cjs:26-36 | Not implemented |
| A-11 | Medium | hr_ops | RBAC scope | As hrops@ (scoped to RML org unit) POST /leave/adjustments for RGH employee id 11 | 403 out of scope | 500 Internal server error (blocked, but wrong status, no message) | t_leave.py output | core/rbac/employee-scope.ts:54 throws plain Error instead of ORPCError FORBIDDEN |
| A-13 | Medium | payroll_admin | Salary assignment | Assign RML structure 2 to RGH employee id 11 | Reject cross-company structure | 200 accepted | t_pay3 output | salary.service.ts assignSalary lacks company match check |
| A-14 | Medium | employee | Attendance / Leave | Approve leave 26–27 Oct, then cancel it and approve cancellation; GET /my/attendance?month=2026-10 | Future days stay unresolved | Day records created with status "A" for future dates 26/27 Oct | t_leave / t_wf output | leave cancel domain hook writes day_records for future dates |
| A-15 | Medium | all | Auth | Review: no change-password / forgot-password API or UI; no it_admin user create/deactivate/reset endpoint | Self-service password change, HR/IT reset, forced change on first login (imported EMS hashes) | Login page only has mailto "Forgot password? Email HR Ops"; password_reset_tokens table unused; only scripts/create-admin.ts | frontend/src/pages/auth/LoginPage.tsx:287-290; routes.txt | Not implemented |
| A-16 | Medium | any user | Workflows | PUT /workflows/delegations {"toUserId":<anyone>,...} | Delegate only to eligible active user in scope; fromDate<=toDate | Any user id accepted, no date-order check | workflows.router.ts:216-245 (code review) | No validation |
| A-17 | Medium | employee / it_admin | Payroll data exposure | GET /payroll/components, /payroll/structures, POST /payroll/structures/preview as employee or it_admin | Restricted to salary.write/payroll roles (docs/08: it_admin never compensation) | 200 for every authenticated user | get-matrix.tsv | component.router.ts / structure.router.ts list/get/preview use `authed` |
| A-18 | Medium | hr_ops | Lifecycle / Probation | As hrops@ GET /lifecycle/probation/alerts, /reviews | hr_ops nav includes probation board (docs/08 §3) | 403 Missing permission lifecycle.confirmation.approve | get-matrix.tsv | RBAC seed: hr_ops lacks confirmation permission |
| A-19 | Medium | alpha | Test suite | Run `npm run verify` (backend) twice on fresh test DB | Deterministic green | Run 1: 1 failed test (workflow-scope "closed company-month" found a future day_record id 54) + branch coverage 79.69% < 80% ⇒ verify FAILS; Run 2: 660/660 pass, branches 80.02% ⇒ verify passes. Isolated reruns pass 5/5 | /workspace/hrms-test/alpha/be-test:coverage.log, be-verify-full.log | State/order-dependent integration test; coverage on knife-edge of threshold |
| A-20 | Medium | loans | Loans API | GET loan ledger | Reachable route with owner check | Declared as "/api/loans/:id/ledger" (Express syntax) with input loanId → unreachable (400 loanId required); no ownership check in handler | loans.router.ts:176-200 | Wrong oRPC path syntax |
| A-21 | Medium | travel | Travel approval | Approve travel advance as reporting manager | RM→FM workflow (wf def travel_advance_domestic) | Approve endpoint requires payroll.run.manage | t_idor.py output | travel.router.ts approve uses payroll permission |
| A-22 | Low | super_admin | Travel | GET /travel/wallet as admin@ (no employee) | Empty/400 | 500 | get-matrix.tsv | null employee_id not handled |
| A-23 | Low | hr_ops / employee | Validation messages | Leave adjustment delta 99999; leave fromDate 2026-02-30 | Friendly 400 | Raw Postgres text leaked: "numeric field overflow", "date/time field value out of range" | t_leave.py output | DB errors passed through asBadRequest |
| A-24 | Low | employee | Leave UI/API | Apply LWP 1 day; GET /leave/balances | LWP shows unlimited/not negative | available = -1 | t_leave.py | balance calc for unpaid type |
| A-25 | Low | employee | Attendance | GET /my/attendance on normal days (out 18:05) | otMinutes 0 below 30-min threshold | otMinutes 5 shown each day (OT entry correctly not created) | t_att output | day OT minutes not thresholded |
| A-26 | Low | manager | Approvals inbox | Raise PERMISSION request | Shown as Permission with times | Inbox type "regularization", dayPortion "full_day" | t_att output | request kind mapping |
| A-27 | Low | security | Auth hardening | Code review | Refresh-token reuse detection; constant-time login for unknown ids | Stale refresh just rejected (family not revoked); unknown identifier skips bcrypt (timing oracle) | auth.sessions.ts, auth.service.ts | Hardening gaps |
| A-28 | Low | dev | Frontend deps | npm audit (frontend) | No known vulns | 17 dev-only advisories (2 critical: vitest/tinypool, 12 high) — no runtime deps affected; backend prod deps clean | npm audit output | Update vitest/knip/vite toolchain |
| A-29 | Low | dev | Config | Use laptop backend/.env as-is for tests (NODE_ENV=development, LOCAL_TEST_DATABASE_NAME=hrms, TEST_DATABASE_URL=…/hrms) | Tests run or clear guidance | vitest globalSetup throws "explicitly declared local test database must match a loopback test target" (requires NODE_ENV=test) — laptop config cannot run tests and points tests at the dev DB | alpha notes | tests/test-database-target.ts |
| A-30 | Low | perf | Frontend build | vite build | Code-split bundle | Single 950 kB JS chunk (257 kB gz) — Vite >500 kB warning | fe-build.log | No route-level lazy loading |
| A-31 | Low | data | Employee import | importEmsSeed | Imported active staff land as active | All imported employees get status "onboarding" (default) and no org unit/location/plant; there is no route/UI to run the import or maintain org masters (departments, locations, plants, grades, org units) | qa-seed.ts notes | import.service.ts; no org-master API |

Beta/UI bugs are listed in §11 (merged from `beta/BETA_REPORT.md`) with their own IDs.

## 7. Role-by-role results

Combined view (beta pass/fail counts from §11; UI crawl = 57 routes per role: healthy / correctly 403-gated / broken).

| Role | Beta API pass/fail | Beta UI pages | Beta UI flows pass/fail |
|---|---|---|---|
| employee | 145 / 22 | 27 / 23 / 5 | 6 / 3 |
| manager | 33 / 5 | 39 / 11 / 5 | 2 / 0 |
| senior_manager | 4 / 0 | 39 / 11 / 5 | 1 / 0 |
| hr_ops | 50 / 8 | 42 / 7 / 6 | 0 / 1 |
| hr_head | 15 / 1 | 47 / 3 / 5 | 0 / 2 |
| payroll_admin | 8 / 6 | 34 / 17 / 4 | 1 / 1 |
| plant_head | 2 / 0 | 39 / 11 / 5 | 0 / 1 |
| ceo_cell | 4 / 2 | 40 / 9 / 6 | 0 / 2 |
| it_admin | 13 / 2 | 34 / 17 / 4 | 1 / 0 |
| super_admin | 6 / 1 | 42 / 0 / 13 | 0 / 1 |

Alpha worker API findings per role:

| Role / user | Worked | Failed / concerns |
|---|---|---|
| employee (employee@) | Login, ESS dashboard, leave apply (all validations), cancel, attendance view, AR/OD/permission requests, own salary view (unmasked own PAN), OT view, helpdesk categories | Can file resignation for others (A-01), read/modify others' trips (A-02), self-activate unlimited loan (A-03); sees pay structures (A-17); Loans/Claims UI path broken (A-06) |
| manager (manager@) | Inbox; approve/reject (reason enforced)/send-back; OT decide with cap; team grid & team day view; blocked from boss's data and from attendance override | — |
| senior_manager (srmanager@) | Subtree team grid; correctly cannot act on step owned by direct manager | No skip-level visibility of pending approvals (by design of chain) |
| hr_ops (hrops@, org-unit scoped) | Leave adjustments, attendance override within scope; blocked outside scope | Out-of-scope → 500 not 403 (A-11); no probation board access (A-18); month-lock correctly denied |
| hr_head (hrhead@) | Month-lock checklist, salary assign, runs list (read), templates, audit | Cannot create payroll runs (by design R) |
| payroll_admin (payroll@) | Structures, salary assignment, run create/lockInputs, month-lock attempt (correctly blocked by checklist) | Compute 500 (A-07); statutory calc errors (A-04); CTC templates (A-08); cross-company assign (A-13) |
| plant_head (planthead@) | Dashboards (BU/HR), reports r21–r31 (200) | — |
| ceo_cell (ceo@) | Login, executive leavers; executive dashboard needs snapshot rebuild (404 message) | Individual salary history visible (A-09) |
| it_admin (itadmin@) | Recompute, devices, RBAC matrix/users, audit | Can read salary structures/preview (A-17); no user create/reset API (A-15) |
| super_admin (admin@, no employee) | All admin GETs | ESS endpoints 400/404 (expected); travel wallet 500 (A-22); sees all trips |
| cross-entity employee (rgh.employee@) | Login; blocked from RML workflow requests | Could read RML trip (A-02). Account later locked by beta lockout test (lockout works) |

Full UI role walkthroughs with screenshots: see §11 (beta) and `/workspace/hrms-test/beta/screenshots/`.

## 8. SOW coverage (SOW Tracker .xlsx — “PROTIVITI SOW”, 176 scored rows)

Legend: **Done** = verified working on this box; **Partial** = code/route exists but incomplete, defective or not verifiable end-to-end here; **Broken** = observed failing; **Missing** = no implementation found; **N/A-Service** = vendor/manual service obligation (EPFO/ESIC portal work, TATs), not software. Client's own sheet scores 93 % complete; this assessment is far lower.

| # | Section | SOW item | Client sheet (Protiviti/RML) | QA verdict | Evidence / reason |
|---|---|---|---|---|---|
| 003 | 1.One Time setup | perform changes on software as per client policies and requirements. | 0.5/0.5 | Partial | Policies configurable via /settings (29 keys) + workflow defs; many client policies (PF wage base, PT, ESIC) not applied correctly in salary engine |
| 004 | 1.One Time setup | Setup of client, employees and compensation master | 1/1 | Partial | Companies seeded (13); NO API/UI to create org units/departments/locations/plants/grades; employees only via importEmsSeed (no route) or candidate convert; importer leaves status=onboarding |
| 005 | 1.One Time setup | Transfer of data for the previous months of the current financial year, the previous financial year any prior financial year before that as  | 1/1 | Missing | Parallel-run importRegister/loadYtd routes exist but no historical data migration delivered/verifiable on box; plans state Adrenalin/greytHR transfer not accepted |
| 008 | 2.1Employee Data Management | Management of centralized repository for employee master data, including personal, employment,  and financial details. | 1/1 | Partial | GET /employees, /employees/{ecode}, /employees/me work with masking; no employee master edit endpoint (employee.write unused by any route) |
| 009 | 2.1Employee Data Management | Providing secure access controls based on roles and permissions | 1/1 | Broken | RBAC exists and mostly enforced, but CRITICAL IDORs: resignation for any employee, travel trips/advances/wallet of others, self-approved ₹5 Cr loan; CEO sees individual salary history |
| 010 | 2.1Employee Data Management | Integration with other Systems, as necessary. | 1/1 | Partial | Kent sync guarded (503 when unconfigured), ATS/SSO and SAP not integrated |
| 012 | 2.2Compensation Structuring on Tool | Defining multiple pay structures based on grades, job levels, and locations. | 1/1 | Partial | Structures per company exist (/payroll/structures); no grade/level/location dimension on structure |
| 013 | 2.2Compensation Structuring on Tool | handling basic pay, allowances, deductions, reimbursements, and performance-linked incentives. | 1/1 | Partial | Component catalogue (earning/deduction/employer) exists; performance incentives/reimbursement components not wired; amount_rule ignored |
| 014 | 2.2Compensation Structuring on Tool | customization for CTC breakup, flexi-benefits, and perquisites | 1/1 | Broken | CTC breakup preview works only with fixed BASIC; BASIC cannot be derived from CTC (no CTC variable) -> 500; ESIC/PF_ER wrong; flexi-benefits absent |
| 016 | 2.3Policy Enforcement & Compliance Track | Platform automated policy updates on portal and employee communication | 1/1 | Partial | Policies publish (/policies), nag endpoint; delivery of notifications (SMTP) not configured |
| 017 | 2.3Policy Enforcement & Compliance Track | Platform real-time tracking of policy adherence | 1/1 | Partial | ack-status/ack-report endpoints exist (200) |
| 018 | 2.3Policy Enforcement & Compliance Track | Real-Time Policy Acknowledgement Tracking and automated alerts for non-compliance . | 1/1 | Partial | ack tracking + /policies/nag; automated alerts depend on unconfigured mail |
| 019 | 2.3Policy Enforcement & Compliance Track | Platform Dashboard for HR and management reporting. | 0/0 | Partial | /dashboards/hr-ops & business-unit return 200; executive dashboard 404 until snapshot rebuilt |
| 022 | 3.1Offer Management | Generation of offer letter and approvals. | 0.7/0.7 | Missing | No offer-letter generation/approval (LOI chain) in HRMS; r21-offers report only; ATS not integrated |
| 023 | 3.1Offer Management | Tracking appointment letters. | 1/1 | Partial | appointment letter template exists (/letters/templates); issuance not verified end-to-end |
| 025 | 3.2Onboarding & Employee Engagement | Updation of candidate information by capturing through personal email. | 1/1 | Partial | Prejoin token portal (/lifecycle/prejoin/*) exists; email delivery not configured |
| 026 | 3.2Onboarding & Employee Engagement | Platform auto CTC structuring based on predefined templates. | 1/1 | Broken | Template-based auto CTC structuring not workable (amount_rule ignored, no CTC variable, probation assign 500) |
| 027 | 3.2Onboarding & Employee Engagement | Management of flexi-basket benefits and reimbursements. | 1/1 | Missing | No flexi-basket backend (0 backend references); claims module deferred |
| 028 | 3.2Onboarding & Employee Engagement | Employee investment declarations for tax planning. | 1/1 | Partial | declareInvestment/verifyDeclaration/projectTds routes exist; not verified end-to-end |
| 029 | 3.2Onboarding & Employee Engagement | Employee loan processing on ESS portal and approval workflow . | 1/1 | Broken | Loan apply activates immediately with no approval/eligibility; Loans UI calls wrong path without auth (404) |
| 030 | 3.2Onboarding & Employee Engagement | Payslip and tax sheet generation for onboarding employees. | 1/1 | Partial | Payslip routes exist (generateRunPayslips/getMyPayslip); payroll compute blocked (500) without attendance lock; tax sheet not verified |
| 031 | 3.2Onboarding & Employee Engagement | capturing previous employment details. | 1/1 | Partial | Prejoin form captures data; previous employment/Form 12B handling not verified |
| 033 | 3.3Employee Confirmation Process | Probation review tracking and automated reminders | 0.7/0.7 | Partial | probation alerts/reviews/evaluate/decide exist; hr_ops lacks access (403); reminders depend on mail |
| 034 | 3.3Employee Confirmation Process | Updating multi-level approval workflows for employee confirmation | 0.7/0.7 | Partial | confirmation workflow def RM->HR head exists; not exercised end-to-end |
| 036 | 3.4Employee Transfers | Platform automated workflow for internal department/location transfers. | 1/1 | Partial | /lifecycle/transfers create/approve/reject exist; not verified end-to-end by alpha |
| 037 | 3.4Employee Transfers | Platform-driven approvals and documentation updates. | 1/1 | Partial | Transfer approvals exist; documentation update not verified |
| 038 | 3.4Employee Transfers | compensation and role change updates in HRMS. | 1/1 | Partial | Transfer has target grade/designation; compensation change via separate salary assign |
| 040 | 3.5Employee Separation & Exit Management | • Resignation initiation, tracking, and approval workflows. | 1/1 | Broken | Resignation apply has no ownership check (IDOR), duplicate filing allowed, no workflow request created (resignation chain never starts) |
| 041 | 3.5Employee Separation & Exit Management | • Digital clearance process across departments (IT, Admin, Finance) | 1/1 | Partial | /lifecycle/clearances list/update exist |
| 042 | 3.5Employee Separation & Exit Management | • Final settlement and compliance with statutory requirements. | 0.7/0.7 | Partial | compute-fnf/pay routes + gratuity calculator exist; not verifiable (no approved separation flow) |
| 044 | 3.6Employee Letters Management | • Generation of various employee-related letters, including:  o Experience letters  o Relieving letters  o Salary certificates | 1/1 | Partial | experience/relieving/salary-certificate templates exist; issue/content routes exist |
| 047 | Shift Management | Defining and configuring multiple shift types (fixed, rotational, flexible, night shifts, etc.). | 1/1 | Done | 4 shifts seeded (GEN, G5 two-session, GCS, NIGHT crosses midnight); PUT /attendance/config/shifts/{code} |
| 048 | Shift Management | Platform automated shift scheduling and roster management. | 1/1 | Partial | Roster GET/PUT exist; rotational auto-scheduling not observed |
| 049 | Shift Management | Integration with biometric systems. | 1/1 | Partial | Kent ingestion code exists; real device integration not configured (sync 503 by design) |
| 051 | Attendance Tracking | management of real-time biometric attendance integration in system. | 1/1 | Partial | Swipe processing verified with synthetic swipes (P/A/HD/late/OT computed correctly); live Kent feed not available |
| 052 | Attendance Tracking | integration with access control systems for seamless tracking. | 1/1 | Partial | Same as above; door/device health present |
| 053 | Attendance Tracking | Platform automated late coming and early leaving reports. | 1/1 | Partial | late/early minutes computed (late 40 on 5 Oct); r4-exceptions report exists (needs params) |
| 054 | Attendance Tracking | Platform alerts for absenteeism, regularization requests, and policy violations | 1/1 | Partial | Absence cases scan/stage/letter exist; alerts depend on mail delivery |
| 056 | Leave Management | Configuration of leave types (annual, sick, maternity, casual, etc.). | 1/1 | Done | 7 leave types (CL, SL, EL, ML, CO, LWP, Election) with gender applicability, max/request, half-day — verified |
| 057 | Leave Management | holiday calendar configuration by location and department. | 1/1 | Partial | Holidays by location supported; by department not supported |
| 058 | Leave Management | • leave request and approval workflows with multi-level authorizations. | 1/1 | Done | Apply/approve/reject/send-back/resubmit/cancel verified; multi-level supported via workflow defs |
| 059 | Leave Management | Platform automated leave balance tracking and accruals. | 1/1 | Partial | Balances/ledger verified; accrual job exists (admin.integrations); EL service gating not verified |
| 060 | Leave Management | Leave encashment and carry-forward policies | 1/1 | Partial | /leave/encashments and year-end carry-forward routes exist; not verified |
| 062 | Overtime & Comp-Offs Management | • overtime tracking based on pre-approved policies. | 0.5/0.5 | Done | OT detected (150 min) from swipes, below-threshold ignored for entries, approval with cap verified |
| 063 | Overtime & Comp-Offs Management | Platform auto-calculation of compensatory offs and extra working hours. | 1/1 | Partial | convert_comp_off action exists; not verified |
| 064 | Overtime & Comp-Offs Management | approval workflows for overtime requests. | 1/1 | Done | Manager OT approve verified; employee blocked (403) |
| 065 | Overtime & Comp-Offs Management | integration with payroll for overtime | 1/1 | Partial | OT component exists; payroll compute blocked so OT pay not verifiable |
| 067 | Attendance Policy & Compliance | enforcement of attendance policies (minimum working hours, grace period, break time tracking). | 1/1 | Done | Grace/min hours/half-day applied: early-out -> HD, missed punch -> A, permission regularised |
| 068 | Attendance Policy & Compliance | Platform automated deductions and penalties for attendance violations. | 1/1 | Partial | Late slabs config exists (empty by default); penalty deduction into payroll not verifiable |
| 069 | Attendance Policy & Compliance | Preparation of reports and dashboards for HR and management monitoring. | 0/None | Partial | Muster, r2..r6 reports exist; require params; content not verified by alpha |
| 072 | 5.1 Payroll Processing | Payroll Inputs Collection & Validation: Protiviti manages payroll inputs (new joiners, salary revisions, variable pay, deductions, loss of p | 1/1 | Partial | Run create/lockInputs work; input validation of joiners/revisions not verified |
| 073 | 5.1 Payroll Processing | Investment & flexi declarations: Tax computation based on employee declarations via ESS portal | 1/1 | Partial | Declarations + TDS projection routes exist; not verified |
| 074 | 5.1 Payroll Processing | • Payroll processing & review:  o Salary calculations with deductions and allowances.  o Draft payroll reports for approval.  o Final payrol | 1/1 | Broken | Payroll compute returns HTTP 500 (attendance lock guard surfaced as 500); salary snapshot statutory errors (ESIC above ceiling, PF_ER) |
| 075 | 5.1 Payroll Processing | Performing Payroll deliverables:  o Final Pay Register.  o Bank Transfer File.  o Journal Voucher Report.  o Payslip & Tax computation slip  | 1/1 | Partial | Bank file / SAP JV / payslip / variance routes exist; cannot run without computed run |
| 076 | 5.1 Payroll Processing | Preparation of standard & customized Reports:  o Standard: TDS report, PF report, PT report, ESIC report, LWF report, Variance report, CTC r | 1/1 | Partial | ECR, ESIC return, PTRC, Form D generators exist; TDS/LWF reports & Form 16 missing |
| 077 | 5.1 Payroll Processing | • Calculation of OT(Over Time) charges and cross verifying with the attendance system and validate the OT charge | 1/1 | Partial | OT entries approved; OT pay not verifiable |
| 078 | 5.1 Payroll Processing | • Protiviti should Handle the payroll Queries | 1/1 | N/A-Service | Vendor service; helpdesk ticketing exists for queries |
| 079 | 5.1 Payroll Processing | Protiviti should Validate attendance by verifying data or biometric records | 1/1 | Partial | Attendance validation via muster/month-lock checklist (verified blocks incomplete month) |
| 081 | 5.2 Verification of Inputs | • The Protiviti should handle the end-to-end payroll process, from collecting inputs to preparing the final register | 1/1 | Partial | End-to-end run pipeline code exists but compute blocked; see 074 |
| 082 | 5.2 Verification of Inputs | Effective date of salary revision. | 1/1 | Partial | Effective-dated salary assignment with retro months verified |
| 083 | 5.2 Verification of Inputs | Duplication of Employee Code / Number / ID. | 1/1 | Done | Unique ecode constraint + importer series check |
| 084 | 5.2 Verification of Inputs | Whether any employees are minor based on the date of birth. | 1/1 | Missing | No minor-age (DOB) check found in code |
| 085 | 5.2 Verification of Inputs | Length of bank account. | 1/1 | Missing | No bank account length validation found |
| 086 | 5.2 Verification of Inputs | IFSC code. | 1/1 | Partial | IFSC referenced in code/UI; validation not verified |
| 087 | 5.2 Verification of Inputs | Permanent Account Number (PAN). | 1/1 | Missing | No PAN format validation found |
| 088 | 5.2 Verification of Inputs | Aadhaar number. | 1/1 | Missing | No Aadhaar validation found |
| 089 | 5.2 Verification of Inputs | Duplication of ESI number. | 1/1 | Missing | No duplicate ESI IP number check found |
| 090 | 5.2 Verification of Inputs | Check that the CTC matches with break up shared by the Rashmi Metaliks Limited | 1/1 | Partial | validateCtcBreakup exists (diffPaise) but statutory components wrong |
| 091 | 5.2 Verification of Inputs | Identification of duplicate inputs. | 1/1 | Missing | No duplicate-input detection found for payroll inputs |
| 092 | 5.2 Verification of Inputs | Special Character for designation, Department - like" & " , ' ". These are not accepted and would be removed. | 1/1 | Missing | No special-character sanitisation found |
| 093 | 5.2 Verification of Inputs | Check whether an employee is in Active or Inactive statusfor variable inputs. | 1/1 | Partial | Run population filters by status (not verified) |
| 095 | 5.3 Entity Transfer of Employes | Payroll Input | 1/1 | Partial | Entity transfer: transfers module; payroll entity switch not verified |
| 096 | 5.3 Entity Transfer of Employes | Draft Pay sheet | 1/1 | Partial | Draft pay sheet = review step; blocked by compute |
| 097 | 5.3 Entity Transfer of Employes | Observations if any | 1/1 | Partial | Variance report route exists |
| 098 | 5.3 Entity Transfer of Employes | Finaly pay Register | 1/1 | Partial | Register via outputs; blocked |
| 099 | 5.3 Entity Transfer of Employes | Bank Transfer File | 1/1 | Partial | Bank file generator exists; blocked |
| 100 | 5.3 Entity Transfer of Employes | Payslip and Tax planner | 1/1 | Partial | Payslip exists; tax planner not found |
| 101 | 5.3 Entity Transfer of Employes | JV report, Standard report and Customised Reports | 1/1 | Partial | SAP JV exists; custom reports partial |
| 103 | 5.4 Pro rating Salary / Calculation of A | Mid-month new joiner | 1/1 | Partial | proration.ts exists; not verifiable |
| 104 | 5.4 Pro rating Salary / Calculation of A | Mid-month leaver | 1/1 | Partial | proration.ts exists; not verifiable |
| 105 | 5.4 Pro rating Salary / Calculation of A | Loss of Pay calculations | 1/1 | Partial | LOP from attendance in code; not verifiable |
| 106 | 5.4 Pro rating Salary / Calculation of A | Loss of Pay reversals | 1/1 | Partial | arrears.ts exists; not verifiable |
| 107 | 5.4 Pro rating Salary / Calculation of A | Previous month Loss of Pay | 1/1 | Partial | arrears.ts exists; not verifiable |
| 109 | 5.4 Pro rating Salary / Calculation of A | Actual calendar days in the month | 1/1 | Partial | Proration modes in code; not verifiable |
| 110 | 5.4 Pro rating Salary / Calculation of A | Actual calendar days in the month less weekends | 1/1 | Partial | Proration modes in code; not verifiable |
| 111 | 5.4 Pro rating Salary / Calculation of A | Fixed days like 30, 31 (this cannot change between months) without decimals. | 1/1 | Partial | Proration modes in code; not verifiable |
| 113 | Pro rating the salary based on the follo | Actual calendar days less alternate weekends | 1/1 | N/A-Service | SOW states not possible (scope exclusion) |
| 114 | Pro rating the salary based on the follo | Actual calendar days less holidays | 1/1 | N/A-Service | SOW states not possible (scope exclusion) |
| 115 | Pro rating the salary based on the follo | Fixed days that vary month on month. | 1/1 | N/A-Service | SOW states not possible (scope exclusion) |
| 116 | Pro rating the salary based on the follo | If the period for which salary is pro rated pertains to the period prior to go live with vendor, then the client would need provide arrear b | 1/1 | Partial | Retro months computed on back-dated assignment; arrear input path not verified |
| 118 | 5.5 Loans and Advances | Vendor would handle the Loan scheduler with the following options: | 0.7/0.7 | Broken | Loan scheduler exists but loans activate without approval; UI broken (wrong path/no auth) |
| 119 | 5.5 Loans and Advances | Diminishing | 1/1 | Partial | loan_diminishing type works via API (/api/api/loans) |
| 120 | 5.5 Loans and Advances | Flat | 1/1 | Partial | loan_flat type exists |
| 121 | 5.5 Loans and Advances | Only EMI without Interest | 1/1 | Partial | emi_no_interest type exists |
| 122 | 5.5 Loans and Advances | vendor would calculate perquisites as per SBI lending rates. This is applicable only if the client provides the loan input to be recovered u | 1/1 | Partial | Perquisite code exists (6 refs); SBI rate source not verified |
| 123 | 5.5 Loans and Advances | In order to claim tax exemption for Home Loan & Interest employees would need to submit relevant proof to claim under Section 24 during end  | 1/1 | Partial | Investment declaration supports proofs (not verified) |
| 124 | 5.5 Loans and Advances | Deductions against Salary advance should be provided as monthly inputs. | 1/1 | Partial | salary_advance type exists |
| 125 | 5.5 Loans and Advances | Vendor will not liaise with any third parties to deduct or remit loans and advances. | 1/1 | N/A-Service | Vendor obligation |
| 127 | 5.6 Process for New Joiners: | Throughout the month through Client portal | 1/1 | Partial | Candidate ingest/convert API exists (hr_ops/hr_head); not verified end-to-end |
| 128 | 5.6 Process for New Joiners: | As part of monthly input through the excel format | 1/1 | Partial | Import service exists but no route/UI to upload Excel |
| 129 | 5.6 Process for New Joiners: | Through HR connector if integration is in scope | 1/1 | Missing | No HR connector/ATS integration |
| 130 | 5.6 Process for New Joiners: | New joiner details for the purpose of ESI IP generation need to be provided by the client once in a week. Flexi would be activated for new j | 1/1 | N/A-Service | Client process |
| 132 | ESS portal would be activated for new jo | When client approves new joiner inputs via client portal | 1/1 | Partial | User account created on convert (not verified) |
| 133 | ESS portal would be activated for new jo | After first month payroll is processed if inputs are provided through excel format | 1/1 | N/A-Service | Process rule |
| 134 | ESS portal would be activated for new jo | At agreed interval if new joiner information is provided via HR connector | 1/1 | Missing | No HR connector |
| 136 | 5.7– Process for Salary hold and release | Scenario 1 (Payment hold) - To hold payment of any specific salary(s) vendor will process salary as instructed by the Rashmi Metaliks Limite | 1/1 | Partial | /payroll/holds place/release/list exist; not verified |
| 137 | 5.7– Process for Salary hold and release | Scenario 2 (Process hold) - To hold processing of any specific salary(s) for absconding employees, etc., the Protiviti should include full m | 1/1 | Partial | Process hold via holds/LOP; not verified |
| 139 | 5.8 Additional General Scope: | Vendor would provide documentation support for any internal Audits and third-party requirements | 1/1 | Partial | Audit log with hash-chain verify (/audit/verify 200) |
| 140 | 5.8 Additional General Scope: | Any data / reports requirement to support audit needs to be shared in advance with vendor and turnaround time to deliver will be mutually ag | 1/1 | N/A-Service | Process |
| 141 | 5.8 Additional General Scope: | Payroll processing for Interns / Trainees and apply statutory contributions (including tax) as applicable. | 1/1 | Partial | category trainee exists; payroll not verifiable |
| 142 | 5.8 Additional General Scope: | Payroll processing for Apprentice as per the Apprenticeship act without any statutory deduction. | 1/1 | Partial | apprentice referenced in code; not verifiable |
| 143 | 5.8 Additional General Scope: | Additional ad hoc/On Demand reports can be provided by vendor subject to feasibility. Timeline to build the report and commercials to be mut | 1/1 | N/A-Service | Commercial/ad-hoc |
| 145 | 5.9 Payroll Compliance & Statutory Repor | Monthly Income TDS deductions and tax reporting | 1/1 | Partial | TDS engine (tds.ts) + projectTds; monthly TDS report missing |
| 146 | 5.9 Payroll Compliance & Statutory Repor | Quarterly filings (Form 24Q) & Annual Form 16 generation | 1/1 | Missing | No Form 24Q / Form 16 generation endpoint (only frontend text references) |
| 147 | 5.9 Payroll Compliance & Statutory Repor | Reconciliation of tax deductions vs. paid challans | 1/1 | Missing | No challan reconciliation |
| 149 | 5.10 Provident Fund – In Scope | UAN generation & KYC updating. | 1/1 | N/A-Service | EPFO portal service |
| 150 | 5.10 Provident Fund – In Scope | PF challan & return filing | 1/1 | Partial | generateEcr exists; challan/return filing manual |
| 151 | 5.10 Provident Fund – In Scope | Inspection support & statutory queries resolution.is received in the mobile number registered in the EPFO Portal | 1/1 | N/A-Service | Service |
| 152 | 5.10 Provident Fund – In Scope | EDLI Returns (Form 7IF)  | 1/1 | N/A-Service | Service |
| 153 | 5.10 Provident Fund – In Scope | Date of Leaving updating – Date of leaving and the reason for leaving will be updated in the EPFO portal by Protiviti | 1/1 | N/A-Service | Service |
| 154 | 5.10 Provident Fund – In Scope | Form 5A updating (Ownership Details) | 1/1 | N/A-Service | Service |
| 155 | 5.10 Provident Fund – In Scope | Modify Establishment Details | 1/1 | N/A-Service | Service |
| 156 | 5.10 Provident Fund – In Scope | Joint Declaration Submission | 1/1 | N/A-Service | Service |
| 157 | 5.10 Provident Fund – In Scope | Death Claim Submission | 1/1 | N/A-Service | Service |
| 158 | 5.10 Provident Fund – In Scope | Support in case of claim rejection by the EPFO | 1/1 | N/A-Service | Service |
| 159 | 5.10 Provident Fund – In Scope | Inspection Assistance / Response to the Notices | 1/1 | N/A-Service | Service |
| 160 | 5.10 Provident Fund – In Scope | Legislative Notification / Amendments | 1/1 | N/A-Service | Service |
| 162 | 5.10 Employee State Insurance (ESIC) Com | IP number generation, e-Pehchan card issuance. | 1/1 | N/A-Service | Service |
| 163 | 5.10 Employee State Insurance (ESIC) Com | ESIC contributions reporting & challan generation | 1/1 | Broken | generateEsicReturn exists, but ESIC contribution computed on wrong base and above ₹21,000 ceiling in salary snapshot |
| 164 | 5.10 Employee State Insurance (ESIC) Com | ESIC half-yearly submission & compliance audits | 1/1 | N/A-Service | Service |
| 165 | 5.10 Employee State Insurance (ESIC) Com | Updating of family members details | 1/1 | N/A-Service | Service |
| 166 | 5.10 Employee State Insurance (ESIC) Com | Sharing ESIC Remitted Challan – Once the payment is made, Rashmi Metaliks Limited to download the paid challan from the ESIC Portal. | 1/1 | N/A-Service | Service |
| 167 | 5.10 Employee State Insurance (ESIC) Com | Documents Submission to ESIC Office for Employee Name, DOJ & Gender Correction (Protiviti Presence location) | 1/1 | N/A-Service | Service |
| 168 | 5.10 Employee State Insurance (ESIC) Com | Updating of Employer Details (Company Name, Address) | 1/1 | N/A-Service | Service |
| 170 | 5.10 Professional Tax (PT) Compliance: | PT computation, reporting & online remittance support | 1/1 | Partial | generatePtrc exists; PT not present in salary snapshot preview; run blocked |
| 171 | 5.10 Professional Tax (PT) Compliance: | PT enrollment & renewal processing | 1/1 | N/A-Service | Service |
| 172 | 5.10 Professional Tax (PT) Compliance: | PT - Enrolment Certificate - Remittance | 1/1 | N/A-Service | Service |
| 173 | 5.10 Professional Tax (PT) Compliance: | PT - Enrolment Certificate - Returns | 1/1 | N/A-Service | Service |
| 174 | 5.10 Professional Tax (PT) Compliance: | Company Tax Remittance | 1/1 | N/A-Service | Service |
| 175 | 5.10 Professional Tax (PT) Compliance: | Sharing remitted /acknowledged challans | 1/1 | N/A-Service | Service |
| 176 | 5.10 Professional Tax (PT) Compliance: | Inspection Assistance / Response to the Notices | 1/1 | N/A-Service | Service |
| 178 | 5.11 Labor Welfare Fund (LWF) Compliance | LWF data upload, challan generation & payment facilitation | 1/1 | Partial | LWF components exist; no LWF challan/report output |
| 179 | 5.11 Labor Welfare Fund (LWF) Compliance | LWF inspection assistance & compliance reporting | 1/1 | N/A-Service | Service |
| 181 | 5.13 Employee Self-Service (ESS) & Suppo | providing Employee Access:   Payslips, tax computation slips, Form 16.   Investment declarations & reimbursement claims.   Tax calculator &  | 1/1 | Partial | ESS: leave/attendance/ESS dashboard work; payslip blocked; Form 16 missing; claims deferred/UI broken |
| 182 | 5.13 Employee Self-Service (ESS) & Suppo | providing HR & Payroll SPOC Access:   Bulk download of payroll & compliance reports.   Employee onboarding & document management.  Payroll d | 1/1 | Partial | Exports (assets, audit, reports) return 200; bulk payroll downloads blocked |
| 184 | 5.14 Annual Processing & Compliance | Annual Bonus & Increment Processing: | 1/1 | Partial | simulateIncrement/applyIncrementBatch/bonus trueup routes exist; not verified |
| 185 | 5.14 Annual Processing & Compliance | Tax Deduction & Year-End Adjustments | 0.5/0.5 | Partial | Year-end tax adjustments not verified |
| 187 | 6.Salary related reimbursement processin | Protiviti team should provide the following: > Reimbursement bank transfer > Reimbursement Register > Submission of reimbursement pay slip t | 1/1 | Missing | Claims/reimbursements deferred by sponsor; Claims UI broken (404 path, no auth) |
| 190 | 7.1Employee Engagement Initiatives | Broadcasting company news and updates in an engaging format. | 1/1 | Partial | Announcements publish/list routes exist (200) |
| 191 | 7.1Employee Engagement Initiatives | Enabling HR teams to share information and conduct opinion polls. | 0/0 | Partial | Polls create/respond/results exist |
| 193 | 7.2 Employee Feedback & Pulse Surveys | Conducting structured surveys for feedback collection. | 0/0 | Partial | Surveys create/respond/results exist |
| 194 | 7.2 Employee Feedback & Pulse Surveys | HR receives data-driven recommendations for improvements. | 1/1 | Missing | No recommendation engine |
| 197 | 8.1 Asset Allocation & Tracking | Platform for Asset Assignment | 1/1 | Partial | Asset assign route exists; list 200 for hr/it |
| 198 | 8.1 Asset Allocation & Tracking | Platform for management of Employee Asset Directory | 1/1 | Partial | Asset directory /assets, held-by exist |
| 200 | 8.2 Asset Maintenance & Compliance | Platform for Asset Maintenance Scheduling | 0.5/0.5 | Partial | Maintenance GET/POST per asset |
| 201 | 8.2 Asset Maintenance & Compliance | Platform for Incident & Damage Reporting | 0.5/0.5 | Partial | Maintenance used for incidents; no separate damage workflow |
| 203 | 8.3 Asset Retrieval & Exit Clearance | Platform for Asset Return Process | 0.5/0.5 | Partial | Return route exists |
| 204 | 8.3 Asset Retrieval & Exit Clearance | Platform for Clearance Workflows | 0.5/0.5 | Partial | Clearances exist |
| 205 | 8.3 Asset Retrieval & Exit Clearance | Platform for Lost or Unreturned Assets Management | 0.5/0.5 | Partial | non-returned list/export 200 |
| 208 | 9.1 Ticketing System & Query Management | Ticket Categories: Categorization of queries | 1/1 | Done | Helpdesk categories with assignee role + SLA returned to all users |
| 209 | 9.1 Ticketing System & Query Management | Platform Auto-Acknowledgment & Assignment:  | 1/1 | Partial | Ticket raise assigns role; auto-ack email not configured |
| 211 | 9.2 Escalation & Resolution Workflow | Escalation Matrix: Automated escalation of unresolved tickets based on pre-set SLAs | 1/1 | Partial | /helpdesk/escalate + SLA escalation job; not verified |
| 213 | 9.3 Helpdesk Reporting & Analytics | Real-time tracking of open, pending, and resolved tickets. | 1/1 | Partial | /helpdesk/tickets agent list 200 |
| 214 | 9.3 Helpdesk Reporting & Analytics | Monthly Performance Reports | 1/1 | Partial | /helpdesk/performance requires params |
| 216 | 9.4 Compliance & Audit Support | Helpdesk Query Logs | 1/1 | Partial | ticket thread/messages exist |
| 217 | 9.4 Compliance & Audit Support | Regulatory Query Handling | 1/1 | N/A-Service | Service |
| 218 | 9.4 Compliance & Audit Support | Employee & Case Management | 1/1 | Partial | POSH/grievance schema exists (ird); no routes found |
| 221 | 10.1 Process Related to Final settlement | Settlement Input in Excel Format as shared by Protiviti viz – Number of days payable, Salary hold release, Leave Encashment days/Notice Pay  | 0.5/0.5 | Partial | F&F engine exists; Excel input format not found |
| 222 | 10.1 Process Related to Final settlement | Communication Protocol: SFTP/ Protiviti’s CRM/ Rashmi Metaliks Limited Portal | 1/1 | N/A-Service | Communication protocol |
| 223 | 10.1 Process Related to Final settlement | Rashmi Metaliks Limited Employees to update investment proofs in ESS portal and submit any pending reimbursement claims | 1/1 | Partial | Declarations exist |
| 224 | 10.1 Process Related to Final settlement | Protiviti should process payroll based on clarifications received (post verification of investment proofs and reimbursement claims submitted | 0.5/0.5 | Partial | F&F compute route exists; not verifiable |
| 225 | 10.1 Process Related to Final settlement | On receipt of confirmation, the following deliverables to be shared with the Rashmi Metaliks Limited SPOC | 0.5/0.5 | Partial | Not verifiable |
| 227 | 10.2 Full and Final Settlement Process-G | Protiviti should offers 2 Full and Final cycle. | 0.5/0.5 | N/A-Service | Vendor cycles |
| 228 | 10.2 Full and Final Settlement Process-G | The turnaround time to process Full and Final is 3 working days. | 0.5/0.5 | N/A-Service | Vendor TAT |
| 229 | 10.2 Full and Final Settlement Process-G | Protiviti would not interact with resigned employees and details would be shared only to SPOC. | 0.5/0.5 | N/A-Service | Service |
| 230 | 10.2 Full and Final Settlement Process-G | “Alumni portal” access to exit employees need to be confirmedly Rashmi Metaliks Limited for RML to download | 0.5/0.5 | Partial | AlumniPortalPage UI + backend refs exist; not verified |

### 8.1 Related client requirement docs

- **Pending Implementation (28 Aug)** — still open on this build: PF/ESIC/PT calculation (A-04), probation 70/80/90 % auto breakup (A-08), loan workflow / “should not open for all employees” (A-03), resignation workflow “not visible to Chaitanya (HR head)” (A-01: no workflow request is created), auto alerts (A-12: no mail transport), offer approval (SOW 022 Missing), Form 16 / tax (146 Missing).
- **Additional Requirement.xlsx (Assets)**: asset search (asset-search trigram migration + /assets list exist — Partial), past warranty date, third-party allocation, resigned employee asset field (/assets/held-by), non-returned on dashboard (/assets/non-returned) — code present, UI acceptance see beta.
- **CEO DASHBOARD (HR Dashboard.pptx)** — `/reports/executive` returns 404 “No KPI snapshot has been built yet” until `POST /reports/executive/rebuild`; nightly snapshot depends on the worker that is commented out in PM2 config (A-12). Financial/GL tiles not source-linked (plans/03-PHASE-STATUS).
- **ATS (SOW_ATS_FINAL, LOI workflow)** — not absorbed: only candidate ingest/convert endpoints and r21-offers report; no requisition/JD/interview/offer/LOI approval flow; SSO to separate ATS not implemented (plans/launch-readiness/01).

## 9. Recommended fixes (priority order)

1. Replace mock Payroll console / Parallel Run / My Pay pages with real API-backed screens; fix F&F paise↔rupee unit bug; block delegation to subordinates and enforce requester ≠ actor at act time.
2. Close IDORs: enforce owner/scope on `/lifecycle/separations/apply` (self only, one open case, create the `resignation` workflow request), all `/travel/*` procedures, loan ledger; add a router-level lint/test that forbids `authed`-only procedures accepting an employeeId.
3. Loans: route `apply` through the `loan` workflow (RM→HR Head→Payroll), status `requested` until approved, eligibility cap from Basic, interest from policy not client input; fix `/api` double prefix and `:id` path; switch Loans/Claims pages to `apiFetch`.
4. Payroll statutory engine: compute ESIC on full gross after balancing with the ₹21,000 contribution-period gate; ER EPF = 12 %×PF wages − EPS; add PT slab & LWF; add golden tests G1–G3 from docs/10 against the salary snapshot path (not only unit engines).
5. CTC templates: support `CTC`/`CTC_MONTHLY` variables and honour `amount_rule`; fix probation-percent assignment 500; validate structure company = employee company.
6. Error handling & observability: map business errors to 4xx (`ORPCError`), add oRPC `onError` logging with request id; replace plain `Error` in `assertEmployeesInScope`, run compute guards, etc.
7. Rate limiting: apply the 5/min identifier limiter to `/api/auth/login` only; key /auth/me, /refresh by session/user.
8. Payroll run flow: require/attach attendance month lock at create; expose a clear readiness message in UI.
9. Notifications: implement SMTP transport and enable worker/scheduler in `ecosystem.config.cjs`; otherwise all SOW alert items fail in production.
10. Privacy: restrict CEO to aggregates; restrict `/payroll/components|structures|preview` to salary/payroll roles; give hr_ops probation board access per docs/08.
11. Account management: change-password, admin reset, forced change on first login, it_admin user lifecycle endpoints.
12. Data validations for payroll inputs (SOW 5.2): PAN, Aadhaar, IFSC, bank length, minor DOB, duplicate ESI/UAN, special characters.
13. Stabilise backend tests (isolate state in workflow-scope test) and lift branch coverage comfortably above 80 %; fix leave-cancel future-day “A” rows; remaining Low items.
14. Missing SOW items: Form 16/24Q, challan reconciliation, offer letter + approval/LOI, flexi basket, org-master maintenance UI/API, Excel import route.

## 10. Not tested / limits

- Real Kent biometric/access-control integration, SMTP/e-mail delivery, object storage, ATS SSO, SAP — not available on box (synthetic swipes used).
- Payroll outputs (payslip PDF, bank file, SAP JV, ECR/ESIC/PTRC files, F&F settlement, annual bonus/increment) could not be exercised by this worker because run compute requires an attendance month lock whose checklist cannot pass with QA data (biometric registration flags, manager approvals); statutory numbers were therefore checked on the salary-snapshot/preview path only.
- Historical data migration (SOW 005), parallel-run comparisons, load/scale, backup/restore, production deployment not tested.
- UI/Playwright coverage, console errors and screenshots are owned by the beta worker (§11).

## 11. Beta / UI testing (merged from `/workspace/hrms-test/beta/BETA_REPORT.md`)

## Rashmi HRMS — Beta / Functional Test Report

Run date: Sun 18 Oct 2026, roughly 21:35–22:55 IST. Environment: backend :5100 (Express 5 + Kysely + Postgres, not restarted), frontend Vite dev :5173 (started for this test). Test data: QA seed users (`/workspace/hrms-test/seed/qa-seed.ts`, password `Rashmi#Test2026`) plus records left by an earlier QA session. Tools: Python `requests` for the API (`beta/api/*.py`, raw results in `beta/api/results.jsonl` and `results-final.json`) and headless Playwright with system Chrome for the UI (`beta/crawl.mjs`, `ui_*.mjs`, results in `crawl-all.json`). Screenshots are under `beta/screenshots/<role>/`, 604 in total.

This report lists only what I observed. I did not change app source, restart the backend or reseed. I did add test data: leaves, AR/OD, a transfer, resignations (two stray ones withdrawn), 2 loans for employee2, trips, a helpdesk ticket, a poll, an announcement, a policy, an asset, letters, candidates, and new employee RML000011. I also temporarily granted and then revoked hr_ops for itadmin@, and saved `att.ot_decision_hours` with its existing value.

### 1. Summary

Roles come from `docs/08 §1`; the role codes match the backend `core.roles`. A seeded user exists for every role, so I didn't need to create any.

| Role | Test user | API checks PASS | API checks FAIL | UI pages healthy / 403-gated / broken (57 routes) | UI flows PASS / FAIL |
|---|---|---|---|---|---|
| employee | employee@rashmi.test (RML000008 Debajit) + employee2@ (RML000009 Priya), rgh.employee@ | 145 | 22 | 27 / 23 / 5 | 6 / 3 |
| manager | manager@rashmi.test (RML000007, RM of 8 & 9) | 33 | 5 | 39 / 11 / 5 | 2 / 0 |
| senior_manager | srmanager@rashmi.test (RML000006) | 4 | 0 | 39 / 11 / 5 | 1 / 0 |
| hr_ops | hrops@rashmi.test (scoped to RML org unit) | 50 | 8 | 42 / 7 / 6 | 0 / 1 |
| hr_head | hrhead@rashmi.test | 15 | 1 | 47 / 3 / 5 | 0 / 2 |
| payroll_admin | payroll@rashmi.test | 8 | 6 | 34 / 17 / 4 | 1 / 1 |
| plant_head | planthead@rashmi.test | 2 | 0 | 39 / 11 / 5 | 0 / 1 |
| ceo_cell | ceo@rashmi.test | 4 | 2 | 40 / 9 / 6 | 0 / 2 |
| it_admin | itadmin@rashmi.test | 13 | 2 | 34 / 17 / 4 | 1 / 0 |
| super_admin | admin@rashmi.test (no employee record) | 6 | 1 | 42 / 0 / 13 | 0 / 1 |
| unauthenticated | — | 1 | 0 | — | — |
| unauthenticated (candidate) | — | 3 | 1 | — | — |
| **Total** | | **284** | **48** | | |

API checks are counted under the role that made the call, so most negative "should be 403" probes appear under `employee`. "Healthy" only means no failed calls and no JS errors. Three healthy pages (`/payroll`, `/payroll/parallel-run`, `/my/pay`) show fabricated data (B-01, B-02). Under employee, `/people/RML000009` counts as "broken" but its 404 is correct scoping. 7 API results are marked INFO (design questions, not counted).

Bugs by severity: **Critical 6, High 12, Medium 12, Low 5 (35 total)**. Details in §3.

Top issues:
- B-01 Payroll console and Parallel Run pages are hard-coded mocks, so payroll can't be run from the UI, and every role (employee included) sees a fake run.
- B-02 My Pay shows the same fake ₹57,999 payslip (ecode RML035384) to every employee.
- B-03 Delegation lets a manager delegate to their own report, who then approves her own leave (segregation-of-duties break).
- B-04 Any employee can file a resignation on behalf of any colleague.
- B-05 F&F settlement about 100× too high (₹10.29 lakh for half a month of a ₹20k salary): paise/rupee mix-up.
- B-06 Loans: an ineligible ₹1 crore loan is accepted, goes active immediately with no approval chain, EMI ₹2.08 lakh/month.
- B-07 Payroll compute/approve/finalize return 500; runs can be created with no attendance lock; payroll can't be run end to end.
- B-08/B-09 Claims and Loans UI hit 404 (double /api prefix, no auth header); claim submission returns 500, so expense claims are unusable.
- B-10/B-11 Resignation and confirmation chains aren't enforced (single RM approval finalises; RM can confirm probation; HR head step returns 500).
- B-13/B-14/B-16 Permission leaks: CEO sees individual salaries; peers can read colleagues' travel, loans and wallet data; RML-scoped HR ops can see and act on RGH lifecycle records.

Other high-severity items: B-12 (cancelling an approved leave marks future days Absent), B-15 (travel claim settled without approval, bad dates accepted), B-17 (CTC breakup applies ESI above ₹21k and wrong PF_ER), B-18 (a future-dated transfer takes effect immediately, approved by HR ops alone).

### 2. Role-by-role task matrix

Each API row shows the call and the response status. The UI page health per role comes from the Playwright crawl of all 57 routes (screenshot per route in `screenshots/<role>/NN_<route>.png`).

#### employee
Visible nav pills: Home, My Attendance, My Leave, My Pay, My Claims, Helpdesk, Directory (any extra items are under "More"). Login: ok. Logout: ok. Opening a protected URL after logout shows the sign-in form.
UI crawl: 27 healthy, 23 correctly 403-gated, 5 broken: /people/RML000009, /my/claims, /loans, /claims, /recruitment.

| Module | Task | Result | HTTP | Notes |
|---|---|---|---|---|
| UI | UI login (valid credentials) | PASS | — | redirects to Home |
| UI | UI login with a bad password | PASS | — | alert "Invalid email or password" (same message for an unknown user) |
| UI | UI login with empty fields | PASS | — | inline "Enter your employee ID…" / "Enter your password." |
| UI | UI logout, then open /payroll directly | PASS | — | sign-in form shown |
| UI | UI apply leave (CL 21–22 Oct) from My Leave drawer | PASS | — | preview shows 2 days and the remaining balance; submit reserves the days. screenshots/employee/ui-leave-apply-*.png |
| UI | UI My Pay shows own payslip | FAIL | — | B-02: hard-coded payslip |
| UI | UI My Claims / Loans list own records | FAIL | — | B-08 |
| UI | UI Payroll page blocked or hidden for employee | FAIL | — | B-01: mock run visible at /payroll |
| UI | UI Travel trips list | PASS | — | shows trips; raw ISO dates (B-33) |
| auth | login bad password rejected | PASS | 401 |  {"defined":false,"code":"UNAUTHORIZED","status":401,"message":"Invalid email or password"} |
| auth | login unknown user rejected w/ same msg | PASS | 401 |  {"defined":false,"code":"UNAUTHORIZED","status":401,"message":"Invalid email or password"} |
| auth | login empty fields -> 400 | PASS | 400 |  {"defined":false,"code":"BAD_REQUEST","status":400,"message":"Input validation failed","data":{"issues":[{"cod |
| auth | login with e-code (RML000009) | PASS | 200 |  {"accessToken":"<redacted> |
| auth | login email case-insensitive | PASS | 200 |  {"accessToken":"<redacted> |
| auth | brute-force rate limit per identifier (5/min) | FAIL | [401, 401, 401, 401, 401, 401, 401] |   |
| auth | logout revokes access token & refresh cookie | PASS | [200, 401, 401] |   |
| auth | refresh token rotation | PASS | 200 |  {"accessToken":"<redacted> |
| leave | Employee cannot self-credit leave | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: leave.admin"} |
| leave | Apply CL 2 days | PASS | 200 |  {"id": 5, "workflowRequestId": 10, "days": 2} |
| leave | Pending days reserved in balance after apply | PASS |  |  {'leaveType': 'CL', 'name': 'Casual Leave', 'balance': 6, 'pending': 0, 'available': 6} -> {'leaveType': 'CL', |
| leave | Overlapping application rejected | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "An open or approved leave already covers  |
| leave | CL above maxPerRequest(3) rejected | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "CL allows at most 3 days per request"} |
| leave | Insufficient balance rejected (SL 20d) | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "Insufficient SL balance: 7 available, 23  |
| leave | toDate < fromDate rejected | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "fromDate must be on or before toDate"} |
| leave | Invalid date 2026-02-30 rejected | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "date/time field value out of range: \"202 |
| leave | Unknown leave type rejected | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "Unknown or inactive leave type: XX"} |
| leave | Male employee cannot apply Maternity Leave | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "Maternity Leave is not applicable for thi |
| leave | Leave starting on weekend/holiday only (Sun 2026-11-29) -> 0 days or rejected | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "The requested span contains no countable  |
| leave | Peer employee cannot approve colleague leave | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Not the current approver"} |
| leave | Applicant cannot approve own leave | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Not the current approver"} |
| leave | Peer cannot read workflow request detail | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Not involved in this request or outside you |
| leave | Balance debited 2 days after approval | PASS |  |  {'leaveType': 'CL', 'name': 'Casual Leave', 'balance': 6, 'pending': 0, 'available': 6} -> {'leaveType': 'CL', |
| leave | Application status approved | PASS | 200 |  [{"id": 5, "leaveType": "CL", "fromDate": "2026-11-23", "toDate": "2026-11-24", "days": 2, "status": "approved |
| leave | Cancel approved leave -> re-approval | PASS | 200 |  {"workflowRequestId": 11} |
| leave | Balance restored after cancel of approved leave | PASS |  |  {'leaveType': 'CL', 'name': 'Casual Leave', 'balance': 6, 'pending': 0, 'available': 6} -> {'leaveType': 'CL', |
| leave | Apply SL 1 day (to cancel while pending) | PASS | 200 |  {"id": 6, "workflowRequestId": 12, "days": 1} |
| leave | Other employee cannot cancel my leave | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "Not your application"} |
| leave | Cancel pending leave | FAIL | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "Only approved leave can be cancelled (thi |
| leave | Apply SL half-day (to be rejected) | PASS | 200 |  {"id": 7, "workflowRequestId": 13, "days": 0.5} |
| leave | Apply SL (send-back flow) | PASS | 200 |  {"id": 8, "workflowRequestId": 14, "days": 1} |
| leave | Employee cannot view other employee balance | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: leave.admin"} |
| leave | Employee cannot edit leave types | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: leave.admin"} |
| leave | Employee cannot run accrual | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: admin.integrations"} |
| leave | Employee cannot run year-end | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: admin.integrations"} |
| leave | Restricted holidays list | PASS | 200 |  [] |
| leave | Leave encashment request (EL=0) | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "Insufficient EL balance: 0 available"} |
| leave | Other user cannot resubmit sent-back request | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "Only the requester can resubmit"} |
| leave | Applicant resubmits sent-back leave | PASS | 200 |  {"ok": true} |
| leave | Leave app status approved after resubmit | PASS | 200 |  [{"id": 8, "leaveType": "SL", "fromDate": "2026-12-04", "toDate": "2026-12-04", "days": 1, "status": "approved |
| leave | Resubmit with altered payload (5 days CL, > max 3) is validated | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "CL allows at most 3 days per request"} |
| attendance | View own monthly attendance | PASS | 200 |  [{"date": "2026-10-01", "status": "P", "sessionStatuses": null, "source": "auto", "isLocked": false, "leaveTyp |
| attendance | Raise AR (missed punch) for past day | PASS | 200 |  {"id": 4, "workflowRequestId": 17} |
| attendance | AR reason <5 chars rejected | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "Input validation failed", "data": {"issue |
| attendance | AR for future date rejected | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "AR is for past days only \u2014 use OD fo |
| attendance | AR older than ar_max_past_days(30) rejected | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "Requests older than 30 days are closed \u |
| attendance | Permission > permission_max_hours(2) rejected | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "Permission is capped at 2 hours"} |
| attendance | Permission toTime<fromTime rejected | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "Permission toTime must be after fromTime" |
| attendance | Raise OD (official duty) | PASS | 200 |  {"id": 5, "workflowRequestId": 18} |
| attendance | Duplicate OD same day rejected | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "An open or approved request already cover |
| attendance | Employee cannot read other employee days | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: attendance.team.read"} |
| attendance | Employee cannot open team grid | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: attendance.team.read"} |
| attendance | Employee cannot override own day | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: attendance.manual_overr |
| attendance | Employee cannot write roster | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: attendance.roster.write |
| attendance | Employee cannot trigger biometric sync | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: admin.integrations"} |
| attendance | My OT | PASS | 200 |  [{"id": 1, "employeeId": 8, "workDate": "2026-10-09", "detectedMinutes": 150, "claimedMinutes": 150, "approved |
| attendance | Employee cannot run OT lapse sweep | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: admin.integrations"} |
| attendance | Employee cannot month-lock | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: attendance.month_lock"} |
| attendance | Employee cannot sign off team attendance | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: attendance.team.read"} |
| attendance | Employee cannot edit shifts | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: admin.settings"} |
| payroll | Employee cannot list payroll runs | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: payroll.run.view"} |
| payroll | Employee cannot compute run | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: payroll.run.manage"} |
| payroll | Employee getMyPayslip Oct | PASS | 200 |  null |
| payroll | Employee cannot fetch other payslip | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: payroll.run.view"} |
| payroll | Employee cannot generate bank file | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: payroll.run.manage"} |
| payroll | Employee reads own salary | PASS | 200 |  {"salary": {"id": 2, "employee_id": 8, "structure_id": 2, "effective_from": "2026-04-01", "effective_to": "999 |
| payroll | Employee cannot read colleague salary | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Can only view your own compensation details |
| payroll | Employee cannot assign own salary | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: salary.write"} |
| payroll | Employee cannot create salary component | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: salary.write"} |
| payroll | Employee TDS projection (own) | INFO | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: payroll.run.view"} |
| payroll | Employee TDS estimate | INFO | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: payroll.run.view"} |
| payroll | Employee cannot generate ECR | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: payroll.reports"} |
| payroll | Employee cannot place payroll hold | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: payroll.run.manage"} |
| lifecycle | Employee cannot ingest candidate | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: lifecycle.onboard.conve |
| lifecycle | Employee cannot convert candidate | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: lifecycle.onboard.conve |
| lifecycle | Employee cannot decide probation | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: lifecycle.confirmation. |
| lifecycle | Employee cannot initiate transfer | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: lifecycle.transfers.man |
| lifecycle | Transferee cannot approve own transfer | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: lifecycle.transfers.man |
| lifecycle | Employee cannot file resignation for someone else | FAIL | 200 |  {"separation": {"id": 3, "employeeId": 9, "initiatedAt": "2026-10-18T16:13:01.343Z", "initiatedBy": "employee" |
| lifecycle | Resignation with reason <5 rejected | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "Input validation failed", "data": {"issue |
| lifecycle | Resignation with LWD in past rejected | FAIL | 500 |  {"defined": false, "code": "INTERNAL_SERVER_ERROR", "status": 500, "message": "Internal server error"} |
| lifecycle | Employee submits resignation | PASS | 200 |  {"separation": {"id": 4, "employeeId": 9, "initiatedAt": "2026-10-18T16:13:01.352Z", "initiatedBy": "employee" |
| lifecycle | Duplicate resignation rejected | FAIL | 200 |  {"separation": {"id": 5, "employeeId": 9, "initiatedAt": "2026-10-18T16:13:01.356Z", "initiatedBy": "employee" |
| lifecycle | Employee cannot mark someone absconding | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: lifecycle.separation.ap |
| lifecycle | Employee views own separation | FAIL | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: lifecycle.separation.ap |
| lifecycle | Peer cannot view colleague separation | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: lifecycle.separation.ap |
| lifecycle | Peer cannot list all separations | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: lifecycle.separation.ap |
| lifecycle | Employee cannot approve own resignation | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: lifecycle.separation.ap |
| lifecycle | Employee cannot clear own Finance clearance | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: lifecycle.separation.ap |
| lifecycle | Employee cannot compute own F&F | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: payroll.run.manage"} |
| lifecycle | Employee cannot mark F&F paid | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: payroll.run.manage"} |
| lifecycle | Employee withdraws resignation | FAIL | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: lifecycle.separation.ap |
| lifecycle | Employee can withdraw a colleague resignation? (should be 403) | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: lifecycle.separation.ap |
| claims/T&E | My claim entitlements | PASS | 200 |  [{"claimTypeCode": "daily_allowance", "claimTypeName": "Daily allowance", "basis": "monthly", "totalEntitlemen |
| claims/T&E | Submit expense claim with bill | FAIL | 500 |  {"defined": false, "code": "INTERNAL_SERVER_ERROR", "status": 500, "message": "Internal server error"} |
| claims/T&E | Claim with no bills rejected | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "Input validation failed", "data": {"issue |
| claims/T&E | Claim period reversed rejected | FAIL | 500 |  {"defined": false, "code": "INTERNAL_SERVER_ERROR", "status": 500, "message": "Internal server error"} |
| claims/T&E | Claim exceeding entitlement rejected | FAIL | 500 |  {"defined": false, "code": "INTERNAL_SERVER_ERROR", "status": 500, "message": "Internal server error"} |
| claims/T&E | My claims | PASS | 200 |  [] |
| claims/T&E | Employee cannot see pending claims queue | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: claims.approve"} |
| claims/T&E | Loan EMI preview | PASS | 200 |  {"eligible": false, "reasons": ["Projected EMI (\u20b98,721.98) exceeds 30% of monthly gross salary (Max allow |
| claims/T&E | Apply salary advance | PASS | 200 |  {"success": true, "loanId": 2, "monthlyEmiRupees": 5000} |
| claims/T&E | Loan > eligibility rejected (₹1 crore) | FAIL | 200 |  {"success": true, "loanId": 3, "monthlyEmiRupees": 208333.32} |
| claims/T&E | My loans | PASS | 200 |  [{"loanId": 3, "employeeId": 9, "loanType": "loan_flat", "originalPrincipalRupees": 10000000, "annualInterestR |
| claims/T&E | Employee cannot list all loans | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: payroll.run.manage"} |
| claims/T&E | Employee cannot legacy-import loan | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: payroll.run.manage"} |
| claims/T&E | Peer cannot read colleague loan ledger | FAIL | 200 |  {"loanId": 2, "employeeId": 9, "loanType": "salary_advance", "originalPrincipalRupees": 10000, "annualInterest |
| claims/T&E | Trip endDate<startDate rejected | FAIL | 200 |  {"trip": {"id": 2, "referenceNo": "TRIP-2026-9699", "employeeId": 9, "companyId": 1, "tripName": "Haldia vendo |
| claims/T&E | Raise travel trip | PASS | 200 |  {"trip": {"id": 3, "referenceNo": "TRIP-2026-7036", "employeeId": 9, "companyId": 1, "tripName": "Haldia vendo |
| claims/T&E | My trips | PASS | 200 |  {"trips": [{"id": 3, "referenceNo": "TRIP-2026-7036", "employeeId": 9, "companyId": 1, "tripName": "Haldia ven |
| claims/T&E | Peer cannot list colleague trips via employeeId | FAIL | 200 |  {"trips": [{"id": 3, "referenceNo": "TRIP-2026-7036", "employeeId": 9, "companyId": 1, "tripName": "Haldia ven |
| claims/T&E | Peer cannot read trip detail | FAIL | 200 |  {"trip": {"id": 3, "referenceNo": "TRIP-2026-7036", "employeeId": 9, "companyId": 1, "tripName": "Haldia vendo |
| claims/T&E | Add itinerary | PASS | 200 |  {"itinerary": {"id": 2, "tripId": 3, "segmentType": "train", "origin": "Kharagpur", "destination": "Haldia", " |
| claims/T&E | Request travel advance | PASS | 200 |  {"advance": {"id": 2, "tripId": 3, "employeeId": 9, "amountPaise": 500000, "purpose": "hotel and DA", "status" |
| claims/T&E | Employee cannot approve own advance | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: payroll.run.manage"} |
| claims/T&E | Peer cannot approve advance | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: payroll.run.manage"} |
| claims/T&E | Wallet balance | PASS | 200 |  {"balancePaise": 0, "balanceRupees": 0, "employeeId": 9} |
| claims/T&E | Peer cannot read colleague wallet | FAIL | 200 |  {"balancePaise": 0, "balanceRupees": 0, "employeeId": 9} |
| claims/T&E | Create travel claim | PASS | 200 |  {"claim": {"id": 1, "referenceNo": "CLM-2026-9516", "tripId": 3, "employeeId": 9, "totalClaimedPaise": 0, "app |
| claims/T&E | Add claim item (hotel) | PASS | 200 |  {"item": {"id": 1, "claimId": 1, "category": "hotel", "itemDate": "2026-11-10T00:00:00.000Z", "amountPaise": 3 |
| claims/T&E | Claim item outside trip dates rejected | FAIL | 200 |  {"item": {"id": 2, "claimId": 1, "category": "food", "itemDate": "2025-01-01T00:00:00.000Z", "amountPaise": 10 |
| claims/T&E | Employee cannot settle own claim | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: payroll.run.manage"} |
| claims/T&E | Travel budgets | PASS | 200 |  {"budgets": [{"id": 1, "gradeLevel": "A", "travelType": "domestic", "flightClass": "economy", "hotelPerNightPa |
| directory/profile | Own profile | PASS | 200 |  {"ecode": "RML000008", "name": "Debajit Roy", "photoPath": null, "gender": "Male", "dob": "1987-08-15", "marit |
| directory/profile | Employee cannot open colleague profile (O scope) | PASS | 404 |  {"defined": false, "code": "NOT_FOUND", "status": 404, "message": "Employee RML000009 not found"} |
| directory/profile | Directory search for employee | PASS | 200 |  {"items": [], "total": 0, "page": 1, "pageSize": 50} |
| helpdesk | Raise helpdesk ticket | PASS | 200 |  {"id": 1, "ticketNo": "HD-2026-000002", "slaDueAt": "2026-10-19T16:14:01.747Z"} |
| helpdesk | Ticket subject <3 chars rejected | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "Input validation failed", "data": {"issue |
| helpdesk | My tickets | PASS | 200 |  {"rows": [{"id": 1, "ticketNo": "HD-2026-000002", "subject": "Payslip not visible", "categoryCode": "attendanc |
| helpdesk | Employee cannot list all tickets (agent queue) | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: helpdesk.agent"} |
| helpdesk | Other employee cannot read ticket thread | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "You do not have permission to view this tic |
| helpdesk | Other employee cannot reply to ticket | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Not authorized to access or reply to this t |
| helpdesk | Internal notes hidden from requester | PASS | 200 |  [{"id": 1, "body": "Looking into it", "isInternal": false, "authorEmail": "hrops@rashmi.test", "createdAt": "2 |
| helpdesk | Requester cannot set status resolved? (close own allowed?) | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: helpdesk.agent"} |
| helpdesk | Employee cannot run escalation | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: admin.integrations"} |
| engagement | Employee cannot publish announcement | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: engagement.publish"} |
| engagement | Employee sees announcement | PASS | 200 |  [{"id": 1, "title": "Diwali holiday", "body": "Plant closed on 8 Nov", "attachmentDocumentId": null, "publishe |
| engagement | Employee responds to poll | PASS | 200 |  {"ok": true} |
| engagement | Double vote rejected | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "You have already responded to this poll"} |
| engagement | Invalid option index rejected | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "Invalid option"} |
| engagement | Employee cannot close poll | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: engagement.publish"} |
| letters | Employee cannot issue letter | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: letters.issue"} |
| letters | My letters | PASS | 200 |  [] |
| letters | Employee cannot list letters of colleague | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: letters.issue"} |
| letters | Employee opens own letter | PASS | 200 |  {"mime": "text/html", "fileName": "appointment-RML000008.html", "content": "<!-- Appointment Letter -->\n<arti |
| letters | Other employee cannot open letter content | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Not your letter"} |
| policies | Employee cannot publish policy | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: engagement.publish"} |
| policies | Pending policies for employee | PASS | 200 |  [{"id": 1, "title": "Code of Conduct 2026", "documentId": 3, "bodySummary": "Be nice", "effectiveDate": "2026- |
| policies | Employee reads policy content | PASS | 200 |  {"mime": "text/plain", "fileName": "coc.txt", "content": "Q29kZSBvZiBjb25kdWN0"} |
| policies | Employee acknowledges policy | PASS | 200 |  {"ok": true} |
| policies | Double ack idempotent/rejected | PASS | 200 |  {"ok": true} |
| policies | Employee cannot see ack report | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: reports.hr"} |
| assets | Employee cannot assign assets | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: assets.manage"} |
| assets | Employee cannot query assets held by colleague | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: assets.manage"} |
| assets | Employee cannot list assets | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: assets.manage"} |
| reports/dashboards | Employee cannot rebuild exec snapshot | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: one of reports.ceo, rep |
| admin/rbac/settings | Employee cannot grant self super_admin | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: admin.roles"} |
| admin/rbac/settings | Employee cannot change setting | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: admin.settings"} |
| admin/rbac/settings | Employee cannot read audit | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: audit.read"} |
| admin/rbac/settings | Employee cannot edit workflow definitions | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: admin.settings"} |
| admin/rbac/settings | Employee settings read (policy store visible to all?) | FAIL | 200 | UI shows full settings list to employee [{"key": "att.absence_show_cause_days", "value": 7, "valueType": "number", "description": "ATT-14: consecutive |
| workflows | Employee escalation trigger blocked | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: admin.integrations"} |
| workflows | Delegate cannot approve their OWN request (SoD) | FAIL | 200 |  {"outcome": "approved"} |
| lifecycle | Employee cannot complete onboarding task | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: lifecycle.onboard.conve |
| lifecycle | Employee cannot evaluate probation | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: lifecycle.confirmation. |
| claims/T&E | Peer cannot read colleague data via /travel/advances?employeeId=9 | FAIL | 200 | IDOR {"advances": [{"id": 2, "tripId": 3, "employeeId": 9, "amountPaise": 500000, "purpose": "hotel and DA", "statu |
| claims/T&E | Peer cannot read colleague data via /travel/claims?employeeId=9 | FAIL | 200 | IDOR {"claims": [{"id": 1, "referenceNo": "CLM-2026-9516", "tripId": 3, "employeeId": 9, "totalClaimedPaise": 31000 |
| claims/T&E | Peer cannot read colleague data via /travel/wallet/ledger?employeeId=9 | PASS | 200 | IDOR {"transactions": []} |
| claims/T&E | Peer cannot read colleague data via /travel/trips?employeeId=9 | FAIL | 200 | IDOR {"trips": [{"id": 3, "referenceNo": "TRIP-2026-7036", "employeeId": 9, "companyId": 1, "tripName": "Haldia ven |

#### manager
Visible nav pills: Home, My Attendance, My Leave, My Pay, My Claims, My Team, Helpdesk, Directory (any extra items are under "More"). Login: ok. Logout: ok. Opening a protected URL after logout shows the sign-in form.
UI crawl: 39 healthy, 11 correctly 403-gated, 5 broken: /my/claims, /loans, /claims, /reports/r29-helpdesk, /recruitment.

| Module | Task | Result | HTTP | Notes |
|---|---|---|---|---|
| UI | UI Approvals inbox lists team requests | PASS | — | screenshots/manager/ui-approvals-inbox.png |
| UI | UI My Team grid | PASS | — | shows A on future cancelled-leave dates (B-12) |
| leave | Manager sees leave in inbox | PASS | 200 |  [{"requestId": 4, "type": "leave", "typeName": "Leave", "subject": {"ecode": "RML000008", "name": "Debajit Roy |
| leave | Manager approves leave | PASS | 200 |  {"outcome": "approved"} |
| leave | Double approval rejected | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "Request is approved, not actionable"} |
| leave | Manager approves leave-cancel | PASS | 200 |  {"outcome": "approved"} |
| leave | Reject without comment (should require reason?) | PASS | 400 | docs: rejection reason required {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "A decision reason is required when reject |
| leave | Manager rejects with comment | PASS | 200 |  {"outcome": "rejected"} |
| leave | Manager sends back | PASS | 200 |  {"outcome": "sent_back"} |
| leave | Manager applies own leave | PASS | 200 |  {"id": 9, "workflowRequestId": 15, "days": 1} |
| leave | Manager cannot approve own leave | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Not the current approver"} |
| leave | Manager views direct report balance | INFO | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: leave.admin"} |
| leave | Manager cannot view non-report balance (CEO=1) | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: leave.admin"} |
| leave | Resubmitted request back in manager inbox | PASS | 200 |  [{"requestId": 4, "type": "leave", "typeName": "Leave", "subject": {"ecode": "RML000008", "name": "Debajit Roy |
| leave | Manager approves resubmitted leave | PASS | 200 |  {"outcome": "approved"} |
| attendance | Manager approves regularization #17 | PASS | 200 |  {"outcome": "approved"} |
| attendance | Manager approves od #18 | PASS | 200 |  {"outcome": "approved"} |
| attendance | Manager reads direct report days | PASS | 200 |  [{"date": "2026-10-01", "status": "P", "scheme": "GEN", "firstIn": "2026-10-01T03:25:00.000Z", "lastOut": "202 |
| attendance | Manager cannot read CEO days (out of subtree) | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Employee outside your permitted data scope" |
| attendance | Team grid (direct) | PASS | 200 |  [{"employeeId": 8, "ecode": "RML000008", "name": "Debajit Roy", "days": {"2026-10-26": {"status": "A", "firstI |
| attendance | Manager subtree=true does not leak beyond team | PASS | 200 |  [{"employeeId": 8, "ecode": "RML000008", "name": "Debajit Roy", "days": {"2026-10-26": {"status": "A", "firstI |
| attendance | Manager cannot manual override | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: attendance.manual_overr |
| attendance | Manager views roster | PASS | 200 |  [{"employeeId": 8, "ecode": "RML000008", "name": "Debajit Roy", "days": {}}, {"employeeId": 9, "ecode": "RML00 |
| attendance | Manager sets roster for report | PASS | 200 |  {"upserted": 1} |
| attendance | Manager cannot roster CEO (outside team) | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "One or more employees are outside your perm |
| attendance | Pending OT for manager | PASS | 200 |  [] |
| attendance | Manager team attendance sign-off | PASS | 200 |  {"ok": true} |
| payroll | Manager cannot read report salary | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Can only view your own compensation details |
| lifecycle | Current RM approves transfer | FAIL | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: lifecycle.transfers.man |
| lifecycle | Resignation appears in RM approvals inbox | FAIL | 200 |  [{"requestId": 4, "type": "leave", "typeName": "Leave", "subject": {"ecode": "RML000008", "name": "Debajit Roy |
| lifecycle | RM approves resignation (step 1) | PASS | 200 |  {"separation": {"id": 4, "employeeId": 9, "initiatedAt": "2026-10-18T16:13:01.352Z", "initiatedBy": "employee" |
| claims/T&E | Loan request reaches RM approval inbox | FAIL | 200 |  [{"requestId": 4, "type": "leave", "typeName": "Leave", "subject": {"ecode": "RML000008", "name": "Debajit Roy |
| claims/T&E | RM approves travel advance | FAIL | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: payroll.run.manage"} |
| directory/profile | Manager opens direct report profile | PASS | 200 |  {"ecode": "RML000008", "name": "Debajit Roy", "photoPath": null, "gender": "Male", "dob": "1987-08-15", "marit |
| directory/profile | Statutory IDs masked for manager viewing report | PASS | 200 |  {"pan": null, "aadhaar": null, "uan": null, "statutoryMasked": true} |
| directory/profile | Manager cannot open CEO profile | PASS | 404 |  {"defined": false, "code": "NOT_FOUND", "status": 404, "message": "Employee RML000001 not found"} |
| workflows | Manager delegates approvals to sr manager | PASS | 200 |  {"ok": true} |
| workflows | Delegation to self rejected | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "Cannot delegate to yourself"} |
| workflows | Delegation to an unrelated employee (peer) — allowed? | PASS | 200 |  {"ok": true} |
| lifecycle | RM evaluates probation (confirm) | PASS | 200 |  {"success": true} |
| lifecycle | RM cannot take final confirmation decision | FAIL | 200 |  {"outcome": "confirmed", "confirmationLetterId": 3} |

#### senior_manager
Visible nav pills: Home, My Attendance, My Leave, My Pay, My Claims, My Team, Helpdesk, Directory (any extra items are under "More"). Login: ok. Logout: ok. Opening a protected URL after logout shows the sign-in form.
UI crawl: 39 healthy, 11 correctly 403-gated, 5 broken: /my/claims, /loans, /claims, /reports/r29-helpdesk, /recruitment.

| Module | Task | Result | HTTP | Notes |
|---|---|---|---|---|
| UI | UI Approvals inbox shows delegated leave and Approve works | PASS | — | screenshots/senior_manager/ui-approvals-inbox.png, ui-approval-after.png |
| leave | Sr manager sees manager's leave | PASS | 200 |  [{"requestId": 15, "type": "leave", "typeName": "Leave", "subject": {"ecode": "RML000007", "name": "Amit Kumar |
| leave | Sr manager approves manager's leave | PASS | 200 |  {"outcome": "approved"} |
| attendance | Team grid subtree (sr manager) | PASS | 200 |  [{"employeeId": 7, "ecode": "RML000007", "name": "Amit Kumar Singh", "days": {"2026-10-01": {"status": "P", "f |
| lifecycle | Non-RM manager evaluating probation of someone else's report | PASS | 200 |  {"success": true} |

#### hr_ops
Visible nav pills: Dashboard, People, Attendance, Leave, Lifecycle, Assets, Helpdesk, Reports (any extra items are under "More"). Login: ok. Logout: ok. Opening a protected URL after logout shows the sign-in form.
UI crawl: 42 healthy, 7 correctly 403-gated, 6 broken: /my/claims, /loans, /claims, /reports/r21-offers, /reports/r29-helpdesk, /recruitment.

| Module | Task | Result | HTTP | Notes |
|---|---|---|---|---|
| UI | UI Reports R21/R29 | FAIL | — | B-25 |
| leave | HR ops credits CL opening balance (emp2) | PASS | 200 |  {"ledgerTxnId": 5} |
| leave | HR ops credits SL (emp2) | PASS | 200 |  {"ledgerTxnId": 6} |
| leave | HR ops (RML-scoped) cannot adjust RGH employee | FAIL | 500 |  {"defined": false, "code": "INTERNAL_SERVER_ERROR", "status": 500, "message": "Internal server error"} |
| leave | HR ops (not current approver) cannot approve step-1 leave | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Not the current approver"} |
| leave | Credit CL to manager | PASS | 200 |  {"ledgerTxnId": 9} |
| leave | HR ops views employee balance | PASS | 200 |  [{"leaveType": "CL", "name": "Casual Leave", "balance": 6, "pending": 0, "available": 6}, {"leaveType": "CO",  |
| attendance | Day status reflects approved AR/OD | PASS | 200 |  [{"date": "2026-10-14", "status": "P", "scheme": "GEN", "firstIn": "2026-10-14T03:25:00.000Z", "lastOut": "202 |
| attendance | HR ops (RML scope) cannot read RGH employee days | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Employee outside your permitted data scope" |
| attendance | HR ops manual override day status | PASS | 200 |  {"ok": true} |
| attendance | Override reason <5 rejected | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "Input validation failed", "data": {"issue |
| attendance | Override future date rejected | FAIL | 200 |  {"ok": true} |
| attendance | HR ops override RGH employee blocked | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Employee outside your permitted data scope" |
| attendance | Unmatched punches list | PASS | 200 |  [] |
| attendance | Quarantined punches list | INFO | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: admin.integrations"} |
| attendance | HR ops cannot month-lock (hr_head/payroll only) | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: attendance.month_lock"} |
| attendance | Absence cases scan | INFO | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: admin.integrations"} |
| attendance | Shifts list | INFO | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: admin.settings"} |
| payroll | HR ops cannot read salary | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Can only view your own compensation details |
| lifecycle | Onboarding reference data includes org units/locations/structures | FAIL | 200 |  {"companies": [{"id": 1, "name": "Rashmi Metaliks Limited", "ecodePrefix": "RML"}], "departments": [{"id": 1,  |
| lifecycle | Separations list scoped to RML (no RGH rows) | FAIL | 200 |  {"separations": [{"id": 2, "employeeId": 11, "ecode": "RGH000001", "employeeName": "Sushanta Nayak", "departme |
| lifecycle | Candidate invalid email rejected | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "Input validation failed", "data": {"issue |
| lifecycle | Candidate mobile <10 digits rejected | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "Input validation failed", "data": {"issue |
| lifecycle | HR ops ingests candidate (onboarding) | PASS | 200 |  {"candidateId": 1, "rawToken": "fafb1566e6a7d5916e599eee9c8884b39075ccec8118822893e84c3682d92b85", "expiresAt" |
| lifecycle | Duplicate candidate detected | FAIL | 200 |  {"hasDuplicate": false} |
| lifecycle | Re-ingest same candidate rejected | FAIL | 200 |  {"candidateId": 2, "rawToken": "e14ec9a7a8b1046916ba0c3735bf0ea9b0d0417261c20ac84088c777255ddb1e", "expiresAt" |
| lifecycle | Convert candidate before pre-join done (should be blocked?) | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "Actual joining date cannot be in the futu |
| lifecycle | Onboarding tasks list | PASS | 200 |  {"tasks": []} |
| lifecycle | Boarding/exit daily | PASS | 200 |  {"from": "2026-10-01", "to": "2026-10-31", "joins": [], "exits": []} |
| lifecycle | HR ops initiates department transfer (emp2 Production->IT) | PASS | 200 |  {"id": 1, "targetEcode": null} |
| lifecycle | HR ops approves transfer (step 2) | PASS | 200 |  {"success": true, "newEcode": null} |
| lifecycle | Transfer history | PASS | 200 |  {"history": [{"id": 1, "employeeId": 9, "effectiveDate": "2026-11-01", "changeType": "transfer_department", "f |
| lifecycle | Transfer list | PASS | 200 |  {"rows": [{"id": 1, "employeeId": 9, "ecode": "RML000009", "employeeName": "Priya Sharma", "transferType": "de |
| lifecycle | HR ops (RML) cannot transfer RGH emp | FAIL | 200 |  {"id": 2, "targetEcode": null} |
| lifecycle | Clearances list | PASS | 200 |  {"clearances": [{"id": 1, "separationId": 4, "department": "IT", "status": "pending", "remarks": "Initial IT c |
| lifecycle | HR withdraws stray separation #3 (cleanup) | PASS | 200 |  {"separation": {"id": 3, "employeeId": 9, "initiatedAt": "2026-10-18T16:13:01.343Z", "initiatedBy": "employee" |
| lifecycle | HR withdraws stray separation #5 (cleanup) | PASS | 200 |  {"separation": {"id": 5, "employeeId": 9, "initiatedAt": "2026-10-18T16:13:01.356Z", "initiatedBy": "employee" |
| lifecycle | Convert candidate (no pre-join submitted) - should require pre-join? | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "A completed and submitted pre-join applic |
| claims/T&E | HR ops pending claims | PASS | 200 |  [] |
| directory/profile | HR ops opens RML profile | PASS | 200 |  {"ecode": "RML000008", "name": "Debajit Roy", "photoPath": null, "gender": "Male", "dob": "1987-08-15", "marit |
| directory/profile | Statutory IDs masked for HR ops (only payroll unmasked) | PASS | 200 |  {"pan": null, "aadhaar": null, "uan": null, "statutoryMasked": true} |
| directory/profile | HR ops (RML scope) cannot open RGH profile | PASS | 404 |  {"defined": false, "code": "NOT_FOUND", "status": 404, "message": "Employee RGH000001 not found"} |
| directory/profile | Directory facets | PASS | 200 |  {"entities": [{"code": "RML", "label": "Rashmi Metaliks Limited", "count": 10}], "departments": [{"code": "1", |
| helpdesk | Agent replies | PASS | 200 |  {"id": 1} |
| helpdesk | Agent internal note | PASS | 200 |  {"id": 2} |
| helpdesk | Agent resolves ticket | PASS | 200 |  {"ok": true} |
| engagement | HR ops publishes announcement | PASS | 200 |  {"id": 1} |
| engagement | HR ops creates anonymous poll | PASS | 200 |  {"id": 1} |
| engagement | Poll with single option rejected | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "Input validation failed", "data": {"issue |
| engagement | Anonymous poll results do not reveal voter identity | PASS | 200 |  {"pollId": 1, "question": "Canteen quality?", "isAnonymous": true, "totalResponses": 1, "options": [{"index":  |
| letters | HR ops issues letter (goes to signature chain) | PASS | 200 |  {"letterId": 1, "documentId": 1, "workflowRequestId": 19} |
| letters | HR ops (RML) cannot issue letter to RGH emp | FAIL | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "No authorized approver in this role for t |
| letters | HR ops approves letter step 1 | PASS | 200 |  {"outcome": "advanced"} |
| assets | Create asset | PASS | 200 |  {"id": 1, "created": true} |
| assets | Assign asset to employee | PASS | 200 |  {"assignmentId": 1} |
| assets | Double-assign same asset rejected | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "Asset BETA-LT-001 is already allocated \u |
| assets | Assets held by employee | PASS | 200 |  [{"assignmentId": 1, "assetNo": "BETA-LT-001", "category": "laptop", "assignedAt": "2026-10-18T16:14:02.021Z"} |
| workflows | Routing holds | INFO | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: admin.settings"} |
| lifecycle | Candidate application view after pre-join | PASS | 200 |  {"candidateId": 1, "submittedAt": "2026-10-18T16:20:20.541Z", "profile": {"presentAddress": "12 MG Road Kharag |
| lifecycle | HR ops converts candidate to employee | PASS | 200 |  {"employeeId": 12, "ecode": "RML000011"} |
| lifecycle | Convert same candidate twice rejected | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "Candidate Beta Newjoin is already convert |
| lifecycle | Onboarding tasks generated for new joiner | PASS | 200 |  {"tasks": [{"id": 1, "employeeId": 12, "ecode": "RML000011", "employeeName": "Beta Newjoin", "taskCode": "it_e |
| lifecycle | New employee visible in directory | PASS | 200 |  {"ecode": "RML000011", "name": "Beta Newjoin", "photoPath": null, "gender": null, "dob": "1998-05-05", "marita |

#### hr_head
Visible nav pills: Dashboard, People, Attendance, Leave, Payroll, Lifecycle, Assets, Helpdesk, Settings (any extra items are under "More"). Login: ok. Logout: ok. Opening a protected URL after logout shows the sign-in form.
UI crawl: 47 healthy, 3 correctly 403-gated, 5 broken: /my/claims, /loans, /claims, /reports/r29-helpdesk, /recruitment.

| Module | Task | Result | HTTP | Notes |
|---|---|---|---|---|
| UI | UI Reports R29 | FAIL | — | B-25 |
| UI | UI Recruitment | FAIL | — | B-29: placeholder, API 404 |
| attendance | Month-lock checklist | PASS | 200 |  {"companyId": 1, "month": "2026-09-01", "canLock": false, "alreadyLocked": false, "items": [{"code": "period_c |
| attendance | Month-lock Sep 2026 with failing checklist is refused | PASS | 400 |  {"defined": false, "code": "BAD_REQUEST", "status": 400, "message": "Month lock blocked: population_ready, att |
| payroll | HR head (R) cannot create payroll run | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: payroll.run.manage"} |
| payroll | HR head can view runs (R) | PASS | 200 |  [{"id": 1, "companyId": 1, "month": "2026-10-01", "runType": "regular", "status": "inputs_locked", "attendance |
| lifecycle | Probation reviews list | PASS | 200 |  {"reviews": []} |
| lifecycle | Probation alerts | PASS | 200 |  {"d30ReviewIds": [], "d14ReviewIds": [], "d7ReviewIds": []} |
| lifecycle | HR head approves resignation (step 2) | FAIL | 500 |  {"defined": false, "code": "INTERNAL_SERVER_ERROR", "status": 500, "message": "Internal server error"} |
| letters | HR head signs letter step 2 | PASS | 200 |  {"outcome": "approved"} |
| policies | HR head publishes policy needing ack | PASS | 200 |  {"id": 1} |
| policies | Ack report | PASS | 200 |  [{"policyId": 1, "policyTitle": "Code of Conduct 2026", "effectiveDate": "2026-10-18", "ecode": "RGH000001", " |
| reports/dashboards | Build muster | PASS | 200 |  {"rows": 10} |
| reports/dashboards | Headcount Excel export | PASS | 200 |  application/json |
| admin/rbac/settings | HR head cannot list users | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: admin.roles"} |
| admin/rbac/settings | HR head reads setting | PASS | 200 |  {"key": "att.ot_decision_hours", "value": 48, "valueType": "number", "description": "ATT-08: the hard 48-hour  |
| lifecycle | Probation reviews after new joiner | PASS | 200 |  {"reviews": [{"id": 1, "employeeId": 12, "ecode": "RML000011", "name": "Beta Newjoin", "department": "Producti |
| lifecycle | HR head confirms employee | PASS | 200 |  {"outcome": "confirmed", "confirmationLetterId": 4} |

#### payroll_admin
Visible nav pills: Dashboard, People, Attendance, Payroll, Helpdesk, Reports, Settings (any extra items are under "More"). Login: ok. Logout: ok. Opening a protected URL after logout shows the sign-in form.
UI crawl: 34 healthy, 17 correctly 403-gated, 4 broken: /my/claims, /loans, /claims, /recruitment.

| Module | Task | Result | HTTP | Notes |
|---|---|---|---|---|
| UI | UI Payroll run console | FAIL | — | B-01: static mock, can't create/compute/approve from UI |
| UI | UI Salary structures page loads real structures | PASS | — |  |
| leave | Payroll cannot adjust leave (no leave.admin) | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: leave.admin"} |
| payroll | Compute payroll run #2 (Sep 2026) | FAIL | 500 |  {"defined": false, "code": "INTERNAL_SERVER_ERROR", "status": 500, "message": "Internal server error"} |
| payroll | Compute payroll run #1 (Oct 2026) | FAIL | 500 |  {"defined": false, "code": "INTERNAL_SERVER_ERROR", "status": 500, "message": "Internal server error"} |
| payroll | Create run for month w/o attendance lock (should be refused) | FAIL | 200 |  {"id": 3} |
| payroll | Finalize non-computed run refused | FAIL | 500 |  {"defined": false, "code": "INTERNAL_SERVER_ERROR", "status": 500, "message": "Internal server error"} |
| payroll | Approve non-computed run refused | FAIL | 500 |  {"defined": false, "code": "INTERNAL_SERVER_ERROR", "status": 500, "message": "Internal server error"} |
| payroll | Structure preview CTC 8,24,196 (G1) | PASS | 200 |  {"monthly": {"BASIC": 32286, "HRA": 16143, "MEDICAL_ALLOW": 1250, "EDUCATION_ALLOW": 200, "STATUTORY_BONUS": 2 |
| payroll | Structure preview low wage 2,40,000 | PASS | 200 |  {"monthly": {"BASIC": 9000, "HRA": 4500, "PF_EE": 1080, "ESI_EE": 102, "PF_ER": 330, "EPS_ER": 750, "EDLI": 45 |
| payroll | Assign salary to RGH employee with RML structure refused | FAIL | 500 |  {"defined": false, "code": "INTERNAL_SERVER_ERROR", "status": 500, "message": "Internal server error"} |
| lifecycle | Payroll computes F&F | PASS | 200 |  {"calculation": {"employeeId": 9, "separationId": 4, "approvedLwd": "2027-01-15", "daysPayable": 15, "earnings |
| claims/T&E | Payroll approved claims for payout | PASS | 200 |  [] |
| claims/T&E | Finance/payroll settles travel claim | PASS | 200 |  {"settlementId": 1, "netPayablePaise": 310000, "netRecoverablePaise": 0, "advanceAdjustedPaise": 0, "walletBal |
| directory/profile | Payroll sees unmasked IDs | PASS | 200 |  {"ecode": "RML000008", "name": "Debajit Roy", "photoPath": null, "gender": "Male", "dob": "1987-08-15", "marit |
| lifecycle | Payroll cannot complete IT-owned task | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: lifecycle.onboard.conve |

#### plant_head
Visible nav pills: Dashboard, People, Attendance, Lifecycle, Reports (any extra items are under "More"). Login: ok. Logout: ok. Opening a protected URL after logout shows the sign-in form.
UI crawl: 39 healthy, 11 correctly 403-gated, 5 broken: /my/claims, /loans, /claims, /reports/r29-helpdesk, /recruitment.

| Module | Task | Result | HTTP | Notes |
|---|---|---|---|---|
| UI | UI Lifecycle nav item | FAIL | — | B-34: every call 403 |
| attendance | Plant head read muster | PASS | 200 |  [] |
| directory/profile | Plant head directory (plant scope) | PASS | 200 |  {"items": [{"ecode": "RML000001", "name": "Arun Gupta", "designation": "Chief Executive Officer", "department" |

#### ceo_cell
Visible nav pills: Executive, Reports (any extra items are under "More"). Login: ok. Logout: ok. Opening a protected URL after logout shows the sign-in form.
UI crawl: 40 healthy, 9 correctly 403-gated, 6 broken: /my/claims, /loans, /claims, /reports/r29-helpdesk, /executive, /recruitment.

| Module | Task | Result | HTTP | Notes |
|---|---|---|---|---|
| UI | UI Executive dashboard after snapshot rebuild | FAIL | — | B-26: TOTAL manpower 0; before the rebuild, "No snapshot yet" |
| UI | UI Reports R29 | FAIL | — | B-25: JS crash |
| payroll | CEO cannot view payroll register | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: payroll.run.view"} |
| payroll | CEO cannot read individual salary history (agg only) | FAIL | 200 |  [{"id": 2, "structure_id": 2, "effective_from": "2026-04-01", "effective_to": "9999-12-31", "annual_ctc_rupees |
| directory/profile | CEO profile view masked | PASS | 200 |  {"pan": null, "aadhaar": null, "statutoryMasked": true} |
| reports/dashboards | CEO executive dashboard has data | FAIL | 404 |  {"defined": false, "code": "NOT_FOUND", "status": 404, "message": "No KPI snapshot has been built yet \u2014 r |
| reports/dashboards | Executive trend | PASS | 200 |  [{"label": "May", "date": "2026-05", "value": null}, {"label": "Jun", "date": "2026-06", "value": null}, {"lab |
| reports/dashboards | Executive leavers | PASS | 200 |  [{"id": 1, "employeeName": "Sushanta Nayak", "ecode": "RGH000001", "company": "Rashmi Green Hydrogen Steel Ltd |

#### it_admin
Visible nav pills: Home, My Attendance, My Leave, My Pay, Helpdesk, People, Settings (any extra items are under "More"). Login: ok. Logout: ok. Opening a protected URL after logout shows the sign-in form.
UI crawl: 34 healthy, 17 correctly 403-gated, 4 broken: /my/claims, /loans, /claims, /recruitment.

| Module | Task | Result | HTTP | Notes |
|---|---|---|---|---|
| UI | UI Users & Roles / Audit / Settings pages load | PASS | — |  |
| attendance | Biometric sync (Kent) - integration unavailable expected | PASS | 503 |  {"defined": false, "code": "SERVICE_UNAVAILABLE", "status": 503, "message": "Kent integration is not configure |
| attendance | Device health list | PASS | 200 |  [{"doorCode": "KGP-GATE1", "source": "kent", "lastSeenAt": "2026-10-18T16:03:51.769Z", "watermarkAt": null, "i |
| payroll | IT admin cannot view payroll runs | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: payroll.run.view"} |
| payroll | IT admin cannot read salaries | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Can only view your own compensation details |
| lifecycle | IT clearance update | FAIL | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: lifecycle.separation.ap |
| directory/profile | IT admin profile view masked & no salary | PASS | 200 |  {"pan": null, "aadhaar": null, "statutoryMasked": true} |
| assets | IT admin lists assets | PASS | 200 |  {"rows": [{"id": 1, "assetNo": "BETA-LT-001", "category": "laptop", "description": "Dell 5440", "serialNo": "S |
| admin/rbac/settings | IT admin lists users | PASS | 200 |  [{"userId": 12, "email": "admin@rashmi.test", "ecode": null, "name": null, "roles": ["super_admin"]}, {"userId |
| admin/rbac/settings | IT admin RBAC matrix | PASS | 200 |  {"roles": [{"code": "ceo_cell", "name": "CEO Cell / Executive"}, {"code": "employee", "name": "Employee (ESS)" |
| admin/rbac/settings | IT admin cannot grant super_admin (grant<=own) | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Cannot delegate or revoke this permission:  |
| admin/rbac/settings | IT admin cannot grant payroll_admin to self | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "You cannot change your own roles."} |
| admin/rbac/settings | IT admin cannot add permission grant to its own role | PASS | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Cannot delegate or revoke this permission:  |
| admin/rbac/settings | IT admin audit log | PASS | 200 |  {"rows": [{"id": 763, "at": "2026-10-18T16:14:14.932Z", "actorUserId": 12, "actorName": "admin@rashmi.test", " |
| admin/rbac/settings | Audit chain verify | PASS | 200 |  {"intact": true, "brokenAtId": null} |
| lifecycle | IT admin completes IT onboarding task | FAIL | 403 |  {"defined": false, "code": "FORBIDDEN", "status": 403, "message": "Missing permission: lifecycle.onboard.conve |

#### super_admin
Visible nav pills: Dashboard, People, Attendance, Leave, Payroll, Lifecycle, Assets, Helpdesk, Settings (any extra items are under "More"). Login: ok. Logout: ok. Opening a protected URL after logout shows the sign-in form.
UI crawl: 42 healthy, 0 correctly 403-gated, 13 broken: /me, /my/attendance, /my/leave, /my/claims, /my/team, /my/team/overtime, /policies, /loans, /claims, /reports/r21-offers, /reports/r29-helpdesk, /travel, /recruitment.

| Module | Task | Result | HTTP | Notes |
|---|---|---|---|---|
| UI | UI ESS pages for an account with no employee record | FAIL | — | B-30 |
| directory/profile | Super admin directory sees all entities | PASS | 200 |  {"items": [{"ecode": "RGH000001", "name": "Sushanta Nayak", "designation": "Engineer", "department": "Producti |
| reports/dashboards | Rebuild executive snapshot | PASS | 200 |  {"snapshotDate": "2026-10-18", "metrics": 68} |
| admin/rbac/settings | Super admin grants hr_ops to IT user | PASS | 200 |  {"ok": true} |
| admin/rbac/settings | Super admin revokes hr_ops from IT user | PASS | 200 |  {"changed": true} |
| admin/rbac/settings | Grant unknown role rejected | PASS | 404 |  {"defined": false, "code": "NOT_FOUND", "status": 404, "message": "Unknown role: god"} |
| admin/rbac/settings | Super admin updates setting (same value) | PASS | 200 |  {"ok": true} |
| admin/rbac/settings | Setting wrong type rejected | FAIL | 500 |  {"defined": false, "code": "INTERNAL_SERVER_ERROR", "status": 500, "message": "Internal server error"} |

#### unauthenticated

| Module | Task | Result | HTTP | Notes |
|---|---|---|---|---|
| auth | no/garbage token -> 401 | PASS | [401, 401] |   |

#### unauthenticated (candidate)

| Module | Task | Result | HTTP | Notes |
|---|---|---|---|---|
| lifecycle | Pre-join link validates (unauthenticated) | PASS | 200 |  {"isValid":true,"candidateId":1,"candidateName":"Beta Newjoin","positionTitle":"Shift Engineer"} |
| lifecycle | Invalid pre-join token rejected | PASS | 200 |  {"isValid":false,"error":"Invalid or unknown pre-join token."} |
| lifecycle | Pre-join invalid PAN format rejected | FAIL | 200 |  {"success":true,"candidateId":1} |
| lifecycle | Pre-join token single-use (resubmit blocked) | PASS | 400 |  {"defined":false,"code":"BAD_REQUEST","status":400,"message":"This candidate is no longer accepting a prejoin  |

### 3. Bug table

Screenshot paths are relative to `/workspace/hrms-test/beta/`. "API" means I reproduced it with curl/Python (scripts are in `beta/api/`). Each "likely cause" is my guess from reading the code; I did not debug it to root cause.

| ID | Sev | Role | Module | Steps to reproduce | Expected | Actual | Screenshot | Likely cause / file |
|---|---|---|---|---|---|---|---|---|
| B-01 | Critical | payroll_admin (and every role) | Payroll | Log in as any user and open `/payroll` or `/payroll/parallel-run` | The real run console, built from `/payroll/runs/*` | A hard-coded mock: "Rashmi Metaliks Limited — June 2026, COMPUTED", 5 fictitious employees (Rajesh Mukherjee…), net ₹1,49,903. The page makes no API calls, so payroll can't be run from the UI. An employee can open the page too. | screenshots/payroll_admin/21_payroll.png, screenshots/employee/21_payroll.png, screenshots/payroll_admin/24_payroll_parallel-run.png | `frontend/src/pages/payroll/PayrollPage.tsx` and `ParallelRunPage.tsx` contain static data (0 fetch calls) |
| B-02 | Critical | employee (all ESS) | Payslip / My Pay | Log in as employee@ or employee2@ and open `/my/pay` | That employee's own payslip, from `/payroll/outputs/getMyPayslip` (which returns `null` because no run is computed) | Every employee sees the same fake payslip: net ₹57,999, ecode **RML035384**, made-up masked PAN/UAN/bank, leave CL 5 / EL 13.5 / SL 7.5 (the real balance is CL 3 / SL 5) | screenshots/employee/07_my_pay.png, screenshots/employee/ui-mypay-employee2.png | `frontend/src/pages/payroll/MyPayPage.tsx` (no API calls) |
| B-03 | Critical | manager → employee | Workflows / SoD | API: manager `PUT /workflows/delegations {toUserId:9 (Priya, a direct report)}`. Priya applies CL for 2026-12-28 (wf 21) and then `POST /workflows/requests/21/act approve` as herself | Delegating to a subordinate is blocked, or at least a delegate can never act on their own request | 200 `{"outcome":"approved"}`. The leave was approved by its own applicant. | API | `backend/src/modules/workflows` delegation and act: no requester ≠ actor check |
| B-04 | Critical | employee | Lifecycle / Exit | API as employee@ (Debajit, id 8): `POST /lifecycle/separations/apply {employeeId:9, reason:"fake resignation for colleague"}` | 403. Self-service can only resign for yourself | 200. Separation #3 was created for Priya, initiatedBy "employee" (I withdrew it afterwards as HR) | API | `lifecycle` separations apply handler trusts `employeeId` from the body |
| B-05 | Critical | payroll_admin | F&F | Priya resigns (sep #4) → RM approves → payroll `POST /lifecycle/separations/4/compute-fnf {daysPayable:15}` | Prorated pay of about ₹10k (annual CTC ₹2.4L, monthly gross about ₹18–20k) | Line reads "Gross ₹21,18,200 / 30 × 15" = **₹10,59,100**. Basic+DA ₹9,00,000. Notice recovery ₹30,000 for a 1-day shortfall. Net payable **₹10,29,100**, about 100× too high | API | F&F service mixes paise and rupees (monthly components in paise are treated as rupees) |
| B-06 | Critical | employee | Loans | API as employee2: `POST /api/loans/preview` (₹1L) returns `eligible:false`. Then `POST /api/loans/apply {loan_flat, ₹1,00,00,000, 60m}` | Ineligible loans are rejected, and anything else goes RM → HR head → payroll (wf def `loan`) | 200, loanId 3, EMI ₹2,08,333/month against a gross of ₹20,000. Status is **active** at once, and no workflow is created (nothing in RM inbox) | API | `backend/src/modules/loans/loans.service.ts`: apply skips the eligibility result and the workflow |
| B-07 | High | payroll_admin | Payroll run | `POST /payroll/runs/compute {id:1}` (or approve/finalize) | 400 "attendance month must be locked" | **500** Internal server error. Underneath: `Error: Cannot transition to 'computed': Attendance month must be locked first` (run-compute.service.ts:42). Also `runs/create` and `lockInputs` succeed with no attendance lock (run 3 created) | API | Plain `Error` not mapped to ORPCError; create has no lock guard |
| B-08 | High | all | Claims / Loans UI | Open `/my/claims`, `/claims` or `/loans` as any role | Entitlements, claims and loans listed | 404 on `/api/claims/my-entitlements`, `/api/claims/my` and `/api/loans/my`. The pages show "No records" even though employee2 has 2 active loans. The routes are declared as `path:'/api/claims/...'` under the `/api` prefix, so they're actually served at `/api/api/claims/...`. The pages also use bare `fetch()` with no Bearer token. | screenshots/employee/08_my_claims.png, screenshots/employee/ui-loans.png | `backend/src/modules/claims/claims.router.ts`, `loans/loans.router.ts` (path prefix); `frontend/src/pages/payroll/ClaimsPage.tsx`, `LoansPage.tsx` (raw fetch) |
| B-09 | High | employee | Claims | `POST /api/api/claims/submit` with a valid bill, a reversed period, or an amount over the entitlement | 200, or a 400 with a message | **500** in all three cases. There's no document-upload endpoint either, so a valid `documentId` can't be produced and a claim can't be submitted at all | API | `claims.service.ts` throws plain `Error` (lines 106–134); bill FK to documents |
| B-10 | High | employee / manager / hr_head | Resignation workflow | Priya applies (sep #4) → check RM inbox → RM approves → HR head approves | RM → HR head → HR ops chain with inbox items, and the employee can see/withdraw their own resignation | `workflowRequestId:null`, nothing in RM inbox. One RM approve sets status **approved**. HR head approve → **500**. Employee `GET /lifecycle/separations/4` and withdraw → 403. Duplicate resignations accepted (#4, #5). LWD in the past → 500 | API | `lifecycle` separation service doesn't use `wf` resignation definition |
| B-11 | High | manager | Probation | RM evaluates review 1 and then calls `POST /lifecycle/probation/decide {outcome:confirmed}` | 403, because the final decision belongs to HR head (wf `confirmation` step 2) | 200, confirmation letter 3 issued. HR head deciding again also gets 200 (letter 4), so the decision isn't idempotent | API | probation decide guarded only by `lifecycle.confirmation.approve`, which managers also hold |
| B-12 | High | employee | Attendance / Leave | Apply CL for future dates → approve → cancel → approve the cancel. Then `GET /my/attendance?month=2026-10` (or 11) | Future days go back to unprocessed / working day | Future days now show **A (Absent)**: RML000008 on 26–27 Oct, RML000009 on 23–24 Nov (also in the team grid) | screenshots/manager/09_my_team.png | Leave-cancel write-back recomputes future dates as absent |
| B-13 | High | ceo_cell | Compensation privacy | As ceo@: `GET /payroll/salaries/history/8` and `/payroll/salaries/effective/8` | 403 (doc 08: CEO gets aggregate compensation only) | 200, full individual CTC and component breakdown | API | salaries router allows `employee.compensation.read`, which CEO holds |
| B-14 | High | employee | Travel / Loans (IDOR) | As employee@: `GET /travel/trips?employeeId=9`, `/travel/trips/3`, `/travel/advances?employeeId=9`, `/travel/claims?employeeId=9`, `/travel/wallet?employeeId=9`, `/api/api/loans/:id/ledger?loanId=2` | 403 | 200 with Priya's trips, advances, claims, wallet and loan ledger | API | travel and loans routers don't scope `employeeId`/`loanId` to the caller |
| B-15 | High | employee / manager / payroll | Travel workflow | Create trip with end < start; add a claim item dated 2025-01-01; RM approves advance; payroll settles a **draft** claim | Validation errors; RM can approve; only submitted and approved claims can be settled | Trip 2 saved with end < start; out-of-range item accepted; RM gets 403 (advance approval needs `payroll.run.manage`); draft claim 1 settled for ₹3,100 | API | `backend/src/modules/travel` |
| B-16 | High | hr_ops (RML-scoped) | Lifecycle scope | As hrops@: `GET /lifecycle/separations` and `POST /lifecycle/transfers {employeeId:11 (RGH)}` | Only RML rows; 403 for RGH | Sees RGH separations #1–2. Transfer #2 created for the RGH employee | API | lifecycle list/transfer don't call `assertEmployeesInScope` |
| B-17 | High | payroll_admin / employee | Salary structure statutory | `POST /payroll/structures/preview {structure_id:2, ctc:824196}` (doc 10 G1) and structure 3 at ₹2.4L | G1: ESI 0, ER EPF ₹2,624, Special ₹12,005. Gross ₹18,436: ESI EE ₹139 / ER ₹600 (ceil) | G1: ESI_EE ₹395 / ESI_ER ₹1,709 (above the ₹21k ceiling), PF_ER ₹1,185, Special ₹11,735. Low-wage case: ESI ₹102 / ₹439. Employees see the same numbers in `/payroll/salaries/effective`. (The `/statutory/estimate` engine itself matches every doc 10 golden case.) | API | Seed formulas in `backend/migrations/1752220000000_pay-schema-init.ts`: `ESI_EE = GROSS*0.0075` has no 21k gate; `PF_ER = PF_WAGES*0.0367` |
| B-18 | High | hr_ops / manager | Transfer | hr_ops `POST /lifecycle/transfers {emp 9, department→IT, effectiveDate 2026-11-01}` → RM approve → hr_ops approve | Chain current RM → receiving RM → HR ops, applied on the effective date | RM approve → 403 (`lifecycle.transfers.manage`). HR ops alone approves → status completed, and the employee's department is already **IT** on 18 Oct | API | lifecycle transfers service |
| B-19 | Medium | employee | Leave | Apply SL (pending) → `POST /leave/applications/6/cancel` | Pending request can be withdrawn | 400 "Only approved leave can be cancelled (this one is pending)". There's no other withdraw route | API | `leave` cancel handler |
| B-20 | Medium | hr_ops, payroll, super_admin | Error handling | (a) hr_ops leave adjustment for RGH emp 11; (b) payroll salary assign for emp 11 with the RML structure; (c) super_admin `PUT /settings/att.ot_decision_hours {value:"abc", valueType:number}`; (d) resignation with a past LWD | 403 / 400 | **500** each time. The request is still refused, but the user gets "Internal server error" | API | `core/rbac/employee-scope.ts:54` throws plain `Error`; same pattern in settings, claims, payroll and lifecycle |
| B-21 | Medium | hr_ops / hr_head | Onboarding | `GET /lifecycle/onboarding-reference-data` | Lists org units, locations and salary structures | `orgUnits:[]`, `locations:[]`, `salaryStructures:[]` (they exist: OU 1, location 1, structures 2–3), so the convert form can't be completed in the UI. The API convert with ids works | API | lifecycle reference-data query |
| B-22 | Medium | hr_ops | Onboarding | Ingest candidate X, then `check-duplicate` with the same email/mobile, then ingest again | Duplicate flagged and refused | `hasDuplicate:false`, and a second candidate (#2) is created | API | candidates service |
| B-23 | Medium | candidate | Pre-join | `POST /lifecycle/prejoin/submit` with `pan:"INVALIDPAN"` | 400 (PAN format AAAAA9999A) | 200, accepted and token consumed. No format checks on PAN, Aadhaar or IFSC either | API | prejoin zod schema only checks min length |
| B-24 | Medium | hr_ops | Attendance | `PUT /attendance/days/override {emp 9, date 2026-12-12, status P}` | Future date refused | 200, and 12 Dec is now marked P | API | attendance override handler |
| B-25 | Medium | hr_ops, hr_head, manager, plant_head, ceo, super_admin | Reports UI | Open `/reports/r29-helpdesk` (and `/reports/r21-offers` as hr_ops or super_admin) | Report renders | Blank page with a JS error: `TypeError: Cannot read properties of undefined (reading 'toFixed')`; R21: `reading 'replace'` | screenshots/hr_ops/46_reports_r29-helpdesk.png, screenshots/hr_ops/39_reports_r21-offers.png | `frontend/src/pages/reports/SupportingReports.tsx` (R29/R21 renderers vs API shape) |
| B-26 | Medium | ceo_cell | CEO dashboard | Log in as ceo@ → `/executive` (after the snapshot rebuild) | Manpower TOTAL = sum of categories (11) | TOTAL **0** while White-collar shows 11; table overflows and the Consultants column is cut off. Before the nightly job runs, the dashboard is empty ("No snapshot yet" / API 404). Roles without access see "No snapshot yet" instead of a permission message | screenshots/ceo_cell/ui-executive-after-rebuild.png, screenshots/ceo_cell/49_executive.png | `reports/executive` total aggregation (companyId null row) |
| B-27 | Medium | ceo_cell / hr | Reports numbers | `GET /reports/executive/leavers`, `/reports/r26-attrition` | Only confirmed / approved exits | Includes RGH000001, whose separation is still **pending**, and Priya, approved by RM only | API | executive/attrition queries don't filter separation status |
| B-28 | Medium | it_admin | Onboarding / Exit | it_admin `POST /lifecycle/tasks/complete {taskId:1}` (owner role it_admin); `POST /lifecycle/clearances/update {department:IT}` | Allowed | 403 (needs `lifecycle.onboard.convert` / `separation.approve`) | API | lifecycle router permissions |
| B-29 | Medium | all | Recruitment / ATS | Open `/recruitment` | Requisitions / ATS | Placeholder page; `GET /api/recruitment/requisitions` → 404, and the backend has no recruitment module. Offer/LOI approval chain can't be tested | screenshots/hr_head/56_recruitment.png | not implemented |
| B-30 | Medium | super_admin | ESS pages | super_admin (no employee record) opens `/me`, `/my/attendance`, `/my/leave`, `/policies`, `/travel` | Pages hidden, or an empty state | 404/400 errors; `/api/travel/wallet` → **500** | screenshots/super_admin/01_me.png, screenshots/super_admin/55_travel.png | nav shows ESS-only pages to an account with no employee profile; travel wallet doesn't handle a null employee_id |
| B-31 | Low | employee | Permissions (info disclosure) | As employee: `/admin/settings` or `GET /settings`; `GET /payroll/structures/2` | Hidden (admin.settings / salary.write) | Every policy value is readable, and so are salary structures, including the grade BASIC override ₹32,286 | screenshots/employee/51_admin_settings.png, screenshots/employee/22_payroll_structures.png | settings/structures GET not permission-gated |
| B-32 | Low | all | Auth | Login page "Forgot password?" | Self-service reset | It's only a `mailto:` link; `/auth/forgot-password` etc. → 404 | screenshots/employee/ui-login-bad-password.png | not implemented |
| B-33 | Low | hr_head / employee | Formatting | `GET /lifecycle/probation/reviews`; `/travel` page | Dates like "18 Oct 2026" | `doj:"Sun Oct 18"`, `dueDate:"Sun Apr 18"` (no year); travel table shows raw `2026-11-10T00:00:00.000Z` | screenshots/employee/ui-travel.png | Date.toString slice / missing formatter |
| B-34 | Low | plant_head | Nav | plant_head nav shows "Lifecycle" | Only pages the role can use | `/lifecycle` loads, then 403 on every call | screenshots/plant_head/27_lifecycle.png | `frontend/src/app/nav-config.ts` (shown on `lifecycle.separation.approve`) |
| B-35 | Low | all | Console noise | Cold load of any page | No errors | `401 POST /api/auth/refresh` plus one 404 console error on every first load (refresh with no cookie) | — | `lib/session.ts` boot refresh |


### 4. Permission-leak findings

Backend permission checks hold for most role-level probes (I sent about 150 "should be 403" calls, and the large majority were refused with `Missing permission: …`). The leaks I found are about data scope, chain steps, and pages that don't call the backend:

- **Self-approval through delegation (B-03).** `PUT /workflows/delegations` accepts any user, including the delegator's own report. The delegate can then approve a request they raised themselves.
- **Acting for another employee (B-04).** `POST /lifecycle/separations/apply` accepts any `employeeId` from a plain employee.
- **CEO sees individual compensation (B-13).** `GET /payroll/salaries/history|effective/{id}` returns 200 for ceo_cell; doc 08 says aggregate only.
- **Horizontal IDOR in Travel and Loans (B-14).** `/travel/trips`, `/travel/trips/{id}`, `/travel/advances`, `/travel/claims`, `/travel/wallet` with `?employeeId=` and `/api/api/loans/:id/ledger?loanId=` all return another employee's data. (`/travel/wallet/ledger` returned an empty list for the peer.)
- **Org-unit scope bypass for hr_ops (B-16).** Separations list includes RGH rows, and a transfer can be created for an RGH employee. Elsewhere scope holds: leave adjustment, attendance days/override, profile and letters were all refused for RGH, though some as 500 instead of 403 (B-20).
- **Chain-step bypass (B-11, B-10, B-18, B-06).** RM can take the HR-head probation decision; resignation finalises on RM approval; a transfer completes on HR ops approval with the RM steps skipped; loans skip their 3-step chain entirely.
- **Information disclosure (B-31).** Every role can read the policy settings store and salary structures (including the grade BASIC amount); `/payroll/components` too.
- **No route guards in the UI.** Except `/dev/gallery`, every route renders for every role (`frontend/src/app/router.tsx`). Usually the backend then returns 403 and the page shows "Missing permission", which is acceptable. But the payroll console and My Pay pages need no API at all, so an employee sees a payroll register and a payslip (fake data, B-01/B-02).
- Held correctly (sample): employee/manager can't adjust leave, override attendance, month-lock, assign salary, see payroll runs, generate bank/ECR files, list all loans, publish policies or announcements, manage assets, read audit, or grant roles. Manager can't read CEO attendance or profile. Statutory IDs are masked for manager, HR ops, IT and CEO, and unmasked for payroll. Helpdesk tickets, letters and leave requests can't be read or acted on by peers. it_admin can't grant super_admin, can't change its own roles, and can't add grants it doesn't hold. Logout revokes both the access and refresh tokens.

### 5. Statutory sanity check (doc 10)

I called `POST /payroll/statutory/estimate` and `/projectTds` as payroll_admin. Every doc 10 golden case matched:

| Case | Expected (doc 10) | Got |
|---|---|---|
| G1 Basic 32,286, gross 64,573, ACTUAL | EE PF 3,874; ER EPS 1,250; ER EPF 2,624; EDLI 75; PT 200; ESI 0 | same (admin 161) |
| G2 Basic 22,000 CEILING_15000 | EE 1,800; EPS 1,250; EPF 1,390 | same; PT 150 on gross 40k |
| G3a gross 20,999 | ESI applicable | EE 158 / ER 683 (ceil) |
| G3b gross 21,001 | ESI not applicable | 0 / 0 |
| G4 PT 9,999/12,000/20,000/35,000/45,000 | 0/110/130/150/200 | 0/110/130/150/200 |
| Apprentice (category trainee + contract apprentice) | no PF/ESI | PF 0, ESI 0, PT 110. With category omitted, apprentice is not detected |
| G5 TDS new regime taxable 7L / 12L / 12.5L / 18L | 0 / 0 / ≤50,000 + cess / slab + cess | 0 / 0 / 52,000 / 1,66,400 |

The salary-structure CTC breakup does **not** use this engine. Its seeded component formulas give wrong ESI and PF_ER (B-17), and employees see those numbers in their salary breakdown. The real payroll compute (payslip lines) couldn't be run (see §6).

### 6. What I couldn't test, and why

- **Payroll end to end** (compute → review → approve → finalize → payslips → bank file → SAP JV → ECR/ESIC/PTRC/Form 24Q, payroll holds, reopen). Compute needs a locked attendance month. Month-lock for Sep 2026 is refused by its checklist: population_ready (10 employees missing biometric registration), attendance_complete (300 missing days), recompute_drained, manager_approvals. That's a test-data limit; I didn't fake DB rows. The compute endpoint also returns 500 instead of the guard message (B-07). Payslip content and statutory return files are therefore unverified, and `getMyPayslip` returns `null`.
- **Biometric import.** `POST /attendance/sync` → 503 "Kent integration is not configured". There's no file-upload import endpoint. Unmatched/quarantine queues are empty.
- **Brute-force lockout / rate limit.** The running backend has `RATE_LIMIT_AUTH_PER_IDENTIFIER=10000` set in its environment (test override), so 7 bad attempts weren't throttled. Not a product finding.
- **Forgot / reset password.** Not implemented (mailto link only, B-32).
- **Recruitment / ATS and the Offer/LOI chain.** Module not implemented (B-29).
- **Expense-claim approval chain** (RM → HR verify → payroll payout). Claims can't be submitted (B-09, no document upload), so the decide/route-payout steps weren't exercised.
- **OT approval and lapse.** No pending OT exists; OT detection needs punch ingestion. The lapse sweep needs `admin.integrations`.
- **Absence-case letters/stages, leave accrual, year-end and comp-off expiry jobs.** These need `admin.integrations` (job endpoints); I didn't run them so I wouldn't mutate shared balances.
- **Email/notifications** (daily boarding/exit mail, SLA reminders, escalations). No mail sink was observable.
- **UI form-level coverage.** I drove these forms in the UI: login (valid, bad, empty), logout, leave apply, approvals approve, plus a screenshot of every route for every role. All other create/approve actions were tested through the API.
- **Multi-level leave (RM → HR ops if > N days).** The seeded `leave` definition has only one step, so there's no second level to test (configurable in Approval chains). Multi-level chains I did test: letters (HR ops → HR head) and delegation.

### 7. Observations (not counted as bugs)

- Employee directory for a plain employee shows only themselves (`employee.read` = Own per doc 08), so "Directory" is effectively a profile link.
- HR ops can't view the quarantined-punch queue, shift masters or routing holds, or run the absence scan. These need `admin.integrations` / `admin.settings`; worth confirming against the doc 04 HR-ops charter.
- Managers can't view a report's leave balance (`/leave/balances/{id}` needs `leave.admin`).
- Employees can't use the TDS estimator API (`payroll.run.view`); the My Pay tax panel is static anyway.
- The executive "Gross salary spend MTD ₹6,21,634.8" and "Cost per man-hour ₹1,841.4" have values even though no payroll run has ever been computed. Probably derived from salary assignments; worth confirming the source.
- Backdated SL for 2026-08-10 (69 days ago), created by the earlier QA session, is still pending. There's no visible backdating limit for leave (attendance AR has 30 days).

### 8. Artifacts

- API scripts: `beta/api/bh.py` (helper), `t_auth.py`, `t_leave.py`, `t_att.py`, `t_lc.py`, `t_lc2.py`, `t_te.py`, `t_misc.py`, `t_rep.py`. Raw results: `results.jsonl`. GET sweep across 5 roles: `get-sweep.tsv`. Dashboard/report matrix: `rep-matrix.tsv`.
- UI: `beta/crawl.mjs` (per-role crawl, results in `crawl-all.json`, `crawl-summary.txt`), `ui_leave.mjs`, `ui_leave2.mjs`, `ui_appr.mjs`, `ui_misc.mjs`. Frontend log: `/workspace/hrms-test/beta-frontend.log`.

## 11. Database schema audit (merged from `/workspace/hrms-test/schema/SCHEMA_AUDIT.md`)

**Verdict:** the schema is moderately precise (6/10).
- **Good:** types are right (no float; money is NUMERIC(14,2); instants are timestamptz; business days are date; IST swipe attribution is correct). PKs and key uniques exist (one attendance row per employee per day, one payslip per employee per run). The org spine is tenant-safe via composite FKs. All 54 migrations are applied and have a `down()`.
- **Weak:** too few constraints and too much sprawl.

Counts: **Critical 1, High 8, Medium 18, Low 13** (40 findings; all from read-only queries and code/migration reads).

Top issues:
- **S-01 (Critical):** `pay.statutory_rates` is empty and `pt_slabs`/`it_slabs` are never read. Statutory rates are literals in component formulas (no ₹21k ESIC gate, uncapped PF_ER). This is the root cause of the ESIC/PF mis-calcs.
- **S-02 (High):** `pay.claims` default `funding_kind='budget'` plus CHECK `claims_budget_present` means every insert from `claims.service.ts:142` violates the CHECK.
- **S-03 (High):** PAN, Aadhaar, UAN, ESIC and IFSC have no format CHECK and no uniqueness; `INVALIDPAN` is stored.
- **S-04 (High):** 10 employee-master columns that docs/03 marks NOT NULL are nullable; 11/12 employees have NULL contract_type and 2 have NULL cost_center.
- **S-05 / S-06 (High):** cross-company salary structure (salary 4), and a te.advance owned by a different employee than its trip (advance 1).
- **S-07 (High):** a separation was approved with no workflow, and one employee has duplicate pending separations.
- **S-08 (High):** `pay.loans` has no CHECKs, no workflow requirement and no audit rows (₹5 cr loan is active).
- **S-09 (High):** ML is gated on `'F'` but employees store `'Female'`, so 0 of 3 women are eligible.

See SCHEMA_AUDIT.md for the full table, the spec diff and data quality.
