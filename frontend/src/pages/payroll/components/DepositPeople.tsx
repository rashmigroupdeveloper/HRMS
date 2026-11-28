import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, CornerDownRight, Undo2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/FormError'
import { Pager } from '@/components/Pager'
import { Pill } from '@/components/Pill'
import { DepositPeopleSkeleton } from '@/components/skeletons/payroll/DepositPeopleSkeleton'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { client, orpc } from '@/lib/orpc'
import { formatDate, formatMoney } from '@/lib/utils'
import type { Line } from './DepositRecords'
import { GAP_REASON, GAP_REASONS_OF, PEOPLE_COLUMNS, PEOPLE_SHOW, PEOPLE_WIDTHS, type GapReason } from './deposits-labels'

type People = Awaited<ReturnType<typeof client.payroll.deposits.people>>
type Person = People['items'][number]
type Show = keyof typeof PEOPLE_SHOW
type Step = { kind: 'leaveOut' } | { kind: 'takeIn' } | { kind: 'remove' } | { kind: 'undo'; person: Person }

// (the month page asks for the first page beside the month with the same size - change both together)
export const PEOPLE_PAGE_SIZE = 50
const PAGE_SIZE = PEOPLE_PAGE_SIZE
const inr = (amount: number | null | undefined) => (amount === null || amount === undefined ? '—' : formatMoney(amount, 'INR'))

