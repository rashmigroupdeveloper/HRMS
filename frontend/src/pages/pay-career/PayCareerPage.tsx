import { Navigate, useSearchParams } from 'react-router'
import { ChangeListSkeleton } from '@/components/skeletons/pay-career/ChangeListSkeleton'
import { PayOverviewSkeleton } from '@/components/skeletons/pay-career/PayOverviewSkeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccess } from '@/hooks/useAccess'
import { usePortal } from '@/hooks/usePortal'
import { cn } from '@/lib/utils'
import { ChangeRegisterView } from './components/ChangeRegisterView'
import { MyPayslipsView } from './components/MyPayslipsView'
import { OverviewView } from './components/OverviewView'
import { RaiseChangeView } from './components/RaiseChangeView'

// Pay & career (/pay-career - the user, 2026-11-21; was "Job changes", then "Jobs & salary"): a sidebar of sections - more come later (payslips,
// tax statements, loans, reimbursements...). The first is everyone's; every other one follows its access area:
// - Overview: the employee's own job, salary, and the changes asked for them
// - Payslips (?view=payslips, self-service only - payroll stage 6): one's own payslips once HR releases them
// - Raise a change (?view=raise): "Request job changes" or "Request salary changes" - ask for others, follow what they asked
// - Change register (?view=register): Employees: View - every change of the employees inside their data access
// Two portals (2026-11-25): /ess/pay-career is the Overview alone (no role, so the others never show); /manage/pay-career
// the role's sections without one's own Overview (none of them: back to the role portal's home).
// On a phone the sidebar becomes a row of pills above the section. Compact (the user, 2026-11-21: "so much gap"): a one-line
// title, a narrow sidebar with tight items.
export function PayCareerPage() {
  const { me, ready, can } = useAccess()
  const { portal } = usePortal()
  const [params, setParams] = useSearchParams()
  const sections = [
    { key: 'mine', label: 'Overview', show: portal === 'ess' },
    // one's own payslips (payroll stage 6) - self-service only
    { key: 'payslips', label: 'Payslips', show: portal === 'ess' },
    { key: 'raise', label: 'Raise a change', show: can('JOB_CHANGE_REQUEST', 'WRITE') || can('SALARY_CHANGE_REQUEST', 'WRITE') },
    { key: 'register', label: 'Change register', show: can('EMPLOYEES') },
  ].filter((s) => s.show)
  // the names of before (others / all / requests) still open the right section
  const OLD: Record<string, string> = { others: 'register', all: 'register', requests: 'raise' }
  const asked = OLD[params.get('view') ?? ''] ?? params.get('view')
  // (until accounts.me answers - a hard refresh - the asked section is kept, so the page does not open Overview first)
  const view = sections.find((s) => s.key === asked)?.key ?? (!ready && (asked === 'raise' || asked === 'register') ? asked : (sections[0]?.key ?? 'mine'))
  // a new section starts without the other's filters
  const go = (key: string) => setParams(key === 'mine' ? {} : { view: key }, { replace: true })
  if (portal === 'manage' && ready && !sections.length) return <Navigate to="/manage" replace />

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-light tracking-tight">Pay &amp; career</h1>
      <div className="grid items-start gap-3 lg:grid-cols-[11.5rem_minmax(0,1fr)]">
        <nav aria-label="Pay & career" className="flex gap-1 overflow-x-auto [scrollbar-width:none] lg:sticky lg:top-4 lg:flex-col lg:gap-0.5 lg:rounded-2xl lg:bg-card lg:p-1.5 lg:shadow-card">
          {sections.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-current={view === s.key ? 'page' : undefined}
              onClick={() => go(s.key)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-left text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:rounded-lg lg:px-2.5',
                view === s.key
                  ? 'bg-hero font-medium text-hero-foreground lg:bg-gold-soft lg:text-foreground'
                  : 'bg-card text-muted-foreground shadow-card hover:text-foreground lg:bg-transparent lg:shadow-none lg:hover:bg-surface-2',
              )}
            >
              {s.label}
            </button>
          ))}
          {/* the other sections follow the access - bars until accounts.me answers */}
          {!ready &&
            ['w-24', 'w-28'].map((width) => (
              <span key={width} className="flex h-8 shrink-0 items-center rounded-full bg-card px-3 shadow-card lg:rounded-lg lg:bg-transparent lg:px-2.5 lg:shadow-none">
                <Skeleton className={`h-3.5 rounded-full ${width}`} />
              </span>
            ))}
        </nav>
        <section className="min-w-0">
          {view === 'raise' ? (
            <RaiseChangeView />
          ) : view === 'payslips' ? (
            <MyPayslipsView />
          ) : view === 'register' ? (
            <ChangeRegisterView />
          ) : portal === 'manage' ? (
            // the role portal before accounts.me answers: its sections are lists of changes
            <ChangeListSkeleton label="Loading the changes" />
          ) : me ? (
            <OverviewView employeeCode={me.employeeCode} />
          ) : (
            <PayOverviewSkeleton label="Loading your job and pay" />
          )}
        </section>
      </div>
    </div>
  )
}
