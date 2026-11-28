import { scopeWhere, type DataScope } from '#core/auth/scope'
import { prisma, createdBy, updatedBy, type ActorId, type DbClient, type PaymentBatchStatus, type PaymentMethod, type Prisma } from '#core/db/prisma'

// Database access for salary payments (payroll stage 6 slice 2: PayrollPaymentBatch, PayrollPayment, PayrollPaymentHold).
// Runs and batches are found with whole-company Payroll payments scope (`wholeCompanyScopeOf` - a batch and a run belong to
// one company); the rows hanging on them are reached only through them.

// a person with pay worked out has at least one earning line
const workedOut = { lines: { some: { OR: [{ kind: 'EARNING' as const }, { kind: null }] } } }
// a payment that pays (or is about to pay) the person: a second one would pay them twice
const ACTIVE = ['IN_BATCH', 'PAID'] as const

// --- What is owed ---

// Every person of the approved runs in the scope (optionally one company / one run) whose pay is worked out and not paid
// yet: their code, run, the payment now in a batch or the last one returned, and an open hold
export function listUnpaid(scope: DataScope, filter: { companyId?: number | undefined; runId?: number | undefined }, db: DbClient = prisma) {
  return db.payrollRunEmployee.findMany({
    where: {
      AND: [
        { run: { AND: [scopeWhere(scope), { status: 'FINALISED' }, ...(filter.companyId ? [{ companyId: filter.companyId }] : []), ...(filter.runId ? [{ id: filter.runId }] : [])] } },
        workedOut,
        { payments: { none: { status: 'PAID' } } },
      ],
    },
    orderBy: [{ run: { payMonth: 'asc' } }, { employeeCode: 'asc' }],
    select: {
      id: true,
      employeeId: true,
      employeeCode: true,
      run: { select: { id: true, payMonth: true, attendanceTo: true, company: { select: { id: true, code: true, name: true } } } },
      payments: { where: { status: { in: ['IN_BATCH', 'RETURNED'] } }, orderBy: { id: 'desc' }, take: 1, select: { status: true, batchId: true, returnReason: true, returnedAt: true } },
      paymentHolds: { where: { releasedAt: null }, select: { reason: true, createdAt: true, createdById: true } },
    },
  })
}

// Each of these people's net pay in their run (earned less deducted), to the paisa
// data access: people of runs the service found with whole-company Payroll payments scope
export async function netsOf(personIds: number[], db: DbClient = prisma) {
  if (!personIds.length) return new Map<number, number>()
  const sum = (kind: 'EARNING' | 'DEDUCTION') =>
    db.payrollRunLine.groupBy({ by: ['payrollRunEmployeeId'], where: { payrollRunEmployeeId: { in: personIds }, kind }, _sum: { amount: true } })
  const [earned, deducted] = await Promise.all([sum('EARNING'), sum('DEDUCTION')])
  const paise = new Map<number, number>()
  for (const g of earned) paise.set(g.payrollRunEmployeeId, Math.round((g._sum.amount?.toNumber() ?? 0) * 100))
  for (const g of deducted) paise.set(g.payrollRunEmployeeId, (paise.get(g.payrollRunEmployeeId) ?? 0) - Math.round((g._sum.amount?.toNumber() ?? 0) * 100))
  return new Map([...paise].map(([id, p]) => [id, p / 100]))
}

// Where one run's people stand (the run page's payments line): each person with pay worked out, whether they are paid,
// in a batch, held or returned
// data access: rows of one run the service found with whole-company Payroll payments scope
export function listRunPeople(payrollRunId: number, db: DbClient = prisma) {
  return db.payrollRunEmployee.findMany({
    where: { payrollRunId, ...workedOut },
    select: {
      id: true,
      employeeId: true,
      payments: { where: { status: { in: ['IN_BATCH', 'PAID', 'RETURNED'] } }, orderBy: { id: 'desc' }, take: 1, select: { status: true } },
      paymentHolds: { where: { releasedAt: null }, select: { id: true } },
    },
  })
}

