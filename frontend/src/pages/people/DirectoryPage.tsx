/**
 * Employee directory (P0-T33, docs/05 §4.2) — FilterPanel + DataTable.
 * Composed only from `frontend/src/ui` (§0.1 firewall).
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, Users } from 'lucide-react';
import { apiFetch, ApiError } from '../../lib/api';
import {
  Button,
  DataTable,
  EmptyState,
  IconButton,
  PageHeader,
  Pill,
  Skeleton,
  StatusBadge,
  TextField,
  Tooltip,
  toast,
} from '../../ui';
import type { Column, StatusTone } from '../../ui';
import {
  EMPTY_PEOPLE_FILTERS,
  PeopleFilterDrawer,
  countActiveFilters,
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

const DIRECTORY_FILTERS_KEY = 'rashmi.directory.filters';

interface StoredDirectoryFilters {
  applied: PeopleFilters;
  q: string;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function parsePeopleFilters(value: unknown): PeopleFilters | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const entities = record['entities'];
  const statuses = record['statuses'];
  const departments = record['departments'];
  const locations = record['locations'];
  const categories = record['categories'];
  const activeOnly = record['activeOnly'];
  if (
    !isStringArray(entities) ||
    !isStringArray(statuses) ||
    !isStringArray(departments) ||
    !isStringArray(locations) ||
    !isStringArray(categories) ||
    typeof activeOnly !== 'boolean'
  ) {
    return null;
  }
  return { entities, statuses, departments, locations, categories, activeOnly };
}

function readStoredDirectoryFilters(): StoredDirectoryFilters {
  const empty: StoredDirectoryFilters = { applied: EMPTY_PEOPLE_FILTERS, q: '' };
  try {
    const raw = window.localStorage.getItem(DIRECTORY_FILTERS_KEY);
    if (raw === null) return empty;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return empty;
    const record = parsed as Record<string, unknown>;
    const q = record['q'];
    if (typeof q !== 'string') return empty;
    const applied = parsePeopleFilters(record['applied']);
    if (applied === null) return empty;
    return { applied, q };
  } catch {
    return empty;
  }
}

function writeStoredDirectoryFilters(applied: PeopleFilters, q: string): void {
  const empty = countActiveFilters(applied) === 0 && q.length === 0;
  try {
    if (empty) {
      window.localStorage.removeItem(DIRECTORY_FILTERS_KEY);
      return;
    }
    const payload: StoredDirectoryFilters = { applied, q };
    window.localStorage.setItem(DIRECTORY_FILTERS_KEY, JSON.stringify(payload));
  } catch {
    /* persistence is best-effort */
  }
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
    width: 'minmax(0,1.2fr)',
    render: (r) => r.designation ?? '—',
  },
  {
    key: 'department',
    header: 'Department',
    width: 'minmax(0,1fr)',
    render: (r) => r.department ?? '—',
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

export function DirectoryPage() {
  const navigate = useNavigate();
  const [stored] = useState(readStoredDirectoryFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<PeopleFilters>(stored.applied);
  const [applied, setApplied] = useState<PeopleFilters>(stored.applied);
  const [search, setSearch] = useState(stored.q);
  const [q, setQ] = useState(stored.q);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<DirectoryResponse | null>(null);
  const appliedCount = countActiveFilters(applied);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [search]);

  const load = useCallback(async (f: PeopleFilters, query: string, pageNumber: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(pageNumber));
      params.set('pageSize', '50');
      params.set('activeOnly', f.activeOnly ? 'true' : 'false');
      if (query.length > 0) params.set('q', query);
      const csv = (key: string, values: string[]): void => {
        if (values.length > 0) params.set(key, values.join(','));
      };
      csv('companyCodes', f.entities);
      csv('statuses', f.statuses);
      csv('categories', f.categories);
      csv('departmentIds', f.departments);
      csv('locationIds', f.locations);
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
    void load(applied, q, page);
  }, [applied, q, page, load]);

  useEffect(() => {
    writeStoredDirectoryFilters(applied, q);
  }, [applied, q]);

  const clearAll = (): void => {
    setFilters(EMPTY_PEOPLE_FILTERS);
    setApplied(EMPTY_PEOPLE_FILTERS);
    setSearch('');
    setQ('');
    setPage(1);
    try {
      window.localStorage.removeItem(DIRECTORY_FILTERS_KEY);
    } catch {
      /* persistence is best-effort */
    }
  };

  const pageCount = data === null ? 1 : Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People · directory"
        title="People"
        description={
          data
            ? `${data.total.toLocaleString('en-IN')} employees in this view. Search and filters stay until you clear them.`
            : 'Find someone by name or e-code, then open their file.'
        }
        actions={
          <div className="flex items-center gap-2">
            {appliedCount > 0 && (
              <Pill>
                {appliedCount} filter{appliedCount === 1 ? '' : 's'} applied
              </Pill>
            )}
            <Tooltip
              label={
                appliedCount > 0
                  ? `Filter people (${String(appliedCount)} applied)`
                  : 'Filter people'
              }
            >
              <IconButton
                label={
                  appliedCount > 0
                    ? `Filter people, ${String(appliedCount)} applied`
                    : 'Filter people'
                }
                icon={<SlidersHorizontal />}
                onClick={() => {
                  setFiltersOpen(true);
                }}
              />
            </Tooltip>
          </div>
        }
      />

      <TextField
        label="Search people"
        type="search"
        name="directory-q"
        placeholder="Name or e-code"
        leadingIcon={<Search />}
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
        }}
      />

      {loading && (
        <div className="space-y-2" role="status" aria-busy="true" aria-label="Loading directory">
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
                void load(applied, q, page);
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
          description="Clear search and filters to see the full directory, or import the employee master if this company has not been loaded yet."
          action={
            <Button variant="primary" onClick={clearAll}>
              Clear search and filters
            </Button>
          }
        />
      )}

      {!loading && error === null && data !== null && data.items.length > 0 && (
        <>
          <DataTable
            columns={COLUMNS}
            rows={data.items}
            rowKey={(r) => r.ecode}
            onRowClick={(r) => {
              void navigate(`/people/${r.ecode}`);
            }}
          />
          {pageCount > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-muted">
                Page {String(data.page)} of {String(pageCount)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => {
                    setPage((current) => Math.max(1, current - 1));
                  }}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= pageCount}
                  onClick={() => {
                    setPage((current) => current + 1);
                  }}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
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
          setPage(1);
          setApplied(filters);
          toast.info('Filters applied');
        }}
      />
    </div>
  );
}
