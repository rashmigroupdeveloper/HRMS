# Required role handoffs and data connections

17 Oct 2026. This is an implementation handoff for the **remaining work**, based on docs01/04/08/13/14 and current code. It is not permission to build multiple stages at once or invent unspecified policies/schema. Preserve earlier plan decisions and obtain the actual authorized ATS/Kent contracts. Claims and budgets remain deferred.

## 1. Attendance: employee → manager → HR → payroll

**Facts:** `core.employees.id` is the internal subject; e-code/external employee number is mapped at intake. `att.swipe_events` retains immutable device events. `att.rosters` and `att.employee_shifts` resolve `att.shifts`; location holidays/week offs apply. Device mapping + `att.device_watermarks` determine when absence is safe. `att.recompute_queue` schedules recomputation; `att.day_records(employee_id, work_date)` stores the derived daily and ordered half results.

**Requests:** employee selects dates and whole/first/second half using `/attendance/requests/schedule`. Windows come from configured shift fields. `att.regularizations.workflow_request_id` links the authoritative request to `wf.requests` and actual `wf.request_steps`. The domain `day_portion` reserves coverage. Final approval applies P for AR or OD for official duty to the selected half; P:A/A:P is HD. Other-half facts continue to recompute. Manual/locked/leave/off-half conflicts cannot be overwritten by an approval retry. Short permission remains bounded from/to time, not a different half-day policy.

**Manager screen:** actual scoped team days/swipes, selected request half, configured timing, reason and workflow history. Approve/reject/send back acts on an assigned eligible step, never direct mark-P. Roster/scheme editing must validate the same employee scope. Every decision reloads committed state; batch actions need per-item outcomes.

**HR correction screen (remaining):** exact employee/date, source/raw evidence, first/second results, requested summary, meaningful trimmed reason, current lock/conflict information. Backend checks permission **and population**, obtains locks in shared order, validates summary, derives a consistent result and writes old/new audit atomically. Locked/no-op conflicts must return a clear error, not HTTP200 plus success audit. Reconcile OT/leave/penalty provenance; do not delete original swipe or approval history to make a day look clean. Current direct override API exists but a dedicated frontend caller was not found; it is not a complete HR journey.

**Month close:** manager month attestation → `att.manager_month_approvals` ledger → completeness/watermark/request/queue checks → `att.month_locks` + freeze of the complete expected day population. Current checklist can report ready for an empty future manual month; fix this before relying on the screen. Recheck facts/attestation revision under the closing transaction; source mutations must coordinate with close. A lock header alone does not prove complete attendance.

**Payroll handoff:** `pay.payroll_runs.attendance_lock_id` must match company and month. Payroll's locked-day reader already rejects incomplete/unlocked/unresolved daily rows and HD contributes0.5 under the existing specification. This defensive check does not cure a premature attendance lock. Never infer an extra payable formula for mixed leave/off halves; approved HR policy/reconciliation remains necessary.

## 2. HR Head: approval authority, policy and recovery

HR Head reviews company HR data and the actual assigned confirmation/resignation/offer decisions. They can review payroll and co-sign; payroll computation remains a separate capability. All grant/population decisions remain in the central runtime RBAC model, not handler role-name checks.

A request with all approvers unavailable is **pending, held for HR**. The existing hold API derives this from request/step/audit state. Remaining screen must show scoped queue, requester/domain/half, why routing failed, current configuration and reasoned retry. Repair uses the approved chain, then retries routing; it cannot itself approve or fabricate a step. Show requester notification and actual dispatch/delivery status separately.

Approval must bind the domain payload/result revision and required authority. Editing a chain or payload after review cannot silently change what was approved. Confirmation/resignation/LOI domain writers must actually enter this workflow; a seeded generic definition does not make their direct mutation path compliant.

## 3. Payroll: maker → independent HR checker → finalized artifacts

**Sources:** effective `pay.employee_salaries`/component snapshots + locked attendance + approved OT, loan/advance/arrears/hold/other inputs + effective statutory/YTD/declaration facts. Use existing ledgers/obligations/source-consumption relationships and integer-paise core Money. A table or isolated statutory calculator is not proof that the run supplies those facts. Current run deliberately refuses unpaid approved OT until correct rate/consumption integration; retain that safe refusal.

**State:** draft → inputs_locked → computed → under_review → approved → finalized, then separately acknowledged disbursement. Current backend has transactional run locking, maker identity and reconciliation checks, but a second payroll-only user can approve without HR. Add the distinct centrally configured co-sign authority/evidence against the unchanged result; do not merely compare two different user IDs. Reopen requires reason/audit and version-safe downstream regeneration.

**Screen (remaining):** real company/month/run selector, readiness blockers, actual inputs, server result totals, per-employee lines/calc notes, independent reconciliation/variance, each authorized action and co-sign actor/time, archived output versions. Replace sample June2026 employees and local-only success handlers. A failed API, empty run or missing artifact must remain an honest failure/empty state.

