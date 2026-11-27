import { ArrowRight, Check, Fingerprint, UserX } from 'lucide-react'
import { Link } from 'react-router'
import { FormError } from '@/components/FormError'
import { HomeToFixSkeleton } from '@/components/skeletons/home/HomeWidgetsSkeleton'
import { cn, toDateInput } from '@/lib/utils'
import type { Overview } from '@/pages/attendance/components/labels'
import { TO_FIX_TITLE, shortDay } from './home-labels'
import { problemOf, useToFix } from './useToFix'

// "Needs your attention" (2026-11-27, drawn like Crextio's onboarding-task list): the days of the last 30 the employee
// still has to ask about - each row opens its regularization on My attendance (?regularize=<date>). The count sits large
// at the top right; with nothing to fix it says so in one calm row. Dark as the page's one dark card (no team), light
// beside the team's People today.
export function HomeToFix({ overview, dark = false }: { overview: Overview | undefined; dark?: boolean }) {
  const fix = useToFix(overview)
  const muted = dark ? 'text-hero-foreground/70' : 'text-muted-foreground'
  return (
    <section className={cn('home-panel min-w-0 p-4 sm:p-5', dark && 'home-panel-dark home-people-dark text-hero-foreground')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-light tracking-tight">{TO_FIX_TITLE}</h2>
          <p className={cn('mt-0.5 text-xs', muted)}>Your last 30 days, before the month locks</p>
        </div>
        {!fix.pending && <span className="text-[44px] leading-none font-light tabular-nums">{fix.days.length}</span>}
      </div>
      <FormError error={fix.error} />
      {fix.pending && <HomeToFixSkeleton />}
      {!fix.pending && fix.days.length === 0 && (
        <div className="mt-4 flex items-center gap-3">
          <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', dark ? 'bg-gold text-gold-foreground' : 'bg-positive/15 text-positive-ink')}><Check aria-hidden className="size-5" /></span>
          <p className="text-sm">Every working day is in order.</p>
        </div>
      )}
      <ul className="mt-3 space-y-1">
        {fix.days.slice(0, 4).map((d) => {
          const missed = problemOf(d) === 'MISSED_PUNCH'
          const Icon = missed ? Fingerprint : UserX
          return (
            <li key={d.date.toISOString()}>
              <Link to={`/ess/attendance?regularize=${toDateInput(d.date)}`} className={cn('group flex min-h-14 items-center gap-3 rounded-2xl py-1.5 outline-none focus-visible:ring-2', dark ? 'hover:bg-hero-foreground/5 focus-visible:ring-gold' : 'hover:bg-surface-2/60 focus-visible:ring-ring')}>
                <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', dark ? 'bg-hero-foreground text-hero' : 'bg-surface-2')}><Icon aria-hidden className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{shortDay(d.date)} · {missed ? 'Missed punch' : 'Absent'}</span>
                  <span className={cn('block text-xs', muted)}>{missed ? 'Ask to correct the punch' : 'Ask to correct it, or apply for leave'}</span>
                </span>
                <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', missed ? 'bg-gold' : 'bg-destructive')} />
                <ArrowRight aria-hidden className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
              </Link>
            </li>
          )
        })}
      </ul>
      <div className={cn('mt-3 border-t pt-3', dark ? 'border-hero-foreground/15' : 'border-border/60')}>
        <Link to="/ess/attendance" className="home-cta flex min-h-9 items-center gap-1.5 text-sm font-medium">{fix.days.length > 4 ? `${fix.days.length - 4} more in My attendance` : 'Open my attendance'} <ArrowRight aria-hidden className="size-4" /></Link>
      </div>
    </section>
  )
}
