# CHANGES — Rashmi HRMS fix branch (/workspace/hrms-fix)

(Running log; the full P-xx / C-A-B listing is assembled at final report time.)

## Round: bulk import framework + co-sign + group-only statutory (2026-10-18 IST)
- Bulk Excel/CSV import framework (core/bulk) and 10 importers: payroll inputs (+Report 4 layout), statutory rates, PT slabs, holidays, leave balances, loans, assets, salary assignments, punches (Kent layout), employees (create/update). There's a template with dropdowns and an Instructions sheet, preview with an xlsx validation report, all-or-nothing commit, idempotent re-upload (sha256), background mode above 1000 rows, audit, formula-injection guard, and .xls is refused. UI: Admin → Data imports, plus a drawer on the payroll Inputs panel.
- Parallel run: the register upload is now parsed server-side (xlsx/csv/Report 4). RML033625 nets 59,124.
- Company locale columns (country, currency, timezone, locale); punch import converts using the company timezone.
- Country-pluggable identity validators (PAN, Aadhaar Verhoeff, UAN, ESIC, IFSC, bank account, mobile, PIN; minors).
- C-04: approving a payroll run now needs the new permission `payroll.run.cosign` (hr_head; super_admin holds it only so it can delegate it). The service refuses a super_admin-only co-sign unless PAYROLL_SUPER_ADMIN_COSIGN=true, and ceo_cell can no longer approve. Migration 1752500000200.
- Statutory rates and PT slabs are group-wide. Entity-bound payroll admins now get 403 (API and importer).

## Round: HOD (2026-10-19 IST, commit 515b743)
- New `hod` role, derived like manager. An active employee becomes an HOD when they are designated in the new `core.department_heads` table, either for one company or group-wide, or when they are named as someone's `hod_employee_id`.
- New grant scope `department`. HOD grants are department-scoped: employee.read, team attendance, muster export, AR/OD/OT/leave/claims approval and HR reports. HODs get no attendance edits, no compensation and no employee.write.
- New `department_head` workflow approver: the employee's own HOD field first, then the company head, then the group head. It never resolves to the subject, and a vacancy goes to the routing hold. Domestic travel advance is now RM → HOD (docs/01 TE-07); the migration changes it only where the chain was still the seeded default.
- API: GET/POST /core/department-heads and POST /core/department-heads/{id}/remove. These are audited. Entity HR can only designate within its own company; a group-wide designation needs group scope.
- New admin screen: Admin → Heads of department. "Head of department" is added to the approver presets on Approval chains.
- Seeded HOD on the fix instance: RML033904 is head of RML Production (fix-verify/env/hod-seed.sql), login rml033904@qa-payroll.rashmi.test. The directory shows 28 RML Production employees only.

## Client decisions needed
| # | Topic | Default chosen | Source | How to change |
|---|---|---|---|---|
| CD-1 | super_admin break-glass co-sign of a payroll run (C-04) | Not allowed; only hr_head co-signs | docs/08 §2 | env PAYROLL_SUPER_ADMIN_COSIGN=true |
| CD-2 | ceo_cell co-sign | Not allowed (it was allowed before) | docs/08 §2 line 41 | grant payroll.run.cosign to ceo_cell |
| CD-3 | Report 4 columns GRATUITY, LEAVE ENCASHMENT, EX-GRATIA, HOLD SALARY, Performance-Linked, LOAN2 in the inputs import | Ignored with a warning (they come from F&F / loans modules) | sample register | importer mapping |
| CD-4 | What HOD means (C-02) | Both: the per-employee hod_employee_id override, else the designated head of the department (per entity or group-wide) | user brief; EMS hod_id; docs/01 TE-07 | data in Admin → Heads of department |
| CD-5 | Which chains include an HOD step | Only domestic travel advance (RM → HOD). Claims, long leave, OT pre-approval, requisition and offer can add a "Head of department" step in Approval chains | docs/01 TE-07 | Admin → Approval chains |

