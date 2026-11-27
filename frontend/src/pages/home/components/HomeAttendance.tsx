import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { usePortal } from '@/hooks/usePortal'
import { HomeAttendanceSkeleton } from '@/components/skeletons/home/HomePanelsSkeleton'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { orpc } from '@/lib/orpc'
import { toDateInput, todayDay } from '@/lib/utils'
import { BOARD_STATE, type Overview } from '@/pages/attendance/components/labels'
import { LiveCount } from './LiveCount'

type Scope = 'TEAM' | 'DEPARTMENT' | 'ALL'
export function HomeAttendance({ overview, date, dark = false }: { overview: Overview; date: Date; dark?: boolean }) {
  const [selected, setSelected] = useState<Scope>('TEAM')
  const { to } = usePortal()
  const scopes = [...(overview.teamSize ? [['TEAM', 'My team'] as const] : []), ...(overview.departmentSize ? [['DEPARTMENT', 'My department'] as const] : []), ...(overview.canSeeAll ? [['ALL', 'Within my access'] as const] : [])]
  const scope = scopes.find(([value]) => value === selected)?.[0] ?? scopes[0]?.[0] ?? 'TEAM'
  // today's board refreshes itself every 2 minutes (as the decisions list) - punches arrive with each upload (2026-11-27)
  const isToday = date.getTime() === todayDay().getTime()
  const board = useQuery({ ...orpc.attendance.days.board.queryOptions({ input: { scope, date } }), enabled: scopes.length > 0, refetchInterval: isToday ? 120_000 : false })
  const data = board.data
  const review = data?.items.filter(r => r.state === 'MISSED_PUNCH' || r.state === 'ABSENT' || r.lateMinutes > 0).slice(0, 3)
  const view = scope === 'TEAM' ? 'team' : scope === 'DEPARTMENT' ? 'department' : 'all'
  if (!scopes.length) return null
  return <section className={`home-panel min-w-0 p-4 sm:p-5 ${dark ? 'home-panel-dark home-people-dark text-hero-foreground' : ''}`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-medium tracking-tight">People today</h2><NativeSelect aria-label="Home attendance scope" value={scope} onChange={e => setSelected(e.target.value as Scope)} className="[&_select]:rounded-full [&_select]:text-foreground">{scopes.map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}</NativeSelect></div>
    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground"><span>“Not in yet” is separate from absence.</span>{isToday && board.dataUpdatedAt > 0 && <span className="inline-flex items-center gap-1.5"><span aria-hidden className={`size-1.5 rounded-full bg-positive ${board.isFetching ? 'home-live' : ''}`} />Updated {new Date(board.dataUpdatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</span>}</p>
    <FormError error={board.error} />{board.isPending && <HomeAttendanceSkeleton dark={dark} />}
    {data && <><dl className={`mt-3 grid grid-cols-2 gap-x-4 gap-y-5 border-y border-border/60 py-3 ${dark ? '' : 'sm:grid-cols-4'}`}>{([['People', data.summary.total], ['Punched in', data.summary.in], ['On leave', data.summary.leave], ['Not in yet', data.summary.notIn]] as const).map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-4xl font-light tabular-nums"><LiveCount value={value} /></dd></div>)}</dl>
      {!!review?.length && <><h3 className="mt-4 text-sm font-medium">Worth a look</h3><ul className="divide-y divide-border/60">{review.map(r => <li key={r.employeeCode}><Link className="flex min-h-16 items-center justify-between gap-3 rounded-xl py-2 outline-none hover:bg-surface-2/50 focus-visible:ring-2 focus-visible:ring-ring" to={to(`/team-attendance?view=${view}`)}><div className="min-w-0"><p className="text-sm font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.employeeCode}{r.department ? ` · ${r.department}` : ''}{r.inAt ? ` · in ${r.inAt}` : ''}</p></div><Pill tone={r.lateMinutes > 0 ? 'warning' : BOARD_STATE[r.state].tone}>{r.lateMinutes > 0 ? `${r.lateMinutes}m late` : BOARD_STATE[r.state].label}</Pill></Link></li>)}</ul></>}
      {review?.length === 0 && <p className="py-3 text-sm text-muted-foreground">{data.summary.total === 0 ? 'No employees in this scope today.' : 'No late arrivals, missed punches or absences to review in this scope.'}</p>}
    </>}
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3"><Link to={to(`/team-attendance?view=${view}`)} className="flex min-h-9 items-center gap-2 text-sm font-medium">Open attendance <ArrowRight aria-hidden className="size-4" /></Link><Link to={`/attendance-reports?scope=${scope}&from=${toDateInput(date)}&to=${toDateInput(date)}`} className="flex min-h-9 items-center text-sm underline underline-offset-4">Reports &amp; Excel</Link></div>
  </section>
}
