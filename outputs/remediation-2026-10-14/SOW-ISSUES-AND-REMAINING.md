# Current SOW issues and remaining work — 14 Oct 2026

All 176 original rows are retained. This report matches reviewed defects to exact requirement IDs; it does not certify delivery. Source wording is preserved. Original workbook is unchanged.

Baseline implemented descriptions come from the 10 Oct crosswalk. Current repairs and tests are listed separately. An absent finding means that current end-to-end verification remains necessary.

Current status counts: {'Blocked by reviewed defects': 109, 'Requires current end-to-end verification': 32, 'Scope decision pending': 6, 'Manual/service evidence pending': 29}.

**Evidence correction:** the earlier R35 JSONB representation concern does not establish double encoding. A read-only driver probe returned an object. Raw prejoin tokens and the concurrent single-use race remain open. See jsonb-probe-correction.json.

## Reviewed defects and SOW links

| Finding | Repair status | Direct SOW rows | Issue |
|---|---|---|---|
| R01 | verified-fixed | SOW-027, SOW-028, SOW-029, SOW-030, SOW-181, SOW-187, SOW-221, SOW-223, SOW-224, SOW-225, SOW-227, SOW-228, SOW-230 | Fresh migration chain cannot build claims schema |
| R02 | partial-repair-verified | SOW-004, SOW-005, SOW-010, SOW-128 | Applied schema and typed checkout still disagree |
| R03 | partial-repair-verified | SOW-003, SOW-068, SOW-072, SOW-073, SOW-074, SOW-075, SOW-076, SOW-077, SOW-081, SOW-103, SOW-104, SOW-105, SOW-106, SOW-107, SOW-109, SOW-110, SOW-111, SOW-113, SOW-114, SOW-115, SOW-116 | Payroll attendance SQL is incompatible and day arithmetic is unsafe |
| R04 | partial-repair-verified | SOW-003, SOW-012, SOW-013, SOW-014, SOW-026, SOW-033, SOW-034, SOW-036, SOW-037, SOW-038, SOW-068, SOW-072, SOW-073, SOW-074, SOW-075, SOW-076, SOW-077, SOW-081, SOW-082, SOW-103, SOW-104, SOW-105, SOW-106, SOW-107, SOW-109, SOW-110, SOW-111, SOW-113, SOW-114, SOW-115, SOW-116 | Mid-month salary assignments can be skipped silently |
| R05 | open | SOW-003, SOW-010, SOW-027, SOW-028, SOW-029, SOW-030, SOW-072, SOW-073, SOW-074, SOW-075, SOW-076, SOW-077, SOW-081, SOW-095, SOW-096, SOW-097, SOW-098, SOW-099, SOW-100, SOW-101, SOW-118, SOW-119, SOW-120, SOW-121, SOW-122, SOW-123, SOW-124, SOW-130, SOW-141, SOW-142, SOW-145, SOW-146, SOW-147, SOW-149, SOW-150, SOW-151, SOW-152, SOW-153, SOW-154, SOW-155, SOW-156, SOW-157, SOW-158, SOW-159, SOW-160, SOW-162, SOW-163, SOW-164, SOW-165, SOW-166, SOW-167, SOW-168, SOW-178, SOW-179, SOW-181, SOW-184, SOW-185, SOW-187, SOW-221, SOW-223, SOW-224, SOW-225, SOW-227, SOW-228, SOW-230 | Real payroll never supplies required statutory and debt facts |
| R06 | partial-repair-verified | SOW-003, SOW-068, SOW-072, SOW-073, SOW-074, SOW-075, SOW-076, SOW-077, SOW-081, SOW-103, SOW-104, SOW-105, SOW-106, SOW-107, SOW-109, SOW-110, SOW-111, SOW-113, SOW-114, SOW-115, SOW-116, SOW-136, SOW-137 | Recovery inputs print but do not reduce net pay |
| R07 | partial-safety-repair | SOW-003, SOW-062, SOW-063, SOW-064, SOW-065, SOW-068, SOW-072, SOW-073, SOW-074, SOW-075, SOW-076, SOW-077, SOW-081, SOW-103, SOW-104, SOW-105, SOW-106, SOW-107, SOW-109, SOW-110, SOW-111, SOW-113, SOW-114, SOW-115, SOW-116 | Detected OT is paid without approval and uses an absent component |
| R08 | open | SOW-003, SOW-036, SOW-037, SOW-038, SOW-082, SOW-103, SOW-104, SOW-105, SOW-106, SOW-107, SOW-109, SOW-110, SOW-111, SOW-116 | Arrears can be paid again on subsequent runs |
| R09 | partial-repair-verified | SOW-003, SOW-065, SOW-068, SOW-072, SOW-073, SOW-074, SOW-075, SOW-076, SOW-077, SOW-079, SOW-081, SOW-091, SOW-093, SOW-095, SOW-096, SOW-097, SOW-098, SOW-099, SOW-100, SOW-101, SOW-103, SOW-104, SOW-105, SOW-106, SOW-107, SOW-109, SOW-110, SOW-111, SOW-113, SOW-114, SOW-115, SOW-116 | Finalization ignores line and review reconciliation failures |
| R10 | open | SOW-003, SOW-036, SOW-037, SOW-038, SOW-065, SOW-068, SOW-072, SOW-073, SOW-074, SOW-075, SOW-076, SOW-077, SOW-079, SOW-081, SOW-082, SOW-091, SOW-093, SOW-095, SOW-096, SOW-097, SOW-098, SOW-099, SOW-100, SOW-101, SOW-103, SOW-104, SOW-105, SOW-106, SOW-107, SOW-109, SOW-110, SOW-111, SOW-116 | Closed payroll results remain editable |
| R11 | partial-repair-verified | SOW-003, SOW-009, SOW-065, SOW-068, SOW-072, SOW-073, SOW-074, SOW-075, SOW-076, SOW-077, SOW-079, SOW-081, SOW-091, SOW-093, SOW-095, SOW-096, SOW-097, SOW-098, SOW-099, SOW-100, SOW-101, SOW-213 | Maker/checker validation fails open on missing evidence |
| R12 | open | SOW-003, SOW-009, SOW-027, SOW-028, SOW-029, SOW-030, SOW-065, SOW-068, SOW-072, SOW-073, SOW-074, SOW-075, SOW-076, SOW-077, SOW-079, SOW-081, SOW-091, SOW-093, SOW-095, SOW-096, SOW-097, SOW-098, SOW-099, SOW-100, SOW-101, SOW-118, SOW-119, SOW-120, SOW-121, SOW-122, SOW-124, SOW-181, SOW-187, SOW-213, SOW-221, SOW-223, SOW-224, SOW-225, SOW-227, SOW-228, SOW-230 | New API routes disagree with product callers |
| R13 | open | SOW-003, SOW-027, SOW-028, SOW-029, SOW-030, SOW-065, SOW-068, SOW-072, SOW-073, SOW-074, SOW-075, SOW-076, SOW-077, SOW-079, SOW-081, SOW-091, SOW-093, SOW-095, SOW-096, SOW-097, SOW-098, SOW-099, SOW-100, SOW-101, SOW-181, SOW-182, SOW-187 | Payroll UI simulates successful computation and payment facts |
| R14 | open | SOW-010, SOW-022, SOW-025, SOW-027, SOW-028, SOW-029, SOW-030, SOW-031, SOW-033, SOW-034, SOW-040, SOW-041, SOW-042, SOW-044, SOW-118, SOW-119, SOW-120, SOW-121, SOW-122, SOW-124, SOW-127, SOW-129, SOW-182, SOW-204, SOW-218, SOW-221, SOW-222, SOW-223, SOW-224, SOW-225, SOW-227, SOW-228, SOW-230 | API errors silently become sample employee records |
| R15 | open | SOW-009, SOW-040, SOW-041, SOW-042, SOW-044, SOW-204, SOW-213, SOW-218, SOW-221, SOW-222, SOW-223, SOW-224, SOW-225, SOW-227, SOW-228, SOW-230 | New financial/lifecycle endpoints do not enforce ownership scope |
| R16 | open | SOW-003, SOW-040, SOW-041, SOW-042, SOW-044, SOW-060, SOW-204, SOW-218, SOW-221, SOW-222, SOW-223, SOW-224, SOW-225, SOW-227, SOW-228, SOW-230 | F&F substitutes fixture salary, leave and payable days |
| R17 | open | SOW-003, SOW-040, SOW-041, SOW-042, SOW-044, SOW-060, SOW-139, SOW-204, SOW-216, SOW-218, SOW-221, SOW-222, SOW-223, SOW-224, SOW-225, SOW-227, SOW-228, SOW-230 | F&F can mark paid and issue letters without approval/payment |
| R18 | open | SOW-003, SOW-010, SOW-012, SOW-013, SOW-014, SOW-022, SOW-025, SOW-026, SOW-031, SOW-033, SOW-034, SOW-127, SOW-129, SOW-130, SOW-132, SOW-133, SOW-134, SOW-182 | Onboarding conversion is not atomic and creates unusable salary/login |
| R19 | open | SOW-022, SOW-033, SOW-034, SOW-040, SOW-041, SOW-042, SOW-044, SOW-058, SOW-064, SOW-204, SOW-218, SOW-221, SOW-222, SOW-223, SOW-224, SOW-225, SOW-227, SOW-228, SOW-230 | Lifecycle approval and notification claims lack workflow records |
| R20 | open | SOW-003, SOW-012, SOW-013, SOW-014, SOW-026, SOW-033, SOW-034 | Probation confirmation leaves a salary gap and zero components |
| R21 | open | SOW-036, SOW-037, SOW-038, SOW-083, SOW-095, SOW-096, SOW-097, SOW-098, SOW-099, SOW-100, SOW-101 | Transfer e-codes use employee count instead of allocator |
| R22 | open | SOW-003, SOW-036, SOW-037, SOW-038, SOW-082, SOW-095, SOW-096, SOW-097, SOW-098, SOW-099, SOW-100, SOW-101, SOW-103, SOW-104, SOW-105, SOW-106, SOW-107, SOW-109, SOW-110, SOW-111, SOW-116 | Future transfers mutate today and promotions do not change salary |
| R23 | open | SOW-027, SOW-028, SOW-029, SOW-030, SOW-118, SOW-119, SOW-120, SOW-121, SOW-122, SOW-124 | ESS loan application bypasses eligibility and approval |
| R24 | open | SOW-010, SOW-118, SOW-119, SOW-120, SOW-121, SOW-122, SOW-124 | Loan ledger is mutable and repeated deductions are not unique |
| R25 | open | SOW-027, SOW-028, SOW-029, SOW-030, SOW-181, SOW-187, SOW-221, SOW-223, SOW-224, SOW-225, SOW-227, SOW-228, SOW-230 | General claims cannot insert into the actual budget-owned model |
| R26 | open | SOW-010, SOW-027, SOW-028, SOW-029, SOW-030, SOW-118, SOW-119, SOW-120, SOW-121, SOW-122, SOW-124, SOW-187 | Claim routing declares paid before funds or batch lines exist |
| R27 | open | SOW-027, SOW-028, SOW-029, SOW-030, SOW-181, SOW-187, SOW-221, SOW-223, SOW-224, SOW-225, SOW-227, SOW-228, SOW-230 | Entitlement policy is invented and the reservation check races |
| R28 | open | SOW-003, SOW-027, SOW-028, SOW-029, SOW-030, SOW-072, SOW-073, SOW-074, SOW-075, SOW-076, SOW-077, SOW-081, SOW-095, SOW-096, SOW-097, SOW-098, SOW-099, SOW-100, SOW-101, SOW-118, SOW-119, SOW-120, SOW-121, SOW-122, SOW-123, SOW-124, SOW-145, SOW-146, SOW-147, SOW-181, SOW-184, SOW-185, SOW-187, SOW-221, SOW-223, SOW-224, SOW-225, SOW-227, SOW-228, SOW-230 | Year-end claim taxable recovery counts unrelated bills repeatedly |
| R29 | open | SOW-003, SOW-027, SOW-028, SOW-029, SOW-030, SOW-068, SOW-072, SOW-073, SOW-074, SOW-075, SOW-076, SOW-077, SOW-081, SOW-095, SOW-096, SOW-097, SOW-098, SOW-099, SOW-100, SOW-101, SOW-103, SOW-104, SOW-105, SOW-106, SOW-107, SOW-109, SOW-110, SOW-111, SOW-113, SOW-114, SOW-115, SOW-116, SOW-118, SOW-119, SOW-120, SOW-121, SOW-122, SOW-123, SOW-124, SOW-145, SOW-146, SOW-147, SOW-181, SOW-184, SOW-185, SOW-187, SOW-221, SOW-223, SOW-224, SOW-225, SOW-227, SOW-228, SOW-230 | Parallel-run gate can pass with missing population or component errors |
| R30 | open | SOW-003, SOW-004, SOW-005, SOW-010, SOW-027, SOW-028, SOW-029, SOW-030, SOW-072, SOW-073, SOW-074, SOW-075, SOW-076, SOW-077, SOW-081, SOW-095, SOW-096, SOW-097, SOW-098, SOW-099, SOW-100, SOW-101, SOW-118, SOW-119, SOW-120, SOW-121, SOW-122, SOW-123, SOW-124, SOW-128, SOW-145, SOW-146, SOW-147, SOW-181, SOW-184, SOW-185, SOW-187, SOW-221, SOW-223, SOW-224, SOW-225, SOW-227, SOW-228, SOW-230 | Opening YTD financial facts exist only in process memory |
| R31 | open | SOW-003, SOW-036, SOW-037, SOW-038, SOW-082, SOW-103, SOW-104, SOW-105, SOW-106, SOW-107, SOW-109, SOW-110, SOW-111, SOW-116 | Apply-increment reports success without salary revisions |
| R32 | open | SOW-019, SOW-069 | Executive financial KPIs silently substitute estimates |
| R33 | open | SOW-003, SOW-027, SOW-028, SOW-029, SOW-030, SOW-065, SOW-072, SOW-073, SOW-074, SOW-075, SOW-076, SOW-077, SOW-081, SOW-095, SOW-096, SOW-097, SOW-098, SOW-099, SOW-100, SOW-101, SOW-181, SOW-182, SOW-187 | Output readiness and artifact ownership are inferred incorrectly |
| R34 | open | SOW-003, SOW-053, SOW-065, SOW-069, SOW-072, SOW-073, SOW-074, SOW-075, SOW-076, SOW-077, SOW-081, SOW-095, SOW-096, SOW-097, SOW-098, SOW-099, SOW-100, SOW-101, SOW-139, SOW-143, SOW-182, SOW-214 | SAP mapping loses legal payer and cost-center dimensions |
| R35 | open | SOW-009, SOW-010, SOW-022, SOW-025, SOW-031, SOW-127, SOW-129, SOW-132, SOW-133, SOW-134, SOW-182 | Prejoin single-use and at-rest token claims are inaccurate |
| R36 | open | SOW-010, SOW-025, SOW-049, SOW-051, SOW-052, SOW-079, SOW-127, SOW-130, SOW-132, SOW-133, SOW-134 | Biometric verification stamps evidence without checking Kent |
| R37 | open | SOW-139, SOW-216 | Completed-stage and UAT labels exceed verified behavior |
| R38 | open | SOW-003, SOW-004, SOW-005, SOW-010, SOW-027, SOW-028, SOW-029, SOW-030, SOW-072, SOW-073, SOW-074, SOW-075, SOW-076, SOW-077, SOW-081, SOW-095, SOW-096, SOW-097, SOW-098, SOW-099, SOW-100, SOW-101, SOW-118, SOW-119, SOW-120, SOW-121, SOW-122, SOW-123, SOW-124, SOW-128, SOW-145, SOW-146, SOW-147, SOW-181, SOW-184, SOW-185, SOW-187, SOW-221, SOW-223, SOW-224, SOW-225, SOW-227, SOW-228, SOW-230 | Income-tax seed contradicts its cited reference and FY claim |
| R39 | partial-repair-verified | SOW-003, SOW-012, SOW-013, SOW-014, SOW-026, SOW-033, SOW-034, SOW-040, SOW-041, SOW-042, SOW-044, SOW-060, SOW-068, SOW-072, SOW-073, SOW-074, SOW-075, SOW-076, SOW-077, SOW-081, SOW-103, SOW-104, SOW-105, SOW-106, SOW-107, SOW-109, SOW-110, SOW-111, SOW-113, SOW-114, SOW-115, SOW-116, SOW-221, SOW-223, SOW-224, SOW-225, SOW-227, SOW-228, SOW-230 | Salary assignment and payroll disagree on paise versus rupee units |
| R40 | open | SOW-003, SOW-004, SOW-012, SOW-013, SOW-014, SOW-026, SOW-033, SOW-034, SOW-082, SOW-090, SOW-127, SOW-128, SOW-129, SOW-132, SOW-133, SOW-134 | Salary preview and assignment ignore configured amount rules |
| R41 | open | SOW-003, SOW-004, SOW-012, SOW-013, SOW-014, SOW-026, SOW-033, SOW-034, SOW-082, SOW-090 | Probation scales earnings after dependent contributions have already been computed |
| R42 | open | SOW-003, SOW-068, SOW-072, SOW-073, SOW-074, SOW-075, SOW-076, SOW-077, SOW-081, SOW-103, SOW-104, SOW-105, SOW-106, SOW-107, SOW-109, SOW-110, SOW-111, SOW-113, SOW-114, SOW-115, SOW-116, SOW-170, SOW-171, SOW-172, SOW-173, SOW-174, SOW-175, SOW-176 | Configured PT slabs are accepted by the compute interface but never used |
| R43 | partial-repair-verified | SOW-004, SOW-005, SOW-010, SOW-128 | Generated timestamp and numeric aliases nest Kysely ColumnType wrappers |
| R44 | partial-repair-verified | SOW-003, SOW-053, SOW-068, SOW-069, SOW-072, SOW-073, SOW-074, SOW-075, SOW-076, SOW-077, SOW-081, SOW-103, SOW-104, SOW-105, SOW-106, SOW-107, SOW-109, SOW-110, SOW-111, SOW-113, SOW-114, SOW-115, SOW-116, SOW-139, SOW-143, SOW-214 | Parallel comparison drops repeated lines of the same component |
| R45 | partial-repair-verified | SOW-003, SOW-004, SOW-005, SOW-010, SOW-053, SOW-065, SOW-069, SOW-072, SOW-073, SOW-074, SOW-075, SOW-076, SOW-077, SOW-081, SOW-095, SOW-096, SOW-097, SOW-098, SOW-099, SOW-100, SOW-101, SOW-128, SOW-139, SOW-143, SOW-182, SOW-214 | Numeric SOW citations in phase plans and backend comments do not identify the original requirements |
| R46 | open | SOW-009, SOW-213 | Full integration results vary across repeated runs and HTTP error bodies are hidden by downstream casts |

## Every SOW point

### SOW-003 — original spreadsheet row 3

**One-time setup / 1.One Time setup**

perform changes on software as per client policies and requirements.

**Current:** Blocked by reviewed defects. **Historical baseline:** Partial.

**Requirement references:** CORE-13, ATT-04/05, PAY-01..18

**Historical implementation evidence:** Typed settings, policy publication, attendance and leave rules exist.

**Remaining scope from full crosswalk:** Complete payroll/lifecycle policy execution and signed policy settings. Broad SOW promise is not fully met.

**Execution cards:** P02, W03, D01

**Database connections:** att.month_locks, att.overtime_entries, core.letter_templates, core.letters, core.policies, core.policy_acknowledgments, core.policy_versions, eng.announcements, eng.poll_responses, eng.polls, eng.survey_responses, eng.surveys, pay.arrears, pay.inputs, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions

**Current reviewed issues:**

- R03 (partial-repair-verified; PAY-04): Payroll attendance SQL is incompatible and day arithmetic is unsafe. Remaining repair: Use work_date plus paid leave/weekoff predicates, SUM weighted days, require complete locked inputs and retain true zero payable days. Integration-test P/HD/LWP/paid-WO/all-absent cases.
- R04 (partial-repair-verified; PAY-02, PAY-04, PAY-16): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R05 (open; PAY-09, PAY-10, PAY-12, PAY-13, PAY-14): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R06 (partial-repair-verified; PAY-04, PAY-08): Recovery inputs print but do not reduce net pay. Remaining repair: Classify input and arrear effects by component kind, validate allowed amounts and update earning/deduction/employer bases consistently. Add an independent full-run recovery fixture.
- R07 (partial-safety-repair; PAY-04): Detected OT is paid without approval and uses an absent component. Remaining repair: Consume only approved unconsumed OT against locked inputs; prohibit CO double consumption and bind the approved canonical component/policy base.
- R08 (open; PAY-16): Arrears can be paid again on subsequent runs. Remaining repair: Reserve/consume each signed delta exactly once in the same financial transaction; preserve original/result versions and retry-safe keys.
- R09 (partial-repair-verified; PAY-03, PAY-04): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-03, PAY-16): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R11 (partial-repair-verified; PAY-03): Maker/checker validation fails open on missing evidence. Remaining repair: Persist authoritative maker/checker records with separate DB-backed authorities, reject missing evidence, and atomically enforce legal transitions/audit/reconciliation.
- R12 (open; PAY-03): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R13 (open; PAY-03, PAY-05, PAY-06): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.
- R16 (open; PAY-15): F&F substitutes fixture salary, leave and payable days. Remaining repair: Require authoritative as-of salary, attendance, leave ledger, paid holds, debt and final tax inputs. Fail missing facts explicitly; retain frozen calculation provenance and reviewed overrides.
- R17 (open; PAY-15): F&F can mark paid and issue letters without approval/payment. Remaining repair: Implement approved immutable settlement->payment obligation->verified receipt transitions, with maker/checker, idempotency, audit/outbox and atomic exit/letter release. Do not label queued payouts paid.
- R18 (open; PAY-02): Onboarding conversion is not atomic and creates unusable salary/login. Remaining repair: Use the existing validated employee/e-code/salary/auth public APIs inside one owned transaction. Resolve mandatory master links and actual salary breakup, candidate consumption key, welcome credentials/grants and outbox tasks.
- R20 (open; PAY-02): Probation confirmation leaves a salary gap and zero components. Remaining repair: Close the prior interval at confirmation date, resolve actual approved salary amounts, make decision/salary/employee/letter effects atomic and idempotent, and connect non-confirmation separation.
- R22 (open; PAY-16): Future transfers mutate today and promotions do not change salary. Remaining repair: Publish effective-dated placement/salary changes; activate projections on effective date with validated aligned links, historical scope snapshots and signed leave/entity payroll continuity.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-04, PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R31 (open; PAY-16): Apply-increment reports success without salary revisions. Remaining repair: Resolve approved employee salary facts server-side, atomically create real effective revisions and replay-safe recompute/delta obligations, and return actual persisted counts.
- R33 (open; PAY-05, PAY-06): Output readiness and artifact ownership are inferred incorrectly. Remaining repair: Persist versioned per-run/payer artifacts with checksum, complete population and actual generation receipts; expose availability from those records, not approval state.
- R34 (open; PAY-05): SAP mapping loses legal payer and cost-center dimensions. Remaining repair: Use the approved scoped GL mapping keys from the canonical table, fail missing/ambiguous mappings and reconcile exact balanced amounts from frozen placement/result versions.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.
- R39 (partial-repair-verified; PAY-02, PAY-04, PAY-15): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R40 (open; PAY-01, PAY-02, PAY-07): Salary preview and assignment ignore configured amount rules. Remaining repair: Define and validate the documented amount_rule grammar and CTC anchors; use one assembler for preview and assignment. Reject missing rules rather than fabricate pay. Add real persisted-structure preview/assignment tests with explicit approved amounts.
- R41 (open; PAY-01, PAY-02): Probation scales earnings after dependent contributions have already been computed. Remaining repair: Apply approved probation scaling before evaluating dependent deduction/employer formulas and balancing CTC. Add a hand-computed fixture that includes BASIC, PF_EE and employer PF, with approved rounding and policy inputs.
- R42 (open; PAY-04, PAY-11): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.
- R44 (partial-repair-verified; PAY-04): Parallel comparison drops repeated lines of the same component. Remaining repair: Sum all signed component facts in integer paise per employee/component. Corrected shared component aggregation is now used by the real comparison; durable complete-population two-cycle/sign-off gates remain open under R29.
- R45 (partial-repair-verified; PAY-05): Numeric SOW citations in phase plans and backend comments do not identify the original requirements. Remaining repair: Regenerate phase tables from the exact original crosswalk, preserve requirement IDs, and replace unverified numeric references in backend comments. Done for backend comments and Phase2/3 maps; source-doc section labels and remaining frontend annotations require separate context validation.

### SOW-004 — original spreadsheet row 4

**One-time setup / 1.One Time setup**

Setup of client, employees and compensation master

**Current:** Blocked by reviewed defects. **Historical baseline:** Partial.

**Requirement references:** CORE-01/12, PAY-01

**Historical implementation evidence:** Company/org and employee masters plus import pipeline exist.

**Remaining scope from full crosswalk:** Load/reconcile real employee sources and build compensation master. Historical setup completion is not current migration evidence.

**Execution cards:** F02, P01, L01, D07, D09

**Database connections:** core.companies, core.cost_centers, core.departments, core.designations, core.documents, core.employee_assignments, core.employee_education, core.employee_family, core.employee_history, core.employee_prev_employment, core.employees, core.grades, core.import_batches, core.locations, core.mis_codes, core.onboarding_candidates, core.onboarding_tasks, core.org_units, core.plants, core.prejoin_invitations, core.probation_reviews, core.profile_change_requests, core.reporting_tree, core.source_mappings, pay.employee_salaries, pay.salary_components, pay.salary_structure_versions, pay.salary_structures

**Current reviewed issues:**

- R02 (partial-repair-verified; CORE-12): Applied schema and typed checkout still disagree. Remaining repair: Recover and hash migration provenance; reconcile actual table contracts before feature work. Update Kysely types and migrations together, without dropping canonical models. Untyped deferred modules need explicit scope decisions.
- R30 (open; CORE-12): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R38 (open; CORE-12): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.
- R40 (open; PAY-01): Salary preview and assignment ignore configured amount rules. Remaining repair: Define and validate the documented amount_rule grammar and CTC anchors; use one assembler for preview and assignment. Reject missing rules rather than fabricate pay. Add real persisted-structure preview/assignment tests with explicit approved amounts.
- R41 (open; PAY-01): Probation scales earnings after dependent contributions have already been computed. Remaining repair: Apply approved probation scaling before evaluating dependent deduction/employer formulas and balancing CTC. Add a hand-computed fixture that includes BASIC, PF_EE and employer PF, with approved rounding and policy inputs.
- R43 (partial-repair-verified; CORE-12): Generated timestamp and numeric aliases nest Kysely ColumnType wrappers. Remaining repair: Use one flattened ColumnType with optional insert for defaulted timestamps/numerics. Corrected timestamp and FX declarations; rerun typecheck and actual database flows. Continue nullability/domain compatibility audit separately from column-name equality.
- R45 (partial-repair-verified; CORE-12): Numeric SOW citations in phase plans and backend comments do not identify the original requirements. Remaining repair: Regenerate phase tables from the exact original crosswalk, preserve requirement IDs, and replace unverified numeric references in backend comments. Done for backend comments and Phase2/3 maps; source-doc section labels and remaining frontend annotations require separate context validation.

### SOW-005 — original spreadsheet row 5

**One-time setup / 1.One Time setup**

Transfer of data for the previous months of the current financial year, the previous financial year any prior financial year before that as required in good faith.

**Current:** Blocked by reviewed defects. **Historical baseline:** Partial.

**Requirement references:** CORE-12, NFR-08

**Historical implementation evidence:** EMS seed and greytHR enrichment functions exist, with sample fixtures.

**Remaining scope from full crosswalk:** Import historical payroll/YTD, leave opening balances and agreed prior periods; reconcile against frozen real exports.

**Execution cards:** F01, P07, T04, D11, D12

**Database connections:** ast.assets, ast.assignments, ast.maintenance, att.absence_cases, att.coverage_targets, att.day_records, att.device_watermarks, att.devices, att.employee_shifts, att.holidays, att.ingest_watermarks, att.leave_blackouts, att.manager_month_approvals, att.month_locks, att.overtime_entries, att.quarantined_swipes, att.recompute_queue, att.regularizations, att.roster_publications, att.roster_revisions, att.rosters, att.shift_patterns, att.shift_swaps, att.shifts, att.swipe_events, cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.audit_log, core.companies, core.cost_centers, core.departments, core.designations, core.documents, core.employee_family, core.employee_history, core.employees, core.grades, core.import_batches, core.letter_templates, core.letters, core.locations, core.mis_codes, core.org_units, core.password_reset_tokens, core.permissions, core.plants, core.policies, core.policy_acknowledgments, core.profile_change_requests, core.reporting_tree, core.role_permissions, core.roles, core.settings, core.source_mappings, core.user_roles, core.users, doc.types, eng.announcements, eng.poll_responses, eng.polls, hd.categories, hd.ticket_messages, hd.tickets, ird.grievances, ird.ic_members, ird.posh_case_access_log, ird.posh_cases, ird.whistleblower_reports, lv.applications, lv.leave_types, lv.ledger, lv.restricted_holidays, lv.rh_selections, pay.arrears, pay.budget_categories, pay.budgets, pay.claim_lines, pay.claim_reservations, pay.claim_types, pay.claims, pay.gl_accounts, pay.output_artifacts, pay.parallel_comparison_lines, pay.parallel_comparisons, pay.payroll_runs, pay.statutory_postings, prv.breach_register, prv.consent_events, prv.consents, prv.legal_holds, prv.notice_acks, prv.notices, prv.processing_register, prv.processors, prv.purge_log, prv.purge_proposals, prv.retention_rules, prv.rights_requests, reporting.kpi_daily, reporting.muster_month, sec.access_events, sec.mfa_enrolments, sec.mfa_recovery_codes, sec.password_history, sec.sessions, te.settlements, te.trips, te.wallet_postings, wf.definitions, wf.delegations, wf.event_subscriptions, wf.notifications, wf.request_steps, wf.requests

**Current reviewed issues:**

- R02 (partial-repair-verified; CORE-12): Applied schema and typed checkout still disagree. Remaining repair: Recover and hash migration provenance; reconcile actual table contracts before feature work. Update Kysely types and migrations together, without dropping canonical models. Untyped deferred modules need explicit scope decisions.
- R30 (open; CORE-12): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R38 (open; CORE-12): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.
- R43 (partial-repair-verified; CORE-12): Generated timestamp and numeric aliases nest Kysely ColumnType wrappers. Remaining repair: Use one flattened ColumnType with optional insert for defaulted timestamps/numerics. Corrected timestamp and FX declarations; rerun typecheck and actual database flows. Continue nullability/domain compatibility audit separately from column-name equality.
- R45 (partial-repair-verified; CORE-12): Numeric SOW citations in phase plans and backend comments do not identify the original requirements. Remaining repair: Regenerate phase tables from the exact original crosswalk, preserve requirement IDs, and replace unverified numeric references in backend comments. Done for backend comments and Phase2/3 maps; source-doc section labels and remaining frontend annotations require separate context validation.

### SOW-008 — original spreadsheet row 8

**Core HR / 2.1Employee Data Management**

Management of centralized repository for employee master data, including personal, employment,  and financial details.

**Current:** Requires current end-to-end verification. **Historical baseline:** Partial.

**Requirement references:** CORE-01/07/08

**Historical implementation evidence:** Employee personal/employment/statutory/bank fields and masked profile reads exist.

**Remaining scope from full crosswalk:** Finish validated master editing, financial/compensation data and real master reconciliation. Nullable and unvalidated statutory fields remain.

**Execution cards:** F02, D09

**Database connections:** core.companies, core.cost_centers, core.departments, core.designations, core.employee_assignments, core.employee_education, core.employee_family, core.employee_history, core.employee_prev_employment, core.employees, core.grades, core.import_batches, core.locations, core.mis_codes, core.org_units, core.plants, core.profile_change_requests, core.reporting_tree, core.source_mappings

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-009 — original spreadsheet row 9

**Core HR / 2.1Employee Data Management**

Providing secure access controls based on roles and permissions

**Current:** Blocked by reviewed defects. **Historical baseline:** Partial.

**Requirement references:** CORE-10, NFR-03

**Historical implementation evidence:** Central runtime RBAC, scoped employee reads and permission masking exist.

**Remaining scope from full crosswalk:** Close business procedures using authed without a permission. Helpdesk thread/reply lacks ticket-owner/assignee authorization in inspected paths. Prove negative access tests.

**Execution cards:** F03, D03, D11

**Database connections:** core.audit_log, core.password_reset_tokens, core.permissions, core.role_permissions, core.roles, core.settings, core.user_roles, core.users, sec.sessions

**Current reviewed issues:**

- R11 (partial-repair-verified; CORE-10): Maker/checker validation fails open on missing evidence. Remaining repair: Persist authoritative maker/checker records with separate DB-backed authorities, reject missing evidence, and atomically enforce legal transitions/audit/reconciliation.
- R12 (open; CORE-10): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R15 (open; CORE-10): New financial/lifecycle endpoints do not enforce ownership scope. Remaining repair: Require one declared business permission and server-derived self/subtree/entity/category scope on reads and writes; deny foreign subject IDs and test all restricted roles.
- R35 (open; NFR-03): Prejoin single-use and at-rest token claims are inaccurate. Remaining repair: Store only a hashed expiring invitation token, lock/compare-and-swap atomic consumption, validate typed profile fields and store one consistent object representation; audit and mask statutory data.
- R46 (open; CORE-10): Full integration results vary across repeated runs and HTTP error bodies are hidden by downstream casts. Remaining repair: Capture sanitized typed HTTP error codes/messages at each failed request; resolve route/input/fixture/environment or framework causes, then prove stable serialized full runs. Do not hide failures with casts, skips, fallback records or reduced coverage thresholds.

### SOW-010 — original spreadsheet row 10

**Core HR / 2.1Employee Data Management**

Integration with other Systems, as necessary.

**Current:** Blocked by reviewed defects. **Historical baseline:** Partial.

**Requirement references:** ATT-01/02, CORE-12, LN-03, LC-01

**Historical implementation evidence:** Import pipeline and Kent interface exist.

**Remaining scope from full crosswalk:** Connect real Kent; complete ATS handoff/SSO and SAP loan/JV integrations. Mock Kent is selected at runtime.

**Execution cards:** F04, T01, T03, T04, R01, X01

**Database connections:** att.day_records, att.mobile_submissions, att.quarantined_swipes, att.swipe_events, core.document_operations, core.documents, core.import_batches, core.letter_templates, core.letters, core.onboarding_candidates, core.source_mappings, pay.budget_categories, pay.budgets, pay.claim_lines, pay.claim_reservations, pay.claims, recruit.candidates, recruit.offers, recruit.vacancies, te.booking_events, te.booking_operations, te.currency_rates, te.employee_travel_levels, te.itinerary_segments, te.policy_versions, te.settlements, te.travel_levels, te.trips, te.wallet_postings, wf.event_subscriptions, wf.notification_attempts, wf.notifications

**Current reviewed issues:**

- R02 (partial-repair-verified; CORE-12): Applied schema and typed checkout still disagree. Remaining repair: Recover and hash migration provenance; reconcile actual table contracts before feature work. Update Kysely types and migrations together, without dropping canonical models. Untyped deferred modules need explicit scope decisions.
- R05 (open; LN-03): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R14 (open; LC-01): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R18 (open; LC-01): Onboarding conversion is not atomic and creates unusable salary/login. Remaining repair: Use the existing validated employee/e-code/salary/auth public APIs inside one owned transaction. Resolve mandatory master links and actual salary breakup, candidate consumption key, welcome credentials/grants and outbox tasks.
- R24 (open; LN-03): Loan ledger is mutable and repeated deductions are not unique. Remaining repair: Use immutable funded/opening/recovery/settlement postings with once-only source keys and SUM-derived debt; reconcile legacy provenance in its own field and validate installment ownership.
- R26 (open; LN-03): Claim routing declares paid before funds or batch lines exist. Remaining repair: Create conserved settlement/obligation/consumption records, validate subject/payer and legal states, materialize frozen payroll/batch lines and mark paid only from payment receipt. Attach invariant CHECKs to the existing table.
- R30 (open; CORE-12): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R35 (open; LC-01): Prejoin single-use and at-rest token claims are inaccurate. Remaining repair: Store only a hashed expiring invitation token, lock/compare-and-swap atomic consumption, validate typed profile fields and store one consistent object representation; audit and mask statutory data.
- R36 (open; ATT-01): Biometric verification stamps evidence without checking Kent. Remaining repair: Separate human-confirmed versus connector-confirmed evidence, retain actor/source receipt and wire approved scheduled reminder/escalation jobs; do not manufacture integration proof.
- R38 (open; CORE-12): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.
- R43 (partial-repair-verified; CORE-12): Generated timestamp and numeric aliases nest Kysely ColumnType wrappers. Remaining repair: Use one flattened ColumnType with optional insert for defaulted timestamps/numerics. Corrected timestamp and FX declarations; rerun typecheck and actual database flows. Continue nullability/domain compatibility audit separately from column-name equality.
- R45 (partial-repair-verified; CORE-12): Numeric SOW citations in phase plans and backend comments do not identify the original requirements. Remaining repair: Regenerate phase tables from the exact original crosswalk, preserve requirement IDs, and replace unverified numeric references in backend comments. Done for backend comments and Phase2/3 maps; source-doc section labels and remaining frontend annotations require separate context validation.

### SOW-012 — original spreadsheet row 12

**Core HR / 2.2Compensation Structuring on Tool**

Defining multiple pay structures based on grades, job levels, and locations.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-01/02

**Historical implementation evidence:** Payroll UI shell and integer-paise utilities only.

**Remaining scope from full crosswalk:** Build salary structures/components, grade/location assignments, CTC breakdown and applicable benefits/incentives/perquisites. No payroll business router exists.

**Execution cards:** P01, D10

**Database connections:** core.employee_assignments, core.probation_reviews, pay.employee_salaries, pay.salary_components, pay.salary_structure_versions, pay.salary_structures

**Current reviewed issues:**

