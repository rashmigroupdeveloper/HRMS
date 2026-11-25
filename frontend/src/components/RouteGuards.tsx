import { Navigate, Outlet, useLocation } from 'react-router'
import { useAccess, type AccessArea } from '@/hooks/useAccess'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { portalOf, storedPortal, type Portal } from '@/lib/active-role'
import { errorMessage, isUnauthorized } from '@/lib/utils'
import { WrongPortal } from './layout/WrongPortal'

function FullPageMessage({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-svh place-items-center p-6 text-sm text-muted-foreground">{children}</div>
}

// Pages inside need a logged-in employee; otherwise -> /login (and back here after logging in).
// Signed in with a temporary password -> /change-password before anything else (the backend blocks other APIs too).
// While accounts.me loads, the layout and the page already show (2026-11-22): the page's own skeleton and its data load
// at the same time instead of after it - one skeleton, not an app skeleton first. Whatever depends on the access waits
// for `me` (useAccess().ready); the backend checks every call anyway.
export function RequireLogin() {
  const me = useCurrentUser()
  const location = useLocation()

  if (me.isPending) return <Outlet />
  // Not logged in (any more): a failed re-check keeps the last user's data in the cache, so the error decides
  if (isUnauthorized(me.error)) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  }
  // Another failure only when nobody is known yet - a failed background re-check stays on the last answer
  if (!me.data) return <FullPageMessage>{errorMessage(me.error)}</FullPageMessage>
  if (me.data.mustChangePassword && location.pathname !== '/change-password') return <Navigate to="/change-password" replace />
  return <Outlet />
}

// The pages of one portal (2026-11-25): /ess/... Employee self-service (no role active), /manage/... the role portal.
// Opened in the other one -> the WrongPortal screen with the switch, instead of the page. Until accounts.me answers the
// page shows its skeleton (the tab's stored choice already sent the right header).
export function RequirePortal({ portal }: { portal: Portal }) {
  const { me, ready } = useAccess()
  if (ready && me && portalOf(me.activeRoleId) !== portal) return <WrongPortal portal={portal} />
  return <Outlet />
}

// An address from before the two portals (2026-11-25) - links in sent e-mails, bookmarks: the same page in its portal.
// `portal` for pages of one portal only; pages in both go to this tab's portal.
export function MovedToPortal({ portal }: { portal?: Portal }) {
  const { pathname, search, hash } = useLocation()
  return <Navigate to={`/${portal ?? storedPortal()}${pathname}${search}${hash}`} replace />
}

// "/" - the home of this tab's portal
export function PortalHome() {
  return <Navigate to={`/${storedPortal()}`} replace />
}

// Pages of one area (e.g. onboarding) - or of any of several (Organization: its masters or the HOD posts): only employees
// whose roles give at least view access to it; everyone else -> the home page. What they may change inside is decided
// per button with useAccess().
export function RequireAccess({ area }: { area: AccessArea | AccessArea[] }) {
  const { ready, can } = useAccess()
  // until accounts.me answers the access is not known - the page shows its skeleton meanwhile
  if (ready && !(Array.isArray(area) ? area : [area]).some((a) => can(a))) return <Navigate to="/" replace />
  return <Outlet />
}
