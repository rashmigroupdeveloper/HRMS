/**
 * Org masters (SOW 004, C-48): companies with statutory registrations, org
 * units, locations, cost centres, departments, designations, grades.
 * Everyone with directory access can read; super_admin (org.masters.manage) edits.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { ApiError, apiFetch } from '../../lib/api';
import type { SessionUser } from '../../lib/session';
import { hasPermission } from '../../lib/session';
import { Button, Card, ConfirmModal, DataTable, Drawer, PageHeader, Select, TextField, toast } from '../../ui';
import type { Column } from '../../ui';

type Kind = 'companies' | 'org_units' | 'locations' | 'cost_centers' | 'departments' | 'designations' | 'grades';
type Row = Record<string, unknown> & { id: number };
interface FieldDef { key: string; label: string; required?: boolean; company?: boolean; hint?: string; numeric?: boolean }

const MASTER_FIELDS: Record<Kind, { title: string; fields: FieldDef[] }> = {
  companies: { title: 'Companies', fields: [
    { key: 'code', label: 'Code', required: true }, { key: 'name', label: 'Legal name', required: true },
    { key: 'ecode_prefix', label: 'E-code prefix', required: true }, { key: 'pan', label: 'PAN', hint: 'AABCR1234K' },
    { key: 'tan', label: 'TAN', hint: 'CALR12345A' }, { key: 'gstin', label: 'GSTIN', hint: '15 characters; chars 3–12 = PAN' },
    { key: 'pf_establishment_code', label: 'PF establishment code', hint: 'WBCAL0012345' },
    { key: 'esic_code', label: 'ESIC employer code', hint: '17 digits' }, { key: 'pt_registration_no', label: 'PT registration no.' },
    { key: 'address', label: 'Registered address' },
  ] },
  org_units: { title: 'Org units', fields: [{ key: 'company_id', label: 'Company', required: true, company: true }, { key: 'name', label: 'Name', required: true }] },
  locations: { title: 'Locations', fields: [{ key: 'company_id', label: 'Company', required: true, company: true }, { key: 'name', label: 'Name', required: true }, { key: 'state_code', label: 'State code', required: true, hint: 'e.g. WB (drives PT slab)' }] },
  cost_centers: { title: 'Cost centres', fields: [{ key: 'company_id', label: 'Company', required: true, company: true }, { key: 'code', label: 'Code', required: true }, { key: 'name', label: 'Name', required: true }] },
  departments: { title: 'Departments', fields: [{ key: 'name', label: 'Name', required: true }] },
  designations: { title: 'Designations', fields: [{ key: 'name', label: 'Name', required: true }] },
  grades: { title: 'Grades', fields: [{ key: 'code', label: 'Code', required: true }, { key: 'name', label: 'Name', required: true }, { key: 'rank', label: 'Rank', required: true, numeric: true, hint: 'Lower = more senior' }] },
};

const str = (v: unknown): string => (v === null || v === undefined ? '' : typeof v === 'string' ? v : typeof v === 'number' ? String(v) : JSON.stringify(v));

export function OrgMastersPage({ user }: { user: SessionUser }) {
  const canEdit = hasPermission(user, 'org.masters.manage');
  const [kind, setKind] = useState<Kind>('companies');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [companies, setCompanies] = useState<Row[]>([]);
  const [form, setForm] = useState<{ id: number | null; values: Record<string, string> } | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const def = MASTER_FIELDS[kind];

  const load = useCallback(() => {
    setRows(null);
    apiFetch<{ rows: Row[] }>(`/api/core/masters/${kind}`).then((r) => { setRows(r.rows); })
      .catch((e: unknown) => { setRows([]); toast.error(e instanceof ApiError ? e.message : 'Could not load.'); });
  }, [kind]);
  useEffect(load, [load]);
  useEffect(() => { apiFetch<{ rows: Row[] }>('/api/core/masters/companies').then((r) => { setCompanies(r.rows); }).catch(() => { setCompanies([]); }); }, []);

  const companyCode = useCallback((id: unknown) => str(companies.find((c) => c.id === id)?.['code']) || str(id), [companies]);

  const columns = useMemo<Column<Row>[]>(() => [
    ...def.fields.slice(0, kind === 'companies' ? 6 : 4).map((f): Column<Row> => ({
      key: f.key, header: f.label, label: f.label,
      render: (r) => (f.company ? companyCode(r[f.key]) : str(r[f.key]) || '—'),
      sortValue: (r) => str(r[f.key]),
    })),
    ...(canEdit ? [{ key: 'act', header: '', width: '170px', render: (r: Row) => (
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => { setForm({ id: r.id, values: Object.fromEntries(def.fields.map((f) => [f.key, str(r[f.key])])) }); }}>Edit</Button>
        <Button size="sm" variant="ghost" onClick={() => { setDeleting(r); }}>Delete</Button>
      </div>) }] : []),
  ], [def, kind, canEdit, companyCode]);

  const save = async () => {
    if (!form) return;
    setBusy(true);
    try {
      const values: Record<string, string | number | null> = {};
      for (const f of def.fields) {
        const raw = form.values[f.key] ?? '';
        values[f.key] = raw.trim() === '' ? null : f.company || f.numeric ? Number(raw) : raw.trim();
      }
      await apiFetch(form.id === null ? `/api/core/masters/${kind}` : `/api/core/masters/${kind}/${String(form.id)}`, {
        method: form.id === null ? 'POST' : 'PATCH', body: JSON.stringify({ values }),
      });
      toast.success('Saved.');
      setForm(null); load();
    } catch (e: unknown) {
      toast.error(e instanceof ApiError ? e.message : 'Could not save.');
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await apiFetch(`/api/core/masters/${kind}/${String(deleting.id)}`, { method: 'DELETE' });
      toast.success('Deleted.'); load();
    } catch (e: unknown) {
      toast.error(e instanceof ApiError ? e.message : 'Could not delete.');
    } finally { setDeleting(null); }
  };

  const missing = form ? def.fields.some((f) => f.required && (form.values[f.key] ?? '').trim() === '') : true;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin" title="Org masters"
        description={canEdit ? 'Companies and their statutory registrations, and the structure every employee is placed in. Masters still in use cannot be deleted.' : 'Read-only: only a super administrator can change org masters.'}
        actions={canEdit ? <Button variant="primary" leadingIcon={<Plus />} onClick={() => { setForm({ id: null, values: {} }); }}>Add {def.title.toLowerCase().replace(/s$/, '')}</Button> : undefined} />
      <Card>
        <div className="max-w-xs">
          <Select label="Master" value={kind} onChange={(k) => { setKind(k as Kind); }}
            options={(Object.keys(MASTER_FIELDS) as Kind[]).map((k) => ({ value: k, label: MASTER_FIELDS[k].title }))} />
        </div>
        <div className="mt-4">
          <DataTable tableId={`org-masters-${kind}`} columns={columns} rows={rows ?? []} rowKey={(r) => String(r.id)} searchable exportName={`org-masters-${kind}`} caption={def.title} empty={rows === null ? 'Loading…' : `No ${def.title.toLowerCase()} yet.`} />
        </div>
      </Card>
      <Drawer open={form !== null} onClose={() => { setForm(null); }} title={`${form?.id === null ? 'Add' : 'Edit'} · ${def.title}`}
        footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => { setForm(null); }}>Cancel</Button><Button variant="primary" loading={busy} disabled={missing} onClick={() => void save()}>Save</Button></div>}>
        <div className="grid gap-4">
          {def.fields.map((f) => f.company ? (
            <Select key={f.key} label={f.label} required={f.required ?? false} value={form?.values[f.key] ?? ''} placeholder="Choose…"
              onChange={(val) => { setForm((p) => (p ? { ...p, values: { ...p.values, [f.key]: val } } : p)); }}
              options={companies.map((c) => ({ value: String(c.id), label: `${str(c['code'])} · ${str(c['name'])}` }))} />
          ) : (
            <TextField key={f.key} label={f.required ? `${f.label} *` : f.label} hint={f.hint} type={f.numeric ? 'number' : 'text'} value={form?.values[f.key] ?? ''}
              onChange={(e) => { const val = e.target.value; setForm((p) => (p ? { ...p, values: { ...p.values, [f.key]: val } } : p)); }} />
          ))}
        </div>
      </Drawer>
      <ConfirmModal open={deleting !== null} onClose={() => { setDeleting(null); }} onConfirm={() => void remove()} danger
        title={`Delete ${str(deleting?.['name'] ?? deleting?.['code'])}?`} description="Refused while any employee or child record still uses it." confirmLabel="Delete" />
    </div>
  );
}
