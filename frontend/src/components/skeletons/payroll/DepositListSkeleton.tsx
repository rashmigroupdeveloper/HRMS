import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LIST_COLUMNS, LIST_TILES, LIST_WIDTHS } from '@/pages/payroll/components/deposits-labels'

const SCHEME = ['w-10', 'w-28', 'w-16', 'w-24']
const DETAIL = ['w-32', 'w-24', 'w-40', 'w-28']

// Loading placeholder for the statutory deposits list (/manage/statutory-deposits), drawn like the real one: the tiles with
// their real labels, then the table with its real headings and rows of bars - the filters stay usable above it
export function DepositListSkeleton({ rows = 8, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {LIST_TILES.map((title, i) => (
          <div key={title} className={`min-w-0 rounded-2xl bg-card px-3 py-2 shadow-card ${i === 0 ? 'col-span-2 sm:col-span-1' : ''}`}>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="flex h-7 items-center"><Skeleton className="h-5 w-10" /></p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl bg-card p-3 shadow-card sm:p-4">
        <Table aria-label="Deposits" className="min-w-[760px] table-fixed text-[13px]">
          <TableHeader>
            <TableRow>{LIST_COLUMNS.map((h, i) => <TableHead key={h} style={{ width: LIST_WIDTHS[i] }} className="h-8 px-2 text-xs">{h}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }, (_, r) => (
              <TableRow key={r}>
                <TableCell className="px-2 py-1.5"><p className="flex h-5 items-center"><Skeleton className="h-3.5 w-16" /></p><p className="flex h-4 items-center"><Skeleton className="h-3 w-10" /></p></TableCell>
                <TableCell className="px-2 py-1.5"><p className="flex h-5 items-center"><Skeleton className={`h-3.5 ${SCHEME[r % 4]}`} /></p><p className="flex h-4 items-center"><Skeleton className="h-3 w-14" /></p></TableCell>
                <TableCell className="px-2 py-1.5"><Skeleton className="h-3.5 w-20" /></TableCell>
                <TableCell className="px-2 py-1.5"><Skeleton className="h-3.5 w-20" /></TableCell>
                <TableCell className="px-2 py-1.5"><Skeleton className="h-3.5 w-20" /></TableCell>
                <TableCell className="px-2 py-1.5"><p className="flex h-[22px] items-center"><Skeleton className="h-5 w-24 rounded-full" /></p><p className="mt-0.5 flex h-4 items-center"><Skeleton className={`h-3 ${DETAIL[r % 4]}`} /></p></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
