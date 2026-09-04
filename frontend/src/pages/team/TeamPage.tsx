/**
 * Manager team workspace — month attendance grid + roster editor (ATT-04, P1-T42)
 * self-approval of team attendance (ATT-12, P1-T07), calendar (SHF-08).
 */
import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import type { SessionUser } from '../../lib/session';
import { hasPermission, hasRole } from '../../lib/session';
import {
  Button,
  Card,
  CardHeader,
  DarkCard,
  EmptyState,
  formatDateIN,
  IconButton,
  PageHeader,
  StatusBadge,
  Switch,
  toast,
  todayISOIST,
} from '../../ui';
import { DashboardError, DashboardSkeleton, UnlinkedEmployee } from '../home/DashboardFeedback';
import { CompanySelect } from '../_shared/CompanySelect';
import { attendanceLabel, currentMonthIST, formatTime } from '../home/dashboard-format';
import type { TeamMemberMonth } from '../home/dashboard-types';
import { useDashboardResource } from '../home/useDashboardResource';
import { defaultCompanyId, rememberCompanyId } from '../reports/report-utils';
import { TeamCalendarTab } from './TeamCalendarTab';
import { TeamRosterEditor } from './TeamRosterEditor';
import { istWeekDates, monthDays, monthTitle, moveMonth } from './team-month';

type TeamTab = 'attendance' | 'roster' | 'calendar';

function MonthNav({ month, onMonth }: { month: string; onMonth: (next: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <IconButton
        label="Previous month"
        icon={<ChevronLeft />}
        size="sm"
        onClick={() => {
          onMonth(moveMonth(month, -1));
        }}
      />
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          onMonth(currentMonthIST());
        }}
      >
        This month
      </Button>
      <IconButton
        label="Next month"
        icon={<ChevronRight />}
        size="sm"
        onClick={() => {
          onMonth(moveMonth(month, 1));
        }}
      />
    </div>
  );
}

