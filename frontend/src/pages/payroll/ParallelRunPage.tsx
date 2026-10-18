/**
 * Parallel run (cut-over gate) — compare a computed HRMS run against the
 * outgoing vendor's (Protiviti) register for the same month, employee by
 * employee. Upload the register as .xlsx/.csv (template or Report 4 layout);
 * the server parses it. Nothing here is sample data.
 */
import { useEffect, useMemo, useState } from 'react';
import { Download, FileUp, GitCompare } from 'lucide-react';
import { ApiError, apiFetch } from '../../lib/api';
import { fileToBase64, UPLOAD_ACCEPT } from '../../lib/files';
import { Button, Card, CardHeader, DataTable, EmptyState, PageHeader, Pill, Select, StatusBadge, toast } from '../../ui';
import type { Column } from '../../ui';

interface RunSummary { id: number; companyId: number; month: string; status: string; employeeCount: number }
interface Item {
  ecode: string; name: string; payableDaysHrms: number; payableDaysProtiviti: number; hrmsGrossRupees: number; protivitiGrossRupees: number;
  grossDeltaRupees: number; hrmsNetPayRupees: number; protivitiNetPayRupees: number; netDeltaRupees: number; category: string; notes: string[];
}
interface Report {
  headcount: number; exactMatchCount: number; roundingToleranceCount: number; policyDivergenceCount: number; dataDiscrepancyCount: number; unexplainedBugCount: number;
  totalHrmsGrossRupees: number; totalProtivitiGrossRupees: number; totalHrmsNetRupees: number; totalProtivitiNetRupees: number; netDeltaRupees: number; cutOverGatePassed: boolean; items: Item[];
}

