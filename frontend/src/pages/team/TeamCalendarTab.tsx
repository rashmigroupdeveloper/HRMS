/**
 * Team leave planner — month grid with roster, leave, blackouts (SHF-08).
 */
import { useEffect, useMemo, useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { Card, EmptyState, StatusBadge, todayISOIST } from '../../ui';
import { DashboardSkeleton } from '../home/DashboardFeedback';
import { monthDays } from './team-month';

interface CalendarDay {
  shiftCode: string | null;
  weekOff: boolean;
  leave: boolean;
  leavePending: boolean;
  blackout: string | null;
}

interface CalendarMember {
  employeeId: number;
  ecode: string;
  name: string;
  days: Record<string, CalendarDay>;
}

function cellLabel(day: CalendarDay | undefined, holiday: string | undefined): string {
  if (holiday && !day?.leave && !day?.blackout) return 'H';
  if (!day) return '·';
  if (day.blackout) return 'X';
  if (day.leave) return day.leavePending ? 'Lp' : 'L';
  if (day.weekOff) return 'WO';
  return day.shiftCode ?? '·';
}

function cellClass(day: CalendarDay | undefined, holiday: string | undefined): string {
  if (day?.blackout) return 'bg-hero text-hero-ink';
  if (day?.leave && day.leavePending) return 'u-hatch bg-surface-2 text-ink';
  if (day?.leave) return 'bg-accent-soft text-accent-ink';
  if (holiday) return 'bg-accent-soft text-accent-ink';
  if (day?.weekOff) return 'u-hatch bg-surface-2 text-ink-muted';
  if (day?.shiftCode) return 'bg-surface-2 text-ink';
  return 'bg-surface-2 text-ink-faint';
}

export function TeamCalendarTab({ month, subtree }: { month: string; subtree: boolean }) {
  const days = useMemo(() => monthDays(month), [month]);
  const [rows, setRows] = useState<CalendarMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [holidays, setHolidays] = useState<ReadonlyMap<string, string>>(new Map());
  const today = todayISOIST();

  useEffect(() => {
    let cancelled = false;
    setError(null);
    void apiFetch<CalendarMember[]>(
      `/api/attendance/team-calendar?month=${month}&subtree=${String(subtree)}`,
    )
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setRows(null);
          setError(cause instanceof Error ? cause.message : 'Calendar could not load.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [month, subtree]);

  useEffect(() => {
    let cancelled = false;
    const year = month.slice(0, 4);
    void apiFetch<{ date: string; name: string }[]>(
      `/api/attendance/config/holidays?year=${year}&mine=true`,
    )
      .then((list) => {
        if (!cancelled) setHolidays(new Map(list.map((row) => [row.date, row.name])));
      })
      .catch(() => {
        if (!cancelled) setHolidays(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  if (error !== null) {
    return (
      <Card>
        <p className="text-sm text-negative" role="alert">
          {error}
        </p>
      </Card>
    );
  }
  if (rows === null) return <DashboardSkeleton />;

  return (
    <Card padded={false}>
      <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3">
        <StatusBadge tone="warning">L leave</StatusBadge>
        <StatusBadge tone="neutral">Lp pending</StatusBadge>
        <StatusBadge tone="warning">H holiday</StatusBadge>
        <StatusBadge tone="neutral">X blackout</StatusBadge>
        <StatusBadge tone="neutral">WO week-off</StatusBadge>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={<CalendarRange />}
          title="Nobody in this scope"
          description="The leave planner follows the same reporting tree as the attendance grid."
        />
      ) : (
        <div className="overflow-auto">
          <div className="min-w-max">
            <div
              className="sticky top-0 z-10 grid bg-surface-2 text-xs text-ink-muted"
              style={{ gridTemplateColumns: `200px repeat(${String(days.length)}, 40px)` }}
            >
              <div className="sticky left-0 z-20 bg-surface-2 px-3 py-2 font-semibold">Employee</div>
              {days.map((date) => (
                <div
                  key={date}
                  className={`grid place-items-center py-2 tabular-nums ${date === today ? 'font-semibold text-accent-ink' : ''}`}
                >
                  {Number(date.slice(-2))}
                </div>
              ))}
            </div>
            {rows.map((member) => (
              <div
                key={member.employeeId}
                className="grid border-t border-line/50"
                style={{ gridTemplateColumns: `200px repeat(${String(days.length)}, 40px)` }}
              >
                <div className="sticky left-0 z-10 bg-surface px-3 py-2">
                  <Link
                    to={`/people/${member.ecode}`}
                    className="block min-w-0 rounded-row outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <p className="truncate text-sm font-semibold text-ink">{member.name}</p>
                    <p className="text-xs text-ink-muted">
                      {member.ecode} · #{String(member.employeeId)}
                    </p>
                  </Link>
                </div>
                {days.map((date) => {
                  const day = member.days[date];
                  const holiday = holidays.get(date);
                  const title = day?.blackout
                    ? `${date} · blackout · ${day.blackout}`
                    : day?.leave
                      ? `${date} · ${day.leavePending ? 'leave pending' : 'on leave'}`
                      : holiday
                        ? `${date} · holiday · ${holiday}`
                        : `${date} · ${cellLabel(day, holiday)}`;
                  return (
                    <div key={date} className="grid place-items-center p-0.5">
                      <span
                        title={title}
                        className={`grid size-7 place-items-center rounded-[8px] text-[10px] font-semibold ${cellClass(day, holiday)}`}
                      >
                        {cellLabel(day, holiday)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
