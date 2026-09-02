/**
 * Attendance masters (ATT-01/ATT-04, docs/04 §1) — shifts and the holiday
 * calendar as editable data.
 *
 * These two tables decide what "late", "half day", "full day" and "holiday"
 * mean for every processed attendance day, so they belong to HR, not to a
 * deploy. Both write paths are gated on `admin.settings` and audited.
 *
 * Changing a shift does not retroactively rewrite closed days — recomputation
 * is explicit, and locked months stay frozen.
 */
import { useMemo, useState } from 'react';
import { CalendarDays, Clock, Plus } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { SessionUser } from '../../lib/session';
import { hasPermission } from '../../lib/session';
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  Drawer,
  EmptyState,
  Pill,
  StatusBadge,
  Switch,
  TextField,
  toast,
} from '../../ui';
import type { Column } from '../../ui';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { useDashboardResource } from '../home/useDashboardResource';
import { formatDateIN } from '../../ui';

interface Shift {
  id: number;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  sessionSplit: string | null;
  graceInMinutes: number;
  graceOutMinutes: number;
  minHalfDayHours: number;
  minFullDayHours: number;
  breakMinutes: number;
  isActive: boolean;
}

interface Holiday {
  date: string;
  name: string;
  locationId: number | null;
}

const BLANK_SHIFT: Shift = {
  id: 0,
  code: '',
  name: '',
  startTime: '09:00',
  endTime: '18:00',
  crossesMidnight: false,
  sessionSplit: null,
  graceInMinutes: 0,
  graceOutMinutes: 0,
  minHalfDayHours: 4,
  minFullDayHours: 8,
  breakMinutes: 0,
  isActive: true,
};

export function AttendanceMastersPage({ user }: { user: SessionUser }) {
  const [tab, setTab] = useState<'shifts' | 'holidays'>('shifts');
  const canEdit = hasPermission(user, 'admin.settings');

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">Master control · attendance</p>
          <h1 className="mt-1 text-4xl font-light tracking-tight text-ink">
            Attendance masters
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Shifts define what late, half-day and full-day mean. Holidays decide which days are
            non-working. Both are data — no deploy needed.
          </p>
        </div>
        <div className="flex rounded-full bg-surface-2 p-1">
          <Button
            size="sm"
            variant={tab === 'shifts' ? 'primary' : 'ghost'}
            onClick={() => {
              setTab('shifts');
            }}
          >
            Shifts
          </Button>
          <Button
            size="sm"
            variant={tab === 'holidays' ? 'primary' : 'ghost'}
            onClick={() => {
              setTab('holidays');
            }}
          >
            Holidays
          </Button>
        </div>
      </header>

      {tab === 'shifts' ? <ShiftsPanel canEdit={canEdit} /> : <HolidaysPanel canEdit={canEdit} />}
    </div>
  );
}

function ShiftsPanel({ canEdit }: { canEdit: boolean }) {
  const shifts = useDashboardResource<Shift[]>('/api/attendance/config/shifts');
  const [editing, setEditing] = useState<Shift | null>(null);

  if (shifts.loading) return <DashboardSkeleton />;
  if (shifts.error) return <DashboardError message={shifts.error} onRetry={shifts.reload} />;

  const columns: Column<Shift>[] = [
    {
      key: 'code',
      header: 'Shift',
      width: 'minmax(180px,1fr)',
      render: (row) => (
        <div>
          <span className="font-semibold text-ink">{row.code}</span>
          <p className="mt-0.5 text-xs text-ink-muted">{row.name}</p>
        </div>
      ),
    },
    {
      key: 'window',
      header: 'Window',
      width: '150px',
      render: (row) => (
        <span className="tabular-nums text-ink">
          {row.startTime}–{row.endTime}{' '}
          {row.crossesMidnight && <Pill>+1d</Pill>}
        </span>
      ),
    },
    {
      key: 'grace',
      header: 'Grace in / out',
      width: '130px',
      render: (row) => (
        <span className="tabular-nums text-ink-muted">
          {row.graceInMinutes} / {row.graceOutMinutes} min
        </span>
      ),
    },
    {
      key: 'hours',
      header: 'Half / full day',
      width: '140px',
      render: (row) => (
        <span className="tabular-nums text-ink-muted">
          {row.minHalfDayHours}h / {row.minFullDayHours}h
        </span>
      ),
    },
    {
      key: 'break',
      header: 'Break',
      width: '90px',
      render: (row) => <span className="tabular-nums text-ink-muted">{row.breakMinutes}m</span>,
    },
    {
      key: 'active',
      header: 'Status',
      width: '110px',
      render: (row) => (
        <StatusBadge tone={row.isActive ? 'positive' : 'neutral'}>
          {row.isActive ? 'Active' : 'Retired'}
        </StatusBadge>
      ),
    },
    {
      key: 'act',
      header: '',
      width: '90px',
      render: (row) =>
        canEdit ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(row);
            }}
          >
            Edit
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <Card>
        <CardHeader
          title={`${(shifts.data ?? []).length.toLocaleString('en-IN')} shifts`}
          subtitle="att.shifts — referenced by rosters and the day-status processor."
          action={
            canEdit ? (
              <Button
                size="sm"
                variant="primary"
                leadingIcon={<Plus className="size-4" />}
                onClick={() => {
                  setEditing({ ...BLANK_SHIFT });
                }}
              >
                New shift
              </Button>
            ) : undefined
          }
        />
      </Card>

      <DataTable
        rows={shifts.data ?? []}
        columns={columns}
        rowKey={(row) => row.code}
        maxHeight={620}
        empty={
          <EmptyState icon={<Clock />} title="No shifts defined" description="Create the first shift." />
        }
      />

      <ShiftEditor
        shift={editing}
        onClose={() => {
          setEditing(null);
        }}
        onSaved={() => {
          setEditing(null);
          shifts.reload();
        }}
      />
    </>
  );
}

