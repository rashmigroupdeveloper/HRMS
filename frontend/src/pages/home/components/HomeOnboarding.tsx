import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ListChecks } from 'lucide-react'
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
    <section className="home-panel min-w-0 p-4 sm:p-5">
      <h2 className="text-lg tracking-tight">Joining work</h2>
      <p className="mt-4 text-4xl font-light tabular-nums leading-none">{open ?? (tasks.isError ? '—' : <Skeleton className="h-10 w-12 rounded" />)}<span className="mt-1 block text-xs font-normal text-muted-foreground">open tasks</span></p>
      {tasks.isPending && <HomeRequestRowsSkeleton />}
      {tasks.error && <p role="alert" className="py-4 text-sm">Joining tasks could not load. Open the checklist to retry.</p>}
      {tasks.data?.items.length === 0 && <p className="py-3 text-sm text-muted-foreground">No open joining tasks in your scope.</p>}
      <ul className="mt-2 divide-y divide-border/60">{tasks.data?.items.slice(0, 3).map(t => <li key={t.id}><Link to="/manage/joining-tasks?tab=all" className="group flex min-h-14 items-center gap-3 rounded-xl py-2 text-sm outline-none transition-[background-color,scale] duration-100 hover:bg-surface-2/70 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.985] motion-reduce:active:scale-100"><ListChecks aria-hidden className="size-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="font-medium">{t.employee.name}</p><p className="mt-0.5 text-muted-foreground">{t.name} · due {formatDate(t.dueDate)}</p></div>{t.overdue && <span className="text-xs text-warning-ink">Overdue</span>}<ArrowRight aria-hidden className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" /></Link></li>)}</ul>
      <Link to="/manage/joining-tasks?tab=all" className="home-cta mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-medium">Open the checklist <ArrowRight aria-hidden className="size-4" /></Link>
    </section>
  )
}

export function HomePreJoining() {
  const { ready } = useAccess()
  const candidates = useQuery({ ...orpc.candidates.list.queryOptions({ input: { status: 'ACCEPTED' } }), enabled: ready })
  const next = candidates.data?.toSorted((a, b) => a.proposedJoiningDate.getTime() - b.proposedJoiningDate.getTime()).slice(0, 3)
  return (
    <section className="home-panel min-w-0 p-4 sm:p-5">
      <h2 className="text-lg tracking-tight">Pre-joining</h2>
      <p className="mt-4 text-4xl font-light tabular-nums leading-none">{candidates.data?.length ?? (candidates.isError ? '—' : <Skeleton className="inline-block h-10 w-12 rounded" />)}<span className="mt-1 block text-xs font-normal text-muted-foreground">accepted offers awaiting joining</span></p>
      <FormError error={candidates.error} />
      {candidates.isPending && <HomeRequestRowsSkeleton />}
      {next?.length === 0 && <p className="pt-3 text-sm text-muted-foreground">No accepted offers awaiting joining.</p>}
      <ul className="mt-2 divide-y divide-border/60">{next?.map(c => <li key={c.id}><Link to={`/manage/onboarding/${c.id}`} className="flex min-h-14 items-center justify-between gap-2 rounded-xl py-2 outline-none transition-colors hover:bg-surface-2/70 focus-visible:ring-2 focus-visible:ring-ring"><div className="min-w-0"><p className="text-sm font-medium">{[c.firstName, c.middleName, c.lastName].filter(Boolean).join(' ')}</p><p className="mt-0.5 text-xs text-muted-foreground">{formatDate(c.proposedJoiningDate)} · {c.company.code}</p></div>{c.proposedJoiningDate < todayDay() && <span className="text-xs text-warning-ink">Date passed</span>}</Link></li>)}</ul>
      <Link to="/manage/onboarding" className="home-cta mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-medium">Open onboarding <ArrowRight aria-hidden className="size-4" /></Link>
    </section>
  )
}
