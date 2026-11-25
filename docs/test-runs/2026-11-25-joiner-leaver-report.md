# Recorded joiner/leaver report — 2026-11-25

## Stage and data contract

Stage 2 from BACKLOG item 32, using only hrms-new's existing employee dates. No schema/model/migration/library changes,
no exit workflow, email delivery or deployment. The pre-existing directory list/export returns employees, not dated
events; new employees.movements.list/export have a distinct event contract under the existing employee module.

Employee directory & job READ is required on the active role. DataScope is mandatory in the repository and scopeWhere
is inside AND beside the event-date OR. No own/team/HOD exemption. A snapshot selects only code/name, recorded joining/
leaving dates, current status/company/plant/department/designation. It expands both dates when both match, sorts by
date/code/kind, counts distinct people separately and marks future dates against the current IST day. All statuses,
imported and directly added employees are included. Current placement/code/status are explicit; approved exits,
clearance/F&F, old codes, historical placements and missing rehire events are not inferred.

Range: inclusive UTC-midnight calendar dates, 1900–2100, maximum 366 days. Older dates are supported for imported
employees. Kind, whitespace-token name/code search and company/plant/department filters combine with the same scope.
Rows, options, totals and export share the same matching snapshot. Screen and export refuse above 20,000 events;
neither silently truncates. Each employee contributes at most two events from its current record.

## UI and browser flow

People → Joiners & leavers, `/employees?view=movements`; URL retains filters and pagination. Existing permission-
limited People tabs and the scrolling pill navigation are reused. Phone uses two employee/event columns and a current-
placement disclosure; desktop shows placement/status columns. Calendar dates and event type remain readable. Coverage
is disclosed under an explicit “Recorded dates, not confirmed exits” summary; pending queries preserve controls/titles.

Local test preview 5191/5291 uses only the checked *_test database, no SMTP. Existing synthetic role/account fixtures
were retained; added two synthetic employee rows in the already-authorized preview company to exercise recorded and
future leaving dates (no real employee data). Browser confirmed four events/two people: two joins, two recorded leaves,
one future date. “On notice” remains the current status; no completed exit is claimed. Company/group behavior and
outside-range restrictions are integration-tested.

- Opened the tab through People navigation, hard-refreshed a date-filtered URL and searched a full name.
- Downloaded actual browser Excel for Aarav Sharma; read back with ExcelJS: one matching event, four Summary rows and
  Review notes. Employee code TEBJMTV07 matched the sole displayed employee. No private fields were selected/exported.
- Changed Events to Leavers/Joiners and observed URL/query/total changes.
- Held API responses using temporary preview middleware to capture loading on desktop and phone, then removed hold.
  Screenshots `/tmp/hrms-movements-qa/`: before/report/loading desktop+phone. CSS1440/390, phone scrollWidth390.
- Tightened the phone header, moved long caveats into coverage details and used 36px select/link/button targets.
- Independent screenshot review opened all six captures: desktop, phone and loading scored 8/10, **Good — ship**.
  No material fixes requested. Detector `[]`. This visual verdict does not certify every error/keyboard/browser state.

## Tests and checks

Five new integration tests cover both event dates, inclusive boundaries, summaries across pages, company/plant/
department scope, no-grant/other-area denial, whole-company/group exports, curated columns, future recorded dates,
validation and refusal both at employee-read and expanded-event limits. Tests use unique synthetic data, no database
wipe. Initial focused fixture annotations used departmentId instead of the helper's department.id; corrected.

The first full run reported two failures: a legacy-date assertion while sources were changed during that run, and an
existing leave-year-end timeout at the unchanged 30s threshold. Final results are recorded after the settled-code rerun;
no test thresholds/configuration were weakened.

Docs updated in this slice: API_TRACKER.md (288 APIs), README.md and BACKLOG.md. CLAUDE rules remain unchanged. Daily
report email/configuration still needs the agreed schema, HR-head role selection and time/coverage/zero-event decisions.

Final settled-code verification:
- npm run typecheck — passed.
- npm run lint -w frontend — passed; existing HodDialogs.tsx fast-refresh export warning remains.
- npm run build — passed; existing large frontend chunk advisory remains.
- npm run check:api-tracker — passed: 288 documented APIs, each with scope.
- npm run check:data-access — passed: 122 repository readers / 42 watched tables.
- Focused movement suite — passed 5/5, including legacy dates and both event/read caps.
- npm run test (unchanged default command, standalone rerun) — passed: 51 files / 275 tests.
- git diff --check — passed. No schema changes or production deployment.

The task's temporary preview was paused during the standalone regression run and restarted afterward with the
settled source. No unrelated process or test data was removed.