// --- Paying ---

// These people of runs, with what decides whether they can be paid now: their run (company, approved?), an open hold, a
// payment in a batch or paid
// data access: the people asked for - the service checks each one's run company against the batch's company (whole-company Payroll payments)
export function listPayable(personIds: number[], db: DbClient = prisma) {
  return db.payrollRunEmployee.findMany({
    where: { id: { in: personIds } },
    select: {
      id: true,
      employeeId: true,
      employeeCode: true,
      run: { select: { companyId: true, status: true } },
      paymentHolds: { where: { releasedAt: null }, select: { id: true } },
      payments: { where: { status: { in: [...ACTIVE] } }, select: { id: true } },
    },
  })
}

export function createBatch(data: { companyId: number; method: PaymentMethod; note: string | null }, actorId: ActorId, db: DbClient = prisma) {
  return db.payrollPaymentBatch.create({ data: { ...data, ...createdBy(actorId) }, select: { id: true } })
}

export type NewPayment = {
  payrollRunEmployeeId: number
  batchId: number
  amount: number
  bankName: string | null
  accountNumberEncrypted: string | null
  accountNumberLast4: string | null
  ifsc: string | null
}
export async function createPayments(rows: NewPayment[], actorId: ActorId, db: DbClient = prisma) {
  await db.payrollPayment.createMany({ data: rows.map((row) => ({ ...row, ...createdBy(actorId) })) })
}

// --- Batches ---

const batchSelect = {
  id: true,
  method: true,
  status: true,
  note: true,
  sentAt: true,
  sentById: true,
  closedAt: true,
  closedById: true,
  createdAt: true,
  createdById: true,
  company: { select: { id: true, code: true, name: true } },
} satisfies Prisma.PayrollPaymentBatchSelect

// The batches in the scope, newest first
export async function listBatches(scope: DataScope, filter: { companyId?: number | undefined; status?: PaymentBatchStatus | undefined }, paging: { skip: number; take: number }, db: DbClient = prisma) {
  const where = { AND: [scopeWhere(scope), ...(filter.companyId ? [{ companyId: filter.companyId }] : []), ...(filter.status ? [{ status: filter.status }] : [])] }
  const [items, total] = await Promise.all([
    db.payrollPaymentBatch.findMany({ where, orderBy: { id: 'desc' }, skip: paging.skip, take: paging.take, select: batchSelect }),
    db.payrollPaymentBatch.count({ where }),
  ])
  return { items, total }
}

// How many payments of each status, and their amounts, in these batches
// data access: batches the service found with whole-company Payroll payments scope
export async function countsOf(batchIds: number[], db: DbClient = prisma) {
  if (!batchIds.length) return []
  const rows = await db.payrollPayment.groupBy({ by: ['batchId', 'status'], where: { batchId: { in: batchIds } }, _count: { _all: true }, _sum: { amount: true } })
  return rows.map((r) => ({ batchId: r.batchId, status: r.status, count: r._count._all, amount: r._sum.amount?.toNumber() ?? 0 }))
}

export function findBatch(id: number, scope: DataScope, db: DbClient = prisma) {
  return db.payrollPaymentBatch.findFirst({ where: { AND: [scopeWhere(scope), { id }] }, select: batchSelect })
}

// A batch's payments, by employee code
// data access: one batch the service found with whole-company Payroll payments scope
export async function listPayments(batchId: number, db: DbClient = prisma) {
  const rows = await db.payrollPayment.findMany({
    where: { batchId },
    orderBy: [{ runEmployee: { employeeCode: 'asc' } }, { id: 'asc' }],
    select: {
      id: true,
      amount: true,
      status: true,
      bankName: true,
      accountNumberEncrypted: true,
      accountNumberLast4: true,
      ifsc: true,
      chequeNumber: true,
      paidOn: true,
      bankReference: true,
      paidAt: true,
      paidById: true,
      returnReason: true,
      returnedAt: true,
      returnedById: true,
      removedAt: true,
      removedById: true,
      runEmployee: { select: { id: true, employeeId: true, employeeCode: true, run: { select: { id: true, payMonth: true } } } },
    },
  })
  return rows.map((r) => ({ ...r, amount: r.amount.toNumber() }))
}

