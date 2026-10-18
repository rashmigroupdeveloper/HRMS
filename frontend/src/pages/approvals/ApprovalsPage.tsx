import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import { Check, CheckCircle2, Clock3, RotateCcw, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { notifyWorkflowChanged } from '../../lib/workflow-events';
import {
  Button,
  Card,
  CardHeader,
  Checkbox,
  ConfirmModal,
  DarkCard,
  EmptyState,
  Pill,
  StatusBadge,
  Textarea,
  toast,
} from '../../ui';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { useDashboardResource } from '../home/useDashboardResource';
import { payloadAsJson, summarizeRequest } from './request-summary';
import { ApprovalRequestStatus } from './ApprovalRequestStatus';

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
  const navigate = useNavigate();
  const { id } = useParams();
  const inbox = useDashboardResource<InboxItem[]>('/api/workflows/inbox');
  const [comment, setComment] = useState('');
  const [noteError, setNoteError] = useState<string | undefined>(undefined);
  const [acting, setActing] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const routeRequestId = id === undefined ? undefined : Number(id);
  const item = id === undefined ? inbox.data?.[0] : inbox.data?.find((row) => row.requestId === routeRequestId);
  const summary = item === undefined ? null : summarizeRequest(item.type, item.payload);

  useEffect(() => {
    setComment('');
    setNoteError(undefined);
  }, [item?.requestId]);

  const act = useCallback(async (action: 'approve' | 'reject' | 'send_back') => {
    if (!item || acting !== null) return;
    if (action !== 'approve' && comment.trim() === '') {
      setNoteError('Add a reason — required when rejecting or sending back.');
      toast.error('Add a decision note', {
        description: 'A reason is required when rejecting or sending a request back.',
      });
      return;
    }
    setActing(item.requestId);
    try {
      const result = await apiFetch<{ outcome: 'advanced' | 'approved' | 'rejected' | 'sent_back' }>(`/api/workflows/requests/${String(item.requestId)}/act`, {
        method: 'POST',
        body: JSON.stringify({
          requestId: item.requestId,
          action,
          comment: comment.trim() || undefined,
        }),
      });
      if (result.outcome === 'advanced') {
        toast.success('Approval recorded', { description: 'Waiting for the next approver.' });
      } else toast.success(
        result.outcome === 'approved'
          ? 'Request approved'
          : action === 'reject'
            ? 'Request rejected'
            : 'Request sent back',
      );
      setComment('');
      setNoteError(undefined);
      notifyWorkflowChanged();
      inbox.reload();
      void navigate('/approvals', { replace: true });
    } catch (cause) {
      toast.error('Decision could not be saved', {
        description: cause instanceof Error ? cause.message : 'Try again.',
      });
    } finally {
      setActing(null);
    }
  }, [acting, comment, inbox, item, navigate]);

  const batchApprove = async () => {
    if (selectedIds.size === 0) return;
    setBatchOpen(false);
    setActing(-1);
    try {
      const ids = [...selectedIds].filter(requestId => inbox.data?.some(row => row.requestId === requestId));
      const results = await Promise.allSettled(ids.map(async requestId =>
        apiFetch<{ outcome: 'advanced' | 'approved' }>(`/api/workflows/requests/${String(requestId)}/act`, {
          method: 'POST', body: JSON.stringify({ requestId, action: 'approve' }),
        }),
      ));
      const failed = new Set<number>();
      let final = 0;
      let advanced = 0;
      results.forEach((result, index) => {
        const requestId = ids[index];
        if (result.status === 'rejected') { if (requestId !== undefined) failed.add(requestId); }
        else if (result.value.outcome === 'approved') final++;
        else advanced++;
      });
      if (final + advanced > 0) toast.success(`${String(final + advanced)} decisions recorded`, {
        description: `${String(final)} approved; ${String(advanced)} waiting for the next approver.`,
      });
      if (failed.size > 0) toast.error(`${String(failed.size)} decisions could not be saved`, {
        description: 'Successful decisions are saved. Only failed requests remain selected for retry.',
      });
      setSelectedIds(failed);
      if (final + advanced > 0) notifyWorkflowChanged();
      inbox.reload();
      void navigate('/approvals', { replace: true });
    } catch (cause) {
      toast.error('Batch approval stopped', {
        description: cause instanceof Error ? cause.message : 'Completed decisions were saved; review the remaining queue.',
      });
      inbox.reload();
    } finally {
      setActing(null);
    }
  };

  const handleShortcut = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
    if (event.metaKey || event.ctrlKey || event.altKey || acting !== null) return;
    if (event.key.toLowerCase() === 'a') {
      event.preventDefault();
      void act('approve');
    }
    if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      void act('reject');
    }
  });

  useEffect(() => {
    window.addEventListener('keydown', handleShortcut);
    return () => { window.removeEventListener('keydown', handleShortcut); };
  }, []);

  if (inbox.loading) return <DashboardSkeleton />;
  if (inbox.error) return <DashboardError message={inbox.error} onRetry={inbox.reload} />;
  if (id !== undefined && !item) {
    if (!Number.isSafeInteger(routeRequestId) || (routeRequestId ?? 0) <= 0) {
      return <Card><EmptyState title="Invalid request link" description="Open a request from your approvals inbox."
        action={<Button onClick={() => { void navigate('/approvals'); }}>Back to inbox</Button>} /></Card>;
    }
    return <ApprovalRequestStatus key={id} requestId={Number(id)} onBack={() => { void navigate('/approvals'); }} />;
  }
  const overdue = inbox.data?.filter((row) => timeRemaining(row.slaDueAt).overdue).length ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-muted">Manager workspace</p>
        <h1 className="mt-1 text-4xl font-light tracking-tight text-ink">
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

      {!item || summary === null ? (
        <Card>
          <EmptyState
            icon={<CheckCircle2 />}
            title="All caught up"
            description="There are no requests waiting on your approval."
          />
        </Card>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <Card padded={false}>
            <div className="p-5">
              <CardHeader title="Queue" subtitle={`${String(inbox.data?.length ?? 0)} requests`} />
              {selectedIds.size > 0 && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-tile bg-accent-soft p-3">
                  <span className="text-xs font-semibold text-ink">{selectedIds.size} selected</span>
                  <Button size="sm" loading={acting === -1} onClick={() => { setBatchOpen(true); }}>
                    Batch approve
                  </Button>
                </div>
              )}
            </div>
            <div className="max-h-[560px] overflow-auto">
              {inbox.data?.map((row) => {
                const sla = timeRemaining(row.slaDueAt);
                const preview = summarizeRequest(row.type, row.payload).preview;
                const selected = row.requestId === item.requestId;
                return (
                  <div
                    key={row.requestId}
                    className={`flex items-start gap-3 border-t border-line/60 px-5 py-4 ${
                      selected
                        ? 'bg-accent text-accent-ink'
                        : 'hover:bg-accent-soft'
                    }`}
                  >
                    <Checkbox
                      label={`Select ${row.subject.name}`}
                      className="[&>span:last-child]:sr-only"
                      checked={selectedIds.has(row.requestId)}
                      disabled={acting !== null}
                      onChange={(event) => {
                        const checked = event.currentTarget.checked;
                        setSelectedIds((current) => {
                          const next = new Set(current);
                          if (checked) next.add(row.requestId);
                          else next.delete(row.requestId);
                          return next;
                        });
                      }}
                    />
                    <button
                      type="button"
                      className="min-w-0 flex-1 rounded-control text-left outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      aria-current={selected ? 'true' : undefined}
                      onClick={() => { void navigate(`/approvals/${String(row.requestId)}`); }}
                    >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-sm font-semibold ${selected ? 'text-accent-ink' : 'text-ink'}`}>{row.subject.name}</p>
                        <p className={`text-xs ${selected ? 'text-accent-ink/80' : 'text-ink-muted'}`}>
                          {row.subject.ecode} · {row.typeName}
                        </p>
                        {preview !== '' && (
                          <p className={`mt-1 text-xs ${selected ? 'text-accent-ink' : 'text-ink'}`}>{preview}</p>
                        )}
                      </div>
                      <StatusBadge tone={sla.overdue ? 'negative' : 'warning'}>
                        {sla.label}
                      </StatusBadge>
                    </div>
                    {row.delegated && <Pill>Delegated</Pill>}
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
          <div className="space-y-4 lg:sticky lg:top-24">
            <DarkCard>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-hero-muted">
                    {item.subject.ecode}
                  </p>
                  <h2 className="mt-3 text-3xl font-light">{item.typeName}</h2>
                  <p className="mt-1 text-sm text-hero-muted">{item.subject.name}</p>
                </div>
                <StatusBadge tone={timeRemaining(item.slaDueAt).overdue ? 'negative' : 'warning'}>
                  {timeRemaining(item.slaDueAt).label}
                </StatusBadge>
              </div>
              {summary.rows.length === 0 ? (
                <p className="mt-6 text-sm text-hero-muted">No extra details on this request.</p>
              ) : (
                <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                  {summary.rows.map((row) => (
                    <div
                      key={`${row.label}:${row.value}`}
                      className="rounded-tile bg-[color-mix(in_srgb,var(--surface)_9%,transparent)] p-4"
                    >
                      <dt className="text-xs text-hero-muted">{row.label}</dt>
                      <dd className="mt-1 text-sm font-semibold text-hero-ink">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className="mt-6 text-sm leading-6 text-hero-muted">{summary.consequence}</p>
              <p className="mt-4 flex items-center gap-2 text-xs text-hero-muted">
                <Clock3 className="size-3.5" aria-hidden />
                Notified {new Date(item.notifiedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </p>
              <details className="mt-4 text-xs text-hero-muted">
                <summary className="cursor-pointer font-medium text-hero-ink">Technical payload</summary>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-tile bg-[color-mix(in_srgb,var(--surface)_9%,transparent)] p-3 leading-5 text-hero-ink">
                  {payloadAsJson(item.payload)}
                </pre>
              </details>
            </DarkCard>
            <Card>
              <Textarea
                label="Decision note"
                rows={3}
                value={comment}
                error={noteError}
                onChange={(event) => {
                  setComment(event.currentTarget.value);
                  if (noteError !== undefined) setNoteError(undefined);
                }}
                hint="Required when you reject or send back. Optional on approve."
              />
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
              <p className="mt-3 text-xs text-ink-muted">Keyboard: A approve · R reject</p>
            </Card>
          </div>
        </div>
      )}
      <ConfirmModal
        open={batchOpen}
        onClose={() => { setBatchOpen(false); }}
        onConfirm={() => { void batchApprove(); }}
        title={`Approve ${String(selectedIds.size)} requests?`}
        description="Each selected request will be granted as submitted. This cannot be undone from the inbox."
        confirmLabel="Approve selected"
      />
    </div>
  );
}
