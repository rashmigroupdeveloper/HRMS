import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// Uneven line widths, so the placeholder reads as names and details, not as a grid of equal bars
const TITLE = ['w-28', 'w-40', 'w-32', 'w-44', 'w-24', 'w-36']
const DETAIL = ['w-48', 'w-40', 'w-52', 'w-36', 'w-44', 'w-56']

// Loading placeholder for a list of people or records: a round avatar, a title line and a detail line per row (the
// directory list, the employee records). Same row height as the real rows, so nothing jumps when the data arrives.
export function ListSkeleton({ rows = 6, avatar = true, label = 'Loading', className }: { rows?: number; avatar?: boolean; label?: string; className?: string }) {
  return (
    <div role="status" aria-label={label} className={cn('space-y-0.5', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-2.5 px-2 py-1.5">
          {avatar && <Skeleton className="size-8 shrink-0 rounded-full" />}
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className={cn('h-3.5 max-w-full rounded-full', TITLE[i % TITLE.length])} />
            <Skeleton className={cn('h-3 max-w-full rounded-full', DETAIL[i % DETAIL.length])} />
          </div>
        </div>
      ))}
    </div>
  )
}
