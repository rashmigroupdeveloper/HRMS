/**
 * Stage 2.0 MIS and cost-centre master panels (ORG-02/03/05).
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

interface MisRow {
  id: number;
  companyId: number;
  companyCode: string;
  code: string;
  name: string;
  parentId: number | null;
  isActive: boolean;
}

interface CostCenterRow {
  id: number;
  companyId: number;
  companyCode: string;
  code: string;
  name: string;
  plantId: number | null;
  plantCode: string | null;
}

export function MisPanel({ canEdit }: { canEdit: boolean }) {
  const mis = useDashboardResource<{ rows: MisRow[] }>('/api/org/mis-codes/admin');
  const companies = useDashboardResource<{ rows: CompanyRow[] }>('/api/org/companies');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ companyId: '', code: '', name: '' });
  const [saving, setSaving] = useState(false);

  const companyOptions: SelectOption[] = useMemo(
    () =>
      (companies.data?.rows ?? []).map((c) => ({
        value: String(c.id),
        label: `${c.code} — ${c.name}`,
      })),
    [companies.data],
  );

  if (mis.loading || companies.loading) return <DashboardSkeleton />;
  if (mis.error) return <DashboardError message={mis.error} onRetry={mis.reload} />;

  const columns: Column<MisRow>[] = [
    {
      key: 'company',
      header: 'Company',
      width: '90px',
      render: (row) => <span className="tabular-nums text-ink-muted">{row.companyCode}</span>,
    },
    {
      key: 'code',
      header: 'MIS code',
      width: '140px',
      render: (row) => <span className="font-semibold tabular-nums text-ink">{row.code}</span>,
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
          title="MIS codes"
          subtitle="ORG-03 — management-information codes from Finance / SAP. Empty is correct until that list arrives."
          action={
            canEdit ? (
              <Button
                size="sm"
                leadingIcon={<Plus className="size-4" />}
                onClick={() => {
                  setDraft({ companyId: companyOptions[0]?.value ?? '', code: '', name: '' });
                  setOpen(true);
                }}
              >
                Add MIS code
              </Button>
            ) : undefined
          }
        />
        <DataTable
          columns={columns}
          rows={mis.data?.rows ?? []}
          rowKey={(row) => String(row.id)}
          empty={
            <EmptyState
              title="No MIS codes"
              description="Do not invent Finance MIS codes. Paste them here when Finance supplies the catalog."
            />
          }
        />
      </Card>

      <Drawer
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        title="Add MIS code"
        subtitle="Only codes from the Finance / SAP MIS list."
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void (async () => {
              setSaving(true);
              try {
                await apiFetch('/api/org/mis-codes', {
                  method: 'PUT',
                  body: JSON.stringify({
                    companyId: Number(draft.companyId),
                    code: draft.code.trim(),
                    name: draft.name.trim(),
                    parentId: null,
                    isActive: true,
                  }),
                });
                toast.success('MIS code saved');
                setOpen(false);
                mis.reload();
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
            label="MIS code"
            value={draft.code}
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, code: event.target.value }));
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

export function CostCentersPanel({ canEdit }: { canEdit: boolean }) {
  const centers = useDashboardResource<{ rows: CostCenterRow[] }>('/api/org/cost-centers');
  const plants = useDashboardResource<{ rows: PlantRow[] }>('/api/org/plants/admin');
  const [editing, setEditing] = useState<CostCenterRow | null>(null);
  const [plantId, setPlantId] = useState('');
  const [saving, setSaving] = useState(false);

  const plantOptionsFor = (companyId: number): SelectOption[] => {
    const options: SelectOption[] = [{ value: '', label: '— Unassigned —' }];
    for (const plant of plants.data?.rows ?? []) {
      if (plant.companyId === companyId) {
        options.push({ value: String(plant.id), label: `${plant.plantCode} — ${plant.name}` });
      }
    }
    return options;
  };

  if (centers.loading || plants.loading) return <DashboardSkeleton />;
  if (centers.error) return <DashboardError message={centers.error} onRetry={centers.reload} />;

  const columns: Column<CostCenterRow>[] = [
    {
      key: 'company',
      header: 'Company',
      width: '90px',
      render: (row) => <span className="tabular-nums text-ink-muted">{row.companyCode}</span>,
    },
    {
      key: 'code',
      header: 'Cost centre',
      width: '120px',
      render: (row) => <span className="font-semibold tabular-nums text-ink">{row.code}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      width: 'minmax(160px,1fr)',
      render: (row) => <span className="text-ink">{row.name}</span>,
    },
    {
      key: 'plant',
      header: 'Plant',
      width: '140px',
      render: (row) => (
        <span className="tabular-nums text-ink-muted">{row.plantCode ?? '—'}</span>
      ),
    },
  ];

  return (
    <>
      <Card>
        <CardHeader
          title="Cost centres"
          subtitle="ORG-02 — each cost centre belongs to exactly one plant (plant_id)."
        />
        <DataTable
          columns={columns}
          rows={centers.data?.rows ?? []}
          rowKey={(row) => String(row.id)}
          {...(canEdit
            ? {
                onRowClick: (row: CostCenterRow) => {
                  setEditing(row);
                  setPlantId(row.plantId === null ? '' : String(row.plantId));
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
        title={editing ? `Plant · ${editing.code}` : 'Plant'}
        subtitle="Assign the plant this cost centre rolls into."
      >
        {editing ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void (async () => {
                setSaving(true);
                try {
                  await apiFetch(`/api/org/cost-centers/${String(editing.id)}/plant`, {
                    method: 'PUT',
                    body: JSON.stringify({
                      costCenterId: editing.id,
                      plantId: plantId === '' ? null : Number(plantId),
                    }),
                  });
                  toast.success('Plant assignment saved');
                  setEditing(null);
                  centers.reload();
                } catch (cause: unknown) {
                  toast.error(cause instanceof Error ? cause.message : 'Could not save');
                } finally {
                  setSaving(false);
                }
              })();
            }}
          >
            <Select
              label="Plant"
              value={plantId}
              options={plantOptionsFor(editing.companyId)}
              onChange={(value) => {
                setPlantId(value);
              }}
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
