import { writeReport } from '#core/excel/report'
import { ORPCError } from '@orpc/server'
import { ALL_OF_GROUP, hasLevelAt, levelOver } from '#core/auth/scope'
import { GENESIS_HASH, hashEntry } from '#core/audit/hash'
import { today } from '#shared/utils/dates'
import { assertAccess } from '#core/auth/access'
import { SYSTEM_ACTOR, type AccessArea } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { accountsService } from '#modules/accounts'
import { employeesService, hodsService } from '#modules/employees'
import {
  companiesService,
  costCentersService,
  departmentsService,
  designationsService,
  gradesService,
  positionsService,
  regionsService,
  plantsService,
  salaryComponentsService,
  workLocationsService,
} from '#modules/organization'
import type { z } from 'zod'
import * as historyRepository from './change-history.repository.js'
import type { exportChangeHistoryInput, listChangeHistoryInput } from './change-history.schema.js'

// The change history (phase 2, 2026-11-16): who changed what and when, read from the rows core/audit records.
// - The whole history needs Change history: View; one employee's history (the profile) also Employees: View.
// - Values needing an access of their own are hidden without it: salaries (Salary), health data (Medical
//   information), a candidate's offered pay (Onboarding) - "(hidden)".
// - Field names are shown in words, ids as names (a designation, a company, an employee...).

const DEFAULT_PAGE_SIZE = 50
const HIDDEN = '(hidden)'

// The employee's own columns that are personal details (the rest - job, placement, contacts - is the directory's)
const PERSONAL_COLUMNS = new Set([
  'fatherName',
  'motherName',
  'gender',
  'dateOfBirth',
  'placeOfBirth',
  'maritalStatus',
  'spouseName',
  'marriageDate',
  'countryOfOrigin',
  'nationality',
  'religion',
  'category',
  'bloodGroup',
  'heightCm',
  'weightKg',
  'identificationMark',
  'hobbies',
  'isPhysicallyDisabled',
  'disabilityType',
  'disabilityPercent',
])
const PERSONAL_MODELS = new Set([
  'EmployeeAddress',
  'EmployeeEmergencyContact',
  'EmployeeQualification',
  'EmployeeCertification',
  'EmployeePreviousEmployment',
  'EmployeeFamilyMember',
  'EmployeeNominee',
])
const IDS_MODELS = new Set(['EmployeeIdentityDocument', 'EmployeeBankAccount', 'EmployeeStatutory'])

// Which access a model's values (or one field's) need, besides Change history (the employee areas split 2026-11-16)
function neededAccess(model: string | null, field: string): AccessArea | null {
  if (model === 'EmployeeSalary' || model === 'EmployeeSalaryLine' || model === 'JobChangeSalary' || model === 'JobChangeSalaryLine') return 'SALARY'
  if (model === 'Employee' && PERSONAL_COLUMNS.has(field)) return 'EMPLOYEE_PERSONAL_DETAILS'
  if (model && PERSONAL_MODELS.has(model)) return 'EMPLOYEE_PERSONAL_DETAILS'
  if (model && IDS_MODELS.has(model)) return 'EMPLOYEE_IDS_BANK'
  if (model === 'EmployeeDocument') return 'EMPLOYEE_DOCUMENTS'
  if (model === 'EmployeeMedicalInfo' || (/^medical/.test(field) && (model === 'Candidate' || model === 'EmployeeOnboarding'))) return 'MEDICAL'
  if (model === 'CandidateSalaryLine' || (model === 'Candidate' && /ctc|performancePay/i.test(field))) return 'ONBOARDING'
  return null
}

// The candidate's own pages make their changes as System - shown as the candidate
const BY_CANDIDATE = /^candidates\.(portal|offerResponse)\./

// The whole change history mixes every company's records with shared settings, so it needs Change history View for all
// companies (A4, 2026-11-18)
function assertWholeHistory(viewer: CurrentUser) {
  assertAccess(viewer.access, 'CHANGE_HISTORY', 'READ')
  if (!levelOver(viewer, 'CHANGE_HISTORY', ALL_OF_GROUP)) {
    throw new ORPCError('FORBIDDEN', { message: "The whole change history needs Change history View for all companies - open one employee's history on their profile instead" })
  }
}

