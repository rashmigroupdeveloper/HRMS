import { hasAccess } from '#core/auth/access'
import { scopeOf, SYSTEM_SCOPE } from '#core/auth/scope'
import { prisma } from '#core/db/prisma'
import { reportFile, reportSheet } from '#core/excel/report'
import type { CurrentUser } from '#core/rpc/procedures'
import { employeesService, hodsService } from '#modules/employees'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as reportsRepository from './reports.repository.js'
import type { reportFilter, reportInput } from './reports.schema.js'

const MAX_EXPORT = 20_000
const TYPES = { LEAVE: 'Leave', LEAVE_CANCEL: 'Leave cancellation', REGULARIZATION: 'Regularisation', ON_DUTY: 'On duty', COMP_OFF: 'Comp off', SHIFT_CHANGE: 'Shift change' } as const
const STATUSES = { PENDING: 'Waiting', APPROVED: 'Approved', REJECTED: 'Rejected', CANCELLED: 'Withdrawn', EXPIRED: 'Expired' } as const
const APPROVER = { REPORTING_MANAGER: 'Reporting manager', FUNCTIONAL_MANAGER: 'Functional manager', HOD: 'Department head', ROLE: 'Role approver', ACCESS: 'Authorized approver', FALLBACK: 'Fallback approver', ESCALATION: 'Escalated approver' } as const
const day = (date: Date) => date.toISOString().slice(0, 10)

async function scopeFor(viewer: CurrentUser, scope: z.infer<typeof reportFilter>['scope']): Promise<reportsRepository.ReportScope> {
  if (scope === 'ALL') {
    if (!hasAccess(viewer.access, 'LEAVE', 'READ') && !hasAccess(viewer.access, 'ATTENDANCE', 'READ')) {
      throw new ORPCError('FORBIDDEN', { message: 'Viewing requests outside your team or department needs Leave or Attendance View access' })
    }
    // Each feature retains its own area and data access. Having Leave View never grants attendance requests.
    return { leave: scopeOf(viewer, 'LEAVE', 'READ'), attendance: scopeOf(viewer, 'ATTENDANCE', 'READ') }
  }
  const employeeIds = scope === 'TEAM' ? await employeesService.listReportingTreeIds(viewer.employeeId) : await hodsService.listDepartmentIds(viewer.employeeId)
  return { leave: SYSTEM_SCOPE, attendance: SYSTEM_SCOPE, employeeIds }
}

function validateRange(input: z.infer<typeof reportFilter>) {
  if (day(input.to) < day(input.from)) throw new ORPCError('BAD_REQUEST', { message: 'The last date must be on or after the first date' })
  if (Date.parse(day(input.to)) - Date.parse(day(input.from)) > 366 * 86_400_000) throw new ORPCError('BAD_REQUEST', { message: 'Choose a date range of one year or less' })
}

type SourceRow = Awaited<ReturnType<typeof reportsRepository.list>>[number]
async function toRows(rows: SourceRow[]) {
  const person = await employeesService.lookupPeople(rows.flatMap(r => [r.requestedById, ...r.steps.map(s => s.decidedById)]))
  return rows.map(r => {
    const leave = r.leave ?? r.leaveCancel
    const source = leave ?? r.regularization ?? r.compOffClaim ?? r.shiftChange
    const reason = r.leave?.reason ?? r.leaveCancel?.cancelReason ?? r.regularization?.reason ?? r.compOffClaim?.reason ?? r.shiftChange?.reason ?? null
    const from = leave?.fromDate ?? r.regularization?.fromDate ?? r.compOffClaim?.workDate ?? r.shiftChange?.date ?? null
    const to = leave?.toDate ?? r.regularization?.toDate ?? from
    const open = r.steps.find(s => s.status === 'OPEN')
    const kind = r.kinds.find(k => k in TYPES) as keyof typeof TYPES | undefined
    const portion = r.regularization?.portion === 'FIRST_HALF' ? 'First half' : r.regularization?.portion === 'SECOND_HALF' ? 'Second half' : leave ?
      [leave.fromSecondHalf ? 'Starts in second half' : '', leave.toFirstHalf ? 'Ends in first half' : ''].filter(Boolean).join('; ') || 'Whole days' : r.regularization ? 'Whole days' : null
    // (team requests are about employees - leave, attendance - never a whole company: the query names those features)
    const employee = r.employee!
    return {
      id: r.id, employeeCode: employee.employeeCode,
      employee: [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' '),
      company: employee.company.code, department: employee.department?.name ?? null,
      kind: kind ? TYPES[kind] : 'Request', summary: r.summary, from, to, portion,
      days: leave?.days.toNumber() ?? r.compOffClaim?.days.toNumber() ?? null,
      reason, sourceAvailable: source !== null, raisedAt: r.createdAt, raisedBy: person(r.requestedById),
      status: r.status === 'PENDING' && r.heldAt ? 'Held' : STATUSES[r.status],
      currentStep: open && !r.heldAt ? `Step ${open.stepNo} · ${open.roleName ?? APPROVER[open.approverType]}` : null,
      heldReason: r.heldReason, closedAt: r.closedAt, withdrawalReason: r.cancelReason,
      decisions: r.steps.filter(s => s.decidedAt || s.comment).map(s => ({
        step: s.stepNo, status: s.status, at: s.decidedAt, by: person(s.decidedById), comment: s.comment, automatic: s.autoDecided,
      })),
    }
  })
}

