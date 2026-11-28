import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/FormError'
import { Pager } from '@/components/Pager'
import { Pill } from '@/components/Pill'
import { BatchListSkeleton } from '@/components/skeletons/payroll/BatchListSkeleton'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { orpc } from '@/lib/orpc'
import { formatDate, formatMoney } from '@/lib/utils'
import { BATCH_COLUMNS, BATCH_STATUS, BATCH_WIDTHS, METHOD } from './payments-labels'

export type BatchFilters = { companyId?: number; status?: keyof typeof BATCH_STATUS; page: number }
const PAGE_SIZE = 50

// "Batches" of Salary payments (payroll stage 6 slice 2): every payment batch of the companies covered in full, newest
// first - its way of paying, people, amount, how much is paid, where it stands; open one to work on it
export function BatchList({ filters, setFilter }: { filters: BatchFilters; setFilter: (key: string, value: string) => void }) {
  const query = useQuery(orpc.payroll.payments.batches.queryOptions({ input: { ...filters, pageSize: PAGE_SIZE } }))
  const data = query.data
  return (
    <section className="space-y-3 rounded-2xl bg-card p-3 shadow-card sm:p-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-full space-y-1 sm:w-64">
          <Label htmlFor="bl-company" className="text-xs text-muted-foreground">Company</Label>
          <NativeSelect id="bl-company" className="w-full [&_select]:h-9" value={filters.companyId ? String(filters.companyId) : ''} onChange={(e) => setFilter('company', e.target.value)}>
            <NativeSelectOption value="">Every company</NativeSelectOption>
            {data?.companies.map((c) => <NativeSelectOption key={c.id} value={String(c.id)}>{c.code} · {c.name}</NativeSelectOption>)}
          </NativeSelect>
        </div>
        <div className="w-full space-y-1 sm:w-44">
          <Label htmlFor="bl-status" className="text-xs text-muted-foreground">Status</Label>
          <NativeSelect id="bl-status" className="w-full [&_select]:h-9" value={filters.status ?? ''} onChange={(e) => setFilter('status', e.target.value)}>
            <NativeSelectOption value="">Every status</NativeSelectOption>
            {(Object.keys(BATCH_STATUS) as (keyof typeof BATCH_STATUS)[]).map((s) => <NativeSelectOption key={s} value={s}>{BATCH_STATUS[s][0]}</NativeSelectOption>)}
          </NativeSelect>
        </div>
      </div>
      <FormError error={query.error} />
      {query.isPending ? (
        <BatchListSkeleton label="Loading the batches" />
      ) : data && (data.items.length === 0 ? (
        <EmptyState className="py-6" title="No batches" hint="Make one from “To pay & owed”: pick the people, then Make a batch." />
      ) : (
        <div className="overflow-x-auto">
          <Table aria-label="Batches" className="min-w-[760px] table-fixed text-[13px]">
            <TableHeader>
              <TableRow>{BATCH_COLUMNS.map((h, i) => <TableHead key={h} style={{ width: BATCH_WIDTHS[i] }} className="h-8 px-2 text-xs">{h}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((b) => (
                <TableRow key={b.id} className="relative hover:bg-surface-2/60">
                  <TableCell className="px-2 py-1.5">
                    <Link to={`/manage/salary-payments/${b.id}`} className="font-medium after:absolute after:inset-0">Batch #{b.id}</Link>
                    <p className="truncate text-xs text-muted-foreground">{formatDate(b.createdAt)} · {b.createdBy?.name ?? '—'}</p>
                  </TableCell>
                  <TableCell className="px-2 py-1.5">{b.company.code}</TableCell>
                  <TableCell className="px-2 py-1.5">{METHOD[b.method]}</TableCell>
                  <TableCell className="px-2 py-1.5 tabular-nums">{b.payments}</TableCell>
                  <TableCell className="px-2 py-1.5 tabular-nums">{formatMoney(b.amount, 'INR')}</TableCell>
                  <TableCell className="px-2 py-1.5 tabular-nums"><p>{formatMoney(b.paid.amount, 'INR')}</p><p className="text-xs text-muted-foreground">{b.paid.count} paid{b.returned.count ? ` · ${b.returned.count} returned` : ''}</p></TableCell>
                  <TableCell className="px-2 py-1.5"><Pill tone={BATCH_STATUS[b.status][1]} className="py-0.5">{BATCH_STATUS[b.status][0]}</Pill></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
      {data && <Pager page={filters.page} pages={Math.ceil(data.total / PAGE_SIZE)} onPage={(page) => setFilter('page', String(page))} />}
    </section>
  )
}
