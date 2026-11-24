# Backlog - things deferred for later

Work we decided **not** to do yet, so nothing is forgotten. Each item says why it waits and what it needs.

**Rules** (also in CLAUDE.md):
- Whenever something is deferred ("later", "when login exists", "ask HR"), add it here in the same change.
- When an item is done, delete it from this file in the same change.

## To build later

### Next modules - in the order an employee lives them (decided by the user, 2026-11-16)
After onboarding and the employee's own login / profile (done), the modules follow a regular employee's working life,
one at a time, each planned with the user before it is built (the old HRMS is inspiration only):
1. **Attendance** - marking attendance every day - **done (2026-11-16)**; what is left is item 19
2. **Leave** - applying for leave (leave types, balances, approval by the reporting manager; the holiday calendar is
   attendance's) - **done (2026-11-22, built while the user was away, after the old HRMS's rules)**; what is left is item 29
3. **Regularization / OD** - fixing a missed punch, on-duty outside the office - **done (2026-11-22, with leave)**; what
   is left is item 29
4. **Payroll** - the month-end salary from attendance and leave - **next**
5. **Probation / confirmation** - intern -> probation, probation -> confirmed, with or without a salary hike
6. **Promotion and increments** - a promotion with a hike, or a hike alone (salary revisions) - **done through job
   changes and the approval service (2026-11-20)**; what is left is item 24
7. **Resignation / exit** - notice period, clearance, final settlement; then the experience and relieving letters
   (item 5)

### 0. Old-HRMS features we still lack - the plan (agreed 2026-11-16)
Everything the old HRMS has in the modules built so far, added phase by phase; each phase is proposed (tables and
fields) before it is built. **Phase 1 is done (2026-11-16):** reporting manager, employee codes from a series per
company, "Add employee" / "Edit details", Excel import of existing employees, the directory's Excel export, saved views
and the "Reports to" filter.
- **Phase 2 - change history: done (2026-11-16)** - what is left of it is item 3b.
- **Phase 3 - login and security: done (2026-11-16)** - what is left is in item 3.
- **Phase 4 - access scopes: skipped for now (2026-11-16 - "we will do this later")** - the plan is in item 3a. Its
  "personal details" access area is done: the employee areas were split in four on 2026-11-16 (Employee directory &
  job / personal details / IDs, bank & PF-ESIC / documents, next to Employee · Salary and medical information).
- **Phase 5: done (2026-11-16)** - decided instead of self-service: employees change nothing in the system (they write
  to HR outside it); HR edits every section of the profile (`employees.form.*`) and manages the employee's documents
  (`employees.documents.upload / review / delete / restore`, 4 new document types); the background worker
  (`src/worker.ts`) with session clean-up and the reminders of item 6.
- **Phase 6 - onboarding extras: done (2026-11-16) except the offer approval** (skipped by the user - item 2): the
  Letter of Intent before the full offer, joining tasks for other teams (each task given to one person with the
  "Joining tasks" access, My tasks page, morning reminders), and letters to employees (appointment automatically on
  the joining day; confirmation, experience, relieving by HR) - item 5.
- **Phase 7 - skipped for now (2026-11-16 - "leave phase 7, add in the backlog"):** item 15 (offers from an outside
  recruitment system - only if one is used) and item 16 (home pages per role). Both wait here; each is proposed first
  when picked up.

### 2. Offer approval chain (skipped in phase 6, 2026-11-16)
- **Now:** HR creates an offer (or a Letter of Intent - done 2026-11-16) and sends it directly - no approval step
  (decided 2026-11-11; the approval was skipped again when phase 6 was built).
- **Later:** an offer goes for approval before it is sent - the old HRMS: plant head -> HR head -> CEO cell, each with
  a time limit (48 / 48 / 72 h) and escalation when it passes; a rejected offer is not sent. **The approval service exists
  since 2026-11-20 (modules/approvals - item 24)**: an offer would be a new kind with its chain; what it needs first is a
  request whose subject is a candidate (no login, no manager - its plant and department decide the role / HOD steps).
- **Needs:** who approves which offer (ask HR - e.g. by CTC or grade, and whether the old chain still applies) and the
  approvers' access (roles and access exist since 2026-11-12).
- **Ask HR:** the wording of the Letter of Intent - there is no LOI template yet; HR adds one on the Letter templates
  page (kind "Letter of Intent") before the first LOI can be sent.

### 3. Login and access: what is still missing
- **Done:** employee-code + password login and sessions (2026-11-11); roles as data with View / Edit per area,
  several roles per employee, the "Roles & access" page and the built-in Super Admin; change own password,
  temporary passwords (new login / admin reset), lockout after 5 wrong passwords, giving logins on the page
  (2026-11-12).
- **Done (2026-11-15):** a login for every new joiner on the joining day, e-mailed to the personal e-mail (else HR
  is shown the temporary password once); "Forgot password?" on the sign-in page (a code by e-mail).
- **Done (2026-11-16, phase 3):** sign in with the work e-mail too; passwords of 10+ characters, not one of the last 5;
  the password re-entered before changing roles (10 minutes); everyone's sessions on Roles & access and one's own on
  Change password, with "log out"; last login; turning a login off / on; roles x access as Excel.
- **Still to do:** a job that deletes expired sessions (today they are removed at the next login of that account) -
  needs the background-jobs worker (phase 5). Passwords set before 2026-11-16 may be shorter than 10 characters
  (decided: the rules apply at the next change, nobody is forced).
- **Logins for employees who joined before 2026-11-15, were added with "Add employee" or imported** (as in the old
  HRMS, 2026-11-16: no automatic login): HR gives them one by one on the Roles & access page. **Later:** "give logins"
  to many employees at once (e.g. a whole import), e-mailed in batches.
- **Employees changing their own details:** decided 2026-11-16 - **not in the system.** The employee writes to HR
  outside it; HR (Employees: Edit) changes the record on the profile. No change requests, no uploads by employees.

### 3a. Data access by company, plant and department (agreed with the user 2026-11-18 - phases 0-5 built)
Compared with the old HRMS (org units, fails open, gaps) and VBMS (company -> plant -> department tree, leaks through
forgotten filters and grant hand-outs) on 2026-11-17. A role says WHAT (areas, View / Edit); data access says WHOSE.
- **Rows per role given to a login** (not per login): company, plant, department - each "all" or one - and View / Edit,
  so one person can be "HR for RML" and "Payroll for the whole group". **Changed 2026-11-23 (the user): one role at a
  time** - the person picks the active role in the account menu, and for an area their level is the lower of that role's
  level and its row level; roles are no longer combined (the old rule took the best over all roles). No rows = nothing
  (own record, own team and own department still work). An employee with no department is covered only by
  "all departments" rows. Super Admin = everything, decided in one place.
- **Records** (employees, candidates and what hangs on them) by their company / plant / department. **Belongs to one
  company** (its holidays, its details, its plants and their departments): Edit covering what it affects. **Shared by
  all companies** (shifts, default shift, patterns, every-company holidays, joining task types, master lists, letter
  templates, roles, security settings): a role giving that area for All companies at Edit. The whole **Change history**
  page needs All companies; each profile's History tab follows the employee.
