import { ArrowUpRight, Building2, Users } from 'lucide-react'
import { Link } from 'react-router'
import type { client } from '@/lib/orpc'
import { CycleRuler } from '@/components/CycleRuler'
import { todayDay } from '@/lib/utils'
import { PAYROLL_DESK_TITLE, PAYROLL_STATE_LABELS, monthLabel } from './payroll-labels'

type Run = Awaited<ReturnType<typeof client.payroll.list>>['items'][number]

// The latest month within the current page. Counts and the segmented strip refer only to these returned runs,
// never to hidden companies or runs on another page. Keep the loading layout in PayrollRunsSkeleton in sync.
export function PayrollDesk({ items }: { items: Run[] }) {
  const latest = items[0]?.payMonth
  if (!latest) return null
  const runs = items.filter(run => run.payMonth.getTime() === latest.getTime())
  const first = runs[0]!
  const shared = runs.every(run => run.attendanceFrom.getTime() === first.attendanceFrom.getTime() && run.attendanceTo.getTime() === first.attendanceTo.getTime())
  const counts = [runs.filter(run => run.status === 'FINALISED').length, runs.filter(run => run.status === 'IN_APPROVAL').length, runs.filter(run => run.status === 'DRAFT').length]
  const next = runs.find(run => run.status === 'DRAFT') ?? runs.find(run => run.status === 'IN_APPROVAL') ?? first
  const people = runs.reduce((sum, run) => sum + run.people, 0)
  const colors = ['bg-gold', 'bg-hero-foreground/75', 'bg-hero-foreground/20']
  return <section aria-label={PAYROLL_DESK_TITLE} className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
    <div className="min-w-0 px-1 py-3 sm:pr-7 sm:py-5">
      <div className="flex items-center justify-between gap-3"><h2 className="text-[26px] font-light tracking-[-0.03em] sm:text-[32px]">{monthLabel(latest)}</h2><span className="rounded-full bg-surface-2 px-3 py-1 text-xs">{PAYROLL_DESK_TITLE}</span></div>
      <p className="mt-2 text-sm text-muted-foreground">Latest month on this page</p>
      <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-4">
        <div className="flex flex-col"><dt className="order-2 mt-2 text-sm text-muted-foreground">{runs.length === 1 ? 'Company' : 'Companies'}</dt><dd className="order-1 flex items-baseline gap-2 text-[42px] font-light leading-none tracking-[-0.03em] tabular-nums"><Building2 className="size-4 self-center text-muted-foreground" aria-hidden />{runs.length}</dd></div>
        <div className="flex flex-col"><dt className="order-2 mt-2 text-sm text-muted-foreground">People in these runs</dt><dd className="order-1 flex items-baseline gap-2 text-[42px] font-light leading-none tracking-[-0.03em] tabular-nums"><Users className="size-4 self-center text-muted-foreground" aria-hidden />{people}</dd></div>
      </dl>
      {shared ? <CycleRuler ink="dark" from={first.attendanceFrom} to={first.attendanceTo} today={todayDay()} /> : <p className="mt-4 text-sm text-muted-foreground">Each run below has its own pay period.</p>}
    </div>
    <div className="flex min-w-0 flex-col justify-between rounded-[24px] bg-hero p-5 text-hero-foreground shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-normal sm:text-2xl">Keep pay moving</h2><p className="mt-2 hidden text-sm text-hero-foreground/70 sm:block">From preparation to final approval</p></div><Link to={`/manage/payroll/${next.id}`} aria-label={`Open ${next.company.code} payroll for ${monthLabel(latest)}`} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-hero-foreground text-hero transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring motion-reduce:hover:translate-y-0"><ArrowUpRight className="size-5" aria-hidden /></Link></div>
      <div className="mt-4 sm:mt-6">
        <div className="flex h-6 gap-1 sm:h-10 overflow-hidden rounded-full" role="img" aria-label={PAYROLL_STATE_LABELS.map((label,i) => `${counts[i]} ${label}`).join(', ')}>{counts.map((count,i) => count > 0 && <span key={PAYROLL_STATE_LABELS[i]} className={`min-w-3 rounded-full ${colors[i]}`} style={{flex:count}} />)}</div>
        <dl className="mt-4 grid grid-cols-3 gap-3">{PAYROLL_STATE_LABELS.map((label,i) => <div key={label} className="flex flex-col"><dt className="order-2 mt-2 flex items-center gap-1.5 text-xs text-hero-foreground/70"><span className={`size-1.5 shrink-0 rounded-full ${colors[i]}`} aria-hidden />{label}</dt><dd className="order-1 text-[28px] font-light leading-none tabular-nums">{counts[i]}</dd></div>)}</dl>
      </div>
      <p className="mt-4 text-xs text-hero-foreground/70">Status of the latest month’s runs on this page</p>
    </div>
  </section>
}
