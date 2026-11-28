import { scopeWhere, type DataScope } from '#core/auth/scope'
import { prisma, createdBy, updatedBy, type ActorId, type DbClient, type DepositGapReason, type Prisma, type StatutoryRole, type StatutoryScheme } from '#core/db/prisma'

// Database access for the statutory deposits (payroll stage 6 slice 3: StatutoryDeposit, StatutoryDepositGap). The
// approved runs and the deposits are found with whole-company Statutory deposits scope (`wholeCompanyScopeOf` - a run and
// a deposit belong to one company); the people and lines hanging on a run are reached only through it. What is due is never
// stored: it is added up from the runs' lines each time, by the classification each line SAVED when its pay was worked out
// (`PayrollRunLine.statutoryRole / stateCode` - CLAUDE.md "Classification snapshots"), never by today's component or work
// location. A run with lines saved before those snapshots (`kind` empty) stays out of the deposits until it is reconciled.

// --- The approved runs and what they worked out ---

// The FINALISED runs in the scope - of one company / one pay month, or all
export function listFinalRuns(scope: DataScope, filter: { companyId?: number | undefined; payMonth?: Date | undefined }, db: DbClient = prisma) {
  return db.payrollRun.findMany({
    where: { AND: [scopeWhere(scope), { status: 'FINALISED' }, ...(filter.companyId ? [{ companyId: filter.companyId }] : []), ...(filter.payMonth ? [{ payMonth: filter.payMonth }] : [])] },
    orderBy: [{ payMonth: 'desc' }, { companyId: 'asc' }],
    select: { id: true, payMonth: true, payslipsReleasedAt: true, company: { select: { id: true, code: true, name: true } } },
  })
}

// The runs among these with a line saved before the classification snapshots (`kind` empty) - they cannot be added up
// data access: runs the service found with whole-company Statutory deposits scope (or the reminder job's own read)
export async function listUnverifiedRuns(runIds: number[], db: DbClient = prisma) {
  if (!runIds.length) return new Set<number>()
  const rows = await db.payrollRun.findMany({ where: { id: { in: runIds }, employees: { some: { lines: { some: { kind: null } } } } }, select: { id: true } })
  return new Set(rows.map((r) => r.id))
}

// The statutory amounts of these runs added up per run, SAVED statutory role and SAVED State (the State the run charged
// professional tax and LWF by): how many people, the amount and what it was worked out on. One query in the database - a
// list of every month would otherwise read every person's lines.
// data access: runs the service found with whole-company Statutory deposits scope (or the reminder job's own read)
export async function sumStatutory(runIds: number[], db: DbClient = prisma) {
  if (!runIds.length) return []
  const rows = await db.$queryRaw<{ runId: number; role: StatutoryRole; stateCode: string | null; people: number; amount: string; base: string | null }[]>`
    SELECT e.payroll_run_id AS "runId", l.statutory_role::text AS "role", l.state_code AS "stateCode",
           COUNT(*)::int AS "people", SUM(l.amount)::text AS "amount", SUM(l.base)::text AS "base"
    FROM payroll_run_lines l
    JOIN payroll_run_employees e ON e.id = l.payroll_run_employee_id
    WHERE e.payroll_run_id = ANY(${runIds}::int[]) AND l.statutory_role IS NOT NULL AND l.amount > 0
    GROUP BY e.payroll_run_id, l.statutory_role, l.state_code`
  return rows.map((r) => ({ ...r, amount: Number(r.amount), base: r.base === null ? null : Number(r.base) }))
}

