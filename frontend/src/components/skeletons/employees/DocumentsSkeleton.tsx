import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

const TYPE = ['w-28', 'w-36', 'w-24', 'w-32', 'w-28']
const FILE = ['w-32', 'w-24', 'w-40', 'w-28', 'w-36']

// Loading placeholder for the profile's documents table: the real column headings, `rows` rows of bars where the type,
// file name, status pill, uploaded line and the View button go
export function DocumentsSkeleton({ rows = 5, label = 'Loading', className }: { rows?: number; label?: string; className?: string }) {
  return (
    <div role="status" aria-label={label} className={cn('overflow-x-auto', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>File</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Uploaded / reviewed</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className={cn('h-3.5 rounded-full', TYPE[i % TYPE.length])} />
              </TableCell>
              <TableCell className="max-w-48">
                <Skeleton className={cn('h-3.5 max-w-full rounded-full', FILE[i % FILE.length])} />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-3 w-36 rounded-full" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="ml-auto h-7 w-16 rounded-full" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
