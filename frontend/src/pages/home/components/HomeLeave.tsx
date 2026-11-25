import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { FormError } from '@/components/FormError'
import { HomeLeaveSkeleton } from '@/components/skeletons/home/HomePanelsSkeleton'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'

export function HomeLeave() {
  const { ready } = useAccess()
  const balances = useQuery({ ...orpc.leave.balances.get.queryOptions(), enabled: ready })
  const paid = balances.data?.balances.filter(b => b.available !== null)
  return <section className="home-panel min-w-0 p-4 sm:p-5">
    <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-medium tracking-tight">Your leave</h2><Link to="/ess/leave" className="flex min-h-9 items-center gap-1 text-sm underline underline-offset-4">Open leave <ArrowRight aria-hidden className="size-3.5" /></Link></div>
    <p className="mt-1 text-xs text-muted-foreground">Days available, after pending requests.</p>
    <FormError error={balances.error} />{balances.isPending && <HomeLeaveSkeleton />}
    {paid?.length === 0 && <p className="py-4 text-sm text-muted-foreground">No paid leave balances apply yet.</p>}
    {paid && <dl className="divide-y divide-border/60">{paid.slice(0, 3).map(b => <div key={b.leaveType.id} className="flex min-h-14 items-center justify-between gap-3 py-2"><div className="min-w-0"><dt className="truncate text-sm font-medium">{b.leaveType.name}</dt><dd className="text-xs text-muted-foreground">Days available{b.pending > 0 ? ` · ${b.pending} waiting` : ''}</dd></div><dd className="shrink-0 text-2xl font-light tabular-nums">{b.available}</dd></div>)}</dl>}
    {paid && paid.length > 3 && <Link to="/ess/leave" className="flex min-h-9 items-center text-xs underline underline-offset-4">See all {paid.length} paid leave types</Link>}
  </section>
}
