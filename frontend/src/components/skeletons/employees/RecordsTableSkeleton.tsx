import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

// a column's value: one line, a line over a small second line, a pill, or a pill over a small line - `width` the bar's
// width, as wide as a typical value so the columns sit where the loaded table puts them
export type RecordsCell = { className?: string; shape: 'line' | 'lines' | 'pill' | 'pill-line'; width: string }

const NAME = ['w-36', 'w-28', 'w-44', 'w-32']

// Loading placeholder for the employee records table: the real header row (`head` - the page's own column headings, so
// sorting still works), then `rows` rows as the table draws them - round initials, the name over the code, each shown
// column's value in its shape (`columns`, with the real columns' classes so the same ones hide on a phone) and the chevron
export function RecordsTableSkeleton({ head, columns, rows = 8, label = 'Loading', className }: { head: React.ReactNode; columns: RecordsCell[]; rows?: number; label?: string; className?: string }) {
  return (
    <div role="status" aria-label={label} className={cn('overflow-x-auto', className)}>
      <Table>
        <TableHeader>{head}</TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, r) => (
            <TableRow key={r}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Skeleton className="size-9 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <div className="flex h-5 items-center">
                      <Skeleton className={cn('h-3.5 max-w-full rounded-full', NAME[r % NAME.length])} />
                    </div>
                    {/* a phone has no Status column - the status pill sits beside the code */}
                    <div className="flex min-h-4 items-center gap-2">
                      <Skeleton className="h-3 w-20 rounded-full" />
                      <Skeleton className="h-5 w-14 rounded-full sm:hidden" />
                    </div>
                  </div>
                </div>
              </TableCell>
              {columns.map((c, i) => (
                <TableCell key={i} className={c.className}>
                  {c.shape === 'pill' ? (
                    <Skeleton className={cn('h-5 rounded-full', c.width)} />
                  ) : c.shape === 'pill-line' ? (
                    <>
                      <Skeleton className="h-5 w-12 rounded-full" />
                      <div className="mt-1 flex h-4 items-center">
                        <Skeleton className={cn('h-3 rounded-full', c.width)} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex h-5 items-center">
                        <Skeleton className={cn('h-3.5 max-w-full rounded-full', c.width)} />
                      </div>
                      {c.shape === 'lines' && (
                        <div className="flex h-4 items-center">
                          <Skeleton className="h-3 w-14 rounded-full" />
                        </div>
                      )}
                    </>
                  )}
                </TableCell>
              ))}
              <TableCell className="w-8">
                <Skeleton className="size-4 rounded" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
