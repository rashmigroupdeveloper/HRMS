import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button, Card, EmptyState, Skeleton } from '../../ui';

export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
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
  return (
    <Card>
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
