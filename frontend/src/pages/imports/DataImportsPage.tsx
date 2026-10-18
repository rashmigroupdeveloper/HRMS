/**
 * Data imports — every bulk upload the signed-in user is allowed to run
 * (employees, salaries, payroll inputs, punches, leave, loans, holidays,
 * assets, statutory tables). Each opens the same validated upload drawer.
 *
 * Layout (docs/05 §4 + 12 §7): a catalogue of import tiles — the selected one
 * takes the solid-gold "this one" fill — then a detail panel with the three-step
 * promise (template → check → commit), the column contract and recent uploads.
 */
import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  CalendarDays,
  Coins,
  FileSpreadsheet,
  Fingerprint,
  Landmark,
  Laptop,
  Palmtree,
  Scale,
  Upload,
  Users,
  Wallet,
} from 'lucide-react';
import { ApiError, apiFetch } from '../../lib/api';
import { Button, Card, DataTable, EmptyState, PageHeader, Select, Skeleton, StatusBadge, cn, toast } from '../../ui';
import type { Column } from '../../ui';
import { BulkUploadDrawer } from './BulkUploadDrawer';
import type { BulkImporterInfo, BulkJob } from './bulk-types';

interface RunSummary { id: number; companyId: number; month: string; status: string }

const ICONS: Record<string, LucideIcon> = {
  employees: Users,
  'salary-assignments': Wallet,
  'payroll-inputs': Banknote,
  punches: Fingerprint,
  'leave-balances': Palmtree,
  loans: Coins,
  holidays: CalendarDays,
  assets: Laptop,
  'statutory-rates': Landmark,
  'pt-slabs': Scale,
};

const dateTime = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
});