/** CSV column → API field. Template headers are the left side. */
const COLUMNS: [string, string][] = [
  ['ecode', 'ecode'], ['name', 'name'], ['department', 'department'], ['designation', 'designation'], ['payable_days', 'payableDays'], ['lop_days', 'lopDays'],
  ['basic', 'basicRupees'], ['hra', 'hraRupees'], ['medical', 'medicalAllowRupees'], ['special', 'specialAllowRupees'], ['education', 'educationAllowRupees'],
  ['bonus_advance', 'bonusAdvanceRupees'], ['other_allowances', 'otherAllowancesRupees'], ['gross', 'grossRupees'], ['pf_ee', 'pfEeRupees'], ['esic_ee', 'esicEeRupees'],
  ['pt', 'ptRupees'], ['lwf', 'lwfRupees'], ['tds', 'tdsRupees'], ['other_deductions', 'otherDeductionsRupees'], ['total_deductions', 'totalDeductionsRupees'], ['net_pay', 'netPayRupees'],
];
const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export function ParallelRunPage() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [runId, setRunId] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState('all');

  useEffect(() => {
    apiFetch<RunSummary[]>('/api/payroll/runs/list', { method: 'POST', body: JSON.stringify({}) })
      .then((r) => { const computed = r.filter((x) => x.status !== 'draft' && x.status !== 'inputs_locked'); setRuns(computed); setRunId(String(computed[0]?.id ?? '')); })
      .catch(() => { setRuns([]); });
  }, []);

  async function compare(file: File) {
    const run = runs.find((r) => String(r.id) === runId);
    if (!run) return;
    setBusy(true);
    try {
      if (/\.xls$/i.test(file.name)) throw new Error('Old .xls files are not accepted — open in Excel and Save As .xlsx.');
      const parsed = await apiFetch<{ layout: string; rows: unknown[] }>('/api/payroll/parallelRun/parseRegister', { method: 'POST', body: JSON.stringify({ filename: file.name, base64: await fileToBase64(file) }) });
      const rows = parsed.rows;
      const res = await apiFetch<Report>('/api/payroll/parallelRun/compareRun', { method: 'POST', body: JSON.stringify({ runId: run.id, month: run.month.slice(0, 7), sourceFileName: file.name, rows }) });
      setReport(res); setCategory('all');
      toast.success(`Compared ${String(res.headcount)} employees`);
    } catch (e) { toast.error(e instanceof ApiError || e instanceof Error ? e.message : 'Comparison failed'); }
    finally { setBusy(false); }
  }

  const items = useMemo(() => (report?.items ?? []).filter((i) => category === 'all' || i.category === category), [report, category]);
  const cols: Column<Item>[] = [
    { key: 'ecode', header: 'E-code', render: (r) => <span className="font-mono text-xs">{r.ecode}</span> },
    { key: 'name', header: 'Employee', render: (r) => r.name },
    { key: 'days', header: 'Days HRMS / vendor', render: (r) => `${String(r.payableDaysHrms)} / ${String(r.payableDaysProtiviti)}` },
    { key: 'gross', header: 'Gross Δ', render: (r) => inr(r.grossDeltaRupees) },
    { key: 'net', header: 'Net HRMS / vendor', render: (r) => `${inr(r.hrmsNetPayRupees)} / ${inr(r.protivitiNetPayRupees)}` },
    { key: 'cat', header: 'Verdict', render: (r) => <Pill>{r.category.replaceAll('_', ' ')}</Pill> },
    { key: 'notes', header: 'Notes', render: (r) => <span className="text-xs">{r.notes.join('; ')}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Payroll" title="Parallel run" description="Upload the vendor register for a month and compare it with the HRMS run, employee by employee, before cut-over." />
      <Card>
        <CardHeader title="Compare a run" subtitle="Pick a computed run, then upload the vendor register: Excel (.xlsx) or CSV — the Report 4 register is accepted as exported." />
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Select label="HRMS run" value={runId} onChange={setRunId} options={runs.map((r) => ({ value: String(r.id), label: `${r.month.slice(0, 7)} · run #${String(r.id)} · ${r.status}` }))} placeholder={runs.length ? 'Choose a run' : 'No computed runs'} />
          <label className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-accent-ink ${!runId || busy ? 'pointer-events-none opacity-50' : ''}`}>
            <FileUp size={16} aria-hidden /> {busy ? 'Comparing…' : 'Upload register (.xlsx / .csv)'}
            <input type="file" accept={UPLOAD_ACCEPT} className="sr-only" aria-label="Upload vendor register" disabled={!runId || busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void compare(f); e.target.value = ''; }} />
          </label>
          <Button variant="ghost" leadingIcon={<Download size={16} />} onClick={() => {
            const url = URL.createObjectURL(new Blob([`${COLUMNS.map(([c]) => c).join(',')}\n`], { type: 'text/csv' }));
            const a = document.createElement('a'); a.href = url; a.download = 'vendor-register-template.csv'; a.click(); URL.revokeObjectURL(url);
          }}>CSV template</Button>
        </div>
      </Card>
      {report ? (
        <Card>
          <CardHeader title={report.cutOverGatePassed ? 'Cut-over gate passed' : 'Cut-over gate NOT passed'} subtitle={`${String(report.headcount)} employees · net Δ ${inr(report.netDeltaRupees)}`}
            action={<StatusBadge tone={report.cutOverGatePassed ? 'positive' : 'negative'}>{report.cutOverGatePassed ? 'Pass' : 'Fail'}</StatusBadge>} />
          <div className="mt-4 grid gap-3 sm:grid-cols-5 text-sm">
            <div><p className="text-ink-muted">Exact</p><p className="text-lg font-semibold">{report.exactMatchCount}</p></div>
            <div><p className="text-ink-muted">Rounding</p><p className="text-lg font-semibold">{report.roundingToleranceCount}</p></div>
            <div><p className="text-ink-muted">Policy</p><p className="text-lg font-semibold">{report.policyDivergenceCount}</p></div>
            <div><p className="text-ink-muted">Data</p><p className="text-lg font-semibold">{report.dataDiscrepancyCount}</p></div>
            <div><p className="text-ink-muted">Unexplained</p><p className="text-lg font-semibold">{report.unexplainedBugCount}</p></div>
          </div>
          <div className="mt-4 flex items-end gap-3">
            <Select label="Show" value={category} onChange={setCategory} options={[{ value: 'all', label: 'All' }, ...[...new Set(report.items.map((i) => i.category))].map((c) => ({ value: c, label: c.replaceAll('_', ' ') }))]} />
          </div>
          <div className="mt-3"><DataTable columns={cols} rows={items} rowKey={(r) => r.ecode} empty={<EmptyState title="No rows in this category" />} /></div>
        </Card>
      ) : (
        <Card><EmptyState icon={<GitCompare />} title="No comparison yet" description="Results appear here after you upload a register." /></Card>
      )}
    </div>
  );
}
