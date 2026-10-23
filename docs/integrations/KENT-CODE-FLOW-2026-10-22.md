# KENT attendance updates and payroll canteen inputs

22 Oct 2026 · Phase 0, Stage 0.6 follow-up · ATT-01/02/03/06/07/15/18, PAY-03, SOW-5.1.1.

Scope: trace the current code against the [native report mapping](KENT-REPORT-MAPPING-2026-10-22.md), repair confirmed transport/input bugs, and verify the attendance-to-payroll boundary. This does not authorize deductions from the supplied two-day export or establish a new canteen recovery policy.

## Actual attendance flow

| Step | Code | Mapping and behavior |
|---|---|---|
| Recognitions arrive | `attendance/kent-webhook.ts`, `kent-http-connector.ts`, `kent-source-connectors.ts` | Webhook or configured API/DB/CSV feed. Native `empId` becomes trimmed uppercase employee number, `time` becomes a zoned instant, `deviceId` becomes a canonical door via the device map. `type=0` is unknown face. Field aliases and source formats are configurable. |
| Identity resolution | `attendance/ingest.service.ts` | Resolve e-code against `core.employees.ecode`. Unmatched codes remain visible as raw events without employee ID; they cannot produce a known employee's day record. This is independent of company-name/code-prefix guesses. |
| Raw storage | `attendance/ingest.service.ts`, migration `1751820000000_attendance-ingestion.ts` | Plausibility quarantine, monthly partition, append-only swipe events, uniqueness on employee number/time/door. Source naming alone cannot duplicate the same canonical event. Preserve source received time when supplied; arrival time is a fallback, not proof of source completeness. |
| Queue work | migration `1751840000000_attendance-processing.ts` | New matched swipes queue their IST date and previous date for night-shift attribution. Duplicate inserts do not queue duplicate events. |
| Scheduled updates | `jobs/worker.ts`, `attendance/kent-sync.job.ts` | Pull every five minutes, followed by recompute; safety drain every minute; missing-day materialization hourly. A separate worker process must actually be running. Webhook ingestion queues work for that drain. |
| Compute a day | `attendance/day-status.service.ts`, `shift-windows.ts` | Roster → scheme → configured default shift, exclusive night-shift ownership, FILO, shift break, session thresholds, late/early/OT facts. These are HRMS rules, not a direct copy of KENT P/A/HLF results. |
| Hold incomplete results | `day-status.service.ts`, `month-lock.service.ts` | Biometric absence requires the next-morning HRMS cutoff (default 04:00 IST), later shift end when applicable, and location-mapped attendance devices complete through that point. Heartbeat or latest recognition time alone is insufficient. Missing completeness keeps affected days/close held. |
| Manual correction | `day-status.service.ts` | Scoped HR override with reason/audit is protected from automatic recomputation. Locked periods are skipped/rejected, preserving payroll history. |
| Regularization / OD | `attendance/regularization.service.ts`, `half-requests.ts` | Final approved workflow writes whole-day results or overlays the approved half. Recompute preserves protected whole-day results and reapplies approved halves. Open/approved overlapping requests and leave conflicts are refused. KENT MIS does not automatically create an approved AR or a paid day. |
| Payroll | `payroll-core/runs/run-compute.service.ts` | Locked HRMS attendance determines payable/LOP days. Vendor daily summaries are reconciliation evidence, not the payroll ledger or raw punch feed. |

All application paths in this note are relative to `backend/src/modules/` except `jobs/worker.ts`, which is relative to `backend/src/`. The existing importer in `bulk/importers/punches.ts` accepts the older raw swipe layout, not the supplied Attendance Details/Muster/Employee Wise summary files.

Routine sync never edits an existing immutable swipe. Late delivered swipes are new events; dedupe and the recompute queue update the unlocked day. API/DB reread windows are configurable. An endpoint that filters by punch time can still miss uploads older than its configured overlap, so the actual offline/backfill contract must be verified with KENT.

## Confirmed bugs repaired

| Problem | Before | Repair and regression evidence |
|---|---|---|
| Canteen recognitions could enter attendance | Recognized food-device events followed the same path as gate swipes; renaming a door offered no purpose filter. | New `KENT_ATTENDANCE_DEVICE_IDS` allow-list shared by webhook/API/DB/CSV mapping and API telemetry. Tests cover food events, mapped device labels, and retained raw webhook bodies without food swipe/device creation. Requires configuration from the real attendance-device inventory. |
| API malformed rows could disappear | Missing code/device records were skipped; malformed primitive records could produce uncontrolled errors. A later valid event could advance the feed watermark. | Reject an invalid fetched batch with a typed record error; unknown faces and explicitly unlisted devices remain intentional exclusions. |
| DB batch could truncate silently | A fixed LIMIT returned only the beginning of the source window; timestamp checkpointing could strand or skip later rows, especially timestamp ties. | Read limit+1 and refuse overflow. No timestamp-only guessed pagination was added. Invalid DB mappings fail the batch. Batch-size configuration is validated. |
| CSV could lose invalid rows during archive | Invalid rows were skipped; earlier filenames could remain pending even if a later file failed. | Validate every record, reject unfinished quotes, publish the archive list only after all files validate. Source files remain available for correction/retry on failure. |
| Valid canteen amounts rejected | `Math.round(value * 100) === value * 100` rejected ₹1.10, ₹1.09 and ₹10.12 due to binary floating point. | Use the core exact decimal-to-paise parser and exact decimal serialization. Integration tests assert stored `1.10`, `1.09`, `10.12` and atomic rejection of `1.005`. |
| Reordered payroll CSV corrupted notes | When Note was not last, all following fields were appended to it. | Select exactly the mapped Note cell. Quoted commas in that cell are preserved. |
| Payroll-input edit race | Draft status was read without the lifecycle run lock; removal could complete while another transaction held that run for locking. Addition could resume past an earlier draft read. | Add/remove lock the run row before checking its current status. Tests exercise two real DB connections, lock waits, and refusal after a concurrent transition. |

