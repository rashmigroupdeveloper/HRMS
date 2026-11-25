import { useLocation } from 'react-router'
import type { Portal } from '@/lib/active-role'

// The portal the current page is shown in (2026-11-25): /manage/... = the role portal, anything else Employee
// self-service. Pages that exist in both portals (approvals, team attendance and leave, reports, people, pay & career)
// build their links with `to` so they stay in the portal they were opened in.
export function usePortal() {
  const { pathname } = useLocation()
  const portal: Portal = pathname === '/manage' || pathname.startsWith('/manage/') ? 'manage' : 'ess'
  return { portal, to: (path: string) => `/${portal}${path === '/' ? '' : path}` }
}
