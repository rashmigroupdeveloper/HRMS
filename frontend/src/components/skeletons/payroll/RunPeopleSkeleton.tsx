import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PEOPLE_COLUMNS, PEOPLE_WIDTHS } from '@/pages/payroll/components/payroll-labels'

// The people table of a run while it loads - same columns and row height as RunPeople (change both together)
export function RunPeopleSkeleton({ label = 'Loading people' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="overflow-x-auto">
      <Table className="min-w-[720px] table-fixed text-[13px]">
        <TableHeader>
          <TableRow>{PEOPLE_COLUMNS.map((h, i) => <TableHead key={h} style={{ width: PEOPLE_WIDTHS[i] }} className="h-8 px-2 text-xs">{h}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 8 }, (_, i) => (
            <TableRow key={i}>
              <TableCell className="px-2 py-1.5"><Skeleton className="h-4 w-40" /><Skeleton className="mt-1 h-3 w-20" /></TableCell>
              <TableCell className="px-2 py-1.5"><Skeleton className="h-4 w-6" /></TableCell>
              <TableCell className="px-2 py-1.5"><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell className="px-2 py-1.5"><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell className="px-2 py-1.5"><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
