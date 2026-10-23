# KENT Recognition Logs mapping and HRMS finalization

Phase 0, Stage 0.6 · ATT-01/03/18 · Sponsor clarification, 23 Oct 2026.

The sponsor chooses **HRMS finalization no earlier than 04:00 IST next morning** to allow post-midnight exits. KENT itself does not promise to finalize then. This supersedes the earlier answer attributing the time to KENT. Actual timestamps and roster work dates remain intact; no synthetic OUT is created.

## Source evidence

Read-only inspection of `/Users/anooppratapsingh/Downloads/Kent data.xlsx`, sheet `Recognition Logs`: 41,936 events for 2,386 employee codes, 1–11 Oct 2026. SHA256: `4f0fde9cc787ae09245961ab9a364270cb5762a36069907581ceeb77116fd66b`.

- 19,800 IN, 14,733 OUT, 7,403 blank directions. Blank direction uses the existing FILO fallback.
- 2,638 rows lack Device Name; 67 distinct nonblank device names exist. A device name is not proof that it is an attendance gate; classify gate/canteen devices before ingestion.
- 250 rows have Created on on a later calendar date; 45 are at least 24 hours later. Created on is retained as a source-created-time proxy, not certified device completeness or network receipt.
- Minute precision yields 225 repeated employee/time/device groups; five have conflicting directions. Obtain second-level timestamps or source event IDs before relying on these rows for exact deduplication.
- These dates do not overlap the canteen exports for 21–22 Oct; this file cannot prove those bookings' punch matches.

Reproducible local evidence is under `outputs/kent-recognition-2026-10-23/`: analysis script, summary, device inventory, source exceptions, duplicate keys and app-mapper validation. No real attendance or payroll records were imported.

## Native mapping

| KENT column | HRMS use |
|---|---|
| S.No | Export row position; not a stable transaction ID |
| Employee ID | Employee e-code, resolved against the master |
| Employee Name | Review label; not identity matching |
| Department, Company, Location | Source provenance; do not overwrite master assignments |
| Device Name | Source door identity; required for this native layout |
| Source, Account ID | Source provenance |
| Date + Time | Actual IST punch timestamp |
| Attendance Type | `in`, `out` or blank only; never daily P/A |
| Created on | Separate source-created-time proxy in received_on, with basis retained |

The bulk punch importer now recognizes these headers. Invalid directions and missing native devices block the affected rows. Review/quarantine unresolved employee codes using the existing ingestion path. The 20,000-row bulk limit remains: split the 41,936-row workbook by date before upload. Scheduled CSV ingestion also recognizes separate Date/Time, Attendance Type and Created on; malformed rows fail the batch and retain the source file. Configured attendance-device allow-lists filter scheduled/live feed adapters; the reviewed bulk upload must itself contain attendance gates only.

## Finalization and updates

The existing worker still pulls every five minutes and drains due recomputes every minute. The configurable next-day cutoff reuses that queue. Automatic present results can be visible provisionally; automatic absence/session absence is held until cutoff and device completeness. A late 03:30 OUT can extend yesterday's attendance without also entering today's early-shift window. A night shift ending at 06:00 waits until 06:00 and completeness through that point. Approved regularizations/manual overrides and locked months retain their existing protections. This is not a new immutable daily lock: delayed logs can correct unlocked days after 04:00.

Canteen amounts remain a separate Finance mapping. Booking/actual meal cost is not automatically salary recovery; approved CANTEEN payroll inputs remain the current path. See [code and payroll-input findings](KENT-CODE-FLOW-2026-10-22.md) and [canteen/export reconciliation](KENT-REPORT-MAPPING-2026-10-22.md).