export async function listChangeHistory(viewer: CurrentUser, input: z.infer<typeof listChangeHistoryInput>) {
  // one employee's history (the profile's History tab): Change history View covering where they are - data access. Not
  // Employees View any more, and not the employee themselves (the user, 2026-11-21: it names who changed what - for HR and
  // audit). Anything else is the whole history.
  if (!input?.employeeCode) assertWholeHistory(viewer)
  else assertAccess(viewer.access, 'CHANGE_HISTORY', 'READ')
  const page = input?.page ?? 1
  const pageSize = input?.pageSize ?? DEFAULT_PAGE_SIZE
  const [employee, actor] = await Promise.all([
    input?.employeeCode ? employeesService.findSummaryByCode(input.employeeCode) : null,
    input?.actorCode ? employeesService.findSummaryByCode(input.actorCode) : null,
  ])
  const models = await historyRepository.listModels()
  const at = employee && { companyId: employee.companyId, plantId: employee.plantId, departmentId: employee.departmentId }
  const coversEmployee = !!at && hasLevelAt(viewer, 'CHANGE_HISTORY', at, 'READ')
  // an unknown employee code - or one outside the viewer's data access - finds nothing
  if ((input?.employeeCode && !coversEmployee) || (input?.actorCode && !actor)) return { items: [], total: 0, page, pageSize, models: models.map(modelOption) }
  // a value of a part with its own area (salary, IDs...): with that area covering the employee - on the whole history,
  // covering every company
  const seesArea = (area: AccessArea) => (at ? hasLevelAt(viewer, area, at, 'READ') : levelOver(viewer, area, ALL_OF_GROUP) !== undefined)
  const nextDay = (date: Date) => new Date(date.getTime() + 86_400_000)
  const { rows, total } = await historyRepository.list(
    {
      from: input?.from,
      before: input?.to ? nextDay(input.to) : undefined,
      actorId: actor?.id,
      employeeId: employee?.id,
      candidateId: input?.candidateId,
      model: input?.model,
      action: input?.action,
    },
    { skip: (page - 1) * pageSize, take: pageSize },
  )

  // names for the people and ids in this page
  const changesOf = (row: (typeof rows)[number]) => (row.changes ?? {}) as Record<string, [unknown, unknown]>
  const personIds = rows.flatMap((row) => [
    row.createdById,
    row.employeeId,
    ...Object.entries(changesOf(row)).flatMap(([field, values]) => (isPersonField(field) ? values : [])),
  ])
  const [person, names] = await Promise.all([employeesService.lookupPeople(personIds.filter((id): id is number => typeof id === 'number')), loadNames(rows.map(changesOf))])

  return {
    items: rows.map((row) => {
      const by =
        row.createdById === SYSTEM_ACTOR && row.source && BY_CANDIDATE.test(row.source)
          ? { employeeCode: null, name: 'Candidate (online)' }
          : person(row.createdById)
      return {
        id: row.id,
        at: row.createdAt,
        action: row.action,
        by,
        source: row.source,
        model: row.model,
        modelLabel: row.model ? modelLabel(row.model) : null,
        recordId: row.recordId,
        employee: row.employeeId === null ? null : person(row.employeeId),
        candidateId: row.candidateId,
        changes: Object.entries(changesOf(row))
          // a login's id says nothing more than whose record it is (shown already)
          .filter(([field]) => !(field === 'accountId' && row.employeeId !== null))
          .map(([field, [before, after]]) => {
          const access = neededAccess(row.model, field)
          const hide = access !== null && !seesArea(access)
          const show = (value: unknown) => (hide && value !== null ? HIDDEN : named(field, value, names, person))
          return { field, label: fieldLabel(field), before: show(before), after: show(after) }
        }),
        details: row.details as Record<string, unknown> | null,
        ip: row.ip,
      }
    }),
    total,
    page,
    pageSize,
    models: models.map(modelOption),
  }
}

