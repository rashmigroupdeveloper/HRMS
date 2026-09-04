import { useMemo, useState } from 'react';
import { CalendarClock, ChevronLeft, ChevronRight, Clock3, FilePlus2 } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  DarkCard,
  EmptyState,
  IconButton,
  KpiPillRow,
  MonthCalendar,
  PageHeader,
  Pill,
  StatusBadge,
  formatDateIN,
  todayISOIST,
} from '../../ui';
import type { AttendanceDay, StatusTone } from '../../ui';
import { attendanceLabel, currentMonthIST, formatTime } from '../home/dashboard-format';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { useDashboardResource } from '../home/useDashboardResource';
import { AttendanceRequestDrawer } from './AttendanceRequestDrawer';
import type { AttendanceMonthRow, AttendanceRequest, OvertimeEntry } from './attendance-types';
import { attendanceState, formatAttendanceMinutes, sessionLabel } from './attendance-display';
import { AttendanceHolidayCard, type HolidayRow } from './AttendanceHolidayCard';

const MONTH_TITLE_IST = new Intl.DateTimeFormat('en-IN', {
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

const KIND_LABEL: Record<string, string> = {
  AR: 'Attendance regularisation',
  OD: 'Official duty',
  PERMISSION: 'Short permission',
};

function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind;
}

function addDaysIso(iso: string, delta: number): string {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + delta));
  return `${String(date.getUTCFullYear())}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function statusTone(status: string): StatusTone {
  if (status === 'P' || status === 'OD' || status === 'CO') return 'positive';
  if (status === 'A' || status === 'UAB') return 'negative';
  if (status === 'HD' || status === 'L') return 'warning';
  return 'neutral';
}

function shiftMonth(month: string, delta: number): string {
  const [year = 0, value = 1] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, value - 1 + delta, 1));
  return `${String(date.getUTCFullYear())}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function needsLook(row: AttendanceMonthRow): boolean {
  return row.status === 'A' || row.status === 'UAB';
}

function statusCopy(status: string): string {
  if (status === 'approved') return 'Approved';
  if (status === 'pending') return 'With your manager';
  if (status === 'rejected') return 'Not approved';
  return status.replaceAll('_', ' ');
}

function deadlineLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
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
  const today = todayISOIST();
  const holidayYear = Number(today.slice(0, 4));
  const holidays = useDashboardResource<HolidayRow[]>(
    `/api/attendance/config/holidays?year=${String(holidayYear)}`,
  );
  const yesterday = addDaysIso(today, -1);
  const rows = attendance.data ?? [];
  const fallbackDate =
    rows.find((row) => row.date === today)?.date ??
    rows.find((row) => needsLook(row))?.date ??
    null;
  const activeDate = selectedDate ?? fallbackDate;
  const selected = rows.find((row) => row.date === activeDate) ?? null;
  const [year = 0, monthNo = 1] = month.split('-').map(Number);
  const days = useMemo(() => {
    const value: Partial<Record<number, AttendanceDay>> = {};
    for (const row of attendance.data ?? []) {
      value[Number(row.date.slice(-2))] = {
        state: attendanceState(row.status),
        note: `${attendanceLabel(row.status)} · ${row.scheme ?? 'No shift'} · ${formatAttendanceMinutes(row.workedMinutes)} · In ${formatTime(row.firstIn)} · Out ${formatTime(row.lastOut)}`,
      };
    }
    return value;
  }, [attendance.data]);

  if (attendance.loading) return <DashboardSkeleton />;
  if (attendance.error)
    return <DashboardError message={attendance.error} onRetry={attendance.reload} />;

  const present = rows.filter((row) => row.status === 'P' || row.status === 'OD' || row.status === 'CO').length;
  const exceptions = rows.filter((row) => row.status === 'A' || row.status === 'UAB').length;
  const processed = rows.length;
  const yesterdayRow = rows.find((row) => row.date === yesterday);
  const yesterdayNeedsHelp = yesterdayRow !== undefined && needsLook(yesterdayRow);
  const openRequest = (date: string | null) => {
    if (date) setSelectedDate(date);
    setRequestOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your month, already in motion"
        title="My attendance"
        description={
          processed > 0
            ? `${String(present)} of ${String(processed)} processed days this month are already marked present.`
            : 'Processed Kent swipes land here as the month unfolds — nothing is waiting until a day is posted.'
        }
        actions={
          <Button
            variant={selected ? 'secondary' : 'primary'}
            leadingIcon={<FilePlus2 className="size-4" />}
            onClick={() => {
              openRequest(yesterdayNeedsHelp ? yesterday : activeDate);
            }}
          >
            {yesterdayNeedsHelp
              ? 'Request regularisation for yesterday'
              : 'Request a correction'}
          </Button>
        }
      />

      {/* Each figure carries the ruler it should be read against: "18 of 22 days
          processed" is a month nearly done, where a bare "18" is nothing at all.
          `processed` is the count the system actually holds — no comparator here
          is invented to flatter the number. */}
      <KpiPillRow
        pills={[
          {
            label: 'Already present',
            value: present,
            state: 'outline',
            anchor: { value: processed, label: 'of', suffix: ' days' },
          },
          {
            label: 'Need a look',
            value: exceptions,
            state: 'hatched',
            anchor: { value: processed, label: 'of', suffix: ' days' },
          },
          { label: 'Requests sent', value: requests.data?.length ?? 0, state: 'outline' },
          { label: 'Overtime rows', value: overtime.data?.length ?? 0, state: 'outline' },
        ]}
      />

      {holidays.error || holidays.data === null || holidays.data.length === 0 ? null : (
        <AttendanceHolidayCard year={holidayYear} today={today} rows={holidays.data} />
      )}

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader
            title={MONTH_TITLE_IST.format(new Date(`${month}-01T00:00:00+05:30`))}
            subtitle={
              exceptions > 0
                ? `${String(exceptions)} day${exceptions === 1 ? '' : 's'} still need a swipe or regularisation`
                : `${String(present)} present of ${String(processed)} processed`
            }
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
          <p className="text-xs font-medium text-hero-muted">This day</p>
          {selected ? (
            <div className="mt-4">
              <StatusBadge tone={statusTone(selected.status)}>
                {attendanceLabel(selected.status)}
              </StatusBadge>
              <p className="mt-4 text-3xl font-light">{formatDateIN(selected.date)}</p>
              <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-hero-muted">Shift</dt>
                  <dd className="mt-1 tabular-nums">{selected.scheme ?? 'Not assigned'}</dd>
                </div>
                <div>
                  <dt className="text-hero-muted">Worked</dt>
                  <dd className="mt-1 tabular-nums">{formatAttendanceMinutes(selected.workedMinutes)}</dd>
                </div>
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
                  <dd className="mt-1 tabular-nums">{formatAttendanceMinutes(selected.lateMinutes)}</dd>
                </div>
                <div>
                  <dt className="text-hero-muted">Early exit</dt>
                  <dd className="mt-1 tabular-nums">{formatAttendanceMinutes(selected.earlyExitMinutes)}</dd>
                </div>
                <div>
                  <dt className="text-hero-muted">Overtime</dt>
                  <dd className="mt-1 tabular-nums">{formatAttendanceMinutes(selected.otMinutes)}</dd>
                </div>
              </dl>
              {selected.sessionStatuses !== null && (
                <div className="mt-5 space-y-2" aria-label="Half-day attendance">
                  {selected.sessionStatuses.map((session) => (
                    <div
                      key={session.session}
                      className="flex items-center justify-between gap-3 text-sm"
                      aria-label={sessionLabel(session)}
                    >
                      <span className="text-hero-muted">{session.session === 1 ? 'First half' : 'Second half'}</span>
                      <StatusBadge tone={session.status === 'P' ? 'positive' : 'negative'}>
                        {session.status === 'P' ? 'Present' : 'Absent'}
                      </StatusBadge>
                    </div>
                  ))}
                </div>
              )}
              {needsLook(selected) && (
                <p className="mt-4 text-sm leading-6 text-hero-muted">
                  {selected.firstIn === null
                    ? 'No inward swipe was recorded. Request regularisation so this day is not treated as unauthorised absence.'
                    : `${attendanceLabel(selected.status)} is already on the muster. Regularise it if you were at work.`}
                </p>
              )}
              <Button
                className="mt-6"
                variant="primary"
                onClick={() => {
                  openRequest(selected.date);
                }}
              >
                {needsLook(selected)
                  ? `Request regularisation for ${formatDateIN(selected.date)}`
                  : 'Request a correction for this day'}
              </Button>
            </div>
          ) : (
            <div className="mt-8 text-hero-muted">
              <CalendarClock className="size-8" />
              <p className="mt-3 text-sm leading-6">
                Pick a calendar day to see its swipes. Today is highlighted on the month.
              </p>
            </div>
          )}
        </DarkCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Requests you have already sent" subtitle="Regularisation, official duty and short permission" />
          {requests.data?.length ? (
            <div className="space-y-2">
              {requests.data.slice(0, 6).map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between rounded-row bg-surface-2 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {kindLabel(request.kind)} · {formatDateIN(request.fromDate)}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">{request.reason}</p>
                  </div>
                  <StatusBadge
                    tone={request.workflowStatus === 'approved' ? 'positive' : 'warning'}
                  >
                    {statusCopy(request.workflowStatus)}
                  </StatusBadge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Clock3 />}
              title="No corrections in flight"
              description="When a swipe is missing, send a regularisation so the day does not stay unauthorised."
              action={
                <Button size="sm" variant="secondary" onClick={() => { openRequest(yesterdayNeedsHelp ? yesterday : activeDate); }}>
                  {yesterdayNeedsHelp ? 'Request regularisation for yesterday' : 'Request a correction'}
                </Button>
              }
            />
          )}
        </Card>
        <Card>
          <CardHeader title="Overtime already detected" subtitle="Claimed minutes against the 48-hour window" />
          {overtime.data?.length ? (
            <div className="space-y-2">
              {overtime.data.slice(0, 6).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-row bg-surface-2 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink">{formatDateIN(entry.workDate)}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Detected {entry.detectedMinutes} · claimed {entry.claimedMinutes} min
                      {entry.status === 'pending'
                        ? ` · claim by ${deadlineLabel(entry.deadlineAt)} or these minutes lapse`
                        : ''}
                    </p>
                  </div>
                  <Pill>{statusCopy(entry.status)}</Pill>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Clock3 />}
              title="No overtime on this record yet"
              description="Extra minutes appear here after attendance is processed. Nothing to claim until a day runs long."
            />
          )}
        </Card>
      </div>

      <AttendanceRequestDrawer
        open={requestOpen}
        initialDate={selectedDate ?? activeDate}
        onClose={() => {
          setRequestOpen(false);
        }}
        onSubmitted={requests.reload}
      />
    </div>
  );
}
