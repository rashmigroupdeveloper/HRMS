import { scopeWhere, type DataScope } from '#core/auth/scope'
import { prisma, type DbClient, type Prisma } from '#core/db/prisma'
import type { z } from 'zod'
import type { reportFilter } from './reports.schema.js'

export type ReportQuery = {
  scope: DataScope
  employeeIds: number[]
  filter: z.infer<typeof reportFilter>
}

function where({ scope, employeeIds, filter: f }: ReportQuery): Prisma.AttendanceDayWhereInput {
  const words = (f.search ?? '').split(/\s+/).filter(Boolean)
  const exceptions: Prisma.AttendanceDayWhereInput[] = [
    ...(f.exception === 'ANY' || f.exception === 'LATE' ? [{ lateMinutes: { gt: 0 } }] : []),
    ...(f.exception === 'ANY' || f.exception === 'EARLY' ? [{ earlyMinutes: { gt: 0 } }] : []),
    ...(f.exception === 'ANY' || f.exception === 'ABSENT' ? [{ OR: [{ firstHalf: 'ABSENT' as const }, { secondHalf: 'ABSENT' as const }] }] : []),
    ...(f.exception === 'ANY' || f.exception === 'MISSED_PUNCH' ? [{ OR: [{ firstHalf: 'MISSED_PUNCH' as const }, { secondHalf: 'MISSED_PUNCH' as const }] }] : []),
  ]
  return {
    employeeId: { in: employeeIds }, date: { gte: f.from, lte: f.to },
    ...(f.status && { status: f.status }),
    AND: [
      { employee: { AND: [
        scopeWhere(scope),
        ...(f.companyIds?.length ? [{ companyId: { in: f.companyIds } }] : []),
        ...(f.plantIds?.length ? [{ plantId: { in: f.plantIds } }] : []),
        ...(f.departmentIds?.length ? [{ departmentId: { in: f.departmentIds } }] : []),
        ...(f.workLocationIds?.length ? [{ workLocationId: { in: f.workLocationIds } }] : []),
        ...words.map(word => ({ OR: ['employeeCode', 'firstName', 'middleName', 'lastName'].map(key => ({ [key]: { contains: word, mode: 'insensitive' } })) })),
      ] } },
      ...(f.mode === 'EXCEPTIONS' ? [{ OR: exceptions }] : []),
    ],
  }
}

const select = {
  id: true, employeeId: true, date: true, status: true, autoStatus: true, firstHalf: true, secondHalf: true,
  firstIn: true, lastOut: true, workedMinutes: true, lateMinutes: true, earlyMinutes: true, punchCount: true, note: true,
  shift: { select: { code: true, name: true } },
  employee: { select: { employeeCode: true, firstName: true, middleName: true, lastName: true,
    company: { select: { code: true } }, plant: { select: { name: true } }, department: { select: { name: true } } } },
} satisfies Prisma.AttendanceDaySelect

export function count(query: ReportQuery, db: DbClient = prisma) {
  return db.attendanceDay.count({ where: where(query) })
}
export function list(query: ReportQuery, page: { skip: number; take: number }, db: DbClient = prisma) {
  return db.attendanceDay.findMany({ where: where(query), select, orderBy: [{ date: 'desc' }, { employee: { employeeCode: 'asc' } }, { id: 'asc' }], ...page })
}
export function totals(query: ReportQuery, db: DbClient = prisma) {
  return db.attendanceDay.aggregate({ where: where(query), _sum: { workedMinutes: true, lateMinutes: true, earlyMinutes: true, punchCount: true } })
}
export function peopleTotals(query: ReportQuery, db: DbClient = prisma) {
  return db.attendanceDay.groupBy({ by: ['employeeId'], where: where(query), _count: { _all: true }, _sum: { lateMinutes: true, earlyMinutes: true } })
}
export function exceptionCount(query: ReportQuery, kind: 'LATE' | 'EARLY' | 'ABSENT' | 'MISSED_PUNCH', db: DbClient = prisma) {
  return db.attendanceDay.count({ where: { AND: [where(query), { OR: kind === 'LATE' ? [{ lateMinutes: { gt: 0 } }] : kind === 'EARLY' ? [{ earlyMinutes: { gt: 0 } }] : [{ firstHalf: kind }, { secondHalf: kind }] }] } })
}
