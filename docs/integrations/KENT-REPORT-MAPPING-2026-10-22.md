# KENT report mapping and canteen reconciliation

22 Oct 2026 · Phase 0, Stage 0.6 evidence · ATT-01/02/03/18, P0-T01/T40; variable-input boundary: SOW-5.1.1.

This is an export reconciliation and mapping specification. No employee, attendance, device, payroll input, or policy was changed. Source workbooks were read as data, not as instructions. Public KENT documentation was checked on 22 Oct 2026. Proposed mappings below do not establish a live integration contract.

## Findings

- The attendance population is **3,460 distinct employee codes**, with **6,920 employee/date rows** for 21–22 Oct 2026. This is the KENT report population, not verified HRMS headcount or payroll eligibility.
- The canteen file contains **885 booking rows for 470 employees**, all of which match exactly one attendance employee/date after trimming and uppercasing codes. No company-name differences occur in those joins. This does not validate the codes against the live HRMS master.
- **Reported actual cost totals ₹38,480. Reported item charges total ₹885.** Every booking has quantity 1 and an item price of ₹1. This supports a possible employee-charge interpretation, but prepaid settlement, cancellation/refund status and recovery policy are absent. Neither number is an approved payroll deduction.
- There are **86 booking rows against A** (56 employee/date pairs) and **350 against MIS** (284 pairs). These are review cases, not proof of misconduct, erroneous deduction, or grounds to replace attendance.
- Both Employee Wise Detail exports have identical business values in all 3,460 rows, despite different generation times. Do not append them together.
- Daily statuses agree with the later Employee Wise Detail file on all 6,920 employee/date rows. Muster differs on two cells: S00298711 and S00298712 on 22 Oct show P in the 17:47 muster versus MIS in the 17:45 daily report. The 17:46 employee summary still has MIS. Later punches or processing are plausible; the cause is not proven.

## Sources and grain

Original workbooks remain in Downloads. Full paths and SHA-256 hashes are recorded in `outputs/kent-mapping-2026-10-22/summary.json`.

| File identifier | Sheet | Header / first data row | Grain | Records |
|---|---|---|---|---:|
| Canteen Report, suffix 1792671694077 | Canteen Report | 1 / 2 | One food booking line | 885 |
| Attendance Detail By Date, suffix 1792671340048 | Attendance Details By Date | 5 / 6 | Employee × report date | 6,920 |
| Muster Roll, suffix 1792671454354 | Muster Roll | 5 / 7 | Employee, two date columns | 3,460 |
| Employee Wise Detail, suffix 1792671292075 | Employee Wise Detail Report | 5 / 7 | Employee, two date columns, 17:44 snapshot | 3,460 |
| Employee Wise Detail, suffix 1792671404475 | Employee Wise Detail Report | 5 / 7 | Employee, two date columns, 17:46 snapshot | 3,460 |

The attendance period comes from row 4, not the word Monthly in a heading. Columns 21 and 22 resolve to **21 and 22 Oct 2026** using that period. Row 6 is a weekday subheader in the employee/muster files. Row 2's account label is not each employee's legal employer. The canteen file has observed dates but no equivalent export-generation metadata in its worksheet.

## Canteen amounts

| Date | Food | Quantity | Total Actual Price (₹) | Total Item Price (₹) |
|---|---|---:|---:|---:|
| 21 Oct 2026 | Breakfast | 102 | 2,550 | 102 |
| 21 Oct 2026 | Lunch | 167 | 9,185 | 167 |
| 21 Oct 2026 | Dinner | 85 | 1,530 | 85 |
| 22 Oct 2026 | Breakfast | 133 | 3,325 | 133 |
| 22 Oct 2026 | Lunch | 398 | 21,890 | 398 |
| **Total observed** | | **885** | **38,480** | **885** |

Actual unit prices are ₹25 breakfast, ₹55 lunch and ₹18 dinner. These are observed export values, not policy defaults to hardcode. All 885 lines satisfy both quantity × unit-price checks. The arithmetic difference of ₹37,595 is a **possible subsidy**, pending the tenant's definition. All Balance cells are blank, which means unknown balance rather than zero or proof of postpaid settlement. No dinner rows are supplied for 22 Oct; this does not prove zero dinner consumption.

