# Attendance → holidays → approvals → payroll: task-based QA

21 October 2026 · local working checkout · Phase 1, Stage 1.8 review.

**Result: the synthetic attendance-to-payslip journey works, but this is not a clean acceptance pass. Six reproducible product/UX findings remain, including a cross-account draft disclosure. Backend focused tests: 63 passed, 1 failed. Frontend tests: 365 passed, 10 failed.** No application fix, deployment, actual bank transfer or external email delivery was performed in this review.

## What was actually exercised

Five separate synthetic logins were used: employee, reporting manager, scoped HR operations, scoped payroll administrator, and HR head. Each browser transition used sign-out and the normal login form. The browser used the existing localhost:5173 frontend and localhost:5100 API. Native API calls used the same accounts and API. PostgreSQL observations independently checked attendance, ledger entries, notification receipts and frozen state.

Synthetic company `QA216002750`, company ID 8860; employee 371172; manager 371171; payroll run 2066. The fixture contains one September payroll employee, a ₹30,000 BASIC-only package, no PF/ESIC applicability, and five opening CL days. The manager joins in October so is excluded from September's payroll population. September days are controlled test inputs, not evidence of real Kent ingestion. Dates 24–26 September start absent; other days are fixture presence. Manual attendance mode avoids claiming that a simulated device proves live biometric readiness.

| Task / handoff | Evidence | Result |
|---|---|---|
| Employee finds correction from Home | Home → Regularise opens the drawer in one navigation action | Pass |
| Submit first-half AR for 24 Sep | Browser request 6534, manager named in preview and inbox | Pass |
| Reject without note | Browser displays “Add a decision note”; request remains pending | Pass |
| Manager approves first-half AR | Browser approval; DB becomes HD, sessions P:A, `applied=true` | Pass |
| Overlap with approved first half | New first-half AR receives 400 and explanatory message | Pass |
| Employee approves own pending leave | Request 6535 action receives 403 | Pass |
| Paid leave for 25 Sep | Employee API submission → manager approval → L/CL; ledger debit exactly -1 | Pass |
| HR finds and creates holiday | More → Attendance masters → Add; scoped company preselected; 26 Sep saved | Pass |
| Holiday effect on attendance | Subject-only normal recomputation changes 26 Sep from A to H | Pass, processing invoked explicitly |
| Scoped HR attempts other company/group holiday | Both writes refused with 403 | Pass |
| Close without manager attestation | Month-lock refuses with `manager_approvals` | Pass |
| Manager attests and payroll closes | Manager API attestation → month-lock ID 1859 | Pass |
| Attempt correction after lock | Second-half AR receives 400, “period is locked for payroll” | Pass |
| Payroll compute before attendance lock | 409; no computed pay published | Pass for safety, recovery flaw F04 |
| Compute using locked attendance | One employee, no exceptions, ₹29,500 gross / ₹29,350 net | Pass |
| Independent reconciliation | Zero discrepancy, no line mismatch or negative net | Pass |
| Employee/HR Ops attempts payroll register access | Both receive 403 | Pass |
| Maker attempts checker approval | 403, missing `payroll.run.cosign` | Pass |
| Maker sends review; HR head approves and finalizes | Browser actions; typed `FINALIZE SEPTEMBER 2026`; distinct checker 18549 | Pass |
| Employee pay before finalization | `getMyPayslip` returns null | Pass |
| Bank file before finalization | Refused with clear state message | Pass |
| Bank file missing employee bank information | Refused rather than silently omitting employee | Pass |
| Bank file after dummy fixture banking added | One synthetic record, ₹29,350, batch 45 | Pass, no transfer |
| Mark paid without bank file | 409 | Pass |
| Simulated paid transition | Reference `QA21-SIMULATED-NO-TRANSFER`; paid state recorded | Pass, local simulation only |
| Recompute paid run | 409 illegal transition | Pass |
| Repeat payslip archive generation | Zero new items/generated documents | Pass |
| Employee sees final payslip | Browser My Pay: ₹29,350 net, 29.5/30 days, 0.5 LOP and BASIC proration note | Pass |
| Future half OD send-back → edit → resubmit → approve | Request 6537 changes second half to first half; history preserves both decisions | Pass via API |
| Future OD remains request coverage | Employee request history shows approved first-half OD; no future absent calendar record was fabricated | Pass for observed browser state |
| Cancellation after payroll lock | Request accepted, approval fails; rejected during cleanup | F05 |
| Draft survives own navigation | Keep draft stores reason | Pass, but isolation fails F01 |
| Draft after account switch | Manager's own form displays employee's saved reason | **Fail F01** |

