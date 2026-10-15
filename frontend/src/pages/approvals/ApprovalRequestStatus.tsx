import { Button, Card, StatusBadge, Timeline } from '../../ui';
import type { TimelineState } from '../../ui';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { useDashboardResource } from '../home/useDashboardResource';
import { formatTimestamp } from '../home/dashboard-format';
import { summarizeRequest } from './request-summary';
import { ResubmitRequestForm } from './ResubmitRequestForm';

interface RequestDetail {
  status: string;
  type: string;
  payload: unknown;
  canResubmit: boolean;
  steps: {
    stepNo: number; action: string | null; comment: string | null;
    notifiedAt: string; actedAt: string | null;
  }[];
}

function stepState(action: string | null): TimelineState {
  if (action === null) return 'current';
  if (action === 'rejected' || action === 'sent_back') return 'rejected';
  return 'done';
}

/** An exact notification target is never replaced with an actionable neighbour. */
export function ApprovalRequestStatus({ requestId, onBack }: { requestId: number; onBack: () => void }) {
  const detail = useDashboardResource<RequestDetail>(`/api/workflows/requests/${String(requestId)}`);
  if (detail.loading) return <DashboardSkeleton />;
  if (detail.error) return <div className="space-y-4">
    <DashboardError message={detail.error} onRetry={detail.reload} />
    <Button variant="secondary" onClick={onBack}>Back to inbox</Button>
  </div>;
  if (!detail.data) return null;
  const request = detail.data;
  const summary = summarizeRequest(request.type, request.payload);
  return <Card>
    <h1 className="text-3xl font-light text-ink">Request {requestId}</h1>
    <p className="my-3 text-sm text-ink-muted">This request is not awaiting your decision.</p>
    <StatusBadge tone={request.status === 'approved' ? 'positive' : request.status === 'rejected' ? 'negative' : 'warning'}>
      {request.status.replaceAll('_', ' ')}
    </StatusBadge>
    <dl className="my-5 grid gap-3 sm:grid-cols-2">
      {summary.rows.map(row => <div key={row.label}>
        <dt className="text-xs text-ink-muted">{row.label}</dt>
        <dd className="mt-1 text-sm font-medium text-ink">{row.value}</dd>
      </div>)}
    </dl>
    <Timeline steps={request.steps.map((step, index) => ({
      id: String(index), title: `Step ${String(step.stepNo)} · ${step.action?.replaceAll('_', ' ') ?? 'awaiting decision'}`,
      state: stepState(step.action), timestamp: formatTimestamp(step.actedAt ?? step.notifiedAt),
      description: step.comment ?? (step.action === null ? 'Notification queued for the assigned approver.' : undefined),
    }))} />
    {request.canResubmit && ['regularization', 'od', 'leave', 'comp_off'].includes(request.type)
      && <ResubmitRequestForm key={requestId} requestId={requestId} type={request.type} payload={request.payload} onSubmitted={detail.reload} />}
    <Button className="mt-5" variant="secondary" onClick={onBack}>Back to inbox</Button>
  </Card>;
}
