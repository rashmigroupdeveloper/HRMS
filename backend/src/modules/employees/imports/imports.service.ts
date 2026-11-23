import { hasLevelAt, type Placement } from '#core/auth/scope'
import { prisma } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { readFirstSheet, writeWorkbook, type CellValue } from '#core/excel/workbook'
import { companiesService, costCentersService, departmentsService, designationsService, gradesService, plantsService, positionsService, workLocationsService } from '#modules/organization'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as employeesRepository from '../employees.repository.js'
import {
  addEmployeeInput,
  EMPLOYMENT_TYPE_LABEL,
  GENDER_LABEL,
  JOINING_TYPE_LABEL,
  SALUTATION_LABEL,
  updateEmployeeInput,
  WORKFORCE_LABEL,
} from '../employees.schema.js'
import * as employeesService from '../employees.service.js'
import * as importsRepository from './imports.repository.js'
import { IMPORT_COLUMNS, MAX_IMPORT_ROWS, type ImportColumnKey, type uploadImportInput } from './imports.schema.js'

// Excel import of employees (EMPLOYEES WRITE; old HRMS bulk import, agreed 2026-11-16). A row with a new or empty code
// adds an employee, checked with the "Add employee" rules; a row whose code is already used updates that employee - only
// the cells filled in, with the "Edit details" rules (the company is not changed by an import - a transfer is a later
// module). The file is saved only when no row has an error - all rows or none. New employees keep the code given in the
// file (an empty code takes the next of the company's series) and get no login (HR gives logins on the Roles & access
// page). Every file saved, and every file with errors, is kept in the history (its wrong rows can be downloaded).

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// The masters the rows are matched against - retired ones too, so a row keeping one an employee already has passes and
// a row choosing one anew is told it is retired (2026-11-23, the review); the template's dropdowns offer the active ones
async function loadMasters() {
  const [companies, plants, plantDepartments, workLocations, departments, designations, grades, positions, costCenters] = await Promise.all([
    companiesService.listCompanies(true),
    plantsService.listPlants({ includeInactive: true }),
    plantsService.listPlantDepartmentKeys(),
    workLocationsService.listWorkLocations({ includeInactive: true }),
    departmentsService.listDepartments(true),
    designationsService.listDesignations(true),
    gradesService.listGrades(true),
    positionsService.listPositions(true),
    costCentersService.listCostCenters({ includeInactive: true }),
  ])
  return { companies, plants, plantDepartments, workLocations, departments, designations, grades, positions, costCenters }
}
const inUse = <T extends { isActive: boolean }>(list: T[]) => list.filter((m) => m.isActive)