- **Enforced:** every read of employees / candidates takes a required data-access filter (scripts / jobs pass an explicit
  "system" one); a record outside your access answers "not found"; a move (plant / department / offer company) needs
  Edit on the old and the new placement; directory counts and tiles count only what you see; people pickers use a
  group-wide code + name search; the offer page's duplicate warning shows employees you cannot see as code + name only;
  every API in the tracker gets a "Scope:" line.
- **Giving access:** Roles & access: Edit with the password re-entered; a role can only be given with rows your own access
  covers for every area of that role; nobody changes their own data access or a Super Admin's.
- **On deploy:** every role already given gets All companies - Edit (nothing changes); new ones start empty.
- **Phases:** 0 plant-department links can be retired + tests (Vitest, a test database); 1 the rows, the rule engine,
  the "Data access" editor per role on a person, `accounts.me`; 2 employees (+ people search, "Scope:" lines, tests);
  3 candidates / onboarding, joining tasks; 4 attendance, change history, the shared-settings rule; 5 HOD (3e).
- **Done (2026-11-18): phases 0-4**, and phase 5 (the HODs - 3e) - every API has its `- **Scope:**` line (`check:api-tracker` requires it); tests in
  `backend/tests/data-access-*.test.ts`. **Still not limited (said so in their Scope lines):** the history of employee
  imports and punch uploads, and the punch codes that matched no employee - **needs:** a company on those rows.
- **Not clicked through in the browser yet:** the "Data access" rows on Roles & access, the forms offering only what the
  user may choose, the Plant filter on the directory.
- **One role at a time - e-mails still look at every role (2026-11-23):** `accountsService.mailRecipients` /
  `mailRecipientsFor` (reminders, approval and HR notices) pick everyone whom *any* of their roles covers, while the pages
  use only the active role. So someone can be e-mailed about a request they see only after switching to the right role.
  Kept for now (being told is better than missing it). **Later:** say in the e-mail which role to switch to, or decide
  with the user that e-mails follow something else.
- **Narrowing goes top-down:** someone can only manage logins whose roles and data access are within their own. After the
  deploy every role covers every company, so the first narrowing of each person must be done by someone with all
  companies (in practice the Super Admin); an HR person narrowed to RML cannot then reset or re-role people still on
  every company.

### 3b. Change history: what is still open
- **Done (2026-11-16, phase 2):** every create / change / delete recorded automatically (`core/audit`, `audit_logs`)
  with old -> new values, who, which API, IP; sign-ins and failed sign-ins; hash chain + "Check integrity"; the
  Change history page and each employee's history on the profile.
- **Who looked at whose data** (the old HRMS had the table but never filled it): reads are not recorded. **Needs:**
  which views count (a profile, a salary, a document download), and a screen for the employee ("who viewed my data").
- **Kept for good** - no clean-up. **Later, if the table grows large:** a retention period (ask HR / legal) and an
  archive that keeps the chain checkable.
- Changes made directly in the database (SQL, outside the app) are not recorded - only the history rows themselves
  are protected by the chain.

### 3d. VBMS sub-departments and department heads
- **Done (2026-11-18):** which departments run at which plant - VBMS's 1,728 links imported (`npm run import:vbms`),
  changed on the Organization page (Plants, "Departments"). **HR to tidy:** VBMS had some departments at every plant
  (PPC, Legal, MIS... even at the Iraq / Morocco offices) - untick the ones that do not really run there.
- **HOD:** built 2026-11-18, redesigned 2026-11-19 - see 3e: the HOD post is the plant-department itself (VBMS's heads on
  10 links were not imported: HR appoints the HODs on the Organization page, Department heads).
- **Later, if needed:** VBMS's 618 sub-departments (e.g. ADMIN > Security, Transport). greytHR's "Department" is often
  this finer level (Casting, Finishing Line) and its DEPTMIS our department (88% of 3,634 employees match by name).
  **Needs:** HR to decide whether employees are placed in a sub-department.
- **Companies without a plant** (e.g. RGRP, Rashmi Group): no offer or employee can be made for them until HR adds a
  plant on the Organization page - plant is required (2026-11-18).

### 3e. HOD posts and appointments (phase 5 of 3a - built 2026-11-18, redesigned with the user 2026-11-19)
- **About 15-20 HODs**, each heading an irregular set of places (the user, 2026-11-19) - so an **HOD post is a
  plant-department**: one company + one of its plants + one department running there (VBMS-style). It exists as soon as
  the department is ticked at the plant (Organization page, Plants) - nothing else to create or keep in step. A
  plant-department with HOD history is retired, never deleted, when unticked. (The first design of 2026-11-18 - posts for
  "every plant" / "every department", HR picking among several fitting posts, the "HOD code" import column, the move
  tool - was replaced before use.)
- **Appointment** = who heads a post **from a moment until a moment** (the end not included; changed with the user
  2026-11-19 - before, from a day to a day, today or earlier only); **one HOD per post at a time** (the database refuses
  overlaps); appointing someone ends the HOD then at that very moment. A change takes effect **now**, from a **later day**
  (upcoming - cancelled by ending it before it starts; nothing has to run when it comes) or an **earlier** one (backdating,
  back to the start of the appointment going on - older history never changes). Days and times are **India time
  for every plant** (the user, 2026-11-19 - a plant time zone was tried and removed the same day): a day starts at
  midnight IST, a last day ends at the midnight after it; an optional time for an exact handover. "Who was the HOD
  at 15:00 on 15-05" can always be answered. One person heads any number of places, in any companies.
- **Every employee stores their HOD post** (`employees.hod_post_id`, kept by the user's decision 2026-11-19 - to find the
  HOD directly, and for later exceptions): for now always the plant-department they are placed in, set whenever they are
  placed (Add employee, Edit details, the joining day, the import) - every employee has a department since 2026-11-19
  (the user), so every employee has one. Because the place is stored, not the person, replacing an HOD moves all their
  employees at once.
- **An HOD gets** a read-only "My department" (the employees of the places they head, never themselves: directory & job +
  attendance) - no role needed, from the moment the appointment starts (an upcoming one gives nothing yet - my default,
  2026-11-19, the user did not choose; widen it if HR wants the new HOD to see the team before); approvals (after the
  reporting manager) come with leave / regularization.
- **Access area "HOD appointments"** (View / Edit): Edit only for places inside the data access of the role giving it.
- **Built (2026-11-19):** `hod_appointments` on `plant_departments`, `employees.hod_post_id`; the APIs `employees.hods.*`
  (list of HODs with their places, places, appoint - several places at once, ending some at the same time - end,
  history, gaps, "My department"); the profile shows the HOD; the Organization page's "Department heads" tab (the HODs
  and where each serves; Add HOD, Change places, Hand over, End, History, the gap list); the "My department" page and
  Attendance tab; tests in `backend/tests/data-access-hods.test.ts`.