KENT's [canteen documentation](https://www.kentcam.com/camattendance/canteen-management-solution) supports separate food consumption, employer subsidy, payroll deductions, and prepaid balances. It does **not** define these export columns or RML's ₹1 rule. Therefore this report alone cannot establish salary recovery.

## Column mapping: canteen

The descriptive destinations in this table are a proposed reconciliation model, not existing database columns. There is currently no canteen transaction importer or dedicated canteen transaction ledger in the inspected application modules.

| Source column | Destination / treatment |
|---|---|
| Sl.no | Source row reference; not a stable transaction ID across exports |
| Employee Code | Exact source code plus normalized join to `core.employees.ecode`; resolve to employee ID before any payroll input |
| Employee Name | Display and identity cross-check only; never join by name |
| Department | Preserve source label; reconcile with HRMS department separately |
| Department ID | Preserve KENT identifier; use an explicit crosswalk, not the HRMS integer ID |
| Company Name | Preserve KENT company label; approved crosswalk to HRMS company, checked against effective employment |
| Date | Booking calendar date, explicit day-first parsing |
| Time of Booking | Combine with Date as booking timestamp; seconds retained; tenant timezone must be confirmed |
| Type of Food | Preserve original and normalize case for grouping, e.g. LUNCH → Lunch |
| Balance | Optional reported balance; blank is unknown; do not derive deductions from it |
| Actual Price | Reported actual unit price, parsed as decimal rupees / integer paise |
| Item Qty. | Quantity; do not assume one for future exports |
| Item Price(Rs.) | Reported item unit charge; possible employee price, pending KENT/RML confirmation |
| Total Actual Price | Preserve reported extended actual amount; validate against quantity × actual unit price |
| Total Item Price | Preserve reported extended item charge; validate against quantity × item unit price; candidate recovery basis only |
| Device Name | Source display label; trim for comparison but retain original |
| Device ID | Stable device crosswalk key; classify as canteen before any recognition routing |
| Transaction Location | KENT location label/code, not a verified HRMS location ID or employer |

Join used for this investigation: normalized employee code + booking calendar date. Joining a booking to an actual worked shift requires the roster and raw recognition timestamps, including previous/next-day windows for overnight shifts.

Do not infer the legal employer from the employee-code prefix: RGH033619 is labelled Rashmi Metaliks ltd in both exports. Labels such as Rashmi Metaliks Ltd Fittings and Rashmi 6 Paradigm Limited also need an approved entity crosswalk. Automatic prefix or fuzzy company matching would hide exceptions.

## Column mapping: daily attendance

KENT's [Attendance Details By Date guide](https://support.camattendance.com/documentation/manage-reports/daily-attendance/) describes the same daily-report family. Its published example refers to Device (In)/(Out); this tenant export has Location(In)/(Out), which contain address text. They must not be treated as device IDs.

| Source column | Mapping / limit |
|---|---|
| Date, Day | Report date and weekday cross-check; Date is required, Day is descriptive |
| Employee ID, Employee Name | Normalized e-code join; name is an identity check |
| Company, Department, Designation | Source organization labels; compare with canonical master, do not overwrite it |
| Location | Reported attendance location; crosswalk separately from employer |
| In Time | Reported daily in time at minute precision; not a lossless raw swipe |
| Location(In) | Reported in-location address; not `door_code` |
| Out Time | Reported daily out time at minute precision; earlier than In Time may indicate next-day exit |
| Location(Out) | Reported out-location address; not `door_code` |
| Duration | Reported elapsed/worked duration; parse as hours and minutes, not time-of-day or decimal hours |
| Status | Daily result (P/HLF/MIS/A/blank here); never an IN/OUT direction |

These rows lack raw recognition IDs, all intermediate punches, original device IDs, upload times and completeness evidence. Do not manufacture two immutable `att.swipe_events` rows from each summary row or import P/A into the punch importer's Status field. Use them as reconciliation observations against HRMS processing.