const jobColumns: Column<BulkJob>[] = [
  { key: 'id', header: 'Job', render: (j) => <span className="tabular-nums text-ink-muted">#{j.jobId}</span>, width: '72px' },
  { key: 'file', header: 'File', render: (j) => <span className="font-medium text-ink [overflow-wrap:anywhere]">{j.filename}</span> },
  { key: 'rows', header: 'Rows', render: (j) => j.totalRows, numeric: true, width: '72px' },
  { key: 'status', header: 'Status', render: (j) => <StatusBadge tone={j.status === 'committed' ? 'positive' : j.status === 'failed' ? 'negative' : j.status === 'discarded' ? 'neutral' : 'info'}>{j.status}</StatusBadge>, width: '130px' },
  { key: 'when', header: 'Uploaded', render: (j) => <span className="tabular-nums">{dateTime.format(new Date(j.createdAt))}</span>, width: '190px' },
];

const STEPS = [
  { title: 'Download the template', body: 'Dropdowns and an Instructions sheet are built in. .xlsx or .csv.' },
  { title: 'Check every row', body: 'Nothing is saved yet — you get a row-by-row report you can download.' },
  { title: 'Commit all or nothing', body: 'One bad row blocks the batch. Re-uploading the same file is detected.' },
];

export function DataImportsPage() {
  const [importers, setImporters] = useState<BulkImporterInfo[] | null>(null);
  const [active, setActive] = useState<BulkImporterInfo | null>(null);
  const [jobs, setJobs] = useState<BulkJob[] | null>(null);
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
    setJobs(null);
    apiFetch<BulkJob[]>(`/api/bulk/${active.key}/jobs`).then(setJobs).catch(() => { setJobs([]); });
    if (active.contextFields.some((f) => f.type === 'run')) {
      apiFetch<RunSummary[]>('/api/payroll/runs/list', { method: 'POST', body: '{}' })
        .then((r) => { const drafts = r.filter((x) => x.status === 'draft'); setRuns(drafts); setRunId(String(drafts[0]?.id ?? '')); })
        .catch(() => { setRuns([]); });
    }
  }, [active]);

  const needsRun = active?.contextFields.some((f) => f.type === 'run') ?? false;
  const context = needsRun ? { runId: Number(runId) } : {};
  const required = active?.columns.filter((c) => c.required) ?? [];
  const optional = active?.columns.filter((c) => !c.required) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Data imports"
        description="Upload Excel or CSV files. Every row is checked before anything is saved."
      />

      {importers === null ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-busy="true" aria-label="Loading imports">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} variant="block" className="h-28" />)}
        </div>
      ) : importers.length === 0 ? (
        <Card>
          <EmptyState icon={<FileSpreadsheet />} title="No imports available" description="Your role has no bulk-upload permissions. Ask HR or IT if you need one." />
        </Card>
      ) : (
        <section aria-labelledby="imports-catalogue">
          <h2 id="imports-catalogue" className="sr-only">Available imports</h2>
          <ul className="u-stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {importers.map((imp) => {
              const Icon = ICONS[imp.key] ?? FileSpreadsheet;
              const selected = active?.key === imp.key;
              return (
                <li key={imp.key}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => { setActive(imp); }}
                    className={cn(
                      'u-press flex h-full w-full items-start gap-4 rounded-tile p-5 text-left transition-[background-color,box-shadow] duration-(--motion-micro) ease-(--ease-std)',
                      selected
                        ? 'bg-accent text-accent-ink u-shadow-float'
                        : 'bg-surface text-ink u-shadow-card hover:bg-[color-mix(in_srgb,var(--accent-soft)_55%,var(--surface))]',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'grid size-11 shrink-0 place-items-center rounded-full [&_svg]:size-5',
                        selected ? 'bg-hero text-hero-ink' : 'bg-surface-2 text-ink',
                      )}
                    >
                      <Icon />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold leading-snug">{imp.title}</span>
                      <span className={cn('mt-1 block text-sm leading-5', selected ? 'text-accent-ink' : 'text-ink-muted')}>
                        {imp.description}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {active ? (
        <div key={active.key} className="u-route grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <Card className="space-y-6">
            <div className="min-w-0">
              <h2 className="text-2xl font-light tracking-tight text-ink">{active.title}</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {active.columns.length} columns · {required.length} required
              </p>
            </div>

            <ol className="space-y-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-semibold tabular-nums text-ink">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{s.title}</span>
                    <span className="block text-sm text-ink-muted">{s.body}</span>
                  </span>
                </li>
              ))}
            </ol>

            {active.instructions.length > 0 ? (
              <div className="rounded-tile bg-surface-2 p-4">
                <p className="text-sm font-semibold text-ink">Before you upload</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
                  {active.instructions.map((i) => <li key={i}>{i}</li>)}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap items-end gap-3">
              {needsRun ? (
                <div className="w-full sm:w-64">
                  <Select label="Payroll run (draft)" value={runId} onChange={setRunId} placeholder={runs.length ? 'Choose a run' : 'No draft runs'}
                    options={runs.map((r) => ({ value: String(r.id), label: `#${String(r.id)} · ${r.month.slice(0, 7)} · company ${String(r.companyId)}` }))} />
                </div>
              ) : null}
              <Button variant="primary" size="lg" leadingIcon={<Upload className="size-4" aria-hidden />} disabled={needsRun && !runId} onClick={() => { setOpen(true); }}>
                Upload file
              </Button>
            </div>
          </Card>

          <div className="min-w-0 space-y-6">
            <Card>
              <h3 className="text-lg font-light text-ink">Columns</h3>
              <p className="mt-0.5 text-sm text-ink-muted">Required columns are dark; the rest are optional.</p>
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Required columns">
                {required.map((c) => (
                  <li key={c.key} title={c.help} className="rounded-full bg-hero px-3 py-1 text-xs font-medium text-hero-ink">
                    {c.header}<span className="sr-only"> (required)</span>
                  </li>
                ))}
              </ul>
              {optional.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-2" aria-label="Optional columns">
                  {optional.map((c) => (
                    <li key={c.key} title={c.help} className="rounded-full px-3 py-1 text-xs font-medium text-ink-muted ring-1 ring-inset ring-(--line-strong)">
                      {c.header}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>

            <Card padded={false} className="overflow-hidden">
              <div className="px-6 pb-2 pt-6">
                <h3 className="text-lg font-light text-ink">Recent uploads</h3>
              </div>
              {jobs === null ? (
                <div className="space-y-2 p-6 pt-2" role="status" aria-busy="true" aria-label="Loading uploads">
                  {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} variant="block" className="h-10 rounded-row" />)}
                </div>
              ) : (
                <DataTable
                  columns={jobColumns}
                  rows={jobs}
                  rowKey={(j) => String(j.jobId)}
                  empty={<EmptyState icon={<Upload />} title="No uploads yet" description="Your uploads for this import will appear here." />}
                />
              )}
            </Card>
          </div>
        </div>
      ) : importers !== null && importers.length > 0 ? (
        <Card rail className="flex items-center gap-4">
          <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-ink [&_svg]:size-5">
            <FileSpreadsheet />
          </span>
          <p className="text-sm text-ink-muted">Choose an import above to see its columns, rules and your recent uploads.</p>
        </Card>
      ) : null}

      {active ? (
        <BulkUploadDrawer
          importer={active.key}
          title={active.title}
          open={open}
          onClose={() => { setOpen(false); }}
          context={context}
          onCommitted={() => { apiFetch<BulkJob[]>(`/api/bulk/${active.key}/jobs`).then(setJobs).catch(() => undefined); }}
        />
      ) : null}
    </div>
  );
}
