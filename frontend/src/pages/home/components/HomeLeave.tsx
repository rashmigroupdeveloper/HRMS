import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { FormError } from '@/components/FormError'
import { HomeLeaveSkeleton } from '@/components/skeletons/home/HomePanelsSkeleton'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { CardTitle, CornerLink, TILE } from './HomeParts'

export function HomeLeave() {
  const { ready } = useAccess()
  const balances = useQuery({ ...orpc.leave.balances.get.queryOptions(), enabled: ready })
  const paid = balances.data?.balances.filter(b => b.available !== null)
  // the days left of each type, in the leave types' own order (2026-11-27 redesign), each with Crextio's segmented strip
  // under it (2026-11-28): taken charcoal, waiting gold, left striped; apply from the leave page
  return <section className={TILE}>
    <CardTitle title="Your leave" sub="Days left, after pending requests" action={<CornerLink to="/ess/leave" label="Open leave" />} />
    <FormError error={balances.error} />{balances.isPending && <HomeLeaveSkeleton />}
    {paid?.length === 0 && <p className="py-4 text-sm text-muted-foreground">No paid leave balances apply yet.</p>}
    {paid && paid.length > 0 && <dl className="mt-1 space-y-2.5">{paid.slice(0, 3).map(b => {
      const left = Math.max(0, b.available ?? 0)
      const parts = [{ key: 'taken', value: Math.max(0, b.taken), tone: 'bg-hero' }, { key: 'waiting', value: b.pending, tone: 'bg-gold' }, { key: 'left', value: left, tone: 'home-hatch' }].filter(p => p.value > 0)
      return <div key={b.leaveType.id}>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="min-w-0 truncate text-sm" title={b.leaveType.name}>{b.leaveType.name}{b.pending > 0 && <span className="text-[11px] text-muted-foreground"> · {b.pending} waiting</span>}</dt>
          <dd className="shrink-0 text-2xl leading-none font-light tabular-nums">{b.available}</dd>
        </div>
        <div role="img" aria-label={`${b.leaveType.name}: ${b.taken} taken, ${b.pending} waiting, ${left} left`} className="mt-1.5 flex h-1.5 gap-0.5">
          {parts.length ? parts.map(p => <span key={p.key} className={`home-grow h-full min-w-1.5 rounded-full ${p.tone}`} style={{ flex: `${p.value} 1 0%` }} />) : <span className="home-hatch h-full flex-1 rounded-full opacity-60" />}
        </div>
      </div>
    })}</dl>}
    <Link to="/ess/leave" className="home-cta mt-auto flex min-h-8 items-center gap-1.5 border-t border-border/60 pt-2 text-xs font-medium">{paid && paid.length > 3 ? `All ${paid.length} leave types · apply` : 'Apply for leave'} <ArrowRight aria-hidden className="size-4" /></Link>
  </section>
}
