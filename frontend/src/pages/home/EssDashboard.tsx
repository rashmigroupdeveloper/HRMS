import { ArrowRight, BookOpen, FileClock, Palmtree } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { todayLongIST } from '../../lib/date';
import {
  Button,
  Card,
  CardHeader,
  DarkCard,
  EmptyState,
  KpiPillRow,
  PageHeader,
  Pill,
  StatusBadge,
  formatDateIN,
} from '../../ui';
import type { AttendanceRequest } from '../attendance/attendance-types';
import type { EssDashboardData } from './dashboard-types';
import { attendanceLabel, formatTime } from './dashboard-format';
import { useDashboardResource } from './useDashboardResource';
import { EssTodayRail } from './ess-today';

const CREAM =
  'u-press mt-6 inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--surface)_12%,transparent)] px-5 py-2.5 text-sm font-semibold text-hero-ink';

const KIND_LABEL: Record<string, string> = {
  AR: 'Attendance regularisation',
  OD: 'Official duty',
  PERMISSION: 'Short permission',
};

interface PolicyItem {
  id: number;
  title: string;
  requiresAcknowledgment: boolean;
  acknowledgedAt: string | null;
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

interface PendingRow {
  key: string;
  title: string;
  dates: string;
  fromDate: string;
  to: '/my/leave' | '/my/attendance';
  status: string;
}

function isOpen(status: string): boolean {
  return status === 'pending' || status === 'sent_back';
}

function dateSpan(from: string, to: string): string {
  if (from === to) return formatDateIN(from);
  return `${formatDateIN(from)} – ${formatDateIN(to)}`;
}

function ackCopy(pendingCount: number, requiringCount: number): string {
  if (requiringCount > 0) {
    return `${String(pendingCount)} of ${String(requiringCount)} still to read`;
  }
  return pendingCount === 1
    ? '1 policy still needs your acknowledgement'
    : `${String(pendingCount)} policies still need your acknowledgement`;
}

function buildPendingRows(
  leave: LeaveApplication[] | null,
  attendance: AttendanceRequest[] | null,
  leaveNames: Record<string, string>,
): { rows: PendingRow[]; openCount: number } {
  const rows: PendingRow[] = [];
  for (const item of leave ?? []) {
    if (!isOpen(item.status)) continue;
    rows.push({
      key: `leave-${String(item.id)}`,
      title: leaveNames[item.leaveType] ?? item.leaveType,
      dates: dateSpan(item.fromDate, item.toDate),
      fromDate: item.fromDate,
      to: '/my/leave',
      status: item.status,
    });
  }
  for (const item of attendance ?? []) {
    if (!isOpen(item.workflowStatus)) continue;
    rows.push({
      key: `att-${String(item.id)}`,
      title: KIND_LABEL[item.kind] ?? item.kind,
      dates: dateSpan(item.fromDate, item.toDate),
      fromDate: item.fromDate,
      to: '/my/attendance',
      status: item.workflowStatus,
    });
  }
  rows.sort((left, right) => right.fromDate.localeCompare(left.fromDate));
  return { rows: rows.slice(0, 5), openCount: rows.length };
}

function todayCopy(data: EssDashboardData): string {
  const status = data.todayStatus?.status;
  if (status === 'A' || status === 'UAB') {
    return 'A missing swipe today becomes unauthorised absence unless you request regularisation.';
  }
  if (status === 'P' || status === 'HD') {
    return `You were in at ${formatTime(data.todayStatus?.firstIn ?? null)}. Open the month if a day looks wrong.`;
  }
  if (status === 'L') {
    return 'You are on leave today. Balances below are the ledger — not a guess.';
  }
  return 'Today’s attendance has not been processed yet. Your shift is still the plan for the day.';
}

function PolicyAckBanner({
  pending,
  requiring,
  onRead,
}: {
  pending: PolicyItem[];
  requiring: number;
  onRead: () => void;
}) {
  const first = pending[0];
  if (first === undefined) return null;
  return (
    <Card role="region" aria-label="Policies still to acknowledge">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-xl">
          <StatusBadge tone="warning">needs your read</StatusBadge>
          <h2 className="mt-3 text-2xl font-light text-ink">{ackCopy(pending.length, requiring)}</h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Start with {first.title}. You are not covered on this policy until you acknowledge it.
          </p>
        </div>
        <Button
          variant="primary"
          trailingIcon={<ArrowRight className="size-4" />}
          onClick={onRead}
        >
          Read {first.title}
        </Button>
      </div>
    </Card>
  );
}

function PendingRequestList({ rows, total }: { rows: PendingRow[]; total: number }) {
  if (rows.length === 0 && total === 0) return null;
  return (
    <Card className="h-full">
      <CardHeader
        title="Waiting on a manager"
        subtitle={`${String(total)} request${total === 1 ? '' : 's'} already submitted — leaving now would abandon that work.`}
        action={
          <div className="flex flex-wrap gap-3">
            <Link to="/my/leave" className="text-sm font-semibold text-ink hover:underline">
              My leave
            </Link>
            <Link to="/my/attendance" className="text-sm font-semibold text-ink hover:underline">
              My attendance
            </Link>
          </div>
        }
      />
      {rows.length > 0 ? (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.key}>
              <Link
                to={row.to}
                className="u-press flex items-center justify-between gap-3 rounded-row bg-surface-2 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{row.title}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{row.dates}</p>
                </div>
                <StatusBadge tone="warning">
                  {row.status === 'sent_back' ? 'Sent back' : 'With your manager'}
                </StatusBadge>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-6 text-ink-muted">
          Open leave or attendance to see each request still with a manager.
        </p>
      )}
    </Card>
  );
}

