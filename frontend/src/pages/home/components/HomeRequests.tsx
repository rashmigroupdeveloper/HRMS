import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CircleCheck, Clock3 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { HomeRequestRowsSkeleton } from '@/components/skeletons/home/HomePanelsSkeleton'
import { Button } from '@/components/ui/button'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { formatDate, initialsOf } from '@/lib/utils'
import { ApprovalDrawer } from '@/pages/approvals/components/ApprovalDrawer'

export function HomeDecisions({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  const { ready } = useAccess()
  const requests = useQuery({ ...orpc.approvals.listToDecide.queryOptions(), enabled: ready, refetchInterval: 120_000 })
  const [open, setOpen] = useState<number | null>(null)
  const rows = requests.data
  return <section className={`home-panel min-w-0 p-4 sm:p-5 ${light ? 'bg-card [--hero-foreground:var(--foreground)]' : 'home-panel-dark text-hero-foreground'}`}>
    <div className="flex items-start justify-between gap-3"><h2 className="text-lg font-medium tracking-tight">Waiting for you</h2>{rows && <span className="flex items-baseline gap-2 text-right"><span className="text-3xl font-light tabular-nums">{rows.length}</span><span className="text-xs text-hero-foreground/75">{rows.length === 1 ? 'decision' : 'decisions'}</span></span>}</div>
    {!compact && <p className="mt-1 text-sm text-hero-foreground/75">The next steps you can move forward.</p>}
    {requests.isPending && <HomeRequestRowsSkeleton dark={!light} />}
    {requests.error && <p role="alert" className="py-5 text-sm text-hero-foreground">Your decision list could not load. Open Approvals to try again.</p>}
    {rows?.length === 0 && <div className="flex items-center gap-3 py-5"><CircleCheck aria-hidden className="size-7 shrink-0 text-hero-foreground/70" /><div><p className="text-sm font-medium">Nothing is waiting for your decision.</p>{!compact && <p className="mt-1 text-sm text-hero-foreground/75">Open your own requests or attendance whenever you need.</p>}</div></div>}
    {!!rows?.length && <ul className="mt-3 divide-y divide-hero-foreground/15">{rows.slice(0, compact ? 1 : 3).map(r => <li key={r.id}><button type="button" onClick={() => setOpen(r.id)} className="group flex min-h-16 w-full items-center gap-3 rounded-xl py-2 text-left outline-none transition-colors hover:bg-hero-foreground/5 focus-visible:ring-2 focus-visible:ring-gold"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-hero-foreground/10 text-xs font-medium">{initialsOf(r.employee.name)}</span><div className="min-w-0 flex-1"><p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">{r.employee.name}{r.step?.late && <span className={`inline-flex items-center gap-1 text-xs ${light ? 'text-warning-ink' : 'text-gold'}`}><Clock3 aria-hidden className="size-3" />Past due</span>}</p><p className="mt-1 line-clamp-2 text-sm text-hero-foreground/80">{r.summary}</p><p className="mt-1 text-xs text-hero-foreground/65">{r.label} · raised {formatDate(r.raisedAt)}</p></div><ArrowRight aria-hidden className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" /></button></li>)}</ul>}
    <div className="mt-4 flex flex-wrap items-center gap-3"><Button variant={compact ? "secondary" : "gold"} nativeButton={false} render={<Link to="/approvals" />}>Review approvals <ArrowRight aria-hidden /></Button><Link className="flex min-h-10 items-center text-sm text-hero-foreground/85 underline underline-offset-4" to="/approvals?tab=mine">Requests I raised</Link></div>
    {open !== null && <ApprovalDrawer id={open} onClose={() => setOpen(null)} />}
  </section>
}

export function HomeMyRequests() {
  const { ready } = useAccess()
  const requests = useQuery({ ...orpc.approvals.listMine.queryOptions(), enabled: ready })
  const [open, setOpen] = useState<number | null>(null)
  const rows = requests.data?.slice(0, 3)
  return <section className="home-panel min-w-0 p-4 sm:p-5">
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-medium tracking-tight">Recent requests</h2><Link to="/approvals?tab=mine" className="flex min-h-9 items-center gap-1 text-sm underline underline-offset-4">View all <ArrowRight aria-hidden className="size-3.5" /></Link></div>
    <FormError error={requests.error} />{requests.isPending && <HomeRequestRowsSkeleton />}
    {rows?.length === 0 && <p className="py-3 text-sm text-muted-foreground">No requests raised yet. Leave, regularization and shift changes will appear here.</p>}
    {!!rows?.length && <ul className="divide-y divide-border/60">{rows.map(r => <li key={r.id}><button type="button" className="flex min-h-16 w-full items-center justify-between gap-3 rounded-xl py-2 text-left outline-none hover:bg-surface-2/50 focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setOpen(r.id)}><div className="min-w-0"><p className="text-sm font-medium">{r.label}</p><p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{r.summary}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(r.raisedAt)}</p></div><Pill tone={r.status === 'APPROVED' ? 'positive' : r.status === 'REJECTED' ? 'negative' : r.held ? 'warning' : 'neutral'}>{r.held ? 'Held' : r.status === 'PENDING' ? 'Waiting' : r.status === 'APPROVED' ? 'Approved' : r.status === 'REJECTED' ? 'Rejected' : r.status === 'CANCELLED' ? 'Withdrawn' : 'Expired'}</Pill></button></li>)}</ul>}
    {open !== null && <ApprovalDrawer id={open} onClose={() => setOpen(null)} />}
  </section>
}
