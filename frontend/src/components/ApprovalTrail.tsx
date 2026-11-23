import { Pill, type Tone } from '@/components/Pill'
import type { client } from '@/lib/orpc'
import { cn, formatDate, formatDateTime } from '@/lib/utils'

// The steps of an approval request (the user, 2026-11-20 - modules/approvals): who was to decide each, in order, and what
// happened - approved / rejected with the comment, skipped with the reason (no manager, no HOD...), decided by the
// fallback approver. Used by the Approvals page and wherever a request's record is shown (a job change).

export type ApprovalRequest = Awaited<ReturnType<typeof client.approvals.get>>
type Step = ApprovalRequest['steps'][number]

const STEP: Record<Step['status'], { label: string; tone: Tone }> = {
  WAITING: { label: 'Not reached', tone: 'neutral' },
  OPEN: { label: 'Waiting', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'positive' },
  REJECTED: { label: 'Rejected', tone: 'negative' },
  SKIPPED: { label: 'Skipped', tone: 'neutral' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  ESCALATED: { label: 'Escalated', tone: 'warning' },
}

const APPROVAL_STATUS: Record<ApprovalRequest['status'], { label: string; tone: Tone }> = {
  PENDING: { label: 'Waiting', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'positive' },
  REJECTED: { label: 'Rejected', tone: 'negative' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  EXPIRED: { label: 'Expired', tone: 'neutral' },
}

// What a late step's time limit does next
const BREACH_THEN: Record<Step['onBreach'], string> = {
  WAIT: 'the approver is reminded',
  ESCALATE: 'escalated',
  AUTO_APPROVE: 'approved automatically',
  EXPIRE: 'the request expires',
  AUTO_REJECT: 'rejected automatically',
}

// Where a request stands, as a pill
export function ApprovalStatusPill({ status }: { status: ApprovalRequest['status'] }) {
  return <Pill tone={APPROVAL_STATUS[status].tone}>{APPROVAL_STATUS[status].label}</Pill>
}

export function ApprovalTrail({ request }: { request: ApprovalRequest }) {
  return (
    <div className="space-y-2">
      {request.held && (
        <p className="rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning-ink">
          Held since {formatDate(request.held.at)} - not approved: {request.held.reason}. Repair the approval routing, then send it through again.
        </p>
      )}
      <ol className="space-y-1.5">
        {request.steps.map((step) => (
          <li key={step.stepNo} className={cn('grid grid-cols-[1.5rem_1fr] gap-2 text-sm', step.status === 'WAITING' && 'opacity-60')}>
            <span className="pt-0.5 text-right text-xs text-muted-foreground tabular-nums">{step.stepNo}.</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{step.who}</span>
                {step.approver && <span className="text-muted-foreground">· {step.approver.name}</span>}
                <Pill tone={STEP[step.status].tone}>{STEP[step.status].label}</Pill>
                {step.late && <Pill tone="negative">Late</Pill>}
                {step.byFallback && <Pill tone="gold">Fallback approver</Pill>}
                {step.seesConfidential && <span className="text-xs text-muted-foreground">sees the figures</span>}
              </div>
              {step.note && <p className="text-xs text-muted-foreground">{step.note}</p>}
              {step.decidedAt && (
                <p className="text-xs text-muted-foreground">
                  {STEP[step.status].label} {step.autoDecided ? 'automatically' : `by ${step.decidedBy?.name ?? 'System'}`}, {formatDateTime(step.decidedAt)}
                  {step.comment && <span className="text-foreground"> - “{step.comment}”</span>}
                </p>
              )}
              {step.status === 'OPEN' && step.openedAt && (
                <p className="text-xs text-muted-foreground">
                  Since {formatDate(step.openedAt)}
                  {step.dueAt && (
                    <span className={cn(step.late && 'text-destructive')}>
                      {' '}
                      · {step.late ? 'was due' : 'due'} {formatDateTime(step.dueAt)}
                      {`, then ${BREACH_THEN[step.onBreach]}${step.onBreach === 'WAIT' ? ` every ${step.slaHours} h` : ''}`}
                    </span>
                  )}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      {request.status === 'EXPIRED' && (
        <p className="text-xs text-muted-foreground">
          Expired{request.closedAt && `, ${formatDateTime(request.closedAt)}`}
          {request.cancelReason && ` - ${request.cancelReason}`}
        </p>
      )}
      {request.status === 'CANCELLED' && (
        <p className="text-xs text-muted-foreground">
          Cancelled by {request.closedBy?.name ?? 'System'}
          {request.closedAt && `, ${formatDate(request.closedAt)}`}
          {request.cancelReason && ` - ${request.cancelReason}`}
        </p>
      )}
    </div>
  )
}