- **With the leave module (approvals):** a place without an HOD sends its approvals to HR; who approves for an HOD who
  heads the place they work in themselves; requests waiting with an HOD who moves (proposed: they follow the place).
- **Leavers (2026-11-19):** nothing records a resignation yet - HR ends the appointment with the last day, in advance too;
  the gap list flags places whose HOD stops with nobody appointed after, and HODs (now or upcoming) who have left or whose
  leaving day comes before their appointment ends; nobody can be appointed from after their leaving day. **With the exit
  module:** recording the last working day plans the end of the leaver's appointments (and cancels upcoming ones).
- **Later (when HR needs it):** an HOD from another place for one employee (`hod_post_id` set by hand - the field is
  ready, the screen is not), an acting HOD, sub-departments; the HOD in the directory list and its Excel export.
- **Done (2026-11-20):** a plant's HOD history per department on the Department heads tab (By place), former
  HODs too; the Department heads tab clicked through in the end-to-end test (`docs/test-runs/2026-11-20-end-to-end.md`).
- **Not clicked through in the browser yet:** "My department".

### 4. Candidate joining-form portal: what is still open
- **Done (2026-11-13):** after accepting, the candidate opens their joining form with the offer link + a one-time
  code, fills every section (incl. education, certifications, previous jobs, family, nominees), uploads their
  documents and signs it online; HR can correct it, send it back with a reason, and is e-mailed when it is signed.
- **Printing the filled forms after joining:** since 2026-11-15 HR prints the pack filled in before joining
  (`candidates.printedForms.print`), but the joining-form draft is cleared on the joining day, so a reprint later (a
  lost copy, a new Form F after marriage) would have to be written from the employee record. Needs: the same layout fed
  from the employee's tables - when HR asks for it.
- **Non-Western characters on the printed forms:** names and addresses are printed with the built-in PDF font, so
  letters outside Western scripts (e.g. Hindi typed in a name) come out as "?". Needs: an embedded Unicode font
  (`@pdf-lib/fontkit` + a font file - a new library, ask first) if HR sees such entries.
- **Ask HR:** the exact wording of the joining form's §10 declaration - the text the candidate signs online is in
  `JOINING_DECLARATION` (`modules/candidates/joining-form/joining-form.service.ts`) and is stored with each signature.
- **Candidates without an e-mail address** cannot sign in (the code goes by e-mail): HR fills the form and it is
  signed on paper. Later: codes by SMS (needs an SMS provider).
- **E-mails not yet sent:** to the candidate when HR rejects a document (they see it on their page); reminders to
  finish the form (needs background jobs - item 6).

### 5. Letters to employees (and the other offer letter wordings)
- **Done (2026-11-12):** the offer letter - written from an editable template (wording + letterhead) HR picks when sending, numbered,
  e-mailed, accepted online or on paper.
- **Done (2026-11-16, phase 6):** the appointment letter issued automatically on the joining day (mandatory under the
  OSH Code) and e-mailed; confirmation, experience and relieving letters issued by HR from the profile's Letters tab
  (`employeeLetters.*`), each numbered and kept as issued.
- **Ask HR:** the wording of the appointment, confirmation, experience and relieving letters - no templates exist yet;
  until an appointment letter template is ready the joining day says so and HR issues it later from the profile.
- **Later - with the resignation module:** experience and relieving letters issued after the manager's approval of the
  resignation (decided 2026-11-16 - by HR by hand until then), with the last working day taken from the exit.
- **Later - with the confirmation process:** the confirmation letter issued when HR confirms the employee (today HR
  sets the confirmation date with Edit details, then issues the letter).
- **Ask HR:** the wording for Consultant & Intern and Overseas offers - until then the one offer letter (from the RML
  appointment letter of Oct 2025) is used for every joining type. HR can add them on the Letter templates page.

### 5a. Offer letters: what is still open
- **E-mail server:** `backend/.env` now uses the CRM's Outlook mailbox (`ithelpdesk@rashmigroup.com` via
  smtp.outlook.com:587, from `crm_full/CRM/.env`, 2026-11-13). From the development PC the connection is cut at the
  encryption (STARTTLS) step - the server greets, then the connection is reset - so a firewall / antivirus on this
  network blocks outgoing mail. Needs: send from the server (or IT to allow port 587 from this PC), then one test
  e-mail. **Ask HR / IT:** should offers come from an HR mailbox instead of the IT helpdesk one? Without `SMTP_HOST`,
  e-mails are saved in `backend/storage/outbox/` and HR shares the link by hand.
- **Letterheads:** upload the header, footer and stamp + signature images on each letter template (Letters page) -
  e.g. one offer letter template per company.
- **When deployed:** the IP kept as proof of an online answer is right behind a proxy on the same machine (nginx /
  IIS - `trust proxy` is `loopback`, 2026-11-13). If the proxy / load balancer runs on another machine, add its
  address to `trust proxy` in `app.ts`, otherwise the proxy's IP is recorded.
- **Maybe later:** e-mail HR when a candidate answers online (today HR sees it on the candidate); Aadhaar eSign for
  the appointment letter if HR / legal want a stronger signature than the online acceptance.

