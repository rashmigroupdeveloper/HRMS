import { createdBy, prisma, updatedBy, type ActorId, type DbClient } from '#core/db/prisma'

// Database access for "attendance not tracked" (2026-11-27): the stretches of days on which an employee counts present
// without punches. (The day calculation reads them with its other inputs - days.repository.)

const select = { id: true, employeeId: true, fromDate: true, toDate: true, reason: true } as const

// These employees' stretches that touch from..to (to null: with no end)
// data access: the service checked Attendance setup Edit covering each of these employees first
export function listOverlapping(employeeIds: number[], from: Date, to: Date | null, db: DbClient = prisma) {
  return db.attendanceExemption.findMany({
    where: { employeeId: { in: employeeIds }, ...(to && { fromDate: { lte: to } }), OR: [{ toDate: null }, { toDate: { gte: from } }] },
    orderBy: [{ employeeId: 'asc' }, { fromDate: 'asc' }],
    select,
  })
}

// These employees' stretches not yet over on a day: the one in force and those still to start, the earliest first
// data access: the Schedules list chose the employees - those inside the viewer's Attendance setup View data access
export function listFrom(employeeIds: number[], day: Date, db: DbClient = prisma) {
  return db.attendanceExemption.findMany({
    where: { employeeId: { in: employeeIds }, OR: [{ toDate: null }, { toDate: { gte: day } }] },
    orderBy: [{ employeeId: 'asc' }, { fromDate: 'asc' }],
    select,
  })
}

// One stretch with where its employee is (the service checks the viewer's data access with it)
export function find(id: number, db: DbClient = prisma) {
  return db.attendanceExemption.findUnique({
    where: { id },
    select: { ...select, employee: { select: { employeeCode: true, companyId: true, plantId: true, departmentId: true } } },
  })
}

export function createMany(rows: { employeeId: number; fromDate: Date; toDate: Date | null; reason: string }[], actorId: ActorId, db: DbClient = prisma) {
  return db.attendanceExemption.createMany({ data: rows.map((row) => ({ ...row, ...createdBy(actorId) })) })
}

export function update(id: number, data: { toDate: Date | null; reason?: string }, actorId: ActorId, db: DbClient = prisma) {
  return db.attendanceExemption.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select })
}

export function deleteExemption(id: number, db: DbClient = prisma) {
  return db.attendanceExemption.delete({ where: { id }, select: { id: true } })
}
