import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { todayLongIST } from '../../lib/date';
import {
  Card,
  CardHeader,
  DarkCard,
  DotMatrix,
  EmptyState,
  formatDateIN,
  KpiPillRow,
  PageHeader,
  StatusBadge,
} from '../../ui';
import type { TeamMemberMonth } from './dashboard-types';
import { attendanceDot, attendanceLabel, formatTime } from './dashboard-format';

const GOLD =
  'u-press inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink';
const CREAM =
  'u-press inline-flex items-center rounded-full bg-[color-mix(in_srgb,var(--surface)_12%,transparent)] px-5 py-2.5 text-sm font-semibold text-hero-ink';

/**
 * Monday–Sunday ISO dates for the IST calendar week that contains `today`.
 * `today` is already YYYY-MM-DD in IST; weekday math uses UTC calendar
 * arithmetic so the browser timezone cannot shift the window.
 */
function istWeekDates(today: string): string[] {
  const [year, month, day] = today.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return [];
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(utc.getTime())) return [];
  const monday = new Date(utc);
  monday.setUTCDate(utc.getUTCDate() - ((utc.getUTCDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    return `${String(date.getUTCFullYear())}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  });
}

function membersOnLeaveThisWeek(members: TeamMemberMonth[], week: string[]) {
  return members
    .map((member) => ({
      member,
      dates: week.filter((iso) => member.days[iso]?.status === 'L'),
    }))
    .filter((row) => row.dates.length > 0);
}

export function ManagerDashboard({ data, today }: { data: TeamMemberMonth[]; today: string }) {
  const todayRows = data.map((member) => ({ member, day: member.days[today] }));
  const present = todayRows.filter(({ day }) => day?.status === 'P' || day?.status === 'HD').length;
  const absent = todayRows.filter(({ day }) => day?.status === 'A' || day?.status === 'UAB').length;
  const awaiting = todayRows.filter(({ day }) => day === undefined).length;
  const absentIsTheJob = absent > 0;
  const goldOnCta = !absentIsTheJob;
  const week = istWeekDates(today);
  const onLeaveWeek = membersOnLeaveThisWeek(data, week);
  const weekMonday = week[0];
  const weekSunday = week[6];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <PageHeader
          eyebrow={todayLongIST()}
          title="Your team today"
          description="Direct-report attendance from the current processed month. Names open the person; the gold path opens the month you sign."
        />

        <KpiPillRow
        pills={[
          {
            label: 'Team members',
            value: data.length,
            state: 'filled',
            icon: <Users />,
            to: '/my/team',
          },
          {
            label: 'Present today',
            value: present,
            state: 'outline',
            icon: <CheckCircle2 />,
            to: '/my/team',
          },
          {
            label: 'Absent / UAB',
            value: absent,
            state: absentIsTheJob ? 'accent' : 'outline',
            icon: <AlertTriangle />,
            to: '/my/team',
          },
          {
            label: 'Awaiting record',
            value: awaiting,
            state: awaiting > 0 ? 'hatched' : 'outline',
            icon: <Clock3 />,
            to: '/my/team',
          },
        ]}
      />
      </div>

      <div className="grid items-stretch gap-6 lg:grid-cols-12">
        {weekMonday && weekSunday ? (
          <Card className="lg:col-span-3">
            <CardHeader
              title="On leave this week"
              subtitle={`${formatDateIN(weekMonday)} – ${formatDateIN(weekSunday)}`}
            />
            {onLeaveWeek.length === 0 ? (
              <p className="text-sm leading-6 text-ink-muted">
                Nobody on your team is on leave this week
              </p>
            ) : (
              <ul className="space-y-2">
                {onLeaveWeek.map(({ member, dates }) => (
                  <li
                    key={member.employeeId}
                    className="rounded-tile bg-surface-2 px-4 py-3"
                  >
                    <Link
                      to={`/people/${member.ecode}`}
                      className="min-w-0 rounded-row outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <p className="truncate text-sm font-semibold text-ink">{member.name}</p>
                      <p className="text-xs text-ink-muted">{member.ecode}</p>
                    </Link>
                    <p className="mt-1 text-xs tabular-nums text-ink-muted">
                      {dates.map((iso) => formatDateIN(iso)).join(' · ')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}

        <Card className={weekMonday && weekSunday ? 'lg:col-span-5' : 'lg:col-span-8'}>
          <CardHeader title="Team pulse" subtitle="Today’s processed attendance by employee" />
          {data.length === 0 ? (
            <EmptyState
              icon={<Users />}
              title="No team members in scope"
              description="Direct reports appear here after the reporting relationship becomes effective."
            />
          ) : (
            <div className="grid gap-3">
              {todayRows.map(({ member, day }) => (
                <Link
                  key={member.employeeId}
                  to={`/people/${member.ecode}`}
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
                </Link>
              ))}
            </div>
          )}
        </Card>

        <DarkCard className="flex flex-col justify-between lg:col-span-4">
          <div>
            <p className="text-xs font-medium text-hero-muted">Team attendance</p>
            <h2 className="mt-3 font-serif text-4xl font-light">
              {data.length === 0
                ? 'No direct reports'
                : `${String(present)} of ${String(data.length)} present`}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-hero-muted">
              {absent + awaiting > 0
                ? `${String(absent + awaiting)} people still need a mark or a regularisation before month lock.`
                : 'Everyone in view has a processed mark for today.'}
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/my/team" className={goldOnCta ? GOLD : CREAM}>
              Open team month grid <ArrowRight className="size-4" />
            </Link>
            <Link to="/approvals" className={CREAM}>
              Review approvals
            </Link>
          </div>
        </DarkCard>
      </div>
    </div>
  );
}
