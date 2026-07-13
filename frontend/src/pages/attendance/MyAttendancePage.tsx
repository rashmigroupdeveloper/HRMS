import { useMemo, useState } from 'react';
import { CalendarClock, ChevronLeft, ChevronRight, Clock3, FilePlus2 } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  DarkCard,
  EmptyState,
  IconButton,
  MonthCalendar,
  Pill,
  StatusBadge,
} from '../../ui';
import type { AttendanceDay, AttendanceDayState } from '../../ui';
import { currentMonthIST, formatTime } from '../home/dashboard-format';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { useDashboardResource } from '../home/useDashboardResource';
import { AttendanceRequestDrawer } from './AttendanceRequestDrawer';
import type { AttendanceMonthRow, AttendanceRequest, OvertimeEntry } from './attendance-types';

const MONTH_TITLE_IST = new Intl.DateTimeFormat('en-IN', {
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

function stateFor(status: string): AttendanceDayState {
  if (status === 'P') return 'present';
  if (status === 'A' || status === 'UAB') return 'absent';
  if (status === 'L') return 'leave';
  if (status === 'HD') return 'halfday';
  if (status === 'H') return 'holiday';
  return 'weekoff';
}

function shiftMonth(month: string, delta: number): string {
  const [year = 0, value = 1] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, value - 1 + delta, 1));
  return `${String(date.getUTCFullYear())}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function MyAttendancePage() {
  const [month, setMonth] = useState(() => currentMonthIST());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const attendance = useDashboardResource<AttendanceMonthRow[]>(
    `/api/my/attendance?month=${month}`,
  );
  const requests = useDashboardResource<AttendanceRequest[]>('/api/attendance/requests/mine');
  const overtime = useDashboardResource<OvertimeEntry[]>('/api/attendance/ot/mine');
  const selected = attendance.data?.find((row) => row.date === selectedDate) ?? null;
  const [year = 0, monthNo = 1] = month.split('-').map(Number);
  const days = useMemo(() => {
    const value: Partial<Record<number, AttendanceDay>> = {};
    for (const row of attendance.data ?? []) {
      value[Number(row.date.slice(-2))] = {
        state: stateFor(row.status),
        note: `${row.status} · In ${formatTime(row.firstIn)} · Out ${formatTime(row.lastOut)}`,
      };
    }
    return value;
  }, [attendance.data]);

  if (attendance.loading) return <DashboardSkeleton />;
  if (attendance.error)
    return <DashboardError message={attendance.error} onRetry={attendance.reload} />;

  const present = attendance.data?.filter((row) => row.status === 'P').length ?? 0;
  const exceptions =
    attendance.data?.filter((row) => row.status === 'A' || row.status === 'UAB').length ?? 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">Employee self-service</p>
          <h1 className="mt-1 font-serif text-4xl font-light tracking-tight text-ink">
            My attendance
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Processed attendance, swipes and requests in one place.
          </p>
        </div>
        <Button
          variant="primary"
          leadingIcon={<FilePlus2 className="size-4" />}
          onClick={() => {
            setRequestOpen(true);
          }}
        >
          Request correction
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader
            title={MONTH_TITLE_IST.format(new Date(`${month}-01T00:00:00+05:30`))}
            subtitle={`${String(present)} present · ${String(exceptions)} exceptions`}
            action={
              <div className="flex gap-1">
                <IconButton
                  label="Previous month"
                  icon={<ChevronLeft />}
                  size="sm"
                  onClick={() => {
                    setMonth(shiftMonth(month, -1));
                  }}
                />
                <IconButton
                  label="Next month"
                  icon={<ChevronRight />}
                  size="sm"
                  onClick={() => {
                    setMonth(shiftMonth(month, 1));
                  }}
                />
              </div>
            }
          />
          <MonthCalendar year={year} month={monthNo} days={days} onSelectDay={setSelectedDate} />
        </Card>

        <DarkCard>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hero-muted">
            Selected day
          </p>
          {selected ? (
            <div className="mt-4">
              <StatusBadge
                tone={
                  selected.status === 'P'
                    ? 'positive'
                    : selected.status === 'A' || selected.status === 'UAB'
                      ? 'negative'
                      : 'warning'
                }
              >
                {selected.status}
              </StatusBadge>
              <p className="mt-4 text-3xl font-light">{selected.date}</p>
              <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-hero-muted">First in</dt>
                  <dd className="mt-1 tabular-nums">{formatTime(selected.firstIn)}</dd>
                </div>
                <div>
                  <dt className="text-hero-muted">Last out</dt>
                  <dd className="mt-1 tabular-nums">{formatTime(selected.lastOut)}</dd>
                </div>
                <div>
                  <dt className="text-hero-muted">Late</dt>
                  <dd className="mt-1 tabular-nums">{selected.lateMinutes} min</dd>
                </div>
                <div>
                  <dt className="text-hero-muted">Overtime</dt>
                  <dd className="mt-1 tabular-nums">{selected.otMinutes} min</dd>
                </div>
              </dl>
              <Button
                className="mt-6"
                variant="primary"
                onClick={() => {
                  setRequestOpen(true);
                }}
              >
                Regularise this day
              </Button>
            </div>
          ) : (
            <div className="mt-8 text-hero-muted">
              <CalendarClock className="size-8" />
              <p className="mt-3 text-sm">
                Choose a calendar day to inspect its processed swipe record.
              </p>
            </div>
          )}
        </DarkCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="My requests" subtitle="AR, OD and permission workflow state" />
          {requests.data?.length ? (
            <div className="space-y-2">
              {requests.data.slice(0, 6).map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between rounded-row bg-surface-2 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {request.kind} · {request.fromDate}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">{request.reason}</p>
                  </div>
                  <StatusBadge
                    tone={request.workflowStatus === 'approved' ? 'positive' : 'warning'}
                  >
                    {request.workflowStatus}
                  </StatusBadge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Clock3 />}
              title="No attendance requests"
              description="Corrections and official-duty requests will appear here."
            />
          )}
        </Card>
        <Card>
          <CardHeader title="Overtime" subtitle="Detected, claimed and approved minutes" />
          {overtime.data?.length ? (
            <div className="space-y-2">
              {overtime.data.slice(0, 6).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-row bg-surface-2 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink">{entry.workDate}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Detected {entry.detectedMinutes} · Claimed {entry.claimedMinutes} min
                    </p>
                  </div>
                  <Pill accent={entry.status === 'pending'}>{entry.status}</Pill>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Clock3 />}
              title="No overtime entries"
              description="Detected overtime appears after attendance processing."
            />
          )}
        </Card>
      </div>

      <AttendanceRequestDrawer
        open={requestOpen}
        initialDate={selectedDate}
        onClose={() => {
          setRequestOpen(false);
        }}
        onSubmitted={requests.reload}
      />
    </div>
  );
}
