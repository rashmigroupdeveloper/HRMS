# API Tracker

Every API (oRPC procedure) of the HRMS backend: who can call it, what it accepts, what it returns and what it does.

**Rules** (also in CLAUDE.md):
- **Before adding an API, search this file.** If an API already does the job (or can with a small optional input),
  extend it instead of creating a new one.
- **Every change to an API updates this file in the same change**: added, removed, renamed, input/output changed,
  access changed, behaviour changed.
- `npm run check:api-tracker` fails if an API exists in code but not here (or the other way round), or if the
  total below is wrong. It is part of the checks before finishing any change.

**How to call an API**
- Frontend: `orpc.<path>` with TanStack Query, e.g. `useQuery(orpc.employees.getByCode.queryOptions({ input: { employeeCode: 'RML001' } }))`.
- HTTP: `POST /api/rpc/<path with / instead of .>` with body `{"json": <input>}`.
- Errors always have a code and message; validation errors (400) list every bad field in `data.issues`.

**Access:** employees log in with their employee code + password (`accounts.login`); the browser then carries an
httpOnly session cookie. Every API needs a logged-in employee except `health.check`, `accounts.login`, the
candidate's offer page `candidates.offerResponse.*` (public - the secret link token from the offer e-mail is the key,
and accepting / declining also needs a one-time code e-mailed to the candidate) and the candidate's joining-form page
`candidates.portal.*`: `signIn` is public (the link + a one-time code) and starts a **candidate session** (its own
httpOnly cookie `hrms_candidate`, not an employee login); the other portal APIs need that session ("Candidate
session" below) and only ever touch that candidate (approved 2026-11-13).

Many APIs also need access to an **area** at a **level**: **View** (`READ`, see only) or **Edit** (`WRITE`, see and
change - includes View). Written below as e.g. "Onboarding: Edit".
- The areas are fixed in code (`AccessArea` in `backend/prisma/schema/access.prisma`): `ONBOARDING`, `ORGANIZATION`,
  `LETTER_TEMPLATES` (the wording of letters), `ACCESS` (roles & access), `CHANGE_HISTORY` (the change history - View
  only, 2026-11-16), `JOINING_TASKS` "Joining tasks" (2026-11-16 - View sees the joining tasks given to you, Edit marks
  them done; only people with Edit can be given a task), `ATTENDANCE` "Attendance" (2026-11-16 - View sees everyone's
  attendance, Edit sets it up, corrects days and gives HR's approval of shift changes), `LEAVE` "Leave" (2026-11-22 - View sees everyone's
  leave applications, balances and the leave types; Edit adjusts balances and changes the leave types), `HOD_APPOINTMENTS` "HOD appointments"
  (2026-11-18, changed 2026-11-19 - View sees the HODs, the places they head and the gap list; Edit appoints and ends HODs,
  only for places inside the caller's data access; a place = a department at a plant), and the **employee areas** (split 2026-11-16): `EMPLOYEES` "Employee · Directory & job" (the
  directory, job, record - the way into anyone else's profile), `EMPLOYEE_PERSONAL_DETAILS` "Employee · Personal"
  (personal, addresses & emergency contacts, education & work, family & nominees), `EMPLOYEE_IDS_BANK` "Employee IDs,
  bank & PF / ESIC", `EMPLOYEE_DOCUMENTS` "Employee · Documents & letters", `SALARY` "Employee · Salary", `MEDICAL` "Employee medical
  information" (also the joining form's health data). Every employee area of someone else's record needs
  `EMPLOYEES` View as well; one's own record needs none.
  Each API checks one with `accessProcedure(area, level)`.
- **Roles are data**, made on the "Roles & access" page (`accounts.roles.*`): each role has a level per area. An
  employee can have several roles; only the selected role contributes permissions and data access. The browser sends
  its per-tab choice in `x-hrms-role` (assigned role ID). Without the header the lowest assigned role ID is selected.
  An unknown or revoked ID gives no role permissions, without silently selecting another role. No role = self-service only.
  Selection is validated against current assignments on every request; it never grants a new role. Switching reloads
  Home and clears cached records. Own records, reporting-manager/HOD relationships and manager/HOD/person approval steps
  remain identity-based. Role/access/fallback approval pools require the corresponding active role.
- The built-in **Super Admin** role has Edit on every area, including areas added later, and cannot be changed or
  deleted. Roles are read on every request, so a change applies at once.

Errors for access: `401 UNAUTHORIZED` "Please log in" (no / expired session), `403 FORBIDDEN` "You do not have
access to this" (not enough access).

**Temporary passwords:** a login given or reset by an admin (or by `npm run set-password`) has a temporary password.
Until it is changed with `accounts.changePassword`, every API except `accounts.me`, `accounts.logout` and
`accounts.changePassword` answers `403 FORBIDDEN` "Change your temporary password first" with
`data.passwordChangeRequired: true`.

**Who did it:** every table records who created and last changed each row (and who did each step such as sending
an offer). Responses show it as a **person**: `{ employeeCode: string | null, name: string }` - the logged-in
employee who did it, or `{ employeeCode: null, name: 'System' }` for scripts, migrations and rows from before this
was recorded; `null` when the step has not happened.

**Password APIs are limited (2026-11-16):** `accounts.login`, `requestPasswordReset`, `resetPasswordWithCode`,
`changePassword` and `confirmPassword` allow 5 tries a minute per account and action, and 300 tries in 15 minutes per IP
address - more answer `429 TOO_MANY_REQUESTS` "Too many tries - wait ... and try again". The lockout after wrong
passwords, the session length and the password rules are the security rules (`accounts.security.*`).

**Identity numbers and mobiles (2026-11-16, old HRMS rules):** an Aadhaar number must pass its check digit (Verhoeff)
and not start with 0 or 1; a PAN must be a person's (4th letter `P`, e.g. ABCPE1234F); a mobile is a 10-digit Indian
number starting 6-9 (with or without +91 / 0) or an international one with + and the country code. These apply to every
API that takes them (candidates, joining form, employees).

**Change history (2026-11-16):** every create / change / delete any API makes is recorded automatically, in the same
transaction (`audit_logs`, see `changeHistory.list`): who, when, which API, the IP and browser, and only the fields
that changed (old -> new; passwords, codes, tokens and encrypted numbers as "(secret)"). Sign-ins, failed sign-ins and
sign-outs are recorded too. The entries are hash-chained, so a row altered in the database is found by
`changeHistory.verify`. This applies to every API below without being repeated in each entry.

## Summary


**Excel review reports (2026-11-24):** Data exports use the shared report writer. Actual column headings remain on row 1; code/text and date formats remain usable for Excel/import workflows. Reports add a separate **Review notes** sheet with preparer, UTC export time, coverage, filter context, per-sheet row counts, reviewer/date/outcome and remarks. Data sheets use A4 landscape printing, repeated row headings, repeated identifier columns A:B for wide reports, page numbers and reviewer/date footers. Very wide sheets print across pages at 85% rather than shrinking all columns to unreadable text. Narrow sheets fit one page wide. Printouts are manual review aids: exporting or marking the sheet does not approve requests or change HRMS records. Import templates remain unchanged. All report endpoints return an `.xlsx` File.

**Total APIs: 317**

| # | API | Access | What it does |
|---|---|---|---|
| 1 | `health.check` | Public | Is the API up and can it reach the database |
| 2 | `accounts.login` | Public | Log in with employee code + password |
| 3 | `accounts.logout` | Logged in | Log out (end this session) |
| 4 | `accounts.me` | Logged in | Who is logged in, their roles and access per area |
| 5 | `accounts.changePassword` | Logged in | Change your own password (also ends a temporary password) |
| 6 | `accounts.confirmPassword` | Logged in | Re-enter one's password before changing roles (valid 10 minutes) |
| 7 | `accounts.requestPasswordReset` | Public | Forgot password: a one-time code to the employee's personal e-mail |
| 8 | `accounts.resetPasswordWithCode` | Public | Forgot password: set a new password with the e-mailed code |
| 9 | `accounts.create` | Roles & access: Edit | Give an employee a login (temporary password, shown once) |
| 10 | `accounts.resetPassword` | Roles & access: Edit | New temporary password for someone's login |
| 11 | `accounts.unlock` | Roles & access: Edit | Lift a lockout after too many wrong passwords |
| 12 | `accounts.disable` | Roles & access: Edit | Turn someone's login off (e.g. a suspension) - logged out everywhere |
| 13 | `accounts.enable` | Roles & access: Edit | Turn a login back on |
| 14 | `accounts.sessions.list` | Roles & access: View | Everyone signed in now: since when, last active, IP, browser |
| 15 | `accounts.sessions.mine` | Logged in | Where I am signed in |
| 16 | `accounts.sessions.end` | Own session; others: Roles & access: Edit | Log one session out |
| 17 | `accounts.sessions.endAll` | Roles & access: Edit | Log someone out everywhere (oneself: every other device) |
| 18 | `accounts.list` | Roles & access: View | Employees with a login and their roles |
| 19 | `accounts.setRoles` | Roles & access: Edit | Give an employee exactly these roles |
| 20 | `accounts.roles.list` | Roles & access: View | The areas and every role with its access |
| 21 | `accounts.roles.export` | Roles & access: View | Roles x access and who has which role, as an Excel file |
| 22 | `accounts.roles.create` | Roles & access: Edit | Make a role (View / Edit per area) |
| 23 | `accounts.roles.update` | Roles & access: Edit | Rename a role, change its access, mark it as the fallback approver |
| 24 | `accounts.roles.delete` | Roles & access: Edit | Delete a role nobody has and no approval chain uses |
| 25 | `employees.list` | Employees: View | The employee directory: search, filters, pages |
| 26 | `employees.export` | Employees: View | The directory (same filters) as an Excel file |
| 27 | `employees.search` | Employees: View | People pickers: employees who have not left, by code or name, across the group |
| 28 | `employees.directory` | Any logged-in employee | The company directory: everyone working now, every company, basic fields only |
| 29 | `employees.orgChart` | Any logged-in employee | The org chart around one employee: managers up, direct reports |
| 30 | `employees.create` | Employees: Edit | Add an employee directly, without onboarding (code from the company's series) |
| 31 | `employees.update` | Employees: Edit | Edit (correct) an employee's core details: job, placement, managers, contact |
| 32 | `employees.getByCode` | Own record; others: Employee · Directory & job: View (each part its own area) | One employee's profile (IDs / bank as last 4 digits) |
| 33 | `employees.updateStatutoryNumbers` | Employee · IDs, bank & statutory: Edit | Record the UAN, PF member number and ESIC IP number given after joining |
| 34 | `employees.updateOnboardingChecklist` | Employees: Edit | The office checklist after joining: payroll updated, ID card / access, induction date |
| 35 | `employees.salaryHistory` | Own record; others: Employee · Salary: View | An employee's salaries from each day, why and who approved |
| 36 | `employees.documents.list` | Own record; others: Employee · Documents & letters: View | An employee's documents |
| 37 | `employees.documents.download` | Own record; others: Employee · Documents & letters: View | Download an employee's document |
| 38 | `employees.documents.upload` | Own: Employee self-service; others: scoped Documents Edit | Submit an own document for HR review, or HR adds one |
| 39 | `employees.documents.review` | Employee · Documents & letters: Edit | Mark an employee's document verified, or rejected with a reason |
| 40 | `employees.documents.delete` | Employee · Documents & letters: Edit | Delete a wrong document (kept, can be restored) |
| 41 | `employees.documents.restore` | Employee · Documents & letters: Edit | Bring back a deleted document |
| 42 | `employees.layoffs.list` | Own record; others: Employees: View | An employee's lay offs |
| 43 | `employees.layoffs.create` | Employees: Edit | Record a lay off (from a day until back at work) |
| 44 | `employees.layoffs.update` | Employees: Edit | Change a lay off (e.g. give the day back at work) |
| 45 | `employees.layoffs.delete` | Employees: Edit | Remove a lay off entered by mistake |
| 46 | `employees.jobHistory.list` | Own record; others: Employees: View | An employee's job timeline |
| 47 | `employees.jobHistory.asOf` | Own record; others: Employees: View | An employee's job details on a day |
| 48 | `employees.imports.template` | Employees: Edit | The Excel template for importing existing employees |
| 49 | `employees.imports.upload` | Employees: Edit | Check a filled-in import file row by row; save it (all rows or none) |
| 50 | `employees.form.get` | Employee · Directory & job: View (each section its area) | The employee's records in the joining form's sections, to edit (numbers as last 4 digits) |
| 51 | `employees.form.save` | Each section: its area's Edit | HR saves sections of the employee's records after joining |
| 52 | `employees.hods.list` | HOD appointments: View | The HODs with the places (plant + department) each heads now or will head |
| 53 | `employees.hods.places` | HOD appointments: View | Every place (company + plant + department) with who heads it now and next - the place picker |
| 54 | `employees.hods.appoint` | HOD appointments: Edit | Appoint someone to places now, from a later or an earlier moment (replacing their HODs then); end some of theirs at once |
| 55 | `employees.hods.end` | HOD appointments: Edit | End someone's appointments on some places (now or after a last day); cancel an upcoming one; take back a planned end |
| 56 | `employees.hods.history` | HOD appointments: View | Who headed a place when - or the places someone headed |
| 57 | `employees.hods.gaps` | HOD appointments: View | The gap list: places without an HOD, HODs stopping with nobody after, leavers heading places |
| 58 | `employees.hods.myDepartment` | Logged in | An HOD's own department: the employees of the places they head |
| 59 | `organization.companies.list` | Logged in | List companies |
| 60 | `organization.companies.create` | Organization: Edit | Add a company |
| 61 | `organization.companies.update` | Organization: Edit | Change or retire a company |
| 62 | `organization.workLocations.list` | Logged in | List work locations |
| 63 | `organization.workLocations.create` | Organization: Edit | Add a work location (any company can use it) |
| 64 | `organization.workLocations.update` | Organization: Edit | Change or retire a work location |
| 65 | `organization.regions.list` | Logged in | List regions (East, West...) |
| 66 | `organization.regions.create` | Organization: Edit | Add a region |
| 67 | `organization.regions.update` | Organization: Edit | Rename or retire a region |
| 68 | `organization.plants.list` | Logged in | List plants (optionally of one company) |
| 69 | `organization.plants.create` | Organization: Edit | Add a plant (SAP plant code) to a company |
| 70 | `organization.plants.update` | Organization: Edit | Change or retire a plant |
| 71 | `organization.plants.setDepartments` | Organization: Edit | Set the departments that run at a plant |
| 72 | `organization.costCenters.list` | Logged in | List cost centres (optionally of one company) |
| 73 | `organization.costCenters.create` | Organization: Edit | Add a SAP cost centre to a company |
| 74 | `organization.costCenters.update` | Organization: Edit | Change or retire a cost centre |
| 75 | `organization.departments.list` | Logged in | List departments (optionally those of one plant) |
| 76 | `organization.departments.create` | Organization: Edit | Add a department |
| 77 | `organization.departments.update` | Organization: Edit | Rename or retire a department |
| 78 | `organization.designations.list` | Logged in | List designations |
| 79 | `organization.designations.create` | Organization: Edit | Add a designation |
| 80 | `organization.designations.update` | Organization: Edit | Rename or retire a designation |
| 81 | `organization.grades.list` | Logged in | List grades |
| 82 | `organization.grades.create` | Organization: Edit | Add a grade |
| 83 | `organization.grades.update` | Organization: Edit | Rename or retire a grade |
| 84 | `organization.positions.list` | Logged in | List positions |
| 85 | `organization.positions.create` | Organization: Edit | Add a position |
| 86 | `organization.positions.update` | Organization: Edit | Rename or retire a position |
| 87 | `organization.salaryComponents.list` | Logged in | List salary components (lines of an offer's salary breakup) |
| 88 | `organization.salaryComponents.create` | Organization: Edit | Add a salary component |
| 89 | `organization.salaryComponents.update` | Organization: Edit | Change or retire a salary component |
| 90 | `organization.salaryStructures.list` | Logged in (retired ones: Organization: View) | List salary structures (how an offer's breakup is worked out from its CTC) |
| 91 | `organization.salaryStructures.create` | Organization: Edit (all companies) | Add a salary structure with its lines |
| 92 | `organization.salaryStructures.update` | Organization: Edit (all companies) | Change, re-line or retire a salary structure |
| 93 | `organization.salaryStructures.calculate` | Logged in | The breakup of an annual CTC by the structure an offer matches (or a draft) |
| 94 | `candidates.list` | Onboarding: View | List candidates (offers), optionally by status / company |
| 95 | `candidates.get` | Onboarding: View | Get one candidate by id |
| 96 | `candidates.create` | Onboarding: Edit | Make a new offer (as a draft) |
| 97 | `candidates.update` | Onboarding: Edit | Change a candidate's details or offer terms |
| 98 | `candidates.send` | Onboarding: Edit | Write the Letter of Intent or the offer letter from the picked template, number it, e-mail it with the candidate's link |
| 99 | `candidates.accept` | Onboarding: Edit | Record that the candidate accepted the newest letter (LOI or offer) on paper (signed copy uploaded) |
| 100 | `candidates.close` | Onboarding: Edit | End the process: declined, expired, withdrawn, backed out or no-show |
| 101 | `candidates.offerLetters.templates` | Onboarding: View | The offer letter or Letter of Intent templates to pick from when sending (+ the suggested one) |
| 102 | `candidates.offerLetters.preview` | Onboarding: View | The offer letter PDF as it would be sent now with a template |
| 103 | `candidates.offerLetters.list` | Onboarding: View | Every letter sent for an offer, with the candidate's online answer |
| 104 | `candidates.offerLetters.download` | Onboarding: View | One sent letter, exactly as sent |
| 105 | `candidates.offerLetters.newLink` | Onboarding: Edit | A new link for the candidate (the old one stops), e-mailed again - after acceptance the joining-form link |
| 106 | `candidates.offerResponse.view` | Public (secret link) | What the candidate's offer page shows |
| 107 | `candidates.offerResponse.download` | Public (secret link) | The candidate downloads their letter |
| 108 | `candidates.offerResponse.sendCode` | Public (secret link) | E-mail the candidate a one-time code |
| 109 | `candidates.offerResponse.accept` | Public (secret link) | The candidate accepts online (code + typed name) |
| 110 | `candidates.offerResponse.decline` | Public (secret link) | The candidate declines online (code, optional reason) |
| 111 | `candidates.portal.signIn` | Public (secret link + code) | The candidate opens their joining form: starts a candidate session |
| 112 | `candidates.portal.me` | Candidate session | The candidate's joining-form page (numbers masked) |
| 113 | `candidates.portal.save` | Candidate session | The candidate saves sections of their joining form |
| 114 | `candidates.portal.uploadDocument` | Candidate session | The candidate uploads a document (photo, KYC copies, bank proof, certificates) |
| 115 | `candidates.portal.removeDocument` | Candidate session | The candidate removes their own upload before HR checks it |
| 116 | `candidates.portal.document` | Candidate session | The candidate views one of their documents |
| 117 | `candidates.portal.submit` | Candidate session | The candidate submits and signs the joining form online (code + typed name) |
| 118 | `candidates.portal.signOut` | Candidate session | Ends the candidate session |
| 119 | `candidates.joiningForm.get` | Onboarding: View | The candidate's joining-form draft (full numbers) and who changed each section |
| 120 | `candidates.joiningForm.save` | Onboarding: Edit | Save sections of the joining-form draft |
| 121 | `candidates.joiningForm.sendBack` | Onboarding: Edit | Send the submitted form back to the candidate for changes (reason e-mailed) |
| 122 | `candidates.printedForms.print` | Onboarding: View | HR's paper forms of the pack (joining form, Form F, ESIC Form 1, EPF Form 11, medical pages) filled in from the joining form, as one PDF to print and sign |
| 123 | `candidates.documents.list` | Onboarding: View | A candidate's uploaded documents with verification status |
| 124 | `candidates.documents.upload` | Onboarding: Edit | Upload a document (PDF / JPG / PNG, 5 MB) |
| 125 | `candidates.documents.download` | Onboarding: View | Download a document file |
| 126 | `candidates.documents.review` | Onboarding: Edit | Mark a document verified, or rejected with a reason |
| 127 | `candidates.documents.delete` | Onboarding: Edit | Delete a wrong or rejected upload (kept, can be restored) |
| 128 | `candidates.documents.restore` | Onboarding: Edit | Bring back a deleted document |
| 129 | `candidates.documents.requirements` | Onboarding: View | The documents each joining type always needs, and those an offer may ask for (offer form checklist) |
| 130 | `candidates.recordMedical` | Onboarding: Edit | Record the pre-employment medical result |
| 131 | `candidates.confirmJoining` | Onboarding: Edit | Record that the candidate confirmed they are joining |
| 132 | `candidates.joining.checklist` | Onboarding: View | What must be done before joining, item by item |
| 133 | `candidates.joining.complete` | Onboarding: Edit | Joining day: create the employee from the candidate (+ joining tasks, appointment letter) |
| 134 | `candidates.backgroundChecks.list` | Onboarding: View | A candidate's background checks |
| 135 | `candidates.backgroundChecks.create` | Onboarding: Edit | Start a background check (needs the signed consent) |
| 136 | `candidates.backgroundChecks.update` | Onboarding: Edit | Record progress or the result of a check |
| 137 | `candidates.backgroundChecks.delete` | Onboarding: Edit | Remove a check started by mistake |
| 138 | `letterTemplates.list` | Letter templates: View | The letter templates (every kind) |
| 139 | `letterTemplates.kinds` | Letter templates: View | The kinds of letter with the fields and blocks of each (for a new template) |
| 140 | `letterTemplates.get` | Letter templates: View | One template with its text and placeholders |
| 141 | `letterTemplates.create` | Letter templates: Edit | Add a letter template |
| 142 | `letterTemplates.update` | Letter templates: Edit | Change the wording / joining type, or retire a template |
| 143 | `letterTemplates.preview` | Letter templates: View | PDF of (unsaved) wording with example values |
| 144 | `letterTemplates.uploadImage` | Letter templates: Edit | Upload a new letterhead image for a template (the old one is kept) |
| 145 | `letterTemplates.setImage` | Letter templates: Edit | Use a letterhead image uploaded before on a template |
| 146 | `letterTemplates.images` | Letter templates: View | The uploaded letterhead images of one part, to pick from |
| 147 | `letterTemplates.image` | Letter templates: View | One uploaded letterhead image (by id) |
| 148 | `changeHistory.list` | Change history: View (one employee: Employees: View) | Who changed what and when, sign-ins - newest first, filtered |
| 149 | `changeHistory.verify` | Change history: View | Check that no history entry was changed or removed (hash chain) |
| 150 | `employeeLetters.list` | Own record; others: Employee · Documents & letters: View | The letters issued to an employee (appointment, confirmation...) |
| 151 | `employeeLetters.download` | Own record; others: Employee · Documents & letters: View | One issued letter's PDF |
| 152 | `employeeLetters.templates` | Employee · Directory & job: View + Employee · Documents & letters: Edit | The templates of a kind of letter to pick from (+ the suggested one) |
| 153 | `employeeLetters.preview` | Employee · Directory & job: View + Employee · Documents & letters: Edit | The letter as it would be issued now (PDF) |
| 154 | `employeeLetters.issue` | Employee · Directory & job: View + Employee · Documents & letters: Edit | Issue a letter: numbered, kept, e-mailed to the employee |
| 155 | `joiningTasks.types.list` | Joining task types: View (active ones: Onboarding: Edit) | The task list every new employee gets |
| 156 | `joiningTasks.types.create` | Joining task types: Edit | Add a task to the list (team, due days, default person) |
| 157 | `joiningTasks.types.update` | Joining task types: Edit | Change or retire a task on the list |
| 158 | `joiningTasks.assignees` | Onboarding or Joining task types: View | The people a joining task can be given to (Joining tasks: Edit) |
| 159 | `joiningTasks.list` | Joining tasks: View (mine) / Onboarding: View (all) | My tasks / all tasks - open or done, by team, search |
| 160 | `joiningTasks.forEmployee` | Own record; others: Employee · Directory & job: View | One employee's joining tasks |
| 161 | `joiningTasks.createForEmployee` | Onboarding: Edit | Make the joining tasks for an employee added directly (once) |
| 162 | `joiningTasks.complete` | The person it is given to (Joining tasks: Edit) or Onboarding: Edit | Mark a task done, with an optional note |
| 163 | `joiningTasks.reopen` | The person it is given to (Joining tasks: Edit) or Onboarding: Edit | Undo "done" |
| 164 | `joiningTasks.assign` | Onboarding: Edit | Give an open task to someone else |
| 165 | `accounts.security.get` | Roles & access: View | The security rules (lockout, sign-in length, password rules) |
| 166 | `accounts.security.update` | Roles & access: Edit (+ password re-entered) | Change the security rules |
| 167 | `candidates.export` | Onboarding: View | The "Offers & candidates" report (Excel) |
| 168 | `changeHistory.export` | Change history: View (one employee: Employees: View) | The change history as an Excel file |
| 169 | `employees.imports.history` | Employees: Edit | The files imported and the ones with errors |
| 170 | `employees.imports.errorReport` | Employees: Edit | A file's rows to fix, as an Excel file |
| 171 | `attendance.overview` | any logged-in employee | what the attendance page and the home page's "Today" card show first |
| 172 | `attendance.days.myMonth` | any logged-in employee (their own) | the employee's month calendar |
| 173 | `attendance.days.employeeMonth` | own | one employee's month |
| 174 | `attendance.days.board` | TEAM / DEPARTMENT: any logged-in employee (their reporting tree / the employees whose HOD they are); ALL: Attendance: View | who is in / late / not in yet / absent / off on a day |
| 175 | `attendance.days.muster` | as `board` | the monthly muster: everyone in the scope x every day |
| 176 | `attendance.days.exportMuster` | as `board` | the muster as Excel |
| 177 | `attendance.days.punches` | as `employeeMonth` | the day's details |
| 178 | `attendance.days.correct` | Attendance: Edit | HR sets the day's status with a reason |
| 179 | `attendance.days.removeCorrection` | Attendance: Edit | takes HR's correction away; the day goes back to what the punches give |
| 180 | `attendance.shifts.list` | any logged-in employee (retired ones: Attendance setup: View) | the shifts |
| 181 | `attendance.shifts.create` | Attendance setup: Edit | adds a shift |
| 182 | `attendance.shifts.update` | Attendance setup: Edit | changes or retires a shift; new times apply from a date (dated) |
| 183 | `attendance.shifts.assign` | Attendance setup: Edit | the schedule pattern and attendance policy of employees from a date |
| 184 | `attendance.shifts.assignments` | own, or Attendance setup: View | one employee's schedules |
| 185 | `attendance.shifts.schedules` | Attendance setup: View | who follows which schedule pattern, policy and holiday list today |
| 186 | `attendance.shifts.patterns.list` | any logged-in employee (retired: Attendance setup: View) | the schedule patterns |
| 187 | `attendance.shifts.patterns.create` | Attendance setup: Edit | adds a schedule pattern |
| 188 | `attendance.shifts.patterns.update` | Attendance setup: Edit | changes, retires or stars (makes the default) a schedule pattern |
| 189 | `attendance.policies.list` | any logged-in employee (retired ones: Attendance setup: View) | the attendance policies |
| 190 | `attendance.policies.create` | Attendance setup: Edit (all companies) | adds an attendance policy |
| 191 | `attendance.policies.update` | Attendance setup: Edit (all companies) | changes the rules from a date, renames, makes default or retires a policy |
| 192 | `attendance.locks.months` | Attendance setup: Edit (all companies) | a year's attendance months - locked or not |
| 193 | `attendance.locks.checklist` | Attendance setup: Edit (all companies) | what is still open in a month before locking |
| 194 | `attendance.locks.lock` | Attendance setup: Edit (all companies) | locks an attendance month (the whole group) |
| 195 | `attendance.locks.unlock` | Attendance setup: Edit (all companies) | opens a locked month again, with a reason |
| 196 | `attendance.locks.setCycleStart` | Attendance setup: Edit (all companies) | the day an attendance month starts |
| 197 | `attendance.holidays.list` | Attendance setup: View | a year's holidays of every list, each with its category and lists (one list's, when asked) |
| 198 | `attendance.holidays.create` | Attendance setup: Edit (every list it goes in) | adds a holiday to holiday lists; a month already worked out is worked out again |
| 199 | `attendance.holidays.update` | Attendance setup: Edit (every list it is / goes in) | changes a holiday or the lists that have it |
| 200 | `attendance.holidays.delete` | Attendance setup: Edit (every list it is in) | removes a holiday |
| 201 | `attendance.punches.upload` | Attendance setup: Edit | the biometric machines' export until the Kent feed is connected |
| 202 | `attendance.punches.uploads` | Attendance setup: View | the earlier uploads |
| 203 | `attendance.punches.unmatched` | Attendance setup: View | the codes on the machines that matched no employee |
| 204 | `attendance.punches.link` | Attendance setup: Edit | gives every unmatched punch of a code to an employee; their days are worked out again |
| 205 | `attendance.punches.addManual` | Attendance setup: Edit | testing only: punches typed by hand for one employee on one day |
| 206 | `attendance.rosters.grid` | Attendance setup: View | the roster: who works which shift on which day |
| 207 | `attendance.rosters.save` | Attendance setup: Edit | sets days of the draft |
| 208 | `attendance.rosters.clear` | as `save` | takes draft days out |
| 209 | `attendance.rosters.publish` | as `save` | publishes the draft days of these employees in the range - attendance follows them; days already come are work |
| 210 | `attendance.shiftChanges.create` | any logged-in employee (their own), Employee self-service only | asks to change one day - goes for approval (approval service) |
| 211 | `attendance.shiftChanges.cancel` | the employee (their own request), Employee self-service only | takes back a request still waiting |
| 212 | `attendance.shiftChanges.mine` | any logged-in employee | the employee's requests and where they stand |
| 213 | `attendance.regularizations.create` | any logged-in employee (their own), Employee self-service only | asks for a missed punch to count as present, or for on duty - goes for approval |
| 214 | `attendance.regularizations.cancel` | the employee (their own request), Employee self-service only | withdraws a request still waiting |
| 215 | `attendance.regularizations.mine` | any logged-in employee | the employee's regularization / on-duty requests and where they stand |
| 216 | `approvals.listToDecide` | Logged in, per portal | What waits for my decision, of every kind |
| 217 | `approvals.countToDecide` | Logged in, per portal | How many requests wait for my decision (the menu) |
| 218 | `approvals.listMine` | Logged in, per portal | The requests I raised |
| 219 | `approvals.listDecided` | Logged in, per portal | The requests I approved or rejected, and where they stand now |
| 220 | `approvals.get` | The request's people (or as the feature allows) | One request with its steps |
| 221 | `approvals.decide` | The step's approver, in its portal | Approve, or reject with a reason |
| 222 | `approvals.cancel` | The requester (or as the feature allows); one's own in self-service | Take back a request still waiting |
| 223 | `approvals.listHeld` | Approval chains: Edit | Requests nobody can decide - routing to repair |
| 224 | `approvals.retryRouting` | Approval chains: Edit | Send a held request through its chain again |
| 225 | `approvals.chains.list` | Approval chains: View | The approval chains of every kind |
| 226 | `approvals.chains.save` | Approval chains: Edit | Set the steps of a chain (shared, or a company's own) |
| 227 | `approvals.chains.remove` | Approval chains: Edit | Remove a company's own chain |
| 228 | `jobChanges.create` | Request job changes: Edit / Request salary changes: Edit (+ Employee · Salary: View) | Ask for a job / salary change from a day on - goes for approval |
| 229 | `jobChanges.get` | Employees: View, the employee themselves, or the approval's people | One job change |
| 230 | `jobChanges.list` | Employees: View; own (about me / asked by me): any logged-in employee | Job changes, filtered |
| 231 | `jobChanges.export` | Employees: View | Job changes as Excel |
| 232 | `jobChanges.cancel` | The requester, or Employees: Edit | Cancel a change not in force yet |
| 233 | `leave.overview` | Logged in | whether the viewer has a team / department to see, and what they may do |
| 234 | `leave.types.list` | Logged in (retired ones: Leave: View) | the leave types and their rules |
| 235 | `leave.types.create` | Leave: Edit (all companies) | adds a leave type |
| 236 | `leave.types.update` | Leave: Edit (all companies) | changes / retires a leave type |
| 237 | `leave.balances.get` | own; team / department; Leave: View | one employee's balances in a year and every row behind them |
| 238 | `leave.balances.register` | team / department; Leave: View for everyone | everyone's balance of each leave type |
| 239 | `leave.balances.export` | as `register` | the register as Excel |
| 240 | `leave.balances.adjust` | Leave: Edit | HR adds or takes away days with a reason |
| 241 | `leave.balances.runCredits` | Leave: Edit (all companies) | credits the months due and lapses the years ended now |
| 242 | `leave.balances.importTemplate` | Leave: Edit | the opening balances Excel template |
| 243 | `leave.balances.importBalances` | Leave: Edit | checks / saves an Excel of opening balances (all rows or none) |
| 244 | `leave.applications.preview` | Logged in (their own), Employee self-service only | what a leave would take, before applying |
| 245 | `leave.applications.apply` | Logged in (their own), Employee self-service only | applies for leave - goes for approval |
| 246 | `leave.applications.cancel` | the employee (their own), Employee self-service only | withdraws a leave still waiting, or asks to cancel an approved one |
| 247 | `leave.applications.mine` | Logged in | the employee's leave and where it stands |
| 248 | `leave.applications.list` | team / department; Leave: View for everyone | who is on leave over a span |
| 249 | `leave.applications.forApproval` | the approval request's people | the leave behind an approval request, with the balance |
| 250 | `leave.applications.recounts` | Leave: View | approved leave the calendar now counts otherwise |
| 251 | `leave.applications.recount` | Leave: Edit | puts one approved leave right by today's calendar |
| 252 | `leave.compOff.claim` | Logged in (their own), Employee self-service only | claims comp-off for work on a weekly off / holiday - goes for approval |
| 253 | `leave.compOff.cancel` | the employee (their own), Employee self-service only | withdraws a claim still waiting |
| 254 | `leave.compOff.mine` | Logged in | the employee's comp-off claims |
| 255 | `organization.export` | Organization: View | Excel review report |
| 256 | `approvals.export` | Logged in; held mode additionally Approval chains: Edit | Excel review report |
| 257 | `approvals.chains.export` | Approval chains: View | Excel review report |
| 258 | `attendance.days.exportMonth` | Logged in; another employee as employeeMonth | Excel review report |
| 259 | `attendance.days.exportBoard` | Logged in; as board | Excel review report |
| 260 | `attendance.exportSetup` | Attendance setup: View; locks additionally group-wide Edit | Excel review report |
| 261 | `attendance.rosters.export` | Attendance setup: View | Excel review report |
| 262 | `employees.exportDirectory` | Logged in; everyone needs Employees: View | Excel review report |
| 263 | `employees.hods.export` | Logged in; heads additionally HOD appointments: View | Excel review report |
| 264 | `joiningTasks.export` | Logged in; MINE Joining tasks: View, ALL Onboarding: View | Excel review report |
| 265 | `joiningTasks.types.export` | As joiningTasks.types.list | Excel review report |
| 266 | `leave.applications.export` | Logged in; as applications.list | Excel review report |
| 267 | `leave.applications.exportMine` | Logged in | Excel review report |
| 268 | `leave.applications.exportRecounts` | Leave: View | Excel review report |
| 269 | `leave.types.export` | Logged in | Excel review report |
| 270 | `approvals.report` | Logged in; team/HOD relationship or scoped area access | Combined leave and attendance request report with messages and history |
| 271 | `attendance.reports.list` | Logged in; team/HOD relationship or Attendance View | Paged attendance detail/exceptions with scoped summaries and filters |
| 272 | `attendance.reports.export` | Same as reports.list | All filtered attendance days, summary and Excel review notes |
| 273 | `attendance.reports.exportPunches` | Same as days.punches | Raw punches owned by one employee work date, with stored provenance |
| 274 | `attendance.holidayLists.list` | any logged-in employee (retired ones: Attendance setup: View) | the named holiday lists and the plants they are the default of |
| 275 | `attendance.holidayLists.create` | Attendance setup: Edit (the list's company / all companies) | adds a holiday list |
| 276 | `attendance.holidayLists.update` | Attendance setup: Edit (the list's company / all companies) | renames, moves to another company or retires a list |
| 277 | `attendance.holidayLists.setPlantDefault` | Attendance setup: Edit (the whole plant) | a plant's default holiday list |
| 278 | `attendance.holidayCategories.list` | any logged-in employee (retired ones: Attendance setup: View) | HR's holiday categories and their colours |
| 279 | `attendance.holidayCategories.create` | Attendance setup: Edit (all companies) | adds a holiday category |
| 280 | `attendance.holidayCategories.update` | Attendance setup: Edit (all companies) | renames, recolours or retires a category |
| 281 | `attendance.holidayLists.assign` | Attendance setup: Edit (covering each person) | employees follow a holiday list from a date - one or many |
| 282 | `attendance.holidayLists.fillMissing` | Attendance setup: Edit | gives everyone without a holiday list their plant's default |
| 283 | `attendance.holidays.copyYear` | Attendance setup: Edit (the lists copied into) | copies last year's holidays into a year, the same lists |
| 284 | `leave.balances.giveMany` | Leave: Edit (covering each person) | gives days of a leave type to many - chosen, or everyone matching |
| 285 | `attendance.holidays.mine` | Logged in (their own) | one's own holidays of a year - those of the list followed on each date |
| 286 | `attendance.holidayLists.ofEmployee` | own, or Employees: View | one employee's holiday list today (the profile's Job tab) |
| 287 | `employees.movements.list` | Employee directory & job: View | Scoped recorded joining/leaving events, full summaries and pagination |
| 288 | `employees.movements.export` | Employee directory & job: View | All matching joining/leaving events as Excel, with review notes |
| 289 | `dailyMovementReports.settings.get` | Active Super Admin only | Daily movement email configuration and eligible HR Head roles |
| 290 | `dailyMovementReports.settings.save` | Active Super Admin only | Save the schedule and HR Head role; delivery stays disabled |
| 291 | `payroll.setup` | Payroll: View | Eligible whole-company India payroll choices and current attendance window |
| 292 | `payroll.list` | Payroll: View | Scoped company/month draft runs and matching pagination totals |
| 293 | `payroll.get` | Payroll: View covering whole company | Run header, pay and attendance periods, people / inputs counts, last refresh |
| 294 | `payroll.create` | Payroll: Edit covering whole company | Create a regular monthly India draft and copy its people and salaries |
| 295 | `payroll.people.list` | Payroll: View covering whole company | The run's people: days (in the run, paid, unpaid, to check), pay worked out or held, stretches, flags; salary and earned figures only with Salary: View |
| 296 | `payroll.people.get` | Payroll: View covering whole company | One person's copied stretches, placement, each day as taken from attendance, whether their pay is worked out and (with Salary: View) salary and earned lines |
| 297 | `payroll.people.refresh` | Payroll: Edit covering whole company | Rebuild a draft's people and salary copy from the employee records |
| 298 | `payroll.inputs.list` | Payroll: View covering whole company | The run's monthly inputs, searchable and paged |
| 299 | `payroll.inputs.create` | Payroll: Edit covering whole company | Type one input (incentive, canteen...) for a person of a draft run |
| 300 | `payroll.inputs.update` | Payroll: Edit covering whole company | Change an input of a draft run |
| 301 | `payroll.inputs.delete` | Payroll: Edit covering whole company | Remove an input of a draft run |
| 302 | `payroll.calculation.compute` | Payroll: Edit covering whole company | "Work out pay": a draft run's days from the locked attendance, each person's earnings, deductions and employer contributions |
| 303 | `attendance.exemptions.create` | Attendance setup: Edit covering each employee | Mark employees "attendance not tracked" from a day (they count present without punches) |
| 304 | `attendance.exemptions.update` | Attendance setup: Edit covering the employee | End a "not tracked" marker on a day (or let it run on), correct its reason |
| 305 | `attendance.exemptions.delete` | Attendance setup: Edit covering the employee | Remove a "not tracked" marker set by mistake |
| 306 | `payroll.statutory.list` | Payroll: View | The statutory rates, professional-tax and income-tax slabs, labour welfare fund (one group-wide list) |
| 307 | `payroll.statutory.saveRate` | Payroll: Edit for every company | Add or change one dated rate or limit |
| 308 | `payroll.statutory.deleteRate` | Payroll: Edit for every company | Remove a dated rate |
| 309 | `payroll.statutory.savePtSlabs` | Payroll: Edit for every company | Save the professional-tax slabs of a State from a date |
| 310 | `payroll.statutory.deletePtSlabs` | Payroll: Edit for every company | Remove a State's slabs from a date |
| 311 | `payroll.statutory.saveLwf` | Payroll: Edit for every company | Add or change a State's labour welfare fund from a date |
| 312 | `payroll.statutory.deleteLwf` | Payroll: Edit for every company | Remove a labour welfare fund row |
| 313 | `payroll.statutory.saveTaxSlabs` | Payroll: Edit for every company | Save the income-tax slabs of a regime and tax year |
| 314 | `payroll.statutory.deleteTaxSlabs` | Payroll: Edit for every company | Remove the slabs of a regime and tax year |
| 315 | `payroll.taxOpenings.list` | Payroll: View covering the employee's company | Opening tax figures of a tax year (earned and deducted outside this system) |
| 316 | `payroll.taxOpenings.save` | Payroll: Edit covering the employee's company | Add or change an employee's opening tax figures |
| 317 | `payroll.taxOpenings.delete` | Payroll: Edit covering the employee's company | Remove opening tax figures |

---

## health

### `health.check`
- **HTTP:** `POST /api/rpc/health/check` · **Code:** `backend/src/modules/health/`
- **Access:** Public (stays public - used by monitoring)
- **Scope:** not limited by data access (public).
- **Input:** none
- **Returns:** `{ status: 'ok', checkedAt: Date }`
- **What it does:** runs a trivial query against the database.
- **Errors:** `503 SERVICE_UNAVAILABLE` "Database is unreachable" when the database does not answer.

## employees

### `employees.list`
- **HTTP:** `POST /api/rpc/employees/list` · **Code:** `backend/src/modules/employees/`
- **Access:** Employees: View.
- **Scope:** only employees inside the caller's Employee · Directory & job View data access - the list, the filter counts and the tiles; PF / ESIC numbers only where Employee · IDs, bank & statutory View covers the employee.
- **Input (optional):**

  | Field | Type | Required | Rules |
  |---|---|---|---|
  | `search` | string | no | up to 100 chars; every word must match the code or a part of the name |
  | `companyIds`, `plantIds`, `workLocationIds`, `departmentIds`, `designationIds` | number[] | no | any of these (several values per filter - 2026-11-16; plants 2026-11-18) |
  | `employmentTypes` | EmploymentType[] | no | any of these |
  | `workforceCategories` | (`WHITE_COLLAR` \| `BLUE_COLLAR`)[] | no | any of these |
  | `reportingManagerCode` | string | no | only the employees who report to this employee (2026-11-16) |
  | `status` | `ACTIVE` \| `ON_NOTICE` \| `EXITED` | no | |
  | `numbersPending` | boolean | no | `true`: only those with PF / ESIC numbers still to record (2026-11-15) |
  | `joinedFrom` | Date | no | only those who joined on or after this date (2026-11-15) |
  | `sort` | `code` \| `name` \| `joined` \| `designation` \| `department` \| `company` | no | default `code` |
  | `direction` | `asc` \| `desc` | no | default `asc` |
  | `page` | number | no | 1 = first page (default) |
  | `pageSize` | number | no | 1-100, default 25 |

- **Returns:** `{ items: [{ employeeCode, name, status, employmentType, workforceCategory, dateOfJoining, company {id, code, name}, plant {id, plantCode, name}, workLocation {id, name},
  department {id, name}, designation {id, name}, position {name} | null, costCenter {code, name} | null, reportingManager {employeeCode, name} | null,
  functionalManager {employeeCode, name} | null, pendingNumbers }], total, page, pageSize, summary, facets }`,
  in the chosen order. `facets` (2026-11-16): for `companyId`, `plantId`, `workLocationId`, `departmentId`, `designationId`,
  `employmentType`, `workforceCategory` - `[{ value, count }]` how many employees each value would show with the other
  filters applied (a filter's own ticks do not shrink its counts; `value: null` = not set, e.g. no department). `summary` (the employees inside the caller's data access, whatever the filters - the page's stat tiles, 2026-11-15): `{ active, onNotice,
  exited, joinedThisMonth, numbersPending }` (`numbersPending`: active employees with PF / ESIC numbers to record).
  `pendingNumbers`: the PF / ESIC numbers still to record - `UAN` and `PF member number` where PF applies, `ESIC IP
  number` where ESIC applies (given after joining; see `updateStatutoryNumbers`).
- **What it does:** the employee directory. The PF / ESIC numbers still to record are IDs information (2026-11-16):
  without Employee · IDs, bank & statutory View `pendingNumbers` is empty, `summary.numbersPending` null and the
  `numbersPending` filter is ignored.
- **Errors:** `400` invalid input · `403` (see Access).

### `employees.getByCode`
- **HTTP:** `POST /api/rpc/employees/getByCode` · **Code:** `backend/src/modules/employees/`
- **Access:** any logged-in employee for their **own** code (everything); anyone else's record needs Employee directory
  & job: View, and each part its own area (split 2026-11-16): without **Employee · Personal** View the personal
  columns (parents, gender, date of birth, marital, religion, category, blood group, height / weight, identification
  mark, hobbies, disability) are null and `addresses`, `emergencyContacts`, `qualifications`, `certifications`,
  `previousJobs`, `familyMembers`, `nominees` are empty; without **Employee · IDs, bank & statutory** View
  `identityDocuments`, `bankAccounts` are empty and `statutory` null; the answer then says so with
  `personalDetailsHidden`, `idsBankHidden` (and `documentsHidden` for the documents area). Salary and medical as
  below (their areas, also with Employee · Directory & job for someone else's).
- **Scope:** one's own record; anyone else's: Employee · Directory & job View covering the employee (else `404` "No employee found"); each part (personal, IDs & bank, documents, medical, salary) needs its area covering the employee too.
- **Input:**

  | Field | Type | Required | Rules |
  |---|---|---|---|
  | `employeeCode` | string | yes | trimmed, upper-cased, 1-30 chars (`" rml001 "` finds `RML001`) |

- **Returns:** the employee - official (`employeeCode`, `joiningType`, `employmentType`, `workforceCategory`,
  `dateOfJoining`, `contractEndDate`, `probationEndDate`, `noticeMonthsProbation`, `noticeMonthsConfirmed` (from the
  offer), `confirmationDate`, `dateOfLeaving`, `status`), placement
  (`company {id, code, name}`, `plant {id, plantCode, name}`, `workLocation {id, name, countryCode, address, postalCode, region {name} | null}`
  (the address and region of the location - 2026-11-19), `department`, `designation`, `grade`, `position` (2026-11-19) as
  `{id, name}`, `costCenter {id, code, name}` or null (2026-11-19), `reportingManager` as `{employeeCode, name}` or null - 2026-11-16,
  `functionalManager` as `{employeeCode, name}` or null (shown only - 2026-11-19), `hod` - their HOD post (BACKLOG 3e, 2026-11-19: the plant-department they are placed in): `{ postId, company (code), plant {plantCode, name}, department (name), holder {employeeCode, name, since, until | null} | null (nobody heads it now - HR approves; the employee themselves when they head it; `until` a planned end), next {employeeCode, name, from} | null (appointed from a later moment) }`; every employee has one - department required since 2026-11-19), personal (`salutation` (from the offer), names, `fatherName`, `motherName`, `gender`, `dateOfBirth`, `placeOfBirth`, `maritalStatus`, `spouseName`, `marriageDate`,
  `countryOfOrigin`, `nationality`, `religion`, `category`, `bloodGroup`, `heightCm`, `weightKg`, `identificationMark`,
  `hobbies`, `isPhysicallyDisabled`, `disabilityType`, `disabilityPercent`) and contact (`workEmail`, `personalEmail`, `mobile`, `alternateMobile`);
  `medicalInfo` (the medical information as in `joiningForm.save` + `consentAt`, `consentById`) only for the employee
  themselves or **Medical information: View** - else null, with `medicalInfoHidden: true` when there is some;
  `salary` (the salary in effect today: `effectiveFrom`, `annualCtc`, `performancePayAnnual`, `currency`, `lines[]` of
  `{ monthlyAmount, salaryComponent { id, name, kind } }` in the components' order) only for the employee themselves or
  **Salary: View** - else null, with `salaryHidden: true` when there is one (2026-11-15);
  `joining` also has the office-use checklist `joiningFormalitiesCompletedAt` / `joiningFormalitiesCompletedBy` (HR's
  tick that everything of the joining is done - not `completedAt`, the record being created), `payrollUpdatedAt` /
  `payrollUpdatedBy`, `idCardIssuedAt` / `idCardIssuedBy`,
  `inductionDate`, and the pre-employment medical copied from onboarding (`medicalResult`, `medicalExamDate`,
  `medicalExaminer`, `medicalRestrictions` - only with Medical covering the employee, else null with
  `medicalHidden: true` when one is recorded - 2026-11-23);
  plus `addresses[]`, `emergencyContacts[]`, `identityDocuments[]` (`type`, **`numberLast4`**, `nameOnDocument`,
  `issuingCountry`, `validFrom`, `validUntil`), `bankAccounts[]` (`bankName`, `branch`, `accountHolderName`,
  **`accountNumberLast4`**, `ifsc`, `accountType`, `isSalaryAccount`), `statutory` (all EPF / ESIC answers, UAN, PF and
  ESIC numbers, or null), `qualifications[]` (`qualification`, `institute`, `yearOfPassing`, `specialization`, `score`),
  `certifications[]` (`name`, `issuedBy`, `certifiedOn`, `specialization`, `score`), `previousJobs[]` (`employerName`,
  `designation`, `fromDate`, `toDate`, `reasonForLeaving`), `familyMembers[]` (`name`, `relationship`, `gender`,
  `dateOfBirth`, **`aadhaarLast4`**, `preExistingDisease`, `livesWithEmployee`, `residenceTown`, `residenceState`),
  `nominees[]` (`scheme`, `name`, `relationship`, `dateOfBirth`, `address`, `sharePercent`, `guardianName`, `guardianAddress`), `createdAt` /
  `createdBy`, `updatedAt` / `updatedBy` (persons), `joining` (`{ completedAt, completedBy, formDate,
  declarationAcceptedAt }`, null for imported employees) and `candidateId` (the offer joined from, or null).
  Identity and bank numbers are **never** returned in full - only the last 4 digits (decided 2026-11-12).
- **What it does:** the employee profile. A code the employee had before a company transfer finds them too (2026-11-20 - the answer has their code now).
- **Errors:** `400` invalid input · `403 FORBIDDEN` someone else's code without Employees: View · `404 NOT_FOUND`
  "No employee found with code X".

### `employees.export`
- **HTTP:** `POST /api/rpc/employees/export` · **Code:** `backend/src/modules/employees/`
- **Access:** Employees: View.
- **Scope:** only employees inside the caller's Employee · Directory & job View data access; PF / ESIC numbers only where Employee · IDs, bank & statutory View covers.
- **Input (optional):** the filters and order of `employees.list` (`search`, `companyIds`, `plantIds`, `workLocationIds`, `departmentIds`,
  `designationIds`, `employmentTypes`, `workforceCategories`, `reportingManagerCode`, `status`, `numbersPending`, `joinedFrom`,
  `sort`, `direction`) - no paging.
- **Returns:** a file `employees-YYYY-MM-DD.xlsx` - one row per matching employee (up to 20 000): code, name, status,
  company, plant, work location, department, designation, position, employment type, workforce, date of joining, reporting manager (code and name),
  functional manager (code and name), cost centre (2026-11-19), the PF / ESIC numbers still to record.
- **What it does:** the directory as an Excel file (old HRMS export, 2026-11-16). The "PF / ESIC numbers to record"
  column only with Employee · IDs, bank & statutory View.
- **Errors:** `400` invalid input · `403` (see Access).

- **Review format (2026-11-24):** shared Excel review-report formatting and separate Review notes sheet described above; existing data columns and authorization retained. More than 20,000 matching records returns `400 BAD_REQUEST` with instructions to narrow filters; no silently truncated workbook.

### `employees.search`
- **HTTP:** `POST /api/rpc/employees/search` · **Code:** `backend/src/modules/employees/`
- **Access:** Employees: View.
- **Scope:** not limited by data access - the whole group, so a manager or colleague can be picked anywhere (code, name, designation, company only).
- **Input (optional):** `{ query?: string }` - up to 100 chars; every word must match the code (or a code the employee had before a company transfer - 2026-11-20) or a part of the name.
- **Returns:** up to 20 `[{ employeeCode, name, designation (name or null), company (code) }]`, by employee code.
- **What it does:** the people pickers (reporting manager, colleague, change-history filters - 2026-11-18): employees who
  have not left, across the whole group, so someone can be picked from another plant; only code, name, designation and
  company are returned.
- **Errors:** `400` invalid input · `403` (see Access).

### `employees.directory`
- **HTTP:** `POST /api/rpc/employees/directory` · **Code:** `backend/src/modules/employees/`
- **Access:** any logged-in employee (the user, 2026-11-21 - like greytHR's People directory).
- **Scope:** not limited by data access - the company directory every employee shares: everyone working now (not left) in
  **every company**, basic fields only. Personal contacts, IDs, salary, documents and the full profile are never returned
  (the profile stays `employees.getByCode`, Employee · Directory & job View).
- **Input (optional):** `{ group?: 'TEAM' | 'DEPARTMENT', search?: string (≤100; every word matches the code or a part of the
  name), companyIds?, plantIds?, departmentIds?: number[], page = 1, pageSize = 50 (1-100) }` - `group`: TEAM = who reports
  to the caller, DEPARTMENT = whose HOD the caller is now (worked out from the caller, never from the request); none = everyone.
- **Returns:** `{ items: [{ employeeCode, name, designation, department {id, name} | null, company {id, code, name}, plant {id,
  code, name}, workLocation, workEmail, reportingManager {employeeCode, name} | null, dateOfJoining, birthday {day, month} | null
  (no year), bloodGroup, directReports (how many report to them now) }], total, page, pageSize }` - by name.
- **What it does:** the People page's Directory tab (My team · My department · Everyone, filters: company, plant, department) - the list and the card of the person clicked.
- **Errors:** `400` invalid input.

### `employees.orgChart`
- **HTTP:** `POST /api/rpc/employees/orgChart` · **Code:** `backend/src/modules/employees/`
- **Access:** any logged-in employee (2026-11-21).
- **Scope:** not limited by data access - the reporting tree of the company directory (basic fields only, as `employees.directory`).
- **Input (optional):** `{ employeeCode? }` - default: the caller.
- **Returns:** `{ person, managers: [...] (nearest first, up to 15 - a loop stops it), reports: [...] (who reports to them now, up
  to 200, by name) }` - each as a directory item.
- **What it does:** the People page's Org chart tab - walk up and down the reporting tree.
- **Errors:** `400` · `404` unknown employee or one who has left.

### `employees.create`
- **HTTP:** `POST /api/rpc/employees/create` · **Code:** `backend/src/modules/employees/`
- **Access:** Employees: Edit.
- **Scope:** the new employee's company / plant / department inside the caller's Employee · Directory & job **Edit** data access (`403`).
- **Input:**

  | Field | Type | Required | Rules |
  |---|---|---|---|
  | `companyId` | number | yes | an existing company |
  | `plantId` | number | yes | an **active plant of the company** (2026-11-18) |
  | `departmentId` | number | yes | **one of the plant's departments** (`organization.departments.list` with `plantId`) - required since 2026-11-19 |
  | `designationId` | number | no | |
  | `workLocationId`, `gradeId` | number | no | |
  | `positionId` | number | no | a position (2026-11-19) |
  | `costCenterId` | number | no | an **active cost centre of the company** (2026-11-19) |
  | `salutation` | `MR` \| `MS` \| `MRS` \| `DR` | no | |
  | `firstName` | string | yes | 1-100 chars |
  | `middleName`, `lastName` | string | no | 1-100 chars |
  | `gender` | `MALE` \| `FEMALE` \| `TRANSGENDER` | no | |
  | `dateOfBirth` | Date | no | in the past; **at least 18 years before `dateOfJoining`** |
  | `dateOfJoining` | Date | yes | may be in the future (as the old HRMS, 2026-11-16) |
  | `joiningType` | `REGULAR` \| `CONSULTANT_INTERN` \| `OVERSEAS` | no | default `REGULAR` |
  | `employmentType` | `PERMANENT` \| `CONTRACT` \| `TRAINEE` \| `CONSULTANT` \| `APPRENTICE` | no | default `PERMANENT` |
  | `workforceCategory` | `WHITE_COLLAR` \| `BLUE_COLLAR` | no | default `WHITE_COLLAR` |
  | `contractEndDate` | Date | no | after `dateOfJoining`; not for `PERMANENT` |
  | `probationEndDate` | Date | no | after `dateOfJoining` |
  | `mobile` | string | no | 6-20 chars |
  | `personalEmail` | string | no | e-mail, lower-cased |
  | `workEmail` | string | no | e-mail, lower-cased, unique |
  | `reportingManagerCode` | string | no | an employee who has not left |
  | `functionalManagerCode` | string | no | a second manager, shown only (2026-11-19): an employee who has not left |

  Only the company, plant (2026-11-18), department (2026-11-19), first name and date of joining are required (as the old
  HRMS, 2026-11-16) - the rest can be filled in later with `employees.update`.
- **Returns:** `{ employeeCode }` - the code given.
- **What it does:** "Add employee" (old HRMS, 2026-11-16) - someone who joins without onboarding becomes an `ACTIVE`
  employee with these core details (IDs, bank, family... are added later). The code is the next of the company's series
  (`ecodePrefix` + `nextEmployeeNumber` as 6 digits, e.g. `RML035385`; a code already used is skipped); the company row
  is locked until the employee is saved, so two people never get the same code. No login is created (as in the old
  HRMS) - give one with `accounts.create`. The employee's HOD post (BACKLOG 3e, 2026-11-19) is the plant-department they
  are placed in. The job timeline gets its first entry (`JOINING`, from the date of joining - `employees.jobHistory.list`).
- **Errors:** `400` invalid input, a date rule, a plant that is not an active plant of the company, a department that does
  not run at the plant, a cost centre of another company or retired, the company has no code series yet ("set its next
  employee number on the Organization page"), or the reporting / functional manager is unknown / has left · `409 CONFLICT`
  work e-mail already used, or an unknown master id. Â· `400` "<master> X is no longer in use - choose one that is" - a retired company, department, work location, designation, grade or position chosen anew (one the employee already has is kept - 2026-11-23)

### `employees.update`
- **HTTP:** `POST /api/rpc/employees/update` · **Code:** `backend/src/modules/employees/`
- **Access:** Employees: Edit.
- **Scope:** Edit covering the employee (job details: also Approve job & salary changes Edit there - D7) (outside the caller's Employee · Directory & job View data access `404`, View only `403`) and, for a move, covering the new plant / department (`403`).
- **Input:** `employeeCode` (required - which employee) plus any field of `create` except `companyId`, and
  `confirmationDate` (Date), `alternateMobile` (string). Only the fields sent change; `null` clears an optional one
  (`salutation`, `middleName`, `lastName`, `workLocationId`, `gradeId`, `positionId`, `costCenterId`, `contractEndDate`,
  `probationEndDate`, `confirmationDate`, `alternateMobile`, `personalEmail`, `workEmail`, `reportingManagerCode`,
  `functionalManagerCode`).
- **Returns:** `{ employeeCode }`
- **What it does:** "Edit details" - the date rules of `create` are checked on the employee as it will be after the
  change (the confirmation date not before joining); the plant and department (`plantId`, `departmentId`, not clearable -
  a move to another plant needs a department running there) must be a plant of the
  employee's company - a newly chosen one active - and the department must run at the plant as it will be (a newly chosen plant or department: not retired there); the reporting manager must not have left, not be the employee
  and not report (directly or further up) to the employee - no loops. The company, code and status do not change here
  (a transfer and joining / leaving are their own processes). A move to another plant / department gives the employee
  that place's HOD post (2026-11-19). A newly chosen cost centre must be an active one of the employee's company; the
  functional manager must not have left nor be the employee (no loop check - it gives no rights). **Job details
  through approval (D7, 2026-11-20):** changing the plant, department, work location, designation, grade, position, cost
  centre, managers, employment type or workforce here needs **Approve job & salary changes: Edit** covering the employee
  (and where a move goes) - else `403` "ask for a job change instead" (`jobChanges.create`); names, dates and contacts need
  only Employees: Edit. **A correction, not a
  change from a day on (2026-11-19):** the job timeline's entry in force takes the corrected details (no new entry - that
  is `employees.jobHistory.create`), a planned entry that had kept a corrected detail's old value takes the new one, and a
  corrected date of joining moves the first entry (it must stay before the first job change).
- **Errors:** `400` invalid input, a date rule, a plant / department rule, a cost-centre rule, a reporting / functional
  manager rule, or a date of joining on / after the first job change · `404 NOT_FOUND` unknown employee ·
  `409 CONFLICT` work e-mail already used, or an unknown master id. Â· `400` "<master> X is no longer in use - choose one that is" - a retired company, department, work location, designation, grade or position chosen anew (one the employee already has is kept - 2026-11-23)

### `employees.updateStatutoryNumbers`
- **HTTP:** `POST /api/rpc/employees/updateStatutoryNumbers` · **Code:** `backend/src/modules/employees/`
- **Access:** Employee · Directory & job: View + Employee · IDs, bank & statutory: Edit (2026-11-16).
- **Scope:** Employee · IDs, bank & statutory Edit and Employee · Directory & job View covering the employee (`404` outside the data access, `403` without Edit).
- **Input:**

  | Field | Type | Required | Rules |
  |---|---|---|---|
  | `employeeCode` | string | yes | case-insensitive |
  | `uan` | string \| null | no | 12 digits (spaces removed); `null` clears it |
  | `pfNumber` | string \| null | no | the PF member number, 1-30 characters, upper-cased; `null` clears it |
  | `esicIpNumber` | string \| null | no | 10 digits; `null` clears it |
  | `pfOnFullWages` | boolean | no | payroll stage 4: PF above the wage ceiling (joint option) |
  | `epsMember` | boolean | no | payroll stage 4: in the pension scheme (EPS) |
  | `taxRegime` | `'NEW' \| 'OLD'` | no | payroll stage 4: the income-tax regime for the current tax year (OLD: HR types the monthly TDS) |

- **Returns:** `{ uan, pfNumber, esicIpNumber, pfOnFullWages, epsMember, taxRegime }` as saved.
- **What it does:** records the numbers given after joining - a first-job joiner gets a UAN and PF member number only
  once the company registers them with EPFO, and an ESIC IP number from ESIC. Only the fields sent change; the
  employee's PF / ESIC row is created if they have none yet. Recorded as changed by this HR person. The three payroll
  facts (2026-11-27) are never part of the joining form's statutory answers, so the candidate's own pages cannot set them.
- **Errors:** `400` invalid input · `403` without Employees: Edit · `404 NOT_FOUND` unknown employee code · `409
  CONFLICT` "This UAN / ESIC IP number already belongs to employee X".

### `employees.updateOnboardingChecklist`
- **HTTP:** `POST /api/rpc/employees/updateOnboardingChecklist` · **Code:** `backend/src/modules/employees/`
- **Access:** Employees: Edit.
- **Scope:** Employee · Directory & job Edit covering the employee (`404` outside the data access).
- **Input:**

  | Field | Type | Required | Rules |
  |---|---|---|---|
  | `employeeCode` | string | yes | case-insensitive |
  | `joiningFormalitiesCompleted` | boolean | no | JF §11 "Joining formalities completed" - everything of the joining done (2026-11-15); `false` clears it |
  | `payrollUpdated` | boolean | no | `false` clears it |
  | `idCardIssued` | boolean | no | ID card / access created; `false` clears it |
  | `inductionDate` | Date \| null | no | `null` clears it |

- **Returns:** `{ joiningFormalitiesCompletedAt, payrollUpdatedAt, idCardIssuedAt, inductionDate }` as saved.
- **What it does:** the joining form's "For HR / Office Use Only" box (JF §11) after joining. Ticking records when and
  by whom (ticking again keeps the first time); only the fields sent change; the joining record is created for an
  employee who has none.
- **Errors:** `400` invalid input · `403` without Employees: Edit · `404 NOT_FOUND` unknown employee code.

### `employees.salaryHistory`
- **HTTP:** `POST /api/rpc/employees/salaryHistory` · **Code:** `backend/src/modules/employees/`
- **Access:** any logged-in employee for their own code; anyone else's: Employee · Directory & job View + Employee · Salary View.
- **Scope:** one's own record; anyone else's: both areas covering the employee (outside Employees View `404`, without the salary access `403`).
- **Input:** `{ employeeCode: string }`
- **Returns:** `[{ id, effectiveFrom, annualCtc, performancePayAnnual, currency, reason, jobChangeRequestId, approvedAt, approvedById,
  approvedBy {employeeCode, name} | null, inForce, upcoming, changePercent, lines[] {monthlyAmount, salaryComponent {id, name, kind}} }]`,
  latest first. `reason`: `JOINING` | `INCREMENT` | `PROMOTION` | `CONFIRMATION` | `CORRECTION` | `OTHER`. `changePercent`: the
  fixed CTC against the salary before it (one decimal; null for the first). `inForce`: the one that applies today;
  `upcoming`: approved, from a later day.
- **What it does:** the salary history (the user, 2026-11-20): the offer's salary from the joining, then every approved
  revision (`jobChanges.create` with a salary) from its day; a correction changes the figures of its day's row.
- **Errors:** `400` invalid input · `403` without the salary access · `404 NOT_FOUND` unknown employee or outside the data access.

### `employees.documents.list`
- **HTTP:** `POST /api/rpc/employees/documents/list` · **Code:** `backend/src/modules/employees/documents/`
- **Access:** any logged-in employee for their **own** documents; anyone else's need Employee · Directory & job +
  Employee · Documents & letters View (2026-11-16).
- **Scope:** one's own record; anyone else's: Employee · Documents & letters View and Employee · Directory & job View covering the employee (else `404`); a sensitive type also needs its area covering.
- **Input:** `{ employeeCode: string }`
- **Returns:** `[{ id, type, fileName, mimeType, sizeBytes, verificationStatus, rejectionReason, reviewedAt, reviewedBy,
  isDeleted, deletedAt, deletedBy, deleteReason, createdAt, uploadedBy, locked }]`, in type order (`...By` are persons).
  **Sensitive documents (2026-11-16):** copies of IDs and bank proof (Aadhaar, PAN, passport, driving licence, visa, bank
  proof) and the EPF Form 11 / ESIC Form 1 also need **Employee · IDs, bank & statutory** View; the medical form and the
  medical fitness certificate also need **Employee · Medical** View; the signed forms pack both. Without it a
  document is `locked: true` with `fileName: null` - listed, but `download` / `review` / `delete` / `restore` /
  `upload` of that type answer `403`. One's own documents: never locked.
- **What it does:** the employee's documents - moved from the candidate on the joining day with their review, and
  the ones HR added since (`documents.upload`); deleted ones come along as history (`isDeleted: true`).
- **Errors:** `400` invalid input · `403` someone else's without Employees: View · `404 NOT_FOUND` unknown employee.

### `employees.documents.download`
- **HTTP:** `POST /api/rpc/employees/documents/download` · **Code:** `backend/src/modules/employees/documents/`
- **Access:** as `employees.documents.list`.
- **Scope:** one's own record; anyone else's: Employee · Documents & letters View and Employee · Directory & job View covering the employee (else `404`); a sensitive type also needs its area covering (ID / bank copies, EPF / ESIC forms and - since 2026-11-23 -
  the signed joining form: IDs, bank & statutory; medical documents: Medical; the signed forms pack: both; since 2026-11-23
  the signed offer letter: Salary).
- **Input:** `{ id: number }`
- **Returns:** the file (`File`, with its original name and type).
- **What it does:** downloads one employee document.
- **Errors:** `403 FORBIDDEN` a sensitive type without its area ("This document also needs the ... access") · `404
  NOT_FOUND` unknown document, or someone else's outside the data access. Â· `404` "No document found with id N" - also when its employee is outside the viewer's View (never names the employee - 2026-11-23)

### `employees.documents.upload`
- **HTTP:** `POST /api/rpc/employees/documents/upload` · **Code:** `backend/src/modules/employees/documents/`
- **Access:** authenticated employee for their own submission (approved 2026-11-25) - in Employee self-service only (no
  active role; `403` while a role is active, 2026-11-25); anyone else's record requires
  Employee · Directory & job View + Employee · Documents & letters Edit, plus sensitive-type View as before.
- **Scope:** own record is matched to the authenticated employee ID, never trusted from the employeeCode input;
  other records keep the scoped HR checks (`404` outside View, `403` when visible without required Edit/sensitive access).
- **Input:** `{ employeeCode: string, type: DocumentType, file: File (PDF / JPG / PNG, 1 byte to 5 MB) }`.
- **Returns:** the new document with uploader attribution and `PENDING`; review fields are not accepted from the caller.
- **What it does:** content-checks the file and stores it under `employees/<code>/<type>/<date>_<random>.<ext>`.
  Employee submissions wait for HR review; they cannot satisfy consent/evidence requirements until verified.
  Existing HR-uploaded evidence keeps its non-rejected/not-deleted rule. The profile keeps a verified copy current
  until another copy is verified; pending/rejected copies and earlier versions remain visible as history.
- **Errors:** `400` invalid file/type/size · `401` no valid employee session · `403` missing other-record permissions ·
  `404` unknown or outside-range employee. File storage is cleaned up if its row cannot be saved.

### `employees.documents.review`
- **HTTP:** `POST /api/rpc/employees/documents/review` · **Code:** `backend/src/modules/employees/documents/`
- **Access:** Employee · Directory & job: View + Employee · Documents & letters: Edit (2026-11-16).
- **Scope:** Employee · Documents & letters Edit covering the document's employee.
- **Input:** `{ id: number, status: 'VERIFIED' | 'REJECTED', rejectionReason?: string (required when REJECTED, up to 500) }`
- **Returns:** the document.
- **What it does:** marks the document verified, or rejected with what is wrong (who and when are recorded).
  An employee cannot review a file they submitted to their own record, even if they also hold HR permissions.
- **Errors:** `403` self-review or missing scoped management/sensitive access · `400` rejected without a reason · `404 NOT_FOUND` · `409 CONFLICT` the document is deleted. Â· `404` "No document found with id N" - also when its employee is outside the viewer's View (never names the employee - 2026-11-23)

### `employees.documents.delete`
- **HTTP:** `POST /api/rpc/employees/documents/delete` · **Code:** `backend/src/modules/employees/documents/`
- **Access:** Employee · Directory & job: View + Employee · Documents & letters: Edit (2026-11-16).
- **Scope:** Employee · Documents & letters Edit covering the document's employee.
- **Input:** `{ id: number, reason: string (1-500) }`
- **Returns:** the document (`isDeleted: true`).
- **What it does:** deletes a wrong document - never erased: kept with who, when and why, and can be restored. A verified
  document must be rejected first.
- **Errors:** `404 NOT_FOUND` · `409 CONFLICT` already deleted, or verified. Â· `404` "No document found with id N" - also when its employee is outside the viewer's View (never names the employee - 2026-11-23)

### `employees.documents.restore`
- **HTTP:** `POST /api/rpc/employees/documents/restore` · **Code:** `backend/src/modules/employees/documents/`
- **Access:** Employee · Directory & job: View + Employee · Documents & letters: Edit (2026-11-16).
- **Scope:** Employee · Documents & letters Edit covering the document's employee.
- **Input:** `{ id: number }`
- **Returns:** the document.
- **What it does:** brings back a deleted document (its review as it was).
- **Errors:** `404 NOT_FOUND` · `409 CONFLICT` not deleted. Â· `404` "No document found with id N" - also when its employee is outside the viewer's View (never names the employee - 2026-11-23)

### `employees.layoffs.list`
- **HTTP:** `POST /api/rpc/employees/layoffs/list` · **Code:** `backend/src/modules/employees/layoffs/`
- **Access:** any logged-in employee for their own code; anyone else's: Employee · Directory & job: View.
- **Scope:** one's own record; anyone else's: Employee · Directory & job View covering the employee (else `404` "No employee found").
- **Input:** `{ employeeCode: string }`
- **Returns:** `[{ id, startDate, rejoinDate | null, reason, createdAt, updatedAt, addedBy {employeeCode, name} | null, changedBy | null }]`,
  latest first.
- **What it does:** the employee's lay offs (the user, 2026-11-19) - each from its first day until the day they are back
  at work (`rejoinDate` empty = still laid off). The employee's status does not change with a lay off.
- **Errors:** `400` invalid input · `404 NOT_FOUND` unknown employee or outside the data access.

### `employees.layoffs.create`
- **HTTP:** `POST /api/rpc/employees/layoffs/create` · **Code:** `backend/src/modules/employees/layoffs/`
- **Access:** Employees: Edit.
- **Scope:** Edit covering the employee (outside the caller's Employee · Directory & job View data access `404`, View only `403`).
- **Input:**

  | Field | Type | Required | Rules |
  |---|---|---|---|
  | `employeeCode` | string | yes | |
  | `startDate` | Date | yes | the first day laid off - not before the date of joining |
  | `rejoinDate` | Date | no | the day back at work - after `startDate`; empty = still laid off |
  | `reason` | string | yes | 1-500 chars |

- **Returns:** the lay off (as in `list`).
- **What it does:** records a lay off. Lay offs of an employee never overlap (one may start the day the last one ended)
  and only one may be still open.
- **Since 2026-11-23 (the review):** checked and saved in one transaction, one change of an employee's lay offs at a time (a lock per employee); refused for an employee who has left.
- **Errors:** `400` invalid input or a date rule · `403` View only · `404 NOT_FOUND` unknown employee or outside the data
  access · `409 CONFLICT` overlaps another lay off, or another one is still open. Â· `400` "<code> has left - a lay off cannot be recorded"

### `employees.layoffs.update`
- **HTTP:** `POST /api/rpc/employees/layoffs/update` · **Code:** `backend/src/modules/employees/layoffs/`
- **Access:** Employees: Edit.
- **Scope:** Edit covering the lay off's employee (outside the caller's View data access `404`, View only `403`).
- **Input:** `{ id: number, startDate?: Date, rejoinDate?: Date | null, reason?: string }` - only the fields sent change;
  `rejoinDate: null` opens it again.
- **Returns:** the lay off (as in `list`).
- **What it does:** changes a lay off - typically gives the day back at work. The rules of `create` are checked on the lay
  off as it will be.
- **Since 2026-11-23 (the review):** checked and saved in one transaction, one change of an employee's lay offs at a time; a lay off of an employee who has left may be corrected but not left open.
- **Errors:** `400` invalid input or a date rule · `403` View only · `404 NOT_FOUND` unknown lay off or outside the data
  access · `409 CONFLICT` overlap / another open one. Â· `404` "No lay off found with id N" - also when its employee is outside the viewer's View (never names the employee - 2026-11-23) Â· `400` "<code> has left - a lay off of theirs needs its day back at work"

### `employees.layoffs.delete`
- **HTTP:** `POST /api/rpc/employees/layoffs/delete` · **Code:** `backend/src/modules/employees/layoffs/`
- **Access:** Employees: Edit.
- **Scope:** Edit covering the lay off's employee (outside the caller's View data access `404`, View only `403`).
- **Input:** `{ id: number }`
- **Returns:** `{ id }`
- **What it does:** removes a lay off entered by mistake (the change history keeps what it was).
- **Errors:** `400` invalid input · `403` View only · `404 NOT_FOUND` unknown lay off or outside the data access. Â· `404` "No lay off found with id N" - also when its employee is outside the viewer's View (never names the employee - 2026-11-23)

### `employees.jobHistory.list`
- **HTTP:** `POST /api/rpc/employees/jobHistory/list` · **Code:** `backend/src/modules/employees/job-history/`
- **Access:** any logged-in employee for their own code; anyone else's: Employee · Directory & job: View.
- **Scope:** one's own record; anyone else's: Employee · Directory & job View covering the employee (else `404` "No employee found").
- **Input:** `{ employeeCode: string }` (a code the employee had before a company transfer finds them too)
- **Returns:** `[{ id, effectiveFrom, kind, note | null, jobChangeRequestId | null, company {code, name}, employeeCode, enteredAt,
  enteredBy {employeeCode, name} | null, details, changed }]`, latest first. `kind`: `JOINING` | `PROMOTION` | `TRANSFER` |
  `COMPANY_TRANSFER` | `REDESIGNATION` | `MANAGER_CHANGE` | `OTHER`. `company` / `employeeCode`: in force from that day (a
  company transfer changes both). `details`: the whole picture from that day, as shown - `plantId` ("code · name"),
  `departmentId`, `workLocationId`, `designationId`, `gradeId`, `positionId`, `costCenterId` ("code · name"),
  `reportingManagerId` / `functionalManagerId` ("name (code)"), `employmentType`, `workforceCategory` (codes) - each a string
  or null. `changed`: which of those differ from the entry before (empty for the first). `jobChangeRequestId`: the approved
  job change that wrote it (`jobChanges.get`).
- **What it does:** the job timeline (the user, 2026-11-19) - the employee's job details from each day on: the joining, then
  each job change once approved and applied (2026-11-20 - a change not in force yet is a job-change request, not an entry).
  The salary is not part of it (`employees.salaryHistory`).
- **Errors:** `400` invalid input · `404 NOT_FOUND` unknown employee or outside the data access.

### `employees.jobHistory.asOf`
- **HTTP:** `POST /api/rpc/employees/jobHistory/asOf` · **Code:** `backend/src/modules/employees/job-history/`
- **Access:** any logged-in employee for their own code; anyone else's: Employee · Directory & job: View.
- **Scope:** one's own record; anyone else's: Employee · Directory & job View covering the employee (else `404`).
- **Input:** `{ employeeCode: string, date: Date }`
- **Returns:** `{ date, entryFrom, kind, company {code, name}, employeeCode, details }` (as in `list`) - or null before the
  employee joined.
- **What it does:** the job details in force on a day (2026-11-20, as the old HRMS's "as of a date") - the latest timeline
  entry from that day or before.
- **Errors:** `400` invalid input · `404 NOT_FOUND` unknown employee or outside the data access.

### `employees.imports.template`
- **HTTP:** `POST /api/rpc/employees/imports/template` · **Code:** `backend/src/modules/employees/imports/`
- **Access:** Employees: Edit.
- **Scope:** not limited by data access (the template lists the active masters).
- **Input:** none.
- **Returns:** a file `employee-import-template.xlsx`: sheet "Employees" with one column per field of
  `employees.create` plus `Employee code` (dropdowns of the active companies, plant codes, work locations, departments, designations,
  grades, positions, cost-centre codes (2026-11-19) and the fixed values; date columns as dd-mm-yyyy; a note on every header), and a sheet "How to fill".
- **What it does:** the template for importing existing employees (old HRMS bulk import, 2026-11-16).
- **Since 2026-11-23 (the review):** the code, plant, cost centre, mobile and manager-code columns are text cells (leading zeros are kept).
- **Errors:** `403` (see Access).

### `employees.imports.upload`
- **HTTP:** `POST /api/rpc/employees/imports/upload` · **Code:** `backend/src/modules/employees/imports/`
- **Access:** Employees: Edit.
- **Scope:** every row: the employee and where the row places them inside the caller's Employee · Directory & job **Edit** data access - a code of an employee outside it "cannot be used" (without saying whose it is).
- **Input:** `{ file: File (.xlsx, up to 5 MB), save?: boolean }`
- **Returns:** `{ saved, total, withErrors, toAdd, toUpdate, importId, rows: [{ rowNumber, employeeCode, name, action, errors[] }] }` -
  `employeeCode` is the code in the file (null = the next of the series), after saving the code given; `action` `ADD` /
  `UPDATE`; `importId` the history entry (a saved file, or a file with errors - `employees.imports.errorReport`).
- **Job details (D7, 2026-11-20):** a row changing an existing employee's job details (plant, department, work location,
  designation, grade, position, cost centre, managers, employment type, workforce) needs Approve job & salary changes: Edit
  for them - else the row is in error ("change through approval"). A code the employee had before a company transfer names
  them (never a new employee).
- **What it does:** reads the first sheet (headers as in the template; up to 2000 rows). **A row whose employee code is
  already used updates that employee (2026-11-16)**: only the cells filled in, with the rules of `employees.update` (an
  empty cell keeps what is saved; the company cannot change - a transfer is a later module). Every other row adds an
  employee, checked with the rules of `employees.create`: masters matched by name (a company by code or name; the **Plant
  code** column - required for a new employee, 2026-11-18 - by plant code or name among the row's company's active
  plants; the **Department** column - required for a new employee, 2026-11-19 - must run at the plant and not be retired there, when the row chooses either anew), fixed values by their label or
  code, dates as date cells or text like 25-03-2024; plus across the file and the database - an employee code or work
  code on two rows, a work e-mail used by another employee or on two rows, a reporting manager who is not an employee nor another row, has left, is the
  employee, or makes a loop with other rows; the **Cost centre** column by code or name among the row's company's active cost
  centres, and a **Functional manager code** that is not an employee nor another row, has left, or is the employee
  (2026-11-19). With `save: true` and no row in error, all rows are saved in one
  transaction (all or none): new `ACTIVE` employees keeping the code given (an empty one takes the next of the company's
  series) and the updates, then the reporting and functional managers (a manager may be a later row; a loop is refused - checked again against the saved data once every row is in, so a loop through a manager's saved manager, or a manager row who has left, refuses the whole file, 2026-11-23).
  A new employee's job timeline starts with its joining entry; an update is a correction of the entry in force (as
  `employees.update`). No logins are
  created (as in the old HRMS). Each employee's HOD post is the plant-department the row places them in (2026-11-19). Every saved file and every file with errors is kept in the history
  (`employees.imports.history`).
- **Since 2026-11-23 (the review):** masters match by name or code after trim, case and spaces only (punctuation counts) - an unknown one is reported, several matches ask for the code; a retired master / plant / cost centre chosen anew is refused ("is retired - choose one in use"), one the employee has is kept; padded codes keep their zeros (a 000-formatted 7 reads "007"); a former employee code is read as the employee's code now, and two rows naming one employee by a former and the current code are both refused; rich-text and hyperlink cells read as their text.
- **Errors:** `400` not an Excel file, a required column missing, no rows or more than 2000 · `403` (see Access).


### `employees.imports.history`
- **HTTP:** `POST /api/rpc/employees/imports/history` · **Code:** `backend/src/modules/employees/imports/`
- **Access:** Employees: Edit.
- **Scope:** not limited by data access yet (the files imported by anyone with Employees: Edit).
- **Input:** none
- **Returns:** `[{ id, fileName, status (DONE | FAILED), rowCount, createdCount, updatedCount, createdAt, by (person) }]`,
  the latest 50, newest first.
- **What it does:** the files imported and the ones checked with errors (2026-11-16, inspired by the old HRMS's job
  history).
- **Errors:** `403`.

### `employees.imports.errorReport`
- **HTTP:** `POST /api/rpc/employees/imports/errorReport` · **Code:** `backend/src/modules/employees/imports/`
- **Access:** Employees: Edit.
- **Scope:** not limited by data access yet (the rows of a file that had errors).
- **Input:** `{ id: number }` (a history entry)
- **Returns:** a file `<file name> - rows to fix.xlsx` - one row per wrong row: row number, employee code, name, and
  every problem (messages never repeat ID or bank numbers).
- **Errors:** `400` · `403` · `404 NOT_FOUND`.
### `employees.form.get`
- **HTTP:** `POST /api/rpc/employees/form/get` · **Code:** `backend/src/modules/employees/form/`
- **Access:** Employee · Directory & job: View; the answer has only the sections whose area the caller may view
  (2026-11-16): personal, addresses, emergency contacts, education, certifications, previous jobs, family, nominees,
  Form F - Employee · Personal; IDs, bank account, PF / ESIC - Employee · IDs, bank & statutory; medical -
  Employee · Medical.
- **Scope:** one's own record, or Employee · Directory & job View covering the employee (else `404`); each section only with its area covering the employee.
- **Input:** `{ employeeCode: string }`
- **Returns:** `{ joiningType, form }` - the employee's records in the joining form's sections: `personal` (with the
  name, mobile, second mobile), `addresses`, `emergencyContacts`, `identityDocuments` (**`numberLast4`** only),
  `bankAccount` (the salary account, **`accountNumberLast4`** only), `statutory` (the EPF Form 11 / ESIC Form 1 answers,
  without the PF member number), `gratuity` (the Form F declarations), `qualifications`, `certifications`,
  `previousJobs`, `familyMembers` (**`aadhaarLast4`** only), `nominees`, `medical` (only with Medical information:
  View). Empty values are left out.
- **What it does:** what HR's edit forms open with (phase 5, 2026-11-16).
- **Errors:** `403` (see Access) · `404 NOT_FOUND` unknown employee.

### `employees.form.save`
- **HTTP:** `POST /api/rpc/employees/form/save` · **Code:** `backend/src/modules/employees/form/`
- **Access:** Employee · Directory & job: View, and each section sent needs Edit on its area (as in `form.get`; checked
  in the service, 2026-11-16).
- **Scope:** each section sent: its area's Edit covering the employee (`404` outside the data access).
- **Input:** `{ employeeCode: string }` plus any of the sections of `form.get`, each with the **same rules as the joining
  form** (`candidates.joiningForm.save` - the same schemas). A saved number may be left out to keep it: an identity
  document's `number` (kept by type), the bank account's `accountNumber`, a family member's `aadhaar` (kept by name +
  `aadhaarLast4`).
- **Returns:** the form as `form.get`, after saving.
- **What it does:** HR changes canonical profile sections after joining. Employees' document submissions are separate;
  family/nominee requests are selected follow-on work (2026-11-25, BACKLOG item 32). Each section sent replaces that whole section (an answer left out is
  cleared; the name and mobile are kept when not sent), all in one transaction. A new identity number is stored
  encrypted with its last 4 digits and fingerprint and may not belong to another employee; a changed date of birth must
  still make the employee 18 on the date of joining. A list section that did not change is not rewritten, so the change
  history shows only real changes. The medical consent (given at joining) stays; for someone without medical
  information yet it is recorded as given to HR now.
- **Errors:** `400` invalid input, a rule of a section, a number to enter again ("Enter the ... number"), or the age
  rule · `403` medical without Medical information: Edit · `404 NOT_FOUND` unknown employee · `409 CONFLICT` an identity
  number of another employee.

### `employees.hods.list`
- **HTTP:** `POST /api/rpc/employees/hods/list` · **Code:** `backend/src/modules/employees/hods/`
- **Access:** HOD appointments: View.
- **Scope:** only the places inside the caller's HOD appointments View data access (an HOD is listed when one of their places is); `employees` counts only employees inside it.
- **Input:** none
- **Returns:** `[{ employeeCode, name, hasLeft, leavingOn | null, places: [{ id, isActive, label, company {id, code, name}, plant {id, plantCode, name}, department {id, code, name}, appointmentId, status, startsAt, endsAt | null, employees, canChange }] }]` -
  by name; `places` the ones they head now (`status` `CURRENT`, `endsAt` a planned end or null) or will head (`UPCOMING`,
  from `startsAt`), "RML · 1101 RML HQ · Maintenance"; `employees` how many employees who have not left have the place as
  their HOD post; `canChange` the caller's Edit covers it; `leavingOn` their leaving day when known (not for one who left -
  `hasLeft`). Moments are India time.
- **What it does:** the Organization page's Department heads tab (BACKLOG 3e, changed with the user 2026-11-19): the HODs -
  about 15-20 people - and where each serves. An HOD post is a plant-department (one company + one of its plants + one
  department running there): it exists as soon as the department is ticked at the plant.
- **Errors:** `403` (see Access).

### `employees.hods.places`
- **HTTP:** `POST /api/rpc/employees/hods/places` · **Code:** `backend/src/modules/employees/hods/`
- **Access:** HOD appointments: View.
- **Scope:** only the places inside the caller's HOD appointments View data access; `employees` counts only employees inside it.
- **Input:** none
- **Returns:** `[{ id, isActive, label, company {id, code, name}, plant {id, plantCode, name}, department {id, code, name}, hod {employeeCode, name, since, until | null} | null, next {employeeCode, name, from} | null, employees, canChange }]` -
  by company, plant and department; active places, and retired ones someone still heads, will head or has. `hod` who
  heads it now (`until` a planned end), `next` the first upcoming appointment.
- **What it does:** the place picker (Add HOD, Change places) and "By place" - every place with who heads it now and next.
- **Errors:** `403` (see Access).

### `employees.hods.appoint`
- **HTTP:** `POST /api/rpc/employees/hods/appoint` · **Code:** `backend/src/modules/employees/hods/`
- **Access:** HOD appointments: Edit.
- **Scope:** every place in `postIds` / `endPostIds` inside the caller's HOD appointments View data access (else `404`) and Edit data access (`403`); the HOD may be anyone in the group (a picker).
- **Input:**

  | Field | Type | Required | Rules |
  |---|---|---|---|
  | `employeeCode` | string | yes | the HOD - an employee who has not left (when places are added), still working there at the start (before the end of their leaving day) |
  | `from` | `{ day: Date, minute?: 0-1439 }` | no | when they start, India time: the start of `day`, or `minute` after its midnight; omitted = now. Earlier (backdating) back to after the start of the appointment going on (or from the end of the last one); later = an upcoming appointment |
  | `postIds` | number[] | yes | the places (plant-department ids) they head from `from`; may be empty when `endPostIds` is given |
  | `endPostIds` | number[] | no | places they stop heading at that same moment (one not started yet is cancelled); none of `postIds` |

- **Returns:** `{ appointed, unchanged, ended, cancelled, replaced: [{ post, employeeCode, name }] }` - `unchanged` places they head then already; `replaced` the HODs whose appointment ends at that moment.
- **What it does:** in one transaction, for each place: whoever heads it at that moment (someone else) stops at that very
  moment and the employee heads it from then - their own upcoming appointment of the place starts earlier instead. An
  appointment runs from a moment until a moment (the end not included), India time for every plant (the user,
  2026-11-19), so "who was the HOD at 15:00 on 15-05" can always be answered and nothing has to run when
  a planned change comes. A place with someone else appointed later must have that cancelled first. The `endPostIds`
  appointments end at that moment. One person may head any number of places, in any companies. The places' employees have
  the new HOD from that moment (they store the place, not the person). Two changes of the same place at the same moment
  (`appoint` / `end`) run one after the other, and the second is checked against what the first did; the database also
  refuses two appointments of a place that overlap in time. Anyone may head the place their own manager works in (the
  2026-11-20 rule against it was dropped by the user, 2026-11-22). When several places are given and one cannot change,
  nothing changes and the message ends "Untick <place> to go on with the other places".
- **Errors:** `400` invalid input, a start too early, someone else appointed later ("cancel that first"), an unknown employee, one who left or leaves before the start, a place in both lists, a place in `endPostIds` they do not head · `403` · `404 NOT_FOUND` a place · `409 CONFLICT` an overlap the database refused. Â· `400` "<post> is retired - it gets no new HOD" (a retired plant-department, plant or department - 2026-11-23)

### `employees.hods.end`
- **HTTP:** `POST /api/rpc/employees/hods/end` · **Code:** `backend/src/modules/employees/hods/`
- **Access:** HOD appointments: Edit.
- **Scope:** as `appoint`.
- **Input:** `{ employeeCode, postIds: number[], lastDay?: { day: Date, minute?: 0-1439 } | null }` - the places (1 or more)
  whose appointment of theirs (going on, or upcoming) ends; `lastDay` their last day as HOD (India time):
  they stop at its end (the midnight after it), or at `minute` of it; omitted = now; `null` = no end (takes back a
  planned end, e.g. a resignation withdrawn).
- **Returns:** `{ ended, cancelled, unchanged }`
- **What it does:** ends the appointments - the places have no HOD from that moment (the gap list) until someone is
  appointed. The end may be past (it was already so), now, or later (planned: they stay HOD until then; the gap list warns
  when nobody comes after). An upcoming appointment ended before it starts is cancelled (removed - it never took effect;
  the change history keeps it). An end cannot be before the start, nor after the next HOD of the place starts. In one
  transaction, waiting for anyone changing the same places at that moment (as `appoint`).
- **Errors:** `400` an end before the start or after the next HOD starts, `null` while someone takes over later, a place they do not head and are not appointed to · `403` · `404 NOT_FOUND` a place.

### `employees.hods.history`
- **HTTP:** `POST /api/rpc/employees/hods/history` · **Code:** `backend/src/modules/employees/hods/`
- **Access:** HOD appointments: View.
- **Scope:** only places inside the caller's HOD appointments View data access (a place outside it: `404`).
- **Input:** `{ postId }` (one place) or `{ employeeCode }` (the places one person headed).
- **Returns:** `[{ id, post, employeeCode, name, startsAt, endsAt | null, status, appointedBy (person) }]` - the latest first, upcoming ones too; `status` `UPCOMING` / `CURRENT` / `PAST`; `post` as in `places` (without `hod`, `next`, `employees`, `canChange`).
- **What it does:** who headed a place from when until when (the Department heads tab's place history - former HODs too,
  2026-11-20), or where someone served as HOD.
- **Errors:** `403` · `404 NOT_FOUND` the place (an unknown employee code gives an empty list).

### `employees.hods.gaps`
- **HTTP:** `POST /api/rpc/employees/hods/gaps` · **Code:** `backend/src/modules/employees/hods/`
- **Access:** HOD appointments: View.
- **Scope:** only places and employees inside the caller's HOD appointments View data access.
- **Input:** none
- **Returns:** `{ vacant: [place + employees + canChange + next {employeeCode, name, from} | null], ending: [place + hod {employeeCode, name} + endsAt + employees + canChange], leavers: [{ employeeCode, name, hasLeft, dateOfLeaving | null, posts: [place + status + startsAt + endsAt + canChange] }] }`.
- **What it does:** the gap list (BACKLOG 3e, 2026-11-19): `vacant` places with employees but no HOD now (their approvals
  go to HR) - with who is appointed next, if anyone; `ending` places with employees whose HOD stops at a planned moment
  with nobody appointed from then (soonest first); `leavers` HODs (now or upcoming) who have left, or whose leaving day
  comes before their appointment ends (nothing records a resignation yet - HR ends the appointment).
- **Errors:** `403` (see Access).

### `employees.hods.myDepartment`
- **HTTP:** `POST /api/rpc/employees/hods/myDepartment` · **Code:** `backend/src/modules/employees/hods/`
- **Access:** any logged-in employee (an HOD needs no role for it).
- **Scope:** not limited by data access - the HOD relationship: the employees whose HOD post is a place the caller heads now, never the caller (CLAUDE.md section 8, rule 7).
- **Input:** none
- **Returns:** `{ posts: [place + since + until | null + employees], employees: [{ employeeCode, name, status, postId, employmentType, dateOfJoining, workEmail, company (code), plant {plantCode, name}, workLocation, department, designation, reportingManager {employeeCode, name} | null }] }` -
  employees who have not left, by code; empty lists when the caller heads no place now (an upcoming appointment gives
  nothing until it starts - 2026-11-19).
- **What it does:** "My department" (H2): the HOD's read-only view of their employees' directory & job details (their
  attendance: `attendance.days.board` / `muster` with scope `DEPARTMENT`). Approvals come with the leave module.
- **Errors:** `401`.

## accounts

Login, roles and access. Employees are the users; there is no separate user list. A login is created (or its
password reset) on the "Roles & access" page (`accounts.create`, `accounts.resetPassword`) or with
`npm run set-password -- <employeeCode> [--role "<role name>"]` - the first super admin is made that way:
`--role "Super Admin"`. Either way the password is temporary and must be changed at the next sign-in.

`access` below is the level per area, e.g. `{ ONBOARDING: 'WRITE', EMPLOYEES: 'READ' }` - an area left out means no
access.

### `accounts.login`
- **HTTP:** `POST /api/rpc/accounts/login` · **Code:** `backend/src/modules/accounts/`
- **Access:** public.
- **Scope:** not limited by data access (public).
- **Input:** `{ login: string, password: string }` - `login` is the employee code (any case - a code had before a company transfer still works, 2026-11-20) or the work e-mail
  (2026-11-16).
- **Returns:** the same as `accounts.me`, and sets the `hrms_session` cookie (httpOnly, SameSite=Strict, path `/api`,
  7 days from sign-in - as the old HRMS, 2026-11-16; not extended by use).
- **What it does:** checks the password (scrypt hash), starts a session (only the token's SHA-256 hash is stored; with
  the IP and browser, for the Sessions lists), sets the login's `lastLoginAt` and removes this account's expired
  sessions. Only `ACTIVE` / `ON_NOTICE` employees with a login that is not turned off can log in.
  **Lockout:** 5 wrong passwords in a row lock the login for 15 minutes (an admin can unlock it earlier with
  `accounts.unlock`); a correct password resets the count. Each wrong password is counted in the database, so wrong
  passwords sent at the same moment each count; the 5 tries a minute apply per login too, whatever name it is reached by
  (code, work e-mail, a former code) - 2026-11-23. With a temporary password `mustChangePassword` is true.
  The change history records the sign-in - or the failed attempt as System, with what was typed and the reason (no
  such code / e-mail, no login, not active, wrong password, locked, turned off) - 2026-11-16. `accounts.logout`
  records the sign-out.
- **Errors:** `400` invalid input · `401 UNAUTHORIZED` "Invalid employee code / e-mail or password" - the same message
  for an unknown code, a wrong password, no login or an exited employee, so codes cannot be discovered by guessing ·
  `401 UNAUTHORIZED` "Too many wrong passwords - this login is locked. Try again in N minutes..." while locked ·
  `401 UNAUTHORIZED` "This login is turned off - ask HR" (only after the right password).

### `accounts.logout`
- **HTTP:** `POST /api/rpc/accounts/logout` · **Code:** `backend/src/modules/accounts/`
- **Access:** any logged-in employee (also with a temporary password).
- **Scope:** not limited by data access - the caller's own login.
- **Input:** none
- **Returns:** `{ loggedOut: true }` and clears the cookie.
- **What it does:** deletes this session (other devices stay logged in).
- **Errors:** `401 UNAUTHORIZED` not logged in.

### `accounts.me`
- **HTTP:** `POST /api/rpc/accounts/me` · **Code:** `backend/src/modules/accounts/`
- **Access:** any logged-in employee (also with a temporary password).
- **Scope:** not limited by data access - the caller's own login; returns the caller's own data access (`dataAccess`).
- **Input:** none
- **Returns:** `{ employeeCode, name, roles: string[] (role names), isSuperAdmin, access, dataAccess, hodPosts, mustChangePassword,
  passwordConfirmedUntil, passwordRule, availableRoles, activeRoleId }` - `dataAccess` (2026-11-18): per area of `access`, `{ READ, WRITE }` - whose
  records it covers to view / change: `'ALL'` or slices `{ companyId, plantId, departmentId }` (null = every ...), so forms
  offer only what may be chosen; `passwordConfirmedUntil`: until when the password counts as re-entered
  (`accounts.confirmPassword`), else null; `passwordRule` `{ minLength, history }` what a new password needs (the
  security rules - `accounts.security.*`, 2026-11-16);
  `roles` lists all assigned role names; `availableRoles: { id, name }[]` lists the choices and
  `activeRoleId: number | null` identifies the selection - `null` = Employee self-service (no `x-hrms-role` header: no role at all, 2026-11-25). `access`, `dataAccess` and `isSuperAdmin` come only from
  the selected role (the selected super admin gets Edit on every area);
  `mustChangePassword` = signed in with a temporary password (the frontend sends them to "Change password");
  `hodPosts` (2026-11-18) how many places (plant + department) the caller heads now as HOD (0: no "My department" page).
- **What it does:** tells the frontend who is logged in and which pages, menus and buttons to show. The frontend
  decides from `access` only, never from role names.
- **Errors:** `401 UNAUTHORIZED` not logged in, session expired, or the employee can no longer log in.

### `accounts.changePassword`
- **HTTP:** `POST /api/rpc/accounts/changePassword` · **Code:** `backend/src/modules/accounts/`
- **Access:** any logged-in employee, for their own login (also with a temporary password).
- **Scope:** not limited by data access - the caller's own login.
- **Input:** `{ currentPassword: string, newPassword: string }`
- **Returns:** `{ changed: true }`
- **What it does:** sets the employee's own password; it is no longer temporary. Rules for the new one (old HRMS,
  2026-11-16): at least **10** characters, a letter and a digit, not containing the employee code, and **not one of the
  last 5 passwords** (the one in use + the 4 before, kept as hashes in `password_history`). Other devices are logged
  out; this session stays. Passwords set before keep working - the rules apply when a password is chosen.
- **Errors:** `400` "Your current password is not correct" (deliberately not 401) or a rule above.

### `accounts.requestPasswordReset`
- **HTTP:** `POST /api/rpc/accounts/requestPasswordReset` · **Code:** `backend/src/modules/accounts/`
- **Access:** public - the sign-in page's "Forgot password?" (not logged in; approved 2026-11-15).
- **Scope:** not limited by data access (public).
- **Input:** `{ employeeCode: string }` (trimmed, upper-cased)
- **Returns:** `{ message, passwordRule }` (`passwordRule` `{ minLength, history }` for the next step's page -
  2026-11-16) - always the same sentence, whatever the code is, so employee codes and e-mail addresses
  cannot be discovered by asking.
- **What it does:** when the employee can log in (`ACTIVE` / `ON_NOTICE`), has a login and a personal e-mail, e-mails a
  6-digit code valid 10 minutes (only its SHA-256 is kept on the login; a new one at most once a minute and 5 a day per
  login - the Indian calendar day, 2026-11-23 - otherwise nothing is sent; several asks at the same moment send one code). The e-mail goes out in the background; a failure is only logged on the server.
- **Since 2026-11-23 (the review):** a turned-off login gets no code (the same answer).
- **Errors:** `400` invalid input.

### `accounts.resetPasswordWithCode`
- **HTTP:** `POST /api/rpc/accounts/resetPasswordWithCode` · **Code:** `backend/src/modules/accounts/`
- **Access:** public - the second step of "Forgot password" (approved 2026-11-15).
- **Scope:** not limited by data access (public).
- **Input:** `{ employeeCode: string, code: string (6 digits), newPassword: string }`
- **Returns:** `{ changed: true }`
- **What it does:** checks the code (a wrong one counts - each try is counted in the database before the check, so
  guesses at the same moment each count, 2026-11-23; after 5 wrong tries the code stops working - ask for a new one), then sets the new password with the `changePassword` rules (10+ characters, a letter and a digit, not the
  employee code, not one of the last 5). The password is no longer temporary, the login is unlocked and logged out everywhere, and the code
  is cleared. Changed "by" System - the employee is not logged in.
- **Since 2026-11-23 (the review):** a turned-off login is refused, with the same answer as a wrong code.
- **Errors:** `400` "The code is wrong or has expired. Ask for a new code." for every refusal of the code - wrong, expired,
  not asked for, used up after 5 wrong tries, an unknown employee code or a turned-off login (the same answer whether the
  login exists - 2026-11-23, the review: "N tries left" told real codes apart) - or a password rule.

### `accounts.create`
- **HTTP:** `POST /api/rpc/accounts/create` · **Code:** `backend/src/modules/accounts/`
- **Access:** Roles & access: Edit.
- **Scope:** the employee must be inside the caller's Roles & access **Edit** data access - outside it `404` "No employee found".
- **Input:** `{ employeeCode: string }`
- **Returns:** `{ employeeCode, name, temporaryPassword }` - the password is shown **once**; only its hash is stored.
- **What it does:** gives an `ACTIVE` / `ON_NOTICE` employee a login with a temporary password (12 characters, no
  look-alike letters) and no roles.
- **Errors:** `404 NOT_FOUND` unknown employee · `409 CONFLICT` the employee cannot log in (status) or already has
  a login.

### `accounts.resetPassword`
- **HTTP:** `POST /api/rpc/accounts/resetPassword` · **Code:** `backend/src/modules/accounts/`
- **Access:** Roles & access: Edit.
- **Scope:** the employee must be inside the caller's Roles & access **Edit** data access - outside it `404` "No employee found".
- **Input:** `{ employeeCode: string }`
- **Returns:** `{ employeeCode, name, temporaryPassword }` (shown once).
- **What it does:** a new temporary password (the old one is kept in the password history); the login is unlocked
  and logged out everywhere; roles stay. Not for
  one's own login (use `changePassword`); only a super admin can reset a super admin, and anyone else only logins
  whose roles are within their own access.
- **Errors:** `403 FORBIDDEN` own login / super admin / beyond own access · `404 NOT_FOUND` unknown employee or no login.

### `accounts.unlock`
- **HTTP:** `POST /api/rpc/accounts/unlock` · **Code:** `backend/src/modules/accounts/`
- **Access:** Roles & access: Edit.
- **Scope:** the employee must be inside the caller's Roles & access **Edit** data access - outside it `404` "No employee found".
- **Input:** `{ employeeCode: string }`
- **Returns:** `{ employeeCode, unlocked: true }`
- **What it does:** lifts a lockout before its 15 minutes are over (same "who may manage which login" rule as reset).
- **Errors:** `403 FORBIDDEN` super admin / beyond own access · `404 NOT_FOUND` unknown employee or no login.

### `accounts.confirmPassword`
- **HTTP:** `POST /api/rpc/accounts/confirmPassword` · **Code:** `backend/src/modules/accounts/`
- **Access:** any logged-in employee.
- **Scope:** not limited by data access - the caller's own login.
- **Input:** `{ password: string }` - their own password.
- **Returns:** `{ confirmedUntil }` - 10 minutes from now.
- **What it does:** re-entering one's password before changing roles (old HRMS "step-up", decided 2026-11-16: only
  `accounts.setRoles`, `accounts.roles.create` / `update` / `delete` need it). Marks this session confirmed until then.
  Wrong passwords count like wrong sign-ins: the 5th locks the login for 15 minutes and logs it out everywhere.
- **Errors:** `400` "Your password is not correct. N tries left..." · `401` locked.

### `accounts.disable`
- **HTTP:** `POST /api/rpc/accounts/disable` · **Code:** `backend/src/modules/accounts/`
- **Access:** Roles & access: Edit.
- **Scope:** the employee must be inside the caller's Roles & access **Edit** data access - outside it `404` "No employee found".
- **Input:** `{ employeeCode: string, reason: string (1-300 chars) }`
- **Returns:** `{ employeeCode, disabled: true }`
- **What it does:** turns the login off (old HRMS, 2026-11-16 - e.g. during a suspension): the employee cannot sign in
  although still employed (the employee record does not change), and is logged out everywhere at once. Records when,
  by whom and why (`accounts.list` `disabled`). Same "who may manage which login" rule as `resetPassword`; not one's
  own login.
- **Errors:** `403 FORBIDDEN` own login / super admin / beyond own access · `404 NOT_FOUND` unknown employee or no login.

### `accounts.enable`
- **HTTP:** `POST /api/rpc/accounts/enable` · **Code:** `backend/src/modules/accounts/`
- **Access:** Roles & access: Edit.
- **Scope:** the employee must be inside the caller's Roles & access **Edit** data access - outside it `404` "No employee found".
- **Input:** `{ employeeCode: string }`
- **Returns:** `{ employeeCode, disabled: false }`
- **What it does:** turns a login back on (clears when / by whom / why). Same management rule as `disable`.
- **Errors:** `403 FORBIDDEN` super admin / beyond own access · `404 NOT_FOUND` unknown employee or no login.

### `accounts.sessions.list`
- **HTTP:** `POST /api/rpc/accounts/sessions/list` · **Code:** `backend/src/modules/accounts/`
- **Access:** Roles & access: View.
- **Scope:** only the sessions of employees inside the caller's Roles & access View data access.
- **Input:** none.
- **Returns:** `[{ id, employee (person), startedAt, lastSeenAt, expiresAt, ip, browser (e.g. "Chrome on Windows"),
  current }]` - every session not expired yet, most recently used first; `current` = the caller's own session.
- **What it does:** where everyone is signed in (old HRMS, 2026-11-16). `lastSeenAt` is updated at most once a minute.
- **Errors:** `403` (see Access).

### `accounts.sessions.mine`
- **HTTP:** `POST /api/rpc/accounts/sessions/mine` · **Code:** `backend/src/modules/accounts/`
- **Access:** any logged-in employee.
- **Scope:** not limited by data access - the caller's own login.
- **Input:** none.
- **Returns:** the caller's own sessions, as in `sessions.list` without `employee`.
- **What it does:** "Where you are signed in" on the Change password page (2026-11-16).
- **Errors:** `401` not logged in.

### `accounts.sessions.end`
- **HTTP:** `POST /api/rpc/accounts/sessions/end` · **Code:** `backend/src/modules/accounts/`
- **Access:** any logged-in employee for their **own** other sessions; anyone else's needs Roles & access: Edit (and
  the "who may manage which login" rule) - checked in the service.
- **Scope:** one's own session: not limited by data access; someone else's: the employee must be inside the caller's Roles & access **Edit** data access - outside it `404` "No employee found".
- **Input:** `{ sessionId: number }`
- **Returns:** `{ ended: 1 }`
- **What it does:** logs that session out; the change history records a sign-out with who did it.
- **Errors:** `400` the caller's current session ("use Log out") · `403` someone else's without access · `404` the
  session has already ended.

### `accounts.sessions.endAll`
- **HTTP:** `POST /api/rpc/accounts/sessions/endAll` · **Code:** `backend/src/modules/accounts/`
- **Access:** Roles & access: Edit.
- **Scope:** one's own login: not limited by data access; someone else's: the employee must be inside the caller's Roles & access **Edit** data access - outside it `404` "No employee found".
- **Input:** `{ employeeCode: string }`
- **Returns:** `{ ended: number }`
- **What it does:** logs that employee out on every device - for one's own code: every device except this one. Same
  management rule as `resetPassword`; recorded as a sign-out in the change history.
- **Errors:** `403 FORBIDDEN` super admin / beyond own access · `404 NOT_FOUND` unknown employee or no login.

### `accounts.list`
- **HTTP:** `POST /api/rpc/accounts/list` · **Code:** `backend/src/modules/accounts/`
- **Access:** Roles & access: View.
- **Scope:** only employees inside the caller's Roles & access View data access.
- **Input:** none
- **Returns:** `[{ employeeCode, name, status, companyId, canLogIn, mustChangePassword, lockedUntil, lastLoginAt, disabled,
  roles: [{ id, name, isSuperAdmin, dataAccess: [{ companyId, plantId, departmentId, level, company, plant, department }] }] }]`,
  sorted by employee code - `companyId`: the employee's own company (suggested for a role newly given); each role's
  `dataAccess` rows say whose records it covers (ids null = every company / plant / department; `company` = its code,
  `plant` = "code · name", `department` = its name, null = all; a Super Admin role covers everything whatever is listed);
  `lockedUntil` only while locked (else null); `disabled`: `{ at, by (person), reason }` while the login is turned off,
  else null (2026-11-16). Never returns password hashes.
- **What it does:** lists every employee who has a login and is inside the caller's Roles & access View data access,
  with their roles and each role's data access (the "People" tab).
- **Errors:** `401` / `403` (see Access).

### `accounts.setRoles`
- **HTTP:** `POST /api/rpc/accounts/setRoles` · **Code:** `backend/src/modules/accounts/`
- **Access:** Roles & access: Edit.
- **Scope:** the employee must be inside the caller's Roles & access **Edit** data access - outside it `404` "No employee found"; roles - with their data access - can only be given, changed or taken away within the caller's own access and data access (`403`). The rows given must also be inside the caller's own Roles & access Edit data access, whatever the role's areas (2026-11-20: a role's rows decide whose approval requests its holders may decide - e.g. the fallback approver role, which has no areas) (`403`).
- **Input:**

  | Field | Type | Required | Rules |
  |---|---|---|---|
  | `employeeCode` | string | yes | trimmed, upper-cased; the employee must have a login |
  | `roles` | `{ roleId, dataAccess }[]` | yes | the complete list the employee should have (up to 50); `[]` takes every role away |
  | `roles[].dataAccess` | `{ companyId, plantId, departmentId, level }[]` | yes | whose records the role covers (up to 100 rows): ids or `null` = every company / plant / department; a plant only with its own company; `level` `READ` / `WRITE`; `[]` = nobody's records |

- **Returns:** `{ employeeCode, name, status, canLogIn, roles }` - the roles as in `accounts.list`.
- **What it does:** gives the employee exactly these roles, each with its data access (2026-11-18). Applies at once (no
  new login needed). For an area, the level for a record is the lower of the role's level and the best row covering it;
  across the roles the best wins.
  - Nobody can change their **own** roles (no giving yourself more, no locking yourself out).
  - The employee must be inside the caller's Roles & access Edit data access (else `404`).
  - Only a super admin can give or take away the **Super Admin** role (it covers everything; its rows are not kept).
    With the rule above, there is always at least one super admin.
  - Anyone else can only give, change or take away a role - with its data access - within their own access **and data
    access** (a role kept with the same rows is not checked).
  - The same slice twice keeps the higher level.
- **Re-entered password (2026-11-16):** needs the caller's password confirmed in this session in the last 10 minutes
  (`accounts.confirmPassword`) - else `403 FORBIDDEN` "Enter your password to confirm this change" with
  `data.passwordConfirmationRequired: true`.
- **Since 2026-11-23 (the review):** giving roles and changing those roles at the same moment wait for each other (a lock per role) and each is checked again against what the other saved.
- **Errors:** `400` invalid input, or a plant that is not one of its row's company's · `403 FORBIDDEN` password not
  re-entered / own roles / Super Admin role / "You can only give access you have yourself..." · `404 NOT_FOUND` unknown
  employee or one outside your data access, employee without a login, or unknown role id · `409 CONFLICT` an unknown
  company / department id.

### `accounts.roles.list`
- **HTTP:** `POST /api/rpc/accounts/roles/list` · **Code:** `backend/src/modules/accounts/roles/`
- **Access:** Roles & access: View.
- **Scope:** not limited by data access (roles are shared by every company).
- **Input:** none
- **Returns:** `{ areas: [{ area, label, read, write }], roles: [{ id, name, description, isSuperAdmin, access,
  isApprovalFallback, chainStepCount, employeeCount, updatedAt, updatedBy (person) }] }` - `read` / `write` explain what View / Edit
  allow in that area; `isApprovalFallback`: the fallback approver of approval requests (2026-11-20); `chainStepCount`: approval-chain
  steps naming the role;
  Super Admin first, then by name.
- **What it does:** everything the "Roles & access" page needs.
- **Errors:** `401` / `403` (see Access).


### `accounts.security.get`
- **HTTP:** `POST /api/rpc/accounts/security/get` · **Code:** `backend/src/modules/accounts/security/`
- **Access:** Roles & access: View.
- **Scope:** not limited by data access (the same rules for every company).
- **Input:** none
- **Returns:** `{ rules, defaults, isDefault, updatedAt, updatedBy }` - `rules` / `defaults`: `{ maxFailedLogins,
  lockMinutes, sessionHours, minPasswordLength, passwordHistory, resetCodeMinutes, confirmPasswordMinutes }`; `isDefault`:
  nobody saved them yet (the defaults apply: 5, 15, 168, 10, 5, 10, 10).
- **What it does:** the security rules (2026-11-16, inspired by the old HRMS's Settings page) - the Roles & access page's
  "Security rules" tab.
- **Errors:** `403`.

### `accounts.security.update`
- **HTTP:** `POST /api/rpc/accounts/security/update` · **Code:** `backend/src/modules/accounts/security/`
- **Access:** Roles & access: Edit, and the password re-entered (`accounts.confirmPassword`).
- **Scope:** shared by every company - needs Roles & access Edit for **all companies** (`403` "... is shared by every company").
- **Input:** every rule: `maxFailedLogins` 3-20, `lockMinutes` 1-1440, `sessionHours` 1-720, `minPasswordLength` 8-64,
  `passwordHistory` 1-24, `resetCodeMinutes` 5-60, `confirmPasswordMinutes` 1-60.
- **Returns:** as `get`.
- **What it does:** saves the rules. They apply from the next sign-in / password change (a session keeps the end time it
  was given; a lock keeps its end).
- **Errors:** `400` invalid input · `403` without the access, or `data.passwordConfirmationRequired` when the password
  was not re-entered recently.
### `accounts.roles.export`
- **HTTP:** `POST /api/rpc/accounts/roles/export` · **Code:** `backend/src/modules/accounts/roles/` (written by `accounts.service`)
- **Access:** Roles & access: View.
- **Scope:** the people sheet lists only employees inside the caller's Roles & access View data access.
- **Input:** none.
- **Returns:** a file `roles-and-access-YYYY-MM-DD.xlsx` - sheet "Roles" (each role, its description, how many people
  have it, View / Edit / - per area) and sheet "People" (everyone with a login: code, name, status, login state, roles,
  last login).
- **What it does:** the roles x access table as Excel (old HRMS, 2026-11-16).
- **Errors:** `403` (see Access).

- **Review format (2026-11-24):** shared Excel review-report formatting and separate Review notes sheet described above; existing data columns and authorization retained.

### `accounts.roles.create`
- **HTTP:** `POST /api/rpc/accounts/roles/create` · **Code:** `backend/src/modules/accounts/roles/`
- **Access:** Roles & access: Edit.
- **Scope:** shared by every company - needs Roles & access Edit for **all companies** (`403` "... is shared by every company").
- **Input:**

  | Field | Type | Required | Rules |
  |---|---|---|---|
  | `name` | string | yes | trimmed, 2-60 chars, unique ignoring upper / lower case |
  | `description` | string | no | up to 300 chars |
  | `access` | object | yes | `{ <area>: 'READ' \| 'WRITE' }` - only known areas; leave an area out for no access |

- **Returns:** the new role (as in `roles.list`).
- **What it does:** makes a role. Someone who is not a super admin can only give levels they have themselves.
- **Re-entered password (2026-11-16):** needs the caller's password confirmed in this session in the last 10 minutes
  (`accounts.confirmPassword`) - else `403 FORBIDDEN` "Enter your password to confirm this change" with
  `data.passwordConfirmationRequired: true`.
- **Errors:** `400` invalid input · `403 FORBIDDEN` "You can only give access you have yourself..." ·
  `409 CONFLICT` "A role named X already exists".

### `accounts.roles.update`
- **HTTP:** `POST /api/rpc/accounts/roles/update` · **Code:** `backend/src/modules/accounts/roles/`
- **Access:** Roles & access: Edit.
- **Scope:** shared by every company - needs Roles & access Edit for **all companies** (`403` "... is shared by every company").
- **Input:** `id` (required) plus any of `name`, `description` (`null` clears it), `access` (replaces the whole
  list) - same rules as `create` - and `isApprovalFallback` (boolean, 2026-11-20: `true` makes the role the fallback approver -
  the mark moves from any other role; `false` takes it away). Only the fields sent are changed.
- **Returns:** the updated role.
- **What it does:** renames a role or changes its access - at once for everyone who has it. Someone who is not a
  super admin can only change roles within their own access (before and after the change). Since 2026-11-23 the change
  is also checked over the people who have the role: every area whose level changes (added, raised, lowered, taken
  away) must be within the caller's access over **each holder's data-access rows** - the same rule as giving them the
  role (`403` "People who have this role have data access beyond yours for: ..."); and nobody but a super admin
  changes a role they have themselves (`403` "You cannot change a role you have yourself").
- **Re-entered password (2026-11-16):** needs the caller's password confirmed in this session in the last 10 minutes
  (`accounts.confirmPassword`) - else `403 FORBIDDEN` "Enter your password to confirm this change" with
  `data.passwordConfirmationRequired: true`.
- **Since 2026-11-23 (the review):** changing a role and giving it at the same moment wait for each other (a lock per role); the change is checked again inside, against the holders saved.
- **Errors:** `400` invalid input · `403 FORBIDDEN` the Super Admin role, beyond own access (also over the holders'
  data access), or a role the caller has · `404 NOT_FOUND` unknown id · `409 CONFLICT` name already used.

### `accounts.roles.delete`
- **HTTP:** `POST /api/rpc/accounts/roles/delete` · **Code:** `backend/src/modules/accounts/roles/`
- **Access:** Roles & access: Edit.
- **Scope:** shared by every company - needs Roles & access Edit for **all companies** (`403` "... is shared by every company").
- **Input:** `{ id: number }`
- **Returns:** `{ id, deleted: true }`
- **What it does:** deletes a role that nobody has, no approval-chain step names (2026-11-20) and no joining task type
  has as its team (2026-11-20).
- **Re-entered password (2026-11-16):** needs the caller's password confirmed in this session in the last 10 minutes
  (`accounts.confirmPassword`) - else `403 FORBIDDEN` "Enter your password to confirm this change" with
  `data.passwordConfirmationRequired: true`.
- **Errors:** `403 FORBIDDEN` the Super Admin role, or beyond own access · `404 NOT_FOUND` unknown id ·
  `409 CONFLICT` "N employee(s) have this role - take it away from them first", the role is a step of an approval chain,
  or it is the team of a joining task.

## candidates

People who were made an offer, from the offer up to the joining day. A candidate is **not** an employee: the
employee row is created on the joining day (`candidates.joining.complete`), and the candidate becomes `JOINED`. After acceptance the
**candidate** fills the joining form and uploads their documents on their own page (`candidates.portal.*` - the same
link as the offer, with a one-time code) and signs it online; HR sees and can correct the same form
(`candidates.joiningForm.*`, stored encrypted), verifies the documents (`candidates.documents.*`), runs the background
checks (`candidates.backgroundChecks.*`), records the medical result and the joining confirmation.

```
DRAFT -> OFFERED -> ACCEPTED -> JOINED (joining day: the employee is created and linked)
DRAFT -> OFFERED (Letter of Intent) -> LOI_ACCEPTED -> OFFERED (full offer) -> ACCEPTED -> JOINED   (with an LOI, 2026-11-16)
  ends: DECLINED (refused the offer / LOI)   EXPIRED (no answer by offerValidUntil)
        WITHDRAWN (company cancelled)        BACKED_OUT (accepted the LOI or the offer, then won't join)   NO_SHOW (did not turn up)
```

**Letter of Intent (2026-11-16):** HR may first send a Letter of Intent (`candidates.send` with a `LETTER_OF_INTENT`
template) - numbered on its own (`RML/LOI/2026/0001`, `loiNumber`), answered like an offer (online or on paper). Once it
is accepted (`LOI_ACCEPTED`, `loiAcceptedAt` / `loiAcceptedBy`) HR sends the full offer (an `OFFER_LETTER` template),
which is accepted as usual and opens the joining form. The terms can still change while `LOI_ACCEPTED`; changing them
after the full offer was sent goes back to `LOI_ACCEPTED`. No LOI once a full offer was sent. The newest letter's
`kind` (`candidates.offerLetters.list`) says what is out.

**The offer letter:** `candidates.send` writes the letter from the template HR picks (`letterTemplates.*` - its wording
and letterhead; `candidates.offerLetters.templates` lists them), gives the offer its number (`RML/OFFER/2026/0001` - company e-code prefix / year / running
number) the first time, stores the PDF (`candidates.offerLetters.*`) and e-mails it with the candidate's secret link.
The candidate answers on their page (`candidates.offerResponse.*`, public) with a one-time code - or on paper, which HR
records with `candidates.accept` after uploading the signed copy. Changing the terms after sending moves the offer back
to `DRAFT`; sending again makes a new revision of the letter with the same number. Without SMTP settings e-mails are
saved to `<STORAGE_DIR>/outbox/` instead of being sent.

**Candidate shape** (returned by every candidates API): `id`; person (`salutation` `MR`/`MS`/`MRS`/`DR`,
`firstName`, `middleName`, `lastName`, `mobile`, `personalEmail`, `address`); offer terms (`company {id, code, name}`,
`workLocation {id, name, countryCode}`, `department`, `designation`, `grade` as `{id, name}`, `joiningType`,
`employmentType`, `workforceCategory`, `annualCtc` (fixed), `performancePayAnnual`, `ctcCurrency`,
`proposedJoiningDate`, `contractEndDate`, `offerValidUntil`, `probationMonths`, `noticeMonthsProbation`,
`noticeMonthsConfirmed`, `offerNumber` (null until first sent), `loiNumber` / `loiAcceptedAt` (the Letter of Intent,
null without one)); progress (`status`,
`offerSentAt`, `acceptedAt`, `closedAt`, `closeReason`, `joiningConfirmedAt`, `joiningFormSubmittedAt` (the candidate
signed the joining form online), `joiningFormReturnedAt` (HR sent it back), `createdAt`, `updatedAt`), and the
employee created from it (`employeeId`, `employee { employeeCode }`, null until JOINED). Once JOINED nothing on the
candidate changes; its joining form and documents now belong to the employee (`joiningForm.get` returns `{}`,
`documents.list` returns `[]`), while background checks stay open. Single-candidate responses (everything except `list`) also contain the medical result (`medicalResult`,
`medicalExamDate`, `medicalExaminer`, `medicalRestrictions`) - health data is kept out of lists - the salary breakup
`salaryLines: [{ monthlyAmount, salaryComponent {id, name, kind} }]` in component order, the online signature of
the joining form (`joiningFormSignedName`, `joiningFormDeclaration` - the exact text agreed to, `joiningFormSignIp`,
`joiningFormSignUserAgent`) and HR's `joiningFormReturnReason`, and who did each
step, as persons: `createdBy`, `updatedBy`, `offerSentBy`, `acceptedBy`, `loiAcceptedBy`, `closedBy`, `joiningConfirmedBy`,
`joiningFormSubmittedBy`, `joiningFormReturnedBy` (an online acceptance / decline / signature shows
`{ employeeCode: null, name: 'Candidate (online)' }`; cleared
together with their time, e.g. when a changed offer goes back to draft). Calendar dates are
`Date`s at UTC midnight.

### `candidates.list`
- **HTTP:** `POST /api/rpc/candidates/list` · **Code:** `backend/src/modules/candidates/`
- **Access:** Onboarding: View.
- **Scope:** only candidates inside the caller's Onboarding View data access.
- **Input (optional):** `{ status?: CandidateStatus, companyId?: number }`
- **Returns:** `[candidate]`, newest first.
- **What it does:** lists candidates, optionally only one status (e.g. `ACCEPTED` = joining soon) or one company.
- **Errors:** `400` invalid input.


### `candidates.export`
- **HTTP:** `POST /api/rpc/candidates/export` · **Code:** `backend/src/modules/candidates/`
- **Access:** Onboarding: View.
- **Scope:** only candidates inside the caller's Onboarding View data access.
- **Input (optional):** `{ status?, companyId? }` (as `list`).
- **Returns:** a file `offers-and-candidates-YYYY-MM-DD.xlsx` - one row per candidate: number, name, mobile, company,
  designation, department, joining type, status, Letter of Intent number and its status (Accepted / Yet to accept / Not
  accepted / Replaced by the offer), offer number, sent, accepted, valid until, joining date, fixed CTC and currency,
  joined as, close reason.
- **What it does:** the "Offers & candidates" report (2026-11-16, inspired by the old HRMS's R21).
- **Errors:** `400` · `403`.
- **Review format (2026-11-24):** shared Excel review-report formatting and separate Review notes sheet described above; existing data columns and authorization retained.

- **Lifecycle groups (2026-11-24):** optional `statuses` array, up to 20 valid CandidateStatus values, narrows the authorized rows after existing status/company filters. Omitted = every status; empty = none. Onboarding sends the current lifecycle group, so the report matches its table.

### `candidates.get`
- **HTTP:** `POST /api/rpc/candidates/get` · **Code:** `backend/src/modules/candidates/`
- **Access:** Onboarding: View.
- **Scope:** Onboarding View covering the candidate's company / plant / department (else `404` "No candidate found"); a possible duplicate outside the caller's Employee · Directory & job View data access shows as code + name only (`status` null - A5).
- **Input:** `{ id: number }`
- **Returns:** the candidate, with `possibleDuplicates: [{ employeeCode, name, status, matchedOn: ('mobile' | 'e-mail')[] }]`
  - employees with the same mobile (its last 10 digits) or e-mail (personal or work) as the candidate, at most 5 (a
  rehire, or an offer made twice - 2026-11-16, inspired by the old HRMS); empty once joined.
- **What it does:** looks up one candidate. The duplicates are only shown to HR - they never stop anything.
- **Errors:** `400` invalid input · `404 NOT_FOUND` "No candidate found with id X".

### `candidates.create`
- **HTTP:** `POST /api/rpc/candidates/create` · **Code:** `backend/src/modules/candidates/`
- **Access:** Onboarding: Edit.
- **Scope:** the offer's company / plant / department inside the caller's Onboarding **Edit** data access (`403`).
- **Input:**

  | Field | Type | Required | Rules |
  |---|---|---|---|
  | `firstName` | string | yes | 1-100 chars, trimmed |
  | `middleName`, `lastName` | string | no | 1-100 chars, trimmed |
  | `mobile` | string | yes | 6-20 chars |
  | `personalEmail` | string | no | valid email; trimmed and lower-cased |
  | `companyId` | number | yes | an existing company |
  | `plantId` | number | yes | an **active plant of the company** (2026-11-18); copied to the employee on the joining day |
  | `workLocationId` | number | no | an **active work location** (group-wide - any company can use any work location) |
  | `departmentId` | number | no | **one of the plant's departments** |
  | `gradeId` | number | no | existing grade |
  | `designationId` | number | yes | an existing designation |
  | `joiningType` | `REGULAR` / `CONSULTANT_INTERN` / `OVERSEAS` | yes | |
  | `employmentType` | `PERMANENT` / `CONTRACT` / `TRAINEE` (also interns) / `CONSULTANT` / `APPRENTICE` | yes | must fit the joining type: `REGULAR` - permanent, contract; `CONSULTANT_INTERN` - consultant, trainee, apprentice; `OVERSEAS` - permanent, contract, consultant, trainee |
  | `workforceCategory` | `WHITE_COLLAR` / `BLUE_COLLAR` | yes | |
  | `annualCtc` | number | yes | the FIXED CTC: whole currency units per year, > 0 |
  | `performancePayAnnual` | number | no | performance pay per year, on top of the fixed CTC (Total CTC on the letter) |
  | `ctcCurrency` | string | no | 3-letter code, default `INR` |
  | `proposedJoiningDate` | Date | yes | |
  | `contractEndDate` | Date | contract / trainee / apprentice: yes; permanent: must be empty | after `proposedJoiningDate` |
  | `offerValidUntil` | Date | no (needed to send) | on or before `proposedJoiningDate` |
  | `salutation` | `MR` / `MS` / `MRS` / `DR` | no (the letter needs it) | |
  | `address` | string | no (the letter needs it) | 1-300 chars - printed under the name |
  | `probationMonths` | number | no (the letter needs it) | 0-24 |
  | `noticeMonthsProbation`, `noticeMonthsConfirmed` | number | no (the letter needs them) | 0-24 - notice during probation / after confirmation |
  | `salaryLines` | `[{ salaryComponentId, monthlyAmount }]` | no (the letter needs it) | active salary components (earnings / employer contributions - never a `DEDUCTION`), each once; per month, up to 2 decimals (paise - 2026-11-24); **the monthly total must equal `annualCtc` / 12 to the paisa** (5,84,000 -> 48,666.67) |
  | `extraRequiredDocuments` | DocumentType[] | no | documents this offer needs on top of the pack's compulsory ones (2026-11-20) - only types from `documents.requirements` `requestable`; duplicates dropped. The candidate uploads them before signing and HR verifies them before joining (`joining.checklist`). Not printed on the letter |
  | `joiningFormOnAcceptance` | boolean | no | default `false` (2026-11-20): `true` = the joining form opens when the candidate accepts and its link is e-mailed with the acceptance; `false` = HR opens it later with `offerLetters.newLink` ("Send link"). Not printed on the letter |

  "The letter needs it" = the seeded offer letter prints it, so sending fails without it (the template decides).
- **Returns:** the new candidate, status `DRAFT`. Candidates now also carry `joiningFormOnAcceptance`, `joiningFormOpenedAt`
  and (in the detail) `joiningFormOpenedBy` (`{ employeeCode, name }`, or "Candidate (online)" when the online acceptance
  opened it).
- **What it does:** records a new offer as a draft, with its salary breakup.
- **Errors:** `400` invalid input, a date / location rule above, a plant / department rule above, an employment type that
  does not fit the joining type, a missing (or, for permanent, an unwanted) contract end date, or a breakup that does not
  add up to the CTC · `409 CONFLICT` unknown company or master id.

### `candidates.update`
- **HTTP:** `POST /api/rpc/candidates/update` · **Code:** `backend/src/modules/candidates/`
- **Access:** Onboarding: Edit.
- **Scope:** Onboarding Edit covering the candidate (outside the View data access `404`, View only `403`); a move (company / plant / department) also needs Edit where it goes (`403`).
- **Input:** `id` (required) plus any field of `create` (same rules). Only the fields sent are changed; `null`
  clears an optional one (`salutation`, `middleName`, `lastName`, `personalEmail`, `address`, `workLocationId`,
  `departmentId`, `gradeId`, `contractEndDate`, `offerValidUntil`, `performancePayAnnual`, `probationMonths`,
  `noticeMonths...`). `salaryLines` replaces the whole breakup (`[]` removes it). The breakup must still add up to the
  (new) CTC.
- **Returns:** the updated candidate.
- **What it does** (depends on the status):
  - `DRAFT`: anything can change.
  - `OFFERED`: person details (salutation, names, mobile, email, address), `joiningFormOnAcceptance` and
    `extraRequiredDocuments` (not on the letter) change freely; sending **any other offer term**
    (a different breakup counts) moves it back to `DRAFT` (`offerSentAt` cleared) - the revised offer must be sent
    again as a new revision of the letter; the candidate's old link then shows "replaced". This is how a negotiation
    is recorded.
  - `ACCEPTED`: only the person details, `extraRequiredDocuments` (until joining, 2026-11-20) and `proposedJoiningDate` (not in the past) can change - and a missing
    `departmentId` can be filled in (joining needs one, 2026-11-19; one already set stays). A new joining
    date clears `joiningConfirmedAt`.
  - closed: nothing can change.
  - Until accepted, the joining / employment type pair and the contract end date follow the `create` rules (checked on
    the resulting offer).
  - A permanent offer has no contract end date: one left on it from before that rule is dropped when the offer is
    saved (any status that can change - 2026-11-15), and is never compared with the joining date.
  - Company, plant and department are checked as they will be (2026-11-18): a new company needs a plant of its own, a
    new plant keeps the department only if it runs there.
- **Errors:** `400` invalid input, a date / location rule, a plant / department rule, or the type / end-date rules · `404 NOT_FOUND` unknown id · `409 CONFLICT` the
  candidate is closed or JOINED, a term of an accepted offer was sent, or an unknown company / master id. Â· `409` "This offer was changed a moment ago" - the status changed since it was read (a candidate's answer and HR's change at the same moment - 2026-11-23)

### `candidates.send`
- **HTTP:** `POST /api/rpc/candidates/send` · **Code:** `backend/src/modules/candidates/`
- **Access:** Onboarding: Edit.
- **Scope:** Onboarding Edit covering the candidate (outside the View data access `404`, View only `403`).
- **Input:** `{ id: number, templateId: number }` - the candidate and the letter template HR picked (an active offer
  letter or Letter of Intent template with its full letterhead; `candidates.offerLetters.templates` lists them). The
  template's kind decides what is sent.
- **Returns:** `{ candidate, link, emailedTo, emailError }` - the candidate (status `OFFERED`, `offerSentAt`,
  `offerNumber` - or `loiNumber` for a Letter of Intent), the candidate's link `APP_URL/offer/<token>` (**shown once** - only its SHA-256 is stored), the
  address it was e-mailed to (`null` without a personal e-mail, or when it was not sent) and a mail error message if
  sending failed or the server has no mail server set up (`SMTP_HOST` - the e-mail is then only saved in the outbox
  folder and not recorded as e-mailed). The offer is still sent - share the link or use `offerLetters.newLink`.
- **What it does:** writes the offer letter from the picked template (its wording and its letterhead); records the
  template and its kind on the letter; gives the offer (or the Letter of Intent) its number on the first send of that
  kind; stores the PDF as revision 0, 1, 2... (`candidates.offerLetters.list` - the LOI and the offer share the revision
  numbers; the e-mail and file names count each kind on its own)
  with its SHA-256; e-mails the PDF and the link to the candidate. All in one transaction (nothing is numbered or
  stored if the letter cannot be written).
- **Errors:** `400` `offerValidUntil` not set or in the past, `proposedJoiningDate` in the past, the template is retired
  / not an offer letter or Letter of Intent / has no complete letterhead, or "The letter needs: ..." (missing offer
  fields) · `404 NOT_FOUND` candidate or template · `409 CONFLICT` a Letter of Intent not from a `DRAFT`, or after the
  LOI was accepted or a full offer was sent; an offer not from `DRAFT` / `LOI_ACCEPTED`. Â· `409` "This offer was changed a moment ago" - the status changed since it was read (a candidate's answer and HR's change at the same moment - 2026-11-23)

### `candidates.accept`
- **HTTP:** `POST /api/rpc/candidates/accept` · **Code:** `backend/src/modules/candidates/`
- **Access:** Onboarding: Edit.
- **Scope:** Onboarding Edit covering the candidate (outside the View data access `404`, View only `403`).
- **Input:** `{ id: number }`
- **Returns:** the candidate, status `ACCEPTED`, `acceptedAt` / `acceptedBy` set - or, when the newest letter is a
  Letter of Intent, `LOI_ACCEPTED` with `loiAcceptedAt` / `loiAcceptedBy` (then send the full offer).
- **What it does:** records that the candidate accepted the newest letter **on paper**. Upload the signed letter first
  (`candidates.documents.upload` with type `SIGNED_OFFER_LETTER`, uploaded after that letter was sent - a signed LOI does
  not accept the full offer). Accepting the offer starts pre-joining; with `joiningFormOnAcceptance` it also opens the
  joining form (by this HR person - no e-mail: send its link with `offerLetters.newLink`), 2026-11-20. (Online acceptance:
  `candidates.offerResponse.accept`.)
- **Errors:** `400` no signed offer letter uploaded (or only a rejected one) · `404 NOT_FOUND` · `409 CONFLICT` not
  `OFFERED`, or the offer expired (past `offerValidUntil`). Â· `409` "This offer was changed a moment ago" - the status changed since it was read (a candidate's answer and HR's change at the same moment - 2026-11-23)

### `candidates.close`
- **HTTP:** `POST /api/rpc/candidates/close` · **Code:** `backend/src/modules/candidates/`
- **Access:** Onboarding: Edit.
- **Scope:** Onboarding Edit covering the candidate (outside the View data access `404`, View only `403`).
- **Input:**

  | Field | Type | Required | Rules |
  |---|---|---|---|
  | `id` | number | yes | |
  | `outcome` | `DECLINED` / `EXPIRED` / `WITHDRAWN` / `BACKED_OUT` / `NO_SHOW` | yes | see below |
  | `reason` | string | only for `WITHDRAWN` | 1-500 chars |

  | Outcome | Meaning | Allowed when |
  |---|---|---|
  | `DECLINED` | candidate refused the offer | `OFFERED` |
  | `EXPIRED` | no answer in time | `OFFERED` and `offerValidUntil` has passed |
  | `WITHDRAWN` | company cancelled (e.g. failed BGV, unfit, fake document, position closed) | `DRAFT`, `OFFERED`, `LOI_ACCEPTED`, `ACCEPTED` |
  | `BACKED_OUT` | accepted (the LOI or the offer), then said they won't join | `LOI_ACCEPTED`, `ACCEPTED` |
  | `NO_SHOW` | did not turn up | `ACCEPTED` and the joining date has come |

- **Returns:** the candidate with the new status, `closedAt` and `closeReason`.
- **What it does:** ends the process without joining. The record is kept as history.
- **Errors:** `400` invalid input or no reason for `WITHDRAWN` · `404 NOT_FOUND` · `409 CONFLICT` outcome not
  allowed from the current status, offer not expired yet, or joining date not reached. Â· `409` "This offer was changed a moment ago" - the status changed since it was read (a candidate's answer and HR's change at the same moment - 2026-11-23)

### `candidates.offerLetters.templates`
- **HTTP:** `POST /api/rpc/candidates/offerLetters/templates` · **Code:** `backend/src/modules/candidates/offer-letters/`
- **Access:** Onboarding: View.
- **Scope:** Onboarding View covering the candidate's company / plant / department (else `404` "No candidate found").
- **Input:** `{ id: number, kind?: 'OFFER_LETTER' | 'LETTER_OF_INTENT' }` (the candidate; default the offer letter)
- **Returns:** `{ templates: [{ id, name, joiningType, ready }], suggestedId, canSendLoi }` - the active templates of that kind by name
  (`ready` = its letterhead is complete, so it can be sent) and the one to pre-select: a ready one suggested for the
  offer's joining type, else a ready one for any joining type, else the first ready one (`null` if none is ready).
  `canSendLoi`: a Letter of Intent can be sent now (a draft with no accepted LOI and no full offer sent).
- **What it does:** what HR picks from when sending the offer or the Letter of Intent (the send dialog).
- **Errors:** `400` invalid input · `404 NOT_FOUND`.

### `candidates.offerLetters.preview`
- **HTTP:** `POST /api/rpc/candidates/offerLetters/preview` · **Code:** `backend/src/modules/candidates/offer-letters/`
- **Access:** Onboarding: View.
- **Scope:** Onboarding View covering the candidate's company / plant / department (else `404` "No candidate found").
- **Input:** `{ id: number, templateId: number }` (the candidate and a template, as `send`)
- **Returns:** a PDF file.
- **What it does:** writes the letter (offer or Letter of Intent - the template's kind) as `send` would now with that
  template (the number shows "(given when sent)" until the first send). Nothing is stored.
- **Errors:** as `send` (without the status rules) · `404 NOT_FOUND`.

### `candidates.offerLetters.list`
- **HTTP:** `POST /api/rpc/candidates/offerLetters/list` · **Code:** `backend/src/modules/candidates/offer-letters/`
- **Access:** Onboarding: View.
- **Scope:** Onboarding View covering the candidate's company / plant / department (else `404` "No candidate found").
- **Input:** `{ id: number }` (the candidate)
- **Returns:** `[{ id, revision, kind (`OFFER_LETTER` / `LETTER_OF_INTENT`), template { id, name }, isCurrent, sha256, sentAt, sentBy, emailedAt, emailedBy, response, respondedAt,
  responseName, responseIp, responseUserAgent, declineReason }]`, newest first. `response` is `ACCEPTED` /
  `DECLINED` / null (only online answers - paper ones are on the candidate); `isCurrent` = the newest letter, the only
  one the candidate can still answer.
- **What it does:** the history of the letters sent for the offer, with the proof of an online answer (the name the
  candidate typed, time, IP, browser) next to the SHA-256 of the exact PDF.
- **Errors:** `400` invalid input · `404 NOT_FOUND`.

### `candidates.offerLetters.download`
- **HTTP:** `POST /api/rpc/candidates/offerLetters/download` · **Code:** `backend/src/modules/candidates/offer-letters/`
- **Access:** Onboarding: View.
- **Scope:** Onboarding View covering the candidate's company / plant / department (else `404` "No candidate found").
- **Input:** `{ id: number }` (the letter, from `list`)
- **Returns:** the PDF exactly as sent.
- **Errors:** `400` invalid input · `404 NOT_FOUND`.

### `candidates.offerLetters.newLink`
- **HTTP:** `POST /api/rpc/candidates/offerLetters/newLink` · **Code:** `backend/src/modules/candidates/offer-letters/`
- **Access:** Onboarding: Edit.
- **Scope:** Onboarding Edit covering the candidate (outside the View data access `404`, View only `403`).
- **Input:** `{ id: number }` (the candidate)
- **Returns:** `{ link, emailedTo, emailError }` (as `candidates.send`).
- **What it does:** gives the newest letter a new secret link - the old link stops working at once - resets its
  one-time codes and e-mails the letter and link again. For a lost / forwarded e-mail or a candidate who used up their
  codes. After acceptance (`ACCEPTED`) it is the **joining-form link** `APP_URL/joining-form/<token>`: the
  e-mail asks the candidate to fill in their joining form (no letter attached) - and it **opens the joining form** when
  it was not open yet (`joiningFormOpenedAt` / `...ById` = the HR person; an offer with `joiningFormOnAcceptance` false
  waits for this, 2026-11-20). A joining-form link also signs the candidate out of every open joining-form session (the
  old link's - 2026-11-23). Only the newest letter's link opens the joining form: an accepted Letter of Intent's link
  shows the letter only (2026-11-23).
- **Errors:** `404 NOT_FOUND` · `409 CONFLICT` the offer is not `OFFERED` / `ACCEPTED`, or has expired.

### `candidates.offerResponse.view`
- **HTTP:** `POST /api/rpc/candidates/offerResponse/view` · **Code:** `backend/src/modules/candidates/offer-letters/`
- **Access:** **public** - the secret link token is the key.
- **Scope:** not limited by data access - the candidate's own secret link.
- **Input:** `{ token: string }` (43 characters, from the link `APP_URL/offer/<token>` or the joining-form link
  `APP_URL/joining-form/<token>` - the same token)
- **Returns:** `{ state, kind, offerNumber, revision, sentAt, name, fullName, company, designation, joiningDate, validUntil,
  codeEmail, respondedAt, joiningFormOpen, joiningFormNext }`. `kind`: `OFFER_LETTER` or `LETTER_OF_INTENT` (2026-11-16); `offerNumber`
  is the number on this letter (the LOI's own for a Letter of Intent) and `revision` counts the letters of its kind.
  `state`: `OPEN` (can be answered), `ACCEPTED` (answered online, or
  accepted on paper - then `respondedAt` is null; a Letter of Intent accepted on paper too) / `DECLINED` (answered online), `EXPIRED`
  (past `offerValidUntil`), `REPLACED` (a newer letter was sent, or the offer went back to draft), `CLOSED` (withdrawn
  etc.). `codeEmail` is the masked address the code goes to (`pr*****@gmail.com`), null when the offer has no
  e-mail (then it can only be answered on paper). `fullName` is what the candidate must type to accept.
  `joiningFormOpen`: accepted, not joined yet, and the joining form opened for the candidate (at acceptance or by HR's
  link) - the joining-form page then opens the form (`candidates.portal.*`). `joiningFormNext` (2026-11-20), after an
  accepted offer: `EMAILED` (the form is open - its link was e-mailed) or `FROM_HR` (HR will send the link); otherwise
  null. The offer page shows no joining-form button - only this message.
- **What it does:** what the candidate's offer page shows; the joining-form page uses it too (to tell an unanswered
  offer or a closed form from an open one).
- **Since 2026-11-23 (the review):** state `CLOSED` also when the letter was accepted but the offer was closed afterwards (withdrawn, backed out, no-show...); a joined candidate still sees ACCEPTED.
- **Errors:** `400` malformed token · `404 NOT_FOUND` "This link is not valid" (unknown or replaced by `newLink`).

### `candidates.offerResponse.download`
- **HTTP:** `POST /api/rpc/candidates/offerResponse/download` · **Code:** `backend/src/modules/candidates/offer-letters/`
- **Access:** **public** (secret link).
- **Scope:** not limited by data access - the candidate's own secret link.
- **Input:** `{ token: string }`
- **Returns:** the PDF of the letter the link belongs to (works in every state, so the candidate keeps a copy).
- **Errors:** `400` · `404 NOT_FOUND`.

### `candidates.offerResponse.sendCode`
- **HTTP:** `POST /api/rpc/candidates/offerResponse/sendCode` · **Code:** `backend/src/modules/candidates/offer-letters/`
- **Access:** **public** (secret link).
- **Scope:** not limited by data access - the candidate's own secret link.
- **Input:** `{ token: string }`
- **Returns:** `{ sentTo, validMinutes }` (masked address, 10).
- **What it does:** e-mails a 6-digit one-time code to the candidate's personal e-mail. A new code replaces the old
  one; at most one a minute and 5 in a row - the count starts again after 30 minutes without a code (2026-11-20; "try
  again in N minutes"), when a code is used, or with HR's new link. Only the code's SHA-256 is stored. While the
  offer is `OPEN` the code answers it; after acceptance (candidate still `ACCEPTED`) it signs the candidate in to their
  joining form (`portal.signIn`) and signs the submitted form (`portal.submit`) - a used code resets the count of 5, so
  the candidate can come back on later days.
  Answers at once: the e-mail is sent in the background, so a mail failure is only logged on the server (the
  candidate asks for a new code after a minute) - it never makes this call fail.
- **Errors:** `400` · `404 NOT_FOUND` · `409 CONFLICT` not `OPEN` and the joining form not open (declined, expired,
  replaced, closed, joined), no e-mail on the offer, asked again within a minute, or 5 codes in a row within 30 minutes.

### `candidates.offerResponse.accept`
- **HTTP:** `POST /api/rpc/candidates/offerResponse/accept` · **Code:** `backend/src/modules/candidates/offer-letters/`
- **Access:** **public** (secret link + one-time code).
- **Scope:** not limited by data access - the candidate's own secret link.
- **Input:** `{ token: string, code: string (6 digits), name: string (1-300) }`
- **Returns:** the page view (as `view`), `state: ACCEPTED`.
- **What it does:** the candidate's electronic acceptance: the right code (10 minutes; after 5 wrong tries it stops
  working - every try is counted in the database before the check, so guesses at the same moment each count, 2026-11-23;
  the same for `decline` and `portal.signIn`) and their full name typed as on the letter (case and spaces ignored). In one transaction the letter records
  the answer and its proof (typed name, time, IP, browser) - the used code is cleared and the count of codes sent starts
  again (2026-11-20), so the codes asked for while answering do not use up the joining form's - and the candidate becomes `ACCEPTED` by System (a Letter of
  Intent: `LOI_ACCEPTED` - the e-mail then says the full offer follows, with no joining-form link). Then the
  candidate is e-mailed their record of the acceptance: the accepted PDF attached, with the offer number / revision,
  time, typed name, IP, the address the code went to and the letter's SHA-256 - a copy outside our system, so a later
  change to the stored letter would show - and the next step: with `joiningFormOnAcceptance` the joining form opens now
  and the e-mail carries its link (`APP_URL/joining-form/<token>`, the same token); without it, the e-mail says HR will
  send the link (2026-11-20). The e-mail is
  started in the background (the answer does not wait for it); a failure is only logged on the server.
- **Errors:** `400` invalid input, code expired / not requested / wrong ("N tries left"), or the name does not match
  · `404 NOT_FOUND` · `409 CONFLICT` not `OPEN`. Â· `409` "This offer was changed a moment ago" - the status changed since it was read (a candidate's answer and HR's change at the same moment - 2026-11-23)

### `candidates.offerResponse.decline`
- **HTTP:** `POST /api/rpc/candidates/offerResponse/decline` · **Code:** `backend/src/modules/candidates/offer-letters/`
- **Access:** **public** (secret link + one-time code).
- **Scope:** not limited by data access - the candidate's own secret link.
- **Input:** `{ token: string, code: string (6 digits), reason?: string (1-500) }`
- **Returns:** the page view, `state: DECLINED`.
- **What it does:** the candidate declines online; the letter keeps the proof and the reason, and the candidate becomes
  `DECLINED` by System with `closeReason` "Declined online: <reason>".
- **Errors:** as `accept` (without the name check). Â· `409` "This offer was changed a moment ago" - the status changed since it was read (a candidate's answer and HR's change at the same moment - 2026-11-23)

### `candidates.portal.signIn`
- **HTTP:** `POST /api/rpc/candidates/portal/signIn` · **Code:** `backend/src/modules/candidates/portal/`
- **Access:** **public** - the secret link + a one-time code (`offerResponse.sendCode`).
- **Scope:** not limited by data access - the candidate's own secret link.
- **Input:** `{ token: string, code: string (6 digits) }`
- **Returns:** the portal view (as `me`).
- **What it does:** after acceptance (online or on paper) and before joining - once the joining form was opened for
  them (`joiningFormOpenedAt`: at acceptance, or by HR's link, 2026-11-20) - opens the candidate's joining form: checks
  the code (10 minutes, 5 wrong tries), clears it, and starts a **candidate session** - a random token in the httpOnly
  cookie `hrms_candidate` (SameSite=Strict, path `/api`, no expiry date), only its SHA-256 stored
  (`candidate_sessions`). The session ends after an hour without use, at `signOut`, or when the candidate is no longer
  `ACCEPTED` (joined, withdrawn, backed out).
- **Since 2026-11-23 (the review):** for a letter not OPEN (closed, replaced...) the message is "Your joining form is closed. Please contact HR."; "opens once you have accepted the offer" only while the offer is open.
- **Errors:** `400` invalid input, code expired / wrong · `404 NOT_FOUND` unknown link · `409 CONFLICT` "The joining
  form opens once you have accepted the offer" / the form is closed.

### `candidates.portal.me`
- **HTTP:** `POST /api/rpc/candidates/portal/me` · **Code:** `backend/src/modules/candidates/portal/`
- **Access:** candidate session.
- **Scope:** not limited by data access - the candidate's own session (never an id from the request).
- **Input:** none.
- **Returns:** `{ candidate { name, fromOffer, signName, company, designation, workLocation, joiningDate, joiningType },
  loadedAt, form, changes, checks, submission, declaration, documents, documentTypes }`:
  - `candidate.fromOffer`: `{ firstName, middleName, lastName, mobile, personalEmail }` as HR typed them on the offer
    (the form starts with the name and mobile; the e-mail is shown only - the codes go to it, so only HR changes it);
    `signName`: the full name to type when signing - the form's name when it has one, else the offer's;
  - `form`: the joining form (sections as `joiningForm.save`) with saved numbers **only as their last 4 digits** -
    `identityDocuments[].numberLast4`, `bankAccount.accountNumberLast4`, `familyMembers[].aadhaarLast4` (no `number`,
    `accountNumber`, `aadhaar`);
  - `changes`: per section `{ at, byHr }` (HR people are not named); `loadedAt`: send it back with `save`;
  - `checks`: the required parts of the form `[{ key, label, ok, detail }]` (as the joining checklist);
  - `submission`: `{ submittedAt, signedName, returnedAt, returnReason }`; `declaration`: the text the candidate signs;
  - `documents`: their documents, deleted ones left out - `[{ id, type, fileName, mimeType, sizeBytes,
    verificationStatus, rejectionReason, createdAt, uploadedByYou }]`;
  - `documentTypes`: the types the candidate uploads `[{ type, label, required }]` - `PHOTO`, `AADHAAR_COPY`,
    `PAN_COPY`, `PASSPORT_COPY`, `BANK_PROOF`, `CLASS_X_MARKSHEET`, `CLASS_XII_MARKSHEET`, `GRADUATION_CERTIFICATE`,
    `POST_GRADUATION_CERTIFICATE`, `EDUCATION_CERTIFICATE` (other), `EXPERIENCE_LETTER`, `DRIVING_LICENCE_COPY`
    (`required` = needed before submitting: the joining-form pack's, plus the offer's `extraRequiredDocuments`).
- **What it does:** the candidate's joining-form page.
- **Errors:** `401 UNAUTHORIZED` "Your session has ended. Please open the link from your e-mail again."

### `candidates.portal.save`
- **HTTP:** `POST /api/rpc/candidates/portal/save` · **Code:** `backend/src/modules/candidates/portal/`
- **Access:** candidate session.
- **Scope:** not limited by data access - the candidate's own session (never an id from the request).
- **Input:** any sections of `joiningForm.save` (without `candidateId`) + `loadedAt?: Date`. A saved number may be left
  out to **keep** it: an identity document without `number` keeps the saved one of that type, `bankAccount` without
  `accountNumber` keeps the saved one, a family member without `aadhaar` but with `aadhaarLast4` keeps the Aadhaar of the
  saved member with that name and last 4 digits. A new item without its number is refused.
- **Returns:** the portal view (as `me`).
- **What it does:** saves the sections into the same draft HR sees (`joiningForm.save` rules), recorded as
  "Candidate (online)". Not after the candidate has submitted (until HR sends it back).
- **Errors:** `400` invalid input (the field messages) or "Enter the ... number" · `401` · `409 CONFLICT` already
  submitted, "HR changed this part of the form after you opened it" (a sent section HR changed after `loadedAt`), or
  "This Aadhaar number is already registered with us..." (the candidate is not told whose it is).

### `candidates.portal.uploadDocument`
- **HTTP:** `POST /api/rpc/candidates/portal/uploadDocument` (multipart) · **Code:** `backend/src/modules/candidates/portal/`
- **Access:** candidate session.
- **Scope:** not limited by data access - the candidate's own session (never an id from the request).
- **Input:** `{ type: PHOTO / AADHAAR_COPY / PAN_COPY / PASSPORT_COPY / BANK_PROOF / EDUCATION_CERTIFICATE /
  EXPERIENCE_LETTER / DRIVING_LICENCE_COPY, file: File (1 byte - 5 MB) }` - the statutory forms, the signed joining
  form, the medical form and the BGV consent are signed on paper and uploaded by HR.
- **Returns:** the portal view.
- **What it does:** as `candidates.documents.upload` (PDF / JPG / PNG checked from the content, `PENDING` until HR
  verifies it), uploaded by "Candidate (online)". Also after submitting (e.g. a document HR rejected).
- **Since 2026-11-23 (the review):** at most 10 of the candidate's own files per document type and 60 in all (removed files count - they are kept; HR's uploads do not count).
- **Errors:** `400` invalid input / not PDF, JPG or PNG · `401` · `409 CONFLICT` the candidate is not `ACCEPTED`. Â· `400` over 10 files of a type / 60 in all

### `candidates.portal.removeDocument`
- **HTTP:** `POST /api/rpc/candidates/portal/removeDocument` · **Code:** `backend/src/modules/candidates/portal/`
- **Access:** candidate session.
- **Scope:** not limited by data access - the candidate's own session (never an id from the request).
- **Input:** `{ id: number }`
- **Returns:** the portal view.
- **What it does:** the candidate removes their own upload while HR has not checked it (a wrong file). Kept like any
  deleted document (HR sees it under "Deleted", reason "Removed by the candidate").
- **Errors:** `400` · `401` · `403 FORBIDDEN` uploaded by HR · `404 NOT_FOUND` not their document · `409 CONFLICT`
  already verified / rejected.

### `candidates.portal.document`
- **HTTP:** `POST /api/rpc/candidates/portal/document` · **Code:** `backend/src/modules/candidates/portal/`
- **Access:** candidate session.
- **Scope:** not limited by data access - the candidate's own session (never an id from the request).
- **Input:** `{ id: number }`
- **Returns:** the file (its uploaded name and type).
- **Errors:** `400` · `401` · `404 NOT_FOUND` not their document (or deleted).

### `candidates.portal.submit`
- **HTTP:** `POST /api/rpc/candidates/portal/submit` · **Code:** `backend/src/modules/candidates/portal/`
- **Access:** candidate session + a fresh one-time code (`offerResponse.sendCode`).
- **Scope:** not limited by data access - the candidate's own session (never an id from the request).
- **Input:** `{ code: string (6 digits), name: string (1-300), agreed: true }`
- **Returns:** the portal view, `submission.submittedAt` set.
- **What it does:** the candidate submits the joining form and **signs it online** (JF §10 declaration): every required
  part filled (the form part of the joining checklist) and the required documents uploaded, their full name typed as
  in the form - the corrected name when the form has one, else the offer's (`signName`; case / spaces ignored). Stores the time, typed name, the declaration text word for word, IP and
  browser on the candidate (by "Candidate (online)"); the form is then locked for them. E-mails the HR person who sent
  the offer (their work e-mail, in the background). The printed form is still signed on paper on the joining day
  (HR wants both - decided 2026-11-13); on joining the signature becomes the employee's declaration.
- **Since 2026-11-23 (the review):** the form is checked first (every required part filled, the name as on the form); the one-time code is checked after that and is used only once the form is saved - a refused submit keeps the code and counts no try.
- **Errors:** `400` invalid input, code wrong / expired, "Please complete these first: ..." or the name does not match
  · `401` · `409 CONFLICT` already submitted / not `ACCEPTED`.

### `candidates.portal.signOut`
- **HTTP:** `POST /api/rpc/candidates/portal/signOut` · **Code:** `backend/src/modules/candidates/portal/`
- **Access:** candidate session.
- **Scope:** not limited by data access - the candidate's own session (never an id from the request).
- **Input:** none.
- **Returns:** `{ signedOut: true }`
- **What it does:** deletes the session and clears the cookie.
- **Errors:** `401`.

### `candidates.joiningForm.get`
- **HTTP:** `POST /api/rpc/candidates/joiningForm/get` · **Code:** `backend/src/modules/candidates/joining-form/`
- **Access:** Onboarding: View.
- **Scope:** Onboarding View covering the candidate's company / plant / department (else `404` "No candidate found"); the medical part only with "Employee · Medical" covering the candidate too.
- **Input:** `{ candidateId: number }`
- **Returns:** `{ loadedAt, form, changes }` - `form`: the draft, any of `personal`, `addresses`, `emergencyContacts`,
  `identityDocuments`, `bankAccount`, `statutory`, `qualifications`, `certifications`, `previousJobs`, `familyMembers`,
  `nominees`, `gratuity`, `medical` (see `save`); `{}` if nothing was saved yet. `medical` (and its change) only with **Medical
  information: View**. Identity, bank and family Aadhaar numbers are returned **in full**. `changes`: per section `{ at, by }` (a person; the candidate = "Candidate (online)"). `loadedAt`: send it back
  with `save`.
- **What it does:** decrypts and returns the joining-form data collected so far (by the candidate and / or HR). Works
  in every status (history).
- **Errors:** `400` invalid input · `404 NOT_FOUND` unknown candidate.

### `candidates.joiningForm.save`
- **HTTP:** `POST /api/rpc/candidates/joiningForm/save` · **Code:** `backend/src/modules/candidates/joining-form/`
- **Access:** Onboarding: Edit.
- **Scope:** Onboarding Edit covering the candidate (outside the View data access `404`, View only `403`); the medical part only with "Employee · Medical" covering the candidate too.
- **Input:** `candidateId` (required) plus any of these sections. **Each section sent replaces that whole section;
  sections not sent are kept** (an empty list clears a list section). The rules are the employees module's own
  schemas (`employeesSchemas`), so the draft always fits the employee tables. Dates of things already done cannot be
  in the future (2026-11-15): date of marriage, an ID's date of issue, previous PF exit and first EPF enrolment, Form F's
  notice date, a certification's date, a previous job's from / to.

  | Section | Fields | Rules |
  |---|---|---|
  | `personal` | `firstName`, `middleName`, `lastName` (the name as on the candidate's documents), `mobile` (the candidate's own, 6-20 characters) - both correct what was typed on the offer, which stays as sent; without them the offer's are used, `alternateMobile` (a second number, 6-20 characters), `fatherName`, `motherName`, `gender`, `dateOfBirth`, `placeOfBirth` (town / city, up to 100 characters), `maritalStatus`, `spouseName`, `marriageDate`, `countryOfOrigin`, `nationality`, `religion`, `category` (GENERAL / EWS / OBC / SC / ST), `bloodGroup`, `heightCm`, `weightKg`, `identificationMark`, `hobbies` (up to 200 characters), `isPhysicallyDisabled`, `disabilityType`, `disabilityPercent` - all optional | names 1-100 characters; as the employee columns; `dateOfBirth` in the past; `spouseName` only when `MARRIED` / `SEPARATED` / `WIDOWED`, `marriageDate` only when `MARRIED` / `SEPARATED` (a single or divorced person has no spouse for PF, ESIC, gratuity) - the same rule when the employee is created at joining; height 50-250 cm, weight 20-300 kg, disability 0-100 % |
  | `addresses` | list of `{ type: PERMANENT/PRESENT/CONTACT/EMERGENCY/SPOUSE/OTHER, houseNo, cityOrVillage, locality?, district?, state?, countryCode? (default IN), postalCode?, postOffice?, policeStation?, subDivision? }` | at most one of each type (`PERMANENT` and `PRESENT` both needed to join - the page's "same as permanent" saves a copy as `PRESENT`), up to 3 `OTHER`, 8 in all; Indian PIN = 6 digits |
  | `emergencyContacts` | list of `{ name, relationship, mobile, alternateMobile?, address? }` | max 5 |
  | `identityDocuments` | list of `{ type: AADHAAR/PAN/FOREIGN_TAX_ID/PASSPORT/DRIVING_LICENCE, number, nameOnDocument?, issuingCountry?, validFrom?, validUntil? }` | max one per type; spaces / hyphens removed, upper-cased; Aadhaar 12 digits, PAN `ABCDE1234F`, others 4-30 / 6-20 letters or digits; `validUntil` after `validFrom` |
  | `bankAccount` | `{ bankName, accountHolderName, accountNumber, accountType: SAVINGS/CURRENT, branch?, ifsc? }` | account number 6-34 letters / digits; IFSC `ABCD0123456` |
  | `statutory` | the EPF Form 11 and ESIC Form 1 answers (`pfApplicable`, `uan`, `epfRelative`, `aadhaarMobile` (item 6b, the mobile registered with Aadhaar - 6-20 characters), previous membership, `esicApplicable`, `esicIpNumber`, branch / dispensary, previous employer and its phone / e-mail `previousEmployerContact`) | UAN 12 digits, ESIC IP 10 digits; `wasEpsMember` only with `wasEpfMember` (EPS is part of EPF); `pfNumber` is ignored (the employer allots it after joining) |
  | `qualifications` | list of `{ qualification, institute, yearOfPassing, specialization?, score? }` (JF §6) | max 15; year 1950-2100; score as written ("78%", "8.2 CGPA") |
  | `certifications` | list of `{ name, issuedBy, certifiedOn?, specialization?, score? }` (JF §7) | max 15 |
  | `previousJobs` | list of `{ employerName, designation, fromDate, toDate, reasonForLeaving? }` (JF §8) | max 15; `toDate` on or after `fromDate` |
  | `familyMembers` | list of `{ name, relationship: SPOUSE/SON/DAUGHTER/FATHER/MOTHER/BROTHER/SISTER/FATHER_IN_LAW/MOTHER_IN_LAW/OTHER, gender?, dateOfBirth?, aadhaar?, preExistingDisease?, livesWithEmployee?, residenceTown?, residenceState? }` (JF family details, ESIC Form 1) | max 15; Aadhaar 12 digits; `dateOfBirth` in the past; town / state only when not living with the employee |
  | `noFamilyMembers` | boolean - "I have no family members to list" (draft only; not stored on the employee) | `400` when ticked while family members are listed; saving family members unticks it |
  | `nominees` | list of `{ scheme: GENERAL/GRATUITY/ESIC, name, relationship, dateOfBirth?, address?, sharePercent?, guardianName?, guardianAddress? }` (JF §4, Gratuity Form F, ESIC Form 1) | max 10; `dateOfBirth` in the past; one `GENERAL` and one `ESIC` nominee at most; every `GRATUITY` nominee has a share (adding up to 100), a date of birth and a full address (Form F); a nominee **under 18** needs `guardianName` + `guardianAddress`, and only such a nominee may have them (2026-11-20 - printed under Form F's nominee table) |
  | `gratuity` | the Gratuity Form F declarations: `gratuityParentsNotDependent`, `gratuityHusbandsParentsNotDependent` (yes / no), `gratuityHusbandExcludedOn` (date) | Regular only (refused for the others); saved with the PF / ESIC answers on the joining day, with `gratuityNoFamily` **worked out** (not asked - 2026-11-15): no family unless married / separated, a son / daughter / spouse in `familyMembers`, parents dependent, or (married woman) husband's parents dependent |
  | `medical` | the joining form's "Employee Medical Information" pages: `conditions` (list of ASTHMA/DIABETES/HEART_DISEASE/HIGH_BLOOD_PRESSURE/EPILEPSY/MENTAL_HEALTH), `otherConditions`, `takesMedication` + `medications`, `hasPhysicalLimitations` + `physicalLimitations`, `hadSurgery` + `surgeries`, `hasAllergies` + `allergies`, family history `familyHeartDisease` / `familyDiabetes` / `familyHighBloodPressure` / `familyCancer` / `familyStroke` / `familyMentalHealth` / `familyGeneticDisorders` / `familyOther` (who in the family), `hasHereditaryCondition` + `hereditaryCondition`, `needsHealthLeave` + `healthLeave`, `smokes`, `drinksAlcohol`, `exercisesRegularly` + `exerciseFrequency`, `needsEmergencyCare` + `emergencyCare`, `sports` (list of TENNIS/PADDLE_BALL/BADMINTON/FOOTBALL/BASKETBALL/OTHER), `otherSports`, `sportsFrequency`, **`consent: true`** | Regular and Consultant & Intern only (refused for Overseas); for HR only with **Medical information: Edit** (403); details up to 500 / family 200 characters |
  | `loadedAt` | Date, optional - from `get` | a sent section someone else changed after it is refused (409) |

- **Returns:** the whole draft after saving (same shape as `get`).
- **What it does:** merges the sections into the draft and stores it **encrypted**, recording who changed each section
  and when. Only while the candidate is `ACCEPTED`; HR can also correct a form the candidate has submitted. Each
  identity number is checked against existing employees first. Only a `REGULAR` joining has `statutory` (PF / ESIC)
  and `GRATUITY` / `ESIC` nominees - the other joining types give only a `GENERAL` nominee.
- **Errors:** `400` invalid input (every bad field listed), or PF / ESIC answers or a gratuity / ESIC nominee for a
  non-regular joining · `404 NOT_FOUND` unknown candidate · `409 CONFLICT` the
  candidate is not `ACCEPTED`, a sent section was changed by someone else after `loadedAt`, or "This PAN already
  belongs to employee X (STATUS)" (nothing is saved).

### `candidates.joiningForm.sendBack`
- **HTTP:** `POST /api/rpc/candidates/joiningForm/sendBack` · **Code:** `backend/src/modules/candidates/joining-form/`
- **Access:** Onboarding: Edit.
- **Scope:** Onboarding Edit covering the candidate (outside the View data access `404`, View only `403`).
- **Input:** `{ candidateId: number, reason: string (1-1000, required) }`
- **Returns:** `{ candidate, link, emailedTo, emailError }` (as `offerLetters.newLink`).
- **What it does:** sends the form the candidate submitted back for changes: the online signature is cleared (it no
  longer matches the form), the reason and who / when are kept (`joiningFormReturned...`), and the candidate is e-mailed
  the reason with a **new link** (the old one stops working; HR sees whether the e-mail went out). The candidate can
  change the form and must sign it again.
- **Errors:** `400` invalid input · `404 NOT_FOUND` · `409 CONFLICT` not `ACCEPTED`, or not submitted.

### `candidates.printedForms.print`
- **HTTP:** `POST /api/rpc/candidates/printedForms/print` · **Code:** `backend/src/modules/candidates/printed-forms/`
- **Access:** Onboarding: View (as `joiningForm.get` - the print shows the full numbers). The medical pages only with
  **Medical information: View**; without it they are left out.
- **Scope:** Onboarding View covering the candidate's company / plant / department (else `404` "No candidate found"); the medical part only with "Employee · Medical" covering the candidate too.
- **Input:** `{ candidateId: number }`
- **Returns:** a PDF file (`joining-forms-<name>.pdf`, `application/pdf`).
- **What it does:** writes the joining form onto **HR's own paper forms** (`docs/hr-forms/joining-form-regular.pdf`;
  the three packs are the same pages - decided 2026-11-15) so they are printed filled in and signed by hand on the
  joining day, then uploaded as the signed documents of the checklist. Pages by joining type: Regular - joining form
  (4 pages), Gratuity Form F (2), ESIC Form 1 (only when ESIC applies), EPF Form 11, medical information (2);
  Consultant & Intern - joining form + medical information; Overseas - joining form. Values are typed in the boxes,
  choices circled (Yes / No, gender, marital status...), tick boxes ticked, and Form F's statements that do not apply
  struck through ("I have no family" worked out as in the checklist). The employer's name, address and ESIC code come
  from the company; dates of appointment are the proposed joining date; "place" is the work location. Rows that do not
  fit a form's table go on a continuation sheet at the end. Left for the paper: signatures and their dates, Form F's
  witnesses and employer certificate, ESIC's counter-signature, Form 11's employer part, the office-use boxes. Text
  is printed in Western characters only (others become "?").
- **Errors:** `400` invalid input, or the joining form not complete yet (any required part of the joining checklist's
  form items missing - the message lists them; 2026-11-15) · `404 NOT_FOUND` unknown candidate · `409 CONFLICT` not
  `ACCEPTED` (the draft is only there between acceptance and joining).

### `candidates.documents.list`
- **HTTP:** `POST /api/rpc/candidates/documents/list` · **Code:** `backend/src/modules/candidates/documents/`
- **Access:** Onboarding: View.
- **Scope:** Onboarding View covering the candidate's company / plant / department (else `404` "No candidate found").
- **Input:** `{ candidateId: number }`
- **Returns:** `[{ id, type, fileName, mimeType, sizeBytes, verificationStatus, rejectionReason, reviewedAt, reviewedBy,
  isDeleted, deletedAt, deletedBy, deleteReason, createdAt, uploadedBy }]` (`uploadedBy` / `reviewedBy` / `deletedBy`
  are persons; `isDeleted` is set together with `deletedAt`), in type order, then upload time. `type` is one of `PHOTO`, `SIGNED_JOINING_FORM`, `SIGNED_FORMS_PACK` (the whole printed pack signed, one scan), `MEDICAL_FORM` (the signed medical pages), `MEDICAL_FITNESS_CERTIFICATE` (the doctor's certificate - optional), `EPF_FORM_11`,
  `ESIC_FORM_1`, `GRATUITY_FORM_F`, `AADHAAR_COPY`, `PAN_COPY`, `PASSPORT_COPY`, `BANK_PROOF`, `BGV_CONSENT_FORM`,
  `SIGNED_OFFER_LETTER`, `CLASS_X_MARKSHEET`, `CLASS_XII_MARKSHEET`, `GRADUATION_CERTIFICATE`, `POST_GRADUATION_CERTIFICATE`,
  `EDUCATION_CERTIFICATE` (other education certificate), `EXPERIENCE_LETTER`, `DRIVING_LICENCE_COPY`, `VISA_COPY`,
  `WORK_PERMIT_COPY`, `TRADE_LICENCE_COPY`, `POLICE_VERIFICATION`. Uploads by the candidate
  on their page show `uploadedBy` "Candidate (online)".
- **What it does:** lists the candidate's documents, deleted ones included (the page shows them under "Deleted").
  Works in every status.
- **Errors:** `400` invalid input · `404 NOT_FOUND` unknown candidate.

### `candidates.documents.upload`
- **HTTP:** `POST /api/rpc/candidates/documents/upload` (multipart) · **Code:** `backend/src/modules/candidates/documents/`
- **Access:** Onboarding: Edit.
- **Scope:** Onboarding Edit covering the candidate (outside the View data access `404`, View only `403`).
- **Input:**

  | Field | Type | Required | Rules |
  |---|---|---|---|
  | `candidateId` | number | yes | candidate must be `ACCEPTED` (a `SIGNED_OFFER_LETTER` also while `OFFERED`) |
  | `type` | document type (see `list`) | yes | several files of one type are allowed (e.g. Aadhaar front + back) |
  | `file` | File | yes | 1 byte - 5 MB; must really be a PDF, JPG or PNG (checked from the content, not the name) |

- **Returns:** the new document (shape of `list`), `verificationStatus: PENDING`.
- **What it does:** stores the file in file storage (`STORAGE_DIR`, random name) and records it.
- **Errors:** `400` invalid input, empty / too big file, or not a PDF / JPG / PNG · `404 NOT_FOUND` unknown candidate ·
  `409 CONFLICT` candidate not `ACCEPTED` (review / delete follow the same status rule) · requests over 6 MB are refused before being read (`413`, or the
  connection is closed) - the frontend should check the 5 MB limit before uploading.

### `candidates.documents.download`
- **HTTP:** `POST /api/rpc/candidates/documents/download` · **Code:** `backend/src/modules/candidates/documents/`
- **Access:** Onboarding: View.
- **Scope:** Onboarding View covering the candidate's company / plant / department (else `404` "No candidate found"); a
  sensitive type also needs its area covering the candidate, as on the employee (2026-11-23): ID / bank copies, EPF Form 11,
  ESIC Form 1 and the signed joining form - Employee · IDs, bank & statutory; medical documents - Employee · Medical; the
  signed forms pack - both; the signed offer letter - Employee · Salary.
- **Input:** `{ id: number }` (document id)
- **Returns:** the file (`File` with the original name and type).
- **What it does:** reads the file from storage. Works in every status.
- **Errors:** `400` invalid input · `403 FORBIDDEN` "This document also needs the ... access" · `404 NOT_FOUND` unknown
  document.

### `candidates.documents.review`
- **HTTP:** `POST /api/rpc/candidates/documents/review` · **Code:** `backend/src/modules/candidates/documents/`
- **Access:** Onboarding: Edit.
- **Scope:** Onboarding Edit covering the candidate (outside the View data access `404`, View only `403`).
- **Input:** `{ id: number, status: 'VERIFIED' | 'REJECTED', rejectionReason?: string }` - the reason (1-500 chars)
  is required for `REJECTED`.
- **Returns:** the document with the new status, `rejectionReason` (cleared when verified), `reviewedAt` and
  `reviewedBy` (the person reviewing).
- **What it does:** records HR's check of the document against the original. Can be changed again before joining.
  When a document **the candidate uploaded** becomes `REJECTED` and their joining-form page is open, the candidate is
  e-mailed (personal e-mail, in the background - a failure is only logged) the document and the reason, and asked to
  upload it again with the link they already have (no new link - it would stop the old one). HR's own uploads, a
  second rejection of the same document, and a document the candidate has already replaced (a newer copy of the same
  type that is not rejected) send nothing.
- **Errors:** `400` invalid input or no reason for `REJECTED` · `404 NOT_FOUND` · `409 CONFLICT` candidate not `ACCEPTED`
  (the signed offer letter: not `OFFERED` / `ACCEPTED`), or the document is deleted (restore it first).

### `candidates.documents.delete`
- **HTTP:** `POST /api/rpc/candidates/documents/delete` · **Code:** `backend/src/modules/candidates/documents/`
- **Access:** Onboarding: Edit.
- **Scope:** Onboarding Edit covering the candidate (outside the View data access `404`, View only `403`).
- **Input:** `{ id: number, reason: string }` - the reason is required (1-500 chars, e.g. "wrong file").
- **Returns:** the document (as in `list`) with `isDeleted: true`, `deletedAt`, `deletedBy` (the person) and
  `deleteReason`.
- **What it does:** deletes a wrong or rejected upload **without erasing it** (decided 2026-11-13): the record and the
  file are kept, it is hidden from the document checks (joining checklist, BGV consent, paper acceptance) and shown
  under "Deleted" with who, when and why. `restore` brings it back. A verified document cannot be deleted (reject it
  first).
- **Errors:** `400` invalid input or no reason · `404 NOT_FOUND` · `409 CONFLICT` document verified or already
  deleted, or candidate not `ACCEPTED` (the signed offer letter: not `OFFERED` / `ACCEPTED`).

### `candidates.documents.restore`
- **HTTP:** `POST /api/rpc/candidates/documents/restore` · **Code:** `backend/src/modules/candidates/documents/`
- **Access:** Onboarding: Edit.
- **Scope:** Onboarding Edit covering the candidate (outside the View data access `404`, View only `403`).
- **Input:** `{ id: number }`
- **Returns:** the document (as in `list`) with `isDeleted: false` and the delete details cleared.
- **What it does:** brings back a document deleted by mistake; it counts in the checks again, with its review as it
  was. Same status rules as `delete`.
- **Errors:** `400` invalid input · `404 NOT_FOUND` · `409 CONFLICT` the document is not deleted, or candidate not
  `ACCEPTED` (the signed offer letter: not `OFFERED` / `ACCEPTED`).

### `candidates.documents.requirements`
- **HTTP:** `POST /api/rpc/candidates/documents/requirements` · **Code:** `backend/src/modules/candidates/documents/`
- **Access:** Onboarding: View.
- **Scope:** not limited by data access - a fixed list of document rules, no person's data.
- **Input:** none.
- **Returns:** `{ compulsory: { REGULAR, CONSULTANT_INTERN, OVERSEAS }: DocumentType[], requestable: [{ type, label }] }` -
  `compulsory`: what each joining-form pack always needs (`ESIC_FORM_1` only when ESIC applies); `requestable`: what an
  offer may ask for on top (`candidates.create` / `update` `extraRequiredDocuments`): `PASSPORT_COPY`,
  `CLASS_X_MARKSHEET`, `CLASS_XII_MARKSHEET`, `GRADUATION_CERTIFICATE`, `POST_GRADUATION_CERTIFICATE`,
  `EDUCATION_CERTIFICATE` (other), `EXPERIENCE_LETTER`, `DRIVING_LICENCE_COPY`, `POLICE_VERIFICATION`.
- **What it does:** the offer form's "Documents needed" checklist (2026-11-20): the compulsory ones ticked and locked,
  the others to tick.
- **Errors:** none beyond access.

### `candidates.recordMedical`
- **HTTP:** `POST /api/rpc/candidates/recordMedical` · **Code:** `backend/src/modules/candidates/`
- **Access:** Onboarding: Edit.
- **Scope:** Onboarding Edit covering the candidate (outside the View data access `404`, View only `403`).
- **Input:**

  | Field | Type | Required | Rules |
  |---|---|---|---|
  | `id` | number | yes | candidate must be `ACCEPTED` |
  | `result` | `FIT` / `FIT_WITH_RESTRICTIONS` / `UNFIT` | yes | |
  | `examDate` | Date | yes | not in the future |
  | `examiner` | string | yes | doctor / clinic, 1-200 chars |
  | `restrictions` | string | for `FIT_WITH_RESTRICTIONS` | 1-500 chars, e.g. "no work at height"; not stored for other results |

- **Returns:** the candidate (with the medical fields).
- **What it does:** records the pre-employment medical; a re-examination replaces it. The filled medical form is
  uploaded separately as a `MEDICAL_FORM` document. `UNFIT` does not withdraw the offer - HR decides. Joining
  (`candidates.joining.complete`) needs `FIT` or `FIT_WITH_RESTRICTIONS` for the Regular and Consultant & Intern packs, not for Overseas.
- **Errors:** `400` invalid input, exam date in the future, or no restrictions · `404 NOT_FOUND` · `409 CONFLICT`
  candidate not `ACCEPTED`. Â· `409` "This offer was changed a moment ago" - the status changed since it was read (a candidate's answer and HR's change at the same moment - 2026-11-23)

### `candidates.confirmJoining`
- **HTTP:** `POST /api/rpc/candidates/confirmJoining` · **Code:** `backend/src/modules/candidates/`
- **Access:** Onboarding: Edit.
- **Scope:** Onboarding Edit covering the candidate (outside the View data access `404`, View only `403`).
- **Input:** `{ id: number }`
- **Returns:** the candidate, `joiningConfirmedAt` set.
- **What it does:** records that HR called the candidate before the joining date and they confirmed. Moving the
  joining date (`candidates.update`) clears it, so the new date must be confirmed again.
- **Errors:** `404 NOT_FOUND` · `409 CONFLICT` candidate not `ACCEPTED`, or the joining date is today or past. Â· `409` "This offer was changed a moment ago" - the status changed since it was read (a candidate's answer and HR's change at the same moment - 2026-11-23)

### `candidates.joining.checklist`
- **HTTP:** `POST /api/rpc/candidates/joining/checklist` · **Code:** `backend/src/modules/candidates/joining/`
- **Access:** Onboarding: View.
- **Scope:** Onboarding View covering the candidate's company / plant / department (else `404` "No candidate found").
- **Input:** `{ candidateId: number }`
- **Returns:** `{ ready: boolean, items: [{ key, label, ok, detail, who, required }], nextEmployeeCode }` - `required`:
  joining waits for it (as the old HRMS, 2026-11-16: everything except the medical result and the verified documents,
  which are shown as reminders); `ready` = every required item done. `nextEmployeeCode`: the
  code the employee will get (the next of the company's series), null when the series is not set; `detail` says what is missing (for HR's
  items, what to do); `who` is `CANDIDATE` (joining form, their own document copies) or `HR` (the medical result and the
  forms signed on paper on the joining day - 2026-11-15).
- **What it does:** what must be done before joining (decided 2026-11-12):
  - offer `ACCEPTED`;
  - a department chosen (HR, 2026-11-19 - every employee has one; the offer may be made without one);
  - joining form: gender and date of birth; permanent and present address (every joining type - 2026-11-14); an emergency contact;
    at least one qualification (every joining type - key `education`, 2026-11-15; certifications and previous jobs are optional);
    at least one family member (key `family`) and the nominees (key `nominees`): a joining-form (`GENERAL`) nominee for every
    joining type, plus for Regular a `GRATUITY` nominee and - when ESIC applies - an `ESIC` nominee (2026-11-15);
    the family check also passes with `noFamilyMembers` ticked, unless the personal details say married;
    Regular gratuity nominees must be in the family details as a Gratuity-Act family member (husband / wife, child,
    dependent parent, a married woman's husband's dependent parent, or "Other") whenever the worked-out "no family" is
    false - `detail` says per nominee why, and which answer to change;
    Regular: the Gratuity Form F declarations (key `gratuity`) - "parents not dependent" answered, and for a married woman
    "husband's parents not dependent" (2026-11-15);
    Aadhaar + PAN (Regular, Consultant & Intern) or passport (Overseas); salary bank account; PF / ESIC answers
    (Regular - when Form 11 is to show the spouse's name, a spouse's name in the personal details; the previous PF exit
    and first EPF enrolment dates not in the future, the enrolment not after the exit, and "member before 1 Sep 2014"
    agreeing with the enrolment date - 2026-11-15); when the candidate has an e-mail address: **submitted and signed online by the candidate**
    (`portal.submit`, key `signed` - 2026-11-13; without an e-mail only the paper signature);
  - joining form: the medical information (Regular and Consultant & Intern - key `medicalInfo`, 2026-11-15);
  - medical result Fit / Fit with restrictions (not for Overseas) - **shown, not required** (2026-11-16);
  - documents uploaded **and verified** - **shown, not required** (2026-11-16) (deleted ones do not count): all packs Photo + Signed joining form; Regular + EPF Form 11, ESIC Form 1
    (only if ESIC applies), Gratuity Form F, Aadhaar copy, PAN copy, Bank proof, Medical form; Consultant & Intern +
    Aadhaar copy, PAN copy, Bank proof, Medical form; Overseas + Passport copy; plus the offer's own
    `extraRequiredDocuments` (2026-11-20). A verified `SIGNED_FORMS_PACK` (one scan
    of the whole signed print, 2026-11-15) counts for every paper form - signed joining form, EPF Form 11, ESIC Form 1,
    Gratuity Form F, Medical form (`detail` "In the signed forms pack"); each may still be uploaded on its own.
  - the company's employee code series is set (key `employeeCodeSeries`, `who` HR - 2026-11-16);
  - Background checks are **not** required.
- **Errors:** `400` invalid input · `404 NOT_FOUND` unknown candidate.

### `candidates.joining.complete`
- **HTTP:** `POST /api/rpc/candidates/joining/complete` · **Code:** `backend/src/modules/candidates/joining/`
- **Access:** Onboarding: Edit.
- **Scope:** Onboarding Edit covering the candidate (outside the View data access `404`, View only `403`).
- **Input:**

  | Field | Type | Required | Rules |
  |---|---|---|---|
  | `candidateId` | number | yes | |
  | `reportingManagerCode` | string | no | who the new employee reports to - an employee who has not left (2026-11-16) |
  | `holidayListId` | number | no | the holiday list followed from `dateOfJoining` (2026-11-24 - the plant's default offered on the page): in use, of the candidate's company or of every company; left out = no list, no holidays until HR gives one |
  | `dateOfJoining` | Date | yes | not in the future; before the contract end date |
  | `workEmail` | string | no | e-mail, lower-cased, unique |
  | `probationEndDate` | Date | no | after `dateOfJoining` |
  | `taskAssignees` | `{ taskTypeId, assigneeCode }[]` | no | who does each joining task (2026-11-16); each a holder of the task's team role whose data access covers the new employee (2026-11-20); a task left out goes to its default person (if they qualify) |
  | `skipTaskTypeIds` | number[] | no | the joining tasks HR unticked - not needed for this employee (2026-11-20); each must be one of the joining type's active task types; all of them may be left out |
  | `noJoiningTasks` | boolean | no | HR confirms the employee gets no joining tasks (2026-11-20) - required when no task type applies to the joining type, refused when one does |

- **Returns:** `{ employeeCode, candidate, login, appointmentLetter, joiningTasks }` (candidate shape, now `JOINED`;
  `login` below; `appointmentLetter` `{ issued: true, letterNumber, emailedTo }` or `{ issued: false, reason }`;
  `joiningTasks` how many were made).
- **What it does:** the joining day, in one transaction: creates the employee (status `ACTIVE`, the code the next of the
  company's series - no longer typed by HR, 2026-11-16 - the reporting manager, and the HOD post: their plant + department, 2026-11-19; the holiday list chosen, from the date of joining - 2026-11-24) from the offer terms
  and the joining-form draft (a permanent employee gets no contract end date) - the name and mobile as in the form (else the offer's), the alternate mobile, addresses, emergency contacts, identity documents and bank account (numbers
  encrypted, with last 4 digits and fingerprint), PF / ESIC answers, education, certifications, previous jobs, family
  members (Aadhaar encrypted + last 4) and nominees, and the joining record (`completedBy` = this HR person; the
  candidate's online signature becomes the declaration `declarationAcceptedAt` with the form date); moves the candidate's documents to the employee (review kept, deleted ones too; each file is copied to
  `employees/<code>/<type>/` and the candidate's copy removed once saved); marks the candidate `JOINED`, links it
  to the employee and deletes the encrypted draft (the data now lives in the employee records); the candidate's
  background checks get the employee (`employeeId`, 2026-11-15 - they may still be running); the employee also gets
  the offer's `salutation` and notice periods, and the joining record the pre-employment medical result; the offer's
  salary (annual fixed CTC, performance pay, currency) and monthly breakup become the employee's first salary,
  effective from the date of joining (`employee_salaries` / `employee_salary_lines`, 2026-11-15).
- **Login (2026-11-15):** in the same transaction the employee gets a login with a temporary password (changed at
  the first sign-in); after it is saved, the employee code, the temporary password and the sign-in address are
  e-mailed to the personal e-mail. The result also has `login: { emailedTo, temporaryPassword }` - `emailedTo` the
  masked address it went to; when there is no personal e-mail, the e-mail failed, or there is no mail server (only
  saved in the outbox folder - 2026-11-23, before it was wrongly reported as e-mailed), `emailedTo` is null and
  `temporaryPassword` is given (shown to HR once, to hand over).
- **Joining tasks (2026-11-16, rules 2026-11-20):** checked before anything is saved: every active task type for the
  joining type (`joiningTasks.types.*`) that HR did not leave out (`skipTaskTypeIds`) must go to a holder of its team role
  whose data access covers the new employee - the person HR picked (`taskAssignees`), else the type's default person; no
  task may be left without a person. Leaving out every task is allowed. When no task type applies at all, HR must send
  `noJoiningTasks: true`. In the same transaction the tasks are made, due from the date of
  joining.
- **Appointment letter (2026-11-16):** after the joining is saved, the appointment letter is issued from the suggested
  ready appointment letter template and e-mailed (`employeeLetters.issue`); it never stops the joining - without a ready
  template (or on an error) `appointmentLetter.reason` says why, and HR issues it later from the profile.
- **Errors:** `400` the checklist is not complete (lists what is missing), a date rule, the reporting manager is
  unknown / has left, a joining task without a person (or nobody of its role covers the employee), a picked person not
  of the task's role covering the employee, a left-out task that is not one of the joining type's, `noJoiningTasks` missing
  with no task type / sent when there are some, a retired holiday list or another company's (2026-11-24) · `404 NOT_FOUND` (also an
  unknown holiday list) · `409 CONFLICT` candidate not `ACCEPTED`, work e-mail / identity number already used. Â· `409` "This offer was changed a moment ago" - the status changed since it was read (a candidate's answer and HR's change at the same moment - 2026-11-23)

### `candidates.backgroundChecks.list`
- **HTTP:** `POST /api/rpc/candidates/backgroundChecks/list` · **Code:** `backend/src/modules/candidates/background-checks/`
- **Access:** Onboarding: View.
- **Scope:** Onboarding View covering the candidate's company / plant / department (else `404` "No candidate found").
- **Input:** `{ candidateId: number }`
- **Returns:** `[{ id, candidateId, employeeId, type, subject, status, vendorName, vendorReference, remarks, completedAt,
  completedBy, createdAt, createdBy, updatedAt, updatedBy }]` (the `...By` fields are persons; `completedBy` = who
  recorded the result; `employeeId` = the employee the check belongs to once the candidate joined - null before),
  in check-type order (IDENTITY, ADDRESS, EDUCATION, EMPLOYMENT, CRIMINAL, REFERENCE), then start time.
- **What it does:** lists the candidate's checks. Works in every status (history).
- **Errors:** `400` invalid input · `404 NOT_FOUND` unknown candidate.

### `candidates.backgroundChecks.create`
- **HTTP:** `POST /api/rpc/candidates/backgroundChecks/create` · **Code:** `backend/src/modules/candidates/background-checks/`
- **Access:** Onboarding: Edit.
- **Scope:** Onboarding Edit covering the candidate (outside the View data access `404`, View only `403`).
- **Input:**

  | Field | Type | Required | Rules |
  |---|---|---|---|
  | `candidateId` | number | yes | candidate must be `ACCEPTED`, with a `BGV_CONSENT_FORM` document that is not rejected |
  | `type` | `IDENTITY` / `ADDRESS` / `EDUCATION` / `EMPLOYMENT` / `CRIMINAL` / `REFERENCE` | yes | several checks of one type are allowed |
  | `subject` | string | no | which item, e.g. "B.Tech, Delhi University", 1-200 chars |
  | `vendorName`, `vendorReference` | string | no | the agency and its case id, 1-100 chars |

- **Returns:** the new check, status `IN_PROGRESS`.
- **What it does:** records that a check was started; after joining it also belongs to the employee (`employeeId`).
- **Errors:** `400` invalid input · `404 NOT_FOUND` · `409 CONFLICT` candidate not `ACCEPTED` / `JOINED`, or no signed
  consent (after joining it is looked for among the employee's documents).

### `candidates.backgroundChecks.update`
- **HTTP:** `POST /api/rpc/candidates/backgroundChecks/update` · **Code:** `backend/src/modules/candidates/background-checks/`
- **Access:** Onboarding: Edit.
- **Scope:** Onboarding Edit covering the check's candidate - or, for a check started for an employee, the employee (`404` / `403`).
- **Input:** `id` (required) plus any of `status` (`IN_PROGRESS` / `CLEAR` / `DISCREPANCY` / `FAILED`), `subject`,
  `vendorName`, `vendorReference`, `remarks` (1-1000 chars). Only the fields sent change; `null` clears a text.
- **Returns:** the updated check.
- **What it does:** records progress or the result. A result sets `completedAt`; back to `IN_PROGRESS` clears it.
  `DISCREPANCY` and `FAILED` need remarks. A `FAILED` check does not act by itself - HR decides (withdraw the offer,
  or the exit process after joining). Allowed while the candidate is `ACCEPTED` or `JOINED`.
- **Errors:** `400` invalid input or no remarks · `404 NOT_FOUND` · `409 CONFLICT` candidate closed.

### `candidates.backgroundChecks.delete`
- **HTTP:** `POST /api/rpc/candidates/backgroundChecks/delete` · **Code:** `backend/src/modules/candidates/background-checks/`
- **Access:** Onboarding: Edit.
- **Scope:** Onboarding Edit covering the check's candidate - or, for a check started for an employee, the employee (`404` / `403`).
- **Input:** `{ id: number }`
- **Returns:** `{ id }`
- **What it does:** removes a check started by mistake. Only while `IN_PROGRESS` - a check with a result stays.
- **Errors:** `400` invalid input · `404 NOT_FOUND` · `409 CONFLICT` check has a result, or candidate closed.

## organization

Masters an employee is placed into. Entries are never deleted - they are retired with `isActive: false` (the
database blocks deleting anything an employee still points to). `list` hides retired entries unless
`includeInactive: true`. The fields of the old HRMS masters were carried over on 2026-11-12 (company registrations,
location state / time zone, grade code / rank, plants, cost centres); its org units were deliberately not.
Companies, plants and departments were then imported from VBMS / SAP (`npm run import:vbms`). "Locations" were
renamed **work locations** (only where people are placed; plants are separate) and made one group-wide list - a
site can be used by several companies.

### `organization.companies.list`
- **HTTP:** `POST /api/rpc/organization/companies/list` · **Code:** `backend/src/modules/organization/companies/`
- **Access:** any logged-in employee; `includeInactive: true` needs Organization: View.
- **Scope:** not limited by data access (one list for every company).
- **Input (optional):** `{ includeInactive?: boolean }` (default `false`)
- **Returns:** `[{ id, code, name, ecodePrefix, nextEmployeeNumber, sapCompanyCode, isIndiaPayroll, address, postalCode, countryCode, region,
  pfEstablishmentCode, esicEmployerCode, pan, tan, gstin, ptRegistrationNo, isActive }]`, sorted by name. (The
  letterhead of letters is on the letter templates - `letterTemplates.uploadImage`.) `address`, `region`, `postalCode`
  and the PF / ESIC codes may be null for a company from the VBMS import until HR fills them in (2026-11-19).
- **What it does:** lists companies of the group.
- **Errors:** `400` invalid input · `403 FORBIDDEN` `includeInactive` without Organization: View.

### `organization.companies.create`
- **HTTP:** `POST /api/rpc/organization/companies/create` · **Code:** `backend/src/modules/organization/companies/`
- **Access:** Organization: Edit.
- **Scope:** shared by every company - needs Organization Edit for **all companies** (`403`).
- **Input:**

  | Field | Type | Required | Rules |
  |---|---|---|---|
  | `code` | string | yes | 1-20 chars, upper-cased, unique (e.g. `RML`) |
  | `name` | string | yes | 1-100 chars, unique |
  | `ecodePrefix` | string | yes | 2-10 letters / digits starting with a letter, upper-cased, unique - start of its employee codes |
  | `nextEmployeeNumber` | number | no | 1-99 999 999 - the number the next system-generated employee code gets (`ecodePrefix` + 6 digits, e.g. 35385 -> `RML035385`); until it is set, no employee can join or be added in the company (2026-11-16) |
  | `sapCompanyCode` | string | no | 2-10 letters / digits, unique - SAP company code, e.g. `1100` |
  | `isIndiaPayroll` | boolean | no | default `true`; `false` for overseas entities (no PF / ESIC / PT / TDS) |
  | `address` | string | **yes** | street / building, 1-500 chars - printed as the employer on Form F / ESIC Form 1 (required since 2026-11-15) |
  | `postalCode` | string | for India | PIN / postal code, 3-12 chars; **an Indian address (country `IN`) needs a 6-digit PIN** (abroad there may be none) |
  | `countryCode` | string | no | 2-letter ISO code, default `IN` |
  | `region` | string | **yes** | state / region name, e.g. `West Bengal`, 1-100 chars |
  | `pfEstablishmentCode` | string | for India payroll | like `WBCAL0012345` (+ optional 3-digit extension); **required when `isIndiaPayroll`** (printed on EPF Form 11) |
  | `esicEmployerCode` | string | for India payroll | 17 digits; **required when `isIndiaPayroll`** (printed on ESIC Form 1) |
  | `pan` | string | no | company PAN, like `AABCR1234K` |
  | `tan` | string | no | like `CALR12345A` |
  | `gstin` | string | no | 15 characters like `19AABCR1234K1Z5`; characters 3-12 must be the PAN |
  | `ptRegistrationNo` | string | no | 4-30 letters, digits, `/` or `-` |

  Registration numbers have spaces removed and are upper-cased before the format check (old HRMS rules).
- **Returns:** the new company (same shape as `list`).
- **What it does:** adds a company (active).
- **Errors:** `400` invalid input, GSTIN not matching the PAN, an Indian address without a 6-digit PIN, or an India
  payroll company without its PF establishment / ESIC employer code · `409 CONFLICT` code, name, e-code prefix or SAP
  company code already exists.

### `organization.companies.update`
- **HTTP:** `POST /api/rpc/organization/companies/update` · **Code:** `backend/src/modules/organization/companies/`
- **Access:** Organization: Edit.
- **Scope:** belongs to one company - needs Organization Edit for that **whole company** (`403`).
- **Input:** `id` (required) plus any field of `create` (same rules) and `isActive` (boolean). Only the fields sent
  are changed; the GSTIN / PAN check uses the stored value of the one not sent, and the PIN / PF / ESIC rules of
  `create` are checked on the company as it will be after the change (e.g. turning `isIndiaPayroll` on needs both codes).
- **Returns:** the updated company.
- **What it does:** changes company details, or retires / re-activates it with `isActive`. The company as it will be
  must have its employer details - address, state / region and the PIN / PF / ESIC rules of `create` - so a company
  from the VBMS import (which may lack them, 2026-11-19) is completed the first time it is saved.
- **Errors:** `400` invalid input, GSTIN not matching the PAN, a missing address / state, or the PIN / PF / ESIC rules of `create` · `404
  NOT_FOUND` unknown id · `409 CONFLICT` code, name or e-code prefix already used.

### `organization.workLocations.list`
- **HTTP:** `POST /api/rpc/organization/workLocations/list` · **Code:** `backend/src/modules/organization/work-locations/`
- **Access:** any logged-in employee; `includeInactive: true` needs Organization: View.
- **Scope:** not limited by data access (one list for every company).
- **Input (optional):** `{ includeInactive?: boolean }`
- **Returns:** `[{ id, name, countryCode, stateCode, timezone, address, postalCode, region {id, name} | null, isActive }]`, sorted by name.
- **What it does:** lists work locations - where employees / candidates are placed. One group-wide list: a site can be
  used by several companies (the employee / offer has its own company). Not linked to plants.
- **Errors:** `400` invalid input · `403 FORBIDDEN` `includeInactive` without Organization: View.

### `organization.workLocations.create`
- **HTTP:** `POST /api/rpc/organization/workLocations/create` · **Code:** `backend/src/modules/organization/work-locations/`
- **Access:** Organization: Edit.
- **Scope:** shared by every company - needs Organization Edit for **all companies** (`403`).
- **Input:**

  | Field | Type | Required | Rules |
  |---|---|---|---|
  | `name` | string | yes | 1-100 chars, unique across the group |
  | `countryCode` | string | no | 2-letter ISO code, default `IN`; non-IN = overseas posting |
  | `stateCode` | string | for `IN` | 2-letter Indian state code, upper-cased (e.g. `WB`) - Professional Tax slab, LWF |
  | `timezone` | string | no | IANA time zone, default `Asia/Kolkata` (e.g. `Asia/Bahrain`) |
  | `address` | string | no | 1-500 chars - street / building (2026-11-19) |
  | `postalCode` | string | no | 3-12 chars; **6 digits for an Indian location** |
  | `regionId` | number | no | an **active region** (`organization.regions.list`) |

- **Returns:** the new location (same shape as `list`).
- **What it does:** adds a work location (usable by every company). An overseas one never keeps a state code.
- **Errors:** `400` invalid input, an Indian location without a state code or with a PIN code that is not 6 digits, or a
  retired / unknown region · `409 CONFLICT` the name already exists.

### `organization.workLocations.update`
- **HTTP:** `POST /api/rpc/organization/workLocations/update` · **Code:** `backend/src/modules/organization/work-locations/`
- **Access:** Organization: Edit.
- **Scope:** shared by every company - needs Organization Edit for **all companies** (`403`).
- **Input:** `id` (required) plus any of `name`, `countryCode`, `stateCode`, `timezone`, `address`, `postalCode`,
  `regionId`, `isActive`; `null` clears `address`, `postalCode` or `regionId`.
- **Returns:** the updated location.
- **What it does:** renames, changes country / state / time zone / address / region, or retires / re-activates a work
  location. Moving it abroad clears its state code. A location made before state codes existed may stay without one
  until its country or state is changed. A PIN code is checked against the country as it will be; a newly chosen region
  must be in use.
- **Errors:** `400` invalid input, an Indian location left without a state code, a PIN code that is not 6 digits, or a
  retired / unknown region · `404 NOT_FOUND` unknown id ·
  `409 CONFLICT` name already used.

### `organization.regions.list`
- **HTTP:** `POST /api/rpc/organization/regions/list` · **Code:** `backend/src/modules/organization/regions/`
- **Access:** any logged-in employee; `includeInactive: true` needs Organization: View.
- **Scope:** not limited by data access (one list for every company).
- **Input (optional):** `{ includeInactive?: boolean }`
- **Returns:** `[{ id, name, isActive }]`, sorted by name.
- **What it does:** lists regions - the parts of the country work locations are grouped under, e.g. East, West (one group-wide list - 2026-11-19).
- **Errors:** `400` invalid input · `403 FORBIDDEN` `includeInactive` without Organization: View.

### `organization.regions.create`
- **HTTP:** `POST /api/rpc/organization/regions/create` · **Code:** `backend/src/modules/organization/regions/`
- **Access:** Organization: Edit.
- **Scope:** shared by every company - needs Organization Edit for **all companies** (`403`).
- **Input:** `{ name: string }` - required, 1-100 chars, unique.
- **Returns:** `{ id, name, isActive }`
- **What it does:** adds a region.
- **Errors:** `400` invalid input · `403` (see Scope) · `409 CONFLICT` name already exists.

### `organization.regions.update`
- **HTTP:** `POST /api/rpc/organization/regions/update` · **Code:** `backend/src/modules/organization/regions/`
- **Access:** Organization: Edit.
- **Scope:** shared by every company - needs Organization Edit for **all companies** (`403`).
- **Input:** `{ id: number, name?: string, isActive?: boolean }`
- **Returns:** `{ id, name, isActive }`
- **What it does:** renames, or retires / re-activates a region. A retired one stays where it is used but is not chosen anew.
- **Errors:** `400` invalid input · `403` (see Scope) · `404 NOT_FOUND` unknown id · `409 CONFLICT` name already used.

### `organization.plants.list`
- **HTTP:** `POST /api/rpc/organization/plants/list` · **Code:** `backend/src/modules/organization/plants/`
- **Access:** any logged-in employee; `includeInactive: true` needs Organization: View.
- **Scope:** not limited by data access (one list for every company).
- **Input (optional):** `{ companyId?: number, includeInactive?: boolean }`
- **Returns:** `[{ id, plantCode, name, address, postalCode, countryCode, region, isActive, company: { id, code, name },
  _count: { departments } }]`, sorted by company name, then plant code. `_count.departments`: how many departments run at it
  (retired links not counted).
- **What it does:** lists plants (SAP plants - salary costs are posted to the GL by plant). Company -> plant -> department
  (2026-11-18): every employee and candidate is placed at a plant of their company. Not linked to work locations.
- **Errors:** `400` invalid input · `403 FORBIDDEN` `includeInactive` without Organization: View.

### `organization.plants.create`
- **HTTP:** `POST /api/rpc/organization/plants/create` · **Code:** `backend/src/modules/organization/plants/`
- **Access:** Organization: Edit.
- **Scope:** belongs to one company - needs Organization Edit for that **whole company** (`403`).
- **Input:**

  | Field | Type | Required | Rules |
  |---|---|---|---|
  | `companyId` | number | yes | an existing company |
  | `plantCode` | string | yes | 2-20 letters, digits, `_` or `-`, upper-cased, unique within the company |
  | `name` | string | yes | 1-100 chars |
  | `address` | string | no | up to 500 chars |
  | `postalCode` | string | no | PIN / postal code, 3-12 chars |
  | `countryCode` | string | no | 2-letter ISO code, default `IN` |
  | `region` | string | no | state / region name as in SAP, e.g. `West Bengal`, `Dubai` |

- **Returns:** the new plant (same shape as `list`).
- **What it does:** adds a plant to a company.
- **Errors:** `400` invalid input · `409 CONFLICT` unknown company, or the plant code already exists in that company.

### `organization.plants.update`
- **HTTP:** `POST /api/rpc/organization/plants/update` · **Code:** `backend/src/modules/organization/plants/`
- **Access:** Organization: Edit.
- **Scope:** belongs to one company - needs Organization Edit for that **whole company** (`403`).
- **Input:** `id` (required) plus any of `plantCode`, `name`, `address`, `postalCode`, `region` (`null` clears these three),
  `countryCode`, `isActive`. The company of a plant cannot be changed.
- **Returns:** the updated plant.
- **What it does:** changes or retires / re-activates a plant. A retired plant can no longer be chosen for an offer or an
  employee; the people already placed there keep it.
- **Errors:** `400` invalid input · `404 NOT_FOUND` · `409 CONFLICT` plant code already used in that company.

### `organization.plants.setDepartments`
- **HTTP:** `POST /api/rpc/organization/plants/setDepartments` · **Code:** `backend/src/modules/organization/plants/`
- **Access:** Organization: Edit.
- **Scope:** belongs to one plant - needs Organization Edit for that **whole plant** (`403`).
- **Input:**

  | Field | Type | Required | Rules |
  |---|---|---|---|
  | `id` | number | yes | the plant |
  | `departmentIds` | number[] | yes | the whole list of departments that run at the plant (up to 500); may be empty |

- **What it does:** sets which departments run at the plant (VBMS PlantDepartment, imported from VBMS 2026-11-18), in one
  transaction: adds the new ones and brings back retired ones that are ticked again; a department left out is **deleted**
  when nobody was ever placed in it there, and **retired** when employees or candidates (current or past) have it, or it
  has HOD history (it is that department's HOD post at the plant - 2026-11-19) or job-timeline entries (2026-11-19) - they keep it, nobody new can be placed in
  it (2026-11-18). An employee's or candidate's newly chosen department must be one
  of their plant's active ones (`organization.departments.list` with `plantId` gives the list).
- **Returns:** `{ added, removed }` - `added` counts new and brought-back links, `removed` deleted and retired ones.
- **Errors:** `400` invalid input · `404 NOT_FOUND` unknown plant · `409 CONFLICT` an unknown department id.

### `organization.costCenters.list`
- **HTTP:** `POST /api/rpc/organization/costCenters/list` · **Code:** `backend/src/modules/organization/cost-centers/`
- **Access:** any logged-in employee; `includeInactive: true` needs Organization: View.
- **Scope:** not limited by data access (one list for every company).
- **Input (optional):** `{ companyId?: number, includeInactive?: boolean }`
- **Returns:** `[{ id, code, name, isActive, company: { id, code, name }, plant: { id, plantCode, name } | null }]`, sorted
  by company name, then code.
- **What it does:** lists SAP cost centres (where an employee's salary cost is booked).
- **Errors:** `400` invalid input · `403 FORBIDDEN` `includeInactive` without Organization: View.

### `organization.costCenters.create`
- **HTTP:** `POST /api/rpc/organization/costCenters/create` · **Code:** `backend/src/modules/organization/cost-centers/`
- **Access:** Organization: Edit.
- **Scope:** belongs to one company - needs Organization Edit for that **whole company** (`403`).
- **Input:**

  | Field | Type | Required | Rules |
  |---|---|---|---|
  | `companyId` | number | yes | an existing company |
  | `code` | string | yes | up to 20 letters, digits, `_` or `-`, upper-cased, unique within the company (e.g. `1701`) |
  | `name` | string | yes | 1-100 chars |
  | `plantId` | number | no | the plant it rolls up into - a plant of the same company |

- **Returns:** the new cost centre (same shape as `list`).
- **What it does:** adds a cost centre to a company.
- **Errors:** `400` invalid input, or a plant of another company · `404 NOT_FOUND` unknown plant · `409 CONFLICT`
  unknown company, or the code already exists in that company.

### `organization.costCenters.update`
- **HTTP:** `POST /api/rpc/organization/costCenters/update` · **Code:** `backend/src/modules/organization/cost-centers/`
- **Access:** Organization: Edit.
- **Scope:** belongs to one company - needs Organization Edit for that **whole company** (`403`).
- **Input:** `id` (required) plus any of `code`, `name`, `plantId` (`null` removes it), `isActive`. The company of a cost
  centre cannot be changed.
- **Returns:** the updated cost centre.
- **What it does:** changes or retires / re-activates a cost centre.
- **Errors:** `400` invalid input or a plant of another company · `404 NOT_FOUND` · `409 CONFLICT` code already used.

### `organization.departments.list`
- **HTTP:** `POST /api/rpc/organization/departments/list` · **Code:** `backend/src/modules/organization/departments/`
- **Access:** any logged-in employee; `includeInactive: true` needs Organization: View.
- **Scope:** not limited by data access (one list for every company).
- **Input (optional):** `{ includeInactive?: boolean, plantId?: number }`
- **Returns:** `[{ id, code, name, isActive }]`, sorted by name.
- **What it does:** lists departments (one group-wide list). With `plantId`: only the departments that run at that plant
  and are not retired there (the list an employee / candidate at that plant can be placed in).
- **Errors:** `400` invalid input · `403 FORBIDDEN` `includeInactive` without Organization: View.

### `organization.departments.create`
- **HTTP:** `POST /api/rpc/organization/departments/create` · **Code:** `backend/src/modules/organization/departments/`
- **Access:** Organization: Edit.
- **Scope:** shared by every company - needs Organization Edit for **all companies** (`403`).
- **Input:** `{ code: string, name: string }` - both required and unique; `code` 1-50 chars as in SAP / VBMS (e.g.
  `ELEC.MAINT`), `name` 1-100 chars.
- **Returns:** `{ id, code, name, isActive }`
- **What it does:** adds a department.
- **Errors:** `400` invalid input · `409 CONFLICT` code or name already exists.

### `organization.departments.update`
- **HTTP:** `POST /api/rpc/organization/departments/update` · **Code:** `backend/src/modules/organization/departments/`
- **Access:** Organization: Edit.
- **Scope:** shared by every company - needs Organization Edit for **all companies** (`403`).
- **Input:** `{ id: number, code?: string, name?: string, isActive?: boolean }`
- **Returns:** `{ id, code, name, isActive }`
- **What it does:** changes code / name, or retires / re-activates a department.
- **Errors:** `400` invalid input · `404 NOT_FOUND` unknown id · `409 CONFLICT` code or name already used.

### `organization.designations.list`
- **HTTP:** `POST /api/rpc/organization/designations/list` · **Code:** `backend/src/modules/organization/designations/`
- **Access:** any logged-in employee; `includeInactive: true` needs Organization: View.
- **Scope:** not limited by data access (one list for every company).
- **Input (optional):** `{ includeInactive?: boolean }`
- **Returns:** `[{ id, name, isActive }]`, sorted by name.
- **What it does:** lists designations (one group-wide list).
- **Errors:** `400` invalid input · `403 FORBIDDEN` `includeInactive` without Organization: View.

### `organization.designations.create`
- **HTTP:** `POST /api/rpc/organization/designations/create` · **Code:** `backend/src/modules/organization/designations/`
- **Access:** Organization: Edit.
- **Scope:** shared by every company - needs Organization Edit for **all companies** (`403`).
- **Input:** `{ name: string }` - required, 1-100 chars, unique.
- **Returns:** `{ id, name, isActive }`
- **What it does:** adds a designation.
- **Errors:** `400` invalid input · `409 CONFLICT` name already exists.

### `organization.designations.update`
- **HTTP:** `POST /api/rpc/organization/designations/update` · **Code:** `backend/src/modules/organization/designations/`
- **Access:** Organization: Edit.
- **Scope:** shared by every company - needs Organization Edit for **all companies** (`403`).
- **Input:** `{ id: number, name?: string, isActive?: boolean }`
- **Returns:** `{ id, name, isActive }`
- **What it does:** renames, or retires / re-activates a designation.
- **Errors:** `400` invalid input · `404 NOT_FOUND` unknown id · `409 CONFLICT` name already used.

### `organization.grades.list`
- **HTTP:** `POST /api/rpc/organization/grades/list` · **Code:** `backend/src/modules/organization/grades/`
- **Access:** any logged-in employee; `includeInactive: true` needs Organization: View.
- **Scope:** not limited by data access (one list for every company).
- **Input (optional):** `{ includeInactive?: boolean }`
- **Returns:** `[{ id, code, name, rank, isActive }]`, sorted by rank (most senior first), then name.
- **What it does:** lists grades / levels (one group-wide list).
- **Errors:** `400` invalid input · `403 FORBIDDEN` `includeInactive` without Organization: View.

### `organization.grades.create`
- **HTTP:** `POST /api/rpc/organization/grades/create` · **Code:** `backend/src/modules/organization/grades/`
- **Access:** Organization: Edit.
- **Scope:** shared by every company - needs Organization Edit for **all companies** (`403`).
- **Input:** `{ code: string, name: string, rank: number }` - all required; `code` up to 20 letters, digits, `_` or `-`,
  upper-cased, unique (e.g. `M1`); `name` 1-100 chars, unique; `rank` whole number 0-999 (seniority order, lower =
  more senior - as the old HRMS, 2026-11-16).
- **Returns:** `{ id, code, name, rank, isActive }`
- **What it does:** adds a grade.
- **Errors:** `400` invalid input · `409 CONFLICT` code or name already exists.

### `organization.grades.update`
- **HTTP:** `POST /api/rpc/organization/grades/update` · **Code:** `backend/src/modules/organization/grades/`
- **Access:** Organization: Edit.
- **Scope:** shared by every company - needs Organization Edit for **all companies** (`403`).
- **Input:** `{ id: number, code?: string, name?: string, rank?: number, isActive?: boolean }` (rules as `create`)
- **Returns:** `{ id, code, name, rank, isActive }`
- **What it does:** changes, or retires / re-activates a grade.
- **Errors:** `400` invalid input · `404 NOT_FOUND` unknown id · `409 CONFLICT` code or name already used.

### `organization.positions.list`
- **HTTP:** `POST /api/rpc/organization/positions/list` · **Code:** `backend/src/modules/organization/positions/`
- **Access:** any logged-in employee; `includeInactive: true` needs Organization: View.
- **Scope:** not limited by data access (one list for every company).
- **Input (optional):** `{ includeInactive?: boolean }`
- **Returns:** `[{ id, name, isActive }]`, sorted by name.
- **What it does:** lists positions - the post an employee fills, e.g. "Plant Maintenance Engineer", separate from the designation (one group-wide list - 2026-11-19).
- **Errors:** `400` invalid input · `403 FORBIDDEN` `includeInactive` without Organization: View.

### `organization.positions.create`
- **HTTP:** `POST /api/rpc/organization/positions/create` · **Code:** `backend/src/modules/organization/positions/`
- **Access:** Organization: Edit.
- **Scope:** shared by every company - needs Organization Edit for **all companies** (`403`).
- **Input:** `{ name: string }` - required, 1-100 chars, unique.
- **Returns:** `{ id, name, isActive }`
- **What it does:** adds a position.
- **Errors:** `400` invalid input · `403` (see Scope) · `409 CONFLICT` name already exists.

### `organization.positions.update`
- **HTTP:** `POST /api/rpc/organization/positions/update` · **Code:** `backend/src/modules/organization/positions/`
- **Access:** Organization: Edit.
- **Scope:** shared by every company - needs Organization Edit for **all companies** (`403`).
- **Input:** `{ id: number, name?: string, isActive?: boolean }`
- **Returns:** `{ id, name, isActive }`
- **What it does:** renames, or retires / re-activates a position. A retired one stays where it is used but is not chosen anew.
- **Errors:** `400` invalid input · `403` (see Scope) · `404 NOT_FOUND` unknown id · `409 CONFLICT` name already used.

### `organization.salaryComponents.list`
- **HTTP:** `POST /api/rpc/organization/salaryComponents/list` · **Code:** `backend/src/modules/organization/salary-components/`
- **Access:** any logged-in employee; `includeInactive: true` needs Organization: View.
- **Scope:** not limited by data access (one list for every company).
- **Input (optional):** `{ includeInactive?: boolean }`
- **Returns:** `[{ id, name, code, kind, enteredMonthly, cutForUnpaidDays, pfWage, esiWage, taxable, statutoryRole, displayOrder, isActive }]` in breakup order
  (`displayOrder`, then name). `code`: short upper-case code or null (payroll stage 2); `enteredMonthly`: typed each
  month in payroll, never a breakup line (payroll stage 2); `cutForUnpaidDays`: an earning of the breakup is cut for a
  pay run's unpaid days (true) or paid in full for every day in the company (payroll stage 3); `pfWage` / `esiWage` /
  `taxable`: an earning counts for PF wages / ESI wages / income tax, `statutoryRole`: the statutory amount a deduction or
  employer contribution carries in a pay run, one component per role (payroll stage 4). `kind`:
  `EARNING` (adds up to the Monthly Gross), `EMPLOYER_CONTRIBUTION` (PF / ESI / gratuity paid on top - part of the
  CTC, not of the gross) or `DEDUCTION` (taken out of the monthly pay by payroll - never a line of a salary breakup;
  2026-11-24).
- **What it does:** the lines an offer's salary breakup is made of (seeded with the 12 lines of the RML offer letter
  Annexure-I), and the payslip's deductions (seeded 2026-11-24: Employee PF, Professional Tax, Canteen Recovery). One
  group-wide list; payroll will reuse it. The offer / salary forms offer only earnings and employer contributions.
- **Errors:** `400` invalid input · `403 FORBIDDEN` `includeInactive` without Organization: View.

### `organization.salaryComponents.create`
- **HTTP:** `POST /api/rpc/organization/salaryComponents/create` · **Code:** `backend/src/modules/organization/salary-components/`
- **Access:** Organization: Edit.
- **Scope:** shared by every company - needs Organization Edit for **all companies** (`403`).
- **Input:** `{ name: string (1-100, unique), kind: 'EARNING' | 'EMPLOYER_CONTRIBUTION' | 'DEDUCTION', displayOrder: number
  (0-999), code?: string | null (capital letters, digits and _, starting with a letter, at most 30; unique),
  enteredMonthly?: boolean (default false), cutForUnpaidDays?: boolean (default true; only used for earnings of the
  breakup), pfWage?: boolean (default false), esiWage?: boolean (default true), taxable?: boolean (default true),
  statutoryRole?: 'PF_EMPLOYEE' | 'ESIC_EMPLOYEE' | 'PROFESSIONAL_TAX' | 'LWF_EMPLOYEE' | 'INCOME_TAX' | 'PF_EMPLOYER' | 'EPS'
  | 'EDLI' | 'ESIC_EMPLOYER' | 'LWF_EMPLOYER' | null (unique) }`
- **Returns:** the new component.
- **Errors:** `400` invalid input, `enteredMonthly` on an employer contribution, or a statutory role that does not fit
  (employee roles are deductions, employer roles employer contributions; income tax is entered monthly, the others never
  are) · `409 CONFLICT` name, code or statutory role already used.

### `organization.salaryComponents.update`
- **HTTP:** `POST /api/rpc/organization/salaryComponents/update` · **Code:** `backend/src/modules/organization/salary-components/`
- **Access:** Organization: Edit.
- **Scope:** shared by every company - needs Organization Edit for **all companies** (`403`).
- **Input:** `{ id: number, name?, kind?, displayOrder?, isActive?: boolean, code?: string | null, enteredMonthly?:
  boolean, cutForUnpaidDays?: boolean, pfWage?, esiWage?, taxable?, statutoryRole? }` (rules as `create`; a change counts
  in a draft pay run the next time its pay is worked out)
- **Returns:** the component.
- **What it does:** changes, or retires / re-activates a component. A retired one stays on the offers that use it but
  cannot be added to an offer. A component cannot change between `DEDUCTION` and the other two kinds (2026-11-24) - the
  earnings and employer contributions sit on salary breakups, a deduction never does. For the same reason
  `enteredMonthly` can be switched only on a deduction; an earning keeps what it was added with (payroll stage 2).
- **Errors:** `400` invalid input, `kind` changed to / from `DEDUCTION`, or `enteredMonthly` changed on an earning / set
  on an employer contribution · `404 NOT_FOUND` unknown id · `409 CONFLICT` name or code already used.

### `organization.salaryStructures.list`
- **HTTP:** `POST /api/rpc/organization/salaryStructures/list` · **Code:** `backend/src/modules/organization/salary-structures/`
- **Access:** any logged-in employee (the offer form lets HR pick a structure - 2026-11-24); `includeInactive: true` needs
  Organization: View.
- **Scope:** not limited by data access (one list for every company - no one's records).
- **Input (optional):** `{ includeInactive?: boolean }`
- **Returns:** `[{ id, name, joiningType, employmentType, workforceCategory (each null = any), basicComponentId, isActive,
  lines [{ salaryComponentId, method, value (number | null), minimumBase, onlyIfGrossAtMost, salaryComponent {id, name,
  kind, isActive} }] }]` by name; lines in breakup order. `method`: `PERCENT_OF_CTC` / `PERCENT_OF_GROSS` /
  `PERCENT_OF_BASIC` (value = %) · `FIXED` (value = monthly amount) · `BALANCE` (what is left; no value).
- **What it does:** how an offer's salary breakup is worked out from its CTC, one structure per type of employee (the
  user, 2026-11-24 - HR's "CTC Structure" sheet). Seeded: "Regular - White collar" and "Regular - Blue collar" (Regular
  offers: Permanent / Contract) - Basic 50% of gross, HRA 50% and bonus 8.33% of Basic (minimum base 7,000), education
  200 + medical 1,250 (white collar only), employer PF 12% and gratuity 4.81% of Basic, employer ESI 3.25% of the gross
  while the gross is at most 21,000, special allowance the balance; "Trainee" (Consultant & Intern trainees) - the whole
  CTC as stipend.
- **Errors:** `400` invalid input · `403 FORBIDDEN` `includeInactive` without Organization: View.

### `organization.salaryStructures.create`
- **HTTP:** `POST /api/rpc/organization/salaryStructures/create` · **Code:** `backend/src/modules/organization/salary-structures/`
- **Access:** Organization: Edit.
- **Scope:** shared by every company - needs Organization Edit for **all companies** (`403`).
- **Input:**
  | Field | Type | Required | Rules |
  |---|---|---|---|
  | `name` | string | yes | 1-100, unique |
  | `joiningType` / `employmentType` / `workforceCategory` | enum \| null | no | which offers it is for; empty = any. Two **active** structures never have the same three (`409`) |
  | `basicComponentId` | number \| null | when a line is `PERCENT_OF_BASIC` | one of its lines, not the balance nor itself a "% of Basic" |
  | `lines` | `[{ salaryComponentId, method, value?, minimumBase?, onlyIfGrossAtMost? }]` | yes (1-50) | each component once, active, not a `DEDUCTION`; exactly one `BALANCE`, an earning, with no value / condition; every other line a value (up to 2 decimals; a % at most 100); `minimumBase` only on a percentage |
- **Returns:** the structure (as in `list`).
- **Errors:** `400` the rules above · `403` not for all companies · `409 CONFLICT` name used, or another active structure
  for the same offers.

### `organization.salaryStructures.update`
- **HTTP:** `POST /api/rpc/organization/salaryStructures/update` · **Code:** `backend/src/modules/organization/salary-structures/`
- **Access:** Organization: Edit.
- **Scope:** shared by every company - needs Organization Edit for **all companies** (`403`).
- **Input:** `{ id: number, name?, joiningType?, employmentType?, workforceCategory?, basicComponentId?, lines?, isActive?:
  boolean }` (rules as `create`; `lines` given = the whole new list).
- **What it does:** changes a structure - e.g. HRA from 50% to 40% of Basic. Offers already made keep their amounts; new
  offers use the new rules. Retiring one (`isActive: false`) lets offers of its kind be typed by hand again.
- **Returns:** the structure.
- **Errors:** `400` the rules of `create` · `403` · `404 NOT_FOUND` unknown id · `409 CONFLICT` as `create`.

### `organization.salaryStructures.calculate`
- **HTTP:** `POST /api/rpc/organization/salaryStructures/calculate` · **Code:** `backend/src/modules/organization/salary-structures/`
- **Access:** any logged-in employee (the offer and salary forms).
- **Scope:** not limited by data access - a calculation; it returns no one's records.
- **Input:** `{ annualCtc: int (1 - 240 crore), joiningType, employmentType, workforceCategory }` (the offer's - the
  closest structure is used), or `{ annualCtc, structureId }` (the structure HR chose on the offer in place of the match -
  2026-11-24; an active one), or `{ annualCtc, draft: { basicComponentId?, lines } }` (a structure being edited - its live
  example).
- **Returns:** `{ structure: { id, name } | null, monthlyCtc, balanceComponentId (the BALANCE line's component, or null),
  lines: [{ salaryComponentId, monthlyAmount }] }` -
  `monthlyCtc` = annualCtc / 12 to the paisa; the lines add up to it exactly. No structure for the offer: `structure:
  null, lines: []` (HR types the breakup).
- **What it does:** picks the active structure closest to the offer (a given employment type counts most, then the joining
  type, then the category), works out the Monthly Gross from the CTC less the employer contributions, drops a line whose
  "only if the gross is at most" fails (ESIC above 21,000) and works it out again, rounds every line to the paisa - never to
  the rupee (the user, 2026-11-24: stored paise can be shown rounded later, rounded amounts cannot be undone) - the "% of
  Basic" ones from the Basic so rounded, and gives the balance line what is left.
- **Errors:** `400` invalid input, a draft breaking the rules of `create`, or a CTC too low for the structure (its other
  lines come to more than the monthly CTC) · `404 NOT_FOUND` `structureId` unknown or retired.

---

## letterTemplates

The wording of the letters the system writes, by `kind` (2026-11-16): to candidates - `LETTER_OF_INTENT`,
`OFFER_LETTER` (`candidates.send`); to employees - `APPOINTMENT_LETTER` (issued automatically on the joining day),
`CONFIRMATION_LETTER`, `EXPERIENCE_LETTER`, `RELIEVING_LETTER`, `SALARY_CERTIFICATE` (`employeeLetters.issue`). Each kind has its own fields
and blocks (`letterTemplates.kinds`). HR edits it on the "Letter templates" pages (`/letter-templates/<id>`) in a page-like editor (TipTap). A
template is a complete letter: wording **and letterhead** (header, footer, stamp + signature images -
`letterTemplates.uploadImage`), e.g. "RML offer letter". HR picks the template when sending an offer
(`candidates.send`); its `joiningType` only pre-selects it, and any number of templates can be active. Seeded with the
wording of the RML appointment letter (Oct 2025). Letters already sent never change (stored as PDFs).

**The letter document** (`body`): the editor's rich-text JSON (TipTap shape `{ type, attrs?, content?, text?, marks? }`).
Allowed nodes: `doc`, `paragraph` (`attrs.textAlign` left / center / right / justify), `text` (marks `bold`, `italic`,
`underline`, and `textStyle` with `attrs.fontFamily` one of the WordCraft open fonts `Carlito`, `Caladea`, `Arimo`, `Tinos`,
`Cousine`, `Inter`, `"Source Sans 3"`, `"Source Serif 4"`, `"JetBrains Mono"` (quoted as stored) and `attrs.fontSize`
1 - 400 pt with at most one decimal, e.g. `10.7pt` - without them the default Roboto 10 pt; only Roboto prints ₹), `hardBreak`, `orderedList` / `bulletList` / `listItem` (a list inside an item = sub-points 4.1, 4.2),
`splitLine` (two paragraphs on one line, left and right - e.g. Ref ... Date), `pageBreak`, `field` (`attrs.name`: a
candidate detail, list in `placeholders`) and `letterBlock` (`attrs.name`: `ctc_table` the Annexure-I salary breakup,
`signature` the company's stamp + signature - list in `blocks`). Anything else is refused (`400`). A field marked
`optional` (the e-mail) with no value takes its line out; an unknown font or size is refused (`400`); any other empty field stops the letter with "The letter
needs: ...". Templates saved before the editor existed held text with `{{placeholders}}`; they are converted when read
and stored as a document when saved again. A table (the salary table) is kept on one page - if it does not fit below
the text it starts on the next page. Layout: `backend/src/core/pdf/letter-pdf.ts`.

### `letterTemplates.list`
- **HTTP:** `POST /api/rpc/letterTemplates/list` · **Code:** `backend/src/modules/letter-templates/`
- **Access:** Letter templates: View.
- **Scope:** not limited by data access (the letters are the same for every company).
- **Input:** none
- **Returns:** `[{ id, kind, joiningType, name, images { header, footer, signature }, imageIds { header, footer,
  signature }, ready, isActive, updatedAt, updatedBy, placeholders: [{ name, label, optional? }], blocks: [{ name,
  label, example }] }]` (without the letter), by kind and name. `images` says which letterhead images the template has
  (booleans), `imageIds` which ones (`null` = none; show one with `letterTemplates.image`); `ready` = all three (offers
  can be sent with it).
  `example` is, for a table block (`ctc_table`), the example table the preview PDF prints -
  `{ kind: 'table', widths: (points | '*')[], rows: [[{ text, bold?, align?, colSpan?, shaded? }]] }` - so the editor
  can show it on the page; `null` for other blocks.
- **Errors:** `403 FORBIDDEN`.

### `letterTemplates.kinds`
- **HTTP:** `POST /api/rpc/letterTemplates/kinds` · **Code:** `backend/src/modules/letter-templates/`
- **Access:** Letter templates: View.
- **Scope:** not limited by data access.
- **Input:** none
- **Returns:** `[{ kind, placeholders: [{ name, label, optional? }], blocks: [{ name, label, example }] }]` - every kind
  of letter with the fields and blocks its templates may use (as in `list`).
- **What it does:** what the editor offers for a new template of a kind (`/letter-templates/new?kind=...`).
- **Errors:** `403 FORBIDDEN`.

### `letterTemplates.get`
- **HTTP:** `POST /api/rpc/letterTemplates/get` · **Code:** `backend/src/modules/letter-templates/`
- **Access:** Letter templates: View.
- **Scope:** not limited by data access (the letters are the same for every company).
- **Input:** `{ id: number }`
- **Returns:** `{ id, kind, joiningType, name, body (the letter document), images, imageIds, ready, isActive, createdAt,
  createdBy, updatedAt, updatedBy, placeholders, blocks }` (`images` / `imageIds` and `blocks` with their `example`, as
  in `list`)
- **Errors:** `400` invalid input · `404 NOT_FOUND`.

### `letterTemplates.create`
- **HTTP:** `POST /api/rpc/letterTemplates/create` · **Code:** `backend/src/modules/letter-templates/`
- **Access:** Letter templates: Edit.
- **Scope:** shared by every company - needs Letter templates Edit for **all companies** (`403`).
- **Input:** `{ kind: LetterKind, joiningType?: JoiningType, name: string (1-100, unique), body: letter document
  (not empty), imageIds?: { header?: number, footer?: number, signature?: number } }` - letterhead images picked from
  the ones uploaded before (`letterTemplates.images`); each must be of its part.
- **Returns:** the template (shape of `get`), active.
- **Errors:** `400` invalid input (an unknown node / mark, an empty letter), a field / block the letter kind does not
  have ("Unknown fields in the letter: ..."), or a picked image of another part · `404 NOT_FOUND` unknown image ·
  `409 CONFLICT` name already used.

### `letterTemplates.update`
- **HTTP:** `POST /api/rpc/letterTemplates/update` · **Code:** `backend/src/modules/letter-templates/`
- **Access:** Letter templates: Edit.
- **Scope:** shared by every company - needs Letter templates Edit for **all companies** (`403`).
- **Input:** `{ id: number, joiningType?: JoiningType | null, name?, body?, isActive?: boolean }` (rules as `create`;
  `joiningType: null` = suggested for none)
- **Returns:** the template.
- **What it does:** changes the wording / name / joining type, or retires / re-activates it. Applies to letters sent
  from now on.
- **Errors:** as `create` · `404 NOT_FOUND`.

### `letterTemplates.preview`
- **HTTP:** `POST /api/rpc/letterTemplates/preview` · **Code:** `backend/src/modules/letter-templates/`
- **Access:** Letter templates: View.
- **Scope:** not limited by data access (a sample, no one's data).
- **Input:** `{ kind: LetterKind, body: letter document, id?: number, imageIds?: { header?, footer?, signature? } }`
- **Returns:** a PDF file.
- **What it does:** the given (possibly unsaved) wording filled with example values, on the letterhead of template
  `id` when given - the template being edited - or, for a template not created yet, on the images picked for it
  (`imageIds`). Missing images are left out; a grey note stands in for the signature. Nothing is stored.
- **Errors:** `400` invalid input or an unknown field / block (as `create`) · `404 NOT_FOUND` unknown template or
  image.

### `letterTemplates.uploadImage`
- **HTTP:** `POST /api/rpc/letterTemplates/uploadImage` (multipart) · **Code:** `backend/src/modules/letter-templates/`
- **Access:** Letter templates: Edit.
- **Scope:** shared by every company - needs Letter templates Edit for **all companies** (`403`).
- **Input:** `{ id: number, part: 'HEADER' | 'FOOTER' | 'SIGNATURE', file: File }` - PNG or JPG (checked from the
  content), up to 2 MB.
- **Returns:** the template (shape of `get`).
- **What it does:** stores one image of the template's letterhead, cut from the printed letterhead: `HEADER` (top of
  every page - logo, registered office, CIN), `FOOTER` (bottom of every page - e.g. factory address), `SIGNATURE`
  (the authorised signatory's stamp + signature, printed at the signature block). It becomes the template's image of
  that part; the previous one is **kept** (never erased - decided 2026-11-13) and can be picked again with `setImage`.
  Each upload is a new letterhead image (`letterTemplates.images`), stored as
  `letter-templates/<template id>-<name>/<part>/<date>_<random>.<ext>`. Offers can be sent with the template once all
  three are there.
- **Errors:** `400` invalid input, empty / too big, or not PNG / JPG · `404 NOT_FOUND` unknown template.

### `letterTemplates.setImage`
- **HTTP:** `POST /api/rpc/letterTemplates/setImage` · **Code:** `backend/src/modules/letter-templates/`
- **Access:** Letter templates: Edit.
- **Scope:** shared by every company - needs Letter templates Edit for **all companies** (`403`).
- **Input:** `{ id: number, part: 'HEADER' | 'FOOTER' | 'SIGNATURE', imageId: number }`
- **Returns:** the template (shape of `get`).
- **What it does:** uses a letterhead image uploaded before (for this or another template) as the template's image of
  that part. One image can serve several templates; the image it replaces is kept.
- **Errors:** `400` invalid input, or the image is of another part · `404 NOT_FOUND` unknown template or image.

### `letterTemplates.images`
- **HTTP:** `POST /api/rpc/letterTemplates/images` · **Code:** `backend/src/modules/letter-templates/`
- **Access:** Letter templates: View.
- **Scope:** not limited by data access.
- **Input:** `{ part: 'HEADER' | 'FOOTER' | 'SIGNATURE' }`
- **Returns:** `[{ id, part, fileName, mimeType, createdAt, uploadedBy, usedBy: [{ id, name }] }]`, newest first -
  `uploadedBy` is a person (`System` for images from before 2026-11-13), `usedBy` the templates using it.
- **What it does:** every image uploaded for that part of a letterhead, for any template - to pick one for a template
  (`setImage`, or `create` with `imageIds`).
- **Errors:** `400` invalid input.

### `letterTemplates.image`
- **HTTP:** `POST /api/rpc/letterTemplates/image` · **Code:** `backend/src/modules/letter-templates/`
- **Access:** Letter templates: View.
- **Scope:** not limited by data access.
- **Input:** `{ imageId: number }` - from a template's `imageIds` or `letterTemplates.images`.
- **Returns:** the image file (its uploaded name and type).
- **Errors:** `400` invalid input · `404 NOT_FOUND` unknown image.

## changeHistory

### `changeHistory.list`
- **HTTP:** `POST /api/rpc/changeHistory/list` · **Code:** `backend/src/modules/change-history/`
- **Access:** Change history: View (checked in the service) - also for one employee's history (`employeeCode`, the profile's
  History tab): Employees View no longer shows it, nor is it shown to the employee themselves (2026-11-21).
- **Scope:** the whole history: Change history View for **all companies** (`403`); one employee's history (`employeeCode`): Change history View covering the employee (else nothing found); a value of a part with its own area (salary, IDs...) only with that area covering the employee (on the whole history: for all companies).
- **Input (optional):**

  | Field | Type | Required | Rules |
  |---|---|---|---|
  | `from`, `to` | Date | no | calendar days, both included |
  | `actorCode` | string | no | who made the changes (employee code) |
  | `employeeCode` | string | no | whose records (employee code) - their records and their sign-ins |
  | `candidateId` | number | no | a candidate's records |
  | `model` | string | no | the kind of record, as in `models` of the answer (e.g. `Employee`) |
  | `action` | `CREATE` \| `UPDATE` \| `DELETE` \| `SIGN_IN` \| `SIGN_IN_FAILED` \| `SIGN_OUT` | no | |
  | `page` | number | no | 1 = first page (default) |
  | `pageSize` | number | no | 1-100, default 50 |

- **Returns:** `{ items: [{ id, at, action, by (person - "Candidate (online)" for the candidate's own pages, "System"
  for scripts and failed sign-ins), source (the API, e.g. "employees.update", or "script:<name>"), model, modelLabel
  (e.g. "Employee", "Login"), recordId, employee (person whose record it is, or null), candidateId, changes: [{ field,
  label (in words, e.g. "Date of joining"), before, after }], details (sign-ins: { employeeCode, reason }), ip }],
  total, page, pageSize, models: [{ value, label }] }`, newest first. Ids are shown as names (company, work location,
  department, designation, grade, plant, cost centre, salary component, role, people); dates as ISO text.
  Values that need an access of their own are `"(hidden)"` without it: employees' salaries (Employee · Salary), health
  data (Employee · Medical), a candidate's offered pay (Onboarding), and (2026-11-16) an employee's personal
  columns, addresses, contacts, education, family and nominees (Employee · Personal), IDs, bank and PF / ESIC
  (Employee · IDs, bank & statutory), documents (Employee · Documents & letters).
- **What it does:** the change history (phase 2, 2026-11-16) - recorded by `core/audit` for every change, never
  changed or deleted.
- **Errors:** `400` invalid input · `403` (see Access). An unknown employee code finds nothing.

### `changeHistory.verify`
- **HTTP:** `POST /api/rpc/changeHistory/verify` · **Code:** `backend/src/modules/change-history/`
- **Access:** Change history: View.
- **Scope:** the whole history - needs Change history View for **all companies** (`403`).
- **Input:** none.
- **Returns:** `{ ok, checked, brokenAt: { id, at } | null }`
- **What it does:** walks the hash chain from the first entry: each entry's fingerprint (SHA-256 of its content and the
  entry before's fingerprint) must match. An entry changed or removed directly in the database breaks the chain there
  (`brokenAt`). (Removing the very last entries leaves no trace in the chain - the database's own backups cover that.)
- **Errors:** `403` (see Access).

---

## employeeLetters

Letters issued to an employee (2026-11-16): `APPOINTMENT_LETTER` (issued automatically on the joining day -
`candidates.joining.complete`), `CONFIRMATION_LETTER`, `EXPERIENCE_LETTER`, `RELIEVING_LETTER`, `SALARY_CERTIFICATE` (on
the employee's request, e.g. for a bank loan - it states the salary in effect with its breakup) (HR for now; later the
experience and relieving letters follow the resignation module's approvals). Written from a template of that kind
(`letterTemplates.*`) with the employee's details (and, for the appointment letter, the current salary breakup),
numbered `<e-code prefix>/<APPT|CONF|EXP|REL|SAL>/<year>/<0001>`, stored as `employees/<code>/<KIND>/<date>_<random>.pdf`
with its SHA-256 - kept exactly as issued - and e-mailed to the work e-mail, else the personal one. Seen on the
profile's Letters tab (and on one's own `/ess/me`).


### `changeHistory.export`
- **HTTP:** `POST /api/rpc/changeHistory/export` · **Code:** `backend/src/modules/change-history/`
- **Access:** as `changeHistory.list`.
- **Scope:** as `changeHistory.list`.
- **Input (optional):** the filters of `changeHistory.list` (`from`, `to`, `actorCode`, `employeeCode`, `candidateId`,
  `model`, `action`) - no paging.
- **Returns:** a file `change-history-YYYY-MM-DD.xlsx` - the matching entries, newest first (up to 20 000), one row per
  changed field: when (server time), what, who, record, record id, whose, field, before, after, the API that made it.
  Values the caller may not see are "(hidden)", as on the page.
- **What it does:** the change history as an Excel file (2026-11-16, inspired by the old HRMS's download).
- **Errors:** `400` · `403`.
- **Review format (2026-11-24):** shared Excel review-report formatting and separate Review notes sheet described above; existing data columns and authorization retained. More than 20,000 matching records returns `400 BAD_REQUEST` with instructions to narrow filters; no silently truncated workbook.

### `employeeLetters.list`
- **HTTP:** `POST /api/rpc/employeeLetters/list` · **Code:** `backend/src/modules/employee-letters/`
- **Access:** own record: any logged-in employee; someone else's: Employee · Directory & job: View + Employee · Documents & letters:
  View (checked in the service).
- **Scope:** one's own record; anyone else's: Employee · Documents & letters View and Employee · Directory & job View covering the employee (else `404`).
- **Input:** `{ employeeCode: string }`
- **Returns:** `[{ id, kind, letterNumber, letterDate, lastWorkingDay, sha256, issuedAt, issuedBy (person), emailedTo }]`,
  newest first (`emailedTo` null: no address, or the e-mail failed).
- **Errors:** `400` · `403 FORBIDDEN` · `404 NOT_FOUND` unknown employee.

### `employeeLetters.download`
- **HTTP:** `POST /api/rpc/employeeLetters/download` · **Code:** `backend/src/modules/employee-letters/`
- **Access:** as `list` (the letter's employee).
- **Scope:** one's own letter; anyone else's: Employee · Documents & letters View and Employee · Directory & job View covering the employee (else `404`).
- **Input:** `{ id: number }`
- **Returns:** the PDF exactly as issued ("Appointment letter RML-APPT-2026-0001.pdf").
- **Errors:** `400` · `403 FORBIDDEN` · `404 NOT_FOUND`.

### `employeeLetters.templates`
- **HTTP:** `POST /api/rpc/employeeLetters/templates` · **Code:** `backend/src/modules/employee-letters/`
- **Access:** Employee · Directory & job: View + Employee · Documents & letters: Edit.
- **Scope:** Employee · Documents & letters Edit covering the employee (`404` outside the data access).
- **Input:** `{ employeeCode: string, kind: 'APPOINTMENT_LETTER' | 'CONFIRMATION_LETTER' | 'EXPERIENCE_LETTER' | 'RELIEVING_LETTER' | 'SALARY_CERTIFICATE' }`
- **Returns:** `{ templates: [{ id, name, joiningType, ready }], suggestedId }` - as `candidates.offerLetters.templates`,
  for the employee's joining type.
- **Errors:** `400` · `403` · `404 NOT_FOUND`.

### `employeeLetters.preview`
- **HTTP:** `POST /api/rpc/employeeLetters/preview` · **Code:** `backend/src/modules/employee-letters/`
- **Access:** Employee · Directory & job: View + Employee · Documents & letters: Edit.
- **Scope:** Employee · Documents & letters Edit covering the employee (`404` outside the data access).
- **Input:** `{ employeeCode: string, kind: (as templates), templateId: number, letterDate?: Date (default today),
  lastWorkingDay?: Date (experience / relieving: required) }`
- **Returns:** a PDF - the letter as `issue` would write it now (number "(given when issued)"). Nothing is stored.
- **Errors:** as `issue`.

### `employeeLetters.issue`
- **HTTP:** `POST /api/rpc/employeeLetters/issue` · **Code:** `backend/src/modules/employee-letters/`
- **Access:** Employee · Directory & job: View + Employee · Documents & letters: Edit.
- **Scope:** Employee · Documents & letters Edit covering the employee (`404` outside the data access).
- **Input:** as `preview`.
- **Returns:** the letter (shape of `list`), with `emailedTo`.
- **What it does:** in one transaction gives the next letter number, writes the PDF, stores it and records the letter;
  then e-mails it with the PDF attached (a mail failure does not undo the letter - `emailedTo` stays null; so does an
  e-mail only saved in the outbox folder when there is no mail server - 2026-11-23).
- **Errors:** `400` the template is not of this kind / retired / has no complete letterhead, "The letter needs: ..."
  (missing details, e.g. the designation), a confirmation letter without the employee's confirmation date, an
  experience / relieving letter without `lastWorkingDay` or with one before the date of joining, an appointment letter or
  salary certificate without a salary on record · `403` · `404 NOT_FOUND` employee or template.

---

## joiningTasks

The tasks other teams do for a new employee (2026-11-16 - the old HRMS's "stakeholder tasks"): e-mail ID, laptop, ID
card... HR keeps the **task list** (`types.*`, Onboarding: Edit): name, team, due days after joining, the joining types
it is for, and a **default person**. On the joining day each active type for the employee's joining type becomes a
**task** given to one person - the one HR picked in the joining dialog, else the default (decided 2026-11-16: an IT
person must not get HR's tasks). Only people with "Joining tasks: Edit" can be given tasks. Each person sees their own
tasks (My tasks) and marks them done; HR (Onboarding) sees every task, gives a task to someone else and can mark any
done. Every morning (worker job `joiningTasks.remindDueTasks`, 09:00) each person is e-mailed their tasks due today or
overdue; tasks given to nobody go to Onboarding: Edit. A task keeps its name, team, due date and person when the list
changes later.

**Task shape:** `{ id, name, team, description, dueDate, doneAt, note, createdAt, overdue, assignedTo (person or null),
doneBy (person or null), employee { employeeCode, name, dateOfJoining, status, company (code), department, designation } }`.

### `joiningTasks.types.list`
- **HTTP:** `POST /api/rpc/joiningTasks/types/list` · **Code:** `backend/src/modules/joining-tasks/`
- **Access:** Joining task types: View (its own area since 2026-11-21) - the whole list; or Onboarding: Edit - the active
  types only, for the joining dialog (checked in the service). Not those who only do tasks with "Joining tasks".
- **Scope:** not limited by data access (one list for every company).
- **Input:** `{ includeInactive?: boolean }` (optional) - the retired ones too; only with Joining task types: View.
- **Returns:** `[{ id, name, role: { id, name }, team, description, dueDays, joiningTypes, isActive, defaultAssignee (person or null) }]`
  by due days, then name (`joiningTypes` empty = every joining type; `team` = the role's name, 2026-11-20 - the manual
  order was removed).
- **Errors:** `403`.

### `joiningTasks.types.create`
- **HTTP:** `POST /api/rpc/joiningTasks/types/create` · **Code:** `backend/src/modules/joining-tasks/`
- **Access:** Joining task types: Edit (2026-11-21; was Onboarding: Edit).
- **Scope:** shared by every company - needs Joining task types Edit for **all companies** (`403`).
- **Input:** `{ name: string (1-100, unique), roleId: number, description?: string (≤1000) | null, dueDays: 0-365,
  joiningTypes?: JoiningType[] (default []), defaultAssigneeCode?: string | null }` - `roleId` the team: a role that gives
  "Joining tasks: Edit" (2026-11-20); the default person a holder of that role.
- **Returns:** the type (shape of `list`).
- **Errors:** `400` invalid input, the role does not give "Joining tasks: Edit", or the default person does not hold it ·
  `409 CONFLICT` name already used.

### `joiningTasks.types.update`
- **HTTP:** `POST /api/rpc/joiningTasks/types/update` · **Code:** `backend/src/modules/joining-tasks/`
- **Access:** Joining task types: Edit (2026-11-21; was Onboarding: Edit).
- **Scope:** shared by every company - needs Joining task types Edit for **all companies** (`403`).
- **Input:** `{ id, ...the fields of create (each optional), isActive?: boolean }` - only the fields sent change;
  `defaultAssigneeCode: null` removes the default person. A new `roleId` keeps the default person only if they hold the
  new role (else send another one, or `null`).
- **Returns:** the type. Applies to employees joining from then on.
- **Errors:** as `create`, or a new team the default person is not in · `404 NOT_FOUND`.

### `joiningTasks.assignees`
- **HTTP:** `POST /api/rpc/joiningTasks/assignees` · **Code:** `backend/src/modules/joining-tasks/`
- **Access:** Onboarding: View, or Joining task types: View (the task type form, 2026-11-21) - checked in the service.
- **Scope:** not limited by data access (the teams and their people for the task forms); with `placement`, only the people
  whose data access on that role covers it - assigning checks the same again.
- **Input:** `{ placement?: { companyId: number, plantId: number, departmentId: number | null } }` (optional) - a new
  employee's place (the joining dialog).
- **Returns:** `[{ id, name, people: [{ id, employeeCode, name }] }]` - the teams: every role that gives "Joining tasks:
  Edit" (2026-11-20), each with its holders who can log in, by name.
- **Errors:** `400` · `403`.

### `joiningTasks.list`
- **HTTP:** `POST /api/rpc/joiningTasks/list` · **Code:** `backend/src/modules/joining-tasks/`
- **Access:** `scope: MINE` - Joining tasks: View; `scope: ALL` - Onboarding: View (checked in the service).
- **Scope:** all tasks: of new employees inside the caller's Onboarding View data access; mine: inside the caller's Joining tasks View data access.
- **Input:** `{ scope?: 'MINE' | 'ALL' (default MINE), status?: 'OPEN' | 'DONE' (default OPEN), team?: string, search?: string (≤100) }`
- **Returns:** `{ items: Task[], teams: [{ team, open }] }` - open tasks oldest due first (up to 1000) or the latest 200
  done (a task has `team` - the role's name when it was made - and `roleId`, its type's role now, or null); `search` matches the employee code or name; `teams` the teams with open tasks (of the same scope).
- **Errors:** `400` · `403`.

### `joiningTasks.forEmployee`
- **HTTP:** `POST /api/rpc/joiningTasks/forEmployee` · **Code:** `backend/src/modules/joining-tasks/`
- **Access:** own record; someone else's: Employee · Directory & job: View (checked in the service).
- **Scope:** one's own record, or Employee · Directory & job View covering the employee (else `404`).
- **Input:** `{ employeeCode: string }`
- **Returns:** `Task[]` by due date (the profile's Record tab).
- **Errors:** `400` · `403` · `404 NOT_FOUND`.

### `joiningTasks.createForEmployee`
- **HTTP:** `POST /api/rpc/joiningTasks/createForEmployee` · **Code:** `backend/src/modules/joining-tasks/`
- **Access:** Onboarding: Edit.
- **Scope:** Onboarding Edit covering the employee (else `404`).
- **Input:** `{ employeeCode: string }`
- **Returns:** `{ made }` - how many tasks were made.
- **What it does:** for an employee who did not join through onboarding (added directly): the tasks of their joining
  type, due from their date of joining, each given to the type's default person if they still hold its role covering the
  employee, else nobody yet (HR gives it on Joining tasks - not checked as strictly as the joining day). Once only.
- **Errors:** `400` no active task type for the joining type · `404 NOT_FOUND` · `409 CONFLICT` the employee already has
  joining tasks.

### `joiningTasks.complete`
- **HTTP:** `POST /api/rpc/joiningTasks/complete` · **Code:** `backend/src/modules/joining-tasks/`
- **Access:** the person the task is given to (with Joining tasks: Edit), or Onboarding: Edit (checked in the service).
- **Scope:** the person it is given to, with Joining tasks Edit covering the new employee - or Onboarding Edit covering them.
- **Input:** `{ id: number, note?: string (≤500) | null }` - `note` left out keeps the note the task already has (one kept
  by an undo, 2026-11-21); `null` clears it.
- **Returns:** the task, done (`doneAt`, `doneBy`, `note`).
- **Errors:** `400` · `403` "This task is given to someone else" · `404 NOT_FOUND` · `409 CONFLICT` already done.

### `joiningTasks.reopen`
- **HTTP:** `POST /api/rpc/joiningTasks/reopen` · **Code:** `backend/src/modules/joining-tasks/`
- **Access:** as `complete`.
- **Scope:** the person it is given to, with Joining tasks Edit covering the new employee - or Onboarding Edit covering them.
- **Input:** `{ id: number }`
- **Returns:** the task, open again (done time and person cleared; the note is **kept** - e.g. a laptop serial - for when it
  is marked done again, 2026-11-21). The pages ask "Undo …?" first.
- **Errors:** `400` · `403` · `404 NOT_FOUND` · `409 CONFLICT` not done.

### `joiningTasks.assign`
- **HTTP:** `POST /api/rpc/joiningTasks/assign` · **Code:** `backend/src/modules/joining-tasks/`
- **Access:** Onboarding: Edit.
- **Scope:** Onboarding Edit covering the new employee (`403`); the person given it must hold the task's team role (its type's role) covering them too (`400`, 2026-11-20).
- **Input:** `{ id: number, assigneeCode: string }`
- **Returns:** the task, given to that person.
- **What it does:** gives an open task to someone else (e.g. the person is on leave).
- **Errors:** `400` the person does not hold the task's role covering the employee · `404 NOT_FOUND` · `409 CONFLICT` the task is done.

---

## attendance

Attendance (2026-11-16, planned with the user - the first module after onboarding, in the order an employee lives it).
Punches come from the biometric machines (an Excel / CSV upload by HR for now - `attendance.punches.upload`; the Kent
feed later). Each employee has a default shift + weekly offs from a date (`shifts.assign`; none: the default shift,
Sunday off); rotating employees get a roster built by their manager (reporting tree) or HR, published before it counts
(`rosters.*`). **Which shift applies on a day:** a holiday of the holiday list the employee follows that day (2026-11-24 - a
whole day; or one half off, the other worked - present for the policy's half-day hours; a first-half holiday on a half-day
weekday makes it all off) first, then a published roster day, then the default shift. **A day:** the punches go to the day whose shift they are nearest (4h
before the start to 8h after the end - a night shift's morning punch is the night before's); where one working day's shift
ends within an hour of the next one's start (a night shift then a morning one), the punches around that moment are split at
their biggest gap - the earlier close the first shift, the later open the next (2026-11-23); a working day with no punch
= absent, one punch = missed punch (punches within 5 minutes of the first are the same tap - 2026-11-23), else first in -> last out minus the unpaid break: full day = present, half day =
half day, less = absent; late = in after start + grace, early = out before end - grace. Worked out when punches arrive,
when a default shift / roster / holiday changes and every night at 02:00 for yesterday (worker job
`attendance.closeYesterday`). HR's correction wins (`days.correct`). Changing a published day: the employee asks, the
manager then HR approve (`shiftChanges.*`). Access: one's own always; a manager their whole reporting tree; Attendance:
View everyone's; Attendance: Edit the setup, corrections and HR's approval. Overtime, late penalties and closing the month
come with payroll; leave and on-duty / missed-punch requests with their modules.

### `attendance.overview`
- **HTTP:** `POST /api/rpc/attendance/overview` · **Code:** `backend/src/modules/attendance/`
- **Access:** any logged-in employee.
- **Scope:** not limited by data access - the caller's own (and the sizes of their reporting tree and of their HOD department).
- **Input:** none
- **Returns:** `{ today, teamSize, directReports, departmentSize, currentMonth {year, month} (the attendance month today is in - 26th to 25th, 2026-11-22), cycleStartDay (the day an attendance month starts, 1-28 - the month placeholder draws its real days), canSeeAll, canEdit }` - `today` the viewer's day (`{ date, employed, status, autoStatus, planned (WORK | WEEKLY_OFF | HOLIDAY), holiday, holidayHalf, rostered, shift {id, code, name}, inAt, outAt ("09:04", the work location's clock), punchCount, workedMinutes, lateMinutes, earlyMinutes, note, correction }` without the correction, plus `corrected` and `shiftHours` (2026-11-27, the home page's day card: `{ start, end ("09:00", the work location's clock), startsAt, endsAt (instants) }` - when the day's working part runs, a night shift ending the next day, a day of one half only to / from its split, as the punches are judged; null on a weekly off or holiday) and `notTracked` (2026-11-27: the person's attendance is not tracked on the day - from the marker itself, before the day is worked out)); `teamSize` the size of their reporting tree; `directReports` (2026-11-27) how many report to them directly - the self-service home shows only those; `departmentSize` (2026-11-18) how many employees they are the HOD of; the "Team attendance" menu item and page show when either is above 0 or `canSeeAll` (2026-11-22); (Shift changes to decide are on the Approvals page since 2026-11-22.)
- **What it does:** what the attendance pages, the menu (whether "Team attendance" shows) and the home page's "Today" card need first.
- **Errors:** `401`.

### `attendance.days.myMonth`
- **HTTP:** `POST /api/rpc/attendance/days/myMonth` · **Code:** `backend/src/modules/attendance/days/`
- **Access:** any logged-in employee (their own).
- **Scope:** not limited by data access - the caller's own.
- **Input:** `{ year, month }`
- **Returns:** `{ employee {employeeCode, name, department, designation, company}, year, month, from, to, locked, days: [`{ date, employed, status, firstHalf, secondHalf, autoStatus, planned (WORK | WEEKLY_OFF | HOLIDAY), holiday, rostered, halfDay, holidayHalf (FIRST | SECOND | null - a half-day holiday's half off, 2026-11-24), policy {id, name, graceMinutes}, note, shift {id, code, name}, inAt, outAt ("09:04", the work location's clock), punchCount, workedMinutes, lateMinutes, earlyMinutes, correction, covers }`], totals { present, halfDay, absent, missedPunch, leave, onDuty, weeklyOff, holiday, late, workedMinutes } }` - `year` / `month` an **attendance month** from the settings' start day (RML: 26 - "November" = 26 Oct - 25 Nov, 2026-11-22) with its `from` / `to` days and whether it is `locked`; each day has two halves (2026-11-22): `firstHalf` / `secondHalf` each PRESENT | ABSENT | MISSED_PUNCH | WEEKLY_OFF | HOLIDAY | LEAVE | ON_DUTY (2026-11-22), `status` the day overall (both the same = that; present + absent = HALF_DAY; present / absent beside an off half = that; on duty counts as worked; leave + worked = HALF_DAY, leave + absent = ABSENT, leave beside an off half = LEAVE); `covers` (2026-11-22) `[{ half: FIRST | SECOND, status: LEAVE | PRESENT | ON_DUTY | HOLIDAY, code (CL, OD, P), label }]` - the approved leave (leave module; HOLIDAY: an on-application holiday taken - a leave type "only on its holiday dates", 2026-11-24) and missed-punch / on-duty requests on the day's working halves, also for days to come (a weekly off / holiday is never covered; HR's correction wins over them, they win over the punches); `halfDay` the day works only the first half (a half-day weekday, e.g. Saturday); `policy` the attendance policy the day is judged by; `note` why a policy rule made a half absent (e.g. "3rd late this month - first half absent", "In 2h 30m late - first half absent"); the totals count in halves (a Saturday present + off = 0.5 + 0.5), `halfDay` = days with one half present and one absent; `correction` `{ firstHalf, secondHalf (null = follows the punches), reason, at, by }` or null; a day not worked out yet (a future day, today before the first punch) has `status: null` and shows what is planned.
- **What it does:** the employee's month calendar.
- **Errors:** `400`.

### `attendance.days.employeeMonth`
- **HTTP:** `POST /api/rpc/attendance/days/employeeMonth` · **Code:** `backend/src/modules/attendance/days/`
- **Access:** own; someone in the viewer's reporting tree or whose HOD they are ("My department", 2026-11-18); or Attendance: View (checked in the service).
- **Scope:** one's own; someone in the caller's reporting tree or of a place the caller heads as HOD (relationships); anyone else: Attendance View covering the employee (else `404`).
- **Input:** `{ employeeCode, year, month }`
- **Returns:** as `myMonth` + `canCorrect` (the viewer's Attendance Edit covers the employee - the day correction is offered only then; 2026-11-23).
- **What it does:** one employee's month (the manager's team, HR).
- **Errors:** `400` · `403` · `404 NOT_FOUND`.

### `attendance.days.board`
- **HTTP:** `POST /api/rpc/attendance/days/board` · **Code:** `backend/src/modules/attendance/days/`
- **Access:** TEAM: any logged-in employee (their reporting tree - empty without one); DEPARTMENT (2026-11-18): any logged-in employee (the employees whose HOD they are - empty when they are no HOD); ALL: Attendance: View.
- **Scope:** DIRECT (2026-11-27, the self-service home): only the people who report to the caller directly (the relationship, like TEAM); TEAM: the caller's reporting tree; DEPARTMENT: the employees of the places the caller heads as HOD (relationships, not data-access rows); ALL: only employees inside the caller's Attendance View data access.
- **Input:** `scope` `DIRECT` (only direct reports), `TEAM` (default - the viewer's reporting tree, every level), `DEPARTMENT` (the employees whose HOD the viewer is) or `ALL` (Attendance: View), `companyIds?`, `workLocationIds?`, `departmentIds?`, `search?` (code or name), `date`
- **Returns:** `{ date, isToday, items: [{ employeeCode, name, company, department, designation, state, ...day (as `myMonth`, with its halves and covers) }], summary { total, in, late, notIn, absent, off, leave, onDuty } }` - `state` the day's status, or `NOT_IN` today before the first punch (`LEAVE` / `ON_DUTY` when approved leave / on duty covers a day not worked out yet - 2026-11-22).
- **What it does:** who is in / late / not in yet / absent / off on a day. A working day with no punch is "not in yet" today and on a day to come, absent only once it has passed (2026-11-23: a day to come showed everyone absent).
- **Errors:** `400` · `403`.

### `attendance.days.muster`
- **HTTP:** `POST /api/rpc/attendance/days/muster` · **Code:** `backend/src/modules/attendance/days/`
- **Access:** as `board`.
- **Scope:** DIRECT (2026-11-27, the self-service home): only the people who report to the caller directly (the relationship, like TEAM); TEAM: the caller's reporting tree; DEPARTMENT: the employees of the places the caller heads as HOD (relationships, not data-access rows); ALL: only employees inside the caller's Attendance View data access.
- **Input:** `scope` `DIRECT` (only direct reports), `TEAM` (default - the viewer's reporting tree, every level), `DEPARTMENT` (the employees whose HOD the viewer is) or `ALL` (Attendance: View), `companyIds?`, `workLocationIds?`, `departmentIds?`, `search?` (code or name), `year`, `month`
- **Returns:** `{ year, month, from, to, locked, days: Date[], rows: [{ employeeCode, name, company, department, cells: [{ code, first, second, late, corrected }], totals }] }` - the attendance month (as `myMonth`) - `code` P / A / MP / WO / H / OD / a leave type's code (CL, SL... - 2026-11-22), or the two halves when they differ (2026-11-22): `P/WO` a Saturday half day, `P/A` a half day worked, `CL/P`; a day to come shows its approved leave / on duty; `first` / `second` each half's code; '' = not worked out yet / not employed; totals in halves (as `myMonth`).
- **What it does:** the monthly muster: everyone in the scope x every day.
- **Errors:** `400` · `403`.

### `attendance.days.exportMuster`
- **HTTP:** `POST /api/rpc/attendance/days/exportMuster` · **Code:** `backend/src/modules/attendance/days/`
- **Access:** as `board`.
- **Scope:** DIRECT (2026-11-27, the self-service home): only the people who report to the caller directly (the relationship, like TEAM); TEAM: the caller's reporting tree; DEPARTMENT: the employees of the places the caller heads as HOD (relationships, not data-access rows); ALL: only employees inside the caller's Attendance View data access.
- **Input:** as `muster`.
- **Returns:** a file `muster-YYYY-MM.xlsx` (codes per day - two halves as `P/WO` -, `*` = late, totals in halves, and a sheet explaining the codes).
- **What it does:** the muster as Excel.
- **Errors:** `400` · `403`.

- **Review format (2026-11-24):** shared Excel review-report formatting and separate Review notes sheet described above; existing data columns and authorization retained.

### `attendance.days.punches`
- **HTTP:** `POST /api/rpc/attendance/days/punches` · **Code:** `backend/src/modules/attendance/days/`
- **Access:** as `employeeMonth`.
- **Scope:** one's own; someone in the caller's reporting tree or of a place the caller heads as HOD (relationships); anyone else: Attendance View covering the employee (else `404`).
- **Input:** `{ employeeCode, date }`
- **Returns:** `[{ id, employeeCode, at, time ("09:04"), timezone, device, source, uploadId, uploadFile, storedAt }]` (extended 2026-11-24). `employeeCode` is the stored machine code; source is UPLOAD / MANUAL; upload reference/file nullable, storedAt is database creation time, not proof of device receipt. Exact `at` timestamps and work-location time zone accompany the local clock. Only punches owned by this work date are returned, including night-shift exits; no new day is computed or stored.
- **What it does:** the day's details.
- **Errors:** `400` · `403` · `404`.

### `attendance.days.correct`
- **HTTP:** `POST /api/rpc/attendance/days/correct` · **Code:** `backend/src/modules/attendance/days/`
- **Access:** Attendance: Edit.
- **Scope:** Attendance Edit covering the employee (outside the View data access `404`, View only `403`).
- **Input:** `{ employeeCode, date (today or before), firstHalf?, secondHalf? (PRESENT | ABSENT | MISSED_PUNCH | WEEKLY_OFF | HOLIDAY | ON_DUTY, or null = back to the punches - at least one; never LEAVE: leave is taken only by an approved application, which debits the balance - 2026-11-22), reason (3-500) }`
- **Returns:** `{ corrected: true }`.
- **What it does:** HR sets one half or both with a reason (`attendance_corrections`, in the change history - 2026-11-22, was one status for the day); refused for a day of a locked attendance month (`409`); the day is worked out again - a set half wins over the punches, a half left out keeps its earlier correction or follows the punches (2026-11-23 - correcting one half wiped the other's); a half sent as `null` goes back to the punches (its correction removed; both null = no correction left).
- **Errors:** `400` neither half, a future day, not employed that day · `403` · `404` · `409` a locked attendance month.

### `attendance.days.removeCorrection`
- **HTTP:** `POST /api/rpc/attendance/days/removeCorrection` · **Code:** `backend/src/modules/attendance/days/`
- **Access:** Attendance: Edit.
- **Scope:** Attendance Edit covering the employee (outside the View data access `404`, View only `403`).
- **Input:** `{ employeeCode, date }`
- **Returns:** `{ removed: true }`.
- **What it does:** takes HR's correction away; the day goes back to what the punches give.
- **Errors:** `403` · `404` no correction.

### `attendance.shifts.list`
- **HTTP:** `POST /api/rpc/attendance/shifts/list` · **Code:** `backend/src/modules/attendance/shifts/`
- **Access:** any logged-in employee (retired ones: Attendance setup: View).
- **Scope:** not limited by data access (one list for every company).
- **Input:** `{ includeInactive?: boolean }` (optional)
- **Returns:** `[{ id, code, name, startMinute, endMinute, start, end ("09:00"), crossesMidnight, lengthMinutes, breakMinutes, halfSplitMinute, halfSplit ("13:00" or null = the middle), isActive, from (the date the timing in force today runs from - 2000-01-01 = from the start), versions: [{ effectiveFrom, startMinute, endMinute, start, end, crossesMidnight, lengthMinutes, breakMinutes, halfSplitMinute, halfSplit, current, upcoming, by: { employeeCode, name } | null, at }] }]` by today's start time - the timing only (grace and the day's hours are the attendance policy, 2026-11-22).
- **What it does:** the shifts - their timing only; which days people work which shift is the schedule patterns (2026-11-23). The timing is dated (2026-11-23): each version runs from its date until the next; a day follows the version in force on it.
- **Errors:** `403`.

### `attendance.shifts.create`
- **HTTP:** `POST /api/rpc/attendance/shifts/create` · **Code:** `backend/src/modules/attendance/shifts/`
- **Access:** Attendance setup: Edit.
- **Scope:** shared by every company - needs Attendance setup Edit for **all companies** (`403`).
- **Input:** `{ code (1-10 letters/digits, unique), name (unique), start, end ("HH:MM"; end not after start = ends the next day), breakMinutes 0-240 (unpaid - only taken off the hours worked shown), halfSplit? ("HH:MM" where the first half ends, inside the shift; null = the middle - 2026-11-22) }`
- **Returns:** the shift (as in `list`).
- **What it does:** adds a shift (used in schedule patterns) - its timing is its first version, from the start.
- **Errors:** `400` same start and end, the break longer than the shift, the first half ending outside the shift · `409` code / name used.

### `attendance.shifts.update`
- **HTTP:** `POST /api/rpc/attendance/shifts/update` · **Code:** `backend/src/modules/attendance/shifts/`
- **Access:** Attendance setup: Edit.
- **Scope:** shared by every company - needs Attendance setup Edit for **all companies** (`403`).
- **Input:** `{ id, ...the fields of create (optional), effectiveFrom?: date (required when start / end / breakMinutes / halfSplit change), isActive? }`
- **Returns:** the shift (as in `list`).
- **What it does:** changes the code / name or retires a shift, and changes its timing **from a date** (dated shifts - the user, 2026-11-23; the review found an edit reworked days already passed): the version in force that day with the changes becomes the version from that date (one on the same date is replaced; later ones stay). The days before keep their times, also when worked out again later. From a day already passed, the days worked out on this shift since then are worked out again at once. A shift that a pattern in use names - today or in a later version - cannot be retired.
- **Errors:** as `create` · `400` new times without `effectiveFrom` · `404` · `409` retiring a shift a pattern names; a locked attendance month on or after `effectiveFrom`.

### `attendance.shifts.assign`
- **HTTP:** `POST /api/rpc/attendance/shifts/assign` · **Code:** `backend/src/modules/attendance/shifts/`
- **Access:** Attendance setup: Edit.
- **Scope:** each employee: Attendance setup Edit covering the employee (outside the View data access `404`, View only `403`).
- **Input:** `{ employeeCodes (1-2000), patternId (an active schedule pattern), startWeek? (1-8, default 1: which week of the pattern the start date's week is), policyId? (an active attendance policy; null / left out = the default policy - 2026-11-22), effectiveFrom }`
- **Returns:** `{ assigned }`.
- **What it does:** the schedule of employees from a date (until the next one; one per employee per date - the user, 2026-11-23): the pattern decides every day (a shift, its first half only, or off), repeating; a 7 / 14 / 21-day pattern lines up with Monday-Sunday - the day of the pattern stored is worked out from `startWeek` and the start date's weekday; a pattern that is not whole weeks starts on its first day on the start date (2026-11-23). And the attendance policy. A half day ends where the shift's first half ends; present = stayed at least the policy's half-day hours from the first in. The days already passed from that date are worked out again. Without one: the default pattern in force on each day (dated - 2026-11-23; counted from Monday 1 Jan 2024), the default policy.
- **Errors:** `400` unknown code, retired policy, `startWeek` past the pattern's weeks · `404` unknown policy or pattern · `409` a locked attendance month on or after the date (its planned days would change - 2026-11-23).

### `attendance.shifts.assignments`
- **HTTP:** `POST /api/rpc/attendance/shifts/assignments` · **Code:** `backend/src/modules/attendance/shifts/`
- **Access:** own, or Attendance setup: View.
- **Scope:** one's own, or Attendance setup View covering the employee (else `404`).
- **Input:** `{ employeeCode }`
- **Returns:** `[{ id, employeeId, patternId, pattern {name}, patternDay (which day of the pattern effectiveFrom is), policyId, policy {name} | null (null = the default), effectiveFrom, createdAt, by }]` newest first.
- **What it does:** one employee's schedules (which pattern from when).
- **Errors:** `403` · `404`.

### `attendance.shifts.schedules`
- **HTTP:** `POST /api/rpc/attendance/shifts/schedules` · **Code:** `backend/src/modules/attendance/shifts/`
- **Access:** Attendance setup: View.
- **Scope:** the employees inside the viewer's Attendance setup View data access (`scopeOf` - employed today).
- **Input:** `{ search? (name or code), companyIds?, plantIds?, departmentIds?, costCenterIds? (each a list of ids - any of them), patternId?, policyId?, holidayListId? (null = those without a list - 2026-11-24), notTracked? (true = only those marked "attendance not tracked" today or from a later day; false = only the others - 2026-11-27) }` (optional)
- **Returns:** `[{ employee {employeeCode, name, company (code), plant (code + name), department, costCenter (code), workLocation}, pattern {id, name} | null, patternIsDefault (never given a schedule), policy {id, name} | null, policyIsDefault (the schedule names none), since (the schedule's start; null = never given one), next {from, pattern} | null (a change already set for later), holidayList { holidayList {id, name} | null (none = no holidays), since, next {from, holidayList} | null } (2026-11-24), notTracked { id, fromDate, toDate | null, reason, current } | null (2026-11-27: the "attendance not tracked" marker in force today, or - `current` false - the next one to start; null = tracked by punches) }]` by employee code - `patternId` / `policyId` keep those following it (the default one included).
- **What it does:** who follows what (the user, 2026-11-23: "which employee got what schedule pattern and what policy") - the Schedules part of Attendance setup.
- **Errors:** `403`.

### `attendance.shifts.patterns.list`
- **HTTP:** `POST /api/rpc/attendance/shifts/patterns/list` · **Code:** `backend/src/modules/attendance/shifts/`
- **Access:** any logged-in employee (retired: Attendance setup: View).
- **Scope:** not limited by data access (one list for every company).
- **Input:** `{ includeInactive? }` (optional)
- **Returns:** `[{ id, name, days (a shift id per day, 0 = off), halfDays (the days, 1 = the first, worked in their first half only), isDefault (the default today), defaultFrom (the date a later change makes it the default, or null), isActive, from (the date the days in force today run from - 2000-01-01 = from the start), versions: [{ effectiveFrom, days, halfDays, current, upcoming, by: { employeeCode, name } | null, at }] }]` - the default first, then by name. `days` / `halfDays` are the ones in force today; the days are dated (2026-11-23), and so is which pattern is the default.
- **What it does:** the schedule patterns (the user, 2026-11-23): weeks of Monday-Sunday that repeat - one idea for fixed and rotating staff alike; the default one is for everyone never given a schedule (a General week - six days, Sunday off - was made from the default shift).
- **Errors:** `401`.

### `attendance.shifts.patterns.create`
- **HTTP:** `POST /api/rpc/attendance/shifts/patterns/create` · **Code:** `backend/src/modules/attendance/shifts/`
- **Access:** Attendance setup: Edit.
- **Scope:** shared by every company - needs Attendance setup Edit for **all companies** (`403`).
- **Input:** `{ name (unique), days: number[] 1-56 (a shift id, or 0 = off - usually 7, 14 or 21), halfDays?: number[] (the days, 1 = the first, worked in their first half only - each a day with a shift) }`
- **Returns:** the pattern (as in `list`).
- **What it does:** adds a pattern (its days are its first version, from the start), e.g. Mon A, Tue B, Wed C, Thu GEN, Fri GEN, Sat GEN ½, Sun off. A half day counts half worked and half off (leave on it 0.5).
- **Errors:** `400` an unknown / retired shift, no working day, a half day without a shift · `409` name used.

### `attendance.shifts.patterns.update`
- **HTTP:** `POST /api/rpc/attendance/shifts/patterns/update` · **Code:** `backend/src/modules/attendance/shifts/`
- **Access:** Attendance setup: Edit.
- **Scope:** shared by every company - needs Attendance setup Edit for **all companies** (`403`).
- **Input:** `{ id, name?, days?, halfDays?, effectiveFrom?: date (required when days / halfDays change), isDefault?: true, isActive? }`
- **Returns:** the pattern (as in `list`).
- **What it does:** changes the name or retires a pattern, and changes its days **from a date** (dated patterns - the user, 2026-11-23): the version in force that day with the changes becomes the version from that date (one on the same date is replaced; later ones stay). The days before keep what they had, also when worked out again later; the cycle keeps counting from each schedule's start. From a day already passed, the days of everyone given the pattern (for the default one: everyone) are worked out again from then. `isDefault: true` makes it the default **from today** (the star - dated, 2026-11-23: the days before today keep the default they had; today's days of everyone are worked out again). There is always exactly one default - no schedule is built into the code - so the default (today's, or one set for a later date) cannot be retired, only moved.
- **Errors:** as `create` · `400` new days without `effectiveFrom`, starring a retired pattern · `404` · `409` retiring the default; a locked attendance month on or after `effectiveFrom`.

### `attendance.policies.list`
- **HTTP:** `POST /api/rpc/attendance/policies/list` · **Code:** `backend/src/modules/attendance/policies/`
- **Access:** any logged-in employee (retired ones: Attendance setup: View).
- **Scope:** not limited by data access (one list for every company).
- **Input:** `{ includeInactive?: boolean }` (optional)
- **Returns:** `[{ id, name, isDefault, isActive, graceMinutes, fullDayMinutes (null = the whole shift), halfDayMinutes, latesPerHalfDayCut, veryLateMinutes, veryEarlyMinutes (the rules in force today), from (the date they run from; 2000-01-01 = from the start), versions [{ effectiveFrom, ...the rules, current, upcoming, by {employeeCode, name} | null, at }] (oldest first) }]` - the default first, then by name.
- **What it does:** the attendance policies (the user, 2026-11-22): the rules a day is judged by, apart from the shift's timing - dated (2026-11-23): each version runs from its date until the next. "Standard" (grace 10, the whole shift, half day 4h) is seeded as the default.
- **Errors:** `403`.

### `attendance.policies.create`
- **HTTP:** `POST /api/rpc/attendance/policies/create` · **Code:** `backend/src/modules/attendance/policies/`
- **Access:** Attendance setup: Edit.
- **Scope:** shared by every company - needs Attendance setup Edit for **all companies** (`403`).
- **Input:** `{ name (unique), graceMinutes 0-120, fullDayMinutes (minutes from the first in to the last out, break inside; null = the whole shift), halfDayMinutes (also a pattern's half day), latesPerHalfDayCut (1-31: every Nth late day of an attendance month loses its first half - on a day with the first half a holiday, its second half, the half worked (2026-11-25); null = off), veryLateMinutes (in later than this after the start = first half absent; null = off), veryEarlyMinutes (out earlier than this before the end = second half absent; null = off), isDefault? }`
- **Returns:** the policy (as in `list`).
- **What it does:** adds a policy - its rules are its first version, from the start; `isDefault` makes it the one for employees with none set (the others lose the flag). A day judged by a rule keeps the reason in its `note`.
- **Errors:** `400` half day longer than the full day · `403` · `409` name used.

### `attendance.policies.update`
- **HTTP:** `POST /api/rpc/attendance/policies/update` · **Code:** `backend/src/modules/attendance/policies/`
- **Access:** Attendance setup: Edit.
- **Scope:** shared by every company - needs Attendance setup Edit for **all companies** (`403`). A change from a day already passed works out again the days of everyone the policy covers (its schedules; the default policy: everyone) - a step of the change, nothing returned about them.
- **Input:** `{ id, name?, graceMinutes?, fullDayMinutes?, halfDayMinutes?, latesPerHalfDayCut?, veryLateMinutes?, veryEarlyMinutes?, effectiveFrom? (date - required with any rule), isDefault?: true, isActive? }`
- **Returns:** the policy (as in `list`).
- **What it does:** dated policy changes (the user, 2026-11-23): the rules in force on `effectiveFrom` with the changes become the version from that date (one on the same date is replaced; later versions stay). A day is judged by the version in force on it, so the days before keep their rules even when worked out again later. From a day already passed, those days up to today are worked out again at once. Also renames, makes default or retires a policy.
- **Errors:** as `create` · `400` rules without `effectiveFrom` · `404` · `409` retiring the default policy, `effectiveFrom` in a locked attendance month.

### `attendance.locks.months`
- **HTTP:** `POST /api/rpc/attendance/locks/months` · **Code:** `backend/src/modules/attendance/locks/`
- **Access:** Attendance setup: Edit for **all companies** (checked in the service).
- **Scope:** the whole group - the lock is one for every company (`403` without Edit for all companies).
- **Input:** `{ year }`
- **Returns:** `{ cycleStartDay, months: [{ year, month, name ("November 2026"), from, to, ended, locked {at, by} | null, reopened [{ lockedAt, lockedBy, unlockedAt, unlockedBy, reason }] }] }` - the 12 attendance months of the year.
- **What it does:** the Month lock screen (the user, 2026-11-22 - for payroll): each attendance month (RML: 26th to 25th) - locked, open, or not over yet.
- **Errors:** `400` · `403`.

### `attendance.locks.checklist`
- **HTTP:** `POST /api/rpc/attendance/locks/checklist` · **Code:** `backend/src/modules/attendance/locks/`
- **Access:** Attendance setup: Edit for **all companies** (checked in the service).
- **Scope:** the whole group (`403` otherwise) - counts of every company's month.
- **Input:** `{ year, month }`
- **Returns:** `{ year, month, name, from, to, locked, missedPunches (days with a missed-punch half), pendingShiftChanges (requests for its days waiting for approval), unmatchedPunches (punches of codes linked to nobody) }`.
- **What it does:** what is still open before locking - a warning, it does not block.
- **Errors:** `400` · `403`.

### `attendance.locks.lock`
- **HTTP:** `POST /api/rpc/attendance/locks/lock` · **Code:** `backend/src/modules/attendance/locks/`
- **Access:** Attendance setup: Edit for **all companies** (checked in the service).
- **Scope:** the whole group (`403` otherwise).
- **Input:** `{ year, month }`
- **Returns:** the checklist, `locked: true`.
- **What it does:** works the month's days out once more for everyone employed in it, then locks it (`attendance_month_locks`): its days are not worked out again, and punches (left out of an upload), HR's corrections, roster days and shift changes (asked or approved) for its days are refused until it is opened again. Two locks of the same month at the
  same moment make one (checked and saved while the month is held - 2026-11-23).
- **Errors:** `400` the month is not over yet · `403` · `409` already locked.

### `attendance.locks.unlock`
- **HTTP:** `POST /api/rpc/attendance/locks/unlock` · **Code:** `backend/src/modules/attendance/locks/`
- **Access:** Attendance setup: Edit for **all companies** (checked in the service).
- **Scope:** the whole group (`403` otherwise).
- **Input:** `{ year, month, reason (3-500) }`
- **Returns:** the checklist, `locked: false`.
- **What it does:** opens a locked month again - who, when and why are kept on the lock; it can be locked again later.
- **Errors:** `400` · `403` · `404` not locked.

### `attendance.locks.setCycleStart`
- **HTTP:** `POST /api/rpc/attendance/locks/setCycleStart` · **Code:** `backend/src/modules/attendance/locks/`
- **Access:** Attendance setup: Edit for **all companies** (checked in the service).
- **Scope:** shared by every company (`403` otherwise).
- **Input:** `{ cycleStartDay (1-28; 1 = the calendar month) }`
- **Returns:** `{ cycleStartDay }`.
- **What it does:** the day an attendance month starts (`attendance_settings`, seeded 26 for RML - "November" = 26 Oct - 25 Nov); the muster, the month views, the late count and the lock follow it. Payroll runs created afterwards pay the new cycle (2026-11-27); a run already created keeps the dates it captured. It does not yet check that the last and the next pay run meet without a gap or an overlap (BACKLOG item 31).
- **Errors:** `400` · `403` · `409` a month is locked (its days would move).

### `attendance.holidays.list`
- **HTTP:** `POST /api/rpc/attendance/holidays/list` · **Code:** `backend/src/modules/attendance/holidays/`
- **Access:** Attendance setup: View (2026-11-24 - was any logged-in employee; employees see their own: `mine`).
- **Scope:** not limited by data access - every list's holidays (dates and names, no one's records), for the setup page.
- **Input:** `{ year, holidayListId? (only that list's) }`
- **Returns:** `[{ id, date, name, portion (FULL_DAY | FIRST_HALF | SECOND_HALF - the part of the day off), mode (AUTOMATIC | ON_APPLICATION), allowHalfDay, leaveType {id, code, name} | null, category {id, name, tone}, lists [{id, name, companyId}] }]` by date.
- **What it does:** a year's holidays (2026-11-24 - each in the holiday lists that have it). Who gets which comes from the list each employee follows (`attendance.holidayLists.*`).
- **Errors:** `400`.

### `attendance.holidays.mine`
- **HTTP:** `POST /api/rpc/attendance/holidays/mine` · **Code:** `backend/src/modules/attendance/holidays/`
- **Access:** Logged in.
- **Scope:** not limited by data access - the caller's own holidays only.
- **Input:** `{ year }`
- **Returns:** `{ holidayList {id, name} | null (followed today), next {from, holidayList} | null (a change set for later), holidays [{ id, date, name, portion, mode, allowHalfDay, leaveType {id, code, name} | null, category {id, name, tone}, list {id, name} }] }` by date.
- **What it does:** "My holidays" (the user, 2026-11-24 - the Holidays page, /holidays, a tab beside My leave for every employee since 2026-11-25): the holidays of the list the caller follows on each date of the year (a list changed in the year: each part its own); automatic ones are days off, an on-application one is theirs to apply for (`leave.applications.apply` with its leave type). No list: none. Their applications and balances come from `leave.applications.mine` / `leave.balances.get`.
- **Errors:** `400`.

### `attendance.holidays.create`
- **HTTP:** `POST /api/rpc/attendance/holidays/create` · **Code:** `backend/src/modules/attendance/holidays/`
- **Access:** Attendance setup: Edit.
- **Scope:** every list it goes in: a company's list - Attendance setup Edit for that **whole company**; a list of every company - for **all companies** (`403`).
- **Input:** `{ date, name, categoryId (a category in use), portion? (default FULL_DAY), holidayListIds (1-200, lists in use), mode? (AUTOMATIC default | ON_APPLICATION - 2026-11-24), leaveTypeId? (ON_APPLICATION: required - a leave type in use, "only on its holiday dates"; AUTOMATIC: none), allowHalfDay? (ON_APPLICATION: half of it may be taken) }` - an on-application holiday is a whole day (`portion` FULL_DAY).
- **Returns:** the holiday, as `list`.
- **What it does:** adds a holiday to the lists (one holiday, shared by them - 2026-11-24): everyone following one of them that day is off - the whole day, or that half (the other half worked); an ON_APPLICATION one is a working day unless they apply for it (leave of its type, approved - the day then a holiday for them). A day already passed works that attendance month out again for those whose days of it are already worked out (never a month before attendance started - 2026-11-24). Leave counts by the same days.
- **Errors:** `400` a retired list or category · `403` · `404` no such list / category · `409` one of the lists already has a holiday that day, or the date is in a locked attendance month (2026-11-23).

### `attendance.holidays.update`
- **HTTP:** `POST /api/rpc/attendance/holidays/update` · **Code:** `backend/src/modules/attendance/holidays/`
- **Access:** Attendance setup: Edit.
- **Scope:** as `create`, for every list it is in and every list it goes in (`403`).
- **Input:** `{ id, ...the fields of create (optional) - holidayListIds: the lists that have it from now on }`
- **Returns:** the holiday, as `list`.
- **What it does:** changes a holiday; moved, put in other lists, another part of the day or how it is given: both dates must be in open months and are worked out again (as `create`); a new name or category alone may be fixed in a locked month (2026-11-23). An on-application holiday changed (2026-11-24): the leave taking it, waiting or approved, that no longer fits (another date, off the person's list) is cancelled - an approved one's days given back, the employee e-mailed. One whose day has passed and that someone took is never moved, put in other lists or given otherwise (the user, 2026-11-25) - a new name or category is fine.
- **Errors:** as `create` · `404` · `409` an on-application holiday already passed and taken (2026-11-25).

### `attendance.holidays.delete`
- **HTTP:** `POST /api/rpc/attendance/holidays/delete` · **Code:** `backend/src/modules/attendance/holidays/`
- **Access:** Attendance setup: Edit.
- **Scope:** every list it is in (as `create`, `403`).
- **Input:** `{ id }`
- **Returns:** `{ deleted: true }`.
- **What it does:** removes a holiday from every list (its month worked out again, as `create`) - not in a locked attendance month (2026-11-23). An on-application one: the leave taking it is cancelled and its days given back (the employee e-mailed - 2026-11-24) - never one already passed and taken (the user, 2026-11-25).
- **Errors:** `403` · `404` · `409` a locked month, or an on-application holiday already passed and taken.

### `attendance.holidays.copyYear`
- **HTTP:** `POST /api/rpc/attendance/holidays/copyYear` · **Code:** `backend/src/modules/attendance/holidays/`
- **Access:** Attendance setup: Edit.
- **Scope:** only the lists the viewer may change (as `create`) - a holiday's other lists are left out; nothing outside the data access is copied into.
- **Input:** `{ year }` - copies `year - 1` into `year`.
- **Returns:** `{ copied, skipped }`.
- **What it does:** "copy from last year" (the user, 2026-11-24): each holiday of the year before, on the same day and month (29 Feb -> 28 Feb), with its name, category, part of the day and how it is given, into the same lists; a list that already has a holiday that day keeps it; days in a locked month are left out. HR then moves the festivals whose dates differ.
- **Errors:** `400` · `403`.

### `attendance.holidayLists.list`
- **HTTP:** `POST /api/rpc/attendance/holidayLists/list` · **Code:** `backend/src/modules/attendance/holiday-lists/`
- **Access:** any logged-in employee; `includeInactive` needs Attendance setup: View.
- **Scope:** not limited by data access - list names and the plants they are the default of, no one's records.
- **Input:** `{ includeInactive? }` (optional)
- **Returns:** `[{ id, name, companyId, isActive, company {id, code, name} | null, defaultPlants [{id, plantCode, name, companyId}] }]` by name.
- **What it does:** the named holiday lists (2026-11-24 - "Corporate", "RML6 Plant"); each employee follows one from a date (`assign`, the joining day, `fillMissing`; who follows which: `attendance.shifts.schedules`). `company` null = a list every company may use.
- **Errors:** `403` retired ones without Attendance setup: View.

### `attendance.holidayLists.create`
- **HTTP:** `POST /api/rpc/attendance/holidayLists/create` · **Code:** `backend/src/modules/attendance/holiday-lists/`
- **Access:** Attendance setup: Edit.
- **Scope:** a company's list: Attendance setup Edit for that **whole company** (`assertWholeSlice`); a list for every company: for **all companies** (`assertGroupWide`) - `403`.
- **Input:** `{ name (unique), companyId? (empty = every company) }`
- **Returns:** the list, as `list`.
- **What it does:** adds a holiday list.
- **Errors:** `400` · `403` · `404` no such company · `409` the name is taken.

### `attendance.holidayLists.update`
- **HTTP:** `POST /api/rpc/attendance/holidayLists/update` · **Code:** `backend/src/modules/attendance/holiday-lists/`
- **Access:** Attendance setup: Edit.
- **Scope:** as `create`, for the company it belongs to and, when moved, the one it goes to (`403`).
- **Input:** `{ id, name?, companyId? (null = every company), isActive? }`
- **Returns:** the list, as `list`.
- **What it does:** renames, gives the list to another company (or to every company) or retires it.
- **Errors:** `400` · `403` · `404` · `409` the name is taken; moved to a company while it is the default of another company's plant or followed (today or from a later date) by employees of another company; retired while it is a plant's default or still followed by employees (2026-11-24).

### `attendance.holidayLists.setPlantDefault`
- **HTTP:** `POST /api/rpc/attendance/holidayLists/setPlantDefault` · **Code:** `backend/src/modules/attendance/holiday-lists/`
- **Access:** Attendance setup: Edit.
- **Scope:** a plant's setting - Attendance setup Edit for that **whole plant** (`assertWholeSlice`, `403`).
- **Input:** `{ plantId, holidayListId (null = no default) }`
- **Returns:** `{ plantId, holidayList {id, name} | null }`.
- **What it does:** the list offered on the joining day for the plant, and given by `fillMissing` to the plant's employees without a list (2026-11-24) - HR may give a person another (`assign`); moving plant keeps the list. A list in use, of the plant's company or of every company. Not dated: it decides only what is given next.
- **Errors:** `400` a retired list or another company's · `403` · `404` no such plant / list.

### `attendance.holidayLists.assign`
- **HTTP:** `POST /api/rpc/attendance/holidayLists/assign` · **Code:** `backend/src/modules/attendance/holiday-lists/`
- **Access:** Attendance setup: Edit.
- **Scope:** each employee: Attendance setup Edit covering the employee (outside the View data access `404`, View only `403`).
- **Input:** `{ employeeCodes (1-2000), holidayListId, effectiveFrom }`
- **Returns:** `{ assigned, unchanged }` - `unchanged`: already following that list from that day, with no later change.
- **What it does:** the employees follow the list from the date until their next row (one per employee per date, a row the same day replaced) - HR's change of one person or many (ticked on Attendance setup > Schedules, or added in the drawer); the days before keep the list they had. A list in use, of each employee's company or of every company. From a day already passed, the holidays' dates since then are worked out again for them (2026-11-24) - only months of theirs already worked out. Their leave taking on-application holidays still to come that are not on the new list is cancelled (an approved one's days given back, the employee e-mailed); one already passed stays (2026-11-25).
- **Errors:** `400` an unknown code, a retired list, another company's list · `403` · `404` no such list · `409` a locked attendance month on or after the date.

### `attendance.holidayLists.ofEmployee`
- **HTTP:** `POST /api/rpc/attendance/holidayLists/ofEmployee` · **Code:** `backend/src/modules/attendance/holiday-lists/`
- **Access:** Logged in.
- **Scope:** one's own record, or Employees View covering the employee (`getEmployeeFor` - outside it `404`).
- **Input:** `{ employeeCode }`
- **Returns:** `{ holidayList {id, name} | null (none: no holidays), since, next {from, holidayList} | null }`.
- **What it does:** the holiday list the employee follows today - its name on the profile's Job tab (the user, 2026-11-25). Given / changed on Attendance setup > Schedules (`assign`).
- **Errors:** `404`.

### `attendance.holidayLists.fillMissing`
- **HTTP:** `POST /api/rpc/attendance/holidayLists/fillMissing` · **Code:** `backend/src/modules/attendance/holiday-lists/`
- **Access:** Attendance setup: Edit.
- **Scope:** the employees inside the viewer's Attendance setup **Edit** data access (`scopeOf`), employed today or joining later.
- **Input:** `{ dryRun? }` - true: only count.
- **Returns:** `{ withoutList, toGive, given, noDefault [{plant, employees}] }` - `noDefault`: plants without a default where people still wait, most first.
- **What it does:** everyone without any holiday list gets their plant's default (in use, of their company or every company) from their joining day - or the day after the last locked attendance month after it. For go-live and for employees added directly or imported (the joining day sets the list itself). The holidays' dates already passed are worked out again for them - only months of theirs already worked out (never days before attendance started).
- **Errors:** `403`.

### `attendance.holidayCategories.list`
- **HTTP:** `POST /api/rpc/attendance/holidayCategories/list` · **Code:** `backend/src/modules/attendance/holiday-categories/`
- **Access:** any logged-in employee; `includeInactive` needs Attendance setup: View.
- **Scope:** not limited by data access - one list shared by every company.
- **Input:** `{ includeInactive? }` (optional)
- **Returns:** `[{ id, name, tone (NEUTRAL | INFO | GOLD | POSITIVE | WARNING | NEGATIVE), isActive }]` by name.
- **What it does:** HR's holiday categories (2026-11-24 - National, Festival, Election...) and the colour each shows in (the app's pill tones).
- **Errors:** `403` retired ones without Attendance setup: View.

### `attendance.holidayCategories.create`
- **HTTP:** `POST /api/rpc/attendance/holidayCategories/create` · **Code:** `backend/src/modules/attendance/holiday-categories/`
- **Access:** Attendance setup: Edit.
- **Scope:** shared by every company - Attendance setup Edit for all companies (`assertGroupWide`, `403`).
- **Input:** `{ name (unique), tone }`
- **Returns:** the category.
- **What it does:** adds a holiday category.
- **Errors:** `400` · `403` · `409` the name is taken.

### `attendance.holidayCategories.update`
- **HTTP:** `POST /api/rpc/attendance/holidayCategories/update` · **Code:** `backend/src/modules/attendance/holiday-categories/`
- **Access:** Attendance setup: Edit.
- **Scope:** as `create`.
- **Input:** `{ id, name?, tone?, isActive? }`
- **Returns:** the category.
- **What it does:** renames, recolours or retires a category (a retired one is offered no more).
- **Errors:** `400` · `403` · `404` · `409` the name is taken.

### `attendance.punches.upload`
- **HTTP:** `POST /api/rpc/attendance/punches/upload` · **Code:** `backend/src/modules/attendance/punches/`
- **Access:** Attendance setup: Edit.
- **Scope:** punches only for employees inside the uploader's Attendance **Edit** data access - other rows are left out ("employee code X cannot be used here", without saying whose it is).
- **Input:** `{ file: File (.xlsx or .csv, up to 10 MB, 50 000 rows) }`
- **Returns:** `{ uploadId, rowCount, added, duplicates, unmatchedCodes, skipped, errors[] (first 50) }`.
- **What it does:** the biometric machines' export until the Kent feed is connected. Columns found by header: the employee code (Employee code / Emp Code / EmpId...), the time (Punch time / Date time... - or a Date and a Time column; when a "Punch time" / "Log time" column holds only a
time of day next to a Date column - the usual machine export - the two are read together, and a full date and time in it
wins over the Date column - 2026-11-23); a date is read as day-month-year (or year-month-day) and a day or month that does
not exist is skipped, not rolled over; a file is read as Excel only when it is one (else as CSV text), the machine (Device / Door..., optional). A time without a zone is the clock of the employee's work location (else Asia/Kolkata). The same punch (code + time) is kept once; a code that is no employee waits in `unmatched` (a code an employee had before a company transfer still matches them - 2026-11-20); a future time or an unreadable row is skipped, and so is a punch whose every day it may belong to (the day before, its own day, the day after) is in a locked attendance month (2026-11-23 - was judged by its calendar day alone; a locked day is never worked out again). The days of the punches are worked out at once. Punches are not in the change history (the upload is).
- **Errors:** `400` not readable, no code / time column, no rows, too many rows · `403`.

### `attendance.punches.uploads`
- **HTTP:** `POST /api/rpc/attendance/punches/uploads` · **Code:** `backend/src/modules/attendance/punches/`
- **Access:** Attendance setup: View.
- **Scope:** not limited by data access yet (the files uploaded by anyone with Attendance setup: View).
- **Input:** none
- **Returns:** `[{ id, fileName, rowCount, addedCount, duplicateCount, unmatchedCount, createdAt, by }]` the latest 30.
- **What it does:** the earlier uploads.
- **Errors:** `403`.

### `attendance.punches.unmatched`
- **HTTP:** `POST /api/rpc/attendance/punches/unmatched` · **Code:** `backend/src/modules/attendance/punches/`
- **Access:** Attendance setup: View.
- **Scope:** not limited by data access yet (codes that matched no employee).
- **Input:** none
- **Returns:** `[{ code, punches, first, last }]`.
- **What it does:** the codes on the machines that matched no employee.
- **Errors:** `403`.

### `attendance.punches.addManual`
- **HTTP:** `POST /api/rpc/attendance/punches/addManual` · **Code:** `backend/src/modules/attendance/punches/`
- **Access:** Attendance setup: Edit - **testing only** (2026-11-22): refused when the server runs in production (`NODE_ENV=production`); the screen shows it only in the dev build.
- **Scope:** the employee: Attendance setup Edit covering them (outside the View data access `404`, View only `403`).
- **Input:** `{ employeeCode, date, times: ["09:02", "18:10"] (1-10, HH:MM on the employee's work-location clock) }`
- **Returns:** `{ added, duplicates }`.
- **What it does:** adds punches typed by hand for one employee on one day - stored like uploaded punches (the same punch kept once), with the device "Manual entry (testing)" - and works the day (and the day before, for a night shift) out again.
- **Errors:** `400` a time in the future · `403` production, View only · `404` unknown employee or outside the data access · `409` a locked month.

### `attendance.punches.link`
- **HTTP:** `POST /api/rpc/attendance/punches/link` · **Code:** `backend/src/modules/attendance/punches/`
- **Access:** Attendance setup: Edit.
- **Scope:** Attendance setup Edit covering the employee (outside the View data access `404`, View only `403`).
- **Input:** `{ code, employeeCode }`
- **Returns:** `{ linked }`.
- **What it does:** gives every unmatched punch of a code to an employee; their days are worked out again.
- **Errors:** `403` · `404` unknown employee / no such unmatched code.

### `attendance.rosters.grid`
- **HTTP:** `POST /api/rpc/attendance/rosters/grid` · **Code:** `backend/src/modules/attendance/rosters/`
- **Access:** Attendance setup: View (part of the attendance setup since 2026-11-22 - until then a manager's team, an HOD's department or Attendance: View).
- **Scope:** only employees inside the caller's Attendance setup View data access.
- **Input:** `companyIds?`, `search?` (code or name), `from`, `to` (at most 6 weeks), `onlyChanges?` (2026-11-22: only the people with a roster day in the range)
- **Returns:** `{ days, shifts, canEdit (Attendance setup Edit), rows: [{ employeeCode, name, department, designation, cells: [{ date, entry {shiftId (null = off), published} | null, planned {kind, shiftId, holiday, halfDay}, warnings[] }] }] }` - `planned` the default without the roster (the default shift and weekly offs, or the rotation's day - 2026-11-22); `planned.halfDay` a half day of the default shift (a roster day is always whole; a half day counts its half in the week's hours); `warnings` on roster days: less than 11h rest after the day before, more than 48h in the week (warnings only - publishing is allowed).
- **What it does:** the roster - one-off changes from the default (2026-11-22): who works which shift on which day (a draft or published day, else the default). The 48-hour warning counts every day of the week (Monday-Sunday), also those not on screen (2026-11-23). The Roster screen asks `onlyChanges` and lists only the changed days.
- **Errors:** `400` range · `403`.

### `attendance.rosters.save`
- **HTTP:** `POST /api/rpc/attendance/rosters/save` · **Code:** `backend/src/modules/attendance/rosters/`
- **Access:** Attendance setup: Edit (2026-11-22 - managers no longer roster; their people ask with a shift-change request).
- **Scope:** each employee: Attendance setup Edit covering them (outside the View data access `404`, View only `403`) - managers no longer roster (2026-11-22).
- **Input:** `{ cells: [{ employeeCode, date, shiftId (null = off) }] (1-5000) }`
- **Returns:** `{ saved, removed }` - `removed` how many days were taken off because they were set back to the default.
- **What it does:** sets days of the draft - any day; a published day stays published and is worked out again. A day set to what the default gives (shift and weekly offs, or the rotation's day) is not kept: its row is taken out, draft or published (2026-11-22 - the roster holds only real changes); a holiday or a half day by default is always kept.
- **Errors:** `400` retired shift, a locked month · `403` View only · `404` outside the data access.

### `attendance.rosters.clear`
- **HTTP:** `POST /api/rpc/attendance/rosters/clear` · **Code:** `backend/src/modules/attendance/rosters/`
- **Access:** as `save`.
- **Scope:** each employee: Attendance setup Edit covering them (outside the View data access `404`, View only `403`) - managers no longer roster (2026-11-22).
- **Input:** `{ cells: [{ employeeCode, date }] }`
- **Returns:** `{ cleared }`.
- **What it does:** takes draft days out (back to the default shift); published days stay.
- **Errors:** `403` · `404`.

### `attendance.rosters.publish`
- **HTTP:** `POST /api/rpc/attendance/rosters/publish` · **Code:** `backend/src/modules/attendance/rosters/`
- **Access:** as `save`.
- **Scope:** each employee: Attendance setup Edit covering them (outside the View data access `404`, View only `403`) - managers no longer roster (2026-11-22).
- **Input:** `{ employeeCodes (1-2000), from, to }`
- **Returns:** `{ published }`.
- **What it does:** publishes the draft days of these employees in the range - attendance follows them; days already come are worked out again.
- **Errors:** `400` · `403` · `404`.

### `attendance.shiftChanges.create`
- **HTTP:** `POST /api/rpc/attendance/shiftChanges/create` · **Code:** `backend/src/modules/attendance/shift-changes/`
- **Access:** any logged-in employee (their own). **Employee self-service only** (2026-11-25, `selfServiceProcedure`): no active role - `403` while a role is active ("Switch to Employee self-service"), even for a Super Admin.
- **Scope:** not limited by data access - the caller's own.
- **Input:** `{ date (today onwards), kind: CHANGE | SWAP, requestedShiftId? (CHANGE: a shift id or null = off), swapWithCode? (SWAP), reason (3-500) }`
- **Returns:** the request `{ id, employee, date, kind, requestedShift, swapWith, reason, status (PENDING | APPROVED | REJECTED | CANCELLED), approvalRequestId, approval {status, held, closedAt, closedById, step {stepNo, of, who, approver, byFallback, late} | null} | null, createdAt }`.
- **What it does:** asks to change one day and raises its approval request (the approval service, kind `SHIFT_CHANGE` - 2026-11-22;
  its chain on the Approval rules page, seeded: reporting manager -> Attendance: Edit, 72 h each); the approvers decide on
  the Approvals page. Approved: the roster day - both days in a swap - is set and published at once, days already come are
  worked out again, the colleague of a swap is e-mailed. Not on a holiday; one open request per day; a swap needs the
  colleague working that day on another shift.
- **Errors:** `400` past day, not employed, holiday, same shift, swapping with oneself · `404` colleague · `409` already asked that day, or the shift-change chain is switched off.

### `attendance.shiftChanges.cancel`
- **HTTP:** `POST /api/rpc/attendance/shiftChanges/cancel` · **Code:** `backend/src/modules/attendance/shift-changes/`
- **Access:** the employee (their own request). **Employee self-service only** (2026-11-25, `selfServiceProcedure`): no active role - `403` while a role is active ("Switch to Employee self-service"), even for a Super Admin.
- **Scope:** not limited by data access - the caller's own.
- **Input:** `{ id }`
- **Returns:** the request, `CANCELLED`.
- **What it does:** takes back a request still waiting - its approval request is cancelled too.
- **Errors:** `404` · `409` already decided.

### `attendance.shiftChanges.mine`
- **HTTP:** `POST /api/rpc/attendance/shiftChanges/mine` · **Code:** `backend/src/modules/attendance/shift-changes/`
- **Access:** any logged-in employee.
- **Scope:** not limited by data access - the caller's own.
- **Input:** none
- **Returns:** the viewer's requests (latest 50), as `create`.
- **What it does:** the employee's requests and where they stand (who has its approval now).
- **Errors:** `401`.

### `attendance.regularizations.create`
- **HTTP:** `POST /api/rpc/attendance/regularizations/create` · **Code:** `backend/src/modules/attendance/regularizations/`
- **Access:** any logged-in employee (their own). **Employee self-service only** (2026-11-25, `selfServiceProcedure`): no active role - `403` while a role is active ("Switch to Employee self-service"), even for a Super Admin.
- **Scope:** not limited by data access - the caller's own.
- **Input:** `{ kind: MISSED_PUNCH | ON_DUTY, fromDate, toDate (>= fromDate, at most 31 days), portion: FULL_DAY | FIRST_HALF | SECOND_HALF (a half: one day only), reason (5-500) }`
- **Returns:** the request `{ id, employee {employeeCode, name}, kind, fromDate, toDate, portion, reason, status (PENDING | APPROVED | REJECTED | CANCELLED), approvalRequestId, approval {status, held, closedAt, closedById, step {...} | null} | null, createdAt }`.
- **What it does:** (2026-11-22, the old HRMS's "attendance regularisation" and "official duty") raises its approval request
  (kind `REGULARIZATION` or `ON_DUTY`; seeded: the reporting manager, 48 h, then escalated to their manager). Approved, the
  working halves it covers are PRESENT (missed punch) / ON_DUTY on the attendance days - days already come are worked out
  again, days to come show it; weekly offs and holidays inside stay so; HR's correction still wins. Rules: at most 30 days
  back; a missed punch only for days already come; no day of a locked attendance month; employed on every day; at least
  one working half; no half already on leave or asked for (approved or waiting).
- **Errors:** `400` too far back, a missed punch for a day to come, too long, not employed, only off days, half day over several days · `409` already leave / a request on a half, a locked month, the chain switched off.

### `attendance.regularizations.cancel`
- **HTTP:** `POST /api/rpc/attendance/regularizations/cancel` · **Code:** `backend/src/modules/attendance/regularizations/`
- **Access:** the employee (their own request). **Employee self-service only** (2026-11-25, `selfServiceProcedure`): no active role - `403` while a role is active ("Switch to Employee self-service"), even for a Super Admin.
- **Scope:** not limited by data access - the caller's own (another's request: `404`).
- **Input:** `{ id }`
- **Returns:** the request, as `create`.
- **What it does:** withdraws a request still waiting - its approval request is cancelled too (better than the old HRMS, which had no withdraw).
- **Errors:** `404` · `409` already decided.

### `attendance.regularizations.mine`
- **HTTP:** `POST /api/rpc/attendance/regularizations/mine` · **Code:** `backend/src/modules/attendance/regularizations/`
- **Access:** any logged-in employee.
- **Scope:** not limited by data access - the caller's own.
- **Input:** none
- **Returns:** the viewer's requests (latest 50), as `create`.
- **What it does:** the employee's regularization / on-duty requests and where they stand.
- **Errors:** `401`.

## approvals

One approval service every feature uses (the user, 2026-11-20 - `backend/src/modules/approvals/`): a feature raises a
request about an employee; it follows the **chain** of its kind(s) one step at a time (a promotion with a hike follows the
job and the salary chain, merged - each approver asked once); the final decision goes back to the feature in the same
transaction. A step is the reporting manager, the functional manager, the HOD, anyone holding a role, or anyone with an
access at Edit - the last three only within their data access (and, for a move, covering where it goes too). A manager /
HOD step with nobody to decide it is **skipped** with the reason; a role / access step nobody holds goes to the **fallback
approver** (the role marked so - seeded "Admin" - covering the employee). The chains and the held requests are their own access area, **Approval chains** (2026-11-20); a request whose every step was skipped gets a
fallback step. If even the fallback approver has nobody, the request is **held** - never approved by itself - until its
routing is repaired and it is sent through again (the daily job `approvals.daily` retries held ones, gives steps to a new
manager / HOD, and cancels requests of employees who left; a role / access / fallback step whose approvers are all gone - left, lost the login, the role or the data access - goes to the fallback approver, or the request is held, 2026-11-23; reminders follow each step's SLA). Nobody decides a request about
themselves or one they raised.

**SLA** (2026-11-20, the old HRMS's SLA plus "wait"): each chain step has SLA hours and an action on breach - `WAIT`
(the default: nothing moves and only its approver decides, even late; the SLA only sets the reminder - they are e-mailed
each time the SLA hours pass, and the first reminder marks the step late; **without SLA hours: wait with no reminder**,
never late), `ESCALATE` (the step ends as `ESCALATED` and a new step is added right after it: the role named on
the step, else the late approver's own reporting manager - an `ESCALATION` step, which escalates again up the line when
late - else the fallback approver), `AUTO_APPROVE`, `AUTO_REJECT`, or `EXPIRE` (the request ends as `EXPIRED`; the feature
records it as cancelled with the reason) - these need SLA hours. A fallback step the service adds itself waits with a
72-hour reminder. The due time is set when a step opens (again when the daily job gives it to a new manager). The hourly
job `approvals.timeLimits` sends the reminders and takes every other action once; a decision made a moment before wins.

**Switched off** (2026-11-20, as the old HRMS): a chain can be made inactive - new requests of its kind are then refused
(`409`) for the company of a company's own chain, or for every company without its own for the shared chain. Requests
already raised go on.

### `approvals.listToDecide`
- **HTTP:** `POST /api/rpc/approvals/listToDecide` · **Code:** `backend/src/modules/approvals/`
- **Access:** any logged-in employee. Per portal (2026-11-25): in Employee self-service (no active role) only the steps named to the viewer (manager, HOD, escalation); in the role portal only the role / access / fallback steps of the active role.
- **Scope:** In Employee self-service (no active role) the steps named to the viewer; in the role portal the active role's role / access / fallback steps (2026-11-25). steps named to the viewer (as reporting / functional manager or HOD, or - a late step escalated - as the late approver's reporting manager: the relationship, CLAUDE.md section 8 rule 7) and role / access / fallback steps whose holders' data access covers the employee (and a move's new place) - never one about the viewer or raised by them.
- **Input:** none.
- **Returns:** `[{ id, feature, label (its kinds in words - "Salary revision", "Job / position change + Salary revision"), status, summary, employee {employeeCode, name}, requestedBy, raisedAt, closedAt, held, step
  {stepNo, of, who, approver, byFallback, note, openedAt, dueAt, late}, link }]`, the oldest-waiting first. `status` also
  `EXPIRED` (not decided in time, its chain said so).
- **What it does:** the Approvals page's "Waiting for me".
- **Errors:** `401`.

### `approvals.countToDecide`
- **HTTP:** `POST /api/rpc/approvals/countToDecide` · **Code:** `backend/src/modules/approvals/`
- **Access:** any logged-in employee. Per portal, as `listToDecide` (2026-11-25).
- **Scope:** as `listToDecide`.
- **Input:** none.
- **Returns:** a number.
- **What it does:** how many requests wait for the viewer's decision (the count next to Approvals in the menu).
- **Errors:** `401`.

### `approvals.listMine`
- **HTTP:** `POST /api/rpc/approvals/listMine` · **Code:** `backend/src/modules/approvals/`
- **Access:** any logged-in employee. Per portal (2026-11-25): in Employee self-service the requests about the viewer; in the role portal the ones they raised about others.
- **Scope:** In Employee self-service the requests about the viewer, in the role portal the ones they raised about others (2026-11-25). the viewer's own requests (they raised them).
- **Input:** none.
- **Returns:** the latest 100, as in `listToDecide`.
- **What it does:** the Approvals page's "Raised by me".
- **Errors:** `401`.

### `approvals.listDecided`
- **HTTP:** `POST /api/rpc/approvals/listDecided` · **Code:** `backend/src/modules/approvals/`
- **Access:** any logged-in employee. Per portal (2026-11-25): in Employee self-service the decisions on named steps (manager, HOD, escalation); in the role portal those on role / access / fallback steps.
- **Scope:** Per portal: decisions on named steps in Employee self-service, on role / access / fallback steps in the role portal (2026-11-25). the viewer's own decisions - requests in which they approved or rejected a step (they could see each when deciding); not limited by data access otherwise.
- **Input:** none.
- **Returns:** the latest 200 (by when raised), as in `listToDecide`, each with `decision: { status (APPROVED | REJECTED), decidedAt, comment }` - the viewer's own (the last, if they decided several steps); the latest decision first.
- **What it does:** the Approvals page's "Decided by me" (the user, 2026-11-22): what the viewer approved or rejected and where each request stands now.
- **Errors:** `401`.

### `approvals.get`
- **HTTP:** `POST /api/rpc/approvals/get` · **Code:** `backend/src/modules/approvals/`
- **Access:** any logged-in employee who may see it (checked in the service).
- **Scope:** the requester, someone who decided or is named to a step, someone who may decide the open step, someone who may repair it while held (Approval chains Edit covering the employee), or as the feature allows (job changes: Employees View covering the employee) - else `404`.
- **Input:** `{ id: number }`
- **Returns:** `{ id, feature, label (as in listToDecide), kinds [{kind, label}], status, summary, employee, requestedBy, raisedAt, closedAt, closedBy,
  cancelReason, held {at, reason} | null, steps [{ stepNo, who, approverType, status, byFallback, note, seesConfidential, approver,
  openedAt, decidedAt, decidedBy, comment, slaHours, onBreach, escalateRoleName, dueAt, breachedAt, autoDecided, late }],
  canDecide, canCancel, canRetry, seesConfidential, link }`. A step's `status`: `WAITING` (not reached) | `OPEN` | `APPROVED` |
  `REJECTED` | `SKIPPED` | `CANCELLED` | `ESCALATED` (not decided in time, passed to the step after it); `approverType` also
  `FALLBACK` and `ESCALATION` (the late approver's manager). `autoDecided`: approved / rejected by its time limit, not a person.
- **What it does:** one request with its whole trail.
- **Errors:** `400` invalid input · `404 NOT_FOUND`.

### `approvals.decide`
- **HTTP:** `POST /api/rpc/approvals/decide` · **Code:** `backend/src/modules/approvals/`
- **Access:** the open step's approver (checked in the service). A named step only in Employee self-service (no active role); a role / access / fallback step only with that role active (2026-11-25) - otherwise `403`.
- **Scope:** A named step in Employee self-service only, a role / access / fallback step with that role active only (2026-11-25). a named step (manager / HOD, or an escalation to the late approver's manager): the person it is named to; a role / access / fallback step: someone holding it whose data access covers the employee (and a move's new place); never the employee themselves nor the requester (`403`); not visible to the viewer `404`.
- **Input:** `{ id: number, approve: boolean, comment?: string (1-500 - required to reject) }`
- **Returns:** the request (as `get`).
- **What it does:** approves or rejects the step that waits. Approved: the next step someone can decide opens (vacant
  manager / HOD steps skipped); after the last, the request is approved and the feature acts on it (a job change applies
  at once if its day has come). Rejected: the request ends, the feature records it. The decision saves only if the step is
  still open; e-mails follow (the next approvers, the requester).
- **Since 2026-11-23 (the review):** approving a leave cancel of a year whose year end has passed is refused (`409`); an approved comp-off uses the expiry rule of `leave.compOff.claim`.
- **Errors:** `400` no reason to reject · `403` not this step's approver · `404` · `409 CONFLICT` already decided, held, or
  decided by someone a moment before.

### `approvals.cancel`
- **HTTP:** `POST /api/rpc/approvals/cancel` · **Code:** `backend/src/modules/approvals/`
- **Access:** the requester, or as the feature allows (job changes: Employees Edit covering the employee). Withdrawing one's own request (raised by the viewer about themselves) only in Employee self-service (`403` while a role is active - 2026-11-25).
- **Scope:** as above; not visible to the viewer `404`.
- **Input:** `{ id: number, reason?: string (1-500) }`
- **Returns:** the request.
- **What it does:** takes back a request still waiting - its steps end and the feature records it as cancelled. The
  request is closed only if it is still waiting at that moment (2026-11-23: a cancel landing just after the last
  approval used to write "cancelled" over it while the change was applied).
- **Errors:** `400` · `403` · `404` · `409` already decided (also "decided a moment ago" when an approval closed it
  while the cancel ran).

### `approvals.listHeld`
- **HTTP:** `POST /api/rpc/approvals/listHeld` · **Code:** `backend/src/modules/approvals/`
- **Access:** Approval chains: Edit.
- **Scope:** held requests of employees inside the viewer's Approval chains Edit data access.
- **Input:** none.
- **Returns:** as `listToDecide` (with `held.reason`).
- **What it does:** the requests nobody can decide - the routing to repair (give the role, appoint the HOD, change the chain).
- **Errors:** `403`.

### `approvals.retryRouting`
- **HTTP:** `POST /api/rpc/approvals/retryRouting` · **Code:** `backend/src/modules/approvals/`
- **Access:** Approval chains: Edit.
- **Scope:** Approval chains Edit covering the employee (`403`; not visible `404`).
- **Input:** `{ id: number }`
- **Returns:** the request.
- **What it does:** sends a held request through its chain again after its routing was repaired - the step it stopped at is
  worked out afresh. It never approves anything by itself.
- **Since 2026-11-23 (the review):** a request held and released (or closed) a moment before is left alone - `409` "This request is not held".
- **Errors:** `403` · `404` · `409` not held.

### `approvals.chains.list`
- **HTTP:** `POST /api/rpc/approvals/chains/list` · **Code:** `backend/src/modules/approvals/chains/`
- **Access:** Approval chains: View.
- **Scope:** not limited by data access (settings shared by every company). The role / access holders listed are a picker of
  names (code + name) across every company - a step can be named to any holder whose access covers the chain's whole reach.
- **Input:** none.
- **Returns:** `{ kinds: [{ kind, label, confidential (what the confidential part is, or null), chains [{ companyId | null, company {code, name} | null, isActive,
  steps [{ approverType, roleId, roleName, accessArea, approverId, approver {employeeCode, name} | null, seesConfidential, slaHours, onBreach, escalateRoleId, escalateRoleName }], updatedAt, updatedBy }] }],
  roles: [{ id, name, isApprovalFallback, holders }], areas: [{ area, label, holders }] }` - every kind (`JOB_CHANGE` "Job / position change", `SALARY_REVISION` "Salary revision", `SHIFT_CHANGE` "Shift change" - 2026-11-22), and what a step can
  name (whoever sets chains need not have Roles & access). `holders`: `[{ employeeId, employeeCode, name, everyCompany, companyIds }]` - who holds the
  role (its own data-access rows) / the access (at Edit, over all their roles) and can sign in, and how far whole: every company (`everyCompany`, may be
  picked on the shared chain) or each whole company (`companyIds`, may be picked on that company's own chain).
- **What it does:** the "Approval chains" page (its own access area since 2026-11-20, apart from Roles & access).
- **Errors:** `403`.

### `approvals.chains.save`
- **HTTP:** `POST /api/rpc/approvals/chains/save` · **Code:** `backend/src/modules/approvals/chains/`
- **Access:** Approval chains: Edit.
- **Scope:** the shared chain (companyId null) is shared by every company - needs Approval chains Edit for **all companies**; a company's own chain needs Approval chains Edit for that **whole company** (`403`).
- **Input:**

  | Field | Type | Required | Rules |
  |---|---|---|---|
  | `kind` | `JOB_CHANGE` \| `SALARY_REVISION` \| `SHIFT_CHANGE` | yes | |
  | `companyId` | number \| null | yes | null = the shared chain; else a company |
  | `isActive` | boolean | no | default true; false = new requests of the kind are refused (those raised go on) |
  | `steps` | array (1-10) | yes | in order: `{ approverType: REPORTING_MANAGER \| FUNCTIONAL_MANAGER \| HOD \| ROLE \| ACCESS, roleId? (ROLE), accessArea? (ACCESS), seesConfidential (default false), slaHours? (1-2160; null only with WAIT = wait with no reminder), onBreach (WAIT \| ESCALATE \| AUTO_APPROVE \| EXPIRE \| AUTO_REJECT, default WAIT - WAIT reminds every SLA hours), escalateRoleId? (ESCALATE only; empty = the late approver's manager / the fallback approver), approverId? (ROLE / ACCESS only: one holder who alone decides it - must hold the role / access, and sign in, for every company on the shared chain or the whole company on its own; empty = anyone holding it) }` - no two steps decided by the same people |

- **Returns:** `{ kind, companyId, isActive, saved: true }`
- **What it does:** creates the chain or replaces its steps, and switches it on / off. Requests already raised keep the steps they were given.
  A step named to one holder opens only for them; if they cannot decide a request (left, no login, the role or data access changed, or it is
  about them / raised by them) the fallback approver decides it, with a note why.
- **Errors:** `400` a ROLE step without an existing role, an ACCESS step without an area, a named holder who does not hold
  the role / access over the chain's whole reach, an action other than WAIT without SLA hours, a role to escalate to that does not exist (or the step's own role), two steps alike · `403` · `404` unknown company.

### `approvals.chains.remove`
- **HTTP:** `POST /api/rpc/approvals/chains/remove` · **Code:** `backend/src/modules/approvals/chains/`
- **Access:** Approval chains: Edit.
- **Scope:** Approval chains Edit for the whole company (`403`).
- **Input:** `{ kind, companyId: number }`
- **Returns:** `{ kind, companyId, removed: true }`
- **What it does:** removes a company's own chain - its requests then follow the shared chain.
- **Errors:** `403` · `404` the company has no chain of its own for that kind.

## jobChanges

Job changes through approval (the user, 2026-11-20 - `backend/src/modules/job-changes/`): a promotion, transfer, company
transfer, redesignation, change of manager... and / or a salary revision (alone, or with the job change), asked by HR with a
reason from a day on. It goes through the approval chain(s) (`approvals`), then applies on its day - at once if the day has
come, else by the daily job `jobChanges.applyDue`, which checks everything again first (one it cannot apply stays approved
with the reason, `applyError`, and is tried again each night). Applying changes the employee, writes the job-timeline entry
(`employees.jobHistory.list`) and / or the salary row (`employees.salaryHistory`), and e-mails the employee (never the
salary figures). One open change per employee at a time (waiting for approval, or approved and waiting for its day).

### `jobChanges.create`
- **HTTP:** `POST /api/rpc/jobChanges/create` · **Code:** `backend/src/modules/job-changes/`
- **Access:** the job part: Request job changes: Edit; the salary part: Request salary changes: Edit and Employee · Salary: View
  (to start from the salary in force) - their own areas since 2026-11-21 (Employees Edit and Employee · Salary Edit no longer
  raise changes); checked in the service. A promotion with a hike needs both.
- **Scope:** the employee inside the caller's Employees View data access (`404` outside), never the caller themselves (`403`, 2026-11-21); the job part: Request job changes Edit covering the employee (`403`) - for a move (plant / department / company) also covering where they go (`403`); the salary part: Request salary changes Edit and Employee · Salary View covering the employee (`403`). Its approvers must cover both places too.
- **Input:**

  | Field | Type | Required | Rules |
  |---|---|---|---|
  | `employeeCode` | string | yes | an employee who has not left |
  | `effectiveFrom` | Date | yes | job details: after the latest timeline entry; a salary: after the latest salary and not before joining - a correction: exactly the day of a salary already saved |
  | `kind` | `PROMOTION` \| `TRANSFER` \| `COMPANY_TRANSFER` \| `REDESIGNATION` \| `MANAGER_CHANGE` \| `SALARY_REVISION` \| `SALARY_CORRECTION` \| `OTHER` | yes | `SALARY_*` change the salary only; a change of company is a `COMPANY_TRANSFER` |
  | `reason` | string | yes | 1-500 chars |
  | `companyId` | number | for `COMPANY_TRANSFER` | another active company with a code series; then `plantId` and `departmentId` are required |
  | `plantId`, `departmentId` | number | no | a plant of the (new) company - a newly chosen one active; the department runs there |
  | `workLocationId`, `designationId`, `gradeId`, `positionId` | number \| null | no | `null` clears |
  | `costCenterId` | number \| null | no | an active cost centre of the (new) company - on a company transfer always checked against the new company, also when it is the employee's present one (2026-11-23); a company transfer without one clears it |
  | `reportingManagerCode` | string \| null | no | an employee who has not left, not the employee, no loop |
  | `functionalManagerCode` | string \| null | no | an employee who has not left, not the employee |
  | `employmentType`, `workforceCategory` | enum | no | |
  | `salary` | object | for `SALARY_*` | `{ annualCtc (int > 0), performancePayAnnual? (int \| null), currency? (3 letters, default the current salary's), lines [{ salaryComponentId, monthlyAmount (up to 2 decimals) }] (1-50, each component once, active, not a `DEDUCTION`, total = annualCtc / 12 to the paisa) }` |

- **Returns:** the change, as `get`.
- **What it does:** raises the request for approval - the job chain when job details change, the salary chain when the salary
  does (both merged for a promotion with a hike). Nothing changes until it is approved and its day comes. Applying a company
  transfer gives the next code of the new company's series (the old code still signs them in, finds them and matches their
  old punches - `employee_former_codes`) and moves their document and letter files to the new code's folder; made
  `PERMANENT`, the contract end date is cleared.
- **Since 2026-11-23 (the review):** the retired-master check runs again on the apply day (a master retired meanwhile fails the apply, as a plant / cost centre already did).
- **Errors:** `400` invalid input, a day rule, nothing changes, a plant / department / cost-centre / manager / salary rule ·
  `403` (see Scope), or a change of one's own job / salary · `404` unknown employee or outside the data access · `409 CONFLICT` the employee already has an open change,
  or the approval chain of its kind (job change / salary revision) is switched off for the employee's company. Â· `400` "<master> X is no longer in use - choose one that is" - a retired company, department, work location, designation, grade or position chosen anew (one the employee already has is kept - 2026-11-23)

### `jobChanges.get`
- **HTTP:** `POST /api/rpc/jobChanges/get` · **Code:** `backend/src/modules/job-changes/`
- **Access:** any logged-in employee who may see it (checked in the service).
- **Scope:** Employees View covering the employee, or the people of its approval (`approvals.get`); the employee themselves whatever its status (2026-11-21 - their "Overview") - else `404`. The salary figures: an approver only while their step set to see them is open (not after deciding - 2026-11-21), or Employee · Salary View covering the employee (the employee themselves always) (else `salary` null, `salaryHidden` true).
- **Input:** `{ id }` or `{ approvalRequestId }` (exactly one)
- **Returns:** `{ id, employee {employeeCode, name}, effectiveFrom, kind, kindLabel, reason, status, statusLabel, changes [{ field, label,
  from, to }] (a company transfer: the company first), salary {annualCtc, performancePayAnnual, currency, lines, replaced {...} | null,
  changePercent} | null, salaryHidden, applyError, appliedAt, appliedBy, cancelledAt, cancelledBy, cancelReason, raisedAt, requestedBy,
  approvalRequestId, approval {status, held, closedAt, closedById, step {stepNo, of, who, approver, byFallback, late} | null} | null,
  canCancel }`. `status`: `PENDING` (waiting for approval) | `APPROVED` (waits for its day, or not applied) | `APPLIED` (in force) |
  `REJECTED` | `CANCELLED`. `from`: in force just before it applied (while not applied: now).
- **What it does:** one job change - the Approvals page, the Pay & career page (all three sections) and the employee's Job tab show it.
- **Errors:** `400` · `404`.

### `jobChanges.list`
- **HTTP:** `POST /api/rpc/jobChanges/list` · **Code:** `backend/src/modules/job-changes/`
- **Access:** without `mine`: Employees: View (`403`, checked in the service); with `mine`: any logged-in employee.
- **Scope:** without `mine`: only changes of employees inside the caller's Employees View data access. `mine: 'ABOUT_ME'`: only
  the changes of the caller themselves; `mine: 'ASKED_BY_ME'`: only the changes the caller asked for - relationships, not rows
  (the caller's own id, never one from the request), so not limited by data access.
- **Input (optional):** `{ mine?: 'ABOUT_ME' | 'ASKED_BY_ME' (not with employeeCode), employeeCode?, statuses?: status[], kinds?: kind[],
  companyIds?: number[], from?: Date, to?: Date (the day it applies from, between), page = 1, pageSize = 50 (1-200) }`
- **Returns:** `{ items: [{ id, employee, effectiveFrom, kind, kindLabel, reason, status, statusLabel, changed (labels), hasSalary,
  applyError, raisedAt, requestedBy, approval }], total, page, pageSize }` - the latest asked first. No salary figures.
- **What it does:** the Pay & career page (2026-11-21, was "Job changes"): "Change register" (without `mine`), "Raise a change"
  (`ASKED_BY_ME`, grouped pending / approved + in force / rejected / cancelled) and "Overview" (`ABOUT_ME`, the ones not in
  force); and the changes not in force yet on an employee's Job tab.
- **Errors:** `400` (also `mine` with `employeeCode`) · `403` · `404` an `employeeCode` outside the data access.

### `jobChanges.export`
- **HTTP:** `POST /api/rpc/jobChanges/export` · **Code:** `backend/src/modules/job-changes/`
- **Access:** Employees: View.
- **Scope:** as `list`.
- **Input (optional):** the filters of `list`, no paging.
- **Returns:** a file `job-changes-YYYY-MM-DD.xlsx` (up to 20 000 rows): code, name, kind, from, what changes, reason, status,
  waiting for, not applied because, asked by / on. No salary figures.
- **What it does:** the list as Excel.
- **Errors:** `400` · `403`.

- **Review format (2026-11-24):** shared Excel review-report formatting and separate Review notes sheet described above; existing data columns and authorization retained. More than 20,000 matching records returns `400 BAD_REQUEST` with instructions to narrow filters; no silently truncated workbook.

### `jobChanges.cancel`
- **HTTP:** `POST /api/rpc/jobChanges/cancel` · **Code:** `backend/src/modules/job-changes/`
- **Access:** waiting for approval: the requester, or Employees: Edit covering the employee; approved and not in force: Employees: Edit covering the employee.
- **Scope:** as Access; outside the caller's view `404`.
- **Input:** `{ id: number, reason?: string (1-500) }`
- **Returns:** the change, as `get`.
- **What it does:** cancels a change not in force yet - one waiting for approval cancels its approval too. The employee's
  slot for a new change is free again. An approved change is cancelled only if it is still approved at that moment, and
  applying one only if it is still approved (2026-11-23 - a cancel and the apply landing together no longer leave a
  cancelled change in force).
- **Errors:** `403` · `404` · `409` in force, rejected or cancelled already (also "applied a moment ago").

## leave

Leave (2026-11-22 - built after the old HRMS's rules: lv.leave_types, lv.ledger, lv.applications). Balances are a ledger
(credits / debits as rows, the balance their sum); applications are approved through the approval service (kinds `LEAVE`
and `LEAVE_CANCEL`); approved leave shows on the attendance days (`LEAVE` halves - see `attendance.days.myMonth`). The
leave year is the calendar year.

### `leave.overview`
- **HTTP:** `POST /api/rpc/leave/overview` · **Code:** `backend/src/modules/leave/`
- **Access:** Logged in.
- **Scope:** not limited by data access - counts of the caller's own reporting tree / HOD department, and the caller's own access.
- **Input:** none
- **Returns:** `{ teamSize, departmentSize, canSeeAll (Leave: View), canEdit (Leave: Edit) }`
- **What it does:** what the leave pages show first (which views exist).
- **Errors:** `401`.

### `leave.types.list`
- **HTTP:** `POST /api/rpc/leave/types/list` · **Code:** `backend/src/modules/leave/types/`
- **Access:** Logged in; retired types only with Leave: View.
- **Scope:** not limited by data access - a list shared by every company.
- **Input:** `{ includeInactive? }` (optional)
- **Returns:** `[{ id, code, name, isPaid, creditPerMonth, creditAfterMonths, maxCarryForward, maxPerRequest, allowHalfDay, countsOffDays, noticeDays, todayOrPastOnly, maxDaysBack (when it may be applied for - 2026-11-24), genders, employmentTypes, isCompOff, holidaysOnly, isActive, creditsFrom (the first month credited under the credit rules in force - 2026-11-23), createdAt }]`
- **What it does:** the leave types and their rules (seeded with the old HRMS's: CL, SL, EL, CO, ML, LWP).
- **Errors:** `401`.

### `leave.types.create`
- **HTTP:** `POST /api/rpc/leave/types/create` · **Code:** `backend/src/modules/leave/types/`
- **Access:** Leave: Edit.
- **Scope:** shared by every company - Leave Edit for all companies (`assertGroupWide`).
- **Input:** `{ code (1-10 capitals / digits), name, isPaid, creditPerMonth (0-31, 2 decimals), creditAfterMonths (0-120), maxCarryForward (null = all carries; 0 = all lapses), maxPerRequest (null = no limit; 0.5 steps), allowHalfDay, countsOffDays, noticeDays? (0-365: at least that many calendar days before the first leave day - EL 7, CL 3; null / 0 / left out = none - 2026-11-24), todayOrPastOnly? (only for today or days passed - sick leave; not with notice), maxDaysBack? (0-365: the first day at most that many days ago; null / left out = any day of an open attendance month), genders: Gender[] (empty = all), employmentTypes: EmploymentType[] (empty = all), isCompOff? (comp-off claims are credited to it - one paid type; 2026-11-22), holidaysOnly? (taken only on its holiday dates - the on-application holidays naming it; paid, not the comp-off one; its carry forward is always 0 - 2026-11-24), isActive? }`
- **Returns:** the type, as `list`.
- **What it does:** adds a leave type. Its monthly credits start on the 1st of the month after it is added (`creditsFrom`).
- **Errors:** `400` (an unpaid type with a credit, an unpaid comp-off type) · `403` · `409` the code / name exists, another type already receives comp-off.

### `leave.types.update`
- **HTTP:** `POST /api/rpc/leave/types/update` · **Code:** `backend/src/modules/leave/types/`
- **Access:** Leave: Edit.
- **Scope:** shared by every company - Leave Edit for all companies (`assertGroupWide`).
- **Input:** as `create` + `id` + `creditsFrom?: date` (any day of the month the changed credit rules credit from - required when `creditPerMonth`, `creditAfterMonths`, `genders`, `employmentTypes` change or a retired type is put back in use).
- **Returns:** the type.
- **What it does:** changes a type's rules or retires it (`isActive: false` - never deleted). Paid / unpaid cannot change once the type has balance rows or applications (old HRMS - add a new type). A change of who is credited what credits from the month HR picks (the user, 2026-11-23 - as Keka and Zoho People work from an effective date; before, every month back to when the type was added was credited at once to whoever it now covered): months before it are never credited by the job; an earlier month back-dates on purpose (not before the month after the type was added).
- **Errors:** `400` (also: credit rules changed without `creditsFrom`, a month before the type's first) · `403` · `404` · `409` paid / unpaid of a used type, the code / name exists.

### `leave.balances.get`
- **HTTP:** `POST /api/rpc/leave/balances/get` · **Code:** `backend/src/modules/leave/balances/`
- **Access:** Logged in - one's own; someone in the caller's reporting tree or HOD department; anyone else with Leave: View.
- **Scope:** one's own; the reporting tree / HOD department (relationships); anyone else: Leave View covering the employee (else `404`).
- **Input:** `{ employeeCode? (empty = one's own), year? (empty = this year) }` (optional)
- **Returns:** `{ employee {employeeCode, name}, year, balances: [{ leaveType {id, code, name, isPaid, allowHalfDay}, balance (null: unpaid), pending, available (balance - pending; null: unpaid), credited (with comp-off earned), adjusted, taken, lapsed (with comp-off expired) (in the year) }], entries: [{ id, leaveType {code, name}, kind (CREDIT | TAKEN | RETURNED | LAPSE | ADJUSTMENT | COMP_OFF | EXPIRED), what, days (+/-), date, leave {fromDate, toDate} | null, note, expiresOn (a comp-off credit), by {employeeCode, name} | null (System), at }], canAdjust }` - the types shown: the active ones that apply to the employee (gender, employment type) and any other with days.
- **What it does:** an employee's balances and the rows behind them (the year's).
- **Errors:** `404`.

### `leave.balances.register`
- **HTTP:** `POST /api/rpc/leave/balances/register` · **Code:** `backend/src/modules/leave/balances/`
- **Access:** TEAM / DEPARTMENT: Logged in; ALL: Leave: View.
- **Scope:** DIRECT (2026-11-27, the self-service home): only the people who report to the caller directly (the relationship, like TEAM); TEAM: the caller's reporting tree; DEPARTMENT: the employees of the places the caller heads as HOD (relationships); ALL: only employees inside the caller's Leave View data access.
- **Input:** `{ scope: DIRECT | TEAM (default) | DEPARTMENT | ALL, companyIds?, departmentIds?, search?, year? }`
- **Returns:** `{ year, types: [{id, code, name, isPaid}], rows: [{ employeeCode, name, company, department, balances: { [typeId]: { balance, pending, taken } }, canAdjust }] }`
- **What it does:** the leave register: everyone in the scope with their balance of each active type (employed in the year).
- **Errors:** `400` · `403`.

### `leave.balances.export`
- **HTTP:** `POST /api/rpc/leave/balances/export` · **Code:** `backend/src/modules/leave/balances/`
- **Access:** as `register`.
- **Scope:** DIRECT (2026-11-27, the self-service home): only the people who report to the caller directly (the relationship, like TEAM); as `register`.
- **Input:** as `register`.
- **Returns:** a file `leave-balances-YYYY.xlsx` (per type: the balance and the days taken in the year).
- **What it does:** the register as Excel.
- **Errors:** `400` · `403`.

- **Review format (2026-11-24):** shared Excel review-report formatting and separate Review notes sheet described above; existing data columns and authorization retained.

### `leave.balances.adjust`
- **HTTP:** `POST /api/rpc/leave/balances/adjust` · **Code:** `backend/src/modules/leave/balances/`
- **Access:** Leave: Edit.
- **Scope:** Leave Edit covering the employee (outside the View data access `404`, View only `403`).
- **Input:** `{ employeeCode, leaveTypeId, days (-365..365, not 0, + adds / - takes away), note (5-500) }`
- **Returns:** `{ balance }` - the balance after it.
- **What it does:** an ADJUSTMENT row dated today with HR's reason - opening balances at go-live, days given (maternity, comp-off), a mistake put right. Never below zero (old HRMS); not for leave without pay.
- **Errors:** `400` below zero, unpaid type · `403` · `404`.


### `leave.balances.giveMany`
- **HTTP:** `POST /api/rpc/leave/balances/giveMany` · **Code:** `backend/src/modules/leave/balances/`
- **Access:** Leave: Edit.
- **Scope:** Leave **Edit** data access (`scopeOf`): codes outside it are "not found" (`400`, never revealing who exists); without codes, only the employees inside it.
- **Input:** `{ leaveTypeId (a paid type in use), days (> 0, up to 365, 2 decimals), note (5-500), employeeCodes? (1-5000 - these people), companyIds?, plantIds?, departmentIds?, holidayListIds? (without codes: everyone matching - each list: any of them; the holiday list followed today), dryRun? (only count) }`
- **Returns:** `{ people, toGive, notForThem, given }` - `notForThem`: left out, the type is not for them (gender / employment type).
- **What it does:** (the user, 2026-11-24 - e.g. one day of election leave to everyone on the West Bengal holiday list, the year's restricted holidays) an ADJUSTMENT of `days` with the note, dated today, for each employee employed today or joining later. A separate API from `adjust` (one person, + or -, the balance back) because it chooses many by a filter and counts first. People joining later get nothing - HR gives it again.
- **Errors:** `400` an unknown / outside code, unpaid or retired type · `403`.
### `leave.balances.runCredits`
- **HTTP:** `POST /api/rpc/leave/balances/runCredits` · **Code:** `backend/src/modules/leave/balances/`
- **Access:** Leave: Edit.
- **Scope:** every company's employees - Leave Edit for all companies (`assertGroupWide`).
- **Input:** none
- **Returns:** `{ credited, lapsed, expired }` - rows added.
- **What it does:** what the nightly job `leave.creditDue` does, now: every type's monthly credit for each 1st due from its `creditsFrom` month (2026-11-23 - was every month since the type was added; to everyone employed that day, whose service is long enough - `creditAfterMonths` - and whom the type applies to; no part credit for a joiner's month - old HRMS) and, for each year ended, the balance above the type's `maxCarryForward` lapses (on 31 Dec) - leave of the new year already approved in the old one (applied in December for January) is paid from the old year's days first, so only what is left above the carry-forward lapses (the user, 2026-11-23: the balance never goes below zero at the lapse); and comp-off not used within 90 days of the day worked expires (the user, 2026-11-23 - as Workday and Odoo: each leave uses only the days there on its date and not expired by then, the closest to expiry first, HR's days - which never expire - last; a leave cancelled gives its days back; what is left of a comp-off past its expiry lapses. Before, a leave was counted against comp-off earned after it, so a later comp-off could never lapse). Not for a retired type (2026-11-23 - its days can no longer be applied for; its year end still lapses). The credits run before the year end, so a December credit caught up late lapses with the rest (2026-11-23). Each month / year / expiry once per employee and type - running it again adds nothing.
- **Since 2026-11-23 (the review):** the comp-off expiry is written at most once a day per employee (`period` "exp:<day>" - a second run the same day adds nothing; more due waits for the next day), noted "Not used before it expired"; the first monthly credit is the 1st on or after the date of joining + `creditAfterMonths` (a joiner of the 31st counts to the month's last day - was a month late).
- **Errors:** `403`.

### `leave.balances.importTemplate`
- **HTTP:** `POST /api/rpc/leave/balances/importTemplate` · **Code:** `backend/src/modules/leave/balances/`
- **Access:** Leave: Edit.
- **Scope:** not limited by data access - an empty template (and the list of the leave type codes, shared by every company).
- **Input:** none
- **Returns:** a file `leave-opening-balances.xlsx` - columns Employee code, Leave type, Balance, Note; a second sheet lists the active paid leave types.
- **What it does:** the file HR fills in for `importBalances`.
- **Errors:** `403`.

### `leave.balances.importBalances`
- **HTTP:** `POST /api/rpc/leave/balances/importBalances` · **Code:** `backend/src/modules/leave/balances/`
- **Access:** Leave: Edit.
- **Scope:** every row's employee: Leave Edit covering them (outside the View data access the row says "No employee found", View only "no access") - each row checked.
- **Input:** `{ file (.xlsx, up to 5 MB, up to 20000 rows), save (default false = only check) }`
- **Returns:** `{ rows: [{ rowNumber, employeeCode, name, leaveType, current, balance, change, note, problem }], problems, changes, saved }`.
- **What it does:** (2026-11-22, the old HRMS's "leave-balances" importer, set-the-balance mode) sets opening balances at go-live: each row's balance as of today - the difference from the current balance is added as an ADJUSTMENT row with the row's note (empty: "Opening balance (Excel import)"). Checks: the employee, an active paid leave type, a balance of 0-999, one row per employee and type. With `save`, all rows or none: nothing is saved while a row is wrong; a row already at its balance changes nothing (the same file twice adds nothing).
- **Errors:** `400` not an Excel file, a column missing, no rows / too many, rows wrong with `save` · `403`.

### `leave.applications.preview`
- **HTTP:** `POST /api/rpc/leave/applications/preview` · **Code:** `backend/src/modules/leave/applications/`
- **Access:** Logged in (their own). **Employee self-service only** (2026-11-25, `selfServiceProcedure`): no active role - `403` while a role is active ("Switch to Employee self-service"), even for a Super Admin.
- **Scope:** not limited by data access - the caller's own; `teamOff` covers the caller's teammates (the same reporting manager - a relationship, not data-access rows), names and days only.
- **Input:** `{ leaveTypeId, fromDate, toDate (>= fromDate), fromSecondHalf? (the first day from its second half), toFirstHalf? (the last day to its first half) }`
- **Returns:** `{ teamOff: [{ employee {employeeCode, name}, fromDate, toDate, fromSecondHalf, toFirstHalf, waiting }], days, available (null: unpaid), after (null: unpaid), problems: string[] }` - what `apply` would refuse, in words; `teamOff` (2026-11-22, the old HRMS's team coverage warning - never a block) the caller's teammates (the same reporting manager) with leave approved or waiting on those days - name and days only, no type or reason.
- **What it does:** counts the days and checks every rule of `apply` without applying; says who of the team is away then.
- **Errors:** `400` · `404` the type.

### `leave.applications.apply`
- **HTTP:** `POST /api/rpc/leave/applications/apply` · **Code:** `backend/src/modules/leave/applications/`
- **Access:** Logged in (their own). **Employee self-service only** (2026-11-25, `selfServiceProcedure`): no active role - `403` while a role is active ("Switch to Employee self-service"), even for a Super Admin.
- **Scope:** not limited by data access - the caller's own.
- **Input:** as `preview` + `reason` (3-500).
- **Returns:** the application `{ id, employee {employeeCode, name}, leaveType {id, code, name, isPaid}, fromDate, toDate, fromSecondHalf, toFirstHalf, days, reason, status (PENDING | APPROVED | REJECTED | CANCELLED), approvalRequestId, approval {status, held, closedAt, closedById, step} | null, cancelRequest {approvalRequestId, status, held, closedAt, closedById, step} | null, cancelReason, createdAt }`.
- **What it does:** counts the days by the attendance plan (each working half 0.5; a half-day weekday's second half is off; weekly offs / holidays count only for a type with `countsOffDays`; a leave must start and end on a working day - never on a weekly off or a holiday, the user 2026-11-23) and raises its approval request (kind `LEAVE`; seeded: the reporting manager, 48 h, then escalated to their manager). Refused: a retired type or one that does not apply to the employee; half days on a whole-day type; when the type's timing says no (2026-11-24, in calendar days from today in India): less notice than `noticeDays` before the first day, a day after today for a `todayOrPastOnly` type, a first day more than `maxDaysBack` days ago; for a `holidaysOnly` type, a day that is not an on-application holiday of that type in the employee's holiday list that day (the refusal lists their coming dates), or half of one that is taken as a whole day; not employed every day; a locked attendance month; any half already on leave or with a regularization / on-duty request (approved or waiting); more than `maxPerRequest`; for a paid type more than the balance less what waits. When approved: the days are counted again (changed: refused - apply again), the balance must still cover them, a TAKEN row is added and the attendance days show the leave (days already come are worked out again).
- **Double submit (2026-11-23):** applications of one employee are saved one at a time and checked again then - a double
  click makes one leave (the second: `409` overlap).
- **Errors:** `400` the rules above · `404` · `409` overlap, not enough balance, a locked month, the chain switched off.

### `leave.applications.cancel`
- **HTTP:** `POST /api/rpc/leave/applications/cancel` · **Code:** `backend/src/modules/leave/applications/`
- **Access:** the employee (their own). **Employee self-service only** (2026-11-25, `selfServiceProcedure`): no active role - `403` while a role is active ("Switch to Employee self-service"), even for a Super Admin.
- **Scope:** not limited by data access - the caller's own (another's: `404`).
- **Input:** `{ id, reason? (needed for an approved leave) }`
- **Returns:** the application, as `apply`.
- **What it does:** a leave still waiting is withdrawn at once (its approval cancelled). An approved leave is asked to be cancelled through approval (kind `LEAVE_CANCEL`, old HRMS) - when approved the days come back (a RETURNED row), the leave is CANCELLED and the attendance days are worked out again; rejected, the leave stays approved.
- **Since 2026-11-23 (the review):** two requests sent at once make one approval (the second: `409` already asked to cancel); an approved leave of a year whose year end has passed, of a type with a carry-forward limit, cannot be cancelled - also refused when the cancel is approved - HR puts it right with a balance adjustment.
- **Errors:** `400` no reason · `404` · `409` a cancel request already waiting, rejected / cancelled already, a locked month. Â· `409` the leave's year end has passed

### `leave.applications.mine`
- **HTTP:** `POST /api/rpc/leave/applications/mine` · **Code:** `backend/src/modules/leave/applications/`
- **Access:** Logged in.
- **Scope:** not limited by data access - the caller's own.
- **Input:** none
- **Returns:** the viewer's applications (latest 100), as `apply`.
- **What it does:** the employee's leave and where each stands.
- **Errors:** `401`.

### `leave.applications.list`
- **HTTP:** `POST /api/rpc/leave/applications/list` · **Code:** `backend/src/modules/leave/applications/`
- **Access:** TEAM / DEPARTMENT: Logged in; ALL: Leave: View.
- **Scope:** DIRECT (2026-11-27, the self-service home): only the people who report to the caller directly (the relationship, like TEAM); TEAM: the caller's reporting tree; DEPARTMENT: the employees of the places the caller heads as HOD (relationships); ALL: only employees inside the caller's Leave View data access.
- **Input:** `{ scope: DIRECT | TEAM (default) | DEPARTMENT | ALL, companyIds?, departmentIds?, search?, from, to, statuses? (default PENDING + APPROVED) }`
- **Returns:** the applications overlapping from..to (up to 2000), as `apply`.
- **What it does:** who is on leave (or has asked) over a span.
- **Errors:** `400` · `403`.

### `leave.applications.recounts`
- **HTTP:** `POST /api/rpc/leave/applications/recounts` · **Code:** `backend/src/modules/leave/applications/`
- **Access:** Leave: View.
- **Scope:** the employees in the viewer's Leave View data access (`scopeOf(viewer, 'LEAVE', 'READ')`).
- **Input:** `{ from: date, to: date }` (required; `to` not before `from`, at most a year)
- **Returns:** `[{ ...the application (as `apply`), now (the days by today's calendar), difference (now - days: negative = days to give back), holidays: string[] (the holidays on it now, "Diwali (Sun, 08 Nov 2026)") }]`
- **What it does:** (the user, 2026-11-23) approved leave overlapping the span whose days the calendar now counts otherwise - a holiday added or removed, a weekly off changed. A leave keeps the days it was approved with - never changed on its own (as in Keka, Zoho People and SAP); HR puts each right with `recount`. Counted without the "starts and ends on a working day" rule (it is approved already).
- **Since 2026-11-23 (the review):** a leave of a year whose year end has passed (a type with a carry-forward limit) is not listed - its days were settled by the lapse.
- **Errors:** `400` · `403`.

### `leave.applications.recount`
- **HTTP:** `POST /api/rpc/leave/applications/recount` · **Code:** `backend/src/modules/leave/applications/`
- **Access:** Leave: Edit.
- **Scope:** Leave Edit covering the employee (`hasLevelAt`) - outside the View range `404`, View only `403`.
- **Input:** `{ id }`
- **Returns:** the application (as `apply`, with its new `days`) + `{ difference }`.
- **What it does:** counts one approved leave again by today's calendar: days it no longer takes come back to the balance (a RETURNED row), days it now takes more are taken (a TAKEN row - only if the balance has them); each row's note says why (the holidays on it). The leave's days become the new count; the employee is e-mailed (work e-mail). One at a time per employee (a double click puts it right once).
- **Errors:** `403` · `404` · `409` not approved, a cancel request waiting, already counted so, not enough balance for days more, a locked attendance month. Â· `409` the leave's year end has passed (a type with a carry-forward limit)

### `leave.applications.forApproval`
- **HTTP:** `POST /api/rpc/leave/applications/forApproval` · **Code:** `backend/src/modules/leave/applications/`
- **Access:** the people who may see the approval request (its approvers, the employee, Leave: View covering them).
- **Scope:** as `approvals.get` (`approvalsService.canSeeRequest`); else `404`. `teamOff`: the employee's teammates (the same reporting manager - a relationship), names and days only.
- **Input:** `{ approvalRequestId }`
- **Returns:** the application (as `apply`) + `{ isCancelRequest, balance { balance, pending, available } | null, teamOff (as `preview`) }`.
- **What it does:** the leave behind a request on the Approvals page, with the employee's balance of its type now and the employee's teammates (the same reporting manager) away on those days.
- **Errors:** `404`.

### `leave.compOff.claim`
- **HTTP:** `POST /api/rpc/leave/compOff/claim` · **Code:** `backend/src/modules/leave/comp-off/`
- **Access:** Logged in (their own). **Employee self-service only** (2026-11-25, `selfServiceProcedure`): no active role - `403` while a role is active ("Switch to Employee self-service"), even for a Super Admin.
- **Scope:** not limited by data access - the caller's own.
- **Input:** `{ workDate, reason (3-500) }`
- **Returns:** the claim `{ id, employee {employeeCode, name}, workDate, days (0.5 | 1), reason, status (PENDING | APPROVED | REJECTED | CANCELLED), expiresOn (approved), approvalRequestId, approval {status, held, closedAt, closedById, step} | null, createdAt }`.
- **What it does:** (the user, 2026-11-22) the employee worked on a weekly off or a holiday and claims comp-off (one claim per day: two sent at the same moment make one - 2026-11-23): the day's punches decide - at least 8 h worked = 1 day, at least 4 h = half a day (the old HRMS's thresholds); raises its approval request (kind `COMP_OFF`; seeded: the reporting manager, 48 h, then their manager). Approved, the hours are counted again and the days credited to the comp-off leave type (`isCompOff` - the seeded CO) as a COMP_OFF row expiring 90 days after the day worked; then it is applied for like any leave. Refused: a working day, a day not over or more than 30 days ago, under 4 h, a second claim for the day, no comp-off type / one that does not apply to the employee.
- **Since 2026-11-23 (the review):** approved, the COMP_OFF row expires 90 days after the day worked, or 30 days after the approval if that is later (a claim approved late is never lapsed at once).
- **Errors:** `400` the rules above · `409` already claimed, no comp-off type, the chain switched off.

### `leave.compOff.cancel`
- **HTTP:** `POST /api/rpc/leave/compOff/cancel` · **Code:** `backend/src/modules/leave/comp-off/`
- **Access:** the employee (their own). **Employee self-service only** (2026-11-25, `selfServiceProcedure`): no active role - `403` while a role is active ("Switch to Employee self-service"), even for a Super Admin.
- **Scope:** not limited by data access - the caller's own (another's: `404`).
- **Input:** `{ id }`
- **Returns:** the claim, as `claim`.
- **What it does:** withdraws a claim still waiting (its approval request is cancelled too).
- **Errors:** `404` · `409` already decided.

### `leave.compOff.mine`
- **HTTP:** `POST /api/rpc/leave/compOff/mine` · **Code:** `backend/src/modules/leave/comp-off/`
- **Access:** Logged in.
- **Scope:** not limited by data access - the caller's own.
- **Input:** none
- **Returns:** the viewer's claims (latest 50), as `claim`.
- **What it does:** the employee's comp-off claims and where they stand.
- **Errors:** `401`.

### `organization.export`
- **HTTP:** `POST /api/rpc/organization/export` · **Code:** `backend/src/modules/organization/`
- **Access:** Organization: View.
- **Scope:** Not limited by data access: shared organization reference lists, using the same authorized `list*For` readers as Organization. Client IDs only narrow the result; they cannot authorize a record.
- **Input:** `{ section, ids, selection? }`: section is companies/plants/costCenters/workLocations/departments/designations/regions/positions/grades/salaryComponents; `ids`: up to 20,000 positive IDs, in display order; `selection`: optional text up to 300 characters.
- **Returns:** Excel File with report data and Review notes. One worksheet of explicit master fields and status, plus Review notes. Unknown IDs are ignored; duplicates removed. Current client search, status, attention filter and sorting are represented by the selected IDs.
- **What it does:** generates a review/print workbook through the existing authorized service readers and shared report writer; exporting has no write or approval side effects.
- **Errors:** `400 BAD_REQUEST` invalid input/range or documented export size limit; `401` no session; `403` insufficient access; `404` for an inaccessible employee where the underlying reader uses not-found semantics. Same additional reader errors as the corresponding list.

### `approvals.export`
- **HTTP:** `POST /api/rpc/approvals/export` · **Code:** `backend/src/modules/approvals/`
- **Access:** Logged in; held mode additionally Approval chains: Edit. The waiting / decided / mine lists are per portal, as
  `listToDecide` / `listDecided` / `listMine` (2026-11-25).
- **Scope:** Same readers as the corresponding inbox tab: named relationships, selected-role approver pools, own requests or held requests within Approval chains Edit data access.
- **Input:** `{ mode, feature? }`: mode waiting/decided/mine/held; feature optional string up to 50 characters.
- **Returns:** Excel File with report data and Review notes. Request identifiers, employee, kind, summary, status, raised-by/time, open step, due date, hold and close details, plus your decision status/time/comment where present. Mine is latest 100; decided latest 200, then narrowed by feature, matching the page. Other modes export their complete authorized list.
- **What it does:** generates a review/print workbook through the existing authorized service readers and shared report writer; exporting has no write or approval side effects.
- **Errors:** `400 BAD_REQUEST` invalid input/range or documented export size limit; `401` no session; `403` insufficient access; `404` for an inaccessible employee where the underlying reader uses not-found semantics. Same additional reader errors as the corresponding list.

- **Team report mode (2026-11-24):** `mode: 'team'` accepts the filters of `approvals.report` without page/pageSize. Uses that report's identity/area scopes and exports all matches in a repeatable-read snapshot, max 20,000. Above the cap returns `400 BAD_REQUEST`, never a partial file. Workbook: Team requests (full messages, dates/portion/days where stored, overall status/current step, remarks, provenance and withdrawal/hold reasons), Approval history (one row per recorded step outcome/comment with person/time/automatic flag), Review notes. Job/salary requests excluded. No approval or record changes. Existing waiting/decided/mine/held modes are unchanged.

### `approvals.chains.export`
- **HTTP:** `POST /api/rpc/approvals/chains/export` · **Code:** `backend/src/modules/approvals/chains/`
- **Access:** Approval chains: View.
- **Scope:** Not limited by data access: shared and company routing definitions, matching `approvals.chains.list`. Does not export approval-request content.
- **Input:** None.
- **Returns:** Excel File with report data and Review notes. One row per configured approval step: request kind, company/shared, active state, step, approver type, role/area/named person, confidentiality, SLA/breach action and modification provenance. Empty and unconfigured chains have explicit rows with blank step values.
- **What it does:** generates a review/print workbook through the existing authorized service readers and shared report writer; exporting has no write or approval side effects.
- **Errors:** `400 BAD_REQUEST` invalid input/range or documented export size limit; `401` no session; `403` insufficient access; `404` for an inaccessible employee where the underlying reader uses not-found semantics. Same additional reader errors as the corresponding list.

### `attendance.days.exportMonth`
- **HTTP:** `POST /api/rpc/attendance/days/exportMonth` · **Code:** `backend/src/modules/attendance/days/`
- **Access:** Logged in; another employee as employeeMonth.
- **Scope:** Own identity or the same reporting-tree, HOD department or Attendance View data access check as `attendance.days.employeeMonth`. Out-of-range employee is not found.
- **Input:** `{ year, month, employeeCode? }`: year/month use month input rules; employeeCode optional valid employee code, omitted means caller.
- **Returns:** Excel File with report data and Review notes. Attendance-day worksheet for the actual configured cycle: date/status, halves, shift/holiday, local in/out clock times, worked/late/early minutes, correction reason. Review notes identify employee, exact cycle and lock state.
- **What it does:** generates a review/print workbook through the existing authorized service readers and shared report writer; exporting has no write or approval side effects.
- **Errors:** `400 BAD_REQUEST` invalid input/range or documented export size limit; `401` no session; `403` insufficient access; `404` for an inaccessible employee where the underlying reader uses not-found semantics. Same additional reader errors as the corresponding list.

### `attendance.days.exportBoard`
- **HTTP:** `POST /api/rpc/attendance/days/exportBoard` · **Code:** `backend/src/modules/attendance/days/`
- **Access:** Logged in; as board.
- **Scope:** DIRECT (2026-11-27, the self-service home): only the people who report to the caller directly (the relationship, like TEAM); Identical to `attendance.days.board`: TEAM reporting relationship, DEPARTMENT HOD relationship, or ALL Attendance View data access.
- **Input:** Same as `attendance.days.board`: date, scope DIRECT/TEAM/DEPARTMENT/ALL (default TEAM), optional search, companyIds, workLocationIds, departmentIds.
- **Returns:** Excel File with report data and Review notes. One row per authorized employee on the selected date, with code/name/company/department, state, shift, in/out, worked/late minutes and correction reason.
- **What it does:** generates a review/print workbook through the existing authorized service readers and shared report writer; exporting has no write or approval side effects.
- **Errors:** `400 BAD_REQUEST` invalid input/range or documented export size limit; `401` no session; `403` insufficient access; `404` for an inaccessible employee where the underlying reader uses not-found semantics. Same additional reader errors as the corresponding list.

### `attendance.exportSetup`
- **HTTP:** `POST /api/rpc/attendance/exportSetup` · **Code:** `backend/src/modules/attendance/`
- **Access:** Attendance setup: View; locks additionally group-wide Edit.
- **Scope:** Shared shifts/patterns/policies/holidays and ingestion metadata match their existing readers and are not restricted by employee data access. Schedules use Attendance setup View data access. Locks call the existing group-wide Edit reader.
- **Input:** `{ section, year?, schedules?, holidayListId? }`: shifts/patterns/policies/holidays/punches/schedules/locks. Year integer 2020-2100, required for holidays/locks. Schedules optional same filters as `attendance.shifts.schedules` (search, company/plant/department/cost-center ID arrays, patternId, policyId, holidayListId, notTracked); the schedules sheet also has each employee's "attendance not tracked" marker (from, until, reason - 2026-11-27). `holidayListId` (holidays, 2026-11-25): only that list's holidays - the page's list filter; named in the file's details.
- **Returns:** Excel File with report data and Review notes. Selected setup section: current effective definitions including retired records and labelled upcoming timings, cycle/default changes and policy rules; selected-year holidays/month locks; scoped current employee schedules; or latest 30 uploads plus unmatched codes in separate sheets. Does not export raw matched biometric punches.
- **What it does:** generates a review/print workbook through the existing authorized service readers and shared report writer; exporting has no write or approval side effects.
- **Errors:** `400 BAD_REQUEST` invalid input/range or documented export size limit; `401` no session; `403` insufficient access; `404` for an inaccessible employee where the underlying reader uses not-found semantics. Same additional reader errors as the corresponding list.

### `attendance.rosters.export`
- **HTTP:** `POST /api/rpc/attendance/rosters/export` · **Code:** `backend/src/modules/attendance/rosters/`
- **Access:** Attendance setup: View.
- **Scope:** Same as roster grid: Attendance setup View data access on employees, narrowed by company and search filters.
- **Input:** Same as `attendance.rosters.grid`: required from/to dates (at most six weeks, validated by reader), optional companyIds, search (100 characters), onlyChanges boolean.
- **Returns:** Excel File with report data and Review notes. Employee rows and a column per selected date. Draft/published overrides labelled explicitly; other cells show the planned shift/off/holiday. Exports stored data, not unsaved edits.
- **What it does:** generates a review/print workbook through the existing authorized service readers and shared report writer; exporting has no write or approval side effects.
- **Errors:** `400 BAD_REQUEST` invalid input/range or documented export size limit; `401` no session; `403` insufficient access; `404` for an inaccessible employee where the underlying reader uses not-found semantics. Same additional reader errors as the corresponding list.

### `employees.exportDirectory`
- **HTTP:** `POST /api/rpc/employees/exportDirectory` · **Code:** `backend/src/modules/employees/`
- **Access:** Logged in; exporting everyone (no `group`) needs Employees: View.
- **Scope:** An export holds only what the viewer's access covers (the user, 2026-11-24 - the directory page itself stays open to all): TEAM uses the reporting relationship; DEPARTMENT the actual HOD relationship; everyone (no `group`) only the employees the viewer's **Employees View data access** covers (`scopeOf` -> `scopeWhere`). Only basic work fields, never HR-only personal/identity/bank/salary fields.
- **Input:** Same optional input as `employees.directory`: group TEAM/DEPARTMENT (omitted everyone), search up to 100 characters, companyIds up to 100, plantIds up to 200, departmentIds up to 100; no pagination fields.
- **Returns:** Excel File with report data and Review notes. All matching currently working colleagues inside that scope, maximum 20,000; code, name, designation, company, plant, department, location, work email, manager and joined date. Above limit returns BAD_REQUEST asking for narrower filters, never a partial workbook.
- **What it does:** generates a review/print workbook through the existing authorized service readers and shared report writer; exporting has no write or approval side effects.
- **Errors:** `400 BAD_REQUEST` invalid input/range or documented export size limit; `401` no session; `403` insufficient access; `404` for an inaccessible employee where the underlying reader uses not-found semantics. Same additional reader errors as the corresponding list.

### `employees.hods.export`
- **HTTP:** `POST /api/rpc/employees/hods/export` · **Code:** `backend/src/modules/employees/hods/`
- **Access:** Logged in; heads additionally HOD appointments: View.
- **Scope:** Department view uses actual current HOD relationship via `myDepartment`, independent of active role. Heads view uses `listPlaces` with HOD appointments View data access.
- **Input:** `{ view, postId?, search?, onlyGaps? }`: view department/heads; optional positive post ID for department; search trimmed up to 200 characters; onlyGaps for heads.
- **Returns:** Excel File with report data and Review notes. Department employee work fields, filtered by post and search; or head-coverage rows (company/plant/department, head count, current/next HOD and dates), optionally unheaded populated departments only.
- **What it does:** generates a review/print workbook through the existing authorized service readers and shared report writer; exporting has no write or approval side effects.
- **Errors:** `400 BAD_REQUEST` invalid input/range or documented export size limit; `401` no session; `403` insufficient access; `404` for an inaccessible employee where the underlying reader uses not-found semantics. Same additional reader errors as the corresponding list.

### `joiningTasks.export`
- **HTTP:** `POST /api/rpc/joiningTasks/export` · **Code:** `backend/src/modules/joining-tasks/`
- **Access:** Logged in; MINE Joining tasks: View, ALL Onboarding: View.
- **Scope:** Uses `joiningTasks.list` unchanged: assigned-to-caller tasks and Joining tasks View data access for MINE, Onboarding View data access for ALL.
- **Input:** `{ scope, status, team?, search?, ids? }`: same list input, scope default MINE, status default OPEN; ids optionally up to 1,000 positive task IDs narrowing quick-filtered visible rows.
- **Returns:** Excel File with report data and Review notes. Employee, company/department, task/team, due, assignee, status and completion provenance. Same list window: up to 1,000 open or latest 200 done tasks. Review notes state coverage explicitly. Client IDs only narrow the authorized reader result.
- **What it does:** generates a review/print workbook through the existing authorized service readers and shared report writer; exporting has no write or approval side effects.
- **Errors:** `400 BAD_REQUEST` invalid input/range or documented export size limit; `401` no session; `403` insufficient access; `404` for an inaccessible employee where the underlying reader uses not-found semantics. Same additional reader errors as the corresponding list.

### `joiningTasks.types.export`
- **HTTP:** `POST /api/rpc/joiningTasks/types/export` · **Code:** `backend/src/modules/joining-tasks/`
- **Access:** As joiningTasks.types.list.
- **Scope:** Not limited by data access: shared task-type definitions. Existing reader requires Joining task types View for inactive types, or Onboarding Edit for active joining-form choices.
- **Input:** Optional `{ includeInactive?: boolean }`.
- **Returns:** Excel File with report data and Review notes. Task, description, team, due days, joining types, default assignee and active/retired status, using the same authorized task-type reader.
- **What it does:** generates a review/print workbook through the existing authorized service readers and shared report writer; exporting has no write or approval side effects.
- **Errors:** `400 BAD_REQUEST` invalid input/range or documented export size limit; `401` no session; `403` insufficient access; `404` for an inaccessible employee where the underlying reader uses not-found semantics. Same additional reader errors as the corresponding list.

### `leave.applications.export`
- **HTTP:** `POST /api/rpc/leave/applications/export` · **Code:** `backend/src/modules/leave/applications/`
- **Access:** Logged in; as applications.list.
- **Scope:** DIRECT (2026-11-27, the self-service home): only the people who report to the caller directly (the relationship, like TEAM); Same as applications.list: TEAM reporting tree, DEPARTMENT HOD department, or ALL Leave View data access.
- **Input:** Same as `leave.applications.list`: required from/to dates, scope default TEAM, optional companyIds/departmentIds (up to 100), search up to 100, statuses up to four PENDING/APPROVED/REJECTED/CANCELLED (default pending and approved).
- **Returns:** Excel File with report data and Review notes. All authorized overlapping applications matching the selected filters: employee, type, dates, half-day boundaries, days, status, reason, request time and cancellation reason. Does not approve or cancel leave.
- **What it does:** generates a review/print workbook through the existing authorized service readers and shared report writer; exporting has no write or approval side effects.
- **Errors:** `400 BAD_REQUEST` invalid input/range or documented export size limit; `401` no session; `403` insufficient access; `404` for an inaccessible employee where the underlying reader uses not-found semantics. Same additional reader errors as the corresponding list.

### `leave.applications.exportMine`
- **HTTP:** `POST /api/rpc/leave/applications/exportMine` · **Code:** `backend/src/modules/leave/applications/`
- **Access:** Logged in.
- **Scope:** Own identity only: balances/ledger from `balances.get` without another employee code, and applications from `listMine`. No role permission required.
- **Input:** None.
- **Returns:** Excel File with report data and Review notes. Current-year balances and complete current-year ledger, plus latest 100 own applications matching My leave. Blank balances are unmetered leave types. Review notes state year and application window.
- **What it does:** generates a review/print workbook through the existing authorized service readers and shared report writer; exporting has no write or approval side effects.
- **Errors:** `400 BAD_REQUEST` invalid input/range or documented export size limit; `401` no session; `403` insufficient access; `404` for an inaccessible employee where the underlying reader uses not-found semantics. Same additional reader errors as the corresponding list.

### `leave.applications.exportRecounts`
- **HTTP:** `POST /api/rpc/leave/applications/exportRecounts` · **Code:** `backend/src/modules/leave/applications/`
- **Access:** Leave: View.
- **Scope:** Same as recounts: Leave View data access on employees. Reuses the authorized recount reader, with no updates.
- **Input:** Same as recounts: `{ from: Date, to: Date }`.
- **Returns:** Excel File with report data and Review notes. Approved leave currently counted differently: employee/type, dates, approved days, days now and difference. Does not apply corrections, change balances or send messages.
- **What it does:** generates a review/print workbook through the existing authorized service readers and shared report writer; exporting has no write or approval side effects.
- **Errors:** `400 BAD_REQUEST` invalid input/range or documented export size limit; `401` no session; `403` insufficient access; `404` for an inaccessible employee where the underlying reader uses not-found semantics. Same additional reader errors as the corresponding list.

### `leave.types.export`
- **HTTP:** `POST /api/rpc/leave/types/export` · **Code:** `backend/src/modules/leave/types/`
- **Access:** Logged in.
- **Scope:** Not limited by data access: shared leave-type rules, same as list. Retired types only when requested and the active role has Leave View.
- **Input:** Optional `{ includeInactive?: boolean }`.
- **Returns:** Excel File with report data and Review notes. Code/name, paid, credit and carry/request limits, half/off-day rules, eligible genders/employment types, comp-off designation and status.
- **What it does:** generates a review/print workbook through the existing authorized service readers and shared report writer; exporting has no write or approval side effects.
- **Errors:** `400 BAD_REQUEST` invalid input/range or documented export size limit; `401` no session; `403` insufficient access; `404` for an inaccessible employee where the underlying reader uses not-found semantics. Same additional reader errors as the corresponding list.

### `approvals.report`
- **HTTP:** `POST /api/rpc/approvals/report` · **Code:** `backend/src/modules/approvals/reports/`
- **Access:** logged-in employee. TEAM/DEPARTMENT are relationship views. ALL needs Leave or Attendance View; each feature still uses its own area/data scope.
- **Scope:** TEAM uses the current reporting tree's explicit employee IDs with SYSTEM_SCOPE; DEPARTMENT the current HOD department employee IDs with SYSTEM_SCOPE, excluding oneself. A manager / HOD so sees every step, approver and remark of their people's leave and attendance requests, even on chains they are not on - wider than `approvals.get`; approved by the user 2026-11-24. ALL: LEAVE and COMP_OFF use Leave View data access; REGULARIZATION and SHIFT_CHANGE use Attendance View data access. Each branch applies scopeWhere inside its own employee predicate, then all date/search/kind/status filters are ANDed. Having one area's access never grants the other. Current relationships/placement apply to historical requests. No job or salary/confidential request data.
- **Input:** `{ scope?: 'TEAM'|'DEPARTMENT'|'ALL', from: Date, to: Date, dateBy?: 'WORK_DATES'|'RAISED', kind?, status?, search?, page?, pageSize? }`. Scope defaults TEAM; dateBy defaults WORK_DATES. Inclusive UTC calendar dates, ordered and at most 366 days apart. WORK_DATES matches overlapping leave/regularisation spans, comp-off work date or shift-change date; RAISED matches the India calendar day the request was raised on (00:00-24:00 India time - fixed 2026-11-27: it compared with UTC days, so a request raised before 05:30 showed under the day before). Kind: LEAVE, LEAVE_CANCEL, REGULARIZATION (missed punch), ON_DUTY, COMP_OFF or SHIFT_CHANGE. Status: PENDING (waiting, excludes held), HELD (pending plus heldAt), APPROVED, REJECTED, CANCELLED (withdrawn) or EXPIRED. Omitted kind/status = every supported type/status. Search trimmed max 100 characters: every word matches employee code or name. Page positive integer default 1; pageSize 1–100 default 25.
- **Returns:** `{ total, items, page, pageSize }`. Items: id, employeeCode/name, company/department, kind label, request summary, from/to/portion/days where available, complete source reason, sourceAvailable, raisedAt/raisedBy, status label (Held separate), currentStep (only while not held), heldReason, closedAt, withdrawalReason and decisions `{step,status,at,by,comment,automatic}[]`. Actor names use the existing lookup service. No encrypted/private employee fields. Newest raised first, ID descending as tie-breaker. Count and page use a repeatable-read snapshot; an oversized page number is clamped to the last page.
- **What it does:** one browsable report of current team's or HOD department's leave, leave cancellations, missed-punch regularisations, OD, comp-off and shift changes across waiting and completed outcomes, independent of whether a step currently waits for this viewer. The Approvals Team requests tab starts with this month's work/leave dates, stores filters/page in the URL and exports through `approvals.export` mode team. Table previews expand in place; export always contains full stored text and all matching pages.
- **Source boundaries:** reads the original domain records through explicit approval-request relations, with no duplicated message store. When an older source link no longer exists (e.g. a cancellation superseded by a later cancellation), dates/message cannot be reconstructed: RAISED can show it with sourceAvailable false and the retained summary; WORK_DATES requires a linked source with dates. Missing details are labelled, never invented. Approval remarks are stored step comments, not messages sent outside HRMS.
- **Errors:** `400 BAD_REQUEST` invalid fields/range; `401` no session; `403 FORBIDDEN` ALL without either area. A caller with no current team/HOD relationship gets an empty relationship report. Export cap errors are documented under approvals.export.


### `attendance.reports.list`
- **HTTP:** `POST /api/rpc/attendance/reports/list` · **Code:** `backend/src/modules/attendance/reports/`
- **Access:** any logged-in employee, with the requested scope checked in the service.
- **Scope:** DIRECT (2026-11-27, the self-service home): only the people who report to the caller directly (the relationship, like TEAM); TEAM = current reporting-tree ids; DEPARTMENT = current HOD employees; ALL requires Attendance View and that active role's company/plant/department DataScope. No relationship gives an empty list. Supplied company/plant/department/work-location ids and search only narrow this scope. Identical scope applies to rows, total, all summaries and employee-period totals. Picker options contain only scoped employees' current places within the employment/date range, before report filters; no private employee fields returned. No broad Reports permission.
- **Input:** `{scope?: DIRECT|TEAM|DEPARTMENT|ALL (TEAM), from: Date, to: Date, mode?: DETAIL|EXCEPTIONS (DETAIL), companyIds?, plantIds?, departmentIds?, workLocationIds?, search?, status?, exception?: ANY|LATE|EARLY|ABSENT|MISSED_PUNCH (ANY), page?: number (1), pageSize?: number (25)}`. Dates required UTC-midnight calendar dates, years 2020–2100, inclusive ordered span at most 366 calendar days; independent of the attendance/payroll cycle. Id arrays positive integers, max 100 each. Search trimmed max 100; every word matches code/first/middle/last name. Status is a DayStatus. Exception applies only in EXCEPTIONS mode: late/early minutes >0, ABSENT/MISSED_PUNCH in either half; ANY matches their union. Other filters combine with AND. Page positive integer; size 1–100.
- **Returns:** `{total,page,pageSize,items,summary,options}`. Rows: id, work date, employee code/name, current company/plant/department, shift code/name, overall/punch-derived/half statuses, first/last punch instants, worked/late/early minutes, stored punch count, calculation note, employee matching-day/late/early totals for the same filtered period. Summary: matching days, distinct employees, worked/late/early minutes, stored punch count, late/early/absent/missed-punch day counts. Counts include either half, not fractional-day absence totals; categories can overlap. Options: authorized companies/plants/departments. Internal employee ids/contacts are not returned.
- **What it does:** read-only register of stored computed days; does not recompute or infer uncomputed/missing days as absent. Current placement/team membership governs visibility; historical placement is not claimed. Stable order date descending, employee code ascending, id ascending; pages above the end clamp to the last. Count/page/summaries share a repeatable-read transaction. UI `/attendance-reports`: scope, calendar dates, employee search, company/plant/department/status, detail/exception tabs, filter persistence in URL, compact summaries, pagination and existing days.punches drill-down. All-scoped company/group access works through ALL and the existing grants.
- **Errors:** `400 BAD_REQUEST` invalid input/range; `401` no usable session; `403 FORBIDDEN` ALL without Attendance View. Outside-scope filters return no rows, not expanded access.

### `attendance.reports.export`
- **HTTP:** `POST /api/rpc/attendance/reports/export` · **Code:** `backend/src/modules/attendance/reports/`
- **Access:** same as attendance.reports.list.
- **Scope:** DIRECT (2026-11-27, the self-service home): only the people who report to the caller directly (the relationship, like TEAM); same identity/DataScope and filters as list, including every summary and employee-period total; never just the current page.
- **Input:** the list filters without page/pageSize; same defaults and validation.
- **Returns:** XLSX File with Attendance detail or Attendance exceptions, Summary and Review notes sheets. All matching rows, max 20,000; above cap refuses the export, never silently truncates. Codes and exact UTC ISO first/last timestamps are text; minutes/counts are numeric; work dates are date cells. Includes per-half/punch-derived statuses, shift, current placement, employee filtered-period totals and full stored calculation notes.
- **What it does:** uses the same query and repeatable-read summary as the list; filters, current-placement/time/date limitations and preparer recorded in Review notes. Read-only, no corrections/approvals or payroll changes. No OT pay or penalty inferred.
- **Errors:** same as list; `400 BAD_REQUEST` over 20,000 matching attendance days, asking for narrower dates/filters.

### `attendance.reports.exportPunches`
- **HTTP:** `POST /api/rpc/attendance/reports/exportPunches` · **Code:** `backend/src/modules/attendance/reports/`
- **Access:** logged in, same as attendance.days.punches.
- **Scope:** checks the employee first through the existing own/reporting-tree/HOD/Attendance View reader; outside View returns NOT_FOUND. Uses exactly the same shift-owned punches as the screen, including overnight exits and night-to-morning handover rules.
- **Input:** `{employeeCode, date}` as attendance.days.punches.
- **Returns:** XLSX File: Raw punches and Review notes; stored machine code, exact UTC ISO punch timestamp, work-location local clock/time zone, device, source, upload reference/file and exact UTC ISO storedAt. Codes and source filenames are safe string cells, not formulas.
- **What it does:** exports retained punches for one attendance work date; not a lossless original machine payload, rejected/duplicate-input report or unmatched-code report. Does not invent card/direction/GPS/door fields. StoredAt is database storage time. No record changes.
- **Errors:** `400` invalid input or more than 20,000 punches in the work date; `401` no usable session; `404 NOT_FOUND` unknown/outside-scope employee.

## Recorded joiners and leavers (2026-11-25)

The directory APIs return one employee per row, with status/placement filters; this report returns one event per date
and can include two events per employee. No existing API provides that contract. No new schema or exit workflow.

### `employees.movements.list`
- **HTTP:** `POST /api/rpc/employees/movements/list` · **Code:** `backend/src/modules/employees/movements/`
- **Access:** Employee · Directory & job: View, on the active role.
- **Scope:** `scopeOf(viewer, 'EMPLOYEES', 'READ')` applied with `scopeWhere` inside AND, alongside the joining/leaving
  date OR and every filter. Rows/options/totals use the same scope and snapshot. No own/team/HOD scope exemption.
- **Input:** `{ from: Date, to: Date, kind?: 'ALL'|'JOINER'|'LEAVER' (ALL), search?: string (trimmed, max 100),
  companyIds?: positiveInt[] (max 100), plantIds?: positiveInt[] (max 100), departmentIds?: positiveInt[] (max 100),
  page?: int (1–20000, default 1), pageSize?: int (1–100, default 25) }`. Dates must be UTC-midnight calendar dates,
  year 1900–2100; ordered, inclusive range of at most 366 days. Empty place arrays mean all authorized places.
- **Returns:** `{ items, total, page, pageSize, asOf, summary: { joiners, leavers, people, future },
  options: { companies, plants, departments } }`. Each item: employeeCode/name/current status, current company/plant/
  department `{id,name}`, designation or null, kind JOINER/LEAVER, date, future (date after current IST day).
- **What it does:** selects the existing employee joining/leaving dates. One employee may contribute both events;
  distinct people count once. Search matches every whitespace-separated term against code/name fields. Stable ascending
  event date, employee code, then event kind. Summaries/options cover every matching event, not only the page. Options
  come only from authorized matching records; selecting another place returns no matches. Includes imported/directly
  added records and all current employment statuses. No writes/recomputation. A recorded leaving date is not confirmed
  resignation/clearance/settlement. Historical placement, old codes and rehire events absent from the current record
  are not reconstructed. Both viewing and exporting are bounded to 20,000 events; larger sets are refused, never truncated.
- **Errors:** `400` invalid dates/filter/page or report over 20,000 events (narrow filters); `401` invalid session;
  `403` active role lacks EMPLOYEES View. Outside-range places produce an empty report, never reveal hidden metadata.

### `employees.movements.export`
- **HTTP:** `POST /api/rpc/employees/movements/export` · **Code:** `backend/src/modules/employees/movements/`
- **Access:** Employee · Directory & job: View, on the active role.
- **Scope:** identical to employees.movements.list, freshly checked at export time for rows, totals and metadata.
- **Input:** list filters above, without page/pageSize.
- **Returns:** File, `joiners-leavers-YYYY-MM-DD-YYYY-MM-DD.xlsx`, with Joiners and leavers, Summary and Review notes.
- **What it does:** exports all filtered events up to 20,000, not just the page. Explicit columns: recorded date,
  event type, future marker, employee code/name, current company/plant/department/designation/status. No salary,
  IDs, bank, medical, personal contacts or documents. Review notes include filters, current placement/recorded-date
  limitations, prepared-by and export time. No email is sent or scheduled.
- **Errors:** same validation/access/cap errors as list. Invalid/outside-range selections do not broaden the report.


### `dailyMovementReports.settings.get`
- **HTTP:** `POST /api/rpc/dailyMovementReports/settings/get` · **Code:** `backend/src/modules/daily-movement-reports/`
- **Access:** authenticated, non-temporary login with `CurrentUser.isSuperAdmin` on the active role; ACCESS Edit alone is insufficient.
- **Scope:** not limited by data access: one group-wide configuration, restricted to active Super Admin (section 8 settings); returns eligible role IDs/names, no role holders or employee records.
- **Input:** none.
- **Returns:** `{ setting: { id, isEnabled, hrHeadRole: { id, name } | null, sendAtMinutes, coverage, sendEmpty, updatedAt: Date | null }, roles: { id, name }[] }`. Eligible roles provide EMPLOYEES READ (WRITE includes READ).
- **Does:** reads singleton id 1. Before first save returns virtual defaults (disabled, no role, 540 minutes/09:00 IST, PREVIOUS_DAY, sendEmpty true, updatedAt null); GET never creates a row or selects a role. A saved role remains visible even if no longer eligible, so it can be corrected.
- **Errors:** UNAUTHORIZED; FORBIDDEN unless the active role is Super Admin.

### `dailyMovementReports.settings.save`
- **HTTP:** `POST /api/rpc/dailyMovementReports/settings/save` · **Code:** `backend/src/modules/daily-movement-reports/`
- **Access:** same active Super Admin requirement as settings.get, checked in service before other work.
- **Scope:** not limited by data access: singleton shared configuration reserved to active Super Admin; selecting a role never grants employee data access.
- **Input:** required `hrHeadRoleId` positive integer (existing role with EMPLOYEES READ), `sendAtMinutes` integer 0–1439 in IST, `coverage` TODAY | PREVIOUS_DAY, `sendEmpty` boolean, `expectedUpdatedAt` Date | null (null only for first creation). Strict object: unknown fields, including isEnabled and audit actors, rejected.
- **Returns:** saved configuration with the same setting fields as settings.get; updatedAt is the next edit's concurrency token.
- **Does:** atomically creates/updates id 1 with the logged-in actor and automatic change history. Conditional write rejects stale edits/duplicate first saves. Delivery stays disabled; no scheduler, recipients, mail or outbox are created in this stage. Role deletion is restricted while referenced.
- **Errors:** UNAUTHORIZED, FORBIDDEN, BAD_REQUEST for invalid input/ineligible role, CONFLICT for a stale edit; central FK error mapping if a role is concurrently removed.


## Payroll — Stage 1 (2026-11-26)

### `payroll.setup`
- **HTTP:** `POST /api/rpc/payroll/setup` · **Code:** `backend/src/modules/payroll/`
- **Access:** Payroll READ on the active role. Salary/Organization/Attendance access alone is insufficient.
- **Scope:** only active India payroll companies where a single active-role data-access row covers every plant and
  department at READ; WRITE also qualifies. Partial rows are never combined. Current attendance period is shared
  configuration, not employee attendance data.
- **Input:** `{ payMonth: Date }`, UTC midnight, first of month, years 2000–2100; strict object.
- **Returns:** `{ companies: [{ id, code, name, canCreate }], attendanceFrom, attendanceTo }`; canCreate requires
  Payroll WRITE for the whole company. No bank, statutory, salary or employee data is exposed.
- **Does:** supplies the company picker and current attendance window for regular monthly India payroll drafts - the
  window is the pay period the new run will have (2026-11-27).
- **Errors:** UNAUTHORIZED, FORBIDDEN, BAD_REQUEST for invalid month.

### `payroll.list`
- **HTTP:** `POST /api/rpc/payroll/list` · **Code:** `backend/src/modules/payroll/`
- **Access:** Payroll READ on the active role.
- **Scope:** `wholeCompanyScopeOf(viewer, PAYROLL, READ)` inside the repository's AND conditions; partial plant/department
  grants see no whole-company runs. Items/counts share scope, filters and repeatable-read transaction. Outside-range
  company selection returns zero, never broadens. No own-team or HOD fallback for financial company runs.
- **Input:** required year integer 2000–2100; optional positive companyId; page integer 1–100000 (default 1), pageSize
  integer 1–100 (default 25); strict object.
- **Returns:** `{ items: [{ id, company: { id, code, name }, payMonth, attendanceFrom, attendanceTo, status,
  peopleRefreshedAt, computedAt, people, createdAt, updatedAt }], total }` - `people`: how many people the run holds
  (stage 2); `computedAt`: when its days were last taken from attendance, null = not yet (stage 3). Current status
  DRAFT only.
- **Does:** lists newest month then ID, bounded pagination; existing runs remain readable when a company is retired
  or its India flag later changes. No raw actor IDs, employee population, financial totals or calculations.
- **Errors:** UNAUTHORIZED, FORBIDDEN, BAD_REQUEST for invalid filters.

### `payroll.get`
- **HTTP:** `POST /api/rpc/payroll/get` · **Code:** `backend/src/modules/payroll/`
- **Access:** Payroll READ on the active role covering the entire run company.
- **Scope:** same whole-company scope applied inside the ID query; outside range/missing run = NOT_FOUND.
- **Input:** `{ id: positive integer }`, strict object.
- **Returns:** list header fields plus `payFrom` / `payTo` (the days the run pays: the attendance cycle of its pay
  month as captured on the run - 26th to 25th with the start day of 26; the user, 2026-11-27. Equal to attendanceFrom /
  attendanceTo today, kept as their own fields because the rule lives in one function, `payPeriodOf`), `people`,
  `peopleWithoutSalary` (people with days that have no salary in force),
  `inputs`, `peopleRefreshedAt`, `canChange` (a draft and Payroll Edit over the whole company), `salaryHidden` (no Salary
  View over the whole company), and createdBy / updatedBy / peopleRefreshedBy / computedBy resolved through lookupPeople
  (code / name; System when actor 0), no raw actor IDs. Attendance dates are the captured historical dates.
  Stage 3 (2026-11-27): `computedAt` (when the days were last taken from attendance; null = not yet),
  `attendanceLocked` (every day of the pay period lies in a locked attendance month now - a shared setting, not anyone's
  attendance), `daysOutdated` (the days were taken, and attendance is now open or was locked again afterwards),
  `peopleWithUnpaidDays` and `peopleToCheck` (people with unclear days, absent throughout, or whose pay is not worked
  out), `peopleHeld` (pay held - see `payroll.people.list`), `peopleToWorkOutAgain` (their inputs changed after the pay
  was worked out) and `earnedGross` (what everyone earned in the period - a salary figure, null when `salaryHidden`) -
  all null until the pay is worked out (stage 3 money, 2026-11-27). `computedAt` is when the pay was last worked out.
  Stage 4 (2026-11-27): `deductions`, `netPay` and `employerContributions` (salary figures, null when `salaryHidden`)
  and `peopleWithoutPf` (worked-out people with no PF - their statutory details do not say "PF applicable").
- **Does:** read-only run header detail for `/manage/payroll/:id`.
- **Errors:** UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST.

### `payroll.create`
- **HTTP:** `POST /api/rpc/payroll/create` · **Code:** `backend/src/modules/payroll/`
- **Access:** Payroll WRITE on the active role, plus `assertWholeSlice` for the company.
- **Scope:** checks whole-company visibility before company lookup (outside range/partial-only grants = NOT_FOUND);
  whole-company View with insufficient Edit = FORBIDDEN. Never grants access through Salary/Organization or a team.
- **Input:** required companyId positive integer, payMonth as setup; expectedAttendanceFrom/expectedAttendanceTo Date
  values from the reviewed setup response. Strict object rejects status, actor IDs and stored attendance dates.
- **Returns:** `{ id }`.
- **Does:** transaction validates active India payroll company, rereads current attendance dates via attendance service,
  compares the reviewed window, then creates DRAFT with session actor. Stored dates come from the server. Company/month
  database uniqueness prevents duplicate/racing submissions. In the same transaction (stage 2, 2026-11-26) it copies
  the run's people and their salary stretches - see `payroll.people.refresh` for the rules. The captured attendance
  dates are the run's pay period (2026-11-27) and never move with a later change of the cycle. No computation, money
  calculation, approvals or payments.
- **Errors:** UNAUTHORIZED, FORBIDDEN, NOT_FOUND; BAD_REQUEST for input/inactive/non-India company; CONFLICT for a changed
  attendance preview or duplicate company/month (central Prisma mapping).

### `payroll.people.list`
- **HTTP:** `POST /api/rpc/payroll/people/list` · **Code:** `backend/src/modules/payroll/people/`
- **Access:** Payroll READ on the active role.
- **Scope:** the run is found with `wholeCompanyScopeOf(viewer, PAYROLL)` first (outside range / partial rows =
  NOT_FOUND); people rows are reached only through the run. Salary figures (annualCtc, monthlyGross, earnedGross) need Salary View
  over the whole company as well (`levelOver(viewer, SALARY, company)`; the user, 2026-11-26) - otherwise they are null
  and `salaryHidden` is true. No team or HOD fallback.
- **Input:** `{ runId: positive int, search?: string (max 100; code or name), flag?: 'NO_SALARY' | 'CHANGED' |
  'HAS_INPUTS' | 'NOT_IN_PERIOD' | 'UNPAID_DAYS' | 'UNCLEAR_DAYS' | 'ALL_ABSENT' | 'PAY_NOT_WORKED_OUT' | 'NO_PF', page (1-100000, default 1), pageSize
  (1-200, default 50) }`; strict.
- **Returns:** `{ items: [{ id (the person in the run), employeeCode (as in this company in the period), name, days,
  paidDays | null, unpaidDays | null, unclearDays | null (in days, a half = 0.5; null until the days are worked out),
  from, to, segments, inputs, annualCtc | null, monthlyGross | null, payStatus: 'WORKED_OUT' | 'HELD' | 'AGAIN' | null,
  heldFor: ('NOT_IN_PERIOD' | 'NO_SALARY' | 'OTHER_CURRENCY' | 'DAYS_MISSING' | 'NO_WORK_LOCATION' | 'NO_RATE' |
  'NO_COMPONENT' | 'OVER_HALF' | 'TAX_TO_TYPE')[], heldNote | null, earnedGross | null, deductions | null, netPay | null,
  flags: { noSalary, changed, hasInputs, notInPeriod, unpaidDays, unclearDays, allAbsent, payNotWorkedOut, noPf } }],
  total, counts: { all, noSalary, changed, hasInputs, notInPeriod, unpaidDays, unclearDays, allAbsent, payNotWorkedOut,
  noPf }, salaryHidden, daysWorkedOut }`. Sorted by code. `payStatus` null until the pay is worked out; `AGAIN` = their inputs changed since.
- **Does:** lists who the run pays and, per person, how many days, how many stretches (a mid-period salary or placement
  change makes two), days with no salary, inputs, and people kept only because they have inputs. Stage 3 (2026-11-27):
  the paid, unpaid and unclear days from the run's own day rows (the days are not money - no salary access needed);
  `allAbsent` = absent on every working half and never present, on duty, on leave or with a punch - most likely someone
  who does not punch, listed to be checked. Stage 3 money (2026-11-27): whether each person's pay is worked out, why it
  is held (no days in the period, days without a salary, a salary in another currency, days missing in attendance -
  never guessed) and their earned gross (the sum of their earning lines). Stage 4: the reasons and their detail are stored
  by "Work out pay" (`PayrollRunEmployee.heldFor / heldNote`); deductions and net pay (salary figures); `noPf` - pay
  worked out with no PF.
- **Errors:** UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST.

### `payroll.people.get`
- **HTTP:** `POST /api/rpc/payroll/people/get` · **Code:** `backend/src/modules/payroll/people/`
- **Access:** Payroll READ on the active role.
- **Scope:** run found with whole-company Payroll scope; the person must belong to that run (otherwise NOT_FOUND).
  Salary figures need Salary View over the whole company as for `payroll.people.list`.
- **Input:** `{ runId: positive int, personId: positive int }`; strict.
- **Returns:** `{ id, employeeCode, name, salaryHidden, segments: [{ id, fromDate, toDate, days, employmentType,
  workforceCategory, plant, department, costCenter | null, hasSalary, salary: { annualCtc, currency, effectiveFrom,
  reason, monthlyGross, lines: [{ component: { id, name, code, kind }, monthlyAmount }] } | null, employeeSalaryId |
  null }], days: [{ date, firstHalf, secondHalf ('PAID' | 'UNPAID' | 'UNCLEAR'), firstStatus, secondStatus (what
  attendance said; null = attendance had no day), firstLeaveCode, secondLeaveCode }] | null, dayTotals: { paidDays,
  unpaidDays, unclearDays, allAbsent } | null, pay: { status: 'WORKED_OUT' | 'HELD' | 'AGAIN', heldFor, heldNote, periodDays,
  lines: [{ component: { id, name, code, kind, enteredMonthly, cutForUnpaidDays, statutoryRole }, amount, base, fromInput }]
  | null, earnedGross | null, deductions | null, netPay | null, employerContributions | null } | null }` - `days` / `dayTotals` / `pay` null until the pay is worked out; `pay.lines` and `earnedGross` are
  salary figures (null without Salary View over the whole company), the status and reasons are shown to every viewer.
- **Does:** shows the copy the run holds for one person: each stretch of days with its placement and salary, and
  (stage 3, 2026-11-27) each day as the run took it from the locked attendance and what they earned; (stage 4) what is
  deducted and what the company pays on top, each with what it was worked out on (`base`), and the net pay.
- **Errors:** UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST.

### `payroll.people.refresh`
- **HTTP:** `POST /api/rpc/payroll/people/refresh` · **Code:** `backend/src/modules/payroll/people/`
- **Access:** Payroll WRITE on the active role, plus `assertWholeSlice` for the run's company.
- **Scope:** run found with whole-company Payroll scope (outside = NOT_FOUND); whole-company View only = FORBIDDEN. The
  people are read with `employeesService.listForPayrollRun` by the job timeline's company (a documented
  `// data access:` exception: today's placement does not say who worked for the company in the pay period).
- **Input:** `{ runId: positive int, expectedRefreshedAt: Date | null }` - the refresh time the screen showed; strict.
- **Returns:** `{ people }` - how many people the copy now holds with days in the period.
- **Does:** in one transaction, while the run is DRAFT: rebuilds the copy from the employee records as they are now.
  The pay period is the attendance cycle captured on the run (26th to 25th with the start day of 26; 2026-11-27).
  A person is in when the job timeline places them in the company on at least one day of the pay period between their
  joining and leaving dates (every employment type, consultants included). Their days are cut at every salary change and
  every job-timeline change of plant, department, cost centre, employment type or category; days in another company are
  left out. People who no longer belong are removed unless they have inputs (they stay, with no days). The days taken
  from attendance and the pay worked out from them (stage 3) belong to the old stretches: they are removed and
  `computedAt` emptied - worked out again with `payroll.calculation.compute`. Records the refresh
  on the run (`peopleRefreshedAt` / `ById` - in the change history); the copy rows themselves are not recorded
  (`core/audit` SKIP_MODELS, decided 2026-11-26).
- **Errors:** UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST; CONFLICT if the run is not a draft or was refreshed by
  someone else since the screen loaded.

### `payroll.inputs.list`
- **HTTP:** `POST /api/rpc/payroll/inputs/list` · **Code:** `backend/src/modules/payroll/inputs/`
- **Access:** Payroll READ on the active role.
- **Scope:** run found with whole-company Payroll scope; inputs reached only through the run.
- **Input:** `{ runId, personId?, salaryComponentId?, search? (code or name, max 100), page (default 1), pageSize
  (1-200, default 50) }`; strict.
- **Returns:** `{ items: [{ id, amount, note, createdAt, updatedAt, person: { id, employeeCode, name }, salaryComponent:
  { id, name, code, kind }, createdBy, updatedBy }], total }` - newest first; people as `{ employeeCode, name }`.
- **Does:** lists the month's typed inputs. Amounts are not salaries, so no Salary View is needed.
- **Errors:** UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST.

### `payroll.inputs.create`
- **HTTP:** `POST /api/rpc/payroll/inputs/create` · **Code:** `backend/src/modules/payroll/inputs/`
- **Access:** Payroll WRITE on the active role, plus `assertWholeSlice` for the run's company (a plant-level HR person
  sends their figures to someone with the whole company - the user, 2026-11-26).
- **Scope:** run found with whole-company Payroll scope; the person must belong to the run; never for one's own record
  (FORBIDDEN).
- **Input:** `{ runId, personId, salaryComponentId, amount: number (> 0, at most 1 crore, 2 decimals), note: string
  (2-500) }`; strict.
- **Returns:** `{ id, duplicate }` - `duplicate`: the person already had this component with this amount (a warning).
- **Does:** while the run is DRAFT, saves an amount for this month for a component marked "entered monthly" (its kind
  says earning or deduction). Recorded in the change history. The pay worked out for that person, and why they were
  held, are removed (stages 3-4): they show as "work out again" until `payroll.calculation.compute` runs once more. Of
  the statutory components only income tax is typed - it replaces the worked-out TDS (stage 4).
- **Errors:** UNAUTHORIZED, FORBIDDEN, NOT_FOUND; BAD_REQUEST for invalid input, an inactive component, one not
  entered monthly, or a statutory component other than income tax; CONFLICT if the run is not a draft.

### `payroll.inputs.update`
- **HTTP:** `POST /api/rpc/payroll/inputs/update` · **Code:** `backend/src/modules/payroll/inputs/`
- **Access:** as `payroll.inputs.create`.
- **Scope:** as `payroll.inputs.create`; the input must belong to the run (otherwise NOT_FOUND).
- **Input:** `{ runId, id, salaryComponentId?, amount?, note? }` (rules as create); strict.
- **Returns:** `{ id, duplicate }`.
- **Does:** changes an input while the run is DRAFT. A new component or amount removes the person's worked-out pay (as
  create); a new note alone does not.
- **Errors:** as `payroll.inputs.create`.

### `payroll.inputs.delete`
- **HTTP:** `POST /api/rpc/payroll/inputs/delete` · **Code:** `backend/src/modules/payroll/inputs/`
- **Access:** as `payroll.inputs.create`.
- **Scope:** as `payroll.inputs.create`; the input must belong to the run.
- **Input:** `{ runId, id }`; strict.
- **Returns:** `{ id }`.
- **Does:** removes an input while the run is DRAFT; the removal stays in the change history. The person's worked-out
  pay is removed (as create).
- **Errors:** UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST; CONFLICT if the run is not a draft.

### `payroll.calculation.compute`
- **HTTP:** `POST /api/rpc/payroll/calculation/compute` · **Code:** `backend/src/modules/payroll/calculation/` (the days:
  `payroll/days/`)
- **Access:** Payroll WRITE on the active role, plus `assertWholeSlice` for the run's company.
- **Scope:** run found with whole-company Payroll scope (outside range / partial rows = NOT_FOUND); whole-company View
  only = FORBIDDEN. The people are those of the run; their attendance days are read through
  `attendanceService.listPayrollDays` for exactly those employees (documented `// data access:` reads - the run was
  found with whole-company Payroll scope first). Attendance access is not needed: the days are the run's own copy.
  Salary access is not needed either: the answer holds counts, never an amount. No team or HOD fallback.
- **Input:** `{ runId: positive int, expectedComputedAt: Date | null }` - the time the screen showed the pay was last
  worked out (null = never); strict.
- **Returns:** `{ people, days (day rows written), peopleWithUnpaidDays, peopleWithUnclearDays, peopleHeld }` - counts
  only; the amounts are read with `payroll.people.list / get` under the salary rule. Also read for the deductions
  (stage 4): the statutory settings, the people's payroll facts (`employeesService.listPayrollFacts`), their opening tax
  figures and their earlier runs of the tax year in any company of the group (their own income tax - documented
  `// data access:` reads).
- **Does:** "Work out pay" - stage 3 (approved 2026-11-27). In one transaction, while the run is DRAFT and every day of its pay
  period lies in a locked attendance month: replaces the run's day rows (`PayrollRunDay`) - one per person and day inside
  their stretches - with each half classed from attendance: PAID (present, on duty, weekly off, holiday, leave of a paid
  type), UNPAID (absent, missed punch, leave of a type without pay) or UNCLEAR (attendance has no day, or a leave half
  with no approved leave found - never guessed), with attendance's status and the leave type's code. Payroll adds no
  rule of its own: an absent Saturday (half working day) is half a day unpaid; an off day between absences stays paid.
  A half the late rule made absent is unpaid like any absence unless regularized or corrected before the lock (the user,
  2026-11-27). Then, from those days, replaces each person's earning lines (`PayrollRunLine`), by the user's rule of
  2026-11-27 (to be checked against a greytHR register in the parallel run): a day is worth the monthly amount / the
  days of the pay period; an earning marked "cut for unpaid days" is paid for the paid halves, any other for every half
  in the company; per component the stretches are added up and rounded once, to the nearest rupee; earning inputs are
  paid as typed. Then (stage 4, approved 2026-11-27) the deductions and employer contributions from the earnings and the
  dated statutory settings (`payroll/deductions/deductions.service.ts`): PF on the earnings marked "PF wages" up to the
  ceiling (full wages with the joint option) for people whose statutory details say "PF applicable" - the employer's
  share split into EPS (members under the age limit) and EPF, EDLI on the capped wages; ESIC when the ESI wages of the
  salary at the start of the ESIC period (1 April / 1 October, or the joining day) were within the ceiling, each share
  rounded up; professional tax by the slab of the work location's State and LWF in its months; TDS new regime - the
  year's tax on the projected taxable salary (opening figures, earlier runs, this month, the months left; standard
  deduction, rebate with marginal relief, cess) less what was deducted, over the months left, or a typed income-tax
  input; typed deductions as typed. No ESIC / professional tax / LWF for consultants (TDS typed), no ESIC for
  apprentices. A person whose pay cannot be worked out (no days in the period, days without a salary, a salary in
  another currency, days missing in attendance; no work location, a rate or slab not in force, no component for a
  statutory amount, the old regime / a consultant / income above the surcharge limit without a typed TDS, deductions
  above half of the wages) gets no lines - held with the reasons and a note (`PayrollRunEmployee.heldFor / heldNote`),
  never guessed. Records it on the run (`computedAt` / `ById` - in the
  change history); the day and result rows themselves are not recorded (rebuilt each time, `core/audit` SKIP_MODELS).
- **Errors:** UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST; CONFLICT if the run is not a draft, the attendance period
  is not locked, or the pay was worked out by someone else in the meantime.

## Payroll — Stage 4, statutory settings and opening tax figures (2026-11-27)

The rates, ceilings and slabs every pay run's deductions are worked out with (approved by the user 2026-11-27: rates are
data - entered from the official notifications, nothing seeded; a figure not in force holds the person, never a zero).
The deductions themselves are worked out by `payroll.calculation.compute` and read with `payroll.people.list / get`.

### `payroll.statutory.list`
- **HTTP:** `POST /api/rpc/payroll/statutory/list` · **Code:** `backend/src/modules/payroll/statutory/`
- **Access:** Payroll: View.
- **Scope:** not limited by data access - one list for every company (rates and slabs, no people's records).
- **Input:** none.
- **Returns:** `{ rates: [{ id, parameter, effectiveFrom, value, reference, updatedAt, updatedBy }], ptSets: [{ stateCode,
  effectiveFrom, reference, updatedAt, slabs: [{ gender, wagesFrom, wagesTo, amount, specialMonth, specialAmount }] }], lwf:
  [{ id, stateCode, effectiveFrom, employeeAmount, employerAmount, months, reference, updatedAt, updatedBy }], taxSets: [{
  regime, taxYearFrom, reference, updatedAt, slabs: [{ incomeFrom, incomeTo, ratePercent }] }], canChange }` - `canChange`:
  Payroll Edit for every company.
- **Does:** the statutory settings page (`/manage/payroll/statutory`).
- **Errors:** UNAUTHORIZED, FORBIDDEN.

### `payroll.statutory.saveRate`
- **HTTP:** `POST /api/rpc/payroll/statutory/saveRate` · **Code:** `backend/src/modules/payroll/statutory/`
- **Access:** Payroll: Edit, for every company (`assertGroupWide`).
- **Scope:** not limited by data access - group-wide settings (Edit for all companies, otherwise FORBIDDEN).
- **Input:** `{ id?: positive int (a change), parameter: 'PF_EMPLOYEE_RATE' | 'PF_EMPLOYER_RATE' | 'EPS_RATE' | 'EDLI_RATE' |
  'PF_WAGE_CEILING' | 'EPS_AGE_LIMIT' | 'ESIC_EMPLOYEE_RATE' | 'ESIC_EMPLOYER_RATE' | 'ESIC_WAGE_CEILING' |
  'ESIC_WAGE_CEILING_DISABLED' | 'TAX_STANDARD_DEDUCTION' | 'TAX_REBATE_INCOME_LIMIT' | 'TAX_REBATE_MAX' | 'TAX_CESS_RATE' |
  'TAX_SURCHARGE_FROM', effectiveFrom: a day, value: number >= 0 (4 decimals), reference: string 3-300 }`; strict.
- **Returns:** `{ id }`.
- **Does:** saves one dated value. A rate in percent is at most 100; the EPS age limit is whole years; income-tax values
  start on 1 April. A change inside a pay period is split by days when pay is worked out. Recorded in the change history.
- **Errors:** UNAUTHORIZED, FORBIDDEN, BAD_REQUEST; NOT_FOUND unknown id; CONFLICT the same rate from the same day.

### `payroll.statutory.deleteRate`
- **HTTP:** `POST /api/rpc/payroll/statutory/deleteRate` · **Code:** `backend/src/modules/payroll/statutory/`
- **Access:** as `payroll.statutory.saveRate`.
- **Scope:** as `payroll.statutory.saveRate`.
- **Input:** `{ id: positive int }`; strict.
- **Returns:** `{ id }`.
- **Does:** removes a dated value (kept in the change history); draft runs use what is in force when worked out next.
- **Errors:** UNAUTHORIZED, FORBIDDEN, NOT_FOUND.

### `payroll.statutory.savePtSlabs`
- **HTTP:** `POST /api/rpc/payroll/statutory/savePtSlabs` · **Code:** `backend/src/modules/payroll/statutory/`
- **Access:** as `payroll.statutory.saveRate`.
- **Scope:** as `payroll.statutory.saveRate`.
- **Input:** `{ stateCode: 2 letters (upper-cased), effectiveFrom: a day, reference: string 3-300, slabs: 1-30 of { gender:
  'MALE' | 'FEMALE' | 'TRANSGENDER' | null, wagesFrom: whole rupees, wagesTo: whole rupees | null, amount: whole rupees,
  specialMonth: 1-12 | null, specialAmount: whole rupees | null (both or neither) }, replaces?: { stateCode, effectiveFrom }
  (the set being edited, when its State or day changes) }`; strict.
- **Returns:** `{ stateCode, effectiveFrom }`.
- **Does:** replaces the State's slabs from that day in one transaction. For each gender (and for everyone) the slabs
  start at 0, follow on without gaps or overlaps and the last has no upper limit. A State without professional tax gets a
  nil slab. Recorded in the change history.
- **Errors:** UNAUTHORIZED, FORBIDDEN, BAD_REQUEST (input, gaps or overlaps).

### `payroll.statutory.deletePtSlabs`
- **HTTP:** `POST /api/rpc/payroll/statutory/deletePtSlabs` · **Code:** `backend/src/modules/payroll/statutory/`
- **Access:** as `payroll.statutory.saveRate`.
- **Scope:** as `payroll.statutory.saveRate`.
- **Input:** `{ stateCode, effectiveFrom }`; strict.
- **Returns:** `{ count }`.
- **Does:** removes the State's slabs from that day.
- **Errors:** UNAUTHORIZED, FORBIDDEN, BAD_REQUEST; NOT_FOUND no such set.

### `payroll.statutory.saveLwf`
- **HTTP:** `POST /api/rpc/payroll/statutory/saveLwf` · **Code:** `backend/src/modules/payroll/statutory/`
- **Access:** as `payroll.statutory.saveRate`.
- **Scope:** as `payroll.statutory.saveRate`.
- **Input:** `{ id?, stateCode: 2 letters, effectiveFrom: a day, employeeAmount: 0-10 lakh (2 decimals), employerAmount:
  likewise, months: up to 12 of 1-12 (empty = every month), reference: string 3-300 }`; strict.
- **Returns:** `{ id }`.
- **Does:** saves a State's labour welfare fund from a day (deducted in the pay months listed). A State without the fund
  gets a nil row. Recorded in the change history.
- **Errors:** UNAUTHORIZED, FORBIDDEN, BAD_REQUEST; NOT_FOUND unknown id; CONFLICT the same State from the same day.

### `payroll.statutory.deleteLwf`
- **HTTP:** `POST /api/rpc/payroll/statutory/deleteLwf` · **Code:** `backend/src/modules/payroll/statutory/`
- **Access:** as `payroll.statutory.saveRate`.
- **Scope:** as `payroll.statutory.saveRate`.
- **Input:** `{ id: positive int }`; strict.
- **Returns:** `{ id }`.
- **Does:** removes a labour welfare fund row.
- **Errors:** UNAUTHORIZED, FORBIDDEN, NOT_FOUND.

### `payroll.statutory.saveTaxSlabs`
- **HTTP:** `POST /api/rpc/payroll/statutory/saveTaxSlabs` · **Code:** `backend/src/modules/payroll/statutory/`
- **Access:** as `payroll.statutory.saveRate`.
- **Scope:** as `payroll.statutory.saveRate`.
- **Input:** `{ regime: 'NEW' | 'OLD', taxYearFrom: 1 April, reference: string 3-300, slabs: 1-20 of { incomeFrom: whole
  rupees, incomeTo: whole rupees | null, ratePercent: 0-100 (2 decimals) }, replaces?: { regime, taxYearFrom } }`; strict.
- **Returns:** `{ regime, taxYearFrom }`.
- **Does:** replaces the slabs of a regime for a tax year. They start at 0, each where the one before ends, the last has
  no upper limit. Only the new regime is worked out today (the old one is typed). Recorded in the change history.
- **Errors:** UNAUTHORIZED, FORBIDDEN, BAD_REQUEST.

### `payroll.statutory.deleteTaxSlabs`
- **HTTP:** `POST /api/rpc/payroll/statutory/deleteTaxSlabs` · **Code:** `backend/src/modules/payroll/statutory/`
- **Access:** as `payroll.statutory.saveRate`.
- **Scope:** as `payroll.statutory.saveRate`.
- **Input:** `{ regime, taxYearFrom }`; strict.
- **Returns:** `{ count }`.
- **Does:** removes the slabs of a regime for a tax year.
- **Errors:** UNAUTHORIZED, FORBIDDEN, BAD_REQUEST; NOT_FOUND no such set.

### `payroll.taxOpenings.list`
- **HTTP:** `POST /api/rpc/payroll/taxOpenings/list` · **Code:** `backend/src/modules/payroll/tax-openings/`
- **Access:** Payroll: View.
- **Scope:** people's records - rows whose employee's company is inside the viewer's whole-company Payroll scope
  (`wholeCompanyScopeOf`, as pay runs: a plant-level row never counts), applied in the query. The amounts are salary
  figures: shown only with Salary View covering the employee's company as well (otherwise null, `amountsHidden`, and the
  row cannot be changed).
- **Input:** `{ taxYearFrom: 1 April, companyId?, search? (code or name, max 100), page (default 1), pageSize (1-200,
  default 50) }`; strict.
- **Returns:** `{ items: [{ id, taxYearFrom, throughPayMonth, taxableIncome | null, taxDeducted | null, amountsHidden, note,
  updatedAt, employee: { employeeCode, name }, updatedBy, canChange }], total }` - by employee code.
- **Does:** what employees earned and had deducted as income tax earlier in the tax year outside this system (greytHR
  before the go-live, a previous employer - Form 122); the monthly TDS spreads the rest of the year's tax over the months
  left.
- **Errors:** UNAUTHORIZED, FORBIDDEN, BAD_REQUEST.

### `payroll.taxOpenings.save`
- **HTTP:** `POST /api/rpc/payroll/taxOpenings/save` · **Code:** `backend/src/modules/payroll/tax-openings/`
- **Access:** Payroll: Edit.
- **Scope:** the employee's company must be inside the viewer's whole-company Payroll scope (otherwise NOT_FOUND), at Edit
  (View only: FORBIDDEN); never one's own record (FORBIDDEN).
- **Input:** `{ id? (a change), employeeCode, taxYearFrom: 1 April, throughPayMonth: the first day of a month inside the
  tax year, taxableIncome: whole rupees, taxDeducted: whole rupees, note?: string up to 500 | null }`; strict.
- **Returns:** `{ id }`.
- **Does:** saves one employee's opening figures for a tax year (one row per employee and tax year; a change keeps its
  employee and tax year). Pay runs of later months in this system are added on top. Recorded in the change history.
- **Errors:** UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST; CONFLICT figures for that employee and tax year exist.

### `payroll.taxOpenings.delete`
- **HTTP:** `POST /api/rpc/payroll/taxOpenings/delete` · **Code:** `backend/src/modules/payroll/tax-openings/`
- **Access:** as `payroll.taxOpenings.save`.
- **Scope:** as `payroll.taxOpenings.save`.
- **Input:** `{ id: positive int }`; strict.
- **Returns:** `{ id }`.
- **Does:** removes opening figures (kept in the change history).
- **Errors:** UNAUTHORIZED, FORBIDDEN, NOT_FOUND.

## Attendance — "attendance not tracked" (2026-11-27)

Who is marked is read with the Schedules list: `attendance.shifts.schedules` (`notTracked` on each row, and its filter).

### `attendance.exemptions.create`
- **HTTP:** `POST /api/rpc/attendance/exemptions/create` · **Code:** `backend/src/modules/attendance/exemptions/`
- **Access:** Attendance setup: Edit (the user, 2026-11-27: on Schedules, with the other per-person settings).
- **Scope:** every employee named must be inside the caller's Attendance setup data access - each one is checked
  (`assertAttendanceEdit`): outside the View range `404`, View only `403`; nothing is saved for anyone when one fails.
- **Input:** `{ employeeCodes: string[] (1-2000), fromDate: Date, toDate?: Date | null (null / left out = until ended; never before fromDate), reason: string (3-300) }`; strict.
- **Returns:** `{ marked, unchanged }` - `unchanged`: those already not tracked on every one of those days.
- **What it does:** "attendance not tracked" (approved by the user 2026-11-27, for payroll): from `fromDate` each of
  these employees counts PRESENT on the working halves of their days whatever the punches say - no punch is not absent,
  one punch is not a missed punch, nothing is late or early (the late rule never cuts them); the day's note says so.
  Weekly offs, holidays and the off half of a half day stay; approved leave / on duty still shows; HR's correction of a
  day still wins. One person's markers never overlap: someone already marked for only some of the days is refused. The
  days already worked out from `fromDate` (up to today) are worked out again at once; months never worked out stay so.
  Kept in the change history.
- **Errors:** `400` unknown employee code, last day before the first; `403`; `404`; `409` a locked attendance month
  lies in the stretch (open it first), or someone already has a marker over part of it.

### `attendance.exemptions.update`
- **HTTP:** `POST /api/rpc/attendance/exemptions/update` · **Code:** `backend/src/modules/attendance/exemptions/`
- **Access:** Attendance setup: Edit.
- **Scope:** the marker's employee must be inside the caller's Attendance setup data access (outside the View range
  `404`, View only `403`).
- **Input:** `{ id, toDate: Date | null (null = until ended), reason?: string (3-300) }`; strict. The first day does not
  change - a marker that started on the wrong day is removed and set again.
- **Returns:** `{ id }`.
- **What it does:** ends the marker on a day (when the person starts to punch), or lets it run on again, and corrects
  its reason. Only the days between the old and the new last day change; they are worked out again.
- **Errors:** `400` last day before the first; `403`; `404`; `409` a locked attendance month lies in the days that
  change, or making it longer would run into another marker of the same person.

### `attendance.exemptions.delete`
- **HTTP:** `POST /api/rpc/attendance/exemptions/delete` · **Code:** `backend/src/modules/attendance/exemptions/`
- **Access:** Attendance setup: Edit.
- **Scope:** as `attendance.exemptions.update`.
- **Input:** `{ id }`; strict.
- **Returns:** `{ id }`.
- **What it does:** removes a marker set by mistake: all its days are worked out from the punches again (a working day
  without a punch becomes absent). The removal stays in the change history.
- **Errors:** `403`; `404`; `409` a locked attendance month lies in its days.
