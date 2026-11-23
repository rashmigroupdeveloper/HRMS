import { Skeleton } from '@/components/ui/skeleton'

// Loading placeholder for a day's punches in the day panel: the real punch card with its numbered rows (the count is
// known from the day), a bar for each time and machine.
export function PunchesSkeleton({ count = 2, label = 'Loading' }: { count?: number; label?: string }) {
  return (
    <ol role="status" aria-label={label} className="divide-y divide-border/70 rounded-xl bg-card px-3 shadow-card">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex items-center gap-3 py-1.5 text-sm">
          <span className="w-4 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
          <span className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-10 rounded-full" />
          </span>
          <span className="flex min-w-0 flex-1 justify-end">
            <Skeleton className="h-3 w-24 max-w-full rounded-full" />
          </span>
        </li>
      ))}
    </ol>
  )
}
