import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DEPOSIT_COLUMNS, DEPOSIT_WIDTHS, MONTH_TILE_LABELS } from '@/pages/payroll/components/deposits-labels'
import { DepositPeopleSkeleton } from './DepositPeopleSkeleton'

// Loading placeholder for one company's pay month of Statutory deposits (/manage/statutory-deposits/:company/:month), drawn
// like the real page: the title (the month is known from the address - real text), the scheme tabs, the tiles with their
// real labels, the state line, the "Returns and challans" card with its real headings and, for PF and ESIC, the people card
// - the texts that do not come from the data stay real
// `people`: the PF / ESIC asked for in the address - its people card, with its number's heading (UAN / ESIC number);
// `canRecord`: Statutory deposits Edit - the "Record" button's place (it wraps under the heading on a phone); `pieces`: how
// many pieces the scheme asked for has (PF 4, ESIC and LWF 2, professional tax 1)
export function DepositMonthSkeleton({ month, people, canRecord, pieces, label = 'Loading' }: { month: string; people: 'PF' | 'ESIC' | null; canRecord: boolean; pieces: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-4">
      <header className="space-y-1">
        <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-2xl font-light tracking-tight"><Skeleton className="h-6 w-14" /><span>· {month}</span></h1>
        </div>
        <p className="flex h-5 items-center"><Skeleton className="h-3.5 w-56" /></p>
      </header>
      {/* the scheme tabs: the same strip as the real tab list, a bar per tab */}
      <div className="flex w-full gap-0.5 rounded-full bg-card p-1 shadow-card">
        {['w-14', 'w-16', 'w-40', 'w-40'].map((w) => <Skeleton key={w} className={`h-[34px] rounded-full ${w}`} />)}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {MONTH_TILE_LABELS.map((title, i) => (
          <div key={title} className={`min-w-0 rounded-2xl bg-card px-3 py-2 shadow-card ${i === 0 ? 'col-span-2 sm:col-span-1' : ''}`}>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="flex h-7 items-center"><Skeleton className="h-5 w-24" /></p>
            <p className="flex h-4 items-center"><Skeleton className="h-3 w-16" /></p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="h-3.5 w-56" />
      </div>
      {/* the pieces of what is due (their names depend on the scheme) */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
        {['w-24', 'w-24', 'w-20', 'w-12'].slice(0, pieces).map((w, i) => (
          <div key={i} className="min-w-0">
            <p className="flex h-4 items-center"><Skeleton className={`h-3 ${w}`} /></p>
            <p className="flex h-5 items-center"><Skeleton className="h-3.5 w-36" /></p>
          </div>
        ))}
      </div>
      <section className="space-y-2 rounded-2xl bg-card p-3 shadow-card sm:p-4">
        <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-medium">Returns and challans</h2>
          {canRecord && <Skeleton className="h-9 w-[215px] rounded-full" />}
        </div>
        <div className="overflow-x-auto">
          <Table aria-label="Returns and challans" className="min-w-[760px] table-fixed text-[13px]">
            <TableHeader>
              <TableRow>{DEPOSIT_COLUMNS.map((h, i) => <TableHead key={`${h}-${i}`} style={{ width: DEPOSIT_WIDTHS[i] }} className="h-8 px-2 text-xs">{h}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {[0].map((r) => (
                <TableRow key={r}>
                  <TableCell className="px-2 py-1.5"><p className="flex h-5 items-center"><Skeleton className="h-3.5 w-28" /></p><p className="flex h-4 items-center"><Skeleton className="h-3 w-24" /></p></TableCell>
                  <TableCell className="px-2 py-1.5"><Skeleton className="h-3.5 w-20" /></TableCell>
                  <TableCell className="px-2 py-1.5"><Skeleton className="h-3.5 w-20" /></TableCell>
                  <TableCell className="px-2 py-1.5"><Skeleton className="h-3.5 w-14" /></TableCell>
                  <TableCell className="px-2 py-1.5"><p className="flex h-5 items-center"><Skeleton className="h-3.5 w-20" /></p><p className="flex h-4 items-center"><Skeleton className="h-3 w-24" /></p></TableCell>
                  <TableCell className="px-2 py-1.5" />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
      {people && (
        <section className="space-y-2 rounded-2xl bg-card p-3 shadow-card sm:p-4">
          <div className="flex min-h-9 items-center justify-between gap-2"><h2 className="text-base font-medium">People</h2></div>
          {/* the filters' labels are real, the controls wait for the counts */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-full space-y-1 sm:w-44"><p className="text-xs text-muted-foreground">Show</p><Skeleton className="h-9 w-full rounded-md" /></div>
            <div className="w-full space-y-1 sm:w-64"><p className="text-xs text-muted-foreground">Employee</p><Skeleton className="h-9 w-full rounded-md" /></div>
          </div>
          <DepositPeopleSkeleton rows={4} numberLabel={people === 'PF' ? 'UAN' : 'ESIC number'} />
        </section>
      )}
    </div>
  )
}
