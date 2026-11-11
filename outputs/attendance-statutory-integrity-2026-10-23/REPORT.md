# Attendance → deduction → statutory payroll audit

23 Oct 2026 · Phase 1, Stage 1.8 · ATT-06/07/08/15, PAY-09/14/15, LC-06/07, CORE-06/11.

This continues [Pack39's punch/canteen/leave/payroll repair](../punch-payroll-integrity-2026-10-23/REPORT.md). The HRMS 04:00 next-morning safety cutoff remains independent of KENT; actual punches, later shift ends and device completeness remain authoritative.

## Confirmed defects repaired

| Defect | Result after repair |
|---|---|
| F&F assumed all final-month days were present when attendance was missing; a manual payable-day value bypassed frozen facts. | Missing, unlocked or unresolved facts refuse computation. Explicit payable days must equal the frozen total. Both collar categories use the same approved attendance evidence. |
| Process-held zero monthly payroll item suppressed final salary. | Such an item no longer counts as the run already paying the salary. Payment-held salary retains its separate release treatment. |
| F&F facts could change between reads and persistence; expired salary revisions could be selected. | Compute and persist run in one transaction under employee/separation locks; paid settlement is rechecked and salary must remain effective at LWD. |
| Explicit EPS non-membership could be overwritten by an employment DOJ before September 2014. | A negative Form 11 membership fact stays authoritative when no actual EPF enrollment date exists; other membership/age/override behavior is retained. |
| Legal apprentice contracts were exempted in monthly payroll but misclassified by the estimate helper for some collar categories. | Both paths use the designated apprentice contract. Ordinary trainees do not become apprentices by category alone. |
| Invalid gratuity dates, unsafe/noninteger paise and invalid F&F days could produce invalid settlement values. | Validate inputs before arithmetic; retain integer money and fractional days via integer day units. |
| Month-borrow tenure calculation produced negative residual days. | Calendar anniversaries clamp month ends; 31 Jan 2020 → 1 Mar 2026 is 6y 1m 1d. |
| AR/OD accepted custom clocks that were silently ignored; short permissions could lie outside the assigned working interval. | AR/OD require full/shift-half selections; custom clock ranges use permission. Permission uses exact minute bounds inside configured working intervals. |
| Pending permissions could exceed a reduced cap at approval. | Final approval revalidates all request kinds against current policy and conflicts, excluding the request itself. |

The white/blue integration fixture uses ₹10,000 monthly salary, seven P records, one HD record and seven A records through 15 September: **7.5 payable days and ₹2,500 final salary**. Missing facts and a supplied 15-day override refuse computation. Adding a zero process-held monthly item still leaves ₹2,500 payable. Fixtures are synthetic and roll back.

## Payroll-admin configuration

Sponsor instruction: “let things be configurable by payroll admin.” The existing audited Settings screen supports `pay.gratuity_eligibility_mode`: `STRICT_5Y` or `LIBERAL_4Y240D`. Existing role ownership allows payroll admin/super admin and refuses HR-head/IT edits. The forward migration and seed preserve existing values and the old liberal default. Strict mode requires five completed calendar years; the death waiver remains. Tests show the same short-service exit becomes ineligible in strict mode and eligible under the legacy liberal rule.

The liberal option preserves the existing approximate calendar-day test (inclusive 1,700 days / rounded 4.66 years), **not proof of 240 actual worked days**. This is exposed for compatibility and requires policy acceptance. The prior doc10 strict-default claim is explicitly reconciled in doc04/doc10; choosing configuration does not certify the legacy formula.

Payroll settings → Statutory rates accepts scheme `GRATUITY`, parameter `cap`, a positive rupee amount with at most two decimals, effective month and source note. The existing group-level payroll permission, closed-run protections and audit apply. F&F reads the latest cap effective on/before LWD. Future versions do not leak into earlier exits. Missing versions retain the previous ₹20 lakh fallback. Tests verify exact ₹1.09 storage/readback, invalid caps, and actual F&F cap consumption. The existing generic screens need no frontend change.

Configuration changes apply to a new computation; paid settlements remain protected with their stored calculation breakdown. No production settings or statutory rates were changed. The migration is prepared for normal reviewed deployment and has not been applied to a live database.

## Verification

Nine focused suites passed **114 tests** before adding the configuration increment. Initial failing regressions covered the actual services rather than a duplicate implementation. The strict-policy/configuration regressions then failed before implementation. Final backend `npm run verify` passed **151 files / 1,099 tests, no skips**, plus typecheck, lint, knip, dependency-cruiser, coverage and build. Coverage: 86.51% statements/lines, 81.10% branches, 90.85% functions. `git diff --check` passed. [Machine-readable verification](verification.json) records the result. Test DB access is restricted to an explicitly declared loopback target; new fixtures roll back. No frontend source changed.

Full-suite verification also reproduced a legacy Stage 1.4 fixture identity collision: employee codes used only the last five timestamp digits, while immutable audit/swipe references intentionally retain old synthetic employees. The fixture now uses a UUID identity, preserving those records and the existing cleanup. A prior assertion was updated to describe a configured gratuity ceiling accurately; the golden ₹20 lakh capped amount is unchanged. The new migration is exercised against a temporary settings table for first installation, rerun and rollback, including preservation of an administrator's strict-mode choice.

## Open statutory and acceptance findings

- **PF estimate/run inconsistency:** the standalone `computePf` helper applies employer contribution to actual wages even when employee contributions are capped; monthly compute uses the capped employee base. The repository's G2 and scenario policies disagree. Record the approved employer-basis policy before changing financial behavior; this audit fixes the independent explicit-membership bug without silently choosing that policy.
- **Current PF reference data needs review:** the official [16 September 2026 PIB announcement](https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2310973&lang=2&reg=48) reports a ₹25,000 mandatory-coverage ceiling from 17 September and says statutory/administrative implementation steps will follow. The repository still has legacy ₹15,000 helper/EPS assumptions. The announcement alone does not settle scheme-specific transition and September calculation rules; obtain the operative notification and EPFO instructions before updating effective-dated parameters and helpers. No new rates were inferred or seeded here.
- **Wage definition and employment coverage:** the Ministry's [Additional FAQs dated 16 March 2026](https://www.labour.gov.in/static/uploads/2026/03/a4ccf4c6d97c4f1f36a6d83f8c64213d.pdf?v=20260620082854) discuss the 50% wage calculation and gratuity wage definition effective from 21 November 2025. The repository's Basic+DA-only assumption needs an approved component mapping. Fixed-term gratuity, disability exit handling and exact six-month rounding remain outside these bounded repairs and require specification acceptance.
- **Regularization limits remain explicit:** permission approval retains the documented legacy attendance effect; it does not introduce minute-prorated salary. AR/OD support full/shift-half selection. A range crossing midnight is still refused by the existing same-date request contract. Half-leave portion acceptance and native canteen settlement/refund mapping remain as recorded in Pack39.

Tests prove the repaired scenarios, not absence of every possible defect or current statutory compliance. Human review of payroll-core/statutory data is mandatory under CLAUDE.md §3 before deployment. No phase/release acceptance is advanced.
