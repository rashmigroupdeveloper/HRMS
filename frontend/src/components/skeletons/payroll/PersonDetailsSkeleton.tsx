import { Skeleton } from '@/components/ui/skeleton'

// One person of a run while their details load - same blocks as PersonDetails' segments (change both together)
export function PersonDetailsSkeleton({ label = 'Loading person' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      {[0, 1].map((i) => (
        <div key={i} className="space-y-2 rounded-2xl border p-3">
          <div className="flex items-center justify-between gap-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-4 w-14" /></div>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            {['Plant', 'Department', 'Cost centre', 'Type'].map((text) => (
              <div key={text}><dt className="text-muted-foreground">{text}</dt><dd><Skeleton className="mt-1 h-4 w-28" /></dd></div>
            ))}
          </dl>
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
    </div>
  )
}
