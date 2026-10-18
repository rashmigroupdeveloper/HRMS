# Phase 0 Stage 0.4 — readonly authority repair

CORE-10 / docs08 §2. Owns H02 from [pack23](23-HR-ACTIONS-SAFETY-REVIEW.md).

- [x] Separate read and write permission membership and population, without schema changes.
- [x] Prevent global readonly rows from widening organizational-unit, own or subtree writes. Bound readonly reads to their assigned unit.
- [x] Filter secondary and alternative write permissions; runtime writable-grant revocation takes effect on the next request.
- [x] Preserve audited POST queries with explicit read authority.
- [x] Require writable workflow administration for another employee's request and writable helpdesk agent authority for another employee's reply; bare ticket assignment is insufficient.
- [x] First 10 native regression tests reproduced failures before repair, then passed after repair. Two additional resolver regressions cover no write scope and subtree preservation.
- [x] Run full backend verification: all510 tests/66 files pass; static checks and separate build pass. Verify remains RED on coverage (76.64% lines;72.06% branches vs80%). No gate advanced.
- [ ] Mandatory human review of payroll-core router authorization annotations (no calculation changes).

Stage0.4 remains open: failed-login atomicity/backoff/reset and signed refresh/session policy remain. H01/H03–H14, other-module findings O01–O12, existing payroll/lifecycle issues, backend coverage, production integrations and signed acceptance remain open. Claims/budgets remain deferred. No other implementation stage was started.

Detailed evidence: [repair report](../../outputs/readonly-authority-repair-2026-10-16/REVIEW.md).

**Follow-up:** [pack25](25-AUTH-SESSION-AND-LOGIN-REPAIR.md) repairs the login counter and implements the sponsor-selected session policy. Global coverage and integration/human acceptance are separate open gates.
