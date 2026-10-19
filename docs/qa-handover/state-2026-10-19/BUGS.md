# BUGS — shared bug list (all jobs append; owners mark `FIXED <commit>`)
Format: id · found-by · role · steps · expected vs actual · owner. e2e evidence: /workspace/STATE/e2e/<run>/ (E2E_RESULTS.md, FAILURES.md, artifacts/).

## Found by e2e (baseline on main c1cfe2c, DB hrms_e2e)

### E2E-001 · e2e · all non-admin roles · OWNER: fix · P0 (RQ-RBAC-012) · FIXED 6ae3f97 (fix)
No route-level permission guard in frontend/src/app/router.tsx (only dev/gallery is gated). Steps: log in as employee → open /payroll/structures, /executive; manager → /attendance/month-lock; payroll_admin → /admin/workflows; ceo_cell → /payroll/structures; it_admin → /payroll/structures.
Expected: 403 page (or redirect), no data, no actions. Actual: page shell renders with action buttons ("Create Structure", "Rebuild snapshot"); the APIs do refuse with 403 so no data leaks, but the UI offers forbidden actions. Fails NEG-UI for 10 of 11 personas. Fix: a RequirePermission wrapper per route using the same permission codes the APIs check; hide actions without permission.

### E2E-002 · e2e · employee · OWNER: fix · P0 (RQ-SEP-001, RQ-WF-012) · FIXED 6ae3f97 (fix)
ESS resignation form hard-codes Employee ID "301". Steps: rml033924@qa-payroll… → /lifecycle/separation → Apply resignation → fill LWD + reason → Submit. Expected: resignation submitted for the signed-in employee. Actual: disabled field shows 301; submit fails "You can only resign on your own behalf; HR uses the HR-initiated separation". Nobody can resign via ESS. Notice period text ("Standard 90 days, shortfall 60 days") also looks static — derive from policy/employee. Blocks E18 and HH2-resign chain.

