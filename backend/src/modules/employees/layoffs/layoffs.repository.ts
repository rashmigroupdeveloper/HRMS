import { createdBy, prisma, updatedBy, type ActorId, type DbClient, type NewRow, type Prisma } from '#core/db/prisma'

// Database access for employee_layoffs (one employee's rows - the service checks the person first).

const layoffSelect = {
  id: true,
  startDate: true,
  rejoinDate: true,
  reason: true,
  createdAt: true,
  createdById: true,
  updatedAt: true,
  updatedById: true,
} satisfies Prisma.EmployeeLayoffSelect

// The employee's lay offs, latest first
export function list(employeeId: number, db: DbClient = prisma) {
  return db.employeeLayoff.findMany({ where: { employeeId }, orderBy: { startDate: 'desc' }, select: layoffSelect })
}

// The lay off with its employee - who they are and where (data-access checks) - or null
export function findById(id: number, db: DbClient = prisma) {
  return db.employeeLayoff.findUnique({
    where: { id },
    select: { ...layoffSelect, employee: { select: { id: true, employeeCode: true, companyId: true, plantId: true, departmentId: true, dateOfJoining: true } } },
  })
}

// The employee's date of joining (a lay off cannot start before it) and status (none for one who has left), or null
export function findEmployee(employeeId: number, db: DbClient = prisma) {
  return db.employee.findUnique({ where: { id: employeeId }, select: { employeeCode: true, dateOfJoining: true, status: true } })
}

// Holds this employee's lay offs until the transaction ends: the overlap rules are checked after it, so two changes at the
// same moment cannot both pass them (2026-11-23, the review)
export async function lockEmployee(employeeId: number, db: DbClient) {
  await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('employee-layoffs'), ${employeeId}::int)::text AS locked`
}

export function create(data: NewRow<Prisma.EmployeeLayoffUncheckedCreateInput>, actorId: ActorId, db: DbClient = prisma) {
  return db.employeeLayoff.create({ data: { ...data, ...createdBy(actorId) }, select: layoffSelect })
}

export function update(id: number, data: Prisma.EmployeeLayoffUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.employeeLayoff.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: layoffSelect })
}

export function remove(id: number, db: DbClient = prisma) {
  return db.employeeLayoff.delete({ where: { id }, select: { id: true } })
}
