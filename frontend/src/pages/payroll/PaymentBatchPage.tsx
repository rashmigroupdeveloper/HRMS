import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { ArrowLeft, CheckCheck, Download, Send, Undo2, X } from 'lucide-react'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { PaymentBatchSkeleton } from '@/components/skeletons/payroll/PaymentBatchSkeleton'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { client, orpc } from '@/lib/orpc'
import { downloadFile, formatDate, formatDateTime, formatMoney, fromDateInput, toDateInput, todayDay } from '@/lib/utils'
import { BATCH_FACT_LABELS, BATCH_PAYMENT_COLUMNS, BATCH_PAYMENT_WIDTHS, BATCH_STATUS, BATCH_TILE_LABELS, LIST_NOTE, METHOD, MONTH_LABEL, PAYMENT_STATUS } from './components/payments-labels'

type Batch = Awaited<ReturnType<typeof client.payroll.payments.batch>>
type Payment = Batch['payments'][number]
type Step = { kind: 'send' } | { kind: 'cancel' } | { kind: 'paid'; payment?: Payment } | { kind: 'returned'; payment: Payment } | { kind: 'remove'; payment: Payment }
const inr = (amount: number) => formatMoney(amount, 'INR')

// One payment batch (/manage/salary-payments/:id - payroll stage 6 slice 2): its payments and the steps - download the
// plain payment list (bank transfer), mark it sent, mark payments paid with the day and the bank's reference (a cheque one
// at a time with its number), mark one returned with the bank's reason, take one out or give the batch up while it is not
// sent. The "Payroll payments" area over the whole company; never one's own payment.
export function PaymentBatchPage() {
  const id = Number(useParams().id)
  const valid = Number.isSafeInteger(id) && id > 0
  const query = useQuery({ ...orpc.payroll.payments.batch.queryOptions({ input: { id } }), enabled: valid })
  const [step, setStep] = useState<Step | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const b = query.data
  const open = b?.status === 'OPEN'
  const sent = b?.status === 'SENT'
  const tiles = b ? [String(b.totals.payments), inr(b.totals.amount), `${inr(b.totals.paid)} · ${b.totals.paidCount}`, String(b.totals.inBatchCount), String(b.totals.returnedCount)] : []
  return (
    <div className="space-y-4">
      <Link to="/manage/salary-payments?tab=batches" className="inline-flex min-h-9 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />Salary payments
      </Link>
      {!valid && <p role="alert" className="text-sm text-negative-ink">This is not a payment batch address.</p>}
      <FormError error={query.error} />
      {valid && query.isPending && <PaymentBatchSkeleton label="Loading the batch" />}
      {b && (
        <>
          <header className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="text-2xl font-light tracking-tight">Batch #{b.id} · {b.company.code}</h1>
                <Pill tone={BATCH_STATUS[b.status][1]}>{BATCH_STATUS[b.status][0]}</Pill>
                <Pill tone="neutral">{METHOD[b.method]}</Pill>
              </div>
              {b.canChange && (open || sent) && (
                <div className="flex flex-wrap items-start gap-2">
                  {b.method === 'BANK' && b.totals.inBatchCount > 0 && (
                    <Button variant="secondary" className="min-h-9 gap-1.5 rounded-full" title={LIST_NOTE} onClick={() => void downloadFile(() => client.payroll.payments.paymentList({ id: b.id }), setListError)}>
                      <Download className="size-4" aria-hidden />Payment list
                    </Button>
                  )}
                  {open && <Button className="min-h-9 gap-1.5 rounded-full" disabled={!b.totals.inBatchCount} onClick={() => setStep({ kind: 'send' })}><Send className="size-4" aria-hidden />Mark sent</Button>}
                  {sent && b.method !== 'CHEQUE' && b.totals.inBatchCount > 0 && <Button className="min-h-9 gap-1.5 rounded-full" onClick={() => setStep({ kind: 'paid' })}><CheckCheck className="size-4" aria-hidden />Mark paid</Button>}
                  {open && <Button variant="secondary" className="min-h-9 gap-1.5 rounded-full" onClick={() => setStep({ kind: 'cancel' })}><X className="size-4" aria-hidden />Give up</Button>}
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{b.company.name}{b.note ? ` · ${b.note}` : ''}</p>
            {listError && <p role="alert" className="text-xs text-negative-ink">{listError}</p>}
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              {BATCH_FACT_LABELS.map((label, i) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="break-words">{i === 0 ? `${formatDateTime(b.createdAt)} · ${b.createdBy?.name ?? '—'}` : i === 1 ? (b.sentAt ? `${formatDateTime(b.sentAt)} · ${b.sentBy?.name ?? '—'}` : 'Not yet') : b.closedAt ? `${formatDateTime(b.closedAt)} · ${b.closedBy?.name ?? '—'}` : 'Not yet'}</dd>
                </div>
              ))}
            </dl>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {BATCH_TILE_LABELS.map((label, i) => (
                <div key={label} className={`min-w-0 rounded-2xl bg-card px-3 py-2 shadow-card ${i === 0 ? 'col-span-2 sm:col-span-1' : ''}`}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`truncate text-lg font-medium leading-7 tabular-nums ${i === 4 && b.totals.returnedCount > 0 ? 'text-negative-ink' : ''}`}>{tiles[i]}</p>
                </div>
              ))}
            </div>
            {open && <p className="text-xs text-muted-foreground">{b.method === 'BANK' ? 'Download the payment list, pay it through the bank, then mark the batch sent.' : 'Hand over the cheques or cash, then mark the batch sent.'}</p>}
            {sent && <p className="text-xs text-muted-foreground">{b.method === 'CHEQUE' ? 'Mark each cheque paid with its number once it is cleared; a cheque that bounced is returned.' : 'Once the bank confirms, mark the batch paid with the day and the bank’s reference; anyone the bank sent back is returned with its reason.'}</p>}
          </header>
          <section className="overflow-x-auto rounded-2xl bg-card p-3 shadow-card sm:p-4">
            <Table aria-label="Payments" className="min-w-[760px] table-fixed text-[13px]">
              <TableHeader>
                <TableRow>{BATCH_PAYMENT_COLUMNS.map((h, i) => <TableHead key={`${h}-${i}`} style={{ width: BATCH_PAYMENT_WIDTHS[i] }} className="h-8 px-2 text-xs">{h}</TableHead>)}</TableRow>
              </TableHeader>
              <TableBody>
                {b.payments.map((p) => (
                  <TableRow key={p.id} className={p.status === 'REMOVED' ? 'text-muted-foreground' : undefined}>
                    <TableCell className="px-2 py-1.5"><p className="truncate font-medium">{p.name || p.employeeCode}</p><p className="text-xs text-muted-foreground">{p.employeeCode}</p></TableCell>
                    <TableCell className="px-2 py-1.5">{MONTH_LABEL(p.run.payMonth)}</TableCell>
                    <TableCell className="px-2 py-1.5 tabular-nums">{inr(p.amount)}</TableCell>
                    <TableCell className="px-2 py-1.5 text-xs">
                      {p.account ? <><p>{p.account.bankName} ·· {p.account.last4}</p><p className="text-muted-foreground">{p.account.ifsc ?? ''}</p></> : p.chequeNumber ? <p>Cheque {p.chequeNumber}</p> : <p className="text-muted-foreground">{METHOD[b.method]}</p>}
                    </TableCell>
                    <TableCell className="px-2 py-1.5">
                      <Pill tone={PAYMENT_STATUS[p.status][1]} className="py-0.5">{PAYMENT_STATUS[p.status][0]}</Pill>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground" title={p.returnReason ?? undefined}>
                        {p.status === 'PAID' ? `${formatDate(p.paidOn)}${p.bankReference ? ` · ${p.bankReference}` : ''}` : p.status === 'RETURNED' ? p.returnReason : p.status === 'REMOVED' ? `by ${p.removedBy?.name ?? '—'}` : p.own ? 'Your own pay' : ' '}
                      </p>
                    </TableCell>
                    <TableCell className="px-2 py-1.5">
                      {b.canChange && !p.own && (
                        <div className="flex flex-nowrap gap-1">
                          {open && p.status === 'IN_BATCH' && <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setStep({ kind: 'remove', payment: p })}>Take out</Button>}
                          {sent && p.status === 'IN_BATCH' && <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setStep({ kind: 'paid', payment: p })}>Paid</Button>}
                          {((sent && p.status === 'IN_BATCH') || p.status === 'PAID') && <Button variant="ghost" size="sm" className="h-7 gap-1 px-2" onClick={() => setStep({ kind: 'returned', payment: p })}><Undo2 className="size-3.5" aria-hidden />Returned</Button>}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
          {step && <StepDialog batch={b} step={step} close={() => setStep(null)} />}
        </>
      )}
    </div>
  )
}

const STEP_TEXT = {
  send: ['Mark the batch sent?', 'Do it once the list is uploaded to the bank, or the cheques / cash handed over. Nobody can be taken out afterwards - a payment that does not go through is returned.', 'Mark sent'],
  cancel: ['Give up this batch?', 'Everyone in it is taken out and is to pay again. Nothing was paid.', 'Give up'],
  remove: ['Take this payment out?', 'The person is to pay again, in another batch.', 'Take out'],
} as const

// The steps of a batch: a confirmation (sent, give up, take out), paid (the day and the bank's reference - a cheque with its
// number), returned (the bank's reason)
function StepDialog({ batch, step, close }: { batch: Batch; step: Step; close: () => void }) {
  const queryClient = useQueryClient()
  const done = { onSuccess: () => { void queryClient.invalidateQueries({ queryKey: orpc.payroll.key() }); close() } }
  const send = useMutation({ ...orpc.payroll.payments.sendBatch.mutationOptions(), ...done })
  const cancel = useMutation({ ...orpc.payroll.payments.cancelBatch.mutationOptions(), ...done })
  const remove = useMutation({ ...orpc.payroll.payments.removePayment.mutationOptions(), ...done })
  const paid = useMutation({ ...orpc.payroll.payments.markPaid.mutationOptions(), ...done })
  const returned = useMutation({ ...orpc.payroll.payments.markReturned.mutationOptions(), ...done })
  const [day, setDay] = useState(toDateInput(todayDay()))
  const [text, setText] = useState('')
  const pending = send.isPending || cancel.isPending || remove.isPending || paid.isPending || returned.isPending
  const error = send.error ?? cancel.error ?? remove.error ?? paid.error ?? returned.error
  const cheque = batch.method === 'CHEQUE'

  if (step.kind === 'send' || step.kind === 'cancel' || step.kind === 'remove') {
    const [title, description, label] = STEP_TEXT[step.kind]
    const go = () => (step.kind === 'send' ? send.mutate({ id: batch.id }) : step.kind === 'cancel' ? cancel.mutate({ id: batch.id }) : remove.mutate({ paymentId: step.payment.id }))
    return (
      <FormDialog onOpenChange={close} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{step.kind === 'remove' ? `${step.payment.name || step.payment.employeeCode} · ${inr(step.payment.amount)}. ` : ''}{description}</DialogDescription>
        </DialogHeader>
        <FormError error={error} />
        <DialogFooter>
          <DialogCancel />
          <Button variant={step.kind === 'send' ? 'default' : 'destructive'} disabled={pending} onClick={go}>{pending ? 'Saving…' : label}</Button>
        </DialogFooter>
      </FormDialog>
    )
  }

  if (step.kind === 'returned') {
    return (
      <FormDialog onOpenChange={close} dirty={text.trim() !== '' && !returned.isSuccess} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Returned by the bank?</DialogTitle>
          <DialogDescription>{step.payment.name || step.payment.employeeCode} · {inr(step.payment.amount)}. {step.payment.status === 'PAID' ? 'It was marked paid - the bank took it back.' : ''} The amount is owed again and paid in a later batch, once the account is right.</DialogDescription>
        </DialogHeader>
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (text.trim().length >= 3) returned.mutate({ paymentId: step.payment.id, reason: text.trim() }) }}>
          <Label htmlFor="rt-reason">The bank’s reason</Label>
          <Textarea id="rt-reason" rows={2} placeholder="e.g. Account closed" value={text} onChange={(e) => setText(e.target.value)} disabled={pending} />
          <FormError error={error} />
          <DialogFooter>
            <DialogCancel />
            <Button type="submit" variant="destructive" disabled={pending || text.trim().length < 3}>{pending ? 'Saving…' : 'Mark returned'}</Button>
          </DialogFooter>
        </form>
      </FormDialog>
    )
  }

  // paid: one payment (a cheque, or one the bank confirmed on its own) or every one still waiting
  const one = step.payment
  const date = fromDateInput(day)
  const ready = !!date && (!cheque || text.trim().length > 0)
  return (
    <FormDialog onOpenChange={close} dirty={text.trim() !== '' && !paid.isSuccess} className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{one ? `Paid - ${one.name || one.employeeCode}` : `Mark ${batch.totals.inBatchCount} ${batch.totals.inBatchCount === 1 ? 'payment' : 'payments'} paid`}</DialogTitle>
        <DialogDescription>{one ? inr(one.amount) : `Everyone still waiting in this batch. Mark anyone the bank sent back as returned instead.`}</DialogDescription>
      </DialogHeader>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (ready) paid.mutate({ batchId: batch.id, paidOn: date, ...(one && { paymentIds: [one.id] }), ...(cheque ? { chequeNumber: text.trim() } : text.trim() ? { reference: text.trim() } : {}) }) }}>
        <div className="space-y-1.5">
          <Label htmlFor="pd-day">Paid on</Label>
          <Input id="pd-day" type="date" className="h-10" max={toDateInput(todayDay())} value={day} onChange={(e) => setDay(e.target.value)} disabled={pending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pd-ref">{cheque ? 'Cheque number' : 'Bank reference (optional)'}</Label>
          <Input id="pd-ref" className="h-10" placeholder={cheque ? 'e.g. 000123' : 'e.g. the UTR or the bank’s batch reference'} value={text} onChange={(e) => setText(e.target.value)} disabled={pending} />
        </div>
        <FormError error={error} />
        <DialogFooter>
          <DialogCancel />
          <Button type="submit" disabled={pending || !ready}>{pending ? 'Saving…' : 'Mark paid'}</Button>
        </DialogFooter>
      </form>
    </FormDialog>
  )
}