- R04 (partial-repair-verified; PAY-02): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R18 (open; PAY-02): Onboarding conversion is not atomic and creates unusable salary/login. Remaining repair: Use the existing validated employee/e-code/salary/auth public APIs inside one owned transaction. Resolve mandatory master links and actual salary breakup, candidate consumption key, welcome credentials/grants and outbox tasks.
- R20 (open; PAY-02): Probation confirmation leaves a salary gap and zero components. Remaining repair: Close the prior interval at confirmation date, resolve actual approved salary amounts, make decision/salary/employee/letter effects atomic and idempotent, and connect non-confirmation separation.
- R39 (partial-repair-verified; PAY-02): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R40 (open; PAY-01, PAY-02): Salary preview and assignment ignore configured amount rules. Remaining repair: Define and validate the documented amount_rule grammar and CTC anchors; use one assembler for preview and assignment. Reject missing rules rather than fabricate pay. Add real persisted-structure preview/assignment tests with explicit approved amounts.
- R41 (open; PAY-01, PAY-02): Probation scales earnings after dependent contributions have already been computed. Remaining repair: Apply approved probation scaling before evaluating dependent deduction/employer formulas and balancing CTC. Add a hand-computed fixture that includes BASIC, PF_EE and employer PF, with approved rounding and policy inputs.

### SOW-013 — original spreadsheet row 13

**Core HR / 2.2Compensation Structuring on Tool**

handling basic pay, allowances, deductions, reimbursements, and performance-linked incentives.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-01/02

**Historical implementation evidence:** Payroll UI shell and integer-paise utilities only.

**Remaining scope from full crosswalk:** Build salary structures/components, grade/location assignments, CTC breakdown and applicable benefits/incentives/perquisites. No payroll business router exists.

**Execution cards:** P01, P02, P06, D10

**Database connections:** att.month_locks, att.overtime_entries, core.documents, core.employee_assignments, core.probation_reviews, pay.arrears, pay.budget_categories, pay.budgets, pay.claim_bills, pay.claim_entitlements, pay.claim_lines, pay.claim_reservations, pay.claim_types, pay.claims, pay.employee_salaries, pay.inputs, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_components, pay.salary_holds, pay.salary_structure_versions, pay.salary_structures, pay.source_consumptions

**Current reviewed issues:**

- R04 (partial-repair-verified; PAY-02): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R18 (open; PAY-02): Onboarding conversion is not atomic and creates unusable salary/login. Remaining repair: Use the existing validated employee/e-code/salary/auth public APIs inside one owned transaction. Resolve mandatory master links and actual salary breakup, candidate consumption key, welcome credentials/grants and outbox tasks.
- R20 (open; PAY-02): Probation confirmation leaves a salary gap and zero components. Remaining repair: Close the prior interval at confirmation date, resolve actual approved salary amounts, make decision/salary/employee/letter effects atomic and idempotent, and connect non-confirmation separation.
- R39 (partial-repair-verified; PAY-02): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R40 (open; PAY-01, PAY-02): Salary preview and assignment ignore configured amount rules. Remaining repair: Define and validate the documented amount_rule grammar and CTC anchors; use one assembler for preview and assignment. Reject missing rules rather than fabricate pay. Add real persisted-structure preview/assignment tests with explicit approved amounts.
- R41 (open; PAY-01, PAY-02): Probation scales earnings after dependent contributions have already been computed. Remaining repair: Apply approved probation scaling before evaluating dependent deduction/employer formulas and balancing CTC. Add a hand-computed fixture that includes BASIC, PF_EE and employer PF, with approved rounding and policy inputs.

### SOW-014 — original spreadsheet row 14

**Core HR / 2.2Compensation Structuring on Tool**

customization for CTC breakup, flexi-benefits, and perquisites

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-01/02

**Historical implementation evidence:** Payroll UI shell and integer-paise utilities only.

**Remaining scope from full crosswalk:** Build salary structures/components, grade/location assignments, CTC breakdown and applicable benefits/incentives/perquisites. No payroll business router exists.

**Execution cards:** P01, P03, P06, T01, D01, D10

**Database connections:** core.documents, core.employee_assignments, core.probation_reviews, pay.budget_categories, pay.budgets, pay.claim_bills, pay.claim_entitlements, pay.claim_lines, pay.claim_reservations, pay.claim_types, pay.claims, pay.employee_salaries, pay.investment_declarations, pay.it_slabs, pay.output_artifacts, pay.payment_obligations, pay.previous_employer_income, pay.pt_slabs, pay.salary_components, pay.salary_structure_versions, pay.salary_structures, pay.source_consumptions, pay.statutory_memberships, pay.statutory_postings, pay.statutory_rates, pay.tax_elections, pay.tds_challans, te.currency_rates, te.employee_travel_levels, te.itinerary_segments, te.policy_versions, te.travel_levels, te.trips

**Current reviewed issues:**

- R04 (partial-repair-verified; PAY-02): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R18 (open; PAY-02): Onboarding conversion is not atomic and creates unusable salary/login. Remaining repair: Use the existing validated employee/e-code/salary/auth public APIs inside one owned transaction. Resolve mandatory master links and actual salary breakup, candidate consumption key, welcome credentials/grants and outbox tasks.
- R20 (open; PAY-02): Probation confirmation leaves a salary gap and zero components. Remaining repair: Close the prior interval at confirmation date, resolve actual approved salary amounts, make decision/salary/employee/letter effects atomic and idempotent, and connect non-confirmation separation.
- R39 (partial-repair-verified; PAY-02): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R40 (open; PAY-01, PAY-02): Salary preview and assignment ignore configured amount rules. Remaining repair: Define and validate the documented amount_rule grammar and CTC anchors; use one assembler for preview and assignment. Reject missing rules rather than fabricate pay. Add real persisted-structure preview/assignment tests with explicit approved amounts.
- R41 (open; PAY-01, PAY-02): Probation scales earnings after dependent contributions have already been computed. Remaining repair: Apply approved probation scaling before evaluating dependent deduction/employer formulas and balancing CTC. Add a hand-computed fixture that includes BASIC, PF_EE and employer PF, with approved rounding and policy inputs.

### SOW-016 — original spreadsheet row 16

**Core HR / 2.3Policy Enforcement & Compliance Tracking**

Platform automated policy updates on portal and employee communication

**Current:** Requires current end-to-end verification. **Historical baseline:** Partial.

**Requirement references:** CORE-13, WF-02

**Historical implementation evidence:** Policy publish, audience feed and acknowledgment exist.

**Remaining scope from full crosswalk:** Wire real communication delivery; queue transport currently logs. Confirm publication audience receives updates.

**Execution cards:** F04, W03

**Database connections:** core.document_operations, core.documents, core.letter_templates, core.letters, core.policies, core.policy_acknowledgments, core.policy_versions, eng.announcements, eng.poll_responses, eng.polls, eng.survey_responses, eng.surveys, wf.event_subscriptions, wf.notification_attempts, wf.notifications

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-017 — original spreadsheet row 17

**Core HR / 2.3Policy Enforcement & Compliance Tracking**

Platform real-time tracking of policy adherence

**Current:** Requires current end-to-end verification. **Historical baseline:** Partial.

**Requirement references:** CORE-13

**Historical implementation evidence:** Policy acknowledgment percentages and employee report exist.

**Remaining scope from full crosswalk:** Acknowledgment proves reading, not general policy adherence. Agree and implement any additional compliance checks.

**Execution cards:** W03, D08

**Database connections:** core.letter_templates, core.letters, core.policies, core.policy_acknowledgments, core.policy_versions, eng.announcements, eng.poll_responses, eng.polls, eng.survey_responses, eng.surveys

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-018 — original spreadsheet row 18

**Core HR / 2.3Policy Enforcement & Compliance Tracking**

Real-Time Policy Acknowledgement Tracking and automated alerts for non-compliance .

**Current:** Requires current end-to-end verification. **Historical baseline:** Partial.

**Requirement references:** CORE-13, WF-02

**Historical implementation evidence:** Acknowledgment tracking, pending list and weekly reminder enqueue exist.

**Remaining scope from full crosswalk:** Deliver reminders via real notification consumer/transport; verify acknowledgment report population and end-to-end alerts.

**Execution cards:** F04, W03, D04

**Database connections:** core.document_operations, core.documents, core.letter_templates, core.letters, core.policies, core.policy_acknowledgments, core.policy_versions, eng.announcements, eng.poll_responses, eng.polls, eng.survey_responses, eng.surveys, wf.event_subscriptions, wf.notification_attempts, wf.notifications

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-019 — original spreadsheet row 19

**Core HR / 2.3Policy Enforcement & Compliance Tracking**

Platform Dashboard for HR and management reporting.

**Current:** Blocked by reviewed defects. **Historical baseline:** Partial.

**Requirement references:** RPT-03/04, CORE-13

**Historical implementation evidence:** HR/BU/CEO pages and KPI snapshot read/build exist.

**Remaining scope from full crosswalk:** Complete cost/CTC/burnout KPIs, correct OT metric (detected minutes currently used, not approved) and attrition denominator (current headcount, not average). Finish drilldowns and accepted KPI fixtures.

**Execution cards:** W04

**Database connections:** core.employee_assignments, pay.payroll_item_lines, pay.payroll_items, pay.source_consumptions, reporting.kpi_daily, reporting.muster_month, reporting.snapshot_builds

**Current reviewed issues:**

- R32 (open; RPT-03, RPT-04): Executive financial KPIs silently substitute estimates. Remaining repair: Use approved versioned scoped snapshots from actual finalized financial/approved OT facts; preserve missing versus0, label any approved estimates and implement the signed KPI formulas/settings.

### SOW-022 — original spreadsheet row 22

**Workforce / 3.1Offer Management**

Generation of offer letter and approvals.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** WF-01, RPT-02, LC-01

**Historical implementation evidence:** Generic workflow spine and recruitment UI shell exist.

**Remaining scope from full crosswalk:** Integrate ATS offers and exact LOI approvals, issue offer letters and expose tracked offer report. Standalone ATS is outside this repository review.

**Execution cards:** L01, R01

**Database connections:** core.documents, core.employee_assignments, core.employees, core.onboarding_candidates, core.onboarding_tasks, core.prejoin_invitations, core.source_mappings, pay.employee_salaries, recruit.candidates, recruit.offers, recruit.vacancies

**Current reviewed issues:**

- R14 (open; LC-01): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R18 (open; LC-01): Onboarding conversion is not atomic and creates unusable salary/login. Remaining repair: Use the existing validated employee/e-code/salary/auth public APIs inside one owned transaction. Resolve mandatory master links and actual salary breakup, candidate consumption key, welcome credentials/grants and outbox tasks.
- R19 (open; WF-01): Lifecycle approval and notification claims lack workflow records. Remaining repair: Wire authoritative versioned workflow requests and domain hooks, transactional audit/outbox and actual notification attempts/receipts. Never manufacture sent/verified timestamps.
- R35 (open; LC-01): Prejoin single-use and at-rest token claims are inaccurate. Remaining repair: Store only a hashed expiring invitation token, lock/compare-and-swap atomic consumption, validate typed profile fields and store one consistent object representation; audit and mask statutory data.

### SOW-023 — original spreadsheet row 23

**Workforce / 3.1Offer Management**

Tracking appointment letters.

**Current:** Requires current end-to-end verification. **Historical baseline:** Implemented.

**Requirement references:** CORE-09

**Historical implementation evidence:** Appointment template, signature workflow, employee archive and ESS letters page exist.

**Remaining scope from full crosswalk:** HR template acceptance and UAT remain; production storage/delivery are cross-cutting prerequisites.

**Execution cards:** P04, L01, W03

**Database connections:** core.documents, core.employee_assignments, core.employees, core.letter_templates, core.letters, core.onboarding_candidates, core.onboarding_tasks, core.policies, core.policy_acknowledgments, core.policy_versions, core.prejoin_invitations, core.source_mappings, eng.announcements, eng.poll_responses, eng.polls, eng.survey_responses, eng.surveys, pay.bank_batch_lines, pay.bank_batches, pay.employee_salaries, pay.gl_accounts, pay.journal_batches, pay.journal_lines, pay.output_artifacts, pay.payment_events, pay.payment_obligations

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-025 — original spreadsheet row 25

**Workforce / 3.2Onboarding & Employee Engagement**

Updation of candidate information by capturing through personal email.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LC-01/02

**Historical implementation evidence:** Onboarding page is a pending shell; boarding/exit report is a separate implemented slice.

**Remaining scope from full crosswalk:** Build personal-email prejoin link, candidate form, delivery/resend tracking and conversion.

**Execution cards:** F04, L01, R01, D03, D11

**Database connections:** core.document_operations, core.documents, core.employee_assignments, core.employees, core.letter_templates, core.letters, core.onboarding_candidates, core.onboarding_tasks, core.prejoin_invitations, core.source_mappings, pay.employee_salaries, recruit.candidates, recruit.offers, recruit.vacancies, wf.event_subscriptions, wf.notification_attempts, wf.notifications

**Current reviewed issues:**

- R14 (open; LC-01): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R18 (open; LC-01, LC-02): Onboarding conversion is not atomic and creates unusable salary/login. Remaining repair: Use the existing validated employee/e-code/salary/auth public APIs inside one owned transaction. Resolve mandatory master links and actual salary breakup, candidate consumption key, welcome credentials/grants and outbox tasks.
- R35 (open; LC-01): Prejoin single-use and at-rest token claims are inaccurate. Remaining repair: Store only a hashed expiring invitation token, lock/compare-and-swap atomic consumption, validate typed profile fields and store one consistent object representation; audit and mask statutory data.
- R36 (open; LC-02): Biometric verification stamps evidence without checking Kent. Remaining repair: Separate human-confirmed versus connector-confirmed evidence, retain actor/source receipt and wire approved scheduled reminder/escalation jobs; do not manufacture integration proof.

### SOW-026 — original spreadsheet row 26

**Workforce / 3.2Onboarding & Employee Engagement**

Platform auto CTC structuring based on predefined templates.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-01/02

**Historical implementation evidence:** Payroll UI shell and integer-paise utilities only.

**Remaining scope from full crosswalk:** Build salary structures/components, grade/location assignments, CTC breakdown and applicable benefits/incentives/perquisites. No payroll business router exists.

**Execution cards:** P01, L01, R01, D10

**Database connections:** core.documents, core.employee_assignments, core.employees, core.onboarding_candidates, core.onboarding_tasks, core.prejoin_invitations, core.probation_reviews, core.source_mappings, pay.employee_salaries, pay.salary_components, pay.salary_structure_versions, pay.salary_structures, recruit.candidates, recruit.offers, recruit.vacancies

**Current reviewed issues:**

- R04 (partial-repair-verified; PAY-02): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R18 (open; PAY-02): Onboarding conversion is not atomic and creates unusable salary/login. Remaining repair: Use the existing validated employee/e-code/salary/auth public APIs inside one owned transaction. Resolve mandatory master links and actual salary breakup, candidate consumption key, welcome credentials/grants and outbox tasks.
- R20 (open; PAY-02): Probation confirmation leaves a salary gap and zero components. Remaining repair: Close the prior interval at confirmation date, resolve actual approved salary amounts, make decision/salary/employee/letter effects atomic and idempotent, and connect non-confirmation separation.
- R39 (partial-repair-verified; PAY-02): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R40 (open; PAY-01, PAY-02): Salary preview and assignment ignore configured amount rules. Remaining repair: Define and validate the documented amount_rule grammar and CTC anchors; use one assembler for preview and assignment. Reject missing rules rather than fabricate pay. Add real persisted-structure preview/assignment tests with explicit approved amounts.
- R41 (open; PAY-01, PAY-02): Probation scales earnings after dependent contributions have already been computed. Remaining repair: Apply approved probation scaling before evaluating dependent deduction/employer formulas and balancing CTC. Add a hand-computed fixture that includes BASIC, PF_EE and employer PF, with approved rounding and policy inputs.

### SOW-027 — original spreadsheet row 27

**Workforce / 3.2Onboarding & Employee Engagement**

Management of flexi-basket benefits and reimbursements.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-13, LN-01/02, CLM-01..06, PAY-06

**Historical implementation evidence:** ESS pay/loan/claim shells only; generic workflows available.

**Remaining scope from full crosswalk:** Implement the row-specific ESS transaction: benefits/claims, investment declaration, loan application or payslip/tax generation. Backend modules are absent.

**Execution cards:** P06, T01, D10

**Database connections:** core.documents, pay.budget_categories, pay.budgets, pay.claim_bills, pay.claim_entitlements, pay.claim_lines, pay.claim_reservations, pay.claim_types, pay.claims, pay.payment_obligations, pay.source_consumptions, te.currency_rates, te.employee_travel_levels, te.itinerary_segments, te.policy_versions, te.travel_levels, te.trips

**Current reviewed issues:**

