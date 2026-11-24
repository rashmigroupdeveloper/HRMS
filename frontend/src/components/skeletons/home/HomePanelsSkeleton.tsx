import { Skeleton } from '@/components/ui/skeleton'

// Mirrors the home panels' real rows and value slots. Section headings and actions remain in the loaded containers.
export function HomeRequestRowsSkeleton({ dark = false }: { dark?: boolean }) {
  return <div role="status" aria-label="Loading requests" className="divide-y divide-current/10">{Array.from({ length: 3 }, (_, i) => <div key={i} className="flex min-h-16 items-center gap-3 py-2"><Skeleton className={`size-9 shrink-0 rounded-full ${dark ? 'bg-hero-foreground/10' : ''}`} /><div className="min-w-0 flex-1 space-y-2"><Skeleton className={`h-3.5 w-36 rounded ${dark ? 'bg-hero-foreground/10' : ''}`} /><Skeleton className={`h-3 w-64 max-w-full rounded ${dark ? 'bg-hero-foreground/10' : ''}`} /></div></div>)}</div>
}
export function HomeLeaveSkeleton() {
  return <div role="status" aria-label="Loading your leave balances" className="divide-y divide-border/60">{Array.from({ length: 3 }, (_, i) => <div key={i} className="flex min-h-14 items-center justify-between gap-3 py-2"><div className="space-y-2"><Skeleton className="h-3.5 w-28 rounded" /><p className="text-xs text-muted-foreground">Days available</p></div><Skeleton className="h-6 w-10 rounded" /></div>)}</div>
}
export function HomeAttendanceSkeleton({ dark = false }: { dark?: boolean }) {
  return <div role="status" aria-label="Loading attendance overview" className="space-y-3"><dl className={`grid grid-cols-2 gap-x-4 gap-y-5 border-y border-border/60 py-3 ${dark ? '' : 'sm:grid-cols-4'}`}>{['People', 'Punched in', 'On leave', 'Not in yet'].map(label => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-2"><Skeleton className="h-10 w-12 rounded" /></dd></div>)}</dl><HomeRequestRowsSkeleton dark={dark} /></div>
}

export function HomeRoleSkeleton() {
  return <section role="status" aria-label="Loading your workspace" className="home-panel home-panel-dark min-h-64 space-y-4 p-4 sm:p-5"><Skeleton className="h-6 w-40 rounded bg-hero-foreground/10" /><HomeRequestRowsSkeleton dark /></section>
}
