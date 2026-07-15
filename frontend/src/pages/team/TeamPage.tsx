import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import type { SessionUser } from '../../lib/session';
import { hasPermission, hasRole } from '../../lib/session';
import { Button, Card, IconButton, EmptyState, StatusBadge, Switch } from '../../ui';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { currentMonthIST, formatTime } from '../home/dashboard-format';
import type { TeamMemberMonth } from '../home/dashboard-types';
import { useDashboardResource } from '../home/useDashboardResource';
import { RosterEditorDrawer } from './RosterEditorDrawer';

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

function statusStyle(status: string | undefined): string {
  if (status === 'P') return 'bg-positive text-surface';
  if (status === 'A' || status === 'UAB') return 'bg-negative text-surface';
  if (status === 'L') return 'bg-info text-surface';
  if (status === 'H' || status === 'WO') return 'u-hatch bg-surface-2 text-ink-muted';
  return 'bg-surface-2 text-ink-faint';
}

export function TeamPage({ user }: { user: SessionUser }) {
  const [month, setMonth] = useState(() => currentMonthIST());
  const [subtree, setSubtree] = useState(() => hasRole(user, 'senior_manager'));
  const [rosterFor, setRosterFor] = useState<{ employeeId: number; name: string; ecode: string } | null>(null);
  const query = new URLSearchParams({ month, subtree: String(subtree) });
  const resource = useDashboardResource<TeamMemberMonth[]>(`/api/my/team/grid?${query.toString()}`);
  const days = useMemo(() => monthDays(month), [month]);
  const canRoster = hasPermission(user, 'attendance.roster.write');

  if (resource.loading) return <DashboardSkeleton />;
  if (resource.error) return <DashboardError message={resource.error} onRetry={resource.reload} />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">Manager workspace</p>
          <h1 className="mt-1 font-serif text-4xl font-light tracking-tight text-ink">
            Team month grid
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Hover any recorded day for first-in and last-out evidence.
          </p>
        </div>
        {hasRole(user, 'senior_manager') && (
          <Switch
            label="Entire reporting subtree"
            checked={subtree}
            onChange={(event) => {
              setSubtree(event.currentTarget.checked);
            }}
          />
        )}
      </header>

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h2 className="text-base font-semibold text-ink">{month}</h2>
            <p className="text-xs text-ink-muted">
              {resource.data?.length ?? 0} employees in scope
            </p>
          </div>
          <div className="flex items-center gap-1">
            <IconButton
              label="Previous month"
              icon={<ChevronLeft />}
              size="sm"
              onClick={() => {
                setMonth(moveMonth(month, -1));
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setMonth(currentMonthIST());
              }}
            >
              This month
            </Button>
            <IconButton
              label="Next month"
              icon={<ChevronRight />}
              size="sm"
              onClick={() => {
                setMonth(moveMonth(month, 1));
              }}
            />
          </div>
        </div>
        {resource.data?.length ? (
          <div className="overflow-auto border-t border-line/60">
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
                    {canRoster ? (
                      <button
                        type="button"
                        className="u-press block w-full text-left"
                        title="Edit this employee's roster"
                        onClick={() => {
                          setRosterFor({ employeeId: member.employeeId, name: member.name, ecode: member.ecode });
                        }}
                      >
                        <p className="truncate text-sm font-semibold text-ink underline-offset-2 hover:underline">
                          {member.name}
                        </p>
                        <p className="text-xs text-ink-muted">{member.ecode}</p>
                      </button>
                    ) : (
                      <>
                        <p className="truncate text-sm font-semibold text-ink">{member.name}</p>
                        <p className="text-xs text-ink-muted">{member.ecode}</p>
                      </>
                    )}
                  </div>
                  {days.map((date) => {
                    const day = member.days[date];
                    return (
                      <div key={date} className="grid place-items-center">
                        <span
                          title={
                            day
                              ? `${date} · In ${formatTime(day.firstIn)} · Out ${formatTime(day.lastOut)}`
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

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone="positive">P Present</StatusBadge>
        <StatusBadge tone="negative">A / UAB absent</StatusBadge>
        <StatusBadge tone="info">L Leave</StatusBadge>
        <StatusBadge tone="neutral">WO / H non-working</StatusBadge>
        {canRoster && (
          <span className="text-xs text-ink-muted">· Click an employee’s name to edit their roster (ATT-04)</span>
        )}
      </div>

      <RosterEditorDrawer
        open={rosterFor !== null}
        onClose={() => {
          setRosterFor(null);
        }}
        onSaved={resource.reload}
        employee={rosterFor}
        month={month}
      />
    </div>
  );
}
