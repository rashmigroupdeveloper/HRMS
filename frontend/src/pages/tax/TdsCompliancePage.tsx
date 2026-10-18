/**
 * Payroll TDS compliance (handover item 3): challans vs deducted TDS by month,
 * Form 24Q quarterly export and Form 16 per employee. Company-scoped on the server.
 */
import { useCallback, useEffect, useState } from 'react';
import { Download, Plus, Trash2 } from 'lucide-react';
import { ApiError, apiFetch } from '../../lib/api';
import { downloadBase64 } from '../../lib/files';
import { Button, Card, CardHeader, ConfirmModal, DataTable, Drawer, PageHeader, Select, StatusBadge, TextField, toast, type Column } from '../../ui';
import { currentFy, fyOptions, inr } from './tax-utils';

interface Company { id: number; name: string; code: string }
interface Line { month: string; deductedRupees: number; depositedRupees: number; differenceRupees: number; challans: number; dueDate: string; lateChallans: number; status: 'matched' | 'short' | 'excess' | 'nil' }
interface Recon { lines: Line[]; totals: { deductedRupees: number; depositedRupees: number; differenceRupees: number } }
interface Challan { id: number; month: string; amountRupees: number; challanNo: string; bsrCode: string; paidOn: string }

const msg = (e: unknown, f: string) => (e instanceof ApiError ? e.message : f);
const tone = { matched: 'positive', short: 'negative', excess: 'warning', nil: 'neutral' } as const;
const monthName = (m: string) => new Date(`${m}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export function TdsCompliancePage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [fy, setFy] = useState(currentFy());
  const [recon, setRecon] = useState<Recon | null>(null);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [deleting, setDeleting] = useState<Challan | null>(null);
  const [ecode, setEcode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<{ companies: Company[] }>('/api/core/companies').then((r) => { setCompanies(r.companies); setCompanyId((c) => c || String(r.companies[0]?.id ?? '')); }).catch(() => { setCompanies([]); });
  }, []);
  const load = useCallback(() => {
    if (!companyId) return;
    const q = `companyId=${companyId}&fy=${fy}`;
    Promise.all([apiFetch<Recon>(`/api/tax/reconciliation?${q}`), apiFetch<Challan[]>(`/api/tax/challans?${q}`)])
      .then(([r, c]) => { setRecon(r); setChallans(c); })
      .catch((e: unknown) => { setRecon(null); setChallans([]); toast.error(msg(e, 'Could not load TDS data.')); });
  }, [companyId, fy]);
  useEffect(load, [load]);

  async function addChallan() {
    if (!form) return;
    setBusy(true);
    try {
      await apiFetch('/api/tax/challans', { method: 'POST', body: JSON.stringify({ companyId: Number(companyId), month: form['month'], amountRupees: Number(form['amount']), paidOn: form['paidOn'], bsrCode: form['bsr'], challanNo: form['no'] }) });
      toast.success('Challan recorded.'); setForm(null); load();
    } catch (e) { toast.error(msg(e, 'Could not save the challan.')); } finally { setBusy(false); }
  }
  async function removeChallan() {
    if (!deleting) return;
    try { await apiFetch(`/api/tax/challans/${String(deleting.id)}`, { method: 'DELETE' }); toast.success('Challan deleted.'); load(); }
    catch (e) { toast.error(msg(e, 'Could not delete.')); } finally { setDeleting(null); }
  }
  async function form24q(quarter: number) {
    try { const f = await apiFetch<{ filename: string; base64: string }>(`/api/tax/form24q?companyId=${companyId}&fy=${fy}&quarter=${String(quarter)}&format=csv`); downloadBase64(f.filename, f.base64, 'text/csv'); }
    catch (e) { toast.error(msg(e, 'Could not build Form 24Q.')); }
  }
  async function form16() {
    try {
      const f = await apiFetch<{ filename: string; base64: string }>(`/api/tax/form16?ecode=${encodeURIComponent(ecode.trim())}&fy=${fy}&format=pdf`);
      downloadBase64(f.filename, f.base64, 'application/pdf');
    } catch (e) { toast.error(msg(e, 'Could not build Form 16.')); }
  }

  const lineCols: Column<Line>[] = [
    { key: 'month', header: 'Month', render: (l) => monthName(l.month), sortValue: (l) => l.month },
    { key: 'ded', header: 'TDS deducted', numeric: true, render: (l) => inr(l.deductedRupees), exportValue: (l) => l.deductedRupees },
    { key: 'dep', header: 'Deposited', numeric: true, render: (l) => inr(l.depositedRupees), exportValue: (l) => l.depositedRupees },
    { key: 'diff', header: 'Difference', numeric: true, render: (l) => inr(l.differenceRupees), exportValue: (l) => l.differenceRupees },
    { key: 'due', header: 'Due by', render: (l) => l.dueDate },
    { key: 'status', header: 'Status', render: (l) => <span className="flex gap-1"><StatusBadge tone={tone[l.status]}>{l.status}</StatusBadge>{l.lateChallans > 0 && <StatusBadge tone="warning">late</StatusBadge>}</span>, exportValue: (l) => l.status },
  ];
  const challanCols: Column<Challan>[] = [
    { key: 'month', header: 'For month', render: (c) => monthName(c.month), sortValue: (c) => c.month },
    { key: 'no', header: 'Challan', render: (c) => `${c.bsrCode} / ${c.challanNo}` },
    { key: 'paid', header: 'Paid on', render: (c) => c.paidOn },
    { key: 'amt', header: 'Amount', numeric: true, render: (c) => inr(c.amountRupees), exportValue: (c) => c.amountRupees },
    { key: 'x', header: '', label: 'Actions', render: (c) => <Button size="sm" variant="ghost" leadingIcon={<Trash2 />} onClick={() => { setDeleting(c); }}>Delete</Button> },
  ];
  const missing = !form || ['month', 'amount', 'paidOn', 'bsr', 'no'].some((k) => !form[k]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Payroll · Statutory" title="TDS compliance" description="Reconcile TDS deducted in finalized payroll with deposited challans, export Form 24Q and issue Form 16."
        actions={<Button variant="primary" leadingIcon={<Plus />} disabled={!companyId} onClick={() => { setForm({}); }}>Record challan</Button>} />
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-64"><Select label="Company" value={companyId} onChange={setCompanyId} options={companies.map((c) => ({ value: String(c.id), label: `${c.code} · ${c.name}` }))} /></div>
          <div className="w-40"><Select label="Financial year" value={fy} onChange={setFy} options={fyOptions()} /></div>
          {recon && <div className="text-sm">Deducted <b>{inr(recon.totals.deductedRupees)}</b> · deposited <b>{inr(recon.totals.depositedRupees)}</b> · gap <b>{inr(recon.totals.differenceRupees)}</b></div>}
        </div>
      </Card>
      <Card>
        <CardHeader title="Monthly reconciliation" />
        <DataTable tableId="tds-recon" columns={lineCols} rows={recon?.lines ?? []} rowKey={(l) => l.month} exportName={`tds-recon-${fy}`} caption="TDS reconciliation" empty="Choose a company." />
      </Card>
      <Card>
        <CardHeader title="Challans" />
        <DataTable tableId="tds-challans" columns={challanCols} rows={challans} rowKey={(c) => String(c.id)} exportName={`tds-challans-${fy}`} caption="TDS challans" empty="No challans recorded for this year." />
      </Card>
      <Card>
        <CardHeader title="Returns and certificates" />
        <div className="flex flex-wrap items-end gap-3">
          {[1, 2, 3, 4].map((q) => <Button key={q} variant="secondary" leadingIcon={<Download />} disabled={!companyId} onClick={() => void form24q(q)}>Form 24Q · Q{q}</Button>)}
          <div className="w-48"><TextField label="Employee code" value={ecode} onChange={(e) => { setEcode(e.target.value); }} /></div>
          <Button variant="secondary" leadingIcon={<Download />} disabled={!ecode.trim()} onClick={() => void form16()}>Form 16 (PDF)</Button>
        </div>
      </Card>
      <Drawer open={form !== null} onClose={() => { setForm(null); }} title="Record TDS challan"
        footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => { setForm(null); }}>Cancel</Button><Button variant="primary" loading={busy} disabled={missing} onClick={() => void addChallan()}>Save</Button></div>}>
        <div className="grid gap-4">
          {([['month', 'Deduction month (YYYY-MM-01)', 'text'], ['amount', 'Amount (₹)', 'number'], ['paidOn', 'Paid on', 'date'], ['bsr', 'BSR code (7 digits)', 'text'], ['no', 'Challan serial (5 digits)', 'text']] as const).map(([k, label, type]) => (
            <TextField key={k} label={`${label} *`} type={type} value={form?.[k] ?? ''} onChange={(e) => { const v = e.target.value; setForm((p) => (p ? { ...p, [k]: v } : p)); }} />
          ))}
        </div>
      </Drawer>
      <ConfirmModal open={deleting !== null} title="Delete challan?" description={deleting ? `${deleting.bsrCode} / ${deleting.challanNo} for ${monthName(deleting.month)}` : ''} confirmLabel="Delete" danger onConfirm={() => void removeChallan()} onClose={() => { setDeleting(null); }} />
    </div>
  );
}
