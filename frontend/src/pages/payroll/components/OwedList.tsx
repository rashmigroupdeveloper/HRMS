import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { HandCoins, Pause, Play } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { FormError } from '@/components/FormError'
import { Pager } from '@/components/Pager'
import { Pill } from '@/components/Pill'
import { OwedListSkeleton } from '@/components/skeletons/payroll/OwedListSkeleton'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { client, orpc } from '@/lib/orpc'
import { cn, formatDate, formatMoney } from '@/lib/utils'
import { METHOD, MONTH_LABEL, OWED_COLUMNS, OWED_STATE, OWED_STATES, OWED_TOTAL_LABEL, OWED_WIDTHS, type Method, type OwedStateKey } from './payments-labels'

type Owed = Awaited<ReturnType<typeof client.payroll.payments.owed>>
type Item = Owed['items'][number]
export type OwedFilters = { companyId?: number; runId?: number; state?: OwedStateKey; search: string; page: number }

const PAGE_SIZE = 50
const inr = (amount: number) => formatMoney(amount, 'INR')

// "To pay & owed" of Salary payments (payroll stage 6 slice 2): everyone of the approved runs not paid yet - to pay, no salary
// account, returned by the bank, held, or in a batch - with the days overdue. The tiles filter by state. Pick people of one
// company to make a batch; hold or release one person's pay. Payroll payments over the whole company; never one's own.
export function OwedList({ filters, setFilter }: { filters: OwedFilters; setFilter: (key: string, value: string) => void }) {
  const query = useQuery(orpc.payroll.payments.owed.queryOptions({ input: { ...filters, search: filters.search || undefined, pageSize: PAGE_SIZE } }))
  const [picked, setPicked] = useState<Map<number, Item>>(new Map())
  const [making, setMaking] = useState(false)
  const [holding, setHolding] = useState<Item | null>(null)
  const data = query.data
  const canPayOf = (companyId: number) => data?.companies.find((c) => c.id === companyId)?.canPay ?? false
  const pickable = (i: Item) => canPayOf(i.company.id) && !i.own && (i.state === 'TO_PAY' || i.state === 'RETURNED' || i.state === 'NO_ACCOUNT')
  const pickedList = [...picked.values()]
  const companies = new Set(pickedList.map((i) => i.company.id))
  const toggle = (item: Item, on: boolean) => setPicked((old) => { const next = new Map(old); if (on) next.set(item.personId, item); else next.delete(item.personId); return next })
  const shown = data?.items ?? []
  const pageable = shown.filter(pickable)
  const allPicked = pageable.length > 0 && pageable.every((i) => picked.has(i.personId))
  const change = (key: string, value: string) => { setPicked(new Map()); setFilter(key, value) }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-full space-y-1 sm:w-64">
          <Label htmlFor="ow-company" className="text-xs text-muted-foreground">Company</Label>
          <NativeSelect id="ow-company" className="w-full [&_select]:h-9" value={filters.companyId ? String(filters.companyId) : ''} onChange={(e) => change('company', e.target.value)}>
            <NativeSelectOption value="">Every company</NativeSelectOption>
            {data?.companies.map((c) => <NativeSelectOption key={c.id} value={String(c.id)}>{c.code} · {c.name}</NativeSelectOption>)}
          </NativeSelect>
        </div>
        <div className="w-full space-y-1 sm:w-44">
          <Label htmlFor="ow-run" className="text-xs text-muted-foreground">Pay month</Label>
          <NativeSelect id="ow-run" className="w-full [&_select]:h-9" value={filters.runId ? String(filters.runId) : ''} onChange={(e) => change('run', e.target.value)}>
            <NativeSelectOption value="">Every month</NativeSelectOption>
            {data?.runs.map((r) => <NativeSelectOption key={r.id} value={String(r.id)}>{MONTH_LABEL(r.payMonth)} · {r.company.code}</NativeSelectOption>)}
          </NativeSelect>
        </div>
        <div className="w-full space-y-1 sm:w-64">
          <Label htmlFor="ow-search" className="text-xs text-muted-foreground">Employee</Label>
          <Input id="ow-search" className="h-9" placeholder="Code or name" value={filters.search} onChange={(e) => change('q', e.target.value)} />
        </div>
      </div>
      <FormError error={query.error} />
      {query.isPending ? (
        <OwedListSkeleton label="Loading what is owed" />
      ) : data && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {OWED_STATES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={filters.state === s}
                onClick={() => change('state', filters.state === s ? '' : s)}
                className={cn('min-w-0 rounded-2xl bg-card px-3 py-2 text-left shadow-card outline-none transition-colors hover:bg-surface-2/70 focus-visible:ring-2 focus-visible:ring-ring/50', filters.state === s && 'ring-2 ring-foreground/70')}
              >
                <p className="text-xs text-muted-foreground">{OWED_STATE[s][0]}</p>
                <p className={cn('truncate text-lg font-medium leading-7 tabular-nums', data.counts[s].count > 0 && (s === 'NO_ACCOUNT' || s === 'HELD') && 'text-warning-ink', data.counts[s].count > 0 && s === 'RETURNED' && 'text-negative-ink')}>{inr(data.counts[s].amount)}</p>
                <p className="text-xs leading-4 text-muted-foreground tabular-nums">{data.counts[s].count} {data.counts[s].count === 1 ? 'person' : 'people'}</p>
              </button>
            ))}
            <div className="min-w-0 rounded-2xl bg-hero px-3 py-2 text-hero-foreground shadow-card">
              <p className="text-xs opacity-75">{OWED_TOTAL_LABEL}</p>
              <p className="truncate text-lg font-medium leading-7 tabular-nums">{inr(data.owed.amount)}</p>
              <p className="text-xs leading-4 opacity-75 tabular-nums">{data.owed.count} {data.owed.count === 1 ? 'person' : 'people'}</p>
            </div>
          </div>
          <div className="space-y-2 rounded-2xl bg-card p-3 shadow-card sm:p-4">
            {picked.size > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gold-soft px-3 py-2 text-sm">
                <span className="tabular-nums">{picked.size} picked · {inr(pickedList.reduce((sum, i) => sum + i.amount, 0))}{companies.size > 1 && <span className="text-warning-ink"> - pick people of one company for a batch</span>}</span>
                <Button size="sm" className="gap-1.5 rounded-full" disabled={companies.size !== 1} onClick={() => setMaking(true)}><HandCoins className="size-4" aria-hidden />Make a batch</Button>
              </div>
            )}
            {shown.length === 0 ? (
              <EmptyState className="py-6" title={data.owed.count ? 'Nobody matches' : 'Nothing owed'} hint={data.owed.count ? 'Change the filters above.' : 'Everyone of the approved pay runs you see is paid.'} />
            ) : (
              <div className="overflow-x-auto">
                <Table aria-label="Owed" className="min-w-[860px] table-fixed text-[13px]">
                  <TableHeader>
                    <TableRow>
                      {OWED_COLUMNS.map((h, i) => (
                        <TableHead key={`${h}-${i}`} style={{ width: OWED_WIDTHS[i] }} className="h-8 px-2 text-xs">
                          {i === 0 && pageable.length > 0 ? <Checkbox aria-label="Pick everyone shown who can be paid" checked={allPicked} onCheckedChange={(on) => setPicked(on === true ? new Map([...picked, ...pageable.map((p) => [p.personId, p] as const)]) : new Map())} /> : h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shown.map((item) => (
                      <TableRow key={item.personId}>
                        <TableCell className="px-2 py-1.5">{pickable(item) && <Checkbox aria-label={`Pick ${item.name || item.employeeCode}`} checked={picked.has(item.personId)} onCheckedChange={(on) => toggle(item, on === true)} />}</TableCell>
                        <TableCell className="px-2 py-1.5"><p className="truncate font-medium">{item.name || item.employeeCode}</p><p className="text-xs text-muted-foreground">{item.employeeCode}</p></TableCell>
                        <TableCell className="px-2 py-1.5"><p>{MONTH_LABEL(item.run.payMonth)}</p><p className="text-xs text-muted-foreground">{item.company.code}</p></TableCell>
                        <TableCell className="px-2 py-1.5 tabular-nums">{inr(item.amount)}</TableCell>
                        <TableCell className="px-2 py-1.5">
                          <Pill tone={OWED_STATE[item.state][1]} className="py-0.5">{OWED_STATE[item.state][0]}</Pill>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground" title={item.hold?.reason ?? item.returned?.reason ?? undefined}>
                            {item.state === 'IN_BATCH' && item.batchId ? <Link to={`/manage/salary-payments/${item.batchId}`} className="underline underline-offset-4">Batch #{item.batchId}</Link> : item.hold ? `${item.hold.reason} · ${item.hold.by?.name ?? ''}` : item.returned ? item.returned.reason : item.own ? 'Your own pay - a colleague pays it' : ' '}
                          </p>
                        </TableCell>
                        <TableCell className="px-2 py-1.5 text-xs">{item.account ? <>{item.account.bankName} ·· {item.account.last4}</> : <span className="text-warning-ink">None</span>}</TableCell>
                        <TableCell className="px-2 py-1.5 text-xs tabular-nums" title={`Due ${formatDate(item.dueOn)}`}>{item.daysOverdue > 0 ? <span className="text-negative-ink">{item.daysOverdue} {item.daysOverdue === 1 ? 'day' : 'days'}</span> : <span className="text-muted-foreground">Due {formatDate(item.dueOn)}</span>}</TableCell>
                        <TableCell className="px-2 py-1.5">
                          {canPayOf(item.company.id) && !item.own && item.state !== 'IN_BATCH' && (
                            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2" onClick={() => setHolding(item)}>
                              {item.state === 'HELD' ? <><Play className="size-3.5" aria-hidden />Release</> : <><Pause className="size-3.5" aria-hidden />Hold</>}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <Pager page={filters.page} pages={Math.ceil(data.total / PAGE_SIZE)} onPage={(page) => setFilter('page', String(page))} />
          </div>
          <p className="text-xs text-muted-foreground">Overdue counts from {data.paymentDueDays} days after each pay period ends (Payroll › Statutory settings › Run settings).</p>
        </>
      )}
      {making && pickedList.length > 0 && <NewBatchDialog companyId={pickedList[0]!.company.id} people={pickedList} close={(done) => { setMaking(false); if (done) setPicked(new Map()) }} />}
      {holding && <HoldDialog item={holding} close={() => setHolding(null)} />}
    </div>
  )
}

function NewBatchDialog({ companyId, people, close }: { companyId: number; people: Item[]; close: (done: boolean) => void }) {
  const noAccount = people.some((p) => !p.account)
  const [method, setMethod] = useState<Method>(noAccount ? 'CHEQUE' : 'BANK')
  const [note, setNote] = useState('')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const create = useMutation({
    ...orpc.payroll.payments.createBatch.mutationOptions(),
    onSuccess: ({ id }) => {
      void queryClient.invalidateQueries({ queryKey: orpc.payroll.key() })
      close(true)
      void navigate(`/manage/salary-payments/${id}`)
    },
  })
  return (
    <FormDialog onOpenChange={() => close(false)} dirty={note.trim() !== '' && !create.isSuccess} className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Make a batch of {people.length} {people.length === 1 ? 'payment' : 'payments'}</DialogTitle>
        <DialogDescription>{formatMoney(people.reduce((sum, p) => sum + p.amount, 0), 'INR')} for {people[0]!.company.code}. Next: download the list or hand over the cheques / cash, mark the batch sent, then mark it paid.</DialogDescription>
      </DialogHeader>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate({ companyId, method, personIds: people.map((p) => p.personId), note: note.trim() || undefined }) }}>
        <div className="space-y-1.5">
          <Label htmlFor="nb-method">Paid by</Label>
          <NativeSelect id="nb-method" className="w-full [&_select]:h-10" value={method} onChange={(e) => setMethod(e.target.value as Method)} disabled={create.isPending}>
            {(Object.keys(METHOD) as Method[]).map((m) => <NativeSelectOption key={m} value={m}>{METHOD[m]}</NativeSelectOption>)}
          </NativeSelect>
          {method === 'BANK' && noAccount && <p className="text-xs text-warning-ink">Someone picked has no salary account - pay them by cheque or cash, or add the account first.</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nb-note">Note (optional)</Label>
          <Textarea id="nb-note" rows={2} placeholder="e.g. Workers first - staff tomorrow" value={note} onChange={(e) => setNote(e.target.value)} disabled={create.isPending} />
        </div>
        <FormError error={create.error} />
        <DialogFooter>
          <DialogCancel />
          <Button type="submit" disabled={create.isPending || (method === 'BANK' && noAccount)}>{create.isPending ? 'Making…' : 'Make the batch'}</Button>
        </DialogFooter>
      </form>
    </FormDialog>
  )
}

// Holds a person's pay with a reason, or releases it
function HoldDialog({ item, close }: { item: Item; close: () => void }) {
  const releasing = item.state === 'HELD'
  const [text, setText] = useState('')
  const queryClient = useQueryClient()
  const done = { onSuccess: () => { void queryClient.invalidateQueries({ queryKey: orpc.payroll.key() }); close() } }
  const hold = useMutation({ ...orpc.payroll.payments.hold.mutationOptions(), ...done })
  const release = useMutation({ ...orpc.payroll.payments.releaseHold.mutationOptions(), ...done })
  const pending = hold.isPending || release.isPending
  return (
    <FormDialog onOpenChange={close} dirty={text.trim() !== '' && !hold.isSuccess && !release.isSuccess} className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{releasing ? 'Release' : 'Hold'} the pay of {item.name || item.employeeCode}?</DialogTitle>
        <DialogDescription>
          {MONTH_LABEL(item.run.payMonth)} · {formatMoney(item.amount, 'INR')}.{' '}
          {releasing ? `Held: ${item.hold?.reason ?? ''}. Released, it is to pay again.` : 'Held pay stays out of batches - it is still owed, and wages are due by law, so release it as soon as the reason is settled.'}
        </DialogDescription>
      </DialogHeader>
      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (releasing) release.mutate({ personId: item.personId, note: text.trim() || undefined }); else if (text.trim().length >= 3) hold.mutate({ personId: item.personId, reason: text.trim() }) }}>
        <Label htmlFor="hd-text">{releasing ? 'Note (optional)' : 'Reason'}</Label>
        <Textarea id="hd-text" rows={3} placeholder={releasing ? 'e.g. Clearance done' : 'e.g. Absconding - notices sent'} value={text} onChange={(e) => setText(e.target.value)} disabled={pending} />
        <FormError error={hold.error ?? release.error} />
        <DialogFooter>
          <DialogCancel />
          <Button type="submit" disabled={pending || (!releasing && text.trim().length < 3)}>{pending ? 'Saving…' : releasing ? 'Release' : 'Hold'}</Button>
        </DialogFooter>
      </form>
    </FormDialog>
  )
}
