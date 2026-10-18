# Rashmi Group "Enterprise HRMS Requirements & Feature Blueprint" → gap analysis

Prepared Mon 19 Oct 2026 ~02:45 IST against `main` @ a67c6b3 (plus fix branch 2da4f3e for Kent). Source: `owner-docs/01M58B55MFH8JGR7EFK8VB730R.docx` (text in `.txt`), read in full: sections 1–38 + conclusion. The docx skips §7 and §21. Compared with `docs/qa-handover/requirements/REQUIREMENTS.md` (258 rows, baseline statuses @ ba6e81d) and the current code. Read-only; no app code changed.

**Nature of the document.** It is a high-level SRS/BRD for a Darwinbox-class platform, so it's broader than the signed SOW. About two-thirds of it (performance, LMS, skills, succession, rewards, POSH, AI, workforce planning, form/report builders) is the blueprint's own **Phase 5–7** and is outside the current SOW (`requirements/REQUIREMENTS.md`, `docs/qa-handover/sow.txt`). Its **Phase 1–3** (org, employee master, ESS/MSS, documents, workflow, RBAC, audit, attendance, shift, leave, OT, payroll, statutory, F&F) is the go-live core, and that's what the "Core" flag below marks.

## Counts

| | Done | Partial | Missing | Total |
|---|---|---|---|---|
| **All 87 atomic blueprint requirements** | 3 | 62 | 22 | 87 |
| Go-live core | 3 | 49 | 1 | 53 |
| Later (blueprint phase 4–7 / beyond SOW) | 0 | 13 | 21 | 34 |
| §2 module list (28 modules) | 0 | 20 | 8 | 28 |

Only a few blueprint requirements are fully **Done** as the blueprint words them. Most ask for more than the SOW-scoped implementation, so "Done" against the SOW (REQUIREMENTS.md) and "Done" against the blueprint are different bars. The payroll/statutory core is the strongest area (register parity 44/44, RML033625 = 59,124).

## Go-live critical gaps (filed in BUGS.md as REQ-001…)

These are the gaps that make the system not production-usable for RML's joining → attendance → payroll → exit loop on day one, ordered by risk:

1. Prejoin → employee conversion skips master validation (PAN/Aadhaar Verhoeff/UAN/IFSC/account/minor/duplicates): bad statutory data reaches payroll. (JF map §3.1)
2. EPF history (member before 01-Sep-2014, previous PF/EPS membership, international worker) isn't captured, so EPS vs EPF split can't be decided for new joiners. (BP-100)
3. No employee/candidate document upload or verification (KYC, bank proof, certificates, photo). (BP-200, BP-051)
4. The joining form can't be recorded. There are no education, certification, experience, structured address, father's name, nationality, disability, passport or bank-branch/holder/type fields, and POST/PATCH /employees can't set personal e-mail, marital status, blood group, addresses or emergency contact. (BP-010..012)
5. Nomination isn't scheme-wise (PF / gratuity Form F / ESIC s.71), nominee address and witnesses are missing, and family is not capturable before joining. (BP-011)
6. No declaration/consent/e-sign record for the joining declaration, EPF undertaking and ESIC declaration. (JF §10)
7. Emergency-contact relationship is dropped and gender is never set for portal joiners. (JF map)
8. No separation type (retirement/death/contract expiry/termination) driving gratuity and F&F; Business Head and Finance approval steps are absent. (BP-120, BP-121)
9. Master edits (designation, grade, RM, employment type) are not effective-dated and leave no history row. (BP-014, BP-020)
10. No maker-checker on bulk imports and no post-commit batch reversal (the blueprint calls this mandatory for salary/employee/attendance). (BP-111, BP-112)
11. No pre-payroll validation for missing PAN/UAN/ESIC/bank or bank-detail changes before compute. (BP-110)
12. Workflow can't do amount-based or plant-head routing; OT has no multi-step/pre-approval chain. (BP-230, BP-081)
13. MFA has a table but no API/UI; there are no Finance or read-only Auditor roles. (BP-240, BP-241)
14. OT types (holiday/WO/night) aren't distinguished for rates. (BP-080)
15. Medical questionnaire (joining-form annexure) has no restricted home; sensitive-data access rule needed before it's collected. (BP-242)

## Non-negotiable design principles (§36)

