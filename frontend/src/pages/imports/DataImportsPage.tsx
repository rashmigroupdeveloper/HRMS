/**
 * Data imports — every bulk upload the signed-in user is allowed to run
 * (employees, salaries, payroll inputs, punches, leave, loans, holidays,
 * assets, statutory tables). Each opens the same validated upload drawer.
 */
import { useEffect, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { ApiError, apiFetch } from '../../lib/api';
import { Button, Card, DataTable, EmptyState, PageHeader, Select, StatusBadge, toast } from '../../ui';
import type { Column } from '../../ui';
import { BulkUploadDrawer } from './BulkUploadDrawer';
import type { BulkImporterInfo, BulkJob } from './bulk-types';

interface RunSummary { id: number; companyId: number; month: string; status: string }

const jobColumns: Column<BulkJob>[] = [
  { key: 'id', header: 'Job', render: (j) => `#${String(j.jobId)}`, width: '72px' },
  { key: 'file', header: 'File', render: (j) => j.filename },
  { key: 'rows', header: 'Rows', render: (j) => j.totalRows, numeric: true, width: '72px' },
  { key: 'status', header: 'Status', render: (j) => <StatusBadge tone={j.status === 'committed' ? 'positive' : j.status === 'failed' ? 'negative' : j.status === 'discarded' ? 'neutral' : 'info'}>{j.status}</StatusBadge>, width: '130px' },
  { key: 'when', header: 'Uploaded', render: (j) => new Date(j.createdAt).toLocaleString(), width: '190px' },
];

export function DataImportsPage() {
  const [importers, setImporters] = useState<BulkImporterInfo[] | null>(null);
  const [active, setActive] = useState<BulkImporterInfo | null>(null);
  const [jobs, setJobs] = useState<BulkJob[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [runId, setRunId] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    apiFetch<BulkImporterInfo[]>('/api/bulk/importers').then(setImporters).catch((e: unknown) => {
      setImporters([]);
      toast.error(e instanceof ApiError ? e.message : 'Could not load imports.');
    });
  }, []);

  useEffect(() => {
    if (!active) return;
    apiFetch<BulkJob[]>(`/api/bulk/${active.key}/jobs`).then(setJobs).catch(() => { setJobs([]); });
    if (active.contextFields.some((f) => f.type === 'run')) {
      apiFetch<RunSummary[]>('/api/payroll/runs/list', { method: 'POST', body: '{}' })
        .then((r) => { const drafts = r.filter((x) => x.status === 'draft'); setRuns(drafts); setRunId(String(drafts[0]?.id ?? '')); })
        .catch(() => { setRuns([]); });
    }
  }, [active]);

  const needsRun = active?.contextFields.some((f) => f.type === 'run') ?? false;
  const context = needsRun ? { runId: Number(runId) } : {};

  return (
    <div className="space-y-6">
      <PageHeader title="Data imports" description="Upload Excel or CSV files. Every row is checked before anything is saved." />
      {importers === null ? null : importers.length === 0 ? (
        <EmptyState title="No imports available" description="Your role has no bulk-upload permissions." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {importers.map((imp) => (
            <Card key={imp.key}>
              <div className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-center gap-2 font-semibold"><FileSpreadsheet size={18} aria-hidden /> {imp.title}</div>
                <p className="flex-1 text-sm text-ink-muted">{imp.description}</p>
                <Button variant={active?.key === imp.key ? 'primary' : 'secondary'} onClick={() => { setActive(imp); }}>
                  {active?.key === imp.key ? 'Selected' : 'Open'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {active && (
        <Card>
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{active.title}</h2>
                <p className="text-sm text-ink-muted">Columns: {active.columns.map((c) => `${c.header}${c.required ? '*' : ''}`).join(', ')}</p>
              </div>
              <div className="flex items-end gap-3">
                {needsRun && (
                  <div className="w-64">
                    <Select label="Payroll run (draft)" value={runId} onChange={setRunId} placeholder={runs.length ? 'Choose a run' : 'No draft runs'}
                      options={runs.map((r) => ({ value: String(r.id), label: `#${String(r.id)} · ${r.month.slice(0, 7)} · company ${String(r.companyId)}` }))} />
                  </div>
                )}
                <Button variant="primary" disabled={needsRun && !runId} onClick={() => { setOpen(true); }}>Upload file</Button>
              </div>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
              {active.instructions.map((i) => <li key={i}>{i}</li>)}
            </ul>
            <h3 className="font-medium">Recent uploads</h3>
            <DataTable columns={jobColumns} rows={jobs} rowKey={(j) => String(j.jobId)} empty={<EmptyState title="No uploads yet" description="Your uploads for this import will appear here." />} />
          </div>
        </Card>
      )}

      {active && (
        <BulkUploadDrawer
          importer={active.key}
          title={active.title}
          open={open}
          onClose={() => { setOpen(false); }}
          context={context}
          onCommitted={() => { apiFetch<BulkJob[]>(`/api/bulk/${active.key}/jobs`).then(setJobs).catch(() => undefined); }}
        />
      )}
    </div>
  );
}
