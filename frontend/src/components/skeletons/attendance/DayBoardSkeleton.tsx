import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// Loading placeholder for PeopleView's day board (DayBoard): the day's counts line, then the table with its real column
// headings and rows of bars - the name with the code and department under it, the shift, in / out / worked and the status
// pill (change both together). Without a `label` (inside another skeleton) it is not a status of its own.
export function DayBoardSkeleton({ rows = 8, label }: { rows?: number; label?: string }) {
  return (
    <div role={label ? 'status' : undefined} aria-label={label} className="space-y-2">
      <Skeleton className="h-3 w-64 max-w-full rounded-full" />
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead className="hidden min-w-24 sm:table-cell">Shift</TableHead>
              <TableHead className="hidden min-w-28 text-right sm:table-cell">In</TableHead>
              <TableHead className="hidden min-w-20 text-right sm:table-cell">Out</TableHead>
              <TableHead className="hidden min-w-24 text-right sm:table-cell">Worked</TableHead>
              <TableHead className="text-right sm:min-w-40">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }, (_, i) => (
              <TableRow key={i}>
                <TableCell className="space-y-1.5">
                  <Skeleton className="h-3.5 w-36 rounded-full" />
                  <Skeleton className="h-3 w-24 rounded-full" />
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Skeleton className="h-3 w-10 rounded-full" />
                </TableCell>
                {['w-10', 'w-10', 'w-12'].map((w, j) => (
                  <TableCell key={j} className="hidden sm:table-cell">
                    <Skeleton className={`ml-auto h-3.5 rounded-full ${w}`} />
                  </TableCell>
                ))}
                <TableCell>
                  <Skeleton className="ml-auto h-5 w-16 rounded-full" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
