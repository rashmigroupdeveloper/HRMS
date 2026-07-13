import { useState } from 'react';
import { CheckCircle2, LockKeyhole, ShieldAlert, XCircle } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import {
  Button,
  Card,
  CardHeader,
  ConfirmModal,
  DarkCard,
  EmptyState,
  StatusBadge,
  TextField,
  toast,
} from '../../ui';
import { currentMonthIST } from '../home/dashboard-format';

interface Checklist {
  companyId: number;
  month: string;
  canLock: boolean;
  alreadyLocked: boolean;
  items: { code: string; label: string; ok: boolean; detail: string }[];
}

export function MonthLockPage() {
  const [companyId, setCompanyId] = useState('');
  const [month, setMonth] = useState(() => currentMonthIST());
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!/^\d+$/.test(companyId)) {
      setError('Enter a valid company ID.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setChecklist(
        await apiFetch<Checklist>(
          `/api/attendance/month-lock/checklist?companyId=${companyId}&month=${month}`,
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Checklist unavailable.');
    } finally {
      setLoading(false);
    }
  };
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

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-muted">ATT-15 · irreversible control</p>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight text-ink">Month lock</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Verify every attendance dependency before freezing the month.
        </p>
      </header>
      <DarkCard>
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <TextField
            label="Company ID"
            value={companyId}
            onChange={(event) => {
              setCompanyId(event.currentTarget.value);
            }}
            placeholder="e.g. 1"
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
          <Button variant="primary" loading={loading} onClick={() => void load()}>
            Run checklist
          </Button>
        </div>
      </DarkCard>
      {checklist ? (
        <Card>
          <CardHeader
            title={`${checklist.month} pre-lock checklist`}
            subtitle={`Company ${String(checklist.companyId)}`}
            action={
              <StatusBadge tone={checklist.canLock ? 'positive' : 'negative'}>
                {checklist.alreadyLocked
                  ? 'Already locked'
                  : checklist.canLock
                    ? 'Ready to lock'
                    : 'Blocked'}
              </StatusBadge>
            }
          />
          <div className="space-y-2">
            {checklist.items.map((item) => (
              <div key={item.code} className="flex items-start gap-3 rounded-row bg-surface-2 p-4">
                {item.ok ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-positive" />
                ) : (
                  <XCircle className="mt-0.5 size-5 shrink-0 text-negative" />
                )}
                <div>
                  <p className="text-sm font-semibold text-ink">{item.label}</p>
                  <p className="mt-0.5 text-xs leading-5 text-ink-muted">{item.detail}</p>
                </div>
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
            description="No lock action is available until completeness, approvals and finalisation gates are proven."
          />
        </Card>
      )}
      <ConfirmModal
        open={confirming}
        onClose={() => {
          setConfirming(false);
        }}
        title="Lock attendance month"
        description={`This freezes attendance for ${month}. Closed records cannot be edited.`}
        confirmLabel="Lock month"
        typedConfirmation={`LOCK ${month}`}
        onConfirm={() => void lock()}
        danger
      />
    </div>
  );
}
