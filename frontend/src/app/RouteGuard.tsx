/** Layout route that renders a 403 state instead of a page the user may not use (E2E-001). */
import { ShieldOff } from 'lucide-react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import type { SessionUser } from '../lib/session';
import { EmptyState } from '../ui';
import { canAccessRoute } from './route-guard';

export function RouteGuard({ user }: { user: SessionUser }) {
  const { pathname } = useLocation();
  if (canAccessRoute(user, pathname)) return <Outlet />;
  return (
    <div role="alert" data-testid="forbidden-page">
      <EmptyState icon={<ShieldOff />} title="You don't have access to this page"
        description="Your role does not include this screen. If you need it, ask HR or IT to review your access."
        action={<Link className="underline" to="/">Go to home</Link>} />
    </div>
  );
}
