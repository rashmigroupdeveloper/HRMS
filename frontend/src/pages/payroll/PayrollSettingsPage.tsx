/**
 * Payroll settings (handover item 6, E2E-003, RQ-STAT-013): effective-dated statutory
 * rates, PT slabs per state and SAP GL mapping on /api/payroll/config/*. Every change is a
 * new dated version (never an overwrite) and is audited server-side; edits need payroll.run.manage.
 */
import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { ApiError, apiFetch } from '../../lib/api';
import { hasPermission, type SessionUser } from '../../lib/session';
import { Button, Card, DataTable, Drawer, PageHeader, Select, TextField, toast, type Column } from '../../ui';

type Tab = 'rates' | 'pt' | 'gl';
interface Rate { id: number; scheme: string; param: string; value: number; effectiveFrom: string; sourceNote: string }
interface Slab { id: number; stateCode: string; minMonthly: number; maxMonthly: number | null; amount: number; effectiveFrom: string; basis: string }
interface Gl { id: number; companyCode: string; plantCode: string; costCenterCode: string; componentCode: string; glCode: string }

const msg = (e: unknown, f: string) => (e instanceof ApiError ? e.message : f);
const nextMonth = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + 1); return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

/** "0-7500:0, 7501-10000:175, 10001-:200" → slabs; exported for tests. */
export function parseSlabs(text: string): { minMonthly: number; maxMonthly: number | null; amount: number }[] {
  return text.split(/[,\n]/).map((t) => t.trim()).filter(Boolean).map((t) => {
    const m = /^(\d+)\s*-\s*(\d*)\s*:\s*(\d+)$/.exec(t);
    if (!m) throw new Error(`Cannot read slab "${t}" — use min-max:amount, e.g. 10001-:200`);
    return { minMonthly: Number(m[1]), maxMonthly: m[2] ? Number(m[2]) : null, amount: Number(m[3]) };
  });
}

