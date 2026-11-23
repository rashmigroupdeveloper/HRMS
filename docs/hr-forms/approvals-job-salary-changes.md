# Plan: one approval service + job, transfer and salary changes on top of it

Written 2026-11-19. Nothing here is built yet. Each phase can be approved or dropped on its own.

## 1. What we are solving

From the comparison with the old HRMS, we lack:

1. Approval before a job change takes effect (and a record of rejections)
2. A move to another company of the group
3. Salary revision - with a promotion **or on its own** - and a salary history
4. One list of all job changes, a required reason, an "as of a date" lookup, and telling people

Your decision: approval must be **one service every feature uses** (job changes now; offers, leave, regularization,
exit later), not something rebuilt inside each feature.

## 2. Decisions I took for you (say if any is wrong)

| # | Decision | The alternative |
|---|---|---|
| D1 | **Default chain for job & salary changes:** reporting manager, then anyone holding a new access "Approve job & salary changes" for that employee. Chains are data: you change them on a settings screen, per company if you want. | HOD first; or one step only. Both are a setting, not a rebuild. |
| D2 | **Salary figures stay confidential.** A manager or HOD step sees only the job part. The proposed salary is shown only to an approver who also has "Employee salary: View" for that employee. A salary-only request skips the manager step. | As the old HRMS: every approver sees the figures. |
| D3 | **Waiting requests:** the approver gets an e-mail when a request reaches them and a reminder every 3 days. Nothing escalates or approves by itself. | Auto-escalate after 72 hours (old HRMS). |
| D4 | **Nobody approves their own:** not the employee the request is about, and not the person who raised it. | - |
| D5 | **One open request per employee** at a time (for job & salary changes). A second waits until the first is decided. | Several at once - leads to changes built on details that never came true. |
| D6 | **Salary never changes without approval.** A wrong salary is fixed by a "Correction" request for the same date - also approved. | A direct "fix salary" button for Salary: Edit. |
| D7 | **"Edit details" stops being a way around approval.** Changing job fields there (plant, department, designation, grade, position, cost centre, managers, employment type) needs the approve access. Everyone else with Employees: Edit can still fix names, contacts and dates. The Excel import follows the same rule for existing employees. | Leave it open and rely on the change history. |
| D8 | **Company move:** same employee record, new code from the new company's series (your answer). The old code keeps working for sign-in, search and old punches. | - |
| D9 | **No new package.** | See section 9. |

## 3. How the approval service works (Phase 1)

A new module `approvals`. It knows nothing about leave or transfers - only requests, steps and decisions.

**The flow**

1. A feature raises a request: "this kind, about this employee (or candidate), raised by this person".
2. The service copies that kind's chain onto the request (so editing a chain later never changes a request in flight).
3. Steps open one at a time. Each step is one of four types:
   - **Reporting manager** of the employee
   - **Functional manager** of the employee
   - **HOD** of the employee's department
   - **Access:** anyone holding a given access area covering the employee (data access applies)
4. A step with nobody to decide it (no manager, no HOD, or the manager *is* the employee) is **skipped with the reason
   recorded**.
5. **The last step is always an access step and is never skipped.** A request nobody could finally decide is refused
   when it is raised, with a message saying which access is missing.
6. Reject at any step ends the request (reason required). Approve at the last step makes it approved.
7. On the final decision the service calls the feature's own "apply" and "rejected" code **in the same transaction** -
   the decision and its effect are saved together or not at all.

**What it stores** (new `approvals.prisma`)