export function EssDashboard({ data }: { data: EssDashboardData }) {
  const navigate = useNavigate();
  const pendingPolicies = useDashboardResource<PolicyItem[]>('/api/policies/pending');
  const catalog = useDashboardResource<PolicyItem[]>('/api/policies');
  const leaveApps = useDashboardResource<LeaveApplication[]>('/api/leave/applications/mine');
  const attReqs = useDashboardResource<AttendanceRequest[]>('/api/attendance/requests/mine');

  const pending = pendingPolicies.data ?? [];
  const requiring = (catalog.data ?? []).filter((policy) => policy.requiresAcknowledgment).length;
  const policyBlocking = pending.length > 0;
  const pendingList = buildPendingRows(
    leaveApps.data,
    attReqs.data,
    Object.fromEntries(data.leaveBalances.map((leave) => [leave.code, leave.name])),
  );
  const pendingTotal = Math.max(data.pendingRequests, pendingList.openCount);

  const totalAvailable = data.leaveBalances.reduce((total, leave) => total + leave.available, 0);
  const needsRegularise =
    data.todayStatus?.status === 'A' || data.todayStatus?.status === 'UAB';
  const pendingIsTheJob = !policyBlocking && !needsRegularise && pendingTotal > 0;
  const attendanceGold = !policyBlocking && (needsRegularise || !pendingIsTheJob);
  const statusWords = attendanceLabel(data.todayStatus?.status);
  const attendanceLabelText = needsRegularise ? 'Request regularisation' : 'Open my attendance';
  const kpiPills = [
    {
      label: 'Leave available',
      value: totalAvailable,
      suffix: ' days',
      state: 'filled' as const,
      precision: totalAvailable % 1 === 0 ? 0 : 1,
      icon: <Palmtree />,
      to: '/my/leave',
    },
    {
      label: 'Pending requests',
      value: pendingTotal,
      state: pendingIsTheJob ? ('accent' as const) : pendingTotal > 0 ? ('hatched' as const) : ('outline' as const),
      icon: <FileClock />,
      to: '/my/leave',
    },
    ...(policyBlocking
      ? [
          {
            label: 'Policies to read',
            value: pending.length,
            state: 'hatched' as const,
            icon: <BookOpen />,
            to: '/policies',
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <PageHeader
          tone="greeting"
          eyebrow={todayLongIST()}
          title={`Hello ${data.greetingName}`}
          actions={
            data.shift ? (
              <Pill>
                {data.shift.name} · {data.shift.startTime}–{data.shift.endTime}
              </Pill>
            ) : undefined
          }
        />
        <KpiPillRow pills={kpiPills} />
      </div>

      {policyBlocking && (
        <PolicyAckBanner
          pending={pending}
          requiring={requiring}
          onRead={() => {
            void navigate('/policies');
          }}
        />
      )}

      <div className="grid items-stretch gap-6 lg:grid-cols-12">
        <EssTodayRail data={data} statusWords={statusWords} />

        <div className="lg:col-span-5">
          {pendingTotal > 0 ? (
            <PendingRequestList rows={pendingList.rows} total={pendingTotal} />
          ) : (
            <Card className="h-full">
              <CardHeader
                title="This month’s pay"
                subtitle="Opens the payslip when payroll has run. Nothing invented in the meantime."
                action={
                  <Link to="/my/pay" className="text-sm font-medium text-ink hover:underline">
                    Open
                  </Link>
                }
              />
              <p className="text-sm leading-6 text-ink-muted">
                Net pay, deductions and the PDF live on My Pay once the run is finalized.
              </p>
            </Card>
          )}
        </div>

        <DarkCard className="flex flex-col justify-between lg:col-span-4">
          <div>
            <p className="text-xs font-medium text-hero-muted">Attendance</p>
            <h2 className="mt-3 font-serif text-4xl font-light">{statusWords}</h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-hero-muted">{todayCopy(data)}</p>
          </div>
          {attendanceGold ? (
            <Button
              className="mt-8 self-start"
              variant="primary"
              trailingIcon={<ArrowRight className="size-4" />}
              onClick={() => {
                void navigate('/my/attendance');
              }}
            >
              {attendanceLabelText}
            </Button>
          ) : (
            <Link to="/my/attendance" className={CREAM}>
              {attendanceLabelText} <ArrowRight className="size-4" />
            </Link>
          )}
        </DarkCard>

        <div className="lg:col-span-12">
          <Card className="h-full">
            <CardHeader
              title="Leave balances"
              subtitle="Ledger-derived available days by type — already yours before you apply."
              action={
                <div className="flex flex-wrap gap-3">
                  <Link to="/my/pay" className="text-sm font-medium text-ink hover:underline">
                    This month’s pay
                  </Link>
                  <Link to="/my/leave" className="text-sm font-medium text-ink hover:underline">
                    Apply for a day off
                  </Link>
                </div>
              }
            />
            {data.leaveBalances.length === 0 ? (
              <EmptyState
                icon={<Palmtree />}
                title="No leave balances yet"
                description="Balances appear here after the applicable leave policy is assigned."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.leaveBalances.map((leave) => (
                  <div key={leave.leaveTypeId} className="rounded-tile bg-surface-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{leave.name}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">{leave.code}</p>
                      </div>
                      <Pill>{leave.isPaid ? 'Paid' : 'Unpaid'}</Pill>
                    </div>
                    <p className="mt-6 font-serif text-3xl font-light tabular-nums text-ink">
                      {leave.available.toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-ink-muted">days available</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
