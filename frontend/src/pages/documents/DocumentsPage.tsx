/**
 * `/documents` — HR document vault ops (DOC-01/02/03).
 *
 * Skeleton surface: list + filter by attention. Coverage / requests / e-sign
 * tabs land with later DOC tasks; this is the managed list HR opens today.
 */
import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from '../../lib/api';
import {
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  PageHeader,
  Skeleton,
  StatusBadge,
  Switch,
} from '../../ui';
import type { Column, StatusTone } from '../../ui';

type ExpiryState = 'perpetual' | 'valid' | 'expiring' | 'expired';

interface Expiry {
  state: ExpiryState;
  daysRemaining: number | null;
}

interface VaultRow {
  id: number;
  ecode: string | null;
  employeeName: string | null;
  typeName: string;
  originalName: string;
  expiresOn: string | null;
  expiry: Expiry;
}

const EXPIRY_TONE: Record<ExpiryState, StatusTone> = {
  expired: 'negative',
  expiring: 'warning',
  valid: 'positive',
  perpetual: 'neutral',
};

function expiryLabel(expiry: Expiry): string {
  if (expiry.state === 'perpetual') return 'No expiry';
  if (expiry.state === 'expired') return `Expired ${String(Math.abs(expiry.daysRemaining ?? 0))} d ago`;
  if (expiry.state === 'expiring') return `${String(expiry.daysRemaining ?? 0)} d left`;
  return 'Valid';
}

export function DocumentsPage() {
  const [rows, setRows] = useState<VaultRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attentionOnly, setAttentionOnly] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const query = attentionOnly ? '?needsAttentionOnly=true' : '';
      const data = await apiFetch<{ rows: VaultRow[] }>(`/api/documents${query}`);
      setRows(data.rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the vault');
      setRows([]);
    }
  }, [attentionOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: Column<VaultRow>[] = [
    {
      key: 'person',
      header: 'Employee',
      render: (row) => (
        <span>
          <span className="font-medium text-ink">{row.employeeName ?? '—'}</span>
          {row.ecode ? <span className="ml-2 text-sm text-ink-muted">{row.ecode}</span> : null}
        </span>
      ),
    },
    { key: 'type', header: 'Type', render: (row) => row.typeName },
    { key: 'file', header: 'File', render: (row) => row.originalName },
    {
      key: 'expiry',
      header: 'Validity',
      render: (row) => (
        <StatusBadge tone={EXPIRY_TONE[row.expiry.state]}>{expiryLabel(row.expiry)}</StatusBadge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Employee vault across the org — the same colour language as licences and medical fitness."
      />

      <Card>
        <CardHeader
          title="Vault"
          subtitle="Filter to what needs attention first — expired and inside the alert ladder."
          action={
            <Switch
              label="Needs attention only"
              checked={attentionOnly}
              onChange={(e) => {
                setAttentionOnly(e.target.checked);
              }}
            />
          }
        />
        {rows === null ? (
          <Skeleton className="h-40" />
        ) : error !== null ? (
          <EmptyState title="Could not load" description={error} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={attentionOnly ? 'Nothing expiring' : 'Vault is empty'}
            description={
              attentionOnly
                ? 'No documents are expired or inside the alert window.'
                : 'Uploads from ESS and HR will appear here.'
            }
          />
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(row) => String(row.id)} />
        )}
      </Card>
    </div>
  );
}
