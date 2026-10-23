import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Select, TextField, Textarea, toast } from '../../ui';
import { apiFetch } from '../../lib/api';
import { budgetLabel, formatPaise, isApprovedBudget, rupeesToPaise, type BudgetItem } from './travel-model';

interface AdvanceFormErrors {
  budget?: string;
  amount?: string;
  purpose?: string;
}
export function AdvancePanel({ budgets, onSaved }: { budgets: BudgetItem[]; onSaved: () => void }) {
  const navigate = useNavigate();
  const approved = budgets.filter(isApprovedBudget);
  const [budgetId, setBudgetId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [errors, setErrors] = useState<AdvanceFormErrors>({});
  const [saving, setSaving] = useState(false);
  const budget = approved.find((item) => String(item.id) === budgetId) ?? null;
  const amountPaise = rupeesToPaise(amount);

  const submit = async () => {
    const next: AdvanceFormErrors = {};
    if (!budget) next.budget = 'Select an approved budget first';
    if (amountPaise === null || amountPaise < 100) next.amount = 'Enter an amount of at least ₹1.00';
    if (purpose.trim().length < 5) next.purpose = 'Explain why you need this advance (at least 5 characters)';
    setErrors(next);
    if (Object.values(next).some((value) => value !== undefined) || !budget || amountPaise === null) return;
    setSaving(true);
    try {
      await apiFetch('/api/travel/advances', {
        method: 'POST',
        body: JSON.stringify({ tripId: budget.id, amountPaise, purpose: purpose.trim() }),
      });
      toast.success('Advance submitted for approval');
      onSaved();
      void navigate('/travel/advances');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not submit the advance');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {approved.length === 0 ? (
        <p className="text-sm text-ink-muted">An advance is requested against an approved travel budget.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            className="sm:col-span-2"
            label="Approved budget"
            required
            value={budgetId}
            onChange={setBudgetId}
            options={approved.map((item) => ({ value: String(item.id), label: budgetLabel(item), description: formatPaise(item.approvedBudgetPaise) }))}
            error={errors.budget}
            placeholder="Select an approved budget"
          />
          <TextField label="Advance amount (₹)" required inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); }} error={errors.amount} />
          <p className="flex items-end font-mono text-3xl font-light tabular-nums text-ink">{amountPaise !== null ? formatPaise(amountPaise) : '—'}</p>
          <Textarea className="sm:col-span-2" label="Advance reason" required value={purpose} onChange={(e) => { setPurpose(e.target.value); }} error={errors.purpose} hint="Why you need this advance before the trip" />
          <div>
            <Button variant="primary" loading={saving} onClick={() => { void submit(); }}>Submit advance</Button>
          </div>
        </div>
      )}
    </div>
  );
}
