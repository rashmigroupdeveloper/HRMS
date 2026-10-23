import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CalendarPlus, ChevronLeft, ChevronRight, Palmtree } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import {
  Button,
  Card,
  CardHeader,
  ConfirmModal,
  DarkCard,
  EmptyState,
  IconButton,
  KpiNumber,
  MonthCalendar,
  PageHeader,
  SegmentedProgress,
  StatusBadge,
  Timeline,
  formatDateIN,
  todayISOIST,
  toast,
} from '../../ui';
import type { AttendanceDay, CalendarSpan, StatusTone, TimelineStep } from '../../ui';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { useDashboardResource } from '../home/useDashboardResource';
import { LeaveApplyDrawer } from './LeaveApplyDrawer';
import type { LeaveTypeOption } from './LeaveApplyDrawer';
import { takeActionParam } from '../_shared/action-param';

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
  workflowStatus?: string;
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

function shiftMonth(month: string, delta: number): string {
  const [year = 0, value = 1] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, value - 1 + delta, 1));
  return `${String(date.getUTCFullYear())}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthTitle(month: string): string {
  const [year = 0, value = 1] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, value - 1, 1)),
  );
}

const LEDGER_MOVEMENT: Record<string, string> = {
  grant: 'Opening credit',
  accrual: 'Monthly credit',
  application: 'Leave taken',
  cancel: 'Cancellation credit',
  encash: 'Encashed',
  lapse: 'Lapsed',
  adjustment: 'Adjustment',
  comp_off_earn: 'Comp-off earned',
};

function ledgerWhen(value: string): string {
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(value)?.[1];
  return iso === undefined ? value : formatDateIN(iso);
}

function orderFloating(rows: RestrictedHoliday[], today: string): RestrictedHoliday[] {
  return [...rows].sort((left, right) => {
    const leftOpen = isOpenPick(left, today) ? 0 : 1;
    const rightOpen = isOpenPick(right, today) ? 0 : 1;
    if (leftOpen !== rightOpen) return leftOpen - rightOpen;
    return left.date.localeCompare(right.date);
  });
}

export function MyLeavePage({ ownerId }: { ownerId?: number }) {
  const [drawerOpen, setDrawerOpen] = useState(() => takeActionParam('apply'));
  const [leaveMonth, setLeaveMonth] = useState(() => todayISOIST().slice(0, 7));
  const [pickingId, setPickingId] = useState<number | null>(null);
  const balances = useDashboardResource<LeaveBalance[]>('/api/leave/balances');
  const types = useDashboardResource<LeaveType[]>('/api/leave/types');
  const applications = useDashboardResource<LeaveApplication[]>('/api/leave/applications/mine');
  const ledger = useDashboardResource<LedgerRow[]>('/api/leave/ledger');
  const floating = useDashboardResource<RestrictedHoliday[]>('/api/leave/restricted-holidays');
  const [cancelling, setCancelling] = useState<LeaveApplication | null>(null);
  const encashable = (types.data ?? []).filter((t) => t.encashable);
  const [encashType, setEncashType] = useState('');
  const [encashDays, setEncashDays] = useState('');
  const cancelLeave = async () => {
    if (!cancelling) return;
    try {
      await apiFetch(`/api/leave/applications/${String(cancelling.id)}/cancel`, { method: 'POST' });
      toast.success('Cancellation requested', { description: 'Your approver has been notified.' });
      applications.reload();
    } catch (e) { toast.error('Could not cancel', { description: e instanceof Error ? e.message : 'Try again.' }); }
    setCancelling(null);
  };
  const requestEncash = async () => {
    const code = encashType === '' ? (encashable[0]?.code ?? '') : encashType;
    try {
      await apiFetch('/api/leave/encashments', { method: 'POST', body: JSON.stringify({ leaveType: code, days: Number(encashDays) }) });
      toast.success('Encashment requested', { description: `${encashDays} day(s) of ${code} sent for approval.` });
      setEncashDays('');
    } catch (e) { toast.error('Could not request encashment', { description: e instanceof Error ? e.message : 'Try again.' }); }
  };

  const leaveSpans = useMemo(() => {
    const spans: CalendarSpan[] = [];
    for (const application of applications.data ?? []) {
      if (application.status === 'rejected' || application.status === 'cancelled') continue;
      if (application.toDate < `${leaveMonth}-01` || application.fromDate > `${leaveMonth}-31`) continue;
      const name = (types.data ?? []).find((type) => type.code === application.leaveType)?.name ?? application.leaveType;
      spans.push({
        id: `leave-${String(application.id)}`,
        from: application.fromDate,
        to: application.toDate,
        label: application.status === 'pending' ? `${name} · pending` : name,
        tone: 'leave',
      });
    }
    for (const holiday of floating.data ?? []) {
      if (!holiday.date.startsWith(leaveMonth)) continue;
      spans.push({ id: `rh-${String(holiday.id)}`, from: holiday.date, to: holiday.date, label: holiday.name, tone: 'holiday' });
    }
    return spans;
  }, [applications.data, floating.data, leaveMonth, types.data]);

  const leaveDays = useMemo(() => {
    const value: Partial<Record<number, AttendanceDay>> = {};
    for (const span of leaveSpans) {
      if (span.tone !== 'holiday' || !span.from.startsWith(leaveMonth)) continue;
      value[Number(span.from.slice(-2))] = { state: 'holiday', note: span.label };
    }
    return value;
  }, [leaveMonth, leaveSpans]);

  if (balances.loading || types.loading) return <DashboardSkeleton />;
  if (balances.error) return <DashboardError message={balances.error} onRetry={balances.reload} />;
  const rows = balances.data ?? [];
  const totalAvailable = rows.reduce((sum, item) => sum + item.available, 0);
  const totalBalance = rows.reduce((sum, item) => sum + item.balance, 0);
  const totalPending = rows.reduce((sum, item) => sum + item.pending, 0);
  const pendingApps = applications.data?.filter((item) => item.status === 'pending' && item.workflowStatus !== 'sent_back').length ?? 0;
  const options: LeaveTypeOption[] = (types.data ?? []).map((type) => ({
    code: type.code,
    name: type.name,
    available: rows.find((balance) => balance.leaveType === type.code)?.available ?? 0,
    isPaid: type.isPaid,
    allowHalfDay: type.allowHalfDay,
    maxPerRequest: type.maxPerRequest,
    sandwichRule: type.sandwichRule,
  }));

  const timeline: TimelineStep[] = (applications.data ?? []).slice(0, 8).map(item => {
    const status = item.status === 'pending' ? item.workflowStatus ?? item.status : item.status;
    return { id: String(item.id),
      title: <Link className="rounded-control underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-focus"
        to={`/approvals/${String(item.workflowRequestId)}`}>{item.leaveType} · {formatDateIN(item.fromDate)} to {formatDateIN(item.toDate)} · View decisions</Link>,
      description: `${String(item.days)} days ${item.status === 'pending' ? 'reserved' : item.status}`,
      timestamp: status.replaceAll('_', ' '),
      state: status === 'approved' ? 'done' : status === 'rejected' || status === 'sent_back' ? 'rejected' : 'current',
    };
  });

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
        <Card>
          <CardHeader title="By type" subtitle="Gold is ready to take, charcoal is reserved, hatch is the rest of the ledger" />
          <div className="space-y-5">
            {rows.map((balance) => (
              balance.balance <= 0 && balance.available <= 0 && balance.pending <= 0 ? (
                <div key={balance.leaveType} className="flex items-baseline justify-between gap-4">
                  <span className="text-sm font-medium text-ink">{balance.name}</span>
                  <span className="text-sm text-ink-muted">Nothing credited yet</span>
                </div>
              ) : (
                <SegmentedProgress
                  key={balance.leaveType}
                  label={balance.name}
                  primary={balance.available}
                  secondary={balance.pending}
                  total={Math.max(balance.balance, balance.available + balance.pending)}
                />
              )
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          headingLevel={2}
          title={monthTitle(leaveMonth)}
          subtitle="Leave you have asked for, and floating holidays you can pick"
          action={
            <div className="flex gap-1">
              <IconButton label="Previous month" icon={<ChevronLeft />} size="sm" onClick={() => { setLeaveMonth(shiftMonth(leaveMonth, -1)); }} />
              <IconButton label="Next month" icon={<ChevronRight />} size="sm" onClick={() => { setLeaveMonth(shiftMonth(leaveMonth, 1)); }} />
            </div>
          }
        />
        <MonthCalendar
          year={Number(leaveMonth.slice(0, 4))}
          month={Number(leaveMonth.slice(5, 7))}
          days={leaveDays}
          spans={leaveSpans}
        />
      </Card>

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
            subtitle={pendingApps > 0 ? `${String(pendingApps)} awaiting approval` : 'Live approval state'}
          />
          {applications.error ? <DashboardError message={applications.error} onRetry={applications.reload} />
            : applications.loading ? <p role="status" className="text-sm text-ink-muted">Loading applications…</p> : timeline.length ? (
            <>
              <Timeline steps={timeline} />
              {/* E2E-012: approved leave can be cancelled (routes for re-approval). */}
              {(applications.data ?? []).filter((a) => a.status === 'approved').slice(0, 6).length > 0 && (
                <ul className="mt-4 space-y-2" aria-label="Approved leave you can cancel">
                  {(applications.data ?? []).filter((a) => a.status === 'approved').slice(0, 6).map((a) => (
                    <li key={a.id} className="flex items-center justify-between rounded-row bg-surface-2 px-4 py-2 text-sm">
                      <span>{a.leaveType} · {formatDateIN(a.fromDate)} – {formatDateIN(a.toDate)} · {String(a.days)} d</span>
                      <Button size="sm" variant="ghost" onClick={() => { setCancelling(a); }}>Cancel leave</Button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <EmptyState
              icon={<Palmtree />}
              title="You have not asked for leave yet"
              description="Apply for leave, then track its approval here. Attendance changes after final approval."
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
                      {(types.data ?? []).find((type) => type.code === row.leaveType)?.name ?? row.leaveType}
                      {' · '}
                      {LEDGER_MOVEMENT[row.txnType] ?? row.txnType.replaceAll('_', ' ')}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {ledgerWhen(row.effectiveDate)}
                      {row.note ? ` · ${row.note}` : ''}
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

      {encashable.length > 0 && (
        <Card>
          <CardHeader title="Leave encashment" subtitle="Turn encashable leave into pay. The request goes through approval; payroll pays it." />
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-ink-muted">Leave type</span>
              <select className="rounded-field border border-line bg-surface px-3 py-2" value={encashType} onChange={(e) => { setEncashType(e.target.value); }}>
                {encashable.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-ink-muted">Days</span>
              <input className="w-24 rounded-field border border-line bg-surface px-3 py-2" type="number" min={0.5} step={0.5} value={encashDays} onChange={(e) => { setEncashDays(e.target.value); }} />
            </label>
            <Button variant="secondary" disabled={!(Number(encashDays) > 0)} onClick={() => void requestEncash()}>Request encashment</Button>
          </div>
        </Card>
      )}

      <ConfirmModal open={cancelling !== null} onClose={() => { setCancelling(null); }} title="Cancel this leave?"
        description={cancelling ? `${cancelling.leaveType} ${formatDateIN(cancelling.fromDate)} – ${formatDateIN(cancelling.toDate)}. The cancellation goes to your approver; the days return to your balance once approved.` : ''}
        confirmLabel="Request cancellation" onConfirm={() => void cancelLeave()} />

      <LeaveApplyDrawer
        ownerId={ownerId}
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
