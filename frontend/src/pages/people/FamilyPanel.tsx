/**
 * Family & nominees (RQ-CORE-025). Self: changes are submitted to HR and show
 * "Pending HR approval" until decided. HR (employee.write, in scope): edits apply directly.
 */
import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { ApiError, apiFetch } from '../../lib/api';
import { Button, Card, CardHeader, Checkbox, ConfirmModal, DataTable, Drawer, Pill, Select, TextField, toast } from '../../ui';
import type { Column } from '../../ui';

interface Member {
  id: number; name: string; relation: string; dob: string | null; aadhaarMasked: string | null;
  isEsicDependent: boolean; isNominee: boolean; nomineeSharePct: number | null;
}
interface Pending { id: number; change: { action: string; member?: { name?: string; relation?: string } }; createdAt: string }
interface Family { members: Member[]; pending: Pending[] }

const RELATIONS = ['spouse', 'son', 'daughter', 'father', 'mother', 'father_in_law', 'mother_in_law', 'brother', 'sister', 'other'];
const label = (r: string) => r.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

interface Draft { name: string; relation: string; dob: string; aadhaar: string; isEsicDependent: boolean; isNominee: boolean; nomineeSharePct: string }
const BLANK: Draft = { name: '', relation: '', dob: '', aadhaar: '', isEsicDependent: false, isNominee: false, nomineeSharePct: '' };

export function FamilyPanel({ self, ecode, canEdit }: { self: boolean; ecode?: string | undefined; canEdit: boolean }) {
  const base = self ? '/api/employees/me/family' : `/api/employees/${encodeURIComponent(ecode ?? '')}/family`;
  const [data, setData] = useState<Family | null>(null);
  const [editing, setEditing] = useState<{ id: number | null; draft: Draft } | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiFetch<Family>(base).then(setData).catch(() => { setData({ members: [], pending: [] }); });
  }, [base]);
  useEffect(load, [load]);

  const submit = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      await apiFetch(self ? `${base}/requests` : base, { method: 'POST', body: JSON.stringify(body) });
      toast.success(self ? 'Sent to HR — pending approval.' : 'Family details saved.');
      setEditing(null); setRemoving(null); load();
    } catch (e: unknown) {
      toast.error(e instanceof ApiError ? e.message : 'Could not save.');
    } finally { setBusy(false); }
  };

  const save = () => {
    if (!editing) return;
    const d = editing.draft;
    const member = {
      name: d.name, relation: d.relation, dob: d.dob || null, aadhaar: d.aadhaar || null,
      isEsicDependent: d.isEsicDependent, isNominee: d.isNominee, nomineeSharePct: d.isNominee ? Number(d.nomineeSharePct) : null,
    };
    void submit(editing.id === null ? { action: 'add', member } : { action: 'update', memberId: editing.id, member });
  };

  const allowed = self || canEdit;
  const columns: Column<Member>[] = [
    { key: 'name', header: 'Name', render: (m) => m.name, sortValue: (m) => m.name },
    { key: 'rel', header: 'Relation', render: (m) => label(m.relation), width: '130px' },
    { key: 'dob', header: 'Date of birth', render: (m) => m.dob ?? '—', width: '130px' },
    { key: 'aad', header: 'Aadhaar', render: (m) => m.aadhaarMasked ?? '—', width: '150px' },
    { key: 'esic', header: 'ESIC dependent', render: (m) => (m.isEsicDependent ? 'Yes' : 'No'), width: '120px' },
    { key: 'nom', header: 'Nominee', render: (m) => (m.isNominee ? `${String(m.nomineeSharePct ?? 0)}%` : '—'), width: '100px' },
    ...(allowed ? [{ key: 'act', header: '', width: '170px', render: (m: Member) => (
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => { setEditing({ id: m.id, draft: { name: m.name, relation: m.relation, dob: m.dob ?? '', aadhaar: '', isEsicDependent: m.isEsicDependent, isNominee: m.isNominee, nomineeSharePct: m.nomineeSharePct === null ? '' : String(m.nomineeSharePct) } }); }}>Edit</Button>
        <Button size="sm" variant="ghost" onClick={() => { setRemoving(m); }}>Remove</Button>
      </div>) }] : []),
  ];
  const d = editing?.draft ?? BLANK;
  const setD = (patch: Partial<Draft>) => { setEditing((p) => (p ? { ...p, draft: { ...p.draft, ...patch } } : p)); };

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardHeader title="Family & nominees" />
        {allowed && <Button variant="secondary" leadingIcon={<Plus />} onClick={() => { setEditing({ id: null, draft: BLANK }); }}>Add member</Button>}
      </div>
      {data && data.pending.length > 0 && (
        <ul className="mt-3 space-y-1" aria-label="Changes awaiting HR">
          {data.pending.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-sm text-ink-muted">
              <Pill>Pending HR approval</Pill>
              <span>{label(p.change.action)} · {p.change.member?.name ?? 'member'}{p.change.member?.relation ? ` (${label(p.change.member.relation)})` : ''}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4">
        <DataTable columns={columns} rows={data?.members ?? []} rowKey={(m) => String(m.id)} empty="No family members recorded yet." />
      </div>
      <Drawer open={editing !== null} onClose={() => { setEditing(null); }} title={editing?.id === null ? 'Add family member' : 'Edit family member'}
        subtitle={self ? 'HR approves the change before it reaches your record.' : 'Saved directly and audited.'}
        footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => { setEditing(null); }}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={d.name.trim() === '' || d.relation === ''} onClick={save}>{self ? 'Submit to HR' : 'Save'}</Button></div>}>
        <div className="grid gap-4">
          <TextField label="Full name" value={d.name} onChange={(e) => { setD({ name: e.target.value }); }} />
          <Select label="Relation" value={d.relation} onChange={(r) => { setD({ relation: r }); }} placeholder="Choose…" options={RELATIONS.map((r) => ({ value: r, label: label(r) }))} />
          <TextField label="Date of birth" type="date" value={d.dob} onChange={(e) => { setD({ dob: e.target.value }); }} />
          <TextField label="Aadhaar" value={d.aadhaar} hint={editing?.id !== null ? 'Leave blank to keep the stored number' : '12 digits; checksum verified'} onChange={(e) => { setD({ aadhaar: e.target.value }); }} />
          <Checkbox label="ESIC dependent" description="Spouse, children and parents only" checked={d.isEsicDependent} onChange={(e) => { setD({ isEsicDependent: e.target.checked }); }} />
          <Checkbox label="Nominee (PF / gratuity)" checked={d.isNominee} onChange={(e) => { setD({ isNominee: e.target.checked }); }} />
          {d.isNominee && <TextField label="Nominee share %" type="number" value={d.nomineeSharePct} hint="All nominees together cannot exceed 100%" onChange={(e) => { setD({ nomineeSharePct: e.target.value }); }} />}
        </div>
      </Drawer>
      <ConfirmModal open={removing !== null} onClose={() => { setRemoving(null); }} danger
        title={`Remove ${removing?.name ?? ''}?`} description={self ? 'HR will review the removal.' : 'The entry is deleted from the employee record (audited).'}
        confirmLabel={self ? 'Submit to HR' : 'Remove'} onConfirm={() => { if (removing) void submit({ action: 'remove', memberId: removing.id }); }} />
    </Card>
  );
}
