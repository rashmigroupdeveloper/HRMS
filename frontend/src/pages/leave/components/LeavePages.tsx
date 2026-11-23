import { useQuery } from '@tanstack/react-query'
import { NavLink } from 'react-router'
import { orpc } from '@/lib/orpc'
import { segment, SEGMENTS } from '@/pages/attendance/components/labels'

// The switch between My leave and Team leave at the top of both pages (one "Leave" item in the menu - 2026-11-22). Only for
// those with someone else's leave to see: a team, an HOD department or Leave View; nothing for everyone else.
export function LeavePages() {
  const overview = useQuery(orpc.leave.overview.queryOptions())
  const o = overview.data
  if (!o || (!o.canSeeAll && !o.teamSize && !o.departmentSize)) return null
  return (
    <nav aria-label="Leave pages" className={SEGMENTS}>
      {(
        [
          ['/leave', 'My leave'],
          ['/team-leave', 'Team leave'],
        ] as const
      ).map(([to, label]) => (
        <NavLink key={to} to={to} end className={({ isActive }) => segment(isActive)}>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
