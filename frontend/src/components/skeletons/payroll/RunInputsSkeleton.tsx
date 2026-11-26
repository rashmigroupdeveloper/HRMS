import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { INPUT_COLUMNS, INPUT_WIDTHS } from '@/pages/payroll/components/payroll-labels'

// The inputs table of a run while it loads - same columns and row height as RunInputs (change both together)
export function RunInputsSkeleton({ label = 'Loading inputs' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="overflow-x-auto">
      <Table className="min-w-[760px] table-fixed text-[13px]">
        <TableHeader>
          <TableRow>{INPUT_COLUMNS.map((h, i) => <TableHead key={`${h}-${i}`} style={{ width: INPUT_WIDTHS[i] }} className="h-8 px-2 text-xs">{h}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }, (_, i) => (
            <TableRow key={i}>
              <TableCell className="px-2 py-1.5"><Skeleton className="h-4 w-36" /><Skeleton className="mt-1 h-3 w-20" /></TableCell>
              <TableCell className="px-2 py-1.5"><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell className="px-2 py-1.5"><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell className="px-2 py-1.5"><Skeleton className="h-4 w-44" /></TableCell>
              <TableCell className="px-2 py-1.5"><Skeleton className="h-4 w-28" /></TableCell>
              <TableCell className="px-2 py-1.5" />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
