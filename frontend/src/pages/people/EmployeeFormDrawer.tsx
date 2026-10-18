/**
 * Employee master create / edit (handover item 2, C-25 / C-48). The server
 * validates exactly like the bulk importer (minors, DOB < DOJ, PAN / Aadhaar /
 * UAN / ESIC / IFSC formats, duplicates across employees, data scope); this
 * form adds instant format hints so most mistakes never reach the server.
 */
import { useEffect, useMemo, useState } from 'react';
import { ApiError, apiFetch } from '../../lib/api';
import { Button, Drawer, Select, TextField, toast } from '../../ui';

export interface EmployeeFormValues {
  companyCode: string; firstName: string; lastName: string; gender: string; dob: string; doj: string;
  orgUnit: string; location: string; department: string; designation: string; grade: string;
  category: string; contractType: string; managerEcode: string; hodEcode: string; workEmail: string;
  mobile: string; pan: string; aadhaar: string; uan: string; esicNo: string; bankName: string; bankAccount: string; bankIfsc: string;
}

const EMPTY: EmployeeFormValues = {
  companyCode: '', firstName: '', lastName: '', gender: '', dob: '', doj: '', orgUnit: '', location: '', department: '',
  designation: '', grade: '', category: '', contractType: '', managerEcode: '', hodEcode: '', workEmail: '', mobile: '',
  pan: '', aadhaar: '', uan: '', esicNo: '', bankName: '', bankAccount: '', bankIfsc: '',
};

interface Row { id: number; name: string; code?: string; company_id?: number }

/** Client-side hints only; the server is authoritative. Exported for tests. */
export function formHints(v: EmployeeFormValues, creating: boolean): Partial<Record<keyof EmployeeFormValues, string>> {
  const e: Partial<Record<keyof EmployeeFormValues, string>> = {};
  if (creating) {
    if (!v.companyCode) e.companyCode = 'Choose a company';
    if (!v.firstName.trim()) e.firstName = 'First name is required';
    if (!v.doj) e.doj = 'Date of joining is required';
    if (!v.orgUnit) e.orgUnit = 'Choose an org unit';
  }
  if (v.dob && v.doj) {
    const [y1 = 0, m1 = 0, d1 = 0] = v.dob.split('-').map(Number);
    const [y2 = 0, m2 = 0, d2 = 0] = v.doj.split('-').map(Number);
    let age = y2 - y1;
    if (m2 < m1 || (m2 === m1 && d2 < d1)) age--;
    if (v.dob >= v.doj) e.dob = 'Must be before the joining date';
    else if (age < 18) e.dob = `Would be ${String(age)} on joining — minors cannot be employed`;
  }
  const up = (s: string) => s.trim().toUpperCase().replace(/[\s-]/g, '');
  if (v.pan && !/^[A-Z]{3}P[A-Z]\d{4}[A-Z]$/.test(up(v.pan))) e.pan = 'PAN looks like ABCPE1234F (4th letter P)';
  if (v.aadhaar && !/^[2-9]\d{11}$/.test(up(v.aadhaar))) e.aadhaar = '12 digits, not starting with 0 or 1';
  if (v.uan && !/^\d{12}$/.test(up(v.uan))) e.uan = '12 digits';
  if (v.esicNo && !/^\d{10}$/.test(up(v.esicNo))) e.esicNo = '10 digits';
  if (v.bankIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(up(v.bankIfsc))) e.bankIfsc = 'Like HDFC0001234 (5th character 0)';
  if (v.bankAccount && !/^\d{9,18}$/.test(up(v.bankAccount))) e.bankAccount = '9–18 digits';
  if (v.mobile && !/^[6-9]\d{9}$/.test(up(v.mobile).replace(/^\+91/, ''))) e.mobile = '10-digit Indian mobile';
  if (v.workEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.workEmail.trim())) e.workEmail = 'Not a valid e-mail';
  return e;
}

