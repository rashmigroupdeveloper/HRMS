import { useQuery } from '@tanstack/react-query'
import { Navigate, useSearchParams } from 'react-router'
import { FormError } from '@/components/FormError'
import { TodayCardSkeleton } from '@/components/skeletons/common/TodayCardSkeleton'
import { TodayCard } from '@/components/TodayCard'
import { orpc } from '@/lib/orpc'
import { MyAttendance } from './components/MyAttendance'

// My attendance (everyone): one's own days from the biometric punches and one's shift changes. Others' attendance and the
// setup are pages of their own in the menu since 2026-11-22 (the user) - Team attendance, Attendance setup.
// Links from before that (/attendance?tab=...) go on to them.
const OLD_TABS: Record<string, string> = {
  team: '/ess/team-attendance',
  department: '/ess/team-attendance?view=department',
  all: '/manage/team-attendance?view=all',
  roster: '/manage/attendance-setup?part=roster',
  setup: '/manage/attendance-setup',
}

export function MyAttendancePage() {
  const overview = useQuery(orpc.attendance.overview.queryOptions())
  const [params] = useSearchParams()
  const moved = OLD_TABS[params.get('tab') ?? '']
  if (moved) return <Navigate to={moved} replace />

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight sm:text-4xl">My attendance</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Your time, shifts and attendance requests.</p>
        </div>
        {overview.data ? <TodayCard today={overview.data.today} /> : !overview.error && <TodayCardSkeleton label="Loading today's attendance" />}
      </header>
      <FormError error={overview.error} />
      <MyAttendance />
    </div>
  )
}
