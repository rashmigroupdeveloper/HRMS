import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { PROGRESS_STEPS } from '@/pages/onboarding/components/labels'

const NAME = ['w-36', 'w-28', 'w-44', 'w-32']
const POSITION = ['w-24', 'w-32', 'w-28', 'w-20']
const DONE = [2, 4, 1, 3]

// Loading placeholder for the onboarding page's candidate table: the real column headings and rows of the real row
// (avatar beside name over mobile, position over company · location · type, joining date over "in N days", the
// progress steps over the next step, status pill, the round open button), with the same columns hidden on a phone.
export function CandidatesTableSkeleton({ rows = 6, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Candidate</TableHead>
            <TableHead className="hidden md:table-cell">Position</TableHead>
            <TableHead className="hidden sm:table-cell">Joining date</TableHead>
            <TableHead className="hidden lg:table-cell">Progress</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden w-12 sm:table-cell">
              <span className="sr-only">Open</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, r) => (
            <TableRow key={r}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Skeleton className="size-9 shrink-0 rounded-full" />
                  <div>
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
                  </div>
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
                <div className="flex h-5 items-center">
                  <Skeleton className="h-3.5 w-24 rounded-full" />
                </div>
                <div className="flex h-4 items-center">
                  <Skeleton className="h-3 w-14 rounded-full" />
                </div>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <div className="w-40">
                  <div className="flex gap-1">
                    {PROGRESS_STEPS.map((step, i) => (
                      <Skeleton key={step} className={cn('h-1.5 flex-1 rounded-full', i >= DONE[r % DONE.length]! && 'opacity-40')} />
                    ))}
                  </div>
                  <div className="mt-1.5 flex h-4 items-center">
                    <Skeleton className="h-3 w-28 rounded-full" />
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-20 rounded-full" />
                <div className="mt-1 flex h-4 items-center lg:hidden">
                  <Skeleton className="h-3 w-24 rounded-full" />
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Skeleton className="size-8 rounded-full" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