- R01 (verified-fixed; CLM-02): Fresh migration chain cannot build claims schema. Remaining repair: Recover original migration sources, reconcile canonical claims/budgets through forward alterations, then prove empty up, no-op up, down/up and upgrade. Rehearse exact target16.
- R05 (open; PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R12 (open; CLM-02, LN-02): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R13 (open; PAY-06): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.
- R14 (open; LN-01): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R23 (open; LN-01, LN-02): ESS loan application bypasses eligibility and approval. Remaining repair: Check authoritative effective eligibility under lock, require approved workflow/funding evidence and typed policy configuration; start as a request, not an active funded loan.
- R25 (open; CLM-02, CLM-04): General claims cannot insert into the actual budget-owned model. Remaining repair: Preserve shared claims ownership; explicitly choose validated entitlement funding, required provenance and existing canonical lines/bills. Bind an approved seeded component and reconcile prior budget reservations.
- R26 (open; CLM-04): Claim routing declares paid before funds or batch lines exist. Remaining repair: Create conserved settlement/obligation/consumption records, validate subject/payer and legal states, materialize frozen payroll/batch lines and mark paid only from payment receipt. Attach invariant CHECKs to the existing table.
- R27 (open; CLM-01, CLM-02): Entitlement policy is invented and the reservation check races. Remaining repair: Use signed effective entitlement rows, exact bucket membership and locked immutable reservation/consumption; reject unconfigured entitlement and test concurrency/period edges.
- R28 (open; CLM-05, PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R33 (open; PAY-06): Output readiness and artifact ownership are inferred incorrectly. Remaining repair: Persist versioned per-run/payer artifacts with checksum, complete population and actual generation receipts; expose availability from those records, not approval state.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.

### SOW-028 — original spreadsheet row 28

**Workforce / 3.2Onboarding & Employee Engagement**

Employee investment declarations for tax planning.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-13, LN-01/02, CLM-01..06, PAY-06

**Historical implementation evidence:** ESS pay/loan/claim shells only; generic workflows available.

**Remaining scope from full crosswalk:** Implement the row-specific ESS transaction: benefits/claims, investment declaration, loan application or payslip/tax generation. Backend modules are absent.

**Execution cards:** P03, D01

**Database connections:** pay.investment_declarations, pay.it_slabs, pay.output_artifacts, pay.previous_employer_income, pay.pt_slabs, pay.statutory_memberships, pay.statutory_postings, pay.statutory_rates, pay.tax_elections, pay.tds_challans

**Current reviewed issues:**

- R01 (verified-fixed; CLM-02): Fresh migration chain cannot build claims schema. Remaining repair: Recover original migration sources, reconcile canonical claims/budgets through forward alterations, then prove empty up, no-op up, down/up and upgrade. Rehearse exact target16.
- R05 (open; PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R12 (open; CLM-02, LN-02): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R13 (open; PAY-06): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.
- R14 (open; LN-01): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R23 (open; LN-01, LN-02): ESS loan application bypasses eligibility and approval. Remaining repair: Check authoritative effective eligibility under lock, require approved workflow/funding evidence and typed policy configuration; start as a request, not an active funded loan.
- R25 (open; CLM-02, CLM-04): General claims cannot insert into the actual budget-owned model. Remaining repair: Preserve shared claims ownership; explicitly choose validated entitlement funding, required provenance and existing canonical lines/bills. Bind an approved seeded component and reconcile prior budget reservations.
- R26 (open; CLM-04): Claim routing declares paid before funds or batch lines exist. Remaining repair: Create conserved settlement/obligation/consumption records, validate subject/payer and legal states, materialize frozen payroll/batch lines and mark paid only from payment receipt. Attach invariant CHECKs to the existing table.
- R27 (open; CLM-01, CLM-02): Entitlement policy is invented and the reservation check races. Remaining repair: Use signed effective entitlement rows, exact bucket membership and locked immutable reservation/consumption; reject unconfigured entitlement and test concurrency/period edges.
- R28 (open; CLM-05, PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R33 (open; PAY-06): Output readiness and artifact ownership are inferred incorrectly. Remaining repair: Persist versioned per-run/payer artifacts with checksum, complete population and actual generation receipts; expose availability from those records, not approval state.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.

### SOW-029 — original spreadsheet row 29

**Workforce / 3.2Onboarding & Employee Engagement**

Employee loan processing on ESS portal and approval workflow .

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-13, LN-01/02, CLM-01..06, PAY-06

**Historical implementation evidence:** ESS pay/loan/claim shells only; generic workflows available.

**Remaining scope from full crosswalk:** Implement the row-specific ESS transaction: benefits/claims, investment declaration, loan application or payslip/tax generation. Backend modules are absent.

**Execution cards:** P05, T02

**Database connections:** pay.claim_lines, pay.claim_reservations, pay.claims, pay.loan_installments, pay.loan_postings, pay.loans, pay.payment_events, pay.payment_obligations, pay.source_consumptions, te.advances, te.settlement_advances, te.settlements, te.wallet_postings

**Current reviewed issues:**

- R01 (verified-fixed; CLM-02): Fresh migration chain cannot build claims schema. Remaining repair: Recover original migration sources, reconcile canonical claims/budgets through forward alterations, then prove empty up, no-op up, down/up and upgrade. Rehearse exact target16.
- R05 (open; PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R12 (open; CLM-02, LN-02): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R13 (open; PAY-06): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.
- R14 (open; LN-01): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R23 (open; LN-01, LN-02): ESS loan application bypasses eligibility and approval. Remaining repair: Check authoritative effective eligibility under lock, require approved workflow/funding evidence and typed policy configuration; start as a request, not an active funded loan.
- R25 (open; CLM-02, CLM-04): General claims cannot insert into the actual budget-owned model. Remaining repair: Preserve shared claims ownership; explicitly choose validated entitlement funding, required provenance and existing canonical lines/bills. Bind an approved seeded component and reconcile prior budget reservations.
- R26 (open; CLM-04): Claim routing declares paid before funds or batch lines exist. Remaining repair: Create conserved settlement/obligation/consumption records, validate subject/payer and legal states, materialize frozen payroll/batch lines and mark paid only from payment receipt. Attach invariant CHECKs to the existing table.
- R27 (open; CLM-01, CLM-02): Entitlement policy is invented and the reservation check races. Remaining repair: Use signed effective entitlement rows, exact bucket membership and locked immutable reservation/consumption; reject unconfigured entitlement and test concurrency/period edges.
- R28 (open; CLM-05, PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R33 (open; PAY-06): Output readiness and artifact ownership are inferred incorrectly. Remaining repair: Persist versioned per-run/payer artifacts with checksum, complete population and actual generation receipts; expose availability from those records, not approval state.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.

### SOW-030 — original spreadsheet row 30

**Workforce / 3.2Onboarding & Employee Engagement**

Payslip and tax sheet generation for onboarding employees.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-13, LN-01/02, CLM-01..06, PAY-06

**Historical implementation evidence:** ESS pay/loan/claim shells only; generic workflows available.

**Remaining scope from full crosswalk:** Implement the row-specific ESS transaction: benefits/claims, investment declaration, loan application or payslip/tax generation. Backend modules are absent.

**Execution cards:** P01, P04, L01

**Database connections:** core.documents, core.employee_assignments, core.employees, core.onboarding_candidates, core.onboarding_tasks, core.prejoin_invitations, core.probation_reviews, core.source_mappings, pay.bank_batch_lines, pay.bank_batches, pay.employee_salaries, pay.gl_accounts, pay.journal_batches, pay.journal_lines, pay.output_artifacts, pay.payment_events, pay.payment_obligations, pay.salary_components, pay.salary_structure_versions, pay.salary_structures

**Current reviewed issues:**

- R01 (verified-fixed; CLM-02): Fresh migration chain cannot build claims schema. Remaining repair: Recover original migration sources, reconcile canonical claims/budgets through forward alterations, then prove empty up, no-op up, down/up and upgrade. Rehearse exact target16.
- R05 (open; PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R12 (open; CLM-02, LN-02): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R13 (open; PAY-06): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.
- R14 (open; LN-01): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R23 (open; LN-01, LN-02): ESS loan application bypasses eligibility and approval. Remaining repair: Check authoritative effective eligibility under lock, require approved workflow/funding evidence and typed policy configuration; start as a request, not an active funded loan.
- R25 (open; CLM-02, CLM-04): General claims cannot insert into the actual budget-owned model. Remaining repair: Preserve shared claims ownership; explicitly choose validated entitlement funding, required provenance and existing canonical lines/bills. Bind an approved seeded component and reconcile prior budget reservations.
- R26 (open; CLM-04): Claim routing declares paid before funds or batch lines exist. Remaining repair: Create conserved settlement/obligation/consumption records, validate subject/payer and legal states, materialize frozen payroll/batch lines and mark paid only from payment receipt. Attach invariant CHECKs to the existing table.
- R27 (open; CLM-01, CLM-02): Entitlement policy is invented and the reservation check races. Remaining repair: Use signed effective entitlement rows, exact bucket membership and locked immutable reservation/consumption; reject unconfigured entitlement and test concurrency/period edges.
- R28 (open; CLM-05, PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R33 (open; PAY-06): Output readiness and artifact ownership are inferred incorrectly. Remaining repair: Persist versioned per-run/payer artifacts with checksum, complete population and actual generation receipts; expose availability from those records, not approval state.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.

### SOW-031 — original spreadsheet row 31

**Workforce / 3.2Onboarding & Employee Engagement**

capturing previous employment details.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** CORE-01, LC-01

**Historical implementation evidence:** Current profile/import omits previous-employment capture.

**Remaining scope from full crosswalk:** Build previous-employment persistence, import/form/read contract and onboarding integration. Specified table is absent from the 07 Oct schema recon.

**Execution cards:** F02, L01

**Database connections:** core.companies, core.cost_centers, core.departments, core.designations, core.documents, core.employee_assignments, core.employee_education, core.employee_family, core.employee_history, core.employee_prev_employment, core.employees, core.grades, core.import_batches, core.locations, core.mis_codes, core.onboarding_candidates, core.onboarding_tasks, core.org_units, core.plants, core.prejoin_invitations, core.profile_change_requests, core.reporting_tree, core.source_mappings, pay.employee_salaries

**Current reviewed issues:**

- R14 (open; LC-01): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R18 (open; LC-01): Onboarding conversion is not atomic and creates unusable salary/login. Remaining repair: Use the existing validated employee/e-code/salary/auth public APIs inside one owned transaction. Resolve mandatory master links and actual salary breakup, candidate consumption key, welcome credentials/grants and outbox tasks.
- R35 (open; LC-01): Prejoin single-use and at-rest token claims are inaccurate. Remaining repair: Store only a hashed expiring invitation token, lock/compare-and-swap atomic consumption, validate typed profile fields and store one consistent object representation; audit and mask statutory data.

### SOW-033 — original spreadsheet row 33

**Workforce / 3.3Employee Confirmation Process**

Probation review tracking and automated reminders

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LC-04, PAY-02

**Historical implementation evidence:** Probation fields and generic confirmation chain definition exist.

**Remaining scope from full crosswalk:** Build probation reviews, due reminders, outcome hooks, salary switch and letters. A seeded chain alone does not complete the process.

**Execution cards:** F04, L02, D04, D11

**Database connections:** core.document_operations, core.documents, core.employee_history, core.letter_templates, core.letters, core.probation_reviews, pay.employee_salaries, wf.event_subscriptions, wf.notification_attempts, wf.notifications, wf.requests

**Current reviewed issues:**

- R04 (partial-repair-verified; PAY-02): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R14 (open; LC-04): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R18 (open; PAY-02): Onboarding conversion is not atomic and creates unusable salary/login. Remaining repair: Use the existing validated employee/e-code/salary/auth public APIs inside one owned transaction. Resolve mandatory master links and actual salary breakup, candidate consumption key, welcome credentials/grants and outbox tasks.
- R19 (open; LC-04): Lifecycle approval and notification claims lack workflow records. Remaining repair: Wire authoritative versioned workflow requests and domain hooks, transactional audit/outbox and actual notification attempts/receipts. Never manufacture sent/verified timestamps.
- R20 (open; LC-04, PAY-02): Probation confirmation leaves a salary gap and zero components. Remaining repair: Close the prior interval at confirmation date, resolve actual approved salary amounts, make decision/salary/employee/letter effects atomic and idempotent, and connect non-confirmation separation.
- R39 (partial-repair-verified; PAY-02): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R40 (open; PAY-02): Salary preview and assignment ignore configured amount rules. Remaining repair: Define and validate the documented amount_rule grammar and CTC anchors; use one assembler for preview and assignment. Reject missing rules rather than fabricate pay. Add real persisted-structure preview/assignment tests with explicit approved amounts.
- R41 (open; PAY-02): Probation scales earnings after dependent contributions have already been computed. Remaining repair: Apply approved probation scaling before evaluating dependent deduction/employer formulas and balancing CTC. Add a hand-computed fixture that includes BASIC, PF_EE and employer PF, with approved rounding and policy inputs.

### SOW-034 — original spreadsheet row 34

**Workforce / 3.3Employee Confirmation Process**

Updating multi-level approval workflows for employee confirmation

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LC-04, PAY-02

**Historical implementation evidence:** Probation fields and generic confirmation chain definition exist.

**Remaining scope from full crosswalk:** Build probation reviews, due reminders, outcome hooks, salary switch and letters. A seeded chain alone does not complete the process.

**Execution cards:** F04, L02, D04, D11

**Database connections:** core.document_operations, core.documents, core.employee_history, core.letter_templates, core.letters, core.probation_reviews, pay.employee_salaries, wf.event_subscriptions, wf.notification_attempts, wf.notifications, wf.requests

**Current reviewed issues:**

- R04 (partial-repair-verified; PAY-02): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R14 (open; LC-04): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R18 (open; PAY-02): Onboarding conversion is not atomic and creates unusable salary/login. Remaining repair: Use the existing validated employee/e-code/salary/auth public APIs inside one owned transaction. Resolve mandatory master links and actual salary breakup, candidate consumption key, welcome credentials/grants and outbox tasks.
- R19 (open; LC-04): Lifecycle approval and notification claims lack workflow records. Remaining repair: Wire authoritative versioned workflow requests and domain hooks, transactional audit/outbox and actual notification attempts/receipts. Never manufacture sent/verified timestamps.
- R20 (open; LC-04, PAY-02): Probation confirmation leaves a salary gap and zero components. Remaining repair: Close the prior interval at confirmation date, resolve actual approved salary amounts, make decision/salary/employee/letter effects atomic and idempotent, and connect non-confirmation separation.
- R39 (partial-repair-verified; PAY-02): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R40 (open; PAY-02): Salary preview and assignment ignore configured amount rules. Remaining repair: Define and validate the documented amount_rule grammar and CTC anchors; use one assembler for preview and assignment. Reject missing rules rather than fabricate pay. Add real persisted-structure preview/assignment tests with explicit approved amounts.
- R41 (open; PAY-02): Probation scales earnings after dependent contributions have already been computed. Remaining repair: Apply approved probation scaling before evaluating dependent deduction/employer formulas and balancing CTC. Add a hand-computed fixture that includes BASIC, PF_EE and employer PF, with approved rounding and policy inputs.

### SOW-036 — original spreadsheet row 36

**Workforce / 3.4Employee Transfers**

Platform automated workflow for internal department/location transfers.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LC-05, PAY-16

**Historical implementation evidence:** Employee history schema and generic transfer definition exist.

**Remaining scope from full crosswalk:** Build approved effective-dated transfer mutations, document updates, compensation/role changes and entity payroll continuity.

**Execution cards:** L03, D07, D11

**Database connections:** core.employee_assignments, core.employee_history, core.transfer_requests, pay.employee_salaries, wf.requests

**Current reviewed issues:**

- R04 (partial-repair-verified; PAY-16): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R08 (open; PAY-16): Arrears can be paid again on subsequent runs. Remaining repair: Reserve/consume each signed delta exactly once in the same financial transaction; preserve original/result versions and retry-safe keys.
- R10 (open; PAY-16): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R21 (open; LC-05): Transfer e-codes use employee count instead of allocator. Remaining repair: Allocate via the canonical locked company sequence within the approved transfer transaction; use an external-identity mapping and concurrent transfer tests.
- R22 (open; LC-05, PAY-16): Future transfers mutate today and promotions do not change salary. Remaining repair: Publish effective-dated placement/salary changes; activate projections on effective date with validated aligned links, historical scope snapshots and signed leave/entity payroll continuity.
- R31 (open; PAY-16): Apply-increment reports success without salary revisions. Remaining repair: Resolve approved employee salary facts server-side, atomically create real effective revisions and replay-safe recompute/delta obligations, and return actual persisted counts.

### SOW-037 — original spreadsheet row 37

**Workforce / 3.4Employee Transfers**

Platform-driven approvals and documentation updates.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LC-05, PAY-16

**Historical implementation evidence:** Employee history schema and generic transfer definition exist.

**Remaining scope from full crosswalk:** Build approved effective-dated transfer mutations, document updates, compensation/role changes and entity payroll continuity.

**Execution cards:** L03, D07, D11

**Database connections:** core.employee_assignments, core.employee_history, core.transfer_requests, pay.employee_salaries, wf.requests

**Current reviewed issues:**

- R04 (partial-repair-verified; PAY-16): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R08 (open; PAY-16): Arrears can be paid again on subsequent runs. Remaining repair: Reserve/consume each signed delta exactly once in the same financial transaction; preserve original/result versions and retry-safe keys.
- R10 (open; PAY-16): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R21 (open; LC-05): Transfer e-codes use employee count instead of allocator. Remaining repair: Allocate via the canonical locked company sequence within the approved transfer transaction; use an external-identity mapping and concurrent transfer tests.
- R22 (open; LC-05, PAY-16): Future transfers mutate today and promotions do not change salary. Remaining repair: Publish effective-dated placement/salary changes; activate projections on effective date with validated aligned links, historical scope snapshots and signed leave/entity payroll continuity.
- R31 (open; PAY-16): Apply-increment reports success without salary revisions. Remaining repair: Resolve approved employee salary facts server-side, atomically create real effective revisions and replay-safe recompute/delta obligations, and return actual persisted counts.

### SOW-038 — original spreadsheet row 38

**Workforce / 3.4Employee Transfers**

compensation and role change updates in HRMS.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LC-05, PAY-16

**Historical implementation evidence:** Employee history schema and generic transfer definition exist.

**Remaining scope from full crosswalk:** Build approved effective-dated transfer mutations, document updates, compensation/role changes and entity payroll continuity.

**Execution cards:** P01, L02, L03, D07, D10, D11

**Database connections:** core.employee_assignments, core.employee_history, core.letters, core.probation_reviews, core.transfer_requests, pay.employee_salaries, pay.salary_components, pay.salary_structure_versions, pay.salary_structures, wf.requests

**Current reviewed issues:**

- R04 (partial-repair-verified; PAY-16): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R08 (open; PAY-16): Arrears can be paid again on subsequent runs. Remaining repair: Reserve/consume each signed delta exactly once in the same financial transaction; preserve original/result versions and retry-safe keys.
- R10 (open; PAY-16): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R21 (open; LC-05): Transfer e-codes use employee count instead of allocator. Remaining repair: Allocate via the canonical locked company sequence within the approved transfer transaction; use an external-identity mapping and concurrent transfer tests.
- R22 (open; LC-05, PAY-16): Future transfers mutate today and promotions do not change salary. Remaining repair: Publish effective-dated placement/salary changes; activate projections on effective date with validated aligned links, historical scope snapshots and signed leave/entity payroll continuity.
- R31 (open; PAY-16): Apply-increment reports success without salary revisions. Remaining repair: Resolve approved employee salary facts server-side, atomically create real effective revisions and replay-safe recompute/delta obligations, and return actual persisted counts.

### SOW-040 — original spreadsheet row 40

**Workforce / 3.5Employee Separation & Exit Management**

• Resignation initiation, tracking, and approval workflows.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LC-06/07, PAY-15

**Historical implementation evidence:** Generic resignation definition and asset holdings lookup exist.

**Remaining scope from full crosswalk:** Build ESS resignation, notices, departmental clearances, settlement compute/payment and exit cascade. No full separation API exists.

**Execution cards:** L04, D11

**Database connections:** ast.assignments, ast.custody_events, core.clearances, core.separations, pay.claims, pay.loan_postings, pay.loans, te.advances, te.wallet_postings

**Current reviewed issues:**

- R14 (open; LC-06): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R15 (open; LC-06): New financial/lifecycle endpoints do not enforce ownership scope. Remaining repair: Require one declared business permission and server-derived self/subtree/entity/category scope on reads and writes; deny foreign subject IDs and test all restricted roles.
- R16 (open; LC-06, PAY-15): F&F substitutes fixture salary, leave and payable days. Remaining repair: Require authoritative as-of salary, attendance, leave ledger, paid holds, debt and final tax inputs. Fail missing facts explicitly; retain frozen calculation provenance and reviewed overrides.
- R17 (open; LC-06, LC-07, PAY-15): F&F can mark paid and issue letters without approval/payment. Remaining repair: Implement approved immutable settlement->payment obligation->verified receipt transitions, with maker/checker, idempotency, audit/outbox and atomic exit/letter release. Do not label queued payouts paid.
- R19 (open; LC-06): Lifecycle approval and notification claims lack workflow records. Remaining repair: Wire authoritative versioned workflow requests and domain hooks, transactional audit/outbox and actual notification attempts/receipts. Never manufacture sent/verified timestamps.
- R39 (partial-repair-verified; PAY-15): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.

### SOW-041 — original spreadsheet row 41

**Workforce / 3.5Employee Separation & Exit Management**

• Digital clearance process across departments (IT, Admin, Finance)

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LC-06/07, PAY-15

**Historical implementation evidence:** Generic resignation definition and asset holdings lookup exist.

**Remaining scope from full crosswalk:** Build ESS resignation, notices, departmental clearances, settlement compute/payment and exit cascade. No full separation API exists.

**Execution cards:** L04, D11

**Database connections:** ast.assignments, ast.custody_events, core.clearances, core.separations, pay.claims, pay.loan_postings, pay.loans, te.advances, te.wallet_postings

**Current reviewed issues:**

- R14 (open; LC-06): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R15 (open; LC-06): New financial/lifecycle endpoints do not enforce ownership scope. Remaining repair: Require one declared business permission and server-derived self/subtree/entity/category scope on reads and writes; deny foreign subject IDs and test all restricted roles.
- R16 (open; LC-06, PAY-15): F&F substitutes fixture salary, leave and payable days. Remaining repair: Require authoritative as-of salary, attendance, leave ledger, paid holds, debt and final tax inputs. Fail missing facts explicitly; retain frozen calculation provenance and reviewed overrides.
- R17 (open; LC-06, LC-07, PAY-15): F&F can mark paid and issue letters without approval/payment. Remaining repair: Implement approved immutable settlement->payment obligation->verified receipt transitions, with maker/checker, idempotency, audit/outbox and atomic exit/letter release. Do not label queued payouts paid.
- R19 (open; LC-06): Lifecycle approval and notification claims lack workflow records. Remaining repair: Wire authoritative versioned workflow requests and domain hooks, transactional audit/outbox and actual notification attempts/receipts. Never manufacture sent/verified timestamps.
- R39 (partial-repair-verified; PAY-15): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.

### SOW-042 — original spreadsheet row 42

**Workforce / 3.5Employee Separation & Exit Management**

• Final settlement and compliance with statutory requirements.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LC-06/07, PAY-15

**Historical implementation evidence:** Generic resignation definition and asset holdings lookup exist.

**Remaining scope from full crosswalk:** Build ESS resignation, notices, departmental clearances, settlement compute/payment and exit cascade. No full separation API exists.

**Execution cards:** L04, L05, D01, D11

**Database connections:** ast.assignments, ast.custody_events, core.clearances, core.letters, core.separations, lv.ledger, pay.claims, pay.fnf_settlements, pay.loan_postings, pay.loans, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, te.advances, te.wallet_postings

**Current reviewed issues:**

- R14 (open; LC-06): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R15 (open; LC-06): New financial/lifecycle endpoints do not enforce ownership scope. Remaining repair: Require one declared business permission and server-derived self/subtree/entity/category scope on reads and writes; deny foreign subject IDs and test all restricted roles.
- R16 (open; LC-06, PAY-15): F&F substitutes fixture salary, leave and payable days. Remaining repair: Require authoritative as-of salary, attendance, leave ledger, paid holds, debt and final tax inputs. Fail missing facts explicitly; retain frozen calculation provenance and reviewed overrides.
- R17 (open; LC-06, LC-07, PAY-15): F&F can mark paid and issue letters without approval/payment. Remaining repair: Implement approved immutable settlement->payment obligation->verified receipt transitions, with maker/checker, idempotency, audit/outbox and atomic exit/letter release. Do not label queued payouts paid.
- R19 (open; LC-06): Lifecycle approval and notification claims lack workflow records. Remaining repair: Wire authoritative versioned workflow requests and domain hooks, transactional audit/outbox and actual notification attempts/receipts. Never manufacture sent/verified timestamps.
- R39 (partial-repair-verified; PAY-15): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.

### SOW-044 — original spreadsheet row 44

**Workforce / 3.6Employee Letters Management**

• Generation of various employee-related letters, including:
 o Experience letters
 o Relieving letters
 o Salary certificates

**Current:** Blocked by reviewed defects. **Historical baseline:** Partial.

**Requirement references:** CORE-09, LC-06, PAY-15

**Historical implementation evidence:** Experience, relieving and salary-certificate templates plus issuance/archive exist.

**Remaining scope from full crosswalk:** Tie exit letters to paid F&F/clearance. Salary amount is a caller-supplied merge field, not derived from a live salary engine. Accept production templates.

**Execution cards:** F04, P04, L05, W03

**Database connections:** core.clearances, core.document_operations, core.documents, core.letter_templates, core.letters, core.policies, core.policy_acknowledgments, core.policy_versions, core.separations, eng.announcements, eng.poll_responses, eng.polls, eng.survey_responses, eng.surveys, lv.ledger, pay.bank_batch_lines, pay.bank_batches, pay.fnf_settlements, pay.gl_accounts, pay.journal_batches, pay.journal_lines, pay.output_artifacts, pay.payment_events, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, wf.event_subscriptions, wf.notification_attempts, wf.notifications

**Current reviewed issues:**

- R14 (open; LC-06): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R15 (open; LC-06): New financial/lifecycle endpoints do not enforce ownership scope. Remaining repair: Require one declared business permission and server-derived self/subtree/entity/category scope on reads and writes; deny foreign subject IDs and test all restricted roles.
- R16 (open; LC-06, PAY-15): F&F substitutes fixture salary, leave and payable days. Remaining repair: Require authoritative as-of salary, attendance, leave ledger, paid holds, debt and final tax inputs. Fail missing facts explicitly; retain frozen calculation provenance and reviewed overrides.
- R17 (open; LC-06, PAY-15): F&F can mark paid and issue letters without approval/payment. Remaining repair: Implement approved immutable settlement->payment obligation->verified receipt transitions, with maker/checker, idempotency, audit/outbox and atomic exit/letter release. Do not label queued payouts paid.
- R19 (open; LC-06): Lifecycle approval and notification claims lack workflow records. Remaining repair: Wire authoritative versioned workflow requests and domain hooks, transactional audit/outbox and actual notification attempts/receipts. Never manufacture sent/verified timestamps.
- R39 (partial-repair-verified; PAY-15): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.

### SOW-047 — original spreadsheet row 47

**Leave & attendance / Shift Management**

Defining and configuring multiple shift types (fixed, rotational, flexible, night shifts, etc.).

**Current:** Requires current end-to-end verification. **Historical baseline:** Partial.

**Requirement references:** ATT-04/05

**Historical implementation evidence:** Shift CRUD covers clock times, night crossing, sessions, grace and thresholds.

**Remaining scope from full crosswalk:** Prove flexible/rotational shift behaviors and exact production thresholds/schemes; effective-date overlap protection remains an audit finding.

**Execution cards:** A02, D05, D07

**Database connections:** att.coverage_targets, att.day_records, att.employee_shifts, att.holidays, att.recompute_queue, att.roster_publications, att.roster_revisions, att.rosters, att.shift_patterns, att.shift_swaps, att.shifts, core.employee_assignments

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-048 — original spreadsheet row 48

**Leave & attendance / Shift Management**

Platform automated shift scheduling and roster management.

**Current:** Requires current end-to-end verification. **Historical baseline:** Partial.

**Requirement references:** ATT-04

**Historical implementation evidence:** Manager roster read/bulk update, employee shift scheme and reminder schedule exist.

**Remaining scope from full crosswalk:** Automated roster generation/rotation is not evidenced; confirm whether manual manager roster plus reminders meets this SOW wording. Complete UAT.

**Execution cards:** A02, D05, D07

**Database connections:** att.coverage_targets, att.day_records, att.employee_shifts, att.holidays, att.recompute_queue, att.roster_publications, att.roster_revisions, att.rosters, att.shift_patterns, att.shift_swaps, att.shifts, core.employee_assignments

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-049 — original spreadsheet row 49

**Leave & attendance / Shift Management**

Integration with biometric systems.

**Current:** Blocked by reviewed defects. **Historical baseline:** Partial.

**Requirement references:** ATT-01/02

**Historical implementation evidence:** Swappable Kent interface, mock ingestion, immutable swipe pipeline and device-health UI exist.

**Remaining scope from full crosswalk:** Confirm access protocol; replace MockKentConnector, ingest/reconcile real door swipes, prove lag/backfill/watermarks in production.

**Execution cards:** F04, A01, D07

**Database connections:** att.device_watermarks, att.devices, att.ingest_watermarks, att.quarantined_swipes, att.source_receipts, att.swipe_events, core.document_operations, core.documents, core.letter_templates, core.letters, wf.event_subscriptions, wf.notification_attempts, wf.notifications

**Current reviewed issues:**

- R36 (open; ATT-01): Biometric verification stamps evidence without checking Kent. Remaining repair: Separate human-confirmed versus connector-confirmed evidence, retain actor/source receipt and wire approved scheduled reminder/escalation jobs; do not manufacture integration proof.

### SOW-051 — original spreadsheet row 51

**Leave & attendance / Attendance Tracking**

management of real-time biometric attendance integration in system.

**Current:** Blocked by reviewed defects. **Historical baseline:** Partial.

**Requirement references:** ATT-01/02

**Historical implementation evidence:** Swappable Kent interface, mock ingestion, immutable swipe pipeline and device-health UI exist.

**Remaining scope from full crosswalk:** Confirm access protocol; replace MockKentConnector, ingest/reconcile real door swipes, prove lag/backfill/watermarks in production.

**Execution cards:** F04, A01, D07

**Database connections:** att.device_watermarks, att.devices, att.ingest_watermarks, att.quarantined_swipes, att.source_receipts, att.swipe_events, core.document_operations, core.documents, core.letter_templates, core.letters, wf.event_subscriptions, wf.notification_attempts, wf.notifications

**Current reviewed issues:**

- R36 (open; ATT-01): Biometric verification stamps evidence without checking Kent. Remaining repair: Separate human-confirmed versus connector-confirmed evidence, retain actor/source receipt and wire approved scheduled reminder/escalation jobs; do not manufacture integration proof.

### SOW-052 — original spreadsheet row 52

**Leave & attendance / Attendance Tracking**

integration with access control systems for seamless tracking.

**Current:** Blocked by reviewed defects. **Historical baseline:** Partial.

**Requirement references:** ATT-01/02

**Historical implementation evidence:** Swappable Kent interface, mock ingestion, immutable swipe pipeline and device-health UI exist.

**Remaining scope from full crosswalk:** Confirm access protocol; replace MockKentConnector, ingest/reconcile real door swipes, prove lag/backfill/watermarks in production.

**Execution cards:** F04, A01, D07

**Database connections:** att.device_watermarks, att.devices, att.ingest_watermarks, att.quarantined_swipes, att.source_receipts, att.swipe_events, core.document_operations, core.documents, core.letter_templates, core.letters, wf.event_subscriptions, wf.notification_attempts, wf.notifications

**Current reviewed issues:**

- R36 (open; ATT-01): Biometric verification stamps evidence without checking Kent. Remaining repair: Separate human-confirmed versus connector-confirmed evidence, retain actor/source receipt and wire approved scheduled reminder/escalation jobs; do not manufacture integration proof.

### SOW-053 — original spreadsheet row 53

**Leave & attendance / Attendance Tracking**

Platform automated late coming and early leaving reports.

**Current:** Blocked by reviewed defects. **Historical baseline:** Implemented.

**Requirement references:** ATT-05, RPT-06

**Historical implementation evidence:** Late/early calculations, R4 exception table and same-filter Excel export exist.

**Remaining scope from full crosswalk:** Accept production grace/scheme settings and reconcile with real Kent data in G1 UAT.

**Execution cards:** A02, W04, D05

**Database connections:** att.coverage_targets, att.day_records, att.employee_shifts, att.holidays, att.recompute_queue, att.roster_publications, att.roster_revisions, att.rosters, att.shift_patterns, att.shift_swaps, att.shifts, core.employee_assignments, pay.payroll_item_lines, pay.payroll_items, pay.source_consumptions, reporting.kpi_daily, reporting.muster_month, reporting.snapshot_builds

**Current reviewed issues:**

- R34 (open; RPT-06): SAP mapping loses legal payer and cost-center dimensions. Remaining repair: Use the approved scoped GL mapping keys from the canonical table, fail missing/ambiguous mappings and reconcile exact balanced amounts from frozen placement/result versions.
- R44 (partial-repair-verified; RPT-06): Parallel comparison drops repeated lines of the same component. Remaining repair: Sum all signed component facts in integer paise per employee/component. Corrected shared component aggregation is now used by the real comparison; durable complete-population two-cycle/sign-off gates remain open under R29.
- R45 (partial-repair-verified; RPT-06): Numeric SOW citations in phase plans and backend comments do not identify the original requirements. Remaining repair: Regenerate phase tables from the exact original crosswalk, preserve requirement IDs, and replace unverified numeric references in backend comments. Done for backend comments and Phase2/3 maps; source-doc section labels and remaining frontend annotations require separate context validation.

### SOW-054 — original spreadsheet row 54

**Leave & attendance / Attendance Tracking**

Platform alerts for absenteeism, regularization requests, and policy violations

**Current:** Requires current end-to-end verification. **Historical baseline:** Partial.

**Requirement references:** ATT-10/11, WF-02

**Historical implementation evidence:** Absence scanning, regularization workflow, notification queue and scheduler hooks exist.

**Remaining scope from full crosswalk:** Wire delivery consumer/SMTP; prove real employee/manager alerts and resolve production sync gaps.

**Execution cards:** F04, A05, W03, D04

**Database connections:** att.absence_cases, att.day_records, att.manager_month_approvals, att.month_locks, core.document_operations, core.documents, core.letter_templates, core.letters, core.policies, core.policy_acknowledgments, core.policy_versions, eng.announcements, eng.poll_responses, eng.polls, eng.survey_responses, eng.surveys, reporting.muster_month, reporting.snapshot_builds, wf.event_subscriptions, wf.notification_attempts, wf.notifications

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-056 — original spreadsheet row 56

**Leave & attendance / Leave Management**

Configuration of leave types (annual, sick, maternity, casual, etc.).

**Current:** Requires current end-to-end verification. **Historical baseline:** Partial.

**Requirement references:** LV-01

**Historical implementation evidence:** Leave catalog seed and audited create/update API exist.

**Remaining scope from full crosswalk:** Finish HR leave-type configuration UI; current LeaveAdmin page only runs accrual/expiry and shows register pending. Accept policies.

**Execution cards:** A04

**Database connections:** lv.applications, lv.credit_allocations, lv.leave_types, lv.ledger, lv.operation_keys, lv.restricted_holidays, lv.rh_selections, pay.payment_obligations

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-057 — original spreadsheet row 57

**Leave & attendance / Leave Management**

holiday calendar configuration by location and department.

**Current:** Requires current end-to-end verification. **Historical baseline:** Partial.

**Requirement references:** ATT-13

**Historical implementation evidence:** Location/global holidays CRUD and ESS calendar exist.

**Remaining scope from full crosswalk:** Department-specific holiday configuration in the SOW is not represented by the inspected location-only contract. Resolve scope with HR.

**Execution cards:** A02, D07, D08

**Database connections:** att.coverage_targets, att.day_records, att.employee_shifts, att.holidays, att.recompute_queue, att.roster_publications, att.roster_revisions, att.rosters, att.shift_patterns, att.shift_swaps, att.shifts, core.employee_assignments

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-058 — original spreadsheet row 58

**Leave & attendance / Leave Management**

• leave request and approval workflows with multi-level authorizations.

**Current:** Blocked by reviewed defects. **Historical baseline:** Implemented.

**Requirement references:** LV-03/08, WF-01

**Historical implementation evidence:** Leave apply/cancel, balance checks, multi-step approvals and ledger/attendance hooks exist.

**Remaining scope from full crosswalk:** G1 HR/manager UAT and production notification delivery remain.

**Execution cards:** A03, A04

**Database connections:** att.overtime_entries, att.regularizations, lv.applications, lv.credit_allocations, lv.leave_types, lv.ledger, lv.operation_keys, lv.restricted_holidays, lv.rh_selections, pay.payment_obligations, wf.definition_versions, wf.definitions, wf.delegations, wf.notifications, wf.request_revisions, wf.request_steps, wf.requests

**Current reviewed issues:**

- R19 (open; WF-01): Lifecycle approval and notification claims lack workflow records. Remaining repair: Wire authoritative versioned workflow requests and domain hooks, transactional audit/outbox and actual notification attempts/receipts. Never manufacture sent/verified timestamps.

### SOW-059 — original spreadsheet row 59

**Leave & attendance / Leave Management**

Platform automated leave balance tracking and accruals.

**Current:** Requires current end-to-end verification. **Historical baseline:** Implemented.

**Requirement references:** LV-02/05

**Historical implementation evidence:** Immutable ledger balance and idempotent monthly accrual plus scheduler exist.

**Remaining scope from full crosswalk:** Prove recurring production execution with real opening balances; policy settings and G1 acceptance remain.

**Execution cards:** A04, D02, D11

**Database connections:** lv.applications, lv.credit_allocations, lv.leave_types, lv.ledger, lv.operation_keys, lv.restricted_holidays, lv.rh_selections, pay.payment_obligations

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-060 — original spreadsheet row 60

**Leave & attendance / Leave Management**

Leave encashment and carry-forward policies

**Current:** Blocked by reviewed defects. **Historical baseline:** Partial.

**Requirement references:** LV-06, PAY-15

**Historical implementation evidence:** Encashment workflow/debit and carry-forward function exist.

**Remaining scope from full crosswalk:** Build encashment money payout/F&F integration. Wire year-end carry-forward recurring execution; worker does not import that function.

**Execution cards:** A04, L05, D06, D11

**Database connections:** core.clearances, core.letters, core.separations, lv.applications, lv.credit_allocations, lv.leave_types, lv.ledger, lv.operation_keys, lv.restricted_holidays, lv.rh_selections, pay.fnf_settlements, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs

**Current reviewed issues:**

- R16 (open; LV-06, PAY-15): F&F substitutes fixture salary, leave and payable days. Remaining repair: Require authoritative as-of salary, attendance, leave ledger, paid holds, debt and final tax inputs. Fail missing facts explicitly; retain frozen calculation provenance and reviewed overrides.
- R17 (open; PAY-15): F&F can mark paid and issue letters without approval/payment. Remaining repair: Implement approved immutable settlement->payment obligation->verified receipt transitions, with maker/checker, idempotency, audit/outbox and atomic exit/letter release. Do not label queued payouts paid.
- R39 (partial-repair-verified; PAY-15): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.

### SOW-062 — original spreadsheet row 62

**Leave & attendance / Overtime & Comp-Offs Management**

• overtime tracking based on pre-approved policies.

**Current:** Blocked by reviewed defects. **Historical baseline:** Partial.

**Requirement references:** ATT-08

**Historical implementation evidence:** Detected OT, policy thresholds, manager decision and lapse functions exist.

**Remaining scope from full crosswalk:** Connect real swipes and real manager digest delivery; approve policy/rates and close G1.

**Execution cards:** A03, D04, D06

**Database connections:** att.overtime_entries, att.regularizations, wf.definition_versions, wf.definitions, wf.delegations, wf.notifications, wf.request_revisions, wf.request_steps, wf.requests

**Current reviewed issues:**

- R07 (partial-safety-repair; ATT-08): Detected OT is paid without approval and uses an absent component. Remaining repair: Consume only approved unconsumed OT against locked inputs; prohibit CO double consumption and bind the approved canonical component/policy base.

### SOW-063 — original spreadsheet row 63

**Leave & attendance / Overtime & Comp-Offs Management**

Platform auto-calculation of compensatory offs and extra working hours.

**Current:** Blocked by reviewed defects. **Historical baseline:** Implemented.

**Requirement references:** LV-04, ATT-08

**Historical implementation evidence:** OT minutes convert to half/full comp-off credits with expiry and no pay-plus-credit duplication.

**Remaining scope from full crosswalk:** Real-feed policy acceptance and G1 UAT remain.

**Execution cards:** A02, A03, A04, D05, D06

**Database connections:** att.coverage_targets, att.day_records, att.employee_shifts, att.holidays, att.overtime_entries, att.recompute_queue, att.regularizations, att.roster_publications, att.roster_revisions, att.rosters, att.shift_patterns, att.shift_swaps, att.shifts, core.employee_assignments, lv.applications, lv.credit_allocations, lv.leave_types, lv.ledger, lv.operation_keys, lv.restricted_holidays, lv.rh_selections, pay.payment_obligations, wf.definition_versions, wf.definitions, wf.delegations, wf.notifications, wf.request_revisions, wf.request_steps, wf.requests

**Current reviewed issues:**

- R07 (partial-safety-repair; ATT-08, LV-04): Detected OT is paid without approval and uses an absent component. Remaining repair: Consume only approved unconsumed OT against locked inputs; prohibit CO double consumption and bind the approved canonical component/policy base.

### SOW-064 — original spreadsheet row 64

**Leave & attendance / Overtime & Comp-Offs Management**

approval workflows for overtime requests.

**Current:** Blocked by reviewed defects. **Historical baseline:** Implemented.

**Requirement references:** ATT-08, WF-01

**Historical implementation evidence:** OT approval/rejection/partial-minute decisions, manager UI and deadline lapse exist.

**Remaining scope from full crosswalk:** Prove actual manager notification delivery and production decision timing.

**Execution cards:** A03, D04, D06

**Database connections:** att.overtime_entries, att.regularizations, wf.definition_versions, wf.definitions, wf.delegations, wf.notifications, wf.request_revisions, wf.request_steps, wf.requests

**Current reviewed issues:**

- R07 (partial-safety-repair; ATT-08): Detected OT is paid without approval and uses an absent component. Remaining repair: Consume only approved unconsumed OT against locked inputs; prohibit CO double consumption and bind the approved canonical component/policy base.
- R19 (open; WF-01): Lifecycle approval and notification claims lack workflow records. Remaining repair: Wire authoritative versioned workflow requests and domain hooks, transactional audit/outbox and actual notification attempts/receipts. Never manufacture sent/verified timestamps.

### SOW-065 — original spreadsheet row 65

**Leave & attendance / Overtime & Comp-Offs Management**

integration with payroll for overtime

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** ATT-08, PAY-03/05

**Historical implementation evidence:** Approved OT exists on attendance side.

**Remaining scope from full crosswalk:** Build OT wage calculation, payroll linkage, payout and overtime payslip. R5 payment linkage explicitly deferred.

**Execution cards:** A03, P02, D06

**Database connections:** att.month_locks, att.overtime_entries, att.regularizations, pay.arrears, pay.inputs, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions, wf.definition_versions, wf.definitions, wf.delegations, wf.notifications, wf.request_revisions, wf.request_steps, wf.requests

**Current reviewed issues:**

- R07 (partial-safety-repair; ATT-08): Detected OT is paid without approval and uses an absent component. Remaining repair: Consume only approved unconsumed OT against locked inputs; prohibit CO double consumption and bind the approved canonical component/policy base.
- R09 (partial-repair-verified; PAY-03): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-03): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R11 (partial-repair-verified; PAY-03): Maker/checker validation fails open on missing evidence. Remaining repair: Persist authoritative maker/checker records with separate DB-backed authorities, reject missing evidence, and atomically enforce legal transitions/audit/reconciliation.
- R12 (open; PAY-03): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R13 (open; PAY-03, PAY-05): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.
- R33 (open; PAY-05): Output readiness and artifact ownership are inferred incorrectly. Remaining repair: Persist versioned per-run/payer artifacts with checksum, complete population and actual generation receipts; expose availability from those records, not approval state.
- R34 (open; PAY-05): SAP mapping loses legal payer and cost-center dimensions. Remaining repair: Use the approved scoped GL mapping keys from the canonical table, fail missing/ambiguous mappings and reconcile exact balanced amounts from frozen placement/result versions.
- R45 (partial-repair-verified; PAY-05): Numeric SOW citations in phase plans and backend comments do not identify the original requirements. Remaining repair: Regenerate phase tables from the exact original crosswalk, preserve requirement IDs, and replace unverified numeric references in backend comments. Done for backend comments and Phase2/3 maps; source-doc section labels and remaining frontend annotations require separate context validation.

### SOW-067 — original spreadsheet row 67

**Leave & attendance / Attendance Policy & Compliance**

enforcement of attendance policies (minimum working hours, grace period, break time tracking).

**Current:** Requires current end-to-end verification. **Historical baseline:** Partial.

**Requirement references:** ATT-05/18

**Historical implementation evidence:** Configured working-hour/grace/break deduction and session/day computation exist.

**Remaining scope from full crosswalk:** Confirm production session thresholds and break interpretation; reconcile real feed and watermark behavior. No per-break punch accounting is evidenced.

**Execution cards:** A02, D05

**Database connections:** att.coverage_targets, att.day_records, att.employee_shifts, att.holidays, att.recompute_queue, att.roster_publications, att.roster_revisions, att.rosters, att.shift_patterns, att.shift_swaps, att.shifts, core.employee_assignments

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-068 — original spreadsheet row 68

**Leave & attendance / Attendance Policy & Compliance**

Platform automated deductions and penalties for attendance violations.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** ATT-05/09, PAY-03/04

**Historical implementation evidence:** Late/early minutes, absence and week-off eligibility are computed.

**Remaining scope from full crosswalk:** Define signed penalty-to-pay policy and implement payroll deductions; metrics alone do not deduct salary.

**Execution cards:** A02, P02, D05, D10

**Database connections:** att.coverage_targets, att.day_records, att.employee_shifts, att.holidays, att.month_locks, att.overtime_entries, att.recompute_queue, att.roster_publications, att.roster_revisions, att.rosters, att.shift_patterns, att.shift_swaps, att.shifts, core.employee_assignments, pay.arrears, pay.inputs, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions

**Current reviewed issues:**

- R03 (partial-repair-verified; ATT-09, PAY-04): Payroll attendance SQL is incompatible and day arithmetic is unsafe. Remaining repair: Use work_date plus paid leave/weekoff predicates, SUM weighted days, require complete locked inputs and retain true zero payable days. Integration-test P/HD/LWP/paid-WO/all-absent cases.
- R04 (partial-repair-verified; PAY-04): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R06 (partial-repair-verified; PAY-04): Recovery inputs print but do not reduce net pay. Remaining repair: Classify input and arrear effects by component kind, validate allowed amounts and update earning/deduction/employer bases consistently. Add an independent full-run recovery fixture.
- R07 (partial-safety-repair; PAY-04): Detected OT is paid without approval and uses an absent component. Remaining repair: Consume only approved unconsumed OT against locked inputs; prohibit CO double consumption and bind the approved canonical component/policy base.
- R09 (partial-repair-verified; PAY-03, PAY-04): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-03): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R11 (partial-repair-verified; PAY-03): Maker/checker validation fails open on missing evidence. Remaining repair: Persist authoritative maker/checker records with separate DB-backed authorities, reject missing evidence, and atomically enforce legal transitions/audit/reconciliation.
- R12 (open; PAY-03): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R13 (open; PAY-03): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.
- R29 (open; PAY-04): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R39 (partial-repair-verified; PAY-04): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R42 (open; PAY-04): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.
- R44 (partial-repair-verified; PAY-04): Parallel comparison drops repeated lines of the same component. Remaining repair: Sum all signed component facts in integer paise per employee/component. Corrected shared component aggregation is now used by the real comparison; durable complete-population two-cycle/sign-off gates remain open under R29.

### SOW-069 — original spreadsheet row 69

**Leave & attendance / Attendance Policy & Compliance**

Preparation of reports and dashboards for HR and management monitoring.

**Current:** Blocked by reviewed defects. **Historical baseline:** Partial.

**Requirement references:** RPT-01/04/06, LV-07

**Historical implementation evidence:** Muster, attendance reports, HR/BU views and employee leave balances exist.

**Remaining scope from full crosswalk:** Finish permission-scoped company leave register/dashboard; complete cost KPIs and accepted production data. RML source score is blank.

**Execution cards:** A05, W04, D05

**Database connections:** att.absence_cases, att.day_records, att.manager_month_approvals, att.month_locks, core.employee_assignments, core.letters, pay.payroll_item_lines, pay.payroll_items, pay.source_consumptions, reporting.kpi_daily, reporting.muster_month, reporting.snapshot_builds

**Current reviewed issues:**

- R32 (open; RPT-04): Executive financial KPIs silently substitute estimates. Remaining repair: Use approved versioned scoped snapshots from actual finalized financial/approved OT facts; preserve missing versus0, label any approved estimates and implement the signed KPI formulas/settings.
- R34 (open; RPT-06): SAP mapping loses legal payer and cost-center dimensions. Remaining repair: Use the approved scoped GL mapping keys from the canonical table, fail missing/ambiguous mappings and reconcile exact balanced amounts from frozen placement/result versions.
- R44 (partial-repair-verified; RPT-06): Parallel comparison drops repeated lines of the same component. Remaining repair: Sum all signed component facts in integer paise per employee/component. Corrected shared component aggregation is now used by the real comparison; durable complete-population two-cycle/sign-off gates remain open under R29.
- R45 (partial-repair-verified; RPT-06): Numeric SOW citations in phase plans and backend comments do not identify the original requirements. Remaining repair: Regenerate phase tables from the exact original crosswalk, preserve requirement IDs, and replace unverified numeric references in backend comments. Done for backend comments and Phase2/3 maps; source-doc section labels and remaining frontend annotations require separate context validation.

### SOW-072 — original spreadsheet row 72

**Payroll & compliance / 5.1 Payroll Processing**

Payroll Inputs Collection & Validation: Protiviti manages payroll inputs (new joiners, salary revisions, variable pay, deductions, loss of pay, etc.) in a predefined format.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-03/04/05/06/09..13

**Historical implementation evidence:** Attendance/reporting/workflow spine and payroll UI shell exist.

**Remaining scope from full crosswalk:** Build row-specific payroll inputs, declaration tax calculation, compute/review/finalize, output files/registers or OT pay. No end-to-end payroll engine is registered.

**Execution cards:** A05, P02, D11

**Database connections:** att.absence_cases, att.day_records, att.manager_month_approvals, att.month_locks, att.overtime_entries, core.letters, pay.arrears, pay.inputs, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions, reporting.muster_month, reporting.snapshot_builds

**Current reviewed issues:**

- R03 (partial-repair-verified; PAY-04): Payroll attendance SQL is incompatible and day arithmetic is unsafe. Remaining repair: Use work_date plus paid leave/weekoff predicates, SUM weighted days, require complete locked inputs and retain true zero payable days. Integration-test P/HD/LWP/paid-WO/all-absent cases.
- R04 (partial-repair-verified; PAY-04): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R05 (open; PAY-09, PAY-10, PAY-12, PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R06 (partial-repair-verified; PAY-04): Recovery inputs print but do not reduce net pay. Remaining repair: Classify input and arrear effects by component kind, validate allowed amounts and update earning/deduction/employer bases consistently. Add an independent full-run recovery fixture.
- R07 (partial-safety-repair; PAY-04): Detected OT is paid without approval and uses an absent component. Remaining repair: Consume only approved unconsumed OT against locked inputs; prohibit CO double consumption and bind the approved canonical component/policy base.
- R09 (partial-repair-verified; PAY-03, PAY-04): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-03): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R11 (partial-repair-verified; PAY-03): Maker/checker validation fails open on missing evidence. Remaining repair: Persist authoritative maker/checker records with separate DB-backed authorities, reject missing evidence, and atomically enforce legal transitions/audit/reconciliation.
- R12 (open; PAY-03): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R13 (open; PAY-03, PAY-05, PAY-06): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-04, PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R33 (open; PAY-05, PAY-06): Output readiness and artifact ownership are inferred incorrectly. Remaining repair: Persist versioned per-run/payer artifacts with checksum, complete population and actual generation receipts; expose availability from those records, not approval state.
- R34 (open; PAY-05): SAP mapping loses legal payer and cost-center dimensions. Remaining repair: Use the approved scoped GL mapping keys from the canonical table, fail missing/ambiguous mappings and reconcile exact balanced amounts from frozen placement/result versions.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.
- R39 (partial-repair-verified; PAY-04): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R42 (open; PAY-04, PAY-11): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.
- R44 (partial-repair-verified; PAY-04): Parallel comparison drops repeated lines of the same component. Remaining repair: Sum all signed component facts in integer paise per employee/component. Corrected shared component aggregation is now used by the real comparison; durable complete-population two-cycle/sign-off gates remain open under R29.
- R45 (partial-repair-verified; PAY-05): Numeric SOW citations in phase plans and backend comments do not identify the original requirements. Remaining repair: Regenerate phase tables from the exact original crosswalk, preserve requirement IDs, and replace unverified numeric references in backend comments. Done for backend comments and Phase2/3 maps; source-doc section labels and remaining frontend annotations require separate context validation.

### SOW-073 — original spreadsheet row 73

**Payroll & compliance / 5.1 Payroll Processing**

Investment & flexi declarations: Tax computation based on employee declarations via ESS portal

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-03/04/05/06/09..13

**Historical implementation evidence:** Attendance/reporting/workflow spine and payroll UI shell exist.

**Remaining scope from full crosswalk:** Build row-specific payroll inputs, declaration tax calculation, compute/review/finalize, output files/registers or OT pay. No end-to-end payroll engine is registered.

**Execution cards:** P03, P06, D01

**Database connections:** core.documents, pay.budget_categories, pay.budgets, pay.claim_bills, pay.claim_entitlements, pay.claim_lines, pay.claim_reservations, pay.claim_types, pay.claims, pay.investment_declarations, pay.it_slabs, pay.output_artifacts, pay.payment_obligations, pay.previous_employer_income, pay.pt_slabs, pay.source_consumptions, pay.statutory_memberships, pay.statutory_postings, pay.statutory_rates, pay.tax_elections, pay.tds_challans

**Current reviewed issues:**

- R03 (partial-repair-verified; PAY-04): Payroll attendance SQL is incompatible and day arithmetic is unsafe. Remaining repair: Use work_date plus paid leave/weekoff predicates, SUM weighted days, require complete locked inputs and retain true zero payable days. Integration-test P/HD/LWP/paid-WO/all-absent cases.
- R04 (partial-repair-verified; PAY-04): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R05 (open; PAY-09, PAY-10, PAY-12, PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R06 (partial-repair-verified; PAY-04): Recovery inputs print but do not reduce net pay. Remaining repair: Classify input and arrear effects by component kind, validate allowed amounts and update earning/deduction/employer bases consistently. Add an independent full-run recovery fixture.
- R07 (partial-safety-repair; PAY-04): Detected OT is paid without approval and uses an absent component. Remaining repair: Consume only approved unconsumed OT against locked inputs; prohibit CO double consumption and bind the approved canonical component/policy base.
- R09 (partial-repair-verified; PAY-03, PAY-04): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-03): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R11 (partial-repair-verified; PAY-03): Maker/checker validation fails open on missing evidence. Remaining repair: Persist authoritative maker/checker records with separate DB-backed authorities, reject missing evidence, and atomically enforce legal transitions/audit/reconciliation.
- R12 (open; PAY-03): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R13 (open; PAY-03, PAY-05, PAY-06): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-04, PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R33 (open; PAY-05, PAY-06): Output readiness and artifact ownership are inferred incorrectly. Remaining repair: Persist versioned per-run/payer artifacts with checksum, complete population and actual generation receipts; expose availability from those records, not approval state.
- R34 (open; PAY-05): SAP mapping loses legal payer and cost-center dimensions. Remaining repair: Use the approved scoped GL mapping keys from the canonical table, fail missing/ambiguous mappings and reconcile exact balanced amounts from frozen placement/result versions.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.
- R39 (partial-repair-verified; PAY-04): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R42 (open; PAY-04, PAY-11): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.
- R44 (partial-repair-verified; PAY-04): Parallel comparison drops repeated lines of the same component. Remaining repair: Sum all signed component facts in integer paise per employee/component. Corrected shared component aggregation is now used by the real comparison; durable complete-population two-cycle/sign-off gates remain open under R29.
- R45 (partial-repair-verified; PAY-05): Numeric SOW citations in phase plans and backend comments do not identify the original requirements. Remaining repair: Regenerate phase tables from the exact original crosswalk, preserve requirement IDs, and replace unverified numeric references in backend comments. Done for backend comments and Phase2/3 maps; source-doc section labels and remaining frontend annotations require separate context validation.

### SOW-074 — original spreadsheet row 74

**Payroll & compliance / 5.1 Payroll Processing**

• Payroll processing & review:
 o Salary calculations with deductions and allowances.
 o Draft payroll reports for approval.
 o Final payroll processing after client confirmation

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-03/04/05/06/09..13

**Historical implementation evidence:** Attendance/reporting/workflow spine and payroll UI shell exist.

**Remaining scope from full crosswalk:** Build row-specific payroll inputs, declaration tax calculation, compute/review/finalize, output files/registers or OT pay. No end-to-end payroll engine is registered.

**Execution cards:** P02, D11

**Database connections:** att.month_locks, att.overtime_entries, pay.arrears, pay.inputs, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions

**Current reviewed issues:**

- R03 (partial-repair-verified; PAY-04): Payroll attendance SQL is incompatible and day arithmetic is unsafe. Remaining repair: Use work_date plus paid leave/weekoff predicates, SUM weighted days, require complete locked inputs and retain true zero payable days. Integration-test P/HD/LWP/paid-WO/all-absent cases.
- R04 (partial-repair-verified; PAY-04): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R05 (open; PAY-09, PAY-10, PAY-12, PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R06 (partial-repair-verified; PAY-04): Recovery inputs print but do not reduce net pay. Remaining repair: Classify input and arrear effects by component kind, validate allowed amounts and update earning/deduction/employer bases consistently. Add an independent full-run recovery fixture.
- R07 (partial-safety-repair; PAY-04): Detected OT is paid without approval and uses an absent component. Remaining repair: Consume only approved unconsumed OT against locked inputs; prohibit CO double consumption and bind the approved canonical component/policy base.
- R09 (partial-repair-verified; PAY-03, PAY-04): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-03): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R11 (partial-repair-verified; PAY-03): Maker/checker validation fails open on missing evidence. Remaining repair: Persist authoritative maker/checker records with separate DB-backed authorities, reject missing evidence, and atomically enforce legal transitions/audit/reconciliation.
- R12 (open; PAY-03): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R13 (open; PAY-03, PAY-05, PAY-06): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-04, PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R33 (open; PAY-05, PAY-06): Output readiness and artifact ownership are inferred incorrectly. Remaining repair: Persist versioned per-run/payer artifacts with checksum, complete population and actual generation receipts; expose availability from those records, not approval state.
- R34 (open; PAY-05): SAP mapping loses legal payer and cost-center dimensions. Remaining repair: Use the approved scoped GL mapping keys from the canonical table, fail missing/ambiguous mappings and reconcile exact balanced amounts from frozen placement/result versions.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.
- R39 (partial-repair-verified; PAY-04): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R42 (open; PAY-04, PAY-11): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.
- R44 (partial-repair-verified; PAY-04): Parallel comparison drops repeated lines of the same component. Remaining repair: Sum all signed component facts in integer paise per employee/component. Corrected shared component aggregation is now used by the real comparison; durable complete-population two-cycle/sign-off gates remain open under R29.
- R45 (partial-repair-verified; PAY-05): Numeric SOW citations in phase plans and backend comments do not identify the original requirements. Remaining repair: Regenerate phase tables from the exact original crosswalk, preserve requirement IDs, and replace unverified numeric references in backend comments. Done for backend comments and Phase2/3 maps; source-doc section labels and remaining frontend annotations require separate context validation.

### SOW-075 — original spreadsheet row 75

**Payroll & compliance / 5.1 Payroll Processing**

Performing Payroll deliverables:
 o Final Pay Register.
 o Bank Transfer File.
 o Journal Voucher Report.
 o Payslip & Tax computation slip via ESS.
 o Reimbursement & variance reports.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-03/04/05/06/09..13

**Historical implementation evidence:** Attendance/reporting/workflow spine and payroll UI shell exist.

**Remaining scope from full crosswalk:** Build row-specific payroll inputs, declaration tax calculation, compute/review/finalize, output files/registers or OT pay. No end-to-end payroll engine is registered.

**Execution cards:** P04, W04

**Database connections:** core.documents, core.employee_assignments, pay.bank_batch_lines, pay.bank_batches, pay.gl_accounts, pay.journal_batches, pay.journal_lines, pay.output_artifacts, pay.payment_events, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.source_consumptions, reporting.kpi_daily, reporting.muster_month, reporting.snapshot_builds

**Current reviewed issues:**

- R03 (partial-repair-verified; PAY-04): Payroll attendance SQL is incompatible and day arithmetic is unsafe. Remaining repair: Use work_date plus paid leave/weekoff predicates, SUM weighted days, require complete locked inputs and retain true zero payable days. Integration-test P/HD/LWP/paid-WO/all-absent cases.
- R04 (partial-repair-verified; PAY-04): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R05 (open; PAY-09, PAY-10, PAY-12, PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R06 (partial-repair-verified; PAY-04): Recovery inputs print but do not reduce net pay. Remaining repair: Classify input and arrear effects by component kind, validate allowed amounts and update earning/deduction/employer bases consistently. Add an independent full-run recovery fixture.
- R07 (partial-safety-repair; PAY-04): Detected OT is paid without approval and uses an absent component. Remaining repair: Consume only approved unconsumed OT against locked inputs; prohibit CO double consumption and bind the approved canonical component/policy base.
- R09 (partial-repair-verified; PAY-03, PAY-04): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-03): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R11 (partial-repair-verified; PAY-03): Maker/checker validation fails open on missing evidence. Remaining repair: Persist authoritative maker/checker records with separate DB-backed authorities, reject missing evidence, and atomically enforce legal transitions/audit/reconciliation.
- R12 (open; PAY-03): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R13 (open; PAY-03, PAY-05, PAY-06): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-04, PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R33 (open; PAY-05, PAY-06): Output readiness and artifact ownership are inferred incorrectly. Remaining repair: Persist versioned per-run/payer artifacts with checksum, complete population and actual generation receipts; expose availability from those records, not approval state.
- R34 (open; PAY-05): SAP mapping loses legal payer and cost-center dimensions. Remaining repair: Use the approved scoped GL mapping keys from the canonical table, fail missing/ambiguous mappings and reconcile exact balanced amounts from frozen placement/result versions.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.
- R39 (partial-repair-verified; PAY-04): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R42 (open; PAY-04, PAY-11): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.
- R44 (partial-repair-verified; PAY-04): Parallel comparison drops repeated lines of the same component. Remaining repair: Sum all signed component facts in integer paise per employee/component. Corrected shared component aggregation is now used by the real comparison; durable complete-population two-cycle/sign-off gates remain open under R29.
- R45 (partial-repair-verified; PAY-05): Numeric SOW citations in phase plans and backend comments do not identify the original requirements. Remaining repair: Regenerate phase tables from the exact original crosswalk, preserve requirement IDs, and replace unverified numeric references in backend comments. Done for backend comments and Phase2/3 maps; source-doc section labels and remaining frontend annotations require separate context validation.

### SOW-076 — original spreadsheet row 76

**Payroll & compliance / 5.1 Payroll Processing**

Preparation of standard & customized Reports:
 o Standard: TDS report, PF report, PT report, ESIC report, LWF report, Variance report, CTC report.
 o Customized: Cost Centre, Location, Department-wise reports.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-03/04/05/06/09..13

**Historical implementation evidence:** Attendance/reporting/workflow spine and payroll UI shell exist.

**Remaining scope from full crosswalk:** Build row-specific payroll inputs, declaration tax calculation, compute/review/finalize, output files/registers or OT pay. No end-to-end payroll engine is registered.

**Execution cards:** P03, P04, P07, W04, D01

**Database connections:** core.documents, core.employee_assignments, core.import_batches, pay.arrears, pay.bank_batch_lines, pay.bank_batches, pay.gl_accounts, pay.investment_declarations, pay.it_slabs, pay.journal_batches, pay.journal_lines, pay.output_artifacts, pay.parallel_comparison_lines, pay.parallel_comparisons, pay.payment_events, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.previous_employer_income, pay.pt_slabs, pay.source_consumptions, pay.statutory_memberships, pay.statutory_postings, pay.statutory_rates, pay.tax_elections, pay.tds_challans, reporting.kpi_daily, reporting.muster_month, reporting.snapshot_builds

**Current reviewed issues:**

- R03 (partial-repair-verified; PAY-04): Payroll attendance SQL is incompatible and day arithmetic is unsafe. Remaining repair: Use work_date plus paid leave/weekoff predicates, SUM weighted days, require complete locked inputs and retain true zero payable days. Integration-test P/HD/LWP/paid-WO/all-absent cases.
- R04 (partial-repair-verified; PAY-04): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R05 (open; PAY-09, PAY-10, PAY-12, PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R06 (partial-repair-verified; PAY-04): Recovery inputs print but do not reduce net pay. Remaining repair: Classify input and arrear effects by component kind, validate allowed amounts and update earning/deduction/employer bases consistently. Add an independent full-run recovery fixture.
- R07 (partial-safety-repair; PAY-04): Detected OT is paid without approval and uses an absent component. Remaining repair: Consume only approved unconsumed OT against locked inputs; prohibit CO double consumption and bind the approved canonical component/policy base.
- R09 (partial-repair-verified; PAY-03, PAY-04): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-03): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R11 (partial-repair-verified; PAY-03): Maker/checker validation fails open on missing evidence. Remaining repair: Persist authoritative maker/checker records with separate DB-backed authorities, reject missing evidence, and atomically enforce legal transitions/audit/reconciliation.
- R12 (open; PAY-03): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R13 (open; PAY-03, PAY-05, PAY-06): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-04, PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R33 (open; PAY-05, PAY-06): Output readiness and artifact ownership are inferred incorrectly. Remaining repair: Persist versioned per-run/payer artifacts with checksum, complete population and actual generation receipts; expose availability from those records, not approval state.
- R34 (open; PAY-05): SAP mapping loses legal payer and cost-center dimensions. Remaining repair: Use the approved scoped GL mapping keys from the canonical table, fail missing/ambiguous mappings and reconcile exact balanced amounts from frozen placement/result versions.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.
- R39 (partial-repair-verified; PAY-04): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R42 (open; PAY-04, PAY-11): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.
- R44 (partial-repair-verified; PAY-04): Parallel comparison drops repeated lines of the same component. Remaining repair: Sum all signed component facts in integer paise per employee/component. Corrected shared component aggregation is now used by the real comparison; durable complete-population two-cycle/sign-off gates remain open under R29.
- R45 (partial-repair-verified; PAY-05): Numeric SOW citations in phase plans and backend comments do not identify the original requirements. Remaining repair: Regenerate phase tables from the exact original crosswalk, preserve requirement IDs, and replace unverified numeric references in backend comments. Done for backend comments and Phase2/3 maps; source-doc section labels and remaining frontend annotations require separate context validation.

### SOW-077 — original spreadsheet row 77

**Payroll & compliance / 5.1 Payroll Processing**

• Calculation of OT(Over Time) charges and cross verifying with the attendance system and validate the OT charge

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-03/04/05/06/09..13

**Historical implementation evidence:** Attendance/reporting/workflow spine and payroll UI shell exist.

**Remaining scope from full crosswalk:** Build row-specific payroll inputs, declaration tax calculation, compute/review/finalize, output files/registers or OT pay. No end-to-end payroll engine is registered.

**Execution cards:** A03, P02, D06, D10

**Database connections:** att.month_locks, att.overtime_entries, att.regularizations, pay.arrears, pay.inputs, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions, wf.definition_versions, wf.definitions, wf.delegations, wf.notifications, wf.request_revisions, wf.request_steps, wf.requests

**Current reviewed issues:**

- R03 (partial-repair-verified; PAY-04): Payroll attendance SQL is incompatible and day arithmetic is unsafe. Remaining repair: Use work_date plus paid leave/weekoff predicates, SUM weighted days, require complete locked inputs and retain true zero payable days. Integration-test P/HD/LWP/paid-WO/all-absent cases.
- R04 (partial-repair-verified; PAY-04): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R05 (open; PAY-09, PAY-10, PAY-12, PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R06 (partial-repair-verified; PAY-04): Recovery inputs print but do not reduce net pay. Remaining repair: Classify input and arrear effects by component kind, validate allowed amounts and update earning/deduction/employer bases consistently. Add an independent full-run recovery fixture.
- R07 (partial-safety-repair; PAY-04): Detected OT is paid without approval and uses an absent component. Remaining repair: Consume only approved unconsumed OT against locked inputs; prohibit CO double consumption and bind the approved canonical component/policy base.
- R09 (partial-repair-verified; PAY-03, PAY-04): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-03): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R11 (partial-repair-verified; PAY-03): Maker/checker validation fails open on missing evidence. Remaining repair: Persist authoritative maker/checker records with separate DB-backed authorities, reject missing evidence, and atomically enforce legal transitions/audit/reconciliation.
- R12 (open; PAY-03): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R13 (open; PAY-03, PAY-05, PAY-06): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-04, PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R33 (open; PAY-05, PAY-06): Output readiness and artifact ownership are inferred incorrectly. Remaining repair: Persist versioned per-run/payer artifacts with checksum, complete population and actual generation receipts; expose availability from those records, not approval state.
- R34 (open; PAY-05): SAP mapping loses legal payer and cost-center dimensions. Remaining repair: Use the approved scoped GL mapping keys from the canonical table, fail missing/ambiguous mappings and reconcile exact balanced amounts from frozen placement/result versions.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.
- R39 (partial-repair-verified; PAY-04): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R42 (open; PAY-04, PAY-11): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.
- R44 (partial-repair-verified; PAY-04): Parallel comparison drops repeated lines of the same component. Remaining repair: Sum all signed component facts in integer paise per employee/component. Corrected shared component aggregation is now used by the real comparison; durable complete-population two-cycle/sign-off gates remain open under R29.
- R45 (partial-repair-verified; PAY-05): Numeric SOW citations in phase plans and backend comments do not identify the original requirements. Remaining repair: Regenerate phase tables from the exact original crosswalk, preserve requirement IDs, and replace unverified numeric references in backend comments. Done for backend comments and Phase2/3 maps; source-doc section labels and remaining frontend annotations require separate context validation.

### SOW-078 — original spreadsheet row 78

**Payroll & compliance / 5.1 Payroll Processing**

• Protiviti should Handle the payroll Queries

**Current:** Requires current end-to-end verification. **Historical baseline:** Partial.

**Requirement references:** HD-01

**Historical implementation evidence:** Generic helpdesk ticket raise/queue/reply exists.

**Remaining scope from full crosswalk:** Staff payroll support and connect queries to actual payroll data. Vendor query-resolution service completion cannot be inferred from code.

**Execution cards:** F04, W02

**Database connections:** core.document_operations, core.documents, core.letter_templates, core.letters, hd.categories, hd.escalation_rules, hd.ticket_events, hd.ticket_messages, hd.tickets, wf.event_subscriptions, wf.notification_attempts, wf.notifications

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-079 — original spreadsheet row 79

**Payroll & compliance / 5.1 Payroll Processing**

Protiviti should Validate attendance by verifying data or biometric records

**Current:** Blocked by reviewed defects. **Historical baseline:** Partial.

**Requirement references:** ATT-01/02/03, PAY-03

**Historical implementation evidence:** Raw-swipe drilldown and reconciliation report exist.

**Remaining scope from full crosswalk:** Replace simulated Kent feed and perform real pre-payroll attendance reconciliation/sign-off.

**Execution cards:** A01, A02, A05, D05, D07

**Database connections:** att.absence_cases, att.coverage_targets, att.day_records, att.device_watermarks, att.devices, att.employee_shifts, att.holidays, att.ingest_watermarks, att.manager_month_approvals, att.month_locks, att.quarantined_swipes, att.recompute_queue, att.roster_publications, att.roster_revisions, att.rosters, att.shift_patterns, att.shift_swaps, att.shifts, att.source_receipts, att.swipe_events, core.employee_assignments, core.letters, reporting.muster_month, reporting.snapshot_builds

**Current reviewed issues:**

- R09 (partial-repair-verified; PAY-03): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-03): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R11 (partial-repair-verified; PAY-03): Maker/checker validation fails open on missing evidence. Remaining repair: Persist authoritative maker/checker records with separate DB-backed authorities, reject missing evidence, and atomically enforce legal transitions/audit/reconciliation.
- R12 (open; PAY-03): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R13 (open; PAY-03): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.
- R36 (open; ATT-01): Biometric verification stamps evidence without checking Kent. Remaining repair: Separate human-confirmed versus connector-confirmed evidence, retain actor/source receipt and wire approved scheduled reminder/escalation jobs; do not manufacture integration proof.

### SOW-081 — original spreadsheet row 81

**Payroll & compliance / 5.2 Verification of Inputs**

• The Protiviti should handle the end-to-end payroll process, from collecting inputs to preparing the final register

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-03/04/05/06/09..13

**Historical implementation evidence:** Attendance/reporting/workflow spine and payroll UI shell exist.

**Remaining scope from full crosswalk:** Build row-specific payroll inputs, declaration tax calculation, compute/review/finalize, output files/registers or OT pay. No end-to-end payroll engine is registered.

**Execution cards:** P02, P07

**Database connections:** att.month_locks, att.overtime_entries, core.import_batches, pay.arrears, pay.inputs, pay.output_artifacts, pay.parallel_comparison_lines, pay.parallel_comparisons, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions, pay.statutory_postings

**Current reviewed issues:**

- R03 (partial-repair-verified; PAY-04): Payroll attendance SQL is incompatible and day arithmetic is unsafe. Remaining repair: Use work_date plus paid leave/weekoff predicates, SUM weighted days, require complete locked inputs and retain true zero payable days. Integration-test P/HD/LWP/paid-WO/all-absent cases.
- R04 (partial-repair-verified; PAY-04): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R05 (open; PAY-09, PAY-10, PAY-12, PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R06 (partial-repair-verified; PAY-04): Recovery inputs print but do not reduce net pay. Remaining repair: Classify input and arrear effects by component kind, validate allowed amounts and update earning/deduction/employer bases consistently. Add an independent full-run recovery fixture.
- R07 (partial-safety-repair; PAY-04): Detected OT is paid without approval and uses an absent component. Remaining repair: Consume only approved unconsumed OT against locked inputs; prohibit CO double consumption and bind the approved canonical component/policy base.
- R09 (partial-repair-verified; PAY-03, PAY-04): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-03): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R11 (partial-repair-verified; PAY-03): Maker/checker validation fails open on missing evidence. Remaining repair: Persist authoritative maker/checker records with separate DB-backed authorities, reject missing evidence, and atomically enforce legal transitions/audit/reconciliation.
- R12 (open; PAY-03): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R13 (open; PAY-03, PAY-05, PAY-06): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-04, PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R33 (open; PAY-05, PAY-06): Output readiness and artifact ownership are inferred incorrectly. Remaining repair: Persist versioned per-run/payer artifacts with checksum, complete population and actual generation receipts; expose availability from those records, not approval state.
- R34 (open; PAY-05): SAP mapping loses legal payer and cost-center dimensions. Remaining repair: Use the approved scoped GL mapping keys from the canonical table, fail missing/ambiguous mappings and reconcile exact balanced amounts from frozen placement/result versions.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.
- R39 (partial-repair-verified; PAY-04): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R42 (open; PAY-04, PAY-11): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.
- R44 (partial-repair-verified; PAY-04): Parallel comparison drops repeated lines of the same component. Remaining repair: Sum all signed component facts in integer paise per employee/component. Corrected shared component aggregation is now used by the real comparison; durable complete-population two-cycle/sign-off gates remain open under R29.
- R45 (partial-repair-verified; PAY-05): Numeric SOW citations in phase plans and backend comments do not identify the original requirements. Remaining repair: Regenerate phase tables from the exact original crosswalk, preserve requirement IDs, and replace unverified numeric references in backend comments. Done for backend comments and Phase2/3 maps; source-doc section labels and remaining frontend annotations require separate context validation.

### SOW-082 — original spreadsheet row 82

**Payroll & compliance / 5.2 Verification of Inputs**

Effective date of salary revision.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-16, PAY-01

**Historical implementation evidence:** Salary history is specified only.

**Remaining scope from full crosswalk:** Build effective-dated revisions, overlap constraint and retro delta computation.

**Execution cards:** P01, P02, L02, L03, D10

**Database connections:** att.month_locks, att.overtime_entries, core.employee_assignments, core.employee_history, core.letters, core.probation_reviews, core.transfer_requests, pay.arrears, pay.employee_salaries, pay.inputs, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_components, pay.salary_holds, pay.salary_structure_versions, pay.salary_structures, pay.source_consumptions, wf.requests

**Current reviewed issues:**

- R04 (partial-repair-verified; PAY-16): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R08 (open; PAY-16): Arrears can be paid again on subsequent runs. Remaining repair: Reserve/consume each signed delta exactly once in the same financial transaction; preserve original/result versions and retry-safe keys.
- R10 (open; PAY-16): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R22 (open; PAY-16): Future transfers mutate today and promotions do not change salary. Remaining repair: Publish effective-dated placement/salary changes; activate projections on effective date with validated aligned links, historical scope snapshots and signed leave/entity payroll continuity.
- R31 (open; PAY-16): Apply-increment reports success without salary revisions. Remaining repair: Resolve approved employee salary facts server-side, atomically create real effective revisions and replay-safe recompute/delta obligations, and return actual persisted counts.
- R40 (open; PAY-01): Salary preview and assignment ignore configured amount rules. Remaining repair: Define and validate the documented amount_rule grammar and CTC anchors; use one assembler for preview and assignment. Reject missing rules rather than fabricate pay. Add real persisted-structure preview/assignment tests with explicit approved amounts.
- R41 (open; PAY-01): Probation scales earnings after dependent contributions have already been computed. Remaining repair: Apply approved probation scaling before evaluating dependent deduction/employer formulas and balancing CTC. Add a hand-computed fixture that includes BASIC, PF_EE and employer PF, with approved rounding and policy inputs.

### SOW-083 — original spreadsheet row 83

**Payroll & compliance / 5.2 Verification of Inputs**

Duplication of Employee Code / Number / ID.

**Current:** Blocked by reviewed defects. **Historical baseline:** Implemented.

**Requirement references:** CORE-02/08

**Historical implementation evidence:** Unique employee ecode, atomic per-company generator and series-checked imports exist.

**Remaining scope from full crosswalk:** Real-source reconciliation and HR review of rejected/duplicate rows remain.

**Execution cards:** F02, D09

**Database connections:** core.companies, core.cost_centers, core.departments, core.designations, core.employee_assignments, core.employee_education, core.employee_family, core.employee_history, core.employee_prev_employment, core.employees, core.grades, core.import_batches, core.locations, core.mis_codes, core.org_units, core.plants, core.profile_change_requests, core.reporting_tree, core.source_mappings

**Current reviewed issues:**

- R21 (open; CORE-02): Transfer e-codes use employee count instead of allocator. Remaining repair: Allocate via the canonical locked company sequence within the approved transfer transaction; use an external-identity mapping and concurrent transfer tests.

### SOW-084 — original spreadsheet row 84

**Payroll & compliance / 5.2 Verification of Inputs**

Whether any employees are minor based on the date of birth.

**Current:** Requires current end-to-end verification. **Historical baseline:** Pending.

**Requirement references:** CORE-07/08

**Historical implementation evidence:** DOB and statutory/bank strings can be stored; identifiers are permission-masked on reads.

**Remaining scope from full crosswalk:** Implement the exact row validation (minor DOB, bank length, IFSC/PAN/Aadhaar format/checksum, duplicate ESIC). Import schema accepts raw strings; source migration lacks these CHECK/UNIQUE rules.

**Execution cards:** F02, D09

**Database connections:** core.companies, core.cost_centers, core.departments, core.designations, core.employee_assignments, core.employee_education, core.employee_family, core.employee_history, core.employee_prev_employment, core.employees, core.grades, core.import_batches, core.locations, core.mis_codes, core.org_units, core.plants, core.profile_change_requests, core.reporting_tree, core.source_mappings

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-085 — original spreadsheet row 85

**Payroll & compliance / 5.2 Verification of Inputs**

Length of bank account.

**Current:** Requires current end-to-end verification. **Historical baseline:** Pending.

**Requirement references:** CORE-07/08

**Historical implementation evidence:** DOB and statutory/bank strings can be stored; identifiers are permission-masked on reads.

**Remaining scope from full crosswalk:** Implement the exact row validation (minor DOB, bank length, IFSC/PAN/Aadhaar format/checksum, duplicate ESIC). Import schema accepts raw strings; source migration lacks these CHECK/UNIQUE rules.

**Execution cards:** F02, D09

**Database connections:** core.companies, core.cost_centers, core.departments, core.designations, core.employee_assignments, core.employee_education, core.employee_family, core.employee_history, core.employee_prev_employment, core.employees, core.grades, core.import_batches, core.locations, core.mis_codes, core.org_units, core.plants, core.profile_change_requests, core.reporting_tree, core.source_mappings

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-086 — original spreadsheet row 86

**Payroll & compliance / 5.2 Verification of Inputs**

IFSC code.

**Current:** Requires current end-to-end verification. **Historical baseline:** Pending.

**Requirement references:** CORE-07/08

**Historical implementation evidence:** DOB and statutory/bank strings can be stored; identifiers are permission-masked on reads.

**Remaining scope from full crosswalk:** Implement the exact row validation (minor DOB, bank length, IFSC/PAN/Aadhaar format/checksum, duplicate ESIC). Import schema accepts raw strings; source migration lacks these CHECK/UNIQUE rules.

**Execution cards:** F02, D09

**Database connections:** core.companies, core.cost_centers, core.departments, core.designations, core.employee_assignments, core.employee_education, core.employee_family, core.employee_history, core.employee_prev_employment, core.employees, core.grades, core.import_batches, core.locations, core.mis_codes, core.org_units, core.plants, core.profile_change_requests, core.reporting_tree, core.source_mappings

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-087 — original spreadsheet row 87

**Payroll & compliance / 5.2 Verification of Inputs**

Permanent Account Number (PAN).

**Current:** Requires current end-to-end verification. **Historical baseline:** Pending.

**Requirement references:** CORE-07/08

**Historical implementation evidence:** DOB and statutory/bank strings can be stored; identifiers are permission-masked on reads.

**Remaining scope from full crosswalk:** Implement the exact row validation (minor DOB, bank length, IFSC/PAN/Aadhaar format/checksum, duplicate ESIC). Import schema accepts raw strings; source migration lacks these CHECK/UNIQUE rules.

**Execution cards:** F02, D09

**Database connections:** core.companies, core.cost_centers, core.departments, core.designations, core.employee_assignments, core.employee_education, core.employee_family, core.employee_history, core.employee_prev_employment, core.employees, core.grades, core.import_batches, core.locations, core.mis_codes, core.org_units, core.plants, core.profile_change_requests, core.reporting_tree, core.source_mappings

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-088 — original spreadsheet row 88

**Payroll & compliance / 5.2 Verification of Inputs**

Aadhaar number.

**Current:** Requires current end-to-end verification. **Historical baseline:** Pending.

**Requirement references:** CORE-07/08

**Historical implementation evidence:** DOB and statutory/bank strings can be stored; identifiers are permission-masked on reads.

**Remaining scope from full crosswalk:** Implement the exact row validation (minor DOB, bank length, IFSC/PAN/Aadhaar format/checksum, duplicate ESIC). Import schema accepts raw strings; source migration lacks these CHECK/UNIQUE rules.

**Execution cards:** F02, D09

**Database connections:** core.companies, core.cost_centers, core.departments, core.designations, core.employee_assignments, core.employee_education, core.employee_family, core.employee_history, core.employee_prev_employment, core.employees, core.grades, core.import_batches, core.locations, core.mis_codes, core.org_units, core.plants, core.profile_change_requests, core.reporting_tree, core.source_mappings

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-089 — original spreadsheet row 89

**Payroll & compliance / 5.2 Verification of Inputs**

Duplication of ESI number.

**Current:** Requires current end-to-end verification. **Historical baseline:** Pending.

**Requirement references:** CORE-07/08

**Historical implementation evidence:** DOB and statutory/bank strings can be stored; identifiers are permission-masked on reads.

**Remaining scope from full crosswalk:** Implement the exact row validation (minor DOB, bank length, IFSC/PAN/Aadhaar format/checksum, duplicate ESIC). Import schema accepts raw strings; source migration lacks these CHECK/UNIQUE rules.

**Execution cards:** F02, D09

**Database connections:** core.companies, core.cost_centers, core.departments, core.designations, core.employee_assignments, core.employee_education, core.employee_family, core.employee_history, core.employee_prev_employment, core.employees, core.grades, core.import_batches, core.locations, core.mis_codes, core.org_units, core.plants, core.profile_change_requests, core.reporting_tree, core.source_mappings

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-090 — original spreadsheet row 90

**Payroll & compliance / 5.2 Verification of Inputs**

Check that the CTC matches with break up shared by the Rashmi Metaliks Limited

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** CORE-08, PAY-01

**Historical implementation evidence:** Salary structure is a pending Phase-2 item.

**Remaining scope from full crosswalk:** Build CTC-vs-component breakup validation and rejection fixtures.

**Execution cards:** P01, D10

**Database connections:** core.employee_assignments, core.probation_reviews, pay.employee_salaries, pay.salary_components, pay.salary_structure_versions, pay.salary_structures

**Current reviewed issues:**

- R40 (open; PAY-01): Salary preview and assignment ignore configured amount rules. Remaining repair: Define and validate the documented amount_rule grammar and CTC anchors; use one assembler for preview and assignment. Reject missing rules rather than fabricate pay. Add real persisted-structure preview/assignment tests with explicit approved amounts.
- R41 (open; PAY-01): Probation scales earnings after dependent contributions have already been computed. Remaining repair: Apply approved probation scaling before evaluating dependent deduction/employer formulas and balancing CTC. Add a hand-computed fixture that includes BASIC, PF_EE and employer PF, with approved rounding and policy inputs.

### SOW-091 — original spreadsheet row 91

**Payroll & compliance / 5.2 Verification of Inputs**

Identification of duplicate inputs.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** CORE-08, PAY-03

**Historical implementation evidence:** Employee ecode uniqueness exists; payroll input pipeline does not.

**Remaining scope from full crosswalk:** Add duplicate monthly-variable/input detection keyed to run/employee/component.

**Execution cards:** P02, D11

**Database connections:** att.month_locks, att.overtime_entries, pay.arrears, pay.inputs, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions

**Current reviewed issues:**

- R09 (partial-repair-verified; PAY-03): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-03): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R11 (partial-repair-verified; PAY-03): Maker/checker validation fails open on missing evidence. Remaining repair: Persist authoritative maker/checker records with separate DB-backed authorities, reject missing evidence, and atomically enforce legal transitions/audit/reconciliation.
- R12 (open; PAY-03): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R13 (open; PAY-03): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.

### SOW-092 — original spreadsheet row 92

**Payroll & compliance / 5.2 Verification of Inputs**

Special Character for designation, Department - like" & " , ' ". These are not accepted and would be removed.

**Current:** Requires current end-to-end verification. **Historical baseline:** Partial.

**Requirement references:** CORE-08

**Historical implementation evidence:** Department/designation import trims, collapses whitespace and deduplicates case.

**Remaining scope from full crosswalk:** Implement the specified special-character rule or obtain approved replacement. Current normalization does not strip ampersands/quotes.

**Execution cards:** F02, D09

**Database connections:** core.companies, core.cost_centers, core.departments, core.designations, core.employee_assignments, core.employee_education, core.employee_family, core.employee_history, core.employee_prev_employment, core.employees, core.grades, core.import_batches, core.locations, core.mis_codes, core.org_units, core.plants, core.profile_change_requests, core.reporting_tree, core.source_mappings

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-093 — original spreadsheet row 93

**Payroll & compliance / 5.2 Verification of Inputs**

Check whether an employee is in Active or Inactive statusfor variable inputs.

**Current:** Blocked by reviewed defects. **Historical baseline:** Partial.

**Requirement references:** CORE-06, PAY-03

**Historical implementation evidence:** Directory supports status filters and exited-requires-DOL CHECK.

**Remaining scope from full crosswalk:** Enforce active/exiting eligibility in payroll variable inputs; input API is pending.

**Execution cards:** F02, P02

**Database connections:** att.month_locks, att.overtime_entries, core.companies, core.cost_centers, core.departments, core.designations, core.employee_assignments, core.employee_education, core.employee_family, core.employee_history, core.employee_prev_employment, core.employees, core.grades, core.import_batches, core.locations, core.mis_codes, core.org_units, core.plants, core.profile_change_requests, core.reporting_tree, core.source_mappings, pay.arrears, pay.inputs, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions

**Current reviewed issues:**

- R09 (partial-repair-verified; PAY-03): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-03): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R11 (partial-repair-verified; PAY-03): Maker/checker validation fails open on missing evidence. Remaining repair: Persist authoritative maker/checker records with separate DB-backed authorities, reject missing evidence, and atomically enforce legal transitions/audit/reconciliation.
- R12 (open; PAY-03): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R13 (open; PAY-03): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.

### SOW-095 — original spreadsheet row 95

**Payroll & compliance / 5.3 Entity Transfer of Employes**

Payroll Input

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LC-05, PAY-03/05/13

**Historical implementation evidence:** Entity master exists; payroll/transfer processes do not.

**Remaining scope from full crosswalk:** Build this entity-transfer deliverable: input, draft, observation/review, final register, bank file, payslip/tax or JV/custom reports; prove payroll continuity.

**Execution cards:** A05, P02

**Database connections:** att.absence_cases, att.day_records, att.manager_month_approvals, att.month_locks, att.overtime_entries, core.letters, pay.arrears, pay.inputs, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions, reporting.muster_month, reporting.snapshot_builds

**Current reviewed issues:**

- R05 (open; PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R09 (partial-repair-verified; PAY-03): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-03): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R11 (partial-repair-verified; PAY-03): Maker/checker validation fails open on missing evidence. Remaining repair: Persist authoritative maker/checker records with separate DB-backed authorities, reject missing evidence, and atomically enforce legal transitions/audit/reconciliation.
- R12 (open; PAY-03): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R13 (open; PAY-03, PAY-05): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.
- R21 (open; LC-05): Transfer e-codes use employee count instead of allocator. Remaining repair: Allocate via the canonical locked company sequence within the approved transfer transaction; use an external-identity mapping and concurrent transfer tests.
- R22 (open; LC-05): Future transfers mutate today and promotions do not change salary. Remaining repair: Publish effective-dated placement/salary changes; activate projections on effective date with validated aligned links, historical scope snapshots and signed leave/entity payroll continuity.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R33 (open; PAY-05): Output readiness and artifact ownership are inferred incorrectly. Remaining repair: Persist versioned per-run/payer artifacts with checksum, complete population and actual generation receipts; expose availability from those records, not approval state.
- R34 (open; PAY-05): SAP mapping loses legal payer and cost-center dimensions. Remaining repair: Use the approved scoped GL mapping keys from the canonical table, fail missing/ambiguous mappings and reconcile exact balanced amounts from frozen placement/result versions.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.
- R45 (partial-repair-verified; PAY-05): Numeric SOW citations in phase plans and backend comments do not identify the original requirements. Remaining repair: Regenerate phase tables from the exact original crosswalk, preserve requirement IDs, and replace unverified numeric references in backend comments. Done for backend comments and Phase2/3 maps; source-doc section labels and remaining frontend annotations require separate context validation.

### SOW-096 — original spreadsheet row 96

**Payroll & compliance / 5.3 Entity Transfer of Employes**

Draft Pay sheet

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LC-05, PAY-03/05/13

**Historical implementation evidence:** Entity master exists; payroll/transfer processes do not.

**Remaining scope from full crosswalk:** Build this entity-transfer deliverable: input, draft, observation/review, final register, bank file, payslip/tax or JV/custom reports; prove payroll continuity.

**Execution cards:** P02

**Database connections:** att.month_locks, att.overtime_entries, pay.arrears, pay.inputs, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions

**Current reviewed issues:**

- R05 (open; PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R09 (partial-repair-verified; PAY-03): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-03): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R11 (partial-repair-verified; PAY-03): Maker/checker validation fails open on missing evidence. Remaining repair: Persist authoritative maker/checker records with separate DB-backed authorities, reject missing evidence, and atomically enforce legal transitions/audit/reconciliation.
- R12 (open; PAY-03): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R13 (open; PAY-03, PAY-05): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.
- R21 (open; LC-05): Transfer e-codes use employee count instead of allocator. Remaining repair: Allocate via the canonical locked company sequence within the approved transfer transaction; use an external-identity mapping and concurrent transfer tests.
- R22 (open; LC-05): Future transfers mutate today and promotions do not change salary. Remaining repair: Publish effective-dated placement/salary changes; activate projections on effective date with validated aligned links, historical scope snapshots and signed leave/entity payroll continuity.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R33 (open; PAY-05): Output readiness and artifact ownership are inferred incorrectly. Remaining repair: Persist versioned per-run/payer artifacts with checksum, complete population and actual generation receipts; expose availability from those records, not approval state.
- R34 (open; PAY-05): SAP mapping loses legal payer and cost-center dimensions. Remaining repair: Use the approved scoped GL mapping keys from the canonical table, fail missing/ambiguous mappings and reconcile exact balanced amounts from frozen placement/result versions.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.
- R45 (partial-repair-verified; PAY-05): Numeric SOW citations in phase plans and backend comments do not identify the original requirements. Remaining repair: Regenerate phase tables from the exact original crosswalk, preserve requirement IDs, and replace unverified numeric references in backend comments. Done for backend comments and Phase2/3 maps; source-doc section labels and remaining frontend annotations require separate context validation.

### SOW-097 — original spreadsheet row 97

**Payroll & compliance / 5.3 Entity Transfer of Employes**

Observations if any

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LC-05, PAY-03/05/13

**Historical implementation evidence:** Entity master exists; payroll/transfer processes do not.

**Remaining scope from full crosswalk:** Build this entity-transfer deliverable: input, draft, observation/review, final register, bank file, payslip/tax or JV/custom reports; prove payroll continuity.

**Execution cards:** P02, W04

**Database connections:** att.month_locks, att.overtime_entries, core.employee_assignments, pay.arrears, pay.inputs, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions, reporting.kpi_daily, reporting.muster_month, reporting.snapshot_builds

**Current reviewed issues:**

- R05 (open; PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R09 (partial-repair-verified; PAY-03): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-03): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R11 (partial-repair-verified; PAY-03): Maker/checker validation fails open on missing evidence. Remaining repair: Persist authoritative maker/checker records with separate DB-backed authorities, reject missing evidence, and atomically enforce legal transitions/audit/reconciliation.
- R12 (open; PAY-03): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R13 (open; PAY-03, PAY-05): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.
- R21 (open; LC-05): Transfer e-codes use employee count instead of allocator. Remaining repair: Allocate via the canonical locked company sequence within the approved transfer transaction; use an external-identity mapping and concurrent transfer tests.
- R22 (open; LC-05): Future transfers mutate today and promotions do not change salary. Remaining repair: Publish effective-dated placement/salary changes; activate projections on effective date with validated aligned links, historical scope snapshots and signed leave/entity payroll continuity.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R33 (open; PAY-05): Output readiness and artifact ownership are inferred incorrectly. Remaining repair: Persist versioned per-run/payer artifacts with checksum, complete population and actual generation receipts; expose availability from those records, not approval state.
- R34 (open; PAY-05): SAP mapping loses legal payer and cost-center dimensions. Remaining repair: Use the approved scoped GL mapping keys from the canonical table, fail missing/ambiguous mappings and reconcile exact balanced amounts from frozen placement/result versions.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.
- R45 (partial-repair-verified; PAY-05): Numeric SOW citations in phase plans and backend comments do not identify the original requirements. Remaining repair: Regenerate phase tables from the exact original crosswalk, preserve requirement IDs, and replace unverified numeric references in backend comments. Done for backend comments and Phase2/3 maps; source-doc section labels and remaining frontend annotations require separate context validation.

### SOW-098 — original spreadsheet row 98

**Payroll & compliance / 5.3 Entity Transfer of Employes**

Finaly pay Register

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LC-05, PAY-03/05/13

**Historical implementation evidence:** Entity master exists; payroll/transfer processes do not.

**Remaining scope from full crosswalk:** Build this entity-transfer deliverable: input, draft, observation/review, final register, bank file, payslip/tax or JV/custom reports; prove payroll continuity.

**Execution cards:** P02, P04, D11

**Database connections:** att.month_locks, att.overtime_entries, core.documents, pay.arrears, pay.bank_batch_lines, pay.bank_batches, pay.gl_accounts, pay.inputs, pay.journal_batches, pay.journal_lines, pay.output_artifacts, pay.payment_events, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions

**Current reviewed issues:**

- R05 (open; PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R09 (partial-repair-verified; PAY-03): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-03): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R11 (partial-repair-verified; PAY-03): Maker/checker validation fails open on missing evidence. Remaining repair: Persist authoritative maker/checker records with separate DB-backed authorities, reject missing evidence, and atomically enforce legal transitions/audit/reconciliation.
- R12 (open; PAY-03): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R13 (open; PAY-03, PAY-05): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.
- R21 (open; LC-05): Transfer e-codes use employee count instead of allocator. Remaining repair: Allocate via the canonical locked company sequence within the approved transfer transaction; use an external-identity mapping and concurrent transfer tests.
- R22 (open; LC-05): Future transfers mutate today and promotions do not change salary. Remaining repair: Publish effective-dated placement/salary changes; activate projections on effective date with validated aligned links, historical scope snapshots and signed leave/entity payroll continuity.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R33 (open; PAY-05): Output readiness and artifact ownership are inferred incorrectly. Remaining repair: Persist versioned per-run/payer artifacts with checksum, complete population and actual generation receipts; expose availability from those records, not approval state.
- R34 (open; PAY-05): SAP mapping loses legal payer and cost-center dimensions. Remaining repair: Use the approved scoped GL mapping keys from the canonical table, fail missing/ambiguous mappings and reconcile exact balanced amounts from frozen placement/result versions.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.
- R45 (partial-repair-verified; PAY-05): Numeric SOW citations in phase plans and backend comments do not identify the original requirements. Remaining repair: Regenerate phase tables from the exact original crosswalk, preserve requirement IDs, and replace unverified numeric references in backend comments. Done for backend comments and Phase2/3 maps; source-doc section labels and remaining frontend annotations require separate context validation.

### SOW-099 — original spreadsheet row 99

**Payroll & compliance / 5.3 Entity Transfer of Employes**

Bank Transfer File

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LC-05, PAY-03/05/13

**Historical implementation evidence:** Entity master exists; payroll/transfer processes do not.

**Remaining scope from full crosswalk:** Build this entity-transfer deliverable: input, draft, observation/review, final register, bank file, payslip/tax or JV/custom reports; prove payroll continuity.

**Execution cards:** P04

**Database connections:** core.documents, pay.bank_batch_lines, pay.bank_batches, pay.gl_accounts, pay.journal_batches, pay.journal_lines, pay.output_artifacts, pay.payment_events, pay.payment_obligations

**Current reviewed issues:**

- R05 (open; PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R09 (partial-repair-verified; PAY-03): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-03): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R11 (partial-repair-verified; PAY-03): Maker/checker validation fails open on missing evidence. Remaining repair: Persist authoritative maker/checker records with separate DB-backed authorities, reject missing evidence, and atomically enforce legal transitions/audit/reconciliation.
- R12 (open; PAY-03): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R13 (open; PAY-03, PAY-05): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.
- R21 (open; LC-05): Transfer e-codes use employee count instead of allocator. Remaining repair: Allocate via the canonical locked company sequence within the approved transfer transaction; use an external-identity mapping and concurrent transfer tests.
- R22 (open; LC-05): Future transfers mutate today and promotions do not change salary. Remaining repair: Publish effective-dated placement/salary changes; activate projections on effective date with validated aligned links, historical scope snapshots and signed leave/entity payroll continuity.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R33 (open; PAY-05): Output readiness and artifact ownership are inferred incorrectly. Remaining repair: Persist versioned per-run/payer artifacts with checksum, complete population and actual generation receipts; expose availability from those records, not approval state.
- R34 (open; PAY-05): SAP mapping loses legal payer and cost-center dimensions. Remaining repair: Use the approved scoped GL mapping keys from the canonical table, fail missing/ambiguous mappings and reconcile exact balanced amounts from frozen placement/result versions.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.
- R45 (partial-repair-verified; PAY-05): Numeric SOW citations in phase plans and backend comments do not identify the original requirements. Remaining repair: Regenerate phase tables from the exact original crosswalk, preserve requirement IDs, and replace unverified numeric references in backend comments. Done for backend comments and Phase2/3 maps; source-doc section labels and remaining frontend annotations require separate context validation.

### SOW-100 — original spreadsheet row 100

**Payroll & compliance / 5.3 Entity Transfer of Employes**

Payslip and Tax planner

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LC-05, PAY-03/05/13

**Historical implementation evidence:** Entity master exists; payroll/transfer processes do not.

**Remaining scope from full crosswalk:** Build this entity-transfer deliverable: input, draft, observation/review, final register, bank file, payslip/tax or JV/custom reports; prove payroll continuity.

**Execution cards:** P03, P04

**Database connections:** core.documents, pay.bank_batch_lines, pay.bank_batches, pay.gl_accounts, pay.investment_declarations, pay.it_slabs, pay.journal_batches, pay.journal_lines, pay.output_artifacts, pay.payment_events, pay.payment_obligations, pay.previous_employer_income, pay.pt_slabs, pay.statutory_memberships, pay.statutory_postings, pay.statutory_rates, pay.tax_elections, pay.tds_challans

**Current reviewed issues:**

- R05 (open; PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R09 (partial-repair-verified; PAY-03): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-03): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R11 (partial-repair-verified; PAY-03): Maker/checker validation fails open on missing evidence. Remaining repair: Persist authoritative maker/checker records with separate DB-backed authorities, reject missing evidence, and atomically enforce legal transitions/audit/reconciliation.
- R12 (open; PAY-03): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R13 (open; PAY-03, PAY-05): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.
- R21 (open; LC-05): Transfer e-codes use employee count instead of allocator. Remaining repair: Allocate via the canonical locked company sequence within the approved transfer transaction; use an external-identity mapping and concurrent transfer tests.
- R22 (open; LC-05): Future transfers mutate today and promotions do not change salary. Remaining repair: Publish effective-dated placement/salary changes; activate projections on effective date with validated aligned links, historical scope snapshots and signed leave/entity payroll continuity.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R33 (open; PAY-05): Output readiness and artifact ownership are inferred incorrectly. Remaining repair: Persist versioned per-run/payer artifacts with checksum, complete population and actual generation receipts; expose availability from those records, not approval state.
- R34 (open; PAY-05): SAP mapping loses legal payer and cost-center dimensions. Remaining repair: Use the approved scoped GL mapping keys from the canonical table, fail missing/ambiguous mappings and reconcile exact balanced amounts from frozen placement/result versions.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.
- R45 (partial-repair-verified; PAY-05): Numeric SOW citations in phase plans and backend comments do not identify the original requirements. Remaining repair: Regenerate phase tables from the exact original crosswalk, preserve requirement IDs, and replace unverified numeric references in backend comments. Done for backend comments and Phase2/3 maps; source-doc section labels and remaining frontend annotations require separate context validation.

### SOW-101 — original spreadsheet row 101

**Payroll & compliance / 5.3 Entity Transfer of Employes**

JV report, Standard report and Customised Reports

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LC-05, PAY-03/05/13

**Historical implementation evidence:** Entity master exists; payroll/transfer processes do not.

**Remaining scope from full crosswalk:** Build this entity-transfer deliverable: input, draft, observation/review, final register, bank file, payslip/tax or JV/custom reports; prove payroll continuity.

**Execution cards:** P04, W04

**Database connections:** core.documents, core.employee_assignments, pay.bank_batch_lines, pay.bank_batches, pay.gl_accounts, pay.journal_batches, pay.journal_lines, pay.output_artifacts, pay.payment_events, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.source_consumptions, reporting.kpi_daily, reporting.muster_month, reporting.snapshot_builds

**Current reviewed issues:**

- R05 (open; PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R09 (partial-repair-verified; PAY-03): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-03): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R11 (partial-repair-verified; PAY-03): Maker/checker validation fails open on missing evidence. Remaining repair: Persist authoritative maker/checker records with separate DB-backed authorities, reject missing evidence, and atomically enforce legal transitions/audit/reconciliation.
- R12 (open; PAY-03): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R13 (open; PAY-03, PAY-05): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.
- R21 (open; LC-05): Transfer e-codes use employee count instead of allocator. Remaining repair: Allocate via the canonical locked company sequence within the approved transfer transaction; use an external-identity mapping and concurrent transfer tests.
- R22 (open; LC-05): Future transfers mutate today and promotions do not change salary. Remaining repair: Publish effective-dated placement/salary changes; activate projections on effective date with validated aligned links, historical scope snapshots and signed leave/entity payroll continuity.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R33 (open; PAY-05): Output readiness and artifact ownership are inferred incorrectly. Remaining repair: Persist versioned per-run/payer artifacts with checksum, complete population and actual generation receipts; expose availability from those records, not approval state.
- R34 (open; PAY-05): SAP mapping loses legal payer and cost-center dimensions. Remaining repair: Use the approved scoped GL mapping keys from the canonical table, fail missing/ambiguous mappings and reconcile exact balanced amounts from frozen placement/result versions.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.
- R45 (partial-repair-verified; PAY-05): Numeric SOW citations in phase plans and backend comments do not identify the original requirements. Remaining repair: Regenerate phase tables from the exact original crosswalk, preserve requirement IDs, and replace unverified numeric references in backend comments. Done for backend comments and Phase2/3 maps; source-doc section labels and remaining frontend annotations require separate context validation.

### SOW-103 — original spreadsheet row 103

**Payroll & compliance / 5.4 Pro rating Salary / Calculation of Arrears:**

Mid-month new joiner

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-04/16

**Historical implementation evidence:** Proration/retro methods are specified; only generic money rounding utilities exist.

**Remaining scope from full crosswalk:** Implement row-specific join/leave/LOP/reversal/divisor/legacy arrear behavior using signed settings and hand-computed payroll fixtures.

**Execution cards:** P01, P02, D10

**Database connections:** att.month_locks, att.overtime_entries, core.employee_assignments, core.probation_reviews, pay.arrears, pay.employee_salaries, pay.inputs, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_components, pay.salary_holds, pay.salary_structure_versions, pay.salary_structures, pay.source_consumptions

**Current reviewed issues:**

- R03 (partial-repair-verified; PAY-04): Payroll attendance SQL is incompatible and day arithmetic is unsafe. Remaining repair: Use work_date plus paid leave/weekoff predicates, SUM weighted days, require complete locked inputs and retain true zero payable days. Integration-test P/HD/LWP/paid-WO/all-absent cases.
- R04 (partial-repair-verified; PAY-04, PAY-16): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R06 (partial-repair-verified; PAY-04): Recovery inputs print but do not reduce net pay. Remaining repair: Classify input and arrear effects by component kind, validate allowed amounts and update earning/deduction/employer bases consistently. Add an independent full-run recovery fixture.
- R07 (partial-safety-repair; PAY-04): Detected OT is paid without approval and uses an absent component. Remaining repair: Consume only approved unconsumed OT against locked inputs; prohibit CO double consumption and bind the approved canonical component/policy base.
- R08 (open; PAY-16): Arrears can be paid again on subsequent runs. Remaining repair: Reserve/consume each signed delta exactly once in the same financial transaction; preserve original/result versions and retry-safe keys.
- R09 (partial-repair-verified; PAY-04): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-16): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R22 (open; PAY-16): Future transfers mutate today and promotions do not change salary. Remaining repair: Publish effective-dated placement/salary changes; activate projections on effective date with validated aligned links, historical scope snapshots and signed leave/entity payroll continuity.
- R29 (open; PAY-04): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R31 (open; PAY-16): Apply-increment reports success without salary revisions. Remaining repair: Resolve approved employee salary facts server-side, atomically create real effective revisions and replay-safe recompute/delta obligations, and return actual persisted counts.
- R39 (partial-repair-verified; PAY-04): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R42 (open; PAY-04): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.
- R44 (partial-repair-verified; PAY-04): Parallel comparison drops repeated lines of the same component. Remaining repair: Sum all signed component facts in integer paise per employee/component. Corrected shared component aggregation is now used by the real comparison; durable complete-population two-cycle/sign-off gates remain open under R29.

### SOW-104 — original spreadsheet row 104

**Payroll & compliance / 5.4 Pro rating Salary / Calculation of Arrears:**

Mid-month leaver

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-04/16

**Historical implementation evidence:** Proration/retro methods are specified; only generic money rounding utilities exist.

**Remaining scope from full crosswalk:** Implement row-specific join/leave/LOP/reversal/divisor/legacy arrear behavior using signed settings and hand-computed payroll fixtures.

**Execution cards:** P01, P02, L04, L05, D10

**Database connections:** ast.assignments, ast.custody_events, att.month_locks, att.overtime_entries, core.clearances, core.employee_assignments, core.letters, core.probation_reviews, core.separations, lv.ledger, pay.arrears, pay.claims, pay.employee_salaries, pay.fnf_settlements, pay.inputs, pay.loan_postings, pay.loans, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_components, pay.salary_holds, pay.salary_structure_versions, pay.salary_structures, pay.source_consumptions, te.advances, te.wallet_postings

**Current reviewed issues:**

- R03 (partial-repair-verified; PAY-04): Payroll attendance SQL is incompatible and day arithmetic is unsafe. Remaining repair: Use work_date plus paid leave/weekoff predicates, SUM weighted days, require complete locked inputs and retain true zero payable days. Integration-test P/HD/LWP/paid-WO/all-absent cases.
- R04 (partial-repair-verified; PAY-04, PAY-16): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R06 (partial-repair-verified; PAY-04): Recovery inputs print but do not reduce net pay. Remaining repair: Classify input and arrear effects by component kind, validate allowed amounts and update earning/deduction/employer bases consistently. Add an independent full-run recovery fixture.
- R07 (partial-safety-repair; PAY-04): Detected OT is paid without approval and uses an absent component. Remaining repair: Consume only approved unconsumed OT against locked inputs; prohibit CO double consumption and bind the approved canonical component/policy base.
- R08 (open; PAY-16): Arrears can be paid again on subsequent runs. Remaining repair: Reserve/consume each signed delta exactly once in the same financial transaction; preserve original/result versions and retry-safe keys.
- R09 (partial-repair-verified; PAY-04): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-16): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R22 (open; PAY-16): Future transfers mutate today and promotions do not change salary. Remaining repair: Publish effective-dated placement/salary changes; activate projections on effective date with validated aligned links, historical scope snapshots and signed leave/entity payroll continuity.
- R29 (open; PAY-04): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R31 (open; PAY-16): Apply-increment reports success without salary revisions. Remaining repair: Resolve approved employee salary facts server-side, atomically create real effective revisions and replay-safe recompute/delta obligations, and return actual persisted counts.
- R39 (partial-repair-verified; PAY-04): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R42 (open; PAY-04): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.
- R44 (partial-repair-verified; PAY-04): Parallel comparison drops repeated lines of the same component. Remaining repair: Sum all signed component facts in integer paise per employee/component. Corrected shared component aggregation is now used by the real comparison; durable complete-population two-cycle/sign-off gates remain open under R29.

### SOW-105 — original spreadsheet row 105

**Payroll & compliance / 5.4 Pro rating Salary / Calculation of Arrears:**

Loss of Pay calculations

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-04/16

**Historical implementation evidence:** Proration/retro methods are specified; only generic money rounding utilities exist.

**Remaining scope from full crosswalk:** Implement row-specific join/leave/LOP/reversal/divisor/legacy arrear behavior using signed settings and hand-computed payroll fixtures.

**Execution cards:** A02, A05, P02, D05, D10

**Database connections:** att.absence_cases, att.coverage_targets, att.day_records, att.employee_shifts, att.holidays, att.manager_month_approvals, att.month_locks, att.overtime_entries, att.recompute_queue, att.roster_publications, att.roster_revisions, att.rosters, att.shift_patterns, att.shift_swaps, att.shifts, core.employee_assignments, core.letters, pay.arrears, pay.inputs, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions, reporting.muster_month, reporting.snapshot_builds

**Current reviewed issues:**

- R03 (partial-repair-verified; PAY-04): Payroll attendance SQL is incompatible and day arithmetic is unsafe. Remaining repair: Use work_date plus paid leave/weekoff predicates, SUM weighted days, require complete locked inputs and retain true zero payable days. Integration-test P/HD/LWP/paid-WO/all-absent cases.
- R04 (partial-repair-verified; PAY-04, PAY-16): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R06 (partial-repair-verified; PAY-04): Recovery inputs print but do not reduce net pay. Remaining repair: Classify input and arrear effects by component kind, validate allowed amounts and update earning/deduction/employer bases consistently. Add an independent full-run recovery fixture.
- R07 (partial-safety-repair; PAY-04): Detected OT is paid without approval and uses an absent component. Remaining repair: Consume only approved unconsumed OT against locked inputs; prohibit CO double consumption and bind the approved canonical component/policy base.
- R08 (open; PAY-16): Arrears can be paid again on subsequent runs. Remaining repair: Reserve/consume each signed delta exactly once in the same financial transaction; preserve original/result versions and retry-safe keys.
- R09 (partial-repair-verified; PAY-04): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-16): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R22 (open; PAY-16): Future transfers mutate today and promotions do not change salary. Remaining repair: Publish effective-dated placement/salary changes; activate projections on effective date with validated aligned links, historical scope snapshots and signed leave/entity payroll continuity.
- R29 (open; PAY-04): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R31 (open; PAY-16): Apply-increment reports success without salary revisions. Remaining repair: Resolve approved employee salary facts server-side, atomically create real effective revisions and replay-safe recompute/delta obligations, and return actual persisted counts.
- R39 (partial-repair-verified; PAY-04): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R42 (open; PAY-04): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.
- R44 (partial-repair-verified; PAY-04): Parallel comparison drops repeated lines of the same component. Remaining repair: Sum all signed component facts in integer paise per employee/component. Corrected shared component aggregation is now used by the real comparison; durable complete-population two-cycle/sign-off gates remain open under R29.

