import { ArrowUpRight, Building2, Users, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PAYROLL_DESK_TITLE, PAYROLL_STATE_LABELS } from '@/pages/payroll/components/payroll-labels'

// The two sections of PayrollDesk with only its month, counts and period replaced. Change both together.
export function PayrollDeskSkeleton() {
  return <section role="status" aria-label="Loading this pay period" className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
    <div className="min-w-0 px-1 py-3 sm:pr-7 sm:py-5">
      <div className="flex items-center justify-between gap-3"><Skeleton className="h-8 w-48" /><span className="rounded-full bg-surface-2 px-3 py-1 text-xs">{PAYROLL_DESK_TITLE}</span></div>
      <p className="mt-2 text-sm text-muted-foreground">Latest month on this page</p>
      <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-4">{[Building2, Users].map((Icon,i) => <div key={i} className="flex flex-col"><dt className="order-2 mt-2 text-sm text-muted-foreground">{i === 0 ? 'Companies' : 'People in these runs'}</dt><dd className="order-1 flex h-[42px] items-center gap-2"><Icon className="size-4 text-muted-foreground" aria-hidden /><Skeleton className="h-10 w-14" /></dd></div>)}</dl>
      <div className="mt-4 px-1"><div className="flex h-6 items-center"><Skeleton className="h-1.5 w-full rounded-full" /></div><div className="mt-1 flex justify-between gap-3"><Skeleton className="h-4 w-12" /><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-12" /></div></div>
    </div>
    <div className="flex min-w-0 flex-col justify-between rounded-[24px] bg-hero p-5 text-hero-foreground shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-[26px] font-light tracking-[-0.03em] sm:text-[32px]">Keep pay moving</h2><p className="mt-2 hidden text-sm text-hero-foreground/70 sm:block">From preparation to final approval</p></div><span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-hero-foreground text-hero"><ArrowUpRight className="size-5" aria-hidden /></span></div>
      <div className="mt-4 sm:mt-6"><Skeleton className="h-6 w-full rounded-full bg-hero-foreground/10 sm:h-10" /><dl className="mt-4 grid grid-cols-3 gap-3">{PAYROLL_STATE_LABELS.map(label => <div key={label} className="flex flex-col"><dt className="order-2 mt-2 text-xs text-hero-foreground/70">{label}</dt><dd><Skeleton className="order-1 h-7 w-10 bg-hero-foreground/10" /></dd></div>)}</dl></div>
      <p className="mt-4 text-xs text-hero-foreground/70">Status of the latest month’s runs on this page</p>
    </div>
  </section>
}

// The same company mark, row columns and pagination as PayrollPage; change both together.
export function PayrollRunsSkeleton({ label = 'Loading payroll runs' }: { label?: string }) {
  return <div role="status" aria-label={label} className="space-y-3">
    <div className="divide-y">{[0, 1, 2].map(i => <div key={i} className="grid min-h-24 items-center gap-3 px-2 py-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_4.5rem_11rem]">
      <div className="flex min-w-0 items-center gap-3"><Skeleton className="size-11 shrink-0 rounded-full bg-gold-soft" /><div><Skeleton className="h-7 w-40" /><Skeleton className="mt-1 h-5 w-48 max-w-full" /></div></div>
      <div><p className="text-xs text-muted-foreground">Pay period</p><Skeleton className="mt-1 h-5 w-44" /></div>
      <div><Skeleton className="h-7 w-10" /><p className="mt-1 text-xs text-muted-foreground">people</p></div>
      <div className="flex items-center justify-between gap-3 sm:justify-end"><Skeleton className="h-6 w-24 rounded-full" /><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background/80"><ArrowUpRight className="size-4" aria-hidden /></span></div>
    </div>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"><span className="flex items-center gap-1"><Skeleton className="h-4 w-4" />runs · page<Skeleton className="h-4 w-4" /></span><div className="flex gap-1"><Button size="sm" variant="secondary" className="min-h-9 rounded-full" disabled><ChevronLeft aria-hidden />Previous</Button><Button size="sm" variant="secondary" className="min-h-9 rounded-full" disabled>Next<ChevronRight aria-hidden /></Button></div></div>
  </div>
}
