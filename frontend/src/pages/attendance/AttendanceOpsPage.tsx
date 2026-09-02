import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  FileSpreadsheet,
  RadioTower,
  ScanSearch,
  UserMinus,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SessionUser } from '../../lib/session';
import { hasPermission } from '../../lib/session';
import { Card, DarkCard, EmptyState, KpiNumber, PageHeader, StatusBadge } from '../../ui';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { useDashboardResource } from '../home/useDashboardResource';

interface UnmatchedSwipe {
  employeeNo: string;
  swipes: number;
  firstSeen: string;
  lastSeen: string;
}

const surfaces = [
  {
    to: '/attendance/muster',
    title: 'Muster summary',
    body: 'Snapshot-backed R1 view and Excel export.',
    icon: FileSpreadsheet,
  },
  {
    to: '/attendance/exceptions',
    title: 'Swipe exceptions',
    body: 'Unmatched employee numbers requiring mapping.',
    icon: ScanSearch,
  },
  {
    to: '/attendance/devices',
    title: 'Device health',
    body: 'Kent door contact and delivery watermarks.',
    icon: RadioTower,
  },
  {
    to: '/attendance/month-lock',
    title: 'Month lock',
    body: 'Preconditions and irreversible attendance freeze.',
    icon: CalendarCheck,
  },
  {
    to: '/attendance/absence-cases',
    title: 'Absence cases',
    body: 'Watch → show-cause queue with letters through the chain.',
    icon: UserMinus,
  },
];

export function AttendanceOpsPage({ user }: { user: SessionUser }) {
  const canViewExceptions = hasPermission(user, 'attendance.manual_override');
  return canViewExceptions ? <AttendanceOpsWithQueue /> : <AttendanceOpsContent />;
}

function AttendanceOpsWithQueue() {
  const unmatched = useDashboardResource<UnmatchedSwipe[]>(
    '/api/attendance/exceptions/unmatched?limit=20',
  );
  if (unmatched.loading) return <DashboardSkeleton />;
  if (unmatched.error)
    return <DashboardError message={unmatched.error} onRetry={unmatched.reload} />;
  return <AttendanceOpsContent unmatchedRows={unmatched.data ?? []} />;
}

function AttendanceOpsContent({ unmatchedRows }: { unmatchedRows?: UnmatchedSwipe[] }) {
  const gated = unmatchedRows === undefined;
  const queue = unmatchedRows ?? [];
  const mappingNeeded = !gated && queue.length > 0;
  const goldTo = gated ? '/attendance/muster' : mappingNeeded ? '/attendance/exceptions' : '/attendance/month-lock';
  const goldLabel = gated
    ? 'Open muster'
    : mappingNeeded
      ? 'Map unmatched numbers'
      : 'Run month-lock checklist';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="HR operations · ATT-02 / ATT-15"
        title="Attendance operations"
        description="From biometric completeness to the frozen monthly muster."
      />

      <DarkCard>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hero-muted">
          Operational priority
        </p>
        {gated ? (
          <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-2xl font-light text-hero-ink">Exception mapping is gated</p>
              <p className="mt-1 text-sm text-hero-muted">
                The workspaces stay visible. Mapping ghost employee numbers needs
                attendance.manual_override.
              </p>
            </div>
            <Link
              to={goldTo}
              className="u-press inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink"
            >
              {goldLabel} <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-4xl font-light tabular-nums">
                <KpiNumber value={queue.length} animateOnMount={false} />
              </p>
              <p className="mt-1 text-sm text-hero-muted">
                {mappingNeeded
                  ? 'unmatched employee numbers — attendance will not lock while these sit open'
                  : 'unmatched employee numbers. Queue is clear — the month can move toward lock.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge tone={mappingNeeded ? 'negative' : 'positive'}>
                {mappingNeeded ? 'Mapping required' : 'Queue clear'}
              </StatusBadge>
              <Link
                to={goldTo}
                className="u-press inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink"
              >
                {goldLabel} <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        )}
      </DarkCard>

      <div className="grid gap-4 sm:grid-cols-2">
        {surfaces.map(({ to, title, body, icon: Icon }) => (
          <Link key={to} to={to} className="group">
            <Card interactive className="h-full">
              <div className="grid size-11 place-items-center rounded-full bg-surface-2 text-ink">
                <Icon className="size-5" />
              </div>
              <h2 className="mt-6 text-lg font-semibold text-ink">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-ink-muted">{body}</p>
              <span className="mt-5 inline-block text-sm font-semibold text-ink group-hover:underline">
                Open workspace →
              </span>
            </Card>
          </Link>
        ))}
      </div>

      {gated && (
        <Card>
          <EmptyState
            icon={<AlertTriangle />}
            title="Exception details are permission-gated"
            description="Ask a colleague with attendance.manual_override to map unmatched numbers before month lock."
          />
        </Card>
      )}
    </div>
  );
}
