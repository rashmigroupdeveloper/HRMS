import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Check, CircleCheck, Clock3, Minus, Pause, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { FormError } from '@/components/FormError'
import { HomeRequestRowsSkeleton } from '@/components/skeletons/home/HomePanelsSkeleton'
import { Button } from '@/components/ui/button'
import { useAccess } from '@/hooks/useAccess'
import { usePortal } from '@/hooks/usePortal'
import { orpc } from '@/lib/orpc'
import { cn, formatDate, initialsOf } from '@/lib/utils'
import { ApprovalDrawer } from '@/pages/approvals/components/ApprovalDrawer'
import { CornerLink, TILE } from './HomeParts'

// who a request is about: the employee - or, for a pay run, its company (payroll stage 5)
const subjectOf = (r: { employee: { employeeCode: string; name: string } | null; company: { code: string; name: string } | null }) => r.employee ?? { employeeCode: r.company?.code ?? '', name: r.company?.name ?? '' }

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
    {!!rows?.length && <ul className="mt-2 divide-y divide-hero-foreground/15">{rows.slice(0, compact ? 1 : 3).map(r => <li key={r.id}><button type="button" onClick={() => setOpen(r.id)} className="group flex min-h-14 w-full items-center gap-3 rounded-xl py-2 text-left outline-none transition-colors hover:bg-hero-foreground/5 focus-visible:ring-2 focus-visible:ring-gold"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-hero-foreground/10 text-[11px] font-medium">{initialsOf(subjectOf(r).name)}</span><div className="min-w-0 flex-1"><p className="flex min-w-0 items-center gap-x-2 text-sm font-medium"><span className="truncate">{subjectOf(r).name}</span><span className="shrink-0 text-xs font-normal text-hero-foreground/65">{r.label}</span>{r.step?.late && <span className={`inline-flex shrink-0 items-center gap-1 text-xs font-normal ${light ? 'text-warning-ink' : 'text-gold'}`}><Clock3 aria-hidden className="size-3" />Past due</span>}</p><p className="truncate text-xs text-hero-foreground/75">{r.summary} · raised {formatDate(r.raisedAt)}</p></div><ArrowRight aria-hidden className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" /></button></li>)}</ul>}
    <div className="mt-auto flex flex-wrap items-center gap-3 pt-2"><Button size="sm" variant={compact ? "secondary" : "gold"} nativeButton={false} render={<Link to={to('/approvals')} />}>Review approvals <ArrowRight aria-hidden /></Button><Link className="flex min-h-8 items-center text-xs text-hero-foreground/85 underline underline-offset-4" to={to('/approvals?tab=mine')}>Requests I raised</Link></div>
    {open !== null && <ApprovalDrawer id={open} onClose={() => setOpen(null)} />}
  </section>
}

type MyRequest = { status: string; held: object | null }
const statusOf = (r: MyRequest) => (r.held ? 'Held' : r.status === 'PENDING' ? 'Waiting' : r.status === 'APPROVED' ? 'Approved' : r.status === 'REJECTED' ? 'Rejected' : r.status === 'CANCELLED' ? 'Withdrawn' : 'Expired')
// each row's round status chip, as the ticks of Crextio's onboarding task list: approved a gold tick, waiting a clock
// on an outlined ring, held a pause, rejected a cross, withdrawn / expired a dash
function StatusChip({ r, dark }: { r: MyRequest; dark: boolean }) {
  const Icon = r.held ? Pause : r.status === 'APPROVED' ? Check : r.status === 'PENDING' ? Clock3 : r.status === 'REJECTED' ? X : Minus
  const tone = r.held ? 'bg-warning/25 text-warning-ink' : r.status === 'APPROVED' ? 'bg-gold text-gold-foreground' : r.status === 'PENDING' ? (dark ? 'border border-hero-foreground/30' : 'border border-foreground/25') : r.status === 'REJECTED' ? 'bg-destructive/20 text-negative-ink' : dark ? 'bg-hero-foreground/10' : 'bg-surface-2'
  return <span title={statusOf(r)} className={cn('grid size-8 shrink-0 place-items-center rounded-full', tone, dark && r.status === 'REJECTED' && !r.held && 'text-destructive')}><Icon aria-hidden className="size-3.5" /></span>
}

