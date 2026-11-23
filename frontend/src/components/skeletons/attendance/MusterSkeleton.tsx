import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { MUSTER_TOTALS } from '@/pages/attendance/components/labels'

const NAME = ['w-28', 'w-24', 'w-32', 'w-20']

// Loading placeholder for the month muster's table (PeopleView's Muster - change both together): the real header - the
// attendance month's day numbers (weekends shaded) and the totals' headings - then rows of bars: the name with the code
// under it, a mark per day and the totals. The month picker, the Excel button and the legend stay real above / below it.
// `days`: the attendance month's days (cycleRange), as the real table heads them.
export function MusterSkeleton({ days, rows = 8, label = 'Loading' }: { days: Date[]; rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full border-collapse text-xs">
        <thead className="bg-surface-2/60 text-muted-foreground">
          <tr>
            <th className="sticky left-0 z-10 min-w-32 bg-surface-2 px-2 py-1.5 text-left font-medium sm:min-w-44">Employee</th>
            {days.map((d) => (
              <th key={d.toISOString()} className={cn('w-7 px-0.5 py-1.5 text-center font-medium tabular-nums', [0, 6].includes(d.getUTCDay()) && 'bg-surface-2')}>
                {d.getUTCDate()}
              </th>
            ))}
            {MUSTER_TOTALS.map((h) => (
              <th key={h} className="px-1.5 py-1.5 text-center font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i}>
              <td className="sticky left-0 z-10 bg-card px-2 py-1">
                <span className="flex h-4 items-center">
                  <Skeleton className={cn('h-3 rounded-full', NAME[i % NAME.length])} />
                </span>
                <span className="flex h-4 items-center">
                  <Skeleton className="h-2.5 w-16 rounded-full" />
                </span>
              </td>
              {days.map((d) => (
                <td key={d.toISOString()} className="px-0.5 py-1 text-center">
                  <Skeleton className="mx-auto h-5 w-6 rounded-md" />
                </td>
              ))}
              {MUSTER_TOTALS.map((h) => (
                <td key={h} className="px-1.5 text-center">
                  <Skeleton className="mx-auto h-3 w-3 rounded-full" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
