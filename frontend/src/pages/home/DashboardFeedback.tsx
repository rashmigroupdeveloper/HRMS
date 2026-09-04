import { AlertTriangle, RefreshCw, UserRound } from 'lucide-react';
import { Button, Card, EmptyState, Skeleton } from '../../ui';

export function DashboardSkeleton() {
  return (
    // role="status" is what makes aria-label legal here: a bare <div> has no
    // role, so an aria-label on it is PROHIBITED (axe: aria-prohibited-attr)
    // and screen readers ignore it — the label was silently doing nothing.
    <div role="status" className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="space-y-2">
        <Skeleton className="w-36" />
        <Skeleton className="h-9 w-72" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} variant="block" />
        ))}
      </div>
      <Skeleton variant="block" className="h-56 rounded-card" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton variant="block" className="h-52 rounded-card" />
        <Skeleton variant="block" className="h-52 rounded-card" />
      </div>
    </div>
  );
}

export function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  if (/no employee profile/i.test(message)) {
    return <UnlinkedEmployee />;
  }
  return (
    // role="alert" + aria-live: a failure must be ANNOUNCED, not just drawn
    // (docs/05 §7 `aria-live-errors`). This is the shared error surface for
    // every dashboard and list in the product, so announcing here fixes them
    // all at once — and every error carries a recovery path (§6 kill-list #5).
    <Card role="alert" aria-live="assertive">
      <EmptyState
        icon={<AlertTriangle />}
        title="Dashboard unavailable"
        description={`${message} Your session and filters are unchanged.`}
        action={
          <Button
            variant="primary"
            leadingIcon={<RefreshCw className="size-4" />}
            onClick={onRetry}
          >
            Try again
          </Button>
        }
      />
    </Card>
  );
}

/** Login exists, but IT has not attached an employee master row (CORE-01). */
export function UnlinkedEmployee() {
  return (
    <Card>
      <EmptyState
        icon={<UserRound />}
        title="No employee profile on this login"
        description="IT attaches your employee record at onboarding. Attendance, leave and team views stay empty until that link exists — nothing is invented in the meantime."
      />
    </Card>
  );
}
