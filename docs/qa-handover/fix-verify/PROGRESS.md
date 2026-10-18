# Fix programme — progress & handoff (box copy /workspace/hrms-fix)

Env (box reset at 22:45 IST 18-Oct wiped system pkgs + PG): run `fix-verify/env/bootstrap.sh`,
`env/reset-fix-db.sh` (hrms_fix = tester snapshot + migrations), `env/start-servers.sh` (:5110/:5183).
PG data now persists in /workspace/.pg17data. 'hrms' DB restored from snapshot (tester state 18-Oct ~22:20).
Recon: `recon/run-recon.sh` → must print Counter({'MATCH': 44}) and RML033625 net 59124.

## Commits
- 2ddd422 security/permissions + workflows
- b92b6d2 payroll engine (P-01..P-21), lifecycle/edge tests, flaky WF test fix
- ba6e81d payroll configurability APIs + real payroll console UI (C-05 run console)

## Open (to do, in order)
1. C-xx status audit (REPORT.md §C list) — write CHANGES.md table.
2. Data validations SOW 084-092 + employee master edit API/UI (hr_ops) [C-25, C-48].
3. CTC templates / probation 70-80-90 [C-19, SOW 014/026].
4. Org masters CRUD (super_admin) [SOW 004, C-48]; sessions view/revoke (it_admin); HOD model.
5. Payroll config UI page (/payroll/settings): statutory, PT, GL, components editor.
6. Form 16/24Q [146], challan recon [147], offer/LOI [022, C-31], flexi basket [027], recommendations [194].
7. Parallel run page mock? (C-05) ; My Pay mock (C-06) — verify.
8. Playwright harness: role task suites (10 roles + hr_ops RML/RGH, it_admin, super_admin, HOD), usability scores, screenshots.
9. VERIFY_REPORT.md, CHANGES.md, SOW_TRACEABILITY.md/.xlsx, payroll configurability table, patch+bundle.

## Update 18-Oct 23:40 IST (round: mock removal + group/entity scope)
Done (uncommitted at time of writing → see next commit):
- C-05/C-06: real My Pay + Parallel Run pages; getMyPayslip only finalized/paid.
- Removed every fake-data fallback / "(Demo mode)" success toast: Claims, Loans (preview, ledger now real postings),
  Travel, Probation, Separation (F&F mock computation, mock pay success, sample clearances, hardcoded asset AST-LT-092,
  payment ref default), Transfers, Salary Revisions. authFetch/responseError helpers in lib/api.ts (Claims/Loans used bare fetch → 401s).
- Separation: compute-fnf response unwrap bug fixed ({calculation}); real approved-separation picker; flag-unreturned-assets drawer
  from /assets/held-by; absconding by e-code (backend accepts ecode).
- Group vs entity scope: entity-bound assignment confines 'all' grants (permissions.service + workflow-access);
  payroll runs/inputs/outputs/parallel-run enforce run company scope (requireRunInScope); list filtered; create checks company.
  assertCompanyInScope now 403 (was 500). Test: tests/group-entity-scope.integration.test.ts.
- DOCS_READ.md written (all client docs + docs/ + plans/).

New directives queued (parent steering 23:21–23:27):
- MNC readiness section (CHANGES.md + VERIFY_REPORT.md) + feasible fixes (formula-injection guard, request IDs/health, PII encryption plan…).
- Group-level roles: entity switcher/filter in UI, consolidated dashboards/reports with per-entity breakdown, hr_head/super_admin act on RML+RGH, entity roles can't cross.
- Bulk upload framework (xlsx+csv; .xls rejected with message — no safe maintained parser): template w/ dropdowns+instructions,
  preview with row report (xlsx download), all-or-nothing commit, dup detection, idempotent re-upload, limits, background+progress, audit.
  Importers: payroll inputs/recoveries (+Report 4 layout), parallel-run register (Report 4), salary assignment/revision, employee master,
  punches (Kent EmployeeSwipeDetails layout), leave balance adjustments, loans, statutory rates/PT slabs, holidays, assets, F&F inputs (SOW-221).
- DOCS_READ §D items 1–18.

E2E (job/e2e, 01:40 IST 19-Oct): baseline on main c1cfe2c with the snapshot was 269 tests: 196 pass, 69 fail, 4 skip. Added scope and concurrency specs. Concurrency found E2E-022 (F&F double pay → 5 letters), E2E-023 (duplicate bank batches) and E2E-024 (overlapping punch uploads fail with 409). Production-readiness pass is next.
## Update 19-Oct IST (job/payroll)
- PG17 on the box (see /workspace/STATE/ENV.md). DBs: hrms_base (stage-1 template), hrms_snapshot (June-2026 runs 4/5 finalized, rebuilt by fix-verify/seed), hrms_recon/fix/ui/e2e, hrms_test_blank (pristine test template).
- Recon: `fix-verify/recon/run-recon.sh` → RECON PASS: MATCH 44, RML033625 net 59124 (baseline c1cfe2c and after every payroll round).
- Matrix: `attendance-payroll/scripts/run-matrix.sh` → MATRIX PASS 49/49.
- Item 4 done (cycle, divisor, sandwich, half-day, holidays per company/plant + import). Old-regime surcharge fixed. See CHANGES.md "payroll & attendance" round and CD-P1..P7.
- Kent → muster → payroll (owner bar #2): no-swipe days materialised (hourly job + recompute API range), fresh-install month-lock blocker fixed (migration 1752700000200), muster LOP = payroll LOP. Matrix K01–K03 drive the simulator through adapter → ingest → lock → muster → payroll: MATRIX PASS 52/52.
- Requirements (reqs job, 19 Oct 02:55 IST): owner's joining form RML/HR/02/01 (3 packs) mapped field-by-field (requirements/JOINING_FORM_MAP.md: 170 fields, 36 exist / 28 partial / 27 wrong / 79 missing) and Enterprise Blueprint gap (requirements/BLUEPRINT_GAP.md: 87 reqs, 3 done / 62 partial / 22 missing); 55 rows RQ-JF-001..022 + RQ-BP-* added to REQUIREMENTS.md/.xlsx (total 313). Go-live gaps filed as REQ-001..017 in /workspace/STATE/BUGS.md. Docs only, no app code.
