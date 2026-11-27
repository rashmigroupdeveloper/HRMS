import { ChevronLeft, ChevronRight, FileSpreadsheet, History, Pencil, Search, Upload } from 'lucide-react'
import { ExportButton } from '@/components/ExportButton'
import { PillTabsList, PillTabsTrigger } from '@/components/PillTabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs } from '@/components/ui/tabs'
import { FILTER_SEARCH, ROSTER_HINT, ROSTER_SUMMARY, SETUP_ICONS, SETUP_PARTS, UPLOAD_HINT, UPLOAD_SUMMARY, UPLOAD_TITLE, WEEKDAYS } from '@/pages/attendance/components/labels'
import { SetupCard } from '@/pages/attendance/components/SetupCard'

// An Edit / Change button of a row, as an icon (the rows' real button - change both together)
export function RowEditIcon() {
  return (
    <span className="inline-grid size-8 place-items-center text-muted-foreground">
      <Pencil className="size-4" />
    </span>
  )
}

// the cards' Export button, disabled until the data is there (it is never clicked)
const notYet = () => Promise.reject(new Error('Still loading'))

// Loading placeholder for the Attendance setup page below its title, while accounts.me says what the viewer may change:
// the setup's tabs, then the asked part - Roster changes (its card), or Punches: the dark upload card and the earlier
// uploads beside it (change both together with SetupView / RosterView)
export function SetupSkeleton({ part, label = 'Loading' }: { part?: string | null; label?: string }) {
  const roster = part === 'roster'
  return (
    <div role="status" aria-label={label} className="space-y-3">
      <Tabs value={roster ? 'roster' : 'punches'}>
        <PillTabsList aria-label="Parts of the attendance setup">
          {SETUP_PARTS.map(([value, name]) => {
            const Icon = SETUP_ICONS[value]
            return (
              <PillTabsTrigger key={value} value={value} className="gap-1.5">
                <Icon aria-hidden className="size-4" />
                {name}
              </PillTabsTrigger>
            )
          })}
        </PillTabsList>
      </Tabs>
      {roster ? (
        <SetupCard icon={SETUP_ICONS.roster} title="Roster changes" summary={ROSTER_SUMMARY} hint={ROSTER_HINT} action={<ExportButton disabled load={notYet} />}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-full bg-surface-2 p-0.5">
              <span className="grid size-8 place-items-center">
                <ChevronLeft className="size-4" />
              </span>
              <Skeleton className="mx-1 h-3.5 w-48 rounded-full" />
              <span className="grid size-8 place-items-center">
                <ChevronRight className="size-4" />
              </span>
            </div>
            <div className="relative w-full sm:w-auto">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className={`${FILTER_SEARCH} w-full sm:w-48`} placeholder="Name or code" disabled />
            </div>
          </div>
          <RosterRowsSkeleton />
        </SetupCard>
      ) : (
        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <SetupCard dark icon={Upload} title={UPLOAD_TITLE} summary={UPLOAD_SUMMARY} hint={UPLOAD_HINT}>
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-hero-foreground/25 p-3 text-sm">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-hero-foreground/10">
                <FileSpreadsheet aria-hidden className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">The machines’ file</span>
                <span className="block text-xs text-hero-muted">.xlsx or .csv</span>
              </span>
              <span className="shrink-0 rounded-full bg-hero-foreground/10 px-4 py-2 text-sm font-medium text-hero-muted">Choose file</span>
            </div>
          </SetupCard>
          <SetupCard icon={History} title="Earlier uploads" summary="Who uploaded which file, and what it added" action={<ExportButton disabled load={notYet} />}>
            <UploadRowsSkeleton />
          </SetupCard>
        </div>
      )}
    </div>
  )
}

// The rows of "Earlier uploads" while they load - also drawn by the Punches part itself (change both together): the file
// icon, the name and who uploaded it, what it added as pills
export function UploadRowsSkeleton({ label }: { label?: string }) {
  return (
    <ul className="divide-y divide-border/60" role={label ? 'status' : undefined} aria-label={label}>
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2">
            <FileSpreadsheet aria-hidden className="size-4 text-muted-foreground" />
          </span>
          <span className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className={i % 2 ? 'h-3.5 w-32 rounded-full' : 'h-3.5 w-44 rounded-full'} />
            <Skeleton className="h-3 w-56 max-w-full rounded-full" />
          </span>
          <span className="flex gap-1 max-sm:w-full max-sm:pl-12">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </span>
        </li>
      ))}
    </ul>
  )
}

