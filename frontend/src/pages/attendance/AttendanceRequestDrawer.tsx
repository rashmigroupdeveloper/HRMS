import { useAttendanceSchedule, windowTiming, schedulePortionOptions } from './attendance-schedule';
import { useEffect, useRef, useState } from 'react';
import { readDayPortion, dayPortionLabel, type DayPortion } from './attendance-portion';
import { apiFetch } from '../../lib/api';
import { Button, DatePicker, Drawer, Select, Textarea, TextField, formatDateIN, toast, todayISOIST } from '../../ui';

const AR_DRAFT_KEY = 'rashmi.draft.ar';
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

function readArDraft(): AttendanceRequestDraft | null {
  try {
    const raw = window.localStorage.getItem(AR_DRAFT_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const savedAt = record['savedAt'];
    if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null;
    if (Date.now() - savedAt >= DRAFT_MAX_AGE_MS) {
      window.localStorage.removeItem(AR_DRAFT_KEY);
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

function writeArDraft(draft: Omit<AttendanceRequestDraft, 'savedAt'>): void {
  try {
    const payload: AttendanceRequestDraft = { ...draft, savedAt: Date.now() };
    window.localStorage.setItem(AR_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    /* persistence is best-effort */
  }
}

function clearArDraft(): void {
  try {
    window.localStorage.removeItem(AR_DRAFT_KEY);
  } catch {
    /* persistence is best-effort */
  }
}

const KIND_COPY: Record<string, { title: string; help: string; inaction: string }> = {
  AR: {
    title: 'Request regularisation',
    help: 'Correct a day so the muster matches when you were actually at work.',
    inaction: 'Without this, a missing swipe stays as unauthorised absence on the muster.',
  },
  OD: {
    title: 'Record official duty',
    help: 'Keep a company-duty day from being treated as absence.',
    inaction: 'Without this, a duty day away from the plant can still read as absent.',
  },
  PERMISSION: {
    title: 'Ask for short permission',
    help: 'A short, approved gap — your manager sees the reason before it hits payroll.',
    inaction: 'Without this, a short gap has no approved record.',
  },
};

const KIND_FALLBACK = {
  title: 'Request regularisation',
  help: 'Correct a day so the muster matches when you were actually at work.',
  inaction: 'Without this, a missing swipe stays as unauthorised absence on the muster.',
};

function kindCopy(kind: string): typeof KIND_FALLBACK {
  return KIND_COPY[kind] ?? KIND_FALLBACK;
}

function inclusiveDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.round((end - start) / 86_400_000) + 1;
}

export function AttendanceRequestDrawer({
  open,
  initialDate,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  initialDate: string | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
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
  const schedule = useAttendanceSchedule(fromDate, open && kind !== 'PERMISSION', toDate);
  const selectedWindow = schedule.data?.windows.find(window => window.dayPortion === dayPortion);
  const portionOptions = schedulePortionOptions(schedule.data);
  const days = fromDate && toDate ? inclusiveDays(fromDate, toDate) : 0;

  useEffect(() => {
    if (!open) {
      skipPersistRef.current = true;
      return;
    }
    skipPersistRef.current = true;
    const draft = readArDraft();
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
  }, [open, initialDate]);

  useEffect(() => {
    if (!open) return;
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    writeArDraft({ kind, dayPortion, fromDate, toDate, reason, fromTime, toTime });
  }, [open, kind, dayPortion, fromDate, toDate, reason, fromTime, toTime]);

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
      await apiFetch('/api/attendance/requests', {
        method: 'POST',
        body: JSON.stringify({ kind, fromDate, toDate, reason: reason.trim(),
          ...(kind === 'PERMISSION' ? { fromTime, toTime } : { dayPortion }),
        }),
      });
      toast.success(`${copy.title} sent`, {
        description: 'Track the request and its decisions in My attendance.',
      });
      skipPersistRef.current = true;
      clearArDraft();
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
        {kind !== 'PERMISSION' && <Select label="Which part of each day?" value={dayPortion}
          onChange={value => { setDayPortion(readDayPortion(value)); }} options={portionOptions}
          disabled={schedule.loading || portionOptions.length === 0} hint={schedule.loading ? 'Loading your assigned shift…' : schedule.data?.shiftName ?? undefined} />}
        {kind !== 'PERMISSION' && <div className="rounded-row bg-surface-2 px-4 py-3 text-sm" aria-live="polite">
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
              {copy.inaction}
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
      </div>
    </Drawer>
  );
}
