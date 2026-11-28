import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, CalendarCheck, RefreshCw, Send, Undo2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { PillTabsList, PillTabsTrigger } from '@/components/PillTabs'
import { PayrollRunHeaderSkeleton } from '@/components/skeletons/payroll/PayrollRunHeaderSkeleton'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { formatDate, formatDateTime, formatDoneBy } from '@/lib/utils'
import { RunOverview } from './components/RunOverview'
import { RunChecks } from './components/RunChecks'
import { monthPath } from './components/deposits-labels'
import { RunInputs } from './components/RunInputs'
import { RunPeople } from './components/RunPeople'
import { PayslipsLine, RegisterButton } from './components/RunPayslips'
import { COMPUTE_LABEL, FINAL_NOTE, NOT_LOCKED_NOTE, NO_PF_NOTE, OUTDATED_NOTE, PAY_RULE_NOTE, REFRESH_LABEL, RUN_FACT_LABELS, RUN_STATUS, RUN_TABS, SALARY_HIDDEN_NOTE, SEND_LABEL, SEND_NOTE, monthLabel } from './components/payroll-labels'

// One pay run: its people with the salary in force on each day of the pay period (a copy, refreshed from the employee
// records while it is a draft), the month's inputs (stage 2), and "Work out pay" (stage 3): each person's paid and unpaid
// days from the locked attendance and what they earned, deductions and net (stage 4); Checks and "Send for approval"
// (stage 5: the approval service decides; approved = final, never to change); the salary register and, on a final run,
// releasing the payslips (stage 6). Payroll: View over the whole company;
// changes need Payroll: Edit over the whole company. Salary figures also need Salary: View over the whole company.
export function PayrollRunPage() {
  const { id: rawId } = useParams()
  const id = Number(rawId)
  const valid = Number.isSafeInteger(id) && id > 0
  const [params, setParams] = useSearchParams()
  const tab = RUN_TABS.some((t) => t.value === params.get('tab')) ? params.get('tab')! : 'people'
  const [refreshing, setRefreshing] = useState(false)
  const [sending, setSending] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const { ready, can, coversWhole } = useAccess()
  const queryClient = useQueryClient()
  const run = useQuery({ ...orpc.payroll.get.queryOptions({ input: { id } }), enabled: valid })
  const reload = () => void queryClient.invalidateQueries({ queryKey: orpc.payroll.key() })
  const refresh = useMutation({
    ...orpc.payroll.people.refresh.mutationOptions(),
    onSuccess: () => {
      setRefreshing(false)
      reload()
    },
  })
  // on a refusal too: "someone worked it out in the meantime" needs the newer run on the screen
  const compute = useMutation({ ...orpc.payroll.calculation.compute.mutationOptions(), onSettled: reload })
  // stage 5: send (the pay is worked out once more first) and withdraw (through the approval service)
  const send = useMutation({ ...orpc.payroll.send.mutationOptions(), onSuccess: () => setSending(false), onSettled: reload })
  const withdraw = useMutation({ ...orpc.approvals.cancel.mutationOptions(), onSuccess: () => setWithdrawing(false), onSettled: () => { reload(); void queryClient.invalidateQueries({ queryKey: orpc.approvals.key() }) } })
  const r = run.data
  const facts = r ? [`${formatDate(r.payFrom)} – ${formatDate(r.payTo)}`, formatDoneBy(r.peopleRefreshedAt, r.peopleRefreshedBy), r.computedAt ? formatDoneBy(r.computedAt, r.computedBy) : 'Not yet'] : []
  const notWorkedOut = r ? (r.peopleHeld ?? 0) + (r.peopleToWorkOutAgain ?? 0) : 0

  return (
    <div className="space-y-5">
      <Link to="/manage/payroll" className="inline-flex min-h-9 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />Payroll runs
      </Link>
      {!valid && <p role="alert" className="text-sm text-negative-ink">This is not a payroll run address.</p>}
      <FormError error={run.error} />
      {valid && run.isPending && <PayrollRunHeaderSkeleton actions={ready && can('PAYROLL', 'WRITE')} />}
      {r && (
        <header className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="text-[28px] font-light tracking-[-0.03em] sm:text-[40px]">{monthLabel(r.payMonth)} · {r.company.code}</h1>
              <Pill tone={r.status === 'FINALISED' ? 'positive' : r.status === 'IN_APPROVAL' ? 'gold' : 'neutral'}>{RUN_STATUS[r.status]}</Pill>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              {r.canChange && (
                <>
                  <Button variant="gold" className="min-h-10 gap-1.5 rounded-full" disabled={!r.attendanceLocked || compute.isPending} onClick={() => compute.mutate({ runId: id, expectedComputedAt: r.computedAt })}>
                    <CalendarCheck className="size-4" aria-hidden />{compute.isPending ? 'Working out…' : COMPUTE_LABEL}
                  </Button>
                  <Button variant="secondary" className="min-h-9 gap-1.5 rounded-full" disabled={!r.canSend} title={r.blockers.join(' · ') || undefined} onClick={() => setSending(true)}>
                    <Send className="size-4" aria-hidden />{SEND_LABEL}
                  </Button>
                  <Button variant="secondary" className="min-h-9 gap-1.5 rounded-full" onClick={() => setRefreshing(true)}>
                    <RefreshCw className="size-4" aria-hidden />{REFRESH_LABEL}
                  </Button>
                </>
              )}
              {r.status === 'IN_APPROVAL' && r.approval && ready && can('PAYROLL', 'WRITE') && (
                <Button variant="secondary" className="min-h-9 gap-1.5 rounded-full" onClick={() => setWithdrawing(true)}>
                  <Undo2 className="size-4" aria-hidden />Withdraw
                </Button>
              )}
              {/* stage 6: the register - once the pay is worked out, for those who see the salaries */}
              {r.computedAt && r.classificationsVerified && !r.salaryHidden && <RegisterButton runId={id} final={r.status === 'FINALISED'} />}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{r.company.name}</p>
          <p className="text-sm text-muted-foreground">Pay period <span className="ml-2 font-medium tabular-nums text-foreground">{facts[0]}</span></p>
          {r.classificationNotice && <p role="status" className="rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning-ink">{r.classificationNotice}</p>}
          <RunOverview run={r} />
          {r.approval && (
            <p role="status" className={`rounded-xl px-3 py-2 text-xs ${r.status === 'FINALISED' ? 'bg-positive/10 text-positive-ink' : r.approval.held ? 'bg-warning/10 text-warning-ink' : 'bg-surface-2/60'}`}>
              {r.status === 'FINALISED'
                ? `${FINAL_NOTE} Approved${r.finalisedBy ? ` - last by ${r.finalisedBy.name}` : ''}${r.finalisedAt ? `, ${formatDateTime(r.finalisedAt)}` : ''}.`
                : r.status === 'IN_APPROVAL'
                  ? `Sent for approval by ${r.approval.sentBy?.name ?? '—'}, ${formatDateTime(r.approval.sentAt)}. ${r.approval.held ? `Held: ${r.approval.held}.` : r.approval.step ? `Waiting - step ${r.approval.step.stepNo} of ${r.approval.step.of}: ${r.approval.step.who}${r.approval.step.late ? ' (late)' : ''}.` : ''}`
                  : `The last approval request was ${r.approval.status === 'REJECTED' ? 'rejected' : r.approval.status === 'CANCELLED' ? 'withdrawn' : r.approval.status.toLowerCase()} - the run is a draft again.`}{' '}
              <Link to={`/manage/approvals?request=${r.approval.requestId}`} className="underline underline-offset-4">Open the approval</Link>
            </p>
          )}
          {r.classificationsVerified && r.payslips && <PayslipsLine runId={id} payslips={r.payslips} />}
          {/* stage 6 slice 2: how far its payment has got (for those with Payroll payments over the company) */}
          {r.payments && (
            <p role="status" className="rounded-xl bg-surface-2/60 px-3 py-2 text-xs">
              <span className="font-medium">Payments: </span>
              {[`${r.payments.paid} of ${r.payments.total} paid`, r.payments.inBatch ? `${r.payments.inBatch} in a batch` : '', r.payments.toPay ? `${r.payments.toPay} to pay` : '', r.payments.held ? `${r.payments.held} held` : '', r.payments.returned ? `${r.payments.returned} returned` : ''].filter(Boolean).join(' · ')}.{' '}
              <Link to={`/manage/salary-payments?company=${r.company.id}&run=${id}`} className="underline underline-offset-4">Open salary payments</Link>
            </p>
          )}
          {/* stage 6 slice 3: what it must deposit to PF, ESIC, professional tax and LWF (Statutory deposits over the company) - not
              for a run from before the classification snapshots, which the deposits leave out */}
          {r.status === 'FINALISED' && r.classificationsVerified && ready && coversWhole('STATUTORY_DEPOSITS', 'READ', { companyId: r.company.id }) && (
            <p className="text-xs text-muted-foreground">
              <Link to={monthPath(r.company.id, r.payMonth)} className="underline underline-offset-4">Statutory deposits of this month</Link> - PF, ESIC, professional tax and LWF.
            </p>
          )}
          {r.status === 'DRAFT' && r.canChange && r.blockers.length > 0 && r.computedAt && <p className="text-xs text-muted-foreground">Before sending: {r.blockers.join(' · ')}.</p>}
          {r.daysOutdated ? <p role="status" className="rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning-ink">{OUTDATED_NOTE}</p> : !r.attendanceLocked && !r.computedAt && <p className="text-xs text-muted-foreground">{NOT_LOCKED_NOTE}</p>}
          {notWorkedOut > 0 && (
            <p role="status" className="rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning-ink">
              Pay not worked out for {notWorkedOut} {notWorkedOut === 1 ? 'person' : 'people'}: {[r.peopleHeld ? `${r.peopleHeld} held (no salary, days missing…)` : '', r.peopleToWorkOutAgain ? `${r.peopleToWorkOutAgain} to work out again (inputs changed)` : ''].filter(Boolean).join(', ')}. Choose “Pay not worked out” under Show to see who.
            </p>
          )}
          {!!r.peopleWithoutPf && <p className="text-xs text-muted-foreground">{r.peopleWithoutPf} {r.peopleWithoutPf === 1 ? 'person' : 'people'} {NO_PF_NOTE}</p>}
          <details className="rounded-2xl bg-card/60 px-4 py-3 text-sm">
            <summary className="cursor-pointer text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">Run details</summary>
            <div className="mt-3 space-y-3">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            {RUN_FACT_LABELS.map((label, i) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="break-words tabular-nums">{facts[i]}</dd>
              </div>
            ))}
          </dl>
              {r.computedAt && <p className="text-xs text-muted-foreground">{PAY_RULE_NOTE}</p>}
              {r.salaryHidden && <p className="text-xs text-muted-foreground">{SALARY_HIDDEN_NOTE}</p>}
            </div>
          </details>
        </header>
      )}
      <FormError error={compute.error} />
      {valid && !run.error && (
        <Tabs value={tab} onValueChange={(value) => setParams((old) => { const next = new URLSearchParams(old); next.set('tab', String(value)); return next }, { replace: true })}>
          <PillTabsList aria-label="Payroll run sections">
            {RUN_TABS.map((t) => <PillTabsTrigger key={t.value} value={t.value}>{t.label}</PillTabsTrigger>)}
          </PillTabsList>
          <TabsContent value="people" className="mt-3">{r?.classificationsVerified !== false && <RunPeople runId={id} canChange={r ? r.canChange : ready && can('PAYROLL', 'WRITE')} />}</TabsContent>
          <TabsContent value="inputs" className="mt-3"><RunInputs runId={id} canChange={r ? r.canChange : ready && can('PAYROLL', 'WRITE')} /></TabsContent>
          <TabsContent value="checks" className="mt-3"><RunChecks runId={id} mayChange={r ? r.canChange : ready && can('PAYROLL', 'WRITE')} /></TabsContent>
        </Tabs>
      )}
      {refreshing && r && (
        <ConfirmDialog
          title="Refresh from employee records?"
          description={`The people and their salaries are copied again from the employee records as they are now. People who no longer belong to this pay period are removed, unless they have inputs. Inputs are kept.${r.computedAt ? ' The pay worked out (days and amounts) is removed - work out pay again afterwards.' : ''}`}
          confirm={refresh.isPending ? 'Refreshing…' : 'Refresh'}
          pending={refresh.isPending}
          onConfirm={() => refresh.mutate({ runId: id, expectedRefreshedAt: r.peopleRefreshedAt }, { onError: () => setRefreshing(false) })}
          onClose={() => { if (!refresh.isPending) setRefreshing(false) }}
        />
      )}
      {refresh.error && <FormError error={refresh.error} />}
      {sending && r && (
        <ConfirmDialog
          title={`Send ${monthLabel(r.payMonth)} · ${r.company.code} for approval?`}
          description={SEND_NOTE}
          confirm={send.isPending ? 'Sending…' : SEND_LABEL}
          pending={send.isPending}
          onConfirm={() => send.mutate({ runId: id }, { onError: () => setSending(false) })}
          onClose={() => { if (!send.isPending) setSending(false) }}
        />
      )}
      {send.error && <FormError error={send.error} />}
      {withdrawing && r?.approval && (
        <ConfirmDialog
          title="Withdraw it from approval?"
          description="The request is cancelled and the run is a draft again - send it again when it is ready."
          confirm={withdraw.isPending ? 'Withdrawing…' : 'Withdraw'}
          pending={withdraw.isPending}
          onConfirm={() => withdraw.mutate({ id: r.approval!.requestId }, { onError: () => setWithdrawing(false) })}
          onClose={() => { if (!withdraw.isPending) setWithdrawing(false) }}
        />
      )}
      {withdraw.error && <FormError error={withdraw.error} />}
    </div>
  )
}
