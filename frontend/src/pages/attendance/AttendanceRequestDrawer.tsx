import { ownedDraftKey } from '../../lib/draft-storage';
import { useAttendanceSchedule, windowTiming, schedulePortionOptions } from './attendance-schedule';
import { useEffect, useRef, useState } from 'react';
import { readDayPortion, dayPortionLabel, type DayPortion } from './attendance-portion';
import { apiFetch } from '../../lib/api';
import { Button, DatePicker, Drawer, Select, Textarea, TextField, formatDateIN, toast, todayISOIST } from '../../ui';
import { ChainPreview } from '../workflows/ChainPreview';

const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface AttendanceRequestDraft {
  savedAt: number;
  kind: string;
  dayPortion?: DayPortion;
  fromDate: string | null;
  toDate: string | null;
  reason: string;
  fromTime?: string;
  toTime?: string;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function readArDraft(key: string | null): AttendanceRequestDraft | null {
  try {
    if (key === null) return null;
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const savedAt = record['savedAt'];
    if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null;
    if (Date.now() - savedAt >= DRAFT_MAX_AGE_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    const kind = record['kind'];
    const reason = record['reason'];
    const fromRaw = record['fromDate'];
    const toRaw = record['toDate'];
    if (typeof kind !== 'string' || typeof reason !== 'string') return null;
    const fromDate = fromRaw === null ? null : isIsoDate(fromRaw) ? fromRaw : undefined;
    const toDate = toRaw === null ? null : isIsoDate(toRaw) ? toRaw : undefined;
    if (fromDate === undefined || toDate === undefined) return null;
    return { savedAt, kind, dayPortion: readDayPortion(record['dayPortion']), fromDate, toDate, reason,
      fromTime: typeof record['fromTime'] === 'string' ? record['fromTime'] : '',
      toTime: typeof record['toTime'] === 'string' ? record['toTime'] : '' };
  } catch {
    return null;
  }
}

function writeArDraft(key: string | null, draft: Omit<AttendanceRequestDraft, 'savedAt'>): void {
  if (key === null) return;
  try {
    const payload: AttendanceRequestDraft = { ...draft, savedAt: Date.now() };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    /* persistence is best-effort */
  }
}

function clearArDraft(key: string | null): void {
  if (key === null) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* persistence is best-effort */
  }
}

const KIND_COPY: Record<string, { title: string; help: string; definitionCode: string }> = {
  AR: {
    title: 'Request regularisation',
    help: 'Correct a day so the muster matches when you were actually at work.',
    definitionCode: 'regularization',
  },
  OD: {
    title: 'Record official duty',
    help: 'Keep a company-duty day from being treated as absence.',
    definitionCode: 'od',
  },
  PERMISSION: {
    title: 'Ask for short permission',
    help: 'A short, approved gap — your manager sees the reason before it hits payroll.',
    definitionCode: 'regularization',
  },
};

const KIND_FALLBACK = {
  title: 'Request regularisation',
  help: 'Correct a day so the muster matches when you were actually at work.',
  definitionCode: 'regularization',
};

function eachIso(from: string, to: string): string[] {
  const days: string[] = [];
  for (let iso = from; iso <= to; iso = nextIso(iso)) days.push(iso);
  return days;
}

function nextIso(iso: string): string {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  return `${String(date.getUTCFullYear())}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/** A blank day is not an absence. Only a posted missing swipe becomes one. */
function requestInaction(kind: string, from: string, to: string, postedDates: readonly string[], loadedMonth?: string): string {
  if (kind === 'OD') return 'Without this, a duty day away from the plant can still read as absent.';
  if (kind === 'PERMISSION') return 'Without this, a short gap has no approved record.';
  const posted = new Set(postedDates);
  const coversPosted = eachIso(from, to).some((iso) => posted.has(iso));
  if (!coversPosted && (from.slice(0, 7) !== loadedMonth || to.slice(0, 7) !== loadedMonth)) {
    return 'Attendance for this period is not loaded in this view. Open that month to check its records before requesting a correction.';
  }
  return coversPosted
    ? 'Without this, a missing swipe on a posted day stays as unauthorised absence on the muster.'
    : 'No attendance is posted for these dates yet, so they are not absences. Send this only if you were at work and the swipe will not arrive.';
}

function kindCopy(kind: string): typeof KIND_FALLBACK {
  return KIND_COPY[kind] ?? KIND_FALLBACK;
}

function inclusiveDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.round((end - start) / 86_400_000) + 1;
}

function OwnedAttendanceRequestDrawer({
  ownerId,
  loadedMonth,
  open,
  initialDate,
  postedDates = [],
  onClose,
  onSubmitted,
}: {
  ownerId?: number | undefined;
  loadedMonth?: string;
  open: boolean;
  initialDate: string | null;
  postedDates?: readonly string[];
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const draftKey = ownedDraftKey('ar', ownerId);
  const [kind, setKind] = useState('AR');
  const [dayPortion, setDayPortion] = useState<DayPortion>('full_day');
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [fromTime, setFromTime] = useState('');
  const [toTime, setToTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipPersistRef = useRef(true);
  const copy = kindCopy(kind);
  const scheduleEnabled = open && kind !== 'PERMISSION';
  const schedule = useAttendanceSchedule(fromDate, scheduleEnabled, toDate);
  const selectedWindow = schedule.data?.windows.find(window => window.dayPortion === dayPortion);
  const portionOptions = schedulePortionOptions(schedule.data);
  const days = fromDate && toDate ? inclusiveDays(fromDate, toDate) : 0;

  useEffect(() => {
    if (!open) {
      skipPersistRef.current = true;
      return;
    }
    skipPersistRef.current = true;
    const draft = readArDraft(draftKey);
    if (draft !== null) {
      setKind(draft.kind);
      setDayPortion(draft.dayPortion ?? 'full_day');
      setFromDate(draft.fromDate);
      setToDate(draft.toDate);
      setReason(draft.reason);
      setFromTime(draft.fromTime ?? ''); setToTime(draft.toTime ?? '');
      return;
    }
    const fallback = initialDate ?? todayISOIST();
    if (initialDate) {
      setKind(initialDate > todayISOIST() ? 'OD' : 'AR');
      setFromDate(initialDate);
      setToDate(initialDate);
      return;
    }
    setFromDate((value) => value ?? fallback);
    setToDate((value) => value ?? fallback);
  }, [open, initialDate, draftKey]);

  useEffect(() => {
    if (!open) return;
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    writeArDraft(draftKey, { kind, dayPortion, fromDate, toDate, reason, fromTime, toTime });
  }, [open, kind, dayPortion, fromDate, toDate, reason, fromTime, toTime, draftKey]);

  const submit = async () => {
    if (!fromDate || !toDate || fromDate > toDate || reason.trim().length < 5) {
      setError('Choose the dates and add a short reason your manager can act on.');
      return;
    }
    if (kind !== 'PERMISSION' && (schedule.loading || schedule.error || !selectedWindow)) {
      setError(schedule.error ?? 'Choose an available shift period after its timings have loaded.'); return;
    }
    if (kind === 'PERMISSION' && (fromDate !== toDate || !fromTime || !toTime || toTime <= fromTime)) {
      setError('Short permission needs one date and an end time after the start time.'); return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<{ routingHeld: boolean }>('/api/attendance/requests', {
        method: 'POST',
        body: JSON.stringify({ kind, fromDate, toDate, reason: reason.trim(),
          ...(kind === 'PERMISSION' ? { fromTime, toTime } : { dayPortion }),
        }),
      });
      toast.success(result.routingHeld ? 'Waiting for HR' : `${copy.title} sent`, {
        description: result.routingHeld
          ? 'Your manager cannot approve this yet, so it is held for HR. Attendance and pay are unchanged.'
          : 'Track the request and its decisions in My attendance.',
      });
      skipPersistRef.current = true;
      clearArDraft(draftKey);
      setReason('');
      setDayPortion('full_day');
      setFromTime(''); setToTime('');
      onSubmitted();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit the request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={copy.title}
      subtitle={copy.help}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Keep draft
          </Button>
          <Button variant="primary" loading={loading} disabled={kind !== 'PERMISSION' && (schedule.loading || !selectedWindow || schedule.error !== null)} onClick={() => void submit()}>
            Send to my manager
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Select
          label="What do you need?"
          value={kind}
          onChange={value => { setKind(value); if (value === 'PERMISSION') setToDate(fromDate); }}
          options={[
            {
              value: 'AR',
              label: 'Attendance regularisation',
              description: 'Fix a past day with a missing or wrong swipe',
            },
            {
              value: 'OD',
              label: 'Official duty',
              description: 'You were on company work, not at the gate',
            },
            {
              value: 'PERMISSION',
              label: 'Short permission',
              description: 'A short approved gap in the day',
            },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <DatePicker label="From date" required value={fromDate} onChange={value => { setFromDate(value); if (kind === 'PERMISSION') setToDate(value); }} />
          <DatePicker
            label="To date"
            required
            value={toDate}
            min={fromDate ?? undefined}
            onChange={setToDate}
          />
        </div>
        {scheduleEnabled && <Select label="Which part of each day?" value={dayPortion}
          onChange={value => { setDayPortion(readDayPortion(value)); }} options={portionOptions}
          disabled={schedule.loading || portionOptions.length === 0} hint={schedule.loading ? 'Loading your assigned shift…' : schedule.data?.shiftName ?? undefined} />}
        {scheduleEnabled && <div className="rounded-row bg-surface-2 px-4 py-3 text-sm" aria-live="polite">
          {schedule.error ? <p role="alert" className="text-negative-ink">{schedule.error}</p> : schedule.loading
            ? <p className="text-ink-muted">Loading shift timings…</p>
            : selectedWindow ? <>
              <p className="font-semibold text-ink">{dayPortionLabel(dayPortion)} · {windowTiming(selectedWindow)}</p>
              <p className="mt-1 text-ink-muted">Assigned shift timings for {schedule.data ? formatDateIN(schedule.data.date) : 'the selected date'}.
                {fromDate !== toDate ? ' Other dates use their own assigned shift timings.' : ''}
                {dayPortion !== 'full_day' ? ' The other half stays unchanged.' : ''}</p>
            </> : <p className="text-ink-muted">{schedule.data?.dayKind === 'holiday' || schedule.data?.dayKind === 'week_off'
              ? 'This is an off day. Choose a working date for regularisation or official duty.'
              : 'The selected half has no configured timings. Choose an available period or contact HR.'}</p>}
        </div>}
        {kind === 'PERMISSION' && <div className="grid grid-cols-2 gap-3">
          <TextField label="Permission from" type="time" required value={fromTime} onChange={event => { setFromTime(event.currentTarget.value); }} />
          <TextField label="Permission to" type="time" required value={toTime} onChange={event => { setToTime(event.currentTarget.value); }} />
        </div>}
        {days > 0 && fromDate && toDate && (
          <div className="rounded-row bg-surface-2 px-4 py-3">
            <p className="text-sm font-semibold text-ink">
              {kind !== 'PERMISSION' && dayPortion !== 'full_day'
                ? `${dayPortionLabel(dayPortion)} on ${String(days)} day${days === 1 ? '' : 's'} — the other half is unchanged`
                : `You are requesting ${String(days)} day${days === 1 ? '' : 's'}`}
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              {formatDateIN(fromDate)}
              {fromDate === toDate ? '' : ` – ${formatDateIN(toDate)}`}
              {' · '}
              {requestInaction(kind, fromDate, toDate, postedDates, loadedMonth)}
            </p>
          </div>
        )}
        <Textarea
          label="Why should this be approved?"
          required
          rows={4}
          value={reason}
          onChange={(event) => {
            setReason(event.currentTarget.value);
          }}
          hint="Your manager reads this — a short, specific why is enough."
          error={error ?? undefined}
        />
        {open && <ChainPreview definitionCode={copy.definitionCode} />}
      </div>
    </Drawer>
  );
}

export function AttendanceRequestDrawer(props: Parameters<typeof OwnedAttendanceRequestDrawer>[0]) {
  return <OwnedAttendanceRequestDrawer key={props.ownerId ?? 'unowned'} {...props} />;
}