### E2E-003 · e2e · payroll_admin · OWNER: fix · P1 (Still-open #6, RQ-STAT-013) · FIXED 038846e (fix)
"Payroll settings" button on /payroll links to /payroll/settings, which is not a route → bounces to /. Expected: payroll settings page (statutory rates, PT slabs, GL, components) on /api/payroll/config/*.

### E2E-004 · e2e · hr_ops · OWNER: fix · P1 (RQ-WF-009, O25)
Routing-hold queue unreachable for hr_ops: /admin/workflows shows "Missing permission: admin.settings". Expected: hr_ops can view routing holds and retry routing with a note (own entity), without workflow-config rights.

### E2E-005 · e2e · hr_head (and super_admin export) · OWNER: fix · P1 (RQ-RBAC-008, HH5)
hr_head cannot review the access-control matrix (/admin/users denied; GET /api/rbac/matrix 403). No "Export to Excel" of the matrix for any role. Expected: read-only matrix for hr_head (audit) + xlsx export.

### E2E-006 · e2e · it_admin / super_admin · OWNER: fix · P1 (RQ-NFR-003, I1) · FIXED 2da4f3e (fix)
Users & Roles (/admin/users) has no Unlock, Reset password (temporary), Activate/Deactivate row actions although the APIs exist (/api/auth/users/{id}/unlock, /reset-password, /active). A locked user can only be unlocked via API. Blocks AUTH-04 / AUTH-07 UI paths.

### E2E-007 · e2e · hr_ops · OWNER: fix · P1 (RQ-ATT-028, RQ-ATT-032; O7, O8)
No UI for manual attendance correction (PUT /api/attendance/days/override, mandatory reason, 409 on locked day) or range recompute (POST /api/attendance/recompute). /attendance hub links only muster/exceptions/devices/month lock/absence cases.

### E2E-008 · e2e · manager, hr_ops, employee · OWNER: fix · P0 (crash) · FIXED 6ae3f97 (fix)
Probation board crashes for every role: /lifecycle/probation → "This page could not load". Cause: ProbationBoardPage reads alerts.d30/d14 (.length) but GET /api/lifecycle/probation/alerts returns {d30ReviewIds,d14ReviewIds,d7ReviewIds} → TypeError at ProbationBoardPage.tsx:~353. Also hr_ops gets 403 on /api/lifecycle/probation/reviews ("Missing permission: lifecycle.confirmation.approve") — O17 says hr_ops runs the probation board; only the confirm step needs hr_head.

### E2E-009 · e2e · all · OWNER: uiux · P2
RouteFrame ChunkBoundary shows "The connection dropped or the app was updated" for ANY render error (see E2E-008), misleading users and support. Distinguish chunk-load failures from render errors ("Something went wrong on this page", with a request/trace id).

### E2E-010 · e2e · payroll_admin (scope) · OWNER: fix (+ payroll for the base seed) · P0 (RQ-RBAC-004; owner rule) · FIXED 6ae3f97 (fix)
Entity-scoped roles can be granted with no org unit, which silently gives group-wide access. Base seed grants payroll@ payroll_admin unscoped → payroll@ lists RML and RGH employees (GET /api/employees: RML=36, RGH=10). Owner: payroll_admin is company-scoped. Expected: grant API/UI requires a scope for hr_ops/payroll_admin/plant_head (it_admin per assignment); seed scopes payroll@ to RML. (e2e prep now scopes payroll@ to org unit 1 to test the owner's model.)

### E2E-011 · e2e · employee · OWNER: fix (client decision?) · P2 (docs/08 §3 "Directory (basic)", RQ-CORE-027)
ESS Directory returns only self (search "Amit" → 0). Expected per docs/08: basic directory (name, designation, department, work email) of own company. If the client prefers self-only, remove "Directory" from the ESS nav instead.

### E2E-012 · e2e · employee · OWNER: fix · P1 (RQ-LV-010, RQ-LV-008; E10, E11)
My Leave has no Cancel action on an approved/pending application and no Encashment request, although the APIs exist (/api/leave/applications/{id}/cancel, /api/leave/encashments).

### E2E-013 · e2e · manager · OWNER: fix · P1 (RQ-WF-004, M11)
No UI to set an out-of-office delegation (APIs /api/workflows/delegations exist). Approvals inbox shows nothing about delegation.

### E2E-014 · e2e · it_admin · OWNER: fix · P2 (RQ-ATT-001, I3; RQ-LC-004, I4)
Device health has no "Sync now" (POST /api/attendance/sync, must fail closed without an adapter) and it_admin cannot see onboarding IT tasks (/lifecycle/onboarding denies). Also it_admin primary nav shows only ESS items; admin screens are under More (see usability).

### E2E-015 · e2e · hr_ops (M13 claim chain) · OWNER: fix · P1 (RQ-TE-009)
Claim submit is blocked "This claim needs a budget" when no budget row exists for the category/cost centre. Requirement: over-budget is flagged for higher approval, not blocked; a missing budget should route with a flag (or seed budgets for every active category).

### E2E-016 · e2e · employee/manager · OWNER: fix · P3
Approvals inbox renders a trip as "Durgapur · 25 Nov 2026 · 24 Nov 2026" (end date before start date) — summary fields out of order.

### E2E-017 · e2e · it_admin · OWNER: uiux · P3 (usability)
Settings shows a "Change" button on payroll-owned keys (pay.*) for it_admin; clicking ends in 403 "owned by payroll_admin". Hide/disable Change for keys the role cannot edit.

### E2E-018 · e2e · super_admin · OWNER: fix · P3 (data integrity) · FIXED 6ae3f97 (fix)
core.user_roles allows duplicate (user, role, NULL scope) rows — the unique key treats NULL scope as distinct. Users & Roles shows "employee" twice for some users. Use NULLS NOT DISTINCT.

### E2E-019 · e2e · several · OWNER: fix · P1 — Missing features from Still-open list (tracked so the suite re-checks them)
E3 family/nominee change (item 2) · O3 employee create/edit (2) · HH9 org masters + entity statutory IDs (2; /admin/masters is attendance masters only) · E14/P11 investment declaration (3) · P10 Form 16/24Q/challans (3) · M4 OT pre-approval, P13 off-cycle run, O26/PH3/C3 offer/LOI chain, E23 geo check-in, M12 requisition (5) · I6 SMTP delivery, I7 backup/restore evidence (7) · P6 holds/LOP reversal visible on the run.

### E2E-020 · e2e · hr_ops / payroll_admin / it_admin · OWNER: fix · P0 (crash; O19, P14, I5)
/lifecycle/separations crashes ("Route failed to render: Cannot read properties of undefined (reading 'toLowerCase')", SeparationBoardPage.tsx:286). The API returns {separations, items} with rows using `employeeName`; the page filters on `item.name.toLowerCase()`. Steps: log in as hrops@ → Exits. Expected: board lists the 2 June leavers. Fix: read employeeName (or map it).

### E2E-021 · e2e · payroll_admin · OWNER: payroll (engine/state machine) · P1 (P4r)
A reopened run shows the variable-inputs form, but saving fails "Variable inputs can only change while the run is a draft". And returnToDraft on a reopened run is refused ("A reopened run cannot go back to draft") although run-state-machine.ts allows reopened → draft. Result: after a reopen you cannot correct an input, which is the reason to reopen. Expected: either accept inputs in `reopened` or allow reopened → draft. Otherwise hide the form.

### E2E-022 · e2e · hr_head / payroll_admin · OWNER: fix (lifecycle; cc payroll) · P0 (money / documents; CONC-FNF-01) · FIXED 2da4f3e^ (fix)
F&F pay has no row lock or status guard inside the transaction. Five parallel POST /lifecycle/separations/{id}/pay calls all return 200. They issue 5 relieving letters and 5 service certificates, write 5 fnf_paid audit rows and overwrite paid_at. separation.service.ts finalizeAndPayFnf reads the settlement outside the transaction and checks `status==='paid'` afterwards (check-then-act). Expected: exactly one 200, the rest 409. Fix: SELECT … FOR UPDATE inside the trx (or `UPDATE … WHERE status<>'paid' RETURNING`), as markPaid does via withLockedRun.

### E2E-023 · e2e · payroll_admin · OWNER: payroll · P2 (CONC-PAY-02)
Generating the bank file 3× in parallel (double click, or two admins) creates 3 pay.bank_batches rows and 3 documents for one finalized run. Sequential regeneration also adds a batch each time, and nothing marks the older ones superseded. Risk: two payable files reach the bank. Expected: one active batch per finalization (lock the run; regenerate supersedes). Same check for the payslip archive.
Verified OK under the same race: compute ×3 (one item per employee, no duplicate lines), approve ×5, finalize ×5 and markPaid ×5 each succeed exactly once.

### E2E-024 · e2e · hr_ops · OWNER: fix · P3 (CONC-PUNCH-01)
Two overlapping punch uploads committed together: one commits and the other fails as a whole with a generic 409 "This record already exists". The importer promises "Punches already in the system are skipped". Data stays correct (unique key). Expected: duplicates skipped (ON CONFLICT DO NOTHING) and the job reports them as skipped. This matters for the Kent backfill and adapter retry path, which will overlap windows.

### E2E-025 · e2e · seed · OWNER: payroll (snapshot seed) · P3
The snapshot's leavers (separations 1, 2: status approved) have no core.clearances rows. The approval step normally fans these out, so F&F stays `clearances_pending` with nothing to sign off and can never be paid through the UI. Seed the 4 clearance rows in build-snapshot.

### E2E-026 · e2e · payroll_admin · OWNER: fix (decision) · P2
The fix for E2E-010 makes payroll@ RML-scoped. Statutory rates and PT slabs are group-wide and need an unscoped payroll_admin, and no seeded persona has one: the e2e suite adds payroll.group@ itself. payroll.run.reopen is super_admin-only, so the payroll admin cannot reopen their own run. Decide and seed who the group payroll owner is (client decision), then document it in USERS.md.

Verified OK under concurrency (no bug): double leave submit ×5 → 1 application; parallel approve ×5 of one request → 1 decision, 1 ledger debit; approve-vs-reject race → one consistent outcome; bulk commit ×5 of one job → applied once.

### Production-readiness pass (fresh empty DB → migrate → seeds → go-live built through the product; e2e-suite scripts/run-prod.sh)
Result on main 5c2cc4e: migrations from empty and seeds (run twice) are clean. Only the break-glass admin exists, with no demo data. Masters (companies with statutory IDs, org unit, location, cost centre, departments, designations, grades), 6 employees, logins (forced password change), role grants, opening leave balances, salary structure and assignment, punches, backdated leave with approval, muster build and manager sign-off all work through the API. The UI nav sweep for 7 personas found no crash and no coming-soon or mock copy. **Attendance → month lock → payroll cannot be completed on a fresh install** because of the items below.

### E2E-027 · e2e · ops · OWNER: fix · P0 (production)
On a fresh DB the background worker dies at start: `Queue kpi-daily-snapshot not found` (pg-boss FK on schedule). worker.ts creates every queue except KPI_SNAPSHOT_QUEUE and HELPDESK_ESCALATION_QUEUE before calling schedule(). Result: no background jobs run at all (recompute, Kent sync, accrual, absence scan, notifications). Punches never become day records until someone calls POST /attendance/recompute. Older DBs hide this because the queues already exist there. Fix: add both queues to the createQueue list, and run the worker in CI against an empty DB.

### E2E-028 · e2e · hr_ops · OWNER: fix · P1 (ROLE_TASKS O5, O9)
hr_ops cannot do two of its own tasks. Adding a holiday (PUT /attendance/config/holidays) returns 403 "Missing permission: admin.settings". Locking the month returns 403 "attendance.month_lock", which only hr_head, payroll_admin and super_admin hold. ROLE_TASKS gives O5 (holidays by location) and O9 (month-lock checklist and lock) to hr_ops. (The snapshot hides this because its tests use hr_head and payroll personas.)

### E2E-029 · e2e · payroll_admin · OWNER: payroll · P1 (go-live)
A generic salary structure cannot be built. Formulas have no CTC variable (only earlier components, GROSS and PF_WAGES). `amount_rule` is accepted by the API but ignored, and BASIC has no default formula. So "Basic = 40% of CTC, HRA = 50% of Basic, Special = balance" is impossible: assigning a structure whose BASIC has no override fails "Unknown variable(s) in formula 'BASIC * 0.50': BASIC". The snapshot works around this with one structure per employee (fixed rupee overrides). Expected: a CTC (or MONTHLY_CTC) variable, or a percent-of-CTC rule, so one structure serves a grade.

### E2E-030 · e2e · payroll_admin / super_admin · OWNER: fix · P1 (go-live)
There is no plants master. core.plants is not in /core/masters kinds (`GET /core/masters/plants` → 400), and cost_centers.plant_id cannot be set. GL mapping is keyed by plant, so PUT /payroll/config/gl-accounts on a fresh install fails with the generic "A referenced record does not exist or is still in use". The SAP JV therefore cannot be configured. Add plants to org masters (with cost centre → plant), and surface the trigger's message ("Unknown plant_code KGP for company RML").

### E2E-031 · e2e · hr_ops / it_admin · OWNER: fix · P1 (go-live)
Employees created through the product (POST /employees, the bulk employee import, onboarding) stay `biometric_registered=false`, and no screen or API sets it: no field on the create form, no importer column, no IT onboarding task. Effects: the month-lock check "population_ready" fails forever ("N missing biometric registration"), and absence finalisation skips the door-sync guard. Expected: a create/import field, or an IT onboarding task that sets it with the enrolment/access-card no.

### E2E-032 · e2e · it_admin / hr_ops · OWNER: fix · P1 (owner bar item 2)
The Kent feed cannot run. POST /attendance/sync returns 503 "Kent integration is not configured", and no adapter or simulator is wired. A manual punch upload (Kent EmployeeSwipeDetails layout) creates swipes and P/H/WO days, but it does not advance door watermarks. So no-punch working days stay `held` (never A), and the month lock is blocked by `sync_watermark`, `attendance_complete` and `recompute_drained`. On a fresh install, attendance → muster → payroll cannot reach compute ("Attendance month must be locked first"). Expected per the acceptance bar: a configurable adapter (base URL, key, polling/webhook, device→plant mapping, dedupe, retry, backfill, error log) plus a simulator. A manual upload should either count as a watermark for its date range or offer an explicit "mark doors complete for period" with audit. Re-test: tests/prod PR-07, PR-08, PR-10, PR-11.

### E2E-033 · e2e · hr_ops · OWNER: fix · P2
POST /attendance/recompute with a JSON body `{}` returns 400 (the input is `.optional()`, but `{}` fails the required fields), so a client that always sends JSON cannot drain the queue. drainRecomputeQueue also swallows recomputeDay errors with no log. Accept `{}` as "drain", and log the failures.

### E2E-034 · e2e · hr_ops · OWNER: fix · P3
Employee create/import resolves Grade by name only. Passing the grade code ("M1") fails "Unknown grade". Accept either the code or the name, as department and location do.

### Usability walkthroughs (owner scope 1–3). Screenshots and text at 1366 and 390 in /workspace/STATE/e2e/walkthrough/<role>/
ESS (RML033625, June 2026), rated 1–5:
- Leave balances: 4/5, 1 click. All 7 types show balance and reserved.
- Apply on a calendar: 4/5, 2–3 clicks. Calendar popover and live preview work. Half-day handling is limited (E2E-035).
- Per-day status: 4/5. Month calendar shows P/WO/H/L codes and a legend, but reaching a past month takes 5 clicks (4 back arrows plus the day).
- Per-session status: 1/5 (E2E-035).
- In/out punches: 4/5 (tooltip and day panel).
- Hours worked: 1/5 (E2E-036).

### E2E-035 · e2e · employee · OWNER: fix · P1 (ESS: first/second-half status, half-day sessions)
1. Per-session (first/second half) status never appears. Every day panel says "No half result posted · Half timings not configured". att.shifts has no half-boundary fields, so `session_statuses` is always NULL.
2. Applying leave offers only "First day is a half day". LeaveApplyDrawer sends `toHalf: false` hard-coded, there is no first-half/second-half choice, and a multi-day leave cannot end on a half day.
3. The API's fromHalf/toHalf booleans say nothing about which session.
Expected: shift half boundaries (seeded for GEN/G5/GCS/NIGHT); a session picker for the first and last day; and A:P / P:A shown per session as the calendar legend already promises.

### E2E-036 · e2e · employee · OWNER: uiux · P2 (ESS presentation)
- Hours worked per day are not shown anywhere, although day_records.worked_minutes is stored. The day panel has only first in, last out, late and OT.
- No month/year jump on My attendance: 4 back-clicks to reach June.
- The day panel shows "Overtime 6 min" while the card beside it says "No overtime on this record yet".
- Leave cards show balance and reserved but not accrued and used per type. Ledger rows don't name the leave type ("accrual +1.25") and use ISO dates (2026-05-01).
- The hero rounds 12.9 to "13" right next to "12.9 of 12.9".
- 390 px: the bottom tab bar overlaps the calendar's last rows in full-page view. Check that scroll padding clears it.

### E2E-037 · e2e · hod · OWNER: fix · P1 (ROLE_TASKS H3, H4)
The HOD home ("Your department today") shows Team members 0 / "No direct reports" for hod@ (head of dept 4, ~30 employees through department scope). The dashboard counts the reporting tree only, not the department. The HOD has no department muster or department dashboard.

### E2E-038 · e2e · hr_head, plant_head · OWNER: fix · P1 (HH8, PH2)
- /executive returns "You don't have access to this page" for hr_head, who should get the full CEO/HR/BU dashboards with drill-down (HH8).
- plant_head is denied /my/team and /executive. Their home has a BU summary, but the absenteeism and OT trends say "No monthly snapshots yet" even on the June snapshot, and the unit label reads "Org Unit (1)" instead of the company or plant name.

### E2E-039 · e2e · hr_ops · OWNER: fix · P1 (core path shows "not available")
Leave operations (/leave) displays "HR leave register needs a read contract — the current backend supports employee histories … but not a permission-scoped company leave-register query. No synthetic register is rendered." hr_ops therefore cannot see who is on leave or the company's balances: a core daily task with placeholder copy.

### E2E-040 · e2e · manager, hr_ops, payroll_admin · OWNER: uiux (+fix if the API needs it) · P2 (usability)
Managers must type a numeric "Company ID" to sign off their team's month (My team: "Enter the company you are signing for — never defaults to 0"). The same raw Company ID field appears on Muster, Month lock and Supporting reports. Default to the user's company and offer a named entity picker for group roles. Muster also opens on the current month with "No snapshot loaded", so every visit needs an extra Rebuild click.

### E2E-041 · e2e · all · OWNER: uiux · P3 (motion, docs/05 §2.3)
Runtime audit (document.getAnimations on 7 hr_head screens, normal and reduced motion). UI durations are 150–300 ms, stagger is 40 ms capped at 280 ms, there is no scale(0) entrance, and a keyboard-opened drawer does not slide: all OK. Gaps:
1. Reduced motion is zero, not gentler. The global `animation-duration: 0.01ms !important` also flattens the u-fade replacements, and the stagger delays (40–280 ms) still apply, so items blink in late.
2. A Tailwind `animate-pulse` (2 s, infinite) runs on the home avatar or icon tile. This is a decorative infinite loop outside the tokens.
3. u-gold-sweep uses --motion-counter (800 ms) plus a 160 ms delay on a non-KPI element (index.css:326), which is over the 300 ms UI ceiling.


### E2E-042 · e2e · employee · OWNER: fix · P1 (ROLE_TASKS loan apply, HH2-loan chain; regression of the E2E-001 route guard)
Employees can no longer apply for a loan. /loans is not in the route guard's SELF_SERVICE list, and nav-config only shows "Loans" to payroll.run.manage / payroll.reports, so an employee on /loans gets "You don't have access to this page". LoansPage itself still has My Loans / Apply tabs that call /api/loans/my and /api/loans/apply. Expected: an ESS entry (e.g. /my/loans or a My Pay → Loans tab) that employees can reach; keep the Company Loans tab for payroll. Test: HH2-loan.

### E2E-043 · e2e · employee · OWNER: fix · P1 (ESS resignation, E18 / HH2-resign)
On /lifecycle/separation an employee gets a red "Missing permission: one of lifecycle.separation.approve, payroll.run.manage, assets.manage" toast on every visit and after submit, because the page loads GET /api/lifecycle/separations (admin list) and the clearances list for every user. The resignation itself IS saved (core.separations row, status pending), but the employee sees an error and the pipeline shows "No active separations", so they cannot see their own resignation status or LWD. Expected: an own-separation read (e.g. /separations/my) for ESS; only call the admin lists when the user holds the permission. Tests: E18, HH2-resign.

### E2E-044 · e2e · manager · OWNER: fix (+uiux) · P2 (ROLE_TASKS M7, RQ-RPT-06)
My Team (/my/team) shows the month grid but has no Excel export of the team muster. Muster summary (/attendance/muster) has "Export Excel", but only after a snapshot is loaded and a Company ID typed (see E2E-040). Expected: an Export control on the team grid, scoped to the manager's tree. Test: M7.

### E2E-045 · e2e · hr_ops (RML) · OWNER: fix · P0/P1 security (scope isolation, RQ-RBAC entity scope)
HR Ops scoped to RML (org unit 1) can issue a letter for an RGH employee: POST /api/letters/issue {employeeId: 11 (RGH000001), templateCode: "experience", extraFields:{dol}} → 200 {letterId, documentId, workflowRequestId}. Leave adjustment and attendance override for the same RGH employee are correctly refused (403). Before the scope check the endpoint also resolves merge fields of the out-of-scope employee ("Missing merge fields: dol"). Expected: 403/404 before any employee data is read. Test: SCOPE-WRITE (tests/api/scope.spec.ts).

### E2E-046 · e2e · employee · OWNER: uiux · P3 (usability)
Leave apply: when the dates overlap an existing open/approved leave, the message "An open or approved leave already covers these dates" is attached to the "Why are you taking this time?" field (red border on the reason box) instead of the date fields, and no toast appears. Employees read it as a problem with their reason. Show it on the date pair (and name the clashing request).

NOTE (client decision, not a bug) · NEG-UI payroll_admin → /admin/workflows: payroll_admin can open and edit Approval chains. This matches docs/08 (admin.settings ✓ "payroll policies"; "admin.settings authorizes … chain edits"), so the suite now allows it. If payroll should only edit payroll chains, the chain editor needs per-chain scoping (fix).
## UI-01 (found by uiux, owner: fix)
- Role: employee/alumni — /alumni (AlumniPortalPage.tsx:187)
- "Statutory Gratuity Included: ₹1,67,639.00 (Golden G8)" is a hard-coded literal, not data from the API. Expected: real F&F gratuity or a dash. Actual: same fake figure for everyone.

## Found by payroll (job/payroll, 19-Oct IST)

### PAY-001 · payroll · payroll_admin · OWNER: payroll · P1 (P-19) · FIXED eb4689d (payroll)
Assigning a probation salary (phase=probation, probation_percent 70/80/90) always returns 400 "breakup does not match CTC". The scaled breakup was validated against the confirmed CTC. Fix: validate the unscaled breakup.

### PAY-002 · payroll · hr_head/HR · OWNER: payroll · P0 (money) · FIXED eb4689d (payroll)
An approved resignation or termination left employees.dol NULL until the F&F was paid. Payroll paid the leaver the full month, and the attendance close expected day records after the LWD. Fix: approval sets dol = approved LWD; withdraw or reject clears it.

### PAY-003 · payroll · payroll · OWNER: payroll · P1 (money) · FIXED 1e10603 (main ee78307)
A half-day of paid leave (HD + CL) was always paid 0.5, even when the other half was worked; a half-day of LWP with no work was also 0.5. Fix: leave approval keeps the other half's punches, recompute refreshes them, and payroll pays the leave half (if paid) plus the worked half. Matrix M04–M07.

### PAY-004 · payroll · payroll · OWNER: payroll · P1 (statutory) · FIXED d6656b4 (main ee78307)
Old-regime TDS had no surcharge (10% above ₹50L, 15% above ₹1Cr, 25% above ₹2Cr, 37% above ₹5Cr, with marginal relief). Matrix M38: monthly TDS is 152,226; before the fix it was 138,388.

### PAY-005 · payroll · it_admin/ops · OWNER: fix · P2 (robustness)
The backend process exits on an unhandled pg pool 'error' event, for example when its DB is dropped or terminated (pg_terminate_backend, or DROP DATABASE … WITH (FORCE)). Expected: log the error and let the pool reconnect or fail the request, without crashing the process. Workaround: restart the backend after a DB reset.

### PAY-006 · payroll · payroll · OWNER: fix (TDS item 3) · P3 (data hygiene)
pay.it_slabs is seeded with FY 2024-25 new-regime values (3L/7L slabs, 87A threshold 7L / max ₹25k) labelled '2025-26'. There are no old-regime rows and no 2026-27 rows. The engine (statutory/tds.ts) does not read this table; it uses hard-coded Budget-2025 slabs, which are correct. Either drop the table or make it the source, with correct FY 2025-26 / 2026-27 rows.

### PAY-007 · payroll · employee · OWNER: payroll · P2 · FIXED d6656b4 (main ee78307)
ESS holiday calendar (MyAttendancePage) listed every holiday of every location and company. Fix: GET /attendance/config/holidays?mine=true returns only the holidays that apply to the caller; MyAttendancePage uses it.

### PAY-008 · payroll · super_admin/hr_head · OWNER: uiux · P3 (UI follow-up)
Admin → Attendance masters → Holidays can only pick a location. The API (companyId/plantId/locationId) and the Excel importer (Company/Plant/Location columns) support company and plant holidays; add Company and Plant pickers to the form.

### PAY-009 · payroll · employee · OWNER: fix · open (P-25)
Employees cannot declare 80C themselves without payroll.run.manage (ESS declaration path). The seed falls back to payroll declaring on their behalf. Check against the fix job's item-3 TDS module (c017496), which may already resolve this.

## UI-02 (uiux) FIXED in job/uiux — frontend/API field drift crashed three screens
- /lifecycle/separation (all HR roles + manager): list API returns employeeName/departmentName/designationName; page read name → "Route failed to render". Frontend now accepts both.
- /reports/r29-helpdesk: page read slaHitPct/slaBreachedTickets; API returns resolutionRatePct/breachedCount → toFixed crash. Frontend aligned.
- /reports/r26-attrition: page keyed rows by separationId (API sends id) → duplicate React keys; lwd→dol, no tenureMonths. Frontend aligned.

## UI-03 (uiux, owner: fix) — nav shows screens whose data APIs 403 for that role (BEFORE crawl, snapshot DB)
- hr_head, hr_ops, payroll_admin, plant_head: GET /api/attendance/devices 403 (page in their nav / dashboard).
- it_admin: /api/attendance/absence-cases, /api/attendance/exceptions/unmatched 403. payroll_admin, plant_head: exceptions/unmatched 403.
- manager, plant_head, ceo_cell: /api/lifecycle/{candidates,onboarding-reference-data,tasks,transfers} 403 (Lifecycle in nav).
- hr_ops: /api/lifecycle/probation/{alerts,reviews} 403. payroll_admin: /api/reports/r26|r27|r29 403 while listed on Reports.
- super_admin (no employee record): /api/claims/my, my-entitlements, loans/my, policies, travel/wallet → 400.
- /api/recruitment/requisitions 404 for every role; /api/reports/executive 404 for ceo_cell.
Expected: either grant the permission or hide the nav item / panel (frontend nav-config gating by permission once you confirm which is intended).

### PAY-010 (payroll job) — Kent-only month can never be locked: no-swipe days never get a day record — FIXED a450f95 (main e31f772)
Absences, Sundays and holidays with no swipe were never queued for recompute (only swipe inserts, roster/holiday edits and leave queue days), so readCloseReadiness reported missing days and `attendance_complete` blocked every month lock for punch-fed employees. Fix: queueMissingDays + hourly `attendance-materialize` job (att.materialize_lookback_days, default 45) + POST /attendance/recompute {companyId, from, until}. Proven by matrix K01/K02 (fail with the materialiser disabled).

### PAY-011 (payroll job) — fresh install: month lock always refused (manager_approvals) — FIXED a450f95 (main e31f772)
Migration 1751900000000 inserts att.manager_approval_required_for_lock=false before seed:settings (ON CONFLICT DO NOTHING), and the checklist treats false as invalid ("repair the policy configuration"). On an empty DB + migrations + seed no month can be locked. Fix: migration 1752700000200 sets it true.

### PAY-012 (payroll job) — muster LOP disagreed with the payslip — FIXED a450f95 (main e31f772)
Muster counted every HD as 0.5 LOP and ignored the sandwich rule / FIXED_26 week-off exclusion, so e.g. half-day CL + worked half showed 0.5 LOP but was paid in full. Muster now uses payroll's unpaidDayEquivalents.

### PAY-013 (payroll job, note for fix/owner) — month-lock `unmatched_swipes` is not company-scoped — OPEN
The checklist counts every unmatched swipe in the window across all companies (unmatched swipes have no employee). One unknown e-code at any plant blocks every entity's lock. Suggest scoping by the door's location → company. Not changed (fix owns ingest/Kent).

## Found by reqs (owner docs 19 Oct 2026: joining form RML/HR/02/01 ×3 + Enterprise Blueprint). Maps: /workspace/STATE/JOINING_FORM_MAP.md, /workspace/STATE/BLUEPRINT_GAP.md; rows RQ-JF-*, RQ-BP-* in requirements/REQUIREMENTS.md (main 7e6cb28)

### REQ-001 · reqs · hr_ops/candidate · OWNER: fix · P1 (RQ-JF-001, data integrity)
Pre-join → convert skips master validation. Steps: candidate submits the pre-join form with Aadhaar that fails Verhoeff / IFSC "ABCD1234567" / account "1234567A" / an Aadhaar or UAN already on another employee → HR converts. Expected: the same errors POST /employees gives (bulk/importers/employees.ts rules, incl. 18+ on DOJ and duplicates on PAN/Aadhaar/UAN/ESIC/account). Actual: prejoin-schema.ts checks lengths only; onboarding.service.ts inserts core.employees directly; the duplicate check covers email/mobile/PAN only. Fix: run employeesImporter.validate (or a shared validator) in prejoin submit and convert.

### REQ-002 · reqs · candidate/hr_ops · OWNER: fix · P1 (RQ-JF-003, RQ-JF-007, data loss)
Pre-join data is dropped or never set. (a) The emergency-contact relationship is required on the portal but has no column, and convert discards it. (b) Gender isn't asked on the portal, and convert leaves core.employees.gender NULL. That breaks ESIC/maternity/statutory exports. The API/UI enum is Male/Female/Other; the forms (and EPF/ESIC) use Male/Female/Transgender. Expected: both persisted, and the gender label reads Transgender.

### REQ-003 · reqs · payroll_admin · OWNER: fix (coordinate payroll) · P1 (RQ-JF-014, statutory money)
The EPS split is applied to every member. statutory/pf.ts always puts 8.33% of min(PF wages, 15,000) into EPS. EPF Form 11 history isn't captured (earlier EPF/EPS member, member before 01-Sep-2014, previous PF no., exit date, withdrawals, international worker). Expected: new members joining on/after 01-Sep-2014 with PF wages > ₹15,000 at joining get no EPS (full 12% ER to EPF), EPS stops at age 58, and international workers have no wage ceiling. Add the Form 11 fields to the employee and the eligibility to the engine; re-run recon (the 44-employee cohort must still MATCH, so confirm their flags with the register first).

### REQ-004 · reqs · candidate/hr_ops/employee · OWNER: fix · P1 (RQ-JF-017, BP-200)
Nobody can upload or verify a document. core.documents + doc.types (pan, aadhaar, appointment, medical_fitness) exist, but there's no upload/list/verify API, the pre-join portal has no uploads, photo_path is never set, and Profile > Documents only links to letters. Expected: a document checklist per category (photo, PAN, Aadhaar, bank proof, education, experience/relieving, payslips, passport/DL, medical fitness, disability cert) uploaded on pre-join and profile; HR verifies or rejects each with a reason; convert is blocked while a mandatory doc is missing.

### REQ-005 · reqs · hr_ops · OWNER: fix · P1 (RQ-JF-005)
HR can't key or correct most joining-form fields. POST/PATCH /employees (employee-master.router.ts) and the importer lack personal e-mail, marital status, blood group, present/permanent address, emergency contact, plant and cost centre. These are only ever set by pre-join conversion, so a walk-in joiner's paper form can't be entered and mistakes can't be fixed.

### REQ-006 · reqs · candidate/hr_ops · OWNER: fix · P1 (RQ-JF-002, -004, -006, -008, -009, -011, -012)
The joining-form data model is missing. Add (see JOINING_FORM_MAP §5):
- Personal extension: father's name, spouse name, marriage date, nationality, country of origin, religion, caste (restricted), height, weight, PwD, identification mark, passport + validity, DL, name as per Aadhaar.
- Marital-status enum per EPF.
- Structured addresses with a 6-digit PIN and state.
- Bank branch, account holder name and account type.
- Education, previous employment and family grids (gender, residing, disease), captured on pre-join.
All must be exposed in POST/PATCH /employees + prejoin submit + the importer template.

### REQ-007 · reqs · employee/hr_ops · OWNER: fix · P1 (RQ-JF-013)
Nominations aren't scheme-wise. One is_nominee + nominee_share_pct on employee_family serves every scheme. Expected: separate nominations for PF/EPS, gratuity (Form F), ESIC s.71 and insurance, each with nominee address, shares totalling 100 per scheme, a guardian for minors, and Form F witnesses + employer certification. F&F gratuity payout on death must use the gratuity nomination.

### REQ-008 · reqs · candidate · OWNER: fix · P2 (RQ-JF-016)
No declaration/consent/e-sign record. The pre-join submit has no §10 declaration, EPF undertaking or ESIC declaration, and prv.consents isn't wired. Expected: submit is blocked until the declaration is accepted and signed, and the store keeps the text version, timestamp, IP and signature.

### REQ-009 · reqs · hr_head/hr_ops · OWNER: fix · P1 (RQ-BP-121, BP-120)
Separations have no type. core.separations only knows initiated_by employee|hr plus the absconding path. Expected: type = resignation / termination / retirement / death / contract expiry / misconduct / restructuring / mutual, driving gratuity eligibility (death and disablement waive the 5-year rule; the payee is the nominee), notice rules and letters. The exit chain also has no Business Head or Finance (F&F) approval step; see D4 in BLUEPRINT_GAP.md.

### REQ-010 · reqs · hr_ops · OWNER: fix · P2 (RQ-BP-020, BP-014)
Master edits aren't effective-dated. PATCH /employees changes designation/grade/RM/department/employment type immediately; it writes audit_log but no core.employee_history row, and takes no effective date, reason or reference. Expected: an effective date (future-dated changes apply on the day), a history row with old/new, approver and reason, and an "as of" view.

### REQ-011 · reqs · hr_ops/payroll_admin · OWNER: fix · P1 (RQ-BP-111, RQ-BP-112)
Bulk import has no checker and no undo. The uploader can commit their own job (core/bulk/engine.ts), and there's no reversal of a committed batch; savepoint rollback only covers commit failure. The blueprint makes both mandatory for salary, employee and attendance imports. Expected: a maker ≠ checker approval before commit, and "Reverse batch <job id>" that restores the prior values (blocked once a payroll run that used them is finalised).

### REQ-012 · reqs · payroll_admin · OWNER: fix · P1 (RQ-BP-110)
There's no pre-payroll validation for missing identifiers. Missing bank/IFSC is only caught when the bank file is generated (bank-file.service.ts); missing PAN (TDS at 20%, s.206AA), UAN for PF members, ESIC IP for ESIC-eligible staff, bank details changed this month, and excess OT aren't flagged before compute. Expected: a pre-run checklist listing each, which payroll can export and acknowledge.

### REQ-013 · reqs · all approvers · OWNER: fix · P2 (RQ-BP-230, RQ-WF-011, RQ-BP-080)
Workflow routing and OT are too thin. workflow-definition.ts supports only sequential RM/FM/department_head/role/user steps: no amount-based (claims, travel, loans), plant-head or conditional steps. OT has one type, decided by the manager alone, so holiday/WO/night OT rates and an OT approval chain can't be set.

### REQ-014 · reqs · super_admin/payroll_admin/hr_head · OWNER: fix · P2 (RQ-BP-240, RQ-BP-241)
Security roles are incomplete. sec.mfa_enrolments exists but there's no MFA enrol/verify API or UI; MFA should be mandatory for super_admin, payroll_admin and hr_head before go-live. There's no read-only Auditor role (Protiviti / internal audit) and no Finance role for F&F/payment approval.

### REQ-015 · reqs · hr (medical) · OWNER: fix · P2 (RQ-JF-018, BP-242)
The medical questionnaire (variants B and C) has nowhere restricted to go. Before any health data is collected, add a separate store with its own permission (never manager-visible), DPDP consent, retention class and access audit. Until then, do not add medical fields to employee_family or the profile.

### REQ-016 · reqs · candidate/hr_ops · OWNER: uiux · P2 (RQ-JF-022)
The joining form UI is a 12-field single page (PrejoinPortalPage.tsx). Once REQ-005/006 land, build a multi-step form in RML/HR/02/01 order:
- Steps: official → personal → address → statutory → bank → education → certifications → experience → family → nominations → emergency → documents → declaration + signature → review.
- Repeating-row editors, "same as present", format hints (PAN/Aadhaar/IFSC/PIN masks), save draft and a progress bar.
- 360–430px one-hand layout, WCAG AA.
The same component goes in the HR "New joiner" drawer (EmployeeFormDrawer.tsx).

### REQ-017 · reqs · employee/hr_ops · OWNER: uiux · P2 (BP-060)
The Profile Documents, Assets and Requests tabs are link-only empty states (ProfilePage.tsx). When REQ-004 lands, Documents should show the real repository (status chips: pending, verified, rejected, expiring), and Assets should list the employee's assignments from /assets/held-by/{employeeId}. Also add Personal (extended), Address, Education & Experience and Nominations sections.

## GUIDE-01..05 (found while writing role guides, owner: fix unless noted) · P1
- GUIDE-01: Employee self-resignation not reachable — resignation form lives under /lifecycle which employees can't open. Expected: ESS "Resign" entry for every employee.
- GUIDE-02: API-only / no UI: Kent "Sync now", manual attendance override, leave adjustment/cancel/encashment, approval delegation, user unlock/reset/deactivate. Expected: screens for each.
- GUIDE-03 (owner: uiux + fix): hr_ops/hr_head/payroll_admin/plant_head have no My Attendance / My Leave in nav; everyone is also an employee and needs self-service in the menu.
- GUIDE-04: ceo_cell has no approvals inbox, but CEO offer/separation approval steps are planned.
- GUIDE-05 (owner: uiux): no AFTER crawl yet for ceo_cell, it_admin, super_admin.

### REQ-003 coordination note · joining job → payroll job (02:20 IST)
The joining job (worktree /workspace/wt/joining, branch job/joining) now owns REQ-003 **data capture** (Form 11 fields in the master API, prejoin portal, importer, Form 11 PDF). Payroll owns the EPS **calculation**.
- Joining will WRITE your columns as-is: `core.employees.epf_member_before_sep2014, epf_first_enrolled_on, epf_first_wages, international_worker, eps_eligible` (seen in your uncommitted 1752700000300_epf-form11-eps.ts). Please keep those names.
- Please make that migration use `ADD COLUMN IF NOT EXISTS` for all five. Joining's migration (17529xxxxxxxx) also declares them `IF NOT EXISTS` with the same types, so either merge order works on fresh and existing DBs.
- The rest of Form 11 goes into a new 1:1 table `core.employee_statutory_profile` (prev EPF/EPS member, prev PF no., prev exit date, scheme cert / PPO no., EPF/EPS withdrawn flags, ESIC previous IP / dispensary / branch). You don't need it for EPS. `eps_eligible` stays NULL for new joiners unless HR confirms it, so your derive-from-enrolment-date rule applies.
- Joining won't touch statutory/pf.ts, compute-engine or run-compute.
