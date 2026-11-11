# Pack40 — attendance and statutory-payroll boundary repair

Phase 1, Stage 1.8 · 23 Oct 2026 · ATT-06/07/08/15, PAY-09/14/15, LC-06/07, CORE-06/11.

- [x] Reproduce ignored AR/OD custom clocks, out-of-shift permissions and stale permission-cap approval; validate exact minutes and revalidate the final decision.
- [x] Reproduce guessed F&F attendance and payable-day bypasses for white- and blue-collar employees; use frozen facts and retain fractional days.
- [x] Protect final-settlement reads and persistence in one employee/separation-locked transaction; check salary validity at exit and paid-settlement guards.
- [x] Stop a zero process-held payroll item from suppressing unpaid final-month salary.
- [x] Honor explicit Form 11 non-membership when an earlier employment joining date exists.
- [x] Use the designated apprentice contract consistently in estimate and monthly compute.
- [x] Reject unsafe gratuity/F&F dates, money and day values; correct short-month residual days and exact fractional-day proration.
- [x] Sponsor instruction implemented: payroll admin can choose strict/liberal gratuity eligibility through audited Settings. Preserve the existing default until changed. Migration is idempotent and retains administrator values.
- [x] Enable positive exact-paise `GRATUITY.cap` versions in the existing payroll editor and apply the exit-date version to F&F.
- [x] Nine focused suites: 114 tests passed before the configurable-policy increment. New policy regressions reproduced before implementation.
- [x] Complete backend `npm run verify`: 151 files / 1,099 tests, no skips; typecheck, lint, knip, dependency-cruiser, coverage and build passed. Coverage 86.51% lines/statements, 81.10% branches, 90.85% functions. `git diff --check` passed. Legacy Stage 1.4 fixture identity collision repaired with UUIDs.
- [ ] Mandatory human review of payroll-core and statutory data before deployment (CLAUDE.md §3).
- [ ] Statutory source/policy acceptance, legacy liberal worked-day proof, PF estimate-vs-run ceiling policy, revised wage definition and fixed-term/disability coverage remain open; no release gate advanced.

[Findings and evidence](../../outputs/attendance-statutory-integrity-2026-10-23/REPORT.md). Continues Pack39; no live imports, payroll finalizations, payout or deployment.
