import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

// Keep row geometry and static pagination labels in sync with PayrollPage.
export function PayrollRunsSkeleton({ label = 'Loading payroll runs' }: { label?: string }) {
  return <div role="status" aria-label={label} className="space-y-3">
    <div className="divide-y">{[0, 1, 2].map(i => <div key={i} className="grid min-h-24 items-center gap-2 py-3 sm:grid-cols-[1fr_1fr_auto]">
      <div><div className="flex h-9 items-center"><Skeleton className="h-4 w-44" /></div><Skeleton className="h-5 w-48" /></div>
      <div><p className="text-xs text-muted-foreground">Attendance period</p><Skeleton className="h-5 w-48" /><Skeleton className="mt-1 h-3 w-16" /></div>
      <Skeleton className="h-6 w-16" />
    </div>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <span className="flex items-center gap-1"><Skeleton className="h-4 w-4" />runs · page<Skeleton className="h-4 w-4" /></span>
      <div className="flex gap-1"><Button size="sm" variant="secondary" className="min-h-9 rounded-full" disabled><ChevronLeft aria-hidden />Previous</Button><Button size="sm" variant="secondary" className="min-h-9 rounded-full" disabled>Next<ChevronRight aria-hidden /></Button></div>
    </div>
  </div>
}
