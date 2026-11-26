import { scopeWhere, type DataScope } from '#core/auth/scope'
import { prisma, type DbClient, type Prisma } from '#core/db/prisma'
import { indiaDayStart } from '#shared/utils/dates'
import type { z } from 'zod'
import type { reportFilter } from './reports.schema.js'

// This is an approval-request projection: only the non-confidential attendance/leave sources are joined.
// Job and salary requests are deliberately outside this report.
const reportSelect = {
  id: true, kinds: true, feature: true, summary: true, status: true, createdAt: true,
  requestedById: true, heldAt: true, heldReason: true, closedAt: true, cancelReason: true,
  employee: { select: { employeeCode: true, firstName: true, middleName: true, lastName: true,
    company: { select: { code: true } }, department: { select: { name: true } } } },
  steps: { orderBy: { stepNo: 'asc' }, select: {
    stepNo: true, roleName: true, approverType: true, status: true, openedAt: true,
    decidedAt: true, decidedById: true, comment: true, autoDecided: true,
  } },
  leave: { select: { fromDate: true, toDate: true, days: true, reason: true, fromSecondHalf: true, toFirstHalf: true } },
  leaveCancel: { select: { fromDate: true, toDate: true, days: true, cancelReason: true, fromSecondHalf: true, toFirstHalf: true } },
  regularization: { select: { fromDate: true, toDate: true, portion: true, reason: true } },
  compOffClaim: { select: { workDate: true, days: true, reason: true } },
  shiftChange: { select: { date: true, reason: true } },
} satisfies Prisma.ApprovalRequestSelect

export type ReportScope = {
  leave: DataScope
  attendance: DataScope
  // Relationships authorize these employee IDs, derived by the service, never supplied by the client.
  employeeIds?: number[]
}

function whereFor(input: z.infer<typeof reportFilter>, scope: ReportScope): Prisma.ApprovalRequestWhereInput {
  const from = new Date(Date.UTC(input.from.getUTCFullYear(), input.from.getUTCMonth(), input.from.getUTCDate()))
  const until = new Date(Date.UTC(input.to.getUTCFullYear(), input.to.getUTCMonth(), input.to.getUTCDate() + 1))
  const span = { fromDate: { lt: until }, toDate: { gte: from } }
  const words = (input.search ?? '').split(/\s+/).filter(Boolean)
  return { AND: [
    { OR: [
      { feature: { in: ['LEAVE', 'COMP_OFF'] }, employee: scopeWhere(scope.leave) },
      { feature: { in: ['REGULARIZATION', 'SHIFT_CHANGE'] }, employee: scopeWhere(scope.attendance) },
    ] },
    ...(scope.employeeIds ? [{ employeeId: { in: scope.employeeIds } }] : []),
    ...(input.kind ? [{ kinds: { has: input.kind } }] : []),
    ...(input.status === 'HELD' ? [{ status: 'PENDING' as const, heldAt: { not: null } }] : input.status ? [
      { status: input.status, ...(input.status === 'PENDING' ? { heldAt: null } : {}) },
    ] : []),
    // "Raised" compares a moment with the chosen days, so the days are India's (2026-11-27: with UTC days a request
    // raised between 00:00 and 05:30 India time showed under the day before); work dates are calendar dates as they are
    ...(input.dateBy === 'RAISED' ? [{ createdAt: { gte: indiaDayStart(from), lt: indiaDayStart(until) } }] : [{ OR: [
      { leave: span }, { leaveCancel: span }, { regularization: span },
      { compOffClaim: { workDate: { gte: from, lt: until } } }, { shiftChange: { date: { gte: from, lt: until } } },
    ] }]),
    ...words.map(word => ({ employee: { OR: ['employeeCode', 'firstName', 'middleName', 'lastName'].map(key => ({ [key]: { contains: word, mode: 'insensitive' as const } })) } })),
  ] }
}

export function list(input: z.infer<typeof reportFilter>, scope: ReportScope, paging: { skip: number; take: number }, db: DbClient = prisma) {
  return db.approvalRequest.findMany({ where: whereFor(input, scope), orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: paging.skip, take: paging.take, select: reportSelect })
}
export function count(input: z.infer<typeof reportFilter>, scope: ReportScope, db: DbClient = prisma) {
  return db.approvalRequest.count({ where: whereFor(input, scope) })
}
