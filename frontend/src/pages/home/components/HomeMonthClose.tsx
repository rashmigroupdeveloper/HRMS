import { ArrowRight, ArrowUpRight, Lock } from 'lucide-react'
import { Link } from 'react-router'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { HomeMonthCloseSkeleton } from '@/components/skeletons/home/HomeWidgetsSkeleton'
import { formatDate, toDateInput, todayDay } from '@/lib/utils'
import type { Overview } from '@/pages/attendance/components/labels'
import { LiveCount } from './LiveCount'
import { useMonthClose } from './useMonthClose'
import { MONTH_CLOSE_COUNTS, MONTH_CLOSE_TITLE, daysBetween, inDays } from './home-labels'

// The attendance month on the role portal's home (2026-11-27) - for whoever locks it (Attendance setup Edit for every
// company, as the lock itself). A month that is over and still open comes first: payroll takes its days only from a locked
// month. Otherwise the month running now - how far it is, when it closes - with what is still open in it.
export function HomeMonthClose({ overview }: { overview: Overview | undefined }) {
  const { pending, before, overdue, focus, checklist: c, error } = useMonthClose(overview)
  const today = overview?.today.date ?? todayDay()
  const length = focus ? daysBetween(focus.from, focus.to) + 1 : 0
  const gone = focus ? Math.min(length, daysBetween(focus.from, today) + 1) : 0
  const counts = c ? [c.missedPunches, c.pendingShiftChanges, c.unmatchedPunches] : []
  const links = focus
    ? [`/manage/attendance-reports?scope=ALL&mode=EXCEPTIONS&exception=MISSED_PUNCH&from=${toDateInput(focus.from)}&to=${toDateInput(focus.to)}`, '/manage/approvals', '/manage/attendance-setup?part=punches']
    : []
  return (
    <section className="home-panel min-w-0 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-light tracking-tight">{MONTH_CLOSE_TITLE}</h2>
        <Link to="/manage/attendance-setup?part=lock" aria-label="Open the month lock" className="grid size-9 place-items-center rounded-full bg-surface-2 outline-none hover:bg-surface-2/70 focus-visible:ring-2 focus-visible:ring-ring"><ArrowUpRight aria-hidden className="size-4" /></Link>
      </div>
      <FormError error={error} />
      {pending && <HomeMonthCloseSkeleton />}
      {!pending && focus && (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-xl font-light">{focus.name}</p>
            {overdue ? <Pill tone="warning">Over - not locked</Pill> : <Pill tone="neutral">Running</Pill>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDate(focus.from)} – {formatDate(focus.to)}
            {overdue ? '' : ` · day ${gone} of ${length}, closes ${inDays(daysBetween(today, focus.to) + 1)}`}
          </p>
          {!overdue && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`Day ${gone} of ${length}`}>
              <span className="home-grow block h-full rounded-full bg-foreground/60" style={{ width: `${(gone / length) * 100}%` }} />
            </div>
          )}
          <dl className="mt-3 grid grid-cols-3 gap-2">
            {MONTH_CLOSE_COUNTS.map((label, i) => (
              <Link key={label} to={links[i]!} className="rounded-2xl bg-surface-2/60 px-3 py-2.5 outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring">
                <dt className="text-xs leading-tight text-muted-foreground">{label}</dt>
                <dd className={`mt-1 text-2xl font-light tabular-nums ${counts[i] ? 'text-warning-ink' : ''}`}><LiveCount value={counts[i] ?? 0} /></dd>
              </Link>
            ))}
          </dl>
          {!overdue && before?.locked && <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Lock aria-hidden className="size-3.5" />{before.name} locked on {formatDate(before.locked.at)}</p>}
          {overdue && (
            <Link to="/manage/attendance-setup?part=lock" className="home-cta mt-3 flex min-h-9 items-center gap-1.5 text-sm font-medium">
              {counts.some(Boolean) ? 'Clear these, then lock the month' : `Lock ${overdue.name}`} <ArrowRight aria-hidden className="size-4" />
            </Link>
          )}
        </>
      )}
    </section>
  )
}
