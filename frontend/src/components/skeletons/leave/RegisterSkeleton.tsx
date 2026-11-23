import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

const NAME = ['w-32', 'w-40', 'w-28', 'w-36']

// Loading placeholder for the leave register (Team leave, Balances): the real table - "Employee" and a column per leave type
// (the types' codes come from the data, so bars), a typical number of rows with the name / code lines and the balances.
export function RegisterSkeleton({ rows = 6, types = 6, label }: { rows?: number; types?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 bg-card">Employee</TableHead>
            {Array.from({ length: types }, (_, i) => (
              <TableHead key={i} className="text-right">
                <Skeleton className="ml-auto h-3 w-7 rounded-full" />
              </TableHead>
            ))}
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, r) => (
            <TableRow key={r}>
              <TableCell className="sticky left-0 z-10 max-w-36 bg-card sm:max-w-none">
                <Skeleton className={cn('my-0.5 h-3.5 rounded-full', NAME[r % NAME.length])} />
                <Skeleton className="mt-1.5 h-3 w-28 rounded-full" />
              </TableCell>
              {Array.from({ length: types }, (_, i) => (
                <TableCell key={i}>
                  <Skeleton className="ml-auto h-3.5 w-6 rounded-full" />
                </TableCell>
              ))}
              <TableCell />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
