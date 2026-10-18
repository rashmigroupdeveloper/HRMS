# RML Employee Joining Form (Doc RML/HR/02/01) → HRMS field map

Prepared Mon 19 Oct 2026 ~02:40 IST against `main` @ a67c6b3 (worktree /workspace/wt/reqs; schema read from a fresh DB `hrms_reqs` migrated with main's 69 migrations). Read-only analysis; no app code changed.

Sources read in full: `owner-docs/01M58B55M8EBRDJ5YK5NGGNST6.pdf` (4 pp), `01M58B55KV662P6W6A5TZMMYDY.pdf` (6 pp), `01M58B55R5SSDT3Y2E6KV1ST06.pdf` (10 pp), each also rendered with pdftoppm to check layout. Code read: `backend/migrations/*`, `backend/src/modules/bulk/employee-master.router.ts` (POST/PATCH /employees), `bulk/importers/employees.ts`, `employees/employees.router.ts` (profile output), `employees/family.*`, `lifecycle/onboarding/*` (prejoin schema, convert), `frontend/src/pages/lifecycle/PrejoinPortalPage.tsx` + `prejoin-form.ts`, `pages/people/EmployeeFormDrawer.tsx`, `ProfilePage.tsx`, `FamilyPanel.tsx`.

## 1. The three PDFs are one form in three packs (not entity or role variants)

All three carry the same title, the same doc no. RML/HR/02/01, the same Rashmi Group logo and photo box, and byte-identical text for pages 1–4. The Word source is "Employee Joining Form New Version - Rashmi Group" (created 04 Sep 2026 13:47 IST). None names a legal entity or a role; "Company Name" is a blank line, so the same form is used for every entity and category. They differ only in the annexures appended:

| Variant | File | Pages | Contents | Use (inferred) |
|---|---|---|---|---|
| **A: base** | 01M58B55M8EBRDJ5YK5NGGNST6.pdf | 4 | §1 official · §2 personal · §3 addresses · §4 statutory + one nominee · §5 bank · §6 education · §7 certifications · §8 previous employment · "6" family (numbered 6 again, a numbering defect) · §9 emergency contact · §10 declaration + signature · §11 HR office-use checklist | Earliest export (created and modified 13:47) |
| **B: base + medical** | 01M58B55KV662P6W6A5TZMMYDY.pdf | 6 | A + 2-page **Employee Medical Information** (self and family history, medications, limitations, surgeries, allergies, height/weight/BMI, lifestyle, emergency medical needs, sports) | Edited 16:37; probably the white-collar/office pack |
| **C: full statutory pack** | 01M58B55R5SSDT3Y2E6KV1ST06.pdf | 10 | A + **Form F** gratuity nomination (Payment of Gratuity Rules r.6(1), 2 pp, incl. statement, witnesses, employer certificate, acknowledgement) + **ESIC Declaration Form-1** (bilingual Hindi/English, with temporary identity card) + **EPF Form 11** (new, with present-employer declaration) + the same medical pages | Edited 16:33; probably the plant/ESIC-covered (blue-collar) joiner pack, or simply the complete pack |

So HRMS must hold the **superset** (variant C). The annexures are statutory forms, so they should come out of the system as pre-filled PDFs. They should not be re-keyed. Which pack applies to which category (for example ESIC Form-1 only when gross ≤ ₹21,000) is an owner decision. See Q1 at the end.

Defects in the form itself, worth passing to RML HR: the family section is numbered "6." after §8 (so §6 appears twice); the base form has one nominee line, but Form F / ESIC / EPF each need their own scheme nominations; medical-page numbering skips (5, 7, 8); and §2 "Other" marital status doesn't match EPF's Widow/Widower/Divorcee.

## 2. Counts

Status: **EXISTS** = stored, captured on a joining path (prejoin portal or HR create/edit) and shown; **PARTIAL** = stored but not capturable on the joining path / not shown / only post-joining; **WRONG** = exists but wrong type, options or validation (or data dropped); **MISSING** = nothing in schema, API or UI.

| Scope | Counts |
|---|---|
| **All fields (A+B+C)** | EXISTS 36 · PARTIAL 28 · WRONG 27 · MISSING 79 · total 170 |
| Base form (A, pp 1–4) incl. documents checklist | EXISTS 21 · PARTIAL 20 · WRONG 22 · MISSING 42 · total 105 |
| Medical annexure (B, C) | EXISTS 0 · PARTIAL 1 · WRONG 0 · MISSING 15 · total 16 |
| Statutory annexures (C: Form F, ESIC-1, EPF-11) | EXISTS 15 · PARTIAL 7 · WRONG 5 · MISSING 22 · total 49 |

**Mapped 170 fields: 36 fully exist, 28 partial, 27 wrong type/validation, 79 missing.**

## 3. Highest-impact findings (code-verified)

1. **Onboarding conversion bypasses the master validation.** `lifecycle/onboarding/onboarding.service.ts` inserts straight into `core.employees`. The prejoin schema (`prejoin-schema.ts`) checks only lengths (PAN 10, Aadhaar 12, IFSC 11, account ≥ 8). The PAN format, Aadhaar Verhoeff, UAN/ESIC/Aadhaar duplicate, 9–18-digit account and 18+ minor checks that POST /employees runs (via `bulk/importers/employees.ts`) are skipped. The duplicate check covers e-mail/mobile/PAN only. This is the main joining path, so bad statutory data reaches payroll.
2. **Emergency-contact relationship is collected and then thrown away.** The prejoin field is required, but there is no column and conversion doesn't map it.
3. **Gender is never set for portal joiners.** The candidate has no gender, the prejoin doesn't ask, and conversion leaves it NULL. That breaks ESIC/maternity/PT/statutory forms. The API enum also says "Other" where the forms say "Transgender".
4. **The HR create/edit API (POST/PATCH /employees) can't set** personal e-mail, marital status, blood group, addresses, emergency contact or plant. Those are only ever set by prejoin conversion, so HR can neither key a walk-in joiner's form nor correct these fields.
5. **No repeating sections at all:** education, certifications, previous employment. No tables, APIs or UI (RQ-CORE-024).
6. **Addresses are free text.** No PIN/district/state/country, so state-based PT/LWF and ESIC/EPF/Form F address blocks can't be produced.
7. **Nomination isn't scheme-specific.** One `is_nominee` + share on `employee_family` is used for everything; Form F (gratuity), EPF Form 2, ESIC s.71 need separate nominations, nominee address and witnesses.
8. **EPF Form 11 history is missing:** earlier EPF/EPS member, member before 01-Sep-2014, previous PF no., exit date, withdrawals, international worker. This is **payroll-critical**: EPS eligibility for new members joining after 01-Sep-2014 with PF wages > ₹15,000 can't be decided.
9. **No document upload anywhere for employees or candidates.** `core.documents` / `doc.types` (pan, aadhaar, appointment, medical_fitness) exist, but there's no upload/verify API and the Profile "Documents" tab only links to letters. The photo can't be uploaded either.
10. **No declaration/consent or signature capture** on the prejoin submit (§10, EPF undertaking, ESIC declaration). `prv.consents` exists but isn't wired.
11. **No medical questionnaire.** This is sensitive health data, so it needs its own restricted table and consent.
12. **HR office-use checklist is partial:** no BGV status, no "payroll updated" task, and no HR sign-off.

## 4. Field-by-field map

Forms column: ALL = in all three variants; B,C = medical annexure; C = statutory pack only.

| # | Section | Form field | Form type / options | HRMS today (table.column / API / screen) | Status | Gap / note | Forms |
|---|---|---|---|---|---|---|---|
| 1 | H Header | Company name | text | core.employees.company_id; POST /employees companyCode; EmployeeFormDrawer "Company" | **EXISTS** | Entity picked from core.companies. | ALL |
| 2 | H Header | Location (header) | text | core.employees.location_id / plant_id | **EXISTS** | Same as Work location; plant_id not settable from create/edit API (only location). | ALL |
| 3 | H Header | Form date | date | core.onboarding_candidates.prejoin_completed_at | **PARTIAL** | Timestamp of portal submission only; no form date for HR-keyed joiners (EmployeeFormDrawer). | ALL |
| 4 | H Header | Photograph (box on p.1; ESIC needs 2 photos) | image | core.employees.photo_path | **PARTIAL** | Column exists; no upload API or UI anywhere (prejoin, profile, HR form). | ALL |
| 5 | 1 Official / employment | Employee name | text | first_name,last_name; prejoin full_name split on first space | **EXISTS** | Conversion splits candidate full_name at first space; no "name as per Aadhaar" (EPF Form 11 item 1). | ALL |
| 6 | 1 Official / employment | Employee code | auto | core.employees.ecode (per-entity series) | **EXISTS** | Allocated on create/convert. | ALL |
| 7 | 1 Official / employment | Designation | master | designation_id; API designation | **EXISTS** |  | ALL |
| 8 | 1 Official / employment | Department | master | department_id; API department | **EXISTS** |  | ALL |
| 9 | 1 Official / employment | Date of joining | date | doj; API doj | **EXISTS** |  | ALL |
| 10 | 1 Official / employment | Work location | master | location_id; API location | **EXISTS** |  | ALL |
| 11 | 1 Official / employment | Employment type: Permanent / Contract / Trainee / Consultant | enum(4) | category enum (white_collar,blue_collar,trainee,consultant,contract) + contract_type enum (permanent,temporary,probationary,consultant,fixed_term,apprentice) | **WRONG** | Form has ONE field; HRMS splits it across two enums with overlapping values (consultant in both; "Permanent" only in contract_type, "Contract"/"Trainee" only in category). Conversion hard-codes contract_type=probationary. Blueprint also wants Regular/Fixed-term/Apprentice/Intern/other configurable. Needs one documented mapping + intern. | ALL |
| 12 | 1 Official / employment | Grade / level | master | grade_id; API grade | **EXISTS** |  | ALL |
| 13 | 2 Personal | Father's name | text | — | **MISSING** | Needed on EPF Form 11, ESIC Form-1, Gratuity Form F; no column, API or UI. | ALL |
| 14 | 2 Personal | Date of birth | date | dob; API dob (18+ on DOJ check) | **EXISTS** | Minor check is in the importer/create path only — prejoin→convert path does not run it. | ALL |
| 15 | 2 Personal | Gender: Male / Female / Transgender | enum(3) | gender text; API enum Male/Female/Other | **WRONG** | Label must read "Transgender" (EPF/ESIC wording). Prejoin portal does not collect gender at all and conversion leaves gender NULL (breaks ESIC/maternity/PT rules). | ALL |
| 16 | 2 Personal | Marital status: Single / Married / Other | enum(3) | marital_status text | **PARTIAL** | Column + profile display only; not in POST/PATCH /employees, not in prejoin. EPF needs Single/Married/Widow/Widower/Divorcee; ESIC M/U/W. | ALL |
| 17 | 2 Personal | Spouse's name | text | core.employee_family (relation=spouse) | **PARTIAL** | Only as a family row after joining; not on the joining capture. | ALL |
| 18 | 2 Personal | Marriage date | date | — | **MISSING** |  | ALL |
| 19 | 2 Personal | Country of origin | text | — | **MISSING** | EPF Form 11 item 10 (international worker). | ALL |
| 20 | 2 Personal | Nationality | text | — | **MISSING** |  | ALL |
| 21 | 2 Personal | Caste | text | — | **MISSING** | Sensitive (DPDP); store optional + restricted. | ALL |
| 22 | 2 Personal | Religion | text | — | **MISSING** | Also on Gratuity Form F statement. | ALL |
| 23 | 2 Personal | Height | number | — | **MISSING** | Also on medical page. | ALL |
| 24 | 2 Personal | Weight | number | — | **MISSING** | Also on medical page. | ALL |
| 25 | 2 Personal | Physically disabled: Yes / No | bool | — | **MISSING** | Drives PT exemption (state rules), 80U/TDS, EPF/ESIC PwD flags. | ALL |
| 26 | 2 Personal | Blood group | enum | blood_group; prejoin bloodGroup | **PARTIAL** | Captured in prejoin and shown on profile; not editable by HR (not in POST/PATCH /employees). | ALL |
| 27 | 2 Personal | Identification mark | text | — | **MISSING** |  | ALL |
| 28 | 2 Personal | Personal e-mail ID | email | personal_email; candidate personal_email | **PARTIAL** | Set from candidate on conversion; not in POST/PATCH /employees (HR-keyed joiners cannot record it). | ALL |
| 29 | 2 Personal | Mobile no. | text | mobile; API mobile (10-digit) | **EXISTS** | Prejoin cannot change it (comes from ATS/candidate). | ALL |
| 30 | 2 Personal | Passport no. | text | — | **MISSING** | EPF Form 11 item 10c/10d needs number + validity. | ALL |
| 31 | 2 Personal | Driving licence no. | text | — | **MISSING** | Relevant for drivers/plant vehicle operators. | ALL |
| 32 | 3 Address | Present / communication address — House/flat no | text | core.employees.present_address (single free-text, min 5 chars in prejoin) | **WRONG** | Stored as one unstructured string; no PIN (6-digit) / state validation; state cannot drive PT/LWF; not editable via POST/PATCH /employees. | ALL |
| 33 | 3 Address | Present / communication address — Locality | text | core.employees.present_address (single free-text, min 5 chars in prejoin) | **WRONG** | see row above | ALL |
| 34 | 3 Address | Present / communication address — City / village | text | core.employees.present_address (single free-text, min 5 chars in prejoin) | **WRONG** | see row above | ALL |
| 35 | 3 Address | Present / communication address — District | text | core.employees.present_address (single free-text, min 5 chars in prejoin) | **WRONG** | see row above | ALL |
| 36 | 3 Address | Present / communication address — State | text | core.employees.present_address (single free-text, min 5 chars in prejoin) | **WRONG** | see row above | ALL |
| 37 | 3 Address | Present / communication address — Country | text | core.employees.present_address (single free-text, min 5 chars in prejoin) | **WRONG** | see row above | ALL |
| 38 | 3 Address | Present / communication address — PIN | 6-digit | core.employees.present_address (single free-text, min 5 chars in prejoin) | **WRONG** | see row above | ALL |
| 39 | 3 Address | Permanent address — House/flat no | text | core.employees.permanent_address (single free-text, min 5 chars in prejoin) | **WRONG** | Stored as one unstructured string; no PIN (6-digit) / state validation; state cannot drive PT/LWF; not editable via POST/PATCH /employees. | ALL |
| 40 | 3 Address | Permanent address — Locality | text | core.employees.permanent_address (single free-text, min 5 chars in prejoin) | **WRONG** | see row above | ALL |
| 41 | 3 Address | Permanent address — City / village | text | core.employees.permanent_address (single free-text, min 5 chars in prejoin) | **WRONG** | see row above | ALL |
| 42 | 3 Address | Permanent address — District | text | core.employees.permanent_address (single free-text, min 5 chars in prejoin) | **WRONG** | see row above | ALL |
| 43 | 3 Address | Permanent address — State | text | core.employees.permanent_address (single free-text, min 5 chars in prejoin) | **WRONG** | see row above | ALL |
| 44 | 3 Address | Permanent address — Country | text | core.employees.permanent_address (single free-text, min 5 chars in prejoin) | **WRONG** | see row above | ALL |
| 45 | 3 Address | Permanent address — PIN | 6-digit | core.employees.permanent_address (single free-text, min 5 chars in prejoin) | **WRONG** | see row above | ALL |
| 46 | 3 Address | "Same as present" option | ui | PrejoinPortalPage.tsx | **MISSING** | Convenience only. | ALL |
| 47 | 4 Statutory | PAN / TPIN | AAAAA9999A | pan; API pan (format+duplicate); prejoin pan | **WRONG** | Importer/create path validates format + duplicates. Prejoin only checks length 10, and convert inserts without format/Verhoeff checks (duplicate check covers email/mobile/PAN only). | ALL |
| 48 | 4 Statutory | Aadhaar no. | 12 digits | aadhaar; API (Verhoeff + duplicate); prejoin aadhaar | **WRONG** | Prejoin: length 12 only; conversion path skips Verhoeff and Aadhaar-duplicate checks. | ALL |
| 49 | 4 Statutory | UAN no. | 12 digits | uan; API (format + duplicate); prejoin uan optional | **WRONG** | Prejoin: no format check; conversion skips UAN-duplicate check. | ALL |
| 50 | 4 Statutory | ESIC no. | 10 digits | esic_ip_number; API esicNo | **PARTIAL** | HR create/edit only; not in prejoin (new joiners rarely have one; previous IP no. needed — ESIC Form-1 item 12a). | ALL |
| 51 | 4 Statutory | Nominee name | text | core.employee_family.is_nominee (FamilyPanel, /employees/{ecode}/family) | **PARTIAL** | Exists post-joining; candidate cannot enter it in prejoin. | ALL |
| 52 | 4 Statutory | Relationship with nominee | enum | employee_family.relation (spouse,son,daughter,father,mother,father_in_law,mother_in_law,brother,sister,other) | **EXISTS** |  | ALL |
| 53 | 5 Bank | Bank name | text | bank_name; API + prejoin | **EXISTS** |  | ALL |
| 54 | 5 Bank | Branch | text | — | **MISSING** |  | ALL |
| 55 | 5 Bank | Account holder name | text | — | **MISSING** | Needed for name-match/penny-drop before first salary credit; joint/third-party accounts undetectable. | ALL |
| 56 | 5 Bank | Account no. | 9–18 digits | bank_account; API (9–18 digits); prejoin min 8 | **WRONG** | Prejoin accepts 8 chars incl. letters; conversion does not re-validate. | ALL |
| 57 | 5 Bank | IFSC code | AAAA0XXXXXX | bank_ifsc; API (format); prejoin length 11 | **WRONG** | Prejoin/convert: length-only check. | ALL |
| 58 | 5 Bank | Account type: Savings / Current | enum(2) | — | **MISSING** | Prejoin label hard-codes "Savings Bank Account Number". | ALL |
| 59 | 6 Education (repeating) | Qualification | grid row | — | **MISSING** | No employee_education table/API/UI. | ALL |
| 60 | 6 Education (repeating) | Institute / university | grid row | — | **MISSING** | No employee_education table/API/UI. | ALL |
| 61 | 6 Education (repeating) | Year of passing | grid row | — | **MISSING** | No employee_education table/API/UI. | ALL |
| 62 | 6 Education (repeating) | Specialization | grid row | — | **MISSING** | No employee_education table/API/UI. | ALL |
| 63 | 6 Education (repeating) | % / CGPA | grid row | — | **MISSING** | No employee_education table/API/UI. | ALL |
| 64 | 7 Additional certification (repeating) | Certification name | grid row | — | **MISSING** | No certification table; blueprint §31 also needs certificate expiry alerts. | ALL |
| 65 | 7 Additional certification (repeating) | Issuing organization / institute | grid row | — | **MISSING** | No certification table; blueprint §31 also needs certificate expiry alerts. | ALL |
| 66 | 7 Additional certification (repeating) | Date of certification | grid row | — | **MISSING** | No certification table; blueprint §31 also needs certificate expiry alerts. | ALL |
| 67 | 7 Additional certification (repeating) | Specialization | grid row | — | **MISSING** | No certification table; blueprint §31 also needs certificate expiry alerts. | ALL |
| 68 | 7 Additional certification (repeating) | Grade / score | grid row | — | **MISSING** | No certification table; blueprint §31 also needs certificate expiry alerts. | ALL |
| 69 | 8 Previous employment (repeating) | Employer name | grid row | onboarding_candidates.previous_company (single value, not carried to employee) | **PARTIAL** | Only the latest employer, candidate-side only (RQ-CORE-024). | ALL |
| 70 | 8 Previous employment (repeating) | Designation | grid row | — | **MISSING** | No employee_experience table/API/UI. | ALL |
| 71 | 8 Previous employment (repeating) | From | grid row | — | **MISSING** | No employee_experience table/API/UI. | ALL |
| 72 | 8 Previous employment (repeating) | To | grid row | — | **MISSING** | No employee_experience table/API/UI. | ALL |
| 73 | 8 Previous employment (repeating) | Reason for leaving | grid row | — | **MISSING** | No employee_experience table/API/UI. | ALL |
| 74 | "6" Family details (form numbers it 6 again — doc defect) | Name of family member | text | employee_family.name | **EXISTS** | Post-joining only (ESS request → HR approval; HR direct). Not in prejoin. | ALL |
| 75 | "6" Family details (form numbers it 6 again — doc defect) | Age | derived | from employee_family.dob | **EXISTS** | Derived; DOB optional so age can be blank. | ALL |
| 76 | "6" Family details (form numbers it 6 again — doc defect) | Gender | enum | — | **MISSING** | Needed for ESIC family + medical insurance. | ALL |
| 77 | "6" Family details (form numbers it 6 again — doc defect) | Date of birth | date | employee_family.dob | **EXISTS** |  | ALL |
| 78 | "6" Family details (form numbers it 6 again — doc defect) | Aadhaar no. | 12 digits | employee_family.aadhaar (masked on read) | **EXISTS** |  | ALL |
| 79 | "6" Family details (form numbers it 6 again — doc defect) | Any pre-existing disease | text | — | **MISSING** | Health data: restricted access. | ALL |
| 80 | "6" Family details (form numbers it 6 again — doc defect) | Relation | enum | employee_family.relation | **EXISTS** |  | ALL |
| 81 | 9 Emergency contact | Name | text | emergency_contact_name; prejoin | **PARTIAL** | Not editable via POST/PATCH /employees. | ALL |
| 82 | 9 Emergency contact | Relationship | text | prejoin emergencyContactRelation → DROPPED | **WRONG** | Collected (required) on the prejoin portal but there is no column; conversion silently discards it — data loss. | ALL |
| 83 | 9 Emergency contact | Mobile no. | text | emergency_contact_phone; prejoin (min 10 chars) | **PARTIAL** | No digit validation; not editable via API. | ALL |
| 84 | 9 Emergency contact | Alternate contact no. | text | — | **MISSING** |  | ALL |
| 85 | 9 Emergency contact | Address | text | — | **MISSING** |  | ALL |
| 86 | 10 Employee declaration | Declaration text acceptance (truth + consent to verification) | checkbox | prv.consents exists (DPDP) but not wired to prejoin | **MISSING** | Prejoin submit has no declaration/consent checkbox; no record of what text was accepted, when, from which IP. | ALL |
| 87 | 10 Employee declaration | Employee signature | e-sign / image | — | **MISSING** | Blueprint §3 wants signature in the master; no capture. | ALL |
| 88 | 10 Employee declaration | Declaration date | date | prejoin_completed_at | **PARTIAL** | Implicit only. | ALL |
| 89 | 11 For HR / office use | Joining formalities completed Y/N | bool | onboarding_candidates.status=converted | **PARTIAL** | Implied by conversion; no explicit checklist sign-off. | ALL |
| 90 | 11 For HR / office use | Employee master created Y/N | bool | onboarding_candidates.employee_id | **EXISTS** |  | ALL |
| 91 | 11 For HR / office use | Payroll updated Y/N | bool | pay.employee_salaries row; convert salaryStructureId optional | **PARTIAL** | No onboarding task for payroll; joiner can be active with no salary assigned. | ALL |
| 92 | 11 For HR / office use | ID card / access created Y/N | bool | core.onboarding_tasks admin_id_card | **EXISTS** |  | ALL |
| 93 | 11 For HR / office use | Background verification initiated Y/N/NA | enum(3) | — | **MISSING** | No BGV status/task/vendor integration. | ALL |
| 94 | 11 For HR / office use | Induction scheduled Y/N | bool | onboarding_tasks hr_induction | **EXISTS** | Task merges induction with document verification; no scheduled date. | ALL |
| 95 | 11 For HR / office use | Name of HR representative | text | onboarding task done_by / audit actor | **PARTIAL** |  | ALL |
| 96 | 11 For HR / office use | HR signature & date | sign | — | **MISSING** | No HR sign-off record on the joining file. | ALL |
| 97 | Documents checklist (implied by declaration, EPF "attach KYC", ESIC "2 photographs") | Photograph | upload | photo_path column, no upload | **PARTIAL** | photo_path column, no upload | ALL |
| 98 | Documents checklist (implied by declaration, EPF "attach KYC", ESIC "2 photographs") | PAN card | upload | doc.types pan seeded; no upload route for employee documents, none in prejoin | **PARTIAL** | doc.types pan seeded; no upload route for employee documents, none in prejoin | ALL |
| 99 | Documents checklist (implied by declaration, EPF "attach KYC", ESIC "2 photographs") | Aadhaar | upload | doc.types aadhaar seeded; no upload | **PARTIAL** | doc.types aadhaar seeded; no upload | ALL |
| 100 | Documents checklist (implied by declaration, EPF "attach KYC", ESIC "2 photographs") | Bank proof (cancelled cheque / passbook) | upload | no doc type | **MISSING** | no doc type | ALL |
| 101 | Documents checklist (implied by declaration, EPF "attach KYC", ESIC "2 photographs") | Education certificates | upload | — | **MISSING** |  | ALL |
| 102 | Documents checklist (implied by declaration, EPF "attach KYC", ESIC "2 photographs") | Experience / relieving letters, last payslips | upload | — | **MISSING** |  | ALL |
| 103 | Documents checklist (implied by declaration, EPF "attach KYC", ESIC "2 photographs") | Passport / driving licence | upload | — | **MISSING** |  | ALL |
| 104 | Documents checklist (implied by declaration, EPF "attach KYC", ESIC "2 photographs") | Medical fitness certificate | upload | doc.types medical_fitness (blue_collar) seeded; no upload | **PARTIAL** | doc.types medical_fitness (blue_collar) seeded; no upload | ALL |
| 105 | Documents checklist (implied by declaration, EPF "attach KYC", ESIC "2 photographs") | Document verification status per item | upload | core.documents.status column; no verify UI/API | **PARTIAL** | core.documents.status column; no verify UI/API | ALL |
| 106 | M Medical information (variants B and C only) | Self history checklist: asthma, diabetes, heart disease, high BP, epilepsy, mental health, allergies (specify), other (specify) | Y/N + text | — | **MISSING** | No medical/health questionnaire. Health data is sensitive personal data under DPDP: separate table, explicit consent, access limited to HR-medical/OHC, never to managers. | B,C |
| 107 | M Medical information (variants B and C only) | Currently taking medications? + list | Y/N + text | — | **MISSING** | No medical/health questionnaire. Health data is sensitive personal data under DPDP: separate table, explicit consent, access limited to HR-medical/OHC, never to managers. | B,C |
| 108 | M Medical information (variants B and C only) | Physical limitations affecting duties? + list | Y/N + text | — | **MISSING** | No medical/health questionnaire. Health data is sensitive personal data under DPDP: separate table, explicit consent, access limited to HR-medical/OHC, never to managers. | B,C |
| 109 | M Medical information (variants B and C only) | Surgeries / major treatment in last 5 years? + details | Y/N + text | — | **MISSING** | No medical/health questionnaire. Health data is sensitive personal data under DPDP: separate table, explicit consent, access limited to HR-medical/OHC, never to managers. | B,C |
| 110 | M Medical information (variants B and C only) | Known allergies? + specify | Y/N + text | — | **MISSING** | No medical/health questionnaire. Health data is sensitive personal data under DPDP: separate table, explicit consent, access limited to HR-medical/OHC, never to managers. | B,C |
| 111 | M Medical information (variants B and C only) | Current weight / height / BMI (BMI derived) | Y/N + text | — | **MISSING** | No medical/health questionnaire. Health data is sensitive personal data under DPDP: separate table, explicit consent, access limited to HR-medical/OHC, never to managers. | B,C |
| 112 | M Medical information (variants B and C only) | Family history: condition × family member (heart, diabetes, BP, cancer type, stroke, mental health, genetic, other) | Y/N + text | — | **MISSING** | No medical/health questionnaire. Health data is sensitive personal data under DPDP: separate table, explicit consent, access limited to HR-medical/OHC, never to managers. | B,C |
| 113 | M Medical information (variants B and C only) | Hereditary conditions affecting work? + specify | Y/N + text | — | **MISSING** | No medical/health questionnaire. Health data is sensitive personal data under DPDP: separate table, explicit consent, access limited to HR-medical/OHC, never to managers. | B,C |
| 114 | M Medical information (variants B and C only) | Condition needing unplanned leave (self/family)? + specify | Y/N + text | — | **MISSING** | No medical/health questionnaire. Health data is sensitive personal data under DPDP: separate table, explicit consent, access limited to HR-medical/OHC, never to managers. | B,C |
| 115 | M Medical information (variants B and C only) | Smoke / tobacco Y/N | Y/N + text | — | **MISSING** | No medical/health questionnaire. Health data is sensitive personal data under DPDP: separate table, explicit consent, access limited to HR-medical/OHC, never to managers. | B,C |
| 116 | M Medical information (variants B and C only) | Alcohol Y/N | Y/N + text | — | **MISSING** | No medical/health questionnaire. Health data is sensitive personal data under DPDP: separate table, explicit consent, access limited to HR-medical/OHC, never to managers. | B,C |
| 117 | M Medical information (variants B and C only) | Exercise regularly Y/N + frequency | Y/N + text | — | **MISSING** | No medical/health questionnaire. Health data is sensitive personal data under DPDP: separate table, explicit consent, access limited to HR-medical/OHC, never to managers. | B,C |
| 118 | M Medical information (variants B and C only) | Requires specific emergency medical care? + specify | Y/N + text | — | **MISSING** | No medical/health questionnaire. Health data is sensitive personal data under DPDP: separate table, explicit consent, access limited to HR-medical/OHC, never to managers. | B,C |
| 119 | M Medical information (variants B and C only) | Sports: tennis / paddle ball / badminton / football / basketball / others + frequency | Y/N + text | — | **MISSING** | No medical/health questionnaire. Health data is sensitive personal data under DPDP: separate table, explicit consent, access limited to HR-medical/OHC, never to managers. | B,C |
| 120 | M Medical information (variants B and C only) | Candidate signature, name, date | Y/N + text | — | **MISSING** | No medical/health questionnaire. Health data is sensitive personal data under DPDP: separate table, explicit consent, access limited to HR-medical/OHC, never to managers. | B,C |
| 121 | M Medical information (variants B and C only) | Emergency contact (repeat of §9) | text | see §9 | **PARTIAL** | Reuse §9. | B,C |
| 122 | F Gratuity nomination — Form F (variant C only) | Establishment name & full address | text | core.companies.name/address | **EXISTS** |  | C |
| 123 | F Gratuity nomination — Form F (variant C only) | Employee full name | text | first/last name | **EXISTS** |  | C |
| 124 | F Gratuity nomination — Form F (variant C only) | Nominee name with full address | grid | employee_family.name (no address) | **PARTIAL** | Nominee address missing. | C |
| 125 | F Gratuity nomination — Form F (variant C only) | Nominee relationship | grid | employee_family.relation | **EXISTS** |  | C |
| 126 | F Gratuity nomination — Form F (variant C only) | Nominee age | grid | derived from dob | **EXISTS** |  | C |
| 127 | F Gratuity nomination — Form F (variant C only) | Proportion of gratuity share | grid | employee_family.nominee_share_pct (≤100 total) | **WRONG** | One nominee flag/share for ALL schemes; PF (Form 2), gratuity (Form F), ESIC (u/s 71) and insurance nominations differ legally. Needs scheme-wise nomination. | C |
| 128 | F Gratuity nomination — Form F (variant C only) | Declarations 2–6 (family within s.2(h); no family; parents not dependent; husband excluded by notice dated…; invalidates previous) | checkbox | — | **MISSING** |  | C |
| 129 | F Gratuity nomination — Form F (variant C only) | Statement: sex, religion, marital status (unmarried/married/widow/widower) | mixed | gender / — / marital_status | **PARTIAL** | Religion missing; marital options differ. | C |
| 130 | F Gratuity nomination — Form F (variant C only) | Statement: department/branch/section, post held with ticket/serial no., date of appointment | mixed | department, designation, ecode, doj | **EXISTS** |  | C |
| 131 | F Gratuity nomination — Form F (variant C only) | Statement: permanent address — village, thana, sub-division, post office, district, state | structured | permanent_address (free text) | **WRONG** | Unstructured. | C |
| 132 | F Gratuity nomination — Form F (variant C only) | Witness declarations (2 names + signatures) | text/sign | — | **MISSING** |  | C |
| 133 | F Gratuity nomination — Form F (variant C only) | Employer certificate (verified & recorded, employer ref no., signatory, designation, date) | sign | — | **MISSING** |  | C |
| 134 | F Gratuity nomination — Form F (variant C only) | Employee acknowledgement of duplicate copy | sign | — | **MISSING** |  | C |
| 135 | F Gratuity nomination — Form F (variant C only) | Pre-filled Form F PDF output | output | letters engine (core.letter_templates) has no form_f template | **MISSING** |  | C |
| 136 | ESIC Declaration Form-1 (variant C only) | Insurance no. | 10 digits | esic_ip_number | **EXISTS** |  | C |
| 137 | ESIC Declaration Form-1 (variant C only) | Name (block letters) | text | first/last name | **EXISTS** |  | C |
| 138 | ESIC Declaration Form-1 (variant C only) | Father's / husband's name | text | — | **MISSING** |  | C |
| 139 | ESIC Declaration Form-1 (variant C only) | Date of birth | date | dob | **EXISTS** |  | C |
| 140 | ESIC Declaration Form-1 (variant C only) | Marital status M/U/W | enum | marital_status (no API capture) | **PARTIAL** |  | C |
| 141 | ESIC Declaration Form-1 (variant C only) | Sex M/F | enum | gender | **EXISTS** |  | C |
| 142 | ESIC Declaration Form-1 (variant C only) | Present & permanent address with PIN, phone/e-mail | structured | present/permanent_address free text | **WRONG** | No PIN field. | C |
| 143 | ESIC Declaration Form-1 (variant C only) | ESIC branch office & dispensary choice | text | — | **MISSING** | Required for IP registration. | C |
| 144 | ESIC Declaration Form-1 (variant C only) | Employer's code no., name & address | text | core.companies.esic_code/name/address | **EXISTS** | Plant-level ESIC sub-codes not modelled. | C |
| 145 | ESIC Declaration Form-1 (variant C only) | Date of appointment | date | doj | **EXISTS** |  | C |
| 146 | ESIC Declaration Form-1 (variant C only) | Previous employment: previous Ins. no., employer code, employer name & address, e-mail | text | — | **MISSING** |  | C |
| 147 | ESIC Declaration Form-1 (variant C only) | Nominee u/s 71 (name, relationship, address) for cash benefit on death | grid | employee_family.is_nominee (no address, not ESIC-specific) | **PARTIAL** |  | C |
| 148 | ESIC Declaration Form-1 (variant C only) | Family particulars: name, DOB/age, relationship | grid | employee_family + is_esic_dependent | **EXISTS** |  | C |
| 149 | ESIC Declaration Form-1 (variant C only) | Family: residing with employee Y/N; if no — town & state | grid | — | **MISSING** |  | C |
| 150 | ESIC Declaration Form-1 (variant C only) | IP declaration + signature/thumb impression; employer counter-signature with seal | sign | — | **MISSING** |  | C |
| 151 | ESIC Declaration Form-1 (variant C only) | Temporary identity card (photo, validity 3 months) | output | — | **MISSING** | Portal-generated (vendor/ESIC duty, RQ-SVC-002); HRMS should hold the PDF. | C |
| 152 | EPF Form 11 declaration (variant C only) | Name of member (as per Aadhaar) | text | first/last name | **PARTIAL** | No separate Aadhaar-name field; mismatch blocks UAN KYC. | C |
| 153 | EPF Form 11 declaration (variant C only) | Father's / spouse's name (tick which) | text | — | **MISSING** |  | C |
| 154 | EPF Form 11 declaration (variant C only) | Date of birth | date | dob | **EXISTS** |  | C |
| 155 | EPF Form 11 declaration (variant C only) | Gender Male/Female/Transgender | enum | gender (Male/Female/Other) | **WRONG** |  | C |
| 156 | EPF Form 11 declaration (variant C only) | Marital status Single/Married/Widow/Widower/Divorcee | enum(5) | marital_status (free text, no capture) | **WRONG** |  | C |
| 157 | EPF Form 11 declaration (variant C only) | E-mail; mobile (Aadhaar-registered) | text | personal_email, mobile | **PARTIAL** | No "Aadhaar-linked mobile" flag. | C |
| 158 | EPF Form 11 declaration (variant C only) | Earlier member of EPF 1952? Y/N | bool | — | **MISSING** |  | C |
| 159 | EPF Form 11 declaration (variant C only) | Earlier member of EPS 1995? Y/N | bool | — | **MISSING** |  | C |
| 160 | EPF Form 11 declaration (variant C only) | Previous UAN | 12 digits | uan | **EXISTS** |  | C |
| 161 | EPF Form 11 declaration (variant C only) | Previous PF account no. | text | — (pf_number is current) | **MISSING** |  | C |
| 162 | EPF Form 11 declaration (variant C only) | Date of exit from previous employment | date | — | **MISSING** |  | C |
| 163 | EPF Form 11 declaration (variant C only) | Scheme certificate no. / PPO no. | text | — | **MISSING** |  | C |
| 164 | EPF Form 11 declaration (variant C only) | International worker Y/N; country of origin; passport no.; passport validity | mixed | — | **MISSING** | International workers have no PF wage ceiling — payroll rule needs this flag. | C |
| 165 | EPF Form 11 declaration (variant C only) | KYC: bank account + IFSC, Aadhaar, PAN | mixed | bank_account, bank_ifsc, aadhaar, pan | **EXISTS** |  | C |
| 166 | EPF Form 11 declaration (variant C only) | First EPF enrolled date; first employment EPF wages | date/number | — | **MISSING** |  | C |
| 167 | EPF Form 11 declaration (variant C only) | EPF member before 01/09/2014? Y/N | bool | — | **MISSING** | PAYROLL-CRITICAL: a new member joining after 1-Sep-2014 with PF wages > ₹15,000 is not eligible for EPS; without this flag the engine cannot decide EPS 8.33% vs full 12% to EPF. | C |
| 168 | EPF Form 11 declaration (variant C only) | EPF withdrawn? EPS withdrawn? Post-Sep-2014 EPS withdrawn before joining? | bool×3 | — | **MISSING** |  | C |
| 169 | EPF Form 11 declaration (variant C only) | Undertaking (Aadhaar use for eKYC; transfer previous fund) | checkbox | — | **MISSING** |  | C |
| 170 | EPF Form 11 declaration (variant C only) | Employer declaration: PF no. allotted, KYC upload/approval status in UAN database, transfer request / Form-13 | mixed | pf_number only | **PARTIAL** | No KYC-status / transfer-request tracking. | C |

## 5. What it takes to close (for the fix / uiux jobs; filed in BUGS.md as REQ-0xx)

Backend (owner **fix**):
- Add a `core.employee_personal` extension (or columns): father_name, spouse_name, marriage_date, nationality, country_of_origin, religion, caste (restricted), height_cm, weight_kg, is_pwd + disability %, identification_mark, passport_no + validity, driving_licence_no + validity, name_as_per_aadhaar, aadhaar_linked_mobile, international_worker. Marital-status enum: single/married/widowed/divorced/separated. Gender enum: male/female/transgender.
- Add a structured `core.employee_addresses` table (type present|permanent; house, locality, city/village, post office, thana/police station, sub-division, district, state_code, country, PIN with 6-digit validation; "same as present"). Keep the legacy text columns derived for read compatibility.
- Add `employee_emergency_contacts` (name, relation, mobile, alternate, address; ≥ 1 required), and stop dropping the relation.
- Add `employee_education`, `employee_certifications` (+ expiry date, for blueprint §31) and `employee_experience` (employer, designation, from, to, reason, last CTC optional, PF/UAN of that employer). These are repeating grids in the API.
- Extend `employee_family` with gender, address, residing_with + town/state, pre-existing disease (restricted), occupation/dependent flag. Add an `employee_nominations` table per scheme (PF, EPS, gratuity, ESIC, GPA/GMC insurance), with shares that total 100 per scheme, nominee address and guardian for minors, a witness block for Form F, and a "supersedes previous" version.
- Add an EPF history block on the employee: prev_epf_member, prev_eps_member, member_before_2014_09_01, prev_pf_no, prev_exit_date, scheme_cert_no, ppo_no, first_epf_enrol_date, first_epf_wages, epf_withdrawn, eps_withdrawn, eps_withdrawn_post_2014. Wire it to the PF engine's EPS eligibility.
- Add an ESIC block: dispensary, branch office, previous IP no., previous employer code.
- Bank: branch, account_holder_name, account_type (savings|current), with name-match warning against the employee name.
- Route **prejoin conversion through the same validator as POST /employees**: PAN regex, Aadhaar Verhoeff, UAN 12, IFSC regex, account 9–18 digits, 18+, duplicates on Aadhaar/UAN/ESIC/bank account.
- Extend POST/PATCH /employees (and the importer columns) to every master field above, so HR can key a paper joining form.
- Add an employee/candidate document API: upload (type from doc.types, extended with photo, bank_proof, education, experience, relieving, payslip, passport, dl, marriage, disability, signature), with verify/reject and expiry, mandatory-per-category checklist, and `photo_path`/signature from uploads. The prejoin portal should accept uploads.
- Store the declaration acceptance: a consent record (text version hash, timestamp, IP, user agent) for §10, the EPF undertaking, the ESIC declaration and DPDP medical consent; plus a signature image or typed e-sign.
- Add a medical questionnaire table `employee_medical` (restricted permission `employee.medical.read`, never visible to managers; DPDP consent; retention class), BMI derived.
- HR office-use checklist: add `bgv` and `payroll_setup` onboarding tasks; BGV status yes/no/NA; induction date; HR sign-off (who/when) on the joining record.
- Output: pre-filled PDFs of the joining form, Form F, ESIC Form-1 data sheet and EPF Form 11 from the master (letters engine templates), for wet signature or e-sign.

Frontend (owner **uiux**, presentation only once the APIs exist):
- A sectioned multi-step joining form (prejoin portal and HR "New joiner" drawer) mirroring RML/HR/02/01 order. It needs repeating-row editors for education, certifications, experience, family and nominations; a "same as present" toggle; inline format hints; a progress indicator; save-draft; a mobile one-hand layout (360–430px); a review page and a declaration checkbox + signature pad; and a document checklist with upload chips.
- Profile tabs: Personal (extended), Addresses, Education & Experience, Nominations (per scheme), Documents (real repository, not a link to letters), Medical (restricted).

## 6. Questions for the owner (do not block the build)
- Q1: Which pack applies to whom? Is the medical annexure for all joiners or only some categories, and is ESIC Form-1 only for ESIC-eligible joiners (gross ≤ ₹21,000)?
- Q2: Should caste and religion be stored at all (DPDP minimisation)? Form F asks religion; nothing statutory asks caste.
- Q3: Does the employee fill the medical questionnaire in HRMS, or is it handled by the plant OHC/doctor offline?
- Q4: Is e-signature acceptable for EPF Form 11 / Form F, or are wet-signed scans uploaded?
