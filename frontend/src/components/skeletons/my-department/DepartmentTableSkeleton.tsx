import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

const NAME = ['w-32', 'w-28', 'w-36', 'w-24']
const VALUE = ['w-24', 'w-20', 'w-28', 'w-16']

// Loading placeholder for the My department page's card: the post chip, the page's own search (`search`, still usable),
// then the table with its real column headings (`headings`) and `rows` rows of bars where the name and code, the
// designation, the department over the company · plant, the joining day, the manager and the e-mail go
export function DepartmentTableSkeleton({ headings, search, rows = 8, label = 'Loading', className }: { headings: string[]; search: React.ReactNode; rows?: number; label?: string; className?: string }) {
  return (
    <section role="status" aria-label={label} className={cn('space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-7 w-64 max-w-full rounded-full" />
        {search}
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {headings.map((heading) => (
              <TableHead key={heading} className="text-xs text-muted-foreground">
                {heading}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, r) => (
            <TableRow key={r}>
              <TableCell className="min-w-44">
                <div className="flex h-5 items-center gap-1.5">
                  <Skeleton className={cn('h-3.5 rounded-full', NAME[r % NAME.length])} />
                  <Skeleton className="h-3 w-16 rounded-full" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className={cn('h-3.5 rounded-full', VALUE[r % VALUE.length])} />
              </TableCell>
              <TableCell>
                <div className="flex h-5 items-center">
                  <Skeleton className="h-3.5 w-24 rounded-full" />
                </div>
                <div className="flex h-4 items-center">
                  <Skeleton className="h-3 w-36 rounded-full" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-3.5 w-20 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className={cn('h-3.5 rounded-full', NAME[(r + 1) % NAME.length])} />
              </TableCell>
              <TableCell>
                <Skeleton className="h-3.5 w-40 rounded-full" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
