import { Skeleton } from '@/components/ui/skeleton'
import { MOVEMENT_TOTALS } from './movement-labels'
export function MovementReportSummary({ values }: { values?: number[] }) {
  return <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border/60 py-3 sm:grid-cols-4">{MOVEMENT_TOTALS.map((label, i) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-2xl font-light tabular-nums">{values ? values[i] : <Skeleton className="my-1 h-6 w-12 rounded" />}</dd></div>)}</dl>
}
