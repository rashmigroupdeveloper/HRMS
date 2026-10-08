/**
 * R1 Muster Summary — snapshot-backed list + Excel with docs/06 filter set.
 * List and export share the same query string (RPT-06).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import {
  Button,
  Card,
  Checkbox,
  DarkCard,
  DataTable,
  EmptyState,
  KpiNumber,
  PageHeader,
  StatusBadge,
  TextField,
  toast,
} from '../../ui';
import type { Column } from '../../ui';
import { currentMonthIST } from '../home/dashboard-format';
import { defaultCompanyId, qs, rememberCompanyId } from './report-utils';

interface MusterRow {
  ecode: string;
  employeeName: string;
  reportingManager: string | null;
  functionalManager: string | null;
  department: string | null;
  designation: string | null;
  orgUnit: string | null;
  costCenter: string | null;
  category: string | null;
  dayStatuses: Record<string, string>;
  present: number;
  absent: number;
  halfDays: number;
  leaveDays: number;
  uabDays: number;
  lopDays: number;
  otHours: number;
}

interface MusterFilters {
  companyId: string;
  month: string;
  department: string;
  costCenter: string;
  location: string;
  orgUnit: string;
  category: string;
  employeeStatus: string;
  reportingManagerId: string;
  subtree: boolean;
  ecode: string;
}

function buildMusterQuery(f: MusterFilters): Record<string, string | number | boolean | undefined> {
  return {
    companyId: Number(f.companyId),
    month: f.month,
    department: f.department || undefined,
    costCenter: f.costCenter || undefined,
    location: f.location || undefined,
    orgUnit: f.orgUnit || undefined,
    category: f.category || undefined,
    employeeStatus: f.employeeStatus || undefined,
    reportingManagerId: /^\d+$/.test(f.reportingManagerId)
      ? Number(f.reportingManagerId)
      : undefined,
    subtree: f.subtree || undefined,
    ecode: f.ecode || undefined,
  };
}

function monthCaption(ym: string): string {
  const [year, month] = ym.split('-');
  if (year === undefined || month === undefined) return ym;
  return new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const columns: Column<MusterRow>[] = [
  {
    key: 'employee',
    header: 'Employee',
    width: 'minmax(180px,1.4fr)',
    render: (row) => (
      <div>
        <p className="font-semibold text-ink">{row.employeeName}</p>
        <p className="text-xs text-ink-muted">{row.ecode}</p>
      </div>
    ),
  },
  {
    key: 'department',
    header: 'Department',
    width: '140px',
    render: (row) => row.department ?? '—',
  },
  {
    key: 'manager',
    header: 'Reporting manager',
    width: '160px',
    render: (row) => row.reportingManager ?? '—',
  },
  {
    key: 'cc',
    header: 'Cost centre / plant',
    width: '150px',
    render: (row) => row.costCenter ?? '—',
  },
  {
    key: 'cat',
    header: 'Category',
    width: '110px',
    render: (row) => row.category ?? '—',
  },
  { key: 'present', header: 'P', width: '56px', numeric: true, render: (row) => row.present },
  { key: 'absent', header: 'A', width: '56px', numeric: true, render: (row) => row.absent },
  { key: 'hd', header: 'HD', width: '56px', numeric: true, render: (row) => row.halfDays },
  { key: 'leave', header: 'Leave', width: '64px', numeric: true, render: (row) => row.leaveDays },
  {
    key: 'uab',
    header: 'UAB',
    width: '64px',
    numeric: true,
    render: (row) => (
      <StatusBadge tone={row.uabDays ? 'negative' : 'neutral'}>{row.uabDays}</StatusBadge>
    ),
  },
  {
    key: 'lop',
    header: 'LOP',
    width: '64px',
    numeric: true,
    render: (row) => row.lopDays,
  },
  { key: 'ot', header: 'OT hrs', width: '72px', numeric: true, render: (row) => row.otHours },
];

export function MusterPage() {
  const [filters, setFilters] = useState<MusterFilters>({
    companyId: defaultCompanyId(),
    month: currentMonthIST(),
    department: '',
    costCenter: '',
    location: '',
    orgUnit: '',
    category: '',
    employeeStatus: 'active',
    reportingManagerId: '',
    subtree: false,
    ecode: '',
  });
  const [rows, setRows] = useState<MusterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const valid = /^\d+$/.test(filters.companyId);
  const queryString = useMemo(() => qs(buildMusterQuery(filters)), [filters]);
  const monthColumns = useMemo(() => {
    const [year = 0, month = 1] = filters.month.split('-').map(Number);
    const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const days: Column<MusterRow>[] = Array.from({ length: dayCount }, (_, index) => {
      const day = String(index + 1).padStart(2, '0');
      return {
        key: `day${day}`,
        header: day,
        width: '56px',
        render: (row) => <span className="text-xs tabular-nums">{row.dayStatuses[day] ?? '—'}</span>,
      };
    });
    return [...columns.slice(0, 5), ...days, ...columns.slice(5)];
  }, [filters.month]);
  const totals = useMemo(() => {
    let present = 0;
    let uab = 0;
    let lop = 0;
    for (const row of rows) {
      present += row.present;
      uab += row.uabDays;
      lop += row.lopDays;
    }
    return { present, uab, lop };
  }, [rows]);

  const patch = (partial: Partial<MusterFilters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...partial };
      if (partial.companyId !== undefined) rememberCompanyId(partial.companyId);
      return next;
    });
  };

  const load = useCallback(
    async (rebuild: boolean) => {
      if (!valid) {
        setError('Enter a valid company ID.');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        if (rebuild) {
          await apiFetch('/api/reports/muster/build', {
            method: 'POST',
            body: JSON.stringify({
              companyId: Number(filters.companyId),
              month: filters.month,
            }),
          });
        }
        setRows(await apiFetch<MusterRow[]>(`/api/reports/muster${queryString}`));
        setHasLoaded(true);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Muster could not be loaded.');
      } finally {
        setLoading(false);
      }
    },
    [filters.companyId, filters.month, queryString, valid],
  );

  useEffect(() => {
    if (/^\d+$/.test(defaultCompanyId())) void load(false);
    // Current month + remembered company and filters — do not refetch while typing.
  }, []);

  const download = async () => {
    if (!valid) {
      setError('Enter a valid company ID.');
      return;
    }
    setLoading(true);
    try {
      const file = await apiFetch<{ filename: string; base64: string }>(
        `/api/reports/muster/export${queryString}`,
      );
      const bytes = Uint8Array.from(atob(file.base64), (character) => character.charCodeAt(0));
      const url = URL.createObjectURL(
        new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('Muster export prepared', {
        description: `${file.filename} · ${String(rows.length)} on-screen rows`,
      });
    } catch (cause) {
      toast.error('Export failed', {
        description: cause instanceof Error ? cause.message : 'Try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="RPT-01 · snapshot-backed"
        title="Muster summary"
        description="On-screen grid and Excel use the same filters (entity, plant, cost centre, department, RM subtree, category, status)."
      />

      <DarkCard>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hero-muted">
          {monthCaption(filters.month)}
        </p>
        {rows.length ? (
          <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-4xl font-light tabular-nums">
                <KpiNumber value={rows.length} animateOnMount={false} />
              </p>
              <p className="mt-1 text-sm text-hero-muted">
                employees ·{' '}
                <span className="tabular-nums">
                  <KpiNumber value={totals.present} animateOnMount={false} /> present days
                </span>
                {' · '}
                <span className="tabular-nums">
                  <KpiNumber value={totals.uab} animateOnMount={false} /> UAB days
                </span>
                {totals.uab
                  ? ' — unauthorised absence becomes LOP unless regularised'
                  : ' · no unauthorised absence in this view'}
                {totals.lop ? (
                  <>
                    {' · '}
                    <span className="tabular-nums">
                      <KpiNumber value={totals.lop} animateOnMount={false} /> LOP days
                    </span>
                  </>
                ) : null}
              </p>
            </div>
            <Button
              variant="primary"
              disabled={!rows.length}
              loading={loading}
              leadingIcon={<Download className="size-4" />}
              onClick={() => void download()}
            >
              Export Excel
            </Button>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-2xl font-light text-hero-ink">
              {hasLoaded ? 'No employees match these filters' : 'No snapshot loaded'}
            </p>
            <p className="mt-1 text-sm text-hero-muted">
              {hasLoaded
                ? 'The snapshot is loaded. Widen filters, or rebuild if the month looks stale.'
                : 'Defaults to this month. Rebuild the snapshot, then tighten filters — list and export stay in lockstep.'}
            </p>
          </div>
        )}
      </DarkCard>

      <Card>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 md:items-end">
          <TextField
            label="Company ID"
            value={filters.companyId}
            onChange={(event) => {
              patch({ companyId: event.currentTarget.value });
            }}
            error={error && !valid ? error : undefined}
          />
          <TextField
            label="Month"
            type="month"
            value={filters.month}
            onChange={(event) => {
              patch({ month: event.currentTarget.value });
            }}
          />
          <TextField
            label="Department"
            value={filters.department}
            onChange={(event) => {
              patch({ department: event.currentTarget.value });
            }}
            placeholder="Contains…"
          />
          <TextField
            label="Cost centre code"
            value={filters.costCenter}
            onChange={(event) => {
              patch({ costCenter: event.currentTarget.value });
            }}
            placeholder="e.g. 1701"
          />
        </div>

        {showMore ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4 md:items-end">
            <TextField
              label="Plant / location"
              value={filters.location}
              onChange={(event) => {
                patch({ location: event.currentTarget.value });
              }}
            />
            <TextField
              label="Org unit"
              value={filters.orgUnit}
              onChange={(event) => {
                patch({ orgUnit: event.currentTarget.value });
              }}
            />
            <TextField
              label="Category"
              value={filters.category}
              onChange={(event) => {
                patch({ category: event.currentTarget.value });
              }}
              placeholder="white_collar / blue_collar…"
            />
            <TextField
              label="Employee status"
              value={filters.employeeStatus}
              onChange={(event) => {
                patch({ employeeStatus: event.currentTarget.value });
              }}
              placeholder="active / on_notice / exited"
            />
            <TextField
              label="Reporting manager ID"
              value={filters.reportingManagerId}
              onChange={(event) => {
                patch({ reportingManagerId: event.currentTarget.value });
              }}
              placeholder="Employee id of RM"
            />
            <TextField
              label="Emp ID"
              value={filters.ecode}
              onChange={(event) => {
                patch({ ecode: event.currentTarget.value });
              }}
              placeholder="Contains e-code…"
            />
            <div className="flex items-end pb-2">
              <Checkbox
                label="Entire RM subtree"
                checked={filters.subtree}
                onChange={(event) => {
                  patch({ subtree: event.currentTarget.checked });
                }}
              />
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowMore((v) => !v);
            }}
          >
            {showMore ? 'Fewer filters' : 'More filters'}
          </Button>
          <Button loading={loading} leadingIcon={<RefreshCw className="size-4" />} onClick={() => void load(true)}>
            Rebuild & view
          </Button>
          <Button variant="secondary" loading={loading} onClick={() => void load(false)}>
            Apply filters
          </Button>
        </div>
        {error && valid ? (
          <p className="mt-3 text-sm text-negative" role="alert">
            {error}
          </p>
        ) : null}
      </Card>

      <DataTable
        rows={rows}
        columns={monthColumns}
        rowKey={(row) => row.ecode}
        maxHeight={620}
        empty={
          <EmptyState
            icon={<FileSpreadsheet />}
            title={hasLoaded ? 'No matching employees' : 'No muster loaded'}
            description={
              hasLoaded
                ? 'Widen or clear filters. List and Excel use the same query.'
                : 'Rebuild the monthly snapshot, then tighten filters if needed. List and Excel use the same query.'
            }
            action={
              <Button variant="primary" loading={loading} onClick={() => void load(true)}>
                Rebuild & view
              </Button>
            }
          />
        }
      />
    </div>
  );
}
