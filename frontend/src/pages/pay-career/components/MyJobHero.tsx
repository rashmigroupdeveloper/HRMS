import { EmploymentTimeline, NoticePeriod } from '@/components/JobOverview'
import { formatMoney } from '@/lib/utils'
import { type EmployeeProfile, fullName } from '../../employees/components/labels'

// The top of the "Mine" tab (redesigned 2026-11-21 - the user: "boring"): a charcoal strip with who they are and where,
// their employment milestones (joined -> probation ends -> confirmed...) with the notice period, and the total CTC as
// the one big gold figure. It replaces the separate "Dates and terms" card and the CTC tiles.
export function MyJobHero({ e }: { e: EmployeeProfile }) {
  const s = e.salary
  const money = (amount: number) => formatMoney(amount, s?.currency ?? 'INR')
  const name = fullName(e)
  const role = [e.designation?.name, e.grade?.name, e.department?.name].filter(Boolean).join(' · ')
  const place = [e.company.name, `${e.plant.plantCode} ${e.plant.name}`, e.workLocation?.name].filter(Boolean).join(' · ')
  return (
    <header className="u-grain relative overflow-hidden rounded-2xl bg-hero px-4 py-3 text-hero-foreground shadow-card">
      <span aria-hidden className="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full bg-gold/15 blur-3xl" />
      <div className="relative grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_auto] lg:items-center lg:gap-5">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold text-sm font-semibold text-gold-foreground">
            {`${e.firstName.charAt(0)}${e.lastName?.charAt(0) ?? ''}`.toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-base leading-tight font-medium">{name}</span>
              <span className="rounded-full border border-hero-foreground/15 px-2 py-0.5 text-[11px] font-medium text-hero-foreground/80 tabular-nums">{e.employeeCode}</span>
            </p>
            <p className="mt-0.5 truncate text-sm text-hero-foreground/80">{role || 'No designation yet'}</p>
            <p className="truncate text-xs text-hero-foreground/60">{place}</p>
          </div>
        </div>

        {/* the milestones with the notice period beside them - one row less (the user, 2026-11-21: compact) */}
        <div className="flex min-w-0 flex-wrap items-end gap-x-6 gap-y-1 border-t border-hero-foreground/10 pt-3 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
          <div className="min-w-0 flex-1">
            <EmploymentTimeline employee={e} dark />
          </div>
          <p className="text-xs text-hero-foreground/60">
            Notice period
            <span className="block text-sm text-hero-foreground/90"><NoticePeriod probation={e.noticeMonthsProbation} confirmed={e.noticeMonthsConfirmed} /></span>
          </p>
        </div>

        {s && (
          <div className="border-t border-hero-foreground/10 pt-3 lg:border-t-0 lg:pt-0 lg:text-right">
            <p className="text-xs text-hero-foreground/60">Total CTC / year</p>
            <p className="text-2xl leading-tight font-semibold tracking-tight text-gold tabular-nums">{money(s.annualCtc + (s.performancePayAnnual ?? 0))}</p>
            <p className="text-xs text-hero-foreground/60 tabular-nums">
              {money(s.annualCtc)} fixed{s.performancePayAnnual ? ` + ${money(s.performancePayAnnual)} performance pay` : ''}
            </p>
          </div>
        )}
      </div>
    </header>
  )
}