// The roster's changed days while they load: its real headings over a few rows (RosterView, the setup's Roster changes)
export function RosterRowsSkeleton({ label }: { label?: string }) {
  return (
    <div role={label ? 'status' : undefined} aria-label={label}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-28">Day</TableHead>
            <TableHead>Employee</TableHead>
            <TableHead className="hidden sm:table-cell">Default</TableHead>
            <TableHead>Changed to</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 3 }, (_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-3.5 w-20 rounded-full" />
              </TableCell>
              <TableCell className="space-y-1.5">
                <Skeleton className="h-3.5 w-32 rounded-full" />
                <Skeleton className="h-3 w-20 rounded-full" />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Skeleton className="h-3 w-10 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-9 rounded-lg" />
              </TableCell>
              <TableCell>
                <Skeleton className="ml-auto h-5 w-18 rounded-full" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// The rows of the Shifts list while they load, inside its real table (its real headings stay): the code chip and name,
// the time, the bar over the day, the break, the Edit icon (change both together - SetupView's Shifts)
export function ShiftRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <TableRow key={i} role="status" aria-label={i === 0 ? 'Loading the shifts' : undefined}>
          <TableCell>
            <span className="flex items-center gap-2.5">
              <Skeleton className="h-6 w-9 rounded-lg" />
              <Skeleton className={i % 2 ? 'h-3.5 w-20 rounded-full' : 'h-3.5 w-28 rounded-full'} />
            </span>
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-24 rounded-full" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <span className="block h-1.5 w-full rounded-full bg-surface-2" />
          </TableCell>
          <TableCell className="hidden sm:table-cell">
            <Skeleton className="h-3.5 w-12 rounded-full" />
          </TableCell>
          <TableCell className="text-right">
            <RowEditIcon />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

// The Schedule patterns while they load (change both together - SetupView's Patterns): tiles with the star, a name and
// length, the Edit icon, a week of Monday-Sunday chips (the weekday names are real)
export function PatternRowsSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <ul role="status" aria-label="Loading the schedule patterns" className="grid gap-2 text-sm lg:grid-cols-2">
      {Array.from({ length: rows }, (_, r) => (
        <li key={r} className="min-w-0 space-y-2 rounded-2xl bg-surface-2/60 p-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center">
              <Skeleton className="size-4 rounded-full" />
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <Skeleton className={r % 2 ? 'h-3.5 w-24 rounded-full' : 'h-3.5 w-36 rounded-full'} />
              <Skeleton className="h-3 w-12 rounded-full" />
            </span>
            <RowEditIcon />
          </div>
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  {WEEKDAYS.map((w) => (
                    <th key={w.key} className="px-0.5 pb-1 text-center font-normal text-muted-foreground">
                      {w.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {WEEKDAYS.map((w) => (
                    <td key={w.key} className="p-0.5">
                      <Skeleton className="h-6 min-w-11 rounded-lg" />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </li>
      ))}
    </ul>
  )
}

// The rows of the Attendance policies list while they load, inside its real table (its real headings stay): a name, the
// grace, full / half day, the late rules as pills, the Edit icon (change both together - PoliciesSetup)
export function PolicyRowsSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <TableRow key={i} role="status" aria-label={i === 0 ? 'Loading the policies' : undefined}>
          <TableCell>
            <Skeleton className={i % 2 ? 'h-3.5 w-20 rounded-full' : 'h-3.5 w-28 rounded-full'} />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-12 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-24 rounded-full" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <span className="flex gap-1">
              <Skeleton className="h-6 w-36 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </span>
          </TableCell>
          <TableCell className="text-right">
            <RowEditIcon />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

// The rows of Schedules while they load, inside its real table (its real headings stay): the tick box, the initial, a
// name, code and place, the pattern, the policy, attendance (tracked or not), the holiday list, since, next change, the
// Change icon (change both together - SetupView's Schedules)
export function ScheduleRowsSkeleton({ rows = 6, change = false }: { rows?: number; change?: boolean }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <TableRow key={i} role="status" aria-label={i === 0 ? 'Loading who follows what' : undefined}>
          {change && (
            <TableCell>
              <Checkbox disabled aria-hidden />
            </TableCell>
          )}
          <TableCell>
            <span className="flex items-center gap-2.5">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <span className="min-w-0 space-y-1.5">
                <span className="flex items-center gap-2">
                  <Skeleton className={i % 2 ? 'h-3.5 w-28 rounded-full' : 'h-3.5 w-36 rounded-full'} />
                  <Skeleton className="h-3 w-16 rounded-full" />
                </span>
                <Skeleton className="h-3 w-24 rounded-full" />
              </span>
            </span>
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-24 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-20 rounded-full" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <Skeleton className="h-3.5 w-16 rounded-full" />
          </TableCell>
          <TableCell className="hidden sm:table-cell">
            <Skeleton className="h-3.5 w-24 rounded-full" />
          </TableCell>
          <TableCell className="hidden sm:table-cell">
            <Skeleton className="h-3.5 w-20 rounded-full" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <Skeleton className="h-3.5 w-8 rounded-full" />
          </TableCell>
          {change && (
            <TableCell className="text-right">
              <RowEditIcon />
            </TableCell>
          )}
        </TableRow>
      ))}
    </>
  )
}
