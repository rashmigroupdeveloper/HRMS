import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/FormError'
import { LeaveRowsSkeleton } from '@/components/skeletons/leave/LeaveRowsSkeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { orpc } from '@/lib/orpc'
import { cn, fromDateInput, toDateInput } from '@/lib/utils'
import { segment, SEGMENTS } from '@/pages/attendance/components/labels'
import { LeaveList } from './LeaveList'

// Who is on leave (or has asked) over a span - a team, an HOD's department or everyone (Leave View): the next 30 days by
// default, waiting and approved; deciding is on the Approvals page.
type Scope = 'TEAM' | 'DEPARTMENT' | 'ALL'
const STATUSES = [
  ['open', 'Waiting & approved'],
  ['waiting', 'Waiting'],
  ['all', 'Every status'],
] as const
const STATUS_FILTER = { open: ['PENDING', 'APPROVED'], waiting: ['PENDING'], all: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] } as const

export function TeamLeaveList({ scope }: { scope: Scope }) {
  const [today] = useState(() => new Date())
  const [from, setFrom] = useState(toDateInput(today))
  const [to, setTo] = useState(toDateInput(new Date(today.getTime() + 30 * 86_400_000)))
  const [status, setStatus] = useState<(typeof STATUSES)[number][0]>('open')
  const [search, setSearch] = useState('')
  const valid = !!from && !!to && to >= from
  const list = useQuery({
    ...orpc.leave.applications.list.queryOptions({ input: { scope, from: fromDateInput(from)!, to: fromDateInput(to)!, statuses: [...STATUS_FILTER[status]], search: search.trim() || undefined } }),
    enabled: valid,
    placeholderData: keepPreviousData,
  })
  return (
    <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="tl-from" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input id="tl-from" type="date" className="h-9 w-36 rounded-xl sm:w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tl-to" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input id="tl-to" type="date" min={from} className="h-9 w-36 rounded-xl sm:w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="relative min-w-44 flex-1 sm:max-w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search by name or code" placeholder="Name or code" className="h-9 rounded-xl pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className={SEGMENTS}>
          {STATUSES.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)} className={segment(status === value)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <FormError error={list.error} />
      {list.isPending && valid && <LeaveRowsSkeleton showEmployee rows={4} label="Loading the leave" />}
      {list.data &&
        (list.data.length ? (
          <div className={cn(list.isFetching && 'opacity-60')}>
            <LeaveList rows={list.data} showEmployee />
          </div>
        ) : (
          <EmptyState className="py-6" title="Nobody is on leave" hint="Nobody has leave in these days - change the dates or the status." />
        ))}
    </section>
  )
}
