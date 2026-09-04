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
  TextField,
  toast,
} from '../../ui';
import type { Column } from '../../ui';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { useDashboardResource } from '../home/useDashboardResource';
import { formatDateIN } from '../../ui';
import { BLANK_SHIFT, ShiftEditor, normalizeShift, type ShiftRecord } from './ShiftEditor';
import { DepartmentsPanel } from './DepartmentsPanel';
import { CompaniesPanel, PlantsPanel } from './OrgMastersPage';
import { CostCentersPanel, MisPanel } from './OrgMisCostCenterPanels';

interface Holiday {
  date: string;
  name: string;
  locationId: number | null;
}

type MasterTab =
  | 'shifts'
  | 'holidays'
  | 'companies'
  | 'plants'
  | 'mis'
  | 'costCenters'
  | 'departments';

const MASTER_TABS: { id: MasterTab; label: string }[] = [
  { id: 'shifts', label: 'Shifts' },
  { id: 'holidays', label: 'Holidays' },
  { id: 'companies', label: 'Companies' },
  { id: 'plants', label: 'Plants' },
  { id: 'mis', label: 'MIS codes' },
  { id: 'costCenters', label: 'Cost centres' },
  { id: 'departments', label: 'Departments' },
];

export function AttendanceMastersPage({ user }: { user: SessionUser }) {
  const [tab, setTab] = useState<MasterTab>('shifts');
  const canEdit = hasPermission(user, 'admin.settings');

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">Master control</p>
          <h1 className="mt-1 text-4xl font-light tracking-tight text-ink">
            Master data
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Attendance rules and Finance-owned organisation codes in one controlled, audited place.
          </p>
        </div>
        <div
          className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface-2 p-1"
          role="tablist"
          aria-label="Master data sections"
        >
          {MASTER_TABS.map((entry) => (
            <Button
              key={entry.id}
              size="sm"
              role="tab"
              aria-selected={tab === entry.id}
              variant={tab === entry.id ? 'primary' : 'ghost'}
              onClick={() => {
                setTab(entry.id);
              }}
            >
              {entry.label}
            </Button>
          ))}
        </div>
      </header>

      {tab === 'shifts' ? <ShiftsPanel canEdit={canEdit} /> : null}
      {tab === 'holidays' ? <HolidaysPanel canEdit={canEdit} /> : null}
      {tab === 'companies' ? <CompaniesPanel canEdit={canEdit} /> : null}
      {tab === 'plants' ? <PlantsPanel canEdit={canEdit} /> : null}
      {tab === 'mis' ? <MisPanel canEdit={canEdit} /> : null}
      {tab === 'costCenters' ? <CostCentersPanel canEdit={canEdit} /> : null}
      {tab === 'departments' ? <DepartmentsPanel canEdit={canEdit} /> : null}
    </div>
  );
}

function ShiftsPanel({ canEdit }: { canEdit: boolean }) {
  const shifts = useDashboardResource<ShiftRecord[]>('/api/attendance/config/shifts');
  const [editing, setEditing] = useState<ShiftRecord | null>(null);

  if (shifts.loading) return <DashboardSkeleton />;
  if (shifts.error) return <DashboardError message={shifts.error} onRetry={shifts.reload} />;

  const columns: Column<ShiftRecord>[] = [
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
              setEditing(normalizeShift(row));
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


function HolidaysPanel({ canEdit }: { canEdit: boolean }) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const holidays = useDashboardResource<Holiday[]>(`/api/attendance/config/holidays/admin?year=${String(year)}`);
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