| Table | Columns that matter |
|---|---|
| `approval_chains` | `kind`, `companyId` (empty = every company; a company's own chain wins), unique per kind + company |
| `approval_chain_steps` | `chainId`, `stepNo`, `approverType` (the four above), `accessArea` (for an access step), `onlyWithTag` (step applies only to requests carrying that tag, e.g. "JOB") |
| `approval_requests` | `kind`, `employeeId` or `candidateId` (exactly one), `requestedById`, `status` (Pending / Approved / Rejected / Cancelled), `tags`, `confidentialArea` (an access-step approver must also hold this area at View), `summary` (one plain line, never confidential), `currentStepNo`, `decidedAt` |
| `approval_request_steps` | `requestId`, `stepNo`, `approverType`, `accessArea`, `approverId` (the named person, for manager / HOD steps), `status` (Waiting / Open / Approved / Rejected / Skipped), `skipReason`, `openedAt`, `decidedAt`, `decidedById`, `comment`, `lastRemindedAt` |

The service holds **no feature data** (no salary, no dates of leave). Each feature keeps its own table with a link to
its request.

**APIs** (`approvals.*`, 8)

| API | Who | What |
|---|---|---|
| `listToDecide`, `countToDecide` | any logged-in employee | what waits for me: steps naming me, and access steps my roles cover |
| `listMine` | any logged-in employee | requests I raised |
| `get` | the people involved | one request with its step trail (who decided what, when) |
| `decide` | the step's approver | approve or reject (reason required to reject) |
| `cancel` | the requester | take back a request still waiting |
| `chains.list`, `chains.save` | Roles & access: View / Edit (all companies for the shared chain, the whole company for its own) | the chains |

**Screens**

- **Approvals** page in the menu, with a count: everything waiting for me, of every kind, in one list. Opening one shows
  the feature's own detail and the step trail.
- **Approval chains** tab on Roles & access: per kind, the steps in order; add / remove / reorder.

**A daily job** `approvals.remind`: reminder e-mails, and it re-checks named approvers - if a manager or HOD left or
changed, the step is given to the new one (or skipped).

**Checked on paper against the other features you named**

| Feature | Fits? | Note |
|---|---|---|
| Offer approval | Yes | subject is a candidate; manager steps skip; access / HOD steps work from the offer's plant + department |
| Leave | Yes | requester is the employee; rule D4 already stops self-approval |
| Regularization, exit | Yes | same as leave |
| Shift swap | Approval part only | the colleague's side stays in the attendance feature |

## 4. Job changes through approval (Phase 2)

A new module `job-changes` (it must be its own module: it needs both `employees` and `approvals`, and `approvals`
needs `employees`).

**One representation of a future change.** Today a planned change is stored as a full timeline entry. That goes away:
a pending or approved-but-not-yet-due change lives **only as a request** holding the fields that change. The timeline
entry is written when the change actually applies. This removes two awkward rules built today ("a planned entry takes a
corrected value", "only the latest planned change can be cancelled").

**Table `job_change_requests`**

| Column | Meaning |
|---|---|
| `employeeId`, `approvalRequestId` (unique) | whose, and its approval |
| `effectiveFrom` | the day it applies |
| `kind` | Promotion, Transfer, Company transfer, Redesignation, Change of manager, Salary revision, Other |
| `reason` | **required** |
| `status` | Pending / Approved (waiting for its day) / Applied / Rejected / Cancelled |
| `changedFields` + one `new...` column per job field | exactly what changes (so "clear the grade" differs from "grade not touched") |
| `appliedAt`, `notifiedAt` | when it took effect; when the employee was told |

**Life of a request**

1. HR opens "Request change" on the profile (today's Change job form + a required reason). Needs Employees: Edit
   covering the employee; a move also where they go.
2. It goes through the chain (D1). The timeline shows it on top as "Waiting for approval - step 1 of 2: <name>".
3. Approved and the day has come: applied at once. Approved for a later day: applied by the daily job on that day. Until
   then HR can still cancel it.
4. **Everything is checked again at the moment it applies** (department still runs at the plant, managers have not
   left, no reporting loop, cost centre still the company's). If a check fails it stays "Approved - not applied" with
   the reason shown, and everyone else's changes go on.
5. Applied: the employee row changes, a timeline entry is written (linked to the request), the employee gets an e-mail
   saying what changed and from when.

**Also in this phase**

- **All job changes** page (under Employees): every request across employees, filter by status / kind / date / company,
  limited by data access. Excel export.
- **"As of a date"** on the profile's timeline: pick a date, see the job details in force that day
  (`employees.jobHistory.asOf`).
- **D7:** "Edit details" and the import need the approve access to change job fields.
- New access area **"Approve job & salary changes"** (`JOB_CHANGE_APPROVAL`).

## 5. Salary revision and salary history (Phase 3)

**Findings in our code**

- Salary rows are already kept "from a date" with their breakup, and a future-dated row is already ignored until its
  day. So history works as soon as rows can be added.
- Employees added directly or imported have **no salary row**. Their first request is "Set salary".
- The rule "monthly lines x 12 = annual CTC, active components only" lives privately in the candidates module. It moves
  to the organization module's salary-components service so the offer and the revision share one rule.

**What is built**

- The request form gets a **Salary** section (only for someone with Employee salary: Edit): new annual CTC,
  performance pay and the full breakup, starting from the current figures (your answer: full breakup). It can be sent
  **alone** (an increment) or **with** a job change (a promotion with a hike) - one request, one approval.
- Tables `job_change_salaries` + `job_change_salary_lines`: the proposed salary, typed and marked confidential (hidden in
  the change history without Salary access - D2).
- On apply, a new `employee_salaries` row from the effective date. That table gains: `reason` (Joining, Increment,
  Promotion, Confirmation, Correction, Other), `jobChangeRequestId`, `approvedAt`, `approvedById`.
- **Salary history** on the profile's Salary tab: every salary with its date, reason, CTC, the change in % from the one
  before, and who approved it; open one to see its breakup. Seen by the employee themselves and Employee salary: View.
- The e-mail to the employee says only "your salary is revised from <date> - see your profile". No figures by e-mail.

## 6. Move to another company (Phase 4)

**Findings in our code - what a new employee code touches**

| Thing | Today | In the plan |
|---|---|---|
| Sign-in | by employee code | the new code signs in; the old code is recognised and tells them the new one |
| Stored files | folder named by the code (`employees/RML035384/...`) | moved to the new code's folder in the same step (CLAUDE.md rule) |
| Punches | machine sends the code | old punches stay linked; a late upload with the old code still matches |
| Profile links, search | by code | the old code still finds them |
| Cost centre | belongs to one company | a new one must be chosen (or it is cleared) |
| Timeline | has no company | each entry gains company + employee code, so "as of a date" is right across the move |

**What is built**

- Kind "Company transfer" on the request: new company, plant, department (required), cost centre, managers.
- New table `employee_former_codes` (employee, old code, company, used until).
- Needs Employees: Edit covering the old **and** the new placement to raise; the approver must cover both.
- On apply: the next code of the new company's series, files moved, HOD post follows.
- The date of joining does not change (service in the group continues).

## 7. What changes in today's (uncommitted) work

**Please commit today's work first**, so this plan's diff is separate and reviewable.

| Built today | Becomes |
|---|---|
| `employees.jobHistory.create` (applies directly) | replaced by `jobChanges.create` (raises a request) |
| `employees.jobHistory.cancel` | replaced by `approvals.cancel` / `jobChanges.cancel` |
| Planned timeline entries (`appliedAt` empty) | removed; a planned change is a request |
| Nightly job `employees.applyJobChanges` | becomes `jobChanges.applyDue` |
| "Change job" drawer | becomes "Request change", with reason and (Phase 3) salary |
| "Edit details" corrections | kept; job fields need the approve access (D7) |
| Tests and API tracker entries of the above | rewritten with each phase |

Position, cost centre, functional manager, regions, lay offs and the timeline display stay as built.

## 8. Things that could go wrong, and what stops each

| Risk | Safeguard |
|---|---|
| A request nobody can approve | refused when raised; the last step is never skipped |
| Approving your own change | subject and requester are never approvers (D4) |
| Two people decide the same step at once | the decision only saves if the step is still open; the second gets "already decided" |
| Approved, but the facts changed since | re-checked when it applies; shown as "not applied" with the reason |
| Approver leaves, or the manager changes | daily job hands the step to the new one, or skips it |
| The employee exits mid-request | the request is cancelled automatically |
| A chain is edited mid-request | each request carries its own copy of the chain |
| Applied twice | status is checked in the same transaction as the change |
| Salary seen by the wrong person | typed tables hidden without Salary access; manager steps never get the figures; no figures in e-mails |
| Approval bypassed through Edit details / import | D7 |
| Someone outside your data access is exposed | every list and record follows CLAUDE.md section 8; each API has its Scope line and an outside-range test |

## 9. Packages

None needed. I considered three kinds and would not add any:

- **A state-machine library (XState):** our flow has four request states and five step states. A library adds more to
  learn than it removes.
- **A workflow engine (Temporal, BullMQ):** needs extra servers. Our existing scheduler already runs daily jobs once at
  a time, with a record of each run.
- **An approval SaaS / library:** none fits our data-access rules, which are the hard part.

## 10. Phases, size and checks

| Phase | What you get | New tables | New APIs (about) |
|---|---|---|---|
| 1 | Approval service, Approvals page, chain settings, reminders | 4 | 8 |
| 2 | Job changes through approval, all-changes list, as-of lookup, e-mails, D7 | 1 | 6 |
| 3 | Salary revision (alone or with a promotion), salary history | 2 (+4 columns) | 2 |
| 4 | Move to another company | 1 (+2 columns) | 0 (new kind) |

Every phase ends with: `typecheck`, `lint`, `build`, `check:api-tracker`, `check:data-access`, `test`, the API tracker
and BACKLOG updated, and a look at the screens in a browser (I need a login for that).

## 11. Not in this plan (goes to BACKLOG.md)

- Delegating approvals while away; auto-escalation; approving from the e-mail itself
- Moving shift changes onto the service; offer approval; leave / regularization / exit (each with its module)
- Arrears when a salary is back-dated (payroll)
- On a company move: leave balances, PF / ESIC transfer between establishments, final settlement
- Promotion / increment / transfer letters (the letters module can add these kinds later)
- Bulk yearly increments from Excel

## 12. Questions only you or HR can answer (none blocks Phase 1)

1. Who gets the "Approve job & salary changes" access at the start - and for which companies?
2. Should a transfer also ask the **new** department's HOD? (A chain setting; default no.)
3. On a company move, does the date of joining really stay the same for gratuity purposes? (Ask HR / accounts.)
