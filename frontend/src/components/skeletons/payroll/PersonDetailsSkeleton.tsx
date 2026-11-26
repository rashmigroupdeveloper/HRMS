import { Skeleton } from '@/components/ui/skeleton'
import { DAY_TOTAL_LABELS } from '@/pages/payroll/components/payroll-labels'

// One person of a run while their details load - same blocks as PersonDetails: the day totals, then each stretch with
// its placement, days and salary (change both together)
export function PersonDetailsSkeleton({ label = 'Loading person' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      <dl className="grid grid-cols-3 gap-2 text-xs">
        {DAY_TOTAL_LABELS.map((text) => (
          <div key={text} className="rounded-xl bg-surface-2/40 px-3 py-1.5">
            <dt className="text-muted-foreground">{text}</dt>
            <dd><Skeleton className="my-0.5 h-4 w-14" /></dd>
          </div>
        ))}
      </dl>
      {[0, 1].map((i) => (
        <div key={i} className="space-y-2 rounded-2xl border p-3">
          <div className="flex items-center justify-between gap-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-14" /></div>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            {['Plant', 'Department', 'Cost centre', 'Type'].map((text) => (
              <div key={text}><dt className="text-muted-foreground">{text}</dt><dd><Skeleton className="h-4 w-28" /></dd></div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-1">{Array.from({ length: i ? 12 : 6 }, (_, n) => <Skeleton key={n} className="h-10 w-10 rounded-lg" />)}</div>
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ))}
    </div>
  )
}
