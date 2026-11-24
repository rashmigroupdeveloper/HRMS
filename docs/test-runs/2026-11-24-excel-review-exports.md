# Excel review exports — 24 November 2026

## Scope

Shared Export action and server-generated XLSX review workbooks across the main data registers and setup lists. No dependency, schema, approval-chain behavior or production database changes.

| Surface | Export coverage |
| --- | --- |
| Roles & access | Existing roles/access and scoped employee-login workbook |
| Employee records | Current filters and sorting; explicit error above 20,000 matches |
| People directory | All matching pages of basic work fields; public-directory and actual team/HOD relationships retained; 20,000 cap with error |
| Onboarding | Current lifecycle group; optional statuses narrows the existing status/company filters after authorization |
| Change history | Current filters, masked values as on page; error above 20,000 entries |
| Pay & career register | Current filters and existing salary checks; error above 20,000 changes |
| Organization | Ten master sections; active/retired, search, attention filter and ordering represented by ordered selected IDs |
| Department heads / My department | Authorized head coverage or actual current HOD's employees; current search/post/gap filters |
| Approvals | Waiting, decided, raised and held tabs, narrowed by request kind; own decision exported separately from overall outcome |
| Approval rules | Shared/company step settings; explicit rows for empty/unconfigured chains |
| Joining tasks | Existing mine/all readers and screen quick-filter IDs; up to 1,000 open or latest 200 done, explicitly stated |
| Joining task types | Same reader and inactive visibility as the list |
| Attendance | Own/authorized employee cycle, day board, monthly muster |
| Attendance setup | Shifts, patterns, policies, scoped schedules, roster, selected-year holidays/locks, latest 30 uploads and unmatched codes |
| Leave | Own balances/current-year ledger/latest 100 applications; team applications, balance register, recount candidates, leave types |

Definition exports include current effective settings, retired records and labelled upcoming shift timings, pattern/default changes and policy rules. Roster exports stored draft/published overrides, not unsaved edits. Public directory export intentionally omits HR-only identity, bank, medical and salary fields.

## Workbook behavior

- Real headings remain on row 1. Import templates retain their original worksheets, dropdowns and formats.
- Codes preserve leading zeros. Formula-like user strings remain Excel string values.
- A4 landscape, repeated column headings, identifier columns repeated on wide printouts, page numbers and reviewer/date footers. Wide reports print across pages at 85%; narrower reports fit one page wide.
- Review notes contain preparer, UTC export timestamp, scope/coverage, filters, per-sheet row counts and reviewer/date/outcome/remarks. Long metadata wraps with row height adjusted.
- The file explicitly says that paper review does not change records or approve HRMS requests. Changes still use existing forms and authorization.

## Automated validation

- `npm run typecheck`: passed.
- `npm run lint -w frontend`: passed, with pre-existing Fast Refresh warning in HodDialogs.tsx.
- `npm run build`: passed, with existing large-bundle warning.
- `npm run check:api-tracker`: passed, 265 APIs documented with Scope.
- `npm run check:data-access`: passed, 108 repository functions / 41 watched tables. No repositories/schema changed.
- `npm run test`: 220 passed across 43 files. Scoped report/access suite: 10 passed; candidate lifecycle export regression also passed.
- Authenticated HTTP smoke run against an isolated `_test` database: **41/41 export combinations passed**. Every response parsed as XLSX and included a data worksheet and Review notes. Covers all new routes, every organization section, attendance setup section and approval tab, plus the existing seven reports.

Access regression cases use company A and company B records. Company A day-board, schedules, roster, leave, tasks, head-coverage and held-request reports exclude B. Client-supplied task IDs cannot authorize B. An out-of-range employee month returns NOT_FOUND. Own attendance/leave work without a role. Held requests require Approval chains Edit. Inactive master lists cannot be exported by a roleless user. Candidate lifecycle exports include the requested stage group and exclude outside-company records. Directory relationship filters and the distinction between public work data and private HR data are retained.

## Browser review

Temporary API/Vite preview used only TEST_DATABASE_URL (checked `_test` suffix), test storage and synthetic credentials; SMTP disabled. No real employee records or logins were changed.

- Organization desktop: Export aligned with existing toolbar; filter FUL1G reduced the list to one test company. Clicking Export downloaded `organization-companies.xlsx`; parsing confirmed exactly one company row and Review notes.
- Organization phone: requested 390px viewport; DOM measured `innerWidth = scrollWidth = 390`. Initial review found Export taking an extra toolbar row. Changed placement to share the title row on phone, keeping search/Add and filter chips below. Reviewed before/after images without editing during the review.
- Attendance shifts desktop/phone: shared Export beside Add shift, existing table retained. Artificially delayed export showed disabled **Exporting…**, preventing duplicate clicks.
- My leave: Export remained visible and disabled during data loading. Keyboard activation downloaded `my-leave-2026.xlsx`; file contained balances, ledger, applications and Review notes. Also found and fixed invalid `<p><div>` nesting in the balance skeleton by changing its layout wrappers to divs.
- Captured loaded/loading leave states and reviewed against the UI critic checklist. Static title/actions/section labels remain present while values load. Synthetic test database has many accumulated leave types, so loaded content is longer than the six-tile placeholder.
- Browser viewport emulation became scaled after repeated size changes: later screenshots/DOM reported 1800px after requesting 1440px. Do not treat every later capture as exact-breakpoint evidence. Initial 1440px desktop and measured 390px phone checks remain valid. A pointer attempt after resizing opened an empty leave form; cancelled it without submitting and verified export using keyboard. No leave application was created.
- Viewport override reset and temporary tab closed after QA. Screenshot evidence stored in `/tmp/hrms-export-qa/` for this run.

## UI critic result

| Representative surface | Verdict | Finding / response |
| --- | --- | --- |
| Organization desktop | Good | Quiet secondary export preserves gold Add as primary; useful content starts within first screen. |
| Organization phone, initial | Needs polish | Export occupied a separate row; moved beside section title. |
| Organization phone, revised | Good | Search, Add and export remain usable; no measured page overflow. |
| Shifts desktop / phone | Good | Export and Add sit together; table remains scanable; long explanatory copy predates this change. |
| Leave loaded / loading | Good for export control | Same visible action and label while loading, disabled until ready; fixed invalid skeleton HTML. |

## Documentation and boundaries

API_TRACKER.md documents 15 new report routes, changes to the existing seven exports, print/review conventions, limits and scopes. BACKLOG.md uses the current Export label for existing completed reports. No changes to CLAUDE.md or README were needed.

Physical printer output and native Excel print preview were not exercised. Print configuration, cell types, worksheet structure, repeated headings and review metadata were verified programmatically. Shared button interactions were browser-tested on representative pages; each individual page/filter combination was not exhaustively clicked. Existing list windows remain explicit on review sheets rather than being described as complete historical records.