### SOW-106 — original spreadsheet row 106

**Payroll & compliance / 5.4 Pro rating Salary / Calculation of Arrears:**

Loss of Pay reversals

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-04/16

**Historical implementation evidence:** Proration/retro methods are specified; only generic money rounding utilities exist.

**Remaining scope from full crosswalk:** Implement row-specific join/leave/LOP/reversal/divisor/legacy arrear behavior using signed settings and hand-computed payroll fixtures.

**Execution cards:** P02, D10

**Database connections:** att.month_locks, att.overtime_entries, pay.arrears, pay.inputs, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions

**Current reviewed issues:**

- R03 (partial-repair-verified; PAY-04): Payroll attendance SQL is incompatible and day arithmetic is unsafe. Remaining repair: Use work_date plus paid leave/weekoff predicates, SUM weighted days, require complete locked inputs and retain true zero payable days. Integration-test P/HD/LWP/paid-WO/all-absent cases.
- R04 (partial-repair-verified; PAY-04, PAY-16): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R06 (partial-repair-verified; PAY-04): Recovery inputs print but do not reduce net pay. Remaining repair: Classify input and arrear effects by component kind, validate allowed amounts and update earning/deduction/employer bases consistently. Add an independent full-run recovery fixture.
- R07 (partial-safety-repair; PAY-04): Detected OT is paid without approval and uses an absent component. Remaining repair: Consume only approved unconsumed OT against locked inputs; prohibit CO double consumption and bind the approved canonical component/policy base.
- R08 (open; PAY-16): Arrears can be paid again on subsequent runs. Remaining repair: Reserve/consume each signed delta exactly once in the same financial transaction; preserve original/result versions and retry-safe keys.
- R09 (partial-repair-verified; PAY-04): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-16): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R22 (open; PAY-16): Future transfers mutate today and promotions do not change salary. Remaining repair: Publish effective-dated placement/salary changes; activate projections on effective date with validated aligned links, historical scope snapshots and signed leave/entity payroll continuity.
- R29 (open; PAY-04): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R31 (open; PAY-16): Apply-increment reports success without salary revisions. Remaining repair: Resolve approved employee salary facts server-side, atomically create real effective revisions and replay-safe recompute/delta obligations, and return actual persisted counts.
- R39 (partial-repair-verified; PAY-04): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R42 (open; PAY-04): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.
- R44 (partial-repair-verified; PAY-04): Parallel comparison drops repeated lines of the same component. Remaining repair: Sum all signed component facts in integer paise per employee/component. Corrected shared component aggregation is now used by the real comparison; durable complete-population two-cycle/sign-off gates remain open under R29.

