import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { FormError } from '@/components/FormError'
import { HomeLeaveSkeleton } from '@/components/skeletons/home/HomePanelsSkeleton'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { CardTitle, CornerLink } from './HomeParts'

export function HomeLeave() {
  const { ready } = useAccess()
  const balances = useQuery({ ...orpc.leave.balances.get.queryOptions(), enabled: ready })
  const paid = balances.data?.balances.filter(b => b.available !== null)
  // tiles with the days left, largest first in the leave types' own order (2026-11-27 redesign); apply from the leave page
  return <section className="home-panel min-w-0 p-4 sm:p-5">
    <CardTitle title="Your leave" sub="Days left, after pending requests" action={<CornerLink to="/ess/leave" label="Open leave" />} />
    <FormError error={balances.error} />{balances.isPending && <HomeLeaveSkeleton />}
    {paid?.length === 0 && <p className="py-4 text-sm text-muted-foreground">No paid leave balances apply yet.</p>}
    {paid && paid.length > 0 && <dl className="mt-3 grid grid-cols-3 gap-2">{paid.slice(0, 3).map(b => <div key={b.leaveType.id} className="min-w-0 rounded-2xl bg-surface-2/60 px-3 py-2.5"><dt className="truncate text-xs text-muted-foreground" title={b.leaveType.name}>{b.leaveType.name}</dt><dd className="mt-1 text-3xl font-light tabular-nums">{b.available}</dd><dd className="truncate text-[11px] text-muted-foreground">{b.pending > 0 ? `${b.pending} waiting` : 'days'}</dd></div>)}</dl>}
    <Link to="/ess/leave" className="home-cta mt-3 flex min-h-9 items-center gap-1.5 text-sm font-medium">{paid && paid.length > 3 ? `All ${paid.length} leave types · apply` : 'Apply for leave'} <ArrowRight aria-hidden className="size-4" /></Link>
  </section>
}
