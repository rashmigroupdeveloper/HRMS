import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BATCH_FACT_LABELS, BATCH_PAYMENT_COLUMNS, BATCH_PAYMENT_WIDTHS, BATCH_TILE_LABELS } from '@/pages/payroll/components/payments-labels'

const NAME = ['w-28', 'w-36', 'w-24', 'w-32']

// Loading placeholder for one payment batch (Salary payments › a batch), drawn like the real page: the title and pills,
// the company line, the facts and tiles with their real labels, then the payments table with its real headings
export function PaymentBatchSkeleton({ rows = 8, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex h-9 items-center"><Skeleton className="h-6 w-48" /></p>
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <p className="flex h-5 items-center"><Skeleton className="h-3.5 w-56" /></p>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          {BATCH_FACT_LABELS.map((l) => (
            <div key={l}>
              <dt className="text-xs text-muted-foreground">{l}</dt>
              <dd className="flex h-5 items-center"><Skeleton className="h-3.5 w-40" /></dd>
            </div>
          ))}
        </dl>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {BATCH_TILE_LABELS.map((l, i) => (
            <div key={l} className={`min-w-0 rounded-2xl bg-card px-3 py-2 shadow-card ${i === 0 ? 'col-span-2 sm:col-span-1' : ''}`}>
              <p className="text-xs text-muted-foreground">{l}</p>
              <p className="flex h-7 items-center"><Skeleton className="h-5 w-20" /></p>
            </div>
          ))}
        </div>
        {/* the line of what to do next (open and sent batches) */}
        <p className="flex h-4 items-center"><Skeleton className="h-3 w-96 max-w-full" /></p>
      </div>
      <div className="overflow-x-auto rounded-2xl bg-card p-3 shadow-card sm:p-4">
        <Table aria-label="Payments" className="min-w-[760px] table-fixed text-[13px]">
          <TableHeader>
            <TableRow>{BATCH_PAYMENT_COLUMNS.map((h, i) => <TableHead key={`${h}-${i}`} style={{ width: BATCH_PAYMENT_WIDTHS[i] }} className="h-8 px-2 text-xs">{h}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }, (_, r) => (
              <TableRow key={r}>
                <TableCell className="px-2 py-1.5"><p className="flex h-5 items-center"><Skeleton className={`h-3.5 ${NAME[r % 4]}`} /></p><p className="flex h-4 items-center"><Skeleton className="h-3 w-16" /></p></TableCell>
                <TableCell className="px-2 py-1.5"><Skeleton className="h-3.5 w-16" /></TableCell>
                <TableCell className="px-2 py-1.5"><Skeleton className="h-3.5 w-16" /></TableCell>
                <TableCell className="px-2 py-1.5"><p className="flex h-5 items-center"><Skeleton className="h-3.5 w-28" /></p><p className="flex h-4 items-center"><Skeleton className="h-3 w-20" /></p></TableCell>
                <TableCell className="px-2 py-1.5"><p className="flex h-5 items-center"><Skeleton className="h-5 w-16 rounded-full" /></p><p className="flex h-4 items-center"><Skeleton className="h-3 w-28" /></p></TableCell>
                <TableCell className="px-2 py-1.5" />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
