/**
 * Stage 5.6 — statutory registers tab (CMP-08..14 stubs).
 *
 * Mount on CompliancePage with tab id `registers`:
 *
 *   import { RegistersTab } from './RegistersTab';
 *   // Tab union: … | 'registers'
 *   // TABS entry: { id: 'registers', label: 'Registers' }
 *   // body: {tab === 'registers' ? <RegistersTab /> : …}
 *
 * Does not invent wages — pending forms show the Stage 2 payroll dependency.
 */
import { useEffect, useState } from 'react';
import { BookMarked, TriangleAlert } from 'lucide-react';
import { ApiError, apiFetch } from '../../lib/api';
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  Skeleton,
  StatusBadge,
  TextField,
} from '../../ui';
import type { Column, StatusTone } from '../../ui';

type RegisterStatus = 'available' | 'pending_payroll';

interface CatalogEntry {
  code: string;
  name: string;
  requirementId: string;
  status: RegisterStatus;
  dependency: string | null;
}

interface HeaderRow {
  ecode: string;
  name: string;
  doj: string | null;
}

type PreviewResult =
  | {
      status: 'ok';
      code: string;
      mode: 'header_only';
      columns: string[];
      rows: HeaderRow[];
    }
  | { status: 'blocked'; code: string; reason: string };

const STATUS_TONE: Record<RegisterStatus, StatusTone> = {
  available: 'positive',
  pending_payroll: 'warning',
};

const headerColumns: Column<HeaderRow>[] = [
  { key: 'ecode', header: 'E-code', render: (row) => row.ecode },
  { key: 'name', header: 'Name', render: (row) => row.name },
  {
    key: 'doj',
    header: 'Date of joining',
    render: (row) => row.doj ?? '—',
  },
];

export function RegistersTab() {
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [companyId, setCompanyId] = useState('1');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void apiFetch<{ rows: CatalogEntry[] }>('/api/compliance/registers/catalog')
      .then((result) => {
        setCatalog(result.rows);
        const first = result.rows[0];
        if (first !== undefined) setSelected(first.code);
      })
      .catch((caught: unknown) => {
        setError(caught instanceof ApiError ? caught.message : 'Could not load the register catalog');
        setCatalog([]);
      });
  }, []);

  const runPreview = async (): Promise<void> => {
    if (selected === '' || companyId.trim() === '') return;
    const id = Number(companyId);
    if (!Number.isInteger(id) || id < 1) {
      setError('Enter a valid company id');
      return;
    }
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      const result = await apiFetch<PreviewResult>(
        `/api/compliance/registers/${encodeURIComponent(selected)}/preview?companyId=${String(id)}`,
      );
      setPreview(result);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Preview failed');
    } finally {
      setBusy(false);
    }
  };

  if (catalog === null) {
    return (
      <Card>
        <div className="space-y-2 p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Statutory registers"
          subtitle="Header-only previews from the employee master. Wage columns stay blocked until Stage 2 payroll compute — we never invent rates or payable days."
        />
        {catalog.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<BookMarked />}
              title={error ?? 'No registers in the catalog'}
              description="The register framework has not been seeded yet."
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {catalog.map((row) => (
              <li key={row.code}>
                <button
                  type="button"
                  className={`u-press flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left ${
                    selected === row.code ? 'bg-surface-2' : ''
                  }`}
                  onClick={() => {
                    setSelected(row.code);
                    setPreview(null);
                  }}
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-ink">{row.name}</span>
                    <span className="block text-xs text-ink-muted">
                      {row.requirementId} · {row.code}
                      {row.dependency !== null ? ` · ${row.dependency}` : ''}
                    </span>
                  </span>
                  <StatusBadge tone={STATUS_TONE[row.status]}>
                    {row.status === 'available' ? 'Header ready' : 'Pending payroll'}
                  </StatusBadge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Preview"
          subtitle="Pick an entity and generate a header-only CSV layout (ecode, name, doj) — or see the honest block reason."
          action={
            <Button size="sm" disabled={busy || selected === ''} onClick={() => void runPreview()}>
              {busy ? 'Loading…' : 'Preview'}
            </Button>
          }
        />
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-4 py-3">
          <TextField
            label="Company id"
            hint="Numeric core.companies.id for this entity."
            className="w-40"
            inputMode="numeric"
            value={companyId}
            onChange={(event) => {
              setCompanyId(event.target.value);
            }}
          />
        </div>

        {error !== null ? (
          <div className="p-4">
            <EmptyState icon={<TriangleAlert />} title="Preview unavailable" description={error} />
          </div>
        ) : null}

        {preview?.status === 'blocked' ? (
          <div className="p-4">
            <EmptyState
              icon={<TriangleAlert />}
              title="Blocked — needs payroll"
              description={preview.reason}
            />
          </div>
        ) : null}

        {preview?.status === 'ok' ? (
          preview.rows.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<BookMarked />}
                title="No employees for this entity"
                description="Header-only preview returned zero rows. That is valid — we do not invent people or wages."
              />
            </div>
          ) : (
            <DataTable
              rows={preview.rows}
              columns={headerColumns}
              rowKey={(row) => row.ecode}
            />
          )
        ) : null}

        {preview === null && error === null ? (
          <div className="p-4">
            <EmptyState
              icon={<BookMarked />}
              title="No preview yet"
              description="Select a register, enter a company id, then Preview."
            />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
