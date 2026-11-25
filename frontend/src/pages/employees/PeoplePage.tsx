import { MovementReportView } from './components/MovementReportView'
import { Navigate, useSearchParams } from 'react-router'
import { PillTabsList, PillTabsTrigger } from '@/components/PillTabs'
import { Tabs } from '@/components/ui/tabs'
import { useAccess } from '@/hooks/useAccess'
import { usePortal } from '@/hooks/usePortal'
import { DirectoryView } from './components/DirectoryView'
import { EmployeeRecordsView } from './components/EmployeeRecordsView'
import { OrgChartView } from './components/OrgChartView'

// People (the user, 2026-11-21, like greytHR's People), split between the two portals (the user, 2026-11-25):
// - /ess/employees: every employee's company directory (everyone working now in every company - a basic card each) and the
//   org chart (`?view=chart&code=...`)
// - /manage/employees: Employee · Directory & job View - HR's "Employee records" (filters, tiles, Excel, Add employee) and
//   "Joiners & leavers" (`?view=movements`); without that access -> the role portal's home
export function PeoplePage() {
  const { ready, can } = useAccess()
  const { portal } = usePortal()
  const [params, setParams] = useSearchParams()
  const hr = can('EMPLOYEES')
  const asked = params.get('view')
  const tabs: [string, string][] = portal === 'ess' ? [['directory', 'Directory'], ['chart', 'Org chart']] : [['records', 'Employee records'], ['movements', 'Joiners & leavers']]
  const first = tabs[0]![0]
  const view = tabs.some(([value]) => value === asked) ? asked! : first
  // a new tab starts without the other tab's address values (records keep their own filters there)
  const go = (next: string, extra: Record<string, string> = {}) => setParams(next === first ? extra : { view: next, ...extra }, { replace: next !== 'chart' })
  if (portal === 'manage' && ready && !hr) return <Navigate to="/manage" replace />

  return (
    <Tabs value={view} onValueChange={(value) => go(String(value))} className="gap-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-light tracking-tight">{portal === 'ess' ? 'People' : 'Employees'}</h1>
        <PillTabsList>
          {tabs.map(([value, label]) => <PillTabsTrigger key={value} value={value}>{label}</PillTabsTrigger>)}
        </PillTabsList>
      </div>
      {view === 'directory' && <DirectoryView onChart={(code) => go('chart', { code })} />}
      {view === 'chart' && <OrgChartView employeeCode={params.get('code')} onMove={(code) => go('chart', { code })} />}
      {view === 'records' && <EmployeeRecordsView />}
      {view === 'movements' && <MovementReportView />}
    </Tabs>
  )
}
