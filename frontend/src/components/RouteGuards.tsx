import { Navigate, Outlet, useLocation } from 'react-router'
import { useAccess, type AccessArea } from '@/hooks/useAccess'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { errorMessage, isUnauthorized } from '@/lib/utils'

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
  if (me.error) {
    if (isUnauthorized(me.error)) {
      return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
    }
    return <FullPageMessage>{errorMessage(me.error)}</FullPageMessage>
  }
  if (me.data.mustChangePassword && location.pathname !== '/change-password') return <Navigate to="/change-password" replace />
  return <Outlet />
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
