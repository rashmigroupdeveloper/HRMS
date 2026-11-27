import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PAYROLL_DESK_TITLE } from '@/pages/payroll/components/payroll-labels'

// The pay-period instrument while the runs load. The title is real; the month and the count are bars.
export function PayrollDeskSkeleton() {
  return (
    <section role="status" aria-label="Loading this pay period" className="home-panel home-panel-dark u-grain min-w-0 p-4 text-hero-foreground sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <h2 className="text-[28px] font-light tracking-[-0.03em] sm:text-[36px]">{PAYROLL_DESK_TITLE}</h2>
          <Skeleton className="mt-2 h-4 w-56 rounded bg-hero-foreground/10" />
        </div>
        <div>
          <Skeleton className="h-12 w-16 rounded bg-hero-foreground/10" />
          <p className="mt-2 text-sm text-hero-foreground/80">companies still to take days</p>
        </div>
      </div>
      <Skeleton className="mt-5 h-1.5 w-full rounded-full bg-hero-foreground/10" />
    </section>
  )
}

// Keep row geometry and static pagination labels in sync with PayrollPage.
export function PayrollRunsSkeleton({ label = 'Loading payroll runs' }: { label?: string }) {
  return <div role="status" aria-label={label} className="space-y-3">
    <div className="divide-y">{[0, 1, 2].map(i => <div key={i} className="grid min-h-24 items-center gap-3 px-2 py-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_4.5rem_auto]">
      <div><Skeleton className="h-5 w-40" /><Skeleton className="mt-2 h-4 w-48" /></div>
      <div><p className="text-xs text-muted-foreground">Pay period</p><Skeleton className="mt-1 h-4 w-44" /><Skeleton className="mt-2 h-1.5 w-full rounded-full" /></div>
      <div><Skeleton className="h-7 w-10" /><p className="mt-1 text-xs text-muted-foreground">people</p></div>
      <Skeleton className="h-6 w-24" />
    </div>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <span className="flex items-center gap-1"><Skeleton className="h-4 w-4" />runs · page<Skeleton className="h-4 w-4" /></span>
      <div className="flex gap-1"><Button size="sm" variant="secondary" className="min-h-9 rounded-full" disabled><ChevronLeft aria-hidden />Previous</Button><Button size="sm" variant="secondary" className="min-h-9 rounded-full" disabled>Next<ChevronRight aria-hidden /></Button></div>
    </div>
  </div>
}
