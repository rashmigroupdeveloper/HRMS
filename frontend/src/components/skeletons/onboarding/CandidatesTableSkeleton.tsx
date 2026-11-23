import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

const NAME = ['w-36', 'w-28', 'w-44', 'w-32']
const POSITION = ['w-24', 'w-32', 'w-28', 'w-20']

// Loading placeholder for the onboarding page's candidate table: the real column headings and rows of the real row
// (name over mobile, position over company · location · type, joining date, status pill, joining confirmed), with
// the same columns hidden on a phone.
export function CandidatesTableSkeleton({ rows = 6, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Candidate</TableHead>
            <TableHead className="hidden md:table-cell">Position</TableHead>
            <TableHead className="hidden sm:table-cell">Joining date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden lg:table-cell">Joining confirmed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, r) => (
            <TableRow key={r}>
              <TableCell>
                <div className="flex h-5 items-center">
                  <Skeleton className={cn('h-3.5 rounded-full', NAME[r % NAME.length])} />
                </div>
                <div className="flex h-4 items-center">
                  <Skeleton className="h-3 w-20 rounded-full" />
                </div>
                {/* narrow screens: the position under the name (on a phone with the joining date) */}
                <div className="flex h-4 items-center md:hidden">
                  <Skeleton className={cn('h-3 rounded-full max-sm:w-44', POSITION[r % POSITION.length])} />
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="flex h-5 items-center">
                  <Skeleton className={cn('h-3.5 rounded-full', POSITION[r % POSITION.length])} />
                </div>
                <div className="flex h-4 items-center">
                  <Skeleton className="h-3 w-44 rounded-full" />
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Skeleton className="h-3.5 w-24 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-20 rounded-full" />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <Skeleton className="h-3.5 w-12 rounded-full" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
