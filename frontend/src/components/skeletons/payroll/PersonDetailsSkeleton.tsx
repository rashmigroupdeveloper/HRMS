import { Skeleton } from '@/components/ui/skeleton'
import { DAY_TOTAL_LABELS, DEDUCTIONS_TITLE, EMPLOYER_TITLE, PAY_TITLE } from '@/pages/payroll/components/payroll-labels'

// one group of pay lines (as PersonDetails' PayLines): its real title, value bars, its real total label
function Lines({ title, rows, total }: { title: string; rows: number; total: string }) {
  return (
    <div className="rounded-xl bg-surface-2/40 p-2 text-xs">
      <p className="mb-1 text-muted-foreground">{title}</p>
      {Array.from({ length: rows }, (_, n) => <div key={n} className="flex justify-between py-0.5"><Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-16" /></div>)}
      <div className="mt-0.5 flex justify-between border-t py-1"><span className="font-medium">{total}</span><Skeleton className="h-4 w-20" /></div>
    </div>
  )
}

// One person of a run while their details load - same blocks as PersonDetails: the day totals, what they earned, then
// each stretch with its placement, days and salary (change both together)
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
      <div className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <Lines title={PAY_TITLE} rows={4} total="Earned gross" />
          <div className="space-y-2">
            <Lines title={DEDUCTIONS_TITLE} rows={3} total="Total deducted" />
            <Lines title={EMPLOYER_TITLE} rows={2} total="Total" />
          </div>
        </div>
        {/* the net pay bar is dark: drawn dark with light bars, so it does not flash light first */}
        <div className="flex items-center justify-between rounded-xl bg-hero px-3 py-2 text-hero-foreground">
          <span className="text-sm">Net pay</span>
          <Skeleton className="my-0.5 h-6 w-24 bg-hero-foreground/10" />
        </div>
      </div>
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
