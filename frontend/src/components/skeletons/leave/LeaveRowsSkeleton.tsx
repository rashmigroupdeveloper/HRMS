import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const SPAN = ['w-40', 'w-56', 'w-32']
const REASON = ['w-48', 'w-64', 'w-40']

// Loading placeholder for leave rows (LeaveList - My leave, Team leave) and the balance history: the real rows' two lines
// and the status pill, with bars for the values. Without a `label` (inside another skeleton) it is not a status of its own.
export function LeaveRowsSkeleton({ rows = 3, showEmployee = false, label }: { rows?: number; showEmployee?: boolean; label?: string }) {
  return (
    <ul role={label ? 'status' : undefined} aria-label={label} className="divide-y">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm">
          <div className="min-w-0 flex-1 basis-60">
            <p className="flex h-5 items-center gap-2">
              {showEmployee && <Skeleton className="h-3.5 w-28 rounded-full" />}
              <Skeleton className="h-3.5 w-7 rounded-full" />
              <Skeleton className={cn('h-3.5 rounded-full', SPAN[i % SPAN.length])} />
            </p>
            <p className="flex h-4 items-center">
              <Skeleton className={cn('h-3 rounded-full', REASON[i % REASON.length])} />
            </p>
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </li>
      ))}
    </ul>
  )
}
