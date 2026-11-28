import { useSearchParams } from 'react-router'
import { PillTabsList, PillTabsTrigger } from '@/components/PillTabs'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { BatchList, type BatchFilters } from './components/BatchList'
import { OwedList, type OwedFilters } from './components/OwedList'
import { BATCH_STATUS, OWED_STATES, PAYMENTS_NOTE, PAYMENTS_TITLE, PAYMENT_TABS, type OwedStateKey } from './components/payments-labels'

const positive = (text: string | null) => (text && /^\d+$/.test(text) && Number(text) > 0 && Number.isSafeInteger(Number(text)) ? Number(text) : undefined)

// Salary payments (/manage/salary-payments - payroll stage 6 slice 2, approved by the user 2026-11-28): "To pay & owed" -
// everyone of the approved runs not paid yet, to make batches from and to hold or release pay - and "Batches". The
// "Payroll payments" area over the whole company (RequireAccess); the filters live in the address (?tab, company, run,
// state, q, page, status).
export function PaymentsPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'batches' ? 'batches' : 'owed'
  const state = params.get('state')
  const status = params.get('status')
  const owed: OwedFilters = {
    companyId: positive(params.get('company')),
    runId: positive(params.get('run')),
    state: OWED_STATES.includes(state as OwedStateKey) ? (state as OwedStateKey) : undefined,
    search: params.get('q') ?? '',
    page: positive(params.get('page')) ?? 1,
  }
  const batches: BatchFilters = {
    companyId: positive(params.get('company')),
    status: status && status in BATCH_STATUS ? (status as BatchFilters['status']) : undefined,
    page: positive(params.get('page')) ?? 1,
  }
  // a filter starts from the first page; another company has its own months
  const setFilter = (key: string, value: string) =>
    setParams(
      (old) => {
        const next = new URLSearchParams(old)
        if (value) next.set(key, value)
        else next.delete(key)
        if (key !== 'page') next.delete('page')
        if (key === 'company') next.delete('run')
        return next
      },
      { replace: true },
    )
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-light tracking-tight">{PAYMENTS_TITLE}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{PAYMENTS_NOTE}</p>
      </header>
      <Tabs value={tab} onValueChange={(value) => setParams((old) => { const next = new URLSearchParams(old); next.set('tab', String(value)); next.delete('page'); next.delete('state'); next.delete('status'); return next }, { replace: true })}>
        <PillTabsList aria-label="Salary payments">
          {PAYMENT_TABS.map((t) => <PillTabsTrigger key={t.value} value={t.value}>{t.label}</PillTabsTrigger>)}
        </PillTabsList>
        <TabsContent value="owed" className="mt-3"><OwedList filters={owed} setFilter={setFilter} /></TabsContent>
        <TabsContent value="batches" className="mt-3"><BatchList filters={batches} setFilter={setFilter} /></TabsContent>
      </Tabs>
    </div>
  )
}
