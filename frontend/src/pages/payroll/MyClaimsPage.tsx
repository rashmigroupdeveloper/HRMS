/**
 * `/my/claims` — raise a travel budget, claim against it, watch it clear.
 *
 * Feature parity with the live EMS claim portal; the interface is ours. The
 * behavioural rules from docs/05 §9 are doing real work here, so each is
 * marked at the point it applies rather than left as good intentions:
 *
 *  §9.3 reciprocity — the budget and its remaining headroom are on screen
 *       BEFORE any form is asked for. Value first, then the ask.
 *  §9.1 smart defaults — the budget with headroom is pre-selected, the date is
 *       today, the first line is already there. Nobody starts at a blank form.
 *  §9.6 anchoring — a claimed figure never appears alone; it carries the
 *       remaining headroom it is drawn against.
 *  §9.7 commitment with the action — the amount and what it leaves are beside
 *       Submit, not scrolled away above it.
 *  §9.5 loss aversion, honestly — submitting really does commit the money, and
 *       the button says so. No invented urgency.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plane, ReceiptText, Wallet } from 'lucide-react';
import { ApiError, apiFetch } from '../../lib/api';
import {
  Button,
  Card,
  CardHeader,
  DatePicker,
  EmptyState,
  KpiPillRow,
  PageHeader,
  Select,
  Skeleton,
  StatusBadge,
  TextField,
  toast,
} from '../../ui';
import type { KpiPill, StatusTone } from '../../ui';
import { todayISOIST } from '../../ui';

interface BudgetRow {
  id: number;
  reference: string;
  title: string;
  status: string;
  travelType: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  periodFrom: string;
  periodTo: string;
  allowance: string;
  reserved: string;
  remaining: string;
  currency: string;
}
interface ClaimRow {
  id: number;
  reference: string;
  budgetTitle: string | null;
  status: string;
  claimedAmount: string;
  approvedAmount: string | null;
  lineCount: number;
  rejectionReason: string | null;
}
interface ClaimType {
  code: string;
  name: string;
  requiresBill: boolean;
}
interface DraftLine {
  claimTypeCode: string;
  description: string;
  spentOn: string;
  billNo: string;
  amount: string;
}

const CLAIM_TONE: Record<string, StatusTone> = {
  draft: 'neutral',
  submitted: 'info',
  sent_back: 'warning',
  approved: 'positive',
  rejected: 'negative',
  settled: 'positive',
};
const CLAIM_LABEL: Record<string, string> = {
  draft: 'Draft',
  submitted: 'With your approver',
  sent_back: 'Sent back to you',
  approved: 'Approved',
  rejected: 'Declined',
  settled: 'Settled',
};

const inr = (value: string | number): string =>
  `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export function MyClaimsPage() {
  const [budgets, setBudgets] = useState<BudgetRow[] | null>(null);
  const [claims, setClaims] = useState<ClaimRow[] | null>(null);
  const [types, setTypes] = useState<ClaimType[]>([]);
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => {
    setReload((n) => n + 1);
  }, []);

  useEffect(() => {
    void apiFetch<{ rows: BudgetRow[] }>('/api/claims/my/budgets')
      .then((r) => {
        setBudgets(r.rows);
      })
      .catch(() => {
        setBudgets([]);
      });
    void apiFetch<{ rows: ClaimRow[] }>('/api/claims/my')
      .then((r) => {
        setClaims(r.rows);
      })
      .catch(() => {
        setClaims([]);
      });
  }, [reload]);

  useEffect(() => {
    void apiFetch<{ rows: ClaimType[] }>('/api/claims/types')
      .then((r) => {
        setTypes(r.rows);
      })
      .catch(() => {
        setTypes([]);
      });
  }, []);

  const claimable = useMemo(
    () => (budgets ?? []).filter((b) => b.status === 'approved' && Number(b.remaining) > 0),
    [budgets],
  );

  // §9.6 — every figure carries the quantity it is read against.
  const pills: KpiPill[] = useMemo(() => {
    const totalRemaining = (budgets ?? [])
      .filter((b) => b.status === 'approved')
      .reduce((sum, b) => sum + Number(b.remaining), 0);
    const totalAllowance = (budgets ?? [])
      .filter((b) => b.status === 'approved')
      .reduce((sum, b) => sum + Number(b.allowance), 0);
    const openClaims = (claims ?? []).filter(
      (c) => c.status === 'submitted' || c.status === 'sent_back',
    ).length;
    return [
      {
        label: 'Left to claim',
        value: totalRemaining,
        state: 'accent',
        prefix: '₹',
        precision: 0,
        ...(totalAllowance > 0
          ? { anchor: { value: totalAllowance, label: 'of', prefix: '₹' } }
          : {}),
      },
      {
        label: 'With your approver',
        value: openClaims,
        state: 'hatched',
        ...((claims?.length ?? 0) > 0
          ? { anchor: { value: claims?.length ?? 0, label: 'of' } }
          : {}),
      },
      { label: 'Budgets you can claim on', value: claimable.length, state: 'outline' },
    ];
  }, [budgets, claims, claimable.length]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My money"
        title="Travel & claims"
        description="Raise a budget for a trip, then claim what you actually spent against it. Your approver sees the same numbers you do."
      />

      {budgets === null ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        <KpiPillRow pills={pills} />
      )}

      {/* §9.3 — the budget and its headroom come BEFORE any form. */}
      <BudgetList rows={budgets} onChanged={refresh} />

      <NewClaim budgets={claimable} types={types} onCreated={refresh} />

      <ClaimList rows={claims} onChanged={refresh} />
    </div>
  );
}