// The template: one column per field (dropdowns for fixed values and masters), and a sheet that explains the columns.
export async function importTemplate() {
  const masters = await loadMasters()
  const lists: Partial<Record<ImportColumnKey, string[]>> = {
    salutation: Object.values(SALUTATION_LABEL),
    gender: Object.values(GENDER_LABEL),
    company: inUse(masters.companies).map((c) => c.code),
    plant: [...new Set(inUse(masters.plants).map((p) => p.plantCode))],
    workLocation: inUse(masters.workLocations).map((l) => l.name),
    department: inUse(masters.departments).map((d) => d.name),
    designation: inUse(masters.designations).map((d) => d.name),
    grade: inUse(masters.grades).map((g) => g.name),
    position: inUse(masters.positions).map((p) => p.name),
    costCenter: [...new Set(inUse(masters.costCenters).map((c) => c.code))],
    joiningType: Object.values(JOINING_TYPE_LABEL),
    employmentType: Object.values(EMPLOYMENT_TYPE_LABEL),
    workforceCategory: Object.values(WORKFORCE_LABEL),
  }
  const bytes = await writeWorkbook([
    {
      name: 'Employees',
      columns: IMPORT_COLUMNS.map((c) => ({
        header: c.header,
        key: c.key,
        width: Math.max(14, c.header.length + 4),
        date: 'date' in c && c.date,
        text: 'text' in c && c.text,
        list: lists[c.key],
        note: [('required' in c && c.required ? 'Required.' : 'Optional.'), 'note' in c ? c.note : ''].filter(Boolean).join(' '),
      })),
      rows: [],
      dropdownRows: MAX_IMPORT_ROWS,
    },
    {
      name: 'How to fill',
      columns: [
        { header: 'Column', key: 'column', width: 26 },
        { header: 'Required', key: 'required', width: 10 },
        { header: 'What to enter', key: 'what', width: 90 },
      ],
      rows: [
        ...IMPORT_COLUMNS.map((c) => ({
          column: c.header,
          required: 'required' in c && c.required ? 'Yes' : '',
          what: ['date' in c && c.date ? 'A date, e.g. 25-03-2024.' : '', lists[c.key] ? 'Pick from the dropdown.' : '', 'note' in c ? c.note : '']
            .filter(Boolean)
            .join(' '),
        })),
        { column: '', required: '', what: '' },
        { column: 'Rules', required: '', what: 'One row per employee. The file is saved only when every row is correct - fix the rows the check lists.' },
        { column: '', required: '', what: 'At least 18 years old on the date of joining (when the date of birth is given). Joining type, employment type and workforce default to Regular, Permanent and White collar.' },
        { column: '', required: '', what: 'Imported employees get no login - give logins on the Roles & access page.' },
      ],
    },
  ])
  return new File([new Uint8Array(bytes)], 'employee-import-template.xlsx', { type: XLSX_TYPE })
}

type RowResult = { rowNumber: number; employeeCode: string | null; name: string; action: 'ADD' | 'UPDATE'; errors: string[] }
type AddInput = z.infer<typeof addEmployeeInput> & { employeeCode?: string | undefined }
type UpdateInput = z.infer<typeof updateEmployeeInput>
type ParsedRow = {
  result: RowResult
  add: AddInput | null
  update: { id: number; changes: UpdateInput } | null
  keys: { employeeCode?: string; workEmail?: string; reportingManagerCode?: string; functionalManagerCode?: string }
}

