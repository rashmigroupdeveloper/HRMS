import { useState } from 'react';
import { BookOpen, CalendarPlus, Palmtree } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import {
  Button,
  Card,
  CardHeader,
  DarkCard,
  EmptyState,
  KpiNumber,
  PageHeader,
  Pill,
  StatusBadge,
  Timeline,
  formatDateIN,
  todayISOIST,
  toast,
} from '../../ui';
import type { StatusTone, TimelineStep } from '../../ui';
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

interface RestrictedHoliday {
  id: number;
  date: string;
  name: string;
  myStatus: string | null;
}

function rhStatusCopy(status: string): string {
  if (status === 'approved') return 'Confirmed';
  if (status === 'pending') return 'With your manager';
  if (status === 'rejected') return 'Not approved';
  if (status === 'sent_back') return 'Sent back';
  return status.replaceAll('_', ' ');
}

function rhStatusTone(status: string): StatusTone {
  if (status === 'approved') return 'positive';
  if (status === 'rejected') return 'negative';
  if (status === 'pending' || status === 'sent_back') return 'warning';
  return 'neutral';
}

function isOpenPick(row: RestrictedHoliday, today: string): boolean {
  return row.myStatus === null && row.date >= today;
}

function orderFloating(rows: RestrictedHoliday[], today: string): RestrictedHoliday[] {
  return [...rows].sort((left, right) => {
    const leftOpen = isOpenPick(left, today) ? 0 : 1;
    const rightOpen = isOpenPick(right, today) ? 0 : 1;
    if (leftOpen !== rightOpen) return leftOpen - rightOpen;
    return left.date.localeCompare(right.date);
  });
}

