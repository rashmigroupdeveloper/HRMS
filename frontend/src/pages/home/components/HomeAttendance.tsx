import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Check } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { usePortal } from '@/hooks/usePortal'
import { HomeAttendanceSkeleton } from '@/components/skeletons/home/HomePanelsSkeleton'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { orpc } from '@/lib/orpc'
import { cn, initialsOf, toDateInput, todayDay } from '@/lib/utils'
import { BOARD_STATE, type Overview } from '@/pages/attendance/components/labels'
import { CornerLink } from './HomeParts'
import { LiveCount } from './LiveCount'
import { PEOPLE_LEGEND } from './home-labels'

// People today (2026-11-27 redesign, Crextio's "Onboarding task 2/8"): how many of the people in the scope have punched
// in, out of all of them, large; one bar split into punched in / on leave / not in yet; then the people worth a look (late,
// missed punch, absent) as a task list. Today's board refreshes itself every 2 minutes - punches arrive with each upload.
type Scope = 'TEAM' | 'DEPARTMENT' | 'ALL'
export function HomeAttendance({ overview, date, dark = false }: { overview: Overview; date: Date; dark?: boolean }) {
  const [selected, setSelected] = useState<Scope>('TEAM')
  const { to } = usePortal()
  const scopes = [...(overview.teamSize ? [['TEAM', 'My team'] as const] : []), ...(overview.departmentSize ? [['DEPARTMENT', 'My department'] as const] : []), ...(overview.canSeeAll ? [['ALL', 'Within my access'] as const] : [])]
  const scope = scopes.find(([value]) => value === selected)?.[0] ?? scopes[0]?.[0] ?? 'TEAM'
  const isToday = date.getTime() === todayDay().getTime()
  const board = useQuery({ ...orpc.attendance.days.board.queryOptions({ input: { scope, date } }), enabled: scopes.length > 0, refetchInterval: isToday ? 120_000 : false })
  const data = board.data
  const review = data?.items.filter((r) => r.state === 'MISSED_PUNCH' || r.state === 'ABSENT' || r.lateMinutes > 0).slice(0, 4)
  const view = scope === 'TEAM' ? 'team' : scope === 'DEPARTMENT' ? 'department' : 'all'
  if (!scopes.length) return null
  const s = data?.summary
  const parts = s ? [s.in, s.leave + s.onDuty, s.notIn] : []
  const tones = [dark ? 'bg-gold' : 'bg-hero', dark ? 'bg-hero-foreground/45' : 'bg-gold', 'home-hatch']
  const muted = dark ? 'text-hero-foreground/70' : 'text-muted-foreground'
  return (
    <section className={cn('home-panel min-w-0 p-4 sm:p-5', dark && 'home-panel-dark home-people-dark text-hero-foreground')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-light tracking-tight">People today</h2>
          <p className={cn('mt-0.5 flex items-center gap-1.5 text-xs', muted)}>
            {isToday && board.dataUpdatedAt > 0 ? <><span aria-hidden className={cn('size-1.5 rounded-full bg-positive', board.isFetching && 'home-live')} />Updated {new Date(board.dataUpdatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</> : 'Attendance in this scope'}
          </p>
        </div>
        <CornerLink to={to(`/team-attendance?view=${view}`)} label="Open team attendance" dark={dark} />
      </div>
      {scopes.length > 1 && (
        <NativeSelect aria-label="People today scope" value={scope} onChange={(e) => setSelected(e.target.value as Scope)} className="mt-3 [&_select]:h-8 [&_select]:rounded-full [&_select]:text-xs [&_select]:text-foreground">
          {scopes.map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}
        </NativeSelect>
      )}
      <FormError error={board.error} />
      {board.isPending && <HomeAttendanceSkeleton dark={dark} />}
      {s && (
        <>
          <div className="mt-4 flex items-end justify-between gap-3">
            <p className="leading-none font-light tabular-nums"><span className="text-[52px]"><LiveCount value={s.in} /></span><span className={cn('text-2xl', muted)}>/{s.total}</span></p>
            <p className={cn('pb-1 text-right text-xs', muted)}>punched in<br />“not in yet” is not absent</p>
          </div>
          <div className="mt-3 flex h-2.5 w-full gap-1 overflow-hidden" role="img" aria-label={PEOPLE_LEGEND.map((l, i) => `${l} ${parts[i]}`).join(', ')}>
            {s.total === 0 ? <span className="home-hatch h-full flex-1 rounded-full" /> : parts.map((v, i) => v > 0 && <span key={i} className={cn('home-grow h-full rounded-full', tones[i])} style={{ flex: `${v} 1 0%` }} />)}
          </div>
          <p className={cn('mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs', muted)}>
            {PEOPLE_LEGEND.map((label, i) => <span key={label} className="inline-flex items-center gap-1.5"><span aria-hidden className={cn('size-2 rounded-full', tones[i])} /><span className={dark ? 'text-hero-foreground' : 'text-foreground'}><LiveCount value={parts[i]!} /></span> {label}</span>)}
          </p>
          <h3 className="mt-5 text-sm font-medium">Worth a look</h3>
          {review?.length === 0 && (
            <div className="mt-2 flex items-center gap-3">
              <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', dark ? 'bg-gold text-gold-foreground' : 'bg-positive/15 text-positive-ink')}><Check aria-hidden className="size-5" /></span>
              <p className="text-sm">{s.total === 0 ? 'Nobody in this scope today.' : 'Nobody late, missing a punch or absent.'}</p>
            </div>
          )}
          <ul className="mt-1 space-y-1">
            {review?.map((r) => (
              <li key={r.employeeCode}>
                <Link to={to(`/team-attendance?view=${view}`)} className={cn('flex min-h-14 items-center gap-3 rounded-2xl py-1.5 outline-none focus-visible:ring-2', dark ? 'hover:bg-hero-foreground/5 focus-visible:ring-gold' : 'hover:bg-surface-2/60 focus-visible:ring-ring')}>
                  <span className={cn('grid size-10 shrink-0 place-items-center rounded-full text-xs font-medium', dark ? 'bg-hero-foreground text-hero' : 'bg-surface-2')}>{initialsOf(r.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.name}</span>
                    <span className={cn('block truncate text-xs', muted)}>{r.department ?? r.employeeCode}{r.inAt ? ` · in ${r.inAt}` : ''}</span>
                  </span>
                  <Pill tone={r.lateMinutes > 0 ? 'warning' : BOARD_STATE[r.state].tone}>{r.lateMinutes > 0 ? `${r.lateMinutes}m late` : BOARD_STATE[r.state].label}</Pill>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className={cn('mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3', dark ? 'border-hero-foreground/15' : 'border-border/60')}>
        <Link to={to(`/team-attendance?view=${view}`)} className="home-cta flex min-h-9 items-center gap-1.5 text-sm font-medium">Open attendance <ArrowRight aria-hidden className="size-4" /></Link>
        <Link to={`/attendance-reports?scope=${scope}&from=${toDateInput(date)}&to=${toDateInput(date)}`} className="flex min-h-9 items-center text-sm underline underline-offset-4">Reports &amp; Excel</Link>
      </div>
    </section>
  )
}
