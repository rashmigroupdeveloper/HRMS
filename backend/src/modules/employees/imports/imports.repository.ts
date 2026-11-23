import { createdBy, prisma, type ActorId, type DbClient, type EmployeeImportStatus, type Prisma } from '#core/db/prisma'

// Data access for the employee import: checks of a whole file at once (one query per check, not one per row).

// Which of these (upper-case) employee codes are already used
// data access: whole group on purpose - an employee code must be unique in every company
export async function listUsedCodes(codes: string[], db: DbClient = prisma) {
  if (!codes.length) return new Set<string>()
  const rows = await db.employee.findMany({ where: { employeeCode: { in: codes } }, select: { employeeCode: true } })
  return new Set(rows.map((row) => row.employeeCode))
}

// Which of these (lower-case) work e-mails are already used, with the employee using each
// data access: whole group on purpose - a work e-mail must be unique in every company
export async function listUsedWorkEmails(emails: string[], db: DbClient = prisma) {
  if (!emails.length) return new Map<string, string>()
  const rows = await db.employee.findMany({ where: { workEmail: { in: emails } }, select: { workEmail: true, employeeCode: true } })
  return new Map(rows.map((row) => [row.workEmail ?? '', row.employeeCode]))
}

// The employees with these codes who could be reporting managers: id and status
// data access: whole group on purpose - a reporting manager may work in another company / plant
export async function listManagersByCodes(codes: string[], db: DbClient = prisma) {
  if (!codes.length) return new Map<string, { id: number; status: string }>()
  const rows = await db.employee.findMany({ where: { employeeCode: { in: codes } }, select: { id: true, employeeCode: true, status: true } })
  return new Map(rows.map((row) => [row.employeeCode, { id: row.id, status: row.status }]))
}

// The employees with these codes, with what an update by the import is checked against
// data access: the import then checks each row's employee against the uploader's data access (imports.service)
export async function listExistingByCodes(codes: string[], db: DbClient = prisma) {
  if (!codes.length) return new Map<string, ExistingEmployee>()
  const rows = await db.employee.findMany({
    // a code someone had before a company transfer names them too (2026-11-20 - never a new employee)
    where: { OR: [{ employeeCode: { in: codes } }, { formerCodes: { some: { employeeCode: { in: codes } } } }] },
    select: {
      id: true,
      employeeCode: true,
      companyId: true,
      plantId: true,
      departmentId: true,
      dateOfBirth: true,
      dateOfJoining: true,
      employmentType: true,
      contractEndDate: true,
      probationEndDate: true,
      confirmationDate: true,
      // the job details - a row changing them needs "Approve job & salary changes" (D7, 2026-11-20)
      workLocationId: true,
      designationId: true,
      gradeId: true,
      positionId: true,
      costCenterId: true,
      workforceCategory: true,
      reportingManager: { select: { employeeCode: true } },
      functionalManager: { select: { employeeCode: true } },
      formerCodes: { select: { employeeCode: true } },
    },
  })
  return new Map(rows.flatMap(({ formerCodes, ...row }) => [[row.employeeCode, row] as const, ...formerCodes.map((f) => [f.employeeCode, row] as const)]))
}
export type ExistingEmployee = {
  id: number
  employeeCode: string
  companyId: number
  plantId: number
  departmentId: number | null
  dateOfBirth: Date | null
  dateOfJoining: Date
  employmentType: Prisma.EmployeeGetPayload<{ select: { employmentType: true } }>['employmentType']
  contractEndDate: Date | null
  probationEndDate: Date | null
  confirmationDate: Date | null
  workLocationId: number | null
  designationId: number | null
  gradeId: number | null
  positionId: number | null
  costCenterId: number | null
  workforceCategory: Prisma.EmployeeGetPayload<{ select: { workforceCategory: true } }>['workforceCategory']
  reportingManager: { employeeCode: string } | null
  functionalManager: { employeeCode: string } | null
}

// --- the history of imports ---

const importSelect = {
  id: true,
  fileName: true,
  status: true,
  rowCount: true,
  createdCount: true,
  updatedCount: true,
  createdAt: true,
  createdById: true,
} satisfies Prisma.EmployeeImportSelect

export function createImport(
  data: { fileName: string; status: EmployeeImportStatus; rowCount: number; createdCount: number; updatedCount: number; errors?: Prisma.InputJsonValue },
  actorId: ActorId,
  db: DbClient = prisma,
) {
  return db.employeeImport.create({ data: { ...data, ...createdBy(actorId) }, select: importSelect })
}

export function listImports(take: number, db: DbClient = prisma) {
  return db.employeeImport.findMany({ orderBy: { id: 'desc' }, take, select: importSelect })
}

export function findImportErrors(id: number, db: DbClient = prisma) {
  return db.employeeImport.findUnique({ where: { id }, select: { id: true, fileName: true, createdAt: true, errors: true } })
}
