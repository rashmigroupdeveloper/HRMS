import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCheck, Pencil, Plus, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { client, orpc } from '@/lib/orpc'
import { formatDate, formatMoney, fromDateInput, toDateInput, todayDay } from '@/lib/utils'
import { CHARGES_NOTE, DEPOSIT_COLUMNS, DEPOSIT_WIDTHS, GAP_REASON, MONTH_LABEL, REFERENCE_HINT, schemeName } from './deposits-labels'

export type Month = Awaited<ReturnType<typeof client.payroll.deposits.month>>
export type Line = Month['lines'][number]
type Deposit = Line['deposits'][number]

const inr = (amount: number) => formatMoney(amount, 'INR')
const money = (text: string) => /^\d+(\.\d{1,2})?$/.test(text.trim())
const useReload = () => {
  const queryClient = useQueryClient()
  return () => void queryClient.invalidateQueries({ queryKey: orpc.payroll.deposits.key() })
}

// "Returns and challans" of a scheme's month (Statutory deposits): each one recorded - its reference, the day it was filed,
// the contributions it carries (compared with the run), the other charges on it (the company's cost), paid or not - and the
// steps: record one, mark it paid, correct it, remove one recorded by mistake. Statutory deposits Edit over the company.
export function DepositRecords({ line, payMonth, canRecord }: { line: Line; payMonth: Date; canRecord: boolean }) {
  const [editing, setEditing] = useState<Deposit | 'new' | null>(null)
  const [paying, setPaying] = useState<Deposit | null>(null)
  const [removing, setRemoving] = useState<Deposit | null>(null)
  const reload = useReload()
  const remove = useMutation({ ...orpc.payroll.deposits.remove.mutationOptions(), onSuccess: () => { setRemoving(null); reload() } })
  return (
    <section className="space-y-2 rounded-2xl bg-card p-3 shadow-card sm:p-4">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-medium">Returns and challans</h2>
        {canRecord && <Button className="min-h-9 gap-1.5 rounded-full" onClick={() => setEditing('new')}><Plus className="size-4" aria-hidden />Record a return / challan</Button>}
      </div>
      <FormError error={remove.error} />
      {line.deposits.length === 0 ? (
        <EmptyState className="py-5" title="None recorded yet" hint={`Record the ${schemeName(line.scheme, line.stateCode)} return or challan once it is made on the portal, then mark it paid.`} />
      ) : (
        <div className="overflow-x-auto">
          <Table aria-label="Returns and challans" className="min-w-[760px] table-fixed text-[13px]">
            <TableHeader>
              <TableRow>{DEPOSIT_COLUMNS.map((h, i) => <TableHead key={`${h}-${i}`} style={{ width: DEPOSIT_WIDTHS[i] }} className="h-8 px-2 text-xs">{h}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {line.deposits.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="px-2 py-1.5">
                    <p className="truncate font-medium" title={d.note ?? undefined}>{d.reference}</p>
                    <p className="truncate text-xs text-muted-foreground">{d.takesIn ? `Takes in ${d.takesIn} left out · ` : ''}{d.recordedBy?.name ?? '—'}</p>
                  </TableCell>
                  <TableCell className="px-2 py-1.5 tabular-nums">{formatDate(d.filedOn)}</TableCell>
                  <TableCell className="px-2 py-1.5 tabular-nums">{inr(d.contributions)}</TableCell>
                  <TableCell className="px-2 py-1.5 tabular-nums">{d.otherCharges ? inr(d.otherCharges) : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="px-2 py-1.5">
                    {d.paidOn ? <><p className="tabular-nums">{formatDate(d.paidOn)}</p><p className="truncate text-xs text-muted-foreground">{d.paymentReference}</p></> : <p className="text-warning-ink">Not paid yet</p>}
                  </TableCell>
                  <TableCell className="px-2 py-1.5">
                    {canRecord && (
                      <div className="flex flex-nowrap justify-end gap-0.5">
                        {!d.paidOn && <Button variant="ghost" size="sm" className="h-7 gap-1 px-2" onClick={() => setPaying(d)}><CheckCheck className="size-3.5" aria-hidden />Paid</Button>}
                        <Button size="icon-sm" variant="ghost" aria-label={`Correct ${d.reference}`} onClick={() => setEditing(d)}><Pencil aria-hidden /></Button>
                        <Button size="icon-sm" variant="ghost" aria-label={`Remove ${d.reference}`} onClick={() => setRemoving(d)}><Trash2 aria-hidden /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {editing && <DepositDrawer line={line} payMonth={payMonth} existing={editing === 'new' ? undefined : editing} close={() => setEditing(null)} />}
      {paying && <PaidDialog deposit={paying} close={() => setPaying(null)} />}
      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.reference}?`}
          description="Only for one recorded by mistake - the change history keeps it. One that took people left out in stays until they are marked not taken in."
          confirm={remove.isPending ? 'Removing…' : 'Remove'}
          pending={remove.isPending}
          onConfirm={() => remove.mutate({ id: removing.id })}
          onClose={() => { if (!remove.isPending) setRemoving(null) }}
        />
      )}
    </section>
  )
}

// Records a return / challan (filed - paid at once if it is), or corrects one recorded. A new PF / ESIC one can take in people
// left out of an earlier return of the month (a supplementary return) in the same step.
function DepositDrawer({ line, payMonth, existing, close }: { line: Line; payMonth: Date; existing?: Deposit; close: () => void }) {
  // what is still to deposit (what is due less what is deposited or filed, the people left out not counted)
  const toDeposit = Math.max(0, line.difference - line.filedUnpaid)
  const canTakeIn = !existing && (line.scheme === 'PF' || line.scheme === 'ESIC') && line.leftOut.count > 0
  const leftOut = useQuery({
    ...orpc.payroll.deposits.people.queryOptions({ input: { companyId: line.company.id, payMonth, scheme: line.scheme === 'ESIC' ? 'ESIC' : 'PF', show: 'LEFT_OUT', page: 1, pageSize: 200 } }),
    enabled: canTakeIn,
  })
  // (one's own mark is taken in by a colleague)
  const open = (leftOut.data?.items ?? []).filter((p) => p.gap && !p.gap.takenIn && !p.own)
  const [takeIn, setTakeIn] = useState<number[]>([])
  const takenShares = open.filter((p) => takeIn.includes(p.gap!.id) && p.amounts).reduce((sum, p) => sum + p.amounts!.employee + p.amounts!.employer, 0)
  const [reference, setReference] = useState(existing?.reference ?? '')
  const [filedOn, setFiledOn] = useState(toDateInput(existing?.filedOn ?? todayDay()))
  const [contributions, setContributions] = useState(existing ? String(existing.contributions) : '')
  const [charges, setCharges] = useState(existing ? String(existing.otherCharges) : '0')
  const [paid, setPaid] = useState(!!existing?.paidOn)
  const [paidOn, setPaidOn] = useState(toDateInput(existing?.paidOn ?? todayDay()))
  const [paymentReference, setPaymentReference] = useState(existing?.paymentReference ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [initial] = useState(() => JSON.stringify({ reference, filedOn, contributions, charges, paid, paidOn, paymentReference, note }))
  const reload = useReload()
  const record = useMutation({ ...orpc.payroll.deposits.record.mutationOptions(), onSuccess: reload })
  const update = useMutation({ ...orpc.payroll.deposits.update.mutationOptions(), onSuccess: reload })
  const save = existing ? update : record
  const filed = fromDateInput(filedOn)
  const paidDay = fromDateInput(paidOn)
  const valid =
    reference.trim().length > 0 && !!filed && money(contributions) && money(charges) && Number(contributions) + Number(charges) > 0 && (!paid || (!!paidDay && paymentReference.trim().length > 0))
  const dirty = JSON.stringify({ reference, filedOn, contributions, charges, paid, paidOn, paymentReference, note }) !== initial || takeIn.length > 0
  const paidPart = paid ? { paid: { paidOn: paidDay!, paymentReference: paymentReference.trim() } } : {}
  const submit = () => {
    if (!valid || save.isPending) return
    const details = { reference: reference.trim(), filedOn: filed!, contributions: Number(contributions), otherCharges: Number(charges), note: note.trim() || undefined }
    if (existing) update.mutate({ id: existing.id, ...details, ...(existing.paidOn ? paidPart : {}) })
    else record.mutate({ companyId: line.company.id, payMonth, scheme: line.scheme, stateCode: line.stateCode, ...details, ...paidPart, ...(takeIn.length && { takeIn }) })
  }
  return (
    <FormDrawer
      onClose={close}
      closed={save.isSuccess}
      dirty={dirty && !save.isSuccess}
      title={existing ? `Correct ${existing.reference}` : `Record a ${schemeName(line.scheme, line.stateCode)} return / challan`}
      description={`${line.company.code} · ${MONTH_LABEL(payMonth)}. The contributions are compared with what the approved run worked out, to the paisa.`}
      footer={<><DrawerCancel /><Button disabled={!valid || save.isPending} onClick={submit}>{save.isPending ? 'Saving…' : 'Save'}</Button></>}
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <fieldset disabled={save.isPending} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dr-reference">Reference</Label>
            <Input id="dr-reference" className="h-9" placeholder={REFERENCE_HINT[line.scheme]} value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dr-filed">Filed on</Label>
            <Input id="dr-filed" type="date" className="h-9" max={toDateInput(todayDay())} value={filedOn} onChange={(e) => setFiledOn(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dr-contributions">Contributions (₹)</Label>
            <Input id="dr-contributions" className="h-9 tabular-nums" inputMode="decimal" value={contributions} onChange={(e) => setContributions(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              The employees’ and the employer’s shares it carries. Due {inr(line.due)}{line.leftOut.count ? ` (${inr(line.due - line.leftOut.amount)} without the people left out)` : ''}.
              {!existing && toDeposit > 0 && <> Still to deposit: <button type="button" className="underline underline-offset-4" onClick={() => setContributions(String(toDeposit))}>{inr(toDeposit)}</button>.</>}
            </p>
          </div>
          {canTakeIn && (
            <fieldset className="space-y-2 rounded-xl bg-surface-2/40 p-3">
              <legend className="sr-only">People left out it takes in</legend>
              <p className="text-sm font-medium">A supplementary return? Tick the people left out it takes in</p>
              {leftOut.isPending ? (
                <div role="status" aria-label="Loading the people left out" className="space-y-2">{['w-48', 'w-40'].map((w) => <Skeleton key={w} className={`h-4 ${w}`} />)}</div>
              ) : open.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nobody you can take in (one’s own is taken in by a colleague).</p>
              ) : (
                open.map((p) => (
                  <label key={p.gap!.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={takeIn.includes(p.gap!.id)} onCheckedChange={(on) => setTakeIn(on === true ? [...takeIn, p.gap!.id] : takeIn.filter((g) => g !== p.gap!.id))} />
                    <span className="min-w-0 truncate">{p.name || p.employeeCode} <span className="text-xs text-muted-foreground">{p.employeeCode} · {GAP_REASON[p.gap!.reason]}</span></span>
                  </label>
                ))
              )}
              {takenShares > 0 && <p className="text-xs text-muted-foreground">Their shares: <button type="button" className="underline underline-offset-4" onClick={() => setContributions(String(Math.round(takenShares * 100) / 100))}>{inr(takenShares)}</button></p>}
            </fieldset>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="dr-charges">Other charges (₹)</Label>
            <Input id="dr-charges" className="h-9 tabular-nums" inputMode="decimal" value={charges} onChange={(e) => setCharges(e.target.value)} />
            <p className="text-xs text-muted-foreground">{CHARGES_NOTE}</p>
          </div>
          {(!existing || existing.paidOn) && (
            <div className="space-y-3 rounded-xl bg-surface-2/40 p-3">
              {!existing && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={paid} onCheckedChange={(on) => setPaid(on === true)} />Paid already
                </label>
              )}
              {paid && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="dr-paid">Paid on</Label>
                    <Input id="dr-paid" type="date" className="h-9" max={toDateInput(todayDay())} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dr-payment">Payment reference</Label>
                    <Input id="dr-payment" className="h-9" placeholder="CRN / CIN / bank reference" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="dr-note">Note (optional)</Label>
            <Textarea id="dr-note" rows={2} placeholder="e.g. Supplementary return for the joiners" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </fieldset>
        <FormError error={save.error} />
      </form>
    </FormDrawer>
  )
}

// A filed return / challan paid: the day and the payment's reference
function PaidDialog({ deposit, close }: { deposit: Deposit; close: () => void }) {
  const [day, setDay] = useState(toDateInput(todayDay()))
  const [reference, setReference] = useState('')
  const reload = useReload()
  const paid = useMutation({ ...orpc.payroll.deposits.markPaid.mutationOptions(), onSuccess: () => { reload(); close() } })
  const date = fromDateInput(day)
  const ready = !!date && reference.trim().length > 0
  return (
    <FormDialog onOpenChange={close} dirty={reference.trim() !== '' && !paid.isSuccess} className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Paid - {deposit.reference}</DialogTitle>
        <DialogDescription>{inr(deposit.contributions + deposit.otherCharges)} filed on {formatDate(deposit.filedOn)}.</DialogDescription>
      </DialogHeader>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (ready) paid.mutate({ id: deposit.id, paidOn: date, paymentReference: reference.trim() }) }}>
        <div className="space-y-1.5">
          <Label htmlFor="dp-day">Paid on</Label>
          <Input id="dp-day" type="date" className="h-10" max={toDateInput(todayDay())} value={day} onChange={(e) => setDay(e.target.value)} disabled={paid.isPending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dp-ref">Payment reference</Label>
          <Input id="dp-ref" className="h-10" placeholder="CRN / CIN / bank reference" value={reference} onChange={(e) => setReference(e.target.value)} disabled={paid.isPending} />
        </div>
        <FormError error={paid.error} />
        <DialogFooter>
          <DialogCancel />
          <Button type="submit" disabled={paid.isPending || !ready}>{paid.isPending ? 'Saving…' : 'Mark paid'}</Button>
        </DialogFooter>
      </form>
    </FormDialog>
  )
}