/* ── Budgets ─────────────────────────────────────────────────────────────── */

function BudgetList({ rows, onChanged }: { rows: BudgetRow[] | null; onChanged: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader
        title="Your budgets"
        subtitle="A budget is the trip and its estimate in one. Nothing can be claimed until it is approved."
        action={
          <Button
            size="sm"
            variant={open ? 'ghost' : 'primary'}
            onClick={() => {
              setOpen((v) => !v);
            }}
          >
            {open ? 'Cancel' : 'New budget'}
          </Button>
        }
      />

      {open ? (
        <NewBudgetForm
          onDone={() => {
            setOpen(false);
            onChanged();
          }}
        />
      ) : null}

      {rows === null ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<Plane />}
            title="No budgets yet"
            description="Raise one for your next trip — where you are going, when, and roughly what it will cost. Once your approver signs it off you can claim against it."
          />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((b) => {
            const remaining = Number(b.remaining);
            const allowance = Number(b.allowance);
            const usedPct = allowance > 0 ? Math.round(((allowance - remaining) / allowance) * 100) : 0;
            return (
              <li key={b.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm text-ink">
                      {b.title}
                      <StatusBadge tone={b.status === 'approved' ? 'positive' : 'info'}>
                        {b.status === 'approved' ? 'Approved' : 'Waiting for approval'}
                      </StatusBadge>
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {b.reference}
                      {b.fromLocation === null ? '' : ` · ${b.fromLocation} → ${b.toLocation ?? ''}`}
                      {` · ${b.periodFrom} to ${b.periodTo}`}
                    </p>
                  </div>
                  {/* §9.6 — the ruler travels with the number. */}
                  <div className="text-right">
                    <p className="text-lg font-light tabular-nums text-ink">
                      {inr(b.remaining)}{' '}
                      <span className="text-sm text-ink-muted">of {inr(b.allowance)} left</span>
                    </p>
                    {usedPct > 0 ? (
                      <p className="text-xs text-ink-muted">{usedPct}% committed</p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function NewBudgetForm({ onDone }: { onDone: () => void }) {
  // §9.1 — never a blank form. Dates default to today, type to domestic.
  const today = todayISOIST();
  const [title, setTitle] = useState('');
  const [fromLocation, setFrom] = useState('');
  const [toLocation, setTo] = useState('');
  const [travelStart, setStart] = useState(today);
  const [travelEnd, setEnd] = useState(today);
  const [allowance, setAllowance] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    setBusy(true);
    try {
      await apiFetch('/api/claims/my/budgets', {
        method: 'POST',
        body: JSON.stringify({
          title,
          purpose: null,
          travelType: 'domestic',
          fromLocation: fromLocation === '' ? null : fromLocation,
          toLocation: toLocation === '' ? null : toLocation,
          travelStart,
          travelEnd,
          nights: null,
          allowance: Number(allowance),
        }),
      });
      toast.success('Budget sent for approval');
      onDone();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not raise the budget');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="u-pop-in grid gap-4 border-b border-line p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <TextField
        label="What is the trip?"
        placeholder="Kolkata site visit"
        className="sm:col-span-2"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
        }}
        required
      />
      <TextField
        label="From"
        value={fromLocation}
        onChange={(e) => {
          setFrom(e.target.value);
        }}
      />
      <TextField
        label="To"
        value={toLocation}
        onChange={(e) => {
          setTo(e.target.value);
        }}
      />
      <DatePicker label="Leaving" value={travelStart} onChange={setStart} />
      <DatePicker label="Returning" value={travelEnd} onChange={setEnd} />
      <TextField
        label="Estimated cost"
        inputMode="decimal"
        hint="Your approver can grant less than you ask for."
        value={allowance}
        onChange={(e) => {
          setAllowance(e.target.value.replace(/[^\d.]/g, ''));
        }}
        required
      />
      <div className="flex items-end sm:col-span-2">
        <Button type="submit" disabled={busy || title.trim() === '' || allowance === ''}>
          Send for approval
        </Button>
      </div>
    </form>
  );
}

/* ── New claim ───────────────────────────────────────────────────────────── */

function NewClaim({
  budgets,
  types,
  onCreated,
}: {
  budgets: BudgetRow[];
  types: ClaimType[];
  onCreated: () => void;
}) {
  const today = todayISOIST();
  // §9.1 — the budget with headroom is pre-selected; one line is already there.
  const [budgetId, setBudgetId] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([
    { claimTypeCode: 'travel', description: '', spentOn: today, billNo: '', amount: '' },
  ]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (budgetId === '' && budgets.length > 0) setBudgetId(String(budgets[0]?.id ?? ''));
  }, [budgets, budgetId]);

  const budget = budgets.find((b) => String(b.id) === budgetId);
  const total = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const remaining = Number(budget?.remaining ?? 0);
  const over = total > remaining;

  if (budgets.length === 0) {
    return (
      <Card>
        <CardHeader title="Make a claim" />
        <div className="p-4">
          <EmptyState
            icon={<ReceiptText />}
            title="Nothing to claim against yet"
            description="A claim always sits against an approved budget. Raise a budget above and once it is approved it will appear here."
          />
        </div>
      </Card>
    );
  }

  const submit = async (): Promise<void> => {
    setBusy(true);
    try {
      const created = await apiFetch<{
        id: number;
        reference: string;
        status: string;
        reservedAmount: string;
      }>('/api/claims/my', {
        method: 'POST',
        body: JSON.stringify({
          budgetId: Number(budgetId),
          intent: 'submit',
          periodFrom: lines.reduce((min, l) => (l.spentOn < min ? l.spentOn : min), today),
          periodTo: lines.reduce((max, l) => (l.spentOn > max ? l.spentOn : max), today),
          lines: lines.map((l) => ({
            claimTypeCode: l.claimTypeCode,
            description: l.description === '' ? null : l.description,
            spentOn: l.spentOn,
            billNo: l.billNo === '' ? null : l.billNo,
            amount: Number(l.amount),
          })),
        }),
      });
      toast.success(`${created.reference} sent to your approver`);
      setLines([{ claimTypeCode: 'travel', description: '', spentOn: today, billNo: '', amount: '' }]);
      onCreated();
    } catch (error) {
      // The server's refusal already names the limit and the shortfall.
      toast.error(error instanceof ApiError ? error.message : 'Could not send the claim');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Make a claim"
        subtitle="Add what you actually spent. Each line can carry its bill number."
      />
      <div className="space-y-4 p-4">
        <Select
          label="Against which budget"
          value={budgetId}
          onChange={setBudgetId}
          options={budgets.map((b) => ({
            value: String(b.id),
            label: `${b.title} — ${inr(b.remaining)} left`,
          }))}
        />

        {lines.map((line, index) => (
          <div key={index} className="grid gap-3 rounded-xl bg-surface-2 p-3 sm:grid-cols-5">
            <Select
              label="Type"
              value={line.claimTypeCode}
              onChange={(value) => {
                setLines((rows) =>
                  rows.map((r, i) => (i === index ? { ...r, claimTypeCode: value } : r)),
                );
              }}
              options={types.map((t) => ({ value: t.code, label: t.name }))}
            />
            <DatePicker
              label="Spent on"
              value={line.spentOn}
              onChange={(value) => {
                setLines((rows) => rows.map((r, i) => (i === index ? { ...r, spentOn: value } : r)));
              }}
            />
            <TextField
              label="Bill no."
              value={line.billNo}
              onChange={(e) => {
                setLines((rows) =>
                  rows.map((r, i) => (i === index ? { ...r, billNo: e.target.value } : r)),
                );
              }}
            />
            <TextField
              label="Description"
              value={line.description}
              onChange={(e) => {
                setLines((rows) =>
                  rows.map((r, i) => (i === index ? { ...r, description: e.target.value } : r)),
                );
              }}
            />
            <TextField
              label="Amount"
              inputMode="decimal"
              value={line.amount}
              onChange={(e) => {
                const amount = e.target.value.replace(/[^\d.]/g, '');
                setLines((rows) => rows.map((r, i) => (i === index ? { ...r, amount } : r)));
              }}
            />
          </div>
        ))}

        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setLines((rows) => [
              ...rows,
              { claimTypeCode: 'travel', description: '', spentOn: today, billNo: '', amount: '' },
            ]);
          }}
        >
          Add another line
        </Button>

        {/* §9.7 — the facts of the commitment sit WITH the action, never above it. */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3">
          <div>
            <p className="text-sm text-ink">
              Claiming <span className="tabular-nums">{inr(total)}</span>{' '}
              <span className="text-ink-muted">of {inr(remaining)} left on this budget</span>
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">
              {over
                ? `That is ${inr(total - remaining)} more than the budget has left — it will need a higher approval.`
                : 'Sending commits this amount against the budget straight away.'}
            </p>
          </div>
          <Button disabled={busy || total <= 0} onClick={() => void submit()}>
            Send to approver
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ── My claims ───────────────────────────────────────────────────────────── */

function ClaimList({ rows, onChanged }: { rows: ClaimRow[] | null; onChanged: () => void }) {
  const discard = async (claim: ClaimRow): Promise<void> => {
    try {
      const result = await apiFetch<{ releasedAmount: string }>('/api/claims/my/delete', {
        method: 'POST',
        body: JSON.stringify({ claimId: claim.id }),
      });
      toast.success(
        Number(result.releasedAmount) > 0
          ? `Discarded — ${inr(result.releasedAmount)} returned to the budget`
          : 'Claim discarded',
      );
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not discard the claim');
    }
  };

  return (
    <Card>
      <CardHeader title="Your claims" subtitle="Everything you have sent, and where it has got to." />
      {rows === null ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<Wallet />}
            title="No claims yet"
            description="Once you send one it will appear here with its status, so you never have to ask where it has got to."
          />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm text-ink">
                  <span className="tabular-nums">{inr(c.claimedAmount)}</span>
                  <StatusBadge tone={CLAIM_TONE[c.status] ?? 'neutral'}>
                    {CLAIM_LABEL[c.status] ?? c.status}
                  </StatusBadge>
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {c.reference} · {c.budgetTitle ?? 'no budget'} · {c.lineCount} line
                  {c.lineCount === 1 ? '' : 's'}
                  {c.approvedAmount === null ? '' : ` · approved ${inr(c.approvedAmount)}`}
                </p>
                {c.rejectionReason === null ? null : (
                  <p className="mt-1 text-xs text-negative">{c.rejectionReason}</p>
                )}
              </div>
              {c.status === 'draft' || c.status === 'submitted' || c.status === 'sent_back' ? (
                <Button size="sm" variant="ghost" onClick={() => void discard(c)}>
                  Discard
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
