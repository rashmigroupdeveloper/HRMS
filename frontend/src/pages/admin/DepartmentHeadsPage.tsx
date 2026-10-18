/**
 * Heads of department (C-02). An HOD approves department-level requests (e.g.
 * domestic travel advance, RM → HOD) and sees their department's people and
 * attendance. Designations are per company, or group-wide (group HR only).
 */
import { useCallback, useEffect, useState } from 'react';
import { Network, Plus } from 'lucide-react';
import { ApiError, apiFetch } from '../../lib/api';
import { Button, Card, CardHeader, DataTable, EmptyState, PageHeader, Select, StatusBadge, TextField, toast } from '../../ui';
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
    {
      key: 'emp',
      header: 'Head of department',
      mobile: 'title',
      sortValue: (h) => h.employeeName,
      render: (h) => (
        <span className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-hero text-xs font-semibold text-hero-ink">
            {initials(h.employeeName)}
          </span>
          <span className="min-w-0 font-medium text-ink [overflow-wrap:anywhere]">{`${h.employeeName} (${h.employeeCode})`}</span>
        </span>
      ),
    },
    { key: 'dept', header: 'Department', mobile: 'subtitle', sortValue: (h) => h.departmentName, render: (h) => h.departmentName },
    {
      key: 'company',
      header: 'Entity',
      mobile: 'badge',
      width: '150px',
      render: (h) => <StatusBadge tone={h.companyCode ? 'neutral' : 'info'}>{h.companyCode ?? 'All entities'}</StatusBadge>,
    },
    {
      key: 'act',
      header: <span className="sr-only">Actions</span>,
      label: 'Actions',
      locked: true,
      width: '110px',
      render: (h) => <Button variant="ghost" size="sm" onClick={() => void remove(h)}>Remove</Button>,
    },
  ];

  const canAdd = departmentId !== '' && companyId !== '' && employeeCode.trim() !== '' && !busy;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Heads of department"
        description="HODs approve department-level requests and see their department's people and attendance. An employee's own HOD field overrides this list."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] xl:items-start">
        <Card>
          <CardHeader title="Designate a head" subtitle="Per entity, or group-wide (group HR only)." />
          <form
            className="grid gap-4"
            onSubmit={(e) => { e.preventDefault(); if (canAdd) void add(); }}
          >
            <Select label="Department" value={departmentId} onChange={setDepartmentId} placeholder="Choose…"
              options={departments.map((d) => ({ value: String(d.id), label: d.name }))} />
            <Select label="Entity" value={companyId} onChange={setCompanyId} placeholder="Choose…"
              options={[{ value: GROUP, label: 'All entities (group HR only)' }, ...companies.map((c) => ({ value: String(c.id), label: c.code ?? c.name }))]} />
            <TextField label="Employee code" value={employeeCode} onChange={(e) => { setEmployeeCode(e.target.value); }} placeholder="e.g. RML000123" autoComplete="off" />
            <Button type="submit" variant="primary" disabled={!canAdd} loading={busy} leadingIcon={<Plus className="size-4" aria-hidden />}>Add head</Button>
          </form>
        </Card>
        <Card padded={false} className="overflow-hidden">
          <div className="px-6 pb-2 pt-6">
            <CardHeader
              title="Current heads"
              subtitle={heads === null ? 'Loading…' : `${String(heads.length)} designated`}
            />
          </div>
          <DataTable
            columns={columns}
            rows={heads ?? []}
            rowKey={(h) => String(h.id)}
            tableId="admin.department-heads"
            empty={<EmptyState icon={<Network />} title="No heads of department yet" description="Designate one on the left; department approvals then route to them." />}
          />
        </Card>
      </div>
    </div>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}
