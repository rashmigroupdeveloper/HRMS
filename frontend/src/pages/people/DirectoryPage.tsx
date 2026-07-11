/**
 * Employee directory (P0-T33, docs/05 §4.2) — FilterPanel + DataTable.
 * Composed only from `frontend/src/ui` (§0.1 firewall).
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SlidersHorizontal, Users } from 'lucide-react';
import { apiFetch, ApiError } from '../../lib/api';
import {
  Button,
  DataTable,
  EmptyState,
  IconButton,
  Pill,
  Skeleton,
  StatusBadge,
  Tooltip,
  toast,
} from '../../ui';
import type { Column, StatusTone } from '../../ui';
import {
  EMPTY_PEOPLE_FILTERS,
  PeopleFilterDrawer,
  type PeopleFilters,
} from './PeopleFilterDrawer';

interface DirectoryItem {
  ecode: string;
  name: string;
  designation: string | null;
  department: string | null;
  entity: string;
  entityName: string;
  status: string;
  statusLabel: string;
}

interface DirectoryResponse {
  items: DirectoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

function toneForStatus(label: string): StatusTone {
  if (label === 'Confirmed') return 'positive';
  if (label === 'Probation' || label === 'Onboarding') return 'warning';
  if (label === 'Notice period') return 'info';
  if (label === 'Exited') return 'negative';
  return 'neutral';
}

const COLUMNS: Column<DirectoryItem>[] = [
  {
    key: 'ecode',
    header: 'E-code',
    width: '130px',
    render: (r) => <span className="tabular-nums text-ink-muted">{r.ecode}</span>,
  },
  {
    key: 'name',
    header: 'Name',
    width: 'minmax(0,1.4fr)',
    render: (r) => <span className="font-medium text-ink">{r.name}</span>,
  },
  {
    key: 'designation',
    header: 'Designation',
    width: 'minmax(0,1.4fr)',
    render: (r) => r.designation ?? '—',
  },
  {
    key: 'entity',
    header: 'Entity',
    width: '90px',
    render: (r) => <Pill>{r.entity}</Pill>,
  },
  {
    key: 'status',
    header: 'Status',
    width: '140px',
    render: (r) => (
      <StatusBadge tone={toneForStatus(r.statusLabel)}>{r.statusLabel}</StatusBadge>
    ),
  },
];

function statusToApi(label: string): string | undefined {
  if (label === 'Confirmed' || label === 'Probation') return 'active';
  if (label === 'Onboarding') return 'onboarding';
  if (label === 'Notice period') return 'on_notice';
  return undefined;
}

export function DirectoryPage() {
  const navigate = useNavigate();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<PeopleFilters>(EMPTY_PEOPLE_FILTERS);
  const [applied, setApplied] = useState<PeopleFilters>(EMPTY_PEOPLE_FILTERS);
  const [data, setData] = useState<DirectoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f: PeopleFilters) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('pageSize', '50');
      params.set('activeOnly', f.activeOnly ? 'true' : 'false');
      if (f.entities.length === 1) {
        const code = f.entities[0];
        if (code !== undefined) params.set('companyCode', code);
      }
      if (f.statuses.length === 1) {
        const label = f.statuses[0];
        if (label !== undefined) {
          const st = statusToApi(label);
          if (st) params.set('status', st);
        }
      }
      const res = await apiFetch<DirectoryResponse>(`/api/employees?${params.toString()}`);
      setData(res);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Could not load the directory.';
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(applied);
  }, [applied, load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-ink">People</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {data
              ? `${String(data.items.length)} of ${String(data.total)} employees`
              : 'Employee directory'}
          </p>
        </div>
        <Tooltip label="Filter people">
          <IconButton
            label="Filter people"
            icon={<SlidersHorizontal />}
            onClick={() => {
              setFiltersOpen(true);
            }}
          />
        </Tooltip>
      </div>

      {loading && (
        <div className="space-y-2" aria-busy>
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      )}

      {!loading && error !== null && (
        <EmptyState
          icon={<Users />}
          title="Directory unavailable"
          description={error}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                void load(applied);
              }}
            >
              Retry
            </Button>
          }
        />
      )}

      {!loading && error === null && data !== null && data.items.length === 0 && (
        <EmptyState
          icon={<Users />}
          title="No people match"
          description="Try clearing filters, or import the employee master (P0-T09/T32)."
        />
      )}

      {!loading && error === null && data !== null && data.items.length > 0 && (
        <DataTable
          columns={COLUMNS}
          rows={data.items}
          rowKey={(r) => r.ecode}
          onRowClick={(r) => {
            void navigate(`/people/${r.ecode}`);
          }}
        />
      )}

      <PeopleFilterDrawer
        open={filtersOpen}
        onClose={() => {
          setFiltersOpen(false);
        }}
        filters={filters}
        onChange={setFilters}
        onApply={() => {
          setFiltersOpen(false);
          setApplied(filters);
          toast.info('Filters applied');
        }}
      />
    </div>
  );
}
