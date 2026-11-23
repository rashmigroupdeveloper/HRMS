import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const NAME = ['w-40', 'w-48', 'w-36']
const TASK = ['w-44', 'w-56', 'w-36', 'w-48']
const DETAIL = ['w-96', 'w-72', 'w-80', 'w-64']

// Loading placeholder for "My tasks" / "All tasks" (TasksView): one card per new employee - the initials circle, name
// and code over the job line, the joining date and the count - and the tasks as the real one-line rows: the empty
// round tick, the task over its description, the team chip, the due date and (All tasks) who it is given to. `columns`
// is the rows' own grid from the sm breakpoint (the same string TasksView uses), so the bars sit in the real columns.
export function TaskCardsSkeleton({
  columns,
  assignee = false,
  groups = 2,
  rows = 2,
  label = 'Loading',
}: {
  columns: string
  assignee?: boolean
  groups?: number
  rows?: number
  label?: string
}) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      {Array.from({ length: groups }, (_, g) => (
        <section key={g} className="overflow-hidden rounded-2xl bg-card shadow-card">
          <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-2.5">
            <Skeleton className="size-9 shrink-0 rounded-full bg-gold-soft" />
            <div className="min-w-0 flex-1">
              <div className="flex h-5 items-center gap-2">
                <Skeleton className={cn('h-3.5 rounded-full', NAME[g % NAME.length])} />
                <Skeleton className="h-3 w-16 rounded-full" />
              </div>
              <div className="flex h-4 items-center">
                <Skeleton className="h-3 w-48 max-w-full rounded-full" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 max-sm:w-full max-sm:pl-12">
              <Skeleton className="h-3 w-28 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>
          </header>
          <ul className="divide-y">
            {Array.from({ length: rows }, (_, r) => (
              <li
                key={r}
                style={{ '--cols': columns } as React.CSSProperties}
                className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 px-4 py-2 sm:grid-cols-(--cols)"
              >
                <span className="grid size-9 place-items-center">
                  <span className="size-6 rounded-full border-2 border-foreground/15" />
                </span>
                <div className="min-w-0">
                  <div className="flex h-5 items-center">
                    <Skeleton className={cn('h-3.5 max-w-full rounded-full', TASK[(g + r) % TASK.length])} />
                  </div>
                  <div className="flex h-4 items-center">
                    <Skeleton className={cn('h-3 max-w-full rounded-full', DETAIL[(g + r) % DETAIL.length])} />
                  </div>
                </div>
                <div className="col-start-2 flex flex-wrap items-center gap-2 sm:contents">
                  <div className="min-w-0">
                    <Skeleton className="h-6 w-14 rounded-full" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-20 rounded-full" />
                    <Skeleton className="h-3 w-10 rounded-full" />
                  </div>
                  {assignee && (
                    <div className="min-w-0 max-sm:w-full">
                      <Skeleton className="h-3.5 w-32 rounded-full" />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
