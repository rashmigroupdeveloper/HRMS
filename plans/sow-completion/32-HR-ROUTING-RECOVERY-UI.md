# Pack32 — HR routing-hold recovery UI

Phase1 Stage1.3 ·17 Oct2026 · WF-01/04, CORE-10.

- [x] Scoped paginated queue, explicit missing-approver explanation, required repair note and persisted draft.
- [x] Single in-flight retry; error preserves note; restored/still-held/lapsed outcomes distinct; no approval claim.
- [x]12 focused cases incl. both-theme axe; fullfrontend verify274 tests green.
- [x] Native browser→API→DB proof, both-theme screenshots, synthetic cleanup.
- [ ] Actual notification delivery, workflow snapshot/versioning and complete security/UAT acceptance.

[Evidence](../../outputs/routing-recovery-ui-2026-10-17/REVIEW.md). No new schema. Sponsor's latest decision: candidate remains separate from employees/MIS until completed application accepted and HR confirms actual joining; permanent company-prefix e-code only then. Next: Phase3 Stage3.1 onboarding integrity, recorded in [candidate boundary plan](../launch-readiness/02-CANDIDATE-TO-EMPLOYEE.md). No SSO/ATS live acceptance claimed.
