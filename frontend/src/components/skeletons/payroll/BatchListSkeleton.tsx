import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BATCH_COLUMNS, BATCH_WIDTHS } from '@/pages/payroll/components/payments-labels'

const MADE = ['w-24', 'w-28', 'w-20', 'w-24']

// Loading placeholder for the list of payment batches (Salary payments › Batches): the real headings, rows of bars shaped
// like the real rows (batch number over who made it, the company, way, counts, amounts, the status pill)
export function BatchListSkeleton({ rows = 6, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="overflow-x-auto">
      <Table aria-label="Batches" className="min-w-[760px] table-fixed text-[13px]">
        <TableHeader>
          <TableRow>
            {BATCH_COLUMNS.map((h, i) => <TableHead key={h} style={{ width: BATCH_WIDTHS[i] }} className="h-8 px-2 text-xs">{h}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, r) => (
            <TableRow key={r}>
              <TableCell className="px-2 py-1.5"><p className="flex h-5 items-center"><Skeleton className="h-3.5 w-16" /></p><p className="flex h-4 items-center"><Skeleton className={`h-3 ${MADE[r % 4]}`} /></p></TableCell>
              <TableCell className="px-2 py-1.5"><Skeleton className="h-3.5 w-12" /></TableCell>
              <TableCell className="px-2 py-1.5"><Skeleton className="h-3.5 w-20" /></TableCell>
              <TableCell className="px-2 py-1.5"><Skeleton className="h-3.5 w-8" /></TableCell>
              <TableCell className="px-2 py-1.5"><Skeleton className="h-3.5 w-20" /></TableCell>
              <TableCell className="px-2 py-1.5"><p className="flex h-5 items-center"><Skeleton className="h-3.5 w-20" /></p><p className="flex h-4 items-center"><Skeleton className="h-3 w-12" /></p></TableCell>
              <TableCell className="px-2 py-1.5"><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
