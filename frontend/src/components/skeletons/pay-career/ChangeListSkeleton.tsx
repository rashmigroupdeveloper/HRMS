import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

const NAME = ['w-28', 'w-36', 'w-24', 'w-32']
const KIND = ['w-20', 'w-28', 'w-24', 'w-16']
const CHANGED = ['w-36', 'w-24', 'w-44', 'w-28']

// Loading placeholder for a list of job changes (Pay & career's change register and "Raise a change"), drawn like the
// real ChangeList: on a wide screen the table in a card with its real headings (Employee, Change, From, Status, Asked) and
// per row the initials, the kind's tile, two lines per cell and the status pill; on a phone one card per change.
export function ChangeListSkeleton({ rows = 8, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label}>
      <div className="hidden overflow-hidden rounded-2xl bg-card shadow-card sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Change</TableHead>
              <TableHead className="w-32">From</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-36">Asked</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }, (_, r) => (
              <TableRow key={r}>
                <TableCell>
                  <span className="flex items-center gap-2.5">
                    <span className="size-8 shrink-0 rounded-full bg-surface-2" />
                    <Lines first={NAME[r % 4]} second="w-16" tall />
                  </span>
                </TableCell>
                <TableCell className="max-w-sm">
                  <span className="flex items-center gap-2.5">
                    <span className="size-8 shrink-0 rounded-xl bg-surface-2" />
                    <Lines first={KIND[r % 4]} second={CHANGED[r % 4]} />
                  </span>
                </TableCell>
                <TableCell>
                  <Lines first="w-20" second="w-14" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-24 rounded-full" />
                </TableCell>
                <TableCell>
                  <Lines first="w-20" second={NAME[(r + 1) % 4]} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl bg-card shadow-card sm:hidden">
        {Array.from({ length: Math.min(rows, 6) }, (_, r) => (
          <li key={r} className="flex items-start gap-3 px-3 py-3">
            <span className="size-8 shrink-0 rounded-xl bg-surface-2" />
            <span className="min-w-0 flex-1 space-y-1">
              <span className="flex h-6 items-center justify-between gap-2">
                <Skeleton className={cn('h-4 rounded-full', NAME[r % 4])} />
                <Skeleton className="h-3 w-16 rounded-full" />
              </span>
              <span className="flex h-5 items-center">
                <Skeleton className={cn('h-3.5 rounded-full', KIND[r % 4])} />
              </span>
              <span className="flex h-4 items-center">
                <Skeleton className={cn('h-3 max-w-full rounded-full', CHANGED[r % 4])} />
              </span>
              <Skeleton className="h-6 w-24 rounded-full" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// a cell's two lines as tall as the real text: the value, and the small line under it (`tall`: the employee's code sits
// in a full text line, so that cell is the row's tallest)
function Lines({ first, second, tall }: { first: string; second: string; tall?: boolean }) {
  return (
    <span className="block min-w-0">
      <span className="flex h-5 items-center">
        <Skeleton className={cn('h-3.5 max-w-full rounded-full', first)} />
      </span>
      <span className={cn('flex items-center', tall ? 'h-5' : 'h-4')}>
        <Skeleton className={cn('h-3 max-w-full rounded-full', second)} />
      </span>
    </span>
  )
}
