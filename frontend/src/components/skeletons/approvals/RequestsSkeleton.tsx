import { Check, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { type ListMode, ROW_GRID } from '@/pages/approvals/components/request-kinds'

const NAME = ['w-28', 'w-36', 'w-32', 'w-40']
const KIND = ['w-24', 'w-32', 'w-20', 'w-28']
const SUMMARY = ['w-4/5', 'w-3/5', 'w-11/12', 'w-2/3']
const WHO = ['w-24', 'w-32', 'w-20', 'w-28']

// Loading placeholder for the requests of an Approvals tab (redesigned 2026-11-22): the real rows of RequestList - the
// avatar, name, kind chip, summary, step segments ("Step x of y" bars), date and, on "Waiting for me", the real Reject /
// Approve buttons (not usable yet). `mode` as RequestList.
export function RequestsSkeleton({ rows = 5, mode = 'decide', label = 'Loading' }: { rows?: number; mode?: ListMode; label?: string }) {
  return (
    <ul role="status" aria-label={label} className="divide-y divide-border/70 overflow-hidden rounded-2xl bg-card shadow-card">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className={cn('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 lg:gap-x-5', ROW_GRID)}>
          <div className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="min-w-0 space-y-1.5">
              <span className="flex h-5 items-center gap-2">
                <Skeleton className={cn('h-3.5 rounded-full', NAME[i % NAME.length])} />
                <Skeleton className="h-3 w-16 rounded-full" />
              </span>
              <Skeleton className={cn('h-5 rounded-full', KIND[i % KIND.length])} />
            </div>
          </div>
          <div className="col-span-2 lg:col-span-1">
            <Skeleton className={cn('h-3.5 rounded-full', SUMMARY[i % SUMMARY.length])} />
          </div>
          <div className="col-span-2 space-y-1 lg:col-span-1">
            {mode === 'held' ? (
              <Skeleton className="h-3.5 w-40 rounded-full" />
            ) : mode === 'decided' ? (
              // "You approved" pill + date, then where the request stands
              <>
                <span className="flex items-center gap-1.5">
                  <Skeleton className="h-6 w-28 rounded-full" />
                  <Skeleton className="h-3 w-20 rounded-full" />
                </span>
                <Skeleton className={cn('h-3 rounded-full', WHO[i % WHO.length])} />
              </>
            ) : (
              <>
                <span className="flex items-center gap-1">
                  <Skeleton className="h-1.5 flex-1 rounded-full" />
                  <Skeleton className="h-1.5 flex-1 rounded-full" />
                </span>
                <span className="flex h-5 items-center gap-1.5">
                  <Skeleton className="h-3 w-16 rounded-full" />
                  <Skeleton className={cn('h-3.5 rounded-full', WHO[i % WHO.length])} />
                </span>
              </>
            )}
          </div>
          <div className="space-y-1">
            <Skeleton className="h-3.5 w-20 rounded-full" />
            <Skeleton className="h-3 w-16 rounded-full" />
          </div>
          <div className="flex justify-end gap-1.5">
            {mode === 'decide' ? (
              // the real buttons, not usable until the request is there
              <>
                <Button variant="destructive" size="sm" disabled tabIndex={-1}>
                  <X /> Reject
                </Button>
                <Button variant="secondary" size="sm" className="bg-positive/15 text-positive-ink" disabled tabIndex={-1}>
                  <Check /> Approve
                </Button>
              </>
            ) : (
              <span className="grid size-7 place-items-center text-muted-foreground">
                <ChevronRight className="size-4" />
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
