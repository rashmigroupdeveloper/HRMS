import { SetupSkeleton } from '@/components/skeletons/attendance/SetupSkeleton'
import { useSearchParams } from 'react-router'
import { useAccess } from '@/hooks/useAccess'
import { SetupStats } from './components/SetupStats'
import { SetupView } from './components/SetupView'

// Attendance setup (its own menu item under "More" and its own area since 2026-11-22 - the user): punch uploads, shifts,
// schedule patterns, policies, schedules (who follows which pattern), roster changes, holidays and the month lock. Attendance setup: View sees it (RequireAccess),
// Edit changes it - what shows depends on that, so it waits for accounts.me.
export function AttendanceSetupPage() {
  const { ready } = useAccess()
  const [params] = useSearchParams()
  return (
    <div className="space-y-5">
      {/* the title with the setup's headline numbers on the right (the redesign, 2026-11-25 - the sentence listing the
          parts is gone: the tabs below say it) */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Time &amp; shifts</p>
          <h1 className="mt-1 text-3xl font-light tracking-tight sm:text-4xl">Attendance setup</h1>
        </div>
        <SetupStats />
      </header>
      {ready ? <SetupView /> : <SetupSkeleton part={params.get('part')} label="Loading the attendance setup" />}
    </div>
  )
}
