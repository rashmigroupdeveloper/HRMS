import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { RunPeopleSkeleton } from '@/components/skeletons/payroll/RunPeopleSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { orpc } from '@/lib/orpc'
import { cn, formatDate, formatMoney } from '@/lib/utils'
import { PersonDetails } from './PersonDetails'
import { PEOPLE_COLUMNS, PEOPLE_FLAGS, PEOPLE_WIDTHS, dayCount } from './payroll-labels'

const PAGE = 50
type Flag = Exclude<(typeof PEOPLE_FLAGS)[number]['value'], ''>
type Counts = { noSalary: number; changed: number; hasInputs: number; notInPeriod: number; unpaidDays: number; unclearDays: number; allAbsent: number; payNotWorkedOut: number }

// The people of a run: who is paid, for how many days - in the run, paid and unpaid once the pay is worked out from
// the locked attendance (stage 3) - with what salary and what they earned (if the viewer may see salaries)
export function RunPeople({ runId, canChange }: { runId: number; canChange: boolean }) {
  const [search, setSearch] = useState('')
  const [flag, setFlag] = useState<Flag | ''>('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<number | null>(null)
  const deferred = useDeferredValue(search.trim())
  const query = useQuery({
    ...orpc.payroll.people.list.queryOptions({ input: { runId, search: deferred || undefined, flag: flag || undefined, page, pageSize: PAGE } }),
    placeholderData: keepPreviousData,
  })
  const data = query.data
  const stale = query.isFetching || search.trim() !== deferred
  return (
    <section className="min-w-0 space-y-3 rounded-2xl bg-card p-3 shadow-card sm:p-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1 space-y-1 sm:max-w-64">
          <Label htmlFor="pp-search" className="text-xs text-muted-foreground">Employee</Label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute top-2.5 left-2.5 size-3.5 text-muted-foreground" />
            <Input id="pp-search" className="h-9 pl-8 sm:h-8" placeholder="Code or name" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
          </div>
        </div>
        <div className="min-w-40 space-y-1">
          <Label htmlFor="pp-flag" className="text-xs text-muted-foreground">Show</Label>
          <NativeSelect id="pp-flag" className="w-full [&_select]:h-9 [&_select]:rounded-lg sm:[&_select]:h-8" value={flag} onChange={(e) => { setFlag(e.target.value as Flag | ''); setPage(1) }}>
            {PEOPLE_FLAGS.map((f) => (
              <NativeSelectOption key={f.value} value={f.value}>{f.label}{data && f.value ? ` (${countOf(data.counts, f.value)})` : ''}</NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
      <FormError error={query.error} />
      {query.isPending ? <RunPeopleSkeleton /> : data && (data.total === 0 ? (
        <EmptyState className="py-6" title={data.counts.all ? 'Nobody matches' : 'Nobody is in this run'} hint={data.counts.all ? 'Try another name or filter.' : 'Nobody worked for this company in the pay period by the job timeline. Refresh after adding employees.'} />
      ) : (
        <div className={cn('overflow-x-auto transition-opacity', stale && 'opacity-50')}>
          <Table aria-label="People in the run" className="min-w-[900px] table-fixed text-[13px]">
            <TableHeader>
              <TableRow>{PEOPLE_COLUMNS.map((h, i) => <TableHead key={h} style={{ width: PEOPLE_WIDTHS[i] }} className="h-8 px-2 text-xs">{h}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((p) => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-surface-2/30" onClick={() => setOpen(p.id)}>
                  <TableCell className="px-2 py-1.5">
                    <button type="button" className="text-left font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring" onClick={(e) => { e.stopPropagation(); setOpen(p.id) }}>{p.name || p.employeeCode}</button>
                    <p className="text-xs text-muted-foreground">{p.employeeCode}</p>
                  </TableCell>
                  <TableCell className="px-2 py-1.5 tabular-nums">{p.days}</TableCell>
                  <TableCell className="px-2 py-1.5 tabular-nums">{p.paidDays === null ? '—' : dayCount(p.paidDays)}</TableCell>
                  <TableCell className={cn('px-2 py-1.5 tabular-nums', !!p.unpaidDays && 'font-medium text-negative-ink')}>{p.unpaidDays === null ? '—' : dayCount(p.unpaidDays)}</TableCell>
                  <TableCell className="px-2 py-1.5 text-xs tabular-nums">{p.from && p.to ? `${formatDate(p.from)} – ${formatDate(p.to)}` : '—'}</TableCell>
                  <TableCell className="px-2 py-1.5 tabular-nums">{data.salaryHidden ? <span className="text-xs text-muted-foreground">Hidden</span> : p.monthlyGross !== null ? formatMoney(p.monthlyGross, 'INR') : '—'}</TableCell>
                  <TableCell className="px-2 py-1.5 font-medium tabular-nums">{data.salaryHidden ? <span className="text-xs font-normal text-muted-foreground">Hidden</span> : p.earnedGross !== null ? formatMoney(p.earnedGross, 'INR') : '—'}</TableCell>
                  <TableCell className="px-2 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {p.payStatus === 'HELD' && <Pill tone="warning">Pay held</Pill>}
                      {p.payStatus === 'AGAIN' && <Pill tone="warning">Work out again</Pill>}
                      {p.heldFor.includes('OTHER_CURRENCY') && <Pill tone="warning">Other currency</Pill>}
                      {p.flags.allAbsent && <Pill tone="warning">Absent throughout</Pill>}
                      {p.flags.unclearDays && <Pill tone="warning">Check {dayCount(p.unclearDays ?? 0)} {p.unclearDays === 1 ? 'day' : 'days'}</Pill>}
                      {p.flags.noSalary && <Pill tone="warning">No salary</Pill>}
                      {p.flags.notInPeriod && <Pill tone="warning">Not in the period</Pill>}
                      {p.flags.changed && <Pill tone="neutral">Changed</Pill>}
                      {p.inputs > 0 && <Pill tone="gold">{p.inputs} {p.inputs === 1 ? 'input' : 'inputs'}</Pill>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
      {data && data.total > PAGE && (
        <nav aria-label="People pages" className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">{(page - 1) * PAGE + 1}–{Math.min(page * PAGE, data.total)} of {data.total}</span>
          <div className="flex gap-1">
            <Button size="sm" variant="secondary" className="min-h-9 rounded-full" disabled={page <= 1 || stale} onClick={() => setPage(page - 1)}><ChevronLeft aria-hidden />Previous</Button>
            <Button size="sm" variant="secondary" className="min-h-9 rounded-full" disabled={page * PAGE >= data.total || stale} onClick={() => setPage(page + 1)}>Next<ChevronRight aria-hidden /></Button>
          </div>
        </nav>
      )}
      {open !== null && <PersonDetails runId={runId} personId={open} canChange={canChange} close={() => setOpen(null)} />}
    </section>
  )
}

function countOf(counts: Counts, flag: Flag) {
  return { NO_SALARY: counts.noSalary, CHANGED: counts.changed, HAS_INPUTS: counts.hasInputs, NOT_IN_PERIOD: counts.notInPeriod, UNPAID_DAYS: counts.unpaidDays, UNCLEAR_DAYS: counts.unclearDays, ALL_ABSENT: counts.allAbsent, PAY_NOT_WORKED_OUT: counts.payNotWorkedOut }[flag]
}
