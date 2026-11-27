import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { HomePayrollSkeleton } from '@/components/skeletons/home/HomeWidgetsSkeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'
import type { Overview } from '@/pages/attendance/components/labels'
import { monthLabel } from '@/pages/payroll/components/payroll-labels'
import { TILE } from './HomeParts'
import { PAYROLL_TITLE } from './home-labels'
import { usePayrollRuns } from './usePayrollRuns'

// The payroll runs of the latest pay month on the role portal's home (2026-11-27) - for Payroll View. Each company's run:
// how many people it holds and whether its pay has been worked out (days from the locked attendance) - never an amount (salary
// figures need Salary access too, and stay on the run's page). The pay month that ended last with no run yet is named.
// Runs are by whole company: access to part of a company shows none (payroll.list).
export function HomePayroll({ overview }: { overview: Overview | undefined }) {
  const { pending, latest, ofLatest, due, dueMissing, error } = usePayrollRuns(overview)
  const waiting = ofLatest.filter((r) => !r.computedAt).length
  return (
    <section className={TILE}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl leading-tight font-light tracking-tight">{PAYROLL_TITLE}</h2>
        <Link to="/manage/payroll" aria-label="Open payroll" className="grid size-9 place-items-center rounded-full bg-surface-2 outline-none hover:bg-surface-2/70 focus-visible:ring-2 focus-visible:ring-ring"><ArrowUpRight aria-hidden className="size-4" /></Link>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{pending ? <Skeleton className="inline-block h-3 w-44 rounded" /> : latest ? `${monthLabel(latest)} · ${waiting ? `${waiting} ${waiting === 1 ? 'company' : 'companies'} still to work out pay` : 'pay worked out'}` : 'Monthly draft runs by company'}</div>
      <FormError error={error} />
      {pending && <HomePayrollSkeleton />}
      {!pending && ofLatest.length === 0 && <p className="py-3 text-sm text-muted-foreground">No company payroll runs within your access yet. Runs cover a whole company.</p>}
      <ul className="mt-1 divide-y divide-border/60">
        {ofLatest.slice(0, 3).map((r) => (
          <li key={r.id}>
            <Link to={`/manage/payroll/${r.id}`} className="group flex min-h-14 items-center justify-between gap-3 rounded-xl py-2 outline-none hover:bg-surface-2/50 focus-visible:ring-2 focus-visible:ring-ring">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.company.name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{r.people} people · {r.computedAt ? `pay worked out ${formatDate(r.computedAt)}` : 'pay not worked out yet'}</p>
              </div>
              <span className="flex shrink-0 items-center gap-2">
                <Pill tone={r.computedAt ? 'neutral' : 'warning'}>{r.computedAt ? 'Pay worked out' : 'Pay to work out'}</Pill>
                <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {ofLatest.length > 4 && <Link to="/manage/payroll" className="flex min-h-9 items-center text-xs underline underline-offset-4">All {ofLatest.length} runs of {monthLabel(latest!)}</Link>}
      {dueMissing && <p className="mt-2 text-xs text-warning-ink">No run for {monthLabel(due!)} yet.</p>}
    </section>
  )
}
