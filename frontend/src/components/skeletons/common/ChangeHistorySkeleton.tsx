import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const WHO = ['w-24', 'w-32', 'w-28', 'w-20']
const WHAT = ['w-40', 'w-52', 'w-32', 'w-44']
// the changed fields under a row - none under a sign-in
const FIELDS = [[], ['w-28', 'w-36', 'w-32'], [], ['w-40'], ['w-24', 'w-32', 'w-28'], ['w-36', 'w-24']]

// Loading placeholder for a change history (ChangeHistoryList - the Change history page, a profile's History tab): entries under day headings, each the real row - the
// action's round icon, who did what, the time on the right, the changed fields under it - with bars for the words that
// come from the data. `days` gives the number of entries under each day heading.
export function ChangeHistorySkeleton({ days = [4, 6], label = 'Loading', className }: { days?: number[]; label?: string; className?: string }) {
  let n = 0
  return (
    <div role="status" aria-label={label} className={className}>
      {days.map((count, d) => (
        <section key={d}>
          <h3 className="flex h-6 items-center border-b border-border/70 bg-card">
            <Skeleton className="h-3 w-32 rounded-full" />
          </h3>
          <ol className="divide-y divide-border/70">
            {Array.from({ length: count }, () => {
              const i = n++
              return (
                <li key={i} className="flex gap-2.5 py-1.5">
                  <Skeleton className="size-6 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-start gap-2">
                      <p className="flex h-5 min-w-0 flex-1 items-center gap-1.5">
                        <Skeleton className={cn('h-3.5 rounded-full', WHO[i % WHO.length])} />
                        <Skeleton className={cn('h-3.5 max-w-full rounded-full', WHAT[i % WHAT.length])} />
                      </p>
                      <span className="flex h-4 shrink-0 items-center">
                        <Skeleton className="h-3 w-12 rounded-full" />
                      </span>
                    </div>
                    {FIELDS[i % FIELDS.length]!.length > 0 && (
                      <p className="flex min-h-4 flex-wrap items-center gap-x-4 gap-y-1">
                        {FIELDS[i % FIELDS.length]!.map((w, f) => (
                          <Skeleton key={f} className={cn('h-3 rounded-full', w)} />
                        ))}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}