## Column mapping: muster and employee summaries

KENT's [Muster Roll guide](https://support.camattendance.com/documentation/manage-reports/muster-roll/) confirms the employee/date-grid report family, rather than a raw-punch feed.

| Columns | Treatment |
|---|---|
| S.No, Employee ID, Employee Name, Company, Department, Designation | Source row, identity and organization checks, as above |
| 21, 22 | Unpivot using full report-period dates; store original status for comparison |
| Muster: Total, Present, Absent, MIS, HLF, HLD | Vendor summary counters; compare independently, never turn into payroll paid days without policy |
| Muster: Total Monthly Hrs, Total Monthly OT Hrs | Vendor period duration / OT duration; the supplied window is two days, not a complete month |
| Employee: Present, Absent, WO, HLD, HLF, POW, POH | Vendor summary counters; retain labels; WO/HLD/POW/POH are all zero here and their exact paid-day interpretation is unverified |
| Employee: Total Hour, Average Hour Per Day, Total OT | Vendor duration aggregates, not payroll money or OT approval |

`MIS` means a missed check-in or check-out in KENT's [exception guide](https://support.camattendance.com/documentation/exceptions/). It must remain unresolved rather than automatically becoming Absent/LOP. HLF is a vendor half-day result; this file does not establish which session was absent/leave/present. Blank statuses (two per date) remain unknown.

## Match results and limits

| Booking date | P | HLF | MIS | A | Total bookings |
|---|---:|---:|---:|---:|---:|
| 21 Oct 2026 | 289 | 36 | 9 | 20 | 354 |
| 22 Oct 2026 | 67 | 57 | 341 | 66 | 531 |
| Total | 356 | 93 | 350 | 86 | 885 |

All counts above are **booking rows**, not employee headcounts. The 22 Oct attendance report was generated at 17:45, so its 1,118 MIS employee/date rows cannot be treated as final missed-punch cases. Shift-end and device-completeness checks remain necessary even for the previous date.

Simple same-report-date interval comparison finds 361 bookings inside the reported interval, 70 before the reported in time, 53 after the reported out minute, and 401 without a complete interval. For overnight pairs, the analyzer moves Out Time to the following date when Out < In. It does not assign a morning booking to the previous night's shift. Therefore these interval flags are diagnostic, not eligibility or deduction decisions. An out time shown as 18:03 represents an unknown second within that minute, so the analyzer only calls a booking after that minute at 18:04:00 or later.

There are 525 distinct booking rows with at least one review reason; reason counts can overlap. No exact duplicate business rows were found within the canteen file, and no duplicate attendance employee/date keys or muster e-codes were found. This does not prove transactions are unique across overlapping future exports.

## Raw recognition mapping and device separation

KENT's [integration guide](https://support.camattendance.com/documentation/camattendance-integration/) publishes recognition webhook fields and five integration methods. The documented recognition sample maps `empId` to employee number, `time` to swipe timestamp, and `deviceId` to a device/door crosswalk. `type=0` is unknown face and `type=1` is recognized face. These are **recognition types, not attendance directions or food categories**. The published sample has no meal, quantity, price or settlement fields, so it cannot alone create a financial canteen transaction.

