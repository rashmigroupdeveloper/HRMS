# Pack33 — actual joining and prejoin safety, 18 Oct 2026

**Release status: not ready. Phase3 Stage3.1 remains open.** Requirements LC-01/02, CORE-02/06/10 and NFR-03. Sponsor requires actual joining confirmation before a permanent employee exists. Claims/reimbursements and budgets remain deferred, not completed. Another AI is actively editing the checkout; whole-tree results are provisional.

## Implemented and proved locally

Candidate submission never creates an employee or consumes an e-code. Conversion requires a real authenticated HR actor, population authority, the submitted application, its contract revalidation, an immutable accepted entity, real entity-bound location and organizational unit, valid department/designation and optional manager/grade/structure relationships, and explicit actual-joining confirmation with a nonfuture calendar date. The chosen real unit is saved to the employee so scoped HR retains access after joining.

Candidate row locks, sorted cross-entity identity locks and the configured company sequence coordinate conversion. Personal and requested work email checks are case-insensitive. The requested work email participates in identity locking and duplicate refusal before allocation, including when an existing employee has no login. The regression first failed at the DB uniqueness constraint; the repaired case now returns the safe domain error before allocation. Employee, optional inactive user, candidate status, tasks, review, sequence and actor audit share one transaction. A late audit FK failure proves rollback. No work email or usable account is invented. Same-candidate retry refuses a second employee. Actual simultaneous independent-root conversion still needs a dedicated test; do not mistake allocator concurrency or sequential retry for that proof.

Link credentials are SHA-256 hashes at rest. Migration1752330000000 adds a validated raw-token-NULL constraint, redacts legacy raw values, seeds the existing72-hour lifetime as editable configuration and fixes e-code truncation after999999. It adds **zero columns/tables**. It was applied only to the authorized local test DB. Missing/invalid expiry, no-show, completed and converted states refuse submission. A conditional update and audit allow one submission; replay fails. Tests cover both a shared transaction and independent database pools: exactly one committed application and one immutable status audit, no employee/account, and later replay refused. Synthetic candidate is cleaned; its non-sensitive audit event is retained. Issuing a link leaves delivery timestamp NULL and status awaiting_prejoin.

The HR board uses real master catalogs with configured prefixes, no sample fallback rows, no invented master IDs, scoped submitted profile review, explicit joining attestation, actual DOJ and one in-flight conversion. Statutory/bank values are withheld; presence indicators explicitly do not establish verification. The candidate portal now actually submits its form, validates the server receipt and preserves fields after error. A stale token response cannot update the current form. Generic task completion cannot fabricate Kent enrollment; real integration unavailable returns503 and leaves employee/task unchanged. Other normal task completion is scoped, transactional and idempotent.

## Evidence

- [42 focused backend tests, four suites](focused-tests.log):15 native joining cases,7 native token cases,5 native allocator cases and15 composition cases. Composition salary assertions are historical mocked behavior, not money acceptance.
- [Frontend full verify](frontend-verify.log):298 tests/32 files, typecheck, lint, knip and production build pass.
- [Owned backend lint](owned-lint.log):pass. Backend production source build passes separately; global verify remains red.
- [Browser → API → native DB proof and cleanup](browser-native-proof.json):submitted candidate, raw token absent, employee count0, one submission audit; candidate removed, synthetic user disabled, sessions revoked, audit parent retained, real employees unchanged.
- [Light review](joining-review-light.jpg), [dark review](joining-review-dark.jpg), [portal receipt](prejoin-submitted.jpg). No final employee conversion was performed in browser because salary readiness remains open.
- [React Doctor](react-doctor.log):74/100,6 shared-change warnings. Its portal loading warning points inside the existing finally block and was inspected as a false positive. No rule was suppressed. Broader attendance/approval complexity and deferred travel warnings remain.
- [Whole-tree audit and verification](../deployment-audit-2026-10-18/REVIEW.md). Full backend runtime run:640 pass,5 fail; branch coverage76.88% fails80. Do not lower the threshold.

## Required next repairs — keep LC-01/02 and G3 open

1. Replace the **existing floating probation CTC and empty component map** with the approved salary allocator inside the same joining transaction. Salary structure is still optional. Read docs04/10 in full, create hand-computed money goldens first and require human review. Existing canonical assignSalary itself has probation validation/nested-transaction and dependency-order concerns; importing it blindly is insufficient.
2. Carry explicit accepted probation duration/percentage to employee fields, calculate the due date with an agreed calendar rule and remove hardcoded6/100 defaults. Current due-date arithmetic can overflow month end. Do not guess an HR policy.
3. Complete statutory/bank entry validation (CORE-07/08), approved document proof/review/correction and resend/delivery receipts. Current profile presence flags are not identity/document verification.
4. Separate IT/Admin task permission from HR salary/conversion authority, use configured task SLAs/owners and prove actual notification delivery. No actor should need payroll authority simply to finish an IT task.
5. Implement the authenticated ATS candidate-acceptance adapter and explicit linked-account handoff. The ATS source does not currently prove a candidate-acceptance event. Internal LOI approval and no-show are not acceptance/rejection evidence.
6. Add independent-root same-candidate and duplicate-identity conversion race tests with safe synthetic fixture cleanup; reconcile real masters and rehearse migrations on target PostgreSQL16.
7. Real Kent enrollment/swipe acceptance is pending sponsor raw data. Production URLs, SMTP and SeaweedFS locations/configuration will be supplied later; no integration acceptance is fabricated.
