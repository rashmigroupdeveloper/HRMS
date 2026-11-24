# Attendance reports and role-aware Home — 2026-11-24

## Scope and environment

Local, uncommitted work on `hrms-new`; main inspected as a business reference only. No schema, migration, new library,
production changes or deployment. Existing AppLayout/index.css motion work was preserved. Temporary localhost preview
5191/5291 used only the configured `_test` database and synthetic accounts/records; no production records were used.

## Stage 1 reports

- Added `/attendance-reports`, linked from Team attendance and Home. Detail/exception tabs, inclusive calendar dates,
  person search, company/plant/department/status/exception filters, URL state, pagination and all-page summaries.
- Test fixture: eight stored work dates, one employee, 48 worked hours, one late day, one early day, one absent day and
  one missed-punch day. Detail showed eight rows; exceptions showed four. Missing calendar rows were not invented.
- Raw drill-down showed retained device, source/upload metadata, exact timestamp, timezone and storage timestamp.
  Existing night-shift/day ownership is reused. No invented GPS/card metadata.
- Browser downloads read back with ExcelJS: raw punch workbook contained two rows and Review notes; filtered exception
  workbook contained one matching row, Summary and Review notes. Integration coverage also verifies all matching pages,
  company-wide/group-wide exports, filter summaries, input limits, 20,000-row refusal, string-safe filenames and night punches.
- Data access: ALL uses active-role Attendance View scope; TEAM/HOD uses explicit relationship-derived IDs with
  SYSTEM_SCOPE. Options, rows, counts, summaries and exports use the same range. Outside-range record lookup is NOT_FOUND.
- Integration cases cover company/plant/department restrictions, unrelated-area access denial, team/HOD relationships,
  full group/company exports, either-half exceptions and no fabricated absence.

## Home

- Inspected main's employee/manager/HR home implementations and local Crextio reference material. Reused business
  priorities, existing typed readers and the incumbent cream/charcoal/gold visual language.
- Signed into synthetic employee and manager accounts. Switched real active-role menu between manager, HR and
  administration capabilities. No decisions were approved/rejected during this review.
- Employee: own current attendance cycle and recent days, leave, recent requests, documents/profile.
- Manager/HOD: pending decisions and scoped People today, attendance/report links, then personal work.
- HR: open joining-task count/earliest tasks, accepted offers awaiting joining, decisions and scoped attendance.
- Administration: permitted organization/access/history shortcuts first. Capabilities decide layout, never role names.
- Found and fixed repeated role switching: history state could restart an already-active role transition after reload.
  The transition now ignores the current active role. Role access remains one role at a time.
- Fixed invalid paragraph nesting in TodayCardSkeleton/raw loading wrappers.

## Visual verification

Desktop and phone screenshots were taken before and after Home work, and for detail, exceptions and raw drill-down.
CSS widths were calibrated with DOM measurements (1440/390); browser output sometimes scaled the PNG. Report loading
was held for screenshots, retaining real tabs, filters, headings and summary labels. Loaded report totals/rows align
with their skeleton structure. Role loading uses neutral placeholders until active capabilities are known.

The screenshot-only UI critic found three phone defects: clipped report dates, manager People today below personal
leave, and excessive space in empty pre-joining. Fixed in one batch: smaller date text/padding, People today directly
after manager decisions, compact empty HR metric/spacing. Desktop captures were retaken at scrollY 0 to remove sticky
header occlusion caused by capture offset. The independent Impeccable reviewer scored all three fixes and header
recapture resolved, with disposition **ship this fix batch**. Employee desktop/phone screenshots were also reviewed.
The bounded verdict does not certify every error state, contrast ratio or keyboard interaction. Detector returned `[]`.
Temporary evidence: `/tmp/hrms-specialist-qa/`.

## Checks

- `npm run typecheck` — passed after final UI batch.
- `npm run lint -w frontend` — passed; existing HodDialogs.tsx fast-refresh export warning remains.
- `npm run build` — passed after final UI batch; existing large frontend chunk advisory remains.
- `npm run check:api-tracker` — passed, 273 documented APIs with scope lines.
- `npm run check:data-access` — passed after repository edits and final verification, 115 readers/41 watched tables.
- `npm run test` — passed, 47 files / 246 tests. An earlier complete run had transaction-start/test timeouts under
  load; default full command was rerun unchanged and passed. No timeout thresholds or test configuration weakened.
- `git diff --check` — passed.

## Deferred

Regularization/OD reporting reuses Team requests in Stage 2. Remaining specialist reports need their owning workflows;
payroll/executive trends/device health and broader HR workload trends remain deferred in BACKLOG item 31/item 16.
Current-placement and stored-day limitations remain explicit. No schema approval is implied by this delivery.

Docs updated: README.md, BACKLOG.md, API_TRACKER.md and this record. Existing CLAUDE.md rules remain accurate.