// Checks every row of the uploaded file; with `save`, also saves them when there is no error.
export async function uploadImport({ file, save }: z.infer<typeof uploadImportInput>, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  let sheet
  try {
    sheet = await readFirstSheet(new Uint8Array(await file.arrayBuffer()))
  } catch (error) {
    throw new ORPCError('BAD_REQUEST', { message: error instanceof Error ? error.message : 'The file cannot be read' })
  }
  // the columns by header (case and a trailing * ignored)
  const header = (h: string) => h.replace(/\*$/, '').trim().toLowerCase()
  const present = new Set(sheet.headers.map(header))
  const missing = IMPORT_COLUMNS.filter((c) => 'required' in c && c.required && !present.has(header(c.header))).map((c) => c.header)
  if (missing.length) {
    throw new ORPCError('BAD_REQUEST', { message: `The file has no ${missing.join(', ')} column${missing.length > 1 ? 's' : ''} - download the template and fill that in` })
  }
  if (!sheet.rows.length) throw new ORPCError('BAD_REQUEST', { message: 'The file has no employee rows' })
  if (sheet.rows.length > MAX_IMPORT_ROWS) throw new ORPCError('BAD_REQUEST', { message: `Import at most ${MAX_IMPORT_ROWS} employees per file` })

  const masters = await loadMasters()
  const cellOf = (values: Record<string, CellValue>) => (key: ImportColumnKey) => {
    const column = IMPORT_COLUMNS.find((c) => c.key === key)!
    const found = Object.entries(values).find(([h]) => header(h) === header(column.header))
    return found ? found[1] : null
  }
  // the employees already in the system that rows name (those rows update them)
  const namedCodes = sheet.rows.flatMap(({ values }) => {
    const code = cellOf(values)('employeeCode')
    return code === null ? [] : [String(code).trim().toUpperCase()]
  })
  const existing = await importsRepository.listExistingByCodes(namedCodes)
  // data access (2026-11-18): rows may only add or change employees inside the viewer's "Employee · Directory & job" Edit
  // range - an employee outside it is never changed or named
  const canPlace = (placement: Placement) => hasLevelAt(viewer, 'EMPLOYEES', placement, 'WRITE')
  // D7 (2026-11-20): a row changing an employee's job details needs "Approve job & salary changes" there
  const canChangeJob = (at: Placement[]) => employeesService.mayChangeJobDirectly(viewer, at)
  const parsed = sheet.rows.map(({ rowNumber, values }) => parseRow(rowNumber, cellOf(values), masters, existing, canPlace, canChangeJob))

  // checks across the file and against the database
  // (from what each row says, also on rows with other problems - every problem of a row is listed at once)
  const codes = parsed.flatMap((row) => (row.keys.employeeCode ? [row.keys.employeeCode] : []))
  const workEmails = parsed.flatMap((row) => (row.keys.workEmail ? [row.keys.workEmail] : []))
  const managerCodes = parsed.flatMap((row) => [row.keys.reportingManagerCode, row.keys.functionalManagerCode].filter((code) => code !== undefined))
  const [usedEmails, managers] = await Promise.all([
    importsRepository.listUsedWorkEmails(workEmails),
    importsRepository.listManagersByCodes([...new Set(managerCodes)]),
  ])
  const fileCodes = new Set(codes)
  const managerOf = new Map(parsed.flatMap((row) => (row.keys.employeeCode && row.keys.reportingManagerCode ? [[row.keys.employeeCode, row.keys.reportingManagerCode] as const] : [])))
  for (const row of parsed) {
    const input = row.keys
    const err = (message: string) => row.result.errors.push(message)
    // (a row may name an employee by a former code - 2026-11-20: rows naming one employee by different codes are found too)
    const sameEmployee = input.employeeCode ? parsed.filter((other) => other.keys.employeeCode === input.employeeCode) : []
    if (sameEmployee.length > 1) {
      const given = [...new Set(sameEmployee.map((other) => other.result.employeeCode))]
      err(
        given.length > 1
          ? `Employee codes ${given.join(' and ')} name the same employee (a former code and the code now) - keep one row`
          : `Employee code ${input.employeeCode} is on more than one row`,
      )
    }
    if (input.workEmail) {
      const owner = usedEmails.get(input.workEmail)
      // (an employee being updated may keep their own work e-mail)
      if (owner && owner !== input.employeeCode) err(`The work e-mail is already used by ${owner}`)
      if (workEmails.filter((e) => e === input.workEmail).length > 1) err('The work e-mail is on more than one row')
    }
    const managerCode = input.reportingManagerCode
    if (managerCode) {
      if (managerCode === input.employeeCode) err('An employee cannot report to themselves')
      else if (!fileCodes.has(managerCode)) {
        const manager = managers.get(managerCode)
        if (!manager) err(`No employee found with code ${managerCode} (reporting manager) - in the database or this file`)
        else if (manager.status === 'EXITED') err(`Reporting manager ${managerCode} has left`)
      } else if (input.employeeCode) {
        // a loop among the rows of this file: A reports to B, B reports to A
        const chain = [input.employeeCode]
        for (let code: string | undefined = managerCode; code && chain.length < 100; code = managerOf.get(code)) {
          if (code === input.employeeCode) {
            err(`The reporting managers make a loop: ${[...chain, code].join(' → ')}`)
            break
          }
          chain.push(code)
        }
      }
    }
    // the functional manager (shown only): an existing employee who has not left, or another row - not themselves
    const functionalCode = input.functionalManagerCode
    if (functionalCode) {
      if (functionalCode === input.employeeCode) err('An employee cannot be their own functional manager')
      else if (!fileCodes.has(functionalCode)) {
        const manager = managers.get(functionalCode)
        if (!manager) err(`No employee found with code ${functionalCode} (functional manager) - in the database or this file`)
        else if (manager.status === 'EXITED') err(`Functional manager ${functionalCode} has left`)
      }
    }
  }

  const rows = parsed.map((row) => row.result)
  const withErrors = rows.filter((row) => row.errors.length).length
  const toAdd = rows.filter((row) => row.action === 'ADD').length
  const toUpdate = rows.length - toAdd
  if (withErrors) {
    // kept in the history, so the wrong rows can be downloaded as an Excel file
    const record = await importsRepository.createImport(
      {
        fileName: file.name,
        status: 'FAILED',
        rowCount: rows.length,
        createdCount: 0,
        updatedCount: 0,
        errors: rows.filter((row) => row.errors.length).map((row) => ({ row: row.rowNumber, employeeCode: row.employeeCode, name: row.name, errors: row.errors })),
      },
      actorId,
    )
    return { saved: false, total: rows.length, withErrors, toAdd, toUpdate, rows, importId: record.id }
  }
  if (!save) return { saved: false, total: rows.length, withErrors, toAdd, toUpdate, rows, importId: null }

  // all rows or none: one transaction; the managers are set once every row exists (a manager can be a later row)
  const record = await prisma.$transaction(
    async (tx) => {
      const idByCode = new Map<string, number>()
      // undefined: the row does not set it; null (update only): clear it
      const managersToSet: { id: number; managerCode: string | null | undefined; functionalCode: string | null | undefined }[] = []
      for (const row of parsed) {
        if (row.add) {
          const { reportingManagerCode, functionalManagerCode, ...details } = row.add
          const employee = await employeesService.createEmployee({ ...details, status: 'ACTIVE' }, actorId, tx)
          row.result.employeeCode = employee.employeeCode
          idByCode.set(employee.employeeCode, employee.id)
          if (reportingManagerCode || functionalManagerCode) managersToSet.push({ id: employee.id, managerCode: reportingManagerCode, functionalCode: functionalManagerCode })
        } else if (row.update) {
          const { employeeCode, reportingManagerCode, functionalManagerCode, ...changes } = row.update.changes
          idByCode.set(employeeCode, row.update.id)
          // a move: the HOD post follows - the plant-department they are placed in now (BACKLOG 3e)
          const saved = existing.get(employeeCode)
          const placement = saved && { plantId: changes.plantId ?? saved.plantId, departmentId: changes.departmentId === undefined ? saved.departmentId : changes.departmentId }
          const data = placement && (placement.plantId !== saved.plantId || placement.departmentId !== saved.departmentId) ? { ...changes, hodPostId: await employeesService.hodPostOf(placement, tx) } : changes
          if (Object.keys(data).length) {
            await employeesRepository.update(row.update.id, data, actorId, tx)
            // a correction: the job timeline's entry in force is fixed too
            await employeesService.correctJobRecords(row.update.id, data, actorId, tx)
          }
          if (reportingManagerCode !== undefined || functionalManagerCode !== undefined) {
            managersToSet.push({ id: row.update.id, managerCode: reportingManagerCode, functionalCode: functionalManagerCode })
          }
        }
      }
      for (const { id, managerCode, functionalCode } of managersToSet) {
        const data: { reportingManagerId?: number | null; functionalManagerId?: number | null } = {}
        if (managerCode !== undefined) {
          data.reportingManagerId = managerCode ? (idByCode.get(managerCode) ?? (await employeesService.resolveReportingManager(managerCode, id, tx))) : null
        }
        if (functionalCode !== undefined) {
          data.functionalManagerId = functionalCode ? (idByCode.get(functionalCode) ?? (await employeesService.resolveFunctionalManager(functionalCode, id, tx))) : null
        }
        await employeesRepository.update(id, data, actorId, tx)
        await employeesService.correctJobRecords(id, data, actorId, tx)
      }
      // checked again once every row is saved, against the database: a manager who is a row of the file was checked only
      // within the file - a loop through someone's saved manager (A -> B in the file, B -> A already) or a manager who has
      // left passed (2026-11-23). Any problem: nothing is saved.
      for (const { id, managerCode } of managersToSet) {
        const managerId = managerCode ? idByCode.get(managerCode) : undefined
        if (managerId === undefined) continue
        const manager = await employeesRepository.findManagerLinkById(managerId, tx)
        if (manager?.status === 'EXITED') throw new ORPCError('BAD_REQUEST', { message: `Reporting manager ${managerCode} has left - nothing was imported` })
        await employeesService.assertNoReportingLoop(managerId, id, tx)
      }
      return importsRepository.createImport({ fileName: file.name, status: 'DONE', rowCount: rows.length, createdCount: toAdd, updatedCount: toUpdate }, actorId, tx)
    },
    // a big file takes longer than a normal request
    { timeout: 300_000, maxWait: 10_000 },
  )
  return { saved: true, total: rows.length, withErrors: 0, toAdd, toUpdate, rows, importId: record.id }
}

