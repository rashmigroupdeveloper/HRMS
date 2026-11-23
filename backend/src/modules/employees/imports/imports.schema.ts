import { z } from 'zod'

// Excel import of employees (old HRMS bulk import, agreed 2026-11-16): HR downloads the template, fills one row per
// employee, uploads it to check, then uploads it again to save. The columns are the "Add employee" details. A row whose
// employee code already exists updates that employee - its empty cells keep what is saved (2026-11-16).

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024
// one file at a time stays quick to check and save
export const MAX_IMPORT_ROWS = 2000

// `save`: false (default) only checks every row; true also saves - all rows or none (nothing is saved while any row
// has an error)
export const uploadImportInput = z.object({
  file: z.file().min(1, 'The file is empty').max(MAX_IMPORT_BYTES, 'The file must be 5 MB or smaller'),
  save: z.boolean().optional(),
})

// The template's columns, in order. `key`: the "Add employee" field the column fills; `text`: a text column in the
// template (codes and numbers keep their leading zeros - 2026-11-23)
export const IMPORT_COLUMNS = [
  {
    key: 'employeeCode',
    header: 'Employee code',
    text: true,
    note: "An employee already in the system: their code updates them (empty cells keep what is saved). A new employee: their existing code (e.g. RML035384), or empty for the next code of the company's series.",
  },
  { key: 'salutation', header: 'Salutation' },
  { key: 'firstName', header: 'First name', required: true },
  { key: 'middleName', header: 'Middle name' },
  { key: 'lastName', header: 'Last name' },
  { key: 'gender', header: 'Gender' },
  { key: 'dateOfBirth', header: 'Date of birth', date: true },
  { key: 'company', header: 'Company code', required: true },
  {
    key: 'plant',
    header: 'Plant code',
    text: true,
    required: true,
    note: "The SAP code of one of the company's plants, e.g. 1101 (RML HQ) - see the Organization page. Required for a new employee.",
  },
  { key: 'workLocation', header: 'Work location' },
  {
    key: 'department',
    header: 'Department',
    required: true,
    note: "One of the plant's departments (Organization page). Required for a new employee - every employee has one.",
  },
  { key: 'designation', header: 'Designation' },
  { key: 'grade', header: 'Grade' },
  { key: 'position', header: 'Position' },
  { key: 'costCenter', header: 'Cost centre', text: true, note: "The code of one of the company's cost centres (Organization page)." },
  { key: 'dateOfJoining', header: 'Date of joining', required: true, date: true },
  { key: 'joiningType', header: 'Joining type' },
  { key: 'employmentType', header: 'Employment type' },
  { key: 'workforceCategory', header: 'Workforce' },
  { key: 'contractEndDate', header: 'Contract end date', date: true, note: 'Only for a fixed-term engagement (not Permanent).' },
  { key: 'probationEndDate', header: 'Probation end date', date: true },
  { key: 'mobile', header: 'Mobile', text: true },
  { key: 'personalEmail', header: 'Personal e-mail' },
  { key: 'workEmail', header: 'Work e-mail' },
  { key: 'reportingManagerCode', header: 'Reporting manager code', text: true, note: 'The employee code of the manager - an existing employee or another row of this file.' },
  {
    key: 'functionalManagerCode',
    header: 'Functional manager code',
    text: true,
    note: 'A second manager the employee works for day to day, shown on the profile only - an existing employee or another row of this file.',
  },
] as const

export type ImportColumnKey = (typeof IMPORT_COLUMNS)[number]['key']

export const importIdInput = z.object({ id: z.number().int().positive() })