### 6. Automatic reminders (background jobs)
- **Done (2026-11-16, phase 5 - `src/worker.ts`, run with `npm run worker -w backend`):** offers past their valid-until
  date become `EXPIRED` (daily 01:00); HR is e-mailed the candidates joining in the next 3 days (from tomorrow - today's can no longer be confirmed, 2026-11-23) whose joining is not confirmed
  (daily 08:30) and the background checks still open after joining (Mondays 09:00) - "HR" = everyone with Onboarding:
  Edit; expired sessions are removed hourly.
- **Still open:** an "Are you still joining?" e-mail to the candidate a few days before; flagging a candidate who did not
  turn up as a possible no-show. **Needs:** the wording of the candidate e-mail (ask HR).
- In production the worker must run as its own process next to the API (like `npm start`: `npm run start:worker`).

### 7. Cloud file storage
- **Now:** uploaded documents are saved on the server's disk (`STORAGE_DIR`, default `backend/storage/`), which
  must be backed up together with the database (decided 2026-11-11).
- **Later:** S3 / Azure Blob. Only `backend/src/core/storage/file-storage.ts` changes.

### 8. Rehiring an ex-employee
- An identity number (Aadhaar, PAN...) can belong to only one employee, so the joining form of a returning
  ex-employee is refused ("This PAN already belongs to employee X (EXITED)").
- **Decide with HR:** re-activate the old employee record (same code) or create a new one and move the identity
  numbers.

### 9. Do not upgrade `pg` to version 9 yet
- Prisma's Postgres adapter (`@prisma/adapter-pg`) runs overlapping queries on one connection, which `pg` 8 only
  warns about ("Calling client.query() when the client is already executing a query") and `pg` 9 will reject.
  Upgrade only once Prisma supports it.

### 10. More background-check types
- **Now:** IDENTITY, ADDRESS, EDUCATION, EMPLOYMENT, CRIMINAL, REFERENCE (decided 2026-11-11).
- **Later, only if required:** DRUG_TEST, CREDIT (one enum value each in `onboarding.prisma`).
- **The agency's report file:** a check keeps only its status, remarks and the agency's case number - the report the
  BGV agency sends has no place (there is a document type for the signed consent, `BGV_CONSENT_FORM`, but none for the
  report). Deferred 2026-11-15. **Needs:** a document type such as `BGV_REPORT` (enum in `employee.prisma`, labels),
  ideally linked to the check it belongs to, and an upload on the Background checks tab.

### 11. Employee fields that belong to later modules
Compared with an employee-profile screen from another HR system (2026-11-14); these were left out on purpose:
- **Salary:** since 2026-11-15 the offer's salary and breakup are copied on the joining day as the employee's first
  salary (`employee_salaries` + `employee_salary_lines` in `payroll.prisma`, effective from the date of joining; the
  employees who had already joined were filled in from their offers); the profile's Salary tab shows the salary in
  effect (the employee themselves or the `SALARY` access, 2026-11-15). Not yet: revisions / increments (a new row from its effective date), salary for
  employees without an offer (entered by HR), pay runs and deductions. **Needs:** the payroll module.
- **Residential status** (resident / non-resident for income tax): decides how tax is deducted from salary, so it
  belongs to the **payroll** module - HR / payroll sets it, not the candidate. **Needs:** the payroll module, and the
  status values as payroll uses them.
- **Office phone extension:** not known on the joining day; HR / IT gives it later. **Needs:** an employee edit
  screen (today the employee record is only created at joining), and HR to confirm extensions are still used.

### 12. Employee profile page: what is still open
- **Photo:** the photo the candidate uploads (document type `PHOTO`) is kept with the employee's documents but not
  shown as the profile picture yet (decided 2026-11-14: "we will do the profile part later"). **Needs:** a profile
  picture on the employee page (and in the app header), read from the employee's newest verified `PHOTO`.
- **Background checks on the employee:** since 2026-11-15 a check belongs to the employee directly
  (`background_checks.employee_id`, set on the joining day and on checks started after it; `candidate_id` is optional),
  but the checks are shown and started only on the candidate's onboarding page - the employee profile does not show
  them, so a pending or failed check is not seen there, and an employee HR adds without onboarding ("Add employee" or
  the import, since 2026-11-16) has nowhere to start one. Deferred 2026-11-15. **Needs:** a Background checks section on the employee profile
  (list by `employee_id`; start / update a check for the employee, with the consent form among the employee's
  documents) and its access rule (Employees area), plus an API that takes an employee instead of a candidate.

### 13. Employees' own documents and expiry alerts (phase 5)
- **Now:** documents come from onboarding; HR sees them on the profile, the employee on /me (read-only).
- **Later (old HRMS):** some document types need an expiry date, shown as valid / expiring / expired with a "needs
  attention" filter; reminders before expiry (the old HRMS had no reminder job). HR uploads the renewed copy - employees
  upload nothing (decided 2026-11-16, item 3).
- **Needs:** which types expire (passport, visa, driving licence, medical fitness...), a background-jobs worker for the
  reminders (item 6).

### 14. Joining tasks: what is still open
- **Done (2026-11-16, phase 6):** the task list (Joining tasks page, Onboarding: Edit) with a default person per task;
  on the joining day each task is given to the person HR picks (default pre-filled); My tasks / All tasks; a daily
  reminder of due and overdue tasks to each person (unassigned ones to HR).
- **Done (2026-11-20):** a task's team is a role with "Joining tasks: Edit"; at joining each task starts ticked, HR unticks
  the ones the employee does not need, and every ticked task must go to a holder of its role covering the employee (or,
  with no task type at all, HR ticks "No joining tasks"); the Task types tab only for Onboarding.
- **Ask HR:** the task list itself (who does what, in how many days) - HR adds it on the Joining tasks page, and gives
  the people who do them a role with "Joining tasks: Edit".
- **Later, if HR wants:** escalation of overdue tasks to the person's manager (the old HRMS had it but it never ran);
  tasks per company / plant (needs the access scopes of item 3a).
- **Employees added with "Add employee" or imported** get no tasks automatically; HR makes them from the profile's
  Record tab ("Make joining tasks") when they are new joiners.

### 15. Offers from an outside recruitment system (phase 7 - skipped for now)
- The old HRMS received accepted offers from an ATS (recruitment app) machine to machine.
- **Needs:** only if an ATS is used - which one, and what it sends.

### 16. Home pages per role (phase 7 - skipped for now)
- **Now:** one home page for everyone (profile, quick links, the areas their roles open).
- **Later (old HRMS):** a home page for HR (to-dos), managers (team), payroll, leadership.
- **Needs:** data to show - attendance, leave and payroll (later modules).

### 17. Directory: saved views per browser
- **Now (2026-11-16):** saved views of the employee directory are kept in the browser (a view is the page address).
- **Later:** if they must follow the employee to other devices, keep them in the database per login.

### 18. Old-HRMS gaps from the second comparison (2026-11-16)
The second comparison of the old HRMS with the new one (only the modules built so far) found these gaps that were not
in this backlog yet. `[x]` done, `[ ]` to do, `[?]` needs the user's / HR's answer, `[later]` waits for a later module.
Rule (the user, 2026-11-16): the old HRMS is inspiration only - its fields and screens are not copied; each need is
designed the HRMS_NEW way, and a field without a clear purpose waits for an answer.
Matched to the old HRMS in the same round (the user asked): grade rank (lower = more senior), joining no longer waits
for the medical result and the verified documents (shown as reminders), "Add employee" needs only company, first name
and date of joining (future joining dates allowed, the three kinds default to Regular / Permanent / White collar), and a
sign-in lasts 7 days from signing in (now a security rule).

**Login and security**
- [x] Limits on repeated tries at the password APIs: 5 a minute per account and action, 300 in 15 minutes per IP
  (`core/auth/rate-limit.ts` - in memory, one API process).
- [x] Security rules on a screen: Roles & access → "Security rules" (`accounts.security.*`): lockout tries and minutes,
  sign-in length, password length and history, reset-code minutes, re-enter-password minutes; changing them needs the
  password re-entered. The password pages show the rule in force.
- [?] Logins that are not an employee (old: admin / service accounts by e-mail). **Ask:** are they needed? Every "by"
  column holds an employee id today.
- [?] Block changes to history rows in the database itself (old: a database trigger). **Ask:** CLAUDE.md says no
  database triggers - keep detecting changes with the hash chain only, or allow this one protective trigger?

**E-mail and history**
- [x] An e-mail the mail server refused is kept (encrypted) and tried again by the worker - after 1, 5, 15 and 60
  minutes, 5 tries in all (`core/mail/retry.ts`, table `mail_retries`); HR is told it will be tried again.
- [x] Change history as an Excel download (`changeHistory.export`, the "Export" button on the History page).
- [?] A daily e-mail of the day's joiners (old: joiners + leavers, but nobody was set up to receive it). **Ask:** who
  receives it? The leavers half waits for the exit module.

**Employees and documents**
- [x] Directory: every filter takes several values with live counts in the filter drawer, a workforce (white / blue
  collar) and an employment-type filter, sortable columns, a "Columns" panel - all kept in the page address (so saved
  views keep them); the Excel export follows the filters and the order.
- [x] Excel import also updates employees already in the system (a row with their code; empty cells keep what is
  saved), shows how many rows add / update, keeps a history of imports, and gives the rows to fix as an Excel file.
- [ ] The import's ID and bank columns (Aadhaar, PAN, UAN, PF / ESIC numbers, salary bank account) - left for a round
  of its own: the numbers are encrypted and must merge with the ones already saved (kept by their last 4 digits), with
  the "Employee · IDs, bank & statutory" access checked per row.
- [x] Stricter Indian ID checks (`shared/utils/identity.ts`): Aadhaar check digit (Verhoeff), a person's PAN (4th letter
  P), a 10-digit Indian mobile or + and the country code for one abroad.