// The people of these runs with an amount of these (saved) statutory roles: their lines of them, the State those lines saved
// and whether they are left out of the scheme's return
// data access: people of runs the service found with whole-company Statutory deposits scope
export async function listSchemePeople(runIds: number[], roles: StatutoryRole[], scheme: StatutoryScheme, db: DbClient = prisma) {
  const rows = await db.payrollRunEmployee.findMany({
    where: { payrollRunId: { in: runIds }, lines: { some: { amount: { gt: 0 }, statutoryRole: { in: roles } } } },
    orderBy: [{ employeeCode: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      payrollRunId: true,
      employeeId: true,
      employeeCode: true,
      lines: { where: { statutoryRole: { in: roles } }, select: { amount: true, base: true, statutoryRole: true, stateCode: true } },
      depositGaps: { where: { scheme }, select: gapSelect },
    },
  })
  return rows.map(({ lines, depositGaps, ...row }) => ({
    ...row,
    lines: lines.map((l) => ({ role: l.statutoryRole!, amount: l.amount.toNumber(), base: l.base?.toNumber() ?? null })),
    stateCode: lines.find((l) => l.stateCode)?.stateCode ?? null,
    gap: depositGaps[0] ?? null,
  }))
}

// How many half days each of these people was paid and not paid in their run (the days of the PF and ESIC returns)
// data access: people of runs the service found with whole-company Statutory deposits scope
export async function countHalves(personIds: number[], db: DbClient = prisma) {
  const halves = new Map<number, { paid: number; unpaid: number }>()
  if (!personIds.length) return halves
  const by = (half: 'firstHalf' | 'secondHalf') => db.payrollRunDay.groupBy({ by: ['payrollRunEmployeeId', half], where: { payrollRunEmployeeId: { in: personIds } }, _count: { _all: true } })
  const [first, second] = await Promise.all([by('firstHalf'), by('secondHalf')])
  for (const g of [...first.map((r) => ({ id: r.payrollRunEmployeeId, pay: r.firstHalf, n: r._count._all })), ...second.map((r) => ({ id: r.payrollRunEmployeeId, pay: r.secondHalf, n: r._count._all }))]) {
    const h = halves.get(g.id) ?? { paid: 0, unpaid: 0 }
    if (g.pay === 'PAID') h.paid += g.n
    else h.unpaid += g.n
    halves.set(g.id, h)
  }
  return halves
}

// --- Deposits ---

const depositSelect = {
  id: true,
  companyId: true,
  scheme: true,
  stateCode: true,
  payMonth: true,
  reference: true,
  filedOn: true,
  contributions: true,
  otherCharges: true,
  paidOn: true,
  paymentReference: true,
  paidAt: true,
  paidById: true,
  note: true,
  createdAt: true,
  createdById: true,
  updatedAt: true,
  updatedById: true,
  _count: { select: { gapsCovered: true } },
} satisfies Prisma.StatutoryDepositSelect

const asNumbers = <T extends { contributions: Prisma.Decimal; otherCharges: Prisma.Decimal; _count: { gapsCovered: number } }>({ contributions, otherCharges, _count, ...row }: T) => ({
  ...row,
  contributions: contributions.toNumber(),
  otherCharges: otherCharges.toNumber(),
  // how many people left out of an earlier deposit it took in
  takesIn: _count.gapsCovered,
})

// The deposits in the scope - of one company / one pay month, or all
export async function listDeposits(scope: DataScope, filter: { companyId?: number | undefined; payMonth?: Date | undefined }, db: DbClient = prisma) {
  const rows = await db.statutoryDeposit.findMany({
    where: { AND: [scopeWhere(scope), ...(filter.companyId ? [{ companyId: filter.companyId }] : []), ...(filter.payMonth ? [{ payMonth: filter.payMonth }] : [])] },
    orderBy: [{ payMonth: 'desc' }, { filedOn: 'asc' }, { id: 'asc' }],
    select: depositSelect,
  })
  return rows.map(asNumbers)
}

// The deposits of these companies' pay months (the months of one's own runs - only their standing reaches the employee)
// data access: the months of one's own approved runs (the logged-in employee's id) - no amount of anyone else is returned
export async function listDepositsOfMonths(months: { companyId: number; payMonth: Date }[], db: DbClient = prisma) {
  if (!months.length) return []
  const rows = await db.statutoryDeposit.findMany({ where: { OR: months.map((m) => ({ companyId: m.companyId, payMonth: m.payMonth })) }, select: depositSelect })
  return rows.map(asNumbers)
}

export async function findDeposit(id: number, scope: DataScope, db: DbClient = prisma) {
  const row = await db.statutoryDeposit.findFirst({ where: { AND: [scopeWhere(scope), { id }] }, select: depositSelect })
  return row ? asNumbers(row) : null
}

export type NewDeposit = {
  companyId: number
  scheme: StatutoryScheme
  stateCode: string | null
  payMonth: Date
  reference: string
  filedOn: Date
  contributions: number
  otherCharges: number
  note: string | null
  paidOn: Date | null
  paymentReference: string | null
  paidAt: Date | null
  paidById: number | null
}
export function createDeposit(data: NewDeposit, actorId: ActorId, db: DbClient = prisma) {
  return db.statutoryDeposit.create({ data: { ...data, ...createdBy(actorId) }, select: { id: true } })
}

// Changes a deposit only while it is still paid / not paid as the caller saw it - false when someone changed it a moment before
export async function updateDepositIf(id: number, wasPaid: boolean, data: Prisma.StatutoryDepositUncheckedUpdateManyInput, actorId: ActorId, db: DbClient = prisma) {
  const { count } = await db.statutoryDeposit.updateMany({ where: { id, paidOn: wasPaid ? { not: null } : null }, data: { ...data, ...updatedBy(actorId) } })
  return count > 0
}

// Removes a deposit recorded by mistake - only while it took nobody in
export async function deleteDepositIf(id: number, db: DbClient = prisma) {
  const { count } = await db.statutoryDeposit.deleteMany({ where: { id, gapsCovered: { none: {} } } })
  return count > 0
}

// --- People left out ---

const gapSelect = {
  id: true,
  scheme: true,
  reason: true,
  note: true,
  depositId: true,
  coveredAt: true,
  coveredById: true,
  createdAt: true,
  createdById: true,
  deposit: { select: { reference: true, filedOn: true, paidOn: true } },
} satisfies Prisma.StatutoryDepositGapSelect

// The people left out of these runs' returns (taken in later or not), with their amounts of the scheme's roles
// data access: people of runs the service found with whole-company Statutory deposits scope (or one's own runs)
export async function listGaps(runIds: number[], roles: StatutoryRole[], db: DbClient = prisma) {
  if (!runIds.length) return []
  const rows = await db.statutoryDepositGap.findMany({
    where: { runEmployee: { payrollRunId: { in: runIds } } },
    select: {
      ...gapSelect,
      runEmployee: {
        select: {
          id: true,
          payrollRunId: true,
          employeeId: true,
          lines: { where: { statutoryRole: { in: roles } }, select: { amount: true, statutoryRole: true } },
        },
      },
    },
  })
  return rows.map(({ runEmployee: { lines, ...person }, ...gap }) => ({
    ...gap,
    person,
    lines: lines.map((l) => ({ role: l.statutoryRole!, amount: l.amount.toNumber() })),
  }))
}

// These people of runs, with their run (company, pay month, status), whether they have an amount of these roles and a mark
// of the scheme already
// data access: the people asked for - the service checks each one's run company and month (whole-company Statutory deposits)
export function listPeopleToMark(personIds: number[], roles: StatutoryRole[], scheme: StatutoryScheme, db: DbClient = prisma) {
  return db.payrollRunEmployee.findMany({
    where: { id: { in: personIds } },
    select: {
      id: true,
      employeeId: true,
      employeeCode: true,
      run: { select: { companyId: true, payMonth: true, status: true } },
      lines: { where: { amount: { gt: 0 }, statutoryRole: { in: roles } }, select: { id: true } },
      depositGaps: { where: { scheme }, select: { id: true } },
    },
  })
}

export async function createGaps(rows: { payrollRunEmployeeId: number; scheme: StatutoryScheme; reason: DepositGapReason; note: string | null }[], actorId: ActorId, db: DbClient = prisma) {
  await db.statutoryDepositGap.createMany({ data: rows.map((row) => ({ ...row, ...createdBy(actorId) })) })
}

// These marks with their person's run (company, pay month) - the service checks them
// data access: the marks asked for - the service checks each one's run company (whole-company Statutory deposits)
export function findGaps(gapIds: number[], db: DbClient = prisma) {
  return db.statutoryDepositGap.findMany({
    where: { id: { in: gapIds } },
    select: { id: true, scheme: true, depositId: true, runEmployee: { select: { employeeId: true, employeeCode: true, run: { select: { companyId: true, payMonth: true } } } } },
  })
}

// Sets (or clears) the later deposit that took these people in - only the marks still as the caller saw them (open when
// setting, taken in when clearing); how many changed
export async function setGapsDeposit(gapIds: number[], depositId: number | null, actorId: ActorId, db: DbClient) {
  const { count } = await db.statutoryDepositGap.updateMany({
    where: { id: { in: gapIds }, depositId: depositId === null ? { not: null } : null },
    data: depositId === null ? { depositId: null, coveredAt: null, coveredById: null, ...updatedBy(actorId) } : { depositId, coveredAt: new Date(), coveredById: actorId, ...updatedBy(actorId) },
  })
  return count
}

// Removes these marks - only the ones not taken in; how many went
export async function deleteOpenGaps(gapIds: number[], db: DbClient) {
  const { count } = await db.statutoryDepositGap.deleteMany({ where: { id: { in: gapIds }, depositId: null } })
  return count
}

// --- One's own ---

// One's own people rows of approved runs whose payslips are released: the run, their statutory lines (by the saved role),
// their marks
// data access: one's own record - the logged-in employee's id, never one from the request
export async function listOwn(employeeId: number, roles: StatutoryRole[], db: DbClient = prisma) {
  const rows = await db.payrollRunEmployee.findMany({
    where: { employeeId, run: { status: 'FINALISED', payslipsReleasedAt: { not: null } }, lines: { some: { amount: { gt: 0 }, statutoryRole: { in: roles } } } },
    orderBy: [{ run: { payMonth: 'desc' } }, { id: 'desc' }],
    select: {
      id: true,
      employeeCode: true,
      run: { select: { id: true, payMonth: true, company: { select: { id: true, code: true, name: true } } } },
      lines: { where: { statutoryRole: { in: roles } }, select: { amount: true, statutoryRole: true, stateCode: true } },
      depositGaps: { select: gapSelect },
    },
  })
  return rows.map(({ lines, ...row }) => ({
    ...row,
    lines: lines.map((l) => ({ role: l.statutoryRole!, amount: l.amount.toNumber() })),
    stateCode: lines.find((l) => l.stateCode)?.stateCode ?? null,
  }))
}
