import { ArrowRight, CalendarDays, Clock3, FileClock, Palmtree } from 'lucide-react';
import { Link } from 'react-router-dom';
import { todayLongIST } from '../../lib/date';
import { Card, CardHeader, DarkCard, EmptyState, KpiPillRow, Pill, StatusBadge } from '../../ui';
import type { EssDashboardData } from './dashboard-types';
import { attendanceLabel, formatTime } from './dashboard-format';

function statusTone(status: string | undefined) {
  if (status === 'P') return 'positive' as const;
  if (status === 'A' || status === 'UAB') return 'negative' as const;
  if (status === 'HD' || status === 'L') return 'warning' as const;
  return 'neutral' as const;
}

export function EssDashboard({ data }: { data: EssDashboardData }) {
  const totalAvailable = data.leaveBalances.reduce((total, leave) => total + leave.available, 0);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-muted">{todayLongIST()}</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-4xl font-light tracking-tight text-ink">
              Hello {data.greetingName}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {data.ecode} · Here is what needs your attention today.
            </p>
          </div>
          {data.shift && (
            <Pill icon={<Clock3 />}>
              {data.shift.name} · {data.shift.startTime}–{data.shift.endTime}
            </Pill>
          )}
        </div>
      </header>

      <KpiPillRow
        pills={[
          {
            label: 'Shift starts',
            value: Number(data.shift?.startTime.split(':')[0] ?? 0),
            suffix: data.shift ? `:${data.shift.startTime.split(':')[1] ?? '00'}` : ' —',
            state: 'filled',
            icon: <Clock3 />,
          },
          {
            label: 'Leave available',
            value: totalAvailable,
            suffix: ' days',
            state: 'outline',
            precision: totalAvailable % 1 === 0 ? 0 : 1,
            icon: <Palmtree />,
          },
          {
            label: 'Pending requests',
            value: data.pendingRequests,
            state: data.pendingRequests > 0 ? 'accent' : 'outline',
            icon: <FileClock />,
          },
          {
            label: 'Leave types',
            value: data.leaveBalances.length,
            state: 'hatched',
            icon: <CalendarDays />,
          },
        ]}
      />

      <DarkCard className="grid gap-8 md:grid-cols-[1.3fr_1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hero-muted">
            Today’s attendance
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h2 className="text-3xl font-light">{attendanceLabel(data.todayStatus?.status)}</h2>
            <StatusBadge tone={statusTone(data.todayStatus?.status)}>
              {data.todayStatus?.status ?? 'No record'}
            </StatusBadge>
          </div>
          <p className="mt-3 max-w-xl text-sm leading-6 text-hero-muted">
            Attendance is sourced from processed Kent swipes. Open the month view to inspect a day
            or request regularisation.
          </p>
          <Link
            to="/my/attendance"
            className="u-press mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink"
          >
            Open my attendance <ArrowRight className="size-4" />
          </Link>
        </div>
        <dl className="grid grid-cols-2 gap-3 self-end">
          <div className="rounded-tile bg-[color-mix(in_srgb,var(--surface)_9%,transparent)] p-4">
            <dt className="text-xs text-hero-muted">First in</dt>
            <dd className="mt-1 tabular-nums text-xl font-semibold">
              {formatTime(data.todayStatus?.firstIn ?? null)}
            </dd>
          </div>
          <div className="rounded-tile bg-[color-mix(in_srgb,var(--surface)_9%,transparent)] p-4">
            <dt className="text-xs text-hero-muted">Last out</dt>
            <dd className="mt-1 tabular-nums text-xl font-semibold">
              {formatTime(data.todayStatus?.lastOut ?? null)}
            </dd>
          </div>
        </dl>
      </DarkCard>

      <Card>
        <CardHeader
          title="Leave balances"
          subtitle="Ledger-derived available balance by leave type"
          action={
            <Link to="/my/leave" className="text-sm font-semibold text-ink hover:underline">
              View leave
            </Link>
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
                <p className="mt-6 text-3xl font-light tabular-nums text-ink">
                  {leave.available.toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-ink-muted">days available</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
