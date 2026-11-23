import { useQuery } from '@tanstack/react-query'
import { orpc } from '@/lib/orpc'
import { todayDay } from './labels'

// The attendance month today is in (the user, 2026-11-22: RML's month runs from the 26th to the 25th, so from 26 Nov it is
// "December") - from the overview the attendance page has already loaded; the calendar month until it answers.
export function useAttendanceMonth() {
  const overview = useQuery(orpc.attendance.overview.queryOptions())
  const now = todayDay()
  return overview.data?.currentMonth ?? { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 }
}

// The day an attendance month starts (RML: 26) - 1 (the calendar month) until the overview answers
export function useCycleStartDay() {
  return useQuery(orpc.attendance.overview.queryOptions()).data?.cycleStartDay ?? 1
}