| # | Principle | Status | Rows |
|---|---|---|---|
| 1 | Group → Legal Entity → Division → Work Location → Plant hierarchy | Partial | BP-001 |
| 2 | Position-based manpower management | Missing | BP-002, BP-040 |
| 3 | Effective-dated employee history | Partial | BP-020 |
| 4 | Manufacturing-grade attendance, shifts and OT | Partial | BP-070..081 |
| 5 | Indian payroll and statutory engine | Partial (strongest area: recon 44/44) | BP-090..101 |
| 6 | Contractor and labour compliance | Missing | BP-271 |
| 7 | Configurable maker-checker workflows | Partial | BP-111, BP-230 |
| 8 | Bulk Excel validation, Batch ID and rollback | Partial (no reversal, no checker) | BP-111, BP-112 |
| 9 | Complete audit trail | Partial (hash-chained audit_log; history table under-used) | BP-014, BP-021 |
| 10 | Group analytics with drill-down to employee | Partial | BP-214 |

## §2 module coverage

| Module | Status | Evidence |
|---|---|---|
| Employee Master | Partial | POST/PATCH /employees, profile; joining-form gaps |
| Organization Management | Partial | org masters; no division/section |
| Position & Manpower | Missing | — |
| Pre-Joining & Onboarding | Partial | prejoin portal, convert, tasks |
| ESS | Partial | /me, /my/* |
| MSS | Partial | /my/team, approvals |
| Attendance | Partial | Kent adapter, day engine, month lock |
| Shift & Roster | Partial | att.shifts/rosters/swaps |
| Leave | Partial | lv.* ledger, accrual, year-end |
| Overtime & Comp-Off | Partial | OT decide/lapse, CO |
| Payroll | Partial | recon 44/44 MATCH |
| Compensation & CTC | Partial | structures, revisions |
| Statutory Compliance | Partial | PF/ESI/PT/LWF/TDS/Form 16/24Q |
| Full & Final Settlement | Partial | compute-fnf, pay |
| Performance | Missing | — |
| Learning & Development | Missing | — |
| Skill & Competency | Missing | — |
| Rewards & Recognition | Missing | — |
| HR Helpdesk / Grievance | Partial | helpdesk yes; grievance schema only |
| Exit & Alumni | Partial | separations, alumni portal |
| Analytics / MIS | Partial | executive + R2–R31 |
| Asset Management | Partial | ast.* |
| Document Management | Missing | no employee doc API/UI |
| HR Letters | Partial | 7 templates |
| Workforce Planning | Missing | — |
| Discipline, Grievance & POSH | Missing | schema only + absence show-cause |
| API/Integration | Partial | Kent, SAP JV, bank, SMTP |
| Administration & Security | Partial | RBAC, audit, sessions; no MFA/SSO |

## Atomic requirements

Go-live: **Core** = needed for production use when Kent is attached (blueprint phases 1–3 + the joining path); **Later** = phase 4–7 or beyond the SOW. Existing RQ = the closest row already in REQUIREMENTS.md; rows with "—" were added as new RQ-BP-* rows.

| ID | § | Requirement | Status | Evidence (file / route) | Existing RQ | Go-live | Prio |
|---|---|---|---|---|---|---|---|
| BP-001 | §1 | Org hierarchy Group → Legal Entity → Division → Work Location → Plant/Office/Site → Department → Sub-department → Designation → Position → Employee | **Partial** | core.companies, core.locations, core.plants, core.org_units (generic parent_id), core.departments (flat, not per plant), core.designations. No division, sub-department/section or position entity. | RQ-CORE-022 | Later | P2 |
| BP-002 | §1/§6 | Position kept separate from designation; each position holds sanctioned HC, occupied HC, vacancy | **Missing** | No position table or API. | — | Later | P2 |
| BP-003 | §1 | Cost centre and profit centre maintained separately from the org hierarchy | **Partial** | core.cost_centers (company, plant), employees.cost_center_id; no profit centre. | RQ-CORE-006 | Core | P2 |
| BP-004 | §1 | Assignments inherit the org hierarchy; transfers are effective-dated | **Partial** | lifecycle/transfers (scheduled future-dated apply, employee_history rows); department/plant/location are independent picks, with no inheritance. | RQ-LC-010 | Core | P2 |
| BP-010 | §3 | Employee personal data: ID, name, DOB, gender, marital status, nationality, photograph, signature, emergency contact, contact details | **Partial** | core.employees has most; nationality, signature, photo upload missing; marital status/personal e-mail/emergency not in POST/PATCH /employees (JOINING_FORM_MAP rows 13–31, 85–89). | RQ-CORE-001 | Core | P1 |
| BP-011 | §3 | Address and family/dependent data with nominee details | **Partial** | Addresses are free text (present_address/permanent_address); employee_family + single is_nominee/share (family.router.ts). | RQ-CORE-025 | Core | P1 |
| BP-012 | §3 | Employment data: DOJ, confirmation, probation, employment type, category, entity, division, location, plant, department, section, designation, grade, position, RM, functional manager, cost centre | **Partial** | Columns exist except division/section/position; plant_id and cost_center not settable from POST/PATCH /employees; functional manager via hodEcode. | RQ-CORE-005 | Core | P1 |
| BP-013 | §3 | Employee categories: Regular, Fixed-term, Trainee, Apprentice, Consultant, Intern, other configurable | **Partial** | Fixed enums employment_category + contract_type (no intern; not configurable). | RQ-CORE-007 | Core | P2 |
| BP-014 | §3 | Single source of truth with controlled changes and complete history | **Partial** | Hash-chained audit_log on PATCH /employees; core.employee_history written only by transfers; ESS change requests only for family. | RQ-RBAC-010 | Core | P1 |
| BP-020 | §4 | All major HR transactions effective-dated, preserving old values (transfer, promotion, revision, designation/grade, dept/location, RM, employment-type change) | **Partial** | Transfers + salary revisions effective-dated; designation/grade/RM/type edits via PATCH are immediate (no effective date, no history row). | RQ-LC-011 | Core | P1 |
| BP-021 | §4 | Each change records previous/new value, effective from/to, changed by, approved by, timestamp, reason, reference no. | **Partial** | audit_log has old/new/actor/time; no reason/approver/reference on master edits. | RQ-RBAC-010 | Core | P2 |
| BP-030 | §5 | Legal-entity master: CIN, PAN, TAN, GSTIN, PF, ESI, PT, LWF, factory/shop registrations, registered address, authorised signatories | **Partial** | core.companies has pan/tan/gstin/pf_establishment_code/esic_code/pt_registration_no/address; cmp.registrations holds licences; no CIN, LWF reg. no., authorised signatories (needed on Form 16, letters, Form F). | RQ-CORE-023 | Core | P2 |
| BP-031 | §5 | Division/location/plant masters with ownership, geography, time zone, establishment type, plant head, HR head, working calendar, shift pattern, statutory applicability | **Partial** | core.locations (state_code, timezone), core.plants; holidays by company/plant/location; no establishment type or per-plant statutory applicability. | RQ-CORE-022 | Later | P2 |
| BP-040 | §6 | Position master (position ID/name, entity, division, location, establishment, dept, section, designation, grade, job family, job level, cost centre, budgeted/sanctioned/occupied HC, vacancy, reporting position) | **Missing** | None. | — | Later | P3 |
| BP-041 | §6 | Manpower lifecycle: position creation → budget → approval → vacancy → recruitment → selection → joining → occupied | **Missing** | GET /api/recruitment/requisitions → 404 (UI-03). | RQ-ATS-001 | Later | P2 |
| BP-042 | §6 | Manpower dashboards: sanctioned, actual, vacant, critical by entity/plant/dept/grade/designation | **Missing** | Only actual headcount (R27). | RQ-RPT-002 | Later | P2 |
| BP-050 | §8 | Automated LOI, offer, appointment, contract, NDA and salary-annexure generation from candidate/employee data | **Partial** | Only the appointment letter template is seeded (core.letter_templates); no offer/LOI/NDA/salary annexure. | RQ-ATS-002 | Core | P2 |
| BP-051 | §8 | Candidate portal for personal data, KYC, bank, education, experience, family, nomination, PF/UAN, ESI and documents | **Partial** | PrejoinPortalPage + prejoin-schema.ts: addresses, emergency, PAN, Aadhaar, UAN, bank, blood group only; no uploads, education, experience, family, nomination, ESIC. | RQ-LC-002 | Core | P1 |
| BP-052 | §8 | Onboarding checklist for HR, IT, Admin, Department: email, laptop, ID card, PPE, induction, safety training, job training | **Partial** | task-fanout.service.ts: it_email, it_laptop, it_biometric, admin_id_card, hr_induction (fixed list); no PPE, safety/job training, department or payroll tasks. | RQ-LC-004 | Core | P2 |
| BP-060 | §9 | ESS: profile, attendance, leave, salary, payslips, documents, assets, expenses, goals, performance, training, requests, helpdesk, letters, notifications | **Partial** | /me, /my/attendance, /my/leave, /my/pay, /my/tax, /my/claims, /my/letters, /helpdesk, /travel; Profile Documents/Assets/Requests tabs are link-only empty states; no goals/performance/training. | RQ-NFR-013 | Core | P1 |
| BP-061 | §9 | MSS: team attendance, leave, OT, vacancies, performance, training, appraisal, movements, salary, attrition, with approvals | **Partial** | /my/team grid, /my/team/overtime, /approvals; no vacancies/performance/training/appraisal views. | RQ-WF-008 | Core | P2 |
| BP-070 | §10 | Attendance sources: biometric, face recognition, mobile, GPS/geofence, web punch, API, controlled manual correction | **Partial** | Kent CamAttendance face adapter (webhook/API/DB/CSV, fix branch 2da4f3e), PUT /attendance/days/override (no UI, E2E-007); no mobile/GPS/web punch. | RQ-ATT-001, RQ-ATT-025 | Core | P1 |
| BP-071 | §10 | Late/early, missing punch, half-day, absent, weekly off, holiday, OD, business travel | **Partial** | day_status P,A,HD,WO,H,L,OD,CO,UAB; late/early slabs on att.shifts; business travel (te.trips) not linked to attendance status. | RQ-ATT-010 | Core | P1 |
| BP-072 | §10 | Shift master A/B/C/general and 24×7 patterns, rotation, weekly off, shift allowance, night allowance, shift swaps | **Done** | att.shifts (crosses_midnight, session split, allowance_component_code per shift = shift/night allowance), att.shift_patterns (rotation), rosters + publications, shift_swaps, weekly off via schemes. | RQ-ATT-007 | Core | P2 |
| BP-073 | §10 | Leave types CL, SL, EL/PL, maternity, paternity, comp-off, LWP, special; accrual, carry-forward, encashment, proration, approvals; state/company policies | **Partial** | Seeded CL, SL, EL, EL_VOTE, CO, LWP, ML (migration 1751880000000); paternity/special not seeded (addable via PUT /leave/types/{code}); no state-specific rule sets. | RQ-LV-001 | Core | P2 |
| BP-080 | §11 | OT types: normal, holiday, weekly-off, night OT, shift allowance, comp-off | **Partial** | att.overtime_entries has one type; comp-off credit for WO; no per-type OT rates. | RQ-ATT-019, RQ-PAY-022 | Core | P1 |
| BP-081 | §11 | Configurable OT approval chain supervisor/employee → department → HR → payroll | **Partial** | Manager-only decision with 48 h lapse (/attendance/ot/decide); no pre-approval (RQ-ATT-018), no multi-step chain. | RQ-ATT-017, RQ-ATT-018 | Core | P1 |
| BP-090 | §12 | Salary components: Basic, DA, HRA, conveyance, special, washing/medical/education, shift allowance, incentives, OT, bonus, arrears, deductions | **Done** | payroll-core/components (any earning/deduction as a formula node, /payroll/components CRUD), engine/arrears.ts; register parity recon 44/44 MATCH. Formula edge cases tracked in RQ-PAY-001. | RQ-PAY-001 | Core | P0 |
| BP-091 | §12 | CTC structures configurable by entity, grade, location, employee type, plant, effective date | **Partial** | pay.salary_structures per company; selection by grade/location/type/plant not modelled. | RQ-PAY-002 | Core | P1 |
| BP-092 | §12 | Payroll flow: master freeze → attendance/leave/OT freeze → inputs → variable pay → arrears/LOP → statutory → calculation → variance → approvals → finalisation → bank file → payslip → JV/statutory outputs | **Partial** | runs/run-state-machine.ts, att.month_locks, variance.service.ts, bank-file, payslip, gl/sap-jv, ECR/ESIC/PTRC/LWF; no explicit master freeze step. | RQ-PAY-005 | Core | P0 |
| BP-093 | §12 | Salary revision, promotion, increment, variable pay, bonus, incentive, CTC simulation, compensation budgeting | **Partial** | /payroll/revisions, annual/increment-batch.ts, bonus-trueup.ts, /payroll/structures/preview; no compensation budgeting. | RQ-PAY-021, RQ-PAY-012 | Core | P2 |
| BP-100 | §13 | India statutory: PF, EPS/EDLI, UAN, ECR, ESI, PT, LWF, bonus, gratuity, TDS, Form 16, configurable state/entity rules | **Partial** | statutory/pf.ts, esic.ts, pt.ts, lwf.ts, tds module, form16/24Q; EPS eligibility for post-01-Sep-2014 members not decidable (no EPF history, JOINING_FORM_MAP EPF rows). | RQ-STAT-001..013 | Core | P0 |
| BP-101 | §13 | Maintain statutory identifiers, applicability, contributions, registers, returns and evidence | **Partial** | cmp.registrations, cmp.filing_evidence, cmp.calendar_items; employees.pf/esic/pt/lwf_applicable flags. | RQ-STAT-013 | Core | P1 |
| BP-110 | §14 | Pre-payroll validation: missing bank/PAN/UAN/ESIC, abnormal salary change, negative salary, excess OT, duplicate employees, bank changes, major variances | **Partial** | variance.service.ts (negative net, variance anomalies); bank-file refuses missing bank/IFSC at output time only; no pre-run missing-PAN/UAN/ESIC, excess-OT or bank-change alert. | RQ-PAY-008 | Core | P1 |
| BP-111 | §14 | Excel import engine: template → upload → validate → error report → preview → maker → checker → approve → import → transaction ID → audit | **Partial** | core/bulk/engine.ts + /bulk/{importer}/template\|preview\|jobs/{id}/report\|commit; the uploader commits their own job (no checker step). | RQ-CORE-021 | Core | P1 |
| BP-112 | §14 | Every import has an Import Batch ID and supports rollback/reversal of the complete batch (mandatory for salary, employee, attendance) | **Partial** | core.bulk_jobs.id is the batch ID; savepoint rollback only on commit failure; no post-commit reversal. | RQ-CORE-021 | Core | P1 |
| BP-120 | §15 | Exit workflow: resignation → manager → Business Head → HR → notice → clearance → attendance freeze → leave encashment → salary/LOP → bonus/gratuity → recovery → asset clearance → F&F → finance approval → payment → relieving/experience letter → exit | **Partial** | lifecycle/separation (chain, ceo-review), clearances, compute-fnf, pay (row lock, E2E-022), letters; no Business Head or Finance approval step in the seeded chain. | RQ-SEP-002, RQ-SEP-005 | Core | P0 |
| BP-121 | §15 | Separation types: resignation, termination, retirement, absconding, death, contract expiry, misconduct, restructuring, mutual separation | **Partial** | core.separations initiated_by employee\|hr, absconding path; no separation-type enum (death/retirement change gratuity eligibility and F&F payee). | RQ-SEP-003 | Core | P1 |
| BP-122 | §15 | Notice waiver/recovery, exit interview, clearance, rehire eligibility, alumni history | **Partial** | Notice recovery in F&F, clearances, alumni portal (GET /lifecycle/alumni/me); no rehire flag, no exit-interview capture. | RQ-SEP-008 | Core | P2 |
| BP-130 | §16 | Letter templates: appointment, promotion, transfer, salary revision, confirmation, warning, show-cause, suspension, disengagement, experience, relieving, increment, designation/dept change, salary/employment certificates | **Partial** | Seeded: appointment, confirmation, experience, relieving, salary_certificate, show_cause, warning; templates editable at /letters/templates; 8 types not seeded. | RQ-LTR-001 | Core | P2 |
| BP-131 | §16 | Dynamic merge variables: name, ID, designation, department, DOJ, CTC, plant, reporting manager | **Partial** | letters.service.ts merges employee_name, ecode, company, designation, department, doj, dol, confirmation_date; no CTC, plant, RM. | RQ-LTR-001 | Core | P2 |
| BP-140 | §17 | Performance: goals/KRA/KPI, weightage, mid-year, continuous feedback, self/manager appraisal, calibration, rating, increment/promotion linkage, 360, PIP | **Missing** | Only the probation review form. | — | Later | P3 |
| BP-141 | §17 | OKR hierarchy Company → Business → Department → Individual objective | **Missing** | None. | — | Later | P3 |
| BP-150 | §18 | Training lifecycle TNA → annual plan → nomination → training → attendance → assessment → feedback → effectiveness → record | **Missing** | None. | — | Later | P3 |
| BP-151 | §18 | Programme types: induction, technical, behavioural, compliance, safety, ISO, POSH, fire, LOTO, HIRA, SOP, leadership | **Missing** | None (hr_induction is a single onboarding task). | — | Later | P3 |
| BP-152 | §18/§31 | Skill matrix employee → process → skill → required/current level → gap → training, rating 0–5 | **Missing** | None. | — | Later | P2 |
| BP-160 | §19 | Critical-position identification, successor mapping, readiness, potential, risk, development plan | **Missing** | None. | — | Later | P3 |
| BP-161 | §19 | 9-box performance/potential framework and talent review | **Missing** | None. | — | Later | P3 |
| BP-170 | §20 | Asset lifecycle (laptop, desktop, mobile, SIM, ID card, PPE, uniform, tools, vehicle, accommodation): assign → acknowledge → transfer → repair → return → clearance | **Partial** | ast.assets/assignments/maintenance, /assets/{id}/assign, return, non-returned; employee acknowledgement and holder-to-holder transfer not found. | RQ-AST-001..007 | Core | P2 |
| BP-180 | §22 | Disciplinary case lifecycle: incident → warning/show cause → explanation → suspension/charge sheet → enquiry → action → appeal → closure | **Partial** | Only for continuous absence (att.absence_cases stages watch → show_cause → warning → termination_review). | RQ-ATT-021 | Later | P2 |
| BP-181 | §22 | Confidential grievance and POSH case management with restricted access, evidence, investigation, IC actions, closure | **Missing** | Schema only (ird.posh_cases, ird.grievances, ird.ic_members, posh_case_access_log); no API or UI. | — | Later | P2 |
| BP-190 | §23 | HR helpdesk: category, queue, assignment, SLA, escalation, resolution, employee confirmation | **Partial** | helpdesk module (SLA due, escalation, reopen_count); no employee confirm-resolution step. | RQ-HD-001..003 | Core | P2 |
| BP-191 | §23 | Engagement: pulse surveys, eNPS, feedback, suggestions, polls, quizzes, birthday/anniversary notifications | **Partial** | engagement surveys, polls, announcements; no eNPS, quiz, suggestion box, birthday/anniversary. | RQ-EN-002..004 | Later | P3 |
| BP-192 | §23 | Rewards: Star of Month/Quarter, Employee of Year, Safety, Innovation, Long Service, Spot awards with nomination/approval | **Missing** | None. | — | Later | P3 |
| BP-200 | §24 | Employee document repository: personal, education, experience, KYC, employment, payroll, statutory, training, performance, disciplinary, exit | **Missing** | core.documents + doc.types (4 seeded) + core/storage; no employee document upload/list API or UI (Profile Documents tab links to letters). | RQ-LC-002 | Core | P1 |
| BP-201 | §24 | Document version control, expiry/renewal alerts, verification, e-sign, access control, download restrictions, audit | **Partial** | core.documents.expires_on/status columns; cmp.registrations expiry for licences; no versioning, verify flow or e-sign. | — | Core | P2 |
| BP-210 | §25 | Group HR dashboard: workforce, permanent/contract/trainee, joiners, exits, attrition, vacancies, absenteeism, OT, payroll cost | **Partial** | /executive (RQ-RPT-101..117), /dashboards/hr-ops; vacancies missing. | RQ-RPT-002 | Core | P1 |
| BP-211 | §25 | Recruitment analytics: requisitions, open positions, CVs, interviews, selections, offers, joining ratio, TAT | **Missing** | Only R21 offers report. | RQ-RPT-005 | Later | P2 |
| BP-212 | §25 | Payroll analytics: salary register, CTC, variance, OT, LOP, arrears, revisions | **Partial** | Register/variance/R5 OT; no LOP/arrears/revision analytics view. | RQ-OUT-006 | Core | P2 |
| BP-213 | §25 | Training analytics: plan vs actual, hours, cost, effectiveness, skill gaps | **Missing** | None. | — | Later | P3 |
| BP-214 | §25 | Drill-down Group → Entity → Division → Location → Plant → Department → Section → Employee | **Partial** | Entity/plant/department filters; no division/section level. | RQ-RPT-004 | Later | P2 |
| BP-220 | §26 | Internal AI assistant (HR queries, policy search, requests, reports, exception analysis) | **Missing** | None. | — | Later | P3 |
| BP-221 | §26 | AI recruitment (resume parsing, JD match, ranking, duplicates, interview questions, rediscovery) | **Missing** | None. | — | Later | P3 |
| BP-222 | §26 | Predictive analytics (attrition risk, absenteeism, retirement, skill gaps, hiring, critical-position risk), advisory only | **Missing** | Burnout index KPI only (RQ-RPT-116). | — | Later | P3 |
| BP-230 | §27 | Approvals: sequential, parallel, conditional, amount-, grade-, plant- and department-based | **Partial** | workflow-definition.ts: sequential steps; approver = RM / FM / department_head / role / user; no parallel, condition or amount routing; plant-head step missing (RQ-WF-011). | RQ-WF-001, RQ-WF-011 | Core | P1 |
| BP-231 | §27 | Delegation, escalation, SLA, reminders, reject, send-back, rework, cancel, withdraw | **Partial** | /workflows/delegations, /escalate, onBreach, resubmit, send-back; reminders and generic withdraw not uniform. | RQ-WF-002..004 | Core | P1 |
| BP-232 | §27 | Workflows configurable by HR admins without code | **Done** | /admin/workflows edits chain data (GET/PUT /workflows/definitions/{code}); conditions not configurable. | RQ-WF-001 | Core | P2 |
| BP-240 | §28 | RBAC: Super Admin, Group HR, Legal Entity HR, Plant HR, Department HR, Manager, Employee, Payroll, Finance, Auditor | **Partial** | Roles: employee, manager, hod, hr_ops, hr_head, payroll_admin, plant_head, ceo_cell, it_admin, super_admin; entity/plant HR via hr_ops scope; no Finance or read-only Auditor role. | RQ-RBAC-001, RQ-RBAC-008 | Core | P1 |
| BP-241 | §28 | Security: encryption, MFA, SSO, audit logs, session control, password policy, IP/device controls, backups, DR, data masking | **Partial** | Audit hash chain, sessions page, password history, backup/restore scripts, masking; sec.mfa_enrolments table but no MFA API/UI; no SSO, no IP allow-list (except Kent webhook); PII encryption is a plan (PII_ENCRYPTION_PLAN.md). | RQ-NFR-004, RQ-NFR-009 | Core | P1 |
| BP-242 | §28 | Restricted access to Aadhaar, PAN, bank, salary, disciplinary and POSH data | **Partial** | Statutory masking by permission (employees.service.ts statutoryMasked); compensation gate; medical data (new from joining form) has no home or permission. | RQ-NFR-004, RQ-RBAC-006 | Core | P0 |
| BP-250 | §29 | Integrations: ERP/SAP, biometric, banks, PF/ESI, email, SMS, WhatsApp, Teams, job portals, BGV, identity providers | **Partial** | SAP JV export, Kent adapter, bank file, ECR/ESIC files, SMTP (notifications.service.ts); no SMS/WhatsApp/Teams/job portals/BGV/IdP. | RQ-WF-006 | Core | P1 |
| BP-251 | §29 | REST APIs, webhooks, SFTP, JSON/XML, OAuth 2.0 | **Partial** | REST/OpenAPI (oRPC); inbound Kent webhook + CSV drop; no outbound webhooks or OAuth2 client credentials. | — | Later | P2 |
| BP-260 | §30 | Recommended stack: React/Next + TS, Flutter mobile, Java/Spring or .NET backend, PostgreSQL, Redis, OpenSearch, AWS/Azure, object storage, Power BI | **Partial** | React + TS, PostgreSQL 17 as recommended; backend is Node/TypeScript (not Java/.NET); local-disk storage; no Redis/OpenSearch; mobile plan is PWA + Capacitor (MOBILE_RECOMMENDATION.md), not Flutter. Deviation needs an owner decision, not a rewrite. | — | Later | P3 |
| BP-261 | §30 | Modular architecture: API gateway, auth, business services, integration layer, monitoring | **Partial** | Modular monolith (backend/src/modules/*), /health/ready, request IDs, structured logs; no gateway/APM. | RQ-NFR-008 | Later | P2 |
| BP-270 | §31 | Plant-wise and shift-wise manpower | **Partial** | Muster/team grid by plant; att.coverage_targets table; no shift-wise manpower dashboard. | RQ-RPT-006 | Core | P2 |
| BP-271 | §31 | Contractor manpower and labour compliance (CLRA: agency, licence, wage register, compliance) | **Missing** | Only category=contract; no contractor/agency master or contract-labour registers. | — | Later | P2 |
| BP-272 | §31 | Trainee/apprentice tracking | **Partial** | Categories trainee/apprentice; apprentice stipend rules (RQ-PAY-015); no apprenticeship contract/term tracking. | RQ-PAY-015 | Core | P2 |
| BP-273 | §31 | Medical fitness, PPE, safety training, certification expiry | **Partial** | doc.types medical_fitness (blue_collar) without upload; PPE only as an asset category; no safety-training or certificate-expiry records. | — | Later | P2 |
| BP-280 | §32 | Daily automation: attendance processing, missing-punch alerts, joining reminders, exit reminders | **Partial** | Kent sync every 5 min + recompute queue, daily 07:00 boarding/exit mail, probation alerts; employee missing-punch alert not found. | RQ-ATT-022, RQ-LC-006 | Core | P1 |
| BP-281 | §32 | Weekly vacancy, HR-pending and contractor-compliance reports | **Missing** | None scheduled. | — | Later | P3 |
| BP-282 | §32 | Monthly payroll, compliance, attendance, headcount, attrition, training reports (scheduled) | **Partial** | Reports exist on demand; no scheduler/subscription. | RQ-RPT-007 | Later | P2 |
| BP-283 | §32 | Yearly appraisal, increment, bonus, compliance calendar, training plan | **Partial** | increment-batch, bonus-trueup, cmp.calendar_items; no appraisal/training. | RQ-PAY-020, RQ-PAY-021 | Later | P2 |
| BP-284 | §32 | Notification channels: in-app, e-mail, SMS, WhatsApp, push | **Partial** | In-app (wf.notifications) + SMTP; no SMS/WhatsApp/push. | RQ-WF-006 | Core | P1 |
| BP-290 | §33 | Admin configuration of org, employees, roles, permissions, workflows, forms, fields, reports, notifications, payroll/attendance/leave/statutory rules, templates, integrations | **Partial** | /admin/org-masters, users, workflows, settings, masters, payroll/settings, letters/templates; no form/field/notification-template admin. | RQ-CORE-022 | Core | P2 |
| BP-291 | §33 | No-code form builder and report builder | **Missing** | None. | — | Later | P3 |
| BP-300 | §34 | Core entity set (legal_entity … import_batch, API log) | **Partial** | Present: companies, locations, plants, departments, designations, grades, cost_centers, employees, employee_family, documents, employee_history, transfers, employee_salaries, salary_components, attendance (att.*), shifts, rosters, leave (lv.*), overtime, payroll runs/items/lines, arrears, fnf, onboarding, candidates, claims, travel, assets, compliance (cmp.*), grievance (schema), helpdesk, surveys, workflow, notifications, audit_log, bulk_jobs. Missing: division, section, job_family, job_level, position, profit centre, employee_address, employee_nominee (scheme-wise), employee_bank, employee_statutory, employee_education/experience, requisition, interview, offer, training, skill, competency, performance, goal, OKR, contractor, disciplinary_case, reward, api_log. | — | Later | P2 |
| BP-320 | §38 | Recommended HRMS menu (Dashboard … Audit, 29 items) | **Partial** | frontend/src/app/nav-config.ts has Dashboard/Home, People, Org masters, Recruitment (stub, API 404), Lifecycle (onboarding/probation/transfers/separation), My * (ESS), My Team/OT Decisions (MSS), Attendance, Leave, Payroll, TDS compliance, Loans, Claims, Travel, Letters, Policies, Assets, Helpdesk, Engagement, Reports, Executive, Users & Roles, Approval chains, Settings, Data imports, Audit log; missing Position & Manpower, Compensation, Performance, Learning, Skills, Rewards, Grievance, Disciplinary, Documents, Integration/API. | RQ-RBAC-012 | Later | P3 |

## Owner decisions surfaced
- D1: The blueprint recommends Java/.NET + Flutter; the build is Node/TypeScript + React (PWA → Capacitor). Recommend keeping the stack and recording the deviation (BP-260).
- D2: Is contract labour (CLRA agency workers) in HRMS scope at go-live, or only on-roll contract employees? (BP-271)
- D3: Should Performance/LMS/Skills (phase 5) be quoted as a post-go-live phase? They are not in the signed SOW.
- D4: Which roles approve exits: is "Business Head" = plant_head or a new role? Is "Finance approval" of F&F a new finance role? (BP-120, BP-240)
