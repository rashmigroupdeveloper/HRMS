import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CircleCheck, Clock3 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { HomeRequestRowsSkeleton } from '@/components/skeletons/home/HomePanelsSkeleton'
import { Button } from '@/components/ui/button'
import { useAccess } from '@/hooks/useAccess'
import { usePortal } from '@/hooks/usePortal'
import { orpc } from '@/lib/orpc'
import { formatDate, initialsOf } from '@/lib/utils'
import { ApprovalDrawer } from '@/pages/approvals/components/ApprovalDrawer'
import { CardTitle, CornerLink, TILE } from './HomeParts'

// "2 past due · the oldest waiting 5 days" - how urgent the list is, before reading it (2026-11-27, from main's "On your desk")
function waitingLine(rows: { raisedAt: Date; step: { late: boolean } | null }[]) {
  const late = rows.filter((r) => r.step?.late).length
  const oldest = Math.max(...rows.map((r) => Math.floor((Date.now() - r.raisedAt.getTime()) / 86_400_000)))
  return [late > 0 ? `${late} past due` : null, oldest >= 1 ? `the oldest waiting ${oldest} ${oldest === 1 ? 'day' : 'days'}` : 'all raised today'].filter(Boolean).join(' · ')
}

export function HomeDecisions({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  const { ready } = useAccess()
  const { to, portal } = usePortal()
  const requests = useQuery({ ...orpc.approvals.listToDecide.queryOptions(), enabled: ready, refetchInterval: 120_000 })
  const [open, setOpen] = useState<number | null>(null)
  const rows = requests.data
  // nothing waiting: one slim row, not a large empty card (the redesign, 2026-11-27)
  if (rows?.length === 0) return <section className="home-panel flex min-w-0 items-center gap-4 p-4 sm:px-5">
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-positive/15 text-positive-ink"><CircleCheck aria-hidden className="size-5" /></span>
    <div className="min-w-0 flex-1"><h2 className="text-xl font-light tracking-tight">Waiting for you</h2><p className="text-xs text-muted-foreground">Nothing is waiting for your decision{portal === 'ess' ? '' : ' in this role'}.</p></div>
    <Link className="hidden min-h-9 items-center text-sm underline underline-offset-4 sm:flex" to={to('/approvals?tab=mine')}>Requests I raised</Link>
    <span className="text-[44px] leading-none font-light tabular-nums">0</span>
    <CornerLink to={to('/approvals')} label="Open approvals" />
  </section>
  return <section className={`${TILE} ${light ? 'bg-card [--hero-foreground:var(--foreground)]' : 'home-panel-dark text-hero-foreground'}`}>
    <div className="flex items-start justify-between gap-3"><h2 className="text-xl leading-tight font-light tracking-tight">Waiting for you</h2>{rows && <span className="flex items-baseline gap-2 text-right"><span className="text-[40px] leading-none font-light tabular-nums">{rows.length}</span><span className="text-xs text-hero-foreground/75">{rows.length === 1 ? 'decision' : 'decisions'}</span></span>}</div>
    {!compact && <p className="mt-0.5 text-xs text-hero-foreground/75">{rows?.length ? waitingLine(rows) : 'The next steps you can move forward.'}</p>}
    {requests.isPending && <HomeRequestRowsSkeleton dark={!light} />}
    {requests.error && <p role="alert" className="py-5 text-sm text-hero-foreground">Your decision list could not load. Open Approvals to try again.</p>}
    {rows?.length === 0 && <div className="flex items-center gap-3 py-5"><CircleCheck aria-hidden className="size-7 shrink-0 text-hero-foreground/70" /><div><p className="text-sm font-medium">Nothing is waiting for your decision.</p>{!compact && <p className="mt-1 text-sm text-hero-foreground/75">{portal === 'ess' ? 'Open your own requests or attendance whenever you need.' : 'Steps for your role appear here as requests reach them.'}</p>}</div></div>}
    {!!rows?.length && <ul className="mt-2 divide-y divide-hero-foreground/15">{rows.slice(0, compact ? 1 : 3).map(r => <li key={r.id}><button type="button" onClick={() => setOpen(r.id)} className="group flex min-h-14 w-full items-center gap-3 rounded-xl py-2 text-left outline-none transition-colors hover:bg-hero-foreground/5 focus-visible:ring-2 focus-visible:ring-gold"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-hero-foreground/10 text-[11px] font-medium">{initialsOf(r.employee.name)}</span><div className="min-w-0 flex-1"><p className="flex min-w-0 items-center gap-x-2 text-sm font-medium"><span className="truncate">{r.employee.name}</span><span className="shrink-0 text-xs font-normal text-hero-foreground/65">{r.label}</span>{r.step?.late && <span className={`inline-flex shrink-0 items-center gap-1 text-xs font-normal ${light ? 'text-warning-ink' : 'text-gold'}`}><Clock3 aria-hidden className="size-3" />Past due</span>}</p><p className="truncate text-xs text-hero-foreground/75">{r.summary} · raised {formatDate(r.raisedAt)}</p></div><ArrowRight aria-hidden className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" /></button></li>)}</ul>}
    <div className="mt-auto flex flex-wrap items-center gap-3 pt-2"><Button size="sm" variant={compact ? "secondary" : "gold"} nativeButton={false} render={<Link to={to('/approvals')} />}>Review approvals <ArrowRight aria-hidden /></Button><Link className="flex min-h-8 items-center text-xs text-hero-foreground/85 underline underline-offset-4" to={to('/approvals?tab=mine')}>Requests I raised</Link></div>
    {open !== null && <ApprovalDrawer id={open} onClose={() => setOpen(null)} />}
  </section>
}

export function HomeMyRequests() {
  const { ready } = useAccess()
  const { to, portal } = usePortal()
  // one's own requests in self-service, the ones raised for others in the role portal (2026-11-25)
  const title = portal === 'ess' ? 'Recent requests' : 'Raised for others'
  const requests = useQuery({ ...orpc.approvals.listMine.queryOptions(), enabled: ready })
  const [open, setOpen] = useState<number | null>(null)
  const rows = requests.data?.slice(0, 3)
  return <section className={TILE}>
    <CardTitle title={title} sub={portal === 'ess' ? 'Leave, corrections and shift changes' : 'Job and salary changes'} action={<CornerLink to={to('/approvals?tab=mine')} label="Open all requests" />} />
    <FormError error={requests.error} />{requests.isPending && <HomeRequestRowsSkeleton />}
    {rows?.length === 0 && <p className="py-3 text-sm text-muted-foreground">{portal === 'ess' ? 'No requests raised yet. Leave, regularization and shift changes will appear here.' : 'Nothing raised for others yet. Job and salary changes you raise appear here.'}</p>}
    {!!rows?.length && <ul className="mt-2 divide-y divide-border/60">{rows.map(r => <li key={r.id}><button type="button" className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl py-1.5 text-left outline-none hover:bg-surface-2/50 focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setOpen(r.id)}><div className="min-w-0"><p className="truncate text-sm font-medium">{r.label} <span className="text-xs font-normal text-muted-foreground">· {formatDate(r.raisedAt)}</span></p><p className="truncate text-xs text-muted-foreground">{r.summary}</p></div><Pill tone={r.status === 'APPROVED' ? 'positive' : r.status === 'REJECTED' ? 'negative' : r.held ? 'warning' : 'neutral'}>{r.held ? 'Held' : r.status === 'PENDING' ? 'Waiting' : r.status === 'APPROVED' ? 'Approved' : r.status === 'REJECTED' ? 'Rejected' : r.status === 'CANCELLED' ? 'Withdrawn' : 'Expired'}</Pill></button></li>)}</ul>}
    {open !== null && <ApprovalDrawer id={open} onClose={() => setOpen(null)} />}
  </section>
}
