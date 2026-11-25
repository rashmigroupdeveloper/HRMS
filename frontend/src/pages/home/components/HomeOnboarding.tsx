import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ArrowUpRight, ListChecks } from 'lucide-react'
import { Link } from 'react-router'
import { FormError } from '@/components/FormError'
import { HomeRequestRowsSkeleton } from '@/components/skeletons/home/HomePanelsSkeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { orpc } from '@/lib/orpc'
import { useAccess } from '@/hooks/useAccess'
import { formatDate, todayDay } from '@/lib/utils'

// HR has its own work surface, not the employee profile with a different title. Existing readers enforce the active
// Onboarding scope. Task totals come from the count reader; the task preview is explicitly limited to three items.
export function HomeJoiningWork() {
  const { ready } = useAccess()
  const tasks = useQuery({ ...orpc.joiningTasks.list.queryOptions({ input: { scope: 'ALL', status: 'OPEN' } }), enabled: ready })
  const open = tasks.data?.teams.reduce((n, t) => n + t.open, 0)
  return (
    <section className="home-panel home-panel-dark min-w-0 p-4 text-hero-foreground sm:p-5">
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-medium tracking-tight">Joining work</h2><Link to="/manage/joining-tasks?tab=all" aria-label="Open all joining tasks" className="grid size-10 place-items-center rounded-full bg-hero-foreground/10 outline-none hover:bg-hero-foreground/20 focus-visible:ring-2 focus-visible:ring-gold"><ArrowUpRight aria-hidden className="size-5" /></Link></div>
      <div className="my-4 flex items-end gap-3"><div className="text-4xl font-light tabular-nums">{open ?? (tasks.isError ? '—' : <Skeleton className="h-12 w-20 rounded bg-hero-foreground/10" />)}</div><span className="pb-1 text-sm text-hero-foreground/75">open tasks within your access</span></div>
      {tasks.isPending && <HomeRequestRowsSkeleton dark />}
      {tasks.error && <p role="alert" className="py-4 text-sm">Joining tasks could not load. Open the checklist to retry.</p>}
      {tasks.data?.items.length === 0 && <p className="py-3 text-sm text-hero-foreground/75">No open joining tasks in your scope.</p>}
      <ul className="divide-y divide-hero-foreground/15">{tasks.data?.items.slice(0, 3).map(t => <li key={t.id}><Link to="/manage/joining-tasks?tab=all" className="flex min-h-16 items-center gap-3 rounded-xl py-3 text-sm outline-none hover:bg-hero-foreground/5 focus-visible:ring-2 focus-visible:ring-gold"><ListChecks aria-hidden className="size-5 shrink-0 text-hero-foreground/75" /><div className="min-w-0 flex-1"><p className="font-medium">{t.employee.name}</p><p className="mt-1 text-hero-foreground/75">{t.name} · due {formatDate(t.dueDate)}</p></div>{t.overdue && <span className="text-xs text-gold">Overdue</span>}<ArrowRight aria-hidden className="size-4 shrink-0" /></Link></li>)}</ul>
      <p className="mt-4 text-xs text-hero-foreground/75">Earliest open tasks first. Open the checklist for the full queue.</p>
    </section>
  )
}

export function HomePreJoining() {
  const { ready } = useAccess()
  const candidates = useQuery({ ...orpc.candidates.list.queryOptions({ input: { status: 'ACCEPTED' } }), enabled: ready })
  const next = candidates.data?.toSorted((a, b) => a.proposedJoiningDate.getTime() - b.proposedJoiningDate.getTime()).slice(0, 3)
  return (
    <section className="home-panel min-w-0 p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-medium tracking-tight">Pre-joining</h2><Link to="/manage/onboarding" className="grid size-9 place-items-center rounded-full bg-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Open onboarding"><ArrowUpRight aria-hidden className="size-4" /></Link></div><p className="mt-1 text-xs text-muted-foreground">Accepted offers awaiting joining</p><div className={next?.length === 0 ? "mt-2 text-2xl font-light tabular-nums " : "mt-4 text-4xl font-light tabular-nums"}>{candidates.data?.length ?? (candidates.isError ? '—' : <Skeleton className="h-10 w-12 rounded" />)}</div><FormError error={candidates.error} />{candidates.isPending && <HomeRequestRowsSkeleton />}{next?.length === 0 && <p className="pt-1 text-sm text-muted-foreground ">No accepted offers awaiting joining.</p>}<ul className="mt-2 divide-y divide-border/60">{next?.map(c => <li key={c.id}><Link to={`/manage/onboarding/${c.id}`} className="flex min-h-16 items-center justify-between gap-2 rounded-xl py-3 outline-none hover:bg-surface-2/50 focus-visible:ring-2 focus-visible:ring-ring"><div className="min-w-0"><p className="text-sm font-medium">{[c.firstName, c.middleName, c.lastName].filter(Boolean).join(' ')}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(c.proposedJoiningDate)} · {c.company.code}</p></div>{c.proposedJoiningDate < todayDay() && <span className="text-xs text-warning-ink">Date passed</span>}</Link></li>)}</ul></section>
  )
}
