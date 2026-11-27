import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { HomeMovementsSkeleton } from '@/components/skeletons/home/HomeWidgetsSkeleton'
import { orpc } from '@/lib/orpc'
import { todayDay } from '@/lib/utils'
import { TILE } from './HomeParts'
import { MOVEMENTS_NOTE, MOVEMENTS_TITLE, MOVEMENT_TILES, addDays, daysBetween, inDays, shortDay } from './home-labels'

// Joiners and leavers on the role portal's home (2026-11-27, from main's HR dashboard "joiners / exits this month") - for
// Employees View, within its data access (employees.movements.list): this calendar month so far, and who joins or leaves
// in the next 30 days. A leaving date is what the employee record says, not a confirmed exit - so no attrition rate.
export function HomeMovements() {
  const today = todayDay()
  const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
  const month = useQuery(orpc.employees.movements.list.queryOptions({ input: { from: first, to: today, pageSize: 1 } }))
  const coming = useQuery(orpc.employees.movements.list.queryOptions({ input: { from: addDays(today, 1), to: addDays(today, 30), pageSize: 5 } }))
  const pending = month.isPending || coming.isPending
  const tiles = month.data ? [month.data.summary.joiners, month.data.summary.leavers] : []
  return (
    <section className={TILE}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl leading-tight font-light tracking-tight">{MOVEMENTS_TITLE}</h2>
        <Link to="/manage/employees?view=movements" aria-label="Open joiners and leavers" className="grid size-9 place-items-center rounded-full bg-surface-2 outline-none hover:bg-surface-2/70 focus-visible:ring-2 focus-visible:ring-ring"><ArrowUpRight aria-hidden className="size-4" /></Link>
      </div>
      <FormError error={month.error ?? coming.error} />
      {pending && <HomeMovementsSkeleton />}
      {!pending && (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-2">
            {MOVEMENT_TILES.map((label, i) => (
              <div key={label} className="rounded-2xl bg-surface-2/60 px-3 py-2.5">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 text-2xl font-light tabular-nums">{tiles[i] ?? '—'}</dd>
              </div>
            ))}
          </dl>
          <h3 className="mt-3 text-sm font-medium">Next 30 days{coming.data ? ` · ${coming.data.summary.joiners} joining, ${coming.data.summary.leavers} leaving` : ''}</h3>
          {coming.data?.items.length === 0 && <p className="py-2 text-sm text-muted-foreground">Nobody joins or leaves in the next 30 days.</p>}
          <ul className="divide-y divide-border/60">
            {coming.data?.items.slice(0, 2).map((m) => (
              <li key={`${m.employeeCode}-${m.kind}`} className="flex min-h-12 items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{shortDay(m.date)} · {inDays(daysBetween(today, m.date))}{m.department ? ` · ${m.department.name}` : ''}</p>
                </div>
                <Pill tone={m.kind === 'JOINER' ? 'positive' : 'neutral'}>{m.kind === 'JOINER' ? 'Joining' : 'Leaving'}</Pill>
              </li>
            ))}
          </ul>
          <p className="mt-auto truncate pt-2 text-[11px] text-muted-foreground" title={MOVEMENTS_NOTE}>{MOVEMENTS_NOTE}</p>
        </>
      )}
    </section>
  )
}
