import { useQuery } from '@tanstack/react-query'
import { NavLink } from 'react-router'
import { usePortal } from '@/hooks/usePortal'
import { orpc } from '@/lib/orpc'
import { segment, SEGMENTS } from '@/pages/attendance/components/labels'

// The switch between the leave pages at the top of each (one "Leave" item in the menu - 2026-11-22): My leave and Holidays
// for everyone (2026-11-25), Team leave only for those with someone else's leave to see - a team, an HOD department or
// Leave View (it appears once that is known). Employee self-service only - in the role portal Team leave is the menu's
// Leave item and the page has no switch (2026-11-25)
export function LeavePages() {
  const { portal } = usePortal()
  const overview = useQuery({ ...orpc.leave.overview.queryOptions(), enabled: portal === 'ess' })
  const o = overview.data
  const team = !!o && (o.canSeeAll || o.teamSize > 0 || o.departmentSize > 0)
  const pages: [string, string][] = [
    ['/ess/leave', 'My leave'],
    ['/ess/holidays', 'Holidays'],
    ...(team ? ([['/ess/team-leave', 'Team leave']] as [string, string][]) : []),
  ]
  if (portal === 'manage') return null
  return (
    <nav aria-label="Leave pages" className={SEGMENTS}>
      {pages.map(([to, label]) => (
        <NavLink key={to} to={to} end className={({ isActive }) => segment(isActive)}>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
