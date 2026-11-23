import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ListChecks, Undo2 } from 'lucide-react'
import { Link } from 'react-router'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { Button } from '@/components/ui/button'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { formatDate, formatDoneBy } from '@/lib/utils'
import { CardTitle } from '@/components/ProfileCards'

// One employee's joining tasks on the profile's Record tab (HR's view, 2026-11-16): the tasks other teams do when the
// employee joins (e-mail ID, laptop, ID card...), made on the joining day. An employee HR added directly gets them with
// "Make joining tasks" (Onboarding: Edit). Each task is given to one person; done / undo by that person (with "Joining
// tasks: Edit") or HR (Onboarding: Edit) - the same as on My tasks, where HR also gives a task to someone else.
export function EmployeeJoiningTasks({ employeeCode }: { employeeCode: string }) {
  const access = useAccess()
  const queryClient = useQueryClient()
  const tasks = useQuery(orpc.joiningTasks.forEmployee.queryOptions({ input: { employeeCode } }))
  const refresh = () => void queryClient.invalidateQueries({ queryKey: orpc.joiningTasks.key() })
  const make = useMutation(orpc.joiningTasks.createForEmployee.mutationOptions({ onSuccess: refresh }))
  const complete = useMutation(orpc.joiningTasks.complete.mutationOptions({ onSuccess: refresh }))
  const reopen = useMutation(orpc.joiningTasks.reopen.mutationOptions({ onSuccess: refresh }))
  const canMark = (t: { assignedTo: { employeeCode: string | null } | null }) =>
    access.can('ONBOARDING', 'WRITE') || (t.assignedTo?.employeeCode === access.me?.employeeCode && access.can('JOINING_TASKS', 'WRITE'))
  const busy = complete.isPending || reopen.isPending
  // "Undo" asks first; the note stays (2026-11-21)
  const [undoing, setUndoing] = useState<{ id: number; name: string; note: string | null } | null>(null)

  if (tasks.isPending || (tasks.data?.length === 0 && !access.can('ONBOARDING', 'WRITE'))) return null
  const done = tasks.data?.filter((t) => t.doneAt).length ?? 0
  return (
    <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle icon={ListChecks}>Joining tasks</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {tasks.data?.length ? `${done} of ${tasks.data.length} done.` : 'None yet - made on the joining day for employees who join through onboarding.'}
            {(access.can('JOINING_TASKS') || access.can('ONBOARDING')) && (
              <>
                {' '}
                <Link to="/joining-tasks" className="underline underline-offset-2">
                  Joining checklist
                </Link>
              </>
            )}
          </p>
        </div>
        {tasks.data?.length === 0 && access.can('ONBOARDING', 'WRITE') && (
          <Button variant="secondary" size="sm" disabled={make.isPending} onClick={() => make.mutate({ employeeCode })}>
            <ListChecks /> {make.isPending ? 'Making…' : 'Make joining tasks'}
          </Button>
        )}
      </div>
      <FormError error={tasks.error ?? make.error ?? complete.error ?? reopen.error} />
      {!!tasks.data?.length && (
        <ul className="divide-y">
          {tasks.data.map((t) => (
            <li key={t.id} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
              <div className="min-w-0 space-y-0.5 text-sm">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {t.name}
                  <Pill tone="neutral">{t.team}</Pill>
                  {t.doneAt ? <Pill tone="positive">Done</Pill> : t.overdue ? <Pill tone="negative">Overdue</Pill> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.doneAt ? `Done ${formatDoneBy(t.doneAt, t.doneBy)}` : `Due ${formatDate(t.dueDate)}`}{t.note ? ` · ${t.note}` : ''} · given to{' '}
                  {t.assignedTo?.name ?? 'nobody yet'}
                </p>
              </div>
              {canMark(t) &&
                (t.doneAt ? (
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => setUndoing(t)}>
                    <Undo2 /> Undo
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" disabled={busy} onClick={() => complete.mutate({ id: t.id })}>
                    <Check /> Done
                  </Button>
                ))}
            </li>
          ))}
        </ul>
      )}
      {undoing && (
        <ConfirmDialog
          title={`Undo "${undoing.name}"?`}
          description={`It goes back to the to-do list.${undoing.note ? ' Its note is kept for when it is marked done again.' : ''}`}
          confirm="Undo done"
          pending={reopen.isPending}
          onConfirm={() => reopen.mutate({ id: undoing.id }, { onSuccess: () => setUndoing(null) })}
          onClose={() => setUndoing(null)}
        />
      )}
    </section>
  )
}