export async function getReport(viewer: CurrentUser, input: z.infer<typeof reportInput>) {
  validateRange(input)
  const scope = await scopeFor(viewer, input.scope)
  const result = await prisma.$transaction(async tx => {
    const total = await reportsRepository.count(input, scope, tx)
    const page = Math.min(input.page, Math.max(1, Math.ceil(total / input.pageSize)))
    const rows = await reportsRepository.list(input, scope, { skip: (page - 1) * input.pageSize, take: input.pageSize }, tx)
    return { total, page, rows }
  }, { isolationLevel: 'RepeatableRead' })
  return { total: result.total, items: await toRows(result.rows), page: result.page, pageSize: input.pageSize }
}

export async function exportReport(viewer: CurrentUser, input: z.infer<typeof reportFilter>) {
  validateRange(input)
  const scope = await scopeFor(viewer, input.scope)
  const rows = await prisma.$transaction(async tx => {
    const total = await reportsRepository.count(input, scope, tx)
    if (total > MAX_EXPORT) throw new ORPCError('BAD_REQUEST', { message: 'More than 20,000 requests match. Narrow the dates or filters and export again.' })
    return reportsRepository.list(input, scope, { skip: 0, take: MAX_EXPORT }, tx)
  }, { isolationLevel: 'RepeatableRead' })
  const items = await toRows(rows)
  const decisions = items.flatMap(r => r.decisions.map(d => ({ request: r, decision: d })))
  return reportFile([
    reportSheet('Team requests', items, [
      { header: 'Request #', text: true, value: r => String(r.id) }, { header: 'Employee code', text: true, value: r => r.employeeCode },
      { header: 'Employee', width: 28, value: r => r.employee }, { header: 'Company', value: r => r.company }, { header: 'Department', value: r => r.department },
      { header: 'Request type', width: 23, value: r => r.kind }, { header: 'From', date: true, value: r => r.from }, { header: 'To', date: true, value: r => r.to },
      { header: 'Days', value: r => r.days }, { header: 'Portion', width: 25, value: r => r.portion },
      { header: 'Employee message', width: 55, value: r => r.reason ?? (r.sourceAvailable ? '' : 'Source details unavailable; see request summary') },
      { header: 'Status', value: r => r.status }, { header: 'Current step', width: 30, value: r => r.currentStep },
      { header: 'Approval remarks', width: 60, value: r => r.decisions.map(d => `Step ${d.step}: ${d.status} · ${d.by?.name ?? (d.automatic ? 'Automatic' : 'Unknown')}\n${d.comment ?? ''}`).join('\n\n') },
      { header: 'Requested at', dateTime: true, value: r => r.raisedAt }, { header: 'Raised by', value: r => r.raisedBy?.name },
      { header: 'Closed at', dateTime: true, value: r => r.closedAt }, { header: 'Withdrawal reason', width: 40, value: r => r.withdrawalReason },
      { header: 'Held reason', width: 40, value: r => r.heldReason }, { header: 'Request summary', width: 55, value: r => r.summary },
    ]),
    reportSheet('Approval history', decisions, [
      { header: 'Request #', text: true, value: r => String(r.request.id) }, { header: 'Employee code', text: true, value: r => r.request.employeeCode },
      { header: 'Employee', value: r => r.request.employee }, { header: 'Request type', value: r => r.request.kind },
      { header: 'Step', value: r => r.decision.step }, { header: 'Decision', value: r => r.decision.status },
      { header: 'By', value: r => r.decision.by?.name }, { header: 'At', dateTime: true, value: r => r.decision.at },
      { header: 'Automatic', value: r => r.decision.automatic ? 'Yes' : 'No' }, { header: 'Remarks', width: 70, value: r => r.decision.comment },
    ]),
  ], {
    title: 'Team requests', preparedBy: `${viewer.name} (${viewer.employeeCode})`,
    coverage: 'All matching leave, leave cancellation, regularisation, on-duty, comp-off and shift-change requests, across pending and completed states. Team/department membership is current. Salary and job changes are excluded. Exporting does not approve requests.',
    filters: [
      { label: 'People', value: { TEAM: 'My reporting team', DEPARTMENT: 'My HOD department', ALL: 'Within my access (Leave and Attendance checked separately)' }[input.scope] },
      { label: 'Dates mean', value: input.dateBy === 'WORK_DATES' ? 'Work / leave dates overlapping this period' : 'Requests raised during this period (UTC)' },
      { label: 'Period', value: `${day(input.from)} to ${day(input.to)}` }, { label: 'Request type', value: input.kind ? TYPES[input.kind] : 'All types' },
      { label: 'Status', value: input.status === 'HELD' ? 'Held' : input.status ? STATUSES[input.status] : 'Every status' }, { label: 'Employee search', value: input.search ?? 'Everyone' },
    ],
  }, `team-requests-${day(input.from)}-${day(input.to)}`)
}