// "Recent requests" (one's own, self-service) / "Raised for others" (role portal). `dark`: the screen's one charcoal card
// (2026-11-28, Crextio's "Onboarding Task 2/8") - the home makes it dark only when no other tile is.
export function HomeMyRequests({ dark = false }: { dark?: boolean }) {
  const { ready } = useAccess()
  const { to, portal } = usePortal()
  // one's own requests in self-service, the ones raised for others in the role portal (2026-11-25)
  const title = portal === 'ess' ? 'Recent requests' : 'Raised for others'
  const requests = useQuery({ ...orpc.approvals.listMine.queryOptions(), enabled: ready })
  const [open, setOpen] = useState<number | null>(null)
  const rows = requests.data?.slice(0, 3)
  const waiting = requests.data?.filter(r => r.status === 'PENDING').length ?? 0
  // the header: the title with the arrow, then the waiting count as the card's one big number (Crextio's "2/8"); each row
  // the status chip, what was asked, then the status word (gold while waiting) and its summary; a footer link fills the
  // card's foot
  return <section className={cn(TILE, dark && 'home-panel-dark home-people-dark text-hero-foreground')}>
    <div className="flex items-start justify-between gap-3">
      <h2 className="min-w-0 truncate text-xl leading-tight font-light tracking-tight">{title}</h2>
      <CornerLink to={to('/approvals?tab=mine')} label="Open all requests" dark={dark} />
    </div>
    {requests.data?.length
      ? <p className="-mt-1 flex items-baseline gap-2"><span className="text-[34px] leading-none font-light tracking-tight tabular-nums">{waiting}<span className="text-muted-foreground">/{requests.data.length}</span></span><span className="text-xs text-muted-foreground">{waiting === 1 ? 'request' : 'requests'} waiting for a decision</span></p>
      : <p className="mt-0.5 text-xs text-muted-foreground">{portal === 'ess' ? 'Leave, corrections and shift changes' : 'Job and salary changes'}</p>}
    <FormError error={requests.error} />{requests.isPending && <HomeRequestRowsSkeleton dark={dark} />}
    {rows?.length === 0 && <p className="py-3 text-sm text-muted-foreground">{portal === 'ess' ? 'No requests raised yet. Leave, regularization and shift changes will appear here.' : 'Nothing raised for others yet. Job and salary changes you raise appear here.'}</p>}
    {!!rows?.length && <ul className="mt-3 space-y-1">{rows.map(r => <li key={r.id}><button type="button" className={cn('-mx-2 flex min-h-13 w-[calc(100%+1rem)] items-center gap-3 rounded-2xl px-2 py-2 text-left outline-none transition-colors focus-visible:ring-2', dark ? 'hover:bg-hero-foreground/[0.06] focus-visible:ring-gold' : 'hover:bg-surface-2/60 focus-visible:ring-ring')} onClick={() => setOpen(r.id)}>
      <StatusChip r={r} dark={dark} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] leading-snug">{r.label}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground"><span className={cn(r.status === 'PENDING' && !r.held && (dark ? 'text-gold' : 'font-medium text-foreground'))}>{statusOf(r)}</span> · {r.summary}</p>
      </div>
    </button></li>)}</ul>}
    {!!requests.data?.length && <Link to={to('/approvals?tab=mine')} className={cn('home-cta mt-auto flex min-h-8 items-center gap-1.5 border-t pt-2 text-xs font-medium', dark ? 'border-hero-foreground/15' : 'border-border/60')}>{requests.data.length > 3 ? `All ${requests.data.length} requests` : portal === 'ess' ? 'Open my requests' : 'Open what I raised'} <ArrowRight aria-hidden className="size-4" /></Link>}
    {open !== null && <ApprovalDrawer id={open} onClose={() => setOpen(null)} />}
  </section>
}
