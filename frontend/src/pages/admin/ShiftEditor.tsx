/**
 * SHF-01 shift editor — every micro-policy field is required on save.
 * Slabs are two numbers, not a JSON blob.
 */
import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { Button, Drawer, Switch, TextField, toast } from '../../ui';
import { slabsFromThresholds, thresholdsFromSlabs, type TimeSlabDraft } from './shift-slabs';

export interface ShiftRecord {
  id: number;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  sessionSplit: string | null;
  session2Start: string | null;
  session2End: string | null;
  graceInMinutes: number;
  graceOutMinutes: number;
  minHalfDayHours: number;
  minFullDayHours: number;
  breakMinutes: number;
  breakPaid: boolean;
  otStartOffsetMinutes: number;
  lateSlabs: TimeSlabDraft[];
  earlyExitSlabs: TimeSlabDraft[];
  allowanceComponentCode: string | null;
  isActive: boolean;
}

export const BLANK_SHIFT: ShiftRecord = {
  id: 0,
  code: '',
  name: '',
  startTime: '09:00',
  endTime: '18:00',
  crossesMidnight: false,
  sessionSplit: null,
  session2Start: null,
  session2End: null,
  graceInMinutes: 0,
  graceOutMinutes: 0,
  minHalfDayHours: 4,
  minFullDayHours: 8,
  breakMinutes: 0,
  breakPaid: false,
  otStartOffsetMinutes: 0,
  lateSlabs: [],
  earlyExitSlabs: [],
  allowanceComponentCode: null,
  isActive: true,
};

