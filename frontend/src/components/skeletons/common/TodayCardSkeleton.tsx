import { CalendarClock } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// Loading placeholder for the "Today" card (the attendance page and the home page): the real card, icon and "Today"
// label, a bar for the day's line.
export function TodayCardSkeleton({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-label={label} className={cn('flex items-center gap-3 rounded-3xl bg-card px-4 py-3 shadow-card', className)}>
      <span className="grid size-10 place-items-center rounded-2xl bg-surface-2">
        <CalendarClock className="size-5" />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">Today</p>
        <div className="flex h-5 items-center">
          <Skeleton className="h-3.5 w-20 rounded-full" />
        </div>
      </div>
    </div>
  )
}