// "People" of a month's PF or ESIC (Statutory deposits): everyone with the scheme's deduction, their UAN / ESIC number, and
// whether they are left out of the return (with why) or taken in by a later one. Pick people to mark them left out, to say
// which later deposit took them in, or to take a mark made by mistake away - never one's own. Each person's amounts only
// with Salary View over the whole company as well.
export function DepositPeople({ line, payMonth }: { line: Pick<Line, 'company' | 'scheme' | 'deposits' | 'noNumber'>; payMonth: Date }) {
  const scheme = line.scheme as 'PF' | 'ESIC'
  const [show, setShow] = useState<Show>('ALL')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [picked, setPicked] = useState<Map<number, Person>>(new Map())
  const [step, setStep] = useState<Step | null>(null)
  const query = useQuery(orpc.payroll.deposits.people.queryOptions({ input: { companyId: line.company.id, payMonth, scheme, show, search: search.trim() || undefined, page, pageSize: PAGE_SIZE } }))
  const data = query.data
  const pickable = (p: Person) => !!data?.canMark && !p.own && !p.gap?.takenIn
  const pickedList = [...picked.values()]
  const allUnmarked = pickedList.length > 0 && pickedList.every((p) => !p.gap)
  const allOpen = pickedList.length > 0 && pickedList.every((p) => p.gap && !p.gap.takenIn)
  const shown = data?.items ?? []
  const pageable = shown.filter(pickable)
  const allPicked = pageable.length > 0 && pageable.every((p) => picked.has(p.personId))
  const reset = () => { setPicked(new Map()); setPage(1) }
  const toggle = (p: Person, on: boolean) => setPicked((old) => { const next = new Map(old); if (on) next.set(p.personId, p); else next.delete(p.personId); return next })
  const numberLabel = scheme === 'PF' ? 'UAN' : 'ESIC number'
  return (
    <section className="space-y-2 rounded-2xl bg-card p-3 shadow-card sm:p-4">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-medium">People</h2>
        {line.noNumber > 0 && <p className="text-xs text-warning-ink">{line.noNumber} with no {numberLabel} yet, not marked left out - they cannot go in the return.</p>}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-full space-y-1 sm:w-44">
          <Label htmlFor="pp-show" className="text-xs text-muted-foreground">Show</Label>
          <NativeSelect id="pp-show" className="w-full [&_select]:h-9" value={show} onChange={(e) => { setShow(e.target.value as Show); reset() }}>
            {(Object.keys(PEOPLE_SHOW) as Show[]).map((s) => (
              <NativeSelectOption key={s} value={s}>{PEOPLE_SHOW[s]}{data ? ` (${s === 'ALL' ? data.counts.all : s === 'LEFT_OUT' ? data.counts.leftOut + data.counts.takenIn : data.counts.noNumber})` : ''}</NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="w-full space-y-1 sm:w-64">
          <Label htmlFor="pp-search" className="text-xs text-muted-foreground">Employee</Label>
          <Input id="pp-search" className="h-9" placeholder={`Code, name or ${numberLabel}`} value={search} onChange={(e) => { setSearch(e.target.value); reset() }} />
        </div>
      </div>
      <FormError error={query.error} />
      {picked.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gold-soft px-3 py-2 text-sm">
          <span className="tabular-nums">{picked.size} picked</span>
          <div className="flex flex-wrap gap-1.5">
            {allUnmarked && <Button size="sm" className="gap-1.5 rounded-full" onClick={() => setStep({ kind: 'leaveOut' })}><Ban className="size-4" aria-hidden />Left out of the return</Button>}
            {allOpen && line.deposits.length > 0 && <Button size="sm" className="gap-1.5 rounded-full" onClick={() => setStep({ kind: 'takeIn' })}><CornerDownRight className="size-4" aria-hidden />Taken in by…</Button>}
            {allOpen && <Button size="sm" variant="secondary" className="rounded-full" onClick={() => setStep({ kind: 'remove' })}>Remove the mark</Button>}
            {!allUnmarked && !allOpen && <span className="text-xs text-warning-ink">Pick only people not marked, or only people left out</span>}
          </div>
        </div>
      )}
      {query.isPending ? (
        <DepositPeopleSkeleton label="Loading the people" numberLabel={numberLabel} />
      ) : data && (shown.length === 0 ? (
        <EmptyState className="py-5" title="Nobody matches" hint={data.counts.all ? 'Change the filters above.' : 'Nobody in this month’s run has this deduction.'} />
      ) : (
        <div className="overflow-x-auto">
          <Table aria-label="People" className="min-w-[820px] table-fixed text-[13px]">
            <TableHeader>
              <TableRow>
                {PEOPLE_COLUMNS.map((h, i) => (
                  <TableHead key={`${h}-${i}`} style={{ width: PEOPLE_WIDTHS[i] }} className="h-8 px-2 text-xs">
                    {i === 0 && pageable.length > 0 ? <Checkbox aria-label="Pick everyone shown" checked={allPicked} onCheckedChange={(on) => setPicked(on === true ? new Map([...picked, ...pageable.map((p) => [p.personId, p] as const)]) : new Map())} /> : i === 2 ? numberLabel : h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((p) => (
                <TableRow key={p.personId}>
                  <TableCell className="px-2 py-1.5">{pickable(p) && <Checkbox aria-label={`Pick ${p.name || p.employeeCode}`} checked={picked.has(p.personId)} onCheckedChange={(on) => toggle(p, on === true)} />}</TableCell>
                  <TableCell className="px-2 py-1.5"><p className="truncate font-medium">{p.name || p.employeeCode}</p><p className="text-xs text-muted-foreground">{p.employeeCode}{p.own ? ' · you - a colleague marks it' : ''}</p></TableCell>
                  <TableCell className="px-2 py-1.5 tabular-nums">{p.number ?? <span className="text-warning-ink">None</span>}</TableCell>
                  <TableCell className="px-2 py-1.5 tabular-nums">{inr(p.amounts?.wages)}</TableCell>
                  <TableCell className="px-2 py-1.5 tabular-nums">{inr(p.amounts?.employee)}</TableCell>
                  <TableCell className="px-2 py-1.5 tabular-nums">{inr(p.amounts?.employer)}</TableCell>
                  <TableCell className="px-2 py-1.5">
                    {p.gap ? (
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <Pill tone={p.gap.takenIn ? 'positive' : 'warning'} className="py-0.5">{p.gap.takenIn ? 'Taken in' : GAP_REASON[p.gap.reason]}</Pill>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground" title={p.gap.note ?? undefined}>
                            {p.gap.takenIn ? `${p.gap.takenIn.reference}${p.gap.takenIn.paidOn ? ` · paid ${formatDate(p.gap.takenIn.paidOn)}` : ' · not paid yet'}` : `${p.gap.note ? `${p.gap.note} · ` : ''}${p.gap.by?.name ?? '—'}`}
                          </p>
                        </div>
                        {p.gap.takenIn && data.canMark && !p.own && <Button size="icon-sm" variant="ghost" aria-label={`Not taken in after all - ${p.name || p.employeeCode}`} onClick={() => setStep({ kind: 'undo', person: p })}><Undo2 aria-hidden /></Button>}
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
      {data && <Pager page={page} pages={Math.ceil(data.total / PAGE_SIZE)} onPage={setPage} />}
      {data && !data.seesAmounts && <p className="text-xs text-muted-foreground">Each person’s amounts also need Salary View over the whole company.</p>}
      {step && <PeopleStep line={line} payMonth={payMonth} step={step} people={step.kind === 'undo' ? [step.person] : pickedList} close={(done) => { setStep(null); if (done) setPicked(new Map()) }} />}
    </section>
  )
}

// The steps on people: left out (why), taken in by a later deposit, the mark removed, taken in undone
function PeopleStep({ line, payMonth, step, people, close }: { line: Pick<Line, 'company' | 'scheme' | 'deposits'>; payMonth: Date; step: Step; people: Person[]; close: (done: boolean) => void }) {
  const scheme = line.scheme as 'PF' | 'ESIC'
  const [reason, setReason] = useState<GapReason>(GAP_REASONS_OF[scheme][0]!)
  const [note, setNote] = useState('')
  // the month's returns / challans, the latest (usually the supplementary one) first chosen
  const [depositId, setDepositId] = useState(line.deposits.at(-1)?.id ?? 0)
  const queryClient = useQueryClient()
  const done = { onSuccess: () => { void queryClient.invalidateQueries({ queryKey: orpc.payroll.deposits.key() }); close(true) } }
  const leaveOut = useMutation({ ...orpc.payroll.deposits.leaveOut.mutationOptions(), ...done })
  const takeIn = useMutation({ ...orpc.payroll.deposits.takeIn.mutationOptions(), ...done })
  const remove = useMutation({ ...orpc.payroll.deposits.removeGaps.mutationOptions(), ...done })
  const pending = leaveOut.isPending || takeIn.isPending || remove.isPending
  const error = leaveOut.error ?? takeIn.error ?? remove.error
  const who = people.length === 1 ? (people[0]!.name || people[0]!.employeeCode) : `${people.length} people`
  const gapIds = people.flatMap((p) => (p.gap ? [p.gap.id] : []))

  if (step.kind === 'remove' || step.kind === 'undo') {
    return (
      <ConfirmDialog
        title={step.kind === 'remove' ? `Remove the mark of ${who}?` : `${who}: not taken in after all?`}
        description={step.kind === 'remove' ? 'Only for a mark made by mistake - they count as in the return again. The change history keeps it.' : 'They are left out again, with the reason given before, until a later deposit takes them in.'}
        confirm={pending ? 'Saving…' : step.kind === 'remove' ? 'Remove' : 'Not taken in'}
        pending={pending}
        onConfirm={() => (step.kind === 'remove' ? remove.mutate({ gapIds }) : takeIn.mutate({ gapIds, depositId: null }))}
        onClose={() => { if (!pending) close(false) }}
      />
    )
  }

  if (step.kind === 'takeIn') {
    return (
      <FormDialog onOpenChange={() => close(false)} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Taken in - {who}</DialogTitle>
          <DialogDescription>Which return / challan of this month took them in (usually a supplementary one recorded after the first)?</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (depositId) takeIn.mutate({ gapIds, depositId }) }}>
          <div className="space-y-1.5">
            <Label htmlFor="ti-deposit">Return / challan</Label>
            <NativeSelect id="ti-deposit" className="w-full [&_select]:h-10" value={String(depositId)} onChange={(e) => setDepositId(Number(e.target.value))} disabled={pending}>
              {line.deposits.map((d) => <NativeSelectOption key={d.id} value={String(d.id)}>{d.reference} · filed {formatDate(d.filedOn)}{d.paidOn ? ` · paid ${formatDate(d.paidOn)}` : ' · not paid'}</NativeSelectOption>)}
            </NativeSelect>
          </div>
          <FormError error={error} />
          <DialogFooter>
            <DialogCancel />
            <Button type="submit" disabled={pending || !depositId}>{pending ? 'Saving…' : 'Taken in'}</Button>
          </DialogFooter>
        </form>
      </FormDialog>
    )
  }

  const ready = reason !== 'OTHER' || note.trim().length >= 3
  return (
    <FormDialog onOpenChange={() => close(false)} dirty={note.trim() !== '' && !leaveOut.isSuccess} className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Left out of the {scheme} return - {who}</DialogTitle>
        <DialogDescription>Their deduction was made but cannot go in the return yet. It is followed - and listed until a later deposit takes them in. The employee is never responsible for it.</DialogDescription>
      </DialogHeader>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (ready) leaveOut.mutate({ companyId: line.company.id, payMonth, scheme, personIds: people.map((p) => p.personId), reason, note: note.trim() || undefined }) }}>
        <div className="space-y-1.5">
          <Label htmlFor="lo-reason">Why</Label>
          <NativeSelect id="lo-reason" className="w-full [&_select]:h-10" value={reason} onChange={(e) => setReason(e.target.value as GapReason)} disabled={pending}>
            {GAP_REASONS_OF[scheme].map((r) => <NativeSelectOption key={r} value={r}>{GAP_REASON[r]}</NativeSelectOption>)}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lo-note">{reason === 'OTHER' ? 'What is wrong' : 'Note (optional)'}</Label>
          <Textarea id="lo-note" rows={2} placeholder="e.g. Joint declaration sent to EPFO" value={note} onChange={(e) => setNote(e.target.value)} disabled={pending} />
        </div>
        <FormError error={error} />
        <DialogFooter>
          <DialogCancel />
          <Button type="submit" disabled={pending || !ready}>{pending ? 'Saving…' : 'Mark left out'}</Button>
        </DialogFooter>
      </form>
    </FormDialog>
  )
}