// One payment with its batch (company, method, status) and person
export function findPayment(id: number, scope: DataScope, db: DbClient = prisma) {
  return db.payrollPayment.findFirst({
    where: { id, batch: scopeWhere(scope) },
    select: { id: true, status: true, batchId: true, batch: { select: { status: true, method: true, company: { select: { id: true } } } }, runEmployee: { select: { employeeId: true } } },
  })
}

// Changes the batch only while it is in `from` - false when someone changed it a moment before
export async function updateBatchIf(id: number, from: PaymentBatchStatus, data: Prisma.PayrollPaymentBatchUncheckedUpdateManyInput, actorId: ActorId, db: DbClient) {
  const { count } = await db.payrollPaymentBatch.updateMany({ where: { id, status: from }, data: { ...data, ...updatedBy(actorId) } })
  return count > 0
}

// Changes these payments of the batch that are still in a batch (IN_BATCH) - how many changed
export async function updatePaymentsIf(batchId: number, paymentIds: number[] | undefined, data: Prisma.PayrollPaymentUncheckedUpdateManyInput, actorId: ActorId, db: DbClient) {
  const { count } = await db.payrollPayment.updateMany({
    where: { batchId, status: 'IN_BATCH', ...(paymentIds && { id: { in: paymentIds } }) },
    data: { ...data, ...updatedBy(actorId) },
  })
  return count
}

// Changes one payment only while it is in `from` - false when someone changed it a moment before
export async function updatePaymentIf(id: number, from: ('IN_BATCH' | 'PAID')[], data: Prisma.PayrollPaymentUncheckedUpdateManyInput, actorId: ActorId, db: DbClient) {
  const { count } = await db.payrollPayment.updateMany({ where: { id, status: { in: from } }, data: { ...data, ...updatedBy(actorId) } })
  return count > 0
}

// The payments of a batch still in it and their people (the own-payment check)
// data access: one batch the service found with whole-company Payroll payments scope
export function listInBatch(batchId: number, db: DbClient = prisma) {
  return db.payrollPayment.findMany({ where: { batchId, status: 'IN_BATCH' }, select: { id: true, runEmployee: { select: { employeeId: true } } } })
}

// Locks these people of runs until the caller's transaction ends (holding and making a batch take the lock first, so the
// two never cross) - a read with FOR UPDATE, nothing is changed
// data access: the people the service checks itself (their company, with whole-company Payroll payments)
export async function lockPeople(personIds: number[], db: DbClient) {
  if (personIds.length) await db.$queryRaw`SELECT id FROM payroll_run_employees WHERE id = ANY(${personIds}::int[]) ORDER BY id FOR UPDATE`
}

// --- Holds ---

// One person of a run, with their run's company and status, an open hold and a payment in a batch or paid
export function findPerson(payrollRunEmployeeId: number, db: DbClient = prisma) {
  return db.payrollRunEmployee.findUnique({
    where: { id: payrollRunEmployeeId },
    select: {
      id: true,
      employeeId: true,
      run: { select: { companyId: true, status: true } },
      paymentHolds: { where: { releasedAt: null }, select: { id: true } },
      payments: { where: { status: { in: [...ACTIVE] } }, select: { id: true } },
    },
  })
}

export function createHold(payrollRunEmployeeId: number, reason: string, actorId: ActorId, db: DbClient = prisma) {
  return db.payrollPaymentHold.create({ data: { payrollRunEmployeeId, reason, ...createdBy(actorId) }, select: { id: true } })
}

export async function releaseHold(id: number, note: string | null, actorId: ActorId, db: DbClient = prisma) {
  const { count } = await db.payrollPaymentHold.updateMany({ where: { id, releasedAt: null }, data: { releasedAt: new Date(), releasedById: actorId, releaseNote: note, ...updatedBy(actorId) } })
  return count > 0
}
