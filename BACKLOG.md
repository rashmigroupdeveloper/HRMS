# Backlog - things deferred for later

Work we decided **not** to do yet, so nothing is forgotten. Each item says why it waits and what it needs.

**Rules** (also in CLAUDE.md):
- Whenever something is deferred ("later", "when login exists", "ask HR"), add it here in the same change.
- When an item is done, delete it from this file in the same change.

## To build later

The module-by-module inventory from `main`, its intentional exclusions and the method for bringing work into
`hrms-new` are in **item 31** below. Existing numbered items retain the detailed decisions; item 31 links to them.

### Next modules - in the order an employee lives them (decided by the user, 2026-11-16)
After onboarding and the employee's own login / profile (done), the modules follow a regular employee's working life,
one at a time, each planned with the user before it is built (the old HRMS is inspiration only):
1. **Attendance** - marking attendance every day - **done (2026-11-16)**; what is left is item 19
2. **Leave** - applying for leave (leave types, balances, approval by the reporting manager; the holiday calendar is
   attendance's) - **done (2026-11-22, built while the user was away, after the old HRMS's rules)**; what is left is item 29
3. **Regularization / OD** - fixing a missed punch, on-duty outside the office - **done (2026-11-22, with leave)**; what
   is left is item 29
4. **Payroll** - the month-end salary from attendance and leave - **in progress: stages 1 (draft runs) and 2 (people,
   salary copy, inputs) built 2026-11-26; stage 3: the days built 2026-11-27, the amounts wait for a greytHR salary
   register**
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
- **Phase 5: built 2026-11-16, decision revised 2026-11-25:** HR still edits canonical profile sections and manages
  documents. Employees may now submit their own documents for HR review; family/nominee change requests are approved
  in principle and await their schema (item 32). Employees do not directly edit the canonical family/nominee records.
  Worker/session cleanup/reminders remain built as before.
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
- **Done (phase 5; status corrected 2026-11-24):** the worker removes expired sessions hourly (item 6). Passwords
  set before 2026-11-16 may be shorter than 10 characters (decided: the rules apply at the next change, nobody is forced).
- **Logins for employees who joined before 2026-11-15, were added with "Add employee" or imported** (as in the old
  HRMS, 2026-11-16: no automatic login): HR gives them one by one on the Roles & access page. **Later:** "give logins"
  to many employees at once (e.g. a whole import), e-mailed in batches.
