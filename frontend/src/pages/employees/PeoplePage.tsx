import { useSearchParams } from 'react-router'
import { PillTabsList, PillTabsTrigger } from '@/components/PillTabs'
import { Tabs } from '@/components/ui/tabs'
import { useAccess } from '@/hooks/useAccess'
import { DirectoryView } from './components/DirectoryView'
import { EmployeeRecordsView } from './components/EmployeeRecordsView'
import { OrgChartView } from './components/OrgChartView'

// People (/employees - the user, 2026-11-21, like greytHR's People): every logged-in employee gets the company directory
// (everyone working now in every company - a basic card each) and the org chart; those with Employee · Directory & job
// View also get "Employee records" - HR's list with filters, tiles, Excel and Add employee (the whole page before), and
// "Open full profile" on a card. `?view=chart&code=...` / `?view=records` keep the tab in the address.
export function PeoplePage() {
  const { ready, can } = useAccess()
  const [params, setParams] = useSearchParams()
  const hr = can('EMPLOYEES')
  const asked = params.get('view')
  // (?view=records is kept until accounts.me answers - a hard refresh - so the page does not open the directory first)
  const view = asked === 'chart' || (asked === 'records' && (hr || !ready)) ? asked : 'directory'
  // a new tab starts without the other tab's address values (records keep their own filters there)
  const go = (next: string, extra: Record<string, string> = {}) => setParams(next === 'directory' ? extra : { view: next, ...extra }, { replace: next !== 'chart' })

  return (
    <Tabs value={view} onValueChange={(value) => go(String(value))} className="gap-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-light tracking-tight">People</h1>
        <PillTabsList>
          <PillTabsTrigger value="directory">Directory</PillTabsTrigger>
          <PillTabsTrigger value="chart">Org chart</PillTabsTrigger>
          {hr && <PillTabsTrigger value="records">Employee records</PillTabsTrigger>}
        </PillTabsList>
      </div>
      {view === 'directory' && <DirectoryView onChart={(code) => go('chart', { code })} />}
      {view === 'chart' && <OrgChartView employeeCode={params.get('code')} onMove={(code) => go('chart', { code })} />}
      {view === 'records' && <EmployeeRecordsView />}
    </Tabs>
  )
}
