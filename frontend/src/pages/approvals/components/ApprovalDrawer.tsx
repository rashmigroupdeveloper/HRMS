import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Check, RotateCcw, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { ApprovalStatusPill, ApprovalTrail } from '@/components/ApprovalTrail'
import { FormDrawer } from '@/components/FormDrawer'
import { FormError } from '@/components/FormError'
import { ApprovalDrawerSkeleton } from '@/components/skeletons/approvals/ApprovalDrawerSkeleton'
import { JobChangeDetails } from '@/components/JobChangeDetails'
import { TeamOffNote } from '@/components/TeamOffNote'
import { ReasonDialog } from '@/components/ReasonDialog'
import { Button } from '@/components/ui/button'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { errorMessage, formatDate } from '@/lib/utils'
import { refreshAfterDecision } from './request-kinds'

// One approval request in a side panel (the user, 2026-11-20): what it is about (the feature's own detail - a job change
// with the salary if this step may see it), its steps, and - for whoever may - Approve / Reject (a reason needed),
// Cancel (the requester, or HR for the employee), Send through again (a held request, after its routing was repaired).
export function ApprovalDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const queryClient = useQueryClient()
  const request = useQuery(orpc.approvals.get.queryOptions({ input: { id } }))
  const r = request.data
  const { me, can } = useAccess()
  // the employee's profile - only for whoever may open it (the backend's `link` is the requester's own page for leave and
  // attendance, and a profile without Employees View bounced to the home page)
  const profile = !r ? null : me?.employeeCode === r.employee.employeeCode ? '/me' : can('EMPLOYEES') ? `/employees/${r.employee.employeeCode}` : null
  // after a decision the request loads again: no second click on what it showed before (it would be refused)
  const settling = request.isFetching
  const jobChange = useQuery({ ...orpc.jobChanges.get.queryOptions({ input: { approvalRequestId: id } }), enabled: r?.feature === 'JOB_CHANGE' })
  // a leave: its reason and the employee's balance of its type now (2026-11-22)
  const leave = useQuery({ ...orpc.leave.applications.forApproval.queryOptions({ input: { approvalRequestId: id } }), enabled: r?.feature === 'LEAVE' })
  const [asking, setAsking] = useState<'reject' | 'cancel' | null>(null)
  const refresh = () => {
    refreshAfterDecision(queryClient)
    setAsking(null)
  }
  const decide = useMutation(orpc.approvals.decide.mutationOptions({ onSuccess: refresh }))
  const cancel = useMutation(orpc.approvals.cancel.mutationOptions({ onSuccess: refresh }))
  const retry = useMutation(orpc.approvals.retryRouting.mutationOptions({ onSuccess: refresh }))
  const error = decide.error ?? cancel.error ?? retry.error

  return (
    <FormDrawer
      onClose={onClose}
      width={600}
      title={r ? `${r.label} · ${r.employee.name}` : 'Approval'}
      description={
        r && (
          <span className="flex flex-wrap items-center gap-2">
            {profile ? (
              <Link to={profile} className="underline-offset-4 hover:underline">
                {r.employee.employeeCode}
              </Link>
            ) : (
              <span>{r.employee.employeeCode}</span>
            )}
            <ApprovalStatusPill status={r.status} />
            <span>
              asked by {r.requestedBy?.name ?? 'System'}, {formatDate(r.raisedAt)}
            </span>
          </span>
        )
      }
      footer={
        r && (
          <>
            {r.canCancel && (
              // "Cancel the request" read like closing the panel (the user, 2026-11-21): red, on the left, "Withdraw request"
              <Button variant="destructive" className="mr-auto" onClick={() => setAsking('cancel')} disabled={cancel.isPending || settling}>
                <Ban /> Withdraw request
              </Button>
            )}
            {r.canRetry && (
              <Button variant="secondary" onClick={() => retry.mutate({ id })} disabled={retry.isPending || settling}>
                <RotateCcw /> Send through again
              </Button>
            )}
            {r.canDecide && (
              <>
                <Button variant="destructive" onClick={() => setAsking('reject')} disabled={decide.isPending || settling}>
                  <X /> Reject
                </Button>
                <Button variant="gold" onClick={() => decide.mutate({ id, approve: true })} disabled={decide.isPending || settling}>
                  <Check /> {decide.isPending ? 'Saving…' : 'Approve'}
                </Button>
              </>
            )}
          </>
        )
      }
    >
      <FormError error={request.error ?? (asking ? null : error)} />
      {request.isPending && <ApprovalDrawerSkeleton label="Loading the request" />}
      {r && (
        <>
          <p className="text-sm">{r.summary}</p>
          {jobChange.data && <JobChangeDetails change={jobChange.data} meta={false} />}
          {leave.data && (
            <dl className="grid grid-cols-2 gap-2 rounded-xl bg-surface-2/60 px-3 py-2 text-sm">
              <div className="col-span-2 min-w-0">
                <dt className="text-xs text-muted-foreground">{leave.data.isCancelRequest ? 'Why cancel' : 'Reason'}</dt>
                <dd>{leave.data.isCancelRequest ? leave.data.cancelReason : leave.data.reason}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Days</dt>
                <dd className="tabular-nums">{leave.data.days}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{leave.data.leaveType.code} balance now</dt>
                <dd className="tabular-nums">
                  {leave.data.balance ? `${leave.data.balance.balance}${leave.data.balance.pending ? ` (${leave.data.balance.pending} waiting)` : ''}` : 'Unpaid - no balance'}
                </dd>
              </div>
            </dl>
          )}
          {leave.data && !leave.data.isCancelRequest && <TeamOffNote away={leave.data.teamOff} />}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">Steps</h3>
            <ApprovalTrail request={r} />
          </section>
        </>
      )}
      {asking === 'reject' && (
        <ReasonDialog
          title="Reject this request?"
          description="The person who asked is told, with your reason."
          label="Reason"
          confirm="Reject"
          required
          pending={decide.isPending}
          error={decide.error ? errorMessage(decide.error) : null}
          onConfirm={(comment) => decide.mutate({ id, approve: false, comment })}
          onClose={() => setAsking(null)}
        />
      )}
      {asking === 'cancel' && (
        <ReasonDialog
          title="Withdraw this request?"
          description="Nobody is asked any more, and it will not apply."
          label="Why (optional)"
          confirm="Withdraw request"
          pending={cancel.isPending}
          error={cancel.error ? errorMessage(cancel.error) : null}
          onConfirm={(reason) => cancel.mutate({ id, reason })}
          onClose={() => setAsking(null)}
        />
      )}
    </FormDrawer>
  )
}
