import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { Button, Checkbox, DatePicker, Drawer, Select, Textarea, formatDateIN, toast, todayISOIST } from '../../ui';

const LEAVE_DRAFT_KEY = 'rashmi.draft.leave';
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface LeaveDraft {
  savedAt: number;
  typeCode: string | null;
  from: string | null;
  to: string | null;
  halfDay: boolean;
  reason: string;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function readLeaveDraft(): LeaveDraft | null {
  try {
    const raw = window.localStorage.getItem(LEAVE_DRAFT_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const savedAt = record['savedAt'];
    if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null;
    if (Date.now() - savedAt >= DRAFT_MAX_AGE_MS) {
      window.localStorage.removeItem(LEAVE_DRAFT_KEY);
      return null;
    }
    const typeRaw = record['typeCode'];
    const fromRaw = record['from'];
    const toRaw = record['to'];
    const halfDay = record['halfDay'];
    const reason = record['reason'];
    const typeCode = typeRaw === null || typeof typeRaw === 'string' ? typeRaw : undefined;
    const from = fromRaw === null ? null : isIsoDate(fromRaw) ? fromRaw : undefined;
    const to = toRaw === null ? null : isIsoDate(toRaw) ? toRaw : undefined;
    if (typeCode === undefined || from === undefined || to === undefined) return null;
    if (typeof halfDay !== 'boolean' || typeof reason !== 'string') return null;
    return { savedAt, typeCode, from, to, halfDay, reason };
  } catch {
    return null;
  }
}

function writeLeaveDraft(draft: Omit<LeaveDraft, 'savedAt'>): void {
  try {
    const payload: LeaveDraft = { ...draft, savedAt: Date.now() };
    window.localStorage.setItem(LEAVE_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    /* persistence is best-effort */
  }
}

function clearLeaveDraft(): void {
  try {
    window.localStorage.removeItem(LEAVE_DRAFT_KEY);
  } catch {
    /* persistence is best-effort */
  }
}

export interface LeaveTypeOption {
  code: string;
  name: string;
  available: number;
  allowHalfDay: boolean;
  maxPerRequest: number | null;
  sandwichRule: 'include' | 'exclude';
}

function previewDays(
  from: string,
  to: string,
  sandwich: 'include' | 'exclude',
  halfDay: boolean,
): { counted: number; skippedSundays: number } {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return { counted: 0, skippedSundays: 0 };
  }
  let counted = 0;
  let skippedSundays = 0;
  for (let time = start; time <= end; time += 86_400_000) {
    const sunday = new Date(time).getUTCDay() === 0;
    if (sandwich === 'exclude' && sunday) {
      skippedSundays += 1;
      continue;
    }
    counted += 1;
  }
  if (halfDay && counted > 0) counted -= 0.5;
  return { counted, skippedSundays };
}

export function LeaveApplyDrawer({
  open,
  leaveTypes,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  leaveTypes: LeaveTypeOption[];
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [typeCode, setTypeCode] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [halfDay, setHalfDay] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipPersistRef = useRef(true);
  const draftAppliedRef = useRef(false);
  const selected = leaveTypes.find((type) => type.code === typeCode);
  const span = from && to && selected ? previewDays(from, to, selected.sandwichRule, halfDay) : null;
  const remaining =
    selected && span ? Math.round((selected.available - span.counted) * 10) / 10 : null;

  useEffect(() => {
    if (!open) {
      skipPersistRef.current = true;
      draftAppliedRef.current = false;
      return;
    }
    skipPersistRef.current = true;
    const draft = readLeaveDraft();
    if (draft !== null) {
      draftAppliedRef.current = true;
      setTypeCode(draft.typeCode);
      setFrom(draft.from);
      setTo(draft.to);
      setHalfDay(draft.halfDay);
      setReason(draft.reason);
      return;
    }
    setFrom((value) => value ?? todayISOIST());
    setTo((value) => value ?? todayISOIST());
  }, [open]);

  useEffect(() => {
    if (!open || draftAppliedRef.current || typeCode !== null || leaveTypes.length === 0) return;
    const preferred = leaveTypes.find((type) => type.available > 0) ?? leaveTypes[0];
    if (preferred !== undefined) setTypeCode(preferred.code);
  }, [open, leaveTypes, typeCode]);

  useEffect(() => {
    if (!open) return;
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    writeLeaveDraft({ typeCode, from, to, halfDay, reason });
  }, [open, typeCode, from, to, halfDay, reason]);

  const submit = async () => {
    if (!typeCode || !from || !to || reason.trim().length < 3) {
      setError('Choose a leave type and dates, then add a short reason.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiFetch('/api/leave/applications', {
        method: 'POST',
        body: JSON.stringify({
          leaveType: typeCode,
          fromDate: from,
          toDate: to,
          fromHalf: halfDay,
          toHalf: false,
          reason: reason.trim(),
        }),
      });
      toast.success('Leave request submitted', {
        description: 'Your reporting manager has been notified.',
      });
      skipPersistRef.current = true;
      clearLeaveDraft();
      setTypeCode(null);
      setFrom(null);
      setTo(null);
      setHalfDay(false);
      setReason('');
      onSubmitted();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit leave.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Apply for a day off"
      subtitle="Dates default to today. Close anytime — this draft stays."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Keep draft
          </Button>
          <Button variant="primary" loading={loading} onClick={() => void submit()}>
            Send to my manager
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Select
          label="Leave type"
          required
          value={typeCode}
          onChange={setTypeCode}
          options={leaveTypes.map((type) => ({
            value: type.code,
            label: type.name,
            description: `${type.available.toLocaleString('en-IN')} days already available`,
          }))}
          placeholder="Choose leave type"
        />
        <div className="grid grid-cols-2 gap-3">
          <DatePicker label="First day" required value={from} onChange={setFrom} />
          <DatePicker
            label="Last day"
            required
            value={to}
            min={from ?? undefined}
            onChange={setTo}
          />
        </div>
        {selected?.allowHalfDay && (
          <Checkbox
            label="First day is a half day"
            description="The final debit follows leave policy after approval."
            checked={halfDay}
            onChange={(event) => {
              setHalfDay(event.currentTarget.checked);
            }}
          />
        )}
        {span && selected && from && to && (
          <div className="rounded-row bg-surface-2 px-4 py-3 text-sm">
            <p className="font-semibold text-ink">
              Preview · {span.counted.toLocaleString('en-IN')} day
              {span.counted === 1 ? '' : 's'} of {selected.name}
            </p>
            <p className="mt-1 text-ink-muted">
              {formatDateIN(from)}
              {from === to ? '' : ` – ${formatDateIN(to)}`}
              {selected.sandwichRule === 'exclude'
                ? span.skippedSundays > 0
                  ? ` · ${String(span.skippedSundays)} Sunday${span.skippedSundays === 1 ? '' : 's'} skipped (sandwich exclude)`
                  : ' · Sundays inside the span are skipped'
                : ' · Sundays inside the span count (sandwich include)'}
              . Payroll confirms the exact debit.
            </p>
            {remaining !== null && (
              <p className="mt-2 tabular-nums text-ink">
                {remaining >= 0
                  ? `${remaining.toLocaleString('en-IN')} of ${selected.available.toLocaleString('en-IN')} days would remain`
                  : `This preview is ${Math.abs(remaining).toLocaleString('en-IN')} days over the ${selected.available.toLocaleString('en-IN')} available`}
              </p>
            )}
            <p className="mt-2 text-ink-muted">
              Applying now reserves the days so they are not treated as unauthorised absence.
            </p>
          </div>
        )}
        {selected?.maxPerRequest !== null && selected?.maxPerRequest !== undefined && (
          <p className="rounded-row bg-surface-2 px-4 py-3 text-sm text-ink">
            Policy cap: {selected.maxPerRequest.toLocaleString('en-IN')} days per request
          </p>
        )}
        <Textarea
          label="Why are you taking this time?"
          required
          rows={4}
          value={reason}
          onChange={(event) => {
            setReason(event.currentTarget.value);
          }}
          hint="Visible to everyone in the approval chain."
          error={error ?? undefined}
        />
      </div>
    </Drawer>
  );
}
