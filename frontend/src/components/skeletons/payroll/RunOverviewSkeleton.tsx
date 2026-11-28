import { ArrowUpRight, Users, SlidersHorizontal, Flag } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { RUN_OVERVIEW_METRICS, RUN_MONEY_LABELS, RUN_PREPARATION_STEPS } from '@/pages/payroll/components/payroll-labels'

// Same containers, typography and labels as pages/payroll/components/RunOverview; change both together.
export function RunOverviewSkeleton({ label = 'Loading payroll summary' }: { label?: string }) {
  const icons = [Users, SlidersHorizontal, Flag, Users]
  return <div role="status" aria-label={label} className="space-y-5">
    <dl className="grid grid-cols-3 gap-x-4 gap-y-5 sm:max-w-xl">
      {RUN_OVERVIEW_METRICS.map((text, i) => { const Icon = icons[i]!; return <div key={text} className="flex min-w-0 flex-col"><dt className="order-2 mt-2 text-xs text-muted-foreground sm:text-sm">{text}</dt><dd className="order-1 flex h-[34px] items-center gap-2 sm:h-[42px]"><Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden /><Skeleton className="h-8 w-12 sm:h-10" /></dd></div> })}
    </dl>
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(19rem,1fr)]">
      <section className="min-w-0 rounded-[24px] bg-card p-5 shadow-card sm:p-6">
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-normal">Net pay</h2><Skeleton className="h-6 w-12 rounded-full" /></div>
        <Skeleton className="mt-4 h-[42px] w-52 max-w-full sm:h-14" /><Skeleton className="mt-3 h-5 w-72 max-w-full" />
        <dl className="mt-6 grid grid-cols-1 gap-3 border-t border-border/60 pt-4 min-[480px]:grid-cols-3">{RUN_MONEY_LABELS.map(text => <div key={text} className="flex items-baseline justify-between gap-3 min-[480px]:block"><dt className="text-xs text-muted-foreground">{text}</dt><dd className="mt-1"><Skeleton className="h-6 w-20" /></dd></div>)}</dl>
      </section>
      <section className="min-w-0 rounded-[24px] bg-hero p-5 text-hero-foreground shadow-card sm:p-6">
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-normal">Run progress</h2><span className="flex size-10 items-center justify-center rounded-full bg-hero-foreground/10"><ArrowUpRight className="size-5" aria-hidden /></span></div>
        <ol className="mt-3 divide-y divide-hero-foreground/15">{RUN_PREPARATION_STEPS.map(text => <li key={text} className="flex items-center gap-3 py-3"><Skeleton className="size-8 shrink-0 rounded-full bg-hero-foreground/10" /><div className="min-w-0"><p className="text-sm">{text}</p><Skeleton className="mt-0.5 h-4 w-40 max-w-full bg-hero-foreground/10" /></div></li>)}</ol>
      </section>
    </div>
  </div>
}
