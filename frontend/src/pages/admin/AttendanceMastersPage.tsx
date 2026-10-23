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
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Plus } from 'lucide-react';
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
  IconButton,
  MonthCalendar,
  Pill,
  Select,
  StatusBadge,
  TextField,
  collapseDaySpans,
  toast,
  todayISOIST,
} from '../../ui';
import type { AttendanceDay } from '../../ui';
import type { Column } from '../../ui';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { useDashboardResource } from '../home/useDashboardResource';
import { formatDateIN } from '../../ui';
import { BLANK_SHIFT, ShiftEditor, normalizeShift, type ShiftRecord } from './ShiftEditor';

interface Holiday {
  date: string;
  name: string;
  companyId: number | null;
  plantId: number | null;
  locationId: number | null;
}

interface HolidayTargets {
  groupWide: boolean;
  companies: { id: number; name: string; code: string }[];
  plants: { id: number; companyId: number; name: string; plantCode: string }[];
  locations: { id: number; companyId: number; name: string }[];
}

export function AttendanceMastersPage({ user }: { user: SessionUser }) {
  const canEditShifts = hasPermission(user, 'admin.settings');
  const [tab, setTab] = useState<'shifts' | 'holidays'>(canEditShifts ? 'shifts' : 'holidays');
  const canEdit = canEditShifts;

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
        <div className="flex min-w-0 max-w-full overflow-x-auto rounded-full bg-surface-2 p-1 [scrollbar-width:none] [&>*]:shrink-0">
          {canEditShifts && (
            <Button
              size="sm"
              variant={tab === 'shifts' ? 'primary' : 'ghost'}
              onClick={() => {
                setTab('shifts');
              }}
            >
              Shifts
            </Button>
          )}
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

      {tab === 'shifts' ? <ShiftsPanel canEdit={canEdit} /> : <HolidaysPanel canEdit={canEdit || hasPermission(user, 'attendance.holidays.manage')} />}
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
  const [viewMonth, setViewMonth] = useState(() => Number(todayISOIST().slice(5, 7)));
  const holidays = useDashboardResource<Holiday[]>(`/api/attendance/config/holidays?year=${String(year)}`);
  const [targets, setTargets] = useState<HolidayTargets | null>(null);
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [plantId, setPlantId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groupWide = targets?.groupWide === true;
  const companies = targets?.companies ?? [];

  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    void apiFetch<HolidayTargets>('/api/attendance/config/holiday-targets')
      .then((result) => {
        if (!cancelled) setTargets(result);
      })
      .catch(() => {
        if (!cancelled) setTargets({ groupWide: false, companies: [], plants: [], locations: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [canEdit]);

  useEffect(() => {
    const only = targets?.companies.length === 1 ? targets.companies[0] : undefined;
    if (!adding || targets?.groupWide || only === undefined) return;
    setCompanyId(String(only.id));
  }, [adding, targets]);

  const years = useMemo(() => [thisYear - 1, thisYear, thisYear + 1], [thisYear]);
  const monthKey = `${String(year)}-${String(viewMonth).padStart(2, '0')}`;
  const monthRows = (holidays.data ?? []).filter((row) => row.date.startsWith(monthKey));
  const holidaySpans = collapseDaySpans(monthRows.map((row) => ({ iso: row.date, label: row.name, tone: 'holiday' as const })));
  const holidayDays: Partial<Record<number, AttendanceDay>> = Object.fromEntries(
    monthRows.map((row) => [Number(row.date.slice(-2)), { state: 'holiday' as const, note: row.name }]),
  );
  const monthTitle = new Intl.DateTimeFormat('en-IN', { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, viewMonth - 1, 1)),
  );

  const save = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || name.trim() === '') {
      setError('Pick a date and give the holiday a name.');
      return;
    }
    if (!groupWide && companyId === '') {
      setError(companies.length === 0
        ? 'No company is in your holiday scope. Ask a group admin to add the calendar.'
        : 'Choose the company this holiday applies to.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/api/attendance/config/holidays', {
        method: 'PUT',
        body: JSON.stringify({
          date,
          name: name.trim(),
          companyId: companyId === '' ? null : Number(companyId),
          plantId: plantId === '' ? null : Number(plantId),
          locationId: locationId === '' ? null : Number(locationId),
        }),
      });
      toast.success('Holiday saved', { description: `${formatDateIN(date)} — ${name.trim()}` });
      setAdding(false);
      setDate('');
      setName('');
      setCompanyId('');
      setPlantId('');
      setLocationId('');
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
        row.locationId !== null ? <Pill>One location</Pill>
          : row.plantId !== null ? <Pill>One plant</Pill>
            : row.companyId !== null ? <Pill>One company</Pill>
              : <Pill>Whole group</Pill>,
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
              <div className="flex min-w-0 max-w-full overflow-x-auto rounded-full bg-surface-2 p-1 [scrollbar-width:none] [&>*]:shrink-0">
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

      <Card>
        <CardHeader
          title={monthTitle}
          subtitle="Each holiday sits on its date. The table below is the year you can edit."
          action={
            <div className="flex gap-1">
              <IconButton
                label="Previous month"
                icon={<ChevronLeft />}
                size="sm"
                onClick={() => { setViewMonth((current) => (current === 1 ? 12 : current - 1)); }}
              />
              <IconButton
                label="Next month"
                icon={<ChevronRight />}
                size="sm"
                onClick={() => { setViewMonth((current) => (current === 12 ? 1 : current + 1)); }}
              />
            </div>
          }
        />
        <MonthCalendar year={year} month={viewMonth} days={holidayDays} spans={holidaySpans} showLegend={false} />
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
          {targets === null ? (
            <p className="text-sm text-ink-muted" role="status">Loading the companies you can update…</p>
          ) : groupWide ? (
            <Select
              label="Company"
              value={companyId}
              onChange={(next) => { setCompanyId(next); setPlantId(''); setLocationId(''); }}
              options={[
                { value: '', label: 'Whole group', description: 'Every company' },
                ...companies.map((company) => ({ value: String(company.id), label: `${company.name} (${company.code})` })),
              ]}
            />
          ) : (
            <Select
              label="Company"
              required
              value={companyId}
              onChange={(next) => { setCompanyId(next); setPlantId(''); setLocationId(''); }}
              options={companies.map((company) => ({ value: String(company.id), label: `${company.name} (${company.code})` }))}
              hint={companies.length === 0 ? 'No company is in your holiday scope.' : 'This holiday applies to that company only.'}
            />
          )}
          {companyId !== '' && (
            <>
              <Select
                label="Plant"
                value={plantId}
                onChange={setPlantId}
                options={[
                  { value: '', label: 'Whole company', description: 'Not limited to one plant' },
                  ...(targets?.plants ?? []).filter((plant) => String(plant.companyId) === companyId).map((plant) => ({
                    value: String(plant.id),
                    label: `${plant.name} (${plant.plantCode})`,
                  })),
                ]}
              />
              <Select
                label="Location"
                value={locationId}
                onChange={setLocationId}
                options={[
                  { value: '', label: 'Every location', description: 'Not limited to one site' },
                  ...(targets?.locations ?? []).filter((location) => String(location.companyId) === companyId).map((location) => ({
                    value: String(location.id),
                    label: location.name,
                  })),
                ]}
              />
            </>
          )}
          {error !== null && (
            <p className="text-sm text-negative-ink" role="alert">
              {error}
            </p>
          )}
          <p className="text-xs leading-5 text-ink-muted">
            {groupWide && companyId === ''
              ? 'Saved for the whole group. '
              : plantId !== '' || locationId !== ''
                ? 'Saved for the company, narrowed to the plant or location you choose. '
                : 'Saved for the company you choose. '}
            Adding a holiday marks the day non-working for future processing; already-locked months are unaffected.
          </p>
        </div>
      </Drawer>
    </>
  );
}