## Hand-checked monetary result

Initial controlled payable days: 27. First-half AR adds 0.5, paid CL adds 1, holiday adds 1. Final total: **29.5 paid days; 0.5 LOP**.

`₹30,000 × 29.5 ÷ 30 = ₹29,500 gross`; configured WB PT for this gross is ₹150; no other fixture deductions; **net ₹29,350**. This is a calculation against the local configured policy, not a legal/statutory-rate certification. Both register and employee pay page show these exact values. The generated synthetic bank batch also totals ₹29,350. DB rows 24–26 September remained locked and unchanged after refused corrections/cancellation.

The leave ledger returns to four CL days after neutralising the legacy suite's unrelated future accrual. Approved workflows have populated `notified_at`. These are database receipts/queued events, not proof of email delivery.

## Reproducible findings

### F01 · P1 · Saved attendance draft discloses one account's text to the next account

Requirements: CORE-10, NFR security, docs05 §6 draft persistence.

1. Employee opens Regularise and enters `QA21 EMPLOYEE PRIVATE DRAFT - synthetic cross-account isolation probe`.
2. Click Keep draft; sign out.
3. Log in as the manager in the same browser/origin.
4. Open the manager's own attendance correction drawer.
5. The employee's text is already populated in the manager's reason field.

This exposes potentially private attendance reasons on shared computers and can cause submission under the wrong employee. No approval authority was needed to read the draft.

Evidence: [DOM with manager account and employee text](cross-account-draft-dom.txt), [screenshot](cross-account-draft.png). Source: `frontend/src/pages/attendance/AttendanceRequestDrawer.tsx:8,28,58`; constant storage key `rashmi.draft.ar` is shared by every user. `frontend/src/lib/session.ts:103` logout clears tokens but does not segregate drafts. Leave uses the analogous global `rashmi.draft.leave` key (`LeaveApplyDrawer.tsx:7`); that variant is a source-identified risk, not a separately executed reproduction.

Repair direction: scope draft storage to immutable user/employee identity, refuse legacy drafts without ownership, and test logout/login across two users. Retain same-user autosave. Verify attendance and leave independently. **Fix before shared-device rollout.** The synthetic draft text was cleared after evidence capture.

### F02 · P2 · Cross-month correction falsely says the date has no posted attendance

Requirements: ATT-03/05/06, CORE-14, docs05 feedback clarity.

From October My Attendance, open Request regularisation and choose 24 September in both date pickers. The drawer states “No attendance is posted for these dates yet, so they are not absences,” although PostgreSQL has the September A/A day. The correction still submits and approves, so this is misleading guidance rather than failed write-back.

Source: `MyAttendancePage.tsx:453` passes only the displayed month's dates to `AttendanceRequestDrawer`; `requestInaction` at drawer line 109 treats missing dates as authoritative absence of records. Changing the request date range does not fetch its posted state. DB evidence is in [db-evidence.jsonl](db-evidence.jsonl).

Repair direction: load the requested period or use an explicit unknown/loading state; never equate “not in this month's loaded data” with “not posted.” Test crossing month/year boundaries.

### F03 · P2 · HR dashboard treats zero recorded absences as complete attendance

Requirements: ATT-02/03/12, docs05 honest data states.

With two scoped synthetic employees and **zero processed records today**, HR Ops shows “No one marked absent so far today — all 2 people on rolls accounted for.” The manager correctly shows the employee as Awaiting record. Group HR also displayed the same completion claim alongside a silent-device warning.

Source: `frontend/src/pages/home/HrOpsDashboard.tsx:126` selects this wording solely because `absentToday` is zero; it does not establish full processed coverage. This can falsely reassure HR before processing or while data is missing. Month-close safety itself remained effective.

Repair direction: display processed/expected/awaiting counts and reserve “accounted for” for proven completeness; reconcile the wording with device and watermark holds. Browser AX observations were captured during this run; a separate screenshot of this specific dashboard state was not retained.

### F04 · P2 · Closing attendance does not repair a payroll run locked too early

Requirements: ATT-15, PAY-03/18.