**Outputs:** `pay.payroll_items` → lines and payslip document; run-specific bank batches/holds/lines, GL/JV and statutory artifacts must identify legal payer, cost center, period and result version. Readiness is based on real metadata/bytes and reconciliation, not matching a filename or seeing a finalized label. Bank file generation ≠ payment acknowledgment. Verified source consumption must prevent repeated arrears/loan/advance settlement after recompute or another run.

All money implementation belongs in its own Phase2 stage after full docs04/10 review, signed policy decisions, independent expected-value cases and human review. This audit made no money changes or current-law/rate certification.

## 4. LOI: recruiter/initiator → Plant Head/GM → HR Head → CEO → candidate → onboarding

**Authority boundary:** before Phase4, ATS owns candidate/requisition/offer events; HRMS owns employee identity. Current code contains candidate intake/conversion and an empty recruitment shell, not a proven ATS connector/LOI approval implementation. Obtain the actual source checkout/schema/read-only contract, stable external candidate/offer/version keys and sanctioned acceptance/join event semantics. Do not invent ATS fields/tables/approval thresholds from the current shell.

**Required steps:** initiate approved offer data (entity, role, CTC/breakup, probation terms, DOJ) → configured sequential reviews → issued approved LOI snapshot/document → explicit candidate accept/reject event → prejoin data/documents → validated DOJ handoff → employee conversion. Editing approved compensation/terms must require a new reviewed revision. Candidate no-show, unsubmitted prejoin data and offer rejection are distinct; the current R21 no_show→Rejected inference must be removed in favor of authoritative evidence.

**Onboarding connection:** stable candidate/offer key → `core.onboarding_candidates` → one `core.employees.id`/allocated e-code, login/invitation and employee grant, valid `pay.employee_salaries` snapshot, `core.onboarding_tasks` and probation review. Lock the candidate and commit all business records + audit/outbox in one transaction. Replays/concurrent conversions are idempotent; failure must not leave an employee created before a failed user/salary/task write. Accepted/ready/DOJ and source/target entity/org/master checks precede active employment. Do not fabricate a work email/password or silently omit required salary data.

**Screens (remaining):** role inbox shows offer revision and prior decisions; candidate sees issued terms and acceptance/prejoin state; HR conversion wizard uses actual scoped master lookups and shows blockers/source provenance; task owners get only their assigned task authority. IT completing biometric enrollment requires matched provider evidence. A `link_sent_at` timestamp or completed task is not proof of email delivery/Kent verification. Implement scheduler/connector, reminders and escalation execution and record actual notification receipts. Current worker has no ATS intake job and the UI promise of nightly feed is unsupported in this checkout.

## 5. Confirmation, movement, separation and other actions

- Confirmation: actual manager review + HR workflow → valid effective salary segments/breakup → approved generated document. Current direct issued letter with null document/workflow and empty salary components remain defects.
- Transfer/promotion: current/receiving manager + HR approvals, source/target scope, effective-date application, existing e-code allocator/history; a future transfer must not mutate today's master and a salary-history note is not a salary revision.
- Separation: resignation/disciplinary authority → required actual approvals/receipts → IT/Admin/Finance/HR clearances with assets → true F&F facts/approval → acknowledged payout/recovery → gated letters and alumni access. No sample salary/days/EL, direct paid flag or fabricated notification timestamp.
- Policies, engagement, assets and helpdesk: retain pack22/23 audience, response validation, custody, category/transition/metrics and scope findings until their owning-stage regressions pass. The19 current probes do not independently clear those domains.

## 6. Execution order and exit evidence

1. **Next build: Phase1 Stage1.2**, F02–F05 HR day/scheme/read safety with native same/foreign-unit, whitespace, locked-day/no-op, stale-derived-fact and concurrent rollback cases. No new speculative fields.
2. Separate Stage1.7: F06/F14 completeness, scope, truthful list/export/tile population and close/recompute concurrency.
3. Separate Stage1.3: F15 HR hold queue + real notification evidence/versioned authority.
4. Own integration stages: F01 Kent protocol/adapter and source readiness. No real-data sync without authorized contract/configuration.
5. After gates/policy prerequisites, own Phase2 stages for F07–F09 and outputs/YTD/annual/loan obligations. Required financial human review stays open.
6. Own Phase3.1 stages for atomic scoped onboarding/task access/confirmation. Phase4 LOI absorption waits for actual ATS source contract; the Phase3 bridge is not silently deferred behind the whole absorption.
7. Remaining lifecycle/workplace/report/operations SOW duties follow their owning tracker. Claims/budgets remain deferred.

For each increment record exact requirement/SOW rows, reviewed code anchors, existing data authority/FKs, migration necessity (if any), lock/transaction/state rules, generated API contract, role screen→API→DB→reload proof, real notification/artifact evidence, independently derived tests and actual full verify result. Update only proved tracker items; no phase gate advances from this review.
