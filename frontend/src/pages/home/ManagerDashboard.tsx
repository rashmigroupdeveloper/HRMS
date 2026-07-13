import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { todayLongIST } from '../../lib/date';
import {
  Card,
  CardHeader,
  DarkCard,
  DotMatrix,
  EmptyState,
  KpiPillRow,
  Pill,
  StatusBadge,
} from '../../ui';
import type { TeamMemberMonth } from './dashboard-types';
import { attendanceDot, attendanceLabel, formatTime } from './dashboard-format';

export function ManagerDashboard({ data, today }: { data: TeamMemberMonth[]; today: string }) {
  const todayRows = data.map((member) => ({ member, day: member.days[today] }));
  const present = todayRows.filter(({ day }) => day?.status === 'P' || day?.status === 'HD').length;
  const absent = todayRows.filter(({ day }) => day?.status === 'A' || day?.status === 'UAB').length;
  const onLeave = todayRows.filter(({ day }) => day?.status === 'L').length;
  const awaiting = todayRows.filter(({ day }) => day === undefined).length;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-muted">{todayLongIST()}</p>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight text-ink">
          Your team today
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Direct-report attendance from the current processed month.
        </p>
      </header>

      <KpiPillRow
        pills={[
          { label: 'Team members', value: data.length, state: 'filled', icon: <Users /> },
          { label: 'Present today', value: present, state: 'outline', icon: <CheckCircle2 /> },
          {
            label: 'Absent / UAB',
            value: absent,
            state: absent > 0 ? 'accent' : 'outline',
            icon: <AlertTriangle />,
          },
          { label: 'Awaiting record', value: awaiting, state: 'hatched', icon: <Clock3 /> },
        ]}
      />

      <DarkCard className="grid gap-8 md:grid-cols-[1.25fr_1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hero-muted">
            Team attendance
          </p>
          <h2 className="mt-3 text-4xl font-light">
            {data.length === 0
              ? 'No direct reports'
              : `${String(present)} of ${String(data.length)} present`}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-hero-muted">
            Open the month grid for day-level first-in, last-out and attendance status. Subtree
            scope remains available to senior managers.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/my/team"
              className="u-press inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink"
            >
              Open team month grid <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/approvals"
              className="u-press inline-flex items-center rounded-full bg-[color-mix(in_srgb,var(--surface)_12%,transparent)] px-5 py-2.5 text-sm font-semibold text-hero-ink"
            >
              Review approvals
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 self-end">
          <div className="rounded-tile bg-[color-mix(in_srgb,var(--surface)_9%,transparent)] p-4">
            <p className="text-xs text-hero-muted">On leave</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{onLeave}</p>
          </div>
          <div className="rounded-tile bg-[color-mix(in_srgb,var(--surface)_9%,transparent)] p-4">
            <p className="text-xs text-hero-muted">Needs attention</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{absent + awaiting}</p>
          </div>
        </div>
      </DarkCard>

      <Card>
        <CardHeader title="Team pulse" subtitle="Today’s processed attendance by employee" />
        {data.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title="No team members in scope"
            description="Direct reports appear here after the reporting relationship becomes effective."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {todayRows.map(({ member, day }) => (
              <div
                key={member.employeeId}
                className="rounded-tile bg-surface-2 p-4 transition-colors hover:bg-accent-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{member.name}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">{member.ecode}</p>
                  </div>
                  <StatusBadge
                    tone={
                      day?.status === 'P'
                        ? 'positive'
                        : day?.status === 'A' || day?.status === 'UAB'
                          ? 'negative'
                          : 'neutral'
                    }
                  >
                    {attendanceLabel(day?.status)}
                  </StatusBadge>
                </div>
                <div className="mt-4 flex items-end justify-between gap-4">
                  <div className="text-xs leading-5 text-ink-muted">
                    <p>
                      In:{' '}
                      <span className="tabular-nums text-ink">
                        {formatTime(day?.firstIn ?? null)}
                      </span>
                    </p>
                    <p>
                      Out:{' '}
                      <span className="tabular-nums text-ink">
                        {formatTime(day?.lastOut ?? null)}
                      </span>
                    </p>
                  </div>
                  <DotMatrix
                    size="sm"
                    columns={7}
                    dots={Object.entries(member.days)
                      .slice(-14)
                      .map(([date, value]) => ({
                        key: date,
                        state: attendanceDot(value.status),
                        title: `${date}: ${attendanceLabel(value.status)}`,
                      }))}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Pill>Present {present}</Pill>
          <Pill>Leave {onLeave}</Pill>
          <Pill accent={absent > 0}>Absent / UAB {absent}</Pill>
        </div>
      </Card>
    </div>
  );
}
