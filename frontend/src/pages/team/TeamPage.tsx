/**
 * Manager team workspace — month attendance grid + roster editor (ATT-04, P1-T42)
 * and self-approval of team attendance for the month (ATT-12, P1-T07).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarRange, CheckCircle2, ChevronLeft, ChevronRight, Save, Users } from 'lucide-react';
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
  TextField,
  toast,
  todayISOIST,
} from '../../ui';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { attendanceLabel, currentMonthIST, formatTime } from '../home/dashboard-format';
import type { TeamMemberMonth } from '../home/dashboard-types';
import { useDashboardResource } from '../home/useDashboardResource';
import { defaultCompanyId, rememberCompanyId } from '../reports/report-utils';
import {
  getRosterChanges,
  mergeSavedRosterChanges,
  rosterCellKey,
  type RosterCellDraft,
  type RosterDraft,
} from './roster-draft';

function moveMonth(month: string, delta: number): string {
  const [year = 0, number = 1] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, number - 1 + delta, 1));
  return `${String(date.getUTCFullYear())}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthDays(month: string): string[] {
  const [year = 0, number = 1] = month.split('-').map(Number);
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return Array.from(
    { length: count },
    (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`,
  );
}

function monthTitle(month: string): string {
  const [year = 0, number = 1] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, number - 1, 1)));
}

/** Monday–Sunday ISO dates for the IST calendar week containing `today` (YYYY-MM-DD). */
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

interface ShiftOption {
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
}

interface RosterMember {
  employeeId: number;
  ecode: string;
  name: string;
  days: Record<string, { shiftCode: string | null; weekOff: boolean }>;
}

