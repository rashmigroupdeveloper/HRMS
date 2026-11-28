import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PEOPLE_COLUMNS, PEOPLE_WIDTHS } from '@/pages/payroll/components/deposits-labels'

const NAME = ['w-28', 'w-36', 'w-24', 'w-32']

// Loading placeholder for the people of a month's PF or ESIC (Statutory deposits › a month): the real headings and rows of
// bars shaped like the real rows (name over code, the number, three amounts, the left-out mark) - the section's heading and
// filters stay real above it
export function DepositPeopleSkeleton({ rows = 6, numberLabel, label = 'Loading' }: { rows?: number; numberLabel: string; label?: string }) {
  return (
    <div role="status" aria-label={label} className="overflow-x-auto">
      <Table aria-label="People" className="min-w-[820px] table-fixed text-[13px]">
        <TableHeader>
          <TableRow>
            {PEOPLE_COLUMNS.map((h, i) => (
              <TableHead key={`${h}-${i}`} style={{ width: PEOPLE_WIDTHS[i] }} className="h-8 px-2 text-xs">{i === 0 ? <Skeleton className="size-4 rounded" /> : i === 2 ? numberLabel : h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, r) => (
            <TableRow key={r}>
              <TableCell className="px-2 py-1.5"><Skeleton className="size-4 rounded" /></TableCell>
              <TableCell className="px-2 py-1.5"><p className="flex h-5 items-center"><Skeleton className={`h-3.5 ${NAME[r % 4]}`} /></p><p className="flex h-4 items-center"><Skeleton className="h-3 w-16" /></p></TableCell>
              <TableCell className="px-2 py-1.5"><Skeleton className="h-3.5 w-24" /></TableCell>
              <TableCell className="px-2 py-1.5"><Skeleton className="h-3.5 w-14" /></TableCell>
              <TableCell className="px-2 py-1.5"><Skeleton className="h-3.5 w-12" /></TableCell>
              <TableCell className="px-2 py-1.5"><Skeleton className="h-3.5 w-12" /></TableCell>
              <TableCell className="px-2 py-1.5"><Skeleton className={`h-3.5 ${r % 3 === 0 ? 'w-24' : 'w-4'}`} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
