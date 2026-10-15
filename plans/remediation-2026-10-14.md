# SOW implementation repair tracker — 14 Oct 2026

The original SOW contains 176 scored rows. The [current crosswalk](../outputs/remediation-2026-10-14/SOW-ISSUES-AND-REMAINING.md) retains every row, requirement/card links, historical code evidence, database connections, 46 findings and remaining work. The [machine-readable progress](../outputs/remediation-2026-10-14/progress.json) distinguishes verified fixes from partial repairs. This tracker does not pass a release gate.

## Phase 0, Stage 0.2 — migration reproducibility repair

Latest continuation: [backend repair scope and progress](sow-completion/19-BACKEND-REPAIR-SCOPE-AND-PROGRESS.md). Claims/budgets are deferred by the sponsor; remaining HR obligations stay active. Current verification and source hashes live in [the new evidence pack](../outputs/backend-repairs-2026-10-14/REPAIR-STATUS.md).

- [x] Backend typecheck, full lint, knip and dependency boundaries pass; no rule/coverage weakening.
- [x] Correct scope and generic-domain workflow fixtures; explicit loopback listeners fix the reproduced local HTTP transport rejection.
- [x] Validate survey/clearance JSON; replace unsafe lifecycle fixtures and prove actual invitation expiry.
- [x] R21: onboarding/transfer e-code callers use the existing locked database allocator; stale-counter and 20-concurrent-caller regressions pass. Other transfer obligations remain open.
- [ ] Full verify, coverage floor and complete HR feature acceptance. See current evidence; no gate advanced.

- [x] Recover 13 missing migration sources from Git, recording commit and file hashes.
- [x] Restore all 132 local business-relation type declarations and missing column names.
- [x] Correct nested Kysely timestamp/numeric types and the nullable claim-type reference.
- [x] Preserve shared table ownership during payroll rollback.
- [x] Add forward compatibility migration for budget overspending and claim funding kind. Do not guess funding ownership on existing invalid rows.
- [x] PostgreSQL 16.15 / Node 24.21.0: 49 up, no-op up, 49 down and 49 restored up pass.
- [x] Upgrade a disposable full copy of the existing local test database; one forward migration and no-op pass. Remove copy and sensitive temporary dump.
- [x] Fresh replay matches inspected column names, types, nullability and defaults.
- [ ] Complete deep CHECK-domain/enum and function/trigger compatibility review. Column equality is not behavioral equivalence.

Field audit addendum: [current field-purpose review](../outputs/schema-purpose-review-2026-10-14/REVIEW.md) inventories 1,379 business fields across 132 relations. All have parsed migration/type declarations; duplicate bill policy, raw invitation token retention, claims-state contract drift, missing relational/immutability guards and absent historical runtime context remain open. [The live follow-up checklist](sow-completion/18-FIELD-PURPOSE-AND-SCHEMA-AUDIT.md) records the nine supplementary findings and their SOW links. The audit-time 597 lint errors are repaired; full verify now reaches tests and fails coverage. No gate is advanced.

Original `hrms` was not migrated by this repair pass. The forward compatibility migration deliberately retains pre-existing columns on a one-step rollback; their owning historical migration drops the tables on full rollback.

## Phase 2, Stage 2.2 — verified calculation repairs; delivery remains open

