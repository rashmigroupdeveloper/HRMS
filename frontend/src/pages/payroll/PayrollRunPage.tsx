import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, CalendarCheck, RefreshCw } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { PillTabsList, PillTabsTrigger } from '@/components/PillTabs'
import { PayrollRunHeaderSkeleton } from '@/components/skeletons/payroll/PayrollRunHeaderSkeleton'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { formatDate, formatDoneBy, formatMoney } from '@/lib/utils'
import { RunInputs } from './components/RunInputs'
import { RunPeople } from './components/RunPeople'
import { COMPUTE_LABEL, NOT_LOCKED_NOTE, NO_PF_NOTE, OUTDATED_NOTE, PAY_RULE_NOTE, REFRESH_LABEL, RUN_FACT_LABELS, RUN_TABS, RUN_TILE_LABELS, SALARY_HIDDEN_NOTE, monthLabel } from './components/payroll-labels'

// One pay run: its people with the salary in force on each day of the pay period (a copy, refreshed from the employee
// records while it is a draft), the month's inputs (stage 2), and "Work out pay" (stage 3): each person's paid and unpaid
// days from the locked attendance and what they earned. Payroll: View over the whole company; changes need Payroll:
// Edit over the whole company. Salary figures (the earned gross too) also need Salary: View over the whole company.
export function PayrollRunPage() {
  const { id: rawId } = useParams()
  const id = Number(rawId)
  const valid = Number.isSafeInteger(id) && id > 0
  const [params, setParams] = useSearchParams()
  const tab = RUN_TABS.some((t) => t.value === params.get('tab')) ? params.get('tab')! : 'people'
  const [refreshing, setRefreshing] = useState(false)
  const { ready, can } = useAccess()
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
  const r = run.data
  const facts = r ? [`${formatDate(r.payFrom)} – ${formatDate(r.payTo)}`, formatDoneBy(r.peopleRefreshedAt, r.peopleRefreshedBy), r.computedAt ? formatDoneBy(r.computedAt, r.computedBy) : 'Not yet'] : []
  const gross = r ? (r.salaryHidden ? 'Hidden' : r.earnedGross === null ? '—' : formatMoney(r.earnedGross, 'INR')) : ''
  const net = r ? (r.salaryHidden ? 'Hidden' : r.netPay === null ? '—' : formatMoney(r.netPay, 'INR')) : ''
  const tiles = r ? [r.people, r.peopleWithoutSalary, r.inputs, r.peopleWithUnpaidDays ?? '—', r.peopleToCheck ?? '—', gross, net] : []
  // which tiles turn amber when they are not zero: people without a salary, people to check
  const warns = [false, true, false, false, true, false, false]
  const notWorkedOut = r ? (r.peopleHeld ?? 0) + (r.peopleToWorkOutAgain ?? 0) : 0

  return (
    <div className="space-y-4">
      <Link to="/manage/payroll" className="inline-flex min-h-9 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />Payroll runs
      </Link>
      {!valid && <p role="alert" className="text-sm text-negative-ink">This is not a payroll run address.</p>}
      <FormError error={run.error} />
      {valid && run.isPending && <PayrollRunHeaderSkeleton actions={ready && can('PAYROLL', 'WRITE')} />}
      {r && (
        <header className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="text-2xl font-light tracking-tight">{monthLabel(r.payMonth)} · {r.company.code}</h1>
              <Pill tone="neutral">Draft</Pill>
            </div>
            {r.canChange && (
              <div className="flex flex-wrap gap-2">
                <Button className="min-h-9 gap-1.5 rounded-full" disabled={!r.attendanceLocked || compute.isPending} onClick={() => compute.mutate({ runId: id, expectedComputedAt: r.computedAt })}>
                  <CalendarCheck className="size-4" aria-hidden />{compute.isPending ? 'Working out…' : COMPUTE_LABEL}
                </Button>
                <Button variant="secondary" className="min-h-9 gap-1.5 rounded-full" onClick={() => setRefreshing(true)}>
                  <RefreshCw className="size-4" aria-hidden />{REFRESH_LABEL}
                </Button>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{r.company.name}</p>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            {RUN_FACT_LABELS.map((label, i) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="break-words tabular-nums">{facts[i]}</dd>
              </div>
            ))}
          </dl>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {RUN_TILE_LABELS.map((label, i) => (
              // (the net pay, last, takes the whole row on a phone - two tiles a row leave it alone)
              <div key={label} className={`min-w-0 rounded-2xl bg-card px-3 py-2 shadow-card ${i === RUN_TILE_LABELS.length - 1 ? 'col-span-2 sm:col-span-1' : ''}`}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`truncate text-lg font-medium tabular-nums ${warns[i] && typeof tiles[i] === 'number' && tiles[i] > 0 ? 'text-warning-ink' : ''} ${tiles[i] === 'Hidden' ? 'text-sm font-normal text-muted-foreground' : ''}`}>{tiles[i]}</p>
              </div>
            ))}
          </div>
          {r.daysOutdated ? <p role="status" className="rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning-ink">{OUTDATED_NOTE}</p> : !r.attendanceLocked && !r.computedAt && <p className="text-xs text-muted-foreground">{NOT_LOCKED_NOTE}</p>}
          {notWorkedOut > 0 && (
            <p role="status" className="rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning-ink">
              Pay not worked out for {notWorkedOut} {notWorkedOut === 1 ? 'person' : 'people'}: {[r.peopleHeld ? `${r.peopleHeld} held (no salary, days missing…)` : '', r.peopleToWorkOutAgain ? `${r.peopleToWorkOutAgain} to work out again (inputs changed)` : ''].filter(Boolean).join(', ')}. Choose “Pay not worked out” under Show to see who.
            </p>
          )}
          {!!r.peopleWithoutPf && <p className="text-xs text-muted-foreground">{r.peopleWithoutPf} {r.peopleWithoutPf === 1 ? 'person' : 'people'} {NO_PF_NOTE}</p>}
          {r.computedAt && <p className="text-xs text-muted-foreground">{PAY_RULE_NOTE}</p>}
          {r.salaryHidden && <p className="text-xs text-muted-foreground">{SALARY_HIDDEN_NOTE}</p>}
        </header>
      )}
      <FormError error={compute.error} />
      {valid && !run.error && (
        <Tabs value={tab} onValueChange={(value) => setParams((old) => { const next = new URLSearchParams(old); next.set('tab', String(value)); return next }, { replace: true })}>
          <PillTabsList aria-label="Payroll run sections">
            {RUN_TABS.map((t) => <PillTabsTrigger key={t.value} value={t.value}>{t.label}</PillTabsTrigger>)}
          </PillTabsList>
          <TabsContent value="people" className="mt-3"><RunPeople runId={id} canChange={r ? r.canChange : ready && can('PAYROLL', 'WRITE')} /></TabsContent>
          <TabsContent value="inputs" className="mt-3"><RunInputs runId={id} canChange={r ? r.canChange : ready && can('PAYROLL', 'WRITE')} /></TabsContent>
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
    </div>
  )
}
