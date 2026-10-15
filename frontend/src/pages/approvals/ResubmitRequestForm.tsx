import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { notifyWorkflowChanged } from '../../lib/workflow-events';
import { Button, Checkbox, DatePicker, Textarea, TextField, toast } from '../../ui';

export function ResubmitRequestForm({ requestId, type, payload: raw, onSubmitted }: {
  requestId: number; type: string; payload: unknown; onSubmitted: () => void;
}) {
  const payload = raw !== null && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown> : {};
  const [fromDate, setFromDate] = useState<string | null>(typeof payload['fromDate'] === 'string' ? payload['fromDate'] : null);
  const [toDate, setToDate] = useState<string | null>(typeof payload['toDate'] === 'string' ? payload['toDate'] : null);
  const [reason, setReason] = useState(typeof payload['reason'] === 'string' ? payload['reason'] : '');
  const [fromTime, setFromTime] = useState(typeof payload['fromTime'] === 'string' ? payload['fromTime'] : '');
  const [toTime, setToTime] = useState(typeof payload['toTime'] === 'string' ? payload['toTime'] : '');
  const [fromHalf, setFromHalf] = useState(payload['fromHalf'] === true);
  const [toHalf, setToHalf] = useState(payload['toHalf'] === true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leave = type === 'leave' || type === 'comp_off';
  const permission = payload['kind'] === 'PERMISSION';
  const submit = async () => {
    if (!fromDate || !toDate || fromDate > toDate || (!leave && reason.trim().length < 5)) {
      setError('Choose a valid date range and add a specific reason.'); return;
    }
    setSaving(true); setError(null);
    try {
      await apiFetch(`/api/workflows/requests/${String(requestId)}/resubmit`, {
        method: 'POST', body: JSON.stringify({ payload: { ...payload, fromDate, toDate, reason: reason.trim(),
          ...(leave ? { fromHalf, toHalf } : { fromTime: fromTime || null, toTime: toTime || null }),
        } }),
      });
      toast.success('Request resubmitted', { description: 'Your corrected details are back in the approval chain.' });
      notifyWorkflowChanged();
      onSubmitted();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not resubmit. Try again.'); }
    finally { setSaving(false); }
  };
  return <form className="mt-6 space-y-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
    <h2 className="text-lg font-semibold text-ink">Correct and resubmit</h2>
    <p className="text-sm text-ink-muted">Review the decision note above. Dates, eligibility and balance are checked again when you submit.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <DatePicker label="Revised from" required value={fromDate} onChange={setFromDate} />
      <DatePicker label="Revised to" required value={toDate} min={fromDate ?? undefined} onChange={setToDate} />
    </div>
    {permission && <div className="grid gap-3 sm:grid-cols-2">
      <TextField label="Permission from" type="time" required value={fromTime} onChange={event => { setFromTime(event.currentTarget.value); }} />
      <TextField label="Permission to" type="time" required value={toTime} onChange={event => { setToTime(event.currentTarget.value); }} />
    </div>}
    {leave && <div className="flex flex-wrap gap-4">
      <Checkbox label="Half day on first date" checked={fromHalf} onChange={event => { setFromHalf(event.currentTarget.checked); }} />
      <Checkbox label="Half day on last date" checked={toHalf} onChange={event => { setToHalf(event.currentTarget.checked); }} />
    </div>}
    <Textarea label="Revised reason" value={reason} required={!leave} error={error ?? undefined}
      onChange={event => { setReason(event.currentTarget.value); }} />
    <Button type="submit" loading={saving}>Resubmit for approval</Button>
  </form>;
}