### SOW-107 — original spreadsheet row 107

**Payroll & compliance / 5.4 Pro rating Salary / Calculation of Arrears:**

Previous month Loss of Pay

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-04/16

**Historical implementation evidence:** Proration/retro methods are specified; only generic money rounding utilities exist.

**Remaining scope from full crosswalk:** Implement row-specific join/leave/LOP/reversal/divisor/legacy arrear behavior using signed settings and hand-computed payroll fixtures.

**Execution cards:** A05, P02, P07, D10

**Database connections:** att.absence_cases, att.day_records, att.manager_month_approvals, att.month_locks, att.overtime_entries, core.import_batches, core.letters, pay.arrears, pay.inputs, pay.output_artifacts, pay.parallel_comparison_lines, pay.parallel_comparisons, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions, pay.statutory_postings, reporting.muster_month, reporting.snapshot_builds

**Current reviewed issues:**

- R03 (partial-repair-verified; PAY-04): Payroll attendance SQL is incompatible and day arithmetic is unsafe. Remaining repair: Use work_date plus paid leave/weekoff predicates, SUM weighted days, require complete locked inputs and retain true zero payable days. Integration-test P/HD/LWP/paid-WO/all-absent cases.
- R04 (partial-repair-verified; PAY-04, PAY-16): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R06 (partial-repair-verified; PAY-04): Recovery inputs print but do not reduce net pay. Remaining repair: Classify input and arrear effects by component kind, validate allowed amounts and update earning/deduction/employer bases consistently. Add an independent full-run recovery fixture.
- R07 (partial-safety-repair; PAY-04): Detected OT is paid without approval and uses an absent component. Remaining repair: Consume only approved unconsumed OT against locked inputs; prohibit CO double consumption and bind the approved canonical component/policy base.
- R08 (open; PAY-16): Arrears can be paid again on subsequent runs. Remaining repair: Reserve/consume each signed delta exactly once in the same financial transaction; preserve original/result versions and retry-safe keys.
- R09 (partial-repair-verified; PAY-04): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-16): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R22 (open; PAY-16): Future transfers mutate today and promotions do not change salary. Remaining repair: Publish effective-dated placement/salary changes; activate projections on effective date with validated aligned links, historical scope snapshots and signed leave/entity payroll continuity.
- R29 (open; PAY-04): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R31 (open; PAY-16): Apply-increment reports success without salary revisions. Remaining repair: Resolve approved employee salary facts server-side, atomically create real effective revisions and replay-safe recompute/delta obligations, and return actual persisted counts.
- R39 (partial-repair-verified; PAY-04): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R42 (open; PAY-04): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.
- R44 (partial-repair-verified; PAY-04): Parallel comparison drops repeated lines of the same component. Remaining repair: Sum all signed component facts in integer paise per employee/component. Corrected shared component aggregation is now used by the real comparison; durable complete-population two-cycle/sign-off gates remain open under R29.

### SOW-109 — original spreadsheet row 109

**Payroll & compliance / 5.4 Pro rating Salary / Calculation of Arrears:**

Actual calendar days in the month

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-04/16

**Historical implementation evidence:** Proration/retro methods are specified; only generic money rounding utilities exist.

**Remaining scope from full crosswalk:** Implement row-specific join/leave/LOP/reversal/divisor/legacy arrear behavior using signed settings and hand-computed payroll fixtures.

**Execution cards:** A02, P02, D10

**Database connections:** att.coverage_targets, att.day_records, att.employee_shifts, att.holidays, att.month_locks, att.overtime_entries, att.recompute_queue, att.roster_publications, att.roster_revisions, att.rosters, att.shift_patterns, att.shift_swaps, att.shifts, core.employee_assignments, pay.arrears, pay.inputs, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions

**Current reviewed issues:**

- R03 (partial-repair-verified; PAY-04): Payroll attendance SQL is incompatible and day arithmetic is unsafe. Remaining repair: Use work_date plus paid leave/weekoff predicates, SUM weighted days, require complete locked inputs and retain true zero payable days. Integration-test P/HD/LWP/paid-WO/all-absent cases.
- R04 (partial-repair-verified; PAY-04, PAY-16): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R06 (partial-repair-verified; PAY-04): Recovery inputs print but do not reduce net pay. Remaining repair: Classify input and arrear effects by component kind, validate allowed amounts and update earning/deduction/employer bases consistently. Add an independent full-run recovery fixture.
- R07 (partial-safety-repair; PAY-04): Detected OT is paid without approval and uses an absent component. Remaining repair: Consume only approved unconsumed OT against locked inputs; prohibit CO double consumption and bind the approved canonical component/policy base.
- R08 (open; PAY-16): Arrears can be paid again on subsequent runs. Remaining repair: Reserve/consume each signed delta exactly once in the same financial transaction; preserve original/result versions and retry-safe keys.
- R09 (partial-repair-verified; PAY-04): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-16): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R22 (open; PAY-16): Future transfers mutate today and promotions do not change salary. Remaining repair: Publish effective-dated placement/salary changes; activate projections on effective date with validated aligned links, historical scope snapshots and signed leave/entity payroll continuity.
- R29 (open; PAY-04): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R31 (open; PAY-16): Apply-increment reports success without salary revisions. Remaining repair: Resolve approved employee salary facts server-side, atomically create real effective revisions and replay-safe recompute/delta obligations, and return actual persisted counts.
- R39 (partial-repair-verified; PAY-04): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R42 (open; PAY-04): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.
- R44 (partial-repair-verified; PAY-04): Parallel comparison drops repeated lines of the same component. Remaining repair: Sum all signed component facts in integer paise per employee/component. Corrected shared component aggregation is now used by the real comparison; durable complete-population two-cycle/sign-off gates remain open under R29.

### SOW-110 — original spreadsheet row 110

**Payroll & compliance / 5.4 Pro rating Salary / Calculation of Arrears:**

Actual calendar days in the month less weekends

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-04/16

**Historical implementation evidence:** Proration/retro methods are specified; only generic money rounding utilities exist.

**Remaining scope from full crosswalk:** Implement row-specific join/leave/LOP/reversal/divisor/legacy arrear behavior using signed settings and hand-computed payroll fixtures.

**Execution cards:** A02, P02, D10

**Database connections:** att.coverage_targets, att.day_records, att.employee_shifts, att.holidays, att.month_locks, att.overtime_entries, att.recompute_queue, att.roster_publications, att.roster_revisions, att.rosters, att.shift_patterns, att.shift_swaps, att.shifts, core.employee_assignments, pay.arrears, pay.inputs, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions

**Current reviewed issues:**

- R03 (partial-repair-verified; PAY-04): Payroll attendance SQL is incompatible and day arithmetic is unsafe. Remaining repair: Use work_date plus paid leave/weekoff predicates, SUM weighted days, require complete locked inputs and retain true zero payable days. Integration-test P/HD/LWP/paid-WO/all-absent cases.
- R04 (partial-repair-verified; PAY-04, PAY-16): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R06 (partial-repair-verified; PAY-04): Recovery inputs print but do not reduce net pay. Remaining repair: Classify input and arrear effects by component kind, validate allowed amounts and update earning/deduction/employer bases consistently. Add an independent full-run recovery fixture.
- R07 (partial-safety-repair; PAY-04): Detected OT is paid without approval and uses an absent component. Remaining repair: Consume only approved unconsumed OT against locked inputs; prohibit CO double consumption and bind the approved canonical component/policy base.
- R08 (open; PAY-16): Arrears can be paid again on subsequent runs. Remaining repair: Reserve/consume each signed delta exactly once in the same financial transaction; preserve original/result versions and retry-safe keys.
- R09 (partial-repair-verified; PAY-04): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-16): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R22 (open; PAY-16): Future transfers mutate today and promotions do not change salary. Remaining repair: Publish effective-dated placement/salary changes; activate projections on effective date with validated aligned links, historical scope snapshots and signed leave/entity payroll continuity.
- R29 (open; PAY-04): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R31 (open; PAY-16): Apply-increment reports success without salary revisions. Remaining repair: Resolve approved employee salary facts server-side, atomically create real effective revisions and replay-safe recompute/delta obligations, and return actual persisted counts.
- R39 (partial-repair-verified; PAY-04): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R42 (open; PAY-04): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.
- R44 (partial-repair-verified; PAY-04): Parallel comparison drops repeated lines of the same component. Remaining repair: Sum all signed component facts in integer paise per employee/component. Corrected shared component aggregation is now used by the real comparison; durable complete-population two-cycle/sign-off gates remain open under R29.

### SOW-111 — original spreadsheet row 111

**Payroll & compliance / 5.4 Pro rating Salary / Calculation of Arrears:**

Fixed days like 30, 31 (this cannot change between months) without decimals.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-04/16

**Historical implementation evidence:** Proration/retro methods are specified; only generic money rounding utilities exist.

**Remaining scope from full crosswalk:** Implement row-specific join/leave/LOP/reversal/divisor/legacy arrear behavior using signed settings and hand-computed payroll fixtures.

**Execution cards:** A02, P02, D10

**Database connections:** att.coverage_targets, att.day_records, att.employee_shifts, att.holidays, att.month_locks, att.overtime_entries, att.recompute_queue, att.roster_publications, att.roster_revisions, att.rosters, att.shift_patterns, att.shift_swaps, att.shifts, core.employee_assignments, pay.arrears, pay.inputs, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions

**Current reviewed issues:**

- R03 (partial-repair-verified; PAY-04): Payroll attendance SQL is incompatible and day arithmetic is unsafe. Remaining repair: Use work_date plus paid leave/weekoff predicates, SUM weighted days, require complete locked inputs and retain true zero payable days. Integration-test P/HD/LWP/paid-WO/all-absent cases.
- R04 (partial-repair-verified; PAY-04, PAY-16): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R06 (partial-repair-verified; PAY-04): Recovery inputs print but do not reduce net pay. Remaining repair: Classify input and arrear effects by component kind, validate allowed amounts and update earning/deduction/employer bases consistently. Add an independent full-run recovery fixture.
- R07 (partial-safety-repair; PAY-04): Detected OT is paid without approval and uses an absent component. Remaining repair: Consume only approved unconsumed OT against locked inputs; prohibit CO double consumption and bind the approved canonical component/policy base.
- R08 (open; PAY-16): Arrears can be paid again on subsequent runs. Remaining repair: Reserve/consume each signed delta exactly once in the same financial transaction; preserve original/result versions and retry-safe keys.
- R09 (partial-repair-verified; PAY-04): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-16): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R22 (open; PAY-16): Future transfers mutate today and promotions do not change salary. Remaining repair: Publish effective-dated placement/salary changes; activate projections on effective date with validated aligned links, historical scope snapshots and signed leave/entity payroll continuity.
- R29 (open; PAY-04): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R31 (open; PAY-16): Apply-increment reports success without salary revisions. Remaining repair: Resolve approved employee salary facts server-side, atomically create real effective revisions and replay-safe recompute/delta obligations, and return actual persisted counts.
- R39 (partial-repair-verified; PAY-04): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R42 (open; PAY-04): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.
- R44 (partial-repair-verified; PAY-04): Parallel comparison drops repeated lines of the same component. Remaining repair: Sum all signed component facts in integer paise per employee/component. Corrected shared component aggregation is now used by the real comparison; durable complete-population two-cycle/sign-off gates remain open under R29.

### SOW-113 — original spreadsheet row 113

**Payroll & compliance / Pro rating the salary based on the following factors is not possible:**

Actual calendar days less alternate weekends

**Current:** Scope decision pending. **Historical baseline:** Scope decision.

**Requirement references:** PAY-04

**Historical implementation evidence:** Source section heading at row 112 says these proration modes are NOT possible, although each has score 100%.

**Remaining scope from full crosswalk:** Keep as contractual exclusion/ambiguity until HR confirms intended scope. Do not count the historical 100% as a delivered capability.

**Execution cards:** D08

**Database connections:** See completion cards; no new schema inferred

**Current reviewed issues:**

- R03 (partial-repair-verified; PAY-04): Payroll attendance SQL is incompatible and day arithmetic is unsafe. Remaining repair: Use work_date plus paid leave/weekoff predicates, SUM weighted days, require complete locked inputs and retain true zero payable days. Integration-test P/HD/LWP/paid-WO/all-absent cases.
- R04 (partial-repair-verified; PAY-04): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R06 (partial-repair-verified; PAY-04): Recovery inputs print but do not reduce net pay. Remaining repair: Classify input and arrear effects by component kind, validate allowed amounts and update earning/deduction/employer bases consistently. Add an independent full-run recovery fixture.
- R07 (partial-safety-repair; PAY-04): Detected OT is paid without approval and uses an absent component. Remaining repair: Consume only approved unconsumed OT against locked inputs; prohibit CO double consumption and bind the approved canonical component/policy base.
- R09 (partial-repair-verified; PAY-04): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R29 (open; PAY-04): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R39 (partial-repair-verified; PAY-04): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R42 (open; PAY-04): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.
- R44 (partial-repair-verified; PAY-04): Parallel comparison drops repeated lines of the same component. Remaining repair: Sum all signed component facts in integer paise per employee/component. Corrected shared component aggregation is now used by the real comparison; durable complete-population two-cycle/sign-off gates remain open under R29.

### SOW-114 — original spreadsheet row 114

**Payroll & compliance / Pro rating the salary based on the following factors is not possible:**

Actual calendar days less holidays

**Current:** Scope decision pending. **Historical baseline:** Scope decision.

**Requirement references:** PAY-04

**Historical implementation evidence:** Source section heading at row 112 says these proration modes are NOT possible, although each has score 100%.

**Remaining scope from full crosswalk:** Keep as contractual exclusion/ambiguity until HR confirms intended scope. Do not count the historical 100% as a delivered capability.

**Execution cards:** D08

**Database connections:** See completion cards; no new schema inferred

**Current reviewed issues:**

- R03 (partial-repair-verified; PAY-04): Payroll attendance SQL is incompatible and day arithmetic is unsafe. Remaining repair: Use work_date plus paid leave/weekoff predicates, SUM weighted days, require complete locked inputs and retain true zero payable days. Integration-test P/HD/LWP/paid-WO/all-absent cases.
- R04 (partial-repair-verified; PAY-04): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R06 (partial-repair-verified; PAY-04): Recovery inputs print but do not reduce net pay. Remaining repair: Classify input and arrear effects by component kind, validate allowed amounts and update earning/deduction/employer bases consistently. Add an independent full-run recovery fixture.
- R07 (partial-safety-repair; PAY-04): Detected OT is paid without approval and uses an absent component. Remaining repair: Consume only approved unconsumed OT against locked inputs; prohibit CO double consumption and bind the approved canonical component/policy base.
- R09 (partial-repair-verified; PAY-04): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R29 (open; PAY-04): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R39 (partial-repair-verified; PAY-04): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R42 (open; PAY-04): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.
- R44 (partial-repair-verified; PAY-04): Parallel comparison drops repeated lines of the same component. Remaining repair: Sum all signed component facts in integer paise per employee/component. Corrected shared component aggregation is now used by the real comparison; durable complete-population two-cycle/sign-off gates remain open under R29.

### SOW-115 — original spreadsheet row 115

**Payroll & compliance / Pro rating the salary based on the following factors is not possible:**

Fixed days that vary month on month.

**Current:** Scope decision pending. **Historical baseline:** Scope decision.

**Requirement references:** PAY-04

**Historical implementation evidence:** Source section heading at row 112 says these proration modes are NOT possible, although each has score 100%.

**Remaining scope from full crosswalk:** Keep as contractual exclusion/ambiguity until HR confirms intended scope. Do not count the historical 100% as a delivered capability.

**Execution cards:** D08

**Database connections:** See completion cards; no new schema inferred

**Current reviewed issues:**

- R03 (partial-repair-verified; PAY-04): Payroll attendance SQL is incompatible and day arithmetic is unsafe. Remaining repair: Use work_date plus paid leave/weekoff predicates, SUM weighted days, require complete locked inputs and retain true zero payable days. Integration-test P/HD/LWP/paid-WO/all-absent cases.
- R04 (partial-repair-verified; PAY-04): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R06 (partial-repair-verified; PAY-04): Recovery inputs print but do not reduce net pay. Remaining repair: Classify input and arrear effects by component kind, validate allowed amounts and update earning/deduction/employer bases consistently. Add an independent full-run recovery fixture.
- R07 (partial-safety-repair; PAY-04): Detected OT is paid without approval and uses an absent component. Remaining repair: Consume only approved unconsumed OT against locked inputs; prohibit CO double consumption and bind the approved canonical component/policy base.
- R09 (partial-repair-verified; PAY-04): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R29 (open; PAY-04): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R39 (partial-repair-verified; PAY-04): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R42 (open; PAY-04): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.
- R44 (partial-repair-verified; PAY-04): Parallel comparison drops repeated lines of the same component. Remaining repair: Sum all signed component facts in integer paise per employee/component. Corrected shared component aggregation is now used by the real comparison; durable complete-population two-cycle/sign-off gates remain open under R29.

### SOW-116 — original spreadsheet row 116

**Payroll & compliance / Pro rating the salary based on the following factors is not possible:**

If the period for which salary is pro rated pertains to the period prior to go live with vendor, then the client would need provide arrear break up component wise to enable vendor to include in the current month payroll.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-04/16

**Historical implementation evidence:** Proration/retro methods are specified; only generic money rounding utilities exist.

**Remaining scope from full crosswalk:** Implement row-specific join/leave/LOP/reversal/divisor/legacy arrear behavior using signed settings and hand-computed payroll fixtures.

**Execution cards:** P01, P02, P03, P07, D10

**Database connections:** att.month_locks, att.overtime_entries, core.employee_assignments, core.import_batches, core.probation_reviews, pay.arrears, pay.employee_salaries, pay.inputs, pay.investment_declarations, pay.it_slabs, pay.output_artifacts, pay.parallel_comparison_lines, pay.parallel_comparisons, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.previous_employer_income, pay.pt_slabs, pay.run_input_refs, pay.salary_components, pay.salary_holds, pay.salary_structure_versions, pay.salary_structures, pay.source_consumptions, pay.statutory_memberships, pay.statutory_postings, pay.statutory_rates, pay.tax_elections, pay.tds_challans

**Current reviewed issues:**

