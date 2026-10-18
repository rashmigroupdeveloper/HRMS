# SOW regression and HR vacancy hold — 16 Oct 2026

**Current boundary:** Phase1 Stage1.3 repair increment implemented; full stage/release acceptance remains open. Cross-stage work in this increment is read-only review, not silent implementation of payroll/lifecycle stages. [Current report](../../outputs/sow-regression-review-2026-10-16/REVIEW.md), [all findings](../../outputs/sow-regression-review-2026-10-16/findings.json), [all 176 SOW rows](../../outputs/sow-regression-review-2026-10-16/sow-scope-current.json), [verification](../../outputs/sow-regression-review-2026-10-16/verification.json) and final source hashes are the latest evidence. Pack20 remains dated evidence for prior manager/browser repairs; pack19 retains all remaining backend domains.

## Implemented decision and regressions

- [x] Sponsor chose **Hold for HR**: an all-vacant new/resubmitted round remains pending. Existing audit identifies the routing hold; no new DB status, fields or fake step/receipt. HR event recipients are `wf.event_subscriptions` data; seed adds role HR Head without overwriting existing chains.
- [x] Exact request detail says Waiting for HR; no Approve or Resubmit control is exposed for a held item.
- [x] Scoped `admin.settings` GET `/workflows/routing-holds` and POST `/workflows/requests/{id}/retry-routing` with reason provide recovery. Retry re-evaluates the configured chain; it cannot approve, excludes readonly grants, and concurrent retries create one open step. Empty routing still holds. No automatic routing to an unapproved substitute HR decision-maker.
- [x] Explicit lapse policy remains enforced while held and before retry, especially ATT-08 overtime. An all-vacant RH/other auto-approve definition cannot gain consent merely by time passing; a real routed step retains its configured policy.
- [x] New native concurrency regression reproduced a global audit/employee lock deadlock. Creation, act, resubmit, escalation and routing retry now lock subject employee before request/step and audit. No retry hides the race.
- [x] Unique step numbers and valid manager/role/user/escalation specifications are required on both definition reads and writes; invalid edits cannot silently omit authority.
- [x] Malformed legacy chains cannot abort other valid SLA/expiry processing; native isolation proof preserves OT lapse. S14 retained fixtures are removed from active/payroll populations without deleting immutable parents.
- [x] Malformed legacy chains cannot abort other valid SLA/expiry processing; native isolation proof preserves OT lapse. S14 retained fixtures are removed from active/payroll populations without deleting immutable parents.
- [x] Live catalog unchanged at 132 business relations / 1,379 columns; no migration/schema edits. Native tests clean up mutable fixture state and retain immutable parents.

### Technical entry points and recovery

`backend/src/modules/workflows/workflow-definition.ts`: shared zod spec/getSteps. `workflow-locks.ts`: shared subject-before-request locks. `workflow-routing.ts`: ordinary step opening/notification, audited vacancy skip, all-vacant hold and final hooks. `workflow-holds.service.ts`: derived hold predicate, scoped list, audited retry and configured lapse. `workflow-holds.router.ts`: centrally permission-gated HTTP contracts; registered through workflows router and appRouter. `seed.ts`: idempotent HR event audience. `frontend/src/pages/approvals/ApprovalRequestStatus.tsx`: actual held state from timeline API.

Data connections stay `wf.requests` → `wf.request_steps` and authoritative domain FK (`att.regularizations`, `att.overtime_entries`, `lv.applications`, etc.). A held request remains pending with its domain row/reservation intact. It has no fabricated approver, so no fabricated notified_at. `core.audit_log(field=routing_hold)` + no open step derives hold state. Requester notification and configured HR event enqueue commit with the hold. Repair the reporting relationship or existing definition through authorized routes, then POST retry with a reason. An eligible real step is opened/notified and domain effects still wait for its final decision. Configured lapse transitions and final hooks commit together; they do not imply approval.

Tests: stage13-workflows, stage14-requests-overtime, workflow-scope and stage15-leave integration suites, plus ApprovalsPage component test. Native lock test coordinates actual pg_locks; scope tests prove wrong-unit/own/readonly refusal, repeated unresolved retry and concurrency. Current complete suites: backend498 / frontend246; see report for the red coverage gate.

## Remaining and handoff boundaries

- [ ] Wire a dedicated HR hold-queue/retry screen to the new secured API; employee request-state display is implemented, and backend recovery is available. Prove real notification delivery separately from enqueue.

- [ ] Central readonly-vs-mutation authority and ownership in existing APIs (G04/R15), under a separate announced foundation stage. New routing repair is protected but the older central contract is not globally repaired.
- [ ] Reconcile the 24 remaining client/HTTP candidates plus nine dynamic call sites, then prove payload/output/auth/data per domain. Selected loans/separation failures are HTTP-confirmed. Avoid a path-only fix that leaves sample data, missing auth or unscoped writes.
- [ ] All prior outstanding payroll/lifecycle/loan/output/report/domain issues in pack19 and current findings. Money/statutory changes require their own tests and human review; none made here.
- [ ] Freeze chain and payload/domain revisions, complete delegation contracts and all leave/attendance/month-close completeness/concurrency policies. Subject-lock ordering is not a global proof for every older domain transaction.
- [ ] Review two malformed existing deferred claim/budget chains and historical test approvals without step rows. Do not rewrite runtime settings or reverse history/payment automatically.
- [ ] Retained schema-purpose/integrity findings; zero added fields is not zero database slop certification.
- [ ] Meaningful coverage to the unchanged80% floor, Kent/SMTP/storage/deployed integration evidence, signed UAT and all release criteria. No gate advanced.

[The full 176-row original scope](../../outputs/sow-regression-review-2026-10-16/sow-scope-current.json) retains exact wording, DB links, decisions and active/deferred obligations. The portable context includes actual current code, canonical specs, original SOW, plans and evidence. Do not reset the pre-existing dirty checkout to Git HEAD or treat a historical done checkbox as acceptance. Execute one announced stage, verify its entire flow, update this evidence and stop.
