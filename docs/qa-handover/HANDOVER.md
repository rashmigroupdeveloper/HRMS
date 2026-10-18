# Rashmi HRMS: QA and fix programme handover (19 Oct 2026, 00:30 IST)

Written for a new assistant or account taking over from "tester". Read this file first, then the files it links.

## Owner's requirements and preferences (Anoop)
- Build and judge to MNC standard: multi-entity isolation, enterprise security and audit, scalability, i18n-ready, polished UX, and exact India statutory payroll (PF, ESIC with ₹21k gate, WB PT, TDS, F&F).
- Implement and verify every SOW and Protiviti requirement, with no regressions. Read the docs fully rather than skimming.
- hr_head and super_admin are GROUP-level (all companies: RML=1, RGH=2, and any added later). Other roles (hr_ops, payroll_admin, plant_head, HOD, manager, employee) are limited to their own company, department or team.
- Bulk Excel (.xlsx) upload everywhere: template, preview, validation, all-or-nothing commit, audit.
- UI: Crextio-inspired "Warm Editorial" design (docs/12-VISUAL-REFERENCE-CREXTIO.md, docs/05-UIUX-SPEC.md, .impeccable/critique). It should be the most pleasing possible for every role on Windows desktops (1366/1920, 125-150% scaling) and phones.
- Testing should cover every role and every task, through the UI and the API, and include usability for hr_head, admin and super_admin (how easy their daily work is). Loop fix and retest until a full pass is clean.
- Work directly on `main`. Local DBs are test DBs, so no separate test DB is needed.
- The sample payroll truth is RML033625 Prateek Kumar Singh, June 2026: gross 64573; PF 3874 (12% of actual basic 32286), ESI 0, PT 200, canteen 1375; net **59124**.

## State of main
- `aca537f` (pushed 19 Oct 00:26 IST) contains everything below on top of `d714353`:
  - Security and permissions: error firewall, auth rate limiters, password policy and reset, refresh-token reuse revocation, permission-gated settings, workflow segregation of duties and delegation checks, approval chains for each module.
  - Payroll engine: data-driven statutory rules, loans lifecycle, OT, EMI, carry-forward, F&F guards (paise, no double pay), paid state, payslip atomicity (P-01 to P-21). **All 44 mock employees reconcile with the register, and RML033625 nets 59124.**
  - Payroll configurability: versioned and audited statutory, PT, GL and variable-input APIs; no retro edits into finalized months; auto attendance lock; back-to-draft; a real payroll run console.
  - Mock and demo fallbacks removed; real My Pay, Parallel Run, Claims, Loans, Separation and F&F screens.
  - Group vs entity scope; payroll run company isolation.
  - Bulk Excel/CSV import framework with 10 importers and a Data Imports UI; identity validators (PAN, Aadhaar, IFSC, bank); payroll co-sign limited to hr_head (break-glass opt-in).
  - HOD role: derived from department_heads master, department scope, admin screen, department_head approver.
  - UI overhaul: role-aware shell and dashboards, company switcher for group roles, DataTable (search, sort, column chooser, saved views, export, bulk select, phone cards), phone bottom bar and sheets, camera bill capture, zero overflow at 360px, dark-mode hero, lazy routes and transitions.
- New migrations: 17524000000xx (auth lifecycle, domain workflow chains, loans approval, payroll statutory data) and later 1752500000xxx.

## Still open (priority order)
Statuses are in `requirements/REQUIREMENTS.xlsx` (258 rows: 43 Done, 171 Partial, 40 Missing at 23:40 18 Oct, before the last rounds). The fix list as given to the fixer:
1. Transfer workflow (work was in progress and uncommitted at handover, so redo it).
2. Employee master create/edit (hr_ops) and org masters CRUD (super_admin); validation for minors and duplicate UAN/ESIC; family updates; company statutory IDs.
3. Investment declaration (ESS), Form 16, TDS challan reconciliation, Form 24Q routed.
4. Configurable muster cycle (26th-25th); attendance-to-payroll correctness: LOP divisor, half days, holidays and week-offs excluded, sandwich rule, joiner and leaver proration, holiday calendars per company/plant with Excel import. Scenario matrix of 30+ cases with hand-computed expected values; see `attendance-payroll/scripts`.
5. OT pre-approval; offer/LOI chain with plant-head step; off-cycle payroll; F&F cycle and turnaround tracking; global travel advance with CHRO as final approver; mobile geo check-in; recruitment and master reports.
6. CTC templates; probation 70/80/90; sessions view and revoke (it_admin); payroll settings UI page (statutory, PT, GL, components editor).
7. Email (SMTP) delivery, Kent feed adapter, backup and restore script.
8. MNC hardening: CSV/Excel formula-injection guard, request IDs and health, PII encryption plan.
9. Conflicting rules (see `requirements/CONFLICTS.md`): make each one configurable, default it to what the sample register and docs/08 support, and list it under "Client decisions needed" in CHANGES.md.
10. UI: finish screenshots of every role at 1366, 1920, 768, 390 and 360; axe a11y; Lighthouse; restyle screens added after the UI pass (Data Imports, Department Heads, etc.).
11. Final independent verification: `npm run verify` in backend and frontend (backend branch coverage 80%), recon 44/44, the e2e suite for every role, then a VERIFY_REPORT.md and verdict for Anoop.

## Files in this folder
- `REPORT.md`: the original QA verdict (48 issues: C/A/B/S/P IDs; SOW coverage). `beta/BETA_REPORT.md`: 35 UI bugs. `schema/SCHEMA_AUDIT.md`: 40 schema findings. `payroll/PAYROLL_TEST_REPORT.md`: 33 P-xx bugs, with `reconciliation.xlsx`, `cohort.json` and `scripts/`.
- `requirements/`: REQUIREMENTS.md/.xlsx (258 atomic rows with UI acceptance steps), SOW_TRACEABILITY.xlsx (176 SOW rows), ROLE_TASKS.md (positive and negative tests for each role), CONFLICTS.md (49 doc conflicts and 18 client questions), DOCS_READ.md.
- `fix-verify/`: CHANGES.md, PROGRESS.md (fixer log), DOCS_READ.md; `env/` scripts to bootstrap Postgres 17, reset DB and start servers; `recon/` reconciliation (`run-recon.sh` must print MATCH 44 with RML033625 net 59124; the DB snapshot was not included because of its size).
- `e2e-suite/`: Playwright (TypeScript) role-task suite. Run `npm i && npx playwright install chromium`, then see README.md.
- `USERS.md`: seeded test users for every role. `sow.txt`: SOW text.

## Running locally
Backend is Express 5/TS/Kysely/oRPC/Postgres on :5100; frontend is React 19/Vite/Tailwind v4 on :5173 (proxies /api). Run `npm run verify` in each project (typecheck, lint, knip, depcruise, tests, build). Run migrations, then seed (see backend package.json scripts).
