import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { Button, Checkbox, DatePicker, Drawer, Select, Textarea, toast } from '../../ui';

export interface LeaveTypeOption {
  code: string;
  name: string;
  available: number;
  allowHalfDay: boolean;
  maxPerRequest: number | null;
}

export function LeaveApplyDrawer({
  open,
  leaveTypes,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  leaveTypes: LeaveTypeOption[];
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [typeCode, setTypeCode] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [halfDay, setHalfDay] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = leaveTypes.find((type) => type.code === typeCode);

  const submit = async () => {
    if (!typeCode || !from || !to || reason.trim().length < 3) {
      setError('Choose a leave type and dates, then add a short reason.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiFetch('/api/leave/applications', {
        method: 'POST',
        body: JSON.stringify({
          leaveType: typeCode,
          fromDate: from,
          toDate: to,
          fromHalf: halfDay,
          toHalf: false,
          reason: reason.trim(),
        }),
      });
      toast.success('Leave request submitted', {
        description: 'Your reporting manager has been notified.',
      });
      setTypeCode(null);
      setFrom(null);
      setTo(null);
      setHalfDay(false);
      setReason('');
      onSubmitted();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit leave.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Apply for leave"
      subtitle="Your inputs remain in place if you close this drawer."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Keep draft
          </Button>
          <Button variant="primary" loading={loading} onClick={() => void submit()}>
            Submit request
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Select
          label="Leave type"
          required
          value={typeCode}
          onChange={setTypeCode}
          options={leaveTypes.map((type) => ({
            value: type.code,
            label: type.name,
            description: `${type.available.toLocaleString('en-IN')} days available`,
          }))}
          placeholder="Choose leave type"
        />
        <div className="grid grid-cols-2 gap-3">
          <DatePicker label="First day" required value={from} onChange={setFrom} />
          <DatePicker
            label="Last day"
            required
            value={to}
            min={from ?? undefined}
            onChange={setTo}
          />
        </div>
        {selected?.allowHalfDay && (
          <Checkbox
            label="First day is a half day"
            description="The final debit is calculated by the leave policy."
            checked={halfDay}
            onChange={(event) => { setHalfDay(event.currentTarget.checked); }}
          />
        )}
        {selected?.maxPerRequest !== null && selected?.maxPerRequest !== undefined && (
          <p className="rounded-row bg-accent-soft px-4 py-3 text-sm text-ink">
            Maximum per request: {selected.maxPerRequest.toLocaleString('en-IN')} days
          </p>
        )}
        <Textarea
          label="Reason"
          required
          rows={4}
          value={reason}
          onChange={(event) => { setReason(event.currentTarget.value); }}
          hint="Visible to everyone in the approval chain."
          error={error ?? undefined}
        />
      </div>
    </Drawer>
  );
}
