import { Skeleton } from '@/components/ui/skeleton'
import { MONTH_CLOSE_COUNTS, MONTH_STRIP, MOVEMENT_TILES, MY_DAY_TILES, WEEKDAY_SHORT } from '@/pages/home/components/home-labels'

// The home widgets' bodies while they load (2026-11-27) - each widget keeps its real title and links; these draw its
// rows, tiles and grid in the same places, with the fixed labels real and only the values as bars.

// HomeToday's card before attendance.overview answers (the page's first read): the title, the ring, the facts beside it
export function HomeTodaySkeleton() {
  return (
    <section role="status" aria-label="Loading your day" className="home-panel flex min-w-0 flex-col p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-xl font-light tracking-tight">Today</h2><Skeleton className="mt-1.5 h-3 w-20 rounded" /></div>
        <div className="flex items-center gap-2"><Skeleton className="h-6 w-16 rounded-full" /><span className="size-9 rounded-full bg-surface-2" /></div>
      </div>
      <div className="mt-3 flex flex-1 items-center gap-5">
        <div className="grid size-32 shrink-0 place-items-center rounded-full border-2 border-dotted border-foreground/15"><Skeleton className="h-7 w-16 rounded" /></div>
        <dl className="min-w-0 flex-1 divide-y divide-border/60">
          {[MY_DAY_TILES[1], MY_DAY_TILES[2], 'Late'].map((label) => (
            <div key={label} className="flex items-baseline justify-between gap-3 py-2"><dt className="text-xs text-muted-foreground">{label}</dt><dd><Skeleton className="h-5 w-12 rounded" /></dd></div>
          ))}
        </dl>
      </div>
      <Skeleton className="mt-3 h-3 w-48 rounded" />
    </section>
  )
}

// "My week": the bars of seven days (also inside HomeWeek while the days load)
export function HomeWeekBarsSkeleton() {
  return (
    <div role="status" aria-label="Loading your week" className="mt-auto grid grid-cols-7 items-end gap-1 pt-4">
      {WEEKDAY_SHORT.map((d, i) => (
        <div key={d} className="flex flex-col items-center gap-1.5">
          <div className="flex h-28 w-full items-end justify-center"><Skeleton className="w-2 rounded-full" style={{ height: `${[70, 82, 64, 90, 40, 22, 22][i]}%` }} /></div>
          <span className="size-1.5 rounded-full bg-foreground/15" />
          <span className="text-xs text-muted-foreground">{d[0]}</span>
        </div>
      ))}
    </div>
  )
}
// the whole "My week" card before attendance.overview answers
export function HomeWeekSkeleton() {
  return (
    <section className="home-panel flex min-w-0 flex-col p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3"><h2 className="text-xl font-light tracking-tight">My week</h2><span className="size-9 rounded-full bg-surface-2" /></div>
      <div className="mt-2 flex items-end gap-3"><Skeleton className="h-11 w-24 rounded" /><span className="pb-1 text-xs text-muted-foreground">Worked this week</span></div>
      <HomeWeekBarsSkeleton />
    </section>
  )
}

// The attendance month's strip under the greeting: its part names real, the parts as grey pills
export function HomeStripSkeleton({ parts = MONTH_STRIP }: { parts?: readonly string[] }) {
  return (
    <div role="status" aria-label="Loading the strip" className="min-w-0">
      <Skeleton className="mb-2 h-3 w-56 rounded" />
      <div className="flex w-full gap-1.5">
        {parts.map((label, i) => (
          <div key={label} className="min-w-[52px]" style={{ flex: `${[6, 1, 1, 2, 10][i] ?? 2} 1 0%` }}>
            <p className="mb-1.5 truncate text-xs text-muted-foreground">{label}</p>
            <Skeleton className="h-11 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// "Needs your attention": two day rows (an icon chip, the day, the hint)
export function HomeToFixSkeleton() {
  return (
    <div role="status" aria-label="Loading the days to fix" className="mt-3 space-y-1">
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="flex min-h-14 items-center gap-3 py-1.5">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-36 rounded" /><Skeleton className="h-3 w-44 rounded" /></div>
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
      <Skeleton className="mt-3 h-6 w-28 rounded-full" />
      <Skeleton className="mt-2 h-3 w-56 max-w-full rounded" />
      <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
      <dl className="mt-4 grid grid-cols-3 gap-x-3">
        {MONTH_CLOSE_COUNTS.map((label) => (
          <div key={label} className="px-1">
            <dt className="text-xs leading-tight text-muted-foreground">{label}</dt>
            <dd className="mt-2"><Skeleton className="h-8 w-8 rounded" /></dd>
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
      <dl className="mt-4 grid grid-cols-2 gap-x-6">
        {MOVEMENT_TILES.map((label) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-2"><Skeleton className="h-10 w-10 rounded" /></dd>
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
