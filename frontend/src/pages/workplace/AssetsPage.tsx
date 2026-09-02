/**
 * Asset registry (M8 — AST-01…AST-06).
 *
 * Organised around the question that actually matters operationally: what is
 * out, and who has it. The register earns its keep at EXIT — an asset still
 * held by a leaver blocks their clearance (AST-04) — so the "still out with
 * leavers" view is a first-class tab, not a report buried in a menu.
 *
 * Everything here reads and writes the live `/api/assets` module.
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Laptop, PackageSearch, Plus, Search, Undo2 } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import {
  Button,
  Card,
  CardHeader,
  DarkCard,
  DataTable,
  Drawer,
  EmptyState,
  PageHeader,
  Pill,
  Select,
  StatusBadge,
  TextField,
  Textarea,
  formatDateIN,
  toast,
} from '../../ui';
import type { Column, SelectOption } from '../../ui';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { defaultCompanyId, rememberCompanyId } from '../reports/report-utils';

type AssetStatus = 'in_stock' | 'assigned' | 'maintenance' | 'lost' | 'scrapped';

interface Asset {
  id: number;
  assetNo: string;
  category: string;
  description: string | null;
  serialNo: string | null;
  purchaseDate: string | null;
  warrantyTill: string | null;
  status: AssetStatus;
  companyId: number;
  locationName: string | null;
  holderKind: 'employee' | 'third_party' | null;
  holderName: string | null;
  holderEcode: string | null;
  assignedAt: string | null;
  assignmentId: number | null;
}

interface Outstanding {
  assetNo: string;
  category: string;
  ecode: string;
  name: string;
  dol: string | null;
}

const STATUS_TONE: Record<AssetStatus, 'positive' | 'info' | 'warning' | 'negative' | 'neutral'> = {
  in_stock: 'positive',
  assigned: 'info',
  maintenance: 'warning',
  lost: 'negative',
  scrapped: 'neutral',
};

const STATUS_LABEL: Record<AssetStatus, string> = {
  in_stock: 'In stock',
  assigned: 'Assigned',
  maintenance: 'Maintenance',
  lost: 'Lost',
  scrapped: 'Scrapped',
};

const STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any status' },
  ...(Object.keys(STATUS_LABEL) as AssetStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] })),
];

export function AssetsPage() {
  const [tab, setTab] = useState<'register' | 'outstanding'>('register');
  const [companyId, setCompanyId] = useState(() => defaultCompanyId());

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Assets"
        title="Company kit"
        description="See every laptop, phone and tool the company owns, who is holding it, and whether it came back when they left."
        actions={
          <div className="flex items-end gap-2">
            <div className="w-32">
              <TextField
                label="Company ID"
                value={companyId}
                onChange={(e) => {
                  setCompanyId(e.currentTarget.value);
                  rememberCompanyId(e.currentTarget.value);
                }}
              />
            </div>
            <div className="flex rounded-full bg-surface-2 p-1">
              <Button
                size="sm"
                variant={tab === 'register' ? 'hero' : 'ghost'}
                onClick={() => {
                  setTab('register');
                }}
              >
                Register
              </Button>
              <Button
                size="sm"
                variant={tab === 'outstanding' ? 'hero' : 'ghost'}
                onClick={() => {
                  setTab('outstanding');
                }}
              >
                Not returned
              </Button>
            </div>
          </div>
        }
      />

      <DarkCard padded={false} className="p-8 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hero-muted">
          Why this exists
        </p>
        <h2 className="mt-4 max-w-xl text-4xl font-light tracking-tight text-hero-ink">
          What is out, and who has it.
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-7 text-hero-muted">
          Register kit, allocate it, take it back. An exit cannot close while something is still in
          someone’s bag.
        </p>
      </DarkCard>

      {tab === 'register' ? (
        <RegisterPanel companyId={companyId} />
      ) : (
        <OutstandingPanel companyId={companyId} />
      )}
    </div>
  );
}

function RegisterPanel({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [acting, setActing] = useState<Asset | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '100', offset: '0' });
      if (/^\d+$/.test(companyId)) params.set('companyId', companyId);
      if (q.trim() !== '') params.set('q', q.trim());
      if (status !== '') params.set('status', status);
      const page = await apiFetch<{ rows: Asset[]; total: number }>(`/api/assets?${params.toString()}`);
      setRows(page.rows);
      setTotal(page.total);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the register.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, q, status]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => {
      clearTimeout(timer);
    };
  }, [load]);

  const columns: Column<Asset>[] = [
    {
      key: 'assetNo',
      header: 'Asset',
      width: 'minmax(180px,1fr)',
      render: (r) => (
        <div>
          <span className="font-semibold text-ink">{r.assetNo}</span>
          <p className="mt-0.5 text-xs text-ink-muted">{r.description ?? r.category}</p>
        </div>
      ),
    },
    { key: 'category', header: 'Category', width: '120px', render: (r) => <Pill>{r.category}</Pill> },
    {
      key: 'serial',
      header: 'Serial',
      width: '150px',
      render: (r) => <span className="text-xs text-ink-muted">{r.serialNo ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '130px',
      render: (r) => <StatusBadge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</StatusBadge>,
    },
    {
      key: 'holder',
      header: 'Held by',
      width: 'minmax(170px,1fr)',
      render: (r) =>
        r.holderName === null ? (
          <span className="text-ink-faint">—</span>
        ) : (
          <div>
            <span className="text-ink">{r.holderName}</span>
            <p className="mt-0.5 text-xs text-ink-muted">
              {r.holderKind === 'third_party' ? 'Third party' : (r.holderEcode ?? 'Employee')}
            </p>
          </div>
        ),
    },
    {
      key: 'warranty',
      header: 'Warranty till',
      width: '130px',
      render: (r) => (
        <span className="tabular-nums text-ink-muted">
          {r.warrantyTill === null ? '—' : formatDateIN(r.warrantyTill)}
        </span>
      ),
    },
    {
      key: 'act',
      header: '',
      width: '120px',
      render: (r) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setActing(r);
          }}
        >
          {r.status === 'assigned' ? 'Return' : 'Allocate'}
        </Button>
      ),
    },
  ];

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <TextField
              label="Search"
              placeholder="Asset no, serial, category or holder…"
              value={q}
              leadingIcon={<Search className="size-4" />}
              onChange={(e) => {
                setQ(e.currentTarget.value);
              }}
            />
          </div>
          <div className="w-44">
            <Select label="Status" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
          </div>
          <Button
            variant="primary"
            leadingIcon={<Plus className="size-4" />}
            onClick={() => {
              setCreating(true);
            }}
          >
            Register asset
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={`${total.toLocaleString('en-IN')} assets`}
          subtitle="Search covers asset number, serial and the current holder (AST-01)."
        />
      </Card>

      {loading ? (
        <DashboardSkeleton />
      ) : error !== null ? (
        <DashboardError message={error} onRetry={() => void load()} />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => String(r.id)}
          maxHeight={620}
          empty={
            <EmptyState
              icon={<PackageSearch />}
              title="No assets match"
              description="Clear the search, or register the first asset."
            />
          }
        />
      )}

      <AssetEditor
        open={creating}
        companyId={companyId}
        onClose={() => {
          setCreating(false);
        }}
        onSaved={() => {
          setCreating(false);
          void load();
        }}
      />

      <AllocationDrawer
        asset={acting}
        onClose={() => {
          setActing(null);
        }}
        onDone={() => {
          setActing(null);
          void load();
        }}
      />
    </>
  );
}

function AssetEditor({
  open,
  companyId,
  onClose,
  onSaved,
}: {
  open: boolean;
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [assetNo, setAssetNo] = useState('');
  const [category, setCategory] = useState('laptop');
  const [description, setDescription] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [warrantyTill, setWarrantyTill] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (assetNo.trim() === '' || category.trim() === '') {
      setError('Asset number and category are required.');
      return;
    }
    if (!/^\d+$/.test(companyId)) {
      setError('Set a valid company ID first.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/assets/${encodeURIComponent(assetNo.trim())}`, {
        method: 'PUT',
        body: JSON.stringify({
          assetNo: assetNo.trim(),
          category: category.trim(),
          description: description.trim() === '' ? null : description.trim(),
          serialNo: serialNo.trim() === '' ? null : serialNo.trim(),
          warrantyTill: warrantyTill === '' ? null : warrantyTill,
          companyId: Number(companyId),
        }),
      });
      toast.success('Asset registered', { description: `${assetNo.trim()} is now in the register.` });
      setAssetNo('');
      setSerialNo('');
      setDescription('');
      setWarrantyTill('');
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the asset.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Register asset"
      subtitle="ast.assets · audited"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            Save asset
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <TextField
          label="Asset number"
          hint="The searchable identity — printed on the sticker."
          value={assetNo}
          onChange={(e) => {
            setAssetNo(e.currentTarget.value);
          }}
        />
        <TextField
          label="Category"
          hint="laptop · phone · sim · vehicle · tool"
          value={category}
          onChange={(e) => {
            setCategory(e.currentTarget.value);
          }}
        />
        <TextField
          label="Serial number"
          value={serialNo}
          onChange={(e) => {
            setSerialNo(e.currentTarget.value);
          }}
        />
        <Textarea
          label="Description"
          rows={3}
          value={description}
          onChange={(e) => {
            setDescription(e.currentTarget.value);
          }}
        />
        <TextField
          label="Warranty till"
          type="date"
          hint="Past dates are allowed — kit is often registered after it was issued (AST-02)."
          value={warrantyTill}
          onChange={(e) => {
            setWarrantyTill(e.currentTarget.value);
          }}
        />
        {error !== null && (
          <p className="text-sm text-negative" role="alert">
            {error}
          </p>
        )}
      </div>
    </Drawer>
  );
}

function AllocationDrawer({
  asset,
  onClose,
  onDone,
}: {
  asset: Asset | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const assigned = asset?.status === 'assigned';
  const [holderKind, setHolderKind] = useState<'employee' | 'third_party'>('employee');
  const [employeeId, setEmployeeId] = useState('');
  const [thirdPartyName, setThirdPartyName] = useState('');
  const [thirdPartyOrg, setThirdPartyOrg] = useState('');
  const [condition, setCondition] = useState<'ok' | 'damaged' | 'not_returned'>('ok');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The register carries the OPEN assignment id, so a return acts on a known
  // row rather than a guessed one.
  const assignmentId = asset === null ? null : asset.assignmentId;

  const allocate = async () => {
    if (!asset) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/assets/${String(asset.id)}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          assetId: asset.id,
          holderKind,
          employeeId: holderKind === 'employee' ? Number(employeeId) : null,
          thirdPartyName: holderKind === 'third_party' ? thirdPartyName.trim() : null,
          thirdPartyOrg: holderKind === 'third_party' ? thirdPartyOrg.trim() : null,
          notes: notes.trim() === '' ? null : notes.trim(),
        }),
      });
      toast.success('Asset allocated', { description: `${asset.assetNo} is now assigned.` });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not allocate the asset.');
    } finally {
      setBusy(false);
    }
  };

  const recordReturn = async () => {
    if (assignmentId === null) {
      setError('Could not resolve the open allocation for this asset.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/assets/assignments/${String(assignmentId)}/return`, {
        method: 'POST',
        body: JSON.stringify({
          assignmentId,
          condition,
          notes: notes.trim() === '' ? null : notes.trim(),
        }),
      });
      toast.success('Return recorded', {
        description:
          condition === 'damaged'
            ? 'Sent to maintenance rather than back into stock.'
            : 'The asset is back in stock.',
      });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not record the return.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={asset !== null}
      onClose={onClose}
      title={`${assigned ? 'Return' : 'Allocate'} ${asset === null ? '' : asset.assetNo}`}
      subtitle={assigned ? 'ast.assignments · audited' : 'AST-03 · employee or third party'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={() => void (assigned ? recordReturn() : allocate())}
          >
            {assigned ? 'Record return' : 'Allocate'}
          </Button>
        </div>
      }
    >
      {asset && (
        <div className="space-y-5">
          {assigned ? (
            <>
              <div className="rounded-row bg-surface-2 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Currently held by
                </p>
                <p className="mt-1 text-sm font-semibold text-ink">{asset.holderName}</p>
              </div>
              <Select
                label="Return condition"
                value={condition}
                options={[
                  { value: 'ok', label: 'Returned — good condition' },
                  { value: 'damaged', label: 'Returned — damaged', description: 'Goes to maintenance' },
                  {
                    value: 'not_returned',
                    label: 'Not returned',
                    description: 'Keeps the exit clearance open (AST-04)',
                  },
                ]}
                onChange={(value) => {
                  setCondition(value as 'ok' | 'damaged' | 'not_returned');
                }}
              />
            </>
          ) : (
            <>
              <Select
                label="Holder type"
                value={holderKind}
                options={[
                  { value: 'employee', label: 'Employee' },
                  { value: 'third_party', label: 'Third party / contractor' },
                ]}
                onChange={(value) => {
                  setHolderKind(value as 'employee' | 'third_party');
                }}
              />
              {holderKind === 'employee' ? (
                <TextField
                  label="Employee ID"
                  hint="Numeric employee id from the directory."
                  value={employeeId}
                  onChange={(e) => {
                    setEmployeeId(e.currentTarget.value);
                  }}
                />
              ) : (
                <>
                  <TextField
                    label="Holder name"
                    value={thirdPartyName}
                    onChange={(e) => {
                      setThirdPartyName(e.currentTarget.value);
                    }}
                  />
                  <TextField
                    label="Organisation"
                    value={thirdPartyOrg}
                    onChange={(e) => {
                      setThirdPartyOrg(e.currentTarget.value);
                    }}
                  />
                </>
              )}
            </>
          )}

          <Textarea
            label="Notes"
            rows={3}
            value={notes}
            onChange={(e) => {
              setNotes(e.currentTarget.value);
            }}
          />

          {error !== null && (
            <p className="text-sm text-negative" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </Drawer>
  );
}

function OutstandingPanel({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<Outstanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (/^\d+$/.test(companyId)) params.set('companyId', companyId);
      setRows(await apiFetch<Outstanding[]>(`/api/assets/non-returned?${params.toString()}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load outstanding assets.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: Column<Outstanding>[] = [
    { key: 'assetNo', header: 'Asset', width: '160px', render: (r) => <span className="font-semibold text-ink">{r.assetNo}</span> },
    { key: 'category', header: 'Category', width: '120px', render: (r) => <Pill>{r.category}</Pill> },
    {
      key: 'holder',
      header: 'Held by (exited)',
      width: 'minmax(200px,1fr)',
      render: (r) => (
        <div>
          <span className="text-ink">{r.name}</span>
          <p className="mt-0.5 text-xs text-ink-muted">{r.ecode}</p>
        </div>
      ),
    },
    {
      key: 'dol',
      header: 'Left on',
      width: '140px',
      render: (r) => (
        <span className="tabular-nums text-ink-muted">{r.dol === null ? '—' : formatDateIN(r.dol)}</span>
      ),
    },
  ];

  if (loading) return <DashboardSkeleton />;
  if (error !== null) return <DashboardError message={error} onRetry={() => void load()} />;

  return (
    <>
      <Card>
        <div className="flex items-start gap-3">
          {rows.length > 0 ? (
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
          ) : (
            <Undo2 className="mt-0.5 size-5 shrink-0 text-positive" />
          )}
          <div>
            <p className="text-sm font-semibold text-ink">
              {rows.length === 0
                ? 'Nothing outstanding'
                : `${String(rows.length)} asset${rows.length === 1 ? '' : 's'} still held by people who have left`}
            </p>
            <p className="mt-0.5 text-xs leading-5 text-ink-muted">
              AST-05 · these keep the exit clearance open until they are returned or written off.
            </p>
          </div>
        </div>
      </Card>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => `${r.assetNo}-${r.ecode}`}
        maxHeight={560}
        empty={
          <EmptyState
            icon={<Laptop />}
            title="Every asset is accounted for"
            description="No exited employee is still holding company kit."
          />
        }
      />
    </>
  );
}
