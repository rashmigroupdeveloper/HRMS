import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// A table of the statutory settings page while it loads - the tab's own column headings and widths (from
// statutory-labels.ts, as the real table uses them), with value bars in the real rows' place and height. `lines`: how
// many text lines a column's real cell has (the rate and its group, a name and its code, a list of slabs) - 1 if left out.
export function StatutoryTableSkeleton({ columns, widths, rows = 6, lines = [], label = 'Loading statutory settings' }: { columns: readonly string[]; widths: readonly string[]; rows?: number; lines?: number[]; label?: string }) {
  return (
    <div role="status" aria-label={label} className="overflow-x-auto">
      <Table className="min-w-[720px] table-fixed text-[13px]">
        <TableHeader>
          <TableRow>{columns.map((h, i) => <TableHead key={`${h}-${i}`} style={{ width: widths[i] }} className="h-8 px-2 text-xs">{h}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, r) => (
            <TableRow key={r}>
              {columns.map((h, i) => (
                <TableCell key={`${h}-${i}`} className="px-2 py-2 align-top">
                  {i < columns.length - 1 && (
                    <>
                      <Skeleton className="my-0.5 h-4" style={{ width: `${[70, 55, 80, 65, 50, 60, 45][i % 7]}%` }} />
                      {Array.from({ length: (lines[i] ?? 1) - 1 }, (_, n) => <Skeleton key={n} className="mt-1 h-3" style={{ width: `${[40, 60, 50][n % 3]}%` }} />)}
                    </>
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
