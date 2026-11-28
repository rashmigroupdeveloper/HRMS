import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/FormError'
import { Pager } from '@/components/Pager'
import { Pill } from '@/components/Pill'
import { DepositListSkeleton } from '@/components/skeletons/payroll/DepositListSkeleton'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { orpc } from '@/lib/orpc'
import { cn, formatDate, formatMoney } from '@/lib/utils'
import { standingDetail } from './components/deposit-standing'
import { DEPOSITS_NOTE, DEPOSITS_TITLE, DEPOSIT_STATE, LIST_COLUMNS, LIST_TILES, LIST_WIDTHS, MONTH_LABEL, SHOW, monthPath, schemeName } from './components/deposits-labels'

const PAGE_SIZE = 50
const positive = (text: string | null) => (text && /^\d+$/.test(text) && Number(text) > 0 && Number.isSafeInteger(Number(text)) ? Number(text) : undefined)
const inr = (amount: number) => formatMoney(amount, 'INR')

// Statutory deposits (/manage/statutory-deposits - payroll stage 6 slice 3, approved by the user 2026-11-28): each company's
// pay month and scheme of the approved runs - PF, ESIC, professional tax and LWF per State - with what is due, what is
// deposited, the due date and where it stands; the open ones (anything not fully deposited) first, the most overdue on top.
// Open a row for the month: the returns and challans, the people left out. The "Statutory deposits" area over the whole
// company (RequireAccess); the filters live in the address (company, show, page).
export function StatutoryDepositsPage() {
  const [params, setParams] = useSearchParams()
  const filters = { companyId: positive(params.get('company')), show: params.get('show') === 'ALL' ? ('ALL' as const) : ('OPEN' as const), page: positive(params.get('page')) ?? 1 }
  const query = useQuery(orpc.payroll.deposits.list.queryOptions({ input: { ...filters, pageSize: PAGE_SIZE } }))
  const data = query.data
  const setFilter = (key: string, value: string) =>
    setParams(
      (old) => {
        const next = new URLSearchParams(old)
        if (value) next.set(key, value)
        else next.delete(key)
        if (key !== 'page') next.delete('page')
        return next
      },
      { replace: true },
    )
  const tiles = data ? [data.counts.open, data.counts.overdue, data.counts.dueSoon, data.counts.filedNotPaid, data.counts.peopleLeftOut] : []
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-light tracking-tight">{DEPOSITS_TITLE}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{DEPOSITS_NOTE}</p>
      </header>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-full space-y-1 sm:w-64">
          <Label htmlFor="dp-company" className="text-xs text-muted-foreground">Company</Label>
          <NativeSelect id="dp-company" className="w-full [&_select]:h-9" value={filters.companyId ? String(filters.companyId) : ''} onChange={(e) => setFilter('company', e.target.value)}>
            <NativeSelectOption value="">Every company</NativeSelectOption>
            {data?.companies.map((c) => <NativeSelectOption key={c.id} value={String(c.id)}>{c.code} · {c.name}</NativeSelectOption>)}
          </NativeSelect>
        </div>
        <div className="w-full space-y-1 sm:w-44">
          <Label htmlFor="dp-show" className="text-xs text-muted-foreground">Show</Label>
          <NativeSelect id="dp-show" className="w-full [&_select]:h-9" value={filters.show} onChange={(e) => setFilter('show', e.target.value === 'ALL' ? 'ALL' : '')}>
            {(Object.keys(SHOW) as (keyof typeof SHOW)[]).map((s) => <NativeSelectOption key={s} value={s}>{SHOW[s]}</NativeSelectOption>)}
          </NativeSelect>
        </div>
      </div>
      <FormError error={query.error} />
      {query.isPending ? (
        <DepositListSkeleton label="Loading the deposits" />
      ) : data && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {LIST_TILES.map((label, i) => (
              <div key={label} className={cn('min-w-0 rounded-2xl bg-card px-3 py-2 shadow-card', i === 0 && 'col-span-2 sm:col-span-1')}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={cn('truncate text-lg font-medium leading-7 tabular-nums', tiles[i]! > 0 && i === 1 && 'text-negative-ink', tiles[i]! > 0 && i === 4 && 'text-warning-ink')}>{tiles[i]}</p>
              </div>
            ))}
          </div>
          <section className="space-y-2 rounded-2xl bg-card p-3 shadow-card sm:p-4">
            {data.items.length === 0 ? (
              <EmptyState
                className="py-6"
                title={filters.show === 'OPEN' ? 'Nothing open' : 'No approved pay runs yet'}
                hint={filters.show === 'OPEN' ? 'Everything the approved pay runs you see must deposit is deposited.' : 'A month shows here once its pay run is approved.'}
              />
            ) : (
              <div className="overflow-x-auto">
                <Table aria-label="Deposits" className="min-w-[760px] table-fixed text-[13px]">
                  <TableHeader>
                    <TableRow>{LIST_COLUMNS.map((h, i) => <TableHead key={h} style={{ width: LIST_WIDTHS[i] }} className="h-8 px-2 text-xs">{h}</TableHead>)}</TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((l) => (
                      <TableRow key={`${l.company.id}-${l.payMonth.getTime()}-${l.scheme}-${l.stateCode ?? ''}`} className="relative hover:bg-surface-2/60">
                        <TableCell className="px-2 py-1.5">
                          <Link to={monthPath(l.company.id, l.payMonth)} className="font-medium after:absolute after:inset-0">{MONTH_LABEL(l.payMonth)}</Link>
                          <p className="text-xs text-muted-foreground">{l.company.code}</p>
                        </TableCell>
                        <TableCell className="px-2 py-1.5"><p className="truncate">{schemeName(l.scheme, l.stateCode)}</p><p className="text-xs text-muted-foreground tabular-nums">{l.people} {l.people === 1 ? 'person' : 'people'}</p></TableCell>
                        <TableCell className="px-2 py-1.5 tabular-nums">{inr(l.due)}</TableCell>
                        <TableCell className="px-2 py-1.5 tabular-nums">{inr(l.deposited)}</TableCell>
                        <TableCell className="px-2 py-1.5 text-xs tabular-nums">{l.dueOn ? <span className={l.daysOverdue ? 'text-negative-ink' : undefined}>{formatDate(l.dueOn)}</span> : <span className="text-warning-ink">Not set</span>}</TableCell>
                        <TableCell className="px-2 py-1.5">
                          <Pill tone={DEPOSIT_STATE[l.state][1]} className="py-0.5">{DEPOSIT_STATE[l.state][0]}</Pill>
                          <p className={cn('mt-0.5 truncate text-xs', l.daysOverdue ? 'text-negative-ink' : 'text-muted-foreground')}>{standingDetail(l)}</p>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <Pager page={filters.page} pages={Math.ceil(data.total / PAGE_SIZE)} onPage={(page) => setFilter('page', String(page))} />
          </section>
          <p className="text-xs text-muted-foreground">
            Due dates are set on Payroll › Statutory settings › Due dates; the people who record deposits get an e-mail every day from {data.reminderDays} {data.reminderDays === 1 ? 'day' : 'days'} before a due date until its challan is paid.
          </p>
        </>
      )}
    </div>
  )
}
