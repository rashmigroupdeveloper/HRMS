import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { Button, Checkbox, DatePicker, Drawer, Select, Textarea, formatDateIN, toast, todayISOIST } from '../../ui';
import { ChainPreview } from '../workflows/ChainPreview';
import { sandwichPreviewCopy, type LeaveSkip } from './leave-preview';

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

interface LeaveApplyPreview {
  days: number;
  available: number;
  remaining: number;
  skipped: LeaveSkip[];
  blackouts: { date: string; name: string }[];
  coverage: { blocked: boolean; warnings: string[] };
  blocked: boolean;
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
  const [preview, setPreview] = useState<LeaveApplyPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipPersistRef = useRef(true);
  const draftAppliedRef = useRef(false);
  const selected = leaveTypes.find((type) => type.code === typeCode);

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

  useEffect(() => {
    if (!open || !from || !to || !typeCode) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    const fromHalf = halfDay ? 'true' : 'false';
    const path = `/api/leave/preview?leaveType=${encodeURIComponent(typeCode)}&from=${from}&to=${to}&fromHalf=${fromHalf}&toHalf=false`;
    void apiFetch<LeaveApplyPreview>(path)
      .then((result) => {
        if (!cancelled) {
          setPreview(result);
          setPreviewError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setPreview(null);
          setPreviewError(cause instanceof Error ? cause.message : 'Could not preview this leave.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, typeCode, from, to, halfDay]);

  const submit = async () => {
    if (!typeCode || !from || !to || reason.trim().length < 3) {
      setError('Choose a leave type and dates, then add a short reason.');
      return;
    }
    if (preview?.blocked) {
      setError(
        preview.blackouts[0]
          ? `Leave is blocked on ${formatDateIN(preview.blackouts[0].date)} (${preview.blackouts[0].name}).`
          : (preview.coverage.warnings[0] ?? 'Coverage policy is blocking this leave.'),
      );
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
        {preview && selected && from && to && (
          <div className="rounded-row bg-surface-2 px-4 py-3 text-sm">
            <p className="font-semibold text-ink">
              Preview · {preview.days.toLocaleString('en-IN')} day
              {preview.days === 1 ? '' : 's'} of {selected.name}
            </p>
            <p className="mt-1 text-ink-muted">
              {formatDateIN(from)}
              {from === to ? '' : ` – ${formatDateIN(to)}`}
              {` · ${sandwichPreviewCopy(selected.sandwichRule, preview.skipped)}`}
              . This is the debit that will be submitted.
            </p>
            <p className="mt-2 tabular-nums text-ink">
              {preview.remaining >= 0
                ? `${preview.remaining.toLocaleString('en-IN')} of ${preview.available.toLocaleString('en-IN')} days would remain`
                : `This preview is ${Math.abs(preview.remaining).toLocaleString('en-IN')} days over the ${preview.available.toLocaleString('en-IN')} available`}
            </p>
            <p className="mt-2 text-ink-muted">
              Applying now reserves the days so they are not treated as unauthorised absence.
            </p>
          </div>
        )}
        {previewError !== null && (
          <p className="rounded-row bg-surface-2 px-4 py-3 text-sm text-ink" role="status">
            {previewError}
          </p>
        )}
        {selected?.maxPerRequest !== null && selected?.maxPerRequest !== undefined && (
          <p className="rounded-row bg-surface-2 px-4 py-3 text-sm text-ink">
            Policy cap: {selected.maxPerRequest.toLocaleString('en-IN')} days per request
          </p>
        )}
        {preview && preview.blackouts.length > 0 && (
          <div className="rounded-row bg-surface-2 px-4 py-3 text-sm text-ink" role="alert">
            {preview.blackouts.map((hit) => (
              <p key={`${hit.date}-${hit.name}`}>
                Leave is blocked on {formatDateIN(hit.date)} ({hit.name}).
              </p>
            ))}
          </div>
        )}
        {preview && preview.coverage.warnings.length > 0 && (
          <div
            className="rounded-row bg-surface-2 px-4 py-3 text-sm text-ink"
            role={preview.coverage.blocked ? 'alert' : 'status'}
          >
            {preview.coverage.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
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
        <ChainPreview definitionCode={typeCode === 'CO' ? 'comp_off' : 'leave'} />
      </div>
    </Drawer>
  );
}
