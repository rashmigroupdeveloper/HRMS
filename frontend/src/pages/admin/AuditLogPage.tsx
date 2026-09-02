/**
 * Audit trail viewer (CORE-11, doc 14 §7.4).
 *
 * The log is append-only and hash-chained in the database. This screen reads
 * it and — the part that matters for an auditor — can prove the chain is
 * intact by asking the DB to recompute it, so the answer does not depend on
 * application code telling the truth about itself.
 *
 * Values shown here were masked by the writer before they were stored
 * (CLAUDE.md §5); this screen never unmasks anything.
 */
import { useCallback, useEffect, useState } from 'react';
import { FileClock, Search, ShieldCheck, ShieldAlert } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  Pill,
  Select,
  StatusBadge,
  TextField,
  toast,
} from '../../ui';
import type { Column, SelectOption } from '../../ui';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';

const PAGE_SIZE = 50;

interface AuditEntry {
  id: number;
  at: string;
  actorUserId: number | null;
  actorName: string | null;
  action: string;
  entity: string;
  entityId: number | null;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  ip: string | null;
}

interface AuditPage {
  rows: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

interface Facets {
  entities: string[];
  actions: string[];
}

function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // IST, DD MMM YYYY HH:mm (CLAUDE.md §1.10 localization rule).
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/** Destructive/security-relevant actions read differently at a glance (§7:
 *  colour is never the only signal — the label carries the meaning too). */
function actionTone(action: string): 'positive' | 'negative' | 'info' | 'neutral' {
  if (action === 'delete' || action === 'login_failed' || action === 'reject') return 'negative';
  if (action === 'create' || action === 'approve') return 'positive';
  if (action === 'update') return 'info';
  return 'neutral';
}

export function AuditLogPage() {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facets, setFacets] = useState<Facets>({ entities: [], actions: [] });

  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [chain, setChain] = useState<{ intact: boolean; brokenAtId: number | null } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const load = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(nextOffset),
      });
      if (entity !== '') params.set('entity', entity);
      if (action !== '') params.set('action', action);
      if (search.trim() !== '') params.set('search', search.trim());
      if (fromDate !== '') params.set('fromDate', fromDate);
      if (toDate !== '') params.set('toDate', toDate);
      try {
        const page = await apiFetch<AuditPage>(`/api/audit?${params.toString()}`);
        setRows(page.rows);
        setTotal(page.total);
        setOffset(page.offset);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not load the audit trail.');
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [entity, action, search, fromDate, toDate],
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  useEffect(() => {
    apiFetch<Facets>('/api/audit/facets')
      .then(setFacets)
      .catch(() => {
        setFacets({ entities: [], actions: [] });
      });
  }, []);

  const verify = async () => {
    setVerifying(true);
    try {
      const result = await apiFetch<{ intact: boolean; brokenAtId: number | null }>('/api/audit/verify');
      setChain(result);
      if (result.intact) {
        toast.success('Audit chain intact', {
          description: 'The database recomputed every hash end to end.',
        });
      } else {
        toast.error('Audit chain BROKEN', {
          description: `First inconsistent row: #${String(result.brokenAtId)}. Escalate immediately.`,
        });
      }
    } catch (cause) {
      toast.error('Verification failed', {
        description: cause instanceof Error ? cause.message : 'Try again.',
      });
    } finally {
      setVerifying(false);
    }
  };

  const entityOptions: SelectOption[] = [
    { value: '', label: 'All entities' },
    ...facets.entities.map((e) => ({ value: e, label: e })),
  ];
  const actionOptions: SelectOption[] = [
    { value: '', label: 'All actions' },
    ...facets.actions.map((a) => ({ value: a, label: a })),
  ];

  const columns: Column<AuditEntry>[] = [
    {
      key: 'at',
      header: 'When (IST)',
      width: '160px',
      render: (row) => <span className="tabular-nums text-ink">{formatStamp(row.at)}</span>,
    },
    {
      key: 'actor',
      header: 'Who',
      width: 'minmax(170px,1fr)',
      render: (row) => (
        <span className="text-ink">
          {row.actorName ?? (row.actorUserId === null ? 'system' : `user ${String(row.actorUserId)}`)}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      width: '128px',
      render: (row) => <StatusBadge tone={actionTone(row.action)}>{row.action}</StatusBadge>,
    },
    {
      key: 'entity',
      header: 'Entity',
      width: 'minmax(180px,1fr)',
      render: (row) => (
        <div>
          <code className="text-xs text-ink">{row.entity}</code>
          {row.entityId !== null && <span className="ml-1 text-xs text-ink-muted">#{row.entityId}</span>}
        </div>
      ),
    },
    {
      key: 'field',
      header: 'Field',
      width: '150px',
      render: (row) => (row.field === null ? <span className="text-ink-faint">—</span> : <Pill>{row.field}</Pill>),
    },
    {
      key: 'change',
      header: 'Change (old → new)',
      width: 'minmax(240px,1.6fr)',
      render: (row) => (
        <div className="flex items-center gap-2 text-xs">
          <span className="max-w-[150px] truncate text-ink-muted line-through">{row.oldValue ?? '—'}</span>
          <span aria-hidden="true" className="text-ink-faint">
            →
          </span>
          <span className="max-w-[150px] truncate font-semibold text-ink">{row.newValue ?? '—'}</span>
        </div>
      ),
    },
    {
      key: 'ip',
      header: 'IP',
      width: '120px',
      render: (row) => <span className="text-xs text-ink-muted">{row.ip ?? '—'}</span>,
    },
  ];

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">Master control · integrity</p>
          <h1 className="mt-1 text-4xl font-light tracking-tight text-ink">Audit log</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Append-only and hash-chained in the database. Rows can never be edited or deleted — only
            added.
          </p>
        </div>
        <Button
          variant={chain?.intact === false ? 'danger' : 'secondary'}
          loading={verifying}
          leadingIcon={
            chain?.intact === false ? <ShieldAlert className="size-4" /> : <ShieldCheck className="size-4" />
          }
          onClick={() => void verify()}
        >
          Verify chain
        </Button>
      </header>

      {chain !== null && (
        <Card>
          <div className="flex items-start gap-3">
            {chain.intact ? (
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-positive" />
            ) : (
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-negative" />
            )}
            <div>
              <p className="text-sm font-semibold text-ink">
                {chain.intact ? 'Chain verified intact' : 'Chain integrity FAILED'}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-ink-muted">
                {chain.intact
                  ? 'The database recomputed every row hash from the first entry forward and found no break.'
                  : `The first inconsistent row is #${String(chain.brokenAtId)}. Treat this as a security incident.`}
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
          <TextField
            label="Search"
            placeholder="entity, action, field…"
            value={search}
            leadingIcon={<Search className="size-4" />}
            onChange={(e) => {
              setSearch(e.currentTarget.value);
            }}
          />
          <Select
            label="Entity"
            value={entity}
            options={entityOptions}
            onChange={setEntity}
          />
          <Select
            label="Action"
            value={action}
            options={actionOptions}
            onChange={setAction}
          />
          <TextField
            label="From"
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.currentTarget.value);
            }}
          />
          <TextField
            label="To"
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.currentTarget.value);
            }}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title={`${total.toLocaleString('en-IN')} entries`}
          subtitle={`Page ${String(page)} of ${String(pages)} · newest first`}
          action={
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={offset === 0 || loading}
                onClick={() => void load(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={offset + PAGE_SIZE >= total || loading}
                onClick={() => void load(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          }
        />
      </Card>

      {loading ? (
        <DashboardSkeleton />
      ) : error !== null ? (
        <DashboardError message={error} onRetry={() => void load(offset)} />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(row) => String(row.id)}
          maxHeight={640}
          empty={
            <EmptyState
              icon={<FileClock />}
              title="No audit entries match"
              description="Widen the date range or clear the filters."
            />
          }
        />
      )}
    </div>
  );
}
