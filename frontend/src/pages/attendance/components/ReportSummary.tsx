import { Skeleton } from '@/components/ui/skeleton'
import { REPORT_SUMMARIES } from './report-labels'

export function ReportSummary({ values }: { values?: number[] }) {
  return <dl className="grid grid-cols-3 gap-x-4 gap-y-2 border-y border-border/60 py-3 sm:grid-cols-4 lg:grid-cols-7">
    {REPORT_SUMMARIES.map((label, i) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-medium tabular-nums">{values ? values[i] : <Skeleton className="my-1 h-5 w-12 rounded" />}</dd></div>)}
  </dl>
}

