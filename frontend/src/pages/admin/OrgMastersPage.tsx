/**
 * Stage 2.0 org masters (ORG-01..05) — company / plant / MIS / cost-centre spine.
 *
 * Codes Finance and SAP already use. MIS stays empty until Finance supplies the
 * real list — never invent seed rows here.
 */
import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  Drawer,
  EmptyState,
  Select,
  StatusBadge,
  TextField,
  toast,
} from '../../ui';
import type { Column, SelectOption } from '../../ui';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { useDashboardResource } from '../home/useDashboardResource';

interface CompanyRow {
  id: number;
  code: string;
  name: string;
  sapCompanyCode: string | null;
  isIndiaPayroll: boolean;
}

interface PlantRow {
  id: number;
  companyId: number;
  companyCode: string;
  plantCode: string;
  name: string;
  locationId: number | null;
  isActive: boolean;
}

export function CompaniesPanel({ canEdit }: { canEdit: boolean }) {
  const companies = useDashboardResource<{ rows: CompanyRow[] }>('/api/org/companies');
  const [editing, setEditing] = useState<CompanyRow | null>(null);
  const [sapCode, setSapCode] = useState('');
  const [saving, setSaving] = useState(false);

  if (companies.loading) return <DashboardSkeleton />;
  if (companies.error) return <DashboardError message={companies.error} onRetry={companies.reload} />;

  const columns: Column<CompanyRow>[] = [
    {
      key: 'code',
      header: 'Code',
      width: '100px',
      render: (row) => <span className="font-semibold tabular-nums text-ink">{row.code}</span>,
    },
    {
      key: 'name',
      header: 'Legal name',
      width: 'minmax(200px,1fr)',
      render: (row) => <span className="text-ink">{row.name}</span>,
    },
    {
      key: 'sap',
      header: 'SAP company code',
      width: '160px',
      render: (row) => (
        <span className="tabular-nums text-ink-muted">{row.sapCompanyCode ?? '—'}</span>
      ),
    },
    {
      key: 'payroll',
      header: 'India payroll',
      width: '120px',
      render: (row) => (
        <StatusBadge tone={row.isIndiaPayroll ? 'positive' : 'neutral'}>
          {row.isIndiaPayroll ? 'Yes' : 'No'}
        </StatusBadge>
      ),
    },
  ];

  return (
    <>
      <Card>
        <CardHeader title="Companies" subtitle="ORG-01 — code is the primary stamp; SAP code only when they diverge." />
        <DataTable
          columns={columns}
          rows={companies.data?.rows ?? []}
          rowKey={(row) => String(row.id)}
          {...(canEdit
            ? {
                onRowClick: (row: CompanyRow) => {
                  setEditing(row);
                  setSapCode(row.sapCompanyCode ?? '');
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
        title={editing ? `SAP code · ${editing.code}` : 'SAP code'}
        subtitle="Leave blank when sap_company_code equals the internal code."
      >
        {editing ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void (async () => {
                setSaving(true);
                try {
                  await apiFetch(`/api/org/companies/${String(editing.id)}/sap-code`, {
                    method: 'PUT',
                    body: JSON.stringify({
                      companyId: editing.id,
                      sapCompanyCode: sapCode.trim() === '' ? null : sapCode.trim(),
                    }),
                  });
                  toast.success('SAP company code saved');
                  setEditing(null);
                  companies.reload();
                } catch (cause: unknown) {
                  toast.error(cause instanceof Error ? cause.message : 'Could not save');
                } finally {
                  setSaving(false);
                }
              })();
            }}
          >
            <TextField
              label="SAP company code"
              value={sapCode}
              onChange={(event) => {
                setSapCode(event.target.value);
              }}
              placeholder={editing.code}
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

export function PlantsPanel({ canEdit }: { canEdit: boolean }) {
  const plants = useDashboardResource<{ rows: PlantRow[] }>('/api/org/plants/admin');
  const companies = useDashboardResource<{ rows: CompanyRow[] }>('/api/org/companies');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    companyId: '',
    plantCode: '',
    name: '',
    isActive: true,
  });
  const [saving, setSaving] = useState(false);

  const companyOptions: SelectOption[] = useMemo(
    () =>
      (companies.data?.rows ?? []).map((c) => ({
        value: String(c.id),
        label: `${c.code} — ${c.name}`,
      })),
    [companies.data],
  );

  if (plants.loading || companies.loading) return <DashboardSkeleton />;
  if (plants.error) return <DashboardError message={plants.error} onRetry={plants.reload} />;

  const columns: Column<PlantRow>[] = [
    {
      key: 'company',
      header: 'Company',
      width: '90px',
      render: (row) => <span className="tabular-nums text-ink-muted">{row.companyCode}</span>,
    },
    {
      key: 'code',
      header: 'Plant code',
      width: '140px',
      render: (row) => <span className="font-semibold tabular-nums text-ink">{row.plantCode}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      width: 'minmax(180px,1fr)',
      render: (row) => <span className="text-ink">{row.name}</span>,
    },
    {
      key: 'active',
      header: 'Status',
      width: '110px',
      render: (row) => (
        <StatusBadge tone={row.isActive ? 'positive' : 'neutral'}>
          {row.isActive ? 'Active' : 'Retired'}
        </StatusBadge>
      ),
    },
  ];

  return (
    <>
      <Card>
        <CardHeader
          title="Plants"
          subtitle="ORG-02 — SAP WERKS / greytHR plant. A plant has many cost centres."
          action={
            canEdit ? (
              <Button
                size="sm"
                leadingIcon={<Plus className="size-4" />}
                onClick={() => {
                  setDraft({
                    companyId: companyOptions[0]?.value ?? '',
                    plantCode: '',
                    name: '',
                    isActive: true,
                  });
                  setOpen(true);
                }}
              >
                Add plant
              </Button>
            ) : undefined
          }
        />
        <DataTable
          columns={columns}
          rows={plants.data?.rows ?? []}
          rowKey={(row) => String(row.id)}
          empty={
            <EmptyState
              title="No plants yet"
              description="Backfill from the live cost-centre / plant mapping — do not invent codes."
            />
          }
        />
      </Card>

      <Drawer
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        title="Add plant"
        subtitle="Use the SAP / greytHR plant code Finance already knows."
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void (async () => {
              setSaving(true);
              try {
                await apiFetch('/api/org/plants', {
                  method: 'PUT',
                  body: JSON.stringify({
                    companyId: Number(draft.companyId),
                    plantCode: draft.plantCode.trim(),
                    name: draft.name.trim(),
                    locationId: null,
                    isActive: draft.isActive,
                  }),
                });
                toast.success('Plant saved');
                setOpen(false);
                plants.reload();
              } catch (cause: unknown) {
                toast.error(cause instanceof Error ? cause.message : 'Could not save');
              } finally {
                setSaving(false);
              }
            })();
          }}
        >
          <Select
            label="Company"
            value={draft.companyId}
            options={companyOptions}
            onChange={(value) => {
              setDraft((prev) => ({ ...prev, companyId: value }));
            }}
          />
          <TextField
            label="Plant code"
            value={draft.plantCode}
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, plantCode: event.target.value }));
            }}
            required
          />
          <TextField
            label="Name"
            value={draft.name}
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, name: event.target.value }));
            }}
            required
          />
          <Button type="submit" disabled={saving || draft.companyId === ''}>
            Save
          </Button>
        </form>
      </Drawer>
    </>
  );
}
