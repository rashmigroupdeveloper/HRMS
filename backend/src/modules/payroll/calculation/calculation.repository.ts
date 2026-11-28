import { prisma, createdBy, updatedBy, type ActorId, type DbClient, type PayHold, type SalaryComponentKind, type StatutoryRole } from '#core/db/prisma'

// Database access for what a pay run worked out (payroll stage 3: PayrollRunLine). Every function takes the run's id or
// a person of the run: the service has already found the run with whole-company Payroll scope, so these rows are reached
// only through it.

export type LineRow = { payrollRunEmployeeId: number; salaryComponentId: number; amount: number; base: number | null; kind: SalaryComponentKind; statutoryRole: StatutoryRole | null; stateCode: string | null }

// a line is nine supplied values - well under the database's limit of 65,535 values in one statement
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
      employeeId: true,
      segments: {
        orderBy: { fromDate: 'asc' },
        select: {
          fromDate: true,
          toDate: true,
          annualCtc: true,
          currency: true,
          workLocationId: true,
          employmentType: true,
          lines: { select: { salaryComponentId: true, monthlyAmount: true, salaryComponent: { select: { kind: true, cutForUnpaidDays: true } } } },
        },
      },
      inputs: { select: { salaryComponentId: true, amount: true, salaryComponent: { select: { kind: true } } } },
    },
  })
  return rows.map((row) => ({
    id: row.id,
    employeeId: row.employeeId,
    segments: row.segments.map(({ lines, ...segment }) => ({
      ...segment,
      lines: lines.map((l) => ({ salaryComponentId: l.salaryComponentId, monthlyAmount: l.monthlyAmount.toNumber(), kind: l.salaryComponent.kind, cutForUnpaidDays: l.salaryComponent.cutForUnpaidDays })),
    })),
    inputs: row.inputs.map((i) => ({ salaryComponentId: i.salaryComponentId, amount: i.amount.toNumber(), kind: i.salaryComponent.kind })),
  }))
}
export type PaySource = Awaited<ReturnType<typeof listPaySources>>[number]

// Removes everything the run worked out and why anyone was held (the people copy was rebuilt: the pay is worked out
// again)
export async function clearLines(payrollRunId: number, actorId: ActorId, db: DbClient) {
  await db.payrollRunLine.deleteMany({ where: { runEmployee: { payrollRunId } } })
  await db.payrollRunEmployee.updateMany({ where: { payrollRunId, NOT: { heldFor: { isEmpty: true } } }, data: { heldFor: [], heldNote: null, ...updatedBy(actorId) } })
}

// Removes what was worked out for one person of the run, and why they were held (their inputs changed: their pay is
// worked out again)
export async function clearPersonLines(payrollRunEmployeeId: number, actorId: ActorId, db: DbClient) {
  await db.payrollRunLine.deleteMany({ where: { payrollRunEmployeeId } })
  await db.payrollRunEmployee.update({ where: { id: payrollRunEmployeeId }, data: { heldFor: [], heldNote: null, ...updatedBy(actorId) }, select: { id: true } })
}

// Why each held person of the run could not be paid (everyone else: nothing), inside the caller's transaction
export async function writeHolds(payrollRunId: number, held: { id: number; heldFor: PayHold[]; heldNote: string | null }[], actorId: ActorId, db: DbClient) {
  await db.payrollRunEmployee.updateMany({ where: { payrollRunId, NOT: { heldFor: { isEmpty: true } } }, data: { heldFor: [], heldNote: null, ...updatedBy(actorId) } })
  for (const h of held) await db.payrollRunEmployee.update({ where: { id: h.id }, data: { heldFor: h.heldFor, heldNote: h.heldNote, ...updatedBy(actorId) }, select: { id: true } })
}

// Replaces everything the run worked out, inside the caller's transaction
export async function replaceLines(payrollRunId: number, rows: LineRow[], actorId: ActorId, db: DbClient) {
  await db.payrollRunLine.deleteMany({ where: { runEmployee: { payrollRunId } } })
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.payrollRunLine.createMany({ data: rows.slice(i, i + BATCH).map((row) => ({ ...row, ...createdBy(actorId) })) })
  }
}

// Each person's totals in the run: how many earning lines were worked out for them and the earned gross, what is
// deducted from their pay and what the company pays on top. A person with no earning line has no pay worked out (held,
// or their inputs changed since).
// data access: rows of one run the service found with whole-company Payroll scope
export async function totalsByPerson(payrollRunId: number, db: DbClient = prisma) {
  const sum = (kind: SalaryComponentKind) =>
    db.payrollRunLine.groupBy({ by: ['payrollRunEmployeeId'], where: { runEmployee: { payrollRunId }, kind }, _count: { _all: true }, _sum: { amount: true } })
  const [earned, deducted, employer] = await Promise.all([sum('EARNING'), sum('DEDUCTION'), sum('EMPLOYER_CONTRIBUTION')])
  const totals = new Map<number, { lines: number; earned: number; deducted: number; employer: number }>()
  const of = (id: number) => totals.get(id) ?? (totals.set(id, { lines: 0, earned: 0, deducted: 0, employer: 0 }).get(id)!)
  for (const g of earned) Object.assign(of(g.payrollRunEmployeeId), { lines: g._count._all, earned: g._sum.amount?.toNumber() ?? 0 })
  for (const g of deducted) of(g.payrollRunEmployeeId).deducted = g._sum.amount?.toNumber() ?? 0
  for (const g of employer) of(g.payrollRunEmployeeId).employer = g._sum.amount?.toNumber() ?? 0
  return totals
}

// The people of the run with a line of the component carrying this statutory role (e.g. who has PF)
// data access: rows of one run the service found with whole-company Payroll scope
export async function peopleWithRole(payrollRunId: number, role: StatutoryRole, db: DbClient = prisma) {
  const rows = await db.payrollRunLine.findMany({ where: { runEmployee: { payrollRunId }, statutoryRole: role }, select: { payrollRunEmployeeId: true } })
  return new Set(rows.map((r) => r.payrollRunEmployeeId))
}

// What was worked out for one person, in the order of the payslip
export async function listPersonLines(payrollRunEmployeeId: number, db: DbClient = prisma) {
  const rows = await db.payrollRunLine.findMany({
    where: { payrollRunEmployeeId },
    orderBy: [{ salaryComponent: { displayOrder: 'asc' } }, { salaryComponent: { name: 'asc' } }],
    select: { amount: true, base: true, kind: true, statutoryRole: true, stateCode: true, salaryComponent: { select: { id: true, name: true, code: true, enteredMonthly: true, cutForUnpaidDays: true } } },
  })
  return rows.map((r) => ({ component: { ...r.salaryComponent, kind: r.kind, statutoryRole: r.statutoryRole }, stateCode: r.stateCode, amount: r.amount.toNumber(), base: r.base?.toNumber() ?? null }))
}

// data access: one run or explicit people already checked by its Payroll / Payroll payments service; the background job
// checks only a released run. Returns presence only, never reads other companies to a viewer.
export async function hasUnclassifiedLines(filter: { runId: number } | { personIds: number[] }, db: DbClient = prisma) {
  return (await db.payrollRunLine.findFirst({
    where: { kind: null, ...('runId' in filter ? { runEmployee: { payrollRunId: filter.runId } } : { payrollRunEmployeeId: { in: filter.personIds } }) },
    select: { id: true },
  })) !== null
}
