import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { PillTabsList, PillTabsTrigger } from '@/components/PillTabs'
import { PayrollRunHeaderSkeleton } from '@/components/skeletons/payroll/PayrollRunHeaderSkeleton'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { formatDate, formatDoneBy } from '@/lib/utils'
import { RunInputs } from './components/RunInputs'
import { RunPeople } from './components/RunPeople'
import { RUN_FACT_LABELS, RUN_TABS, RUN_TILE_LABELS, SALARY_HIDDEN_NOTE, monthLabel } from './components/payroll-labels'

// One pay run (payroll stage 2): its people with the salary in force on each day of the month (a copy, refreshed from
// the employee records while it is a draft) and the month's inputs. Payroll: View over the whole company; changes need
// Payroll: Edit over the whole company. Salary figures also need Salary: View over the whole company.
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
  const refresh = useMutation({
    ...orpc.payroll.people.refresh.mutationOptions(),
    onSuccess: () => {
      setRefreshing(false)
      void queryClient.invalidateQueries({ queryKey: orpc.payroll.key() })
    },
  })
  const r = run.data
  const facts = r ? [`${formatDate(r.payFrom)} – ${formatDate(r.payTo)}`, `${formatDate(r.attendanceFrom)} – ${formatDate(r.attendanceTo)}`, formatDoneBy(r.peopleRefreshedAt, r.peopleRefreshedBy)] : []
  const tiles = r ? [r.people, r.peopleWithoutSalary, r.inputs] : []

  return (
    <div className="space-y-4">
      <Link to="/manage/payroll" className="inline-flex min-h-9 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />Payroll runs
      </Link>
      {!valid && <p role="alert" className="text-sm text-negative-ink">This is not a payroll run address.</p>}
      <FormError error={run.error} />
      {valid && run.isPending && <PayrollRunHeaderSkeleton refresh={ready && can('PAYROLL', 'WRITE')} />}
      {r && (
        <header className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="text-2xl font-light tracking-tight">{monthLabel(r.payMonth)} · {r.company.code}</h1>
              <Pill tone="neutral">Draft</Pill>
            </div>
            {r.canChange && (
              <Button variant="secondary" className="min-h-9 gap-1.5 rounded-full" onClick={() => setRefreshing(true)}>
                <RefreshCw className="size-4" aria-hidden />Refresh from employee records
              </Button>
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
          <div className="grid grid-cols-3 gap-2">
            {RUN_TILE_LABELS.map((label, i) => (
              <div key={label} className="rounded-2xl bg-card px-3 py-2 shadow-card">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-lg font-medium tabular-nums ${i === 1 && tiles[i] ? 'text-warning-ink' : ''}`}>{tiles[i]}</p>
              </div>
            ))}
          </div>
          {r.salaryHidden && <p className="text-xs text-muted-foreground">{SALARY_HIDDEN_NOTE}</p>}
        </header>
      )}
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
          description="The people and their salaries are copied again from the employee records as they are now. People who no longer belong to this month are removed, unless they have inputs. Inputs are kept."
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
