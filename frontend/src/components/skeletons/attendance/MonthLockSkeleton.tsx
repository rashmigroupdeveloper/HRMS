import { Skeleton } from '@/components/ui/skeleton'
import { CYCLE_LABEL } from '@/pages/attendance/components/labels'

// The setup's Month lock while the year's months load (change both together with MonthLockSetup): the twelve month tiles
// with their name, days and state as bars, and the row "Each attendance month starts on day" at the foot of the card

export function MonthTilesSkeleton({ label }: { label?: string }) {
  return (
    <ul role="status" aria-label={label} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: 12 }, (_, i) => (
        <li key={i} className="flex min-w-0 flex-col justify-between gap-2 rounded-2xl bg-surface-2 p-3">
          <div className="space-y-1.5 pt-0.5">
            <Skeleton className="h-3.5 w-24 rounded-full bg-foreground/10" />
            <Skeleton className="h-3 w-28 max-w-full rounded-full bg-foreground/10" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-16 rounded-full bg-foreground/10" />
            <Skeleton className="h-8 w-20 rounded-full bg-foreground/10" />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function CycleStartSkeleton() {
  return (
    <div className="border-t border-border/60 pt-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm font-medium">{CYCLE_LABEL}</span>
        <Skeleton className="h-9 w-20 rounded-xl" />
        <span className="inline-flex h-8 items-center rounded-full bg-secondary px-3.5 text-xs font-medium text-muted-foreground">Save</span>
        <Skeleton className="h-3 w-72 max-w-full rounded-full" />
      </div>
    </div>
  )
}
