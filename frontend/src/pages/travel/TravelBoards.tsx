import { useState } from 'react';
import { CreditCard, FileText, Plane, Plus, Wallet } from 'lucide-react';
import { Button, Card, CardHeader, DataTable, EmptyState, IconButton, StatusBadge, formatDateIN, toast, type Column } from '../../ui';
import { apiFetch } from '../../lib/api';
import { dayOf, formatPaise, statusTone, type AdvanceItem, type BudgetItem, type ClaimItem, type WalletLedgerItem } from './travel-model';

function when(value: string): string {
  const day = dayOf(value);
  return /^\d{4}-\d{2}-\d{2}/.test(day) ? formatDateIN(day) : value;
}

export function MyBudgetsPanel({
  budgets,
  onChanged,
  onCreate,
}: {
  budgets: BudgetItem[];
  onChanged: () => void;
  onCreate: () => void;
}) {
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  const submit = async (id: number) => {
    setSubmittingId(id);
    try {
      await apiFetch(`/api/travel/trips/${String(id)}/submit`, { method: 'POST', body: JSON.stringify({ tripId: id }) });
      toast.success('Budget submitted for approval');
      onChanged();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not submit the budget');
    } finally {
      setSubmittingId(null);
    }
  };

  const columns: Column<BudgetItem>[] = [
    { key: 'ref', header: 'Reference', mobile: 'title', render: (row) => <span className="font-mono text-xs font-semibold text-ink">{row.referenceNo}</span> },
    {
      key: 'route',
      header: 'Journey',
      mobile: 'subtitle',
      render: (row) => (
        <div>
          <p className="font-medium text-ink">{row.originCity ? `${row.originCity} to ${row.destinationCity}` : row.destinationCity}</p>
          <p className="max-w-xs truncate text-xs text-ink-muted">{row.purpose}</p>
        </div>
      ),
    },
    { key: 'type', header: 'Type', mobile: 'fact', render: (row) => <span className="text-xs capitalize text-ink-muted">{row.travelType}</span> },
    { key: 'dates', header: 'Dates', mobile: 'fact', render: (row) => <span className="text-xs text-ink-muted">{when(row.startDate)} – {when(row.endDate)}</span> },
    { key: 'amount', header: 'Budget', numeric: true, mobile: 'fact', render: (row) => <span className="font-mono text-xs text-ink">{formatPaise(row.estimatedBudgetPaise)}</span> },
    {
      key: 'status',
      header: 'Status',
      mobile: 'badge',
      render: (row) => (
        <span className="inline-flex items-center gap-2">
          <StatusBadge tone={statusTone(row.status)}>{row.status.replaceAll('_', ' ')}</StatusBadge>
          {row.status === 'draft' && (
            <Button size="sm" variant="secondary" loading={submittingId === row.id} onClick={() => { void submit(row.id); }}>
              Submit
            </Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader
        title="Travel budgets"
        subtitle="Each budget is the travel request. A claim or an advance opens only after it is approved."
        action={(
          <IconButton label="Create budget" icon={<Plus />} onClick={onCreate} />
        )}
      />
      <DataTable
        columns={columns}
        rows={budgets}
        rowKey={(row) => String(row.id)}
        empty={(
          <EmptyState
            icon={<Plane />}
            title="No budgets yet"
            description="A budget is the travel request. Create one, then raise a claim or an advance after it is approved."
          />
        )}
      />
    </Card>
  );
}

export function MyClaimsPanel({
  claims,
  budgets,
  onCreate,
}: {
  claims: ClaimItem[];
  budgets: BudgetItem[];
  onCreate: () => void;
}) {
  const byId = new Map(budgets.map((budget) => [budget.id, budget]));
  const columns: Column<ClaimItem>[] = [
    { key: 'ref', header: 'Reference', mobile: 'title', render: (row) => <span className="font-mono text-xs font-semibold text-ink">{row.referenceNo}</span> },
    { key: 'budget', header: 'Budget', mobile: 'subtitle', render: (row) => <span className="text-sm text-ink">{byId.get(row.tripId)?.destinationCity ?? `Budget #${String(row.tripId)}`}</span> },
    { key: 'claimed', header: 'Claimed', numeric: true, mobile: 'fact', render: (row) => <span className="font-mono text-xs text-ink">{formatPaise(row.totalClaimedPaise)}</span> },
    { key: 'net', header: 'Net', numeric: true, mobile: 'fact', render: (row) => <span className="font-mono text-xs text-ink">{row.netPayablePaise > 0 ? formatPaise(row.netPayablePaise) : formatPaise(row.netRecoverablePaise)}</span> },
    { key: 'settlement', header: 'Settlement', mobile: 'fact', render: (row) => <span className="text-xs capitalize text-ink-muted">{row.settlementStatus}</span> },
    { key: 'status', header: 'Status', mobile: 'badge', render: (row) => <StatusBadge tone={statusTone(row.status)}>{row.status.replaceAll('_', ' ')}</StatusBadge> },
  ];
  return (
    <Card>
      <CardHeader
        title="Expense claims"
        subtitle="Itemized claims reconciled against the advance in your travel wallet."
        action={(
          <IconButton label="File expense" icon={<Plus />} onClick={onCreate} />
        )}
      />
      <DataTable
        columns={columns}
        rows={claims}
        rowKey={(row) => String(row.id)}
        empty={<EmptyState icon={<FileText />} title="No claims filed" description="Submit receipts against an approved budget for settlement." />}
      />
    </Card>
  );
}

export function MyAdvancesPanel({
  advances,
  budgets,
  onCreate,
}: {
  advances: AdvanceItem[];
  budgets: BudgetItem[];
  onCreate: () => void;
}) {
  const byId = new Map(budgets.map((budget) => [budget.id, budget]));
  const columns: Column<AdvanceItem>[] = [
    { key: 'budget', header: 'Budget', mobile: 'title', render: (row) => <span className="text-sm text-ink">{byId.get(row.tripId)?.referenceNo ?? `Budget #${String(row.tripId)}`}</span> },
    { key: 'purpose', header: 'Reason', mobile: 'subtitle', render: (row) => <span className="text-sm text-ink">{row.purpose}</span> },
    { key: 'amount', header: 'Amount', numeric: true, mobile: 'fact', render: (row) => <span className="font-mono text-xs text-ink">{formatPaise(row.amountPaise)}</span> },
    { key: 'status', header: 'Status', mobile: 'badge', render: (row) => <StatusBadge tone={statusTone(row.status)}>{row.status.replaceAll('_', ' ')}</StatusBadge> },
    { key: 'when', header: 'Requested', mobile: 'fact', render: (row) => <span className="text-xs text-ink-muted">{when(row.createdAt)}</span> },
  ];
  return (
    <Card>
      <CardHeader
        title="Travel advances"
        subtitle="An approved advance is credited to the travel wallet."
        action={(
          <IconButton label="Request advance" icon={<Plus />} onClick={onCreate} />
        )}
      />
      <DataTable
        columns={columns}
        rows={advances}
        rowKey={(row) => String(row.id)}
        empty={<EmptyState icon={<CreditCard />} title="No advances on record" description="Request an advance against an approved budget." />}
      />
    </Card>
  );
}

export function WalletPanel({ ledger }: { ledger: WalletLedgerItem[] }) {
  const columns: Column<WalletLedgerItem>[] = [
    { key: 'ref', header: 'Reference', mobile: 'title', render: (row) => <span className="font-mono text-xs text-ink">{row.transactionReference}</span> },
    { key: 'source', header: 'Source', mobile: 'subtitle', render: (row) => <span className="text-sm capitalize text-ink">{row.source.replaceAll('_', ' ').toLowerCase()}</span> },
    { key: 'type', header: 'Movement', mobile: 'badge', render: (row) => <StatusBadge tone={row.type === 'credit' ? 'positive' : 'warning'}>{row.type}</StatusBadge> },
    { key: 'amount', header: 'Amount', numeric: true, mobile: 'fact', render: (row) => <span className="font-mono text-xs text-ink">{formatPaise(row.amountPaise)}</span> },
    { key: 'after', header: 'Balance after', numeric: true, mobile: 'fact', render: (row) => <span className="font-mono text-xs text-ink">{formatPaise(row.balanceAfterPaise)}</span> },
    { key: 'when', header: 'When', mobile: 'fact', render: (row) => <span className="text-xs text-ink-muted">{when(row.createdAt)}</span> },
  ];
  return (
    <Card>
      <CardHeader
        title="Wallet ledger"
        subtitle="Advances, claim settlements, and recoveries, in order."
      />
      <DataTable
        columns={columns}
        rows={ledger}
        rowKey={(row) => String(row.id)}
        empty={<EmptyState icon={<Wallet />} title="Wallet ledger empty" description="Movements appear here when an advance is disbursed or a claim is settled." />}
      />
    </Card>
  );
}
