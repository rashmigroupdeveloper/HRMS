import { type DataScope, scopeWhere } from '#core/auth/scope'
import { createdBy, prisma, updatedBy, type ActorId, type DbClient, type Prisma } from '#core/db/prisma'

// Database access for HOD appointments (BACKLOG 3e - an HOD post is a plant-department, changed with the user 2026-11-19)
// and the employees' HOD post. The posts themselves (plant-departments) come from the organization module.
// An appointment runs from `startsAt` until `endsAt` (not included; empty = no end) - see organization.prisma.

const personSelect = {
  id: true,
  employeeCode: true,
  firstName: true,
  middleName: true,
  lastName: true,
  status: true,
  dateOfLeaving: true,
} satisfies Prisma.EmployeeSelect

const appointmentSelect = {
  id: true,
  postId: true,
  startsAt: true,
  endsAt: true,
  createdById: true,
  employee: { select: personSelect },
} satisfies Prisma.HodAppointmentSelect

// not over at `now`: no end, or an end after it
const notOver = (now: Date) => ({ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }) satisfies Prisma.HodAppointmentWhereInput
// going on at `now`: begun, and not over
const goingOn = (now: Date) => ({ AND: [{ startsAt: { lte: now } }, notOver(now)] }) satisfies Prisma.HodAppointmentWhereInput

// The appointments not over at `now` - the ones going on and the upcoming ones - earliest first
// data access: HOD posts are places, not people's records - the service keeps the ones inside the viewer's data access
export function listOpenAppointments(now: Date, db: DbClient = prisma) {
  return db.hodAppointment.findMany({ where: notOver(now), orderBy: [{ startsAt: 'asc' }, { id: 'asc' }], select: appointmentSelect })
}

// A post's appointments, the latest first - its history
// data access: one post's history - the service checked that the post is inside the viewer's data access
export function listAppointmentsOfPost(postId: number, db: DbClient = prisma) {
  return db.hodAppointment.findMany({ where: { postId }, orderBy: [{ startsAt: 'desc' }, { id: 'desc' }], select: appointmentSelect })
}

// Every appointment of these posts, by post and earliest first - to change them
// data access: posts the service checked first
export function listAppointmentsOfPosts(postIds: number[], db: DbClient = prisma) {
  if (!postIds.length) return Promise.resolve([])
  return db.hodAppointment.findMany({ where: { postId: { in: postIds } }, orderBy: [{ postId: 'asc' }, { startsAt: 'asc' }], select: appointmentSelect })
}

// An employee's appointments, the latest first - the posts they head, will head or headed
export function listAppointmentsOfEmployee(employeeId: number, db: DbClient = prisma) {
  return db.hodAppointment.findMany({ where: { employeeId }, orderBy: [{ startsAt: 'desc' }, { id: 'desc' }], select: appointmentSelect })
}

// Who heads the post at `now` (an employee id), or null - an approval step named to the HOD (modules/approvals)
export async function findHolderAt(postId: number, now: Date, db: DbClient = prisma) {
  const row = await db.hodAppointment.findFirst({ where: { AND: [{ postId }, goingOn(now)] }, select: { employeeId: true } })
  return row?.employeeId ?? null
}

// The posts the employee heads at `now`
export async function listPostIdsHeldAt(employeeId: number, now: Date, db: DbClient = prisma) {
  const rows = await db.hodAppointment.findMany({ where: { AND: [{ employeeId }, goingOn(now)] }, select: { postId: true } })
  return rows.map((row) => row.postId)
}

// How many posts the employee heads at `now`
export function countHeldAt(employeeId: number, now: Date, db: DbClient = prisma) {
  return db.hodAppointment.count({ where: { AND: [{ employeeId }, goingOn(now)] } })
}

// Holds these posts until the transaction ends, so two changes of one post's HOD at the same moment run one after the
// other and the second sees the first (a lock of its own - no table row is locked; in id order, so two calls never wait
// on each other). The database also refuses two appointments of a post that overlap (hod_appointments_no_overlap).
export async function lockPosts(postIds: number[], db: DbClient) {
  for (const id of [...new Set(postIds)].sort((a, b) => a - b)) {
    await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('hod-post'), ${id}::int)::text AS locked`
  }
}

export function createAppointments(rows: { postId: number; employeeId: number; startsAt: Date }[], actorId: ActorId, db: DbClient = prisma) {
  return db.hodAppointment.createMany({ data: rows.map((row) => ({ ...row, ...createdBy(actorId) })) })
}

// Sets when an appointment ends (null: no end) - or, for one that has not begun, when it starts
export function updateAppointment(id: number, data: { startsAt?: Date; endsAt?: Date | null }, actorId: ActorId, db: DbClient = prisma) {
  return db.hodAppointment.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: { id: true } })
}

// Removes appointments that have not begun (cancelled - they never took effect; the change history keeps them)
export function deleteAppointments(ids: number[], db: DbClient = prisma) {
  return db.hodAppointment.deleteMany({ where: { id: { in: ids } } })
}

// --- the employees ---

// The employee with this (upper-case) code - whether they left - or null
export function findEmployeeByCode(employeeCode: string, db: DbClient = prisma) {
  return db.employee.findUnique({ where: { employeeCode }, select: personSelect })
}

// How many employees who have not left have each post - of those in `scope` (the counts follow data access)
export async function countEmployeesByPost(scope: DataScope, db: DbClient = prisma) {
  const rows = await db.employee.groupBy({
    by: ['hodPostId'],
    where: { AND: [scopeWhere(scope), { hodPostId: { not: null }, status: { not: 'EXITED' } }] },
    _count: { _all: true },
  })
  return new Map(rows.map((row) => [row.hodPostId ?? 0, row._count._all]))
}

// The employees who have not left whose HOD post is one of these, but `exceptId` (the HOD) - an HOD's "My department"
// (directory & job). `scope`: SYSTEM_SCOPE from the service - the HOD relationship (the posts the viewer heads)
export function listOnPosts(filter: { scope: DataScope; postIds: number[]; exceptId: number }, db: DbClient = prisma) {
  if (!filter.postIds.length) return Promise.resolve([])
  return db.employee.findMany({
    where: { AND: [scopeWhere(filter.scope), { hodPostId: { in: filter.postIds }, status: { not: 'EXITED' }, id: { not: filter.exceptId } }] },
    orderBy: { employeeCode: 'asc' },
    select: {
      employeeCode: true,
      firstName: true,
      middleName: true,
      lastName: true,
      status: true,
      hodPostId: true,
      employmentType: true,
      dateOfJoining: true,
      workEmail: true,
      company: { select: { code: true } },
      plant: { select: { plantCode: true, name: true } },
      workLocation: { select: { name: true } },
      department: { select: { name: true } },
      designation: { select: { name: true } },
      reportingManager: { select: { employeeCode: true, firstName: true, middleName: true, lastName: true } },
    },
  })
}

// The ids of the employees whose HOD post is one of these, whatever their status, but `exceptId` - attendance's "My
// department" (it keeps only the days they were employed). `scope`: SYSTEM_SCOPE from the service - the HOD relationship
export async function listIdsOnPosts(filter: { scope: DataScope; postIds: number[]; exceptId: number }, db: DbClient = prisma) {
  if (!filter.postIds.length) return []
  const rows = await db.employee.findMany({
    where: { AND: [scopeWhere(filter.scope), { hodPostId: { in: filter.postIds }, id: { not: filter.exceptId } }] },
    select: { id: true },
  })
  return rows.map((row) => row.id)
}