- R03 (partial-repair-verified; PAY-04): Payroll attendance SQL is incompatible and day arithmetic is unsafe. Remaining repair: Use work_date plus paid leave/weekoff predicates, SUM weighted days, require complete locked inputs and retain true zero payable days. Integration-test P/HD/LWP/paid-WO/all-absent cases.
- R04 (partial-repair-verified; PAY-04, PAY-16): Mid-month salary assignments can be skipped silently. Remaining repair: Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.
- R06 (partial-repair-verified; PAY-04): Recovery inputs print but do not reduce net pay. Remaining repair: Classify input and arrear effects by component kind, validate allowed amounts and update earning/deduction/employer bases consistently. Add an independent full-run recovery fixture.
- R07 (partial-safety-repair; PAY-04): Detected OT is paid without approval and uses an absent component. Remaining repair: Consume only approved unconsumed OT against locked inputs; prohibit CO double consumption and bind the approved canonical component/policy base.
- R08 (open; PAY-16): Arrears can be paid again on subsequent runs. Remaining repair: Reserve/consume each signed delta exactly once in the same financial transaction; preserve original/result versions and retry-safe keys.
- R09 (partial-repair-verified; PAY-04): Finalization ignores line and review reconciliation failures. Remaining repair: Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.
- R10 (open; PAY-16): Closed payroll results remain editable. Remaining repair: Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.
- R22 (open; PAY-16): Future transfers mutate today and promotions do not change salary. Remaining repair: Publish effective-dated placement/salary changes; activate projections on effective date with validated aligned links, historical scope snapshots and signed leave/entity payroll continuity.
- R29 (open; PAY-04): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R31 (open; PAY-16): Apply-increment reports success without salary revisions. Remaining repair: Resolve approved employee salary facts server-side, atomically create real effective revisions and replay-safe recompute/delta obligations, and return actual persisted counts.
- R39 (partial-repair-verified; PAY-04): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
- R42 (open; PAY-04): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.
- R44 (partial-repair-verified; PAY-04): Parallel comparison drops repeated lines of the same component. Remaining repair: Sum all signed component facts in integer paise per employee/component. Corrected shared component aggregation is now used by the real comparison; durable complete-population two-cycle/sign-off gates remain open under R29.

### SOW-118 — original spreadsheet row 118

**Payroll & compliance / 5.5 Loans and Advances**

Vendor would handle the Loan scheduler with the following options:

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LN-01/02/03, PAY-13

**Historical implementation evidence:** Loans UI shell and generic loan workflow definition exist.

**Remaining scope from full crosswalk:** Implement schedulers, eligibility, EMI/payroll postings, advances and SBI perquisite valuation as applicable. Import and reconcile legacy SAP balances.

**Execution cards:** P05, D10, D11

**Database connections:** pay.loan_installments, pay.loan_postings, pay.loans, pay.payment_events, pay.payment_obligations, pay.source_consumptions

**Current reviewed issues:**

