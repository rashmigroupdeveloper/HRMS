import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// Loading placeholder for plain rows of one height (a master list, a settings list, a drawer's list): `rowClassName`
// sets the real row's height and corners, e.g. 'h-10 rounded-xl'.
export function RowsSkeleton({ rows = 5, rowClassName = 'h-10 rounded-xl', label = 'Loading', className }: { rows?: number; rowClassName?: string; label?: string; className?: string }) {
  return (
    <div role="status" aria-label={label} className={cn('space-y-1.5', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={rowClassName} />
      ))}
    </div>
  )
}
