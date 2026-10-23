import { AttendancePenalties } from './AttendancePenalties';
import { AttendanceHalfDetails } from './AttendanceHalfDetails';
import { dayPortionLabel } from './attendance-portion';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
  Select,
  StatusBadge,
  collapseDaySpans,
  formatDateIN,
  todayISOIST,
} from '../../ui';
import type { AttendanceDay, AttendanceDayState, StatusTone } from '../../ui';
import { attendanceLabel, currentMonthIST, formatTime } from '../home/dashboard-format';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { useDashboardResource } from '../home/useDashboardResource';
import { AttendanceRequestDrawer } from './AttendanceRequestDrawer';
import type { AttendanceMonthRow, AttendanceRequest, OvertimeEntry } from './attendance-types';
import { attendanceSessionDescription, attendanceSessionGlyph } from './attendance-session-format';
import { takeActionParam } from '../_shared/action-param';

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

function detailedDayLabel(row: AttendanceMonthRow): string {
  if (row.status === 'HD') {
    if (row.leaveTypeName) return `Half day · ${row.leaveTypeName}`;
    if (row.sessionStatuses?.some(half => half.status === 'P' || half.status === 'OD')) return 'Half-day present';
  }
  return row.leaveTypeName ?? attendanceLabel(row.status);
}

function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind;
}

