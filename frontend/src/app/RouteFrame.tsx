/**
 * Route frame — the Suspense boundary for lazy route chunks + the route
 * transition + chunk-failure recovery (docs/05 §6 kill-list #3 and #5).
 *
 * - Fallback is a layout-matched page skeleton (title + KPI row + cards), shown
 *   only after 120ms so fast chunk loads never flash a skeleton.
 * - Each pathname renders inside a keyed `.u-route` wrapper: a 200ms
 *   fade-through with a 6px rise (reduced-motion → fade only).
 * - A failed chunk (deploy rolled the hashes) shows a recovery card that
 *   reloads the app — never a blank screen.
 */
import { Component, Suspense, useEffect, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { Button, Card, EmptyState, Skeleton } from '../ui';

function PageSkeleton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
    }, 120);
    return () => {
      clearTimeout(timer);
    };
  }, []);
  return (
    <div role="status" aria-busy="true" aria-label="Loading page" className="space-y-6" style={{ opacity: visible ? 1 : 0 }}>
      <div className="space-y-3">
        <Skeleton className="w-32" />
        <Skeleton className="h-10 w-64 sm:w-80" />
      </div>
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-36 rounded-full" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Skeleton variant="block" className="h-56 rounded-card" />
        <Skeleton variant="block" className="h-56 rounded-card" />
      </div>
      <Skeleton variant="block" className="h-72 rounded-card" />
    </div>
  );
}

interface BoundaryState {
  failed: boolean;
}

class ChunkBoundary extends Component<{ children: ReactNode; resetKey: string }, BoundaryState> {
  override state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  override componentDidUpdate(previous: { resetKey: string }): void {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Route failed to render', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <Card role="alert">
        <EmptyState
          icon={<WifiOff />}
          title="This page could not load"
          description="The connection dropped or the app was updated while you were working. Reloading keeps your session and saved filters."
          action={
            <Button
              variant="primary"
              leadingIcon={<RefreshCw className="size-4" />}
              onClick={() => {
                window.location.reload();
              }}
            >
              Reload page
            </Button>
          }
        />
      </Card>
    );
  }
}

export function RouteFrame({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  return (
    <ChunkBoundary resetKey={routeKey}>
      <Suspense fallback={<PageSkeleton />}>
        <div key={routeKey} className="u-route">
          {children}
        </div>
      </Suspense>
    </ChunkBoundary>
  );
}