export function MyLeavePage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pickingId, setPickingId] = useState<number | null>(null);
  const balances = useDashboardResource<LeaveBalance[]>('/api/leave/balances');
  const types = useDashboardResource<LeaveType[]>('/api/leave/types');
  const applications = useDashboardResource<LeaveApplication[]>('/api/leave/applications/mine');
  const ledger = useDashboardResource<LedgerRow[]>('/api/leave/ledger');
  const floating = useDashboardResource<RestrictedHoliday[]>('/api/leave/restricted-holidays');

  if (balances.loading || types.loading) return <DashboardSkeleton />;
  if (balances.error) return <DashboardError message={balances.error} onRetry={balances.reload} />;
  const rows = balances.data ?? [];
  const totalAvailable = rows.reduce((sum, item) => sum + item.available, 0);
  const totalBalance = rows.reduce((sum, item) => sum + item.balance, 0);
  const totalPending = rows.reduce((sum, item) => sum + item.pending, 0);
  const pendingApps = applications.data?.filter((item) => item.status === 'pending').length ?? 0;
  const options: LeaveTypeOption[] = (types.data ?? []).map((type) => ({
    code: type.code,
    name: type.name,
    available: rows.find((balance) => balance.leaveType === type.code)?.available ?? 0,
    allowHalfDay: type.allowHalfDay,
    maxPerRequest: type.maxPerRequest,
    sandwichRule: type.sandwichRule,
  }));

  const timeline: TimelineStep[] = (applications.data ?? []).slice(0, 8).map((item) => ({
    id: String(item.id),
    title: `${item.leaveType} · ${item.fromDate} to ${item.toDate}`,
    description: `${String(item.days)} days reserved`,
    timestamp: item.status,
    state:
      item.status === 'approved' ? 'done' : item.status === 'rejected' ? 'rejected' : 'current',
  }));

  const today = todayISOIST();
  const yearPrefix = today.slice(0, 4);
  const yearFloating = orderFloating(
    (floating.data ?? []).filter((row) => row.date.startsWith(yearPrefix)),
    today,
  );

  const pickFloating = async (row: RestrictedHoliday) => {
    setPickingId(row.id);
    try {
      await apiFetch(`/api/leave/restricted-holidays/${String(row.id)}/select`, { method: 'POST' });
      toast.success('Floating holiday sent for approval', {
        description: `${formatDateIN(row.date)} — ${row.name}`,
      });
      floating.reload();
    } catch (cause) {
      toast.error('Could not pick this day', {
        description: cause instanceof Error ? cause.message : 'Try again in a moment.',
      });
    } finally {
      setPickingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Time you have already earned"
        title="My leave"
        description={
          rows.length > 0
            ? `${totalAvailable.toLocaleString('en-IN')} of ${totalBalance.toLocaleString('en-IN')} ledger days are ready to take.`
            : 'Leave types are assigned first; monthly accrual credits the ledger you see here.'
        }
        actions={
          <Button
            variant="primary"
            leadingIcon={<CalendarPlus className="size-4" />}
            onClick={() => {
              setDrawerOpen(true);
            }}
          >
            Apply for a day off
          </Button>
        }
      />

      <DarkCard>
        <div>
          <p className="text-xs font-medium tracking-tight text-hero-muted">Ready to take</p>
          <p className="mt-3 text-5xl font-light tabular-nums">
            <KpiNumber value={totalAvailable} />
          </p>
          <p className="mt-1 text-sm text-hero-muted">
            {rows.length > 0
              ? `${totalAvailable.toLocaleString('en-IN')} of ${totalBalance.toLocaleString('en-IN')} ledger days · ${totalPending.toLocaleString('en-IN')} reserved · ${String(rows.length)} type${rows.length === 1 ? '' : 's'} already assigned`
              : 'No types assigned yet — HR adds them with your joining pack'}
          </p>
        </div>
      </DarkCard>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Palmtree />}
            title="Balances appear after types are assigned"
            description="Once HR maps your leave types, accrual credits days here. You can still start an application so your manager sees the dates."
            action={
              <Button size="sm" variant="secondary" onClick={() => { setDrawerOpen(true); }}>
                Apply for a day off
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((balance) => (
            <Card key={balance.leaveType}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{balance.name}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {balance.available.toLocaleString('en-IN')} of {balance.balance.toLocaleString('en-IN')} ready
                  </p>
                </div>
                <Pill>{balance.pending.toLocaleString('en-IN')} reserved</Pill>
              </div>
              <p className="mt-8 text-4xl font-light tabular-nums text-ink">
                {balance.available.toLocaleString('en-IN')}
              </p>
            </Card>
          ))}
        </div>
      )}

      {floating.error || floating.loading ? null : (
        <Card>
          <CardHeader
            title="Floating holidays"
            subtitle="Pick the floating holiday you will take"
          />
          {yearFloating.length === 0 ? (
            <EmptyState
              icon={<Palmtree />}
              title="HR has not published this year's list yet"
              description="Floating holidays appear here after HR publishes them. Nothing is missing from your record."
            />
          ) : (
            <ul className="space-y-2">
              {yearFloating.map((row) => {
                const open = isOpenPick(row, today);
                return (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 rounded-row bg-surface-2 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {formatDateIN(row.date)} — {row.name}
                      </p>
                      {row.myStatus === null && row.date < today ? (
                        <p className="mt-0.5 text-xs text-ink-muted">This day has already passed</p>
                      ) : null}
                    </div>
                    {open ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={pickingId === row.id}
                        disabled={pickingId !== null && pickingId !== row.id}
                        onClick={() => {
                          void pickFloating(row);
                        }}
                      >
                        Pick this day
                      </Button>
                    ) : row.myStatus !== null ? (
                      <StatusBadge tone={rhStatusTone(row.myStatus)}>
                        {rhStatusCopy(row.myStatus)}
                      </StatusBadge>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Applications already in motion"
            subtitle={pendingApps > 0 ? `${String(pendingApps)} waiting on your manager` : 'Live approval state'}
          />
          {timeline.length ? (
            <Timeline steps={timeline} />
          ) : (
            <EmptyState
              icon={<Palmtree />}
              title="You have not asked for leave yet"
              description="Apply now and the days are reserved so they are not treated as unauthorised absence."
              action={
                <Button size="sm" variant="secondary" onClick={() => { setDrawerOpen(true); }}>
                  Apply for a day off
                </Button>
              }
            />
          )}
        </Card>
        <Card>
          <CardHeader title="What has already been credited" subtitle="Immutable ledger — every credit and debit" />
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
              title="The ledger fills after the first accrual"
              description="Monthly credits and approved leave debits appear here. Nothing is missing — the first credit has not posted yet."
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
