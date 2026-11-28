import { ArrowUpRight, Check, Circle, Users, SlidersHorizontal, Flag } from 'lucide-react'
import { Link } from 'react-router'
import type { client } from '@/lib/orpc'
import { formatMoney } from '@/lib/utils'
import { RUN_OVERVIEW_METRICS, RUN_MONEY_LABELS, RUN_PREPARATION_STEPS } from './payroll-labels'

type Run = Awaited<ReturnType<typeof client.payroll.get>>

// A run's first reading: people, money and the preparation steps. Keep geometry and static labels in sync with
// skeletons/payroll/RunOverviewSkeleton. Progress comes from recorded states, never from an estimated percentage.
export function RunOverview({ run }: { run: Run }) {
  const values = [run.people, run.inputs, run.peopleToCheck]
  const icons = [Users, SlidersHorizontal, Flag, Users]
  const money = (value: number | null) => run.salaryHidden ? 'Hidden' : value === null ? '—' : formatMoney(value, 'INR')
  const done = [!!run.peopleRefreshedAt, !!run.computedAt && run.classificationsVerified && run.peopleHeld === 0 && run.peopleToWorkOutAgain === 0, run.status === 'FINALISED']
  const notes = [run.peopleRefreshedAt ? `${run.people} ${run.people === 1 ? 'person' : 'people'} in this run` : 'Copy employee records first', !run.classificationsVerified ? 'Historical review needed' : !run.computedAt ? 'Ready after attendance is locked' : (run.peopleHeld ?? 0) + (run.peopleToWorkOutAgain ?? 0) > 0 ? 'Some pay needs attention' : 'Figures worked out', run.status === 'FINALISED' ? 'Final figures are kept' : run.status === 'IN_APPROVAL' ? 'With the approvers' : 'Review checks before sending']
  const amounts = [run.earnedGross, run.deductions, run.employerContributions]

  return <div className="space-y-5">
    <dl className="grid grid-cols-3 gap-x-4 gap-y-5 sm:max-w-xl">
      {RUN_OVERVIEW_METRICS.map((label, i) => {
        const Icon = icons[i]!
        const warning = i === 2 && (values[i] ?? 0) > 0
        return <div key={label} className="flex min-w-0 flex-col">
          <dt className="order-2 mt-2 text-xs text-muted-foreground sm:text-sm">{label}</dt>
          <dd className={`order-1 flex items-baseline gap-2 text-[34px] font-light leading-none tracking-[-0.03em] tabular-nums sm:text-[42px] ${warning ? 'text-warning-ink' : ''}`}><Icon className="size-4 shrink-0 self-center text-muted-foreground" aria-hidden />{values[i] ?? '—'}</dd>
        </div>
      })}
    </dl>
    {(!!run.peopleWithUnpaidDays || run.peopleWithoutSalary > 0) && <p className="text-sm text-muted-foreground">{[run.peopleWithUnpaidDays ? `${run.peopleWithUnpaidDays} with unpaid days` : '', run.peopleWithoutSalary ? `${run.peopleWithoutSalary} without a salary` : ''].filter(Boolean).join(' · ')}</p>}
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(19rem,1fr)]">
      <section aria-label="Pay summary" className="min-w-0 rounded-[24px] bg-card p-5 shadow-card sm:p-6">
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-normal">Net pay</h2><span className="rounded-full bg-gold-soft px-3 py-1 text-xs text-foreground">{run.salaryHidden ? 'Salary access required' : run.classificationsVerified ? 'INR' : 'Unverified'}</span></div>
        <p className={`mt-4 break-words font-light leading-none tracking-[-0.035em] tabular-nums ${run.salaryHidden ? 'text-4xl' : 'text-[42px] sm:text-[56px]'}`}>{money(run.netPay)}</p>
        <p className="mt-3 text-sm text-muted-foreground">{run.salaryHidden ? 'Your role does not show salary figures.' : run.netPay === null ? 'Available once pay is worked out and verified.' : 'After employee deductions, for this pay period.'}</p>
        <dl className="mt-6 grid grid-cols-1 gap-3 border-t border-border/60 pt-4 min-[480px]:grid-cols-3">
          {RUN_MONEY_LABELS.map((label, i) => <div key={label} className="flex items-baseline justify-between gap-3 min-[480px]:block"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-base font-medium tabular-nums sm:text-lg">{money(amounts[i] ?? null)}</dd></div>)}
        </dl>
      </section>
      <section aria-label="Run progress" className="min-w-0 rounded-[24px] bg-hero p-5 text-hero-foreground shadow-card sm:p-6">
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-normal">Run progress</h2><Link to={`/manage/payroll/${run.id}?tab=checks`} aria-label="Open this run’s checks" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-hero-foreground/10 transition-colors hover:bg-hero-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"><ArrowUpRight className="size-5" aria-hidden /></Link></div>
        <ol className="mt-3 divide-y divide-hero-foreground/15">
          {RUN_PREPARATION_STEPS.map((label, i) => <li key={label} className="flex items-center gap-3 py-3"><span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${done[i] ? 'bg-gold text-gold-foreground' : 'bg-hero-foreground/10 text-hero-foreground/70'}`}>{done[i] ? <Check className="size-4" aria-hidden /> : <Circle className="size-3" aria-hidden />}</span><div className="min-w-0"><p className="text-sm">{label}<span className="sr-only">{done[i] ? ', complete' : ', pending'}</span></p><p className="mt-0.5 text-xs text-hero-foreground/70">{notes[i]}</p></div></li>)}
        </ol>
      </section>
    </div>
  </div>
}
