import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { OWED_COLUMNS, OWED_STATE, OWED_STATES, OWED_TOTAL_LABEL, OWED_WIDTHS } from '@/pages/payroll/components/payments-labels'

const NAME = ['w-28', 'w-36', 'w-24', 'w-32']
const DETAIL = ['w-32', 'w-24', 'w-40', 'w-28']

// Loading placeholder for the owed list (Salary payments › To pay & owed), drawn like the real one: the state tiles with
// their real labels, then the table with its real headings and rows of bars - the filters stay usable above it
export function OwedListSkeleton({ rows = 8, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {OWED_STATES.map((s) => OWED_STATE[s][0]).map((title) => (
          <div key={title} className="min-w-0 rounded-2xl bg-card px-3 py-2 text-left shadow-card">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="flex h-7 items-center"><Skeleton className="h-5 w-24" /></p>
            <p className="flex h-4 items-center"><Skeleton className="h-3 w-12" /></p>
          </div>
        ))}
        {/* the total is a dark tile - dark while loading too, its bars light on dark */}
        <div className="min-w-0 rounded-2xl bg-hero px-3 py-2 text-hero-foreground shadow-card">
          <p className="text-xs opacity-75">{OWED_TOTAL_LABEL}</p>
          <p className="flex h-7 items-center"><Skeleton className="h-5 w-24 bg-hero-foreground/10" /></p>
          <p className="flex h-4 items-center"><Skeleton className="h-3 w-12 bg-hero-foreground/10" /></p>
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl bg-card p-3 shadow-card sm:p-4">
        <Table aria-label="Owed" className="min-w-[860px] table-fixed text-[13px]">
          <TableHeader>
            <TableRow>
              {OWED_COLUMNS.map((h, i) => <TableHead key={`${h}-${i}`} style={{ width: OWED_WIDTHS[i] }} className="h-8 px-2 text-xs">{h}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }, (_, r) => (
              <TableRow key={r}>
                <TableCell className="px-2 py-1.5"><Skeleton className="size-4 rounded" /></TableCell>
                <TableCell className="px-2 py-1.5"><p className="flex h-5 items-center"><Skeleton className={`h-3.5 ${NAME[r % 4]}`} /></p><p className="flex h-4 items-center"><Skeleton className="h-3 w-16" /></p></TableCell>
                <TableCell className="px-2 py-1.5"><p className="flex h-5 items-center"><Skeleton className="h-3.5 w-16" /></p><p className="flex h-4 items-center"><Skeleton className="h-3 w-10" /></p></TableCell>
                <TableCell className="px-2 py-1.5"><Skeleton className="h-3.5 w-16" /></TableCell>
                <TableCell className="px-2 py-1.5"><p className="flex h-5 items-center"><Skeleton className="h-5 w-20 rounded-full" /></p><p className="flex h-4 items-center"><Skeleton className={`h-3 ${DETAIL[r % 4]}`} /></p></TableCell>
                <TableCell className="px-2 py-1.5"><Skeleton className="h-3.5 w-24" /></TableCell>
                <TableCell className="px-2 py-1.5"><Skeleton className="h-3.5 w-12" /></TableCell>
                <TableCell className="px-2 py-1.5"><Skeleton className="h-7 w-14 rounded-full" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