// The history: the files imported and the ones with errors, newest first
export async function listImports() {
  const rows = await importsRepository.listImports(50)
  const person = await employeesService.lookupPeople(rows.map((r) => r.createdById))
  return rows.map(({ createdById, ...row }) => ({ ...row, by: person(createdById) }))
}

// A file's wrong rows as an Excel file (row number, employee, every problem)
export async function errorReport(id: number) {
  const record = await importsRepository.findImportErrors(id)
  if (!record) throw new ORPCError('NOT_FOUND', { message: `No import with id ${id}` })
  const errors = (record.errors ?? []) as { row: number; employeeCode: string | null; name: string; errors: string[] }[]
  const bytes = await writeWorkbook([
    {
      name: 'Rows to fix',
      columns: [
        { header: 'Row', key: 'row', width: 8 },
        { header: 'Employee code', key: 'code', width: 16 },
        { header: 'Name', key: 'name', width: 28 },
        { header: 'What to fix', key: 'errors', width: 100 },
      ],
      rows: errors.map((e) => ({ row: e.row, code: e.employeeCode, name: e.name, errors: e.errors.join('; ') })),
    },
  ])
  const base = record.fileName.replace(/\.xlsx$/i, '')
  return new File([new Uint8Array(bytes)], `${base} - rows to fix.xlsx`, { type: XLSX_TYPE })
}

