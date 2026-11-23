import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const TASK = ['w-40', 'w-48', 'w-36', 'w-44']
const DETAIL = ['w-96', 'w-80', 'w-72', 'w-64']

// Loading placeholder for the task list (TaskTypesSection): one card with a thin band per day after joining and the
// tasks as the real rows - the task over its description, the team chip, the joining types, the default person and
// (`canChange`) the Edit and Retire buttons, disabled until the row is there.
export function TaskTypesSkeleton({ canChange = false, groups = 3, rows = 1, label = 'Loading' }: { canChange?: boolean; groups?: number; rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="overflow-hidden rounded-2xl bg-card shadow-card">
      {Array.from({ length: groups }, (_, g) => (
        <div key={g}>
          <div className="flex items-center gap-2 border-b bg-surface-2/60 px-4 py-1.5">
            <Skeleton className="size-5 rounded-full bg-card" />
            <Skeleton className="h-3 w-24 rounded-full bg-foreground/10" />
          </div>
          <ul className="divide-y">
            {Array.from({ length: rows }, (_, r) => (
              <li
                key={r}
                className={cn(
                  'grid grid-cols-1 items-center gap-x-3 gap-y-1.5 px-4 py-2',
                  canChange ? 'sm:grid-cols-[minmax(0,1fr)_8.5rem_11rem_13rem_6.5rem]' : 'sm:grid-cols-[minmax(0,1fr)_8.5rem_11rem_13rem]',
                )}
              >
                <div className="min-w-0">
                  <div className="flex h-5 items-center">
                    <Skeleton className={cn('h-3.5 max-w-full rounded-full', TASK[(g + r) % TASK.length])} />
                  </div>
                  <div className="flex h-4 items-center">
                    <Skeleton className={cn('h-3 max-w-full rounded-full', DETAIL[(g + r) % DETAIL.length])} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:contents">
                  <div className="min-w-0">
                    <Skeleton className="h-6 w-14 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-24 rounded-full" />
                  <div className="flex min-w-0 items-center gap-2">
                    <Skeleton className="size-6 shrink-0 rounded-full" />
                    <Skeleton className="h-3.5 w-28 rounded-full" />
                  </div>
                  {canChange && (
                    <div className="flex items-center gap-0.5 max-sm:ml-auto sm:justify-end">
                      <Button variant="ghost" size="icon-sm" aria-label="Edit" disabled>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-muted-foreground" disabled>
                        Retire
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
