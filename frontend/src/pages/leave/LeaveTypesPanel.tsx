import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { Button, Card, CardHeader, Checkbox, DataTable, Drawer, Select, TextField, toast, type Column } from '../../ui';

export interface LeavePolicy {
  code: string; name: string; isPaid: boolean; isActive: boolean; accrualPerMonth: number;
  accrualRequiresServiceMonths: number; maxCarryForward: number | null; encashable: boolean;
  maxPerRequest: number | null; allowHalfDay: boolean; sandwichRule: 'include' | 'exclude';
  applicableGender: string | null; applicableCategories: string[] | null;
}
export interface LeaveCatalog { types: LeavePolicy[]; canManageTypes: boolean; canRunJobs: boolean }
interface EditPolicy extends Omit<LeavePolicy, 'accrualPerMonth' | 'accrualRequiresServiceMonths' | 'maxCarryForward' | 'maxPerRequest'> {
  accrualPerMonth: string; accrualRequiresServiceMonths: string; maxCarryForward: string; maxPerRequest: string;
}
const categories = ['white_collar', 'blue_collar', 'trainee', 'consultant', 'contract'];
function editPolicy(row: LeavePolicy): EditPolicy {
  return { ...row, accrualPerMonth: String(row.accrualPerMonth), accrualRequiresServiceMonths: String(row.accrualRequiresServiceMonths),
    maxCarryForward: row.maxCarryForward === null ? '' : String(row.maxCarryForward), maxPerRequest: row.maxPerRequest === null ? '' : String(row.maxPerRequest) };
}
function blankPolicy(): EditPolicy {
  return { code: '', name: '', isPaid: true, isActive: true, accrualPerMonth: '0', accrualRequiresServiceMonths: '0',
    maxCarryForward: '', maxPerRequest: '', encashable: false, allowHalfDay: true, sandwichRule: 'exclude',
    applicableGender: null, applicableCategories: null };
}
export function LeaveTypesPanel({ catalog, onSaved }: { catalog: LeaveCatalog; onSaved: () => void }) {
  const [editing, setEditing] = useState<{ draft: EditPolicy; existing: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof EditPolicy>(key: K, value: EditPolicy[K]) => {
    setEditing(current => current ? { ...current, draft: { ...current.draft, [key]: value } } : current);
  };
  const draft = editing?.draft;
  const columns: Column<LeavePolicy>[] = [
    { key: 'type', header: 'Leave type', render: row => <div><p className="font-semibold">{row.name}</p><p className="text-xs text-ink-muted">{row.code} · {row.isActive ? 'Active' : 'Inactive'}</p></div> },
    { key: 'pay', header: 'Treatment', render: row => row.isPaid ? 'Paid' : 'Unpaid' },
    { key: 'accrual', header: 'Monthly credit', render: row => `${String(row.accrualPerMonth)} days after ${String(row.accrualRequiresServiceMonths)} months of service` },
    { key: 'cap', header: 'Request cap', render: row => row.maxPerRequest === null ? 'No cap' : `${String(row.maxPerRequest)} days` },
    { key: 'halves', header: 'Half days', render: row => row.allowHalfDay ? 'Allowed' : 'Whole days only' },
    ...(catalog.canManageTypes ? [{ key: 'edit', header: 'Actions', render: (row: LeavePolicy) => <Button size="sm" variant="ghost" onClick={() => { setEditing({ draft: editPolicy(row), existing: true }); setError(null); }}>Edit {row.code}</Button> }] : []),
  ];
  const save = async () => {
    if (!draft) return;
    if (!draft.code.trim() || !draft.name.trim() || draft.accrualPerMonth === '' || draft.accrualRequiresServiceMonths === '') {
      setError('Enter a code, name, monthly credit and service requirement. Use zero for no monthly credit or no waiting period.'); return;
    }
    const numeric = [draft.accrualPerMonth, draft.accrualRequiresServiceMonths, draft.maxCarryForward, draft.maxPerRequest].filter(value => value !== '');
    if (numeric.some(value => !Number.isFinite(Number(value)) || Number(value) < 0)) { setError('Policy numbers must be valid and non-negative.'); return; }
    setSaving(true); setError(null);
    try {
      await apiFetch(`/api/leave/types/${encodeURIComponent(draft.code.trim())}`, { method: 'PUT', body: JSON.stringify({ ...draft,
        code: draft.code.trim(), name: draft.name.trim(), accrualPerMonth: Number(draft.accrualPerMonth),
        accrualRequiresServiceMonths: Number(draft.accrualRequiresServiceMonths),
        maxCarryForward: draft.maxCarryForward === '' ? null : Number(draft.maxCarryForward),
        maxPerRequest: draft.maxPerRequest === '' ? null : Number(draft.maxPerRequest),
      }) });
      toast.success('Leave policy saved'); setEditing(null); onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this policy. Try again.'); }
    finally { setSaving(false); }
  };
  return <Card>
    <CardHeader title="Leave configuration" subtitle="Group-wide rules. Changes are audited; existing paid/unpaid history is protected."
      action={catalog.canManageTypes ? <Button onClick={() => { setEditing({ draft: blankPolicy(), existing: false }); setError(null); }}>New leave type</Button> : undefined} />
    {!catalog.canManageTypes && <p className="mt-3 text-sm text-ink-muted">You can inspect these rules. Group-wide HR leave authority is required to change them.</p>}
    <div className="mt-4"><DataTable rows={catalog.types} columns={columns} rowKey={row => row.code} caption="Leave configuration" empty="No leave types configured." /></div>
    <Drawer open={editing !== null} onClose={() => { if (!saving) setEditing(null); }} title={editing?.existing ? `Edit leave policy · ${draft?.code ?? ''}` : 'New leave type'}
      subtitle="These rules apply across the group. Deactivation prevents new applications and retains history."
      footer={<div className="flex justify-end gap-2"><Button variant="ghost" disabled={saving} onClick={() => { setEditing(null); }}>Cancel</Button><Button variant="primary" loading={saving} onClick={() => { void save(); }}>Save policy</Button></div>}>
      {draft && <div className="space-y-5">
        <TextField label="Code" required disabled={editing.existing} value={draft.code} onChange={event => { set('code', event.currentTarget.value); }} />
        <TextField label="Name" required value={draft.name} onChange={event => { set('name', event.currentTarget.value); }} />
        <Checkbox label="Active" checked={draft.isActive} onChange={event => { set('isActive', event.currentTarget.checked); }} />
        <Checkbox label="Paid leave" checked={draft.isPaid} onChange={event => { set('isPaid', event.currentTarget.checked); }} description="Paid/unpaid treatment cannot change once this type has history. Use a new type instead." />
        <TextField label="Monthly credit in days" type="number" min="0" step="0.01" required value={draft.accrualPerMonth} onChange={event => { set('accrualPerMonth', event.currentTarget.value); }} hint="Zero means no automatic monthly credit." />
        <TextField label="Service required in months" type="number" min="0" step="1" required value={draft.accrualRequiresServiceMonths} onChange={event => { set('accrualRequiresServiceMonths', event.currentTarget.value); }} />
        <TextField label="Maximum carry-forward days" type="number" min="0" step="0.01" value={draft.maxCarryForward} onChange={event => { set('maxCarryForward', event.currentTarget.value); }} hint="Leave blank for no cap; zero carries no days forward." />
        <TextField label="Maximum days per request" type="number" min="0.1" step="0.1" value={draft.maxPerRequest} onChange={event => { set('maxPerRequest', event.currentTarget.value); }} hint="Leave blank for no cap." />
        <Checkbox label="Allow half-day leave" checked={draft.allowHalfDay} onChange={event => { set('allowHalfDay', event.currentTarget.checked); }} />
        <Checkbox label="Allow encashment" checked={draft.encashable} onChange={event => { set('encashable', event.currentTarget.checked); }} />
        <Select label="Holidays and week-offs inside leave" value={draft.sandwichRule} onChange={value => { set('sandwichRule', value === 'include' ? 'include' : 'exclude'); }}
          options={[{ value: 'exclude', label: 'Exclude from leave days' }, { value: 'include', label: 'Count within the leave span' }]} />
        <Select label="Gender eligibility" value={draft.applicableGender ?? ''} onChange={value => { set('applicableGender', value || null); }}
          options={[{ value: '', label: 'All employees' }, { value: 'F', label: 'Female employees' }, { value: 'M', label: 'Male employees' }]} />
        <Checkbox label="All employment categories" checked={draft.applicableCategories === null} onChange={event => { set('applicableCategories', event.currentTarget.checked ? null : [...categories]); }} />
        {draft.applicableCategories !== null && <fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">Eligible categories</legend>{categories.map(category => <Checkbox key={category} label={category.replaceAll('_', ' ')} checked={draft.applicableCategories?.includes(category) ?? false}
          onChange={event => { set('applicableCategories', event.currentTarget.checked ? [...(draft.applicableCategories ?? []), category] : (draft.applicableCategories ?? []).filter(value => value !== category)); }} />)}</fieldset>}
        {error && <p role="alert" className="text-sm text-negative-ink">{error}</p>}
      </div>}
    </Drawer>
  </Card>;
}