- R05 (open; LN-03, PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R12 (open; LN-02): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R14 (open; LN-01): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R23 (open; LN-01, LN-02): ESS loan application bypasses eligibility and approval. Remaining repair: Check authoritative effective eligibility under lock, require approved workflow/funding evidence and typed policy configuration; start as a request, not an active funded loan.
- R24 (open; LN-03): Loan ledger is mutable and repeated deductions are not unique. Remaining repair: Use immutable funded/opening/recovery/settlement postings with once-only source keys and SUM-derived debt; reconcile legacy provenance in its own field and validate installment ownership.
- R26 (open; LN-03): Claim routing declares paid before funds or batch lines exist. Remaining repair: Create conserved settlement/obligation/consumption records, validate subject/payer and legal states, materialize frozen payroll/batch lines and mark paid only from payment receipt. Attach invariant CHECKs to the existing table.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.

### SOW-119 — original spreadsheet row 119

**Payroll & compliance / 5.5 Loans and Advances**

Diminishing

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LN-01/02/03, PAY-13

**Historical implementation evidence:** Loans UI shell and generic loan workflow definition exist.

**Remaining scope from full crosswalk:** Implement schedulers, eligibility, EMI/payroll postings, advances and SBI perquisite valuation as applicable. Import and reconcile legacy SAP balances.

**Execution cards:** P05, D10

**Database connections:** pay.loan_installments, pay.loan_postings, pay.loans, pay.payment_events, pay.payment_obligations, pay.source_consumptions

**Current reviewed issues:**

- R05 (open; LN-03, PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R12 (open; LN-02): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R14 (open; LN-01): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R23 (open; LN-01, LN-02): ESS loan application bypasses eligibility and approval. Remaining repair: Check authoritative effective eligibility under lock, require approved workflow/funding evidence and typed policy configuration; start as a request, not an active funded loan.
- R24 (open; LN-03): Loan ledger is mutable and repeated deductions are not unique. Remaining repair: Use immutable funded/opening/recovery/settlement postings with once-only source keys and SUM-derived debt; reconcile legacy provenance in its own field and validate installment ownership.
- R26 (open; LN-03): Claim routing declares paid before funds or batch lines exist. Remaining repair: Create conserved settlement/obligation/consumption records, validate subject/payer and legal states, materialize frozen payroll/batch lines and mark paid only from payment receipt. Attach invariant CHECKs to the existing table.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.

### SOW-120 — original spreadsheet row 120

**Payroll & compliance / 5.5 Loans and Advances**

Flat

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LN-01/02/03, PAY-13

**Historical implementation evidence:** Loans UI shell and generic loan workflow definition exist.

**Remaining scope from full crosswalk:** Implement schedulers, eligibility, EMI/payroll postings, advances and SBI perquisite valuation as applicable. Import and reconcile legacy SAP balances.

**Execution cards:** P05, D10

**Database connections:** pay.loan_installments, pay.loan_postings, pay.loans, pay.payment_events, pay.payment_obligations, pay.source_consumptions

**Current reviewed issues:**

- R05 (open; LN-03, PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R12 (open; LN-02): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R14 (open; LN-01): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R23 (open; LN-01, LN-02): ESS loan application bypasses eligibility and approval. Remaining repair: Check authoritative effective eligibility under lock, require approved workflow/funding evidence and typed policy configuration; start as a request, not an active funded loan.
- R24 (open; LN-03): Loan ledger is mutable and repeated deductions are not unique. Remaining repair: Use immutable funded/opening/recovery/settlement postings with once-only source keys and SUM-derived debt; reconcile legacy provenance in its own field and validate installment ownership.
- R26 (open; LN-03): Claim routing declares paid before funds or batch lines exist. Remaining repair: Create conserved settlement/obligation/consumption records, validate subject/payer and legal states, materialize frozen payroll/batch lines and mark paid only from payment receipt. Attach invariant CHECKs to the existing table.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.

### SOW-121 — original spreadsheet row 121

**Payroll & compliance / 5.5 Loans and Advances**

Only EMI without Interest

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LN-01/02/03, PAY-13

**Historical implementation evidence:** Loans UI shell and generic loan workflow definition exist.

**Remaining scope from full crosswalk:** Implement schedulers, eligibility, EMI/payroll postings, advances and SBI perquisite valuation as applicable. Import and reconcile legacy SAP balances.

**Execution cards:** P05, D10

**Database connections:** pay.loan_installments, pay.loan_postings, pay.loans, pay.payment_events, pay.payment_obligations, pay.source_consumptions

**Current reviewed issues:**

- R05 (open; LN-03, PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R12 (open; LN-02): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R14 (open; LN-01): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R23 (open; LN-01, LN-02): ESS loan application bypasses eligibility and approval. Remaining repair: Check authoritative effective eligibility under lock, require approved workflow/funding evidence and typed policy configuration; start as a request, not an active funded loan.
- R24 (open; LN-03): Loan ledger is mutable and repeated deductions are not unique. Remaining repair: Use immutable funded/opening/recovery/settlement postings with once-only source keys and SUM-derived debt; reconcile legacy provenance in its own field and validate installment ownership.
- R26 (open; LN-03): Claim routing declares paid before funds or batch lines exist. Remaining repair: Create conserved settlement/obligation/consumption records, validate subject/payer and legal states, materialize frozen payroll/batch lines and mark paid only from payment receipt. Attach invariant CHECKs to the existing table.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.

### SOW-122 — original spreadsheet row 122

**Payroll & compliance / 5.5 Loans and Advances**

vendor would calculate perquisites as per SBI lending rates. This is applicable only if the client provides the loan input to be recovered using vendor loan scheduler. If the client is giving the loan recovery amount month on month, then the client should provide the perquisite value.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LN-01/02/03, PAY-13

**Historical implementation evidence:** Loans UI shell and generic loan workflow definition exist.

**Remaining scope from full crosswalk:** Implement schedulers, eligibility, EMI/payroll postings, advances and SBI perquisite valuation as applicable. Import and reconcile legacy SAP balances.

**Execution cards:** P03, P05, D01, D10

**Database connections:** pay.investment_declarations, pay.it_slabs, pay.loan_installments, pay.loan_postings, pay.loans, pay.output_artifacts, pay.payment_events, pay.payment_obligations, pay.previous_employer_income, pay.pt_slabs, pay.source_consumptions, pay.statutory_memberships, pay.statutory_postings, pay.statutory_rates, pay.tax_elections, pay.tds_challans

**Current reviewed issues:**

- R05 (open; LN-03, PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R12 (open; LN-02): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R14 (open; LN-01): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R23 (open; LN-01, LN-02): ESS loan application bypasses eligibility and approval. Remaining repair: Check authoritative effective eligibility under lock, require approved workflow/funding evidence and typed policy configuration; start as a request, not an active funded loan.
- R24 (open; LN-03): Loan ledger is mutable and repeated deductions are not unique. Remaining repair: Use immutable funded/opening/recovery/settlement postings with once-only source keys and SUM-derived debt; reconcile legacy provenance in its own field and validate installment ownership.
- R26 (open; LN-03): Claim routing declares paid before funds or batch lines exist. Remaining repair: Create conserved settlement/obligation/consumption records, validate subject/payer and legal states, materialize frozen payroll/batch lines and mark paid only from payment receipt. Attach invariant CHECKs to the existing table.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.

### SOW-123 — original spreadsheet row 123

**Payroll & compliance / 5.5 Loans and Advances**

In order to claim tax exemption for Home Loan & Interest employees would need to submit relevant proof to claim under Section 24 during end of year process.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-13

**Historical implementation evidence:** Declarations/proof workflow is specified.

**Remaining scope from full crosswalk:** Build home-loan proof capture/verification and tax treatment; no declarations backend exists.

**Execution cards:** P03, P06, D01

**Database connections:** core.documents, pay.budget_categories, pay.budgets, pay.claim_bills, pay.claim_entitlements, pay.claim_lines, pay.claim_reservations, pay.claim_types, pay.claims, pay.investment_declarations, pay.it_slabs, pay.output_artifacts, pay.payment_obligations, pay.previous_employer_income, pay.pt_slabs, pay.source_consumptions, pay.statutory_memberships, pay.statutory_postings, pay.statutory_rates, pay.tax_elections, pay.tds_challans

**Current reviewed issues:**

- R05 (open; PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.

### SOW-124 — original spreadsheet row 124

**Payroll & compliance / 5.5 Loans and Advances**

Deductions against Salary advance should be provided as monthly inputs.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LN-01/02/03, PAY-13

**Historical implementation evidence:** Loans UI shell and generic loan workflow definition exist.

**Remaining scope from full crosswalk:** Implement schedulers, eligibility, EMI/payroll postings, advances and SBI perquisite valuation as applicable. Import and reconcile legacy SAP balances.

**Execution cards:** P02, P05, T02, D10

**Database connections:** att.month_locks, att.overtime_entries, pay.arrears, pay.claim_lines, pay.claim_reservations, pay.claims, pay.inputs, pay.loan_installments, pay.loan_postings, pay.loans, pay.payment_events, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions, te.advances, te.settlement_advances, te.settlements, te.wallet_postings

**Current reviewed issues:**

- R05 (open; LN-03, PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R12 (open; LN-02): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R14 (open; LN-01): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R23 (open; LN-01, LN-02): ESS loan application bypasses eligibility and approval. Remaining repair: Check authoritative effective eligibility under lock, require approved workflow/funding evidence and typed policy configuration; start as a request, not an active funded loan.
- R24 (open; LN-03): Loan ledger is mutable and repeated deductions are not unique. Remaining repair: Use immutable funded/opening/recovery/settlement postings with once-only source keys and SUM-derived debt; reconcile legacy provenance in its own field and validate installment ownership.
- R26 (open; LN-03): Claim routing declares paid before funds or batch lines exist. Remaining repair: Create conserved settlement/obligation/consumption records, validate subject/payer and legal states, materialize frozen payroll/batch lines and mark paid only from payment receipt. Attach invariant CHECKs to the existing table.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.

### SOW-125 — original spreadsheet row 125

**Payroll & compliance / 5.5 Loans and Advances**

Vendor will not liaise with any third parties to deduct or remit loans and advances.

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** SOW-5.5 exclusion

**Historical implementation evidence:** This is a vendor limitation: no third-party loan liaison.

**Remaining scope from full crosswalk:** Assign Finance/payroll responsibility for any third-party remittance. Not a software feature to mark built.

**Execution cards:** P05, M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.documents, pay.loan_installments, pay.loan_postings, pay.loans, pay.output_artifacts, pay.payment_events, pay.payment_obligations, pay.source_consumptions

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-127 — original spreadsheet row 127

**Payroll & compliance / 5.6 Process for New Joiners:**

Throughout the month through Client portal

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LC-01/02, PAY-07

**Historical implementation evidence:** Employee directory exists; candidate conversion is pending.

**Remaining scope from full crosswalk:** Build approved new-joiner portal intake/conversion and salary availability.

**Execution cards:** F02, L01, R01

**Database connections:** core.companies, core.cost_centers, core.departments, core.designations, core.documents, core.employee_assignments, core.employee_education, core.employee_family, core.employee_history, core.employee_prev_employment, core.employees, core.grades, core.import_batches, core.locations, core.mis_codes, core.onboarding_candidates, core.onboarding_tasks, core.org_units, core.plants, core.prejoin_invitations, core.profile_change_requests, core.reporting_tree, core.source_mappings, pay.employee_salaries, recruit.candidates, recruit.offers, recruit.vacancies

**Current reviewed issues:**

- R14 (open; LC-01): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R18 (open; LC-01, LC-02): Onboarding conversion is not atomic and creates unusable salary/login. Remaining repair: Use the existing validated employee/e-code/salary/auth public APIs inside one owned transaction. Resolve mandatory master links and actual salary breakup, candidate consumption key, welcome credentials/grants and outbox tasks.
- R35 (open; LC-01): Prejoin single-use and at-rest token claims are inaccurate. Remaining repair: Store only a hashed expiring invitation token, lock/compare-and-swap atomic consumption, validate typed profile fields and store one consistent object representation; audit and mask statutory data.
- R36 (open; LC-02): Biometric verification stamps evidence without checking Kent. Remaining repair: Separate human-confirmed versus connector-confirmed evidence, retain actor/source receipt and wire approved scheduled reminder/escalation jobs; do not manufacture integration proof.
- R40 (open; PAY-07): Salary preview and assignment ignore configured amount rules. Remaining repair: Define and validate the documented amount_rule grammar and CTC anchors; use one assembler for preview and assignment. Reject missing rules rather than fabricate pay. Add real persisted-structure preview/assignment tests with explicit approved amounts.

### SOW-128 — original spreadsheet row 128

**Payroll & compliance / 5.6 Process for New Joiners:**

As part of monthly input through the excel format

**Current:** Blocked by reviewed defects. **Historical baseline:** Partial.

**Requirement references:** CORE-12, PAY-07

**Historical implementation evidence:** JSON-row EMS seed/greytHR enrich functions and sample fixtures exist.

**Remaining scope from full crosswalk:** Build/reconcile approved Excel monthly-new-joiner intake including payroll/salary data. Generic seed import is not that complete workflow.

**Execution cards:** F02, F04

**Database connections:** core.companies, core.cost_centers, core.departments, core.designations, core.document_operations, core.documents, core.employee_assignments, core.employee_education, core.employee_family, core.employee_history, core.employee_prev_employment, core.employees, core.grades, core.import_batches, core.letter_templates, core.letters, core.locations, core.mis_codes, core.org_units, core.plants, core.profile_change_requests, core.reporting_tree, core.source_mappings, wf.event_subscriptions, wf.notification_attempts, wf.notifications

**Current reviewed issues:**

- R02 (partial-repair-verified; CORE-12): Applied schema and typed checkout still disagree. Remaining repair: Recover and hash migration provenance; reconcile actual table contracts before feature work. Update Kysely types and migrations together, without dropping canonical models. Untyped deferred modules need explicit scope decisions.
- R30 (open; CORE-12): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R38 (open; CORE-12): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.
- R40 (open; PAY-07): Salary preview and assignment ignore configured amount rules. Remaining repair: Define and validate the documented amount_rule grammar and CTC anchors; use one assembler for preview and assignment. Reject missing rules rather than fabricate pay. Add real persisted-structure preview/assignment tests with explicit approved amounts.
- R43 (partial-repair-verified; CORE-12): Generated timestamp and numeric aliases nest Kysely ColumnType wrappers. Remaining repair: Use one flattened ColumnType with optional insert for defaulted timestamps/numerics. Corrected timestamp and FX declarations; rerun typecheck and actual database flows. Continue nullability/domain compatibility audit separately from column-name equality.
- R45 (partial-repair-verified; CORE-12): Numeric SOW citations in phase plans and backend comments do not identify the original requirements. Remaining repair: Regenerate phase tables from the exact original crosswalk, preserve requirement IDs, and replace unverified numeric references in backend comments. Done for backend comments and Phase2/3 maps; source-doc section labels and remaining frontend annotations require separate context validation.

### SOW-129 — original spreadsheet row 129

**Payroll & compliance / 5.6 Process for New Joiners:**

Through HR connector if integration is in scope

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LC-01, PAY-07

**Historical implementation evidence:** Connector-based ATS handoff is planned.

**Remaining scope from full crosswalk:** Implement agreed HR connector/ATS joined-list sync and mapping.

**Execution cards:** F02, F04, L01, R01

**Database connections:** core.companies, core.cost_centers, core.departments, core.designations, core.document_operations, core.documents, core.employee_assignments, core.employee_education, core.employee_family, core.employee_history, core.employee_prev_employment, core.employees, core.grades, core.import_batches, core.letter_templates, core.letters, core.locations, core.mis_codes, core.onboarding_candidates, core.onboarding_tasks, core.org_units, core.plants, core.prejoin_invitations, core.profile_change_requests, core.reporting_tree, core.source_mappings, pay.employee_salaries, recruit.candidates, recruit.offers, recruit.vacancies, wf.event_subscriptions, wf.notification_attempts, wf.notifications

**Current reviewed issues:**

- R14 (open; LC-01): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R18 (open; LC-01): Onboarding conversion is not atomic and creates unusable salary/login. Remaining repair: Use the existing validated employee/e-code/salary/auth public APIs inside one owned transaction. Resolve mandatory master links and actual salary breakup, candidate consumption key, welcome credentials/grants and outbox tasks.
- R35 (open; LC-01): Prejoin single-use and at-rest token claims are inaccurate. Remaining repair: Store only a hashed expiring invitation token, lock/compare-and-swap atomic consumption, validate typed profile fields and store one consistent object representation; audit and mask statutory data.
- R40 (open; PAY-07): Salary preview and assignment ignore configured amount rules. Remaining repair: Define and validate the documented amount_rule grammar and CTC anchors; use one assembler for preview and assignment. Reject missing rules rather than fabricate pay. Add real persisted-structure preview/assignment tests with explicit approved amounts.

### SOW-130 — original spreadsheet row 130

**Payroll & compliance / 5.6 Process for New Joiners:**

New joiner details for the purpose of ESI IP generation need to be provided by the client once in a week. Flexi would be activated for new joiners after the first month payroll is processed.

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** PAY-10, LC-02

**Historical implementation evidence:** Weekly ESI IP creation and flexi activation timing are vendor operating terms.

**Remaining scope from full crosswalk:** Assign an owner and record weekly submission/portal proof. Any flexi activation feature still needs the pending payroll/benefit implementation.

**Execution cards:** F02, P01, P03, P06, L01, D01, D10, M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.companies, core.cost_centers, core.departments, core.designations, core.documents, core.employee_assignments, core.employee_education, core.employee_family, core.employee_history, core.employee_prev_employment, core.employees, core.grades, core.import_batches, core.locations, core.mis_codes, core.onboarding_candidates, core.onboarding_tasks, core.org_units, core.plants, core.prejoin_invitations, core.probation_reviews, core.profile_change_requests, core.reporting_tree, core.source_mappings, pay.budget_categories, pay.budgets, pay.claim_bills, pay.claim_entitlements, pay.claim_lines, pay.claim_reservations, pay.claim_types, pay.claims, pay.employee_salaries, pay.investment_declarations, pay.it_slabs, pay.output_artifacts, pay.payment_obligations, pay.previous_employer_income, pay.pt_slabs, pay.salary_components, pay.salary_structure_versions, pay.salary_structures, pay.source_consumptions, pay.statutory_memberships, pay.statutory_postings, pay.statutory_rates, pay.tax_elections, pay.tds_challans

**Current reviewed issues:**

- R05 (open; PAY-10): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R18 (open; LC-02): Onboarding conversion is not atomic and creates unusable salary/login. Remaining repair: Use the existing validated employee/e-code/salary/auth public APIs inside one owned transaction. Resolve mandatory master links and actual salary breakup, candidate consumption key, welcome credentials/grants and outbox tasks.
- R36 (open; LC-02): Biometric verification stamps evidence without checking Kent. Remaining repair: Separate human-confirmed versus connector-confirmed evidence, retain actor/source receipt and wire approved scheduled reminder/escalation jobs; do not manufacture integration proof.

### SOW-132 — original spreadsheet row 132

**Payroll & compliance / ESS portal would be activated for new joiners**

When client approves new joiner inputs via client portal

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LC-02, PAY-07, NFR-03

**Historical implementation evidence:** Seed import can create a login when source email/password hash is present.

**Remaining scope from full crosswalk:** Implement rule-driven new-joiner ESS activation on approved intake/first payroll/connector interval; verify access lifecycle.

**Execution cards:** P02, P06, L01, D10

**Database connections:** att.month_locks, att.overtime_entries, core.documents, core.employee_assignments, core.employees, core.onboarding_candidates, core.onboarding_tasks, core.prejoin_invitations, core.source_mappings, pay.arrears, pay.budget_categories, pay.budgets, pay.claim_bills, pay.claim_entitlements, pay.claim_lines, pay.claim_reservations, pay.claim_types, pay.claims, pay.employee_salaries, pay.inputs, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions

**Current reviewed issues:**

- R18 (open; LC-02): Onboarding conversion is not atomic and creates unusable salary/login. Remaining repair: Use the existing validated employee/e-code/salary/auth public APIs inside one owned transaction. Resolve mandatory master links and actual salary breakup, candidate consumption key, welcome credentials/grants and outbox tasks.
- R35 (open; NFR-03): Prejoin single-use and at-rest token claims are inaccurate. Remaining repair: Store only a hashed expiring invitation token, lock/compare-and-swap atomic consumption, validate typed profile fields and store one consistent object representation; audit and mask statutory data.
- R36 (open; LC-02): Biometric verification stamps evidence without checking Kent. Remaining repair: Separate human-confirmed versus connector-confirmed evidence, retain actor/source receipt and wire approved scheduled reminder/escalation jobs; do not manufacture integration proof.
- R40 (open; PAY-07): Salary preview and assignment ignore configured amount rules. Remaining repair: Define and validate the documented amount_rule grammar and CTC anchors; use one assembler for preview and assignment. Reject missing rules rather than fabricate pay. Add real persisted-structure preview/assignment tests with explicit approved amounts.

### SOW-133 — original spreadsheet row 133

**Payroll & compliance / ESS portal would be activated for new joiners**

After first month payroll is processed if inputs are provided through excel format

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LC-02, PAY-07, NFR-03

**Historical implementation evidence:** Seed import can create a login when source email/password hash is present.

**Remaining scope from full crosswalk:** Implement rule-driven new-joiner ESS activation on approved intake/first payroll/connector interval; verify access lifecycle.

**Execution cards:** P02, P06, L01, D10

**Database connections:** att.month_locks, att.overtime_entries, core.documents, core.employee_assignments, core.employees, core.onboarding_candidates, core.onboarding_tasks, core.prejoin_invitations, core.source_mappings, pay.arrears, pay.budget_categories, pay.budgets, pay.claim_bills, pay.claim_entitlements, pay.claim_lines, pay.claim_reservations, pay.claim_types, pay.claims, pay.employee_salaries, pay.inputs, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions

**Current reviewed issues:**

- R18 (open; LC-02): Onboarding conversion is not atomic and creates unusable salary/login. Remaining repair: Use the existing validated employee/e-code/salary/auth public APIs inside one owned transaction. Resolve mandatory master links and actual salary breakup, candidate consumption key, welcome credentials/grants and outbox tasks.
- R35 (open; NFR-03): Prejoin single-use and at-rest token claims are inaccurate. Remaining repair: Store only a hashed expiring invitation token, lock/compare-and-swap atomic consumption, validate typed profile fields and store one consistent object representation; audit and mask statutory data.
- R36 (open; LC-02): Biometric verification stamps evidence without checking Kent. Remaining repair: Separate human-confirmed versus connector-confirmed evidence, retain actor/source receipt and wire approved scheduled reminder/escalation jobs; do not manufacture integration proof.
- R40 (open; PAY-07): Salary preview and assignment ignore configured amount rules. Remaining repair: Define and validate the documented amount_rule grammar and CTC anchors; use one assembler for preview and assignment. Reject missing rules rather than fabricate pay. Add real persisted-structure preview/assignment tests with explicit approved amounts.

### SOW-134 — original spreadsheet row 134

**Payroll & compliance / ESS portal would be activated for new joiners**

At agreed interval if new joiner information is provided via HR connector

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** LC-02, PAY-07, NFR-03

**Historical implementation evidence:** Seed import can create a login when source email/password hash is present.

**Remaining scope from full crosswalk:** Implement rule-driven new-joiner ESS activation on approved intake/first payroll/connector interval; verify access lifecycle.

**Execution cards:** P02, P06, L01, R01, D10

**Database connections:** att.month_locks, att.overtime_entries, core.documents, core.employee_assignments, core.employees, core.onboarding_candidates, core.onboarding_tasks, core.prejoin_invitations, core.source_mappings, pay.arrears, pay.budget_categories, pay.budgets, pay.claim_bills, pay.claim_entitlements, pay.claim_lines, pay.claim_reservations, pay.claim_types, pay.claims, pay.employee_salaries, pay.inputs, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions, recruit.candidates, recruit.offers, recruit.vacancies

**Current reviewed issues:**

- R18 (open; LC-02): Onboarding conversion is not atomic and creates unusable salary/login. Remaining repair: Use the existing validated employee/e-code/salary/auth public APIs inside one owned transaction. Resolve mandatory master links and actual salary breakup, candidate consumption key, welcome credentials/grants and outbox tasks.
- R35 (open; NFR-03): Prejoin single-use and at-rest token claims are inaccurate. Remaining repair: Store only a hashed expiring invitation token, lock/compare-and-swap atomic consumption, validate typed profile fields and store one consistent object representation; audit and mask statutory data.
- R36 (open; LC-02): Biometric verification stamps evidence without checking Kent. Remaining repair: Separate human-confirmed versus connector-confirmed evidence, retain actor/source receipt and wire approved scheduled reminder/escalation jobs; do not manufacture integration proof.
- R40 (open; PAY-07): Salary preview and assignment ignore configured amount rules. Remaining repair: Define and validate the documented amount_rule grammar and CTC anchors; use one assembler for preview and assignment. Reject missing rules rather than fabricate pay. Add real persisted-structure preview/assignment tests with explicit approved amounts.

### SOW-136 — original spreadsheet row 136

**Payroll & compliance / 5.7– Process for Salary hold and release**

Scenario 1 (Payment hold) - To hold payment of any specific salary(s) vendor will process salary as instructed by the Rashmi Metaliks Limited. The salary transfer details in bank file will be removed. All statutory payments (PF, PT, ESI, LWF) would be remitted normally. In order to release the salary, Protiviti implant should add the net pay value of the employee as part of respective month's input

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-08

**Historical implementation evidence:** Salary hold scenarios are documented only.

**Remaining scope from full crosswalk:** Build the exact payment-hold/process-hold behavior, statutory continuity, bank exclusions, releases and LOP reversals.

**Execution cards:** P02, P04, L05, D10

**Database connections:** att.month_locks, att.overtime_entries, core.clearances, core.documents, core.letters, core.separations, lv.ledger, pay.arrears, pay.bank_batch_lines, pay.bank_batches, pay.fnf_settlements, pay.gl_accounts, pay.inputs, pay.journal_batches, pay.journal_lines, pay.output_artifacts, pay.payment_events, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions

**Current reviewed issues:**

- R06 (partial-repair-verified; PAY-08): Recovery inputs print but do not reduce net pay. Remaining repair: Classify input and arrear effects by component kind, validate allowed amounts and update earning/deduction/employer bases consistently. Add an independent full-run recovery fixture.

### SOW-137 — original spreadsheet row 137

**Payroll & compliance / 5.7– Process for Salary hold and release**

Scenario 2 (Process hold) - To hold processing of any specific salary(s) for absconding employees, etc., the Protiviti should include full month LOP input for this employee until the defined date. If the defined date is not known, Protiviti to give LOP input month on month. In order to release the salary, Protiviti should provide LOP reversal inputs in the respective month of release.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-08

**Historical implementation evidence:** Salary hold scenarios are documented only.

**Remaining scope from full crosswalk:** Build the exact payment-hold/process-hold behavior, statutory continuity, bank exclusions, releases and LOP reversals.

**Execution cards:** P02, L05, D10

**Database connections:** att.month_locks, att.overtime_entries, core.clearances, core.letters, core.separations, lv.ledger, pay.arrears, pay.fnf_settlements, pay.inputs, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions

**Current reviewed issues:**

- R06 (partial-repair-verified; PAY-08): Recovery inputs print but do not reduce net pay. Remaining repair: Classify input and arrear effects by component kind, validate allowed amounts and update earning/deduction/employer bases consistently. Add an independent full-run recovery fixture.

### SOW-139 — original spreadsheet row 139

**Payroll & compliance / 5.8 Additional General Scope:**

Vendor would provide documentation support for any internal Audits and third-party requirements

**Current:** Blocked by reviewed defects. **Historical baseline:** Partial.

**Requirement references:** CORE-11, RPT-06, PAY-18

**Historical implementation evidence:** Append-only audit and several exports exist.

**Remaining scope from full crosswalk:** Complete payroll audit records/evidence and document actual internal/third-party audit support. Source code is not proof of vendor service delivery.

**Execution cards:** F01, F04, A05, P04, W04, D12

**Database connections:** ast.assets, ast.assignments, ast.maintenance, att.absence_cases, att.coverage_targets, att.day_records, att.device_watermarks, att.devices, att.employee_shifts, att.holidays, att.ingest_watermarks, att.leave_blackouts, att.manager_month_approvals, att.month_locks, att.overtime_entries, att.quarantined_swipes, att.recompute_queue, att.regularizations, att.roster_publications, att.roster_revisions, att.rosters, att.shift_patterns, att.shift_swaps, att.shifts, att.swipe_events, cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.audit_log, core.companies, core.cost_centers, core.departments, core.designations, core.document_operations, core.documents, core.employee_assignments, core.employee_family, core.employee_history, core.employees, core.grades, core.letter_templates, core.letters, core.locations, core.mis_codes, core.org_units, core.password_reset_tokens, core.permissions, core.plants, core.policies, core.policy_acknowledgments, core.profile_change_requests, core.reporting_tree, core.role_permissions, core.roles, core.settings, core.user_roles, core.users, doc.types, eng.announcements, eng.poll_responses, eng.polls, hd.categories, hd.ticket_messages, hd.tickets, ird.grievances, ird.ic_members, ird.posh_case_access_log, ird.posh_cases, ird.whistleblower_reports, lv.applications, lv.leave_types, lv.ledger, lv.restricted_holidays, lv.rh_selections, pay.bank_batch_lines, pay.bank_batches, pay.budget_categories, pay.budgets, pay.claim_lines, pay.claim_reservations, pay.claim_types, pay.claims, pay.gl_accounts, pay.journal_batches, pay.journal_lines, pay.output_artifacts, pay.payment_events, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.source_consumptions, prv.breach_register, prv.consent_events, prv.consents, prv.legal_holds, prv.notice_acks, prv.notices, prv.processing_register, prv.processors, prv.purge_log, prv.purge_proposals, prv.retention_rules, prv.rights_requests, reporting.kpi_daily, reporting.muster_month, reporting.snapshot_builds, sec.access_events, sec.mfa_enrolments, sec.mfa_recovery_codes, sec.password_history, sec.sessions, wf.definitions, wf.delegations, wf.event_subscriptions, wf.notification_attempts, wf.notifications, wf.request_steps, wf.requests

**Current reviewed issues:**

- R17 (open; CORE-11): F&F can mark paid and issue letters without approval/payment. Remaining repair: Implement approved immutable settlement->payment obligation->verified receipt transitions, with maker/checker, idempotency, audit/outbox and atomic exit/letter release. Do not label queued payouts paid.
- R34 (open; RPT-06): SAP mapping loses legal payer and cost-center dimensions. Remaining repair: Use the approved scoped GL mapping keys from the canonical table, fail missing/ambiguous mappings and reconcile exact balanced amounts from frozen placement/result versions.
- R37 (open; CORE-11): Completed-stage and UAT labels exceed verified behavior. Remaining repair: Retain work credit but reopen failed acceptance items; attach dated signed evidence for any external/UAT/legal claim. Never infer proof from a checked box.
- R44 (partial-repair-verified; RPT-06): Parallel comparison drops repeated lines of the same component. Remaining repair: Sum all signed component facts in integer paise per employee/component. Corrected shared component aggregation is now used by the real comparison; durable complete-population two-cycle/sign-off gates remain open under R29.
- R45 (partial-repair-verified; RPT-06): Numeric SOW citations in phase plans and backend comments do not identify the original requirements. Remaining repair: Regenerate phase tables from the exact original crosswalk, preserve requirement IDs, and replace unverified numeric references in backend comments. Done for backend comments and Phase2/3 maps; source-doc section labels and remaining frontend annotations require separate context validation.

### SOW-140 — original spreadsheet row 140

**Payroll & compliance / 5.8 Additional General Scope:**

Any data / reports requirement to support audit needs to be shared in advance with vendor and turnaround time to deliver will be mutually agreed.

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** SOW-5.8 service term

**Historical implementation evidence:** Advance report notice/turnaround agreement is an operating clause.

**Remaining scope from full crosswalk:** Record requested report, agreed turnaround and delivery evidence with responsible HR/payroll owner.

**Execution cards:** M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.documents, pay.output_artifacts

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-141 — original spreadsheet row 141

**Payroll & compliance / 5.8 Additional General Scope:**

Payroll processing for Interns / Trainees and apply statutory contributions (including tax) as applicable.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-14, CORE-05

**Historical implementation evidence:** Trainee/category flags exist; stipend payroll does not.

**Remaining scope from full crosswalk:** Build trainee/apprentice payroll and explicit applicability rules. Resolve SOW blanket statutory exclusion against doc 10 §9 before implementation.

**Execution cards:** P01, P02, P03, D01

**Database connections:** att.month_locks, att.overtime_entries, core.employee_assignments, core.probation_reviews, pay.arrears, pay.employee_salaries, pay.inputs, pay.investment_declarations, pay.it_slabs, pay.output_artifacts, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.previous_employer_income, pay.pt_slabs, pay.run_input_refs, pay.salary_components, pay.salary_holds, pay.salary_structure_versions, pay.salary_structures, pay.source_consumptions, pay.statutory_memberships, pay.statutory_postings, pay.statutory_rates, pay.tax_elections, pay.tds_challans

**Current reviewed issues:**

- R05 (open; PAY-14): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.

### SOW-142 — original spreadsheet row 142

**Payroll & compliance / 5.8 Additional General Scope:**

Payroll processing for Apprentice as per the Apprenticeship act without any statutory deduction.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-14, CORE-05

**Historical implementation evidence:** Trainee/category flags exist; stipend payroll does not.

**Remaining scope from full crosswalk:** Build trainee/apprentice payroll and explicit applicability rules. Resolve SOW blanket statutory exclusion against doc 10 §9 before implementation.

**Execution cards:** P01, P02, P03, D01

**Database connections:** att.month_locks, att.overtime_entries, core.employee_assignments, core.probation_reviews, pay.arrears, pay.employee_salaries, pay.inputs, pay.investment_declarations, pay.it_slabs, pay.output_artifacts, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.previous_employer_income, pay.pt_slabs, pay.run_input_refs, pay.salary_components, pay.salary_holds, pay.salary_structure_versions, pay.salary_structures, pay.source_consumptions, pay.statutory_memberships, pay.statutory_postings, pay.statutory_rates, pay.tax_elections, pay.tds_challans

**Current reviewed issues:**

- R05 (open; PAY-14): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.

### SOW-143 — original spreadsheet row 143

**Payroll & compliance / 5.8 Additional General Scope:**

Additional ad hoc/On Demand reports can be provided by vendor subject to feasibility. Timeline to build the report and commercials to be mutually agreed.

**Current:** Scope decision pending. **Historical baseline:** Scope decision.

**Requirement references:** RPT-06; SOW-5.8 service term

**Historical implementation evidence:** Fixed specified reports exist; no general ad-hoc report builder.

**Remaining scope from full crosswalk:** Agree each additional report, columns, feasibility and service/commercial terms. This clause does not authorize inventing a report-builder scope.

**Execution cards:** W04, D08

**Database connections:** core.employee_assignments, pay.payroll_item_lines, pay.payroll_items, pay.source_consumptions, reporting.kpi_daily, reporting.muster_month, reporting.snapshot_builds

**Current reviewed issues:**

- R34 (open; RPT-06): SAP mapping loses legal payer and cost-center dimensions. Remaining repair: Use the approved scoped GL mapping keys from the canonical table, fail missing/ambiguous mappings and reconcile exact balanced amounts from frozen placement/result versions.
- R44 (partial-repair-verified; RPT-06): Parallel comparison drops repeated lines of the same component. Remaining repair: Sum all signed component facts in integer paise per employee/component. Corrected shared component aggregation is now used by the real comparison; durable complete-population two-cycle/sign-off gates remain open under R29.
- R45 (partial-repair-verified; RPT-06): Numeric SOW citations in phase plans and backend comments do not identify the original requirements. Remaining repair: Regenerate phase tables from the exact original crosswalk, preserve requirement IDs, and replace unverified numeric references in backend comments. Done for backend comments and Phase2/3 maps; source-doc section labels and remaining frontend annotations require separate context validation.

### SOW-145 — original spreadsheet row 145

**Payroll & compliance / 5.9 Payroll Compliance & Statutory Reporting**

Monthly Income TDS deductions and tax reporting

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-13

**Historical implementation evidence:** TDS/declaration/24Q/Form16/challan reconciliation are specified.

**Remaining scope from full crosswalk:** Build TDS calculations and row-specific output/reconciliation; confirm coverage beyond source note white collars. Humans file portal outputs.

**Execution cards:** P03, D01

**Database connections:** pay.investment_declarations, pay.it_slabs, pay.output_artifacts, pay.previous_employer_income, pay.pt_slabs, pay.statutory_memberships, pay.statutory_postings, pay.statutory_rates, pay.tax_elections, pay.tds_challans

**Current reviewed issues:**

- R05 (open; PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.

### SOW-146 — original spreadsheet row 146

**Payroll & compliance / 5.9 Payroll Compliance & Statutory Reporting**

Quarterly filings (Form 24Q) & Annual Form 16 generation

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-13

**Historical implementation evidence:** TDS/declaration/24Q/Form16/challan reconciliation are specified.

**Remaining scope from full crosswalk:** Build TDS calculations and row-specific output/reconciliation; confirm coverage beyond source note white collars. Humans file portal outputs.

**Execution cards:** P03, D01

**Database connections:** pay.investment_declarations, pay.it_slabs, pay.output_artifacts, pay.previous_employer_income, pay.pt_slabs, pay.statutory_memberships, pay.statutory_postings, pay.statutory_rates, pay.tax_elections, pay.tds_challans

**Current reviewed issues:**

- R05 (open; PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.

### SOW-147 — original spreadsheet row 147

**Payroll & compliance / 5.9 Payroll Compliance & Statutory Reporting**

Reconciliation of tax deductions vs. paid challans

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-13

**Historical implementation evidence:** TDS/declaration/24Q/Form16/challan reconciliation are specified.

**Remaining scope from full crosswalk:** Build TDS calculations and row-specific output/reconciliation; confirm coverage beyond source note white collars. Humans file portal outputs.

**Execution cards:** P03, P04, D01

**Database connections:** core.documents, pay.bank_batch_lines, pay.bank_batches, pay.gl_accounts, pay.investment_declarations, pay.it_slabs, pay.journal_batches, pay.journal_lines, pay.output_artifacts, pay.payment_events, pay.payment_obligations, pay.previous_employer_income, pay.pt_slabs, pay.statutory_memberships, pay.statutory_postings, pay.statutory_rates, pay.tax_elections, pay.tds_challans

**Current reviewed issues:**

- R05 (open; PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.

### SOW-149 — original spreadsheet row 149

**Payroll & compliance / 5.10 Provident Fund – In Scope**

UAN generation & KYC updating.

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** PAY-09; statutory operations

**Historical implementation evidence:** These are government-portal updates, claims, inspection assistance or legislative-monitoring services. No service completion evidence was audited.

**Remaining scope from full crosswalk:** Assign compliance owner and retain portal acknowledgment/claim/notice evidence. HRMS file generation does not discharge these human duties.

**Execution cards:** M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.documents, pay.output_artifacts

**Current reviewed issues:**

- R05 (open; PAY-09): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.

### SOW-150 — original spreadsheet row 150

**Payroll & compliance / 5.10 Provident Fund – In Scope**

PF challan & return filing

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-09

**Historical implementation evidence:** PF register/ECR generation is specified, not implemented.

**Remaining scope from full crosswalk:** Build PF/ECR output and acceptance checks; named compliance owner uploads/pays and retains challan/return acknowledgment.

**Execution cards:** P03, P04, D01

**Database connections:** core.documents, pay.bank_batch_lines, pay.bank_batches, pay.gl_accounts, pay.investment_declarations, pay.it_slabs, pay.journal_batches, pay.journal_lines, pay.output_artifacts, pay.payment_events, pay.payment_obligations, pay.previous_employer_income, pay.pt_slabs, pay.statutory_memberships, pay.statutory_postings, pay.statutory_rates, pay.tax_elections, pay.tds_challans

**Current reviewed issues:**

- R05 (open; PAY-09): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.

### SOW-151 — original spreadsheet row 151

**Payroll & compliance / 5.10 Provident Fund – In Scope**

Inspection support & statutory queries resolution.is received in the mobile number registered in the EPFO Portal

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** PAY-09; statutory operations

**Historical implementation evidence:** These are government-portal updates, claims, inspection assistance or legislative-monitoring services. No service completion evidence was audited.

**Remaining scope from full crosswalk:** Assign compliance owner and retain portal acknowledgment/claim/notice evidence. HRMS file generation does not discharge these human duties.

**Execution cards:** M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.documents, pay.output_artifacts

**Current reviewed issues:**

- R05 (open; PAY-09): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.

### SOW-152 — original spreadsheet row 152

**Payroll & compliance / 5.10 Provident Fund – In Scope**

EDLI Returns (Form 7IF) 

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** PAY-09; statutory operations

**Historical implementation evidence:** These are government-portal updates, claims, inspection assistance or legislative-monitoring services. No service completion evidence was audited.

**Remaining scope from full crosswalk:** Assign compliance owner and retain portal acknowledgment/claim/notice evidence. HRMS file generation does not discharge these human duties.

**Execution cards:** D01, M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.documents, pay.output_artifacts

**Current reviewed issues:**

- R05 (open; PAY-09): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.

### SOW-153 — original spreadsheet row 153

**Payroll & compliance / 5.10 Provident Fund – In Scope**

Date of Leaving updating – Date of leaving and the reason for leaving will be updated in the EPFO portal by Protiviti

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** PAY-09; statutory operations

**Historical implementation evidence:** These are government-portal updates, claims, inspection assistance or legislative-monitoring services. No service completion evidence was audited.

**Remaining scope from full crosswalk:** Assign compliance owner and retain portal acknowledgment/claim/notice evidence. HRMS file generation does not discharge these human duties.

**Execution cards:** L04, M01

**Database connections:** ast.assignments, ast.custody_events, cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.clearances, core.documents, core.separations, pay.claims, pay.loan_postings, pay.loans, pay.output_artifacts, te.advances, te.wallet_postings

**Current reviewed issues:**

- R05 (open; PAY-09): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.

### SOW-154 — original spreadsheet row 154

**Payroll & compliance / 5.10 Provident Fund – In Scope**

Form 5A updating (Ownership Details)

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** PAY-09; statutory operations

**Historical implementation evidence:** These are government-portal updates, claims, inspection assistance or legislative-monitoring services. No service completion evidence was audited.

**Remaining scope from full crosswalk:** Assign compliance owner and retain portal acknowledgment/claim/notice evidence. HRMS file generation does not discharge these human duties.

**Execution cards:** M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.documents, pay.output_artifacts

**Current reviewed issues:**

- R05 (open; PAY-09): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.

### SOW-155 — original spreadsheet row 155

**Payroll & compliance / 5.10 Provident Fund – In Scope**

Modify Establishment Details

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** PAY-09; statutory operations

**Historical implementation evidence:** These are government-portal updates, claims, inspection assistance or legislative-monitoring services. No service completion evidence was audited.

**Remaining scope from full crosswalk:** Assign compliance owner and retain portal acknowledgment/claim/notice evidence. HRMS file generation does not discharge these human duties.

**Execution cards:** M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.documents, pay.output_artifacts

**Current reviewed issues:**

- R05 (open; PAY-09): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.

### SOW-156 — original spreadsheet row 156

**Payroll & compliance / 5.10 Provident Fund – In Scope**

Joint Declaration Submission

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** PAY-09; statutory operations

**Historical implementation evidence:** These are government-portal updates, claims, inspection assistance or legislative-monitoring services. No service completion evidence was audited.

**Remaining scope from full crosswalk:** Assign compliance owner and retain portal acknowledgment/claim/notice evidence. HRMS file generation does not discharge these human duties.

**Execution cards:** M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.documents, pay.output_artifacts

**Current reviewed issues:**

- R05 (open; PAY-09): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.

### SOW-157 — original spreadsheet row 157

**Payroll & compliance / 5.10 Provident Fund – In Scope**

Death Claim Submission

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** PAY-09; statutory operations

**Historical implementation evidence:** These are government-portal updates, claims, inspection assistance or legislative-monitoring services. No service completion evidence was audited.

**Remaining scope from full crosswalk:** Assign compliance owner and retain portal acknowledgment/claim/notice evidence. HRMS file generation does not discharge these human duties.

**Execution cards:** M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.documents, pay.output_artifacts

**Current reviewed issues:**

- R05 (open; PAY-09): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.

### SOW-158 — original spreadsheet row 158

**Payroll & compliance / 5.10 Provident Fund – In Scope**

Support in case of claim rejection by the EPFO

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** PAY-09; statutory operations

**Historical implementation evidence:** These are government-portal updates, claims, inspection assistance or legislative-monitoring services. No service completion evidence was audited.

**Remaining scope from full crosswalk:** Assign compliance owner and retain portal acknowledgment/claim/notice evidence. HRMS file generation does not discharge these human duties.

**Execution cards:** M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.documents, pay.output_artifacts

**Current reviewed issues:**

- R05 (open; PAY-09): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.

### SOW-159 — original spreadsheet row 159

**Payroll & compliance / 5.10 Provident Fund – In Scope**

Inspection Assistance / Response to the Notices

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** PAY-09; statutory operations

**Historical implementation evidence:** These are government-portal updates, claims, inspection assistance or legislative-monitoring services. No service completion evidence was audited.

**Remaining scope from full crosswalk:** Assign compliance owner and retain portal acknowledgment/claim/notice evidence. HRMS file generation does not discharge these human duties.

**Execution cards:** M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.documents, pay.output_artifacts

**Current reviewed issues:**

- R05 (open; PAY-09): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.

### SOW-160 — original spreadsheet row 160

**Payroll & compliance / 5.10 Provident Fund – In Scope**

Legislative Notification / Amendments

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** PAY-09; statutory operations

**Historical implementation evidence:** These are government-portal updates, claims, inspection assistance or legislative-monitoring services. No service completion evidence was audited.

**Remaining scope from full crosswalk:** Assign compliance owner and retain portal acknowledgment/claim/notice evidence. HRMS file generation does not discharge these human duties.

**Execution cards:** P03, D01, M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.documents, pay.investment_declarations, pay.it_slabs, pay.output_artifacts, pay.previous_employer_income, pay.pt_slabs, pay.statutory_memberships, pay.statutory_postings, pay.statutory_rates, pay.tax_elections, pay.tds_challans

**Current reviewed issues:**

- R05 (open; PAY-09): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.

### SOW-162 — original spreadsheet row 162

**Payroll & compliance / 5.10 Employee State Insurance (ESIC) Compliance:**

IP number generation, e-Pehchan card issuance.

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** PAY-10; statutory operations

**Historical implementation evidence:** These involve ESIC portal registration/cards/returns, family updates, paid challans or office corrections.

**Remaining scope from full crosswalk:** Assign HR/compliance owner and retain actual portal/office receipts. Master family schema is not proof of ESIC portal submission.

**Execution cards:** M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.documents, pay.output_artifacts

**Current reviewed issues:**

- R05 (open; PAY-10): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.

### SOW-163 — original spreadsheet row 163

**Payroll & compliance / 5.10 Employee State Insurance (ESIC) Compliance:**

ESIC contributions reporting & challan generation

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-10

**Historical implementation evidence:** ESIC reporting/file generation is specified.

**Remaining scope from full crosswalk:** Build contribution-period engine and return/challan data export; human creates/remits portal challan and records proof.

**Execution cards:** P03, P04, D01

**Database connections:** core.documents, pay.bank_batch_lines, pay.bank_batches, pay.gl_accounts, pay.investment_declarations, pay.it_slabs, pay.journal_batches, pay.journal_lines, pay.output_artifacts, pay.payment_events, pay.payment_obligations, pay.previous_employer_income, pay.pt_slabs, pay.statutory_memberships, pay.statutory_postings, pay.statutory_rates, pay.tax_elections, pay.tds_challans

**Current reviewed issues:**

- R05 (open; PAY-10): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.

### SOW-164 — original spreadsheet row 164

**Payroll & compliance / 5.10 Employee State Insurance (ESIC) Compliance:**

ESIC half-yearly submission & compliance audits

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** PAY-10; statutory operations

**Historical implementation evidence:** These involve ESIC portal registration/cards/returns, family updates, paid challans or office corrections.

**Remaining scope from full crosswalk:** Assign HR/compliance owner and retain actual portal/office receipts. Master family schema is not proof of ESIC portal submission.

**Execution cards:** D01, M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.documents, pay.output_artifacts

**Current reviewed issues:**

- R05 (open; PAY-10): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.

### SOW-165 — original spreadsheet row 165

**Payroll & compliance / 5.10 Employee State Insurance (ESIC) Compliance:**

Updating of family members details

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** PAY-10; statutory operations

**Historical implementation evidence:** These involve ESIC portal registration/cards/returns, family updates, paid challans or office corrections.

**Remaining scope from full crosswalk:** Assign HR/compliance owner and retain actual portal/office receipts. Master family schema is not proof of ESIC portal submission.

**Execution cards:** M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.documents, pay.output_artifacts

**Current reviewed issues:**

- R05 (open; PAY-10): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.

### SOW-166 — original spreadsheet row 166

**Payroll & compliance / 5.10 Employee State Insurance (ESIC) Compliance:**

Sharing ESIC Remitted Challan – Once the payment is made, Rashmi Metaliks Limited to download the paid challan from the ESIC Portal.

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** PAY-10; statutory operations

**Historical implementation evidence:** These involve ESIC portal registration/cards/returns, family updates, paid challans or office corrections.

**Remaining scope from full crosswalk:** Assign HR/compliance owner and retain actual portal/office receipts. Master family schema is not proof of ESIC portal submission.

**Execution cards:** M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.documents, pay.output_artifacts

**Current reviewed issues:**

- R05 (open; PAY-10): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.

### SOW-167 — original spreadsheet row 167

**Payroll & compliance / 5.10 Employee State Insurance (ESIC) Compliance:**

Documents Submission to ESIC Office for Employee Name, DOJ & Gender Correction (Protiviti Presence location)

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** PAY-10; statutory operations

**Historical implementation evidence:** These involve ESIC portal registration/cards/returns, family updates, paid challans or office corrections.

**Remaining scope from full crosswalk:** Assign HR/compliance owner and retain actual portal/office receipts. Master family schema is not proof of ESIC portal submission.

**Execution cards:** M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.documents, pay.output_artifacts

**Current reviewed issues:**

- R05 (open; PAY-10): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.

### SOW-168 — original spreadsheet row 168

**Payroll & compliance / 5.10 Employee State Insurance (ESIC) Compliance:**

Updating of Employer Details (Company Name, Address)

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** PAY-10; statutory operations

**Historical implementation evidence:** These involve ESIC portal registration/cards/returns, family updates, paid challans or office corrections.

**Remaining scope from full crosswalk:** Assign HR/compliance owner and retain actual portal/office receipts. Master family schema is not proof of ESIC portal submission.

**Execution cards:** M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.documents, pay.output_artifacts

**Current reviewed issues:**

- R05 (open; PAY-10): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.

### SOW-170 — original spreadsheet row 170

**Payroll & compliance / 5.10 Professional Tax (PT) Compliance:**

PT computation, reporting & online remittance support

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-11

**Historical implementation evidence:** PT computation/register is specified.

**Remaining scope from full crosswalk:** Build configured PT engine/report; named compliance owner handles online remittance and proof.

**Execution cards:** P03, P04, D01

**Database connections:** core.documents, pay.bank_batch_lines, pay.bank_batches, pay.gl_accounts, pay.investment_declarations, pay.it_slabs, pay.journal_batches, pay.journal_lines, pay.output_artifacts, pay.payment_events, pay.payment_obligations, pay.previous_employer_income, pay.pt_slabs, pay.statutory_memberships, pay.statutory_postings, pay.statutory_rates, pay.tax_elections, pay.tds_challans

**Current reviewed issues:**

- R42 (open; PAY-11): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.

### SOW-171 — original spreadsheet row 171

**Payroll & compliance / 5.10 Professional Tax (PT) Compliance:**

PT enrollment & renewal processing

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** PAY-11; statutory operations

**Historical implementation evidence:** Enrollment, establishment tax/payment, acknowledged challans and notice support are human/service activities.

**Remaining scope from full crosswalk:** Confirm legal entity owner and retain enrollment/return/payment/notice evidence. Do not treat historical 100% as current completion.

**Execution cards:** M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.documents, pay.output_artifacts

**Current reviewed issues:**

- R42 (open; PAY-11): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.

### SOW-172 — original spreadsheet row 172

**Payroll & compliance / 5.10 Professional Tax (PT) Compliance:**

PT - Enrolment Certificate - Remittance

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** PAY-11; statutory operations

**Historical implementation evidence:** Enrollment, establishment tax/payment, acknowledged challans and notice support are human/service activities.

**Remaining scope from full crosswalk:** Confirm legal entity owner and retain enrollment/return/payment/notice evidence. Do not treat historical 100% as current completion.

**Execution cards:** M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.documents, pay.output_artifacts

**Current reviewed issues:**

- R42 (open; PAY-11): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.

### SOW-173 — original spreadsheet row 173

**Payroll & compliance / 5.10 Professional Tax (PT) Compliance:**

PT - Enrolment Certificate - Returns

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** PAY-11; statutory operations

**Historical implementation evidence:** Enrollment, establishment tax/payment, acknowledged challans and notice support are human/service activities.

**Remaining scope from full crosswalk:** Confirm legal entity owner and retain enrollment/return/payment/notice evidence. Do not treat historical 100% as current completion.

**Execution cards:** M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.documents, pay.output_artifacts

**Current reviewed issues:**

- R42 (open; PAY-11): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.

### SOW-174 — original spreadsheet row 174

**Payroll & compliance / 5.10 Professional Tax (PT) Compliance:**

Company Tax Remittance

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** PAY-11; statutory operations

**Historical implementation evidence:** Enrollment, establishment tax/payment, acknowledged challans and notice support are human/service activities.

**Remaining scope from full crosswalk:** Confirm legal entity owner and retain enrollment/return/payment/notice evidence. Do not treat historical 100% as current completion.

**Execution cards:** M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.documents, pay.output_artifacts

**Current reviewed issues:**

- R42 (open; PAY-11): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.

### SOW-175 — original spreadsheet row 175

**Payroll & compliance / 5.10 Professional Tax (PT) Compliance:**

Sharing remitted /acknowledged challans

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** PAY-11; statutory operations

**Historical implementation evidence:** Enrollment, establishment tax/payment, acknowledged challans and notice support are human/service activities.

**Remaining scope from full crosswalk:** Confirm legal entity owner and retain enrollment/return/payment/notice evidence. Do not treat historical 100% as current completion.

**Execution cards:** P04, M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.documents, pay.bank_batch_lines, pay.bank_batches, pay.gl_accounts, pay.journal_batches, pay.journal_lines, pay.output_artifacts, pay.payment_events, pay.payment_obligations

**Current reviewed issues:**

- R42 (open; PAY-11): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.

### SOW-176 — original spreadsheet row 176

**Payroll & compliance / 5.10 Professional Tax (PT) Compliance:**

Inspection Assistance / Response to the Notices

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** PAY-11; statutory operations

**Historical implementation evidence:** Enrollment, establishment tax/payment, acknowledged challans and notice support are human/service activities.

**Remaining scope from full crosswalk:** Confirm legal entity owner and retain enrollment/return/payment/notice evidence. Do not treat historical 100% as current completion.

**Execution cards:** M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.documents, pay.output_artifacts

**Current reviewed issues:**

- R42 (open; PAY-11): Configured PT slabs are accepted by the compute interface but never used. Remaining repair: Pass authoritative effective-dated slab facts to the shared PT engine, reject missing applicable state policy, and test custom configured slabs through the run path. Do not infer current statutory rates from this defect review.

### SOW-178 — original spreadsheet row 178

**Payroll & compliance / 5.11 Labor Welfare Fund (LWF) Compliance**

LWF data upload, challan generation & payment facilitation

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-12

**Historical implementation evidence:** LWF register/file generation is specified.

**Remaining scope from full crosswalk:** Build LWF periodic computation/export; compliance owner performs upload/challan/payment and stores receipts.

**Execution cards:** P03, P04, D01

**Database connections:** core.documents, pay.bank_batch_lines, pay.bank_batches, pay.gl_accounts, pay.investment_declarations, pay.it_slabs, pay.journal_batches, pay.journal_lines, pay.output_artifacts, pay.payment_events, pay.payment_obligations, pay.previous_employer_income, pay.pt_slabs, pay.statutory_memberships, pay.statutory_postings, pay.statutory_rates, pay.tax_elections, pay.tds_challans

**Current reviewed issues:**

- R05 (open; PAY-12): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.

### SOW-179 — original spreadsheet row 179

**Payroll & compliance / 5.11 Labor Welfare Fund (LWF) Compliance**

LWF inspection assistance & compliance reporting

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** PAY-12; statutory operations

**Historical implementation evidence:** LWF inspection assistance is a service duty, not established by repository code.

**Remaining scope from full crosswalk:** Assign owner; retain inspection response and compliance evidence.

**Execution cards:** M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.documents, pay.output_artifacts

**Current reviewed issues:**

- R05 (open; PAY-12): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.

### SOW-181 — original spreadsheet row 181

**Payroll & compliance / 5.13 Employee Self-Service (ESS) & Support**

providing Employee Access:
  Payslips, tax computation slips, Form 16.
  Investment declarations & reimbursement claims.
  Tax calculator & helpdesk ticketing

**Current:** Blocked by reviewed defects. **Historical baseline:** Partial.

**Requirement references:** PAY-06/13, CLM-02, HD-01

**Historical implementation evidence:** Employee helpdesk and ESS shell exist.

**Remaining scope from full crosswalk:** Build payslip/tax/Form16 downloads, investment declarations, claims and tax calculator. Helpdesk ticket access also needs ownership checks.

**Execution cards:** F03, P03, P04, P06, L05, W02, W04, T02, D03

**Database connections:** core.audit_log, core.clearances, core.documents, core.employee_assignments, core.letters, core.password_reset_tokens, core.permissions, core.role_permissions, core.roles, core.separations, core.settings, core.user_roles, core.users, hd.categories, hd.escalation_rules, hd.ticket_events, hd.ticket_messages, hd.tickets, lv.ledger, pay.bank_batch_lines, pay.bank_batches, pay.budget_categories, pay.budgets, pay.claim_bills, pay.claim_entitlements, pay.claim_lines, pay.claim_reservations, pay.claim_types, pay.claims, pay.fnf_settlements, pay.gl_accounts, pay.investment_declarations, pay.it_slabs, pay.journal_batches, pay.journal_lines, pay.output_artifacts, pay.payment_events, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.previous_employer_income, pay.pt_slabs, pay.source_consumptions, pay.statutory_memberships, pay.statutory_postings, pay.statutory_rates, pay.tax_elections, pay.tds_challans, reporting.kpi_daily, reporting.muster_month, reporting.snapshot_builds, sec.sessions, te.advances, te.settlement_advances, te.settlements, te.wallet_postings, wf.notifications

**Current reviewed issues:**

- R01 (verified-fixed; CLM-02): Fresh migration chain cannot build claims schema. Remaining repair: Recover original migration sources, reconcile canonical claims/budgets through forward alterations, then prove empty up, no-op up, down/up and upgrade. Rehearse exact target16.
- R05 (open; PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R12 (open; CLM-02): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R13 (open; PAY-06): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.
- R25 (open; CLM-02): General claims cannot insert into the actual budget-owned model. Remaining repair: Preserve shared claims ownership; explicitly choose validated entitlement funding, required provenance and existing canonical lines/bills. Bind an approved seeded component and reconcile prior budget reservations.
- R27 (open; CLM-02): Entitlement policy is invented and the reservation check races. Remaining repair: Use signed effective entitlement rows, exact bucket membership and locked immutable reservation/consumption; reject unconfigured entitlement and test concurrency/period edges.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R33 (open; PAY-06): Output readiness and artifact ownership are inferred incorrectly. Remaining repair: Persist versioned per-run/payer artifacts with checksum, complete population and actual generation receipts; expose availability from those records, not approval state.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.

### SOW-182 — original spreadsheet row 182

**Payroll & compliance / 5.13 Employee Self-Service (ESS) & Support**

providing HR & Payroll SPOC Access:
  Bulk download of payroll & compliance reports.
  Employee onboarding & document management.
 Payroll discrepancy tracking & query resolution

**Current:** Blocked by reviewed defects. **Historical baseline:** Partial.

**Requirement references:** CORE-09, LC-01, PAY-05, HD-01

**Historical implementation evidence:** Letters archive, generic helpdesk and selected HR report exports exist.

**Remaining scope from full crosswalk:** Build payroll bulk/compliance downloads, full onboarding/document workflow and discrepancy tracking linked to payroll.

**Execution cards:** F01, F03, P04, W02, W04

**Database connections:** ast.assets, ast.assignments, ast.maintenance, att.absence_cases, att.coverage_targets, att.day_records, att.device_watermarks, att.devices, att.employee_shifts, att.holidays, att.ingest_watermarks, att.leave_blackouts, att.manager_month_approvals, att.month_locks, att.overtime_entries, att.quarantined_swipes, att.recompute_queue, att.regularizations, att.roster_publications, att.roster_revisions, att.rosters, att.shift_patterns, att.shift_swaps, att.shifts, att.swipe_events, cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.audit_log, core.companies, core.cost_centers, core.departments, core.designations, core.documents, core.employee_assignments, core.employee_family, core.employee_history, core.employees, core.grades, core.letter_templates, core.letters, core.locations, core.mis_codes, core.org_units, core.password_reset_tokens, core.permissions, core.plants, core.policies, core.policy_acknowledgments, core.profile_change_requests, core.reporting_tree, core.role_permissions, core.roles, core.settings, core.user_roles, core.users, doc.types, eng.announcements, eng.poll_responses, eng.polls, hd.categories, hd.escalation_rules, hd.ticket_events, hd.ticket_messages, hd.tickets, ird.grievances, ird.ic_members, ird.posh_case_access_log, ird.posh_cases, ird.whistleblower_reports, lv.applications, lv.leave_types, lv.ledger, lv.restricted_holidays, lv.rh_selections, pay.bank_batch_lines, pay.bank_batches, pay.budget_categories, pay.budgets, pay.claim_lines, pay.claim_reservations, pay.claim_types, pay.claims, pay.gl_accounts, pay.journal_batches, pay.journal_lines, pay.output_artifacts, pay.payment_events, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.source_consumptions, prv.breach_register, prv.consent_events, prv.consents, prv.legal_holds, prv.notice_acks, prv.notices, prv.processing_register, prv.processors, prv.purge_log, prv.purge_proposals, prv.retention_rules, prv.rights_requests, reporting.kpi_daily, reporting.muster_month, reporting.snapshot_builds, sec.access_events, sec.mfa_enrolments, sec.mfa_recovery_codes, sec.password_history, sec.sessions, wf.definitions, wf.delegations, wf.event_subscriptions, wf.notifications, wf.request_steps, wf.requests

**Current reviewed issues:**

- R13 (open; PAY-05): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.
- R14 (open; LC-01): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R18 (open; LC-01): Onboarding conversion is not atomic and creates unusable salary/login. Remaining repair: Use the existing validated employee/e-code/salary/auth public APIs inside one owned transaction. Resolve mandatory master links and actual salary breakup, candidate consumption key, welcome credentials/grants and outbox tasks.
- R33 (open; PAY-05): Output readiness and artifact ownership are inferred incorrectly. Remaining repair: Persist versioned per-run/payer artifacts with checksum, complete population and actual generation receipts; expose availability from those records, not approval state.
- R34 (open; PAY-05): SAP mapping loses legal payer and cost-center dimensions. Remaining repair: Use the approved scoped GL mapping keys from the canonical table, fail missing/ambiguous mappings and reconcile exact balanced amounts from frozen placement/result versions.
- R35 (open; LC-01): Prejoin single-use and at-rest token claims are inaccurate. Remaining repair: Store only a hashed expiring invitation token, lock/compare-and-swap atomic consumption, validate typed profile fields and store one consistent object representation; audit and mask statutory data.
- R45 (partial-repair-verified; PAY-05): Numeric SOW citations in phase plans and backend comments do not identify the original requirements. Remaining repair: Regenerate phase tables from the exact original crosswalk, preserve requirement IDs, and replace unverified numeric references in backend comments. Done for backend comments and Phase2/3 maps; source-doc section labels and remaining frontend annotations require separate context validation.

### SOW-184 — original spreadsheet row 184

**Payroll & compliance / 5.14 Annual Processing & Compliance**

Annual Bonus & Increment Processing:

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-17/13

**Historical implementation evidence:** Annual bonus/increment and tax year-end processes are specified.

**Remaining scope from full crosswalk:** Build bonus true-up/increments or year-end TDS adjustments and prove fixtures; annual use-case absence is not completion.

**Execution cards:** P01, P07

**Database connections:** core.employee_assignments, core.import_batches, core.probation_reviews, pay.arrears, pay.employee_salaries, pay.output_artifacts, pay.parallel_comparison_lines, pay.parallel_comparisons, pay.payroll_runs, pay.salary_components, pay.salary_structure_versions, pay.salary_structures, pay.statutory_postings

**Current reviewed issues:**

- R05 (open; PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.

### SOW-185 — original spreadsheet row 185

**Payroll & compliance / 5.14 Annual Processing & Compliance**

Tax Deduction & Year-End Adjustments

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-17/13

**Historical implementation evidence:** Annual bonus/increment and tax year-end processes are specified.

**Remaining scope from full crosswalk:** Build bonus true-up/increments or year-end TDS adjustments and prove fixtures; annual use-case absence is not completion.

**Execution cards:** P03, P06, P07, D01

**Database connections:** core.documents, core.import_batches, pay.arrears, pay.budget_categories, pay.budgets, pay.claim_bills, pay.claim_entitlements, pay.claim_lines, pay.claim_reservations, pay.claim_types, pay.claims, pay.investment_declarations, pay.it_slabs, pay.output_artifacts, pay.parallel_comparison_lines, pay.parallel_comparisons, pay.payment_obligations, pay.payroll_runs, pay.previous_employer_income, pay.pt_slabs, pay.source_consumptions, pay.statutory_memberships, pay.statutory_postings, pay.statutory_rates, pay.tax_elections, pay.tds_challans

**Current reviewed issues:**

- R05 (open; PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.

### SOW-187 — original spreadsheet row 187

**Salary reimbursements / 6.Salary related reimbursement processing**

Protiviti team should provide the following:
> Reimbursement bank transfer
> Reimbursement Register
> Submission of reimbursement pay slip to employees via the Platform.
> Calculation of TDS on the unclaimed entitlement at the year end or as per the Client policy
> Assistance for management and resolution of desk queries raised by employees.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** CLM-01..06, PAY-06/13

**Historical implementation evidence:** Claim/reimbursement page is a shell; generic helpdesk exists.

**Remaining scope from full crosswalk:** Build reimbursement bank transfer, register, payslip, year-end unsubstantiated entitlement tax and linked query support.

**Execution cards:** P04, P06, W04, T01, T02, T03, T04, D10, D11

**Database connections:** core.documents, core.employee_assignments, core.import_batches, core.source_mappings, pay.bank_batch_lines, pay.bank_batches, pay.budget_categories, pay.budgets, pay.claim_bills, pay.claim_entitlements, pay.claim_lines, pay.claim_reservations, pay.claim_types, pay.claims, pay.gl_accounts, pay.journal_batches, pay.journal_lines, pay.output_artifacts, pay.payment_events, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.source_consumptions, reporting.kpi_daily, reporting.muster_month, reporting.snapshot_builds, te.advances, te.booking_events, te.booking_operations, te.currency_rates, te.employee_travel_levels, te.itinerary_segments, te.policy_versions, te.settlement_advances, te.settlements, te.travel_levels, te.trips, te.wallet_postings

**Current reviewed issues:**

- R01 (verified-fixed; CLM-02): Fresh migration chain cannot build claims schema. Remaining repair: Recover original migration sources, reconcile canonical claims/budgets through forward alterations, then prove empty up, no-op up, down/up and upgrade. Rehearse exact target16.
- R05 (open; PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R12 (open; CLM-02): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R13 (open; PAY-06): Payroll UI simulates successful computation and payment facts. Remaining repair: Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.
- R25 (open; CLM-02, CLM-04): General claims cannot insert into the actual budget-owned model. Remaining repair: Preserve shared claims ownership; explicitly choose validated entitlement funding, required provenance and existing canonical lines/bills. Bind an approved seeded component and reconcile prior budget reservations.
- R26 (open; CLM-04): Claim routing declares paid before funds or batch lines exist. Remaining repair: Create conserved settlement/obligation/consumption records, validate subject/payer and legal states, materialize frozen payroll/batch lines and mark paid only from payment receipt. Attach invariant CHECKs to the existing table.
- R27 (open; CLM-01, CLM-02): Entitlement policy is invented and the reservation check races. Remaining repair: Use signed effective entitlement rows, exact bucket membership and locked immutable reservation/consumption; reject unconfigured entitlement and test concurrency/period edges.
- R28 (open; CLM-05, PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R33 (open; PAY-06): Output readiness and artifact ownership are inferred incorrectly. Remaining repair: Persist versioned per-run/payer artifacts with checksum, complete population and actual generation receipts; expose availability from those records, not approval state.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.

### SOW-190 — original spreadsheet row 190

**Engagement / 7.1Employee Engagement Initiatives**

Broadcasting company news and updates in an engaging format.

**Current:** Requires current end-to-end verification. **Historical baseline:** Partial.

**Requirement references:** EN-01

**Historical implementation evidence:** Announcement publish/read/withdraw APIs and targeted ESS feed exist.

**Remaining scope from full crosswalk:** Build HR publisher console and delivery/read reach evidence; current page displays feed only.

**Execution cards:** F04, W03

**Database connections:** core.document_operations, core.documents, core.letter_templates, core.letters, core.policies, core.policy_acknowledgments, core.policy_versions, eng.announcements, eng.poll_responses, eng.polls, eng.survey_responses, eng.surveys, wf.event_subscriptions, wf.notification_attempts, wf.notifications

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-191 — original spreadsheet row 191

**Engagement / 7.1Employee Engagement Initiatives**

Enabling HR teams to share information and conduct opinion polls.

**Current:** Requires current end-to-end verification. **Historical baseline:** Partial.

**Requirement references:** EN-02

**Historical implementation evidence:** Poll create/respond/results/close APIs, audience and anonymity dedupe exist.

**Remaining scope from full crosswalk:** Build HR/employee polls UI and conduct real poll/UAT.

**Execution cards:** W03

**Database connections:** core.letter_templates, core.letters, core.policies, core.policy_acknowledgments, core.policy_versions, eng.announcements, eng.poll_responses, eng.polls, eng.survey_responses, eng.surveys

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-193 — original spreadsheet row 193

**Engagement / 7.2 Employee Feedback & Pulse Surveys**

Conducting structured surveys for feedback collection.

**Current:** Requires current end-to-end verification. **Historical baseline:** Partial.

**Requirement references:** EN-03

**Historical implementation evidence:** Poll engine supports kind=pulse and anonymous results.

**Remaining scope from full crosswalk:** Build pulse-survey UI; multi-question structured survey support is not evidenced by single-question/options contract. Confirm required scope.

**Execution cards:** W03, D11

**Database connections:** core.letter_templates, core.letters, core.policies, core.policy_acknowledgments, core.policy_versions, eng.announcements, eng.poll_responses, eng.polls, eng.survey_responses, eng.surveys

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-194 — original spreadsheet row 194

**Engagement / 7.2 Employee Feedback & Pulse Surveys**

HR receives data-driven recommendations for improvements.

**Current:** Scope decision pending. **Historical baseline:** Scope decision.

**Requirement references:** EN-03; no explicit recommendation-engine requirement

**Historical implementation evidence:** Basic poll tallies/comments exist; no recommendation engine found.

**Remaining scope from full crosswalk:** Clarify whether this means HR interpretation of survey results or new automated recommendations. Record scope before building.

**Execution cards:** W03, W04, D08, D11

**Database connections:** core.employee_assignments, core.letter_templates, core.letters, core.policies, core.policy_acknowledgments, core.policy_versions, eng.announcements, eng.poll_responses, eng.polls, eng.survey_responses, eng.surveys, pay.payroll_item_lines, pay.payroll_items, pay.source_consumptions, reporting.kpi_daily, reporting.muster_month, reporting.snapshot_builds

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-197 — original spreadsheet row 197

**Assets / 8.1 Asset Allocation & Tracking**

Platform for Asset Assignment

**Current:** Requires current end-to-end verification. **Historical baseline:** Implemented.

**Requirement references:** AST-01..03

**Historical implementation evidence:** Asset register/search, holder assignments, employee/third-party XOR and UI allocation exist.

**Remaining scope from full crosswalk:** Accept real asset inventory and Admin UAT; production rollout remains.

**Execution cards:** W01

**Database connections:** ast.assets, ast.assignments, ast.custody_events, ast.maintenance, pay.payment_obligations

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-198 — original spreadsheet row 198

**Assets / 8.1 Asset Allocation & Tracking**

Platform for management of Employee Asset Directory

**Current:** Requires current end-to-end verification. **Historical baseline:** Implemented.

**Requirement references:** AST-01..03

**Historical implementation evidence:** Asset register/search, holder assignments, employee/third-party XOR and UI allocation exist.

**Remaining scope from full crosswalk:** Accept real asset inventory and Admin UAT; production rollout remains.

**Execution cards:** W01, W04

**Database connections:** ast.assets, ast.assignments, ast.custody_events, ast.maintenance, core.employee_assignments, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.source_consumptions, reporting.kpi_daily, reporting.muster_month, reporting.snapshot_builds

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-200 — original spreadsheet row 200

**Assets / 8.2 Asset Maintenance & Compliance**

Platform for Asset Maintenance Scheduling

**Current:** Requires current end-to-end verification. **Historical baseline:** Partial.

**Requirement references:** AST-06

**Historical implementation evidence:** Maintenance API/trail stores scheduled date and cost.

**Remaining scope from full crosswalk:** Build maintenance scheduling UI, recurring reminders/status completion as agreed; asset page currently only register/allocate/return/outstanding.

**Execution cards:** W01, D11

**Database connections:** ast.assets, ast.assignments, ast.custody_events, ast.maintenance, pay.payment_obligations

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-201 — original spreadsheet row 201

**Assets / 8.2 Asset Maintenance & Compliance**

Platform for Incident & Damage Reporting

**Current:** Requires current end-to-end verification. **Historical baseline:** Partial.

**Requirement references:** AST-06

**Historical implementation evidence:** Maintenance API records incident/damage/loss; damaged return routes to maintenance.

**Remaining scope from full crosswalk:** Build dedicated incident/damage reporting UI and recovery linkage to payroll/F&F.

**Execution cards:** W01, D11

**Database connections:** ast.assets, ast.assignments, ast.custody_events, ast.maintenance, pay.payment_obligations

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-203 — original spreadsheet row 203

**Assets / 8.3 Asset Retrieval & Exit Clearance**

Platform for Asset Return Process

**Current:** Requires current end-to-end verification. **Historical baseline:** Implemented.

**Requirement references:** AST-04

**Historical implementation evidence:** Return drawer and API record ok/damaged/not_returned and assignment state.

**Remaining scope from full crosswalk:** Prove actual exit integration/clearance in Stage 3.2; asset-return capability itself exists.

**Execution cards:** W01

**Database connections:** ast.assets, ast.assignments, ast.custody_events, ast.maintenance, pay.payment_obligations

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-204 — original spreadsheet row 204

**Assets / 8.3 Asset Retrieval & Exit Clearance**

Platform for Clearance Workflows

**Current:** Blocked by reviewed defects. **Historical baseline:** Partial.

**Requirement references:** AST-04, LC-06

**Historical implementation evidence:** Open employee holdings lookup and leaver outstanding list exist.

**Remaining scope from full crosswalk:** Build clearance fan-out/approvals and enforce asset disposition before Admin clearance/F&F. Asset lookup alone is not the workflow.

**Execution cards:** L04, W01, W04, D11

**Database connections:** ast.assets, ast.assignments, ast.custody_events, ast.maintenance, core.clearances, core.employee_assignments, core.separations, pay.claims, pay.loan_postings, pay.loans, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.source_consumptions, reporting.kpi_daily, reporting.muster_month, reporting.snapshot_builds, te.advances, te.wallet_postings

**Current reviewed issues:**

- R14 (open; LC-06): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R15 (open; LC-06): New financial/lifecycle endpoints do not enforce ownership scope. Remaining repair: Require one declared business permission and server-derived self/subtree/entity/category scope on reads and writes; deny foreign subject IDs and test all restricted roles.
- R16 (open; LC-06): F&F substitutes fixture salary, leave and payable days. Remaining repair: Require authoritative as-of salary, attendance, leave ledger, paid holds, debt and final tax inputs. Fail missing facts explicitly; retain frozen calculation provenance and reviewed overrides.
- R17 (open; LC-06): F&F can mark paid and issue letters without approval/payment. Remaining repair: Implement approved immutable settlement->payment obligation->verified receipt transitions, with maker/checker, idempotency, audit/outbox and atomic exit/letter release. Do not label queued payouts paid.
- R19 (open; LC-06): Lifecycle approval and notification claims lack workflow records. Remaining repair: Wire authoritative versioned workflow requests and domain hooks, transactional audit/outbox and actual notification attempts/receipts. Never manufacture sent/verified timestamps.

### SOW-205 — original spreadsheet row 205

**Assets / 8.3 Asset Retrieval & Exit Clearance**

Platform for Lost or Unreturned Assets Management

**Current:** Requires current end-to-end verification. **Historical baseline:** Partial.

**Requirement references:** AST-05/06

**Historical implementation evidence:** Lost trail prevents allocation; leaver non-returned list and export exist.

**Remaining scope from full crosswalk:** Expose loss handling/disposition UI and integrate recovery/write-off with clearance/payroll.

**Execution cards:** L04, W01, W04

**Database connections:** ast.assets, ast.assignments, ast.custody_events, ast.maintenance, core.clearances, core.employee_assignments, core.separations, pay.claims, pay.loan_postings, pay.loans, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.source_consumptions, reporting.kpi_daily, reporting.muster_month, reporting.snapshot_builds, te.advances, te.wallet_postings

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-208 — original spreadsheet row 208

**Helpdesk / 9.1 Ticketing System & Query Management**

Ticket Categories: Categorization of queries

**Current:** Requires current end-to-end verification. **Historical baseline:** Implemented.

**Requirement references:** HD-01

**Historical implementation evidence:** Category catalog with data-driven SLA/routing role is available in API and ticket UI.

**Remaining scope from full crosswalk:** Accept HR/IT/payroll categories and routing ownership in UAT.

**Execution cards:** W02

**Database connections:** hd.categories, hd.escalation_rules, hd.ticket_events, hd.ticket_messages, hd.tickets, wf.notifications

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-209 — original spreadsheet row 209

**Helpdesk / 9.1 Ticketing System & Query Management**

Platform Auto-Acknowledgment & Assignment: 

**Current:** Requires current end-to-end verification. **Historical baseline:** Partial.

**Requirement references:** HD-01, WF-02

**Historical implementation evidence:** Raise transaction sets SLA/acknowledgment and resolves assignee from category role.

**Remaining scope from full crosswalk:** Prove delivered acknowledgment/assignment notification, handle vacant assignee, and align business permission requirement.

**Execution cards:** F04, W02, D04

**Database connections:** core.document_operations, core.documents, core.letter_templates, core.letters, hd.categories, hd.escalation_rules, hd.ticket_events, hd.ticket_messages, hd.tickets, wf.event_subscriptions, wf.notification_attempts, wf.notifications

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-211 — original spreadsheet row 211

**Helpdesk / 9.2 Escalation & Resolution Workflow**

Escalation Matrix: Automated escalation of unresolved tickets based on pre-set SLAs

**Current:** Requires current end-to-end verification. **Historical baseline:** Partial.

**Requirement references:** HD-01, WF-03

**Historical implementation evidence:** Hourly sweep increments escalation level and queues same-assignee alert.

**Remaining scope from full crosswalk:** Implement actual escalation matrix/new responsible recipient; worker createQueue list omits helpdesk/KPI queue names. Prove clean-DB scheduler boot and real delivery.

**Execution cards:** F04, W02, D04, D11

**Database connections:** core.document_operations, core.documents, core.letter_templates, core.letters, hd.categories, hd.escalation_rules, hd.ticket_events, hd.ticket_messages, hd.tickets, wf.event_subscriptions, wf.notification_attempts, wf.notifications

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-213 — original spreadsheet row 213

**Helpdesk / 9.3 Helpdesk Reporting & Analytics**

Real-time tracking of open, pending, and resolved tickets.

**Current:** Blocked by reviewed defects. **Historical baseline:** Partial.

**Requirement references:** HD-01, CORE-10

**Historical implementation evidence:** Employee own list and agent queue support open/pending/resolved/closed.

**Remaining scope from full crosswalk:** Add ticket-owner/assignee authorization to thread/reply and category/org scoping where required; then prove negative access fixtures.

**Execution cards:** W02, W04

**Database connections:** core.employee_assignments, hd.categories, hd.escalation_rules, hd.ticket_events, hd.ticket_messages, hd.tickets, pay.payroll_item_lines, pay.payroll_items, pay.source_consumptions, reporting.kpi_daily, reporting.muster_month, reporting.snapshot_builds, wf.notifications

**Current reviewed issues:**

- R11 (partial-repair-verified; CORE-10): Maker/checker validation fails open on missing evidence. Remaining repair: Persist authoritative maker/checker records with separate DB-backed authorities, reject missing evidence, and atomically enforce legal transitions/audit/reconciliation.
- R12 (open; CORE-10): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R15 (open; CORE-10): New financial/lifecycle endpoints do not enforce ownership scope. Remaining repair: Require one declared business permission and server-derived self/subtree/entity/category scope on reads and writes; deny foreign subject IDs and test all restricted roles.
- R46 (open; CORE-10): Full integration results vary across repeated runs and HTTP error bodies are hidden by downstream casts. Remaining repair: Capture sanitized typed HTTP error codes/messages at each failed request; resolve route/input/fixture/environment or framework causes, then prove stable serialized full runs. Do not hide failures with casts, skips, fallback records or reduced coverage thresholds.

### SOW-214 — original spreadsheet row 214

**Helpdesk / 9.3 Helpdesk Reporting & Analytics**

Monthly Performance Reports

**Current:** Blocked by reviewed defects. **Historical baseline:** Partial.

**Requirement references:** HD-01, RPT-06

**Historical implementation evidence:** Monthly category report and Excel exist.

**Remaining scope from full crosswalk:** Add assignee/SLA-hit reporting per doc 04; retain historic breach facts so resolved late tickets do not disappear from breached count.

**Execution cards:** W02, W04, D11

**Database connections:** core.employee_assignments, hd.categories, hd.escalation_rules, hd.ticket_events, hd.ticket_messages, hd.tickets, pay.payroll_item_lines, pay.payroll_items, pay.source_consumptions, reporting.kpi_daily, reporting.muster_month, reporting.snapshot_builds, wf.notifications

**Current reviewed issues:**

- R34 (open; RPT-06): SAP mapping loses legal payer and cost-center dimensions. Remaining repair: Use the approved scoped GL mapping keys from the canonical table, fail missing/ambiguous mappings and reconcile exact balanced amounts from frozen placement/result versions.
- R44 (partial-repair-verified; RPT-06): Parallel comparison drops repeated lines of the same component. Remaining repair: Sum all signed component facts in integer paise per employee/component. Corrected shared component aggregation is now used by the real comparison; durable complete-population two-cycle/sign-off gates remain open under R29.
- R45 (partial-repair-verified; RPT-06): Numeric SOW citations in phase plans and backend comments do not identify the original requirements. Remaining repair: Regenerate phase tables from the exact original crosswalk, preserve requirement IDs, and replace unverified numeric references in backend comments. Done for backend comments and Phase2/3 maps; source-doc section labels and remaining frontend annotations require separate context validation.

### SOW-216 — original spreadsheet row 216

**Helpdesk / 9.4 Compliance & Audit Support**

Helpdesk Query Logs

**Current:** Blocked by reviewed defects. **Historical baseline:** Implemented.

**Requirement references:** HD-01, CORE-11

**Historical implementation evidence:** Ticket-message history is append-only via migration trigger.

**Remaining scope from full crosswalk:** Close ticket read/reply authorization gap; prove production retention and UAT.

**Execution cards:** W02, W04

**Database connections:** core.employee_assignments, hd.categories, hd.escalation_rules, hd.ticket_events, hd.ticket_messages, hd.tickets, pay.payroll_item_lines, pay.payroll_items, pay.source_consumptions, reporting.kpi_daily, reporting.muster_month, reporting.snapshot_builds, wf.notifications

**Current reviewed issues:**

- R17 (open; CORE-11): F&F can mark paid and issue letters without approval/payment. Remaining repair: Implement approved immutable settlement->payment obligation->verified receipt transitions, with maker/checker, idempotency, audit/outbox and atomic exit/letter release. Do not label queued payouts paid.
- R37 (open; CORE-11): Completed-stage and UAT labels exceed verified behavior. Remaining repair: Retain work credit but reopen failed acceptance items; attach dated signed evidence for any external/UAT/legal claim. Never infer proof from a checked box.

### SOW-217 — original spreadsheet row 217

**Helpdesk / 9.4 Compliance & Audit Support**

Regulatory Query Handling

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** HD-01; regulatory operations

**Historical implementation evidence:** Generic helpdesk can record queries; specialist regulatory responses are human services.

**Remaining scope from full crosswalk:** Assign qualified compliance owner and retain response/closure evidence; ticketing alone does not prove regulatory resolution.

**Execution cards:** W02, M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.documents, hd.categories, hd.escalation_rules, hd.ticket_events, hd.ticket_messages, hd.tickets, pay.output_artifacts, wf.notifications

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-218 — original spreadsheet row 218

**Helpdesk / 9.4 Compliance & Audit Support**

Employee & Case Management

**Current:** Blocked by reviewed defects. **Historical baseline:** Partial.

**Requirement references:** HD-01, ATT-10, LC-06

**Historical implementation evidence:** Ticket threads and absence-case queue exist.

**Remaining scope from full crosswalk:** Finish secure employee/case access and connect relevant lifecycle/payroll cases. Agree whether SOW refers only to helpdesk cases.

**Execution cards:** F04, L04, W02

**Database connections:** ast.assignments, ast.custody_events, core.clearances, core.document_operations, core.documents, core.letter_templates, core.letters, core.separations, hd.categories, hd.escalation_rules, hd.ticket_events, hd.ticket_messages, hd.tickets, pay.claims, pay.loan_postings, pay.loans, te.advances, te.wallet_postings, wf.event_subscriptions, wf.notification_attempts, wf.notifications

**Current reviewed issues:**

- R14 (open; LC-06): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R15 (open; LC-06): New financial/lifecycle endpoints do not enforce ownership scope. Remaining repair: Require one declared business permission and server-derived self/subtree/entity/category scope on reads and writes; deny foreign subject IDs and test all restricted roles.
- R16 (open; LC-06): F&F substitutes fixture salary, leave and payable days. Remaining repair: Require authoritative as-of salary, attendance, leave ledger, paid holds, debt and final tax inputs. Fail missing facts explicitly; retain frozen calculation provenance and reviewed overrides.
- R17 (open; LC-06): F&F can mark paid and issue letters without approval/payment. Remaining repair: Implement approved immutable settlement->payment obligation->verified receipt transitions, with maker/checker, idempotency, audit/outbox and atomic exit/letter release. Do not label queued payouts paid.
- R19 (open; LC-06): Lifecycle approval and notification claims lack workflow records. Remaining repair: Wire authoritative versioned workflow requests and domain hooks, transactional audit/outbox and actual notification attempts/receipts. Never manufacture sent/verified timestamps.

### SOW-221 — original spreadsheet row 221

**Final settlement / 10.1 Process Related to Final settlement Process:**

Settlement Input in Excel Format as shared by Protiviti viz – Number of days payable, Salary hold release, Leave Encashment days/Notice Pay recovery, Other Payments& Deductions, Gratuity, LTA claimed in previous employment

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-15/13, CLM-02, LC-06/07

**Historical implementation evidence:** F&F/alumni are specified; lifecycle/payroll shells only.

**Remaining scope from full crosswalk:** Build the row-specific settlement input, proof/claim submission, reviewed workings, approved deliverables, two monthly cycles, configurable signed TAT or alumni download access. Full F&F pipeline is absent.

**Execution cards:** A04, P05, L04, L05, D10, D11

**Database connections:** ast.assignments, ast.custody_events, core.clearances, core.letters, core.separations, lv.applications, lv.credit_allocations, lv.leave_types, lv.ledger, lv.operation_keys, lv.restricted_holidays, lv.rh_selections, pay.claims, pay.fnf_settlements, pay.loan_installments, pay.loan_postings, pay.loans, pay.payment_events, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.source_consumptions, te.advances, te.wallet_postings

**Current reviewed issues:**

- R01 (verified-fixed; CLM-02): Fresh migration chain cannot build claims schema. Remaining repair: Recover original migration sources, reconcile canonical claims/budgets through forward alterations, then prove empty up, no-op up, down/up and upgrade. Rehearse exact target16.
- R05 (open; PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R12 (open; CLM-02): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R14 (open; LC-06): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R15 (open; LC-06): New financial/lifecycle endpoints do not enforce ownership scope. Remaining repair: Require one declared business permission and server-derived self/subtree/entity/category scope on reads and writes; deny foreign subject IDs and test all restricted roles.
- R16 (open; LC-06, PAY-15): F&F substitutes fixture salary, leave and payable days. Remaining repair: Require authoritative as-of salary, attendance, leave ledger, paid holds, debt and final tax inputs. Fail missing facts explicitly; retain frozen calculation provenance and reviewed overrides.
- R17 (open; LC-06, LC-07, PAY-15): F&F can mark paid and issue letters without approval/payment. Remaining repair: Implement approved immutable settlement->payment obligation->verified receipt transitions, with maker/checker, idempotency, audit/outbox and atomic exit/letter release. Do not label queued payouts paid.
- R19 (open; LC-06): Lifecycle approval and notification claims lack workflow records. Remaining repair: Wire authoritative versioned workflow requests and domain hooks, transactional audit/outbox and actual notification attempts/receipts. Never manufacture sent/verified timestamps.
- R25 (open; CLM-02): General claims cannot insert into the actual budget-owned model. Remaining repair: Preserve shared claims ownership; explicitly choose validated entitlement funding, required provenance and existing canonical lines/bills. Bind an approved seeded component and reconcile prior budget reservations.
- R27 (open; CLM-02): Entitlement policy is invented and the reservation check races. Remaining repair: Use signed effective entitlement rows, exact bucket membership and locked immutable reservation/consumption; reject unconfigured entitlement and test concurrency/period edges.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.
- R39 (partial-repair-verified; PAY-15): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.

### SOW-222 — original spreadsheet row 222

**Final settlement / 10.1 Process Related to Final settlement Process:**

Communication Protocol: SFTP/ Protiviti’s CRM/ Rashmi Metaliks Limited Portal

**Current:** Scope decision pending. **Historical baseline:** Scope decision.

**Requirement references:** SOW-10.1 protocol; LC-06

**Historical implementation evidence:** SFTP/vendor CRM communication is a vendor operating clause; HRMS portal is planned.

**Remaining scope from full crosswalk:** Confirm retained portal/exchange protocol and evidence requirements under custom replacement. No SFTP/vendor CRM implementation evidenced.

**Execution cards:** F04, D08

**Database connections:** core.document_operations, core.documents, core.letter_templates, core.letters, wf.event_subscriptions, wf.notification_attempts, wf.notifications

**Current reviewed issues:**

- R14 (open; LC-06): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R15 (open; LC-06): New financial/lifecycle endpoints do not enforce ownership scope. Remaining repair: Require one declared business permission and server-derived self/subtree/entity/category scope on reads and writes; deny foreign subject IDs and test all restricted roles.
- R16 (open; LC-06): F&F substitutes fixture salary, leave and payable days. Remaining repair: Require authoritative as-of salary, attendance, leave ledger, paid holds, debt and final tax inputs. Fail missing facts explicitly; retain frozen calculation provenance and reviewed overrides.
- R17 (open; LC-06): F&F can mark paid and issue letters without approval/payment. Remaining repair: Implement approved immutable settlement->payment obligation->verified receipt transitions, with maker/checker, idempotency, audit/outbox and atomic exit/letter release. Do not label queued payouts paid.
- R19 (open; LC-06): Lifecycle approval and notification claims lack workflow records. Remaining repair: Wire authoritative versioned workflow requests and domain hooks, transactional audit/outbox and actual notification attempts/receipts. Never manufacture sent/verified timestamps.

### SOW-223 — original spreadsheet row 223

**Final settlement / 10.1 Process Related to Final settlement Process:**

Rashmi Metaliks Limited Employees to update investment proofs in ESS portal and submit any pending reimbursement claims

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-15/13, CLM-02, LC-06/07

**Historical implementation evidence:** F&F/alumni are specified; lifecycle/payroll shells only.

**Remaining scope from full crosswalk:** Build the row-specific settlement input, proof/claim submission, reviewed workings, approved deliverables, two monthly cycles, configurable signed TAT or alumni download access. Full F&F pipeline is absent.

**Execution cards:** P03, P06, L04, L05, T02

**Database connections:** ast.assignments, ast.custody_events, core.clearances, core.documents, core.letters, core.separations, lv.ledger, pay.budget_categories, pay.budgets, pay.claim_bills, pay.claim_entitlements, pay.claim_lines, pay.claim_reservations, pay.claim_types, pay.claims, pay.fnf_settlements, pay.investment_declarations, pay.it_slabs, pay.loan_postings, pay.loans, pay.output_artifacts, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.previous_employer_income, pay.pt_slabs, pay.source_consumptions, pay.statutory_memberships, pay.statutory_postings, pay.statutory_rates, pay.tax_elections, pay.tds_challans, te.advances, te.settlement_advances, te.settlements, te.wallet_postings

**Current reviewed issues:**

- R01 (verified-fixed; CLM-02): Fresh migration chain cannot build claims schema. Remaining repair: Recover original migration sources, reconcile canonical claims/budgets through forward alterations, then prove empty up, no-op up, down/up and upgrade. Rehearse exact target16.
- R05 (open; PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R12 (open; CLM-02): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R14 (open; LC-06): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R15 (open; LC-06): New financial/lifecycle endpoints do not enforce ownership scope. Remaining repair: Require one declared business permission and server-derived self/subtree/entity/category scope on reads and writes; deny foreign subject IDs and test all restricted roles.
- R16 (open; LC-06, PAY-15): F&F substitutes fixture salary, leave and payable days. Remaining repair: Require authoritative as-of salary, attendance, leave ledger, paid holds, debt and final tax inputs. Fail missing facts explicitly; retain frozen calculation provenance and reviewed overrides.
- R17 (open; LC-06, LC-07, PAY-15): F&F can mark paid and issue letters without approval/payment. Remaining repair: Implement approved immutable settlement->payment obligation->verified receipt transitions, with maker/checker, idempotency, audit/outbox and atomic exit/letter release. Do not label queued payouts paid.
- R19 (open; LC-06): Lifecycle approval and notification claims lack workflow records. Remaining repair: Wire authoritative versioned workflow requests and domain hooks, transactional audit/outbox and actual notification attempts/receipts. Never manufacture sent/verified timestamps.
- R25 (open; CLM-02): General claims cannot insert into the actual budget-owned model. Remaining repair: Preserve shared claims ownership; explicitly choose validated entitlement funding, required provenance and existing canonical lines/bills. Bind an approved seeded component and reconcile prior budget reservations.
- R27 (open; CLM-02): Entitlement policy is invented and the reservation check races. Remaining repair: Use signed effective entitlement rows, exact bucket membership and locked immutable reservation/consumption; reject unconfigured entitlement and test concurrency/period edges.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.
- R39 (partial-repair-verified; PAY-15): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.

### SOW-224 — original spreadsheet row 224

**Final settlement / 10.1 Process Related to Final settlement Process:**

Protiviti should process payroll based on clarifications received (post verification of investment proofs and reimbursement claims submitted) and share the Final Settlement workings for confirmation

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-15/13, CLM-02, LC-06/07

**Historical implementation evidence:** F&F/alumni are specified; lifecycle/payroll shells only.

**Remaining scope from full crosswalk:** Build the row-specific settlement input, proof/claim submission, reviewed workings, approved deliverables, two monthly cycles, configurable signed TAT or alumni download access. Full F&F pipeline is absent.

**Execution cards:** P02, P03, P06, L04, L05, D01, D10, D11

**Database connections:** ast.assignments, ast.custody_events, att.month_locks, att.overtime_entries, core.clearances, core.documents, core.letters, core.separations, lv.ledger, pay.arrears, pay.budget_categories, pay.budgets, pay.claim_bills, pay.claim_entitlements, pay.claim_lines, pay.claim_reservations, pay.claim_types, pay.claims, pay.fnf_settlements, pay.inputs, pay.investment_declarations, pay.it_slabs, pay.loan_postings, pay.loans, pay.output_artifacts, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.previous_employer_income, pay.pt_slabs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions, pay.statutory_memberships, pay.statutory_postings, pay.statutory_rates, pay.tax_elections, pay.tds_challans, te.advances, te.wallet_postings

**Current reviewed issues:**

- R01 (verified-fixed; CLM-02): Fresh migration chain cannot build claims schema. Remaining repair: Recover original migration sources, reconcile canonical claims/budgets through forward alterations, then prove empty up, no-op up, down/up and upgrade. Rehearse exact target16.
- R05 (open; PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R12 (open; CLM-02): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R14 (open; LC-06): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R15 (open; LC-06): New financial/lifecycle endpoints do not enforce ownership scope. Remaining repair: Require one declared business permission and server-derived self/subtree/entity/category scope on reads and writes; deny foreign subject IDs and test all restricted roles.
- R16 (open; LC-06, PAY-15): F&F substitutes fixture salary, leave and payable days. Remaining repair: Require authoritative as-of salary, attendance, leave ledger, paid holds, debt and final tax inputs. Fail missing facts explicitly; retain frozen calculation provenance and reviewed overrides.
- R17 (open; LC-06, LC-07, PAY-15): F&F can mark paid and issue letters without approval/payment. Remaining repair: Implement approved immutable settlement->payment obligation->verified receipt transitions, with maker/checker, idempotency, audit/outbox and atomic exit/letter release. Do not label queued payouts paid.
- R19 (open; LC-06): Lifecycle approval and notification claims lack workflow records. Remaining repair: Wire authoritative versioned workflow requests and domain hooks, transactional audit/outbox and actual notification attempts/receipts. Never manufacture sent/verified timestamps.
- R25 (open; CLM-02): General claims cannot insert into the actual budget-owned model. Remaining repair: Preserve shared claims ownership; explicitly choose validated entitlement funding, required provenance and existing canonical lines/bills. Bind an approved seeded component and reconcile prior budget reservations.
- R27 (open; CLM-02): Entitlement policy is invented and the reservation check races. Remaining repair: Use signed effective entitlement rows, exact bucket membership and locked immutable reservation/consumption; reject unconfigured entitlement and test concurrency/period edges.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.
- R39 (partial-repair-verified; PAY-15): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.

### SOW-225 — original spreadsheet row 225

**Final settlement / 10.1 Process Related to Final settlement Process:**

On receipt of confirmation, the following deliverables to be shared with the Rashmi Metaliks Limited SPOC

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-15/13, CLM-02, LC-06/07

**Historical implementation evidence:** F&F/alumni are specified; lifecycle/payroll shells only.

**Remaining scope from full crosswalk:** Build the row-specific settlement input, proof/claim submission, reviewed workings, approved deliverables, two monthly cycles, configurable signed TAT or alumni download access. Full F&F pipeline is absent.

**Execution cards:** P04, L05, W04

**Database connections:** core.clearances, core.documents, core.employee_assignments, core.letters, core.separations, lv.ledger, pay.bank_batch_lines, pay.bank_batches, pay.fnf_settlements, pay.gl_accounts, pay.journal_batches, pay.journal_lines, pay.output_artifacts, pay.payment_events, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.source_consumptions, reporting.kpi_daily, reporting.muster_month, reporting.snapshot_builds

**Current reviewed issues:**

- R01 (verified-fixed; CLM-02): Fresh migration chain cannot build claims schema. Remaining repair: Recover original migration sources, reconcile canonical claims/budgets through forward alterations, then prove empty up, no-op up, down/up and upgrade. Rehearse exact target16.
- R05 (open; PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R12 (open; CLM-02): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R14 (open; LC-06): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R15 (open; LC-06): New financial/lifecycle endpoints do not enforce ownership scope. Remaining repair: Require one declared business permission and server-derived self/subtree/entity/category scope on reads and writes; deny foreign subject IDs and test all restricted roles.
- R16 (open; LC-06, PAY-15): F&F substitutes fixture salary, leave and payable days. Remaining repair: Require authoritative as-of salary, attendance, leave ledger, paid holds, debt and final tax inputs. Fail missing facts explicitly; retain frozen calculation provenance and reviewed overrides.
- R17 (open; LC-06, LC-07, PAY-15): F&F can mark paid and issue letters without approval/payment. Remaining repair: Implement approved immutable settlement->payment obligation->verified receipt transitions, with maker/checker, idempotency, audit/outbox and atomic exit/letter release. Do not label queued payouts paid.
- R19 (open; LC-06): Lifecycle approval and notification claims lack workflow records. Remaining repair: Wire authoritative versioned workflow requests and domain hooks, transactional audit/outbox and actual notification attempts/receipts. Never manufacture sent/verified timestamps.
- R25 (open; CLM-02): General claims cannot insert into the actual budget-owned model. Remaining repair: Preserve shared claims ownership; explicitly choose validated entitlement funding, required provenance and existing canonical lines/bills. Bind an approved seeded component and reconcile prior budget reservations.
- R27 (open; CLM-02): Entitlement policy is invented and the reservation check races. Remaining repair: Use signed effective entitlement rows, exact bucket membership and locked immutable reservation/consumption; reject unconfigured entitlement and test concurrency/period edges.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.
- R39 (partial-repair-verified; PAY-15): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.

### SOW-227 — original spreadsheet row 227

**Final settlement / 10.2 Full and Final Settlement Process-General**

Protiviti should offers 2 Full and Final cycle.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-15/13, CLM-02, LC-06/07

**Historical implementation evidence:** F&F/alumni are specified; lifecycle/payroll shells only.

**Remaining scope from full crosswalk:** Build the row-specific settlement input, proof/claim submission, reviewed workings, approved deliverables, two monthly cycles, configurable signed TAT or alumni download access. Full F&F pipeline is absent.

**Execution cards:** P02, L05, D11

**Database connections:** att.month_locks, att.overtime_entries, core.clearances, core.letters, core.separations, lv.ledger, pay.arrears, pay.fnf_settlements, pay.inputs, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, pay.run_input_refs, pay.salary_holds, pay.source_consumptions

**Current reviewed issues:**

- R01 (verified-fixed; CLM-02): Fresh migration chain cannot build claims schema. Remaining repair: Recover original migration sources, reconcile canonical claims/budgets through forward alterations, then prove empty up, no-op up, down/up and upgrade. Rehearse exact target16.
- R05 (open; PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R12 (open; CLM-02): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R14 (open; LC-06): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R15 (open; LC-06): New financial/lifecycle endpoints do not enforce ownership scope. Remaining repair: Require one declared business permission and server-derived self/subtree/entity/category scope on reads and writes; deny foreign subject IDs and test all restricted roles.
- R16 (open; LC-06, PAY-15): F&F substitutes fixture salary, leave and payable days. Remaining repair: Require authoritative as-of salary, attendance, leave ledger, paid holds, debt and final tax inputs. Fail missing facts explicitly; retain frozen calculation provenance and reviewed overrides.
- R17 (open; LC-06, LC-07, PAY-15): F&F can mark paid and issue letters without approval/payment. Remaining repair: Implement approved immutable settlement->payment obligation->verified receipt transitions, with maker/checker, idempotency, audit/outbox and atomic exit/letter release. Do not label queued payouts paid.
- R19 (open; LC-06): Lifecycle approval and notification claims lack workflow records. Remaining repair: Wire authoritative versioned workflow requests and domain hooks, transactional audit/outbox and actual notification attempts/receipts. Never manufacture sent/verified timestamps.
- R25 (open; CLM-02): General claims cannot insert into the actual budget-owned model. Remaining repair: Preserve shared claims ownership; explicitly choose validated entitlement funding, required provenance and existing canonical lines/bills. Bind an approved seeded component and reconcile prior budget reservations.
- R27 (open; CLM-02): Entitlement policy is invented and the reservation check races. Remaining repair: Use signed effective entitlement rows, exact bucket membership and locked immutable reservation/consumption; reject unconfigured entitlement and test concurrency/period edges.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.
- R39 (partial-repair-verified; PAY-15): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.

### SOW-228 — original spreadsheet row 228

**Final settlement / 10.2 Full and Final Settlement Process-General**

The turnaround time to process Full and Final is 3 working days.

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-15/13, CLM-02, LC-06/07

**Historical implementation evidence:** F&F/alumni are specified; lifecycle/payroll shells only.

**Remaining scope from full crosswalk:** Build the row-specific settlement input, proof/claim submission, reviewed workings, approved deliverables, two monthly cycles, configurable signed TAT or alumni download access. Full F&F pipeline is absent.

**Execution cards:** L05, D01

**Database connections:** core.clearances, core.letters, core.separations, lv.ledger, pay.fnf_settlements, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs

**Current reviewed issues:**

- R01 (verified-fixed; CLM-02): Fresh migration chain cannot build claims schema. Remaining repair: Recover original migration sources, reconcile canonical claims/budgets through forward alterations, then prove empty up, no-op up, down/up and upgrade. Rehearse exact target16.
- R05 (open; PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R12 (open; CLM-02): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R14 (open; LC-06): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R15 (open; LC-06): New financial/lifecycle endpoints do not enforce ownership scope. Remaining repair: Require one declared business permission and server-derived self/subtree/entity/category scope on reads and writes; deny foreign subject IDs and test all restricted roles.
- R16 (open; LC-06, PAY-15): F&F substitutes fixture salary, leave and payable days. Remaining repair: Require authoritative as-of salary, attendance, leave ledger, paid holds, debt and final tax inputs. Fail missing facts explicitly; retain frozen calculation provenance and reviewed overrides.
- R17 (open; LC-06, LC-07, PAY-15): F&F can mark paid and issue letters without approval/payment. Remaining repair: Implement approved immutable settlement->payment obligation->verified receipt transitions, with maker/checker, idempotency, audit/outbox and atomic exit/letter release. Do not label queued payouts paid.
- R19 (open; LC-06): Lifecycle approval and notification claims lack workflow records. Remaining repair: Wire authoritative versioned workflow requests and domain hooks, transactional audit/outbox and actual notification attempts/receipts. Never manufacture sent/verified timestamps.
- R25 (open; CLM-02): General claims cannot insert into the actual budget-owned model. Remaining repair: Preserve shared claims ownership; explicitly choose validated entitlement funding, required provenance and existing canonical lines/bills. Bind an approved seeded component and reconcile prior budget reservations.
- R27 (open; CLM-02): Entitlement policy is invented and the reservation check races. Remaining repair: Use signed effective entitlement rows, exact bucket membership and locked immutable reservation/consumption; reject unconfigured entitlement and test concurrency/period edges.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.
- R39 (partial-repair-verified; PAY-15): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.

### SOW-229 — original spreadsheet row 229

**Final settlement / 10.2 Full and Final Settlement Process-General**

Protiviti would not interact with resigned employees and details
would be shared only to SPOC.

**Current:** Manual/service evidence pending. **Historical baseline:** Manual / service.

**Requirement references:** SOW-10.2 communication restriction

**Historical implementation evidence:** Only-SPOC communication is a vendor service/privacy term.

**Remaining scope from full crosswalk:** Confirm who handles exited-employee contact in the replacement; retain agreed SOP. It is not a shipped software feature.

**Execution cards:** F04, L05, M01

**Database connections:** cmp.calendar_items, cmp.filing_evidence, cmp.registrations, core.clearances, core.document_operations, core.documents, core.letter_templates, core.letters, core.separations, lv.ledger, pay.fnf_settlements, pay.output_artifacts, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, wf.event_subscriptions, wf.notification_attempts, wf.notifications

**Current reviewed issues:**

- No directly matched finding. Current end-to-end verification remains open; retain the remaining scope above.

### SOW-230 — original spreadsheet row 230

**Final settlement / 10.2 Full and Final Settlement Process-General**

“Alumni portal” access to exit employees need to be
confirmedly Rashmi Metaliks Limited for RML to download

**Current:** Blocked by reviewed defects. **Historical baseline:** Pending.

**Requirement references:** PAY-15/13, CLM-02, LC-06/07

**Historical implementation evidence:** F&F/alumni are specified; lifecycle/payroll shells only.

**Remaining scope from full crosswalk:** Build the row-specific settlement input, proof/claim submission, reviewed workings, approved deliverables, two monthly cycles, configurable signed TAT or alumni download access. Full F&F pipeline is absent.

**Execution cards:** F03, P04, L05, D03, D11

**Database connections:** core.audit_log, core.clearances, core.documents, core.letters, core.password_reset_tokens, core.permissions, core.role_permissions, core.roles, core.separations, core.settings, core.user_roles, core.users, lv.ledger, pay.bank_batch_lines, pay.bank_batches, pay.fnf_settlements, pay.gl_accounts, pay.journal_batches, pay.journal_lines, pay.output_artifacts, pay.payment_events, pay.payment_obligations, pay.payroll_item_lines, pay.payroll_items, pay.payroll_runs, sec.sessions

**Current reviewed issues:**

- R01 (verified-fixed; CLM-02): Fresh migration chain cannot build claims schema. Remaining repair: Recover original migration sources, reconcile canonical claims/budgets through forward alterations, then prove empty up, no-op up, down/up and upgrade. Rehearse exact target16.
- R05 (open; PAY-13): Real payroll never supplies required statutory and debt facts. Remaining repair: Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.
- R12 (open; CLM-02): New API routes disagree with product callers. Remaining repair: Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.
- R14 (open; LC-06): API errors silently become sample employee records. Remaining repair: Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.
- R15 (open; LC-06): New financial/lifecycle endpoints do not enforce ownership scope. Remaining repair: Require one declared business permission and server-derived self/subtree/entity/category scope on reads and writes; deny foreign subject IDs and test all restricted roles.
- R16 (open; LC-06, PAY-15): F&F substitutes fixture salary, leave and payable days. Remaining repair: Require authoritative as-of salary, attendance, leave ledger, paid holds, debt and final tax inputs. Fail missing facts explicitly; retain frozen calculation provenance and reviewed overrides.
- R17 (open; LC-06, LC-07, PAY-15): F&F can mark paid and issue letters without approval/payment. Remaining repair: Implement approved immutable settlement->payment obligation->verified receipt transitions, with maker/checker, idempotency, audit/outbox and atomic exit/letter release. Do not label queued payouts paid.
- R19 (open; LC-06): Lifecycle approval and notification claims lack workflow records. Remaining repair: Wire authoritative versioned workflow requests and domain hooks, transactional audit/outbox and actual notification attempts/receipts. Never manufacture sent/verified timestamps.
- R25 (open; CLM-02): General claims cannot insert into the actual budget-owned model. Remaining repair: Preserve shared claims ownership; explicitly choose validated entitlement funding, required provenance and existing canonical lines/bills. Bind an approved seeded component and reconcile prior budget reservations.
- R27 (open; CLM-02): Entitlement policy is invented and the reservation check races. Remaining repair: Use signed effective entitlement rows, exact bucket membership and locked immutable reservation/consumption; reject unconfigured entitlement and test concurrency/period edges.
- R28 (open; PAY-13): Year-end claim taxable recovery counts unrelated bills repeatedly. Remaining repair: Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.
- R29 (open; PAY-13): Parallel-run gate can pass with missing population or component errors. Remaining repair: Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.
- R30 (open; PAY-13): Opening YTD financial facts exist only in process memory. Remaining repair: Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.
- R38 (open; PAY-13): Income-tax seed contradicts its cited reference and FY claim. Remaining repair: Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.
- R39 (partial-repair-verified; PAY-15): Salary assignment and payroll disagree on paise versus rupee units. Remaining repair: Use an explicit integer-paise salary snapshot boundary everywhere; inspect existing snapshots for import provenance without guessing their unit. Correct F&F consumers and prove assignment-to-run and assignment-to-F&F integration. Run boundary fixed with regression; remaining consumers and legacy-data provenance remain open.