export function EmployeeFormDrawer({ open, onClose, ecode, initial, onSaved }: {
  open: boolean; onClose: () => void; ecode?: string | undefined;
  initial?: Partial<EmployeeFormValues> | undefined; onSaved: (ecode: string) => void;
}) {
  const creating = ecode === undefined;
  const [v, setV] = useState<EmployeeFormValues>({ ...EMPTY, ...initial });
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [m, setM] = useState<Record<string, Row[]>>({});

  useEffect(() => {
    if (!open) return;
    setV({ ...EMPTY, ...initial });
    setTouched(false);
    for (const kind of ['companies', 'org_units', 'locations', 'departments', 'designations', 'grades']) {
      apiFetch<{ rows: Row[] }>(`/api/core/masters/${kind}`).then((r) => { setM((p) => ({ ...p, [kind]: r.rows })); }).catch(() => { /* optional list */ });
    }
  }, [open, initial]);

  const hints = useMemo(() => formHints(v, creating), [v, creating]);
  const company = (m['companies'] ?? []).find((c) => c.code === v.companyCode);
  const opts = (kind: string, byCompany = false) => (m[kind] ?? [])
    .filter((r) => !byCompany || company === undefined || r.company_id === company.id)
    .map((r) => ({ value: r.name, label: r.name }));
  const set = (k: keyof EmployeeFormValues) => (val: string) => { setV((p) => ({ ...p, [k]: val })); };
  const err = (k: keyof EmployeeFormValues) => (touched ? hints[k] : undefined);

  const save = async () => {
    setTouched(true);
    if (Object.keys(hints).length > 0) { toast.error('Fix the highlighted fields first.'); return; }
    setBusy(true);
    try {
      const body: Record<string, string> = {};
      for (const [k, val] of Object.entries(v) as [string, string][]) if (val.trim() !== '' && !(k === 'companyCode' && !creating)) body[k] = val.trim();
      const r = await apiFetch<{ ecode: string; warnings: { message: string }[] }>(creating ? '/api/employees' : `/api/employees/${encodeURIComponent(ecode)}`, {
        method: creating ? 'POST' : 'PATCH', body: JSON.stringify(body),
      });
      toast.success(creating ? `Employee ${r.ecode} created.` : `${r.ecode} saved.`);
      for (const w of r.warnings) toast.warning(w.message);
      onSaved(r.ecode);
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof ApiError ? e.message : 'Could not save the employee.');
    } finally {
      setBusy(false);
    }
  };

  const text = (k: keyof EmployeeFormValues, label: string, extra: { type?: string; hint?: string } = {}) => (
    <TextField label={label} type={extra.type ?? 'text'} value={v[k]} error={err(k)} hint={extra.hint}
      onChange={(e) => { set(k)(e.target.value); }} />
  );

  return (
    <Drawer open={open} onClose={onClose} width={560}
      title={creating ? 'Add employee' : `Edit ${ecode}`}
      subtitle={creating ? 'An e-code is allocated from the company series on save.' : 'Only the fields you change are saved. Company changes are transfers.'}
      footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} onClick={() => void save()}>{creating ? 'Create employee' : 'Save changes'}</Button></div>}>
      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-2" aria-label="Personal">
          {creating && <Select label="Company" required value={v.companyCode} onChange={set('companyCode')} error={err('companyCode')} placeholder="Choose…"
            options={(m['companies'] ?? []).map((c) => ({ value: c.code ?? '', label: `${c.code ?? ''} · ${c.name}` }))} />}
          {text('firstName', 'First name')}
          {text('lastName', 'Last name')}
          <Select label="Gender" value={v.gender} onChange={set('gender')} placeholder="Choose…" options={['Male', 'Female', 'Other'].map((g) => ({ value: g, label: g }))} />
          {text('dob', 'Date of birth', { type: 'date', hint: 'Must be 18+ on the joining date' })}
          {text('doj', 'Date of joining', { type: 'date' })}
        </section>
        <section className="grid gap-4 sm:grid-cols-2" aria-label="Job">
          <Select label="Org unit" value={v.orgUnit} onChange={set('orgUnit')} error={err('orgUnit')} placeholder="Choose…" options={opts('org_units', true)} />
          <Select label="Work location" value={v.location} onChange={set('location')} placeholder="Choose…" options={opts('locations', true)} />
          <Select label="Department" value={v.department} onChange={set('department')} placeholder="Choose…" options={opts('departments')} />
          <Select label="Designation" value={v.designation} onChange={set('designation')} placeholder="Choose…" options={opts('designations')} />
          <Select label="Grade" value={v.grade} onChange={set('grade')} placeholder="Choose…" options={opts('grades')} />
          <Select label="Category" value={v.category} onChange={set('category')} placeholder="Choose…"
            options={[['white_collar', 'White collar'], ['blue_collar', 'Blue collar'], ['trainee', 'Trainee'], ['consultant', 'Consultant'], ['contract', 'Contract']].map(([value = '', label = '']) => ({ value, label }))} />
          <Select label="Contract type" value={v.contractType} onChange={set('contractType')} placeholder="Choose…"
            options={['probationary', 'permanent', 'temporary', 'fixed_term', 'consultant', 'apprentice'].map((c) => ({ value: c, label: c.replace('_', ' ') }))} />
          {text('managerEcode', 'Reporting manager e-code')}
          {text('hodEcode', 'HOD e-code')}
          {text('workEmail', 'Work e-mail', { type: 'email' })}
          {text('mobile', 'Mobile', { type: 'tel' })}
        </section>
        <section className="grid gap-4 sm:grid-cols-2" aria-label="Statutory and bank">
          {text('pan', 'PAN')}
          {text('aadhaar', 'Aadhaar', { hint: 'Checksum verified on save' })}
          {text('uan', 'UAN', { hint: 'Must be unique across employees' })}
          {text('esicNo', 'ESIC IP number', { hint: 'Must be unique across employees' })}
          {text('bankName', 'Bank name')}
          {text('bankAccount', 'Bank account')}
          {text('bankIfsc', 'IFSC')}
        </section>
      </div>
    </Drawer>
  );
}
