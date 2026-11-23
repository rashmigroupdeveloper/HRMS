import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const MAIN = ['w-48', 'w-40', 'w-56', 'w-44']
const WHEN = ['w-52', 'w-44', 'w-48', 'w-40']

// Loading placeholder for an HOD history list (HodDialogs): `rows` rows as the list draws them - with `person` the HOD's
// round initials and name + code (a place's history), without it the place's name (a person's history) - and the
// from → to · by line on the right
export function HodHistorySkeleton({ rows = 4, person = false, label = 'Loading', className }: { rows?: number; person?: boolean; label?: string; className?: string }) {
  return (
    <ul role="status" aria-label={label} className={cn('divide-y', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
          <span className="flex min-w-0 items-center gap-2">
            {person && <Skeleton className="size-6 shrink-0 rounded-full" />}
            <span className="flex h-5 items-center gap-1.5">
              <Skeleton className={cn('h-3.5 rounded-full', MAIN[i % MAIN.length])} />
              {person && <Skeleton className="h-3 w-16 rounded-full" />}
            </span>
          </span>
          <Skeleton className={cn('h-3 rounded-full', WHEN[i % WHEN.length])} />
        </li>
      ))}
    </ul>
  )
}
