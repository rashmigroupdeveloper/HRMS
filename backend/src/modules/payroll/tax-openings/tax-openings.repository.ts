import { prisma, createdBy, updatedBy, type ActorId, type DbClient } from '#core/db/prisma'
import { scopeWhere, type DataScope } from '#core/auth/scope'

// Database access for the opening tax figures (payroll stage 4) - people's records: lists take a DataScope.

const select = {
  id: true,
  taxYearFrom: true,
  throughPayMonth: true,
  taxableIncome: true,
  taxDeducted: true,
  note: true,
  updatedAt: true,
  updatedById: true,
  employee: { select: { id: true, employeeCode: true, firstName: true, middleName: true, lastName: true, companyId: true } },
} as const

// The rows of a tax year whose employee is inside the scope (whole-company Payroll scope), by code - paged here
export async function list(scope: DataScope, filter: { taxYearFrom: Date; companyId?: number; search?: string; page: number; pageSize: number }, db: DbClient = prisma) {
  const text = filter.search
  const where = {
    AND: [
      { employee: scopeWhere(scope) },
      { taxYearFrom: filter.taxYearFrom },
      ...(filter.companyId ? [{ employee: { companyId: filter.companyId } }] : []),
      ...(text
        ? [{ employee: { OR: [{ employeeCode: { contains: text, mode: 'insensitive' as const } }, { firstName: { contains: text, mode: 'insensitive' as const } }, { lastName: { contains: text, mode: 'insensitive' as const } }] } }]
        : []),
    ],
  }
  const [items, total] = await Promise.all([
    db.taxOpeningBalance.findMany({ where, select, orderBy: [{ employee: { employeeCode: 'asc' } }], skip: (filter.page - 1) * filter.pageSize, take: filter.pageSize }),
    db.taxOpeningBalance.count({ where }),
  ])
  return { items, total }
}

export function find(id: number, db: DbClient = prisma) {
  return db.taxOpeningBalance.findUnique({ where: { id }, select })
}

// The opening figures of a tax year for these employees (working out a pay run's TDS)
// data access: the people of one pay run - the payroll service found the run with whole-company Payroll scope first
export function listForEmployees(employeeIds: number[], taxYearFrom: Date, db: DbClient = prisma) {
  return db.taxOpeningBalance.findMany({
    where: { employeeId: { in: employeeIds }, taxYearFrom },
    select: { employeeId: true, throughPayMonth: true, taxableIncome: true, taxDeducted: true },
  })
}

type Figures = { throughPayMonth: Date; taxableIncome: number; taxDeducted: number; note: string | null }

export function create(data: Figures & { employeeId: number; taxYearFrom: Date }, actorId: ActorId, db: DbClient = prisma) {
  return db.taxOpeningBalance.create({ data: { ...data, ...createdBy(actorId) }, select: { id: true } })
}

export function update(id: number, data: Figures, actorId: ActorId, db: DbClient = prisma) {
  return db.taxOpeningBalance.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: { id: true } })
}

export function deleteOpening(id: number, db: DbClient = prisma) {
  return db.taxOpeningBalance.delete({ where: { id }, select: { id: true } })
}