1. Create payroll draft before attendance close; Lock inputs succeeds with null `attendance_lock_id`.
2. Compute refuses, correctly.
3. Complete manager attestation and attendance close.
4. Compute **still** refuses, “Attendance month must be locked first (attendance_lock_id is required),” even though lock 1859 now exists.
5. Back to draft → Lock inputs → Compute recovers and gives the correct pay.

Evidence: sequential request responses in [api-evidence.jsonl](api-evidence.jsonl), run 2066. Source: `run.service.ts:119` refreshes the lock reference only during input locking; the compute state guard evaluates the stale stored reference first.

Repair direction: either block Lock inputs until a valid company/month attendance lock exists, or resolve/attach it atomically at the supported recovery point. Give an explicit recovery instruction. Do not relax closed-period checks.

### F05 · P2 · Locked leave cancellation enters an unapprovable queue

Requirements: LV-08, ATT-15, WF-01, CORE-14.

After run 2066 is finalized, cancellation of approved September leave 728 returns 200 and creates request 6536. Manager approval returns 400, “Attendance month is locked — contact HR for a historical correction.” The request remains pending until separately rejected. The ledger and locked attendance stay intact.

Source: `leave-apply.service.ts:156` checks ownership/status but not period writability during request creation. Its completion hook checks the lock at line 198. The test rejected the blocked request with the historical-correction explanation so no pending cancellation remains.

Repair direction: refuse an already-locked cancellation during submission with the HR correction route; retain the final transactional guard for races. Cover locks occurring both before submission and between submission/approval.

### F06 · P2 · Group dashboard fan-out throttles the next task, which then shows a false empty state

Requirements: CORE-14, NFR performance/reliability, docs14 scale-safe reads.

Log in as group HR head on this accumulated local QA dataset (1,416 companies at that observation), then follow Open payroll runs. Payroll displays `Request failed (429)` **and** “No payroll runs yet,” although run 2066 exists and is awaiting this checker. Reload after the limiter window recovers it; checker approval then succeeds.

Evidence: [checker-load-error.png](checker-load-error.png). Source explains the load mechanism: `LeadershipInsights.tsx:168–182` fires one boarding-report request per company via `Promise.all`; `PayrollPage.tsx:112` replaces a failed run load with `[]`. Default API rate limit is 100/minute per authenticated user (`backend/src/api/rate-limits.ts:22` and `app.ts:194`). The observed 429 and false empty state are confirmed; causation from the fan-out is source-supported, not a captured network trace. Company count reflects test-fixture accumulation, not the production company's legal-entity count.

Repair direction: one bounded consolidated reporting endpoint or controlled batching; distinguish load error from a successfully loaded empty list and provide Retry. Recheck with the normal entity catalog and an accumulated QA catalog.

## Test gates and supporting coverage

Executed with existing installed dependencies and native local PostgreSQL. Logs retained, no tests claimed from historical handovers.

| Suite | Fresh result |
|---|---|
| `half-attendance-requests.integration` | 10 passed |
| `holiday-calendar-api.integration` | 1 passed |
| `attendance-cycle-holiday-scope.integration` | 3 passed |
| `month-close-readiness.integration` | 11 passed |
| `payroll-attendance.integration` | 4 passed |
| `workflow-scope.integration` | 5 passed |
| `stage14-requests-overtime.integration` | 15 passed |
| `stage15-leave.integration` | 14 passed |
| `payroll-run-lifecycle.integration` | 1 failed |
| Frontend full unit suite | 365 passed, 10 failed; 51/52 files passed |

Backend failure: `payroll-run-lifecycle.integration.test.ts:94` directly inserts a second active bank batch after reopen and hits `bank_batches_one_active`. The product's normal generator supersedes the previous active batch; this test bypasses that generator and is incompatible with the active-batch constraint. Treat this as a test-fixture regression, not proof that normal bank generation is broken. The successful normal generator was independently exercised above. The legacy reopen/recovery test still needs repair and a green rerun.

All ten frontend failures are in `MyAttendancePage.test.tsx`. Assertions expect visible P:O, OD, SL, HD/SL or half-session glyph text in the selected date button, but receive only its date number. Current `MonthCalendar.tsx:179` explicitly hides the glyph for `isSelected`, and hides it under an event span. Accessible labels still carry status, and details may show it; the failing tests alone do not establish ten separate product defects. Resolve the intended visual contract, test the selected/unselected/spanning cases in both themes and restore this gate.

