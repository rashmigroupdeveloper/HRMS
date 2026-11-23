import type { Tone } from '@/components/Pill'
import type { client } from '@/lib/orpc'
import { formatDate } from '@/lib/utils'

// Types and words of the leave pages (2026-11-22, typed from the API).

export type LeaveType = Awaited<ReturnType<typeof client.leave.types.list>>[number]
export type Balances = Awaited<ReturnType<typeof client.leave.balances.get>>
export type Balance = Balances['balances'][number]
export type Application = Awaited<ReturnType<typeof client.leave.applications.mine>>[number]
export type Register = Awaited<ReturnType<typeof client.leave.balances.register>>
export type LeaveOverview = Awaited<ReturnType<typeof client.leave.overview>>

export const LEAVE_STATUS: Record<Application['status'], { label: string; tone: Tone }> = {
  // who has it now is shown beside (the approval's open step)
  PENDING: { label: 'Waiting for approval', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'positive' },
  REJECTED: { label: 'Rejected', tone: 'negative' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
}

// "2 days" / "½ day" / "1½ days"
export function daysText(days: number) {
  const whole = Math.floor(days)
  const half = days - whole >= 0.5
  const text = whole === 0 && half ? '½' : `${whole}${half ? '½' : ''}`
  return `${text} ${days <= 1 ? 'day' : 'days'}`
}

// "Mon 01 Dec (second half) – Wed 03 Dec 2026"
export function spanText(a: Pick<Application, 'fromDate' | 'toDate' | 'fromSecondHalf' | 'toFirstHalf'>) {
  if (a.fromDate.getTime() === a.toDate.getTime()) return `${formatDate(a.fromDate)}${a.fromSecondHalf ? ' (second half)' : a.toFirstHalf ? ' (first half)' : ''}`
  return `${formatDate(a.fromDate)}${a.fromSecondHalf ? ' (second half)' : ''} – ${formatDate(a.toDate)}${a.toFirstHalf ? ' (first half)' : ''}`
}

// The balance tiles' lines, in this order (the tiles and their loading placeholder)
export const BALANCE_HINT = 'available'

// Whose leave the Team leave page shows (the views the viewer has)
export type TeamLeaveView = 'team' | 'department' | 'all'
export function teamLeaveViews(o: LeaveOverview): [TeamLeaveView, string][] {
  return [
    ...(o.teamSize > 0 ? [['team', `My team · ${o.teamSize}`] as [TeamLeaveView, string]] : []),
    ...(o.departmentSize > 0 ? [['department', `My department · ${o.departmentSize}`] as [TeamLeaveView, string]] : []),
    ...(o.canSeeAll ? [['all', 'Everyone'] as [TeamLeaveView, string]] : []),
  ]
}

// The parts of the Team leave page (also drawn by its skeleton): who is away, the balances, the leave types
export const TEAM_LEAVE_PARTS = [
  ['away', 'Leave'],
  ['balances', 'Balances'],
  ['types', 'Leave types'],
  // approved leave the calendar now counts otherwise (Leave View - 2026-11-23)
  ['recount', 'To recount'],
] as const
export type TeamLeavePart = (typeof TEAM_LEAVE_PARTS)[number][0]

// The leave list's column headings (the list and its skeleton - change both together)
export const LEAVE_LIST_HEADINGS = ['Employee', 'Leave', 'Days', 'Status']
// The leave types table's headings (the table and its skeleton)
export const TYPE_HEADINGS = ['Code', 'Leave type', 'Credit a month', 'Carry forward', 'At most at once', 'Rules']
