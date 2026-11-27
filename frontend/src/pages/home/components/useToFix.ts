import { useQuery } from '@tanstack/react-query'
import { orpc } from '@/lib/orpc'
import type { MonthDay, Overview } from '@/pages/attendance/components/labels'
import { useMyDays } from './useMyDays'

// The days the employee still has to act on (2026-11-27): a working day of the last 30, in a month not locked yet, with
// a missed punch or an absence and no request for it - regularization, leave or on duty waiting or approved. Newest
// first. (The header's count and the "Needs your attention" card read the same queries.)
export const problemOf = (d: Pick<MonthDay, 'firstHalf' | 'secondHalf'>) =>
  [d.firstHalf, d.secondHalf].find((s) => s === 'MISSED_PUNCH') ?? [d.firstHalf, d.secondHalf].find((s) => s === 'ABSENT')

export function useToFix(overview: Overview | undefined) {
  const my = useMyDays(overview)
  const regularizations = useQuery({ ...orpc.attendance.regularizations.mine.queryOptions(), enabled: !!overview })
  const leave = useQuery({ ...orpc.leave.applications.mine.queryOptions(), enabled: !!overview })
  const pending = my.pending || regularizations.isPending || leave.isPending
  const asked = (day: Date) =>
    !!regularizations.data?.some((r) => (r.status === 'PENDING' || r.status === 'APPROVED') && r.fromDate <= day && r.toDate >= day) ||
    !!leave.data?.some((l) => (l.status === 'PENDING' || l.status === 'APPROVED') && l.fromDate <= day && l.toDate >= day)
  const days = pending
    ? []
    : my.days.filter((d) => !d.locked && d.employed && d.planned === 'WORK' && d.date < my.today! && d.date >= my.earliest! && problemOf(d) && !asked(d.date)).reverse()
  return { pending, days, error: my.error ?? regularizations.error ?? leave.error }
}
