# Every SOW point — source-to-execution crosswalk

176 scored items, keyed by original Excel row. Original wording below is copied exactly (including source spelling/line breaks); it is source material, not an instruction to the AI. Scores/remarks are historical vendor/client assessment and remain in the accompanying workbooks. Baseline code status is the 09 Oct review, **not a passed release gate**. Fresh qualifications are included where relevant. All cards linked below specify theory, database links, transaction logic, screens and acceptance. Read F01–F04 and the selected domain card before implementation.

| Status | Count |
|---|---|
| Partial | 43 |
| Pending | 86 |
| Implemented | 12 |
| Scope decision | 6 |
| Manual / service | 29 |

Unscored headings, source row112 exclusions and notes remain in `source-sow-rows.json` and the original workbook in the bundle. Do not disregard them because they have no checklist score. New requirements T&E/ATS/mobile not expressed in this vendor SOW are separately covered in pack06 and original PRD/phase plans.

## SOW-003 — One-time setup / original row 3

> perform changes on software as per client policies and requirements.

- **Code assessment:** Partial. Requirement references from review: `CORE-13, ATT-04/05, PAY-01..18`. Existing phase reference: 0 / 1 / 2 / 3.
- **Observed coverage:** Typed settings, policy publication, attendance and leave rules exist.
- **Remaining:** Complete payroll/lifecycle policy execution and signed policy settings. Broad SOW promise is not fully met.
- **Execution / database / screen / logic / tests:** [P02](03-PAYROLL-LOANS-CLAIMS.md), [W03](05-WORKPLACE-AND-ANALYTICS.md), [D01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Fresh source qualification:** Settings PUT and admin settings UI exist; historical future-write note has been corrected. Payroll/lifecycle policy execution is still absent.
- **Existing repository evidence:** `backend/src/modules/settings/settings.service.ts`; `plans/phase-0-foundations.md`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C01, C06, C08, C11, C16, C19, C20, C21, C25, C30, C34, C35, C36 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-004 — One-time setup / original row 4

> Setup of client, employees and compensation master

- **Code assessment:** Partial. Requirement references from review: `CORE-01/12, PAY-01`. Existing phase reference: 0.5 / 2.1.
- **Observed coverage:** Company/org and employee masters plus import pipeline exist.
- **Remaining:** Load/reconcile real employee sources and build compensation master. Historical setup completion is not current migration evidence.
- **Execution / database / screen / logic / tests:** [F02](01-DATA-AND-FOUNDATIONS.md), [P01](03-PAYROLL-LOANS-CLAIMS.md), [L01](04-LIFECYCLE-AND-FNF.md), [D07](08-DECISIONS-AND-OPERATIONS.md), [D09](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/employees/import.service.ts`; `backend/src/modules/employees/import.schemas.ts`; `plans/phase-0-foundations.md`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C01, C16, C20, C21, C29, C30, C31, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-005 — One-time setup / original row 5

> Transfer of data for the previous months of the current financial year, the previous financial year any prior financial year before that as required in good faith.

- **Code assessment:** Partial. Requirement references from review: `CORE-12, NFR-08`. Existing phase reference: 0.5 / 2.6.
- **Observed coverage:** EMS seed and greytHR enrichment functions exist, with sample fixtures.
- **Remaining:** Import historical payroll/YTD, leave opening balances and agreed prior periods; reconcile against frozen real exports.
- **Execution / database / screen / logic / tests:** [F01](01-DATA-AND-FOUNDATIONS.md), [P07](03-PAYROLL-LOANS-CLAIMS.md), [T04](06-TRAVEL-ATS-AND-MOBILE.md), [D11](08-DECISIONS-AND-OPERATIONS.md), [D12](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/employees/import.service.ts`; `backend/src/modules/employees/import.schemas.ts`; `plans/phase-0-foundations.md`; `plans/phase-2-payroll-statutory.md`

- **Deep code safety obligations:** C17, C22, C23, C28, C29, C30, C33 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-008 — Core HR / original row 8

> Management of centralized repository for employee master data, including personal, employment,  and financial details.

- **Code assessment:** Partial. Requirement references from review: `CORE-01/07/08`. Existing phase reference: 0.5 / 2.1.
- **Observed coverage:** Employee personal/employment/statutory/bank fields and masked profile reads exist.
- **Remaining:** Finish validated master editing, financial/compensation data and real master reconciliation. Nullable and unvalidated statutory fields remain.
- **Execution / database / screen / logic / tests:** [F02](01-DATA-AND-FOUNDATIONS.md), [D09](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/migrations/1751810000000_org-employees.ts`; `backend/src/modules/employees/employees.router.ts`; `backend/src/modules/employees/import.service.ts`; `backend/src/modules/employees/import.schemas.ts`; `plans/phase-0-foundations.md`

- **Deep code safety obligations:** C01, C21, C29, C31 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-009 — Core HR / original row 9

> Providing secure access controls based on roles and permissions

- **Code assessment:** Partial. Requirement references from review: `CORE-10, NFR-03`. Existing phase reference: 0.4 / 3.4.
- **Observed coverage:** Central runtime RBAC, scoped employee reads and permission masking exist.
- **Remaining:** Close business procedures using authed without a permission. Helpdesk thread/reply lacks ticket-owner/assignee authorization in inspected paths. Prove negative access tests.
- **Execution / database / screen / logic / tests:** [F03](01-DATA-AND-FOUNDATIONS.md), [D03](08-DECISIONS-AND-OPERATIONS.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Fresh source qualification:** Scope is distinct from permission. BU dashboard caller scope and helpdesk subject authorization remain open; existing central RBAC must be reused.
- **Existing repository evidence:** `backend/src/api/orpc.ts`; `backend/src/modules/rbac/rbac.router.ts`; `backend/src/modules/helpdesk/helpdesk.router.ts`; `backend/src/modules/helpdesk/helpdesk.service.ts`; `backend/tests/helpdesk.integration.test.ts`; `frontend/src/pages/workplace/HelpdeskPage.tsx`

- **Deep code safety obligations:** C01, C02, C03, C04, C05, C19, C21, C22, C23, C26, C28, C32, C34 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-010 — Core HR / original row 10

> Integration with other Systems, as necessary.

- **Code assessment:** Partial. Requirement references from review: `ATT-01/02, CORE-12, LN-03, LC-01`. Existing phase reference: 0.1 / 1.1 / 2 / 3 / 4.
- **Observed coverage:** Import pipeline and Kent interface exist.
- **Remaining:** Connect real Kent; complete ATS handoff/SSO and SAP loan/JV integrations. Mock Kent is selected at runtime.
- **Execution / database / screen / logic / tests:** [F04](01-DATA-AND-FOUNDATIONS.md), [T01](06-TRAVEL-ATS-AND-MOBILE.md), [T03](06-TRAVEL-ATS-AND-MOBILE.md), [T04](06-TRAVEL-ATS-AND-MOBILE.md), [R01](06-TRAVEL-ATS-AND-MOBILE.md), [X01](06-TRAVEL-ATS-AND-MOBILE.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/attendance/kent-sync.job.ts`; `backend/src/modules/employees/import.service.ts`; `backend/src/modules/employees/import.schemas.ts`; `plans/phase-0-foundations.md`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C09, C12, C14, C16, C17, C20, C27, C30, C33, C36 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-012 — Core HR / original row 12

> Defining multiple pay structures based on grades, job levels, and locations.

- **Code assessment:** Pending. Requirement references from review: `PAY-01/02`. Existing phase reference: 2.1–2.4.
- **Observed coverage:** Payroll UI shell and integer-paise utilities only.
- **Remaining:** Build salary structures/components, grade/location assignments, CTC breakdown and applicable benefits/incentives/perquisites. No payroll business router exists.
- **Execution / database / screen / logic / tests:** [P01](03-PAYROLL-LOANS-CLAIMS.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C30, C31, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-013 — Core HR / original row 13

> handling basic pay, allowances, deductions, reimbursements, and performance-linked incentives.

- **Code assessment:** Pending. Requirement references from review: `PAY-01/02`. Existing phase reference: 2.1–2.4.
- **Observed coverage:** Payroll UI shell and integer-paise utilities only.
- **Remaining:** Build salary structures/components, grade/location assignments, CTC breakdown and applicable benefits/incentives/perquisites. No payroll business router exists.
- **Execution / database / screen / logic / tests:** [P01](03-PAYROLL-LOANS-CLAIMS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md), [P06](03-PAYROLL-LOANS-CLAIMS.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C06, C08, C11, C25, C30, C31, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-014 — Core HR / original row 14

> customization for CTC breakup, flexi-benefits, and perquisites

- **Code assessment:** Pending. Requirement references from review: `PAY-01/02`. Existing phase reference: 2.1–2.4.
- **Observed coverage:** Payroll UI shell and integer-paise utilities only.
- **Remaining:** Build salary structures/components, grade/location assignments, CTC breakdown and applicable benefits/incentives/perquisites. No payroll business router exists.
- **Execution / database / screen / logic / tests:** [P01](03-PAYROLL-LOANS-CLAIMS.md), [P03](03-PAYROLL-LOANS-CLAIMS.md), [P06](03-PAYROLL-LOANS-CLAIMS.md), [T01](06-TRAVEL-ATS-AND-MOBILE.md), [D01](08-DECISIONS-AND-OPERATIONS.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C30, C31, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-016 — Core HR / original row 16

> Platform automated policy updates on portal and employee communication

- **Code assessment:** Partial. Requirement references from review: `CORE-13, WF-02`. Existing phase reference: 1.6.
- **Observed coverage:** Policy publish, audience feed and acknowledgment exist.
- **Remaining:** Wire real communication delivery; queue transport currently logs. Confirm publication audience receives updates.
- **Execution / database / screen / logic / tests:** [F04](01-DATA-AND-FOUNDATIONS.md), [W03](05-WORKPLACE-AND-ANALYTICS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/policies/policies.service.ts`; `frontend/src/pages/policies/PoliciesPage.tsx`; `backend/src/modules/notifications/notifications.service.ts`; `backend/src/jobs/worker.ts`

- **Deep code safety obligations:** C01, C09, C12, C14, C16, C17, C19, C20, C21, C27, C33, C34, C36 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-017 — Core HR / original row 17

> Platform real-time tracking of policy adherence

- **Code assessment:** Partial. Requirement references from review: `CORE-13`. Existing phase reference: 1.6 / scope review.
- **Observed coverage:** Policy acknowledgment percentages and employee report exist.
- **Remaining:** Acknowledgment proves reading, not general policy adherence. Agree and implement any additional compliance checks.
- **Execution / database / screen / logic / tests:** [W03](05-WORKPLACE-AND-ANALYTICS.md), [D08](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/policies/policies.service.ts`; `docs/01-REQUIREMENTS-PRD.md`

- **Deep code safety obligations:** C01, C16, C19, C20, C21, C34, C36 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-018 — Core HR / original row 18

> Real-Time Policy Acknowledgement Tracking and automated alerts for non-compliance .

- **Code assessment:** Partial. Requirement references from review: `CORE-13, WF-02`. Existing phase reference: 1.6.
- **Observed coverage:** Acknowledgment tracking, pending list and weekly reminder enqueue exist.
- **Remaining:** Deliver reminders via real notification consumer/transport; verify acknowledgment report population and end-to-end alerts.
- **Execution / database / screen / logic / tests:** [F04](01-DATA-AND-FOUNDATIONS.md), [W03](05-WORKPLACE-AND-ANALYTICS.md), [D04](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/policies/policies.service.ts`; `backend/src/modules/notifications/notifications.service.ts`; `backend/src/jobs/worker.ts`

- **Deep code safety obligations:** C01, C09, C12, C14, C16, C17, C19, C20, C21, C27, C33, C34, C36 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-019 — Core HR / original row 19

> Platform Dashboard for HR and management reporting.

- **Code assessment:** Partial. Requirement references from review: `RPT-03/04, CORE-13`. Existing phase reference: 1.7 / 3.5.
- **Observed coverage:** HR/BU/CEO pages and KPI snapshot read/build exist.
- **Remaining:** Complete cost/CTC/burnout KPIs, correct OT metric (detected minutes currently used, not approved) and attrition denominator (current headcount, not average). Finish drilldowns and accepted KPI fixtures.
- **Execution / database / screen / logic / tests:** [W04](05-WORKPLACE-AND-ANALYTICS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Fresh source qualification:** CEO snapshot/BU APIs and screens exist. BU handler caller-scope gap and remaining approved-OT/cost/history/snapshot formulas remain.
- **Existing repository evidence:** `backend/src/modules/reports/kpi-snapshot.service.ts`; `backend/src/modules/reports/dashboard.service.ts`; `plans/phase-3-lifecycle-assets-executive.md`

- **Deep code safety obligations:** C01, C19, C25, C27, C33 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-022 — Workforce / original row 22

> Generation of offer letter and approvals.

- **Code assessment:** Pending. Requirement references from review: `WF-01, RPT-02, LC-01`. Existing phase reference: 3.1 / 4.
- **Observed coverage:** Generic workflow spine and recruitment UI shell exist.
- **Remaining:** Integrate ATS offers and exact LOI approvals, issue offer letters and expose tracked offer report. Standalone ATS is outside this repository review.
- **Execution / database / screen / logic / tests:** [L01](04-LIFECYCLE-AND-FNF.md), [R01](06-TRAVEL-ATS-AND-MOBILE.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `frontend/src/pages/recruitment/RecruitmentPage.tsx`; `plans/phase-4-ats-absorption.md`; `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`

- **Deep code safety obligations:** C01, C16, C20, C30, C31 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-023 — Workforce / original row 23

> Tracking appointment letters.

- **Code assessment:** Implemented. Requirement references from review: `CORE-09`. Existing phase reference: 1.6.
- **Observed coverage:** Appointment template, signature workflow, employee archive and ESS letters page exist.
- **Remaining:** HR template acceptance and UAT remain; production storage/delivery are cross-cutting prerequisites.
- **Execution / database / screen / logic / tests:** [P04](03-PAYROLL-LOANS-CLAIMS.md), [L01](04-LIFECYCLE-AND-FNF.md), [W03](05-WORKPLACE-AND-ANALYTICS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Closure condition:** preserve this implementation; prove the linked acceptance and scoped real-data/UAT evidence before treating the SOW duty or stage as accepted.
- **Existing repository evidence:** `backend/migrations/1751890000000_absence-letters-policies.ts`; `backend/src/modules/letters/letters.service.ts`; `frontend/src/pages/letters/MyLettersPage.tsx`

- **Deep code safety obligations:** C01, C16, C19, C20, C21, C30, C31, C34, C36 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-025 — Workforce / original row 25

> Updation of candidate information by capturing through personal email.

- **Code assessment:** Pending. Requirement references from review: `LC-01/02`. Existing phase reference: 3.1.
- **Observed coverage:** Onboarding page is a pending shell; boarding/exit report is a separate implemented slice.
- **Remaining:** Build personal-email prejoin link, candidate form, delivery/resend tracking and conversion.
- **Execution / database / screen / logic / tests:** [F04](01-DATA-AND-FOUNDATIONS.md), [L01](04-LIFECYCLE-AND-FNF.md), [R01](06-TRAVEL-ATS-AND-MOBILE.md), [D03](08-DECISIONS-AND-OPERATIONS.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`

- **Deep code safety obligations:** C01, C09, C12, C14, C16, C17, C20, C27, C30, C31, C33, C36 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-026 — Workforce / original row 26

> Platform auto CTC structuring based on predefined templates.

- **Code assessment:** Pending. Requirement references from review: `PAY-01/02`. Existing phase reference: 2.1–2.4.
- **Observed coverage:** Payroll UI shell and integer-paise utilities only.
- **Remaining:** Build salary structures/components, grade/location assignments, CTC breakdown and applicable benefits/incentives/perquisites. No payroll business router exists.
- **Execution / database / screen / logic / tests:** [P01](03-PAYROLL-LOANS-CLAIMS.md), [L01](04-LIFECYCLE-AND-FNF.md), [R01](06-TRAVEL-ATS-AND-MOBILE.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C01, C16, C20, C30, C31, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-027 — Workforce / original row 27

> Management of flexi-basket benefits and reimbursements.

- **Code assessment:** Pending. Requirement references from review: `PAY-13, LN-01/02, CLM-01..06, PAY-06`. Existing phase reference: 2.3–2.5.
- **Observed coverage:** ESS pay/loan/claim shells only; generic workflows available.
- **Remaining:** Implement the row-specific ESS transaction: benefits/claims, investment declaration, loan application or payslip/tax generation. Backend modules are absent.
- **Execution / database / screen / logic / tests:** [P06](03-PAYROLL-LOANS-CLAIMS.md), [T01](06-TRAVEL-ATS-AND-MOBILE.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-028 — Workforce / original row 28

> Employee investment declarations for tax planning.

- **Code assessment:** Pending. Requirement references from review: `PAY-13, LN-01/02, CLM-01..06, PAY-06`. Existing phase reference: 2.3–2.5.
- **Observed coverage:** ESS pay/loan/claim shells only; generic workflows available.
- **Remaining:** Implement the row-specific ESS transaction: benefits/claims, investment declaration, loan application or payslip/tax generation. Backend modules are absent.
- **Execution / database / screen / logic / tests:** [P03](03-PAYROLL-LOANS-CLAIMS.md), [D01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-029 — Workforce / original row 29

> Employee loan processing on ESS portal and approval workflow .

- **Code assessment:** Pending. Requirement references from review: `PAY-13, LN-01/02, CLM-01..06, PAY-06`. Existing phase reference: 2.3–2.5.
- **Observed coverage:** ESS pay/loan/claim shells only; generic workflows available.
- **Remaining:** Implement the row-specific ESS transaction: benefits/claims, investment declaration, loan application or payslip/tax generation. Backend modules are absent.
- **Execution / database / screen / logic / tests:** [P05](03-PAYROLL-LOANS-CLAIMS.md), [T02](06-TRAVEL-ATS-AND-MOBILE.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C30, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-030 — Workforce / original row 30

> Payslip and tax sheet generation for onboarding employees.

- **Code assessment:** Pending. Requirement references from review: `PAY-13, LN-01/02, CLM-01..06, PAY-06`. Existing phase reference: 2.3–2.5.
- **Observed coverage:** ESS pay/loan/claim shells only; generic workflows available.
- **Remaining:** Implement the row-specific ESS transaction: benefits/claims, investment declaration, loan application or payslip/tax generation. Backend modules are absent.
- **Execution / database / screen / logic / tests:** [P01](03-PAYROLL-LOANS-CLAIMS.md), [P04](03-PAYROLL-LOANS-CLAIMS.md), [L01](04-LIFECYCLE-AND-FNF.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C01, C16, C20, C30, C31, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-031 — Workforce / original row 31

> capturing previous employment details.

- **Code assessment:** Pending. Requirement references from review: `CORE-01, LC-01`. Existing phase reference: 0.5 / 3.1.
- **Observed coverage:** Current profile/import omits previous-employment capture.
- **Remaining:** Build previous-employment persistence, import/form/read contract and onboarding integration. Specified table is absent from the 07 Oct schema recon.
- **Execution / database / screen / logic / tests:** [F02](01-DATA-AND-FOUNDATIONS.md), [L01](04-LIFECYCLE-AND-FNF.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/migrations/1751810000000_org-employees.ts`; `backend/src/modules/employees/employees.router.ts`; `docs/recon/greythr-additional-fields-2026-10-07.md`

- **Deep code safety obligations:** C01, C16, C20, C21, C29, C30, C31 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-033 — Workforce / original row 33

> Probation review tracking and automated reminders

- **Code assessment:** Pending. Requirement references from review: `LC-04, PAY-02`. Existing phase reference: 3.1.
- **Observed coverage:** Probation fields and generic confirmation chain definition exist.
- **Remaining:** Build probation reviews, due reminders, outcome hooks, salary switch and letters. A seeded chain alone does not complete the process.
- **Execution / database / screen / logic / tests:** [F04](01-DATA-AND-FOUNDATIONS.md), [L02](04-LIFECYCLE-AND-FNF.md), [D04](08-DECISIONS-AND-OPERATIONS.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `backend/src/modules/workflows/definitions.seed.ts`

- **Deep code safety obligations:** C09, C12, C14, C16, C17, C20, C27, C30, C33, C36 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-034 — Workforce / original row 34

> Updating multi-level approval workflows for employee confirmation

- **Code assessment:** Pending. Requirement references from review: `LC-04, PAY-02`. Existing phase reference: 3.1.
- **Observed coverage:** Probation fields and generic confirmation chain definition exist.
- **Remaining:** Build probation reviews, due reminders, outcome hooks, salary switch and letters. A seeded chain alone does not complete the process.
- **Execution / database / screen / logic / tests:** [F04](01-DATA-AND-FOUNDATIONS.md), [L02](04-LIFECYCLE-AND-FNF.md), [D04](08-DECISIONS-AND-OPERATIONS.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `backend/src/modules/workflows/definitions.seed.ts`

- **Deep code safety obligations:** C09, C12, C14, C16, C17, C20, C27, C30, C33, C36 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-036 — Workforce / original row 36

> Platform automated workflow for internal department/location transfers.

- **Code assessment:** Pending. Requirement references from review: `LC-05, PAY-16`. Existing phase reference: 3.3.
- **Observed coverage:** Employee history schema and generic transfer definition exist.
- **Remaining:** Build approved effective-dated transfer mutations, document updates, compensation/role changes and entity payroll continuity.
- **Execution / database / screen / logic / tests:** [L03](04-LIFECYCLE-AND-FNF.md), [D07](08-DECISIONS-AND-OPERATIONS.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `backend/src/modules/workflows/definitions.seed.ts`

- **Deep code safety obligations:** C30, C31 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-037 — Workforce / original row 37

> Platform-driven approvals and documentation updates.

- **Code assessment:** Pending. Requirement references from review: `LC-05, PAY-16`. Existing phase reference: 3.3.
- **Observed coverage:** Employee history schema and generic transfer definition exist.
- **Remaining:** Build approved effective-dated transfer mutations, document updates, compensation/role changes and entity payroll continuity.
- **Execution / database / screen / logic / tests:** [L03](04-LIFECYCLE-AND-FNF.md), [D07](08-DECISIONS-AND-OPERATIONS.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `backend/src/modules/workflows/definitions.seed.ts`

- **Deep code safety obligations:** C30, C31 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-038 — Workforce / original row 38

> compensation and role change updates in HRMS.

- **Code assessment:** Pending. Requirement references from review: `LC-05, PAY-16`. Existing phase reference: 3.3.
- **Observed coverage:** Employee history schema and generic transfer definition exist.
- **Remaining:** Build approved effective-dated transfer mutations, document updates, compensation/role changes and entity payroll continuity.
- **Execution / database / screen / logic / tests:** [P01](03-PAYROLL-LOANS-CLAIMS.md), [L02](04-LIFECYCLE-AND-FNF.md), [L03](04-LIFECYCLE-AND-FNF.md), [D07](08-DECISIONS-AND-OPERATIONS.md), [D10](08-DECISIONS-AND-OPERATIONS.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `backend/src/modules/workflows/definitions.seed.ts`

- **Deep code safety obligations:** C20, C30, C31, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-040 — Workforce / original row 40

> • Resignation initiation, tracking, and approval workflows.

- **Code assessment:** Pending. Requirement references from review: `LC-06/07, PAY-15`. Existing phase reference: 3.2.
- **Observed coverage:** Generic resignation definition and asset holdings lookup exist.
- **Remaining:** Build ESS resignation, notices, departmental clearances, settlement compute/payment and exit cascade. No full separation API exists.
- **Execution / database / screen / logic / tests:** [L04](04-LIFECYCLE-AND-FNF.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C18, C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-041 — Workforce / original row 41

> • Digital clearance process across departments (IT, Admin, Finance)

- **Code assessment:** Pending. Requirement references from review: `LC-06/07, PAY-15`. Existing phase reference: 3.2.
- **Observed coverage:** Generic resignation definition and asset holdings lookup exist.
- **Remaining:** Build ESS resignation, notices, departmental clearances, settlement compute/payment and exit cascade. No full separation API exists.
- **Execution / database / screen / logic / tests:** [L04](04-LIFECYCLE-AND-FNF.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C18, C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-042 — Workforce / original row 42

> • Final settlement and compliance with statutory requirements.

- **Code assessment:** Pending. Requirement references from review: `LC-06/07, PAY-15`. Existing phase reference: 3.2.
- **Observed coverage:** Generic resignation definition and asset holdings lookup exist.
- **Remaining:** Build ESS resignation, notices, departmental clearances, settlement compute/payment and exit cascade. No full separation API exists.
- **Execution / database / screen / logic / tests:** [L04](04-LIFECYCLE-AND-FNF.md), [L05](04-LIFECYCLE-AND-FNF.md), [D01](08-DECISIONS-AND-OPERATIONS.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C18, C20, C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-044 — Workforce / original row 44

> • Generation of various employee-related letters, including:
>  o Experience letters
>  o Relieving letters
>  o Salary certificates

- **Code assessment:** Partial. Requirement references from review: `CORE-09, LC-06, PAY-15`. Existing phase reference: 1.6 / 3.2.
- **Observed coverage:** Experience, relieving and salary-certificate templates plus issuance/archive exist.
- **Remaining:** Tie exit letters to paid F&F/clearance. Salary amount is a caller-supplied merge field, not derived from a live salary engine. Accept production templates.
- **Execution / database / screen / logic / tests:** [F04](01-DATA-AND-FOUNDATIONS.md), [P04](03-PAYROLL-LOANS-CLAIMS.md), [L05](04-LIFECYCLE-AND-FNF.md), [W03](05-WORKPLACE-AND-ANALYTICS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/letters/letters.service.ts`; `frontend/src/pages/letters/LettersPage.tsx`; `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`

- **Deep code safety obligations:** C01, C09, C12, C14, C16, C17, C19, C20, C21, C27, C30, C33, C34, C36 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-047 — Leave & attendance / original row 47

> Defining and configuring multiple shift types (fixed, rotational, flexible, night shifts, etc.).

- **Code assessment:** Partial. Requirement references from review: `ATT-04/05`. Existing phase reference: 1.2 / 1.8.
- **Observed coverage:** Shift CRUD covers clock times, night crossing, sessions, grace and thresholds.
- **Remaining:** Prove flexible/rotational shift behaviors and exact production thresholds/schemes; effective-date overlap protection remains an audit finding.
- **Execution / database / screen / logic / tests:** [A02](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [D05](08-DECISIONS-AND-OPERATIONS.md), [D07](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/attendance/attendance-config.router.ts`; `backend/src/modules/attendance/day-status.service.ts`; `docs/recon/database-audit-2026-10-07.md`

- **Deep code safety obligations:** C11, C12, C13, C15, C25, C37 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-048 — Leave & attendance / original row 48

> Platform automated shift scheduling and roster management.

- **Code assessment:** Partial. Requirement references from review: `ATT-04`. Existing phase reference: 1.2 / 1.7.
- **Observed coverage:** Manager roster read/bulk update, employee shift scheme and reminder schedule exist.
- **Remaining:** Automated roster generation/rotation is not evidenced; confirm whether manual manager roster plus reminders meets this SOW wording. Complete UAT.
- **Execution / database / screen / logic / tests:** [A02](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [D05](08-DECISIONS-AND-OPERATIONS.md), [D07](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/attendance/attendance-config.router.ts`; `backend/src/modules/attendance/day-status.service.ts`; `backend/src/modules/attendance/roster.service.ts`; `frontend/src/pages/team/TeamPage.tsx`

- **Deep code safety obligations:** C11, C12, C13, C15, C25, C37 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-049 — Leave & attendance / original row 49

> Integration with biometric systems.

- **Code assessment:** Partial. Requirement references from review: `ATT-01/02`. Existing phase reference: 0.1 / 0.6 / 1.1.
- **Observed coverage:** Swappable Kent interface, mock ingestion, immutable swipe pipeline and device-health UI exist.
- **Remaining:** Confirm access protocol; replace MockKentConnector, ingest/reconcile real door swipes, prove lag/backfill/watermarks in production.
- **Execution / database / screen / logic / tests:** [F04](01-DATA-AND-FOUNDATIONS.md), [A01](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [D07](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/attendance/kent-connector.ts`; `backend/src/modules/attendance/kent-sync.job.ts`; `plans/phase-0-foundations.md`

- **Deep code safety obligations:** C09, C12, C14, C15, C16, C17, C20, C27, C33, C36 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-051 — Leave & attendance / original row 51

> management of real-time biometric attendance integration in system.

- **Code assessment:** Partial. Requirement references from review: `ATT-01/02`. Existing phase reference: 0.1 / 0.6 / 1.1.
- **Observed coverage:** Swappable Kent interface, mock ingestion, immutable swipe pipeline and device-health UI exist.
- **Remaining:** Confirm access protocol; replace MockKentConnector, ingest/reconcile real door swipes, prove lag/backfill/watermarks in production.
- **Execution / database / screen / logic / tests:** [F04](01-DATA-AND-FOUNDATIONS.md), [A01](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [D07](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/attendance/kent-connector.ts`; `backend/src/modules/attendance/kent-sync.job.ts`; `plans/phase-0-foundations.md`

- **Deep code safety obligations:** C09, C12, C14, C15, C16, C17, C20, C27, C33, C36 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-052 — Leave & attendance / original row 52

> integration with access control systems for seamless tracking.

- **Code assessment:** Partial. Requirement references from review: `ATT-01/02`. Existing phase reference: 0.1 / 0.6 / 1.1.
- **Observed coverage:** Swappable Kent interface, mock ingestion, immutable swipe pipeline and device-health UI exist.
- **Remaining:** Confirm access protocol; replace MockKentConnector, ingest/reconcile real door swipes, prove lag/backfill/watermarks in production.
- **Execution / database / screen / logic / tests:** [F04](01-DATA-AND-FOUNDATIONS.md), [A01](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [D07](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/attendance/kent-connector.ts`; `backend/src/modules/attendance/kent-sync.job.ts`; `plans/phase-0-foundations.md`

- **Deep code safety obligations:** C09, C12, C14, C15, C16, C17, C20, C27, C33, C36 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-053 — Leave & attendance / original row 53

> Platform automated late coming and early leaving reports.

- **Code assessment:** Implemented. Requirement references from review: `ATT-05, RPT-06`. Existing phase reference: 1.7.
- **Observed coverage:** Late/early calculations, R4 exception table and same-filter Excel export exist.
- **Remaining:** Accept production grace/scheme settings and reconcile with real Kent data in G1 UAT.
- **Execution / database / screen / logic / tests:** [A02](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [W04](05-WORKPLACE-AND-ANALYTICS.md), [D05](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Closure condition:** preserve this implementation; prove the linked acceptance and scoped real-data/UAT evidence before treating the SOW duty or stage as accepted.
- **Existing repository evidence:** `backend/src/modules/reports/reports.service.ts`; `backend/src/modules/reports/reports-export.service.ts`; `backend/tests/stage17-supporting-reports.integration.test.ts`; `backend/src/modules/attendance/attendance-config.router.ts`; `backend/src/modules/attendance/day-status.service.ts`

- **Deep code safety obligations:** C01, C11, C12, C13, C15, C19, C25, C27, C33, C37 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-054 — Leave & attendance / original row 54

> Platform alerts for absenteeism, regularization requests, and policy violations

- **Code assessment:** Partial. Requirement references from review: `ATT-10/11, WF-02`. Existing phase reference: 1.4 / 1.6.
- **Observed coverage:** Absence scanning, regularization workflow, notification queue and scheduler hooks exist.
- **Remaining:** Wire delivery consumer/SMTP; prove real employee/manager alerts and resolve production sync gaps.
- **Execution / database / screen / logic / tests:** [F04](01-DATA-AND-FOUNDATIONS.md), [A05](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [W03](05-WORKPLACE-AND-ANALYTICS.md), [D04](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/attendance/absence.service.ts`; `backend/src/modules/attendance/regularization.service.ts`; `backend/src/modules/notifications/notifications.service.ts`; `backend/src/jobs/worker.ts`

- **Deep code safety obligations:** C01, C08, C09, C10, C11, C12, C14, C16, C17, C19, C20, C21, C25, C27, C33, C34, C36, C37 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-056 — Leave & attendance / original row 56

> Configuration of leave types (annual, sick, maternity, casual, etc.).

- **Code assessment:** Partial. Requirement references from review: `LV-01`. Existing phase reference: 1.5 / 1.8.
- **Observed coverage:** Leave catalog seed and audited create/update API exist.
- **Remaining:** Finish HR leave-type configuration UI; current LeaveAdmin page only runs accrual/expiry and shows register pending. Accept policies.
- **Execution / database / screen / logic / tests:** [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/leave/leave.router.ts`; `backend/src/modules/leave/leave-core.service.ts`; `backend/tests/stage15-leave.integration.test.ts`; `frontend/src/pages/leave/LeaveAdminPage.tsx`

- **Deep code safety obligations:** C01, C02, C04, C06, C07, C08, C09, C10, C13, C21, C25 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-057 — Leave & attendance / original row 57

> holiday calendar configuration by location and department.

- **Code assessment:** Partial. Requirement references from review: `ATT-13`. Existing phase reference: 1.2 / scope review.
- **Observed coverage:** Location/global holidays CRUD and ESS calendar exist.
- **Remaining:** Department-specific holiday configuration in the SOW is not represented by the inspected location-only contract. Resolve scope with HR.
- **Execution / database / screen / logic / tests:** [A02](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [D07](08-DECISIONS-AND-OPERATIONS.md), [D08](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/attendance/attendance-config.router.ts`; `backend/src/modules/attendance/day-status.service.ts`; `docs/01-REQUIREMENTS-PRD.md`

- **Deep code safety obligations:** C11, C12, C13, C15, C25, C37 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-058 — Leave & attendance / original row 58

> • leave request and approval workflows with multi-level authorizations.

- **Code assessment:** Implemented. Requirement references from review: `LV-03/08, WF-01`. Existing phase reference: 1.5.
- **Observed coverage:** Leave apply/cancel, balance checks, multi-step approvals and ledger/attendance hooks exist.
- **Remaining:** G1 HR/manager UAT and production notification delivery remain.
- **Execution / database / screen / logic / tests:** [A03](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Fresh source qualification:** Current leave approval and cancellation clear whole-day session labels; preserve these fixes and test dirty recompute vs month lock.
- **Closure condition:** preserve this implementation; prove the linked acceptance and scoped real-data/UAT evidence before treating the SOW duty or stage as accepted.
- **Existing repository evidence:** `backend/src/modules/leave/leave-apply.service.ts`; `backend/src/modules/leave/workflow-hooks.ts`; `backend/tests/stage15-leave.integration.test.ts`; `frontend/src/pages/leave/MyLeavePage.tsx`

- **Deep code safety obligations:** C01, C02, C03, C04, C05, C06, C07, C08, C09, C10, C13, C16, C21, C24, C25 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-059 — Leave & attendance / original row 59

> Platform automated leave balance tracking and accruals.

- **Code assessment:** Implemented. Requirement references from review: `LV-02/05`. Existing phase reference: 1.5.
- **Observed coverage:** Immutable ledger balance and idempotent monthly accrual plus scheduler exist.
- **Remaining:** Prove recurring production execution with real opening balances; policy settings and G1 acceptance remain.
- **Execution / database / screen / logic / tests:** [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [D02](08-DECISIONS-AND-OPERATIONS.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Fresh source qualification:** Accrual code exists; ATT-12 vs docs04 credit-readiness conflict is D02. Code presence is not real-period accrual sign-off.
- **Closure condition:** preserve this implementation; prove the linked acceptance and scoped real-data/UAT evidence before treating the SOW duty or stage as accepted.
- **Existing repository evidence:** `backend/src/modules/leave/leave.router.ts`; `backend/src/modules/leave/leave-core.service.ts`; `backend/tests/stage15-leave.integration.test.ts`; `backend/src/jobs/worker.ts`

- **Deep code safety obligations:** C01, C02, C04, C06, C07, C08, C09, C10, C13, C21, C25 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-060 — Leave & attendance / original row 60

> Leave encashment and carry-forward policies

- **Code assessment:** Partial. Requirement references from review: `LV-06, PAY-15`. Existing phase reference: 1.5 / 2 / 3.2.
- **Observed coverage:** Encashment workflow/debit and carry-forward function exist.
- **Remaining:** Build encashment money payout/F&F integration. Wire year-end carry-forward recurring execution; worker does not import that function.
- **Execution / database / screen / logic / tests:** [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [L05](04-LIFECYCLE-AND-FNF.md), [D06](08-DECISIONS-AND-OPERATIONS.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Fresh source qualification:** Encash approval posts a ledger debit with audited balance clamp; payout linkage remains absent. Pay the actual approved debit exactly once after D06.
- **Existing repository evidence:** `backend/src/modules/leave/leave-apply.service.ts`; `backend/src/modules/leave/leave-core.service.ts`; `backend/src/jobs/worker.ts`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C01, C02, C04, C06, C07, C08, C09, C10, C13, C20, C21, C25, C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-062 — Leave & attendance / original row 62

> • overtime tracking based on pre-approved policies.

- **Code assessment:** Partial. Requirement references from review: `ATT-08`. Existing phase reference: 1.4 / 1.7.
- **Observed coverage:** Detected OT, policy thresholds, manager decision and lapse functions exist.
- **Remaining:** Connect real swipes and real manager digest delivery; approve policy/rates and close G1.
- **Execution / database / screen / logic / tests:** [A03](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [D04](08-DECISIONS-AND-OPERATIONS.md), [D06](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/attendance/overtime.service.ts`; `backend/src/modules/notifications/notifications.service.ts`; `backend/src/jobs/worker.ts`

- **Deep code safety obligations:** C02, C03, C04, C05, C06, C07, C08, C13, C16, C24 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-063 — Leave & attendance / original row 63

> Platform auto-calculation of compensatory offs and extra working hours.

- **Code assessment:** Implemented. Requirement references from review: `LV-04, ATT-08`. Existing phase reference: 1.4 / 1.5.
- **Observed coverage:** OT minutes convert to half/full comp-off credits with expiry and no pay-plus-credit duplication.
- **Remaining:** Real-feed policy acceptance and G1 UAT remain.
- **Execution / database / screen / logic / tests:** [A02](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A03](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [D05](08-DECISIONS-AND-OPERATIONS.md), [D06](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Closure condition:** preserve this implementation; prove the linked acceptance and scoped real-data/UAT evidence before treating the SOW duty or stage as accepted.
- **Existing repository evidence:** `backend/src/modules/leave/leave.router.ts`; `backend/src/modules/leave/leave-core.service.ts`; `backend/tests/stage15-leave.integration.test.ts`; `backend/src/modules/attendance/overtime.service.ts`

- **Deep code safety obligations:** C01, C02, C03, C04, C05, C06, C07, C08, C09, C10, C11, C12, C13, C15, C16, C21, C24, C25, C37 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-064 — Leave & attendance / original row 64

> approval workflows for overtime requests.

- **Code assessment:** Implemented. Requirement references from review: `ATT-08, WF-01`. Existing phase reference: 1.4.
- **Observed coverage:** OT approval/rejection/partial-minute decisions, manager UI and deadline lapse exist.
- **Remaining:** Prove actual manager notification delivery and production decision timing.
- **Execution / database / screen / logic / tests:** [A03](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [D04](08-DECISIONS-AND-OPERATIONS.md), [D06](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Closure condition:** preserve this implementation; prove the linked acceptance and scoped real-data/UAT evidence before treating the SOW duty or stage as accepted.
- **Existing repository evidence:** `backend/src/modules/attendance/overtime.service.ts`; `frontend/src/pages/team/OtDecisionsPage.tsx`; `backend/tests/stage14-requests-overtime.integration.test.ts`

- **Deep code safety obligations:** C02, C03, C04, C05, C06, C07, C08, C13, C16, C24 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-065 — Leave & attendance / original row 65

> integration with payroll for overtime

- **Code assessment:** Pending. Requirement references from review: `ATT-08, PAY-03/05`. Existing phase reference: 2.2 / 2.4.
- **Observed coverage:** Approved OT exists on attendance side.
- **Remaining:** Build OT wage calculation, payroll linkage, payout and overtime payslip. R5 payment linkage explicitly deferred.
- **Execution / database / screen / logic / tests:** [A03](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md), [D06](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`; `plans/phase-1-attendance-leave-workflows.md`

- **Deep code safety obligations:** C02, C03, C04, C05, C06, C07, C08, C11, C13, C16, C24, C25, C30, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-067 — Leave & attendance / original row 67

> enforcement of attendance policies (minimum working hours, grace period, break time tracking).

- **Code assessment:** Partial. Requirement references from review: `ATT-05/18`. Existing phase reference: 1.2 / G1.
- **Observed coverage:** Configured working-hour/grace/break deduction and session/day computation exist.
- **Remaining:** Confirm production session thresholds and break interpretation; reconcile real feed and watermark behavior. No per-break punch accounting is evidenced.
- **Execution / database / screen / logic / tests:** [A02](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [D05](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Fresh source qualification:** Current processor now readiness-gates daily A or any absent session; regularization/leave clear stale labels. Session-threshold parity and actual deployed evidence remain open.
- **Existing repository evidence:** `backend/src/modules/attendance/attendance-config.router.ts`; `backend/src/modules/attendance/day-status.service.ts`; `docs/recon/greythr-attendance-and-access-2026-10-07.md`

- **Deep code safety obligations:** C11, C12, C13, C15, C25, C37 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-068 — Leave & attendance / original row 68

> Platform automated deductions and penalties for attendance violations.

- **Code assessment:** Pending. Requirement references from review: `ATT-05/09, PAY-03/04`. Existing phase reference: 2.2 / P0-T06.
- **Observed coverage:** Late/early minutes, absence and week-off eligibility are computed.
- **Remaining:** Define signed penalty-to-pay policy and implement payroll deductions; metrics alone do not deduct salary.
- **Execution / database / screen / logic / tests:** [A02](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md), [D05](08-DECISIONS-AND-OPERATIONS.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/attendance/attendance-config.router.ts`; `backend/src/modules/attendance/day-status.service.ts`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C06, C08, C11, C12, C13, C15, C25, C30, C35, C37 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-069 — Leave & attendance / original row 69

> Preparation of reports and dashboards for HR and management monitoring.

- **Code assessment:** Partial. Requirement references from review: `RPT-01/04/06, LV-07`. Existing phase reference: 1.7 / 3.5.
- **Observed coverage:** Muster, attendance reports, HR/BU views and employee leave balances exist.
- **Remaining:** Finish permission-scoped company leave register/dashboard; complete cost KPIs and accepted production data. RML source score is blank.
- **Execution / database / screen / logic / tests:** [A05](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [W04](05-WORKPLACE-AND-ANALYTICS.md), [D05](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `frontend/src/pages/leave/LeaveAdminPage.tsx`; `backend/src/modules/reports/dashboard.service.ts`; `plans/phase-1-attendance-leave-workflows.md`

- **Deep code safety obligations:** C01, C08, C10, C11, C19, C25, C27, C33, C36, C37 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-072 — Payroll & compliance / original row 72

> Payroll Inputs Collection & Validation: Protiviti manages payroll inputs (new joiners, salary revisions, variable pay, deductions, loss of pay, etc.) in a predefined format.

- **Code assessment:** Pending. Requirement references from review: `PAY-03/04/05/06/09..13`. Existing phase reference: 2.1–2.6.
- **Observed coverage:** Attendance/reporting/workflow spine and payroll UI shell exist.
- **Remaining:** Build row-specific payroll inputs, declaration tax calculation, compute/review/finalize, output files/registers or OT pay. No end-to-end payroll engine is registered.
- **Execution / database / screen / logic / tests:** [A05](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C06, C08, C10, C11, C25, C30, C35, C36, C37 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-073 — Payroll & compliance / original row 73

> Investment & flexi declarations: Tax computation based on employee declarations via ESS portal

- **Code assessment:** Pending. Requirement references from review: `PAY-03/04/05/06/09..13`. Existing phase reference: 2.1–2.6.
- **Observed coverage:** Attendance/reporting/workflow spine and payroll UI shell exist.
- **Remaining:** Build row-specific payroll inputs, declaration tax calculation, compute/review/finalize, output files/registers or OT pay. No end-to-end payroll engine is registered.
- **Execution / database / screen / logic / tests:** [P03](03-PAYROLL-LOANS-CLAIMS.md), [P06](03-PAYROLL-LOANS-CLAIMS.md), [D01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-074 — Payroll & compliance / original row 74

> • Payroll processing & review:
>  o Salary calculations with deductions and allowances.
>  o Draft payroll reports for approval.
>  o Final payroll processing after client confirmation

- **Code assessment:** Pending. Requirement references from review: `PAY-03/04/05/06/09..13`. Existing phase reference: 2.1–2.6.
- **Observed coverage:** Attendance/reporting/workflow spine and payroll UI shell exist.
- **Remaining:** Build row-specific payroll inputs, declaration tax calculation, compute/review/finalize, output files/registers or OT pay. No end-to-end payroll engine is registered.
- **Execution / database / screen / logic / tests:** [P02](03-PAYROLL-LOANS-CLAIMS.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C06, C08, C11, C25, C30, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-075 — Payroll & compliance / original row 75

> Performing Payroll deliverables:
>  o Final Pay Register.
>  o Bank Transfer File.
>  o Journal Voucher Report.
>  o Payslip & Tax computation slip via ESS.
>  o Reimbursement & variance reports.

- **Code assessment:** Pending. Requirement references from review: `PAY-03/04/05/06/09..13`. Existing phase reference: 2.1–2.6.
- **Observed coverage:** Attendance/reporting/workflow spine and payroll UI shell exist.
- **Remaining:** Build row-specific payroll inputs, declaration tax calculation, compute/review/finalize, output files/registers or OT pay. No end-to-end payroll engine is registered.
- **Execution / database / screen / logic / tests:** [P04](03-PAYROLL-LOANS-CLAIMS.md), [W04](05-WORKPLACE-AND-ANALYTICS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C01, C19, C25, C27, C30, C33 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-076 — Payroll & compliance / original row 76

> Preparation of standard & customized Reports:
>  o Standard: TDS report, PF report, PT report, ESIC report, LWF report, Variance report, CTC report.
>  o Customized: Cost Centre, Location, Department-wise reports.

- **Code assessment:** Pending. Requirement references from review: `PAY-03/04/05/06/09..13`. Existing phase reference: 2.1–2.6.
- **Observed coverage:** Attendance/reporting/workflow spine and payroll UI shell exist.
- **Remaining:** Build row-specific payroll inputs, declaration tax calculation, compute/review/finalize, output files/registers or OT pay. No end-to-end payroll engine is registered.
- **Execution / database / screen / logic / tests:** [P03](03-PAYROLL-LOANS-CLAIMS.md), [P04](03-PAYROLL-LOANS-CLAIMS.md), [P07](03-PAYROLL-LOANS-CLAIMS.md), [W04](05-WORKPLACE-AND-ANALYTICS.md), [D01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C01, C19, C25, C27, C30, C33 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-077 — Payroll & compliance / original row 77

> • Calculation of OT(Over Time) charges and cross verifying with the attendance system and validate the OT charge

- **Code assessment:** Pending. Requirement references from review: `PAY-03/04/05/06/09..13`. Existing phase reference: 2.1–2.6.
- **Observed coverage:** Attendance/reporting/workflow spine and payroll UI shell exist.
- **Remaining:** Build row-specific payroll inputs, declaration tax calculation, compute/review/finalize, output files/registers or OT pay. No end-to-end payroll engine is registered.
- **Execution / database / screen / logic / tests:** [A03](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md), [D06](08-DECISIONS-AND-OPERATIONS.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C02, C03, C04, C05, C06, C07, C08, C11, C13, C16, C24, C25, C30, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-078 — Payroll & compliance / original row 78

> • Protiviti should Handle the payroll Queries

- **Code assessment:** Partial. Requirement references from review: `HD-01`. Existing phase reference: 3.4 / 2.
- **Observed coverage:** Generic helpdesk ticket raise/queue/reply exists.
- **Remaining:** Staff payroll support and connect queries to actual payroll data. Vendor query-resolution service completion cannot be inferred from code.
- **Execution / database / screen / logic / tests:** [F04](01-DATA-AND-FOUNDATIONS.md), [W02](05-WORKPLACE-AND-ANALYTICS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/helpdesk/helpdesk.router.ts`; `backend/src/modules/helpdesk/helpdesk.service.ts`; `backend/tests/helpdesk.integration.test.ts`; `frontend/src/pages/workplace/HelpdeskPage.tsx`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C09, C12, C14, C16, C17, C20, C21, C26, C27, C33, C36 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-079 — Payroll & compliance / original row 79

> Protiviti should Validate attendance by verifying data or biometric records

- **Code assessment:** Partial. Requirement references from review: `ATT-01/02/03, PAY-03`. Existing phase reference: G1 / 2.2.
- **Observed coverage:** Raw-swipe drilldown and reconciliation report exist.
- **Remaining:** Replace simulated Kent feed and perform real pre-payroll attendance reconciliation/sign-off.
- **Execution / database / screen / logic / tests:** [A01](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A02](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A05](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [D05](08-DECISIONS-AND-OPERATIONS.md), [D07](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Fresh source qualification:** Fresh processor fixes above are present. Historical future watermarks/dangling swipe links remain dated audit findings needing a new safe comparison.
- **Existing repository evidence:** `backend/src/modules/reports/reports.service.ts`; `backend/src/modules/attendance/kent-sync.job.ts`; `plans/phase-1-attendance-leave-workflows.md`

- **Deep code safety obligations:** C08, C10, C11, C12, C13, C14, C15, C25, C36, C37 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-081 — Payroll & compliance / original row 81

> • The Protiviti should handle the end-to-end payroll process, from collecting inputs to preparing the final register

- **Code assessment:** Pending. Requirement references from review: `PAY-03/04/05/06/09..13`. Existing phase reference: 2.1–2.6.
- **Observed coverage:** Attendance/reporting/workflow spine and payroll UI shell exist.
- **Remaining:** Build row-specific payroll inputs, declaration tax calculation, compute/review/finalize, output files/registers or OT pay. No end-to-end payroll engine is registered.
- **Execution / database / screen / logic / tests:** [P02](03-PAYROLL-LOANS-CLAIMS.md), [P07](03-PAYROLL-LOANS-CLAIMS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C06, C08, C11, C25, C30, C33, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-082 — Payroll & compliance / original row 82

> Effective date of salary revision.

- **Code assessment:** Pending. Requirement references from review: `PAY-16, PAY-01`. Existing phase reference: 2.1 / 2.2.
- **Observed coverage:** Salary history is specified only.
- **Remaining:** Build effective-dated revisions, overlap constraint and retro delta computation.
- **Execution / database / screen / logic / tests:** [P01](03-PAYROLL-LOANS-CLAIMS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md), [L02](04-LIFECYCLE-AND-FNF.md), [L03](04-LIFECYCLE-AND-FNF.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C06, C08, C11, C20, C25, C30, C31, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-083 — Payroll & compliance / original row 83

> Duplication of Employee Code / Number / ID.

- **Code assessment:** Implemented. Requirement references from review: `CORE-02/08`. Existing phase reference: 0.5.
- **Observed coverage:** Unique employee ecode, atomic per-company generator and series-checked imports exist.
- **Remaining:** Real-source reconciliation and HR review of rejected/duplicate rows remain.
- **Execution / database / screen / logic / tests:** [F02](01-DATA-AND-FOUNDATIONS.md), [D09](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Fresh source qualification:** DB e-code allocation and duplicate protection exist; preserve them. Legacy alias/typo validation and concurrent real-import proof remain.
- **Closure condition:** preserve this implementation; prove the linked acceptance and scoped real-data/UAT evidence before treating the SOW duty or stage as accepted.
- **Existing repository evidence:** `backend/migrations/1751810000000_org-employees.ts`; `backend/src/modules/employees/employees.router.ts`; `backend/src/modules/employees/import.service.ts`; `backend/src/modules/employees/import.schemas.ts`; `plans/phase-0-foundations.md`; `backend/tests/employee-import.integration.test.ts`

- **Deep code safety obligations:** C01, C21, C29, C31 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-084 — Payroll & compliance / original row 84

> Whether any employees are minor based on the date of birth.

- **Code assessment:** Pending. Requirement references from review: `CORE-07/08`. Existing phase reference: 0.5 / before 2.
- **Observed coverage:** DOB and statutory/bank strings can be stored; identifiers are permission-masked on reads.
- **Remaining:** Implement the exact row validation (minor DOB, bank length, IFSC/PAN/Aadhaar format/checksum, duplicate ESIC). Import schema accepts raw strings; source migration lacks these CHECK/UNIQUE rules.
- **Execution / database / screen / logic / tests:** [F02](01-DATA-AND-FOUNDATIONS.md), [D09](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/migrations/1751810000000_org-employees.ts`; `backend/src/modules/employees/employees.router.ts`; `backend/src/modules/employees/import.schemas.ts`

- **Deep code safety obligations:** C01, C21, C29, C31 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-085 — Payroll & compliance / original row 85

> Length of bank account.

- **Code assessment:** Pending. Requirement references from review: `CORE-07/08`. Existing phase reference: 0.5 / before 2.
- **Observed coverage:** DOB and statutory/bank strings can be stored; identifiers are permission-masked on reads.
- **Remaining:** Implement the exact row validation (minor DOB, bank length, IFSC/PAN/Aadhaar format/checksum, duplicate ESIC). Import schema accepts raw strings; source migration lacks these CHECK/UNIQUE rules.
- **Execution / database / screen / logic / tests:** [F02](01-DATA-AND-FOUNDATIONS.md), [D09](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/migrations/1751810000000_org-employees.ts`; `backend/src/modules/employees/employees.router.ts`; `backend/src/modules/employees/import.schemas.ts`

- **Deep code safety obligations:** C01, C21, C29, C31 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-086 — Payroll & compliance / original row 86

> IFSC code.

- **Code assessment:** Pending. Requirement references from review: `CORE-07/08`. Existing phase reference: 0.5 / before 2.
- **Observed coverage:** DOB and statutory/bank strings can be stored; identifiers are permission-masked on reads.
- **Remaining:** Implement the exact row validation (minor DOB, bank length, IFSC/PAN/Aadhaar format/checksum, duplicate ESIC). Import schema accepts raw strings; source migration lacks these CHECK/UNIQUE rules.
- **Execution / database / screen / logic / tests:** [F02](01-DATA-AND-FOUNDATIONS.md), [D09](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/migrations/1751810000000_org-employees.ts`; `backend/src/modules/employees/employees.router.ts`; `backend/src/modules/employees/import.schemas.ts`

- **Deep code safety obligations:** C01, C21, C29, C31 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-087 — Payroll & compliance / original row 87

> Permanent Account Number (PAN).

- **Code assessment:** Pending. Requirement references from review: `CORE-07/08`. Existing phase reference: 0.5 / before 2.
- **Observed coverage:** DOB and statutory/bank strings can be stored; identifiers are permission-masked on reads.
- **Remaining:** Implement the exact row validation (minor DOB, bank length, IFSC/PAN/Aadhaar format/checksum, duplicate ESIC). Import schema accepts raw strings; source migration lacks these CHECK/UNIQUE rules.
- **Execution / database / screen / logic / tests:** [F02](01-DATA-AND-FOUNDATIONS.md), [D09](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/migrations/1751810000000_org-employees.ts`; `backend/src/modules/employees/employees.router.ts`; `backend/src/modules/employees/import.schemas.ts`

- **Deep code safety obligations:** C01, C21, C29, C31 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-088 — Payroll & compliance / original row 88

> Aadhaar number.

- **Code assessment:** Pending. Requirement references from review: `CORE-07/08`. Existing phase reference: 0.5 / before 2.
- **Observed coverage:** DOB and statutory/bank strings can be stored; identifiers are permission-masked on reads.
- **Remaining:** Implement the exact row validation (minor DOB, bank length, IFSC/PAN/Aadhaar format/checksum, duplicate ESIC). Import schema accepts raw strings; source migration lacks these CHECK/UNIQUE rules.
- **Execution / database / screen / logic / tests:** [F02](01-DATA-AND-FOUNDATIONS.md), [D09](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/migrations/1751810000000_org-employees.ts`; `backend/src/modules/employees/employees.router.ts`; `backend/src/modules/employees/import.schemas.ts`

- **Deep code safety obligations:** C01, C21, C29, C31 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-089 — Payroll & compliance / original row 89

> Duplication of ESI number.

- **Code assessment:** Pending. Requirement references from review: `CORE-07/08`. Existing phase reference: 0.5 / before 2.
- **Observed coverage:** DOB and statutory/bank strings can be stored; identifiers are permission-masked on reads.
- **Remaining:** Implement the exact row validation (minor DOB, bank length, IFSC/PAN/Aadhaar format/checksum, duplicate ESIC). Import schema accepts raw strings; source migration lacks these CHECK/UNIQUE rules.
- **Execution / database / screen / logic / tests:** [F02](01-DATA-AND-FOUNDATIONS.md), [D09](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/migrations/1751810000000_org-employees.ts`; `backend/src/modules/employees/employees.router.ts`; `backend/src/modules/employees/import.schemas.ts`

- **Deep code safety obligations:** C01, C21, C29, C31 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-090 — Payroll & compliance / original row 90

> Check that the CTC matches with break up shared by the Rashmi Metaliks Limited

- **Code assessment:** Pending. Requirement references from review: `CORE-08, PAY-01`. Existing phase reference: 2.1.
- **Observed coverage:** Salary structure is a pending Phase-2 item.
- **Remaining:** Build CTC-vs-component breakup validation and rejection fixtures.
- **Execution / database / screen / logic / tests:** [P01](03-PAYROLL-LOANS-CLAIMS.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C30, C31, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-091 — Payroll & compliance / original row 91

> Identification of duplicate inputs.

- **Code assessment:** Pending. Requirement references from review: `CORE-08, PAY-03`. Existing phase reference: 2.2.
- **Observed coverage:** Employee ecode uniqueness exists; payroll input pipeline does not.
- **Remaining:** Add duplicate monthly-variable/input detection keyed to run/employee/component.
- **Execution / database / screen / logic / tests:** [P02](03-PAYROLL-LOANS-CLAIMS.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C06, C08, C11, C25, C30, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-092 — Payroll & compliance / original row 92

> Special Character for designation, Department - like" & " , ' ". These are not accepted and would be removed.

- **Code assessment:** Partial. Requirement references from review: `CORE-08`. Existing phase reference: 0.5.
- **Observed coverage:** Department/designation import trims, collapses whitespace and deduplicates case.
- **Remaining:** Implement the specified special-character rule or obtain approved replacement. Current normalization does not strip ampersands/quotes.
- **Execution / database / screen / logic / tests:** [F02](01-DATA-AND-FOUNDATIONS.md), [D09](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/employees/import.service.ts`; `backend/src/modules/employees/import.schemas.ts`; `plans/phase-0-foundations.md`

- **Deep code safety obligations:** C01, C21, C29, C31 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-093 — Payroll & compliance / original row 93

> Check whether an employee is in Active or Inactive statusfor variable inputs.

- **Code assessment:** Partial. Requirement references from review: `CORE-06, PAY-03`. Existing phase reference: 2.2.
- **Observed coverage:** Directory supports status filters and exited-requires-DOL CHECK.
- **Remaining:** Enforce active/exiting eligibility in payroll variable inputs; input API is pending.
- **Execution / database / screen / logic / tests:** [F02](01-DATA-AND-FOUNDATIONS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/migrations/1751810000000_org-employees.ts`; `backend/src/modules/employees/employees.router.ts`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C01, C06, C08, C11, C21, C25, C29, C30, C31, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-095 — Payroll & compliance / original row 95

> Payroll Input

- **Code assessment:** Pending. Requirement references from review: `LC-05, PAY-03/05/13`. Existing phase reference: 2 / 3.3.
- **Observed coverage:** Entity master exists; payroll/transfer processes do not.
- **Remaining:** Build this entity-transfer deliverable: input, draft, observation/review, final register, bank file, payslip/tax or JV/custom reports; prove payroll continuity.
- **Execution / database / screen / logic / tests:** [A05](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C06, C08, C10, C11, C25, C30, C35, C36, C37 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-096 — Payroll & compliance / original row 96

> Draft Pay sheet

- **Code assessment:** Pending. Requirement references from review: `LC-05, PAY-03/05/13`. Existing phase reference: 2 / 3.3.
- **Observed coverage:** Entity master exists; payroll/transfer processes do not.
- **Remaining:** Build this entity-transfer deliverable: input, draft, observation/review, final register, bank file, payslip/tax or JV/custom reports; prove payroll continuity.
- **Execution / database / screen / logic / tests:** [P02](03-PAYROLL-LOANS-CLAIMS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C06, C08, C11, C25, C30, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-097 — Payroll & compliance / original row 97

> Observations if any

- **Code assessment:** Pending. Requirement references from review: `LC-05, PAY-03/05/13`. Existing phase reference: 2 / 3.3.
- **Observed coverage:** Entity master exists; payroll/transfer processes do not.
- **Remaining:** Build this entity-transfer deliverable: input, draft, observation/review, final register, bank file, payslip/tax or JV/custom reports; prove payroll continuity.
- **Execution / database / screen / logic / tests:** [P02](03-PAYROLL-LOANS-CLAIMS.md), [W04](05-WORKPLACE-AND-ANALYTICS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C01, C06, C08, C11, C19, C25, C27, C30, C33, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-098 — Payroll & compliance / original row 98

> Finaly pay Register

- **Code assessment:** Pending. Requirement references from review: `LC-05, PAY-03/05/13`. Existing phase reference: 2 / 3.3.
- **Observed coverage:** Entity master exists; payroll/transfer processes do not.
- **Remaining:** Build this entity-transfer deliverable: input, draft, observation/review, final register, bank file, payslip/tax or JV/custom reports; prove payroll continuity.
- **Execution / database / screen / logic / tests:** [P02](03-PAYROLL-LOANS-CLAIMS.md), [P04](03-PAYROLL-LOANS-CLAIMS.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C06, C08, C11, C25, C30, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-099 — Payroll & compliance / original row 99

> Bank Transfer File

- **Code assessment:** Pending. Requirement references from review: `LC-05, PAY-03/05/13`. Existing phase reference: 2 / 3.3.
- **Observed coverage:** Entity master exists; payroll/transfer processes do not.
- **Remaining:** Build this entity-transfer deliverable: input, draft, observation/review, final register, bank file, payslip/tax or JV/custom reports; prove payroll continuity.
- **Execution / database / screen / logic / tests:** [P04](03-PAYROLL-LOANS-CLAIMS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-100 — Payroll & compliance / original row 100

> Payslip and Tax planner

- **Code assessment:** Pending. Requirement references from review: `LC-05, PAY-03/05/13`. Existing phase reference: 2 / 3.3.
- **Observed coverage:** Entity master exists; payroll/transfer processes do not.
- **Remaining:** Build this entity-transfer deliverable: input, draft, observation/review, final register, bank file, payslip/tax or JV/custom reports; prove payroll continuity.
- **Execution / database / screen / logic / tests:** [P03](03-PAYROLL-LOANS-CLAIMS.md), [P04](03-PAYROLL-LOANS-CLAIMS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-101 — Payroll & compliance / original row 101

> JV report, Standard report and Customised Reports

- **Code assessment:** Pending. Requirement references from review: `LC-05, PAY-03/05/13`. Existing phase reference: 2 / 3.3.
- **Observed coverage:** Entity master exists; payroll/transfer processes do not.
- **Remaining:** Build this entity-transfer deliverable: input, draft, observation/review, final register, bank file, payslip/tax or JV/custom reports; prove payroll continuity.
- **Execution / database / screen / logic / tests:** [P04](03-PAYROLL-LOANS-CLAIMS.md), [W04](05-WORKPLACE-AND-ANALYTICS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C01, C19, C25, C27, C30, C33 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-103 — Payroll & compliance / original row 103

> Mid-month new joiner

- **Code assessment:** Pending. Requirement references from review: `PAY-04/16`. Existing phase reference: 2.2.
- **Observed coverage:** Proration/retro methods are specified; only generic money rounding utilities exist.
- **Remaining:** Implement row-specific join/leave/LOP/reversal/divisor/legacy arrear behavior using signed settings and hand-computed payroll fixtures.
- **Execution / database / screen / logic / tests:** [P01](03-PAYROLL-LOANS-CLAIMS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`; `docs/04-MODULE-SPECS.md`

- **Deep code safety obligations:** C06, C08, C11, C25, C30, C31, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-104 — Payroll & compliance / original row 104

> Mid-month leaver

- **Code assessment:** Pending. Requirement references from review: `PAY-04/16`. Existing phase reference: 2.2.
- **Observed coverage:** Proration/retro methods are specified; only generic money rounding utilities exist.
- **Remaining:** Implement row-specific join/leave/LOP/reversal/divisor/legacy arrear behavior using signed settings and hand-computed payroll fixtures.
- **Execution / database / screen / logic / tests:** [P01](03-PAYROLL-LOANS-CLAIMS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md), [L04](04-LIFECYCLE-AND-FNF.md), [L05](04-LIFECYCLE-AND-FNF.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`; `docs/04-MODULE-SPECS.md`

- **Deep code safety obligations:** C06, C08, C11, C18, C20, C25, C30, C31, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-105 — Payroll & compliance / original row 105

> Loss of Pay calculations

- **Code assessment:** Pending. Requirement references from review: `PAY-04/16`. Existing phase reference: 2.2.
- **Observed coverage:** Proration/retro methods are specified; only generic money rounding utilities exist.
- **Remaining:** Implement row-specific join/leave/LOP/reversal/divisor/legacy arrear behavior using signed settings and hand-computed payroll fixtures.
- **Execution / database / screen / logic / tests:** [A02](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [A05](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md), [D05](08-DECISIONS-AND-OPERATIONS.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`; `docs/04-MODULE-SPECS.md`

- **Deep code safety obligations:** C06, C08, C10, C11, C12, C13, C15, C25, C30, C35, C36, C37 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-106 — Payroll & compliance / original row 106

> Loss of Pay reversals

- **Code assessment:** Pending. Requirement references from review: `PAY-04/16`. Existing phase reference: 2.2.
- **Observed coverage:** Proration/retro methods are specified; only generic money rounding utilities exist.
- **Remaining:** Implement row-specific join/leave/LOP/reversal/divisor/legacy arrear behavior using signed settings and hand-computed payroll fixtures.
- **Execution / database / screen / logic / tests:** [P02](03-PAYROLL-LOANS-CLAIMS.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`; `docs/04-MODULE-SPECS.md`

- **Deep code safety obligations:** C06, C08, C11, C25, C30, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-107 — Payroll & compliance / original row 107

> Previous month Loss of Pay

- **Code assessment:** Pending. Requirement references from review: `PAY-04/16`. Existing phase reference: 2.2.
- **Observed coverage:** Proration/retro methods are specified; only generic money rounding utilities exist.
- **Remaining:** Implement row-specific join/leave/LOP/reversal/divisor/legacy arrear behavior using signed settings and hand-computed payroll fixtures.
- **Execution / database / screen / logic / tests:** [A05](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md), [P07](03-PAYROLL-LOANS-CLAIMS.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`; `docs/04-MODULE-SPECS.md`

- **Deep code safety obligations:** C06, C08, C10, C11, C25, C30, C33, C35, C36, C37 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-109 — Payroll & compliance / original row 109

> Actual calendar days in the month

- **Code assessment:** Pending. Requirement references from review: `PAY-04/16`. Existing phase reference: 2.2.
- **Observed coverage:** Proration/retro methods are specified; only generic money rounding utilities exist.
- **Remaining:** Implement row-specific join/leave/LOP/reversal/divisor/legacy arrear behavior using signed settings and hand-computed payroll fixtures.
- **Execution / database / screen / logic / tests:** [A02](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`; `docs/04-MODULE-SPECS.md`

- **Deep code safety obligations:** C06, C08, C11, C12, C13, C15, C25, C30, C35, C37 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-110 — Payroll & compliance / original row 110

> Actual calendar days in the month less weekends

- **Code assessment:** Pending. Requirement references from review: `PAY-04/16`. Existing phase reference: 2.2.
- **Observed coverage:** Proration/retro methods are specified; only generic money rounding utilities exist.
- **Remaining:** Implement row-specific join/leave/LOP/reversal/divisor/legacy arrear behavior using signed settings and hand-computed payroll fixtures.
- **Execution / database / screen / logic / tests:** [A02](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`; `docs/04-MODULE-SPECS.md`

- **Deep code safety obligations:** C06, C08, C11, C12, C13, C15, C25, C30, C35, C37 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-111 — Payroll & compliance / original row 111

> Fixed days like 30, 31 (this cannot change between months) without decimals.

- **Code assessment:** Pending. Requirement references from review: `PAY-04/16`. Existing phase reference: 2.2.
- **Observed coverage:** Proration/retro methods are specified; only generic money rounding utilities exist.
- **Remaining:** Implement row-specific join/leave/LOP/reversal/divisor/legacy arrear behavior using signed settings and hand-computed payroll fixtures.
- **Execution / database / screen / logic / tests:** [A02](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`; `docs/04-MODULE-SPECS.md`

- **Deep code safety obligations:** C06, C08, C11, C12, C13, C15, C25, C30, C35, C37 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-113 — Payroll & compliance / original row 113

> Actual calendar days less alternate weekends

- **Code assessment:** Scope decision. Requirement references from review: `PAY-04`. Existing phase reference: Scope review / 2.2.
- **Observed coverage:** Source section heading at row 112 says these proration modes are NOT possible, although each has score 100%.
- **Remaining:** Keep as contractual exclusion/ambiguity until HR confirms intended scope. Do not count the historical 100% as a delivered capability.
- **Execution / database / screen / logic / tests:** [D08](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/01-REQUIREMENTS-PRD.md`; `docs/04-MODULE-SPECS.md`

- **Deep code safety obligations:**  — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-114 — Payroll & compliance / original row 114

> Actual calendar days less holidays

- **Code assessment:** Scope decision. Requirement references from review: `PAY-04`. Existing phase reference: Scope review / 2.2.
- **Observed coverage:** Source section heading at row 112 says these proration modes are NOT possible, although each has score 100%.
- **Remaining:** Keep as contractual exclusion/ambiguity until HR confirms intended scope. Do not count the historical 100% as a delivered capability.
- **Execution / database / screen / logic / tests:** [D08](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/01-REQUIREMENTS-PRD.md`; `docs/04-MODULE-SPECS.md`

- **Deep code safety obligations:**  — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-115 — Payroll & compliance / original row 115

> Fixed days that vary month on month.

- **Code assessment:** Scope decision. Requirement references from review: `PAY-04`. Existing phase reference: Scope review / 2.2.
- **Observed coverage:** Source section heading at row 112 says these proration modes are NOT possible, although each has score 100%.
- **Remaining:** Keep as contractual exclusion/ambiguity until HR confirms intended scope. Do not count the historical 100% as a delivered capability.
- **Execution / database / screen / logic / tests:** [D08](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/01-REQUIREMENTS-PRD.md`; `docs/04-MODULE-SPECS.md`

- **Deep code safety obligations:**  — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-116 — Payroll & compliance / original row 116

> If the period for which salary is pro rated pertains to the period prior to go live with vendor, then the client would need provide arrear break up component wise to enable vendor to include in the current month payroll.

- **Code assessment:** Pending. Requirement references from review: `PAY-04/16`. Existing phase reference: 2.2.
- **Observed coverage:** Proration/retro methods are specified; only generic money rounding utilities exist.
- **Remaining:** Implement row-specific join/leave/LOP/reversal/divisor/legacy arrear behavior using signed settings and hand-computed payroll fixtures.
- **Execution / database / screen / logic / tests:** [P01](03-PAYROLL-LOANS-CLAIMS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md), [P03](03-PAYROLL-LOANS-CLAIMS.md), [P07](03-PAYROLL-LOANS-CLAIMS.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`; `docs/04-MODULE-SPECS.md`

- **Deep code safety obligations:** C06, C08, C11, C25, C30, C31, C33, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-118 — Payroll & compliance / original row 118

> Vendor would handle the Loan scheduler with the following options:

- **Code assessment:** Pending. Requirement references from review: `LN-01/02/03, PAY-13`. Existing phase reference: 2.5.
- **Observed coverage:** Loans UI shell and generic loan workflow definition exist.
- **Remaining:** Implement schedulers, eligibility, EMI/payroll postings, advances and SBI perquisite valuation as applicable. Import and reconcile legacy SAP balances.
- **Execution / database / screen / logic / tests:** [P05](03-PAYROLL-LOANS-CLAIMS.md), [D10](08-DECISIONS-AND-OPERATIONS.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`; `frontend/src/pages/payroll/LoansPage.tsx`

- **Deep code safety obligations:** C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-119 — Payroll & compliance / original row 119

> Diminishing

- **Code assessment:** Pending. Requirement references from review: `LN-01/02/03, PAY-13`. Existing phase reference: 2.5.
- **Observed coverage:** Loans UI shell and generic loan workflow definition exist.
- **Remaining:** Implement schedulers, eligibility, EMI/payroll postings, advances and SBI perquisite valuation as applicable. Import and reconcile legacy SAP balances.
- **Execution / database / screen / logic / tests:** [P05](03-PAYROLL-LOANS-CLAIMS.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`; `frontend/src/pages/payroll/LoansPage.tsx`

- **Deep code safety obligations:** C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-120 — Payroll & compliance / original row 120

> Flat

- **Code assessment:** Pending. Requirement references from review: `LN-01/02/03, PAY-13`. Existing phase reference: 2.5.
- **Observed coverage:** Loans UI shell and generic loan workflow definition exist.
- **Remaining:** Implement schedulers, eligibility, EMI/payroll postings, advances and SBI perquisite valuation as applicable. Import and reconcile legacy SAP balances.
- **Execution / database / screen / logic / tests:** [P05](03-PAYROLL-LOANS-CLAIMS.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`; `frontend/src/pages/payroll/LoansPage.tsx`

- **Deep code safety obligations:** C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-121 — Payroll & compliance / original row 121

> Only EMI without Interest

- **Code assessment:** Pending. Requirement references from review: `LN-01/02/03, PAY-13`. Existing phase reference: 2.5.
- **Observed coverage:** Loans UI shell and generic loan workflow definition exist.
- **Remaining:** Implement schedulers, eligibility, EMI/payroll postings, advances and SBI perquisite valuation as applicable. Import and reconcile legacy SAP balances.
- **Execution / database / screen / logic / tests:** [P05](03-PAYROLL-LOANS-CLAIMS.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`; `frontend/src/pages/payroll/LoansPage.tsx`

- **Deep code safety obligations:** C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-122 — Payroll & compliance / original row 122

> vendor would calculate perquisites as per SBI lending rates. This is applicable only if the client provides the loan input to be recovered using vendor loan scheduler. If the client is giving the loan recovery amount month on month, then the client should provide the perquisite value.

- **Code assessment:** Pending. Requirement references from review: `LN-01/02/03, PAY-13`. Existing phase reference: 2.5.
- **Observed coverage:** Loans UI shell and generic loan workflow definition exist.
- **Remaining:** Implement schedulers, eligibility, EMI/payroll postings, advances and SBI perquisite valuation as applicable. Import and reconcile legacy SAP balances.
- **Execution / database / screen / logic / tests:** [P03](03-PAYROLL-LOANS-CLAIMS.md), [P05](03-PAYROLL-LOANS-CLAIMS.md), [D01](08-DECISIONS-AND-OPERATIONS.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`; `frontend/src/pages/payroll/LoansPage.tsx`

- **Deep code safety obligations:** C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-123 — Payroll & compliance / original row 123

> In order to claim tax exemption for Home Loan & Interest employees would need to submit relevant proof to claim under Section 24 during end of year process.

- **Code assessment:** Pending. Requirement references from review: `PAY-13`. Existing phase reference: 2.3.
- **Observed coverage:** Declarations/proof workflow is specified.
- **Remaining:** Build home-loan proof capture/verification and tax treatment; no declarations backend exists.
- **Execution / database / screen / logic / tests:** [P03](03-PAYROLL-LOANS-CLAIMS.md), [P06](03-PAYROLL-LOANS-CLAIMS.md), [D01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-124 — Payroll & compliance / original row 124

> Deductions against Salary advance should be provided as monthly inputs.

- **Code assessment:** Pending. Requirement references from review: `LN-01/02/03, PAY-13`. Existing phase reference: 2.5.
- **Observed coverage:** Loans UI shell and generic loan workflow definition exist.
- **Remaining:** Implement schedulers, eligibility, EMI/payroll postings, advances and SBI perquisite valuation as applicable. Import and reconcile legacy SAP balances.
- **Execution / database / screen / logic / tests:** [P02](03-PAYROLL-LOANS-CLAIMS.md), [P05](03-PAYROLL-LOANS-CLAIMS.md), [T02](06-TRAVEL-ATS-AND-MOBILE.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`; `frontend/src/pages/payroll/LoansPage.tsx`

- **Deep code safety obligations:** C06, C08, C11, C25, C30, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-125 — Payroll & compliance / original row 125

> Vendor will not liaise with any third parties to deduct or remit loans and advances.

- **Code assessment:** Manual / service. Requirement references from review: `SOW-5.5 exclusion`. Existing phase reference: Finance / service scope.
- **Observed coverage:** This is a vendor limitation: no third-party loan liaison.
- **Remaining:** Assign Finance/payroll responsibility for any third-party remittance. Not a software feature to mark built.
- **Execution / database / screen / logic / tests:** [P05](03-PAYROLL-LOANS-CLAIMS.md), [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** Finance / external lender liaison owner — Honor exclusion: no assumed vendor third-party remittance. Record authorized direct recovery/remittance owner and receipts if sponsor assigns it; P05 only posts approved salary recovery.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/01-REQUIREMENTS-PRD.md`

- **Deep code safety obligations:** C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-127 — Payroll & compliance / original row 127

> Throughout the month through Client portal

- **Code assessment:** Pending. Requirement references from review: `LC-01/02, PAY-07`. Existing phase reference: 3.1 / 2.1.
- **Observed coverage:** Employee directory exists; candidate conversion is pending.
- **Remaining:** Build approved new-joiner portal intake/conversion and salary availability.
- **Execution / database / screen / logic / tests:** [F02](01-DATA-AND-FOUNDATIONS.md), [L01](04-LIFECYCLE-AND-FNF.md), [R01](06-TRAVEL-ATS-AND-MOBILE.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C01, C16, C20, C21, C29, C30, C31 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-128 — Payroll & compliance / original row 128

> As part of monthly input through the excel format

- **Code assessment:** Partial. Requirement references from review: `CORE-12, PAY-07`. Existing phase reference: 0.5 / 2.1 / 3.1.
- **Observed coverage:** JSON-row EMS seed/greytHR enrich functions and sample fixtures exist.
- **Remaining:** Build/reconcile approved Excel monthly-new-joiner intake including payroll/salary data. Generic seed import is not that complete workflow.
- **Execution / database / screen / logic / tests:** [F02](01-DATA-AND-FOUNDATIONS.md), [F04](01-DATA-AND-FOUNDATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Fresh source qualification:** Import test cleanup is now fixture-scoped, and test setup uses a dedicated *_test URL. Validate isolation and real import completeness; do not recreate the old fixes.
- **Existing repository evidence:** `backend/src/modules/employees/import.service.ts`; `backend/src/modules/employees/import.schemas.ts`; `plans/phase-0-foundations.md`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C01, C09, C12, C14, C16, C17, C20, C21, C27, C29, C31, C33, C36 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-129 — Payroll & compliance / original row 129

> Through HR connector if integration is in scope

- **Code assessment:** Pending. Requirement references from review: `LC-01, PAY-07`. Existing phase reference: 3.1 / 4.
- **Observed coverage:** Connector-based ATS handoff is planned.
- **Remaining:** Implement agreed HR connector/ATS joined-list sync and mapping.
- **Execution / database / screen / logic / tests:** [F02](01-DATA-AND-FOUNDATIONS.md), [F04](01-DATA-AND-FOUNDATIONS.md), [L01](04-LIFECYCLE-AND-FNF.md), [R01](06-TRAVEL-ATS-AND-MOBILE.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `plans/phase-4-ats-absorption.md`

- **Deep code safety obligations:** C01, C09, C12, C14, C16, C17, C20, C21, C27, C29, C30, C31, C33, C36 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-130 — Payroll & compliance / original row 130

> New joiner details for the purpose of ESI IP generation need to be provided by the client once in a week. Flexi would be activated for new joiners after the first month payroll is processed.

- **Code assessment:** Manual / service. Requirement references from review: `PAY-10, LC-02`. Existing phase reference: HR / payroll operations.
- **Observed coverage:** Weekly ESI IP creation and flexi activation timing are vendor operating terms.
- **Remaining:** Assign an owner and record weekly submission/portal proof. Any flexi activation feature still needs the pending payroll/benefit implementation.
- **Execution / database / screen / logic / tests:** [F02](01-DATA-AND-FOUNDATIONS.md), [P01](03-PAYROLL-LOANS-CLAIMS.md), [P03](03-PAYROLL-LOANS-CLAIMS.md), [P06](03-PAYROLL-LOANS-CLAIMS.md), [L01](04-LIFECYCLE-AND-FNF.md), [D01](08-DECISIONS-AND-OPERATIONS.md), [D10](08-DECISIONS-AND-OPERATIONS.md), [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** HR joining / statutory / Payroll — Weekly sanctioned ESIC new-joiner/IP handoff with portal receipt; decide flex activation after first payroll under D10. P01/P06 implement the accepted timing, not this human duty.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:** C01, C16, C20, C21, C29, C30, C31, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-132 — Payroll & compliance / original row 132

> When client approves new joiner inputs via client portal

- **Code assessment:** Pending. Requirement references from review: `LC-02, PAY-07, NFR-03`. Existing phase reference: 3.1 / 2.
- **Observed coverage:** Seed import can create a login when source email/password hash is present.
- **Remaining:** Implement rule-driven new-joiner ESS activation on approved intake/first payroll/connector interval; verify access lifecycle.
- **Execution / database / screen / logic / tests:** [P02](03-PAYROLL-LOANS-CLAIMS.md), [P06](03-PAYROLL-LOANS-CLAIMS.md), [L01](04-LIFECYCLE-AND-FNF.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/employees/import.service.ts`; `backend/src/modules/employees/import.schemas.ts`; `plans/phase-0-foundations.md`; `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C01, C06, C08, C11, C16, C20, C25, C30, C31, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-133 — Payroll & compliance / original row 133

> After first month payroll is processed if inputs are provided through excel format

- **Code assessment:** Pending. Requirement references from review: `LC-02, PAY-07, NFR-03`. Existing phase reference: 3.1 / 2.
- **Observed coverage:** Seed import can create a login when source email/password hash is present.
- **Remaining:** Implement rule-driven new-joiner ESS activation on approved intake/first payroll/connector interval; verify access lifecycle.
- **Execution / database / screen / logic / tests:** [P02](03-PAYROLL-LOANS-CLAIMS.md), [P06](03-PAYROLL-LOANS-CLAIMS.md), [L01](04-LIFECYCLE-AND-FNF.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/employees/import.service.ts`; `backend/src/modules/employees/import.schemas.ts`; `plans/phase-0-foundations.md`; `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C01, C06, C08, C11, C16, C20, C25, C30, C31, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-134 — Payroll & compliance / original row 134

> At agreed interval if new joiner information is provided via HR connector

- **Code assessment:** Pending. Requirement references from review: `LC-02, PAY-07, NFR-03`. Existing phase reference: 3.1 / 2.
- **Observed coverage:** Seed import can create a login when source email/password hash is present.
- **Remaining:** Implement rule-driven new-joiner ESS activation on approved intake/first payroll/connector interval; verify access lifecycle.
- **Execution / database / screen / logic / tests:** [P02](03-PAYROLL-LOANS-CLAIMS.md), [P06](03-PAYROLL-LOANS-CLAIMS.md), [L01](04-LIFECYCLE-AND-FNF.md), [R01](06-TRAVEL-ATS-AND-MOBILE.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/employees/import.service.ts`; `backend/src/modules/employees/import.schemas.ts`; `plans/phase-0-foundations.md`; `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C01, C06, C08, C11, C16, C20, C25, C30, C31, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-136 — Payroll & compliance / original row 136

> Scenario 1 (Payment hold) - To hold payment of any specific salary(s) vendor will process salary as instructed by the Rashmi Metaliks Limited. The salary transfer details in bank file will be removed. All statutory payments (PF, PT, ESI, LWF) would be remitted normally. In order to release the salary, Protiviti implant should add the net pay value of the employee as part of respective month's input

- **Code assessment:** Pending. Requirement references from review: `PAY-08`. Existing phase reference: 2.2 / 2.4.
- **Observed coverage:** Salary hold scenarios are documented only.
- **Remaining:** Build the exact payment-hold/process-hold behavior, statutory continuity, bank exclusions, releases and LOP reversals.
- **Execution / database / screen / logic / tests:** [P02](03-PAYROLL-LOANS-CLAIMS.md), [P04](03-PAYROLL-LOANS-CLAIMS.md), [L05](04-LIFECYCLE-AND-FNF.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C06, C08, C11, C20, C25, C30, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-137 — Payroll & compliance / original row 137

> Scenario 2 (Process hold) - To hold processing of any specific salary(s) for absconding employees, etc., the Protiviti should include full month LOP input for this employee until the defined date. If the defined date is not known, Protiviti to give LOP input month on month. In order to release the salary, Protiviti should provide LOP reversal inputs in the respective month of release.

- **Code assessment:** Pending. Requirement references from review: `PAY-08`. Existing phase reference: 2.2 / 2.4.
- **Observed coverage:** Salary hold scenarios are documented only.
- **Remaining:** Build the exact payment-hold/process-hold behavior, statutory continuity, bank exclusions, releases and LOP reversals.
- **Execution / database / screen / logic / tests:** [P02](03-PAYROLL-LOANS-CLAIMS.md), [L05](04-LIFECYCLE-AND-FNF.md), [D10](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C06, C08, C11, C20, C25, C30, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-139 — Payroll & compliance / original row 139

> Vendor would provide documentation support for any internal Audits and third-party requirements

- **Code assessment:** Partial. Requirement references from review: `CORE-11, RPT-06, PAY-18`. Existing phase reference: 0.4 / 2 / service scope.
- **Observed coverage:** Append-only audit and several exports exist.
- **Remaining:** Complete payroll audit records/evidence and document actual internal/third-party audit support. Source code is not proof of vendor service delivery.
- **Execution / database / screen / logic / tests:** [F01](01-DATA-AND-FOUNDATIONS.md), [F04](01-DATA-AND-FOUNDATIONS.md), [A05](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [P04](03-PAYROLL-LOANS-CLAIMS.md), [W04](05-WORKPLACE-AND-ANALYTICS.md), [D12](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/core/audit/audit.service.ts`; `backend/src/modules/reports/reports-export.service.ts`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C01, C08, C09, C10, C11, C12, C14, C16, C17, C19, C20, C22, C23, C25, C27, C28, C29, C30, C33, C36, C37 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-140 — Payroll & compliance / original row 140

> Any data / reports requirement to support audit needs to be shared in advance with vendor and turnaround time to deliver will be mutually agreed.

- **Code assessment:** Manual / service. Requirement references from review: `SOW-5.8 service term`. Existing phase reference: HR / payroll operations.
- **Observed coverage:** Advance report notice/turnaround agreement is an operating clause.
- **Remaining:** Record requested report, agreed turnaround and delivery evidence with responsible HR/payroll owner.
- **Execution / database / screen / logic / tests:** [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** HR/Finance audit SPOC — Agree audit scope, secure data access, due date and delivery receipt; software export is P04/W04, agreed vendor turnaround remains manual.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`

- **Deep code safety obligations:**  — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-141 — Payroll & compliance / original row 141

> Payroll processing for Interns / Trainees and apply statutory contributions (including tax) as applicable.

- **Code assessment:** Pending. Requirement references from review: `PAY-14, CORE-05`. Existing phase reference: 2.3 / policy review.
- **Observed coverage:** Trainee/category flags exist; stipend payroll does not.
- **Remaining:** Build trainee/apprentice payroll and explicit applicability rules. Resolve SOW blanket statutory exclusion against doc 10 §9 before implementation.
- **Execution / database / screen / logic / tests:** [P01](03-PAYROLL-LOANS-CLAIMS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md), [P03](03-PAYROLL-LOANS-CLAIMS.md), [D01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:** C06, C08, C11, C25, C30, C31, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-142 — Payroll & compliance / original row 142

> Payroll processing for Apprentice as per the Apprenticeship act without any statutory deduction.

- **Code assessment:** Pending. Requirement references from review: `PAY-14, CORE-05`. Existing phase reference: 2.3 / policy review.
- **Observed coverage:** Trainee/category flags exist; stipend payroll does not.
- **Remaining:** Build trainee/apprentice payroll and explicit applicability rules. Resolve SOW blanket statutory exclusion against doc 10 §9 before implementation.
- **Execution / database / screen / logic / tests:** [P01](03-PAYROLL-LOANS-CLAIMS.md), [P02](03-PAYROLL-LOANS-CLAIMS.md), [P03](03-PAYROLL-LOANS-CLAIMS.md), [D01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:** C06, C08, C11, C25, C30, C31, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-143 — Payroll & compliance / original row 143

> Additional ad hoc/On Demand reports can be provided by vendor subject to feasibility. Timeline to build the report and commercials to be mutually agreed.

- **Code assessment:** Scope decision. Requirement references from review: `RPT-06; SOW-5.8 service term`. Existing phase reference: Scope review.
- **Observed coverage:** Fixed specified reports exist; no general ad-hoc report builder.
- **Remaining:** Agree each additional report, columns, feasibility and service/commercial terms. This clause does not authorize inventing a report-builder scope.
- **Execution / database / screen / logic / tests:** [W04](05-WORKPLACE-AND-ANALYTICS.md), [D08](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/06-REPORTS-AND-DASHBOARDS.md`

- **Deep code safety obligations:** C01, C19, C25, C27, C33 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-145 — Payroll & compliance / original row 145

> Monthly Income TDS deductions and tax reporting

- **Code assessment:** Pending. Requirement references from review: `PAY-13`. Existing phase reference: 2.3 / 2.4 / 2.6.
- **Observed coverage:** TDS/declaration/24Q/Form16/challan reconciliation are specified.
- **Remaining:** Build TDS calculations and row-specific output/reconciliation; confirm coverage beyond source note white collars. Humans file portal outputs.
- **Execution / database / screen / logic / tests:** [P03](03-PAYROLL-LOANS-CLAIMS.md), [D01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-146 — Payroll & compliance / original row 146

> Quarterly filings (Form 24Q) & Annual Form 16 generation

- **Code assessment:** Pending. Requirement references from review: `PAY-13`. Existing phase reference: 2.3 / 2.4 / 2.6.
- **Observed coverage:** TDS/declaration/24Q/Form16/challan reconciliation are specified.
- **Remaining:** Build TDS calculations and row-specific output/reconciliation; confirm coverage beyond source note white collars. Humans file portal outputs.
- **Execution / database / screen / logic / tests:** [P03](03-PAYROLL-LOANS-CLAIMS.md), [D01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-147 — Payroll & compliance / original row 147

> Reconciliation of tax deductions vs. paid challans

- **Code assessment:** Pending. Requirement references from review: `PAY-13`. Existing phase reference: 2.3 / 2.4 / 2.6.
- **Observed coverage:** TDS/declaration/24Q/Form16/challan reconciliation are specified.
- **Remaining:** Build TDS calculations and row-specific output/reconciliation; confirm coverage beyond source note white collars. Humans file portal outputs.
- **Execution / database / screen / logic / tests:** [P03](03-PAYROLL-LOANS-CLAIMS.md), [P04](03-PAYROLL-LOANS-CLAIMS.md), [D01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-149 — Payroll & compliance / original row 149

> UAN generation & KYC updating.

- **Code assessment:** Manual / service. Requirement references from review: `PAY-09; statutory operations`. Existing phase reference: Compliance operations.
- **Observed coverage:** These are government-portal updates, claims, inspection assistance or legislative-monitoring services. No service completion evidence was audited.
- **Remaining:** Assign compliance owner and retain portal acknowledgment/claim/notice evidence. HRMS file generation does not discharge these human duties.
- **Execution / database / screen / logic / tests:** [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** PF compliance owner — UAN/KYC portal submission and acknowledgment, employee mapping and authorized evidence; never assume generated UAN or OTP automation.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:**  — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-150 — Payroll & compliance / original row 150

> PF challan & return filing

- **Code assessment:** Pending. Requirement references from review: `PAY-09`. Existing phase reference: 2.3 / compliance operations.
- **Observed coverage:** PF register/ECR generation is specified, not implemented.
- **Remaining:** Build PF/ECR output and acceptance checks; named compliance owner uploads/pays and retains challan/return acknowledgment.
- **Execution / database / screen / logic / tests:** [P03](03-PAYROLL-LOANS-CLAIMS.md), [P04](03-PAYROLL-LOANS-CLAIMS.md), [D01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:** C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-151 — Payroll & compliance / original row 151

> Inspection support & statutory queries resolution.is received in the mobile number registered in the EPFO Portal

- **Code assessment:** Manual / service. Requirement references from review: `PAY-09; statutory operations`. Existing phase reference: Compliance operations.
- **Observed coverage:** These are government-portal updates, claims, inspection assistance or legislative-monitoring services. No service completion evidence was audited.
- **Remaining:** Assign compliance owner and retain portal acknowledgment/claim/notice evidence. HRMS file generation does not discharge these human duties.
- **Execution / database / screen / logic / tests:** [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** PF compliance / Legal — Case/inspection query, authorized response, submitted evidence and closure receipt.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:**  — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-152 — Payroll & compliance / original row 152

> EDLI Returns (Form 7IF) 

- **Code assessment:** Manual / service. Requirement references from review: `PAY-09; statutory operations`. Existing phase reference: Compliance operations.
- **Observed coverage:** These are government-portal updates, claims, inspection assistance or legislative-monitoring services. No service completion evidence was audited.
- **Remaining:** Assign compliance owner and retain portal acknowledgment/claim/notice evidence. HRMS file generation does not discharge these human duties.
- **Execution / database / screen / logic / tests:** [D01](08-DECISIONS-AND-OPERATIONS.md), [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** PF/EDLI compliance / Legal — Verify correct EDLI form/procedure and applicability before submission; source calls it Form 7IF. Retain case and official acknowledgment.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:**  — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-153 — Payroll & compliance / original row 153

> Date of Leaving updating – Date of leaving and the reason for leaving will be updated in the EPFO portal by Protiviti

- **Code assessment:** Manual / service. Requirement references from review: `PAY-09; statutory operations`. Existing phase reference: Compliance operations.
- **Observed coverage:** These are government-portal updates, claims, inspection assistance or legislative-monitoring services. No service completion evidence was audited.
- **Remaining:** Assign compliance owner and retain portal acknowledgment/claim/notice evidence. HRMS file generation does not discharge these human duties.
- **Execution / database / screen / logic / tests:** [L04](04-LIFECYCLE-AND-FNF.md), [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** PF compliance / HR exit — Approved LWD/reason from L04 matched to UAN; portal DOL update acknowledgment, not just HRMS employee status.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:** C18, C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-154 — Payroll & compliance / original row 154

> Form 5A updating (Ownership Details)

- **Code assessment:** Manual / service. Requirement references from review: `PAY-09; statutory operations`. Existing phase reference: Compliance operations.
- **Observed coverage:** These are government-portal updates, claims, inspection assistance or legislative-monitoring services. No service completion evidence was audited.
- **Remaining:** Assign compliance owner and retain portal acknowledgment/claim/notice evidence. HRMS file generation does not discharge these human duties.
- **Execution / database / screen / logic / tests:** [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** Company statutory owner — Approved ownership details and Form 5A submission/version/acknowledgment.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:**  — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-155 — Payroll & compliance / original row 155

> Modify Establishment Details

- **Code assessment:** Manual / service. Requirement references from review: `PAY-09; statutory operations`. Existing phase reference: Compliance operations.
- **Observed coverage:** These are government-portal updates, claims, inspection assistance or legislative-monitoring services. No service completion evidence was audited.
- **Remaining:** Assign compliance owner and retain portal acknowledgment/claim/notice evidence. HRMS file generation does not discharge these human duties.
- **Execution / database / screen / logic / tests:** [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** Company statutory owner — Sanctioned establishment change and portal acknowledgment; retain prior registration reference.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:**  — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-156 — Payroll & compliance / original row 156

> Joint Declaration Submission

- **Code assessment:** Manual / service. Requirement references from review: `PAY-09; statutory operations`. Existing phase reference: Compliance operations.
- **Observed coverage:** These are government-portal updates, claims, inspection assistance or legislative-monitoring services. No service completion evidence was audited.
- **Remaining:** Assign compliance owner and retain portal acknowledgment/claim/notice evidence. HRMS file generation does not discharge these human duties.
- **Execution / database / screen / logic / tests:** [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** PF compliance / employee liaison — Authorized joint declaration, supporting documents and submission/outcome record.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:**  — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-157 — Payroll & compliance / original row 157

> Death Claim Submission

- **Code assessment:** Manual / service. Requirement references from review: `PAY-09; statutory operations`. Existing phase reference: Compliance operations.
- **Observed coverage:** These are government-portal updates, claims, inspection assistance or legislative-monitoring services. No service completion evidence was audited.
- **Remaining:** Assign compliance owner and retain portal acknowledgment/claim/notice evidence. HRMS file generation does not discharge these human duties.
- **Execution / database / screen / logic / tests:** [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** PF/EDLI compliance / Legal — Authorized death-claim documents, claimant relationship and submission/outcome; restrict sensitive evidence.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:**  — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-158 — Payroll & compliance / original row 158

> Support in case of claim rejection by the EPFO

- **Code assessment:** Manual / service. Requirement references from review: `PAY-09; statutory operations`. Existing phase reference: Compliance operations.
- **Observed coverage:** These are government-portal updates, claims, inspection assistance or legislative-monitoring services. No service completion evidence was audited.
- **Remaining:** Assign compliance owner and retain portal acknowledgment/claim/notice evidence. HRMS file generation does not discharge these human duties.
- **Execution / database / screen / logic / tests:** [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** PF compliance / Legal — Claim rejection reference, reason, reviewed correction/appeal and official resolution.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:**  — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-159 — Payroll & compliance / original row 159

> Inspection Assistance / Response to the Notices

- **Code assessment:** Manual / service. Requirement references from review: `PAY-09; statutory operations`. Existing phase reference: Compliance operations.
- **Observed coverage:** These are government-portal updates, claims, inspection assistance or legislative-monitoring services. No service completion evidence was audited.
- **Remaining:** Assign compliance owner and retain portal acknowledgment/claim/notice evidence. HRMS file generation does not discharge these human duties.
- **Execution / database / screen / logic / tests:** [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** PF compliance / Legal — Notice due date, assigned responder, approved response/evidence and acknowledgment.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:**  — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-160 — Payroll & compliance / original row 160

> Legislative Notification / Amendments

- **Code assessment:** Manual / service. Requirement references from review: `PAY-09; statutory operations`. Existing phase reference: Compliance operations.
- **Observed coverage:** These are government-portal updates, claims, inspection assistance or legislative-monitoring services. No service completion evidence was audited.
- **Remaining:** Assign compliance owner and retain portal acknowledgment/claim/notice evidence. HRMS file generation does not discharge these human duties.
- **Execution / database / screen / logic / tests:** [P03](03-PAYROLL-LOANS-CLAIMS.md), [D01](08-DECISIONS-AND-OPERATIONS.md), [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** Legal/statutory policy owner — Track official amendment, effective applicability, reviewed policy/spec/setting update and affected historical/future runs; an AI browser result does not approve a rate.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:** C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-162 — Payroll & compliance / original row 162

> IP number generation, e-Pehchan card issuance.

- **Code assessment:** Manual / service. Requirement references from review: `PAY-10; statutory operations`. Existing phase reference: Compliance operations.
- **Observed coverage:** These involve ESIC portal registration/cards/returns, family updates, paid challans or office corrections.
- **Remaining:** Assign HR/compliance owner and retain actual portal/office receipts. Master family schema is not proof of ESIC portal submission.
- **Execution / database / screen / logic / tests:** [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** ESIC compliance / HR joining — Authorized IP generation/e-Pehchan issuance, employee mapping and portal evidence.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:**  — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-163 — Payroll & compliance / original row 163

> ESIC contributions reporting & challan generation

- **Code assessment:** Pending. Requirement references from review: `PAY-10`. Existing phase reference: 2.3 / compliance operations.
- **Observed coverage:** ESIC reporting/file generation is specified.
- **Remaining:** Build contribution-period engine and return/challan data export; human creates/remits portal challan and records proof.
- **Execution / database / screen / logic / tests:** [P03](03-PAYROLL-LOANS-CLAIMS.md), [P04](03-PAYROLL-LOANS-CLAIMS.md), [D01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-164 — Payroll & compliance / original row 164

> ESIC half-yearly submission & compliance audits

- **Code assessment:** Manual / service. Requirement references from review: `PAY-10; statutory operations`. Existing phase reference: Compliance operations.
- **Observed coverage:** These involve ESIC portal registration/cards/returns, family updates, paid challans or office corrections.
- **Remaining:** Assign HR/compliance owner and retain actual portal/office receipts. Master family schema is not proof of ESIC portal submission.
- **Execution / database / screen / logic / tests:** [D01](08-DECISIONS-AND-OPERATIONS.md), [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** ESIC compliance / Legal — Verify applicable return frequency/procedure; source half-yearly wording is historical. Retain submitted version, audit response and receipt.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:**  — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-165 — Payroll & compliance / original row 165

> Updating of family members details

- **Code assessment:** Manual / service. Requirement references from review: `PAY-10; statutory operations`. Existing phase reference: Compliance operations.
- **Observed coverage:** These involve ESIC portal registration/cards/returns, family updates, paid challans or office corrections.
- **Remaining:** Assign HR/compliance owner and retain actual portal/office receipts. Master family schema is not proof of ESIC portal submission.
- **Execution / database / screen / logic / tests:** [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** ESIC compliance / HR — Verified dependent/family changes and portal acknowledgment; own-data permissions and sensitive retention.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:**  — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-166 — Payroll & compliance / original row 166

> Sharing ESIC Remitted Challan – Once the payment is made, Rashmi Metaliks Limited to download the paid challan from the ESIC Portal.

- **Code assessment:** Manual / service. Requirement references from review: `PAY-10; statutory operations`. Existing phase reference: Compliance operations.
- **Observed coverage:** These involve ESIC portal registration/cards/returns, family updates, paid challans or office corrections.
- **Remaining:** Assign HR/compliance owner and retain actual portal/office receipts. Master family schema is not proof of ESIC portal submission.
- **Execution / database / screen / logic / tests:** [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** Finance / ESIC compliance — Client downloads paid challan; verify entity/period/amount/reference against P03 liability and payment, archive evidence.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:**  — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-167 — Payroll & compliance / original row 167

> Documents Submission to ESIC Office for Employee Name, DOJ & Gender Correction (Protiviti Presence location)

- **Code assessment:** Manual / service. Requirement references from review: `PAY-10; statutory operations`. Existing phase reference: Compliance operations.
- **Observed coverage:** These involve ESIC portal registration/cards/returns, family updates, paid challans or office corrections.
- **Remaining:** Assign HR/compliance owner and retain actual portal/office receipts. Master family schema is not proof of ESIC portal submission.
- **Execution / database / screen / logic / tests:** [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** ESIC compliance / HR — Verified name/DOJ/gender correction documents, authorized office submission and official accepted result.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:**  — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-168 — Payroll & compliance / original row 168

> Updating of Employer Details (Company Name, Address)

- **Code assessment:** Manual / service. Requirement references from review: `PAY-10; statutory operations`. Existing phase reference: Compliance operations.
- **Observed coverage:** These involve ESIC portal registration/cards/returns, family updates, paid challans or office corrections.
- **Remaining:** Assign HR/compliance owner and retain actual portal/office receipts. Master family schema is not proof of ESIC portal submission.
- **Execution / database / screen / logic / tests:** [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** Company statutory owner — Approved employer-name/address update and registration/portal acknowledgment.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:**  — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-170 — Payroll & compliance / original row 170

> PT computation, reporting & online remittance support

- **Code assessment:** Pending. Requirement references from review: `PAY-11`. Existing phase reference: 2.3 / compliance operations.
- **Observed coverage:** PT computation/register is specified.
- **Remaining:** Build configured PT engine/report; named compliance owner handles online remittance and proof.
- **Execution / database / screen / logic / tests:** [P03](03-PAYROLL-LOANS-CLAIMS.md), [P04](03-PAYROLL-LOANS-CLAIMS.md), [D01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-171 — Payroll & compliance / original row 171

> PT enrollment & renewal processing

- **Code assessment:** Manual / service. Requirement references from review: `PAY-11; statutory operations`. Existing phase reference: Compliance operations.
- **Observed coverage:** Enrollment, establishment tax/payment, acknowledged challans and notice support are human/service activities.
- **Remaining:** Confirm legal entity owner and retain enrollment/return/payment/notice evidence. Do not treat historical 100% as current completion.
- **Execution / database / screen / logic / tests:** [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** State PT compliance — Applicable enrollment/renewal approval, registration identifiers and receipt.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:**  — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-172 — Payroll & compliance / original row 172

> PT - Enrolment Certificate - Remittance

- **Code assessment:** Manual / service. Requirement references from review: `PAY-11; statutory operations`. Existing phase reference: Compliance operations.
- **Observed coverage:** Enrollment, establishment tax/payment, acknowledged challans and notice support are human/service activities.
- **Remaining:** Confirm legal entity owner and retain enrollment/return/payment/notice evidence. Do not treat historical 100% as current completion.
- **Execution / database / screen / logic / tests:** [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** Finance / State PT compliance — Enrollment certificate remittance applicability, payment approval and acknowledged receipt, separate from employee PT deductions.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:**  — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-173 — Payroll & compliance / original row 173

> PT - Enrolment Certificate - Returns

- **Code assessment:** Manual / service. Requirement references from review: `PAY-11; statutory operations`. Existing phase reference: Compliance operations.
- **Observed coverage:** Enrollment, establishment tax/payment, acknowledged challans and notice support are human/service activities.
- **Remaining:** Confirm legal entity owner and retain enrollment/return/payment/notice evidence. Do not treat historical 100% as current completion.
- **Execution / database / screen / logic / tests:** [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** State PT compliance — Enrollment-certificate return applicability/period, reviewed filing and acknowledgment.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:**  — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-174 — Payroll & compliance / original row 174

> Company Tax Remittance

- **Code assessment:** Manual / service. Requirement references from review: `PAY-11; statutory operations`. Existing phase reference: Compliance operations.
- **Observed coverage:** Enrollment, establishment tax/payment, acknowledged challans and notice support are human/service activities.
- **Remaining:** Confirm legal entity owner and retain enrollment/return/payment/notice evidence. Do not treat historical 100% as current completion.
- **Execution / database / screen / logic / tests:** [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** Finance / company tax owner — Identify jurisdiction/company tax obligation explicitly; do not fold into employee PT deduction by name. Payment evidence and reconciliation.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:**  — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-175 — Payroll & compliance / original row 175

> Sharing remitted /acknowledged challans

- **Code assessment:** Manual / service. Requirement references from review: `PAY-11; statutory operations`. Existing phase reference: Compliance operations.
- **Observed coverage:** Enrollment, establishment tax/payment, acknowledged challans and notice support are human/service activities.
- **Remaining:** Confirm legal entity owner and retain enrollment/return/payment/notice evidence. Do not treat historical 100% as current completion.
- **Execution / database / screen / logic / tests:** [P04](03-PAYROLL-LOANS-CLAIMS.md), [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** Finance / State PT compliance — Verified remitted/acknowledged challan by entity/period/amount and archived receipt.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:** C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-176 — Payroll & compliance / original row 176

> Inspection Assistance / Response to the Notices

- **Code assessment:** Manual / service. Requirement references from review: `PAY-11; statutory operations`. Existing phase reference: Compliance operations.
- **Observed coverage:** Enrollment, establishment tax/payment, acknowledged challans and notice support are human/service activities.
- **Remaining:** Confirm legal entity owner and retain enrollment/return/payment/notice evidence. Do not treat historical 100% as current completion.
- **Execution / database / screen / logic / tests:** [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** State PT compliance / Legal — Inspection/notice case, due date, approved response and official acknowledgment.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:**  — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-178 — Payroll & compliance / original row 178

> LWF data upload, challan generation & payment facilitation

- **Code assessment:** Pending. Requirement references from review: `PAY-12`. Existing phase reference: 2.3 / compliance operations.
- **Observed coverage:** LWF register/file generation is specified.
- **Remaining:** Build LWF periodic computation/export; compliance owner performs upload/challan/payment and stores receipts.
- **Execution / database / screen / logic / tests:** [P03](03-PAYROLL-LOANS-CLAIMS.md), [P04](03-PAYROLL-LOANS-CLAIMS.md), [D01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-179 — Payroll & compliance / original row 179

> LWF inspection assistance & compliance reporting

- **Code assessment:** Manual / service. Requirement references from review: `PAY-12; statutory operations`. Existing phase reference: Compliance operations.
- **Observed coverage:** LWF inspection assistance is a service duty, not established by repository code.
- **Remaining:** Assign owner; retain inspection response and compliance evidence.
- **Execution / database / screen / logic / tests:** [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** LWF compliance / Legal — Applicable welfare-board inspection/reporting requirement, reviewed response and acknowledgment.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md`

- **Deep code safety obligations:**  — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-181 — Payroll & compliance / original row 181

> providing Employee Access:
>   Payslips, tax computation slips, Form 16.
>   Investment declarations & reimbursement claims.
>   Tax calculator & helpdesk ticketing

- **Code assessment:** Partial. Requirement references from review: `PAY-06/13, CLM-02, HD-01`. Existing phase reference: 2 / 3.4.
- **Observed coverage:** Employee helpdesk and ESS shell exist.
- **Remaining:** Build payslip/tax/Form16 downloads, investment declarations, claims and tax calculator. Helpdesk ticket access also needs ownership checks.
- **Execution / database / screen / logic / tests:** [F03](01-DATA-AND-FOUNDATIONS.md), [P03](03-PAYROLL-LOANS-CLAIMS.md), [P04](03-PAYROLL-LOANS-CLAIMS.md), [P06](03-PAYROLL-LOANS-CLAIMS.md), [L05](04-LIFECYCLE-AND-FNF.md), [W02](05-WORKPLACE-AND-ANALYTICS.md), [W04](05-WORKPLACE-AND-ANALYTICS.md), [T02](06-TRAVEL-ATS-AND-MOBILE.md), [D03](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/helpdesk/helpdesk.router.ts`; `backend/src/modules/helpdesk/helpdesk.service.ts`; `backend/tests/helpdesk.integration.test.ts`; `frontend/src/pages/workplace/HelpdeskPage.tsx`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C01, C02, C03, C04, C05, C16, C19, C20, C21, C22, C23, C25, C26, C27, C28, C30, C32, C33, C34, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-182 — Payroll & compliance / original row 182

> providing HR & Payroll SPOC Access:
>   Bulk download of payroll & compliance reports.
>   Employee onboarding & document management.
>  Payroll discrepancy tracking & query resolution

- **Code assessment:** Partial. Requirement references from review: `CORE-09, LC-01, PAY-05, HD-01`. Existing phase reference: 2 / 3.1.
- **Observed coverage:** Letters archive, generic helpdesk and selected HR report exports exist.
- **Remaining:** Build payroll bulk/compliance downloads, full onboarding/document workflow and discrepancy tracking linked to payroll.
- **Execution / database / screen / logic / tests:** [F01](01-DATA-AND-FOUNDATIONS.md), [F03](01-DATA-AND-FOUNDATIONS.md), [P04](03-PAYROLL-LOANS-CLAIMS.md), [W02](05-WORKPLACE-AND-ANALYTICS.md), [W04](05-WORKPLACE-AND-ANALYTICS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/helpdesk/helpdesk.router.ts`; `backend/src/modules/helpdesk/helpdesk.service.ts`; `backend/tests/helpdesk.integration.test.ts`; `frontend/src/pages/workplace/HelpdeskPage.tsx`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`; `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`

- **Deep code safety obligations:** C01, C02, C03, C04, C05, C16, C17, C19, C21, C22, C23, C25, C26, C27, C28, C29, C30, C32, C33, C34 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-184 — Payroll & compliance / original row 184

> Annual Bonus & Increment Processing:

- **Code assessment:** Pending. Requirement references from review: `PAY-17/13`. Existing phase reference: 2.6.
- **Observed coverage:** Annual bonus/increment and tax year-end processes are specified.
- **Remaining:** Build bonus true-up/increments or year-end TDS adjustments and prove fixtures; annual use-case absence is not completion.
- **Execution / database / screen / logic / tests:** [P01](03-PAYROLL-LOANS-CLAIMS.md), [P07](03-PAYROLL-LOANS-CLAIMS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C30, C31, C33, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-185 — Payroll & compliance / original row 185

> Tax Deduction & Year-End Adjustments

- **Code assessment:** Pending. Requirement references from review: `PAY-17/13`. Existing phase reference: 2.6.
- **Observed coverage:** Annual bonus/increment and tax year-end processes are specified.
- **Remaining:** Build bonus true-up/increments or year-end TDS adjustments and prove fixtures; annual use-case absence is not completion.
- **Execution / database / screen / logic / tests:** [P03](03-PAYROLL-LOANS-CLAIMS.md), [P06](03-PAYROLL-LOANS-CLAIMS.md), [P07](03-PAYROLL-LOANS-CLAIMS.md), [D01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C30, C33 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-187 — Salary reimbursements / original row 187

> Protiviti team should provide the following:
> > Reimbursement bank transfer
> > Reimbursement Register
> > Submission of reimbursement pay slip to employees via the Platform.
> > Calculation of TDS on the unclaimed entitlement at the year end or as per the Client policy
> > Assistance for management and resolution of desk queries raised by employees.

- **Code assessment:** Pending. Requirement references from review: `CLM-01..06, PAY-06/13`. Existing phase reference: 2.5.
- **Observed coverage:** Claim/reimbursement page is a shell; generic helpdesk exists.
- **Remaining:** Build reimbursement bank transfer, register, payslip, year-end unsubstantiated entitlement tax and linked query support.
- **Execution / database / screen / logic / tests:** [P04](03-PAYROLL-LOANS-CLAIMS.md), [P06](03-PAYROLL-LOANS-CLAIMS.md), [W04](05-WORKPLACE-AND-ANALYTICS.md), [T01](06-TRAVEL-ATS-AND-MOBILE.md), [T02](06-TRAVEL-ATS-AND-MOBILE.md), [T03](06-TRAVEL-ATS-AND-MOBILE.md), [T04](06-TRAVEL-ATS-AND-MOBILE.md), [D10](08-DECISIONS-AND-OPERATIONS.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`; `frontend/src/pages/payroll/ClaimsPage.tsx`

- **Deep code safety obligations:** C01, C19, C25, C27, C30, C33, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-190 — Engagement / original row 190

> Broadcasting company news and updates in an engaging format.

- **Code assessment:** Partial. Requirement references from review: `EN-01`. Existing phase reference: 3.4.
- **Observed coverage:** Announcement publish/read/withdraw APIs and targeted ESS feed exist.
- **Remaining:** Build HR publisher console and delivery/read reach evidence; current page displays feed only.
- **Execution / database / screen / logic / tests:** [F04](01-DATA-AND-FOUNDATIONS.md), [W03](05-WORKPLACE-AND-ANALYTICS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/engagement/engagement.router.ts`; `frontend/src/pages/workplace/EngagementPage.tsx`; `plans/phase-3-lifecycle-assets-executive.md`

- **Deep code safety obligations:** C01, C09, C12, C14, C16, C17, C19, C20, C21, C27, C33, C34, C36 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-191 — Engagement / original row 191

> Enabling HR teams to share information and conduct opinion polls.

- **Code assessment:** Partial. Requirement references from review: `EN-02`. Existing phase reference: 3.4.
- **Observed coverage:** Poll create/respond/results/close APIs, audience and anonymity dedupe exist.
- **Remaining:** Build HR/employee polls UI and conduct real poll/UAT.
- **Execution / database / screen / logic / tests:** [W03](05-WORKPLACE-AND-ANALYTICS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/engagement/polls.service.ts`; `frontend/src/pages/workplace/EngagementPage.tsx`; `backend/tests/engagement.integration.test.ts`

- **Deep code safety obligations:** C01, C16, C19, C20, C21, C34, C36 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-193 — Engagement / original row 193

> Conducting structured surveys for feedback collection.

- **Code assessment:** Partial. Requirement references from review: `EN-03`. Existing phase reference: 3.4 / scope review.
- **Observed coverage:** Poll engine supports kind=pulse and anonymous results.
- **Remaining:** Build pulse-survey UI; multi-question structured survey support is not evidenced by single-question/options contract. Confirm required scope.
- **Execution / database / screen / logic / tests:** [W03](05-WORKPLACE-AND-ANALYTICS.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Fresh source qualification:** Single-question pulse API is not the full doc03 structured multi-question survey. Decide D11 before a second survey schema.
- **Existing repository evidence:** `backend/src/modules/engagement/engagement.router.ts`; `frontend/src/pages/workplace/EngagementPage.tsx`

- **Deep code safety obligations:** C01, C16, C19, C20, C21, C34, C36 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-194 — Engagement / original row 194

> HR receives data-driven recommendations for improvements.

- **Code assessment:** Scope decision. Requirement references from review: `EN-03; no explicit recommendation-engine requirement`. Existing phase reference: Scope review.
- **Observed coverage:** Basic poll tallies/comments exist; no recommendation engine found.
- **Remaining:** Clarify whether this means HR interpretation of survey results or new automated recommendations. Record scope before building.
- **Execution / database / screen / logic / tests:** [W03](05-WORKPLACE-AND-ANALYTICS.md), [W04](05-WORKPLACE-AND-ANALYTICS.md), [D08](08-DECISIONS-AND-OPERATIONS.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `docs/01-REQUIREMENTS-PRD.md`; `backend/src/modules/engagement/polls.service.ts`

- **Deep code safety obligations:** C01, C16, C19, C20, C21, C25, C27, C33, C34, C36 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-197 — Assets / original row 197

> Platform for Asset Assignment

- **Code assessment:** Implemented. Requirement references from review: `AST-01..03`. Existing phase reference: 3.3.
- **Observed coverage:** Asset register/search, holder assignments, employee/third-party XOR and UI allocation exist.
- **Remaining:** Accept real asset inventory and Admin UAT; production rollout remains.
- **Execution / database / screen / logic / tests:** [W01](05-WORKPLACE-AND-ANALYTICS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Closure condition:** preserve this implementation; prove the linked acceptance and scoped real-data/UAT evidence before treating the SOW duty or stage as accepted.
- **Existing repository evidence:** `backend/src/modules/assets/assets.router.ts`; `backend/src/modules/assets/assets.service.ts`; `backend/tests/assets.integration.test.ts`; `frontend/src/pages/workplace/AssetsPage.tsx`

- **Deep code safety obligations:** C01, C18, C21, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-198 — Assets / original row 198

> Platform for management of Employee Asset Directory

- **Code assessment:** Implemented. Requirement references from review: `AST-01..03`. Existing phase reference: 3.3.
- **Observed coverage:** Asset register/search, holder assignments, employee/third-party XOR and UI allocation exist.
- **Remaining:** Accept real asset inventory and Admin UAT; production rollout remains.
- **Execution / database / screen / logic / tests:** [W01](05-WORKPLACE-AND-ANALYTICS.md), [W04](05-WORKPLACE-AND-ANALYTICS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Closure condition:** preserve this implementation; prove the linked acceptance and scoped real-data/UAT evidence before treating the SOW duty or stage as accepted.
- **Existing repository evidence:** `backend/src/modules/assets/assets.router.ts`; `backend/src/modules/assets/assets.service.ts`; `backend/tests/assets.integration.test.ts`; `frontend/src/pages/workplace/AssetsPage.tsx`

- **Deep code safety obligations:** C01, C18, C19, C21, C25, C27, C33, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-200 — Assets / original row 200

> Platform for Asset Maintenance Scheduling

- **Code assessment:** Partial. Requirement references from review: `AST-06`. Existing phase reference: 3.3.
- **Observed coverage:** Maintenance API/trail stores scheduled date and cost.
- **Remaining:** Build maintenance scheduling UI, recurring reminders/status completion as agreed; asset page currently only register/allocate/return/outstanding.
- **Execution / database / screen / logic / tests:** [W01](05-WORKPLACE-AND-ANALYTICS.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/assets/assets.router.ts`; `backend/src/modules/assets/assets.service.ts`; `backend/tests/assets.integration.test.ts`; `frontend/src/pages/workplace/AssetsPage.tsx`

- **Deep code safety obligations:** C01, C18, C21, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-201 — Assets / original row 201

> Platform for Incident & Damage Reporting

- **Code assessment:** Partial. Requirement references from review: `AST-06`. Existing phase reference: 3.3 / 3.2.
- **Observed coverage:** Maintenance API records incident/damage/loss; damaged return routes to maintenance.
- **Remaining:** Build dedicated incident/damage reporting UI and recovery linkage to payroll/F&F.
- **Execution / database / screen / logic / tests:** [W01](05-WORKPLACE-AND-ANALYTICS.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/assets/assets.router.ts`; `backend/src/modules/assets/assets.service.ts`; `backend/tests/assets.integration.test.ts`; `frontend/src/pages/workplace/AssetsPage.tsx`; `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`

- **Deep code safety obligations:** C01, C18, C21, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-203 — Assets / original row 203

> Platform for Asset Return Process

- **Code assessment:** Implemented. Requirement references from review: `AST-04`. Existing phase reference: 3.3.
- **Observed coverage:** Return drawer and API record ok/damaged/not_returned and assignment state.
- **Remaining:** Prove actual exit integration/clearance in Stage 3.2; asset-return capability itself exists.
- **Execution / database / screen / logic / tests:** [W01](05-WORKPLACE-AND-ANALYTICS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Closure condition:** preserve this implementation; prove the linked acceptance and scoped real-data/UAT evidence before treating the SOW duty or stage as accepted.
- **Existing repository evidence:** `backend/src/modules/assets/assets.router.ts`; `backend/src/modules/assets/assets.service.ts`; `backend/tests/assets.integration.test.ts`; `frontend/src/pages/workplace/AssetsPage.tsx`

- **Deep code safety obligations:** C01, C18, C21, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-204 — Assets / original row 204

> Platform for Clearance Workflows

- **Code assessment:** Partial. Requirement references from review: `AST-04, LC-06`. Existing phase reference: 3.2 / 3.3.
- **Observed coverage:** Open employee holdings lookup and leaver outstanding list exist.
- **Remaining:** Build clearance fan-out/approvals and enforce asset disposition before Admin clearance/F&F. Asset lookup alone is not the workflow.
- **Execution / database / screen / logic / tests:** [L04](04-LIFECYCLE-AND-FNF.md), [W01](05-WORKPLACE-AND-ANALYTICS.md), [W04](05-WORKPLACE-AND-ANALYTICS.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Fresh source qualification:** Existing asset allocation/return/loss services do not establish separation clearance integration; explicit evidence and approved recovery link remain.
- **Existing repository evidence:** `backend/src/modules/assets/assets.router.ts`; `backend/src/modules/assets/assets.service.ts`; `backend/tests/assets.integration.test.ts`; `frontend/src/pages/workplace/AssetsPage.tsx`; `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`

- **Deep code safety obligations:** C01, C18, C19, C21, C25, C27, C30, C33, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-205 — Assets / original row 205

> Platform for Lost or Unreturned Assets Management

- **Code assessment:** Partial. Requirement references from review: `AST-05/06`. Existing phase reference: 3.3 / 3.2.
- **Observed coverage:** Lost trail prevents allocation; leaver non-returned list and export exist.
- **Remaining:** Expose loss handling/disposition UI and integrate recovery/write-off with clearance/payroll.
- **Execution / database / screen / logic / tests:** [L04](04-LIFECYCLE-AND-FNF.md), [W01](05-WORKPLACE-AND-ANALYTICS.md), [W04](05-WORKPLACE-AND-ANALYTICS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/assets/assets.router.ts`; `backend/src/modules/assets/assets.service.ts`; `backend/tests/assets.integration.test.ts`; `frontend/src/pages/workplace/AssetsPage.tsx`; `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`

- **Deep code safety obligations:** C01, C18, C19, C21, C25, C27, C30, C33, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-208 — Helpdesk / original row 208

> Ticket Categories: Categorization of queries

- **Code assessment:** Implemented. Requirement references from review: `HD-01`. Existing phase reference: 3.4.
- **Observed coverage:** Category catalog with data-driven SLA/routing role is available in API and ticket UI.
- **Remaining:** Accept HR/IT/payroll categories and routing ownership in UAT.
- **Execution / database / screen / logic / tests:** [W02](05-WORKPLACE-AND-ANALYTICS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Closure condition:** preserve this implementation; prove the linked acceptance and scoped real-data/UAT evidence before treating the SOW duty or stage as accepted.
- **Existing repository evidence:** `backend/src/modules/helpdesk/helpdesk.router.ts`; `backend/src/modules/helpdesk/helpdesk.service.ts`; `backend/tests/helpdesk.integration.test.ts`; `frontend/src/pages/workplace/HelpdeskPage.tsx`

- **Deep code safety obligations:** C16, C21, C26, C27 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-209 — Helpdesk / original row 209

> Platform Auto-Acknowledgment & Assignment: 

- **Code assessment:** Partial. Requirement references from review: `HD-01, WF-02`. Existing phase reference: 3.4.
- **Observed coverage:** Raise transaction sets SLA/acknowledgment and resolves assignee from category role.
- **Remaining:** Prove delivered acknowledgment/assignment notification, handle vacant assignee, and align business permission requirement.
- **Execution / database / screen / logic / tests:** [F04](01-DATA-AND-FOUNDATIONS.md), [W02](05-WORKPLACE-AND-ANALYTICS.md), [D04](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Fresh source qualification:** Dev notification log is not production acknowledgment. SMTP/storage/drain/queue creation and actual delivery proof remain F04.
- **Existing repository evidence:** `backend/src/modules/helpdesk/helpdesk.router.ts`; `backend/src/modules/helpdesk/helpdesk.service.ts`; `backend/tests/helpdesk.integration.test.ts`; `frontend/src/pages/workplace/HelpdeskPage.tsx`; `backend/src/modules/notifications/notifications.service.ts`; `backend/src/jobs/worker.ts`

- **Deep code safety obligations:** C09, C12, C14, C16, C17, C20, C21, C26, C27, C33, C36 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-211 — Helpdesk / original row 211

> Escalation Matrix: Automated escalation of unresolved tickets based on pre-set SLAs

- **Code assessment:** Partial. Requirement references from review: `HD-01, WF-03`. Existing phase reference: 3.4.
- **Observed coverage:** Hourly sweep increments escalation level and queues same-assignee alert.
- **Remaining:** Implement actual escalation matrix/new responsible recipient; worker createQueue list omits helpdesk/KPI queue names. Prove clean-DB scheduler boot and real delivery.
- **Execution / database / screen / logic / tests:** [F04](01-DATA-AND-FOUNDATIONS.md), [W02](05-WORKPLACE-AND-ANALYTICS.md), [D04](08-DECISIONS-AND-OPERATIONS.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Fresh source qualification:** Current sweep notifies same assignee; an effective higher escalation recipient matrix and historical breach event evidence remain.
- **Existing repository evidence:** `backend/src/modules/helpdesk/helpdesk.router.ts`; `backend/src/modules/helpdesk/helpdesk.service.ts`; `backend/tests/helpdesk.integration.test.ts`; `frontend/src/pages/workplace/HelpdeskPage.tsx`; `backend/src/jobs/worker.ts`

- **Deep code safety obligations:** C09, C12, C14, C16, C17, C20, C21, C26, C27, C33, C36 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-213 — Helpdesk / original row 213

> Real-time tracking of open, pending, and resolved tickets.

- **Code assessment:** Partial. Requirement references from review: `HD-01, CORE-10`. Existing phase reference: 3.4.
- **Observed coverage:** Employee own list and agent queue support open/pending/resolved/closed.
- **Remaining:** Add ticket-owner/assignee authorization to thread/reply and category/org scoping where required; then prove negative access fixtures.
- **Execution / database / screen / logic / tests:** [W02](05-WORKPLACE-AND-ANALYTICS.md), [W04](05-WORKPLACE-AND-ANALYTICS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/helpdesk/helpdesk.router.ts`; `backend/src/modules/helpdesk/helpdesk.service.ts`; `backend/tests/helpdesk.integration.test.ts`; `frontend/src/pages/workplace/HelpdeskPage.tsx`

- **Deep code safety obligations:** C01, C16, C19, C21, C25, C26, C27, C33 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-214 — Helpdesk / original row 214

> Monthly Performance Reports

- **Code assessment:** Partial. Requirement references from review: `HD-01, RPT-06`. Existing phase reference: 3.4.
- **Observed coverage:** Monthly category report and Excel exist.
- **Remaining:** Add assignee/SLA-hit reporting per doc 04; retain historic breach facts so resolved late tickets do not disappear from breached count.
- **Execution / database / screen / logic / tests:** [W02](05-WORKPLACE-AND-ANALYTICS.md), [W04](05-WORKPLACE-AND-ANALYTICS.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Fresh source qualification:** Performance queries do not yet establish complete historical SLA hit-rate semantics. Closed breached tickets remain in the denominator.
- **Existing repository evidence:** `backend/src/modules/helpdesk/helpdesk.router.ts`; `backend/src/modules/helpdesk/helpdesk.service.ts`; `backend/tests/helpdesk.integration.test.ts`; `frontend/src/pages/workplace/HelpdeskPage.tsx`; `docs/04-MODULE-SPECS.md`

- **Deep code safety obligations:** C01, C16, C19, C21, C25, C26, C27, C33 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-216 — Helpdesk / original row 216

> Helpdesk Query Logs

- **Code assessment:** Implemented. Requirement references from review: `HD-01, CORE-11`. Existing phase reference: 3.4.
- **Observed coverage:** Ticket-message history is append-only via migration trigger.
- **Remaining:** Close ticket read/reply authorization gap; prove production retention and UAT.
- **Execution / database / screen / logic / tests:** [W02](05-WORKPLACE-AND-ANALYTICS.md), [W04](05-WORKPLACE-AND-ANALYTICS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Fresh source qualification:** Query-thread code exists; subject/author authorization still must be repaired before capability release.
- **Closure condition:** preserve this implementation; prove the linked acceptance and scoped real-data/UAT evidence before treating the SOW duty or stage as accepted.
- **Existing repository evidence:** `backend/src/modules/helpdesk/helpdesk.router.ts`; `backend/src/modules/helpdesk/helpdesk.service.ts`; `backend/tests/helpdesk.integration.test.ts`; `frontend/src/pages/workplace/HelpdeskPage.tsx`; `backend/migrations/1751990000000_helpdesk-engagement.ts`

- **Deep code safety obligations:** C01, C16, C19, C21, C25, C26, C27, C33 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-217 — Helpdesk / original row 217

> Regulatory Query Handling

- **Code assessment:** Manual / service. Requirement references from review: `HD-01; regulatory operations`. Existing phase reference: Compliance operations.
- **Observed coverage:** Generic helpdesk can record queries; specialist regulatory responses are human services.
- **Remaining:** Assign qualified compliance owner and retain response/closure evidence; ticketing alone does not prove regulatory resolution.
- **Execution / database / screen / logic / tests:** [W02](05-WORKPLACE-AND-ANALYTICS.md), [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** HR statutory/Legal helpdesk owner — Route regulatory ticket to authorized human; record reviewed advice/response/evidence; helpdesk does not autonomously decide law.
- **Existing repository evidence:** `backend/src/modules/helpdesk/helpdesk.router.ts`; `backend/src/modules/helpdesk/helpdesk.service.ts`; `backend/tests/helpdesk.integration.test.ts`; `frontend/src/pages/workplace/HelpdeskPage.tsx`; `Documention_ProtiVity/SOW Tracker .xlsx`

- **Deep code safety obligations:** C16, C21, C26, C27 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-218 — Helpdesk / original row 218

> Employee & Case Management

- **Code assessment:** Partial. Requirement references from review: `HD-01, ATT-10, LC-06`. Existing phase reference: 3.4 / scope review.
- **Observed coverage:** Ticket threads and absence-case queue exist.
- **Remaining:** Finish secure employee/case access and connect relevant lifecycle/payroll cases. Agree whether SOW refers only to helpdesk cases.
- **Execution / database / screen / logic / tests:** [F04](01-DATA-AND-FOUNDATIONS.md), [L04](04-LIFECYCLE-AND-FNF.md), [W02](05-WORKPLACE-AND-ANALYTICS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `backend/src/modules/helpdesk/helpdesk.router.ts`; `backend/src/modules/helpdesk/helpdesk.service.ts`; `backend/tests/helpdesk.integration.test.ts`; `frontend/src/pages/workplace/HelpdeskPage.tsx`; `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`

- **Deep code safety obligations:** C09, C12, C14, C16, C17, C18, C20, C21, C26, C27, C30, C33, C36 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-221 — Final settlement / original row 221

> Settlement Input in Excel Format as shared by Protiviti viz – Number of days payable, Salary hold release, Leave Encashment days/Notice Pay recovery, Other Payments& Deductions, Gratuity, LTA claimed in previous employment

- **Code assessment:** Pending. Requirement references from review: `PAY-15/13, CLM-02, LC-06/07`. Existing phase reference: 3.2.
- **Observed coverage:** F&F/alumni are specified; lifecycle/payroll shells only.
- **Remaining:** Build the row-specific settlement input, proof/claim submission, reviewed workings, approved deliverables, two monthly cycles, configurable signed TAT or alumni download access. Full F&F pipeline is absent.
- **Execution / database / screen / logic / tests:** [A04](02-ATTENDANCE-LEAVE-WORKFLOWS.md), [P05](03-PAYROLL-LOANS-CLAIMS.md), [L04](04-LIFECYCLE-AND-FNF.md), [L05](04-LIFECYCLE-AND-FNF.md), [D10](08-DECISIONS-AND-OPERATIONS.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C01, C02, C04, C06, C07, C08, C09, C10, C13, C18, C20, C21, C25, C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-222 — Final settlement / original row 222

> Communication Protocol: SFTP/ Protiviti’s CRM/ Rashmi Metaliks Limited Portal

- **Code assessment:** Scope decision. Requirement references from review: `SOW-10.1 protocol; LC-06`. Existing phase reference: Scope review / 3.2.
- **Observed coverage:** SFTP/vendor CRM communication is a vendor operating clause; HRMS portal is planned.
- **Remaining:** Confirm retained portal/exchange protocol and evidence requirements under custom replacement. No SFTP/vendor CRM implementation evidenced.
- **Execution / database / screen / logic / tests:** [F04](01-DATA-AND-FOUNDATIONS.md), [D08](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`

- **Deep code safety obligations:** C09, C12, C14, C16, C17, C20, C27, C33, C36 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-223 — Final settlement / original row 223

> Rashmi Metaliks Limited Employees to update investment proofs in ESS portal and submit any pending reimbursement claims

- **Code assessment:** Pending. Requirement references from review: `PAY-15/13, CLM-02, LC-06/07`. Existing phase reference: 3.2.
- **Observed coverage:** F&F/alumni are specified; lifecycle/payroll shells only.
- **Remaining:** Build the row-specific settlement input, proof/claim submission, reviewed workings, approved deliverables, two monthly cycles, configurable signed TAT or alumni download access. Full F&F pipeline is absent.
- **Execution / database / screen / logic / tests:** [P03](03-PAYROLL-LOANS-CLAIMS.md), [P06](03-PAYROLL-LOANS-CLAIMS.md), [L04](04-LIFECYCLE-AND-FNF.md), [L05](04-LIFECYCLE-AND-FNF.md), [T02](06-TRAVEL-ATS-AND-MOBILE.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C18, C20, C30, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-224 — Final settlement / original row 224

> Protiviti should process payroll based on clarifications received (post verification of investment proofs and reimbursement claims submitted) and share the Final Settlement workings for confirmation

- **Code assessment:** Pending. Requirement references from review: `PAY-15/13, CLM-02, LC-06/07`. Existing phase reference: 3.2.
- **Observed coverage:** F&F/alumni are specified; lifecycle/payroll shells only.
- **Remaining:** Build the row-specific settlement input, proof/claim submission, reviewed workings, approved deliverables, two monthly cycles, configurable signed TAT or alumni download access. Full F&F pipeline is absent.
- **Execution / database / screen / logic / tests:** [P02](03-PAYROLL-LOANS-CLAIMS.md), [P03](03-PAYROLL-LOANS-CLAIMS.md), [P06](03-PAYROLL-LOANS-CLAIMS.md), [L04](04-LIFECYCLE-AND-FNF.md), [L05](04-LIFECYCLE-AND-FNF.md), [D01](08-DECISIONS-AND-OPERATIONS.md), [D10](08-DECISIONS-AND-OPERATIONS.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C06, C08, C11, C18, C20, C25, C30, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-225 — Final settlement / original row 225

> On receipt of confirmation, the following deliverables to be shared with the Rashmi Metaliks Limited SPOC

- **Code assessment:** Pending. Requirement references from review: `PAY-15/13, CLM-02, LC-06/07`. Existing phase reference: 3.2.
- **Observed coverage:** F&F/alumni are specified; lifecycle/payroll shells only.
- **Remaining:** Build the row-specific settlement input, proof/claim submission, reviewed workings, approved deliverables, two monthly cycles, configurable signed TAT or alumni download access. Full F&F pipeline is absent.
- **Execution / database / screen / logic / tests:** [P04](03-PAYROLL-LOANS-CLAIMS.md), [L05](04-LIFECYCLE-AND-FNF.md), [W04](05-WORKPLACE-AND-ANALYTICS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Existing repository evidence:** `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C01, C19, C20, C25, C27, C30, C33 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-227 — Final settlement / original row 227

> Protiviti should offers 2 Full and Final cycle.

- **Code assessment:** Pending. Requirement references from review: `PAY-15/13, CLM-02, LC-06/07`. Existing phase reference: 3.2.
- **Observed coverage:** F&F/alumni are specified; lifecycle/payroll shells only.
- **Remaining:** Build the row-specific settlement input, proof/claim submission, reviewed workings, approved deliverables, two monthly cycles, configurable signed TAT or alumni download access. Full F&F pipeline is absent.
- **Execution / database / screen / logic / tests:** [P02](03-PAYROLL-LOANS-CLAIMS.md), [L05](04-LIFECYCLE-AND-FNF.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Fresh source qualification:** Two F&F cycles require an approved run/version key; baseline unique company/month/type cannot be accepted blindly.
- **Existing repository evidence:** `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C06, C08, C11, C20, C25, C30, C35 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-228 — Final settlement / original row 228

> The turnaround time to process Full and Final is 3 working days.

- **Code assessment:** Pending. Requirement references from review: `PAY-15/13, CLM-02, LC-06/07`. Existing phase reference: 3.2.
- **Observed coverage:** F&F/alumni are specified; lifecycle/payroll shells only.
- **Remaining:** Build the row-specific settlement input, proof/claim submission, reviewed workings, approved deliverables, two monthly cycles, configurable signed TAT or alumni download access. Full F&F pipeline is absent.
- **Execution / database / screen / logic / tests:** [L05](04-LIFECYCLE-AND-FNF.md), [D01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Fresh source qualification:** Separate internal vendor turnaround from applicable statutory wage deadline, with Legal confirmation; see D01/D11.
- **Existing repository evidence:** `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`

- **Deep code safety obligations:** C20, C30 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-229 — Final settlement / original row 229

> Protiviti would not interact with resigned employees and details
> would be shared only to SPOC.

- **Code assessment:** Manual / service. Requirement references from review: `SOW-10.2 communication restriction`. Existing phase reference: HR / payroll operations.
- **Observed coverage:** Only-SPOC communication is a vendor service/privacy term.
- **Remaining:** Confirm who handles exited-employee contact in the replacement; retain agreed SOP. It is not a shipped software feature.
- **Execution / database / screen / logic / tests:** [F04](01-DATA-AND-FOUNDATIONS.md), [L05](04-LIFECYCLE-AND-FNF.md), [M01](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Human responsibility and evidence:** RML F&F SPOC / contracted provider — Source vendor communicates only via SPOC. Record contracted communication protocol; alumni own access remains separate L05/D03 decision. No unsolicited messages to resigned employees.
- **Existing repository evidence:** `Documention_ProtiVity/SOW Tracker .xlsx`; `docs/08-ROLES-AND-PERMISSIONS.md`

- **Deep code safety obligations:** C09, C12, C14, C16, C17, C20, C27, C30, C33, C36 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.


## SOW-230 — Final settlement / original row 230

> “Alumni portal” access to exit employees need to be
> confirmedly Rashmi Metaliks Limited for RML to download

- **Code assessment:** Pending. Requirement references from review: `PAY-15/13, CLM-02, LC-06/07`. Existing phase reference: 3.2.
- **Observed coverage:** F&F/alumni are specified; lifecycle/payroll shells only.
- **Remaining:** Build the row-specific settlement input, proof/claim submission, reviewed workings, approved deliverables, two monthly cycles, configurable signed TAT or alumni download access. Full F&F pipeline is absent.
- **Execution / database / screen / logic / tests:** [F03](01-DATA-AND-FOUNDATIONS.md), [P04](03-PAYROLL-LOANS-CLAIMS.md), [L05](04-LIFECYCLE-AND-FNF.md), [D03](08-DECISIONS-AND-OPERATIONS.md), [D11](08-DECISIONS-AND-OPERATIONS.md). Follow the corresponding existing stage boundaries; decisions must be closed before dependent branches.
- **Fresh source qualification:** Alumni restricted own-document access conflicts with disable-on-exit wording. Resolve centrally, do not bypass authentication.
- **Existing repository evidence:** `plans/phase-3-lifecycle-assets-executive.md`; `backend/src/modules/lifecycle/lifecycle.router.ts`; `frontend/src/pages/lifecycle/LifecyclePage.tsx`; `plans/phase-2-payroll-statutory.md`; `backend/src/api/router.ts`; `frontend/src/pages/payroll/PayrollPage.tsx`


- **Deep code safety obligations:** C01, C02, C03, C04, C05, C19, C20, C21, C22, C23, C26, C28, C30, C32, C34 — see [10-CODE-AUDIT-AND-GAPS.md](10-CODE-AUDIT-AND-GAPS.md). These include shared prerequisite dependencies; this row is not release-complete until its applicable repairs and acceptance pass.