- [x] Sensitive documents need their own access too: ID copies, bank proof and the EPF / ESIC forms also "Employee IDs,
  bank & PF / ESIC"; medical documents also "Employee · Medical" - without it a document is listed as
  locked (no file name, no opening or changing).
- [?] Ordinary employees seeing colleagues of their own company (old: name, designation, department - contact details
  and IDs removed). **Ask:** wanted? Today an employee sees only their own profile.

**Letters**
- [x] Salary certificate - a letter kind of its own (template, number RML/SAL/..., the salary table), issued by HR from
  the profile's Letters tab on the employee's request.
- [?] Approval before a letter reaches the employee (old: a "letter signature" approval). **Ask:** which letters, and
  who approves?

**Onboarding**
- [x] Duplicate check: the candidate page warns when an employee (working or left) has the same mobile or e-mail - a
  rehire or an offer made twice; it never blocks.
- [x] The medical consent kept word for word with the medical information (`consentText`; the text lives in
  `employees.schema.ts` MEDICAL_CONSENT_TEXT and is shown by the joining form).
- [x] "Offers & candidates" Excel report (`candidates.export`, the "Export" button on Onboarding): status, the
  Letter of Intent's number and status, the offer, dates, CTC, joined as.
- [?] The candidate's background at the interview (old: current CTC, expected CTC, total experience, previous
  company). **Ask HR:** is it needed in the HRMS (and for what), or does it stay in recruitment? Added and taken out
  again on 2026-11-16 - not to be copied from the old HRMS without a purpose.
- [?] Salary during probation as a % (old: e.g. 80%, printed on the letter and used for the first salary). **Ask HR:**
  is probation pay reduced at all, and how - a % of the whole salary, or certain components? The first salary part waits
  for payroll.
- [?] More nominee schemes (old: PF, EPS, group personal accident, group medical, group term life). **Ask HR:** which
  ones the companies have (EPF Form 2 is statutory; the insurance ones depend on the policies) - see "Questions to settle
  with HR" (the JF §4 nominee).
- [later] A probation review created on the joining day (old) - with the probation / confirmation module.

**Works differently from the old HRMS - to look at later** (added 2026-11-16, "we will see it later"; each is designed
the HRMS_NEW way when picked up, not copied)
- [ ] Lockout that grows: the old HRMS locked for 15, then 30, 60, up to 120 minutes on repeated lockouts; ours is one
  length (a security rule).
- [ ] Free-text search on the History page (ours: dates, who, whose record, kind of record, action - no text box).
- [ ] Probation / Confirmed shown in the directory (worked out from the confirmation date), and whether the default
  list should also show employees on notice (ours: Active / On notice / Left; default Active only).
- [ ] Work locations tied to a company (old: one company per location; ours: one group-wide list - it already has a
  state code, which state-wise rules such as professional tax will use).
- [ ] Salary components with a code and a "part of gross" flag (old: in payroll; ours: name, kind and order) - with
  the payroll module. (The kind `DEDUCTION` was added 2026-11-24 with the payslip's Employee PF, Professional Tax and
  Canteen Recovery; how each component is calculated and which are cut for LOP waits for HR's answer - mail sent.)
- [ ] HR adding new kinds of letters themselves (old: any letter code; ours: seven fixed kinds, a new one needs code).

### 19. Attendance: what is still open (module built 2026-11-16)
- **Done:** shifts (night shifts too), default shifts + weekly offs from a date, rotations (a pattern as the default shift - 2026-11-22), rosters only for rare
  one-off changes (draft -> publish, a day set back to the default is not kept,
  11h-rest / 48h-week warnings), the holiday calendar, punch upload (Excel / CSV, duplicates kept once, unmatched codes),
  each day worked out (present / half day / absent / missed punch / weekly off / holiday, late and early minutes), HR's
  corrections, shift changes (employee -> manager -> HR), my attendance / my team (whole reporting tree) / everyone, the
  day board, the monthly muster with Excel, the nightly close, the "Today" card on the home page.
- **The Kent machines' automatic feed** - needs IT: how the machines give punches (push to a link, a database to read,
  or a file drop) and their codes; it adds punches through the same path as the upload.
- **App check-in** (web / mobile, with location) for staff away from the machines - decided "later" (2026-11-16).
- **With payroll:** overtime (and comp-off), late-mark penalties (e.g. "3 lates = half day" - ask HR), closing / locking
  the month, and whether managers sign off their team's month (decided: decide with payroll).
- **Ask HR:** the real shifts (the seeded General 09:00-18:00 with a 30-minute break makes 51 hours in a 6-day week - more
  than 48), the weekly offs per company / plant (the default is Sunday only), and the holiday list.
- **Later, if needed:** remembering an unmatched machine code for the next uploads (today each upload's unknown code is
  linked again); a shift change re-working the days already worked out (today it applies from now on); e-mailing
  employees when their roster is published; absence follow-up after several absent days in a row (the old HRMS opened a
  case at 4 days); reminders for shift changes waiting too long; heads of department seeing their department (with item
  3a).
- **Skeletons inside the attendance pages (2026-11-22, left when attendance was split into My / Team / Setup pages):**
  the pages show a skeleton until they know what to show, but then the day board, the month muster, the roster grid and
  the setup's lists (shifts, policies, holidays, patterns, unmatched codes) show an empty area while their own data loads
  (section 5). Each needs a skeleton of its real rows - TeamAttendanceSkeleton's BoardSkeleton / RosterSkeleton can be
  reused. Waits: they were not changed in the split (the earlier uploads got theirs).