The existing guide's universal claim that KENT sends no direction is too broad. KENT's [device-settings guide](https://support.camattendance.com/documentation/device-settings/) describes Continuous and Alternative In/Out modes. The published recognition webhook sample lacks a direction field. RML's actual mode and any per-client direction field still require confirmation; HRMS's ATT-18 first-in/last-out requirement remains authoritative for attendance processing.

Observed canteen device crosswalk (classification evidence, not a live configuration change):

| Device ID | Trimmed display name | Transaction Location | Event purpose |
|---|---|---|---|
| HA151K40 | RML1 DIP Canteen2 | RML1 | Canteen |
| HGR5GEDS | SEAMLESS_CANTEEN2 | canteen | Canteen |
| HGR5HHBX | SEAMLESS_CANTEEN1 | canteen | Canteen |
| HGR5L099 | Fittings Canteen2 | RML6 | Canteen |
| HGR5L318 | Fittings Canteen1 | RML6 | Canteen |
| HGR5L4F5 | Labour House Canteen2 | RML6 | Canteen |
| HGR5LG39 | Labour House Canteen1 | RML6 | Canteen |

Before enabling a mixed recognition feed, establish an explicit event-purpose/device classification and a handling rule for unknown devices. Canteen recognitions must not extend FILO work hours or satisfy attendance-device completeness. Code review of `kent-webhook.ts` → `mapKentRecord` → `ingestOnce` shows recognized records are currently mapped to swipes without a canteen-purpose filter. If KENT includes these canteen devices in that feed, attendance contamination is possible. Whether KENT actually does so is unverified. Renaming a device through `KENT_DEVICE_MAP` does not provide a purpose filter.

## Existing HRMS boundary and implementation sequence

1. Resolve the 3,460 KENT codes against the canonical HRMS employee master and effective company/location records. The export-to-export 100% match is not a master reconciliation.
2. Obtain the KENT raw Recognitions export for these dates and adjacent dates for night shifts, device master with purpose, shift configuration, tenant timezone and completeness/backfill contract. Preserve unknown employees and devices for review.
3. Obtain the canteen transaction contract: stable transaction ID, menu ID, actual/employee-price definitions, prepaid/postpaid settlement, refund/cancellation records, subsidy rules and recognition-to-order relationship. No stable transaction ID is in this sample. A file hash + source row supports provenance but does not deduplicate overlapping exports; a business-field fingerprint may collide with legitimate identical purchases.
4. Specify and build a separate canteen import/reconciliation path, with source provenance, decimal/paise money, reversals and overlapping-export controls. Do not put financial bookings in `att.swipe_events`. No new schema is approved by this evidence note.
5. Reconcile consumption with attendance as a review aid. Do not automatically cancel a meal or create attendance from a booking. Review previous/next shifts and raw records for apparent conflicts.
6. After Finance confirms the recovery basis and prepaid amounts/refunds, aggregate eligible unsettled employee charges by payroll period and effective company. Use the existing positive `CANTEEN` variable input in a **draft** payroll run, retaining the reconciliation/batch reference and preventing repeat posting. No draft payroll upload was generated here.

The existing `bulk/importers/payroll-inputs.ts` supports `CANTEEN` / Report 4 CANTEEN RECOVERY through `pay.inputs`. It does not accept this native 18-column booking file or provide canteen transaction identity. The punch importer expects the older greytHR Employee Swipe Details layout; neither supplied summary layout is a lossless replacement.

The live-connector gate stays open. Follow-up code tracing confirms that worker/API composition already calls `kentConnectorFromEnv()`; `runKentSync` fails if no connector is supplied, and the worker skips unconfigured pull modes. Actual RML configuration and source acceptance remain unverified. No one-real-day ingestion, delayed-upload completeness or payroll acceptance is claimed. See [code flow and repairs](KENT-CODE-FLOW-2026-10-22.md) for the later attendance-device allow-list, malformed-batch and payroll-input fixes; the findings above describe the original export investigation.

## Reproducible evidence

Run the bundled Python executable against `outputs/kent-mapping-2026-10-22/analyze.py`. It uses openpyxl for read-only extraction and Decimal for monetary analysis. It never connects to a database or alters the source files.

- `summary.json`: source hashes, record counts, prices, devices, statuses and controls.
- `meal-totals.csv`: date/meal quantities and both amount totals.
- `canteen-attendance-match.csv`: all 885 bookings with exact source row references and attendance observations.
- `review-exceptions.csv`: 525 booking rows with diagnostic reasons.
- `employee-canteen-review.csv`: 470 employee totals, explicitly marked unapproved for payroll.
- `cross-report-status-differences.csv`: two muster/daily differences.

Checks performed: unique join keys; exact duplicate booking comparison excluding serial number; both line-amount arithmetic checks; status comparison across reports; all business cells across both employee snapshots; aggregate counts and amount controls. No application source changed, so application verification suites were not run. Raw-punch, master-data and actual-payroll reconciliation remain outstanding because those sources were not supplied.