function ShiftEditor({
  shift,
  onClose,
  onSaved,
}: {
  shift: Shift | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Shift>(BLANK_SHIFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const identity = shift === null ? null : `${String(shift.id)}:${shift.code}`;
  if (shift !== null && loadedFor !== identity) {
    setLoadedFor(identity);
    setDraft(shift);
    setError(null);
  }

  const isNew = shift?.id === 0;
  const set = (patch: Partial<Shift>) => {
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
          sessionSplit: draft.sessionSplit,
          graceInMinutes: draft.graceInMinutes,
          graceOutMinutes: draft.graceOutMinutes,
          minHalfDayHours: draft.minHalfDayHours,
          minFullDayHours: draft.minFullDayHours,
          breakMinutes: draft.breakMinutes,
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
      subtitle="att.shifts · audited"
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

        <TextField
          label="Break (min)"
          type="number"
          value={String(draft.breakMinutes)}
          hint="Deducted from worked minutes before the half/full-day test."
          onChange={(e) => {
            set({ breakMinutes: Number(e.currentTarget.value) });
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

function HolidaysPanel({ canEdit }: { canEdit: boolean }) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const holidays = useDashboardResource<Holiday[]>(`/api/attendance/config/holidays?year=${String(year)}`);
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const years = useMemo(() => [thisYear - 1, thisYear, thisYear + 1], [thisYear]);

  const save = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || name.trim() === '') {
      setError('Pick a date and give the holiday a name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/api/attendance/config/holidays', {
        method: 'PUT',
        body: JSON.stringify({ date, name: name.trim(), locationId: null }),
      });
      toast.success('Holiday saved', { description: `${formatDateIN(date)} — ${name.trim()}` });
      setAdding(false);
      setDate('');
      setName('');
      holidays.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the holiday.');
    } finally {
      setSaving(false);
    }
  };

  if (holidays.loading) return <DashboardSkeleton />;
  if (holidays.error) return <DashboardError message={holidays.error} onRetry={holidays.reload} />;

  const columns: Column<Holiday>[] = [
    {
      key: 'date',
      header: 'Date',
      width: '160px',
      render: (row) => <span className="tabular-nums text-ink">{formatDateIN(row.date)}</span>,
    },
    {
      key: 'day',
      header: 'Day',
      width: '120px',
      render: (row) => (
        <span className="text-ink-muted">
          {new Date(`${row.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long' })}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Holiday',
      width: 'minmax(220px,1.5fr)',
      render: (row) => <span className="font-semibold text-ink">{row.name}</span>,
    },
    {
      key: 'scope',
      header: 'Scope',
      width: '140px',
      render: (row) =>
        row.locationId === null ? <Pill>All locations</Pill> : <Pill>Location #{row.locationId}</Pill>,
    },
  ];

  return (
    <>
      <Card>
        <CardHeader
          title={`${(holidays.data ?? []).length.toLocaleString('en-IN')} holidays in ${String(year)}`}
          subtitle="att.holidays — a holiday makes the day non-working for the day-status processor."
          action={
            <div className="flex items-center gap-2">
              <div className="flex rounded-full bg-surface-2 p-1">
                {years.map((y) => (
                  <Button
                    key={y}
                    size="sm"
                    variant={year === y ? 'primary' : 'ghost'}
                    onClick={() => {
                      setYear(y);
                    }}
                  >
                    {y}
                  </Button>
                ))}
              </div>
              {canEdit && (
                <Button
                  size="sm"
                  variant="primary"
                  leadingIcon={<Plus className="size-4" />}
                  onClick={() => {
                    setAdding(true);
                  }}
                >
                  Add
                </Button>
              )}
            </div>
          }
        />
      </Card>

      <DataTable
        rows={holidays.data ?? []}
        columns={columns}
        rowKey={(row) => `${row.date}-${String(row.locationId ?? 0)}`}
        maxHeight={620}
        empty={
          <EmptyState
            icon={<CalendarDays />}
            title={`No holidays loaded for ${String(year)}`}
            description="Add the year’s calendar so attendance processing marks them non-working."
          />
        }
      />

      <Drawer
        open={adding}
        onClose={() => {
          setAdding(false);
        }}
        title="Add holiday"
        subtitle="att.holidays · audited"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setAdding(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={() => void save()}>
              Save holiday
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <TextField
            label="Date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.currentTarget.value);
            }}
          />
          <TextField
            label="Holiday name"
            placeholder="e.g. Independence Day"
            value={name}
            onChange={(e) => {
              setName(e.currentTarget.value);
            }}
          />
          {error !== null && (
            <p className="text-sm text-negative" role="alert">
              {error}
            </p>
          )}
          <p className="text-xs leading-5 text-ink-muted">
            Saved for all locations. Adding a holiday marks the day non-working for future
            processing; already-locked months are unaffected.
          </p>
        </div>
      </Drawer>
    </>
  );
}
