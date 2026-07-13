import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { Button, DatePicker, Drawer, Select, Textarea, toast } from '../../ui';

export function AttendanceRequestDrawer({
  open,
  initialDate,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  initialDate: string | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [kind, setKind] = useState('AR');
  const [fromDate, setFromDate] = useState<string | null>(initialDate);
  const [toDate, setToDate] = useState<string | null>(initialDate);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!fromDate || !toDate || reason.trim().length < 5) {
      setError('Choose the date range and enter a meaningful reason.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiFetch('/api/attendance/requests', {
        method: 'POST',
        body: JSON.stringify({ kind, fromDate, toDate, reason: reason.trim() }),
      });
      toast.success(`${kind} request submitted`, {
        description: 'Your reporting manager has been notified.',
      });
      setReason('');
      onSubmitted();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit the request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Attendance request"
      subtitle="Regularise a day, record official duty or request short permission."
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
          label="Request type"
          value={kind}
          onChange={setKind}
          options={[
            {
              value: 'AR',
              label: 'Attendance regularisation',
              description: 'Correct a past attendance record',
            },
            { value: 'OD', label: 'Official duty', description: 'Past or future company duty' },
            {
              value: 'PERMISSION',
              label: 'Short permission',
              description: 'A short approved absence',
            },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <DatePicker label="From" required value={fromDate} onChange={setFromDate} />
          <DatePicker
            label="To"
            required
            value={toDate}
            min={fromDate ?? undefined}
            onChange={setToDate}
          />
        </div>
        <Textarea
          label="Reason"
          required
          rows={4}
          value={reason}
          onChange={(event) => { setReason(event.currentTarget.value); }}
          hint="Visible to every approver in the chain."
          error={error ?? undefined}
        />
      </div>
    </Drawer>
  );
}