Attendance filtering is transport configuration, not a hardcoded meal/device policy. No gate IDs are inferred from addresses in the supplied reports. The allow-list is optional for dedicated attendance-only feeds, so deploying code without configuring a mixed feed does not solve classification. Historical incorrect devices or swipes require explicit reconciliation; they were not modified.

## Canteen-to-payroll mapping

The existing supported route is **reviewed employee-period recovery totals → draft payroll input → payroll engine deduction**:

1. Resolve source Employee Code to the HRMS employee and effective payroll company. Use the canonical employee master rather than the prefix or canteen location.
2. In a separate canteen reconciliation, retain each booking's source file/row, Date/Time, food, quantity and both price totals. The exported `Total Item Price` is the candidate employee charge, pending confirmation; `Total Actual Price` is not automatically recoverable.
3. Confirm postpaid versus prepaid settlement, reversals/refunds, payroll period and overlap dedupe before calculating a recovery. Supplied Balance cells are blank and transaction IDs absent. The two-day report is not a whole-month payroll control.
4. Aggregate only approved unsettled recovery amounts per employee/company/period. Use component **`CANTEEN`**, positive amount, and a meaningful reconciliation/batch note. Existing templates expect Employee code, Component, Amount, Note. The native canteen booking export is not directly supported.
5. `bulk/importers/payroll-inputs.ts` validates the run company and delegates to `addRunInputs`; the JSON/CSV APIs share that validation. Engine-owned/statutory components are refused. Bulk import has exact-file/job replay safeguards; direct add-input calls are additive and are not transaction-ID-based canteen dedupe. Do not retry a direct add blindly or post overlapping consumption batches.
6. `run-compute.service.ts` reads `pay.inputs.amount` with core Money into paise. `compute-engine.ts` applies the component's deduction classification, writes a calc note, subtracts recoveries from net, and handles approved negative-net/carry-forward policy. Recompute rebuilds the run's items; it does not add the same input a second time. Input collection must still prevent duplicate business charges.

The current engine rounds adjustment lines to whole rupees under its existing parity behavior. This repair preserves exact cents in input storage but does not change that calculation policy. If KENT recovery must preserve paise on the final payslip, Finance needs to approve that explicit rounding contract before changing the engine. The supplied ₹1 bookings do not exercise a fractional payroll recovery.

For this sample, the observed employee-price total is ₹885 and actual cost ₹38,480. Neither was posted. Separate canteen transaction ingestion, refund/settlement handling and transaction-level dedupe remain unimplemented pending the source/policy contract. A generic recognition webhook has no quantity/price/settlement payload and cannot substitute for those transactions.

## Validation and remaining acceptance

New regression tests live in `backend/tests/kent-feed-safety.test.ts` and `payroll-input-safety.integration.test.ts`; existing KENT integration tests now include mixed-device webhook behavior. The regularization suite's weekend-span fixture uses a separate employee so it cannot overlap the earlier approved AR based on the current weekday. Production duplicate-request validation was retained.

Final command outcomes are recorded in [Pack38](../../plans/sow-completion/38-KENT-CODE-SAFETY.md). Local integration tests use the explicitly declared loopback test target and synthetic fixtures, with audit history preserved. No production deployment, real KENT call, source-file change, source employee import, actual salary deduction or statutory-rule change was performed.

Before real enablement: obtain the raw recognition/device inventory, tenant auth/pagination/received-time contract, confirm timezone and configure the attendance allow-list, prove delayed delivery and completeness, run one real-day reconciliation, and obtain canteen settlement/recovery sign-off. The payroll-core input changes require human review under CLAUDE.md; tests do not replace that review.

## Sponsor correction and raw-log follow-up — 23 Oct 2026

The 04:00 time is an **HRMS safety cutoff selected by the sponsor**, not KENT finalization. [Native Recognition Logs evidence and mapping](KENT-RECOGNITION-LOGS-2026-10-23.md) records the new file's actual schema, gaps, source timestamp delays, native bulk/CSV support and cutoff behavior. Device completeness still gates automatic absence; night shifts ending later remain open. The app mapper was exercised read-only against all 41,936 supplied rows, grouped by date: the only mapping errors were the 2,638 missing source devices. This does not validate employee-master joins or approve devices for attendance.
