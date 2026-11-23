import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TYPE_HEADINGS } from '@/pages/leave/components/labels'

// Loading placeholder for the leave types table (Team leave, Leave types): the real headings, rows of bars.
export function LeaveTypesSkeleton({ rows = 6, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {TYPE_HEADINGS.map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, r) => (
            <TableRow key={r}>
              <TableCell>
                <Skeleton className="h-3.5 w-8 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-3.5 w-32 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-3.5 w-10 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-3.5 w-16 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-3.5 w-12 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-3.5 w-40 rounded-full" />
              </TableCell>
              {/* the real rows' Edit button (its height sets the row's) */}
              <TableCell className="text-right">
                <Skeleton className="ml-auto h-8 w-12 rounded-full" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
