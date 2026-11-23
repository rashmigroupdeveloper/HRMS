import { useQuery } from '@tanstack/react-query'
import { Navigate, useSearchParams } from 'react-router'
import { FormError } from '@/components/FormError'
import { TeamLeaveSkeleton } from '@/components/skeletons/leave/TeamLeaveSkeleton'
import { orpc } from '@/lib/orpc'
import { cn } from '@/lib/utils'
import { segment, SEGMENTS } from '@/pages/attendance/components/labels'
import { LeavePages } from './components/LeavePages'
import { TEAM_LEAVE_PARTS, type TeamLeavePart, type TeamLeaveView, teamLeaveViews } from './components/labels'
import { LeaveRecounts } from './components/LeaveRecounts'
import { LeaveRegister } from './components/LeaveRegister'
import { LeaveTypes } from './components/LeaveTypes'
import { TeamLeaveList } from './components/TeamLeaveList'

// Team leave (/team-leave, 2026-11-22): others' leave - a manager's reporting tree, the employees whose HOD they are (view
// only) and everyone (Leave View): who is on leave over a span, the balances (the leave register, HR's adjustments with
// Leave Edit) and - with Leave View - the leave types. Deciding is on the Approvals page. The views the viewer has and the
// part are in the address (?view=all&part=balances). Nobody to see: back to one's own leave. The backend checks every call.
const SCOPE: Record<TeamLeaveView, 'TEAM' | 'DEPARTMENT' | 'ALL'> = { team: 'TEAM', department: 'DEPARTMENT', all: 'ALL' }

export function TeamLeavePage() {
  const overview = useQuery(orpc.leave.overview.queryOptions())
  const [params, setParams] = useSearchParams()
  const o = overview.data
  const views = o ? teamLeaveViews(o) : []
  const view = views.find(([value]) => value === params.get('view'))?.[0] ?? views[0]?.[0]
  // the leave types and the leave to recount: everyone's (Leave View)
  const parts = TEAM_LEAVE_PARTS.filter(([value]) => (value !== 'types' && value !== 'recount') || o?.canSeeAll)
  const part: TeamLeavePart = parts.find(([value]) => value === params.get('part'))?.[0] ?? 'away'
  if (o && !view) return <Navigate to="/leave" replace />
  const go = (next: { view?: string; part?: string }) => setParams({ ...(view && { view }), part, ...next }, { replace: true })

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Time off</p>
          <h1 className="mt-1 text-3xl font-light tracking-tight sm:text-4xl">Team leave</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground max-sm:hidden">Who is on leave, everyone&apos;s balances, the leave types and leave to recount. Leave is approved on the Approvals page.</p>
        </div>
        <LeavePages />
      </header>
      <FormError error={overview.error} />
      {!o && !overview.error && <TeamLeaveSkeleton label="Loading team leave" />}
      {o && view && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className={SEGMENTS}>
              {parts.map(([value, label]) => (
                <button key={value} type="button" aria-pressed={part === value} onClick={() => go({ part: value })} className={segment(part === value)}>
                  {label}
                </button>
              ))}
            </div>
            {views.length > 1 && part !== 'types' && part !== 'recount' && (
              <div className={cn(SEGMENTS, 'sm:ml-auto')}>
                {views.map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={view === value} onClick={() => go({ view: value })} className={segment(view === value)}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* a key per view: each starts afresh */}
          {part === 'away' && <TeamLeaveList key={view} scope={SCOPE[view]} />}
          {part === 'balances' && <LeaveRegister key={view} scope={SCOPE[view]} />}
          {part === 'types' && <LeaveTypes />}
          {part === 'recount' && <LeaveRecounts />}
        </div>
      )}
    </div>
  )
}
