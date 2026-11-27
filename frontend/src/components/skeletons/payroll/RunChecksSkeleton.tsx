import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CHECK_COLUMNS, CHECK_WIDTHS } from '@/pages/payroll/components/payroll-labels'

// The warnings table of a run while it loads - same columns and two-line rows as RunChecks (change both together)
export function RunChecksSkeleton({ label = 'Loading checks' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="overflow-x-auto">
      <Table className="min-w-[720px] table-fixed text-[13px]">
        <TableHeader>
          <TableRow>{CHECK_COLUMNS.map((h, i) => <TableHead key={`${h}-${i}`} style={{ width: CHECK_WIDTHS[i] }} className="h-8 px-2 text-xs">{h}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 6 }, (_, i) => (
            <TableRow key={i}>
              <TableCell className="px-2 py-1.5"><Skeleton className="size-4 rounded" /></TableCell>
              <TableCell className="px-2 py-1.5"><Skeleton className="h-4 w-36" /><Skeleton className="mt-1 h-3 w-20" /></TableCell>
              <TableCell className="px-2 py-1.5"><Skeleton className="h-4 w-32" /><Skeleton className="mt-1 h-3 w-52 max-w-full" /></TableCell>
              <TableCell className="px-2 py-1.5"><Skeleton className="h-4 w-14" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
