import { useDeferredValue, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/FormError'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { StatutoryTableSkeleton } from '@/components/skeletons/payroll/StatutoryTableSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { client, orpc } from '@/lib/orpc'
import { cn, formatMoney } from '@/lib/utils'
import { MONTHS, OPENING_COLUMNS, OPENING_NOTE, OPENING_WIDTHS, taxYearLabel } from './statutory-labels'
import { SALARY_HIDDEN_NOTE } from './payroll-labels'

const PAGE = 50
type Row = Awaited<ReturnType<typeof client.payroll.taxOpenings.list>>['items'][number]
// the tax year today is in (from 1 April)
const currentTaxYear = () => {
  const now = new Date()
  return now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
}
const monthLabel = (date: Date) => `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`

// Opening tax figures (payroll stage 4): whose rows - whole-company Payroll scope by the employee's company; added and
// changed with Payroll Edit covering it, never one's own (checked on the server too)
export function OpeningsTab({ canAdd }: { canAdd: boolean }) {
  const [year, setYear] = useState(currentTaxYear)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Row | 'new' | null>(null)
  const [removing, setRemoving] = useState<Row | null>(null)
  const deferred = useDeferredValue(search.trim())
  const queryClient = useQueryClient()
  const taxYearFrom = new Date(Date.UTC(year, 3, 1))
  const query = useQuery({ ...orpc.payroll.taxOpenings.list.queryOptions({ input: { taxYearFrom, search: deferred || undefined, page, pageSize: PAGE } }), placeholderData: keepPreviousData })
  const remove = useMutation({ ...orpc.payroll.taxOpenings.delete.mutationOptions(), onSuccess: () => { setRemoving(null); void queryClient.invalidateQueries({ queryKey: orpc.payroll.taxOpenings.key() }) } })
  const data = query.data
  const stale = query.isFetching || search.trim() !== deferred
  return (
    <>
      <p className="text-xs text-muted-foreground">{OPENING_NOTE}</p>
      {data?.items.some((r) => r.amountsHidden) && <p className="text-xs text-muted-foreground">{SALARY_HIDDEN_NOTE}</p>}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="op-year" className="text-xs text-muted-foreground">Tax year</Label>
            <NativeSelect id="op-year" className="[&_select]:h-9 sm:[&_select]:h-8" value={String(year)} onChange={(e) => { setYear(Number(e.target.value)); setPage(1) }}>
              {Array.from({ length: 5 }, (_, i) => currentTaxYear() + 1 - i).map((y) => <NativeSelectOption key={y} value={String(y)}>{taxYearLabel(new Date(Date.UTC(y, 3, 1)))}</NativeSelectOption>)}
            </NativeSelect>
          </div>
          <div className="min-w-40 space-y-1 sm:w-64">
            <Label htmlFor="op-search" className="text-xs text-muted-foreground">Employee</Label>
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute top-2.5 left-2.5 size-3.5 text-muted-foreground" />
              <Input id="op-search" className="h-9 pl-8 sm:h-8" placeholder="Code or name" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
            </div>
          </div>
        </div>
        {canAdd && <Button className="min-h-9 gap-1.5 rounded-full" onClick={() => setEditing('new')}><Plus className="size-4" aria-hidden />Add figures</Button>}
      </div>
      <FormError error={query.error ?? remove.error} />
      {query.isPending ? <StatutoryTableSkeleton columns={OPENING_COLUMNS} widths={OPENING_WIDTHS} rows={5} lines={[2]} label="Loading opening tax figures" /> : data && (data.total === 0 ? (
        <EmptyState className="py-6" title={deferred ? 'Nothing matches' : 'No opening figures for this tax year'} hint={deferred ? 'Try another name or code.' : 'Needed for anyone paid outside this system earlier in the tax year.'} />
      ) : (
        <div className={cn('overflow-x-auto transition-opacity', stale && 'opacity-50')}>
          <Table aria-label="Opening tax figures" className="min-w-[720px] table-fixed text-[13px]">
            <TableHeader><TableRow>{OPENING_COLUMNS.map((h, i) => <TableHead key={`${h}-${i}`} style={{ width: OPENING_WIDTHS[i] }} className="h-8 px-2 text-xs">{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {data.items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="px-2 py-1.5"><p className="font-medium">{r.employee.name}</p><p className="text-xs text-muted-foreground">{r.employee.employeeCode}</p></TableCell>
                  <TableCell className="px-2 py-1.5 tabular-nums">{monthLabel(r.throughPayMonth)}</TableCell>
                  <TableCell className="px-2 py-1.5 tabular-nums">{r.taxableIncome === null ? <span className="text-xs text-muted-foreground">Hidden</span> : formatMoney(r.taxableIncome, 'INR')}</TableCell>
                  <TableCell className="px-2 py-1.5 tabular-nums">{r.taxDeducted === null ? <span className="text-xs text-muted-foreground">Hidden</span> : formatMoney(r.taxDeducted, 'INR')}</TableCell>
                  <TableCell className="px-2 py-1.5 text-xs break-words">{r.note ?? ''}</TableCell>
                  <TableCell className="px-2 py-1.5">
                    {r.canChange && (
                      <div className="flex justify-end gap-0.5">
                        <Button size="icon-sm" variant="ghost" aria-label={`Change the figures of ${r.employee.name}`} onClick={() => setEditing(r)}><Pencil aria-hidden /></Button>
                        <Button size="icon-sm" variant="ghost" aria-label={`Remove the figures of ${r.employee.name}`} onClick={() => setRemoving(r)}><Trash2 aria-hidden /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
      {data && data.total > PAGE && (
        <nav aria-label="Opening figures pages" className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">{(page - 1) * PAGE + 1}–{Math.min(page * PAGE, data.total)} of {data.total}</span>
          <div className="flex gap-1">
            <Button size="sm" variant="secondary" className="min-h-9 rounded-full" disabled={page <= 1 || stale} onClick={() => setPage(page - 1)}><ChevronLeft aria-hidden />Previous</Button>
            <Button size="sm" variant="secondary" className="min-h-9 rounded-full" disabled={page * PAGE >= data.total || stale} onClick={() => setPage(page + 1)}>Next<ChevronRight aria-hidden /></Button>
          </div>
        </nav>
      )}
      {editing && <OpeningDrawer taxYear={year} existing={editing === 'new' ? undefined : editing} close={() => setEditing(null)} />}
      {removing && (
        <ConfirmDialog
          title="Remove these opening figures?"
          description={`${removing.employee.name} · tax year ${taxYearLabel(removing.taxYearFrom)}. Their TDS is worked out again without them the next time their pay is worked out.`}
          confirm={remove.isPending ? 'Removing…' : 'Remove'}
          pending={remove.isPending}
          onConfirm={() => remove.mutate({ id: removing.id })}
          onClose={() => { if (!remove.isPending) setRemoving(null) }}
        />
      )}
    </>
  )
}

function OpeningDrawer({ taxYear, existing, close }: { taxYear: number; existing?: Row; close: () => void }) {
  const [code, setCode] = useState(existing?.employee.employeeCode ?? '')
  // the months of the tax year: April .. March
  const months = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(taxYear, 3 + i, 1)))
  const [through, setThrough] = useState(existing ? String(existing.throughPayMonth.getTime()) : '')
  const [income, setIncome] = useState(existing?.taxableIncome != null ? String(existing.taxableIncome) : '')
  const [deducted, setDeducted] = useState(existing?.taxDeducted != null ? String(existing.taxDeducted) : '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [initial] = useState(() => JSON.stringify({ code, through, income, deducted, note }))
  const queryClient = useQueryClient()
  const save = useMutation({ ...orpc.payroll.taxOpenings.save.mutationOptions(), onSuccess: () => void queryClient.invalidateQueries({ queryKey: orpc.payroll.taxOpenings.key() }) })
  const whole = (text: string) => /^\d+$/.test(text.trim())
  const valid = code.trim().length > 0 && !!through && whole(income) && whole(deducted)
  const dirty = JSON.stringify({ code, through, income, deducted, note }) !== initial
  const submit = () => {
    if (!valid || save.isPending) return
    save.mutate({
      ...(existing && { id: existing.id }),
      employeeCode: code.trim().toUpperCase(),
      taxYearFrom: new Date(Date.UTC(taxYear, 3, 1)),
      throughPayMonth: new Date(Number(through)),
      taxableIncome: Number(income),
      taxDeducted: Number(deducted),
      note: note.trim() || null,
    })
  }
  return (
    <FormDrawer
      onClose={close}
      closed={save.isSuccess}
      dirty={dirty && !save.isSuccess}
      title={existing ? `Opening figures of ${existing.employee.name}` : 'Add opening tax figures'}
      description={`Tax year ${taxYearLabel(new Date(Date.UTC(taxYear, 3, 1)))}. Whole rupees, from greytHR or the previous employer's Form 122.`}
      footer={<><DrawerCancel /><Button disabled={!valid || save.isPending} onClick={submit}>{save.isPending ? 'Saving…' : 'Save'}</Button></>}
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <fieldset disabled={save.isPending} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="op-code">Employee code</Label>
            {existing ? <p id="op-code" className="text-sm">{existing.employee.name} · {existing.employee.employeeCode}</p> : <Input id="op-code" className="h-9 uppercase" placeholder="e.g. RML035384" value={code} onChange={(e) => setCode(e.target.value)} />}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="op-through">Covers the tax year up to</Label>
            <NativeSelect id="op-through" className="w-full [&_select]:h-9" value={through} onChange={(e) => setThrough(e.target.value)}>
              <NativeSelectOption value="">Choose the last month covered</NativeSelectOption>
              {months.map((m) => <NativeSelectOption key={m.getTime()} value={String(m.getTime())}>{monthLabel(m)}</NativeSelectOption>)}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">Pay runs of the months after it in this system are added on top.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="op-income">Taxable income (₹)</Label><Input id="op-income" className="h-9 tabular-nums" inputMode="numeric" value={income} onChange={(e) => setIncome(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="op-deducted">Tax deducted (₹)</Label><Input id="op-deducted" className="h-9 tabular-nums" inputMode="numeric" value={deducted} onChange={(e) => setDeducted(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="op-note">Note</Label><Textarea id="op-note" rows={2} placeholder="e.g. greytHR April - October" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </fieldset>
        <FormError error={save.error} />
      </form>
    </FormDrawer>
  )
}
