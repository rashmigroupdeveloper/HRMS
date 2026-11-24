import { ExportButton } from '@/components/ExportButton'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/FormError'
import { LeaveRowsSkeleton } from '@/components/skeletons/leave/LeaveRowsSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAccess } from '@/hooks/useAccess'
import { client, orpc } from '@/lib/orpc'
import { fromDateInput, toDateInput } from '@/lib/utils'
import { daysText, spanText } from './labels'

const DAY = 86_400_000
const todayUtc = () => {
  const n = new Date()
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()))
}

// Approved leave the calendar now counts otherwise (the user, 2026-11-23): a holiday added or removed on it, a weekly off
// changed. A leave keeps its days until HR puts it right here - days back to the balance, or days more taken; the
// employee is e-mailed. Leave View sees the list (inside its data access), Leave Edit puts a leave right.
export function LeaveRecounts() {
  const queryClient = useQueryClient()
  const canEdit = useAccess().can('LEAVE', 'WRITE')
  const [from, setFrom] = useState(() => toDateInput(new Date(todayUtc().getTime() - 90 * DAY)))
  const [to, setTo] = useState(() => toDateInput(new Date(todayUtc().getTime() + 180 * DAY)))
  const span = { from: fromDateInput(from), to: fromDateInput(to) }
  const list = useQuery({ ...orpc.leave.applications.recounts.queryOptions({ input: { from: span.from!, to: span.to! } }), enabled: !!span.from && !!span.to })
  const recount = useMutation(orpc.leave.applications.recount.mutationOptions({ onSuccess: () => void queryClient.invalidateQueries({ queryKey: orpc.leave.key() }) }))
  return (
    <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-xs text-muted-foreground">
          Approved leave whose days the calendar now counts otherwise - a holiday added or removed on it, a weekly off changed. It keeps the days it was approved with until you put it right; the employee is e-mailed.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <ExportButton disabled={!span.from || !span.to || !list.data?.length || list.isFetching} load={() => client.leave.applications.exportRecounts({from:span.from!,to:span.to!})} />
          <div className="space-y-1">
            <Label htmlFor="rc-from" className="text-xs text-muted-foreground">
              Leave from
            </Label>
            <Input id="rc-from" type="date" className="h-9 w-40 rounded-xl" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rc-to" className="text-xs text-muted-foreground">
              to
            </Label>
            <Input id="rc-to" type="date" className="h-9 w-40 rounded-xl" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>
      <FormError error={list.error ?? recount.error} />
      {list.isPending && <LeaveRowsSkeleton rows={3} showEmployee label="Loading the leave to recount" />}
      {list.data && !list.data.length && <EmptyState title="Nothing to recount" hint="Every approved leave in these dates counts the days it was approved with." />}
      {list.data && list.data.length > 0 && (
        <ul className="divide-y">
          {list.data.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm">
              <div className="min-w-0 flex-1 basis-60">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{a.employee.name}</span>
                  <span className="text-xs font-semibold">{a.leaveType.code}</span>
                  <span>{spanText(a)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    approved {daysText(a.days)}, now {daysText(a.now)}
                  </span>
                </p>
                <p className="truncate text-xs text-muted-foreground">{a.holidays.length ? `Holidays on it: ${a.holidays.join(', ')}` : 'The weekly offs or holidays changed'}</p>
              </div>
              {canEdit && (
                <Button variant="secondary" size="sm" disabled={recount.isPending} onClick={() => recount.mutate({ id: a.id })}>
                  {a.difference < 0 ? `Give back ${daysText(-a.difference)}` : `Take ${daysText(a.difference)} more`}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