function addDaysIso(iso: string, delta: number): string {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + delta));
  return `${String(date.getUTCFullYear())}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function stateFor(status: string): AttendanceDayState {
  if (status === 'P' || status === 'OD') return 'present';
  if (status === 'A' || status === 'UAB') return 'absent';
  if (status === 'L' || status === 'CO') return 'leave';
  if (status === 'HD') return 'halfday';
  if (status === 'H') return 'holiday';
  return 'weekoff';
}

function statusTone(status: string): StatusTone {
  if (status === 'P' || status === 'OD') return 'positive';
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
  return row.status === 'A' || row.status === 'UAB' || row.sessionStatuses?.some((s) => s.status === 'A') === true;
}

function statusCopy(status: string, held = false): string {
  if (held && status === 'pending') return 'Waiting for HR';
  if (status === 'approved') return 'Approved';
  if (status === 'pending') return 'Awaiting approval';
  if (status === 'rejected') return 'Not approved';
  if (status === 'sent_back') return 'Sent back for review';
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
        headingLevel={2}
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

export function MyAttendancePage({ ownerId }: { ownerId?: number }) {
  const [month, setMonth] = useState(() => currentMonthIST());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(() => takeActionParam('request'));
  const attendance = useDashboardResource<AttendanceMonthRow[]>(
    `/api/my/attendance?month=${month}`,
  );
  const requests = useDashboardResource<AttendanceRequest[]>('/api/attendance/requests/mine');
  const overtime = useDashboardResource<OvertimeEntry[]>('/api/attendance/ot/mine');
  const today = todayISOIST();
  const holidayYear = Number(today.slice(0, 4));
  const holidays = useDashboardResource<HolidayRow[]>(
    `/api/attendance/config/holidays?year=${String(holidayYear)}&mine=true`,
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
        label: row.sessionStatuses ? attendanceSessionGlyph(row.status, row.sessionStatuses)
          : row.status === 'HD' && row.leaveTypeCode ? `HD/${row.leaveTypeCode}` : row.leaveTypeCode ?? row.status,
        note: `${attendanceSessionDescription(row.sessionStatuses) || (row.leaveTypeName ?? attendanceLabel(row.status))} · In ${formatTime(row.firstIn)} · Out ${formatTime(row.lastOut)}`,
      };
    }
    return value;
  }, [attendance.data]);

  const spans = useMemo(() => {
    const events: { iso: string; label: string; tone: 'holiday' | 'leave' | 'duty' }[] = [];
    for (const row of attendance.data ?? []) {
      if (row.status === 'L' || row.status === 'CO' || (row.status === 'HD' && row.leaveTypeName)) {
        events.push({ iso: row.date, label: row.leaveTypeName ?? 'Leave', tone: 'leave' });
      } else if (row.status === 'OD') {
        events.push({ iso: row.date, label: 'Official duty', tone: 'duty' });
      } else if (row.status === 'H') {
        events.push({ iso: row.date, label: 'Holiday', tone: 'holiday' });
      }
    }
    for (const holiday of holidays.data ?? []) {
      if (!holiday.date.startsWith(month)) continue;
      const named = events.find((event) => event.iso === holiday.date && event.tone === 'holiday');
      if (named) named.label = holiday.name;
      else events.push({ iso: holiday.date, label: holiday.name, tone: 'holiday' });
    }
    return collapseDaySpans(events);
  }, [attendance.data, holidays.data, month]);

  if (attendance.loading) return <DashboardSkeleton />;
  if (attendance.error)
    return <DashboardError message={attendance.error} onRetry={attendance.reload} />;

  const present = rows.filter((row) => row.status === 'P' || row.status === 'OD').length;
  const halfDays = rows.filter(row => row.status === 'HD').length;
  const exceptions = rows.filter(needsLook).length;
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
        title="My attendance"
        description={
          processed > 0
            ? `${String(present)} full days present or on duty; ${String(halfDays)} half-day${halfDays === 1 ? '' : 's'} recorded across ${String(processed)} processed date${processed === 1 ? '' : 's'}.`
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
          { label: 'Present', value: present, state: 'filled' },
          { label: 'Need a look', value: exceptions, state: 'accent' },
          { label: 'Half-days', value: halfDays, state: 'hatched' },
          { label: 'Requests', value: requests.data?.length ?? 0, state: 'outline' },
        ]}
      />

      {holidays.error || holidays.data === null || holidays.data.length === 0 ? null : (
        <HolidayYearCard year={holidayYear} today={today} rows={holidays.data} />
      )}

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader
            headingLevel={2}
            title={MONTH_TITLE_IST.format(new Date(`${month}-01T00:00:00+05:30`))}
            subtitle={
              exceptions > 0
                ? `${String(exceptions)} day${exceptions === 1 ? '' : 's'} still need a swipe or regularisation`
                : `${String(present)} full days · ${String(halfDays)} half-days · ${String(processed)} processed`
            }
            action={
              <div className="flex items-end gap-1">
                <div className="w-44">
                  <Select
                    label="Month"
                    value={month}
                    onChange={setMonth}
                    options={Array.from({ length: 36 }, (_, index) => {
                      const anchor = Number(today.slice(0, 4)) - 2;
                      const cursor = new Date(Date.UTC(anchor, index, 1));
                      const value = `${String(cursor.getUTCFullYear())}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;
                      return { value, label: MONTH_TITLE_IST.format(new Date(`${value}-01T00:00:00+05:30`)) };
                    })}
                  />
                </div>
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
          <MonthCalendar
            year={year}
            month={monthNo}
            days={days}
            spans={spans}
            selectedIso={activeDate}
            onSelectDay={setSelectedDate}
          />
          <p className="mt-4 text-xs leading-5 text-ink-muted">
            Bars name leave, holidays and official duty. A blank day has no posted attendance yet.
          </p>
        </Card>

        <DarkCard>
          <p className="text-xs font-medium tracking-tight text-hero-muted">This day</p>
          {selected ? (
            <div className="mt-4">
              <StatusBadge tone={statusTone(selected.status)}>
                {detailedDayLabel(selected)}
              </StatusBadge>
              {selected.source && <p className="mt-3 text-xs text-hero-muted">
                {selected.source === 'regularized' ? 'From an approved request' : selected.source === 'manual' ? 'HR correction' : 'Processed attendance'}
                {selected.isLocked ? ' · Locked for payroll' : ''}
                {selected.leaveIsPaid === false ? ' · Unpaid leave' : ''}
              </p>}
              <AttendanceHalfDetails date={selected.date} row={selected} />
              <AttendancePenalties row={selected} />
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
                  <dt className="text-hero-muted">Hours worked</dt>
                  <dd className="mt-1 tabular-nums">
                    {selected.workedMinutes === null || selected.workedMinutes === undefined
                      ? '—'
                      : `${String(Math.floor(selected.workedMinutes / 60))}h ${String(selected.workedMinutes % 60)}m`}
                  </dd>
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
              <p className="mt-3 text-sm leading-6">{selectedDate
                ? selectedDate > today
                  ? `Attendance is not due for ${formatDateIN(selectedDate)} yet. You can request official duty for planned company work.`
                  : `No attendance is posted for ${formatDateIN(selectedDate)}. This does not mean absent. Processing may still be waiting for complete device data.`
                : 'Pick a calendar day to see its attendance and swipes. Today is highlighted on the month.'}</p>
            </div>
          )}
        </DarkCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader headingLevel={2} title="Requests you have already sent" subtitle="Regularisation, official duty and short permission" />
          {requests.error ? <DashboardError message={requests.error} onRetry={requests.reload} /> : requests.loading
            ? <p role="status" className="text-sm text-ink-muted">Loading requests…</p> : requests.data?.length ? (
            <div className="space-y-2">
              {requests.data.slice(0, 6).map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between rounded-row bg-surface-2 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {kindLabel(request.kind)} · {formatDateIN(request.fromDate)} · {dayPortionLabel(request.dayPortion)}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">{request.reason}</p>
                    <Link className="mt-1 inline-block rounded-control text-xs font-semibold underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-focus"
                      to={`/approvals/${String(request.workflowRequestId)}`}>View request and decisions</Link>
                  </div>
                  <StatusBadge
                    tone={request.workflowStatus === 'approved' ? 'positive' : 'warning'}
                  >
                    {statusCopy(request.workflowStatus, request.routingHeld)}
                  </StatusBadge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Clock3 />}
              title="No corrections in flight"
              description={processed === 0
                ? 'A blank day is not an absence. Send a correction after a day is posted and the swipe does not match the day you worked.'
                : 'When a posted day is missing a swipe, send a regularisation so it does not stay an unauthorised absence.'}
              action={
                <Button size="sm" variant="secondary" onClick={() => { openRequest(yesterdayNeedsHelp ? yesterday : activeDate); }}>
                  {yesterdayNeedsHelp ? 'Request regularisation for yesterday' : 'Request a correction'}
                </Button>
              }
            />
          )}
        </Card>
        <Card>
          <CardHeader headingLevel={2} title="Overtime already detected" subtitle="Claimed minutes against the 48-hour window" />
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
          ) : selected !== null && selected.otMinutes > 0 ? (
            <p className="text-sm leading-6 text-ink-muted" role="status">
              {formatDateIN(selected.date)} already shows {String(selected.otMinutes)} overtime minutes on the day.
              A claim row appears here once that day is in the overtime queue.
            </p>
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
        ownerId={ownerId}
        loadedMonth={month}
        open={requestOpen}
        initialDate={selectedDate ?? activeDate}
        postedDates={rows.map((row) => row.date)}
        onClose={() => {
          setRequestOpen(false);
        }}
        onSubmitted={() => { requests.reload(); attendance.reload(); }}
      />
    </div>
  );
}
