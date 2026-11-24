import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, CalendarClock } from 'lucide-react'
import { Link } from 'react-router'
import { FormError } from '@/components/FormError'
import { Skeleton } from '@/components/ui/skeleton'
import { orpc } from '@/lib/orpc'
import { formatDate, todayDay } from '@/lib/utils'
import { type Overview, STATUS } from '@/pages/attendance/components/labels'

export function HomePersonalAttendance({ overview }: { overview?: Overview }) {
  const month = useQuery({ ...orpc.attendance.days.myMonth.queryOptions({ input: overview?.currentMonth ?? { year: todayDay().getUTCFullYear(), month: todayDay().getUTCMonth() + 1 } }), enabled: !!overview })
  const days = month.data?.days.filter(d => d.employed && d.date <= overview!.today.date).slice(-7)
  return <section className="home-panel home-panel-dark min-w-0 p-4 text-hero-foreground sm:p-5">
    <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-light tracking-tight">My attendance</h2><Link to="/attendance" aria-label="Open my attendance calendar" className="grid size-10 place-items-center rounded-full bg-hero-foreground/10 outline-none hover:bg-hero-foreground/20 focus-visible:ring-2 focus-visible:ring-gold"><ArrowUpRight aria-hidden className="size-5" /></Link></div>
    <p className="mt-1 text-sm text-hero-foreground/75">Your current attendance cycle</p>
    <FormError error={month.error} />
    <dl className="mt-6 grid grid-cols-3 gap-3">{['Present days', 'On leave', 'Late days'].map((label, i) => <div key={label}><dt className="text-xs text-hero-foreground/75">{label}</dt><dd className="mt-1 text-4xl font-light tabular-nums sm:text-5xl">{month.data ? [month.data.totals.present, month.data.totals.leave, month.data.totals.late][i] : <Skeleton className="my-2 h-9 w-12 rounded bg-hero-foreground/10" />}</dd></div>)}</dl>
    <p className="mt-6 flex items-center gap-2 text-xs text-hero-foreground/75"><CalendarClock aria-hidden className="size-4" />Recent days in this cycle</p>
    {month.isPending && <div role="status" aria-label="Loading your recent attendance" className="mt-3 grid grid-cols-7 gap-2">{Array.from({length:7},(_,i)=><Skeleton key={i} className="h-16 rounded-xl bg-hero-foreground/10" />)}</div>}
    {days && <div className="mt-3 grid grid-cols-7 gap-1.5">{days.map(d => <Link key={d.date.toISOString()} to="/attendance" title={`${formatDate(d.date)}: ${d.status ? STATUS[d.status].label : 'Not worked out yet'}`} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl bg-hero-foreground/10 text-xs outline-none transition-colors hover:bg-hero-foreground/20 focus-visible:ring-2 focus-visible:ring-gold"><span className="text-hero-foreground/70">{d.date.getUTCDate()}</span><span className={`grid size-7 place-items-center rounded-full text-xs font-medium ${d.status === 'PRESENT' || d.status === 'ON_DUTY' ? 'bg-gold text-gold-foreground' : 'bg-hero-foreground/10 text-hero-foreground'}`}>{d.status ? STATUS[d.status].short : '—'}</span></Link>)}</div>}
    <p className="mt-4 text-xs text-hero-foreground/70">{month.data ? `${formatDate(month.data.from)} – ${formatDate(month.data.to)} · P present · L leave · A absent · MP missed punch` : 'P present · L leave · A absent · MP missed punch'}</p>
  </section>
}
