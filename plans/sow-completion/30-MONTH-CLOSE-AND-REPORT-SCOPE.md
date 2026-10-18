# Pack30 — month-close and report population repair

17 Oct2026 · Phase1 Stage1.7 · ATT-03/04/12/15, CORE-10/13, RPT-02/06.

Evidence: [review](../../outputs/month-close-safety-2026-10-17/REVIEW.md), [full verify](../../outputs/month-close-safety-2026-10-17/backend-verify.log), [migration](../../outputs/month-close-safety-2026-10-17/migration.log).

- [x] Employment-date completeness and closed-period readiness; no silent carry of unresolved facts.
- [x] Manager policy mandatory; close/roster/attestation/recompute locking coordinated.
- [x] Freeze/no-op recomputation preserves manager approval; actual changes invalidate.
- [x] Company close/checklist/ledger scope; R21/R28/HR dashboard population scope and correct policy audience denominator/numerator.
- [x]15 new native regression/HTTP cases, static checks and separate build.
- [ ] Global80% coverage gate (77.59% lines/statements,73.50% branches remains red).
- [ ] Full report, attendance, SOW and real integration/HR UAT acceptance.

No new DB column/table. One function-only migration1752310000000 applied locally. ATS source location found and inspected; connected-account plan is [here](../launch-readiness/01-ATS-CONNECTED-ACCOUNTS.md), not implemented SSO. Next: prevent normal sync from generating mock Kent punches. Sponsor's continuous-work instruction supersedes older one-stage stop preference.
