import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MovementReportSummary } from '@/pages/employees/components/MovementReportSummary'
import { MOVEMENT_COLUMNS } from '@/pages/employees/components/movement-labels'
export function MovementReportSkeleton() {
  return <div role="status" aria-label="Loading joiners and leavers" className="space-y-3"><MovementReportSummary /><p className="text-xs text-muted-foreground">Totals cover all matching events, not just this page.</p><Table className="max-md:table-fixed"><TableHeader><TableRow>{MOVEMENT_COLUMNS.map(c => <TableHead key={c.label} className={c.className}>{c.label}</TableHead>)}</TableRow></TableHeader><TableBody>{Array.from({ length: 5 }, (_, i) => <TableRow key={i} className="h-20">{MOVEMENT_COLUMNS.map(c => <TableCell key={c.label} className={c.className}><Skeleton className="h-4 w-28 max-w-full rounded" /><Skeleton className="mt-2 h-3 w-20 max-w-full rounded" /></TableCell>)}</TableRow>)}</TableBody></Table></div>
}
