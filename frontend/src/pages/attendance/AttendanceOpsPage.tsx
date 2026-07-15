import {
  AlertTriangle,
  CalendarCheck,
  FileSpreadsheet,
  RadioTower,
  ScanSearch,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SessionUser } from '../../lib/session';
import { hasPermission } from '../../lib/session';
import { Card, DarkCard, EmptyState, StatusBadge } from '../../ui';
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
    icon: ScanSearch,
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
  const queue = unmatchedRows ?? [];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-muted">HR operations</p>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight text-ink">
          Attendance operations
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          From biometric completeness to the frozen monthly muster.
        </p>
      </header>
      <DarkCard>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hero-muted">
          Operational priority
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-4xl font-light tabular-nums">{queue.length}</p>
            <p className="mt-1 text-sm text-hero-muted">
              unmatched employee numbers in the current queue
            </p>
          </div>
          <StatusBadge tone={queue.length ? 'negative' : 'positive'}>
            {queue.length ? 'Mapping required' : 'Queue clear'}
          </StatusBadge>
        </div>
      </DarkCard>
      <div className="grid gap-4 sm:grid-cols-2">
        {surfaces.map(({ to, title, body, icon: Icon }) => (
          <Link key={to} to={to} className="group">
            <Card interactive className="h-full">
              <div className="grid size-11 place-items-center rounded-full bg-accent-soft text-accent-ink">
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
      {unmatchedRows === undefined && (
        <Card>
          <EmptyState
            icon={<AlertTriangle />}
            title="Exception details are permission-gated"
            description="The dashboard remains visible, while employee-number mapping requires attendance.manual_override."
          />
        </Card>
      )}
    </div>
  );
}
