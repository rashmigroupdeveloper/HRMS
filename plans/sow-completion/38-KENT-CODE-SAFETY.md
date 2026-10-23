# Pack38 — KENT code flow and payroll-input safety

Phase 0, Stage 0.6 · 22 Oct 2026 · ATT-01/02/03/06/07/15/18, PAY-03, SOW-5.1.1.

- [x] Trace actual worker/API composition, e-code/device/time mapping, immutable ingestion, recompute, approved AR/OD protection and locked-attendance payroll inputs.
- [x] Add configurable attendance-device allow-list across live feed adapters and telemetry; retain excluded webhook records raw.
- [x] Refuse malformed API/DB/CSV batches and detect DB truncation; retain failed CSV files for correction/retry.
- [x] Fix valid decimal input validation/serialization and reordered CSV notes.
- [x] Lock draft payroll runs before adding/removing variable inputs; add real-connection race regressions.
- [x] Correct a date-dependent weekend-AR fixture collision without weakening duplicate-request validation.
- [x] Apply the sponsor's 23 Oct correction: HRMS chooses next-day 04:00 IST, independent of KENT finalization; preserve actual OUT, wait through later shifts and device completeness, and requeue provisional days.
- [x] Support native Recognition Logs in reviewed bulk uploads and scheduled CSV; validate all 41,936 supplied rows read-only through the app mapper in per-date groups (2,638 missing-device errors).
- [x] Add cutoff/late-OUT exclusive-attribution and native-layout regressions; record source delay/precision and canteen date-overlap limits.
- [x] Final verification results recorded below: backend `npm run verify` green, 147 files / 1,065 tests.
- [ ] RML live configuration, attendance-device inventory, raw recognition/completeness and one real day acceptance.
- [ ] Canteen transaction identity, settlement/refund and Finance recovery/rounding contract; separate financial importer.
- [ ] Mandatory human review of payroll-core input-boundary diff before merge/deployment (CLAUDE.md).

[Code mapping and repair detail](../../docs/integrations/KENT-CODE-FLOW-2026-10-22.md).

No statutory rates, payroll calculation policies, schema, actual payroll inputs or production configuration changed. Existing unrelated working-tree edits were preserved.

## Verification

Initial regressions reproduced malformed-batch/device-mapping issues and the decimal/CSV-note/removal-lock bugs. The first focused local test run passed 57 tests. An expanded run passed 111/112 before exposing the weekend fixture collision, which is corrected above.

The broader gate exposed stale fixture assumptions in access-control, group-entity payroll prerequisites, absence-role scope/audit cleanup and onboarding delegation. Those fixtures were corrected without weakening production checks. Cutoff follow-up updated the split-shift receipt expectation to next-day 04:00 and isolated the matrix's bounded queue; its single rollback transaction explicitly makes already-due retries visible against PostgreSQL's transaction-fixed `now()`, emulating separately committed worker cycles without bypassing future cutoffs. The final focused matrix/split-shift/cutoff run passed 65/65 tests.

One full rerun passed 1,064/1,065 tests with only an unrelated privacy-export five-second timeout. The unchanged complete rerun then passed: **147 files / 1,065 tests**, plus typecheck, lint, knip, dependency-cruiser and build. Coverage: 86.46% statements/lines, 80.94% branches, 90.82% functions. `git diff --check` passed. [Recorded result](../../outputs/kent-recognition-2026-10-23/verification.json).
