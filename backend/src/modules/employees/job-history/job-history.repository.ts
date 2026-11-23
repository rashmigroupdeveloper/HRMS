import { createdBy, prisma, updatedBy, type ActorId, type DbClient, type EmploymentType, type JobChangeKind, type Prisma, type WorkforceCategory } from '#core/db/prisma'

// Database access for employee_job_records - the job timeline (one employee's rows; the service checks the person first).

// The job details a timeline entry holds - the same columns as on Employee
export const JOB_FIELDS = [
  'plantId',
  'departmentId',
  'workLocationId',
  'designationId',
  'gradeId',
  'positionId',
  'costCenterId',
  'reportingManagerId',
  'functionalManagerId',
  'employmentType',
  'workforceCategory',
] as const
export type JobField = (typeof JOB_FIELDS)[number]
export type JobDetails = {
  plantId: number
  departmentId: number
  workLocationId: number | null
  designationId: number | null
  gradeId: number | null
  positionId: number | null
  costCenterId: number | null
  reportingManagerId: number | null
  functionalManagerId: number | null
  employmentType: EmploymentType
  workforceCategory: WorkforceCategory
}

// The job details out of an employee row / input (a missing optional one = none)
export function jobDetailsOf(row: { plantId: number; departmentId: number; employmentType: EmploymentType; workforceCategory: WorkforceCategory } & Partial<Record<JobField, unknown>>): JobDetails {
  const id = (value: unknown) => (typeof value === 'number' ? value : null)
  return {
    plantId: row.plantId,
    departmentId: row.departmentId,
    workLocationId: id(row.workLocationId),
    designationId: id(row.designationId),
    gradeId: id(row.gradeId),
    positionId: id(row.positionId),
    costCenterId: id(row.costCenterId),
    reportingManagerId: id(row.reportingManagerId),
    functionalManagerId: id(row.functionalManagerId),
    employmentType: row.employmentType,
    workforceCategory: row.workforceCategory,
  }
}

// The first entry of a new employee: the details they joined with, from the date of joining - created with the employee
export function joiningRecord(details: JobDetails, held: { companyId: number; employeeCode: string }, dateOfJoining: Date, actorId: ActorId) {
  return { ...details, ...held, effectiveFrom: dateOfJoining, kind: 'JOINING' as const, ...createdBy(actorId) }
}

const recordSelect = {
  id: true,
  effectiveFrom: true,
  kind: true,
  note: true,
  ...Object.fromEntries(JOB_FIELDS.map((f) => [f, true])),
  jobChangeRequestId: true,
  companyId: true,
  employeeCode: true,
  createdAt: true,
  createdById: true,
} as { id: true; effectiveFrom: true; kind: true; note: true; jobChangeRequestId: true; companyId: true; employeeCode: true; createdAt: true; createdById: true } & Record<JobField, true>

const person = { select: { employeeCode: true, firstName: true, middleName: true, lastName: true } } as const
// with the names of what the ids stand for (the timeline shows names)
const namedSelect = {
  ...recordSelect,
  company: { select: { code: true, name: true } },
  plant: { select: { plantCode: true, name: true } },
  department: { select: { name: true } },
  workLocation: { select: { name: true } },
  designation: { select: { name: true } },
  grade: { select: { name: true } },
  position: { select: { name: true } },
  costCenter: { select: { code: true, name: true } },
  reportingManager: person,
  functionalManager: person,
} satisfies Prisma.EmployeeJobRecordSelect

// The employee's timeline, latest first, with names
export function listNamed(employeeId: number, db: DbClient = prisma) {
  return db.employeeJobRecord.findMany({ where: { employeeId }, orderBy: { effectiveFrom: 'desc' }, select: namedSelect })
}

// The entry in force on a day (the latest from that day or before), with names - or null before the first
export function findNamedOn(employeeId: number, day: Date, db: DbClient = prisma) {
  return db.employeeJobRecord.findFirst({ where: { employeeId, effectiveFrom: { lte: day } }, orderBy: { effectiveFrom: 'desc' }, select: namedSelect })
}

// The names of what a set of job details stands for (a job change shows old -> new)
export async function findNames(d: JobDetails, db: DbClient = prisma) {
  const [plant, department, workLocation, designation, grade, position, costCenter, reportingManager, functionalManager] = await Promise.all([
    db.plant.findUnique({ where: { id: d.plantId }, select: { plantCode: true, name: true } }),
    db.department.findUnique({ where: { id: d.departmentId }, select: { name: true } }),
    d.workLocationId === null ? null : db.workLocation.findUnique({ where: { id: d.workLocationId }, select: { name: true } }),
    d.designationId === null ? null : db.designation.findUnique({ where: { id: d.designationId }, select: { name: true } }),
    d.gradeId === null ? null : db.grade.findUnique({ where: { id: d.gradeId }, select: { name: true } }),
    d.positionId === null ? null : db.position.findUnique({ where: { id: d.positionId }, select: { name: true } }),
    d.costCenterId === null ? null : db.costCenter.findUnique({ where: { id: d.costCenterId }, select: { code: true, name: true } }),
    d.reportingManagerId === null ? null : db.employee.findUnique({ where: { id: d.reportingManagerId }, select: person.select }),
    d.functionalManagerId === null ? null : db.employee.findUnique({ where: { id: d.functionalManagerId }, select: person.select }),
  ])
  return { plant, department, workLocation, designation, grade, position, costCenter, reportingManager, functionalManager }
}

// The employee's entries, earliest first (ids only)
export function list(employeeId: number, db: DbClient = prisma) {
  return db.employeeJobRecord.findMany({ where: { employeeId }, orderBy: { effectiveFrom: 'asc' }, select: recordSelect })
}

// The entry with its employee - who they are and where (data-access checks) - or null
export function findById(id: number, db: DbClient = prisma) {
  return db.employeeJobRecord.findUnique({
    where: { id },
    select: { ...recordSelect, employee: { select: { id: true, employeeCode: true, companyId: true, plantId: true, departmentId: true } } },
  })
}

// The employee's job details as they are now, with the date of joining, or null
export function findEmployeeJob(employeeId: number, db: DbClient = prisma) {
  return db.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, employeeCode: true, companyId: true, dateOfJoining: true, ...Object.fromEntries(JOB_FIELDS.map((f) => [f, true])) } as {
      id: true
      employeeCode: true
      companyId: true
      dateOfJoining: true
    } & Record<JobField, true>,
  })
}

// The employees with no timeline entry yet (they were added before the timeline existed)
// data access: a one-off script (scripts/backfill-job-records.ts) - every employee, no logged-in person
export async function listEmployeeIdsWithoutRecords(db: DbClient = prisma) {
  const rows = await db.employee.findMany({ where: { jobRecords: { none: {} } }, select: { id: true }, orderBy: { id: 'asc' } })
  return rows.map((row) => row.id)
}

export function create(
  data: JobDetails & {
    employeeId: number
    companyId: number
    employeeCode: string
    effectiveFrom: Date
    kind: JobChangeKind
    note?: string | null | undefined
    jobChangeRequestId?: number | null
  },
  actorId: ActorId,
  db: DbClient = prisma,
) {
  return db.employeeJobRecord.create({ data: { ...data, ...createdBy(actorId) }, select: recordSelect })
}

export function update(id: number, data: Prisma.EmployeeJobRecordUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.employeeJobRecord.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: recordSelect })
}