### 20. Security updates of packages
- `npm audit` (2026-11-16) lists warnings in packages used before exceljs (body-parser, zod, undici, prisma's tooling,
  shadcn's CLI...) and a moderate one in exceljs's `uuid` (exceljs does not use the affected functions).
- **Needs:** one round of `npm audit fix` / updates on its own, with the checks and a test of the app.

### 21. Unsaved input on the joining-form pages (rule added 2026-11-17)

Every drawer and dialog now asks "Discard your changes?" before losing typed input (CLAUDE.md section 5). Two pages
still don't ask before *leaving the page* (a link, the back button, closing the tab) with a section's form open: the
candidate's joining-form page and HR's Joining form tab on a candidate. `JoiningFormSections` already reports open
sections (`onEditingChange`); what's left is a leave-page guard like the letter-template page's (`useBlocker` +
`beforeunload`). Also: the profile's "Edit <tab>" drawer asks whenever a section is open, even if nothing in it was
changed - exact "changed" tracking needs each section form to report its values.

### 22. Old-HRMS import: departments (deferred by the user 2026-11-19)
`npm run import:old-hrms` brings no departments across, and every employee needs one since 2026-11-19 - so it now
imports companies only and skips every employee ("no department"). The user's plan for a fresh start: organization data
from VBMS (`npm run import:vbms`) and a super admin (`npm run create-admin`), no old employees. **Needs, if old
employees are ever imported:** map each old `department_id` to a department running at the employee's plant (by name),
in `scripts/import-old-hrms.ts` where it says so; rows that do not match are skipped and listed.

### 23. "Employment & Job" fields deferred (the user, 2026-11-19)
Compared with an "Employment & Job" screen, these were added now: cost centre, functional manager (shown only), position,
region (on the work location), the work location's address, lay offs, and the job timeline. Deferred:
- **Pay group** (e.g. RML_CONT - who is paid together in one run) - with the payroll module's pay runs.
- **Named holiday lists / calendars** per employee (e.g. "Corporate", "PLANT_SO") - today holidays are set by company and
  work location; plan named lists when holidays are next worked on.
- **Attendance scheme** - a named set of attendance rules given to an employee (grace, late marks, half-day...); today the
  rules sit on the shift. Plan when the attendance rules are next worked on (late marks wait for payroll - item 19).
- **Probation -> confirmation hike %** ("Join Probation Retain") and the **internship completed date** - with the
  probation / confirmation module (next modules, 5).
- **Lay offs and attendance / pay** - a lay off does not change the employee's status nor their attendance days yet;
  decide with attendance / payroll whether laid-off days show as such and whether a "Laid off" status is needed.
- **Job timeline, later:** inserting a change between earlier entries (today a change must follow the latest one); leaving
  / status changes on the timeline. (Approval, company transfers, salary history and the e-mail when a change applies:
  done 2026-11-20 - item 24.)
- **Run once on each database that has employees:** `npm run backfill-job-records -w backend` gives employees added before
  the timeline their first entry (also done by itself the first time HR changes or corrects their job).

### 24. Approvals and job changes: what is still open (built 2026-11-20)
- **Done:** one approval service (modules/approvals): chains per kind - shared or a company's own - with free-form steps
  (reporting manager, functional manager, HOD, a role, an access), skipped vacant steps, the "Admin" fallback approver,
  held requests and "send through again", one decision per step, nobody deciding their own, reminders every 3 days, the
  Approvals page and the Approval chains page (its own access area, "Approval chains"). Job changes through it (modules/job-changes): promotion, transfer,
  company transfer (a new code, the old one still works), redesignation, change of manager, salary revision and correction
  - with a reason, applied on their day, checked again then; the job changes list with Excel; "as of a date"; the salary
  history; "Edit details" / the import change job details only with "Approve job & salary changes" (D7).
- **Later, each with its module:** exit as a kind of the approval service (leave, its cancelling, regularization and on
  duty: done 2026-11-22); offer approval
  (item 2 - needs candidate subjects); moving the attendance shift-change approval onto it (today its own two steps).
- **Later, if needed:** delegating approvals while away; approving from the e-mail itself; expiring held requests (the old
  HRMS does - ours wait until repaired); more than one open job change per employee (decided: one at a time). (Time limits
  per step - wait / escalate / approve / expire / reject - were built 2026-11-20.)
- **Skip the HOD step when a senior is already in it (the user, 2026-11-22 - not built yet):** since 2026-11-22 an HOD
  may head the place their own manager (or someone above them) works in, so an HOD can be junior to the employee or to
  someone else in the request. In a chain with an HOD step, skip that step when someone above the HOD in the reporting
  line already takes part: the employee the request is about, or the person who raised it, or an approver of an earlier
  step (a junior should not approve what their senior did). **Needs:** the check where the approval service opens the
  next step (`approvals.service.ts`, beside the skipped vacant steps), shown on the request as "skipped - a senior is
  already in it", and a test. **Ask the user:** which of the three cases count, and whether a later step by a senior
  also makes the HOD step skip.
- **Time limits, open points:** the limit counts calendar hours, not working hours (no holidays / weekends - wait for the
  attendance calendar).
- **With payroll:** arrears when a salary revision is back-dated (applied today from an earlier day); the pay group.
- **A company transfer, later:** carrying over or encashing the leave balance (with the leave module); moving the PF / ESIC
  registration between establishments; the final settlement of the old company, if HR treats it as a separation.
- **Letters:** promotion / increment / transfer letters (new kinds of employee letters, issued when a change applies).
- **Bulk:** yearly increments for many employees from one Excel file.
- **Ask HR:** which roles are "HR" and "HR Head" in the chains (the starting chains end with the "Approve job & salary
  changes" access, which the Super Admin has) and for which companies; who gets the "Admin" role (the fallback approver),
  for which companies; whether a transfer should also ask the new department's HOD; whether the date of joining stays the
  same across a company transfer for gratuity.

### 25. Asset management (planned 2026-11-20 - deferred by the user: "not the core feature, add later after the core features")
- **Why it waits:** not core HR; it comes after the core modules (the list at the top). Planned with the user during the
  end-to-end test (`docs/test-runs/2026-11-20-end-to-end.md`, step 102) - laptops and ID cards at joining are today only
  joining tasks, with nothing recording which unit was given.
- **Three kinds of things:** a **tracked asset** - one numbered unit, returnable (laptop, desktop, phone, SIM, ID / RFID
  card, tools); a **locker** - a place (plant, floor e.g. ground floor, locker no., key no.) given to one employee; a **kit
  item** - counted stock without a serial, usually not returned (bottle, pen, slippers, notebook, T-shirt, safety shoes).
  A category list (settings) says each one's kind, the team that manages it (a role, as joining tasks), whether it must be
  returned at exit and whether a request needs approval.
- **Register:** tracked assets one by one or from Excel (company / plant, status In stock / Assigned / Under repair /
  Lost / Scrapped, condition); lockers per plant and floor; kit stock per plant store (received / issued, low-stock
  warning); a **kit** = a named bundle (e.g. Joining kit) with each employee's kit Given / Partly given / Pending.
- **Giving out:** (a) at joining - a joining task type linked to a category / kit ("Laptop and system access" -> Laptop);
  the task's person marks it done by picking a free unit at the employee's plant (task closed + unit assigned in one step);
  (b) any time - from the employee profile (an Assets tab), or a request by the employee / their manager / HR: through the
  approval service (a new kind "Asset request") when the category needs approval, else straight to the team's queue;
  (c) the employee acknowledges receipt online (recommended).
- **Returns / exit:** return with condition (good / damaged / lost) - back to stock or repair; a recovery note for the final
  settlement (with payroll); exit clearance lists every returnable item held (with the exit module); a repairs log.
- **Access:** a new area "Assets" (View / Edit); stock limited by company / plant, assignments by the employee's
  placement (section 8).
- **Reports:** free stock by plant / category, who holds what, kits pending, open requests, items overdue for return,
  warranties ending, leavers with items not returned (the old HRMS had this one).
- **Phases:** 1 categories, tracked assets + lockers, assign / return, profile tab, joining-task link; 2 kit stock, kits,
  kit status; 3 employee requests (with / without approval), acknowledgements; 4 exit clearance, recovery, repairs.
- **Ask the user / HR before designing the tables:** who manages what (IT: laptops / phones / SIMs; Admin: ID cards,
  lockers, kits?) and one store per plant?; existing asset tags, or numbered by the system (e.g. RML/LAP/0001)?; cost /
  vendor / warranty needed (recovery on loss)?; kit sizes (slippers, T-shirt), and items replaced every N months (safety
  shoes, helmet)?; lockers - one per employee, key no. or combination, ever shared?; which categories need approval and
  who approves?; must employees acknowledge online?; the ID card - pre-numbered blank RFID cards (a unit) or just
  "issued"?

### 26. A page for lay offs and resignations (the user, 2026-11-21)
- **Why it waits:** the user moved the changes off the employee profile, which now only shows the record (the job
  timeline, and lay offs only when there are any); job and salary changes are asked for on the Job changes page, and "we
  will make a different page for layoff and resignation" later.
- **Until then:** lay offs cannot be recorded from any screen - the APIs stay (`employees.layoffs.create` / `update` /
  `delete`, Employees: Edit, recorded directly without approval); the old add / edit / remove dialog is in the git history
  (`pages/employees/components/Layoffs.tsx` before 2026-11-21).
- **Needs:** the page (list + record a lay off / the day back at work); resignations with the exit module (module roadmap:
  exit) - notice period, last working day, clearance, final settlement; ask the user whether a lay off should go through
  approval (today it does not) and which access area it needs (today Employees: Edit).
### 27. Photos on the People directory and org chart (the user, 2026-11-21)
- **Why it waits:** the directory card and the org chart show initials for now - the user: "for now leave it".
- **Needs:** use the photograph the joining documents already ask for (document type `PHOTO`, `employee_documents`) as
  the employee's picture: a small, safe read of only the photo for every logged-in employee (today documents need
  Employee · Documents & letters), a resized thumbnail, and what to show when there is none or it was rejected.
- **Also asked and left out:** "Starred" colleagues (a personal favourites list - a small table of who starred whom).### 28. Schedules as rules, not day rows (agreed with the user 2026-11-22 - after "finishing Attendance")
- **Why it waits:** the user: "keep it in backlog first, complete what we find is missing" (half-day sessions, attendance
  policy, weekly-off patterns, month lock, shift changes through the approval service).
- **The idea:** no roster stored day by day, not even for rotating shifts. Each employee follows one **rule from a date**:
  a fixed shift + weekly offs, or a **rotation** (a cycle with its offs inside, e.g. 21 days = A A A A A A Off · B×6 Off ·
  C×6 Off) whose day 1 is the rule's start date; day of the cycle = (date - start) mod length - it never runs out, nothing
  to fill or publish. Groups on the same rotation are split by **different start dates** (group 2 starts a week later).
  Only a day that really differs is stored (**one-day change**, with a reason - e.g. from an approved shift change).
  Order per day: holiday -> one-day change -> the rule.
- **Tables (proposed, agreed in principle):** `RosterPattern` becomes the rotation (as is); `ShiftAssignment` gets an
  optional `patternId` (exactly one of a shift or a rotation; `effectiveFrom` is day 1 of the cycle); `RosterEntry` becomes
  `ScheduleException` (`schedule_exceptions`): + `reason`, + `shiftChangeRequestId`, - `publishedAt` / `publishedById`.
  Existing published roster rows kept as one-day changes ("From the published roster"); drafts dropped.
- **Screens:** the Roster tab becomes "Schedules" - the same grid, calculated; "give rule from <date>" for selected
  people; a cell click changes one day; no drafts / Publish. Setup -> Rotations. The 11h-rest / 48h-week warnings checked
  on saving a rule or a one-day change.

### 29. Leave and regularization / on duty: what is still open (built 2026-11-22)
- **Done:** leave types with the old HRMS's rules (monthly credit, credit after N months, carry-forward limit, most days at
  once, half days, the "sandwich" rule, gender / employment type), balances as a ledger (monthly credits by the nightly job -
  missed months caught up - the year-end lapse on 1 January, HR's adjustments with a reason, never below zero), applying
  with the days counted by the attendance plan and a live preview, approval through the approval service (kinds LEAVE /
  LEAVE_CANCEL; seeded: the reporting manager, 48 h, then their manager), withdrawing / cancelling, the leave on the
  attendance days (LEAVE halves, the type's code on the muster), the leave register with Excel, Team leave (team /
  department / everyone); regularization (missed punch) and on duty through approval (kinds REGULARIZATION / ON_DUTY),
  30 days back, on the days as present / on duty; the Approvals page shows the leave with the balance. Added the same day
  after the user's answers: the **team coverage warning** (teammates away, in the apply dialog and on the Approvals page)
  and the **opening balances Excel import** (template, every row checked, all rows or none). Then (the user's own design,
  2026-11-22): **comp-off claims** - work on a weekly off / holiday is claimed from My attendance, the punches decide (8 h
  = a day, 4 h = half a day), within 30 days, approved by the manager (kind COMP_OFF), credited to the comp-off type (the
  seeded CO) and expiring 90 days after the day worked (the nightly leave job lapses it).
- **Settled with the user (2026-11-23):** a leave of the new year approved in the old one is paid from the old year's
  days before they lapse (only what is left above the carry-forward lapses on 1 January).
- **Settled with the user (2026-11-22):** the leave year is the calendar year; leave and regularization are approved by the
  reporting manager only (as seeded); the seeded leave types stay until HR gives the real ones (changed on Team leave >
  Leave types, no code needed).
- **Not built yet (the old HRMS had them):** **encashment** of leave (needs payroll - and at exit, the final settlement);
  **overtime on working days** paid or turned into comp-off (with payroll - comp-off for a weekly off / holiday is built);
  **restricted
  holidays** (pick 2 a year); **leave blackout dates** per location; **short permission** (up to 2 hours, in / out
  times); **send back / resubmit** of a request; a **company transfer** carrying over or encashing the balance (item 24).
  (The user chose on 2026-11-22 not to build these now.)
- **Not in the old HRMS either, maybe later:** an attachment (e.g. a medical certificate for sick leave over 2 days),
  minimum notice before a leave, HR applying on someone's behalf, e-mails to the team when someone's leave is approved.
- **Later, if needed:** a credit that counts only part of a joiner's first month (old HRMS: none - the first credit is the
  next 1st); a leave approved after its year's lapse ran is not lapsed again (rare - the lapse runs once on 1 January);
  the attendance month lock refusing while leave / requests of the month wait (old HRMS: pending requests older than 7
  days block the lock).
