import { useQuery } from '@tanstack/react-query'
import { orpc } from '@/lib/orpc'
import { todayDay } from '@/lib/utils'
import type { Overview } from '@/pages/attendance/components/labels'

// The attendance month to close (2026-11-27 - the "Attendance month" card and the role home's attention order read the
// same queries): the month before today's if it is over and still open (`overdue` - payroll takes days only from a
// locked month), else the month running now, with what is still open in it. `enabled`: only for whoever may lock it
// (Attendance setup Edit for every company - the readers refuse anyone else).
export function useMonthClose(overview: Overview | undefined, enabled = true) {
  const current = overview?.currentMonth ?? { year: todayDay().getUTCFullYear(), month: todayDay().getUTCMonth() + 1 }
  const previous = current.month === 1 ? { year: current.year - 1, month: 12 } : { year: current.year, month: current.month - 1 }
  const on = enabled && !!overview
  const months = useQuery({ ...orpc.attendance.locks.months.queryOptions({ input: { year: current.year } }), enabled: on })
  const lastYear = useQuery({ ...orpc.attendance.locks.months.queryOptions({ input: { year: previous.year } }), enabled: on && previous.year !== current.year })
  const all = [...(lastYear.data?.months ?? []), ...(months.data?.months ?? [])]
  const find = (m: { year: number; month: number }) => all.find((x) => x.year === m.year && x.month === m.month)
  const before = find(previous)
  const now = find(current)
  const overdue = before && before.ended && !before.locked ? before : null
  const focus = overdue ?? now
  const checklist = useQuery({ ...orpc.attendance.locks.checklist.queryOptions({ input: { year: focus?.year ?? current.year, month: focus?.month ?? current.month } }), enabled: on && !!focus })
  const pending = !overview || months.isPending || (previous.year !== current.year && lastYear.isPending) || (!!focus && checklist.isPending)
  return { pending, before, overdue, focus, checklist: checklist.data, error: months.error ?? lastYear.error ?? checklist.error }
}
