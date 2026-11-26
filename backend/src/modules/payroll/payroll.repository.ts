import { prisma, createdBy, updatedBy, type ActorId, type DbClient } from '#core/db/prisma'
import { scopeWhere, type DataScope } from '#core/auth/scope'
import type { ListInput } from './payroll.schema.js'

const select = { id: true, company: { select: { id: true, code: true, name: true } }, payMonth: true, attendanceFrom: true, attendanceTo: true, status: true, peopleRefreshedAt: true, peopleRefreshedById: true, createdAt: true, createdById: true, updatedAt: true, updatedById: true } as const

// The service supplies wholeCompanyScopeOf: narrower plant/department rows never authorize a whole-company run.
export async function list(scope: DataScope, input: ListInput, db: DbClient = prisma) {
  const where = { AND: [scopeWhere(scope), { payMonth: { gte: new Date(Date.UTC(input.year, 0, 1)), lt: new Date(Date.UTC(input.year + 1, 0, 1)) } }, ...(input.companyId ? [{ companyId: input.companyId }] : [])] }
  const [items, total] = await Promise.all([db.payrollRun.findMany({ where, select: { ...select, _count: { select: { employees: true } } }, orderBy: [{ payMonth: 'desc' }, { id: 'desc' }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }), db.payrollRun.count({ where })])
  return { items, total }
}

export function find(id: number, scope: DataScope, db: DbClient = prisma) {
  return db.payrollRun.findFirst({ where: { AND: [scopeWhere(scope), { id }] }, select })
}

export function create(data: { companyId: number; payMonth: Date; attendanceFrom: Date; attendanceTo: Date }, actorId: ActorId, db: DbClient = prisma) {
  return db.payrollRun.create({ data: { ...data, status: 'DRAFT', ...createdBy(actorId) }, select })
}

// data access: uniqueness check after the service verifies whole-company scope; no people's records.
export function findMonth(companyId: number, payMonth: Date, db: DbClient = prisma) {
  return db.payrollRun.findUnique({ where: { companyId_payMonth: { companyId, payMonth } }, select: { id: true } })
}

// Records that the run's people and salary copy was rebuilt now, by this actor (stage 2) - this is what the change
// history keeps of a refresh; the copy rows themselves are not recorded
export function markRefreshed(id: number, actorId: ActorId, db: DbClient = prisma) {
  return db.payrollRun.update({ where: { id }, data: { peopleRefreshedAt: new Date(), peopleRefreshedById: actorId, ...updatedBy(actorId) }, select: { peopleRefreshedAt: true } })
}
