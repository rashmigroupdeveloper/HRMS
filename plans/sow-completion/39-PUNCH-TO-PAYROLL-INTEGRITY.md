# Pack39 — punch-to-payroll integrity repair

Phase 1, Stage 1.8 · 23 Oct 2026 · ATT-01/03/06/07/08/09/15/18, LV-03/08/09, PAY-03/04/08, CORE-06/11.

- [x] Review punch transport/dedupe, 04:00 readiness/shift attribution, attendance corrections, leave approval/cancellation, week-off dependencies, payroll inputs/carry-forwards, maker-checker, reconciliation and finalization.
- [x] Reproduce conflicting native CSV directions before immutable swipe dedupe can discard one side; reject the batch and retain files.
- [x] Reproduce cross-month locked-presence exclusion and stale open week-off pay after late raw recomputation; read frozen evidence without changing it and refresh decided weeks after derived/manual/approved coverage changes.
- [x] Reproduce stale clocks/OT on full-day leave and on cancellation; clear derived facts, retain raw events and existing half-leave semantics.
- [x] Reproduce full-day leave approval alongside approved OT; require reconciliation before the atomic approval/debit write.
- [x] Reproduce recovery from unsettled/later payroll, unsafe source reopening and unreleased draft claims; enforce settled earlier same-company provenance and shared origin/row claim locks.
- [x] Exercise reviewed CANTEEN input plus settled carry through recompute, maker/checker approval, finalization, post-final input refusal and dependent-run recovery.
- [x] Focused verification: 106 tests passed before the final cancellation regression; that regression separately reproduced the stale-clock failure before repair.
- [x] Complete backend `npm run verify`: 149 files / 1,072 tests; typecheck, lint, knip, dependency-cruiser, coverage and build passed. Coverage 86.48% statements/lines, 80.98% branches, 90.82% functions. `git diff --check` passed.
- [ ] Human review of payroll-core changes required by CLAUDE.md before deployment.
- [ ] Real KENT device classification/completeness, half-leave portion/policy acceptance, canteen transaction/settlement/refund contract and live payroll parallel-run sign-off remain external acceptance items.

[Findings and evidence](../../outputs/punch-payroll-integrity-2026-10-23/REPORT.md). No live payroll, deployment, statutory-rate change, actual employee import or payout. Preserve all unrelated working-tree changes. No release/phase acceptance gate advanced.