export function PayrollSettingsPage({ user }: { user: SessionUser }) {
  const canEdit = hasPermission(user, 'payroll.run.manage');
  const [tab, setTab] = useState<Tab>('rates');
  const [rates, setRates] = useState<Rate[]>([]);
  const [slabs, setSlabs] = useState<Slab[]>([]);
  const [gl, setGl] = useState<Gl[]>([]);
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const fail = (e: unknown) => { toast.error(msg(e, 'Could not load payroll settings.')); };
    if (tab === 'rates') apiFetch<Rate[]>('/api/payroll/config/statutory-rates').then(setRates).catch(fail);
    if (tab === 'pt') apiFetch<Slab[]>('/api/payroll/config/pt-slabs').then(setSlabs).catch(fail);
    if (tab === 'gl') apiFetch<Gl[]>('/api/payroll/config/gl-accounts').then(setGl).catch(fail);
  }, [tab]);
  useEffect(load, [load]);

  async function save() {
    if (!form) return;
    setBusy(true);
    try {
      if (tab === 'rates') await apiFetch('/api/payroll/config/statutory-rates', { method: 'POST', body: JSON.stringify({ scheme: form['scheme'], param: form['param'], value: Number(form['value']), effectiveFrom: form['effectiveFrom'], sourceNote: form['sourceNote'] }) });
      if (tab === 'pt') await apiFetch('/api/payroll/config/pt-slabs', { method: 'PUT', body: JSON.stringify({ stateCode: (form['stateCode'] ?? '').toUpperCase(), effectiveFrom: form['effectiveFrom'], basis: form['basis'] ?? 'earned_monthly', slabs: parseSlabs(form['slabs'] ?? '') }) });
      if (tab === 'gl') await apiFetch('/api/payroll/config/gl-accounts', { method: 'PUT', body: JSON.stringify({ companyCode: form['companyCode'], plantCode: form['plantCode'], costCenterCode: form['costCenterCode'], componentCode: form['componentCode'], glCode: form['glCode'] }) });
      toast.success('Saved as a new version (audited).'); setForm(null); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save.'); } finally { setBusy(false); }
  }

  const rateCols: Column<Rate>[] = [
    { key: 's', header: 'Scheme', render: (r) => r.scheme, sortValue: (r) => r.scheme },
    { key: 'p', header: 'Parameter', render: (r) => r.param, sortValue: (r) => r.param },
    { key: 'v', header: 'Value', numeric: true, render: (r) => String(r.value) },
    { key: 'f', header: 'Effective from', render: (r) => r.effectiveFrom, sortValue: (r) => r.effectiveFrom },
    { key: 'n', header: 'Source', render: (r) => r.sourceNote },
  ];
  const slabCols: Column<Slab>[] = [
    { key: 's', header: 'State', render: (r) => r.stateCode, sortValue: (r) => r.stateCode },
    { key: 'r', header: 'Monthly gross', render: (r) => `₹${String(r.minMonthly)} – ${r.maxMonthly === null ? 'above' : `₹${String(r.maxMonthly)}`}` },
    { key: 'a', header: 'PT', numeric: true, render: (r) => `₹${String(r.amount)}` },
    { key: 'f', header: 'Effective from', render: (r) => r.effectiveFrom, sortValue: (r) => r.effectiveFrom },
    { key: 'b', header: 'Basis', render: (r) => r.basis.replace('_', ' ') },
  ];
  const glCols: Column<Gl>[] = [
    { key: 'c', header: 'Company', render: (r) => r.companyCode, sortValue: (r) => r.companyCode },
    { key: 'p', header: 'Plant', render: (r) => r.plantCode },
    { key: 'cc', header: 'Cost centre', render: (r) => r.costCenterCode },
    { key: 'k', header: 'Component', render: (r) => r.componentCode, sortValue: (r) => r.componentCode },
    { key: 'g', header: 'GL code', render: (r) => r.glCode },
  ];
  const FIELDS: Record<Tab, [string, string][]> = {
    rates: [['scheme', 'Scheme (PF, ESIC, OT, BONUS…)'], ['param', 'Parameter'], ['value', 'Value'], ['effectiveFrom', 'Effective from (YYYY-MM-01)'], ['sourceNote', 'Source / circular reference']],
    pt: [['stateCode', 'State code (e.g. WB)'], ['effectiveFrom', 'Effective from (YYYY-MM-01)'], ['slabs', 'Slabs — min-max:amount, comma separated']],
    gl: [['companyCode', 'Company code'], ['plantCode', 'Plant code'], ['costCenterCode', 'Cost centre'], ['componentCode', 'Component code'], ['glCode', 'GL code']],
  };
  const missing = !form || FIELDS[tab].some(([k]) => !form[k]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Payroll · Configuration" title="Payroll settings"
        description="Statutory rates, professional-tax slabs and SAP GL mapping. Changes create a dated version; past runs keep the values they used."
        actions={canEdit ? <Button variant="primary" leadingIcon={<Plus />} onClick={() => { setForm({ effectiveFrom: nextMonth() }); }}>Add version</Button> : undefined} />
      <Card>
        <div className="max-w-xs">
          <Select label="Section" value={tab} onChange={(v) => { setTab(v as Tab); }}
            options={[{ value: 'rates', label: 'Statutory rates (PF, ESIC, OT, bonus)' }, { value: 'pt', label: 'Professional tax slabs' }, { value: 'gl', label: 'GL mapping (SAP)' }]} />
        </div>
        <div className="mt-4">
          {tab === 'rates' && <DataTable tableId="pay-rates" columns={rateCols} rows={rates} rowKey={(r) => String(r.id)} searchable exportName="statutory-rates" caption="Statutory rates" empty="No statutory rates." />}
          {tab === 'pt' && <DataTable tableId="pay-pt" columns={slabCols} rows={slabs} rowKey={(r) => String(r.id)} searchable exportName="pt-slabs" caption="PT slabs" empty="No PT slabs." />}
          {tab === 'gl' && <DataTable tableId="pay-gl" columns={glCols} rows={gl} rowKey={(r) => String(r.id)} searchable exportName="gl-mapping" caption="GL mapping" empty="No GL mappings." />}
        </div>
      </Card>
      <Drawer open={form !== null} onClose={() => { setForm(null); }} title="Add version"
        footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => { setForm(null); }}>Cancel</Button><Button variant="primary" loading={busy} disabled={missing} onClick={() => void save()}>Save</Button></div>}>
        <div className="grid gap-4">
          {FIELDS[tab].map(([k, label]) => (
            <TextField key={k} label={`${label} *`} value={form?.[k] ?? ''} type={k === 'value' ? 'number' : 'text'}
              onChange={(e) => { const v = e.target.value; setForm((p) => (p ? { ...p, [k]: v } : p)); }} />
          ))}
          {tab === 'pt' && (
            <Select label="Basis" value={form?.['basis'] ?? 'earned_monthly'} onChange={(v) => { setForm((p) => (p ? { ...p, basis: v } : p)); }}
              options={[{ value: 'earned_monthly', label: 'Earned monthly gross' }, { value: 'contracted_monthly', label: 'Contracted monthly gross' }]} />
          )}
        </div>
      </Drawer>
    </div>
  );
}