export function normalizeShift(row: Partial<ShiftRecord> & Pick<ShiftRecord, 'code' | 'name'>): ShiftRecord {
  return {
    ...BLANK_SHIFT,
    ...row,
    lateSlabs: row.lateSlabs ?? [],
    earlyExitSlabs: row.earlyExitSlabs ?? [],
    breakPaid: row.breakPaid ?? false,
    otStartOffsetMinutes: row.otStartOffsetMinutes ?? 0,
    session2Start: row.session2Start ?? null,
    session2End: row.session2End ?? null,
    allowanceComponentCode: row.allowanceComponentCode ?? null,
  };
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function ShiftEditor({
  shift,
  onClose,
  onSaved,
}: {
  shift: ShiftRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<ShiftRecord>(BLANK_SHIFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [lateUntil, setLateUntil] = useState(0);
  const [lateHalfAfter, setLateHalfAfter] = useState(0);
  const [earlyUntil, setEarlyUntil] = useState(0);
  const [earlyHalfAfter, setEarlyHalfAfter] = useState(0);

  const identity = shift === null ? null : `${String(shift.id)}:${shift.code}`;
  if (shift !== null && loadedFor !== identity) {
    setLoadedFor(identity);
    const next = normalizeShift(shift);
    setDraft(next);
    const late = thresholdsFromSlabs(next.lateSlabs);
    const early = thresholdsFromSlabs(next.earlyExitSlabs);
    setLateUntil(late.lateUntil);
    setLateHalfAfter(late.halfDayAfter);
    setEarlyUntil(early.lateUntil);
    setEarlyHalfAfter(early.halfDayAfter);
    setError(null);
  }

  const isNew = shift?.id === 0;
  const set = (patch: Partial<ShiftRecord>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const save = async () => {
    if (draft.code.trim() === '' || draft.name.trim() === '') {
      setError('Code and name are required.');
      return;
    }
    if (draft.minHalfDayHours > draft.minFullDayHours) {
      setError('Half-day hours cannot exceed full-day hours.');
      return;
    }
    const session2Start = emptyToNull(draft.session2Start ?? '');
    const session2End = emptyToNull(draft.session2End ?? '');
    if ((session2Start === null) !== (session2End === null)) {
      setError('Split-shift session 2 needs both a start and an end, or neither.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/attendance/config/shifts/${encodeURIComponent(draft.code.trim())}`, {
        method: 'PUT',
        body: JSON.stringify({
          code: draft.code.trim(),
          name: draft.name.trim(),
          startTime: draft.startTime,
          endTime: draft.endTime,
          crossesMidnight: draft.crossesMidnight,
          sessionSplit: emptyToNull(draft.sessionSplit ?? ''),
          session2Start,
          session2End,
          graceInMinutes: draft.graceInMinutes,
          graceOutMinutes: draft.graceOutMinutes,
          minHalfDayHours: draft.minHalfDayHours,
          minFullDayHours: draft.minFullDayHours,
          breakMinutes: draft.breakMinutes,
          breakPaid: draft.breakPaid,
          otStartOffsetMinutes: draft.otStartOffsetMinutes,
          lateSlabs: slabsFromThresholds(lateUntil, lateHalfAfter),
          earlyExitSlabs: slabsFromThresholds(earlyUntil, earlyHalfAfter),
          allowanceComponentCode: emptyToNull(draft.allowanceComponentCode ?? ''),
          isActive: draft.isActive,
        }),
      });
      toast.success(isNew ? 'Shift created' : 'Shift updated', {
        description: 'Future day processing uses the new definition; closed months stay frozen.',
      });
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the shift.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={shift !== null}
      onClose={onClose}
      title={isNew ? 'New shift' : `Shift ${draft.code}`}
      subtitle="att.shifts · audited · SHF-01"
      width={560}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            {isNew ? 'Create shift' : 'Save shift'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Code"
            value={draft.code}
            disabled={!isNew}
            hint={isNew ? 'e.g. GEN, A, B, C' : 'Code is the identity — create a new shift to change it.'}
            onChange={(e) => {
              set({ code: e.currentTarget.value.toUpperCase() });
            }}
          />
          <TextField
            label="Name"
            value={draft.name}
            onChange={(e) => {
              set({ name: e.currentTarget.value });
            }}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Start time"
            type="time"
            value={draft.startTime}
            onChange={(e) => {
              set({ startTime: e.currentTarget.value });
            }}
          />
          <TextField
            label="End time"
            type="time"
            value={draft.endTime}
            onChange={(e) => {
              set({ endTime: e.currentTarget.value });
            }}
          />
        </div>

        <Switch
          label="Crosses midnight"
          description="Night shift — the out-punch lands on the next calendar day."
          checked={draft.crossesMidnight}
          onChange={(e) => {
            set({ crossesMidnight: e.currentTarget.checked });
          }}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Session 2 start"
            type="time"
            value={draft.session2Start ?? ''}
            hint="Leave blank unless this is a split shift (G5)."
            onChange={(e) => {
              set({ session2Start: emptyToNull(e.currentTarget.value) });
            }}
          />
          <TextField
            label="Session 2 end"
            type="time"
            value={draft.session2End ?? ''}
            onChange={(e) => {
              set({ session2End: emptyToNull(e.currentTarget.value) });
            }}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Grace in (min)"
            type="number"
            value={String(draft.graceInMinutes)}
            hint="Late only after this."
            onChange={(e) => {
              set({ graceInMinutes: Number(e.currentTarget.value) });
            }}
          />
          <TextField
            label="Grace out (min)"
            type="number"
            value={String(draft.graceOutMinutes)}
            onChange={(e) => {
              set({ graceOutMinutes: Number(e.currentTarget.value) });
            }}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Min half-day hours"
            type="number"
            value={String(draft.minHalfDayHours)}
            onChange={(e) => {
              set({ minHalfDayHours: Number(e.currentTarget.value) });
            }}
          />
          <TextField
            label="Min full-day hours"
            type="number"
            value={String(draft.minFullDayHours)}
            onChange={(e) => {
              set({ minFullDayHours: Number(e.currentTarget.value) });
            }}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Break (min)"
            type="number"
            value={String(draft.breakMinutes)}
            hint="Deducted from worked minutes unless the break is paid."
            onChange={(e) => {
              set({ breakMinutes: Number(e.currentTarget.value) });
            }}
          />
          <TextField
            label="OT starts after end (min)"
            type="number"
            value={String(draft.otStartOffsetMinutes)}
            hint="Minutes after shift end before overtime begins."
            onChange={(e) => {
              set({ otStartOffsetMinutes: Number(e.currentTarget.value) });
            }}
          />
        </div>

        <Switch
          label="Break is paid"
          description="Unpaid break is deducted from worked minutes before the half/full-day test."
          checked={draft.breakPaid}
          onChange={(e) => {
            set({ breakPaid: e.currentTarget.checked });
          }}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Late until (min after grace)"
            type="number"
            value={String(lateUntil)}
            hint="0 keeps the existing hour rules. Example: 15."
            onChange={(e) => {
              setLateUntil(Number(e.currentTarget.value));
            }}
          />
          <TextField
            label="Late half-day after (min)"
            type="number"
            value={String(lateHalfAfter)}
            hint="Example: 30 forces HD beyond this."
            onChange={(e) => {
              setLateHalfAfter(Number(e.currentTarget.value));
            }}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Early-exit until (min)"
            type="number"
            value={String(earlyUntil)}
            onChange={(e) => {
              setEarlyUntil(Number(e.currentTarget.value));
            }}
          />
          <TextField
            label="Early-exit half-day after (min)"
            type="number"
            value={String(earlyHalfAfter)}
            onChange={(e) => {
              setEarlyHalfAfter(Number(e.currentTarget.value));
            }}
          />
        </div>

        <TextField
          label="Shift allowance component"
          value={draft.allowanceComponentCode ?? ''}
          hint="Payroll component code. Leave blank if this shift has no allowance."
          onChange={(e) => {
            set({ allowanceComponentCode: emptyToNull(e.currentTarget.value) });
          }}
        />

        <Switch
          label="Active"
          description="Retired shifts stay on historical rosters but cannot be newly assigned."
          checked={draft.isActive}
          onChange={(e) => {
            set({ isActive: e.currentTarget.checked });
          }}
        />

        {error !== null && (
          <p className="text-sm text-negative" role="alert">
            {error}
          </p>
        )}
      </div>
    </Drawer>
  );
}
