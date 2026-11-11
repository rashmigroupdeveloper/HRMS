# Pack42 — Payroll controls and IT stakeholder tasks

Phase1 Stage1.8 · 23 October 2026 · PAY-08/13, LC-02, CORE-10/11.

- [x] Reproduce and repair missing employee-scope guards in holds and declaration administration.
- [x] Add audited, serialized hold placement/release, overlap/month validation and protection for computed/settled payroll.
- [x] Add salary hold UI, scoped e-code lookup and payroll/run-console entry points.
- [x] Add scoped paginated proof queue, audited owned-proof download, exact partial verification and locked verified records.
- [x] Coordinate ESS declaration edits with verification; prevent foreign/stale proof acceptance.
- [x] Add an independent IT task-owner permission, scoped owner queue and task completion without HR conversion authority.
- [x] Retain unavailable Kent enrollment truthfully; native 503 leaves the biometric task open.
- [x] Record sponsor clarification: HH3 was test data; no live run identifier pending.
- [x] Backend full verify:153 files/1,108 tests,86.77% lines,81.11% branches,91.31% functions; frontend full verify:63 files/401 tests. Focused follow-up guards also pass.
- [ ] Remaining full-request features and browser/operational evidence are listed in the report; this increment does not declare all38 groups closed.
- [ ] Mandatory human payroll-core review before deployment; no phase/release gate advanced.

[Evidence and remaining scope](../../outputs/payroll-controls-2026-10-23/REPORT.md). Only the declared loopback test clone was migrated. Previous workspace changes preserved.
