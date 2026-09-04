import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, LockKeyhole, ShieldAlert, XCircle } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import {
  Button,
  Card,
  CardHeader,
  ConfirmModal,
  DarkCard,
  DataTable,
  EmptyState,
  KpiNumber,
  PageHeader,
  SegmentedProgress,
  StatusBadge,
  TextField,
  toast,
} from '../../ui';
import type { Column } from '../../ui';
import { CompanySelect } from '../_shared/CompanySelect';
import { currentMonthIST } from '../home/dashboard-format';
import { defaultCompanyId, rememberCompanyId } from '../reports/report-utils';

interface Checklist {
  companyId: number;
  month: string;
  canLock: boolean;
  alreadyLocked: boolean;
  items: { code: string; label: string; ok: boolean; detail: string }[];
}

interface ManagerApproval {
  managerEmployeeId: number;
  managerEcode: string;
  managerName: string;
  reportCount: number;
  approved: boolean;
  approvedAt: string | null;
  note: string | null;
}

function monthCaption(ym: string): string {
  const [year, month] = ym.split('-');
  if (year === undefined || month === undefined) return ym;
  return new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function MonthLockPage() {
  const [companyId, setCompanyId] = useState(() => defaultCompanyId());
  const [month, setMonth] = useState(() => currentMonthIST());
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [ledger, setLedger] = useState<ManagerApproval[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!/^\d+$/.test(companyId)) {
      setError('Select a legal entity.');
      return;
    }
    rememberCompanyId(companyId);
    setLoading(true);
    setError(null);
    try {
      const [cl, approvals] = await Promise.all([
        apiFetch<Checklist>(
          `/api/attendance/month-lock/checklist?companyId=${companyId}&month=${month}`,
        ),
        apiFetch<ManagerApproval[]>(
          `/api/attendance/manager-approvals?companyId=${companyId}&month=${month}`,
        ).catch(() => [] as ManagerApproval[]),
      ]);
      setChecklist(cl);
      setLedger(approvals);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Checklist unavailable.');
    } finally {
      setLoading(false);
    }
  }, [companyId, month]);

  useEffect(() => {
    if (/^\d+$/.test(defaultCompanyId())) void load();
    // Current month + remembered company — do not re-run while typing.
  }, []);

  const lock = async () => {
    setLoading(true);
    try {
      await apiFetch('/api/attendance/month-lock', {
        method: 'POST',
        body: JSON.stringify({ companyId: Number(companyId), month }),
      });
      toast.success(`${month} attendance locked`);
      setConfirming(false);
      await load();
    } catch (cause) {
      toast.error('Month could not be locked', {
        description: cause instanceof Error ? cause.message : 'Try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const met = checklist?.items.filter((item) => item.ok).length ?? 0;
  const total = checklist?.items.length ?? 0;
  const pendingManagers = ledger.filter((row) => !row.approved).length;
  const locked = checklist?.alreadyLocked === true;
  const ready = checklist?.canLock === true && !locked;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ATT-15 · irreversible control"
        title="Month lock"
        description="Verify every attendance dependency before freezing the month. Closed records cannot be edited."
      />

      <DarkCard>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hero-muted">
          {monthCaption(month)}
        </p>
        {checklist ? (
          <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-4xl font-light tabular-nums">
                <KpiNumber value={met} animateOnMount={false} />
                <span className="text-2xl text-hero-muted"> / {String(total)}</span>
              </p>
              <p className="mt-1 text-sm text-hero-muted">
                {locked
                  ? 'gates met — this month is already frozen. Day records cannot be edited.'
                  : ready
                    ? 'gates already met. Locking now permanently withdraws the ability to edit this month.'
                    : `${String(total - met)} gate${total - met === 1 ? '' : 's'} still open — payroll cannot start until they close.`}
              </p>
            </div>
            <StatusBadge tone={locked ? 'positive' : ready ? 'warning' : 'negative'}>
              {locked ? 'Already locked' : ready ? 'Ready to lock' : 'Blocked'}
            </StatusBadge>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-2xl font-light text-hero-ink">Run the checklist for this month</p>
            <p className="mt-1 text-sm text-hero-muted">
              Already-met gates will show as done. Nothing starts at empty if the work is already done.
            </p>
          </div>
        )}
      </DarkCard>

      <Card>
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <CompanySelect
            value={companyId}
            onChange={(value) => {
              setCompanyId(value);
            }}
            error={error ?? undefined}
          />
          <TextField
            label="Month"
            type="month"
            value={month}
            onChange={(event) => {
              setMonth(event.currentTarget.value);
            }}
          />
          <Button variant={checklist ? 'secondary' : 'primary'} loading={loading} onClick={() => void load()}>
            {checklist ? 'Refresh checklist' : 'Run checklist'}
          </Button>
        </div>
      </Card>

      {checklist ? (
        <Card>
          <CardHeader
            title={`${checklist.month} pre-lock checklist`}
            subtitle={`Selected legal entity · ${String(met)} of ${String(total)} already done`}
          />
          <SegmentedProgress label="Gates already met" primary={met} total={total} />
          <div className="mt-4 space-y-2">
            {checklist.items.map((item) => (
              <div key={item.code} className="flex items-start gap-3 rounded-row bg-surface-2 p-4">
                {item.ok ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-positive" />
                ) : (
                  <XCircle className="mt-0.5 size-5 shrink-0 text-negative" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{item.label}</p>
                  <p className="mt-0.5 text-xs leading-5 text-ink-muted">{item.detail}</p>
                </div>
                <StatusBadge tone={item.ok ? 'positive' : 'negative'}>
                  {item.ok ? 'Done' : 'Open'}
                </StatusBadge>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <Button
              variant="danger"
              leadingIcon={<LockKeyhole className="size-4" />}
              disabled={!checklist.canLock || checklist.alreadyLocked}
              onClick={() => {
                setConfirming(true);
              }}
            >
              Lock {checklist.month}
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon={<ShieldAlert />}
            title="Run the checklist first"
            description="No lock action is available until completeness, approvals and finalisation gates are proven. Enter company and month above — remembered company loads current month automatically."
          />
        </Card>
      )}

      {ledger.length > 0 ? (
        <Card>
          <CardHeader
            title="Manager approval ledger"
            subtitle={
              pendingManagers
                ? `ATT-12 · ${String(pendingManagers)} of ${String(ledger.length)} managers still outstanding`
                : `ATT-12 · all ${String(ledger.length)} managers approved`
            }
          />
          <DataTable
            rows={ledger}
            columns={ledgerColumns}
            rowKey={(row) => String(row.managerEmployeeId)}
            maxHeight={360}
          />
        </Card>
      ) : null}

      <ConfirmModal
        open={confirming}
        onClose={() => {
          setConfirming(false);
        }}
        title="Lock attendance month"
        description={`Locking ${monthCaption(month)} permanently withdraws the ability to edit day records. Payroll can start only after this freeze. Type the confirmation to continue.`}
        confirmLabel="Lock month"
        typedConfirmation={`LOCK ${month}`}
        onConfirm={() => void lock()}
        danger
      />
    </div>
  );
}

const ledgerColumns: Column<ManagerApproval>[] = [
  {
    key: 'mgr',
    header: 'Manager',
    width: 'minmax(180px,1.4fr)',
    render: (row) => (
      <div>
        <p className="font-semibold text-ink">{row.managerName}</p>
        <p className="text-xs text-ink-muted">{row.managerEcode}</p>
      </div>
    ),
  },
  {
    key: 'reports',
    header: 'Reports',
    width: '90px',
    numeric: true,
    render: (row) => row.reportCount,
  },
  {
    key: 'status',
    header: 'Status',
    width: '120px',
    render: (row) => (
      <StatusBadge tone={row.approved ? 'positive' : 'warning'}>
        {row.approved ? 'Approved' : 'Pending'}
      </StatusBadge>
    ),
  },
  {
    key: 'at',
    header: 'Approved at',
    width: '180px',
    render: (row) =>
      row.approvedAt ? new Date(row.approvedAt).toLocaleString('en-IN') : '—',
  },
];
