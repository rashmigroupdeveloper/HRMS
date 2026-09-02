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
import type { AttendanceDay, AttendanceDayState, StatusTone } from '../../ui';
import { attendanceLabel, currentMonthIST, formatTime } from '../home/dashboard-format';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { useDashboardResource } from '../home/useDashboardResource';
import { AttendanceRequestDrawer } from './AttendanceRequestDrawer';
import type { AttendanceMonthRow, AttendanceRequest, OvertimeEntry } from './attendance-types';

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

function stateFor(status: string): AttendanceDayState {
  if (status === 'P') return 'present';
  if (status === 'A' || status === 'UAB') return 'absent';
  if (status === 'L') return 'leave';
  if (status === 'HD') return 'halfday';
  if (status === 'H') return 'holiday';
  return 'weekoff';
}

function statusTone(status: string): StatusTone {
  if (status === 'P') return 'positive';
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

interface HolidayRow {
  date: string;
  name: string;
  locationId: number | null;
}

function HolidayYearCard({ year, today, rows }: { year: number; today: string; rows: readonly HolidayRow[] }) {
  const upcoming = rows.filter((row) => row.date >= today);
  const observed = rows.filter((row) => row.date < today);
  const line = (row: HolidayRow) => `${formatDateIN(row.date)} — ${row.name}`;
  return (
    <Card>
      <CardHeader
        title={`${String(year)} holidays`}
        subtitle="These days are already off — you do not apply leave for them."
      />
      {upcoming.length > 0 ? (
        <ul className="space-y-2">
          {upcoming.map((row) => (
            <li key={`${row.date}:${row.name}`} className="rounded-row bg-surface-2 px-4 py-3 text-sm font-semibold text-ink">
              {line(row)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-6 text-ink-muted">No further holidays this year.</p>
      )}
      {observed.length > 0 ? (
        <details className="mt-4 text-sm text-ink-muted">
          <summary className="cursor-pointer font-medium text-ink">Already observed · {String(observed.length)}</summary>
          <ul className="mt-2 space-y-1">
            {observed.map((row) => (
              <li key={`${row.date}:${row.name}`}>{line(row)}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
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
        state: stateFor(row.status),
        note: `${attendanceLabel(row.status)} · In ${formatTime(row.firstIn)} · Out ${formatTime(row.lastOut)}`,
      };
    }
    return value;
  }, [attendance.data]);

  if (attendance.loading) return <DashboardSkeleton />;
  if (attendance.error)
    return <DashboardError message={attendance.error} onRetry={attendance.reload} />;

  const present = rows.filter((row) => row.status === 'P').length;
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

      <KpiPillRow
        pills={[
          { label: 'Already present', value: present, state: 'outline' },
          { label: 'Need a look', value: exceptions, state: 'hatched' },
          { label: 'Requests sent', value: requests.data?.length ?? 0, state: 'outline' },
          { label: 'Overtime rows', value: overtime.data?.length ?? 0, state: 'outline' },
        ]}
      />

      {holidays.error || holidays.data === null || holidays.data.length === 0 ? null : (
        <HolidayYearCard year={holidayYear} today={today} rows={holidays.data} />
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
          <p className="text-xs font-medium tracking-tight text-hero-muted">This day</p>
          {selected ? (
            <div className="mt-4">
              <StatusBadge tone={statusTone(selected.status)}>
                {attendanceLabel(selected.status)}
              </StatusBadge>
              <p className="mt-4 text-3xl font-light">{formatDateIN(selected.date)}</p>
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
