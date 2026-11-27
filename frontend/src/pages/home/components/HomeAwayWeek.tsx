import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { FormError } from '@/components/FormError'
import { HomeAwayWeekSkeleton } from '@/components/skeletons/home/HomeWidgetsSkeleton'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { usePortal } from '@/hooks/usePortal'
import { orpc } from '@/lib/orpc'
import { cn, todayDay } from '@/lib/utils'
import { AWAY_LEGEND, AWAY_TITLE, WEEKDAY_SHORT, weekOf } from './home-labels'

// Who is away this week (2026-11-27, from main's manager dashboard "On leave this week", drawn as a week): one row per
// person with leave waiting or approved on a day from Monday to Sunday, today's column marked - so a manager sees at a
// glance who is out before planning the week. Their team / HOD department in self-service, everyone in the role's Leave
// View access in the role portal (the same views as Team leave).
type Scope = 'TEAM' | 'DEPARTMENT' | 'ALL'
const VIEW: Record<Scope, string> = { TEAM: 'team', DEPARTMENT: 'department', ALL: 'all' }
const ROWS = 6

export function HomeAwayWeek() {
  const { to, portal } = usePortal()
  const overview = useQuery(orpc.leave.overview.queryOptions())
  const o = overview.data
  const scopes = o ? ([...(o.teamSize ? [['TEAM', 'My team']] : []), ...(o.departmentSize ? [['DEPARTMENT', 'My department']] : []), ...(o.canSeeAll ? [['ALL', 'Within my access']] : [])] as [Scope, string][]) : []
  const [selected, setSelected] = useState<Scope | null>(null)
  // self-service opens on one's team, the role portal on the role's access
  const scope = scopes.find(([value]) => value === selected)?.[0] ?? (portal === 'manage' ? scopes.at(-1) : scopes[0])?.[0]
  const today = todayDay()
  const week = weekOf(today)
  const leave = useQuery({ ...orpc.leave.applications.list.queryOptions({ input: { scope: scope ?? 'TEAM', from: week[0]!, to: week[6]! } }), enabled: !!scope })
  if (o && !scopes.length) return null
  // per person: each weekday approved / waiting (approved wins when two applications meet on a day)
  const people = new Map<string, { name: string; days: ('APPROVED' | 'PENDING' | null)[] }>()
  for (const a of leave.data ?? []) {
    const row = people.get(a.employee.employeeCode) ?? { name: a.employee.name, days: Array<'APPROVED' | 'PENDING' | null>(7).fill(null) }
    week.forEach((day, i) => {
      if (a.fromDate <= day && a.toDate >= day && row.days[i] !== 'APPROVED') row.days[i] = a.status === 'APPROVED' ? 'APPROVED' : 'PENDING'
    })
    people.set(a.employee.employeeCode, row)
  }
  const todayIndex = week.findIndex((d) => d.getTime() === today.getTime())
  const rows = [...people].filter(([, r]) => r.days.some(Boolean)).sort(([, a], [, b]) => a.days.findIndex(Boolean) - b.days.findIndex(Boolean) || a.name.localeCompare(b.name))
  const awayToday = rows.filter(([, r]) => r.days[todayIndex]).length
  const pending = overview.isPending || leave.isPending
  return (
    <section className="home-panel min-w-0 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-light tracking-tight">{AWAY_TITLE}</h2>
        {scopes.length > 1 && (
          <NativeSelect aria-label="Away this week scope" value={scope} onChange={(e) => setSelected(e.target.value as Scope)} className="[&_select]:rounded-full">
            {scopes.map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}
          </NativeSelect>
        )}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {pending ? <Skeleton className="mt-1 inline-block h-3 w-40 rounded" /> : rows.length === 0 ? 'Nobody has leave waiting or approved this week.' : `${rows.length} ${rows.length === 1 ? 'person' : 'people'} away this week · ${awayToday} today`}
      </div>
      <FormError error={overview.error ?? leave.error} />
      {pending && <HomeAwayWeekSkeleton />}
      {rows.length > 0 && (
        <table className="mt-3 w-full table-fixed border-separate border-spacing-y-1 text-sm">
          <thead>
            <tr>
              <th scope="col" className="w-28 text-left text-xs font-normal text-muted-foreground sm:w-36"><span className="sr-only">Employee</span></th>
              {WEEKDAY_SHORT.map((d, i) => <th key={d} scope="col" aria-current={i === todayIndex ? 'date' : undefined} className={cn('text-center text-xs', i === todayIndex ? 'font-semibold text-foreground underline decoration-gold decoration-2 underline-offset-4' : 'font-normal text-muted-foreground')}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, ROWS).map(([code, r]) => (
              <tr key={code}>
                <th scope="row" className="truncate pr-2 text-left font-medium" title={`${r.name} · ${code}`}>{r.name}</th>
                {r.days.map((state, i) => (
                  <td key={i} className="px-0.5">
                    <span
                      title={`${WEEKDAY_SHORT[i]}: ${state === 'APPROVED' ? 'approved leave' : state === 'PENDING' ? 'leave waiting for approval' : 'not away'}`}
                      className={cn('mx-auto block h-6 max-w-10 rounded-md', state === 'APPROVED' ? AWAY_LEGEND[0].swatch : state === 'PENDING' ? AWAY_LEGEND[1].swatch : 'bg-surface-2/50')}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border/60 pt-3">
        <Link to={to(`/team-leave?view=${VIEW[scope ?? 'TEAM']}`)} className="home-cta flex min-h-9 items-center gap-1.5 text-sm font-medium">
          {rows.length > ROWS ? `All ${rows.length} in Team leave` : 'Open team leave'} <ArrowRight aria-hidden className="size-4" />
        </Link>
        <p className="flex gap-3 text-xs text-muted-foreground">
          {AWAY_LEGEND.map((l) => <span key={l.label} className="inline-flex items-center gap-1.5"><span aria-hidden className={cn('size-3 rounded', l.swatch)} />{l.label}</span>)}
        </p>
      </div>
    </section>
  )
}
