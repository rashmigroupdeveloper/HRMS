import { useState } from 'react';
import { BookOpen, CalendarPlus, Palmtree } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  DarkCard,
  EmptyState,
  Pill,
  StatusBadge,
  Timeline,
} from '../../ui';
import type { TimelineStep } from '../../ui';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { useDashboardResource } from '../home/useDashboardResource';
import { LeaveApplyDrawer } from './LeaveApplyDrawer';
import type { LeaveTypeOption } from './LeaveApplyDrawer';

interface LeaveBalance {
  leaveType: string;
  name: string;
  balance: number;
  pending: number;
  available: number;
}
interface LeaveType {
  code: string;
  name: string;
  isPaid: boolean;
  accrualPerMonth: number;
  allowHalfDay: boolean;
  encashable: boolean;
  sandwichRule: 'include' | 'exclude';
  maxPerRequest: number | null;
}
interface LeaveApplication {
  id: number;
  leaveType: string;
  fromDate: string;
  toDate: string;
  days: number;
  status: string;
  workflowRequestId: number;
}
interface LedgerRow {
  id: number;
  leaveType: string;
  txnType: string;
  delta: number;
  effectiveDate: string;
  expiryDate: string | null;
  note: string | null;
}

export function MyLeavePage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const balances = useDashboardResource<LeaveBalance[]>('/api/leave/balances');
  const types = useDashboardResource<LeaveType[]>('/api/leave/types');
  const applications = useDashboardResource<LeaveApplication[]>('/api/leave/applications/mine');
  const ledger = useDashboardResource<LedgerRow[]>('/api/leave/ledger');

  if (balances.loading || types.loading) return <DashboardSkeleton />;
  if (balances.error) return <DashboardError message={balances.error} onRetry={balances.reload} />;
  const totalAvailable = balances.data?.reduce((sum, item) => sum + item.available, 0) ?? 0;
  const pending =
    applications.data?.filter((item) => item.status === 'pending').length ?? 0;
  const options: LeaveTypeOption[] = (types.data ?? []).map((type) => ({
    code: type.code,
    name: type.name,
    available: balances.data?.find((balance) => balance.leaveType === type.code)?.available ?? 0,
    allowHalfDay: type.allowHalfDay,
    maxPerRequest: type.maxPerRequest,
  }));

  const timeline: TimelineStep[] = (applications.data ?? []).slice(0, 8).map((item) => ({
    id: String(item.id),
    title: `${item.leaveType} · ${item.fromDate} to ${item.toDate}`,
    description: `${String(item.days)} days · workflow #${String(item.workflowRequestId)}`,
    timestamp: item.status,
    state:
      item.status === 'approved'
        ? 'done'
        : item.status === 'rejected'
          ? 'rejected'
          : 'current',
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">Employee self-service</p>
          <h1 className="mt-1 font-serif text-4xl font-light tracking-tight text-ink">My leave</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Balances are ledger sums; pending requests are already reserved.
          </p>
        </div>
        <Button
          variant="primary"
          leadingIcon={<CalendarPlus className="size-4" />}
          onClick={() => {
            setDrawerOpen(true);
          }}
        >
          Apply leave
        </Button>
      </header>

      <DarkCard className="flex flex-wrap items-end justify-between gap-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hero-muted">
            Available now
          </p>
          <p className="mt-3 text-5xl font-light tabular-nums">
            {totalAvailable.toLocaleString('en-IN')}
          </p>
          <p className="mt-1 text-sm text-hero-muted">days across assigned leave types</p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-tile bg-[color-mix(in_srgb,var(--surface)_9%,transparent)] px-5 py-4">
            <p className="text-xs text-hero-muted">Pending</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{pending}</p>
          </div>
          <div className="rounded-tile bg-[color-mix(in_srgb,var(--surface)_9%,transparent)] px-5 py-4">
            <p className="text-xs text-hero-muted">Leave types</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{balances.data?.length ?? 0}</p>
          </div>
        </div>
      </DarkCard>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(balances.data ?? []).map((balance) => (
          <Card key={balance.leaveType}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">{balance.name}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{balance.leaveType}</p>
              </div>
              <Pill>{balance.pending.toLocaleString('en-IN')} pending</Pill>
            </div>
            <p className="mt-8 text-4xl font-light tabular-nums text-ink">
              {balance.available.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-ink-muted">
              available of {balance.balance.toLocaleString('en-IN')}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Applications" subtitle="Live workflow status" />
          {timeline.length ? (
            <Timeline steps={timeline} />
          ) : (
            <EmptyState
              icon={<Palmtree />}
              title="No leave applications"
              description="Your submitted applications will appear here with approval state."
            />
          )}
        </Card>
        <Card>
          <CardHeader title="Leave ledger" subtitle="Immutable credits and debits" />
          {ledger.data?.length ? (
            <div className="space-y-2">
              {ledger.data.slice(0, 10).map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between rounded-row bg-surface-2 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {row.txnType.replaceAll('_', ' ')}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {row.effectiveDate} · {row.note ?? 'Policy transaction'}
                    </p>
                  </div>
                  <StatusBadge tone={row.delta >= 0 ? 'positive' : 'warning'}>
                    {row.delta > 0 ? '+' : ''}
                    {row.delta}
                  </StatusBadge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<BookOpen />}
              title="No ledger transactions"
              description="Accruals and approved leave debits will appear here."
            />
          )}
        </Card>
      </div>

      <LeaveApplyDrawer
        open={drawerOpen}
        leaveTypes={options}
        onClose={() => {
          setDrawerOpen(false);
        }}
        onSubmitted={() => {
          balances.reload();
          applications.reload();
          ledger.reload();
        }}
      />
    </div>
  );
}
