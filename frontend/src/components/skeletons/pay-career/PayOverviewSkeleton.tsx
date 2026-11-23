import { BriefcaseBusiness, History, TrendingUp, Wallet } from 'lucide-react'
import { Chip, InfoCard } from '@/components/ProfileCards'
import { TimelineSkeleton } from '@/components/skeletons/common/TimelineSkeleton'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// The job details' groups and labels - the same as MyJobDetails (pages/pay-career/components); change both together
const GROUPS: [title: string, labels: string[]][] = [
  ['Where', ['Plant', 'Department', 'Work location', 'Region', 'Cost centre']],
  ['Role', ['Designation', 'Position', 'Grade', 'Employment type', 'Workforce', 'Joining type']],
  ['People', ['Reports to', 'Functional manager', 'HOD']],
]
const VALUE = ['w-24', 'w-20', 'w-28', 'w-16', 'w-24', 'w-20']
// a typical salary: the earnings, then the employer contributions
const EARNINGS = ['max-w-12', 'max-w-10', 'max-w-36', 'max-w-24', 'max-w-16', 'max-w-32', 'max-w-28', 'max-w-10', 'max-w-14']
const EMPLOYER = ['max-w-48', 'max-w-48', 'max-w-52']

// Loading placeholder for Pay & career's Overview, drawn like the loaded page with only the data missing: the charcoal
// header (who - name, code, role, place; Joined; Notice period; Total CTC / year), the "Job details" card with its real
// groups and labels, and below them "Monthly breakup" (its headings and rows) beside "Job timeline" and "Salary history".
export function PayOverviewSkeleton({ label = 'Loading' }: { label?: string }) {
  const bar = 'rounded-full bg-hero-foreground/10'
  return (
    <div role="status" aria-label={label} className="space-y-3">
      {/* as MyJobHero - dark, so it does not flash light first */}
      <header className="u-grain relative overflow-hidden rounded-2xl bg-hero px-4 py-3 text-hero-foreground shadow-card">
        <span aria-hidden className="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full bg-gold/15 blur-3xl" />
        <div className="relative grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_auto] lg:items-center lg:gap-5">
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-xl bg-gold/40" />
            {/* each line as tall as its text: the name with the code chip, the role, the place */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <Skeleton className={cn('h-4 w-28', bar)} />
                <span className="rounded-full border border-hero-foreground/15 px-2 py-1.5">
                  <Skeleton className={cn('h-2.5 w-16', bar)} />
                </span>
              </div>
              <div className="mt-0.5 flex h-5 items-center">
                <Skeleton className={cn('h-3.5 w-20', bar)} />
              </div>
              <div className="flex h-4 items-center">
                <Skeleton className={cn('h-3 w-56 max-w-full', bar)} />
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-end gap-x-6 gap-y-1 border-t border-hero-foreground/10 pt-3 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
            {/* the milestones: Joined is always the first one */}
            <div className="flex min-w-0 flex-1 gap-3 pt-1 sm:block">
              <span aria-hidden className="block size-3 shrink-0 rounded-full border-2 border-gold bg-gold" />
              <div className="min-w-0 pb-1 sm:pt-2">
                <p className="text-xs text-hero-foreground/60">Joined</p>
                <div className="flex h-5 items-center">
                  <Skeleton className={cn('h-3.5 w-20', bar)} />
                </div>
                <div className="flex h-4 items-center">
                  <Skeleton className={cn('h-3 w-16', bar)} />
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs text-hero-foreground/60">Notice period</p>
              <div className="flex h-5 items-center">
                <Skeleton className={cn('h-3.5 w-16', bar)} />
              </div>
            </div>
          </div>

          <div className="border-t border-hero-foreground/10 pt-3 lg:border-t-0 lg:pt-0 lg:text-right">
            <p className="text-xs text-hero-foreground/60">Total CTC / year</p>
            <div className="flex h-8 items-center lg:justify-end">
              <Skeleton className={cn('h-6 w-36', bar)} />
            </div>
            <div className="flex h-4 items-center lg:justify-end">
              <Skeleton className={cn('h-3 w-64 max-w-full', bar)} />
            </div>
          </div>
        </div>
      </header>

      {/* as MyJobDetails */}
      <InfoCard icon={BriefcaseBusiness} title="Job details">
        <div className="grid gap-x-6 gap-y-3 lg:grid-cols-[5fr_6fr_4fr]">
          {GROUPS.map(([title, labels], g) => (
            <section key={title} className={cn('min-w-0', g > 0 && 'lg:border-l lg:border-dashed lg:pl-6')}>
              <h4 className="mb-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{title}</h4>
              <dl className={cn('grid grid-cols-2 gap-x-4 gap-y-1.5', title === 'People' && 'lg:grid-cols-1')}>
                {labels.map((text, i) => (
                  <div key={text} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{text}</dt>
                    <dd className="flex h-5 items-center">
                      <Skeleton className={cn('h-3.5 rounded-full', VALUE[(g + i) % VALUE.length])} />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </InfoCard>

      <div className="grid items-start gap-3 lg:grid-cols-[7fr_5fr]">
        {/* as SalaryCard without its tiles */}
        <InfoCard
          icon={Wallet}
          title="Monthly breakup"
          aside={
            <Chip>
              <Skeleton className="my-0.5 h-3 w-20 rounded-full" />
            </Chip>
          }
        >
          <table className="w-full text-sm [&_td+td]:pl-3">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1 text-left font-medium">Component</th>
                <th className="py-1 text-right font-medium">Monthly</th>
                <th className="py-1 text-right font-medium">Annual</th>
              </tr>
            </thead>
            <tbody>
              <BreakupGroup title="Earnings" names={EARNINGS} />
              <tr className="text-muted-foreground">
                <td className="py-1.5">Monthly gross</td>
                <Amounts />
              </tr>
              <BreakupGroup title="Employer contributions" names={EMPLOYER} />
              <tr className="font-semibold">
                <td className="pt-3">Total (fixed CTC)</td>
                <Amounts top />
              </tr>
            </tbody>
          </table>
        </InfoCard>
        <div className="space-y-3">
          {/* as JobTimeline */}
          <InfoCard
            icon={History}
            title="Job timeline"
            aside={
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">As of</span>
                <Input type="date" aria-label="As of" disabled className="h-8 w-36 rounded-full text-xs" />
              </span>
            }
          >
            <TimelineSkeleton rows={2} link="Show all details" label={label} />
          </InfoCard>
          {/* as SalaryHistory */}
          <InfoCard icon={TrendingUp} title="Salary history">
            <ul className="divide-y divide-dashed divide-border/80">
              {['w-20', 'w-16'].map((reason, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <span className="w-24">
                    <Skeleton className="h-3 w-18 rounded-full" />
                  </span>
                  <Skeleton className="h-4 w-20 rounded-full" />
                  <Skeleton className={cn('h-3 rounded-full', reason)} />
                </li>
              ))}
            </ul>
          </InfoCard>
        </div>
      </div>
    </div>
  )
}

// A group of the breakup: its heading in real text, then a row per component with bars for the name and the amounts
function BreakupGroup({ title, names }: { title: string; names: string[] }) {
  return (
    <>
      <tr>
        <td colSpan={3} className="pt-3 pb-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          {title}
        </td>
      </tr>
      {/* the name bars shrink with the column, so a phone keeps the amounts in view */}
      {names.map((width, i) => (
        <tr key={i} className="border-b border-dashed border-border/80">
          <td className="py-1.5">
            <Skeleton className={cn('my-[3px] h-3.5 w-full rounded-full', width)} />
          </td>
          <Amounts />
        </tr>
      ))}
    </>
  )
}

// the monthly and annual amounts of a row
function Amounts({ top }: { top?: boolean }) {
  return (
    <>
      <td className={top ? 'pt-3' : 'py-1.5'}>
        <Skeleton className="my-[3px] ml-auto h-3.5 w-14 rounded-full" />
      </td>
      <td className={top ? 'pt-3' : 'py-1.5'}>
        <Skeleton className="my-[3px] ml-auto h-3.5 w-16 rounded-full" />
      </td>
    </>
  )
}
