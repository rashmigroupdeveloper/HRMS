import { prisma, createdBy, type ActorId, type DayStatus, type DbClient, type PayClass } from '#core/db/prisma'

// Database access for a pay run's days (payroll stage 3). Every function takes the run's id or a person of the run:
// the service has already found the run with whole-company Payroll scope, so these rows are reached only through it.

export type DayRow = {
  payrollRunEmployeeId: number
  date: Date
  firstHalf: PayClass
  secondHalf: PayClass
  firstStatus: DayStatus | null
  secondStatus: DayStatus | null
  firstLeaveCode: string | null
  secondLeaveCode: string | null
}

const BATCH = 2000

// The people of the run with the stretches of days they are in the company (their days are only inside these)
// data access: rows of one run the service found with whole-company Payroll scope
export function listSpans(payrollRunId: number, db: DbClient = prisma) {
  return db.payrollRunEmployee.findMany({
    where: { payrollRunId },
    orderBy: { id: 'asc' },
    select: { id: true, employeeId: true, segments: { orderBy: { fromDate: 'asc' }, select: { fromDate: true, toDate: true } } },
  })
}

// Removes every day of the run (the people copy was rebuilt: the days are worked out again)
export function clearDays(payrollRunId: number, db: DbClient) {
  return db.payrollRunDay.deleteMany({ where: { runEmployee: { payrollRunId } } })
}

// Replaces every day of the run, inside the caller's transaction
export async function replaceDays(payrollRunId: number, rows: DayRow[], actorId: ActorId, db: DbClient) {
  await clearDays(payrollRunId, db)
  // in batches well under the database's limit of 65,535 values in one statement (a row is about a dozen values)
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.payrollRunDay.createMany({ data: rows.slice(i, i + BATCH).map((row) => ({ ...row, ...createdBy(actorId) })) })
  }
}

// The days of the run counted per person by how their two halves are classed and what attendance said - the totals of
// the people list and the run's header are added up from these few rows per person
// data access: rows of one run the service found with whole-company Payroll scope
export async function groupHalves(payrollRunId: number, db: DbClient = prisma) {
  const groups = await db.payrollRunDay.groupBy({
    by: ['payrollRunEmployeeId', 'firstHalf', 'secondHalf', 'firstStatus', 'secondStatus'],
    where: { runEmployee: { payrollRunId } },
    _count: { _all: true },
  })
  return groups.map(({ _count, ...group }) => ({ ...group, days: _count._all }))
}

// One person's days in the run, in date order
export function listPersonDays(payrollRunEmployeeId: number, db: DbClient = prisma) {
  return db.payrollRunDay.findMany({
    where: { payrollRunEmployeeId },
    orderBy: { date: 'asc' },
    select: { date: true, firstHalf: true, secondHalf: true, firstStatus: true, secondStatus: true, firstLeaveCode: true, secondLeaveCode: true },
  })
}
