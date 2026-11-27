import { Skeleton } from '@/components/ui/skeleton'
import { CYCLE_COUNTS, PEOPLE_LEGEND } from '@/pages/home/components/home-labels'

// Mirrors the home panels' real rows and value slots. Section headings and actions remain in the loaded containers.
export function HomeRequestRowsSkeleton({ dark = false }: { dark?: boolean }) {
  return <div role="status" aria-label="Loading requests" className="divide-y divide-current/10">{Array.from({ length: 3 }, (_, i) => <div key={i} className="flex min-h-16 items-center gap-3 py-2"><Skeleton className={`size-9 shrink-0 rounded-full ${dark ? 'bg-hero-foreground/10' : ''}`} /><div className="min-w-0 flex-1 space-y-2"><Skeleton className={`h-3.5 w-36 rounded ${dark ? 'bg-hero-foreground/10' : ''}`} /><Skeleton className={`h-3 w-64 max-w-full rounded ${dark ? 'bg-hero-foreground/10' : ''}`} /></div></div>)}</div>
}
export function HomeLeaveSkeleton() {
  return <div role="status" aria-label="Loading your leave balances" className="mt-3 grid grid-cols-3 gap-2">{Array.from({ length: 3 }, (_, i) => <div key={i} className="rounded-2xl bg-surface-2/60 px-3 py-2.5"><Skeleton className="h-3 w-16 rounded" /><Skeleton className="mt-2 h-8 w-10 rounded" /><Skeleton className="mt-1.5 h-2.5 w-8 rounded" /></div>)}</div>
}
// People today's body: the in / total number, the split bar, its legend (real words) and the people rows
export function HomeAttendanceSkeleton({ dark = false }: { dark?: boolean }) {
  const bar = dark ? 'bg-hero-foreground/10' : ''
  return <div role="status" aria-label="Loading attendance overview">
    <div className="mt-4 flex items-end justify-between gap-3"><Skeleton className={`h-12 w-24 rounded ${bar}`} /><p className={`pb-1 text-right text-xs ${dark ? 'text-hero-foreground/70' : 'text-muted-foreground'}`}>punched in<br />“not in yet” is not absent</p></div>
    <Skeleton className={`mt-3 h-2.5 w-full rounded-full ${bar}`} />
    <p className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs ${dark ? 'text-hero-foreground/70' : 'text-muted-foreground'}`}>{PEOPLE_LEGEND.map(label => <span key={label} className="inline-flex items-center gap-1.5"><Skeleton className={`h-3 w-4 rounded ${bar}`} />{label}</span>)}</p>
    <h3 className="mt-5 text-sm font-medium">Worth a look</h3>
    <div className="mt-1 space-y-1">{Array.from({ length: 2 }, (_, i) => <div key={i} className="flex min-h-14 items-center gap-3 py-1.5"><Skeleton className={`size-10 shrink-0 rounded-full ${bar}`} /><div className="flex-1 space-y-1.5"><Skeleton className={`h-3.5 w-28 rounded ${bar}`} /><Skeleton className={`h-3 w-36 rounded ${bar}`} /></div></div>)}</div>
  </div>
}

export function CycleDeskSkeleton() {
  return (
    <section role="status" aria-label="Loading the attendance cycle" className="home-panel home-panel-dark u-grain min-w-0 p-4 text-hero-foreground sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <Skeleton className="h-9 w-48 rounded bg-hero-foreground/10" />
          <Skeleton className="mt-2 h-4 w-56 rounded bg-hero-foreground/10" />
        </div>
        <CycleDeskFiguresSkeleton />
      </div>
      <Skeleton className="mt-5 h-1.5 w-full rounded-full bg-hero-foreground/10" />
    </section>
  )
}

export function CycleDeskFiguresSkeleton() {
  return (
    <div role="status" aria-label="Loading who is in today" className="grid grid-cols-3 gap-x-5 sm:gap-x-8">
      {CYCLE_COUNTS.map((label) => (
        <div key={label}>
          <p className="text-xs text-hero-foreground/80">{label}</p>
          <Skeleton className="mt-2 h-9 w-12 rounded bg-hero-foreground/10" />
        </div>
      ))}
    </div>
  )
}

export function HomeRoleSkeleton({ dark = false }: { dark?: boolean }) {
  return <section role="status" aria-label="Loading your workspace" className={`home-panel min-h-64 space-y-4 p-4 sm:p-5 ${dark ? 'home-panel-dark text-hero-foreground' : ''}`}><h2 className="text-lg font-medium">Your workspace</h2><HomeRequestRowsSkeleton dark={dark} /></section>
}
