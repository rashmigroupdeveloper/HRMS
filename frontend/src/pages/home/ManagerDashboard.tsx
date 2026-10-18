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
  HeadlineStats,
  StatusStrip,
  CardLink,
  PageHeader,
  StatusBadge,
  QuickLinks,
} from '../../ui';
import type { QuickLink } from '../../ui';
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

export function ManagerDashboard({
  data,
  today,
  quickLinks,
  title = 'Your team today',
}: {
  data: TeamMemberMonth[];
  today: string;
  quickLinks?: QuickLink[] | undefined;
  title?: string;
}) {
  const todayRows = data.map((member) => ({ member, day: member.days[today] }));
  const present = todayRows.filter(({ day }) => day?.status === 'P' || day?.status === 'HD').length;
  const absent = todayRows.filter(({ day }) => day?.status === 'A' || day?.status === 'UAB').length;
  const onLeave = todayRows.filter(({ day }) => day?.status === 'L').length;
  const awaiting = todayRows.filter(({ day }) => day === undefined).length;
  const absentIsTheJob = absent > 0;
  const goldOnCta = !absentIsTheJob;
  const week = istWeekDates(today);
  const onLeaveWeek = membersOnLeaveThisWeek(data, week);
  const weekMonday = week[0];
  const weekSunday = week[6];

  return (
    <div className="u-stagger space-y-6">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <PageHeader
          eyebrow={todayLongIST()}
          title={title}
          description="Direct-report attendance from the current processed month."
        />

        <HeadlineStats
          stats={[
            { label: 'Team members', value: data.length, icon: <Users />, to: '/my/team' },
            { label: 'Present today', value: present, icon: <CheckCircle2 />, to: '/my/team' },
            {
              label: 'Absent / UAB',
              value: absent,
              emphasis: absentIsTheJob,
              icon: <AlertTriangle />,
              to: '/my/team',
            },
            { label: 'Awaiting record', value: awaiting, icon: <Clock3 />, to: '/my/team' },
          ]}
        />
      </div>

      {data.length > 0 ? (
        <StatusStrip
          label="Team attendance today"
          segments={[
            { label: 'Present', value: present, tone: 'dark' },
            { label: 'Absent / UAB', value: absent, tone: absentIsTheJob ? 'gold' : 'outline' },
            { label: 'On leave', value: onLeave, tone: 'outline' },
            { label: 'Awaiting record', value: awaiting, tone: 'hatched' },
          ]}
        />
      ) : null}

      {quickLinks && quickLinks.length > 0 ? <QuickLinks links={quickLinks} /> : null}

      <DarkCard className="grid gap-8 md:grid-cols-[1.25fr_1fr]">
        <div>
          <p className="text-sm font-medium text-hero-muted">
            Team attendance
          </p>
          <h2 className="mt-3 text-4xl font-light">
            {data.length === 0
              ? 'No direct reports'
              : `${String(present)} of ${String(data.length)} present`}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-hero-muted">
            {absent + awaiting > 0
              ? `${String(absent + awaiting)} people still need a mark or a regularisation before month lock.`
              : 'Everyone in view has a processed mark for today.'}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/my/team" className={goldOnCta ? GOLD : CREAM}>
              Open team month grid <ArrowRight className="size-4" />
            </Link>
            <Link to="/approvals" className={CREAM}>
              Review approvals
            </Link>
          </div>
        </div>
        <TeamDotReport members={data} today={today} onLeave={onLeave} attention={absent + awaiting} />
      </DarkCard>

      {data.length > 0 && weekMonday && weekSunday && (
        <Card>
          <CardHeader
            title="On leave this week"
            subtitle={`${formatDateIN(weekMonday)} – ${formatDateIN(weekSunday)} · approved days marked L, not pending requests`}
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
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-tile bg-surface-2 px-4 py-3"
                >
                  <Link
                    to={`/people/${member.ecode}`}
                    className="min-w-0 rounded-row outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <p className="truncate text-sm font-semibold text-ink">{member.name}</p>
                    <p className="text-xs text-ink-muted">{member.ecode}</p>
                  </Link>
                  <p className="text-sm tabular-nums text-ink-muted">
                    {dates.map((iso) => formatDateIN(iso)).join(' · ')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card>
        <CardHeader
          title="Team pulse"
          subtitle="Today’s processed attendance by employee"
          action={data.length > 0 ? <CardLink to="/my/team" label="Open team month grid" /> : undefined}
        />
        {data.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title="No team members in scope"
            description="Direct reports appear here after the reporting relationship becomes effective."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
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
    </div>
  );
}

/** Last `days` processed dates up to today, oldest first. */
function recentDates(members: TeamMemberMonth[], today: string, days: number): string[] {
  const all = new Set<string>();
  for (const m of members) for (const iso of Object.keys(m.days)) if (iso <= today) all.add(iso);
  const seen = [...all].sort().slice(-days);
  if (seen.length > 0) return seen;
  // Nothing processed yet this month: show the last `days` calendar days as
  // empty cells so the report keeps its shape and reads "not processed".
  const [y, mo, d] = today.split('-').map(Number);
  if (y === undefined || mo === undefined || d === undefined) return [];
  return Array.from({ length: days }, (_, k) => {
    const dt = new Date(Date.UTC(y, mo - 1, d - (days - 1 - k)));
    return dt.toISOString().slice(0, 10);
  });
}

/**
 * Crextio-style "attendance report" inside the charcoal hero: one row of
 * dots per person (up to 8) across the last ten processed days.
 */
function TeamDotReport({
  members,
  today,
  onLeave,
  attention,
}: {
  members: TeamMemberMonth[];
  today: string;
  onLeave: number;
  attention: number;
}) {
  const dates = recentDates(members, today, 10);
  const rows = members.slice(0, 8);
  return (
    <div className="flex flex-col justify-end gap-4 self-end">
      <div className="flex items-end gap-6">
        <p className="flex items-baseline gap-2">
          <span className="text-4xl font-light tabular-nums">{onLeave}</span>
          <span className="text-xs text-hero-muted">on leave</span>
        </p>
        <p className="flex items-baseline gap-2">
          <span className="text-4xl font-light tabular-nums">{attention}</span>
          <span className="text-xs text-hero-muted">need attention</span>
        </p>
      </div>
      {rows.length > 0 && dates.length > 0 ? (
        <div className="rounded-tile bg-[color-mix(in_srgb,var(--surface)_6%,transparent)] p-4">
          <DotMatrix
            tone="dark"
            animate
            columns={dates.length}
            label={`Last ${String(dates.length)} processed days for ${String(rows.length)} team members`}
            dots={rows.flatMap((m) =>
              dates.map((iso) => {
                const status = m.days[iso]?.status;
                return {
                  key: `${String(m.employeeId)}-${iso}`,
                  state: attendanceDot(status),
                  title: `${m.name}, ${formatDateIN(iso)}: ${attendanceLabel(status)}`,
                };
              }),
            )}
          />
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-hero-muted">
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-accent" aria-hidden />Present</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[color-mix(in_srgb,var(--hero-ink)_70%,transparent)]" aria-hidden />Leave</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[color-mix(in_srgb,var(--negative)_80%,var(--hero))]" aria-hidden />Absent</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
