import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const NAME = ['w-32', 'w-40', 'w-28']
const REASON = ['w-64', 'w-52', 'w-72']

// Loading placeholder for the shift changes to approve (attendance's Approvals tab): one group card with the real request
// rows - who, the day and the change, the reason - and the Reject / Approve buttons (disabled). The group's title is a
// bar: whether it is "Your team's requests" or "Waiting for HR" comes from the data. Without a `label` (inside another
// skeleton) it is not a status of its own.
export function ShiftChangesSkeleton({ rows = 3, label }: { rows?: number; label?: string }) {
  return (
    <section role={label ? 'status' : undefined} aria-label={label} className="space-y-2 rounded-3xl bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Skeleton className="my-1.5 h-4 w-44 rounded-full" />
        <Skeleton className="h-3.5 w-56 max-w-full rounded-full" />
      </div>
      <ul className="divide-y">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="py-2.5 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex h-5 items-center gap-2">
                  <Skeleton className={cn('h-3.5 rounded-full', NAME[i % NAME.length])} />
                  <Skeleton className="h-3 w-16 rounded-full" />
                </p>
                <p className="flex h-5 items-center">
                  <Skeleton className="h-3.5 w-44 rounded-full" />
                </p>
                <p className="flex h-4 items-center">
                  <Skeleton className={cn('h-3 max-w-full rounded-full', REASON[i % REASON.length])} />
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled>
                  <X /> Reject
                </Button>
                <Button size="sm" disabled>
                  <Check /> Approve
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