- **Employee submissions (revised by the user 2026-11-25):** own document uploads for HR review are built.
  Family/nominee change requests are now selected work, awaiting schema approval (item 32); direct canonical editing
  is still HR-only. This supersedes the 2026-11-16 exclusion for these named submission flows.

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
  company** (its holiday lists and their holidays, its details, its plants and their departments): Edit covering what it
  affects. **Shared by all companies** (shifts, default shift, patterns, every-company holiday lists, holiday categories,
  joining task types, master lists, letter
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
  with the user that e-mails follow something else. **Since 2026-11-25 (two portals)** every link in an e-mail
  opens in Employee self-service (a fresh tab has no role): an e-mail to a role holder links to `/manage/...`, which
  shows the "pick a role to open this page" screen with the role picker and comes back to the page.
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
  effect (the employee themselves or the `SALARY` access, 2026-11-15). **Revisions / increments are done** through
  approved job changes (2026-11-20; status corrected 2026-11-24), with a salary row from its effective date.
  Draft pay runs are built (2026-11-26); employee inputs, calculation and deductions remain in item 31.
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

### 16. Home pages per role (initial delivery 2026-11-24)
- **Built 2026-11-24 after the user selected this work:** one useful Home adapting to active access and actual team/HOD
  relationships: decisions with request drill-down, own attendance/leave/recent requests, scoped People today and report
  links, profile/documents and permitted workspace links. Employee attendance cycle, HR open joining tasks/accepted
  offers and administration-first links give distinct capability-based layouts. Crextio informs the visual hierarchy.
  **Polished 2026-11-25:** consistent wide work column / charcoal role focus, compact rows and empty states,
  grouped personal tools and matching light/dark loading panels. Uses existing APIs, with no schema changes or
  role-name checks.
  **Widgets 2026-11-27 (the user asked to bring main's useful dashboard parts):** self-service "My day" (first in / last
  out / worked, shift line, days of the last 30 to fix), coming holidays, away this week (team / HOD department), decision
  urgency, People today refreshing every 2 minutes; role home: attendance month to close, payroll runs (status only, no
  amounts), joiners & leavers, away this week - each gated by the access of its reader. One API change:
  `attendance.overview` `today.shiftHours`. Punches still arrive by upload, so nothing claims live presence.
  **Redesigned 2026-11-27 (the user: "boring, not professional" - follow crextio-ref):** headline numbers, month strip,
  Today ring, My week bars, light titles with round links, slim empty states. The role home (/manage) got the same header
  and attention-first order the same day (the user chose it).
  **Same day (the user):** attention first (decisions / days to fix rise to the top, calm ones sink as slim rows) and the
  self-service home shows only direct reports - a `DIRECT` scope on the attendance and leave people filters.
- **Still deferred:** broader HR workload trends, executive trends and device-health panels (they need the Kent
  machines' automatic feed, item 19); a team attendance dot grid over several days (needs a bounded multi-day board read, not the whole
  muster for an Attendance View scope).
  **Needs:** agreed metrics and the owning source modules; payroll/KPI/device values must not be invented.

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
- [ ] Daily joiner/recorded-leaver email (report + Excel built 2026-11-25): HR Head receives it; Super Admin configures
  additional recipients. Time/coverage and recipient mapping remain to be agreed. Existing leaving dates support a
  recorded-leaver register; full exit workflow details still wait for exit. See item 32.

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
  Canteen Recovery. How each component is calculated is done since 2026-11-24 as salary structures (from HR's "CTC
  Structure" sheet - Organization page); which components are cut for LOP waits for payroll - all of them on the old
  payslip. **Ask HR:** the structures for consultants, apprentices and Overseas offers (none seeded - typed by hand until
  HR adds them on the page).)
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
- **With payroll:** working-day overtime (pay or comp-off), late-mark penalties (e.g. "3 lates = half day" - ask HR),
  and whether managers sign off their team's month (decided: decide with payroll). **Already built (2026-11-22; status
  corrected 2026-11-24):** month locking and weekly-off/holiday comp-off claims (items 29 and 31).
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
- **Named holiday lists** per employee (e.g. "Corporate") - **being built (agreed with the user 2026-11-24)**, in steps:
  1. done 2026-11-24 - the lists (one company's or every company's), each plant's default list, HR's holiday categories
     with a colour (Attendance setup > Holidays); 2. done 2026-11-24 - the employee's list from a date (a table of its own,
     not the job timeline - changed without approval): chosen on the joining day next to the reporting manager (the
     plant's default offered - the user, 2026-11-24), given / changed by HR on Attendance setup > Schedules (one person or
     many ticked, with a "holiday list" column and filter), and "fill in" on the plants' card gives everyone without a list
     their plant's default from their joining day (go-live, employees added directly or imported); moving plant keeps the
     list (the user: HR changes it later if wanted); no list = no holidays. A company transfer keeps the list too - HR
     changes it (the user, 2026-11-24), though it may be the old company's; 3. done 2026-11-24 - holidays put in lists, each **automatic** (everyone on the list is off) or **on application** (taken
     from a leave type's balance, approved by the reporting manager, whole or half day as HR sets), with a category and
     an optional half-day off; the day's holiday then comes from the person's list in force, not company / location;
     giving or changing someone's list works out again the holidays' dates since then; a holiday or list change works out
     again only the months already worked out for each person (never fills months before attendance started with absent
     days); "copy from last year" copies a year's holidays into the next, the same lists. Built in step 3: the automatic
     holidays with a category, the part of the day off and the lists; the **on-application** part (a holiday taken from a
     leave type's balance) comes with steps 4-5. **Settled with the user 2026-11-25:** working a half-day
     holiday's off half earns no comp-off (only a whole weekly off / holiday does) and a company admin's "copy from last
     year" copies a shared holiday only into their own lists, as a holiday of its own - both right as they are; done the
     same day: a late arrival after a first-half holiday counts towards the monthly late penalty and, when it is the Nth,
     that day's second half (the half worked) is absent; the roster's rest / week-hours warnings use the half really worked
     (a first-half holiday: the afternoon); the holidays' Excel export follows the list filter;
     4. done 2026-11-24 - leave-type timing rules on Team leave > Leave types: notice in calendar days (EL 7, CL 3),
     "today or past only" (sick), "up to N days back" (empty = until the month locks); checked when applying (the
     employee's own application - nothing else applies leave), shown on the apply form (its dates limited to match).
     **HR to fill in:** the real types' values - none is set on the seeded types; 5. done 2026-11-24 - **on-application holidays**: a holiday given "on application" names
     a leave type "only on its holiday dates" (paid, lapses at the year end) and may allow half days; it stays a working day
     unless someone on its lists applies (leave of that type, approved by the reporting manager - the day then a holiday for
     them); HR gives days of a leave type to everyone / chosen / filtered (company, plant, department, holiday list) on Team
     leave > Balances > Give days, counted first (the election example: 2 dates, 1 day each; people joining later get
     nothing unless HR gives it); a holiday changed or removed, or someone moved to another list, cancels the leave taking
     it that no longer fits (waiting: its approval closed; approved: the days back, the days worked out again) and e-mails
     the employee; an on-application holiday whose day has passed and that someone took can no longer be moved, removed
     or given otherwise (the user, 2026-11-25 - a new name / category still can), and a list change from a past date
     leaves such taken holidays as they were; 6. done 2026-11-24 -
     **My holidays**: the holidays of the employee's own list for this year / next (automatic ones; on-application ones with
     the balance left and Apply - then Waiting / Taken) - on a **Holidays** page of its own for every employee (/holidays,
     a tab beside My leave - the user, 2026-11-25); every list's holidays are Attendance setup View only (the setup page). Also
     agreed: "copy from last year" for a list (step 3); HR changes many people's list at once (step 2); an on-application
     holiday moved or deleted after people took it cancels those leaves and gives the days back (with an e-mail); the
     balance of a holidays-only leave type lapses at year-end (carry forward 0). A holiday on a weekly off is simply lost. "Calendar Name" (e.g.
     PLANT_SO) is dropped - the user does not know what it was. The one holiday entered before (a test) was deleted
     2026-11-24 (the user's word) - step 3 starts with no holidays. The profile's Job tab shows the name of the holiday list
     followed today (the user, 2026-11-25 - the name only; its history: Schedules and the change history).
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
  (item 2 - needs candidate subjects). Shift-change and swap approvals already use this service (2026-11-22);
  they are not a migration gap.
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
  **leave blackout dates** per location (restricted holidays moved to item 23 - built as "on application" holidays, the
  user 2026-11-24); **short permission** (up to 2 hours, in / out
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

### 31. Main-to-new feature inventory and implementation method (2026-11-24)

Requested by the user after comparing `origin/main` **4e87cf2** with `origin/hrms-new` **a3b3e3e**.
The local `hrms-new` checkout was **cd1f732**; the newer remote commit changes onboarding UI, not the inventory below.
These branches have separate histories. This is a business-capability inventory from source, not a list of commits
to cherry-pick or proof that the old implementation works. Recheck both branches before implementing a slice.

**Status key:**
- **DEFERRED:** a missing capability recorded for planning; inclusion here does not approve its schema or business rules.
- **INTENTIONALLY DEFERRED:** the user explicitly postponed it; keep it waiting until selected again.
- **INTENTIONALLY EXCLUDED:** a current decision replaces the old behaviour; do not restore it without changing that decision.
- **DECISION NEEDED:** an old capability or design difference whose need/rule has not been agreed.
- **PRESENT:** already rebuilt; extend it where needed rather than building another version.

#### How to bring a feature from main

1. **Select one coherent slice**, following the existing employee-life roadmap above (payroll is in progress). Announce it,
   finish it and wait for “continue”. Recording this inventory does not start implementation of every module.
2. **Read the owning old code without changing branches:**
   `git show 4e87cf2:backend/src/modules/<module>/<file>` and
   `git ls-tree -r --name-only 4e87cf2 backend/src/modules/<module>`.
   Read its router, service, tests and relevant specifications together. Use current `origin/main` only after checking
   what changed from this snapshot. Old paths below are relative to the repository at that main commit.
3. **Extract the business rule:** inputs, eligibility, states, calculations, approvers, side effects, reports and edge
   cases. Compare with current `API_TRACKER.md`, schemas and services. Label each part already present, still needed,
   intentionally excluded or awaiting a decision. Old tests are examples to verify, not authority over newer decisions.
4. **Agree the design first:** propose only the necessary model/field changes, one model at a time, with a concrete
   HR/form/statutory purpose. Ask for required schema, library or folder-structure approval under `CLAUDE.md`.
   For payroll/statutory work, verify current rules and obtain HR's actual policy; never carry old rates forward blindly.
5. **Reimplement in the new architecture:** Prisma schema/migrations; router -> service -> repository; typed oRPC
   client; existing approval service, audit, encryption, file storage and jobs. Keep one active role, company/plant/
   department data access and scoped recipients. Do not merge/cherry-pick the old feature wholesale, copy Kysely/SQL
   migrations or triggers, restore hard-coded role checks, add compatibility layers or create a second approval engine.
6. **Treat data migration separately:** agree source-to-target mappings, business keys, opening balances and historical
   records to retain. Use an explicit import with validation, dry run and reconciliation; no production writes or
   copying real HR data into tests/docs as part of a code port. Deployment and cutover need their own concrete plan.
7. **Verify the complete slice:** happy path, outside-scope access, state transitions, amounts, retries/concurrency
   where relevant, reports and exports. For UI, review desktop 1440 px and phone 390 px before/after, plus loaded/loading
   layouts. Run all section 6 checks; update the API tracker and every affected rule/doc. Delete completed backlog
   tasks and their duplicate references together; preserve intentional exclusions until the decision changes.

#### Payroll, statutory and income tax — Stages 1 and 2 built; later stages planned

**Reference:** `backend/src/modules/payroll-core/`, `payroll-outputs/`, `tds/`; related screens in
`frontend/src/pages/payroll/` and `tax/`. **Needs:** agreed pay groups/cycles, attendance and leave inputs, statutory
policy, sample reconciled payslips/registers and approved schema. See items 11, 18, 19, 23, 24 and 29.

**The payroll plan (2026-11-26) - read before coding any payroll stage.** Kept on the user's machine, outside the repo
(where it should live in the repo is still open):
- `C:\Users\Prateek Kumar Singh\Desktop\HRMS-payroll-coding-plan.md` - **the coding plan / handover**: rules for every
  stage, stage 2 in full (tables, APIs, pages, tests), stages 3-7 with their gates (answers needed first) and blockers.
  Everything in it is proposed until the user approves each table.
- `C:\Users\Prateek Kumar Singh\Desktop\HRMS-payroll-plan.html` - the business logic and the decisions list;
  `HRMS-payroll-cases.html` - the case catalogue (every situation payroll must handle, with its building block);
  `HRMS-payroll-research\` - the research notes and the plan sources (`plan-src\`).

**Stage 2 decisions (the user, 2026-11-26):**
- Approved: the first table, `PayrollRunEmployee` (one row per person in a run), as written in the coding plan.
- Salary amounts inside a run are shown only with `SALARY` View covering the whole company as well as Payroll View;
  Payroll alone shows people, days and inputs but not the salaries (also in CLAUDE.md section 4).
- Monthly inputs are entered and changed only by someone with Payroll Edit covering the whole company; a plant-level
  HR person sends their figures to them (also in CLAUDE.md section 4).
- Everyone on the company's rolls is in its run - trainees, apprentices and consultants too. How a consultant's pay is
  taxed (salary slabs, or a flat rate on professional fees) is a question for the CA at stage 4.
- Rows the system rebuilds on every refresh (the people / salary copy) stay out of the change history, as attendance
  days do (`SKIP_MODELS` in `core/audit/capture.ts`); each refresh is recorded on the run (who, when, how many people),
  and human decisions (inputs and everything after) stay recorded. The user left it to "what is best"; CLAUDE.md
  section 3 "Change history is automatic" now names this exception (built with stage 2).
- [later] **Hidden pay list** (the user, 2026-11-26): no salary is treated as confidential beyond the access areas for
  now - everyone is an employee with a salary, seen only by those with access. Later, if needed: a list of employees
  whose pay only named people can see; everyone added to it is hidden from the other payroll users. **Needs:** the
  user to ask for it, and a design of who manages the list and how it combines with the whole-company rule.

- **Stage 1 built 2026-11-26:** approved PayrollRun model and dedicated PAYROLL area; regular monthly India
  company/month drafts, captured attendance window, unique company/month, audited creation, scoped list/count/detail
  and `/manage/payroll`. Requires one grant covering the whole company; no plant/department stitching or team fallback.
  Setup changes between preview/create cause a conflict. Captured dates do not move with later cycle changes.
- **Stage 2 built 2026-11-26** (the user approved the four tables and two columns): PayrollRunEmployee,
  PayrollRunSalarySegment, PayrollRunSalaryLine (the copy, kept out of the change history), PayrollInput;
  SalaryComponent `code` (optional until HR fills every component, then to be made required) and `enteredMonthly`;
  PayrollRun `peopleRefreshedAt / ById`. APIs `payroll.people.list / get / refresh`, `payroll.inputs.list / create /
  update / delete`; `/manage/payroll/:id` with People and Inputs. **Still open from stage 2:** Excel upload of inputs
  (waits for HR's list of monthly items; preview-then-save like the employee import, item 32.5); making `code` required;
  employees with no
  job-timeline row are silently left out of a run - a list of them for HR (or a check that the backfill script has run)
  is not built yet (run `npm run backfill-job-records -w backend` on any database with older employees).
- **Pay period (2026-11-27).** The user: "keep the payment day dynamic so we can change the month later currently in company we are using 26 to 25 cycle".
  Built as: a run pays the attendance cycle of its pay month, as captured on the run - 26th to 25th today ("March" =
  26 Feb - 25 Mar) - not the calendar month. The start day stays the setting in Attendance setup, so it can be changed
  later; runs created afterwards follow it, a run already created keeps its dates (`payPeriodOf`; the run page shows
  one "Pay period"). Draft runs created before this change hold a calendar-month copy until "Refresh from employee
  records" is pressed.
  **Confirmed by the user the same day ("yes 26 to 25 is correct"):** salary is for 26th-25th, not for the calendar
  month with the days after the 25th paid as present (the old HRMS's way). So an increment from the 1st splits the
  run (6 days at the old salary + 25 at the new) and a joiner on the 27th is first paid in next month's run.
  **Still open:**
  - [ ] **Changing the start day between two runs** can leave days that no run pays (26 -> 1: 26th to month end) or
    days paid twice (1 -> 26). Today only a locked attendance month refuses the change. **Needs:** the user's decision
    on the guard - e.g. refuse the change while it would leave a gap or overlap after a company's latest run, or a
    one-time bridging period - before the first real run is paid.
  - [ ] Is every company on the same cycle? The start day is one setting for the whole group today.
- **Stage 3, the days - built 2026-11-27** (the user approved `PayrollRunDay` and `PayrollRun.computedAt / ById`, with
  the day rows out of the change history): "Work out days" (`payroll.days.compute`) copies each person's days from the
  LOCKED attendance into the run - each half paid, unpaid or unclear, with what attendance said; paid / unpaid days on
  the people list, each day on a person's view; the header says when attendance was opened or locked again afterwards.
  Refreshing the people removes the days. **Decided by the user 2026-11-27:**
  - Payroll follows attendance half by half with no rule of its own: present, on duty, weekly off, holiday and paid
    leave are paid; absent, missed punch and leave without pay are unpaid; no "sandwich" rule (an off day between
    absences stays paid). An absent Saturday (half working day) costs half a day, as leave counts it.
  - A day attendance never worked out, or a leave half with no approved leave found, is "unclear": listed, never
    guessed.
  - The money part waits for a greytHR salary register: `private/` holds only CTC sheets, the employee master and
    punches.
  **Still open:**
  - [ ] **A greytHR salary register in `private/`** - best the 26 Feb to 25 Mar month (28 days) with at least one
    person with loss of pay - to read: what a day's pay is divided by (the period's days, 30 or 26), which components
    are cut for loss of pay, how the lines and the net are rounded. Then propose the results table, the dated rule
    settings and the component's "cut for loss of pay" switch, and build the earned amounts and gross.
  - **People who do not punch - built 2026-11-27** (the user approved the `AttendanceExemption` table and chose
    Schedules with Attendance setup Edit): "Not tracked" on Attendance setup > Schedules - one person or everyone ticked,
    from a day, with a last day or until ended, with a reason. A marked person counts present on working days whatever
    the punches say; leave, on duty, off days and HR's corrections stay; a locked month never changes
    (`attendance.exemptions.*`, the rule in `attendance/days/days.service.ts` - countPresent). Payroll needs no rule of
    its own: it still lists anyone absent on every working day as "Absent throughout" under "To check".
    - [ ] **HR's list of who does not punch**, per company (about a third of the active employees have no punch in
      HR's 11-day punch file of October 2026; the file may not cover every site). They are marked on Schedules - filter
      by plant or department and tick all, or paste the employee codes - while the attendance month is still open.
    - [ ] Only the marker in force (or the next to start) shows on Schedules; one that has ended is seen only in the
      change history and on its days' notes. A per-employee history, if HR asks for it.
    - [ ] On a phone the Schedules table hides the "Attendance" column (as it hides the holiday list); the "Not
      tracked" filter still works.
  - [ ] **The late rule's absent half** (the Nth late of a month makes a half absent) is an absent half in attendance,
    so the run shows it unpaid like any absence. Whether that penalty may reach pay is NOT decided: the law lets only
    the time actually missed be cut without the fine procedure (plan, "Payable days"; question for the CA). To settle
    before any amount is cut - if it may not, attendance must tell payroll which absent halves come from the late rule.
  - [ ] Unclear days block nothing yet; whether a run with unclear days may be approved is settled with stage 5.
  - [ ] The run's days are taken 100 employees at a time, because the leave reader stops at 2,000 applications - fine
    for one month; to revisit if a period can ever be longer.
- [ ] Remaining pay-run lifecycle: lock inputs, compute, issues, review,
  independent approval through the shared approval service, finalize, mark paid, return to draft/reopen and reconciliation.
- [ ] Employee run inputs: uploads, calculated items, component proration and backdated salary arrears (typed one-off
  earnings / deductions and component codes: stage 2; payable and unpaid days: stage 3, built 2026-11-27). Gross flags
  and the amount cut for an unpaid day need agreement against a register.
- [ ] Salary holds and releases, with the effect on calculation/payment defined.
- [ ] Payslips and own-payslip downloads; run output bundles; bank payment files, SAP GL/JV mapping/exports and variance reports.
- [ ] PF/EPS/EDLI, ESIC, PT and LWF calculations; effective statutory parameters/rates and PT slabs; ECR, ESIC return,
  PTRC and Form D outputs, with current eligibility/rates verified before implementation.
- [ ] Income tax: employee declarations, proofs and review, regime choice, tax projection/TDS, challans,
  reconciliation, Form 24Q and Form 16; agree tax residential status (item 11).
- [ ] Annual bonus true-up, bulk annual-increment simulation/application and retroactive arrears scheduling.
- [ ] Parallel-run migration: vendor/Protiviti register parsing/import, component-level variance comparison,
  cutover acceptance and historical YTD opening data.
**Payroll build order approved 2026-11-26:** (1) draft foundation above; (2) employee population, effective salary
snapshots and monthly inputs; (3) locked attendance, payable days/LOP and gross earnings; (4) statutory/other deductions,
net and rounding; (5) review/approval/reconciliation/finalization; (6) registers/payslips/bank/payment; (7) arrears, loans,
F&F, annual/tax outputs and parallel-run cutover. Propose each later model/field before adding it.

**Important differences from main:** new has group-wide attendance locks and two-half attendance facts. Main's
company locks, SQL triggers, separate approval lifecycle, rupee rounding and post-cutoff assumed-presence policy are
not copied. The cut-off treatment follows the user's instruction of 2026-11-27 (a run pays its attendance cycle - see
"Pay period" above, confirmed the same day). Agree the denominator, component proration and rounding against
reconciled samples before calculation. Current statutory eligibility/rates must be verified at that stage; no old rates are seeded now.

- **PRESENT:** salary structures/calculation, dated employee salary/history and individual approved revisions,
  promotions and transfers. Reuse Organization, employees and job-changes; these are not missing payroll modules.

#### Probation, confirmation and employee exit — DEFERRED core modules

**Reference:** `backend/src/modules/lifecycle/probation/`, `separation/`, `boarding-exit.service.ts`,
`frontend/src/pages/lifecycle/`. **Needs:** HR's review/notice/clearance rules and payroll for financial settlement.
See items 5, 24 and 26; reuse employee dates, letters, HOD appointments and approvals.

- [ ] Probation review creation/evaluation, due alerts, confirmation/extension decisions, confirmation salary switch
  and confirmation letter tied to the approved process.
- [ ] Resignation, notice calculation, approval/rejection/withdrawal, absconding and agreed last-working-day handling.
- [ ] Department clearance, F&F calculation/review/calendar/payment and experience/relieving letters tied to exit.
- [ ] End leavers' access/HOD appointments and other assignments under explicit exit rules; alumni view of exit/settlement.
- [ ] Scheduled joiner/leaver email/configuration remains (item 32); recorded-date report + Excel are built 2026-11-25.
  HR Head receives it, Super Admin configures others; agree time/coverage and schema before enabling delivery.
- **PRESENT:** manual confirmation-date editing, manual issue of employee letters, job changes/transfers and layoff APIs.
  A dedicated layoff/resignation page still waits under item 26; avoid rebuilding these existing APIs.

#### Attendance and biometric devices — DEFERRED extensions

**Reference:** `backend/src/modules/attendance/`, `backend/src/jobs/worker.ts`, attendance/team screens.
**Needs:** IT's device connection details/codes, HR's OT and closure policy; payroll where amounts are involved.
See items 19, 28 and 29.

- [ ] Kent automatic feed: webhook/API pull/database read/file drop as actually supported; safe retry/deduplication,
  device-health view, biometric-enrolment verification, quarantined punches and re-ingestion.
- [ ] Working-day OT detection, full/partial approval, rejection, conversion to comp-off, decision deadlines/lapse
  and summaries. Keep existing weekly-off/holiday comp-off claims.
- [ ] Short permission with in/out times — **INTENTIONALLY DEFERRED** on 2026-11-22 (item 29).
- [ ] Consecutive-absence cases, stages, follow-up letters and scheduled scans; confirm the old four-day trigger with HR.
- [ ] Manager month sign-off and separate week close; agree their purpose alongside the existing month lock.
- [ ] Roster publication status/revisions, coverage/meters, publication notifications and deadline reminders;
  assess what the current grid already supplies before adding any endpoint.
- **PRESENT:** shifts, patterns, dated policy, corrections, rosters/publishing, approved shift changes/swaps,
  regularization/OD, muster exports and month locking. Old shift bidding is **DECISION NEEDED** if distinct from swaps.

#### Leave — INTENTIONALLY DEFERRED extensions

**Reference:** `backend/src/modules/leave/` and attendance blackout configuration. **Why waiting:** the user chose
on 2026-11-22 to finish the core flow first. **Needs:** policy selection; encashment needs payroll/exit. Item 29 owns details.

- [ ] Leave encashment, location blackout dates and send-back/resubmit (restricted holidays: item 23, being built 2026-11-24).
- [ ] Company-transfer carry-over/encashment and handling pending requests when locking attendance; agree rules first.
- **PRESENT:** type rules, ledger/credits/lapse, balances/import, apply/preview, cancellation, team coverage, register,
  comp-off claims/expiry and recounting. Keep the new calendar-year and December/January balance decisions.

#### Approvals, offers and letters

**Reference:** `backend/src/modules/workflows/`, `lifecycle/offers/`, `letters/`.
**Needs:** delegation authority, candidate-subject design, letter approvers and held-request expiry policy. See items 2, 5, 18, 24.

- [ ] **DEFERRED:** approval delegation while away; send-back/resubmit; expiry of requests held for broken routing.
- [ ] **INTENTIONALLY DEFERRED:** offer approval before sending (skipped 2026-11-16). Implement only when selected,
  using the existing approvals service with candidate subjects and an agreed chain.
- [ ] **DECISION NEEDED:** letter-signature approval and user-defined letter kinds/codes; new currently has seven fixed kinds.
- **PRESENT:** configurable approval chains, SLA actions/escalation/expiry, routing holds/retry, reminders, job/leave/
  regularization/OD/comp-off/shift-change approvals, editable templates and manual employee-letter issue.
  Held-request expiry is distinct from the existing timed approval-step expiry.

#### Employees, documents and imports

**Reference:** `backend/src/modules/employees/`, `documents/`, `bulk/registry.ts` and `bulk/importers/`.
**Needs:** sensitive-column merge rules, expiry-bearing document types and permissions per imported person.
See items 12, 13, 18 and 27.

- [ ] **DEFERRED:** sensitive ID/bank/statutory import columns (Aadhaar, PAN, UAN, PF/ESIC, salary bank account),
  encryption, existing-value matching and per-row access checks.
- [ ] **DEFERRED:** document expiry dates/status and attention filters. Reminder jobs are an additional new need;
  the previous comparison found no working expiry-reminder job in main.
- [ ] **DEFERRED with owning module:** salary-assignment/payroll-input, legacy-loan, asset, holiday, statutory-rate
  and PT-slab imports; preview/commit/discard and error-report workflow. Reuse current imports where sufficient;
  a generic import framework is not a requirement by itself.
- **DECISION REVISED (2026-11-25):** the user selected employee family/nominee submissions and document uploads
  with HR review. Own uploads are built; family/nominee requests await schema approval in item 32. Direct canonical
  profile editing remains HR-only. The earlier submission exclusion no longer applies to these named flows.
- **PRESENT:** employee import/update/history/error files, punch upload and opening leave-balance import.

#### Loans and advances — DEFERRED

**Reference:** `backend/src/modules/loans/`; payroll Loans page. **Why waiting:** depends on payroll and approved lending policy.
**Needs:** eligibility, limits, interest, repayment and approval rules.

- [ ] Application/approval, eligibility and amortization preview, immutable posting ledger, payroll repayment,
  perquisite valuation and legacy SAP/greytHR loan import/reconciliation.

#### Reimbursements and payment batches — DEFERRED

**Reference:** `backend/src/modules/claims/` (including receipts and payments); Claims and ReimbursementPayments pages.
**Why waiting:** needs entitlements and finance/payment policy; payroll for salary-routed amounts.

- [ ] Entitlements, claims/receipts, approval, direct-payout/payroll routing and year-end recovery.
- [ ] Eligible-claim payment batches, bank files and paid status; define retry protection and reconciliation.

#### Travel — DEFERRED

**Reference:** `backend/src/modules/travel/`, `frontend/src/pages/travel/`.
**Why waiting:** core HR comes first. **Needs:** travel approval chains, budgets, advance and settlement rules.

- [ ] Trip requests, itineraries, submit/approve, budgets/reservations/headroom, advances and approvals,
  expense claims/items, settlement and wallet/ledger; reuse approvals and payment services when available.

#### Assets — INTENTIONALLY DEFERRED until after core HR

**Reference:** `backend/src/modules/assets/`, Assets page. The user explicitly deferred this on 2026-11-20;
**item 25** owns the fuller new design and HR questions.

- [ ] Register/import, assign/return, maintenance, employee holdings, unreturned assets and exports;
  connect returnable assets to exit clearance when both modules exist.
- Main's asset model does not approve the proposed lockers/kits schema in item 25; agree each model first.

#### Helpdesk, engagement and policies — DEFERRED

**Reference:** `backend/src/modules/helpdesk/`, `engagement/`, `policies/`; workplace and policy screens.
**Why waiting:** core HR first. **Needs:** owners, employee visibility and escalation/acknowledgement rules.

- [ ] Helpdesk categories, tickets, thread/replies, statuses, SLA escalation and performance/export.
- [ ] Announcements; polls/surveys with responses, results and closing/withdrawal rules.
- [ ] Policy catalogue/files, publication, employee acknowledgements, outstanding acknowledgements, reminders and reports.

#### Statutory compliance, industrial relations and privacy — DEFERRED

**Reference:** `backend/src/modules/compliance/`, `ird/`, `privacy/`; Compliance page and IRD panels.
**Why waiting:** dedicated policy/access design required. **Needs:** HR/legal ownership, confidentiality, retention
and actual registration/filing obligations; verify current legal requirements when implementing.

- [ ] Compliance registrations/retirement, posture, filing calendar, evidence, filing/waiver and expiry/due reminders.
- [ ] Internal committee, POSH cases/assignment, named or anonymous reporting/status, grievances and whistleblower cases.
- [ ] Privacy notices/acknowledgements, consents, rights requests/fulfilment/refusal, processor register, breach register,
  DPO details, personal export, retention and proposed/confirmed purge.
- **DECISION NEEDED:** retention/purge policy changes to today's retained audit history (item 3b); do not silently
  delete history. An access-history endpoint/table in main is not evidence of working read auditing: item 3b records
  that reads were not filled. Decide what to record before promising “who viewed my data”.

#### Accounts, SSO and recruitment integration

**Reference:** `backend/src/modules/auth/`, `sso/`, `ats-bridge/`.
**Needs:** account ownership/authentication model, identity provider, actual ATS contract and service-actor design.
See items 3, 15 and 18.

- [ ] **DEFERRED / DECISION NEEDED:** SSO account linking/unlinking, external-account lookup, authorization/token,
  introspection and logout integration; confirm the provider and required interoperability.
- [ ] **INTENTIONALLY DEFERRED (phase 7, 2026-11-16):** external ATS employing-entity lookup and accepted-offer ingestion;
  only needed if an ATS will be used (item 15).
- [ ] **DECISION NEEDED:** non-employee admin/service accounts; current actors are employee ids or SYSTEM_ACTOR.
- [ ] **DECISION NEEDED:** increasing lockout duration on repeated lockouts versus the new configurable fixed duration.
- **PRESENT:** password re-entry, password history/reset codes, session administration, security rules and active-role
  data access. Reuse these; main's combined-role behaviour is **INTENTIONALLY EXCLUDED** by the 2026-11-23 decision.

#### Dashboards, reports, audit search and feedback

**Reference:** `backend/src/modules/reports/`, `audit/`, `feedback/`; home/executive/report screens.
**Needs:** scoped source data and agreed metrics/recipients; avoid counting the same capability twice.

- **PRESENT (2026-11-24, selected by the user):** daily-work Home with decisions/request drill-down, own leave and
  attendance, recent requests, manager/HOD/Attendance View People today, scope selector and Reports & Excel links (item 16).
  Home separates employee, manager, HR joining-work/pre-joining and administration priorities using active capabilities.
  2026-11-27: role-home attendance-month, payroll-run and joiners & leavers cards, and self-service "My day" (item 16).
- **PRESENT (Stage 1, 2026-11-24):** attendance detail, retained raw punches and exceptions at `/attendance-reports`,
  with calendar-date/place/person/status/exception filters, scoped summaries, paging, night-shift drill-down and full
  matching Excel exports up to 20,000 attendance days. No schema changes; current placement and stored-day limitations
  are explicit. See API_TRACKER attendance.reports.* and docs/test-runs/2026-11-24-attendance-reports-home.md.
- [ ] **Stage 2:** extend/reuse Team requests for regularization/OD reporting; no second request/message store.
- **PRESENT (2026-11-25):** recorded joiner/leaver register and Excel, scoped to Employee directory & job View (item 32).
- [ ] **Stage 3 remaining:** probation-due list from existing dates; full exit/review details wait for their owning workflows.
- [ ] **DEFERRED with owning modules (Stage 4):** OT, absence-case, probation-outcome, complete attrition, asset,
  helpdesk, policy and claim reports/exports. Needs their approved business process/schema, not report-only tables.
- [ ] **Still deferred (Stage 5 / item 16):** broader HR workload trends, payroll/leadership/device-health dashboards,
  historical headcount/movement/attrition/payroll costs and executive trends/snapshots. Agree metric definitions,
  historical placement and data access first; no snapshot model approved by Stage 1.
- [ ] **DEFERRED:** free-text history search, retaining current access rules, filters, integrity checks and export (item 18).
- [ ] **DEFERRED:** beta feedback with context, screenshot attachment and administrative triage; agree who sees it.
- **PRESENT:** change history/integrity/export, muster, employee/candidate/job-change exports and combined team-request
  reports. Preserve original reasons/comments and the known cancellation-history limitation recorded below.

#### Delivery, operations and reference material — DEFERRED release work

**Reference:** `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `scripts/deploy.sh`, `scripts/backup.sh`,
`scripts/restore.sh`, `ecosystem.config.cjs`, `DEPLOY.md`, `backend/src/modules/system/`, old `docs/` and `plans/`.
**Needs:** chosen hosting/worker/storage topology, credentials handled outside docs, recovery targets and release owner.

- [ ] Adapt CI to new workspaces/checks; design deployment, worker supervision and database migration/cutover for the
  chosen host. cPanel/GitHub Actions/PM2 from main are references, not an approved hosting choice.
- [ ] Database and stored-file backup/restore, retention/manifest and a demonstrated restore drill.
- [ ] Database readiness and broader service health suitable for the new API/worker deployment; preserve existing health.check.
- [ ] Review old SOW/requirements, phase plans, guides and E2E evidence for uncovered business rules; map relevant
  requirements to new APIs/tests and write current guides. Old green checks/screenshots do not validate new.
- **INTENTIONALLY EXCLUDED:** copying old architecture, SQL schema/migration history, hard-coded roles, duplicate
  stores/services, obsolete plans or stale test results into new as current truth. Adapt useful test scenarios instead.
- New deployment files/folders or libraries must first follow the structure/approval rules in `CLAUDE.md`.

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
- **Reporting manager — settled:** stored on the employee since phase 1 (2026-11-16, item 0); this is no longer
  an open HR question (status corrected 2026-11-24).

### Combined team-request reports (2026-11-24)

- [x] Approvals → Team requests: current team/HOD department or separately scoped Leave/Attendance access; all leave, cancellation, regularisation, OD, comp-off and shift-change outcomes with original employee messages and approval remarks. Inclusive date basis, type/status/person filters, URL persistence, paged compact table and one full Excel review export.
- [ ] Preserve source details of older, superseded leave-cancellation requests. A leave application points only to its latest cancellation approval; another cancellation can replace that relation and its reason. The new report labels unavailable details rather than reconstructing text from summaries; request-raised date filtering can still show these approval rows. Retaining every future cancellation's original dates/reason needs an agreed schema/history change; already-lost text may be unrecoverable. No speculative backfill or audit-log workaround.

### 32. Selected extensions — new-only execution plan (2026-11-25)

The user selected these four areas and requested work using **only hrms-new's current context**. This execution plan
is based on its current schema/services, not main's architecture. Deliver one tested slice at a time. Only `DailyMovementReportSetting` is approved/built below; other proposed models remain unapproved. Each model/field
is proposed before its migration per CLAUDE.md section 2.

**Confirmed decisions:** employee family/nominee submissions and document uploads require HR review (supersedes the
16 November exclusion). Daily report goes to the HR Head; only an active Super Admin configures additional recipients
(check `CurrentUser.isSuperAdmin`, not a role name). Choosing recipients never grants data access.

1. **Own document submissions — built, no schema changes.** Reuses EmployeeDocument/PENDING/VERIFIED/REJECTED and
   employees.documents.*. Own upload is authenticated and bound to employee ID; other employees keep existing HR
   scope/area checks. Review/delete/restore remain HR management operations. Self-review is forbidden. Pending own
   evidence cannot satisfy consent; verified copies stay current until a replacement is verified. HR uses the
   employee's Documents tab. Remaining improvement: a consolidated scoped HR submission queue/notifications, using
   these same rows and reviewers rather than a second document store.
2. **Recorded joiner/leaver register + Excel — built 2026-11-25, no schema changes.** Employee.dateOfJoining and
   dateOfLeaving exist; a complete resignation/clearance/F&F domain does not. Use inclusive work-date range, event
   type, person and company/plant/department filters; summaries and full matching export share EMPLOYEES READ scope.
   Group/company reports include only the role's authorized slice. One person may have both joining/leaving events
   in a period. Label current placement, future recorded leaving dates and the absence of exit confirmation/history;
   never infer resignation approval, clearance or settlement. Reuse core/excel review metadata. Do not call a
   current-directory export a historical exit register. Delivered in People → Joiners & leavers; list/export use one
   bounded snapshot with a 20,000-event refusal, stable pagination and future-date markers. Owning sources: employees.schema/service/repository.ts,
   employee.prisma, employees/movements and core/excel. The directory returns employees; movement APIs return events
   (two per employee when both dates match), so they have a distinct contract. No email is sent.
3. **Daily report configuration — built 2026-11-25; email delivery deferred.** Approved `DailyMovementReportSetting`
   singleton stores enabled (kept false), HR-head role FK, IST minute-of-day, coverage (same day / previous day),
   sendEmpty and standard audit fields. Defaults approved: 09:00 IST, PREVIOUS_DAY and no-movement summaries on.
   Active Super Admin configures it in People → Joiners & leavers → Email settings. Reads do not seed a role or row;
   saves check role reporting access, preserve actor history and reject stale edits. Delivery cannot be enabled yet.
   Reuse worker.ts, core/jobs/scheduler and core/mail retry/attachments for the next stage. Select the HR Head role by ID,
   never code against its name. Proposed recipient relation names employee IDs selected by Super Admin; HR Head
   role holders are included automatically, duplicates removed. Resolve recipient eligibility and role-specific
   employee data access at delivery time; do not union all assigned roles or send one group-wide attachment to
   differently scoped recipients. Missing email/disabled/exited/no longer authorized recipients are skipped visibly.
   Propose a per-date/per-recipient delivery record when adding reliable retries, with explicit attempt state and
   uniqueness; scheduler JobRun alone is not a delivery receipt. SMTP retries cannot promise exactly-once delivery.
   **Still needed:** Super Admin selects the actual HR Head role. Propose/approve the recipient and delivery models
   one at a time; build scoped recipient resolution, scheduler integration and guarded/regenerated retries before
   activation. Existing generic frozen-payload MailRetry is insufficient for changing recipient access. No real
   scheduled email is enabled by this stage.
4. **Family/nominee change requests — schema proposal needed.** Reuse employeesSchemas family/nominee validation,
   core encryption, FormDialog/FormDrawer and approvalsService.registerFeature/raiseRequest. Proposed one
   `EmployeeProfileChangeRequest` model: employee FK, section FAMILY/NOMINEES, encrypted before/proposed snapshots,
   reason, approval request link, and standard audit fields. Review state belongs to the existing approval request;
   do not duplicate its decisions/status. Add the required ApprovalKind/ApprovalFeature values with that model.
   Canonical EmployeeFamilyMember/EmployeeNominee rows change only in the final approval transaction, after checking
   the before snapshot still matches and revalidating current marriage, nomination/share and guardian rules. A stale
   request requires review/resubmission; never overwrite HR's intervening edits. Owners may read their requests;
   HR review requires scoped EMPLOYEES READ + EMPLOYEE_PERSONAL_DETAILS WRITE, and relevant sensitive access for the
   encrypted fields. No self-approval. One pending request per employee/section; withdraw/reject/resubmit preserve
   history. Confirm HR reviewer chain before activating it. Family/request payloads never appear in plaintext logs.
5. **Imports — build domain-specific slices before a shared job schema.** Current employee import already previews
   (`save:false`), commits atomically (`save:true`), records successful/failed files and exports errors; it has no
   durable staged preview or discard state. Punch upload and opening leave balances have their own real workflows.
   Holidays now use HolidayList/Category/Mode/portion/leaveType and protected taken holidays/month locks; any holiday
   import must call those current services, not an obsolete flat company holiday writer. Start with a reviewed
   holiday template/preview/commit using that model, then salary assignments through salary/job-change rules.
   Payroll inputs, legacy loans, assets, statutory rates and PT slabs wait for the missing payroll/loan/asset/rate
   models and agreed templates. Do not store them in generic JSON import rows as a substitute for their owner.
   Only when the first two staged adapters need persistence, propose ImportJob + ImportJobRow (actor/domain/file
   key/hash/state/times; row number/validated encrypted payload/errors/target revision), with commit/discard audit,
   revalidation and scope checks at commit, concurrency protection and file retention. Share UX; keep each adapter
   in its owning module and one authoritative domain writer. Initial salary imports must not bypass approvals or
   silently overwrite effective-dated salaries; define opening assignment vs revision with HR first.
6. **Biometric ingestion — first verify IT's source contract, then propose models.** Current punches module reads
   CSV/XLSX, normalizes work-location timezones, deduplicates code+instant, preserves uploads/unmatched codes, links
   unmatched punches and reworks attendance. It does not have a device registry, durable source cursor, enrollment
   facts, quarantine/replay model or adapters. Reuse this normalization/day-ownership/locking path after separating
   transport from ingestion; don't manufacture uploads to represent automatic events. Candidate models for separate
   approval: BiometricDevice (source identity/location/zone/enabled), BiometricSyncState (cursor/success/error),
   BiometricIdentity (external person mapping/verification source/time), BiometricIngestionItem (source event identity,
   encrypted retained payload/error/disposition and resolved punch link). Exact fields follow the actual source.
   Build **one** supported Kent adapter first, not four speculative adapters. Quarantine malformed/unknown/outside
   scope events with reason; retry/re-ingestion is idempotent and cannot bypass locked attendance or approved changes.
   Device health distinguishes transport success, last received punch and enrollment verification; a quiet shift is
   not proof of device failure. No biometric images/templates are stored without a separately approved real need.
   **IT must provide:** protocol/version, supported push/API/DB/file mode, sanitized payload samples, authentication,
   stable event/device/person keys, timezone, corrections/deletions/replay behavior, connectivity and retention.

Verification for each slice: outside-company/plant/department reads and writes, own-vs-other records, active-role
isolation, stale/replayed/concurrent requests, invalid rows/files, true Excel scope/totals, UI loading/empty/error at
1440/390, audit attribution and all CLAUDE.md section 6 commands. Do not mark later stages built because this plan exists.

### 33. Mobile app with Capacitor - later (the user, 2026-11-27)
- **Why it waits:** the user chose to leave it for later after the research of 2026-11-27 (nothing installed).
- **What was found:** Capacitor 8 (iOS 15+, Android 7+). Push notifications are the main gain - a Firebase project, an
  Apple Developer account and APNs key, a device-token table per employee and a sender on approval / leave / payroll
  events. Home-screen widgets need native code (SwiftUI WidgetKit, Kotlin App Widget) per widget; bridge plugins only pass
  data. Live Activities / Android Live Updates do not fit while punches arrive by upload (they need the Kent machines'
  automatic feed, item 19), and approvals are ordinary alerts.
- **Needs first:** token sign-in for the app (the httpOnly SameSite=Strict session cookie does not reach a bundled app or
  a widget), CORS for the app's origin, the user's approval of the new libraries, and an App Store / Play plan (Apple 4.2:
  more than a repackaged website).
