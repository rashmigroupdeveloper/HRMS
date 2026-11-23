import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const NAME = ['w-28', 'w-36', 'w-32', 'w-40', 'w-24', 'w-32']
const DETAIL = ['w-48', 'w-40', 'w-52', 'w-36', 'w-44', 'w-56']

// Loading placeholder for the People page's directory list: the "N people" count line, then `rows` rows as the list draws
// them - round initials, the name with the code beside it, and the designation · department · company line
export function DirectoryListSkeleton({ rows = 10, label = 'Loading', className }: { rows?: number; label?: string; className?: string }) {
  return (
    <div role="status" aria-label={label} className={cn('space-y-2', className)}>
      <div className="flex h-4 items-center px-1">
        <Skeleton className="h-3 w-16 rounded-full" />
      </div>
      <ul className="space-y-0.5 pr-0.5">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <div className="flex h-5 items-center gap-1.5">
                <Skeleton className={cn('h-3.5 rounded-full', NAME[i % NAME.length])} />
                <Skeleton className="h-3 w-16 rounded-full" />
              </div>
              <div className="flex h-4 items-center">
                <Skeleton className={cn('h-3 max-w-full rounded-full', DETAIL[i % DETAIL.length])} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
