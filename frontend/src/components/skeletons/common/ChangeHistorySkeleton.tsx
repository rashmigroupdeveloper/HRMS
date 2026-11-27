import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const WHO = ['w-24', 'w-32', 'w-28', 'w-20']
const WHAT = ['w-40', 'w-52', 'w-32', 'w-44']
// the changed fields under a row - none under a sign-in
const FIELDS = [[], ['w-28', 'w-36', 'w-32'], [], ['w-40'], ['w-24', 'w-32', 'w-28'], ['w-36', 'w-24']]

// Loading placeholder for a change history (ChangeHistoryList - the Change history page, a profile's History tab): entries under day headings, each the real row - the
// action's round icon, who did what, the time on the right, the changed fields under it - with bars for the words that
// come from the data. `days` gives the number of entries under each day heading.
export function ChangeHistorySkeleton({
  days = [4, 6],
  label = 'Loading',
  className,
  variant = 'compact',
}: {
  days?: number[]
  label?: string
  className?: string
  variant?: 'compact' | 'ledger'
}) {
  let n = 0
  if (variant === 'ledger') {
    return (
      <div role="status" aria-label={label} className={className}>
        {days.map((count, d) => (
          <section key={d} className="mt-5 first:mt-0">
            <h3 className="flex h-7 items-center">
              <Skeleton className="h-3.5 w-36 rounded-full" />
            </h3>
            <ol className="relative">
              <span aria-hidden className="absolute top-2 bottom-2 left-[calc(5.25rem+0.75rem+0.625rem)] w-px -translate-x-1/2 border-l border-dashed border-foreground/25" />
              {Array.from({ length: count }, () => {
                const i = n++
                return (
                  <li key={i} className="grid grid-cols-[5.25rem_1.25rem_minmax(0,1fr)] gap-x-3 py-2">
                    <span className="flex justify-end pt-1">
                      <Skeleton className="h-3 w-14 rounded-full" />
                    </span>
                    <span className="relative z-10 flex justify-center pt-1.5">
                      <Skeleton className="size-2 rounded-full" />
                    </span>
                    <div className="space-y-1 px-2">
                      <p className="flex h-5 items-center gap-1.5">
                        <Skeleton className={cn('h-3.5 rounded-full', WHO[i % WHO.length])} />
                        <Skeleton className={cn('h-3.5 max-w-full rounded-full', WHAT[i % WHAT.length])} />
                      </p>
                      {FIELDS[i % FIELDS.length]!.length > 0 && (
                        <p className="flex min-h-4 flex-wrap items-center gap-x-4">
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
