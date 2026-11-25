import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { ApprovalTrail } from '@/components/ApprovalTrail'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { FormError } from '@/components/FormError'
import { JobChangeDetails } from '@/components/JobChangeDetails'
import { ReasonDialog } from '@/components/ReasonDialog'
import { Button } from '@/components/ui/button'
import { orpc } from '@/lib/orpc'
import { errorMessage } from '@/lib/utils'

// One job change in a side panel (the user, 2026-11-20): its details and its approval's steps; "Cancel the change" while
// it waits for approval or for its day (the requester, or Employees: Edit for the employee). Used by the job changes list
// and the employee's Job tab.
export function JobChangeDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const queryClient = useQueryClient()
  const change = useQuery(orpc.jobChanges.get.queryOptions({ input: { id } }))
  const approvalId = change.data?.approvalRequestId
  const approval = useQuery({ ...orpc.approvals.get.queryOptions({ input: { id: approvalId ?? 0 } }), enabled: !!approvalId, retry: false })
  const [cancelling, setCancelling] = useState(false)
  const cancel = useMutation(
    orpc.jobChanges.cancel.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.jobChanges.key() })
        void queryClient.invalidateQueries({ queryKey: orpc.approvals.key() })
        void queryClient.invalidateQueries({ queryKey: orpc.employees.key() })
        setCancelling(false)
      },
    }),
  )
  const c = change.data
  return (
    <FormDrawer
      onClose={onClose}
      width={560}
      title={c ? c.employee.name : 'Job change'}
      description={
        c && (
          <Link to={`/manage/employees/${c.employee.employeeCode}?tab=job`} className="underline-offset-4 hover:underline">
            {c.employee.employeeCode}
          </Link>
        )
      }
      // "Cancel the change" read like closing the panel (the user, 2026-11-21): it is "Withdraw request" (waiting for approval)
      // or "Stop this change" (approved, not in force), in red on the left; the panel closes with "Close"
      footer={
        <>
          {c?.canCancel && (
            <Button variant="destructive" className="mr-auto" onClick={() => setCancelling(true)}>
              <Ban /> {c.status === 'PENDING' ? 'Withdraw request' : 'Stop this change'}
            </Button>
          )}
          <DrawerCancel>Close</DrawerCancel>
        </>
      }
    >
      <FormError error={change.error} />
      {c && <JobChangeDetails change={c} />}
      {approval.data && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">Approval</h3>
          <ApprovalTrail request={approval.data} />
        </section>
      )}
      {cancelling && c && (
        <ReasonDialog
          title={c.status === 'PENDING' ? 'Withdraw this request?' : 'Stop this approved change?'}
          description={c.status === 'PENDING' ? 'Its approval stops - nobody is asked any more.' : 'It was approved but is not in force yet - it will not apply.'}
          label="Why (optional)"
          confirm={c.status === 'PENDING' ? 'Withdraw request' : 'Stop this change'}
          pending={cancel.isPending}
          error={cancel.error ? errorMessage(cancel.error) : null}
          onConfirm={(reason) => cancel.mutate({ id: c.id, reason })}
          onClose={() => setCancelling(false)}
        />
      )}
    </FormDrawer>
  )
}
