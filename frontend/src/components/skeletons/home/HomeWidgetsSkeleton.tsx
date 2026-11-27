import { Skeleton } from '@/components/ui/skeleton'
import { MONTH_CLOSE_COUNTS, MOVEMENT_TILES, MY_DAY_NOTE, MY_DAY_TILES, WEEKDAY_SHORT } from '@/pages/home/components/home-labels'

// The home widgets' bodies while they load (2026-11-27) - each widget keeps its real title and links; these draw its
// rows, tiles and grid in the same places, with the fixed labels real and only the values as bars.

// HomeMyDay's card before attendance.overview answers (the page's first read)
export function HomeMyDaySkeleton() {
  return (
    <section role="status" aria-label="Loading your day" className="home-panel min-w-0 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium tracking-tight">My day</h2>
          <Skeleton className="mt-1.5 h-3 w-24 rounded" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {MY_DAY_TILES.map((label) => (
          <div key={label} className="rounded-2xl bg-surface-2/60 px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1.5"><Skeleton className="h-6 w-14 rounded" /></dd>
          </div>
        ))}
      </dl>
      <div className="mt-4">
        <div className="flex justify-between"><Skeleton className="h-3 w-32 rounded" /><Skeleton className="h-3 w-24 rounded" /></div>
        <Skeleton className="mt-2 h-2 w-full rounded-full" />
      </div>
      <Skeleton className="mt-3 h-4 w-40 rounded" />
      <div className="mt-4 border-t border-border/60 pt-3">
        <h3 className="text-sm font-medium">Needs your attention</h3>
        <HomeToFixSkeleton />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border/60 pt-3">
        <p className="flex min-h-9 items-center text-sm font-medium">Open my attendance</p>
        <p className="text-xs text-muted-foreground">{MY_DAY_NOTE}</p>
      </div>
    </section>
  )
}

// "Needs your attention": two day rows
export function HomeToFixSkeleton() {
  return (
    <div role="status" aria-label="Loading the days to fix" className="divide-y divide-border/60">
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="flex min-h-14 items-center justify-between gap-3 py-2">
          <div className="space-y-1.5"><Skeleton className="h-3.5 w-24 rounded" /><Skeleton className="h-3 w-40 rounded" /></div>
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      ))}
    </div>
  )
}

// "Coming holidays": the next one's box and two rows
export function HomeHolidaysSkeleton() {
  return (
    <div role="status" aria-label="Loading your holidays">
      <div className="mt-3 rounded-2xl bg-surface-2/60 p-3">
        <Skeleton className="h-3 w-24 rounded" />
        <Skeleton className="mt-2 h-6 w-40 rounded" />
        <Skeleton className="mt-2 h-4 w-28 rounded" />
      </div>
      <div className="mt-1 divide-y divide-border/60">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="flex min-h-12 items-center justify-between gap-3 py-2">
            <div className="space-y-1.5"><Skeleton className="h-3.5 w-32 rounded" /><Skeleton className="h-3 w-20 rounded" /></div>
            <Skeleton className="h-3 w-14 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

// "Away this week": the weekday heading real, three people's rows
export function HomeAwayWeekSkeleton() {
  return (
    <table role="status" aria-label="Loading who is away this week" className="mt-3 w-full table-fixed border-separate border-spacing-y-1 text-sm">
      <thead>
        <tr>
          <th className="w-28 sm:w-36" />
          {WEEKDAY_SHORT.map((d) => <th key={d} className="text-center text-xs font-normal text-muted-foreground">{d}</th>)}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 3 }, (_, i) => (
          <tr key={i}>
            <td className="pr-2"><Skeleton className="h-3.5 w-24 rounded" /></td>
            {WEEKDAY_SHORT.map((d) => <td key={d} className="px-0.5"><span className="mx-auto block h-6 max-w-10 rounded-md bg-surface-2/50" /></td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// "Attendance month": the month's name, its line, the bar and the three counts
export function HomeMonthCloseSkeleton() {
  return (
    <div role="status" aria-label="Loading the attendance month">
      <div className="mt-2 flex items-center gap-2"><Skeleton className="h-6 w-36 rounded" /><Skeleton className="h-6 w-20 rounded-full" /></div>
      <Skeleton className="mt-2 h-3 w-56 max-w-full rounded" />
      <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {MONTH_CLOSE_COUNTS.map((label) => (
          <div key={label} className="rounded-2xl bg-surface-2/60 px-3 py-2.5">
            <dt className="text-xs leading-tight text-muted-foreground">{label}</dt>
            <dd className="mt-1.5"><Skeleton className="h-6 w-8 rounded" /></dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// "Payroll runs": a company run's rows
export function HomePayrollSkeleton() {
  return (
    <div role="status" aria-label="Loading payroll runs" className="mt-1 divide-y divide-border/60">
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="flex min-h-14 items-center justify-between gap-3 py-2">
          <div className="space-y-1.5"><Skeleton className="h-3.5 w-36 rounded" /><Skeleton className="h-3 w-44 rounded" /></div>
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      ))}
    </div>
  )
}

// "Joiners & leavers": the two month tiles and the next rows
export function HomeMovementsSkeleton() {
  return (
    <div role="status" aria-label="Loading joiners and leavers">
      <dl className="mt-3 grid grid-cols-2 gap-2">
        {MOVEMENT_TILES.map((label) => (
          <div key={label} className="rounded-2xl bg-surface-2/60 px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1.5"><Skeleton className="h-6 w-8 rounded" /></dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-3 text-sm font-medium">Next 30 days</h3>
      <div className="divide-y divide-border/60">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="flex min-h-12 items-center justify-between gap-3 py-2">
            <div className="space-y-1.5"><Skeleton className="h-3.5 w-32 rounded" /><Skeleton className="h-3 w-40 rounded" /></div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
