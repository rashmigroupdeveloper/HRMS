import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { FormError } from '@/components/FormError'
import { PillTabsList, PillTabsTrigger } from '@/components/PillTabs'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { OpeningsTab } from './components/OpeningsTab'
import { LwfTab, PtTab, RatesTab, TaxTab } from './components/StatutorySettings'
import { CHANGE_NOTE, STATUTORY_NOTE, STATUTORY_TABS, STATUTORY_TITLE, type StatutoryTab } from './components/statutory-labels'

// Payroll › Statutory settings (payroll stage 4, approved 2026-11-27): the dated rates, the professional-tax and
// income-tax slabs, the labour welfare fund - one list for the group (Payroll View; changes need Payroll Edit for every
// company) - and opening tax figures, which are people's records (whole-company Payroll scope by the employee's company).
export function StatutoryPage() {
  const [params, setParams] = useSearchParams()
  const tab: StatutoryTab = STATUTORY_TABS.some((t) => t.value === params.get('tab')) ? (params.get('tab') as StatutoryTab) : 'rates'
  const { ready, can } = useAccess()
  const settings = useQuery(orpc.payroll.statutory.list.queryOptions())
  // before the settings say who may change them (Payroll Edit for every company), someone with Payroll Edit keeps the
  // add buttons' place, disabled - so nothing jumps when they arrive
  const canChange = settings.data ? settings.data.canChange : ready && can('PAYROLL', 'WRITE')
  const tabProps = { data: settings.data, pending: settings.isPending, canChange }
  return (
    <div className="space-y-4">
      <Link to="/manage/payroll" className="inline-flex min-h-9 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />Payroll runs
      </Link>
      <header className="space-y-1">
        <h1 className="text-2xl font-light tracking-tight">{STATUTORY_TITLE}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{STATUTORY_NOTE}</p>
        {settings.data && !canChange && tab !== 'openings' && <p className="text-xs text-muted-foreground">{CHANGE_NOTE}</p>}
      </header>
      <Tabs value={tab} onValueChange={(value) => setParams((old) => { const next = new URLSearchParams(old); next.set('tab', String(value)); return next }, { replace: true })}>
        <PillTabsList aria-label="Statutory settings sections">
          {STATUTORY_TABS.map((t) => <PillTabsTrigger key={t.value} value={t.value}>{t.label}</PillTabsTrigger>)}
        </PillTabsList>
        {tab !== 'openings' && <FormError error={settings.error} />}
        <TabsContent value="rates" className="mt-3"><section className="min-w-0 space-y-3 rounded-2xl bg-card p-3 shadow-card sm:p-4"><RatesTab {...tabProps} /></section></TabsContent>
        <TabsContent value="pt" className="mt-3"><section className="min-w-0 space-y-3 rounded-2xl bg-card p-3 shadow-card sm:p-4"><PtTab {...tabProps} /></section></TabsContent>
        <TabsContent value="lwf" className="mt-3"><section className="min-w-0 space-y-3 rounded-2xl bg-card p-3 shadow-card sm:p-4"><LwfTab {...tabProps} /></section></TabsContent>
        <TabsContent value="tax" className="mt-3"><section className="min-w-0 space-y-3 rounded-2xl bg-card p-3 shadow-card sm:p-4"><TaxTab {...tabProps} /></section></TabsContent>
        <TabsContent value="openings" className="mt-3"><section className="min-w-0 space-y-3 rounded-2xl bg-card p-3 shadow-card sm:p-4"><OpeningsTab canAdd={ready && can('PAYROLL', 'WRITE')} /></section></TabsContent>
      </Tabs>
    </div>
  )
}
