import { ArrowRight, Check, Fingerprint, UserX } from 'lucide-react'
import { Link } from 'react-router'
import { FormError } from '@/components/FormError'
import { HomeToFixSkeleton } from '@/components/skeletons/home/HomeWidgetsSkeleton'
import { cn, toDateInput } from '@/lib/utils'
import type { Overview } from '@/pages/attendance/components/labels'
import { CornerLink, TILE } from './HomeParts'
import { TO_FIX_TITLE, shortDay } from './home-labels'
import { problemOf, useToFix } from './useToFix'

// "Needs your attention" (2026-11-27, drawn like Crextio's onboarding-task list): the days of the last 30 the employee
// still has to ask about - each row opens its regularization on My attendance (?regularize=<date>). The count sits large
// at the top right; with nothing to fix it says so in one calm row. Dark as the page's one dark card (no team), light
// beside the team's People today.
export function HomeToFix({ overview, dark = false }: { overview: Overview | undefined; dark?: boolean }) {
  const fix = useToFix(overview)
  const muted = dark ? 'text-hero-foreground/70' : 'text-muted-foreground'
  // nothing to fix: one calm slim row (the home moves it below the cards that need attention - 2026-11-27)
  if (!fix.pending && !fix.error && fix.days.length === 0) return (
    <section className="home-panel flex min-w-0 items-center gap-4 p-4 sm:px-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-positive/15 text-positive-ink"><Check aria-hidden className="size-5" /></span>
      <div className="min-w-0 flex-1"><h2 className="text-xl font-light tracking-tight">{TO_FIX_TITLE}</h2><p className="text-xs text-muted-foreground">Every working day of the last 30 is in order.</p></div>
      <span className="text-[44px] leading-none font-light tabular-nums">0</span>
      <CornerLink to="/ess/attendance" label="Open my attendance" />
    </section>
  )
  // a tile of the home's grid: three days, the rest counted in the footer
  return (
    <section className={cn(TILE, dark && 'home-panel-dark home-people-dark text-hero-foreground')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl leading-tight font-light tracking-tight">{TO_FIX_TITLE}</h2>
          <p className={cn('mt-0.5 truncate text-xs', muted)}>Last 30 days, before the lock</p>
        </div>
        {!fix.pending && <span className="text-[40px] leading-none font-light tabular-nums">{fix.days.length}</span>}
      </div>
      <FormError error={fix.error} />
      {fix.pending && <HomeToFixSkeleton />}
      <ul className="mt-2 space-y-0.5">
        {fix.days.slice(0, 3).map((d) => {
          const missed = problemOf(d) === 'MISSED_PUNCH'
          const Icon = missed ? Fingerprint : UserX
          return (
            <li key={d.date.toISOString()}>
              <Link to={`/ess/attendance?regularize=${toDateInput(d.date)}`} className={cn('group flex min-h-12 items-center gap-3 rounded-xl py-1 outline-none focus-visible:ring-2', dark ? 'hover:bg-hero-foreground/5 focus-visible:ring-gold' : 'hover:bg-surface-2/60 focus-visible:ring-ring')}>
                <span className={cn('grid size-9 shrink-0 place-items-center rounded-full', dark ? 'bg-hero-foreground text-hero' : 'bg-surface-2')}><Icon aria-hidden className="size-3.5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{shortDay(d.date)}</span>
                  <span className={cn('block truncate text-xs', muted)}>{missed ? 'Missed punch · ask to correct' : 'Absent · correct or apply leave'}</span>
                </span>
                <span aria-hidden className={cn('size-2 shrink-0 rounded-full', missed ? 'bg-gold' : 'bg-destructive')} />
                <ArrowRight aria-hidden className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
              </Link>
            </li>
          )
        })}
      </ul>
      <Link to="/ess/attendance" className={cn('home-cta mt-auto flex min-h-8 items-center gap-1.5 border-t pt-2 text-xs font-medium', dark ? 'border-hero-foreground/15' : 'border-border/60')}>{fix.days.length > 3 ? `${fix.days.length - 3} more in My attendance` : 'Open my attendance'} <ArrowRight aria-hidden className="size-3.5" /></Link>
    </section>
  )
}
