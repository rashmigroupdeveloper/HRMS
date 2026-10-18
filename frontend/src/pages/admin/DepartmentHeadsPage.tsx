/**
 * Heads of department (C-02). An HOD approves department-level requests (e.g.
 * domestic travel advance, RM → HOD) and sees their department's people and
 * attendance. Designations are per company, or group-wide (group HR only).
 */
import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from '../../lib/api';
import { Button, Card, DataTable, PageHeader, Select, TextField, toast } from '../../ui';
import type { Column } from '../../ui';

interface Head {
  id: number; departmentId: number; departmentName: string; companyId: number | null;
  companyCode: string | null; employeeId: number; employeeCode: string; employeeName: string;
}
interface Named { id: number; name: string; code?: string }

const GROUP = 'group';

export function DepartmentHeadsPage() {
  const [heads, setHeads] = useState<Head[] | null>(null);
  const [departments, setDepartments] = useState<Named[]>([]);
  const [companies, setCompanies] = useState<Named[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiFetch<{ heads: Head[] }>('/api/core/department-heads')
      .then((r) => { setHeads(r.heads); })
      .catch((e: unknown) => { setHeads([]); toast.error(e instanceof ApiError ? e.message : 'Could not load heads of department.'); });
  }, []);

  useEffect(() => {
    load();
    apiFetch<{ departments: Named[] }>('/api/core/departments').then((r) => { setDepartments(r.departments); }).catch(() => { setDepartments([]); });
    apiFetch<{ companies: Named[] }>('/api/core/companies').then((r) => { setCompanies(r.companies); }).catch(() => { setCompanies([]); });
  }, [load]);

  const add = async () => {
    setBusy(true);
    try {
      await apiFetch('/api/core/department-heads', {
        method: 'POST',
        body: JSON.stringify({
          departmentId: Number(departmentId),
          companyId: companyId === GROUP ? null : Number(companyId),
          employeeCode: employeeCode.trim(),
        }),
      });
      toast.success('Head of department saved.');
      setEmployeeCode('');
      load();
    } catch (e: unknown) {
      toast.error(e instanceof ApiError ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (head: Head) => {
    try {
      await apiFetch(`/api/core/department-heads/${String(head.id)}/remove`, { method: 'POST', body: '{}' });
      toast.success(`${head.employeeName} is no longer head of ${head.departmentName}.`);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof ApiError ? e.message : 'Could not remove.');
    }
  };

  const columns: Column<Head>[] = [
    { key: 'dept', header: 'Department', render: (h) => h.departmentName },
    { key: 'company', header: 'Entity', render: (h) => h.companyCode ?? 'All entities', width: '140px' },
    { key: 'emp', header: 'Head of department', render: (h) => `${h.employeeName} (${h.employeeCode})` },
    { key: 'act', header: '', render: (h) => <Button variant="ghost" onClick={() => void remove(h)}>Remove</Button>, width: '110px' },
  ];

  const canAdd = departmentId !== '' && companyId !== '' && employeeCode.trim() !== '' && !busy;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Heads of department"
        description="HODs approve department-level requests and see their department's people and attendance. An employee's own HOD field overrides this list."
      />
      <Card>
        <div className="grid gap-4 md:grid-cols-4 md:items-end">
          <Select label="Department" value={departmentId} onChange={setDepartmentId} placeholder="Choose…"
            options={departments.map((d) => ({ value: String(d.id), label: d.name }))} />
          <Select label="Entity" value={companyId} onChange={setCompanyId} placeholder="Choose…"
            options={[{ value: GROUP, label: 'All entities (group HR only)' }, ...companies.map((c) => ({ value: String(c.id), label: c.code ?? c.name }))]} />
          <TextField label="Employee code" value={employeeCode} onChange={(e) => { setEmployeeCode(e.target.value); }} placeholder="e.g. RML000123" />
          <Button disabled={!canAdd} loading={busy} onClick={() => void add()}>Add head</Button>
        </div>
      </Card>
      <Card>
        <DataTable columns={columns} rows={heads ?? []} rowKey={(h) => String(h.id)} empty="No heads of department designated yet." />
      </Card>
    </div>
  );
}
