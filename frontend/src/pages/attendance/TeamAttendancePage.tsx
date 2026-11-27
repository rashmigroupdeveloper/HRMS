import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useSearchParams } from 'react-router'
import { FormError } from '@/components/FormError'
import { usePortal } from '@/hooks/usePortal'
import { TeamAttendanceSkeleton } from '@/components/skeletons/attendance/TeamAttendanceSkeleton'
import { orpc } from '@/lib/orpc'
import { segment, SEGMENTS, type TeamView, teamViews } from './components/labels'
import { PeopleView } from './components/PeopleView'

// Team attendance (its own menu item since 2026-11-22 - the user): others' attendance - a manager's reporting tree, the
// employees whose HOD they are (view only) and everyone (Attendance: View). (The roster is in the attendance setup.)
// A switch between the views the viewer has (only when there are two or more); the open one is in the address
// (?view=all). Nobody to see: back to one's own attendance. The backend checks every call.
const SUBTITLE: Record<TeamView, string> = {
  team: 'Who in your team is in today, and their month.',
  department: 'The employees whose HOD you are: who is in today, and their month.',
  all: 'Who is in today across the company, and the month muster.',
}

export function TeamAttendancePage() {
  const overview = useQuery(orpc.attendance.overview.queryOptions())
  const { portal, to } = usePortal()
  const [params, setParams] = useSearchParams()
  const o = overview.data
  const views = o ? teamViews(o) : []
  const asked = params.get('view')
  const view = views.find(([value]) => value === asked)?.[0] ?? views[0]?.[0]
  // the roster moved to the attendance setup (2026-11-22)
  if (asked === 'roster') return <Navigate to="/manage/attendance-setup?part=roster" replace />
  // nobody to see: one's own attendance (self-service), or the role portal's home
  if (o && !view) return <Navigate to={portal === 'ess' ? '/ess/attendance' : '/manage'} replace />
  // before the views are known: the asked one's line (the first view's otherwise)
  const subtitle = SUBTITLE[(view ?? asked ?? 'team') as TeamView] ?? SUBTITLE.team

  return (
    <div className="space-y-6">
      <header>
        <Link to={to('/attendance-reports')} className="float-right flex min-h-10 items-center text-sm underline underline-offset-4">Reports</Link>
        <p className="text-sm text-muted-foreground">Time &amp; shifts</p>
        <h1 className="mt-1 text-3xl font-light tracking-tight sm:text-4xl">Team attendance</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground max-sm:hidden">{subtitle}</p>
      </header>
      <FormError error={overview.error} />
      {!o && !overview.error && <TeamAttendanceSkeleton label="Loading team attendance" team={(asked ?? 'team') === 'team'} />}
      {o && view && (
        <div className="space-y-3">
          {views.length > 1 && (
            <div className={SEGMENTS}>
              {views.map(([value, label]) => (
                <button key={value} type="button" aria-pressed={view === value} onClick={() => setParams({ view: value }, { replace: true })} className={segment(view === value)}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {/* a key per view: each starts afresh (its own day, search and company) */}
          {view === 'team' && <PeopleView key="team" scope="TEAM" canEdit={o.canEdit} />}
          {view === 'department' && <PeopleView key="department" scope="DEPARTMENT" canEdit={o.canEdit} />}
          {view === 'all' && <PeopleView key="all" scope="ALL" canEdit={o.canEdit} />}
        </div>
      )}
    </div>
  )
}
