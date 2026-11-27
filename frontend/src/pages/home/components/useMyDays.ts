import { useQuery } from '@tanstack/react-query'
import { orpc } from '@/lib/orpc'
import { cycleRange, type MonthDay, type Overview } from '@/pages/attendance/components/labels'
import { addDays } from './home-labels'

// One's own days around today for the self-service home (2026-11-27): the attendance month today is in and, while the
// last 30 days reach back into it, the month before - with RML's 26th start day, 27 Nov is day 2 of "December", so the
// recent days and the days still to fix are mostly in "November". (Requests go back 30 days - the regularization's limit.)
export function useMyDays(overview: Overview | undefined) {
  const current = overview?.currentMonth
  const previous = current && (current.month === 1 ? { year: current.year - 1, month: 12 } : { year: current.year, month: current.month - 1 })
  const today = overview?.today.date
  const earliest = today && addDays(today, -30)
  const needPrevious = !!(current && earliest && earliest < cycleRange(current.year, current.month, overview.cycleStartDay).from)
  const thisMonth = useQuery({ ...orpc.attendance.days.myMonth.queryOptions({ input: current ?? { year: 2000, month: 1 } }), enabled: !!current })
  const lastMonth = useQuery({ ...orpc.attendance.days.myMonth.queryOptions({ input: previous ?? { year: 2000, month: 1 } }), enabled: needPrevious })
  const pending = !overview || thisMonth.isPending || (needPrevious && lastMonth.isPending)
  const days: (MonthDay & { locked: boolean })[] = pending
    ? []
    : [
        ...(needPrevious && lastMonth.data ? lastMonth.data.days.map((d) => ({ ...d, locked: lastMonth.data.locked })) : []),
        ...(thisMonth.data ? thisMonth.data.days.map((d) => ({ ...d, locked: thisMonth.data.locked })) : []),
      ]
  return { pending, error: thisMonth.error ?? lastMonth.error, days, month: thisMonth.data, today, earliest }
}