function OnLeaveThisWeekStrip({
  members,
  month,
}: {
  members: TeamMemberMonth[];
  month: string;
}) {
  if (members.length === 0) return null;
  const week = istWeekDates(todayISOIST());
  const monday = week[0];
  const sunday = week[6];
  if (!monday || !sunday || !week.some((iso) => iso.startsWith(month))) return null;
  const rows = members
    .map((member) => ({
      member,
      dates: week.filter((iso) => member.days[iso]?.status === 'L'),
    }))
    .filter((row) => row.dates.length > 0);

  return (
    <Card>
      <CardHeader
        title="On leave this week"
        subtitle={`${formatDateIN(monday)} – ${formatDateIN(sunday)}`}
      />
      {rows.length === 0 ? (
        <p className="text-sm leading-6 text-ink-muted">
          Nobody on your team is on leave this week
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ member, dates }) => (
            <li
              key={member.employeeId}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
            >
              <Link
                to={`/people/${member.ecode}`}
                className="min-w-0 rounded-row text-sm font-semibold text-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent"
              >
                {member.name}
              </Link>
              <p className="text-xs tabular-nums text-ink-muted">
                {dates.map((iso) => formatDateIN(iso)).join(' · ')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function statusStyle(status: string | undefined): string {
  if (status === 'P') return 'bg-positive text-surface';
  if (status === 'A' || status === 'UAB') return 'bg-negative text-surface';
  if (status === 'L') return 'bg-info text-surface';
  if (status === 'H' || status === 'WO') return 'u-hatch bg-surface-2 text-ink-muted';
  return 'bg-surface-2 text-ink-faint';
}

function EmployeeLink({ ecode, name }: { ecode: string; name: string }) {
  return (
    <Link
      to={`/people/${ecode}`}
      className="block min-w-0 rounded-row outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <p className="truncate text-sm font-semibold text-ink">{name}</p>
      <p className="text-xs text-ink-muted">{ecode}</p>
    </Link>
  );
}

export function TeamPage({ user }: { user: SessionUser }) {
  const [month, setMonth] = useState(() => currentMonthIST());
  const [subtree, setSubtree] = useState(() => hasRole(user, 'senior_manager'));
  const [tab, setTab] = useState<TeamTab>('attendance');
  const [companyId, setCompanyId] = useState(() => defaultCompanyId());
  const [approving, setApproving] = useState(false);

  const query = new URLSearchParams({ month, subtree: String(subtree) });
  const linked = user.employeeId !== null;
  const resource = useDashboardResource<TeamMemberMonth[]>(
    `/api/my/team/grid?${query.toString()}`,
    linked,
  );
  const days = useMemo(() => monthDays(month), [month]);
  const canRoster = hasPermission(user, 'attendance.roster.write');
  const canOt = hasPermission(user, 'ot.approve');
  const canCalendar = hasPermission(user, 'attendance.team.read');

  const approveMonth = async () => {
    if (!/^\d+$/.test(companyId)) {
      toast.error('Select the legal entity to approve');
      return;
    }
    rememberCompanyId(companyId);
    setApproving(true);
    try {
      await apiFetch('/api/attendance/manager-approvals', {
        method: 'POST',
        body: JSON.stringify({ companyId: Number(companyId), month }),
      });
      toast.success('Team attendance approved', {
        description: `${monthTitle(month)} · selected legal entity`,
      });
    } catch (cause) {
      toast.error('Approval failed', {
        description: cause instanceof Error ? cause.message : 'Try again.',
      });
    } finally {
      setApproving(false);
    }
  };

  if (!linked) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My team"
          description="Direct-report attendance for the month. This login is not linked to an employee record."
        />
        <UnlinkedEmployee />
      </div>
    );
  }

  if (resource.loading && tab === 'attendance') return <DashboardSkeleton />;
  if (resource.error && tab === 'attendance') {
    return <DashboardError message={resource.error} onRetry={resource.reload} />;
  }

  const teamCount = resource.data?.length ?? 0;
  const canSignOff = /^\d+$/.test(companyId);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          tab === 'roster'
            ? 'Manager workspace · SHF-03/05'
            : tab === 'calendar'
              ? 'Manager workspace · SHF-08'
              : 'Manager workspace · ATT-12'
        }
        title="My team"
        description={
          tab === 'roster'
            ? 'Assign the shifts they will actually work. A save that would break the plant is refused with a name.'
            : tab === 'calendar'
              ? 'Month view of roster, leave and blackouts. Coverage shortfall is a number, not a colour.'
              : 'The grid is what you are signing. Month lock cannot proceed without this sign-off.'
        }
        actions={
          <>
            {hasRole(user, 'senior_manager') && (
              <Switch
                label="Entire reporting subtree"
                checked={subtree}
                onChange={(event) => {
                  setSubtree(event.currentTarget.checked);
                }}
              />
            )}
            <div className="flex rounded-full bg-surface-2 p-1">
              <Button
                size="sm"
                variant={tab === 'attendance' ? 'hero' : 'ghost'}
                onClick={() => {
                  setTab('attendance');
                }}
              >
                Attendance
              </Button>
              {canRoster && (
                <Button
                  size="sm"
                  variant={tab === 'roster' ? 'hero' : 'ghost'}
                  onClick={() => {
                    setTab('roster');
                  }}
                >
                  Roster
                </Button>
              )}
              {canCalendar && (
                <Button
                  size="sm"
                  variant={tab === 'calendar' ? 'hero' : 'ghost'}
                  onClick={() => {
                    setTab('calendar');
                  }}
                >
                  Calendar
                </Button>
              )}
            </div>
            {canOt && (
              <Link
                to="/my/team/overtime"
                className="text-sm font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline"
              >
                Overtime queue
              </Link>
            )}
          </>
        }
      />

      {tab === 'attendance' ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <DarkCard>
            <p className="text-sm text-hero-muted">{String(teamCount)} people on this grid</p>
            <h2 className="mt-2 text-3xl font-light tracking-tight">{monthTitle(month)}</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-hero-muted">
              Payroll month-lock waits on your sign-off. You are confirming every processed day
              below — not editing statuses (ATT-17).
            </p>
          </DarkCard>

          <Card className="lg:sticky lg:top-24">
            <MonthNav month={month} onMonth={setMonth} />
            <div className="mt-4">
              <CompanySelect
                value={companyId}
                hint={
                  canSignOff
                    ? 'Last used legal entity is remembered. This is the entity you are signing for.'
                    : 'Select the legal entity you are signing for.'
                }
                onChange={(value) => {
                  setCompanyId(value);
                }}
              />
            </div>
            <div className="mt-5">
              <Button
                variant="primary"
                loading={approving}
                disabled={!canSignOff}
                leadingIcon={<CheckCircle2 className="size-4" />}
                onClick={() => void approveMonth()}
              >
                Approve {monthTitle(month)}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'attendance' && resource.data ? (
        <OnLeaveThisWeekStrip members={resource.data} month={month} />
      ) : null}

      {tab === 'attendance' ? (
        <Card padded={false}>
          {resource.data?.length ? (
            <div className="overflow-auto">
              <div className="min-w-max">
                <div
                  className="sticky top-0 z-10 grid bg-surface-2 text-xs text-ink-muted"
                  style={{ gridTemplateColumns: `220px repeat(${String(days.length)}, 36px)` }}
                >
                  <div className="sticky left-0 z-20 bg-surface-2 px-4 py-3 font-semibold">
                    Employee
                  </div>
                  {days.map((date) => (
                    <div key={date} className="grid place-items-center py-3 tabular-nums">
                      {Number(date.slice(-2))}
                    </div>
                  ))}
                </div>
                {resource.data.map((member) => (
                  <div
                    key={member.employeeId}
                    className="grid border-t border-line/50 hover:bg-accent-soft"
                    style={{ gridTemplateColumns: `220px repeat(${String(days.length)}, 36px)` }}
                  >
                    <div className="sticky left-0 z-10 bg-surface px-4 py-3">
                      <EmployeeLink ecode={member.ecode} name={member.name} />
                    </div>
                    {days.map((date) => {
                      const day = member.days[date];
                      return (
                        <div key={date} className="grid place-items-center">
                          <span
                            title={
                              day
                                ? `${date} · ${attendanceLabel(day.status)} · In ${formatTime(day.firstIn)} · Out ${formatTime(day.lastOut)}`
                                : `${date} · No processed record`
                            }
                            className={`grid size-7 place-items-center rounded-[8px] text-[10px] font-semibold ${statusStyle(day?.status)}`}
                          >
                            {day?.status ?? '·'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Users />}
              title="No employees in this scope"
              description="Effective reporting relationships determine who appears in this grid."
            />
          )}
        </Card>
      ) : null}

      {tab === 'roster' && canRoster ? (
        <TeamRosterEditor month={month} subtree={subtree} onMonth={setMonth} />
      ) : null}

      {tab === 'calendar' && canCalendar ? (
        <div className="space-y-4">
          <Card rail>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-ink">{monthTitle(month)}</h2>
                <p className="text-xs text-ink-muted">Leave planner · roster + blackouts</p>
              </div>
              <MonthNav month={month} onMonth={setMonth} />
            </div>
          </Card>
          <TeamCalendarTab month={month} subtree={subtree} />
        </div>
      ) : null}

      {tab === 'attendance' && (
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="positive">P Present</StatusBadge>
          <StatusBadge tone="negative">A / UAB absent</StatusBadge>
          <StatusBadge tone="info">L Leave</StatusBadge>
          <StatusBadge tone="neutral">WO week-off</StatusBadge>
        </div>
      )}
    </div>
  );
}
