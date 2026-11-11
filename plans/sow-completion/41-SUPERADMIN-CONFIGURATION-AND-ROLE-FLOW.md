# Pack41 — Super Admin configuration and reported role-flow regressions

Phase 1, Stage 1.8 · 23 Oct 2026 · CORE-10/11, WF-01/04, ATT-03/06/07/15/17, PAY-03/04/06/08/13/15, CLM-04, NFR-03.

- [x] Review all 38 reported groups against the current checkout; retain open features and missing original UAT evidence explicitly.
- [x] Apply sponsor decisions: configuration defaults to Super Admin, with independently delegated payroll/HR/system/workflow authority; deny default HR Head access-matrix access and payroll-admin chain access.
- [x] Add audited, password-confirmed creation of empty custom roles; verify custom-role delegation, assignment and revocation without changing payroll-processing authority.
- [x] Enforce unrestricted write scope for group-wide policy settings, rates, PT and GL; keep configuration-only readers separate from salary/register readers.
- [x] Repair reopened-run input editing through the shared validator, retaining run locks and post-lock refusal.
- [x] Persist maker/checker access to last-compute omissions after reload. Reproduce HH3 on synthetic missing salary; repair the salary and verify ₹59,124 through finalized payslip, bank batch, paid state and employee-own API.
- [x] Reproduce non-regular runs repeating regular salary; refuse monthly computation for unsupported run types before mutations.
- [x] Repair payroll navigation and permission-gated dashboard fetches; surface assigned approvals without granting broad approval authority.
- [x] Repair HR recompute access and employee/queue scope isolation.
- [x] Add account-menu Change password, My Pay declaration entry before any payslip, and Plan new trip entry to the existing travel budget flow.
- [x] Run React review skill on the changed UI; retain existing Warm Editorial components, labels, server policy authority and account-scoped polling.
- [x] Full backend `npm run verify`: 152 files / 1,102 tests, no skips; coverage 86.58% lines/statements, 81.15% branches, 90.86% functions; all checks/build passed. Full frontend `npm run verify`: 60 files / 397 tests and all checks/build passed. `git diff --check` passed.
- [x] HH3 sponsor clarification: the reported run was test data; synthetic recovery is the regression evidence and no live run identifier remains requested. Other original browser observations still require replay.
- [ ] Implement/accept the open features and operational evidence listed in the 38-case report; no phase/release gate advanced.
- [ ] Mandatory human review of payroll-core changes before deployment (CLAUDE.md §3).

[All 38 cases and evidence](../../outputs/superadmin-role-flow-2026-10-23/REPORT.md). Migration `1753000001200` and its prerequisite `1100` were exercised only on a new explicitly declared loopback test database cloned for this task. Main application configuration, live payroll and payouts were not changed. Existing unrelated workspace changes are preserved.