type Masters = Awaited<ReturnType<typeof loadMasters>>
type Master = { id: number; name: string; code?: string | null; plantCode?: string; isActive: boolean }

// One row turned into the "Add employee" input, with the problems found (by column)
// `keys`: what the row says for the checks across the file (code, work e-mail, manager), even when it has problems
function parseRow(
  rowNumber: number,
  cell: (key: ImportColumnKey) => CellValue,
  masters: Masters,
  existing: Map<string, importsRepository.ExistingEmployee>,
  canPlace: (placement: Placement) => boolean,
  canChangeJob: (at: Placement[]) => boolean,
): ParsedRow {
  const errors: string[] = []
  const label = (key: ImportColumnKey) => IMPORT_COLUMNS.find((c) => c.key === key)!.header
  const text = (key: ImportColumnKey) => {
    const value = cell(key)
    if (value === null) return undefined
    return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).trim() || undefined
  }
  const date = (key: ImportColumnKey) => {
    const value = cell(key)
    if (value === null) return undefined
    const parsed = toDate(value)
    if (!parsed) errors.push(`${label(key)}: "${String(value)}" is not a date - use e.g. 25-03-2024`)
    return parsed
  }
  // a fixed value: its label or its code, in any case ("Permanent", "PERMANENT", "white collar")
  const choice = <T extends string>(key: ImportColumnKey, labels: Record<T, string>) => {
    const value = text(key)
    if (!value) return undefined
    const wanted = norm(value)
    const found = (Object.entries(labels) as [T, string][]).find(([code, name]) => [code, name, name.replace(/\s*\(.*\)$/, '')].some((v) => norm(v) === wanted))
    if (!found) errors.push(`${label(key)}: "${value}" is not one of ${Object.values(labels).join(', ')}`)
    return found?.[0]
  }
  // a master by its name or code, exactly as on the Organization page but for case and extra spaces - never a guess
  // ("Sales East" is not "Sales-East"; 2026-11-23, the review). Several matches, or a retired one the row chooses anew
  // (`now`: what the employee has), are reported.
  const pick = (key: ImportColumnKey, list: Master[], value: string | undefined, now: number | null | undefined, missing: string) => {
    if (!value) return undefined
    const wanted = same(value)
    const matches = list.filter((m) => [m.name, m.code, m.plantCode].some((v) => v && same(v) === wanted))
    const inUseOnly = matches.length > 1 ? matches.filter((m) => m.isActive) : matches
    const found = inUseOnly.length === 1 ? inUseOnly[0]! : undefined
    if (matches.length > 1 && !found) errors.push(`${label(key)}: "${value}" matches more than one - use the code`)
    else if (!found) errors.push(`${label(key)}: "${value}" ${missing}`)
    else if (!found.isActive && found.id !== now) errors.push(`${label(key)}: "${value}" is retired - choose one in use (Organization page)`)
    return found?.id
  }
  const master = (key: ImportColumnKey, list: Master[], now?: number | null) => pick(key, list, text(key), now, 'is not in the list (Organization page)')

  const givenCode = text('employeeCode')?.toUpperCase()
  // the employee the row names - by their code, or a former one (then the row is theirs, under their code now)
  const current = givenCode ? existing.get(givenCode) : undefined
  const raw = {
    employeeCode: current?.employeeCode ?? givenCode,
    salutation: choice('salutation', SALUTATION_LABEL),
    firstName: text('firstName'),
    middleName: text('middleName'),
    lastName: text('lastName'),
    gender: choice('gender', GENDER_LABEL),
    dateOfBirth: date('dateOfBirth'),
    companyId: master('company', masters.companies, current?.companyId),
    workLocationId: master('workLocation', masters.workLocations, current?.workLocationId),
    departmentId: master('department', masters.departments, current?.departmentId),
    designationId: master('designation', masters.designations, current?.designationId),
    gradeId: master('grade', masters.grades, current?.gradeId),
    positionId: master('position', masters.positions, current?.positionId),
    dateOfJoining: date('dateOfJoining'),
    joiningType: choice('joiningType', JOINING_TYPE_LABEL),
    employmentType: choice('employmentType', EMPLOYMENT_TYPE_LABEL),
    workforceCategory: choice('workforceCategory', WORKFORCE_LABEL),
    contractEndDate: date('contractEndDate'),
    probationEndDate: date('probationEndDate'),
    mobile: text('mobile'),
    personalEmail: text('personalEmail'),
    workEmail: text('workEmail'),
    reportingManagerCode: text('reportingManagerCode')?.toUpperCase(),
    functionalManagerCode: text('functionalManagerCode')?.toUpperCase(),
  }
  // the plant: by its code (or name) among the plants of the row's company - an employee being updated keeps theirs
  const companyOfRow = raw.companyId ?? current?.companyId
  const plantText = text('plant')
  let plantId: number | undefined
  if (plantText && companyOfRow !== undefined) {
    const plants = masters.plants.filter((p) => p.company.id === companyOfRow)
    plantId = pick('plant', plants, plantText, current?.plantId, 'is not a plant of the company (Organization page)')
  }
  // the department must run at the plant (as it will be after the row is saved) - checked when the row chooses either
  // anew; one the employee already has may have been retired at the plant since
  const plantAfter = plantId ?? current?.plantId
  const departmentAfter = raw.departmentId ?? current?.departmentId
  const choosesAnew = (plantId !== undefined && plantId !== current?.plantId) || (raw.departmentId !== undefined && raw.departmentId !== current?.departmentId)
  if (plantAfter !== undefined && departmentAfter != null && choosesAnew) {
    if (!masters.plantDepartments.has(`${plantAfter}:${departmentAfter}`)) {
      errors.push(`${label('department')}: does not run at the plant - choose one of the plant's departments, or add it to the plant on the Organization page`)
    }
  }
  // data access: an employee being updated must be inside the viewer's Edit range (else the code cannot be used - without
  // saying whose it is), and where the row places someone too
  if (current && !canPlace({ companyId: current.companyId, plantId: current.plantId, departmentId: current.departmentId })) {
    errors.push(`${label('employeeCode')}: "${givenCode}" cannot be used - give another code, or leave it empty for the next of the company's series`)
  } else if (companyOfRow !== undefined && plantAfter !== undefined && (choosesAnew || !current)) {
    if (!canPlace({ companyId: companyOfRow, plantId: plantAfter, departmentId: departmentAfter ?? null })) {
      errors.push(`${label('plant')}: you can only place employees in a company / plant / department inside your data access`)
    }
  }
  // the cost centre: by its code (or name) among the active cost centres of the row's company
  const costCenterText = text('costCenter')
  let costCenterId: number | undefined
  if (costCenterText && companyOfRow !== undefined) {
    const costCenters = masters.costCenters.filter((c) => c.company.id === companyOfRow)
    costCenterId = pick('costCenter', costCenters, costCenterText, current?.costCenterId, 'is not a cost centre of the company (Organization page)')
  }
  const raw2 = { ...raw, plantId, costCenterId }
  const name = [raw.firstName, raw.middleName, raw.lastName].filter(Boolean).join(' ')
  // (the code as the file gives it - the checks across the file name the employee by their code now)
  const result: RowResult = { rowNumber, employeeCode: givenCode ?? null, name, action: current ? 'UPDATE' : 'ADD', errors }
  const keys = {
    ...(raw.employeeCode && { employeeCode: raw.employeeCode }),
    ...(raw.workEmail && { workEmail: raw.workEmail.trim().toLowerCase() }),
    ...(raw.reportingManagerCode && { reportingManagerCode: raw.reportingManagerCode }),
    ...(raw.functionalManagerCode && { functionalManagerCode: raw.functionalManagerCode }),
  }
  if (current) {
    // D7: the job details as the row would change them
    const differs = <T>(cell: T | undefined, now: T) => cell !== undefined && cell !== now
    const jobChanged =
      differs(plantId, current.plantId) ||
      differs(raw.departmentId, current.departmentId) ||
      differs(raw.workLocationId, current.workLocationId) ||
      differs(raw.designationId, current.designationId) ||
      differs(raw.gradeId, current.gradeId) ||
      differs(raw.positionId, current.positionId) ||
      differs(costCenterId, current.costCenterId) ||
      differs(raw.employmentType, current.employmentType) ||
      differs(raw.workforceCategory, current.workforceCategory) ||
      differs(raw.reportingManagerCode, current.reportingManager?.employeeCode) ||
      differs(raw.functionalManagerCode, current.functionalManager?.employeeCode)
    const here = { companyId: current.companyId, plantId: current.plantId, departmentId: current.departmentId }
    if (jobChanged && !canChangeJob([here, { companyId: current.companyId, plantId: plantAfter ?? current.plantId, departmentId: departmentAfter ?? null }])) {
      errors.push('Job details (plant, department, designation, grade, position, cost centre, managers, employment type...) change through approval - leave them as they are, or ask for a job change on the Pay & career page (Raise a change)')
    }
    return parseUpdate(raw2, current, result, keys, label)
  }
  if (raw.employeeCode && !/^[A-Z0-9][A-Z0-9/-]{1,29}$/.test(raw.employeeCode)) errors.push(`${label('employeeCode')}: use letters and digits, e.g. RML035384`)
  // the "Add employee" rules; a value that was wrong above is already reported, so only the others are added
  const checked = addEmployeeInput.safeParse(raw2)
  if (!checked.success) {
    for (const issue of checked.error.issues) {
      const key = String(issue.path[0] ?? '')
      const column = IMPORT_COLUMNS.find((c) => c.key === key || `${c.key}Id` === key)
      const name = column?.header ?? key
      if (errors.some((e) => e.startsWith(`${name}:`))) continue
      errors.push(raw2[key as keyof typeof raw2] === undefined ? `${name}: required` : `${name}: ${issue.message}`)
    }
  }
  // the date rules, whenever the dates they need were read
  if (raw.dateOfJoining && raw.employmentType) {
    try {
      employeesService.checkEmploymentDates({ ...raw, dateOfJoining: raw.dateOfJoining, employmentType: raw.employmentType })
    } catch (error) {
      errors.push(error instanceof ORPCError ? error.message : String(error))
    }
  }
  return { result, add: checked.success && !errors.length ? { ...checked.data, employeeCode: raw.employeeCode } : null, update: null, keys }
}

