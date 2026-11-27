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
  // tiles with the days left, largest first in the leave types' own order (2026-11-27 redesign); apply from the leave page
  return <section className={TILE}>
    <CardTitle title="Your leave" sub="Days left, after pending requests" action={<CornerLink to="/ess/leave" label="Open leave" />} />
    <FormError error={balances.error} />{balances.isPending && <HomeLeaveSkeleton />}
    {paid?.length === 0 && <p className="py-4 text-sm text-muted-foreground">No paid leave balances apply yet.</p>}
    {paid && paid.length > 0 && <dl className="mt-2 divide-y divide-border/60">{paid.slice(0, 3).map(b => <div key={b.leaveType.id} className="flex min-h-11 items-center justify-between gap-3 py-1"><div className="min-w-0"><dt className="truncate text-sm" title={b.leaveType.name}>{b.leaveType.name}</dt>{b.pending > 0 && <dd className="text-[11px] text-muted-foreground">{b.pending} waiting</dd>}</div><dd className="shrink-0 text-2xl font-light tabular-nums">{b.available}</dd></div>)}</dl>}
    <Link to="/ess/leave" className="home-cta mt-auto flex min-h-8 items-center gap-1.5 border-t border-border/60 pt-2 text-xs font-medium">{paid && paid.length > 3 ? `All ${paid.length} leave types · apply` : 'Apply for leave'} <ArrowRight aria-hidden className="size-4" /></Link>
  </section>
}