- **Ask HR:** see "Questions to settle with HR" (the real leave types and days, 30 days back for a regularization; comp-off:
  8 h / 4 h, 30 days to claim and 90 days to use - the old HRMS's numbers, the user chose them for now).

### 30. Bugs found in the code review of 2026-11-23
A read-through of every module built so far. **Fixed the same day:** editing a role now checks the holders' data access (and
nobody edits a role they have); a cancel racing an approval or an apply no longer leaves a cancelled request with its change
applied; punch files with "Date" + "Punch Time", impossible months, CSVs named without .csv; the new-login and letter
e-mails no longer say "e-mailed" when only saved in the outbox; the tests no longer reach the real mail server; a January
leave approved in December is paid from the old year's days at the lapse (the user's rule), so the balance never goes below
zero. **Fixed the same day, the medium list (the user approved the order):** the pre-employment medical needs Medical;
candidate ID / bank / medical documents and the signed joining form / offer letter need the matching access; every code
try, wrong password and reset-code try is counted in the database (parallel guesses each count; a login's tries count
across its code, e-mail and former codes); only the newest letter's link opens the joining form and a new link signs the
candidate out everywhere; a leave starts and ends on a working day (the user's rule); retired types get no credits; the
credits run before the year-end lapse; one leave / one comp-off claim per double click; two recomputes of one employee
wait for each other; one lock per month; two taps within 5 minutes are one punch; a company transfer checks the cost
centre against the new company; the import checks managers again against the saved data; the day board shows a day to
come as "not in yet"; holidays and schedules are refused inside a locked month; a role step whose approvers are all gone
goes to the fallback approver (or is held). **Fixed the same day, the user's "fix it" / "yes do it":** a shift's times and a
pattern's days are dated versions (like the policies) - an edit applies from a date and never reworks the days before it;
forgot-password codes are capped at 5 a day per login, and asks at the same moment send one code. **Fixed the same day, the
user's answers (after comparing Keka, Zoho People, SAP, Workday, Odoo):** a change of a type's credit rules credits from the
month HR picks (creditsFrom - never every month back by surprise); approved leave the calendar now counts otherwise is
listed under Team leave > To recount and HR gives days back / takes days more by hand, the employee e-mailed (never on its
own); a comp-off leave uses only the days there on its date, the closest to expiry first, so a later comp-off still
lapses. **Fixed the same day, the user's "fix the rest":** the default pattern is dated (DefaultPatternChange); "today" and
the job times are India's whatever the server's time zone; and every item of the waiting list below except the
questions - attendance (night-shift punches beside a locked month, one half's correction kept / cleared, the 48-hour
warning over the whole week, a night-then-morning hand-over, a pattern not of whole weeks), leave (comp-off expiry once a
day, joiners of the 29th-31st, one cancel per double click, comp-off approved late keeps 30 days, no cancelling a leave of
a lapsed year), approvals (the daily job writes only what it read), roles (a lock per role), employees / accounts (by-id
records outside the View answer like unknown ids, forgot-password answers the same and refuses turned-off logins, lay
offs, HODs of retired places, retired masters, the import's matching / zeros / former codes / rich text), candidates (the
signing code kept on a refused submit, an upload limit, a closed offer's page, the joining reminder from tomorrow, one
failing offer no longer stops the expiry, a PDF deleted only with its rolled-back row, accept / withdraw at the same
moment) and the test setup using the installed Prisma; and the frontend review's findings (see below). **Waiting:**
- **Ask the user (design questions):** (a) an admin's password reset lets HR sign in as a manager / HOD; (b) a laid-off
  approver still gets approval steps; (c) an AUTO_APPROVE step approves with no person (and on a cancel of a lapsed year's
  leave it fails every hour); (d) the old manager can still decide until the 07:30 hand-over; (e) an employee whose gender
  / employment type changes is credited every month back from the type's creditsFrom (a person's details are not dated).
