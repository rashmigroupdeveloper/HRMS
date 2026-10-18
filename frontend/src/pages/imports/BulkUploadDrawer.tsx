/**
 * One upload flow for every bulk import: template → upload (.xlsx/.csv) →
 * row-level validation report → confirm (all-or-nothing) → progress.
 * Nothing is saved until Confirm; errors block the commit; the report can be
 * downloaded as Excel to fix and re-upload.
 */
import { useEffect, useRef, useState } from 'react';
import { Download, FileUp } from 'lucide-react';
import { ApiError, apiFetch } from '../../lib/api';
import { downloadBase64, fileToBase64, MAX_UPLOAD_BYTES, UPLOAD_ACCEPT } from '../../lib/files';
import { Button, DataTable, Drawer, EmptyState, Pill, StatusBadge, toast } from '../../ui';
import type { Column } from '../../ui';
import type { BulkIssue, BulkJob } from './bulk-types';

interface Props {
  importer: string;
  title: string;
  open: boolean;
  onClose: () => void;
  /** Upload details the importer needs (e.g. { runId }). */
  context?: Record<string, unknown>;
  onCommitted?: (job: BulkJob) => void;
}

const issueColumns: Column<BulkIssue & { i: number }>[] = [
  { key: 'row', header: 'Row', render: (r) => r.rowNumber, width: '64px', numeric: true },
  { key: 'sev', header: 'Type', render: (r) => <StatusBadge tone={r.severity === 'error' ? 'negative' : 'warning'}>{r.severity === 'error' ? 'Error' : 'Warning'}</StatusBadge>, width: '96px' },
  { key: 'col', header: 'Column', render: (r) => r.column ?? '—', width: '160px' },
  { key: 'msg', header: 'Problem', render: (r) => r.message },
];

