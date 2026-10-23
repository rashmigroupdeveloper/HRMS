import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, DatePicker, Select, TextField, Textarea, toast } from '../../ui';
import { apiFetch } from '../../lib/api';
import { budgetLabel, dayOf, formatPaise, isApprovedBudget, rupeesToPaise, type BudgetItem } from './travel-model';

interface ClaimFormErrors {
  budget?: string;
  category?: string;
  itemDate?: string;
  amount?: string;
  receiptUrl?: string;
  summaryUrl?: string;
}

const CATEGORIES = [
  { value: 'flight', label: 'Travel' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'daily_allowance', label: 'Daily allowance' },
  { value: 'local_travel', label: 'Local travel' },
  { value: 'visa', label: 'Visa' },
  { value: 'food', label: 'Food' },
  { value: 'misc', label: 'Miscellaneous' },
];

/**
 * Claim Expense against an approved budget. A receipt link is required on the
 * line, and a summary link is required before the claim is submitted.
 */
export function ClaimExpensePanel({ budgets, onSaved }: { budgets: BudgetItem[]; onSaved: () => void }) {
  const navigate = useNavigate();
  const approved = budgets.filter(isApprovedBudget);
  const [budgetId, setBudgetId] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>('flight');
  const [itemDate, setItemDate] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [summaryUrl, setSummaryUrl] = useState('');
  const [errors, setErrors] = useState<ClaimFormErrors>({});
  const [saving, setSaving] = useState(false);

  const budget = approved.find((item) => String(item.id) === budgetId) ?? null;

  const submit = async () => {
    const next: ClaimFormErrors = {};
    const amountPaise = rupeesToPaise(amount);
    if (!budget) next.budget = 'Select an approved budget first';
    if (!category) next.category = 'Select an expense type';
    if (!itemDate) next.itemDate = 'Select the bill date';
    if (budget && itemDate && (itemDate < dayOf(budget.startDate) || itemDate > dayOf(budget.endDate))) {
      next.itemDate = 'Bill date must fall within the travel dates';
    }
    if (amountPaise === null || amountPaise < 100) next.amount = 'Enter an amount of at least ₹1.00';
    if (!receiptUrl.trim()) next.receiptUrl = 'A receipt link is required on every line';
    if (!summaryUrl.trim()) next.summaryUrl = 'A summary attachment is required';
    setErrors(next);
    if (Object.values(next).some((value) => value !== undefined) || !budget || !category || !itemDate || amountPaise === null) return;

    setSaving(true);
    try {
      const created = await apiFetch<{ claim: { id: number } }>('/api/travel/claims', {
        method: 'POST',
        body: JSON.stringify({ tripId: budget.id, periodFrom: dayOf(budget.startDate), periodTo: dayOf(budget.endDate) }),
      });
      await apiFetch(`/api/travel/claims/${String(created.claim.id)}/items`, {
        method: 'POST',
        body: JSON.stringify({
          claimId: created.claim.id,
          category,
          itemDate,
          amountPaise,
          description: description.trim() || undefined,
          receiptUrl: receiptUrl.trim(),
        }),
      });
      await apiFetch(`/api/travel/claims/${String(created.claim.id)}/submit`, {
        method: 'POST',
        body: JSON.stringify({ claimId: created.claim.id, summaryDocumentUrl: summaryUrl.trim() }),
      });
      toast.success('Expense claim submitted for approval');
      onSaved();
      void navigate('/travel/claims');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not submit the claim');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {approved.length === 0 ? (
        <p className="text-sm text-ink-muted">Claims are raised against an approved budget. Submit a budget and wait for approval before filing an expense.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            className="sm:col-span-2"
            label="Approved budget"
            required
            value={budgetId}
            onChange={(value) => {
              setBudgetId(value);
              const picked = approved.find((item) => String(item.id) === value);
              if (picked) setItemDate(dayOf(picked.startDate));
            }}
            options={approved.map((item) => ({ value: String(item.id), label: budgetLabel(item) }))}
            error={errors.budget}
            placeholder="Select an approved budget"
          />
          {budget ? (
            <p className="rounded-card bg-surface-2 px-4 py-3 text-sm text-ink-muted sm:col-span-2">
              Approved for this journey <span className="font-mono text-lg font-light text-ink">{formatPaise(budget.approvedBudgetPaise)}</span>
            </p>
          ) : null}
          <Select label="Expense type" required value={category} onChange={setCategory} options={CATEGORIES} error={errors.category} />
          <DatePicker
            label="Bill date"
            required
            value={itemDate}
            onChange={setItemDate}
            min={budget ? dayOf(budget.startDate) : undefined}
            max={budget ? dayOf(budget.endDate) : undefined}
            error={errors.itemDate}
            disabled={!budget}
          />
          <TextField label="Amount (₹)" required inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); }} error={errors.amount} />
          <TextField label="Receipt link" required value={receiptUrl} onChange={(e) => { setReceiptUrl(e.target.value); }} error={errors.receiptUrl} hint="Every line needs a receipt" />
          <Textarea className="sm:col-span-2" label="Description" value={description} onChange={(e) => { setDescription(e.target.value); }} />
          <TextField className="sm:col-span-2" label="Summary attachment" required value={summaryUrl} onChange={(e) => { setSummaryUrl(e.target.value); }} error={errors.summaryUrl} hint="A summary file is required before submit" />
          <div className="sm:col-span-2">
            <Button variant="primary" loading={saving} onClick={() => { void submit(); }}>Submit claim</Button>
          </div>
        </div>
      )}
    </div>
  );
}