// Checks the hash chain from the first row: every row's fingerprint must match its content and the row before. A row
// changed or removed directly in the database breaks it there.
export async function verifyChain(viewer: CurrentUser) {
  assertWholeHistory(viewer)
  let previous = GENESIS_HASH
  let checked = 0
  let afterId = 0
  for (;;) {
    const rows = await historyRepository.listChain(afterId, 2000)
    if (!rows.length) break
    for (const row of rows) {
      if (row.previousHash !== previous || hashEntry(previous, row) !== row.hash) {
        return { ok: false, checked, brokenAt: { id: row.id, at: row.createdAt } }
      }
      previous = row.hash
      afterId = row.id
      checked++
    }
  }
  return { ok: true, checked, brokenAt: null }
}

// --- words for the screen ---

const MODEL_LABEL: Record<string, string> = {
  UserAccount: 'Login',
  UserAccountRole: 'Role given',
  RolePermission: 'Role access',
  EmployeeOnboarding: 'Joining record',
  EmployeeStatutory: 'PF / ESIC details',
  EmployeeMedicalInfo: 'Medical information',
  CandidateSalaryLine: 'Offer salary line',
  EmployeeSalaryLine: 'Salary line',
  OfferNumberSequence: 'Offer number series',
  PlantDepartment: 'Department at a plant',
  HodAppointment: 'HOD appointment',
  JobChangeRequest: 'Job change',
  JobChangeSalary: 'Proposed salary',
  JobChangeSalaryLine: 'Proposed salary line',
  ApprovalRequest: 'Approval request',
  ApprovalRequestStep: 'Approval step',
  ApprovalChain: 'Approval chain',
  ApprovalChainStep: 'Approval chain step',
  EmployeeJobRecord: 'Job timeline entry',
}
const modelLabel = (model: string) => MODEL_LABEL[model] ?? sentence(model.replace(/([a-z])([A-Z])/g, '$1 $2'))
const modelOption = (model: string) => ({ value: model, label: modelLabel(model) })

// "dateOfJoining" -> "Date of joining", "designationId" -> "Designation", "offerSentById" -> "Offer sent by"
const FIELD_LABEL: Record<string, string> = { passwordHash: 'Password', roleId: 'Role', hodPostId: 'HOD post', postId: 'HOD post' }
const fieldLabel = (field: string) => FIELD_LABEL[field] ?? sentence(field.replace(/ById$/, 'By').replace(/Id$/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2'))
// First letter capital, the rest small - except the words written in capitals (PF, ESIC, UAN...)
const sentence = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1).toLowerCase().replace(/(pf|esic|uan|ifsc|pan|ctc|ip|sap|gstin|tan|pt|bgv|id|url)/g, (w) => w.toUpperCase())

// Fields that hold an employee's id
const isPersonField = (field: string) => /ById$/.test(field) || field === 'employeeId' || field === 'reportingManagerId' || field === 'functionalManagerId'

// Fields that hold a master's id, and where its names come from
const MASTER_FIELDS = ['companyId', 'workLocationId', 'departmentId', 'designationId', 'gradeId', 'positionId', 'plantId', 'costCenterId', 'salaryComponentId', 'regionId', 'roleId', 'hodPostId', 'postId'] as const
type MasterField = (typeof MASTER_FIELDS)[number]

// The names of the masters used in these changes (one list per kind, only when needed)
async function loadNames(changes: Record<string, unknown>[]) {
  const used = new Set(changes.flatMap((c) => Object.keys(c)).filter((f): f is MasterField => (MASTER_FIELDS as readonly string[]).includes(f)))
  const all = { includeInactive: true }
  const load: Record<MasterField, () => Promise<Map<number, string>>> = {
    companyId: async () => new Map((await companiesService.listCompanies(true)).map((c) => [c.id, `${c.name} (${c.code})`])),
    workLocationId: async () => new Map((await workLocationsService.listWorkLocations(all)).map((l) => [l.id, l.name])),
    departmentId: async () => new Map((await departmentsService.listDepartments(true)).map((d) => [d.id, d.name])),
    designationId: async () => new Map((await designationsService.listDesignations(true)).map((d) => [d.id, d.name])),
    gradeId: async () => new Map((await gradesService.listGrades(true)).map((g) => [g.id, g.name])),
    positionId: async () => new Map((await positionsService.listPositions(true)).map((p) => [p.id, p.name])),
    plantId: async () => new Map((await plantsService.listPlants(all)).map((p) => [p.id, p.name])),
    costCenterId: async () => new Map((await costCentersService.listCostCenters(all)).map((c) => [c.id, c.name])),
    salaryComponentId: async () => new Map((await salaryComponentsService.listSalaryComponents(true)).map((s) => [s.id, s.name])),
    regionId: async () => new Map((await regionsService.listRegions(true)).map((r) => [r.id, r.name])),
    roleId: () => accountsService.roleNames(),
    // an employee's HOD post, an appointment's post (BACKLOG 3e): "RML · 1101 RML HQ · Maintenance"
    hodPostId: () => hodsService.listPostLabels(),
    postId: () => hodsService.listPostLabels(),
  }
  const entries = await Promise.all([...used].map(async (field) => [field, await load[field]()] as const))
  return new Map<string, Map<number, string>>(entries)
}

// A value as shown: an id as the name it stands for
function named(field: string, value: unknown, names: Map<string, Map<number, string>>, person: (id: number) => { name: string } | null) {
  if (typeof value !== 'number') return value
  if (isPersonField(field)) return person(value)?.name ?? `#${value}`
  const list = names.get(field)
  return list ? (list.get(value) ?? `#${value}`) : value
}

const ACTION_WORD: Record<string, string> = {
  CREATE: 'Created',
  UPDATE: 'Changed',
  DELETE: 'Deleted',
  SIGN_IN: 'Signed in',
  SIGN_IN_FAILED: 'Sign-in failed',
  SIGN_OUT: 'Signed out',
}
const cell = (value: unknown) => (value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value))