- **Small, known:** two portal uploads at the same moment can go one file over the limit; the set-password script gives a
  role without the role lock; manager / HOD pickers answer "has left" vs "not found" (managers are picked group-wide by
  design); conflict messages for a duplicate UAN / ESIC IP / identity number / work e-mail name the owner's code; the
  approvals daily job's skip / fallback / give-back / pool / retry / remind branches have no race test (only reassign);
  test files are not type-checked (backend tsconfig covers src only).

## Questions to settle with HR

- **OU / OUMIS and DEPTMIS** (on the "Employment & Job" screen, 2026-11-19): what are they - the company code / SAP code
  and the department code we already have, or organisation units of their own? Do we need them?
- **Position and cost centre on the offer:** should HR choose them when making the offer (copied on the joining day), or
  only on the employee (as built, 2026-11-19)?

- **Leave (built 2026-11-22 on the old HRMS's values - they were "pending sign-off" there too; the user keeps them for
  now):** which leave types and how many days a month (seeded: CL 0.75 lapsing at the year end, at most 3 at once; SL
  0.58, all carried; EL 1.25 after 12 months, carry 30, counting weekly offs; CO and ML given by HR; LWP unpaid)? Is 30
  days back right for a regularization? (Leave year = calendar year and manager-only approval: settled by the user.)
- **HOD (for the leave module, 3e):** who approves for an HOD who heads the place they work in - HR, or their reporting
  manager? And should a place without an HOD send approvals to HR (as built) or somewhere else?

- **Joining form §4 nominee:** which benefit is this nomination for (PF, gratuity, group insurance, or a general
  one)?
- **Previous-employment table:** what is the unlabeled column on the joining form?
- **Overseas employees' bank:** do we need SWIFT / IBAN for salary paid abroad?
- **Reporting manager:** do we store it on the employee? (8 employees in the old HRMS have one; it was not
  imported.)

### Combined team-request reports (2026-11-24)

- [x] Approvals → Team requests: current team/HOD department or separately scoped Leave/Attendance access; all leave, cancellation, regularisation, OD, comp-off and shift-change outcomes with original employee messages and approval remarks. Inclusive date basis, type/status/person filters, URL persistence, paged compact table and one full Excel review export.
- [ ] Preserve source details of older, superseded leave-cancellation requests. A leave application points only to its latest cancellation approval; another cancellation can replace that relation and its reason. The new report labels unavailable details rather than reconstructing text from summaries; request-raised date filtering can still show these approval rows. Retaining every future cancellation's original dates/reason needs an agreed schema/history change; already-lost text may be unrecoverable. No speculative backfill or audit-log workaround.