export function BulkUploadDrawer({ importer, title, open, onClose, context, onCommitted }: Props) {
  const [job, setJob] = useState<BulkJob | null>(null);
  const [busy, setBusy] = useState<'' | 'template' | 'upload' | 'commit' | 'report' | 'discard'>('');
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => { window.clearInterval(timer.current); }, []);
  useEffect(() => { if (!open) { setJob(null); window.clearInterval(timer.current); } }, [open]);

  function fail(e: unknown, fallback: string) {
    toast.error(e instanceof ApiError ? e.message : fallback);
  }

  async function template() {
    setBusy('template');
    try {
      const res = await apiFetch<{ filename: string; base64: string }>(`/api/bulk/${importer}/template`);
      downloadBase64(res.filename, res.base64);
    } catch (e) { fail(e, 'Could not download the template.'); } finally { setBusy(''); }
  }

  async function upload(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) { toast.error('The file is larger than 8 MB. Split it and upload the parts.'); return; }
    if (/\.xls$/i.test(file.name)) { toast.error('Old .xls files are not accepted — open in Excel and Save As .xlsx.'); return; }
    setBusy('upload');
    try {
      const res = await apiFetch<BulkJob>(`/api/bulk/${importer}/preview`, { method: 'POST', body: JSON.stringify({ filename: file.name, base64: await fileToBase64(file), context: context ?? {} }) });
      setJob(res);
    } catch (e) { setJob(null); fail(e, 'Could not reach the server. Nothing was saved.'); } finally { setBusy(''); }
  }

  function poll(jobId: number) {
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      apiFetch<BulkJob>(`/api/bulk/${importer}/jobs/${String(jobId)}`).then((j) => {
        setJob(j);
        if (j.status !== 'committing') {
          window.clearInterval(timer.current);
          if (j.status === 'committed') { toast.success(summary(j)); onCommitted?.(j); } else toast.error(j.error ?? 'Import failed — nothing was saved.');
        }
      }).catch(() => { window.clearInterval(timer.current); });
    }, 1000);
  }

  async function commit() {
    if (!job) return;
    setBusy('commit');
    try {
      const res = await apiFetch<BulkJob>(`/api/bulk/${importer}/jobs/${String(job.jobId)}/commit`, { method: 'POST', body: '{}' });
      setJob(res);
      if (res.status === 'committing') poll(res.jobId);
      else { toast.success(summary(res)); onCommitted?.(res); }
    } catch (e) { fail(e, 'Could not reach the server. Nothing was saved.'); } finally { setBusy(''); }
  }

  async function report() {
    if (!job) return;
    setBusy('report');
    try {
      const res = await apiFetch<{ filename: string; base64: string }>(`/api/bulk/${importer}/jobs/${String(job.jobId)}/report`);
      downloadBase64(res.filename, res.base64);
    } catch (e) { fail(e, 'Could not download the report.'); } finally { setBusy(''); }
  }

  async function discard() {
    if (!job) return;
    setBusy('discard');
    try {
      await apiFetch(`/api/bulk/${importer}/jobs/${String(job.jobId)}/discard`, { method: 'POST', body: '{}' });
      setJob(null);
    } catch (e) { fail(e, 'Could not discard.'); } finally { setBusy(''); }
  }

  const done = job?.status === 'committed';
  const committing = job?.status === 'committing';
  const blocked = !job || job.errorRows > 0 || job.duplicateOfJobId !== null || job.status !== 'previewed';
  const pct = job && job.totalRows > 0 ? Math.round((job.processedRows / job.totalRows) * 100) : 0;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      subtitle="Excel (.xlsx) or CSV · nothing is saved until you confirm"
      width={760}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {job && !done && !committing && <Button variant="ghost" loading={busy === 'discard'} onClick={() => void discard()}>Discard</Button>}
          {job && <Button variant="secondary" loading={busy === 'report'} onClick={() => void report()}><Download size={16} aria-hidden /> Validation report</Button>}
          {!done && <Button variant="primary" disabled={blocked || committing} loading={busy === 'commit' || committing} onClick={() => void commit()}>
            {job ? `Import ${String(job.totalRows)} row${job.totalRows === 1 ? '' : 's'}` : 'Import'}
          </Button>}
          {done && <Button variant="primary" onClick={onClose}>Done</Button>}
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" loading={busy === 'template'} onClick={() => void template()}><Download size={16} aria-hidden /> Download template</Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-pill bg-ink px-4 py-2 text-sm font-medium text-surface focus-within:ring-2 focus-within:ring-focus">
            <FileUp size={16} aria-hidden /> {busy === 'upload' ? 'Checking…' : job ? 'Upload another file' : 'Choose file'}
            <input ref={fileRef} type="file" accept={UPLOAD_ACCEPT} className="sr-only" aria-label="Choose a .xlsx or .csv file to upload" disabled={busy !== '' || committing}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
          </label>
        </div>

        {!job && <EmptyState title="Upload a file to see the check" description="Every row is validated first. You'll see errors and warnings per row and column, and can download them as Excel." />}

        {job && (
          <>
            <div className="flex flex-wrap gap-2" aria-live="polite">
              <Pill>{job.filename}</Pill>
              {job.layout && job.layout !== 'standard' && <Pill>{job.layout}</Pill>}
              <StatusBadge tone="neutral">{job.totalRows} rows</StatusBadge>
              <StatusBadge tone="positive">{job.validRows} valid</StatusBadge>
              {job.errorRows > 0 && <StatusBadge tone="negative">{job.errorRows} with errors</StatusBadge>}
              {job.warningRows > 0 && <StatusBadge tone="warning">{job.warningRows} with warnings</StatusBadge>}
              {done && <StatusBadge tone="positive">Imported</StatusBadge>}
              {job.status === 'failed' && <StatusBadge tone="negative">Failed — nothing saved</StatusBadge>}
            </div>
            {job.fileIssues.map((m) => <p key={m} className="rounded-row bg-surface-2 px-3 py-2 text-sm text-ink-muted">{m}</p>)}
            {job.errorRows > 0 && <p className="text-sm font-medium text-negative-ink">Fix the rows with errors and upload again — the import is all-or-nothing.</p>}
            {committing && (
              <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Import progress" className="h-2 w-full overflow-hidden rounded-pill bg-surface-2">
                <div className="h-full bg-accent transition-[width]" style={{ width: `${String(pct)}%` }} />
              </div>
            )}
            {done && job.result && <p className="text-sm">{summary(job)}{job.result.notes?.length ? ` · ${job.result.notes.join(' · ')}` : ''}</p>}
            {job.error && <p className="text-sm text-negative-ink">{job.error}</p>}
            {job.issues.length > 0 && (
              <DataTable columns={issueColumns} rows={job.issues.map((x, i) => ({ ...x, i }))} rowKey={(r) => String(r.i)} maxHeight={360} />
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}

function summary(job: BulkJob): string {
  const r = job.result;
  if (!r) return 'Imported';
  return `Imported: ${String(r.created)} created, ${String(r.updated)} updated${r.skipped ? `, ${String(r.skipped)} skipped` : ''}`;
}