- [x] Deduction-kind monthly inputs and arrears affect deductions and net. Employer adjustments remain outside employee gross/deductions. Unknown adjustment codes fail.
- [x] Documented G1 guest-house recovery reproduces net ₹57,999 in the pure golden fixture.
- [x] Current earning adjustments update the PF wage base.
- [x] Preserve salary snapshots as integer paise. Exact DB decimal conversion replaces floating rupee conversion in run inputs/results.
- [x] Real database-to-run tests preserve ₹10,000 gross, compute ₹5,483.87 gross for a 15 July joiner, and retain zero for an all-absent month.
- [x] Read real locked attendance columns, weight half-days, respect paid leave/week-off flags and reject missing/unlocked/unresolved records.
- [x] Missing/empty/gapped/multiple salary coverage fails explicitly; no silent employee skip.
- [x] Detected OT is not paid. Unconsumed approved OT blocks the run until rate/consumption integration exists.
- [x] Missing maker and reconciliation evidence fail approval/finalization. Computation actor identifies the maker.
- [x] Creation and state/audit writes share transactions; computation/finalization lock the run header.
- [x] Reconciliation separately checks positive deduction lines, excludes employer costs, and rejects bad lines, empty populations and negative net.
- [x] Parallel comparison sums repeated signed component lines rather than retaining the last line.
- [x] Split run state service, computation and reads into files below 400 lines.
- [ ] Full effective salary segment calculation for multiple revisions within a month.
- [ ] Freeze approved policy, applicable statutory membership, TDS/YTD, LWF and debt facts into the real run. Apprentice/applicability facts must reach the tested engines.
- [ ] Approved OT calculation using configured ordinary-rate components and exactly-once consumption; canonical component FK.
- [ ] Immutable source consumption for arrears/loans/claims/holds. Retro must consume approved recomputed result deltas with period provenance; do not infer obligations from mutable counters.
- [ ] Freeze expected employee/date population and component classifications; compare the complete manifest before finalization.
- [ ] DB immutability for closed run lines, inserts, inputs and source facts; reopen creates a new version and never rewrites historical paid results.
- [ ] Durable result-version maker/checker authority, review dispositions and concurrency proofs.
- [ ] Scope every payroll read/mutation and reconcile the typed API with actual callers.
- [ ] Human review of all payroll-core/money changes and signed policy decisions before payroll release.

## Remaining modules and acceptance

Every remaining requirement, model connection and screen/transaction contract stays in [the complete execution pack](sow-completion/00-START-HERE.md). Current defects are appended rather than assuming the 10 Oct baseline is still correct.

- [ ] Salary amount-rule/CTC grammar, shared preview/assignment assembler, probation-dependent contribution recalculation and effective PT slab inputs.
- [ ] Real payroll/ESS screens and artifact generation; remove simulated success/sample-data fallbacks and prove HTTP/data ownership.
- [ ] Atomic onboarding, invitation consumption, workflow receipts, salary creation and runtime login grants.
- [ ] Real approved F&F inputs, clearance/payment evidence, once-only settlement and alumni/letter gates. F&F still has a salary unit mismatch.
- [x] Canonical e-code allocation for onboarding/transfers, backed by the existing company sequence and native concurrency tests (R21).
- [ ] Effective transfers and promotions and historical legal-payer placement.
- [ ] Eligibility/approval-based loans, immutable ledger posting and opening-loan import reconciliation.
- [ ] Deferred by sponsor: claims/budgets, canonical funding, configured entitlements, atomic reservations, bill workflow, real payout obligation/batch and FY/type-scoped taxable recovery. Dependent HR settlements remain blocked until their inputs are authoritative.
- [ ] Persistent YTD, complete two-cycle comparisons with signed dispositions, real annual salary revisions and bonus true-up.
- [ ] Financial KPI formulas from authoritative historical facts, dimensioned GL mapping and scoped/versioned output artifacts.
- [ ] Remaining frontend/source-document numeric trace citations validated against the original row crosswalk. Backend numeric citations and Phase 2/3 tables have been corrected.
- [x] Backend lint and existing full-suite assertion failures repaired; current counts/evidence in pack19.
- [ ] Backend coverage/full verify gates. Do not weaken thresholds or discard failing tests.
- [ ] 29 manual/service duties need operational receipts; six scope decisions need recorded resolution. Portal acceptance, signed UAT, backup restore, statutory-policy approval and cut-over are not established by passing source tests.

Phase 2/3 completion labels and unsupported acceptance checkboxes are reopened. No G0/G1/G2/G3 gate is advanced.

## Approval/attendance continuation — 15 Oct 2026

[Pack20](sow-completion/20-MANAGER-APPROVAL-AND-ATTENDANCE-REVIEW.md) and its verification evidence supersede prior counts for the current checkout. C03/C04/C08 have bounded repairs with their remaining contracts retained; C24's exact-request substitution defect is repaired. Added SLA missing-target, permission-form, leave-history and badge regressions. No new fields/migrations, payroll/statutory edits or release gates in this increment. R46 transport repair and R21 allocation evidence remain; global coverage and full remaining SOW work remain open.