// A row for an employee already in the system: only the cells filled in change ("Edit details" rules); the company stays
function parseUpdate(
  raw: Record<string, unknown> & { employeeCode?: string; companyId?: number },
  current: importsRepository.ExistingEmployee,
  result: RowResult,
  keys: ParsedRow['keys'],
  label: (key: ImportColumnKey) => string,
): ParsedRow {
  const { errors } = result
  const { companyId, employeeCode: _code, ...cells } = raw
  if (companyId !== undefined && companyId !== current.companyId) {
    errors.push(`${label('company')}: an import does not move an employee to another company - leave it empty or as it is`)
  }
  const given = Object.fromEntries(Object.entries(cells).filter(([, value]) => value !== undefined))
  const checked = updateEmployeeInput.safeParse({ employeeCode: current.employeeCode, ...given })
  if (!checked.success) {
    for (const issue of checked.error.issues) {
      const key = String(issue.path[0] ?? '')
      const column = IMPORT_COLUMNS.find((c) => c.key === key || `${c.key}Id` === key)
      const name = column?.header ?? key
      if (!errors.some((e) => e.startsWith(`${name}:`))) errors.push(`${name}: ${issue.message}`)
    }
  } else {
    const changes = checked.data
    try {
      employeesService.checkEmploymentDates({
        dateOfBirth: changes.dateOfBirth === undefined ? current.dateOfBirth : changes.dateOfBirth,
        dateOfJoining: changes.dateOfJoining ?? current.dateOfJoining,
        employmentType: changes.employmentType ?? current.employmentType,
        contractEndDate: changes.contractEndDate === undefined ? current.contractEndDate : changes.contractEndDate,
        probationEndDate: changes.probationEndDate === undefined ? current.probationEndDate : changes.probationEndDate,
        confirmationDate: current.confirmationDate,
      })
    } catch (error) {
      errors.push(error instanceof ORPCError ? error.message : String(error))
    }
  }
  return { result, add: null, update: checked.success && !errors.length ? { id: current.id, changes: checked.data } : null, keys }
}

// fixed values (gender, employment type...): any case, spaces or punctuation ("white collar" = WHITE_COLLAR)
const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
// masters: the same name or code, but for case and spaces at the ends / between words
const same = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase()

// A calendar date (UTC midnight) from a date cell, an Excel day number, or text like 25-03-2024 / 25/03/2024 / 2024-03-25
function toDate(value: CellValue): Date | undefined {
  const day = (y: number, m: number, d: number) => {
    const date = new Date(Date.UTC(y, m - 1, d))
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : undefined
  }
  if (value instanceof Date) return day(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate())
  if (typeof value === 'number') {
    // days since 30-12-1899 (Excel's day 0)
    const date = new Date(Math.round((value - 25569) * 86_400_000))
    return day(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
  }
  if (typeof value !== 'string') return undefined
  const dmy = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  if (dmy) return day(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]))
  const ymd = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (ymd) return day(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]))
  return undefined
}