See [backend-focused.log](backend-focused.log) and [frontend-tests.log](frontend-tests.log). These failures mean full `npm run verify` cannot be described as green; a full verify/coverage/build run was not performed for this audit because no application source was changed.

## Ease of use observed

| Task | Observed strengths | Friction |
|---|---|---|
| Employee correction | Home quick action, half timings, manager preview, success toast and history link | Cross-month guidance incorrect; independent From/To pickers require repeated month navigation |
| Manager decision | Home count leads to inbox; pending item already selected; explicit consequence and notification timestamp; note required for reject/send-back | Delegation setup occupies the top of the small-screen inbox before the queue; would be easier as secondary disclosure |
| Holiday maintenance | Scoped HR sees Attendance masters and only its own write target; one-company scope preselected | Holiday functionality is behind More → Attendance masters; plant/location API scopes have no corresponding fields in the add form |
| Payroll maker/checker | Register explains paid/LOP days; maker lacks checker button; clear typed finalization | Early-lock recovery F04; failed loads represented as empty F06; finalization phrase names month but not entity |
| Employee payslip | Home → Payslip, latest finalized month selected automatically, exact pay and proration explanation | Formal PDF rendering/printing, exported-file layout and download accessibility not assessed |
| Switching users | Normal sign-out returns to login, business data access changes with roles | Shared draft F01 defeats account isolation |

Browser initially used its default narrow layout and dark theme; an explicit phone-sized override was also used. The browser reported a rendered CSS width of 487px despite the requested 390px override, so this is narrow-layout evidence, **not a certified 390px device test**. Pay-page measured scroll width equalled viewport width and its displayed values fit. Wider desktop, full keyboard-only journeys, contrast measurement, axe browser scans and every page/role combination remain unverified. Native component tests cover both themes but do not replace visual/contrast QA.

## Environment and cleanup record

- Existing local `hrms` database was used; no database was created/reset, no migration was applied, and both existing dev servers were retained. Existing application edits were not modified by this audit.
- The older Stage15 suite invokes **global** monthly accrual; it added 66 future-dated credits, including accounts beyond its own fixture. Those exact invocation-window rows were offset by 66 immutable compensating adjustments with original-row references and audit entries. Evidence: [suite-accrual-cleanup.json](suite-accrual-cleanup.json), reproducible cleanup code in `fixture-maintenance.mjs`. No ledger trigger was disabled and original rows were preserved.
- The older escalation tests also re-notified/restamped four pre-existing pending local requests (5606, 5608, 5672, 5763), recording eight audit updates for missing escalation targets. They remained pending; those original SLA timestamps were not recoverable from their audit `old_value` fields and were not guessed/restored. This is a residual test-harness side effect, not a claim of perfectly restored database state.
- No worker process was observed. 527 queued test-window/fixture notifications were marked dead with a “local test output quarantined; do not deliver” reason so they cannot later be mailed by a worker. Database notification timestamps prove enqueue/routing only. Evidence: [notification-cleanup.json](notification-cleanup.json). Do not rerun those global suites against shared data without transaction-scoped or dedicated fixture targeting.
- All five new synthetic accounts were disabled, role grants detached and sessions revoked; both synthetic employee rows marked exited. Synthetic open recomputation work was removed. Locked attendance, ledger/audit history, paid run and generated synthetic artifacts remain as clearly identified evidence. No real transfer was made; “paid” is a local simulation.
- The test draft text was cleared and browser viewport override reset. Existing user-owned work was preserved. Source and environment observations are dated to this working checkout; subsequent concurrent edits require a fresh focused rerun.

## Acceptance still outstanding

Live Kent ingestion/backfill/outage recovery, actual SMTP delivery, production storage, bank/SAP/government-file format receipts, real payroll parallel-cycle reconciliation and human HR/Finance UAT were not certified. The focused native suites cover OT expiry/comp-off, holiday scoping/divisors, leave/cancellation/RH/encashment, routing scope and month-close safety, but not every branch through a real browser. HR/Finance should not interpret one successful synthetic pay example as production approval.

Recommended next repair order: **F01 draft ownership → F03 truthful attendance completeness → F04/F05 close/cancellation recovery → F02 period-aware guidance → F06 bounded reporting/error recovery → restore both red test gates → repeat the same task journey.** No phase gate has been promoted.
