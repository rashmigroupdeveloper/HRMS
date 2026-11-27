import { ArrowUpRight, CalendarClock } from 'lucide-react'
import { Link } from 'react-router'
import { FormError } from '@/components/FormError'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'
import { type Overview, STATUS } from '@/pages/attendance/components/labels'
import { useMyDays } from './useMyDays'

// The employee's attendance month on the self-service home: its totals and the last 7 days - reaching into the month
// before on the first days of a month (2026-11-27: on 27 Nov, day 2 of "December", it showed only two days).
export function HomePersonalAttendance({ overview }: { overview?: Overview }) {
  const my = useMyDays(overview)
  const month = my.month
  const days = my.pending ? undefined : my.days.filter((d) => d.employed && d.date <= overview!.today.date).slice(-7)
  return <section className="home-panel home-panel-dark min-w-0 p-4 text-hero-foreground sm:p-5">
    <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-light tracking-tight">My attendance</h2><Link to="/ess/attendance" aria-label="Open my attendance calendar" className="grid size-10 place-items-center rounded-full bg-hero-foreground/10 outline-none hover:bg-hero-foreground/20 focus-visible:ring-2 focus-visible:ring-gold"><ArrowUpRight aria-hidden className="size-5" /></Link></div>
    <p className="mt-1 text-sm text-hero-foreground/75">Your current attendance month</p>
    <FormError error={my.error} />
    <dl className="mt-6 grid grid-cols-3 gap-3">{['Present days', 'On leave', 'Late days'].map((label, i) => <div key={label}><dt className="text-xs text-hero-foreground/75">{label}</dt><dd className="mt-1 text-4xl font-light tabular-nums sm:text-5xl">{month && !my.pending ? [month.totals.present, month.totals.leave, month.totals.late][i] : <Skeleton className="my-2 h-9 w-12 rounded bg-hero-foreground/10" />}</dd></div>)}</dl>
    <p className="mt-6 flex items-center gap-2 text-xs text-hero-foreground/75"><CalendarClock aria-hidden className="size-4" />Your last 7 days</p>
    {my.pending && <div role="status" aria-label="Loading your recent attendance" className="mt-3 grid grid-cols-7 gap-1.5">{Array.from({length:7},(_,i)=><Skeleton key={i} className="h-16 rounded-xl bg-hero-foreground/10" />)}</div>}
    {days && <div className="mt-3 grid grid-cols-7 gap-1.5">{days.map(d => <Link key={d.date.toISOString()} to="/ess/attendance" title={`${formatDate(d.date)}: ${d.status ? STATUS[d.status].label : 'Not worked out yet'}`} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl bg-hero-foreground/10 text-xs outline-none transition-colors hover:bg-hero-foreground/20 focus-visible:ring-2 focus-visible:ring-gold"><span className="text-hero-foreground/70">{d.date.getUTCDate()}</span><span className={`grid size-7 place-items-center rounded-full text-xs font-medium ${d.status === 'PRESENT' || d.status === 'ON_DUTY' ? 'bg-gold text-gold-foreground' : 'bg-hero-foreground/10 text-hero-foreground'}`}>{d.status ? STATUS[d.status].short : '—'}</span></Link>)}</div>}
    <p className="mt-4 text-xs text-hero-foreground/70">{month ? `${formatDate(month.from)} – ${formatDate(month.to)} · P present · L leave · A absent · MP missed punch` : 'P present · L leave · A absent · MP missed punch'}</p>
  </section>
}
