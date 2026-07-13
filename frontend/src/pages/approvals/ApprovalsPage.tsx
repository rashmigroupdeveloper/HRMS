import { useState } from 'react';
import { Check, CheckCircle2, Clock3, RotateCcw, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import {
  Button,
  Card,
  CardHeader,
  DarkCard,
  EmptyState,
  Pill,
  StatusBadge,
  Textarea,
  toast,
} from '../../ui';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { useDashboardResource } from '../home/useDashboardResource';

interface InboxItem {
  requestId: number;
  type: string;
  typeName: string;
  subject: { ecode: string; name: string };
  payload: unknown;
  stepNo: number;
  notifiedAt: string;
  slaDueAt: string;
  delegated: boolean;
}

function timeRemaining(iso: string): { label: string; overdue: boolean } {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (minutes < 0)
    return {
      label: `${String(Math.abs(Math.round(minutes / 60)))}h overdue`,
      overdue: true,
    };
  if (minutes < 60) return { label: `${String(minutes)}m left`, overdue: false };
  return { label: `${String(Math.round(minutes / 60))}h left`, overdue: false };
}

export function ApprovalsPage() {
  const inbox = useDashboardResource<InboxItem[]>('/api/workflows/inbox');
  const [comment, setComment] = useState('');
  const [acting, setActing] = useState<number | null>(null);
  const item = inbox.data?.[0];

  const act = async (action: 'approve' | 'reject' | 'send_back') => {
    if (!item) return;
    setActing(item.requestId);
    try {
      await apiFetch(`/api/workflows/requests/${String(item.requestId)}/act`, {
        method: 'POST',
        body: JSON.stringify({
          requestId: item.requestId,
          action,
          comment: comment.trim() || undefined,
        }),
      });
      toast.success(
        action === 'approve'
          ? 'Request approved'
          : action === 'reject'
            ? 'Request rejected'
            : 'Request sent back',
      );
      setComment('');
      inbox.reload();
    } catch (cause) {
      toast.error('Decision could not be saved', {
        description: cause instanceof Error ? cause.message : 'Try again.',
      });
    } finally {
      setActing(null);
    }
  };

  if (inbox.loading) return <DashboardSkeleton />;
  if (inbox.error) return <DashboardError message={inbox.error} onRetry={inbox.reload} />;
  const overdue = inbox.data?.filter((row) => timeRemaining(row.slaDueAt).overdue).length ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-muted">Manager workspace</p>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight text-ink">
          Approvals inbox
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          SLA-sorted requests waiting specifically for your decision.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-ink-muted">Waiting</p>
          <p className="mt-2 text-3xl font-light tabular-nums">{inbox.data?.length ?? 0}</p>
        </Card>
        <Card>
          <p className="text-xs text-ink-muted">Overdue</p>
          <p className="mt-2 text-3xl font-light tabular-nums">{overdue}</p>
        </Card>
        <Card>
          <p className="text-xs text-ink-muted">Order</p>
          <p className="mt-2 text-sm font-semibold text-ink">Nearest SLA first</p>
        </Card>
      </div>

      {!item ? (
        <Card>
          <EmptyState
            icon={<CheckCircle2 />}
            title="All caught up"
            description="There are no requests waiting on your approval."
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <Card padded={false}>
            <div className="p-5">
              <CardHeader title="Queue" subtitle={`${String(inbox.data?.length ?? 0)} requests`} />
            </div>
            <div className="max-h-[560px] overflow-auto">
              {inbox.data?.map((row, index) => {
                const sla = timeRemaining(row.slaDueAt);
                return (
                  <div
                    key={row.requestId}
                    className={`border-t border-line/60 px-5 py-4 ${index === 0 ? 'bg-accent' : 'hover:bg-accent-soft'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{row.subject.name}</p>
                        <p className="text-xs text-ink-muted">
                          {row.subject.ecode} · {row.typeName}
                        </p>
                      </div>
                      <StatusBadge tone={sla.overdue ? 'negative' : 'warning'}>
                        {sla.label}
                      </StatusBadge>
                    </div>
                    {row.delegated && <Pill>Delegated</Pill>}
                  </div>
                );
              })}
            </div>
          </Card>
          <DarkCard>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hero-muted">
                  Decision {item.requestId}
                </p>
                <h2 className="mt-3 text-3xl font-light">{item.typeName}</h2>
                <p className="mt-1 text-sm text-hero-muted">
                  {item.subject.name} · {item.subject.ecode}
                </p>
              </div>
              <StatusBadge tone={timeRemaining(item.slaDueAt).overdue ? 'negative' : 'warning'}>
                {timeRemaining(item.slaDueAt).label}
              </StatusBadge>
            </div>
            <pre className="mt-6 max-h-48 overflow-auto whitespace-pre-wrap rounded-tile bg-[color-mix(in_srgb,var(--surface)_9%,transparent)] p-4 text-xs leading-5 text-hero-ink">
              {JSON.stringify(item.payload, null, 2)}
            </pre>
            <div className="mt-5">
              <Textarea
                label="Decision note"
                rows={3}
                value={comment}
                onChange={(event) => { setComment(event.currentTarget.value); }}
                hint="Required by policy for rejection; useful for every decision."
              />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                variant="primary"
                leadingIcon={<Check className="size-4" />}
                loading={acting === item.requestId}
                onClick={() => void act('approve')}
              >
                Approve
              </Button>
              <Button
                variant="secondary"
                leadingIcon={<RotateCcw className="size-4" />}
                disabled={acting !== null}
                onClick={() => void act('send_back')}
              >
                Send back
              </Button>
              <Button
                variant="danger"
                leadingIcon={<X className="size-4" />}
                disabled={acting !== null}
                onClick={() => void act('reject')}
              >
                Reject
              </Button>
            </div>
            <p className="mt-5 flex items-center gap-2 text-xs text-hero-muted">
              <Clock3 className="size-3.5" /> Notified{' '}
              {new Date(item.notifiedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
            </p>
          </DarkCard>
        </div>
      )}
    </div>
  );
}
