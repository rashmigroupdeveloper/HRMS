import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { CycleRuler } from '@/components/CycleRuler'
import { todayDay } from '@/lib/utils'
import { PAYROLL_DESK_TITLE, monthLabel } from './payroll-labels'

type Run = {
  id: number
  payMonth: Date
  attendanceFrom: Date
  attendanceTo: Date
  computedAt: Date | null
  people: number
  company: { code: string; name: string }
}

// The payroll page's first reading: the latest pay month on this page, where today sits in its captured
// attendance cycle, and which of those companies still need their days taken from the locked attendance.
export function PayrollDesk({ items }: { items: Run[] }) {
  const latest = items[0]?.payMonth
  if (!latest) return null
  const ofLatest = items.filter((run) => run.payMonth.getTime() === latest.getTime())
  const waiting = ofLatest.filter((run) => !run.computedAt)
  const first = ofLatest[0]!
  const shared = ofLatest.every((run) => run.attendanceFrom.getTime() === first.attendanceFrom.getTime() && run.attendanceTo.getTime() === first.attendanceTo.getTime())
  const people = ofLatest.reduce((sum, run) => sum + run.people, 0)
  return (
    <section className="home-panel home-panel-dark u-grain min-w-0 overflow-hidden p-4 text-hero-foreground sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h2 className="text-[28px] font-light tracking-[-0.03em] sm:text-[36px]">{monthLabel(latest)}</h2>
          <p className="mt-1 max-w-md text-sm text-hero-foreground/80">
            {PAYROLL_DESK_TITLE} · {ofLatest.length} {ofLatest.length === 1 ? 'company' : 'companies'} on this page · {people} {people === 1 ? 'person' : 'people'}
          </p>
        </div>
        <div className="min-w-0">
          <p className={`text-[2.5rem] font-light tabular-nums leading-none ${waiting.length ? 'text-gold' : ''}`}>{waiting.length}</p>
          <p className="mt-2 text-sm text-hero-foreground/80">{waiting.length === 1 ? 'company still to take days' : 'companies still to take days'}</p>
        </div>
      </div>
      {shared ? <CycleRuler from={first.attendanceFrom} to={first.attendanceTo} today={todayDay()} /> : <p className="mt-4 text-sm text-hero-foreground/80">These runs do not share one pay period. Each row below has its own dates.</p>}
      {!!waiting.length && (
        <ul className="mt-4 divide-y divide-hero-foreground/15">
          {waiting.slice(0, 3).map((run) => (
            <li key={run.id}>
              <Link to={`/manage/payroll/${run.id}`} className="home-cta flex min-h-11 items-center justify-between gap-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-gold">
                <span className="min-w-0 truncate">{run.company.code} · {run.company.name}</span>
                <span className="flex shrink-0 items-center gap-1.5 text-gold">Take days <ArrowRight aria-hidden className="size-4" /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {waiting.length > 3 && <p className="mt-2 text-xs text-hero-foreground/80">and {waiting.length - 3} more on this page</p>}
      {waiting.length === 0 && <p className="mt-4 text-sm text-hero-foreground/80">Days are taken for every company on this page.</p>}
    </section>
  )
}
