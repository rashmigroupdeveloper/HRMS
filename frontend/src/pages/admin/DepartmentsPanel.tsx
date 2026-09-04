/** Stage 2.0 department → Finance MIS mapping (ORG-03/05). */
import { useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { Button, Card, CardHeader, DataTable, Drawer, EmptyState, Select, toast } from '../../ui';
import type { Column, SelectOption } from '../../ui';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { useDashboardResource } from '../home/useDashboardResource';

interface DepartmentRow {
  id: number;
  name: string;
  misCodeId: number | null;
  misCode: string | null;
  misName: string | null;
  misCompanyCode: string | null;
}

interface MisRow {
  id: number;
  companyCode: string;
  code: string;
  name: string;
}

export function DepartmentsPanel({ canEdit }: { canEdit: boolean }) {
  const departments = useDashboardResource<{ rows: DepartmentRow[] }>('/api/org/departments');
  const misCodes = useDashboardResource<{ rows: MisRow[] }>('/api/org/mis-codes/admin');
  const [editing, setEditing] = useState<DepartmentRow | null>(null);
  const [misCodeId, setMisCodeId] = useState('');
  const [saving, setSaving] = useState(false);

  const misOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: '— Unmapped —' },
      ...(misCodes.data?.rows ?? []).map((mis) => ({
        value: String(mis.id),
        label: `${mis.companyCode} · ${mis.code} — ${mis.name}`,
      })),
    ],
    [misCodes.data],
  );

  if (departments.loading || misCodes.loading) return <DashboardSkeleton />;
  if (departments.error) {
    return <DashboardError message={departments.error} onRetry={departments.reload} />;
  }
  if (misCodes.error) return <DashboardError message={misCodes.error} onRetry={misCodes.reload} />;

  const columns: Column<DepartmentRow>[] = [
    {
      key: 'department',
      header: 'Department',
      width: 'minmax(180px,1fr)',
      render: (row) => <span className="font-semibold text-ink">{row.name}</span>,
    },
    {
      key: 'company',
      header: 'MIS company',
      width: '120px',
      render: (row) => <span className="tabular-nums text-ink-muted">{row.misCompanyCode ?? '—'}</span>,
    },
    {
      key: 'mis',
      header: 'MIS code',
      width: 'minmax(180px,1fr)',
      render: (row) => (
        <span className="text-ink-muted">
          {row.misCode === null ? 'Unmapped' : `${row.misCode} — ${row.misName ?? ''}`}
        </span>
      ),
    },
  ];

  return (
    <>
      <Card>
        <CardHeader
          title="Departments"
          subtitle="ORG-03 — map normalized HR departments to Finance-owned MIS codes."
        />
        <DataTable
          columns={columns}
          rows={departments.data?.rows ?? []}
          rowKey={(row) => String(row.id)}
          empty={
            <EmptyState
              title="No departments"
              description="Departments appear after the employee master import."
            />
          }
          {...(canEdit
            ? {
                onRowClick: (row: DepartmentRow) => {
                  setEditing(row);
                  setMisCodeId(row.misCodeId === null ? '' : String(row.misCodeId));
                },
              }
            : {})}
        />
      </Card>

      <Drawer
        open={editing !== null}
        onClose={() => {
          setEditing(null);
        }}
        title={editing ? `MIS mapping · ${editing.name}` : 'MIS mapping'}
        subtitle="Use only the catalog confirmed by Finance."
      >
        {editing ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void (async () => {
                setSaving(true);
                try {
                  await apiFetch(`/api/org/departments/${String(editing.id)}/mis-code`, {
                    method: 'PUT',
                    body: JSON.stringify({
                      departmentId: editing.id,
                      misCodeId: misCodeId === '' ? null : Number(misCodeId),
                    }),
                  });
                  toast.success('Department MIS mapping saved');
                  setEditing(null);
                  departments.reload();
                } catch (cause: unknown) {
                  toast.error(cause instanceof Error ? cause.message : 'Could not save');
                } finally {
                  setSaving(false);
                }
              })();
            }}
          >
            <Select
              label="Finance MIS code"
              value={misCodeId}
              options={misOptions}
              onChange={setMisCodeId}
            />
            <Button type="submit" disabled={saving}>
              Save
            </Button>
          </form>
        ) : null}
      </Drawer>
    </>
  );
}
