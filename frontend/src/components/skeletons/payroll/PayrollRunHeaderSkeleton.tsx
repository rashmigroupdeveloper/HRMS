import { CalendarCheck, RefreshCw, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RunOverviewSkeleton } from './RunOverviewSkeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { COMPUTE_LABEL, REFRESH_LABEL, SEND_LABEL } from '@/pages/payroll/components/payroll-labels'

// The run page's header while payroll.get loads - same blocks as PayrollRunPage's header (change both together).
// `actions`: the viewer has Payroll Edit, so the page will most likely show its three buttons - keep their place.
export function PayrollRunHeaderSkeleton({ label = 'Loading payroll run', actions = false }: { label?: string; actions?: boolean }) {
  return (
    <div role="status" aria-label={label} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Skeleton className="h-[34px] w-64 max-w-full sm:h-12" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
        {actions && (
          <div className="flex flex-wrap gap-2">
            <Button variant="gold" className="min-h-10 gap-1.5 rounded-full" disabled><CalendarCheck className="size-4" aria-hidden />{COMPUTE_LABEL}</Button>
            <Button variant="secondary" className="min-h-9 gap-1.5 rounded-full" disabled><Send className="size-4" aria-hidden />{SEND_LABEL}</Button>
            <Button variant="secondary" className="min-h-9 gap-1.5 rounded-full" disabled><RefreshCw className="size-4" aria-hidden />{REFRESH_LABEL}</Button>
          </div>
        )}
      </div>
      {/* the company's name */}
      <Skeleton className="h-5 w-56 max-w-full" />
      <p className="flex items-center gap-2 text-sm text-muted-foreground">Pay period <Skeleton className="h-5 w-48" /></p>
      <RunOverviewSkeleton />
      <div className="rounded-2xl bg-card/60 px-4 py-3 text-sm text-muted-foreground">Run details</div>
    </div>
  )
}
