import { Skeleton } from '@/components/ui/skeleton'
import { TILES_GRID } from '@/pages/leave/components/BalanceTiles'

// Loading placeholder for the leave balance tiles (My leave): the real tiles - the type's code and name, the number with
// "available", the line beneath - with bars for the values (the types come from the data, so their names are bars too).
export function BalanceTilesSkeleton({ tiles = 6, label }: { tiles?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className={TILES_GRID}>
      {Array.from({ length: tiles }, (_, i) => (
        <div key={i} className="min-w-0 rounded-2xl bg-surface-2/60 px-3 py-2.5">
          <div className="flex h-4 items-center gap-1.5">
            <Skeleton className="h-3 w-6 rounded-full" />
            <Skeleton className="h-3 w-20 rounded-full" />
          </div>
          <div className="mt-0.5 flex h-8 items-center gap-1">
            <Skeleton className="h-6 w-8 rounded-lg" />
            <span className="text-xs text-muted-foreground">available</span>
          </div>
          <div className="flex h-4 items-center">
            <Skeleton className="h-3 w-28 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}
