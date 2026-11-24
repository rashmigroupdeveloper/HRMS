import { ChevronDown, ChevronRight, LockKeyhole, Search, ShieldCheck, Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ACCESS_GROUPS } from '@/pages/access/components/labels'

// Match RoleWorkspace's sidebar, dark role summary, filters and single-column permission list.
export function RoleWorkspaceSkeleton({ areas = ACCESS_GROUPS.reduce((n, group) => n + group.areas.length, 0), label = 'Loading roles' }: { areas?: number; label?: string }) {
  return <div role="status" aria-label={label} className="grid items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
    <aside className="min-w-0 rounded-3xl bg-card p-4 shadow-card">
      <div className="mb-3 hidden items-center justify-between lg:flex"><h2 className="text-base font-medium">Roles</h2><Skeleton className="h-8 w-5 rounded-full" /></div>
      <div className="flex h-9 items-center justify-between rounded-lg border border-input px-3 lg:hidden"><Skeleton className="h-4 w-28 rounded-full" /><ChevronDown aria-hidden className="size-4 text-muted-foreground" /></div>
      <div className="hidden lg:block">
        <div className="mb-3 flex h-9 items-center gap-2 rounded-full border border-input px-3 text-sm text-muted-foreground"><Search aria-hidden className="size-4" />Find a role</div>
        <div className="space-y-1">{Array.from({ length: 3 }, (_, i) => <div key={i} className="flex min-h-16 items-center gap-3 rounded-2xl px-3 py-3 first:bg-surface-2"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2"><ShieldCheck aria-hidden className="size-4 text-muted-foreground" /></span><span className="flex flex-1 flex-col gap-2"><Skeleton className="h-4 w-24 rounded-full" /><Skeleton className="h-3 w-20 rounded-full" /></span>{i === 0 && <ChevronRight aria-hidden className="size-4" />}</div>)}</div>
        <p className="mt-4 px-2 text-xs leading-relaxed text-muted-foreground">Inspecting a role here does not change your active role.</p>
      </div>
    </aside>
    <section className="min-w-0 overflow-hidden rounded-3xl bg-card shadow-card">
      <div className="bg-hero p-4 text-hero-foreground sm:p-5">
        <Skeleton className="h-8 w-36 rounded-full bg-hero-foreground/10" />
        <div className="mt-2 flex h-8 flex-col justify-center gap-1"><Skeleton className="h-3 w-full max-w-96 rounded-full bg-hero-foreground/10" /><Skeleton className="h-3 w-2/3 max-w-72 rounded-full bg-hero-foreground/10" /></div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-hero-foreground/80"><span className="inline-flex items-center gap-1.5"><Users aria-hidden className="size-3.5" /><Skeleton className="h-3 w-20 rounded-full bg-hero-foreground/10" /></span><Skeleton className="h-3 w-28 rounded-full bg-hero-foreground/10" /><span className="hidden items-center gap-1.5 sm:inline-flex"><LockKeyhole aria-hidden className="size-3.5" /><Skeleton className="h-3 w-24 rounded-full bg-hero-foreground/10" /></span></div>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><div className="flex gap-4">{['Edit', 'View', 'No access'].map((text) => <span key={text} className="inline-flex items-center gap-1"><Skeleton className="h-3 w-3 rounded-full" />{text}</span>)}</div><span className="inline-flex items-center gap-1"><Skeleton className="h-3 w-4 rounded-full" />permission areas</span></div>
        <div className="flex h-9 items-center gap-2 rounded-full border border-input px-3 text-sm text-muted-foreground"><Search aria-hidden className="size-4" />Find a permission</div>
        <div className="flex flex-wrap gap-1.5">{['All areas', ...ACCESS_GROUPS.map((g) => g.label)].map((text, i) => <span key={text} className={i === 0 ? 'flex min-h-9 items-center rounded-full bg-hero px-3 text-xs text-hero-foreground' : 'flex min-h-9 items-center rounded-full bg-surface-2 px-3 text-xs text-muted-foreground'}>{text}</span>)}</div>
        <div><div className="flex items-center justify-between border-b border-border pb-2 text-xs"><h3 className="font-medium">Permissions</h3><Skeleton className="h-3 w-12 rounded-full" /></div>{Array.from({ length: areas }, (_, i) => <div key={i} className="flex min-h-12 items-center gap-3 border-b border-border/60 py-2 last:border-0"><ChevronDown aria-hidden className="size-3.5 shrink-0 text-muted-foreground" /><Skeleton className="h-3.5 w-40 max-w-[55%] rounded-full" /><Skeleton className="ml-auto h-6 w-16 shrink-0 rounded-full" /></div>)}</div>
        <div className="border-t border-border pt-3"><Skeleton className="h-3 w-64 max-w-full rounded-full" /><p className="mt-1 text-xs text-muted-foreground">Data access is set separately for each employee on the People tab.</p></div>
      </div>
    </section>
  </div>
}
