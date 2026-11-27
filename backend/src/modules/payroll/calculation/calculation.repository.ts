import { prisma, createdBy, type ActorId, type DbClient } from '#core/db/prisma'

// Database access for what a pay run worked out (payroll stage 3: PayrollRunLine). Every function takes the run's id or
// a person of the run: the service has already found the run with whole-company Payroll scope, so these rows are reached
// only through it.

export type LineRow = { payrollRunEmployeeId: number; salaryComponentId: number; amount: number }

// a line is about half a dozen values - well under the database's limit of 65,535 values in one statement
const BATCH = 5000

// What each person's pay is worked out from: the stretches of the salary copy (each line with its component's kind and
// whether it is cut for unpaid days) and the inputs typed for them
// data access: rows of one run the service found with whole-company Payroll scope
export async function listPaySources(payrollRunId: number, db: DbClient = prisma) {
  const rows = await db.payrollRunEmployee.findMany({
    where: { payrollRunId },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      segments: {
        orderBy: { fromDate: 'asc' },
        select: {
          fromDate: true,
          toDate: true,
          annualCtc: true,
          currency: true,
          lines: { select: { salaryComponentId: true, monthlyAmount: true, salaryComponent: { select: { kind: true, cutForUnpaidDays: true } } } },
        },
      },
      inputs: { select: { salaryComponentId: true, amount: true, salaryComponent: { select: { kind: true } } } },
    },
  })
  return rows.map((row) => ({
    id: row.id,
    segments: row.segments.map(({ lines, ...segment }) => ({
      ...segment,
      lines: lines.map((l) => ({ salaryComponentId: l.salaryComponentId, monthlyAmount: l.monthlyAmount.toNumber(), kind: l.salaryComponent.kind, cutForUnpaidDays: l.salaryComponent.cutForUnpaidDays })),
    })),
    inputs: row.inputs.map((i) => ({ salaryComponentId: i.salaryComponentId, amount: i.amount.toNumber(), kind: i.salaryComponent.kind })),
  }))
}
export type PaySource = Awaited<ReturnType<typeof listPaySources>>[number]

// Removes everything the run worked out (the people copy was rebuilt: the pay is worked out again)
export function clearLines(payrollRunId: number, db: DbClient) {
  return db.payrollRunLine.deleteMany({ where: { runEmployee: { payrollRunId } } })
}

// Removes what was worked out for one person of the run (their inputs changed: their pay is worked out again)
export function clearPersonLines(payrollRunEmployeeId: number, db: DbClient) {
  return db.payrollRunLine.deleteMany({ where: { payrollRunEmployeeId } })
}

// Replaces everything the run worked out, inside the caller's transaction
export async function replaceLines(payrollRunId: number, rows: LineRow[], actorId: ActorId, db: DbClient) {
  await clearLines(payrollRunId, db)
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.payrollRunLine.createMany({ data: rows.slice(i, i + BATCH).map((row) => ({ ...row, ...createdBy(actorId) })) })
  }
}

// Each person's earnings in the run: how many earning lines were worked out for them and what they add up to (the
// earned gross). A person with none has no pay worked out (held, or their inputs changed since).
// data access: rows of one run the service found with whole-company Payroll scope
export async function earningsByPerson(payrollRunId: number, db: DbClient = prisma) {
  const groups = await db.payrollRunLine.groupBy({
    by: ['payrollRunEmployeeId'],
    where: { runEmployee: { payrollRunId }, salaryComponent: { kind: 'EARNING' } },
    _count: { _all: true },
    _sum: { amount: true },
  })
  return new Map(groups.map((g) => [g.payrollRunEmployeeId, { lines: g._count._all, amount: g._sum.amount?.toNumber() ?? 0 }]))
}

// What was worked out for one person, in the order of the payslip
export async function listPersonLines(payrollRunEmployeeId: number, db: DbClient = prisma) {
  const rows = await db.payrollRunLine.findMany({
    where: { payrollRunEmployeeId },
    orderBy: [{ salaryComponent: { displayOrder: 'asc' } }, { salaryComponent: { name: 'asc' } }],
    select: { amount: true, salaryComponent: { select: { id: true, name: true, code: true, kind: true, enteredMonthly: true, cutForUnpaidDays: true } } },
  })
  return rows.map((r) => ({ component: r.salaryComponent, amount: r.amount.toNumber() }))
}
