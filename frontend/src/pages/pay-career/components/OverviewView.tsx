import { useQuery } from '@tanstack/react-query'
import { FormError } from '@/components/FormError'
import { JobTimeline } from '@/components/JobTimeline'
import { SalaryCard } from '@/components/SalaryCard'
import { SalaryHistory } from '@/components/SalaryHistory'
import { PayOverviewSkeleton } from '@/components/skeletons/pay-career/PayOverviewSkeleton'
import { orpc } from '@/lib/orpc'
import { MyJobDetails } from './MyJobDetails'
import { MyJobHero } from './MyJobHero'
import { RequestsAboutMe } from './RequestsAboutMe'

// The "Overview" of Pay & career (the user, 2026-11-21): the logged-in employee's own record - job details, the job
// timeline (changes in force), the salary in force with its breakup and the salary history; above them the changes asked
// for them that are not in force (the user, 2026-11-21 - was "record only" earlier the same day).
// Redesigned the same day ("boring"): a charcoal header (who, milestones, total CTC), the job details as a compact
// grouped grid, then the monthly breakup beside the job timeline and the salary history.
export function OverviewView({ employeeCode }: { employeeCode: string }) {
  const profile = useQuery(orpc.employees.getByCode.queryOptions({ input: { employeeCode } }))
  const e = profile.data
  if (profile.error) return <FormError error={profile.error} />
  if (!e) return <PayOverviewSkeleton label="Loading your job and pay" />
  return (
    <div className="space-y-3">
      <MyJobHero e={e} />
      <RequestsAboutMe />
      <MyJobDetails e={e} />
      {e.salary ? (
        <div className="grid items-start gap-3 lg:grid-cols-[7fr_5fr]">
          <SalaryCard s={e.salary} tiles={false} />
          <div className="space-y-3">
            <JobTimeline employee={e} canSeeChanges={false} />
            <SalaryHistory employeeCode={e.employeeCode} />
          </div>
        </div>
      ) : (
        <div className="lg:max-w-xl">
          <JobTimeline employee={e} canSeeChanges={false} />
        </div>
      )}
    </div>
  )
}
