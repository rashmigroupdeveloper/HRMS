import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { CycleRuler } from '@/components/CycleRuler'
import { cycleBounds } from '@/lib/cycle'
import { FormError } from '@/components/FormError'
import { CycleDeskFiguresSkeleton } from '@/components/skeletons/home/HomePanelsSkeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { usePortal } from '@/hooks/usePortal'
import { orpc } from '@/lib/orpc'
import type { Overview } from '@/pages/attendance/components/labels'
import { LiveCount } from './LiveCount'
import { CYCLE_COUNTS } from './home-labels'

type Scope = 'TEAM' | 'DEPARTMENT' | 'ALL'
const VIEW: Record<Scope, string> = { TEAM: 'team', DEPARTMENT: 'department', ALL: 'all' }
const SCOPE_LABEL: Record<Scope, string> = { TEAM: 'Your team', DEPARTMENT: 'Your department', ALL: 'Within your access' }

// The role home's first reading (2026-11-27): the attendance cycle itself — 26th to 25th, or whatever start day
// Attendance setup holds — with who is in today. The three counts are the same board the people panel reads.
export function CycleDesk({ overview, date }: { overview: Overview; date: Date }) {
  const { to } = usePortal()
  const scope: Scope = overview.canSeeAll ? 'ALL' : overview.departmentSize ? 'DEPARTMENT' : 'TEAM'
  const { year, month } = overview.currentMonth
  const { from, to: end } = cycleBounds(year, month, overview.cycleStartDay)
  const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const board = useQuery({ ...orpc.attendance.days.board.queryOptions({ input: { scope, date } }), refetchInterval: 120_000 })
  const summary = board.data?.summary
  const counts = summary ? [summary.in, summary.leave, summary.notIn] : []
  const finding = summary
    ? [summary.notIn ? `${summary.notIn} not in yet` : null, summary.absent ? `${summary.absent} absent` : null, summary.late ? `${summary.late} late` : null].filter(Boolean).join(' · ')
    : ''
  const weight = summary ? Math.max(summary.total, summary.in + summary.leave + summary.notIn, 1) : 1
  const parts = summary
    ? [
        { label: 'Punched in', value: summary.in, className: 'bg-gold' },
        { label: 'On leave', value: summary.leave, className: 'bg-hero-foreground/75' },
        { label: 'Not in yet', value: summary.notIn, className: 'bg-hero-foreground/35' },
      ].filter((part) => part.value > 0)
    : []
  return (
    <section className="home-panel home-panel-dark u-grain min-w-0 overflow-hidden p-4 text-hero-foreground sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h2 className="text-[28px] font-light tracking-[-0.03em] sm:text-[36px]">{monthName}</h2>
          <p className="mt-1 max-w-md text-sm text-hero-foreground/80">
            {SCOPE_LABEL[scope]}
            {summary ? (finding ? ` · ${finding}` : summary.total === 0 ? ' · nobody in this scope today' : ' · everyone expected in has a punch') : ''}
          </p>
        </div>
        {board.isPending ? <CycleDeskFiguresSkeleton /> : summary && (
          <dl className="grid grid-cols-3 gap-x-5 sm:gap-x-8">
            {CYCLE_COUNTS.map((label, i) => (
              <div key={label}>
                <dt className="text-xs text-hero-foreground/80">{label}</dt>
                <dd className="mt-1 text-3xl font-light tabular-nums sm:text-4xl"><LiveCount value={counts[i] ?? 0} /></dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <FormError error={board.error} />
      <CycleRuler from={from} to={end} today={date} />
      {board.isPending && <Skeleton className="mt-4 h-2.5 w-full rounded-full bg-hero-foreground/10" />}
      {parts.length > 1 && (
        <div
          className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-hero-foreground/10"
          role="img"
          aria-label={`${summary!.in} punched in, ${summary!.leave} on leave, ${summary!.notIn} not in yet, of ${summary!.total}.`}
        >
          {parts.map((part, i) => (
            <span key={part.label} className={`home-grow h-full ${part.className}`} style={{ width: `${(part.value / weight) * 100}%`, animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      )}
      <Link to={to(`/team-attendance?view=${VIEW[scope]}`)} className="home-cta mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-medium">
        {summary && summary.notIn > 0 ? 'See who is not in yet' : 'Open attendance'} <ArrowRight aria-hidden className="size-4" />
      </Link>
    </section>
  )
}
