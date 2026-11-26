import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RUN_FACT_LABELS, RUN_TILE_LABELS } from '@/pages/payroll/components/payroll-labels'

// The run page's header while payroll.get loads - same blocks as PayrollRunPage's header (change both together).
// `refresh`: the viewer has Payroll Edit, so the page will most likely show the refresh button - keep its place.
export function PayrollRunHeaderSkeleton({ label = 'Loading payroll run', refresh = false }: { label?: string; refresh?: boolean }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
        {refresh && <Button variant="secondary" className="min-h-9 gap-1.5 rounded-full" disabled><RefreshCw className="size-4" aria-hidden />Refresh from employee records</Button>}
      </div>
      {/* the company's name */}
      <Skeleton className="h-5 w-56 max-w-full" />
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        {RUN_FACT_LABELS.map((text) => (
          <div key={text} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{text}</dt>
            <dd><Skeleton className="mt-1 h-5 w-48 max-w-full" /></dd>
          </div>
        ))}
      </dl>
      <div className="grid grid-cols-3 gap-2">
        {RUN_TILE_LABELS.map((text) => (
          <div key={text} className="rounded-2xl bg-card px-3 py-2 shadow-card">
            <p className="text-xs text-muted-foreground">{text}</p>
            <Skeleton className="mt-1 h-6 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}
