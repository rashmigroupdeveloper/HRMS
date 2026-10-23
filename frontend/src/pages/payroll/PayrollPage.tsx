/**
 * Payroll run console (PAY-03..06, docs/05 §4.5) — wired to the real run API.
 *
 * One screen for the monthly cycle: pick or create the run, enter variable
 * inputs (single or CSV), lock, compute, review the register, send for
 * approval, approve (independent checker), finalize (typed confirmation),
 * generate outputs, mark paid. Back-to-draft and super-admin reopen are the
 * undo paths. Every button maps to one audited server transition.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Banknote, Download, FileUp, Lock, Plus, RotateCcw, Search, Settings2, Trash2 } from 'lucide-react';
import { BulkUploadDrawer } from '../imports/BulkUploadDrawer';
import { DashboardError } from '../home/DashboardFeedback';
import { ApiError, apiFetch } from '../../lib/api';
import type { SessionUser } from '../../lib/session';
import { hasPermission, hasRole } from '../../lib/session';
import {
  Button, Card, CardHeader, ConfirmModal, DataTable, Drawer, EmptyState, PageHeader, Pill, Select, StatusBadge, TextField, Textarea, Timeline, toast,
} from '../../ui';
import type { Column, StatusTone, TimelineStep } from '../../ui';

interface Company { id: number; name: string; code: string }
interface RunSummary {
  id: number; companyId: number; month: string; runType: string; status: string; attendanceLockId: number | null;
  computedAt: string | null; approvedAt: string | null; finalizedAt: string | null; employeeCount: number;
  grossRupees: number; totalDeductionsRupees: number; netPayRupees: number;
}
interface RegisterLine { code: string; name: string; kind: string; amountRupees: number; calcNote: string | null }
interface RegisterItem {
  itemId: number; employeeId: number; ecode: string; name: string; payableDays: number; lopDays: number; otMinutes: number;
  grossRupees: number; deductionsRupees: number; netRupees: number; employerCostRupees: number; paymentStatus: string; hasPayslip: boolean; lines: RegisterLine[];
}
interface InputRow { id: number; employeeId: number; ecode: string; name: string; componentCode: string; amountRupees: number; note: string }
interface ComputeResult { employeeCount: number; negativeNetCount: number; exceptions: { employeeId: number; ecode: string; reason: string }[] }
interface OutputItem { code: string; label: string; note: string; isReady: boolean; generatedAt: string | null; recordCount: number | null; totalAmountRupees: number | null }

const STATES = [
  { code: 'draft', label: 'Draft', hint: 'Enter variable inputs (incentives, canteen, guest house, recoveries).' },
  { code: 'inputs_locked', label: 'Inputs locked', hint: 'Inputs frozen; attendance month lock attached.' },
  { code: 'computed', label: 'Computed', hint: 'Every employee calculated in integer paise. Check exceptions.' },
  { code: 'under_review', label: 'Under review', hint: 'Waiting for an independent checker (HR head) to approve.' },
  { code: 'approved', label: 'Approved', hint: 'Two-person check done. Ready to finalize.' },
  { code: 'finalized', label: 'Finalized', hint: 'Locked. Generate payslips, bank file and SAP JV.' },
  { code: 'paid', label: 'Paid', hint: 'Bank transfer confirmed with a payment reference.' },
] as const;

const INPUT_COMPONENTS = [
  { value: 'INCENTIVE', label: 'Incentive (earning)' },
  { value: 'OTHER_EARNINGS', label: 'Other earnings' },
  { value: 'PROJECT_ALLOW', label: 'Project allowance' },
  { value: 'ARREARS', label: 'Arrears (manual)' },
  { value: 'CANTEEN', label: 'Canteen recovery' },
  { value: 'GUEST_HOUSE', label: 'Guest house recovery' },
  { value: 'NOTICE_RECOVERY', label: 'Notice period recovery' },
  { value: 'TRAVEL_ADV_RECOVERY', label: 'Travel advance recovery' },
  { value: 'MISC_RECOVERY', label: 'Miscellaneous recovery' },
];

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const monthLabel = (m: string) => new Date(`${m.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const statusTone = (s: string): StatusTone => (s === 'paid' || s === 'finalized' ? 'positive' : s === 'approved' || s === 'under_review' ? 'info' : s === 'reopened' ? 'warning' : 'neutral');
const errText = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');

function download(name: string, content: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function nextMonthStart(): string {
  const now = new Date(Date.now() + 5.5 * 3600_000);
  return `${String(now.getUTCFullYear())}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export function PayrollPage({ user }: { user: SessionUser }) {
  const canManage = hasPermission(user, 'payroll.run.manage');
  const canSign = hasPermission(user, 'payroll.run.finalize');
  /** docs/08 §2: only hr_head co-signs (payroll.run.cosign). */
  const canCosign = hasPermission(user, 'payroll.run.cosign');
  const canReopen = hasPermission(user, 'payroll.run.reopen') || hasRole(user, 'super_admin');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tab, setTab] = useState<'register' | 'inputs' | 'outputs'>('register');
  const [items, setItems] = useState<RegisterItem[]>([]);
  const [inputs, setInputs] = useState<InputRow[]>([]);
  const [outputs, setOutputs] = useState<OutputItem[]>([]);
  const [lastCompute, setLastCompute] = useState<ComputeResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newRun, setNewRun] = useState<{ open: boolean; companyId: string; month: string }>({ open: false, companyId: '', month: nextMonthStart() });
  const [confirm, setConfirm] = useState<null | 'finalize' | 'reopen' | 'draft' | 'paid'>(null);
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'hold' | 'zero' | 'lop'>('all');
  const [slip, setSlip] = useState<RegisterItem | null>(null);
  const [identifierGaps, setIdentifierGaps] = useState<{ ecode: string; name: string; missing: string[] }[] | null>(null);

  const run = runs?.find((r) => r.id === selectedId) ?? null;

  const preflightCompanyId = run?.companyId ?? null;
  useEffect(() => {
    if (preflightCompanyId === null) {
      setIdentifierGaps(null);
      return;
    }
    let cancelled = false;
    void apiFetch<{ gaps: { ecode: string; name: string; missing: string[] }[] }>(`/api/payroll/preflight?companyId=${String(preflightCompanyId)}`)
      .then((result) => {
        if (!cancelled) setIdentifierGaps(result.gaps);
      })
      .catch(() => {
        if (!cancelled) setIdentifierGaps(null);
      });
    return () => {
      cancelled = true;
    };
  }, [preflightCompanyId]);
  const company = companies.find((c) => c.id === run?.companyId);

  const loadRuns = useCallback(async () => {
    try {
      const [list, comp] = await Promise.all([
        apiFetch<RunSummary[]>('/api/payroll/runs/list', { method: 'POST', body: JSON.stringify({}) }),
        apiFetch<{ companies: Company[] }>('/api/core/companies').catch(() => ({ companies: [] })),
      ]);
      const sorted = [...list].sort((a, b) => b.month.localeCompare(a.month) || a.companyId - b.companyId);
      setRuns(sorted); setCompanies(comp.companies);
      setSelectedId((cur) => cur ?? sorted[0]?.id ?? null);
      setError(null);
    } catch (e) { setError(errText(e)); }
  }, []);

  const loadRunDetail = useCallback(async (id: number) => {
    const [reg, inp, out] = await Promise.all([
      apiFetch<RegisterItem[]>(`/api/payroll/runs/${String(id)}/items`).catch(() => []),
      apiFetch<InputRow[]>(`/api/payroll/runs/${String(id)}/inputs`).catch(() => []),
      apiFetch<{ outputs: OutputItem[] }>('/api/payroll/outputs/getRunOutputs', { method: 'POST', body: JSON.stringify({ runId: id }) }).catch(() => ({ outputs: [] })),
    ]);
    setItems(reg); setInputs(inp); setOutputs(out.outputs);
  }, []);

  useEffect(() => { void loadRuns(); }, [loadRuns]);
  useEffect(() => { if (selectedId !== null) void loadRunDetail(selectedId); }, [selectedId, loadRunDetail]);

  async function step(label: string, path: string, body: Record<string, unknown>, after?: (res: unknown) => void) {
    if (!run) return;
    setBusy(label);
    try {
      const res = await apiFetch<unknown>(path, { method: 'POST', body: JSON.stringify({ id: run.id, ...body }) });
      after?.(res);
      toast.success(`${label}: done`);
      await loadRuns(); await loadRunDetail(run.id);
    } catch (e) { toast.error(errText(e)); }
    finally { setBusy(null); }
  }

  async function createRun() {
    setBusy('Create run');
    try {
      const res = await apiFetch<{ id: number }>('/api/payroll/runs/create', { method: 'POST', body: JSON.stringify({ company_id: Number(newRun.companyId), month: newRun.month }) });
      toast.success('Draft run created — add variable inputs, then lock.');
      setNewRun((s) => ({ ...s, open: false }));
      setSelectedId(res.id); setTab('inputs');
      await loadRuns();
    } catch (e) { toast.error(errText(e)); }
    finally { setBusy(null); }
  }

  async function generate(code: 'payslips' | 'bank' | 'jv') {
    if (!run) return;
    const path = code === 'payslips' ? 'generateRunPayslips' : code === 'bank' ? 'generateBankFile' : 'generateSapJv';
    setBusy(code);
    try {
      const res = await apiFetch<{ csvContent?: string; generatedCount?: number; recordCount?: number; isBalanced?: boolean }>(`/api/payroll/outputs/${path}`, { method: 'POST', body: JSON.stringify({ runId: run.id }) });
      if (res.csvContent) download(`${company?.code ?? 'run'}-${run.month.slice(0, 7)}-${code}.csv`, res.csvContent);
      toast.success(code === 'payslips' ? `${String(res.generatedCount ?? 0)} payslips archived` : code === 'bank' ? `Bank file: ${String(res.recordCount ?? 0)} transfers` : `SAP JV ${res.isBalanced ? 'balanced' : 'NOT balanced'}`);
      await loadRunDetail(run.id);
    } catch (e) { toast.error(errText(e)); }
    finally { setBusy(null); }
  }

  const filtered = useMemo(() => items.filter((i) => {
    const q = search.trim().toLowerCase();
    if (q && !i.ecode.toLowerCase().includes(q) && !i.name.toLowerCase().includes(q)) return false;
    if (filter === 'hold') return i.paymentStatus !== 'payable' && i.paymentStatus !== 'paid';
    if (filter === 'zero') return i.netRupees <= 0;
    if (filter === 'lop') return i.lopDays > 0;
    return true;
  }), [items, search, filter]);

  function exportRegister() {
    if (!run) return;
    const head = 'ecode,name,payable_days,lop_days,gross,deductions,net,employer_cost,status';
    const rows = items.map((i) => [i.ecode, `"${(/^[=+\-@]/.test(i.name) ? `'${i.name}` : i.name).replace(/"/g, '""')}"`, i.payableDays, i.lopDays, i.grossRupees, i.deductionsRupees, i.netRupees, i.employerCostRupees, i.paymentStatus].join(','));
    download(`${company?.code ?? 'run'}-${run.month.slice(0, 7)}-register.csv`, [head, ...rows].join('\n'));
  }

  const currentIdx = run ? STATES.findIndex((s) => s.code === run.status) : -1;
  const timeline: TimelineStep[] = STATES.map((s, i) => ({
    id: s.code, title: s.label, description: s.hint,
    state: run?.status === 'reopened' ? (i === 0 ? 'current' : 'pending') : i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'pending',
  }));

  const registerColumns: Column<RegisterItem>[] = [
    { key: 'ecode', header: 'E-code', render: (r) => <span className="font-mono text-xs">{r.ecode}</span> },
    { key: 'name', header: 'Employee', render: (r) => r.name },
    { key: 'days', header: 'Paid days', render: (r) => `${String(r.payableDays)}${r.lopDays > 0 ? ` (LOP ${String(r.lopDays)})` : ''}` },
    { key: 'gross', header: 'Gross', render: (r) => inr(r.grossRupees) },
    { key: 'ded', header: 'Deductions', render: (r) => inr(r.deductionsRupees) },
    { key: 'net', header: 'Net pay', render: (r) => <strong>{inr(r.netRupees)}</strong> },
    { key: 'status', header: 'Status', render: (r) => <Pill>{r.paymentStatus.replace('_', ' ')}</Pill> },
  ];

  const status = run?.status ?? '';
  const isDraft = status === 'draft' || status === 'reopened';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Payroll"
        title="Payroll runs"
        description="Create the month's run, enter inputs, compute, review, approve and pay — every step is audited."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/payroll/settings"><Button variant="secondary" leadingIcon={<Settings2 size={16} />}>Payroll settings</Button></Link>
            {canManage && <Button leadingIcon={<Plus size={16} />} onClick={() => { setNewRun((s) => ({ ...s, open: true, companyId: s.companyId || String(companies[0]?.id ?? '') })); }}>New run</Button>}
          </div>
        }
      />
      {error && <DashboardError message={error} onRetry={() => { void loadRuns(); }} />}
      {identifierGaps !== null && identifierGaps.length > 0 && (
        <Card>
          <CardHeader
            title={`${String(identifierGaps.length)} people are missing pay identifiers`}
            subtitle="PAN, UAN, ESIC or bank details. Compute can still run; the bank file and TDS export will stop on these."
          />
          <ul className="mt-3 space-y-1 text-sm">
            {identifierGaps.slice(0, 12).map((gap) => (
              <li key={gap.ecode}><span className="font-mono">{gap.ecode}</span> {gap.name} — {gap.missing.join(', ')}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card padded={false}>
          <div className="p-4"><CardHeader title="Runs" subtitle={runs ? `${String(runs.length)} runs` : 'Loading…'} /></div>
          {runs?.length === 0 ? (
            <div className="p-4"><EmptyState title="No payroll runs yet" description={canManage ? 'Lock the attendance month, then create the run with “New run”.' : 'Runs appear here once payroll creates them.'} /></div>
          ) : (
            <ul aria-label="Payroll runs" className="divide-y divide-line">
              {(runs ?? []).map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => { setSelectedId(r.id); setLastCompute(null); }} aria-current={r.id === selectedId}
                    className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-surface-2 ${r.id === selectedId ? 'bg-surface-2' : ''}`}>
                    <span>
                      <span className="block text-sm font-semibold">{monthLabel(r.month)}</span>
                      <span className="block text-xs text-ink-muted">{companies.find((c) => c.id === r.companyId)?.code ?? `Company ${String(r.companyId)}`} · {r.employeeCount} employees</span>
                    </span>
                    <StatusBadge tone={statusTone(r.status)}>{r.status.replace('_', ' ')}</StatusBadge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {run ? (
          <div className="space-y-6">
            <Card>
              <CardHeader title={`${company?.name ?? 'Company'} — ${monthLabel(run.month)}`} subtitle={`Run #${String(run.id)} · ${run.runType}${run.attendanceLockId ? '' : ' · attendance month NOT locked yet'}`}
                action={<StatusBadge tone={statusTone(run.status)}>{run.status.replace('_', ' ')}</StatusBadge>} />
              <div className="mt-4 grid gap-4 sm:grid-cols-4">
                <div><p className="text-xs text-ink-muted">Employees</p><p className="text-xl font-semibold">{run.employeeCount}</p></div>
                <div><p className="text-xs text-ink-muted">Gross</p><p className="text-xl font-semibold">{inr(run.grossRupees)}</p></div>
                <div><p className="text-xs text-ink-muted">Deductions</p><p className="text-xl font-semibold">{inr(run.totalDeductionsRupees)}</p></div>
                <div><p className="text-xs text-ink-muted">Net pay</p><p className="text-xl font-semibold">{inr(run.netPayRupees)}</p></div>
              </div>
              <div role="group" className="mt-5 flex flex-wrap gap-2" aria-label="Run actions">
                {canManage && isDraft && <Button leadingIcon={<Lock size={16} />} loading={busy === 'Lock inputs'} onClick={() => void step('Lock inputs', '/api/payroll/runs/lockInputs', {})}>Lock inputs</Button>}
                {canManage && status === 'inputs_locked' && <Button loading={busy === 'Compute'} onClick={() => void step('Compute', '/api/payroll/runs/compute', {}, (r) => { setLastCompute(r as ComputeResult); setTab('register'); })}>Compute payroll</Button>}
                {canManage && status === 'computed' && <Button loading={busy === 'Send for review'} onClick={() => void step('Send for review', '/api/payroll/runs/review', {})}>Send for approval</Button>}
                {canCosign && status === 'under_review' && <Button loading={busy === 'Approve'} onClick={() => void step('Approve', '/api/payroll/runs/approve', {})}>Approve (checker)</Button>}
                {canSign && status === 'approved' && <Button variant="hero" onClick={() => { setConfirm('finalize'); }}>Finalize…</Button>}
                {canManage && status === 'finalized' && <Button variant="secondary" onClick={() => { setTab('outputs'); }}>Outputs</Button>}
                {canSign && status === 'finalized' && <Button leadingIcon={<Banknote size={16} />} onClick={() => { setReason(''); setConfirm('paid'); }}>Mark paid…</Button>}
                {canManage && ['inputs_locked', 'computed', 'under_review'].includes(status) && <Button variant="ghost" leadingIcon={<RotateCcw size={16} />} onClick={() => { setReason(''); setConfirm('draft'); }}>Back to draft</Button>}
                {canReopen && ['approved', 'finalized'].includes(status) && <Button variant="danger" leadingIcon={<RotateCcw size={16} />} onClick={() => { setReason(''); setConfirm('reopen'); }}>Reopen…</Button>}
              </div>
              {!canManage && !canSign && <p className="mt-3 text-sm text-ink-muted">You have read-only access to payroll runs.</p>}
            </Card>

            {lastCompute && (lastCompute.exceptions.length > 0 || lastCompute.negativeNetCount > 0) && (
              <Card>
                <CardHeader title={`${String(lastCompute.exceptions.length)} employees need attention`} subtitle="These were skipped or flagged — fix the data and recompute (Back to draft → Lock → Compute)." action={<AlertTriangle className="text-warning-ink" aria-hidden />} />
                <ul className="mt-3 space-y-1 text-sm">{lastCompute.exceptions.map((x) => <li key={x.employeeId}><span className="font-mono">{x.ecode}</span> — {x.reason}</li>)}</ul>
              </Card>
            )}

            <Card>
              <div role="tablist" aria-label="Run detail" className="mb-4 flex flex-wrap gap-2">
                {(['register', 'inputs', 'outputs'] as const).map((t) => (
                  <Button key={t} role="tab" aria-selected={tab === t} variant={tab === t ? 'primary' : 'ghost'} size="sm" onClick={() => { setTab(t); }}>
                    {t === 'register' ? `Register (${String(items.length)})` : t === 'inputs' ? `Variable inputs (${String(inputs.length)})` : 'Outputs'}
                  </Button>
                ))}
              </div>
              {tab === 'register' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <TextField label="Search" placeholder="E-code or name" value={search} onChange={(e) => { setSearch(e.target.value); }} leadingIcon={<Search size={16} />} />
                    <Select label="Show" value={filter} onChange={(v) => { setFilter(v as typeof filter); }} options={[{ value: 'all', label: 'Everyone' }, { value: 'lop', label: 'With LOP' }, { value: 'zero', label: 'Zero / negative net' }, { value: 'hold', label: 'On hold' }]} />
                    <Button variant="secondary" leadingIcon={<Download size={16} />} disabled={items.length === 0} onClick={exportRegister}>Export CSV</Button>
                  </div>
                  <DataTable columns={registerColumns} rows={filtered} rowKey={(r) => String(r.itemId)} onRowClick={setSlip}
                    empty={<EmptyState title={items.length === 0 ? 'Not computed yet' : 'No employees match'} description={items.length === 0 ? 'Lock inputs and compute to see the register.' : 'Clear the search or filter.'} />} />
                </div>
              )}
              {tab === 'inputs' && <InputsPanel runId={run.id} editable={canManage && isDraft} rows={inputs} onChanged={() => void loadRunDetail(run.id)} companyCode={company?.code ?? ''} />}
              {tab === 'outputs' && (
                <div className="space-y-3">
                  {status !== 'finalized' && status !== 'paid' ? <EmptyState title="Outputs unlock after finalize" description="Payslips, the bank file and the SAP JV are generated from the finalized register." /> : (
                    <div className="flex flex-wrap gap-2">
                      {canManage && <Button loading={busy === 'payslips'} onClick={() => void generate('payslips')}>Generate payslips</Button>}
                      {canManage && <Button loading={busy === 'bank'} onClick={() => void generate('bank')}>Bank file (replaces the active file)</Button>}
                      <Link to="/payroll/tds" className="inline-flex items-center text-sm text-ink underline">Form 24Q and Form 16</Link>
                      {canManage && <Button loading={busy === 'jv'} onClick={() => void generate('jv')}>SAP JV (CSV)</Button>}
                    </div>
                  )}
                  <ul className="divide-y divide-line text-sm">
                    {outputs.map((o) => (
                      <li key={o.code} className="flex items-center justify-between gap-3 py-2">
                        <span><strong>{o.label}</strong><span className="block text-xs text-ink-muted">{o.note}</span></span>
                        <StatusBadge tone={o.isReady ? 'positive' : 'neutral'}>{o.isReady ? `Ready${o.recordCount !== null ? ` · ${String(o.recordCount)}` : ''}` : 'Not generated'}</StatusBadge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>

            <Card><CardHeader title="Run lifecycle" /><div className="mt-3"><Timeline steps={timeline} /></div></Card>
          </div>
        ) : (
          runs !== null && <Card><EmptyState title="Select a run" description="Pick a month on the left, or create a new run." /></Card>
        )}
      </div>

      <Drawer open={newRun.open} onClose={() => { setNewRun((s) => ({ ...s, open: false })); }} title="New payroll run"
        footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => { setNewRun((s) => ({ ...s, open: false })); }}>Cancel</Button><Button loading={busy === 'Create run'} disabled={!newRun.companyId} onClick={() => void createRun()}>Create draft run</Button></div>}>
        <div className="space-y-4">
          <Select label="Company" required value={newRun.companyId} onChange={(v) => { setNewRun((s) => ({ ...s, companyId: v })); }} options={companies.map((c) => ({ value: String(c.id), label: `${c.name} (${c.code})` }))} />
          <TextField label="Payroll month" type="month" required value={newRun.month.slice(0, 7)} onChange={(e) => { setNewRun((s) => ({ ...s, month: `${e.target.value}-01` })); }} hint="The attendance month lock for this company and month is attached automatically." />
        </div>
      </Drawer>

      <Drawer open={slip !== null} onClose={() => { setSlip(null); }} title={slip ? `${slip.name} (${slip.ecode})` : ''} subtitle={slip ? `${String(slip.payableDays)} paid days · net ${inr(slip.netRupees)}` : ''}>
        {slip && (
          <div className="space-y-4 text-sm">
            {(['earning', 'deduction', 'employer_contribution'] as const).map((kind) => (
              <section key={kind}>
                <h3 className="mb-1 font-semibold">{kind === 'earning' ? 'Earnings' : kind === 'deduction' ? 'Deductions' : 'Employer contributions'}</h3>
                <ul className="divide-y divide-line">
                  {slip.lines.filter((l) => l.kind === kind).map((l) => (
                    <li key={l.code} className="flex justify-between gap-3 py-1.5"><span>{l.name}{l.calcNote && <span className="block text-xs text-ink-muted">{l.calcNote}</span>}</span><span className="tabular-nums">{inr(l.amountRupees)}</span></li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Drawer>

      <ConfirmModal open={confirm === 'finalize'} onClose={() => { setConfirm(null); }} title="Finalize this payroll run?"
        description="Finalized runs are locked and post loan recoveries. Only a super admin can reopen."
        typedConfirmation={`FINALIZE ${run ? monthLabel(run.month).toUpperCase() : ''}`} confirmLabel="Finalize"
        onConfirm={() => { setConfirm(null); void step('Finalize', '/api/payroll/runs/finalize', {}); }} />
      <Drawer open={confirm === 'draft' || confirm === 'reopen' || confirm === 'paid'} onClose={() => { setConfirm(null); }}
        title={confirm === 'reopen' ? 'Reopen run' : confirm === 'paid' ? 'Mark run paid' : 'Send run back to draft'}
        footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => { setConfirm(null); }}>Cancel</Button>
          <Button variant={confirm === 'reopen' ? 'danger' : 'primary'} disabled={reason.trim().length < (confirm === 'paid' ? 3 : 5)} onClick={() => {
            const c = confirm; setConfirm(null);
            if (c === 'reopen') void step('Reopen', '/api/payroll/runs/reopen', { reason });
            else if (c === 'paid') void step('Mark paid', '/api/payroll/runs/markPaid', { paymentReference: reason });
            else void step('Back to draft', '/api/payroll/runs/returnToDraft', { reason });
          }}>Confirm</Button></div>}>
        <Textarea label={confirm === 'paid' ? 'Bank payment reference (UTR / batch no.)' : 'Reason (recorded in the audit log)'} value={reason} onChange={(e) => { setReason(e.target.value); }} required />
        {confirm === 'reopen' && <p className="mt-3 text-sm text-ink-muted">Reopening reverses loan postings; the bank file must be regenerated after re-finalizing.</p>}
      </Drawer>
    </div>
  );
}

function InputsPanel({ runId, editable, rows, onChanged, companyCode }: { runId: number; editable: boolean; rows: InputRow[]; onChanged: () => void; companyCode: string }) {
  const [ecode, setEcode] = useState('');
  const [component, setComponent] = useState('INCENTIVE');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  async function add() {
    setSaving(true);
    try {
      // Single entry reuses the CSV path so the e-code resolves within the run's company.
      const csv = `ecode,component_code,amount,note\n${ecode.trim()},${component},${amount},"${note.replace(/"/g, '""')}"\n`;
      await apiFetch(`/api/payroll/runs/${String(runId)}/inputs/upload`, { method: 'POST', body: JSON.stringify({ csv }) });
      toast.success('Input added'); setAmount(''); setNote(''); onChanged();
    } catch (e) { toast.error(errText(e)); }
    finally { setSaving(false); }
  }
  async function remove(id: number) {
    try { await apiFetch(`/api/payroll/runs/${String(runId)}/inputs/${String(id)}`, { method: 'DELETE' }); toast.success('Input removed'); onChanged(); }
    catch (e) { toast.error(errText(e)); }
  }
  const cols: Column<InputRow>[] = [
    { key: 'ecode', header: 'E-code', render: (r) => <span className="font-mono text-xs">{r.ecode}</span> },
    { key: 'name', header: 'Employee', render: (r) => r.name },
    { key: 'comp', header: 'Component', render: (r) => r.componentCode },
    { key: 'amt', header: 'Amount', render: (r) => inr(r.amountRupees) },
    { key: 'note', header: 'Note', render: (r) => r.note },
    { key: 'x', header: '', render: (r) => editable ? <Button size="sm" variant="ghost" aria-label={`Remove ${r.componentCode} for ${r.ecode}`} onClick={(e) => { e.stopPropagation(); void remove(r.id); }}><Trash2 size={14} /></Button> : null },
  ];
  return (
    <div className="space-y-4">
      {editable ? (
        <div className="grid gap-3 rounded-xl border border-line p-4 md:grid-cols-[1fr_1fr_140px_1.5fr_auto]">
          <TextField label="E-code" value={ecode} onChange={(e) => { setEcode(e.target.value); }} placeholder={`${companyCode || 'RML'}0xxxxx`} />
          <Select label="Component" value={component} onChange={setComponent} options={INPUT_COMPONENTS} />
          <TextField label="Amount (₹)" type="number" min="0" step="0.01" value={amount} onChange={(e) => { setAmount(e.target.value); }} />
          <TextField label="Note" value={note} onChange={(e) => { setNote(e.target.value); }} placeholder="e.g. June canteen" />
          <div className="flex items-end"><Button loading={saving} disabled={!ecode || !amount || note.trim().length < 2} onClick={() => void add()}>Add</Button></div>
          <div className="md:col-span-5 flex flex-wrap items-center gap-3 text-sm">
            <Button variant="secondary" size="sm" onClick={() => { setBulkOpen(true); }}><FileUp size={16} aria-hidden /> Bulk upload (Excel / CSV / Report 4)</Button>
            <span className="text-ink-muted">All rows are checked first; one bad row rejects the file with every problem listed.</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Inputs are read-only once locked. Use “Back to draft” to change them.</p>
      )}
      <BulkUploadDrawer importer="payroll-inputs" title="Upload variable inputs" open={bulkOpen} onClose={() => { setBulkOpen(false); }} context={{ runId }} onCommitted={onChanged} />
      <DataTable columns={cols} rows={rows} rowKey={(r) => String(r.id)} empty={<EmptyState title="No variable inputs" description="Incentives, canteen and guest-house recoveries entered here flow into the next compute." />} />
    </div>
  );
}