export function TeamPage({ user }: { user: SessionUser }) {
  const [month, setMonth] = useState(() => currentMonthIST());
  const [subtree, setSubtree] = useState(() => hasRole(user, 'senior_manager'));
  const [tab, setTab] = useState<'attendance' | 'roster'>('attendance');
  const [companyId, setCompanyId] = useState(() => defaultCompanyId());
  const [approving, setApproving] = useState(false);

  const query = new URLSearchParams({ month, subtree: String(subtree) });
  const resource = useDashboardResource<TeamMemberMonth[]>(`/api/my/team/grid?${query.toString()}`);
  const days = useMemo(() => monthDays(month), [month]);
  const canRoster = hasPermission(user, 'attendance.roster.write');
  const canOt = hasPermission(user, 'ot.approve');

  // ── Roster editor state ─────────────────────────────────────────────────
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [draft, setDraft] = useState<RosterDraft>({});
  const [rosterBaseline, setRosterBaseline] = useState<RosterDraft>({});
  const [defaultShift, setDefaultShift] = useState('');
  const [rosterLoading, setRosterLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadRoster = useCallback(async () => {
    setRosterLoading(true);
    try {
      const [shiftList, teamRoster] = await Promise.all([
        apiFetch<ShiftOption[]>('/api/attendance/config/shifts/active'),
        apiFetch<RosterMember[]>(
          `/api/attendance/roster?month=${month}&subtree=${String(subtree)}`,
        ),
      ]);
      setShifts(shiftList);
      setRoster(teamRoster);
      setDefaultShift((prev) => (prev !== '' ? prev : (shiftList[0]?.code ?? '')));
      const next: RosterDraft = {};
      for (const member of teamRoster) {
        for (const date of Object.keys(member.days)) {
          const cell = member.days[date];
          if (!cell) continue;
          next[rosterCellKey(member.employeeId, date)] = {
            weekOff: cell.weekOff,
            shiftCode: cell.shiftCode,
          };
        }
      }
      setDraft(next);
      setRosterBaseline(next);
    } catch (cause) {
      toast.error('Roster could not load', {
        description: cause instanceof Error ? cause.message : 'Try again.',
      });
    } finally {
      setRosterLoading(false);
    }
  }, [month, subtree]);

  useEffect(() => {
    if (tab === 'roster') void loadRoster();
  }, [tab, loadRoster]);

  const getCell = (employeeId: number, date: string): RosterCellDraft => {
    const key = rosterCellKey(employeeId, date);
    return draft[key] ?? { weekOff: false, shiftCode: null };
  };

  const setCell = (employeeId: number, date: string, value: RosterCellDraft) => {
    setDraft((prev) => ({ ...prev, [rosterCellKey(employeeId, date)]: value }));
  };

  const fillWeekOffsSunday = () => {
    if (!roster.length) return;
    setDraft((prev) => {
      const next = { ...prev };
      for (const member of roster) {
        for (const date of days) {
          const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
          if (dow === 0) {
            next[rosterCellKey(member.employeeId, date)] = {
              weekOff: true,
              shiftCode: null,
            };
          }
        }
      }
      return next;
    });
    toast.success('Sundays marked week-off in draft');
  };

  const fillDefaultShiftWeekdays = () => {
    if (!defaultShift) {
      toast.error('Pick a default shift first');
      return;
    }
    setDraft((prev) => {
      const next = { ...prev };
      for (const member of roster) {
        for (const date of days) {
          const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
          if (dow !== 0) {
            next[rosterCellKey(member.employeeId, date)] = {
              weekOff: false,
              shiftCode: defaultShift,
            };
          }
        }
      }
      return next;
    });
    toast.success(`Weekdays set to ${defaultShift} in draft`);
  };

  const rosterChanges = useMemo(
    () => getRosterChanges(draft, rosterBaseline),
    [draft, rosterBaseline],
  );

  const saveRoster = async () => {
    const entries = rosterChanges;
    if (entries.length === 0) {
      toast.error('Nothing to save', { description: 'Edit cells or use bulk fill first.' });
      return;
    }
    setSaving(true);
    try {
      const chunks = Array.from(
        { length: Math.ceil(entries.length / 500) },
        (_, index) => entries.slice(index * 500, index * 500 + 500),
      );
      let total = 0;
      for (const chunk of chunks) {
        const result = await apiFetch<{ upserted: number }>('/api/attendance/roster', {
          method: 'PUT',
          body: JSON.stringify({ entries: chunk }),
        });
        total += result.upserted;
        setRosterBaseline((current) => mergeSavedRosterChanges(current, chunk));
      }
      toast.success('Roster saved', { description: `${String(total)} day(s) updated` });
      await loadRoster();
    } catch (cause) {
      toast.error('Roster save failed', {
        description:
          cause instanceof Error
            ? `${cause.message} Saved batches are retained; retry to continue.`
            : 'Saved batches are retained; retry to continue.',
      });
    } finally {
      setSaving(false);
    }
  };

  const approveMonth = async () => {
    if (!/^\d+$/.test(companyId)) {
      toast.error('Enter company ID to approve against');
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
        description: `${monthTitle(month)} · company ${companyId}`,
      });
    } catch (cause) {
      toast.error('Approval failed', {
        description: cause instanceof Error ? cause.message : 'Try again.',
      });
    } finally {
      setApproving(false);
    }
  };

  if (resource.loading && tab === 'attendance') return <DashboardSkeleton />;
  if (resource.error && tab === 'attendance') {
    return <DashboardError message={resource.error} onRetry={resource.reload} />;
  }

  const teamCount = tab === 'attendance' ? (resource.data?.length ?? 0) : roster.length;
  const canSignOff = /^\d+$/.test(companyId);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={tab === 'roster' ? 'Manager workspace · ATT-04' : 'Manager workspace · ATT-12'}
        title="My team"
        description={
          tab === 'roster'
            ? 'Assign the shifts they will actually work. Saves recompute dirty days.'
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
            <h2 className="mt-2 text-3xl font-light tracking-tight">
              {monthTitle(month)}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-hero-muted">
              Payroll month-lock waits on your sign-off. You are confirming every processed day
              below — not editing statuses (ATT-17).
            </p>
          </DarkCard>

          <Card className="lg:sticky lg:top-24">
            <MonthNav month={month} onMonth={setMonth} />
            <div className="mt-4">
              <TextField
                label="Company ID"
                value={companyId}
                hint={
                  canSignOff
                    ? 'Last used company is remembered. This is the entity you are signing for.'
                    : 'Enter the company you are signing for — never defaults to 0.'
                }
                onChange={(event) => {
                  setCompanyId(event.currentTarget.value);
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
      ) : (
        <Card rail>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-ink">{monthTitle(month)}</h2>
              <p className="text-xs text-ink-muted">
                {String(roster.length)} employees · shift assignments
              </p>
            </div>
            <MonthNav month={month} onMonth={setMonth} />
          </div>
        </Card>
      )}

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
      ) : (
        <Card>
          <CardHeader
            title="Roster editor"
            subtitle="Bulk-assign shifts and week-offs · writes recompute dirty days (ATT-04)"
            action={
              <Button
                size="sm"
                variant="primary"
                loading={saving}
                disabled={rosterChanges.length === 0}
                leadingIcon={<Save className="size-4" />}
                onClick={() => void saveRoster()}
              >
                Save roster{rosterChanges.length > 0 ? ` (${String(rosterChanges.length)})` : ''}
              </Button>
            }
          />
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="text-sm text-ink">
              <span className="mb-1 block text-xs font-semibold text-ink-muted">Default shift</span>
              <select
                className="rounded-row border border-line bg-surface px-3 py-2 text-sm"
                value={defaultShift}
                onChange={(e) => {
                  setDefaultShift(e.currentTarget.value);
                }}
              >
                {shifts.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} · {s.name} ({s.startTime}–{s.endTime})
                  </option>
                ))}
              </select>
            </label>
            <Button size="sm" variant="secondary" onClick={fillDefaultShiftWeekdays}>
              Fill weekdays
            </Button>
            <Button size="sm" variant="secondary" onClick={fillWeekOffsSunday}>
              Sundays → week-off
            </Button>
            <Button size="sm" variant="ghost" loading={rosterLoading} onClick={() => void loadRoster()}>
              Reload
            </Button>
          </div>

          {rosterLoading ? (
            <DashboardSkeleton />
          ) : roster.length === 0 ? (
            <EmptyState
              icon={<CalendarRange />}
              title="No team members"
              description="Assign reporting relationships, then reload."
            />
          ) : (
            <div className="overflow-auto">
              <div className="min-w-max">
                <div
                  className="sticky top-0 z-10 grid bg-surface-2 text-xs text-ink-muted"
                  style={{ gridTemplateColumns: `200px repeat(${String(days.length)}, 72px)` }}
                >
                  <div className="sticky left-0 z-20 bg-surface-2 px-3 py-2 font-semibold">
                    Employee
                  </div>
                  {days.map((date) => (
                    <div key={date} className="grid place-items-center py-2 tabular-nums">
                      {Number(date.slice(-2))}
                    </div>
                  ))}
                </div>
                {roster.map((member) => (
                  <div
                    key={member.employeeId}
                    className="grid border-t border-line/50"
                    style={{ gridTemplateColumns: `200px repeat(${String(days.length)}, 72px)` }}
                  >
                    <div className="sticky left-0 z-10 bg-surface px-3 py-2">
                      <EmployeeLink ecode={member.ecode} name={member.name} />
                    </div>
                    {days.map((date) => {
                      const cell = getCell(member.employeeId, date);
                      return (
                        <div key={date} className="grid place-items-center p-1">
                          <select
                            className="w-full rounded-[8px] border border-line bg-surface px-1 py-1 text-[10px]"
                            value={cell.weekOff ? 'WO' : (cell.shiftCode ?? '')}
                            onChange={(e) => {
                              const value = e.currentTarget.value;
                              if (value === 'WO') {
                                setCell(member.employeeId, date, {
                                  weekOff: true,
                                  shiftCode: null,
                                });
                              } else if (value === '') {
                                setCell(member.employeeId, date, {
                                  weekOff: false,
                                  shiftCode: null,
                                });
                              } else {
                                setCell(member.employeeId, date, {
                                  weekOff: false,
                                  shiftCode: value,
                                });
                              }
                            }}
                            aria-label={`Roster ${member.ecode} ${date}`}
                          >
                            <option value="">—</option>
                            <option value="WO">WO</option>
                            {shifts.map((s) => (
                              <option key={s.code} value={s.code}>
                                {s.code}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

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
