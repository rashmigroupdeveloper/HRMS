import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

const TYPE = ['w-28', 'w-36', 'w-24', 'w-32']
const FILE = ['w-40', 'w-32', 'w-36', 'w-28']

// Loading placeholder for a candidate's documents table (the Documents tab): the real column headings and rows of the
// real row - type, file name · size, status pill, uploaded by, and the "View" button (disabled until the row is there).
export function DocumentsTableSkeleton({ rows = 4, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>File</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Uploaded / reviewed</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, r) => (
            <TableRow key={r}>
              <TableCell>
                <Skeleton className={cn('h-3.5 rounded-full', TYPE[r % TYPE.length])} />
              </TableCell>
              <TableCell className="max-w-48">
                <Skeleton className={cn('h-3.5 max-w-full rounded-full', FILE[r % FILE.length])} />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-20 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-3 w-40 rounded-full" />
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" disabled>
                    <Download /> View
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
