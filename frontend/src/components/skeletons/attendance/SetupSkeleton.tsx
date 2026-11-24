import { Pencil, Search, Upload } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ROSTER_HINT, segment, SEGMENTS, SETUP_PARTS, UPLOAD_HINT, UPLOAD_TITLE, WEEKDAYS } from '@/pages/attendance/components/labels'

// Loading placeholder for the Attendance setup page below its title, while accounts.me says what the viewer may change:
// the setup's parts, then the asked part - Roster changes (its card), or Punches: the upload card and the earlier uploads
// (change both together)
export function SetupSkeleton({ part, label = 'Loading' }: { part?: string | null; label?: string }) {
  const roster = part === 'roster'
  return (
    <div role="status" aria-label={label} className="space-y-3">
      <div className={SEGMENTS}>
        {SETUP_PARTS.map(([value, name], i) => (
          <span key={value} className={segment(roster ? value === 'roster' : i === 0)}>
            {name}
          </span>
        ))}
      </div>
      {roster ? (
        <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-56 rounded-full" />
            <div className="relative w-full sm:w-auto">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-9 w-full rounded-full pl-9 sm:w-48" placeholder="Name or code" disabled />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{ROSTER_HINT}</p>
          <RosterRowsSkeleton />
        </section>
      ) : (
      <div className="space-y-4">
        <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
          <div>
            <h2 className="text-lg font-light tracking-tight">{UPLOAD_TITLE}</h2>
            <p className="max-w-prose text-sm text-muted-foreground">{UPLOAD_HINT}</p>
          </div>
          <div className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-foreground/25 px-4 py-3 text-center text-sm">
            <span className="flex items-center gap-2">
              <Upload className="size-4 text-muted-foreground" />
              The machines’ file - .xlsx or .csv
            </span>
            <span className="rounded-full bg-surface-2 px-4 py-1.5 text-sm font-medium text-muted-foreground">Choose file</span>
          </div>
        </section>
        <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
          <h2 className="text-lg font-light tracking-tight">Earlier uploads</h2>
          <UploadRowsSkeleton />
        </section>
      </div>
      )}
    </div>
  )
}

// The rows of "Earlier uploads" while they load - also drawn by the Punches part itself (change both together)
export function UploadRowsSkeleton({ label }: { label?: string }) {
  return (
    <ul className="divide-y" role={label ? 'status' : undefined} aria-label={label}>
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
          <Skeleton className="h-3.5 w-40 rounded-full" />
          <Skeleton className="h-3 w-64 max-w-full rounded-full" />
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
                <Skeleton className="h-3.5 w-10 rounded-full" />
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

// The rows of the Shifts list while they load, inside its real table (its real headings stay): a name and code, the time and the break, the Edit button (change both together - SetupView's Shifts)
export function ShiftRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <TableRow key={i} role="status" aria-label={i === 0 ? 'Loading the shifts' : undefined}>
          <TableCell>
            <span className="flex h-5 items-center gap-2">
              <Skeleton className={i % 2 ? 'h-3.5 w-20 rounded-full' : 'h-3.5 w-28 rounded-full'} />
              <Skeleton className="h-3 w-10 rounded-full" />
            </span>
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-24 rounded-full" />
          </TableCell>
          <TableCell className="hidden sm:table-cell">
            <Skeleton className="h-3.5 w-8 rounded-full" />
          </TableCell>
          <TableCell className="text-right">
            <span className="inline-flex h-8 items-center gap-1 px-3.5 text-xs text-muted-foreground">
              <Pencil className="size-3.5" /> Edit
            </span>
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

// The Schedule patterns list while it loads (change both together - SetupView's Patterns): the star, a name and length,
// the weeks of Monday-Sunday chips (the weekday names are real), the Edit button
export function PatternRowsSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <ul role="status" aria-label="Loading the schedule patterns" className="divide-y text-sm">
      {Array.from({ length: rows }, (_, r) => (
        <li key={r} className="flex flex-wrap items-start gap-x-3 gap-y-2 py-3">
          <span className="grid size-7 shrink-0 place-items-center">
            <Skeleton className="size-4 rounded-full" />
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <span className="flex h-5 items-center gap-2">
              <Skeleton className={r % 2 ? 'h-3.5 w-24 rounded-full' : 'h-3.5 w-36 rounded-full'} />
              <Skeleton className="h-3 w-12 rounded-full" />
            </span>
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
                      <Skeleton className="h-6 min-w-11 rounded-md" />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <span className="inline-flex h-8 items-center gap-1 px-3.5 text-xs text-muted-foreground">
            <Pencil className="size-3.5" /> Edit
          </span>
        </li>
      ))}
    </ul>
  )
}

// The rows of the Attendance policies list while they load, inside its real table (its real headings stay): a name, the
// grace, full / half day, the late rules, the Edit button (change both together - PoliciesSetup)
export function PolicyRowsSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <TableRow key={i} role="status" aria-label={i === 0 ? 'Loading the policies' : undefined}>
          <TableCell>
            <Skeleton className={i % 2 ? 'h-3.5 w-20 rounded-full' : 'h-3.5 w-28 rounded-full'} />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-8 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-24 rounded-full" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <Skeleton className="h-3 w-40 rounded-full" />
          </TableCell>
          <TableCell className="text-right">
            <span className="inline-flex h-8 items-center gap-1 px-3.5 text-xs text-muted-foreground">
              <Pencil className="size-3.5" /> Edit
            </span>
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

// The rows of "Who follows what" while they load, inside its real table (its real headings stay): a name, code and place,
// the tick box, the pattern, the policy, the holiday list, since, next change, the Change button (change both together - SetupView's ScheduleList)
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
            <span className="flex h-5 items-center gap-2">
              <Skeleton className={i % 2 ? 'h-3.5 w-28 rounded-full' : 'h-3.5 w-36 rounded-full'} />
              <Skeleton className="h-3 w-16 rounded-full" />
            </span>
            <Skeleton className="mt-1 h-3 w-24 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-24 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-20 rounded-full" />
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
              <span className="inline-flex h-8 items-center gap-1 px-3.5 text-xs text-muted-foreground">
                <Pencil className="size-3.5" /> Change
              </span>
            </TableCell>
          )}
        </TableRow>
      ))}
    </>
  )
}
