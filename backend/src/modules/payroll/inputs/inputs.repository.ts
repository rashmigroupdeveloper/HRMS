import { prisma, createdBy, updatedBy, type ActorId, type DbClient } from '#core/db/prisma'

// Database access for a pay run's monthly inputs (payroll stage 2). Every function takes the run's id: the service has
// already found the run with whole-company Payroll scope, so inputs are reached only through it.

const select = {
  id: true,
  amount: true,
  note: true,
  createdAt: true,
  createdById: true,
  updatedAt: true,
  updatedById: true,
  runEmployee: { select: { id: true, employeeId: true, employeeCode: true } },
  salaryComponent: { select: { id: true, name: true, code: true, kind: true } },
} as const

const asNumber = <T extends { amount: { toNumber(): number } }>(row: T) => ({ ...row, amount: row.amount.toNumber() })

// Every input of the run (optionally one person's / one component's), newest first - filtered by name and paged in the
// service (a run is one company)
// data access: rows of one run the service found with whole-company Payroll scope
export async function list(payrollRunId: number, filter: { personId?: number; salaryComponentId?: number }, db: DbClient = prisma) {
  const rows = await db.payrollInput.findMany({
    where: {
      runEmployee: { payrollRunId, ...(filter.personId && { id: filter.personId }) },
      ...(filter.salaryComponentId && { salaryComponentId: filter.salaryComponentId }),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select,
  })
  return rows.map(asNumber)
}

export async function find(payrollRunId: number, id: number, db: DbClient = prisma) {
  const row = await db.payrollInput.findFirst({ where: { id, runEmployee: { payrollRunId } }, select })
  return row && asNumber(row)
}

// The person of the run an input is for, or null
export function findPerson(payrollRunId: number, personId: number, db: DbClient = prisma) {
  return db.payrollRunEmployee.findFirst({ where: { id: personId, payrollRunId }, select: { id: true, employeeId: true, employeeCode: true } })
}

// How many inputs the run has (for its header)
// data access: rows of one run the service found with whole-company Payroll scope
export function count(payrollRunId: number, db: DbClient = prisma) {
  return db.payrollInput.count({ where: { runEmployee: { payrollRunId } } })
}

// Whether the person already has an input of this component with this amount (a warning, not a refusal)
export async function hasSame(personId: number, salaryComponentId: number, amount: number, exceptId: number | null, db: DbClient = prisma) {
  const n = await db.payrollInput.count({ where: { payrollRunEmployeeId: personId, salaryComponentId, amount, ...(exceptId && { id: { not: exceptId } }) } })
  return n > 0
}

export function create(data: { personId: number; salaryComponentId: number; amount: number; note: string }, actorId: ActorId, db: DbClient = prisma) {
  return db.payrollInput.create({
    data: { payrollRunEmployeeId: data.personId, salaryComponentId: data.salaryComponentId, amount: data.amount, note: data.note, ...createdBy(actorId) },
    select: { id: true },
  })
}

export function update(id: number, data: { salaryComponentId?: number; amount?: number; note?: string }, actorId: ActorId, db: DbClient = prisma) {
  return db.payrollInput.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: { id: true } })
}

export function deleteInput(id: number, db: DbClient = prisma) {
  return db.payrollInput.delete({ where: { id }, select: { id: true } })
}
