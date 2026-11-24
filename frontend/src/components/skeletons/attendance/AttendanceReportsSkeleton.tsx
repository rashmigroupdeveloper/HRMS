import { ReportSummary } from '@/pages/attendance/components/ReportSummary'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { REPORT_COLUMNS, REPORT_SUMMARY_NOTE } from '@/pages/attendance/components/report-labels'

export function AttendanceReportsSkeleton({ label = 'Loading attendance report' }: { label?: string }) {
  return <div role="status" aria-label={label} className="space-y-3"><ReportSummary /><p className="text-xs text-muted-foreground">{REPORT_SUMMARY_NOTE}</p><div className="overflow-x-auto"><Table className="max-md:table-fixed">
    <TableHeader><TableRow>{REPORT_COLUMNS.map(c => <TableHead key={c.label} className={c.className}>{c.label}</TableHead>)}</TableRow></TableHeader>
    <TableBody>{Array.from({ length: 8 }, (_, i) => <TableRow key={i} className="h-20">{REPORT_COLUMNS.map((c, n) => <TableCell key={c.label} className={c.className}><Skeleton className={`h-3 rounded ${n > 1 ? 'ml-auto w-12' : 'w-28'}`} /><Skeleton className={`mt-2 h-3 rounded ${n > 1 ? 'ml-auto w-9' : 'w-20'}`} /></TableCell>)}</TableRow>)}</TableBody>
  </Table></div></div>
}

export function RawPunchesSkeleton({ rows = 4 }: { rows?: number }) {
  return <div role="status" aria-label="Loading raw punches" className="space-y-3"><div className="text-xs text-muted-foreground"><Skeleton className="inline-block h-3 w-4 rounded" /> stored punches · displayed in the employee’s work-location time zone</div><ol className="divide-y divide-border/60">{Array.from({ length: rows }, (_, i) => <li key={i} className="space-y-1 py-3 text-sm"><Skeleton className="h-5 w-60 max-w-full rounded" /><Skeleton className="h-4 w-52 max-w-full rounded" /><Skeleton className="h-5 w-20 rounded" /><div className="text-xs">Source: <Skeleton className="inline-block h-3 w-16 rounded" /></div><div className="text-xs text-muted-foreground">Stored: <Skeleton className="inline-block h-3 w-44 max-w-full rounded" /></div></li>)}</ol></div>
}
