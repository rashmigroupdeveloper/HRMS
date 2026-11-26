import { Skeleton } from '@/components/ui/skeleton'
import { RUN_DETAIL_LABELS } from '@/pages/payroll/components/payroll-labels'

export function PayrollRunSkeleton({ label = 'Loading payroll run' }: { label?: string }) {
  return <dl role="status" aria-label={label} className="grid grid-cols-1 gap-4 sm:grid-cols-2">{RUN_DETAIL_LABELS.map(text => <div key={text} className="space-y-1"><dt className="text-xs text-muted-foreground">{text}</dt><dd><Skeleton className="h-5 w-40 max-w-full" /></dd></div>)}</dl>
}
