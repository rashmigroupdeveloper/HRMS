import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

const CHECK = ['w-28', 'w-36', 'w-24']
const SUBJECT = ['w-40', 'w-32', 'w-36']

// Loading placeholder for a candidate's background checks table: the real column headings and rows of the real row -
// the check over what is checked, the agency over its case id, the result pill over its remarks, started / completed,
// and (`editable`) "Record result".
export function BackgroundChecksTableSkeleton({ rows = 3, editable = false, label = 'Loading' }: { rows?: number; editable?: boolean; label?: string }) {
  return (
    <div role="status" aria-label={label}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Check</TableHead>
            <TableHead>Agency</TableHead>
            <TableHead>Result</TableHead>
            <TableHead>Started / completed</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, r) => (
            <TableRow key={r}>
              <TableCell>
                <div className="flex h-5 items-center">
                  <Skeleton className={cn('h-3.5 rounded-full', CHECK[r % CHECK.length])} />
                </div>
                <div className="flex h-4 items-center">
                  <Skeleton className={cn('h-3 rounded-full', SUBJECT[r % SUBJECT.length])} />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex h-5 items-center">
                  <Skeleton className="h-3.5 w-28 rounded-full" />
                </div>
                <div className="flex h-4 items-center">
                  <Skeleton className="h-3 w-24 rounded-full" />
                </div>
              </TableCell>
              <TableCell className="max-w-56">
                <Skeleton className="h-6 w-16 rounded-full" />
                <div className="mt-1 flex h-4 items-center">
                  <Skeleton className="h-3 w-48 max-w-full rounded-full" />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex h-4 items-center">
                  <Skeleton className="h-3 w-40 rounded-full" />
                </div>
                <div className="flex h-4 items-center">
                  <Skeleton className="h-3 w-24 rounded-full" />
                </div>
              </TableCell>
              <TableCell>
                {editable && (
                  <div className="flex justify-end gap-1">
                    <Button variant="secondary" size="sm" disabled>
                      Record result
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
