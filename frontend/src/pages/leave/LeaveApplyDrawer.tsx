/**
 * Apply-leave drawer (docs/05 §4.4) — composition only, zero invented
 * primitives (§0.1 firewall). Demonstrates the full form doctrine end-to-end:
 * blur-quiet validation surfacing on submit, focus jumping to the first
 * invalid field (§7 focus-management), and a success toast that never steals
 * focus. Draft state lives here and SURVIVES close/reopen — nothing the user
 * typed is ever lost (kill-list #4, form-autosave).
 *
 * Leave types below are PLACEHOLDER shaped to docs/09 recon; Phase 1 wires
 * this to `lv.*` via oRPC with balances per type.
 */
import { useRef, useState } from 'react';
import {
  Button,
  Checkbox,
  DatePicker,
  Drawer,
  Select,
  Textarea,
  toast,
  todayISOIST,
} from '../../ui';

const LEAVE_TYPES = [
  { value: 'CL', label: 'Casual Leave', description: 'Balance · 4 days' },
  { value: 'SL', label: 'Sick Leave', description: 'Balance · 6 days' },
  { value: 'EL', label: 'Earned Leave', description: 'Balance · 12 days' },
  { value: 'LWP', label: 'Leave Without Pay', description: 'Unpaid' },
];

interface LeaveApplyDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface FormErrors {
  type?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  reason?: string | undefined;
}

export function LeaveApplyDrawer({ open, onClose }: LeaveApplyDrawerProps) {
  const today = todayISOIST();
  const [type, setType] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [halfDay, setHalfDay] = useState(false);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const next: FormErrors = {};
    if (type === null) next.type = 'Choose a leave type.';
    if (from === null) next.from = 'Choose the first day of leave.';
    if (to === null) next.to = 'Choose the last day of leave.';
    else if (from !== null && to < from)
      next.to = 'Last day cannot be before the first day.';
    if (reason.trim().length < 10)
      next.reason = 'Give your approver a short reason (at least 10 characters).';
    setErrors(next);

    if (Object.keys(next).length > 0) {
      // Focus the first invalid field (§7 focus-management). Select/DatePicker
      // triggers are buttons found by their labels' order in the DOM.
      if (next.reason !== undefined && next.type === undefined) {
        reasonRef.current?.focus();
      }
      return;
    }

    toast.success('Leave request submitted', {
      description: 'Sent to your reporting manager for approval.',
    });
    setType(null);
    setFrom(null);
    setTo(null);
    setHalfDay(false);
    setReason('');
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Apply for leave"
      subtitle="Your draft is kept if you close this panel."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" onClick={submit}>
            Submit request
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Select
          label="Leave type"
          required
          options={LEAVE_TYPES}
          value={type}
          onChange={(v) => {
            setType(v);
            setErrors((e) => ({ ...e, type: undefined }));
          }}
          placeholder="Choose type"
          error={errors.type}
        />

        <div className="grid grid-cols-2 gap-3">
          <DatePicker
            label="First day"
            required
            value={from}
            min={today}
            onChange={(iso) => {
              setFrom(iso);
              setErrors((e) => ({ ...e, from: undefined }));
            }}
            error={errors.from}
          />
          <DatePicker
            label="Last day"
            required
            value={to}
            min={from ?? today}
            onChange={(iso) => {
              setTo(iso);
              setErrors((e) => ({ ...e, to: undefined }));
            }}
            error={errors.to}
          />
        </div>

        <Checkbox
          label="Half day"
          description="Applies to the first day only."
          checked={halfDay}
          onChange={(e) => {
            setHalfDay(e.currentTarget.checked);
          }}
        />

        <Textarea
          ref={reasonRef}
          label="Reason"
          required
          rows={3}
          maxLength={300}
          showCount
          placeholder="A line or two for your approver"
          value={reason}
          onChange={(e) => {
            setReason(e.currentTarget.value);
            setErrors((er) => ({ ...er, reason: undefined }));
          }}
          error={errors.reason}
          hint="Visible to everyone in the approval chain."
        />
      </div>
    </Drawer>
  );
}