// The change history as an Excel file (2026-11-16, inspired by the old HRMS's download): the entries matching the
// filters, newest first (up to 20,000), one row per changed field - with the same hidden values as on the page
export async function exportChangeHistory(viewer: CurrentUser, input: z.infer<typeof exportChangeHistoryInput>) {
  const { items, total } = await listChangeHistory(viewer, { ...input, page: 1, pageSize: 20_000 })
  if (total > items.length) throw new ORPCError('BAD_REQUEST', { message: 'This report exceeds 20,000 audit entries. Narrow the filters and export again.' })
  const rows = items.flatMap((item) => {
    const base = {
      at: item.at,
      action: ACTION_WORD[item.action] ?? item.action,
      by: item.by ? `${item.by.name}${item.by.employeeCode ? ` (${item.by.employeeCode})` : ''}` : '',
      record: item.modelLabel ?? '',
      recordId: item.recordId ?? '',
      whose: item.employee ? `${item.employee.name}${item.employee.employeeCode ? ` (${item.employee.employeeCode})` : ''}` : item.candidateId ? `Candidate #${item.candidateId}` : '',
      source: item.source ?? '',
    }
    return item.changes.length
      ? item.changes.map((c) => ({ ...base, field: c.label, before: cell(c.before), after: cell(c.after) }))
      : [{ ...base, field: '', before: '', after: '' }]
  })
  const bytes = await writeReport([
    {
      name: 'Change history',
      columns: [
        { header: 'When', key: 'at', width: 20, dateTime: true },
        { header: 'What', key: 'action', width: 14 },
        { header: 'Who', key: 'by', width: 28 },
        { header: 'Record', key: 'record', width: 24 },
        { header: 'Record id', key: 'recordId', width: 10 },
        { header: 'Whose', key: 'whose', width: 28 },
        { header: 'Field', key: 'field', width: 24 },
        { header: 'Before', key: 'before', width: 30 },
        { header: 'After', key: 'after', width: 30 },
        { header: 'Made by (API)', key: 'source', width: 30 },
      ],
      rows,
    },
  ], { filters: [{label:'Filters',value:JSON.stringify(input ?? {})}], title: 'Change history', preparedBy: `${viewer.name} (${viewer.employeeCode})`, coverage: 'Audit entries matching the current filters, within the active role data scope. One row per changed field.' })
  return new File([new Uint8Array(bytes)], `change-history-${today().toISOString().slice(0, 10)}.xlsx`, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
