import { Pencil, Trash2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { TableCell, TableRow } from '@/components/ui/table'

// The rows of the setup's holidays, holiday lists, categories and plants' default lists while they load, inside their real
// tables / lists (their real headings stay) - change both together with HolidayListsSetup / SetupView's Holidays

const EditLabel = () => (
  <span className="inline-flex h-8 items-center gap-1 px-3.5 text-xs text-muted-foreground">
    <Pencil className="size-3.5" /> Edit
  </span>
)

// Holiday lists: the name, the company, the plants it is the default of, Edit
export function HolidayListRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <TableRow key={i} role="status" aria-label={i === 0 ? 'Loading the holiday lists' : undefined}>
          <TableCell>
            <Skeleton className={i % 2 ? 'h-3.5 w-20 rounded-full' : 'h-3.5 w-28 rounded-full'} />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-12 rounded-full" />
          </TableCell>
          <TableCell className="hidden sm:table-cell">
            <Skeleton className="h-3 w-24 rounded-full" />
          </TableCell>
          <TableCell className="text-right">
            <EditLabel />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

// The setup's Holidays list: a date, a name, the category pill and the lists, Edit / Remove for those who may change it
// (change both together with HolidaysSetup)
export function HolidayRowsSkeleton({ rows = 4, canChange }: { rows?: number; canChange: boolean }) {
  return (
    <ul className="divide-y text-sm" role="status" aria-label="Loading the holidays">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span className="flex items-center gap-2 py-1.5">
            <Skeleton className="h-3.5 w-20 rounded-full" />
            <Skeleton className={i % 2 ? 'h-3.5 w-24 rounded-full' : 'h-3.5 w-32 rounded-full'} />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-3 w-28 rounded-full" />
          </span>
          {canChange && (
            <span className="flex gap-1 text-xs text-muted-foreground">
              <EditLabel />
              <span className="inline-flex h-8 items-center gap-1 px-3.5">
                <Trash2 className="size-3.5" /> Remove
              </span>
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

// Holiday categories: a coloured pill each, Edit
export function HolidayCategoryRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="divide-y" role="status" aria-label="Loading the holiday categories">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center justify-between gap-2 py-1.5">
          <Skeleton className={i % 2 ? 'h-6 w-20 rounded-full' : 'h-6 w-24 rounded-full'} />
          <EditLabel />
        </li>
      ))}
    </ul>
  )
}

// The line over the plants' table: "N of M plants have a default list"
export function PlantCoverageSkeleton() {
  return (
    <p className="flex h-4 items-center">
      <Skeleton className="h-3 w-48 rounded-full" />
    </p>
  )
}

// The strip "N employees have no holiday list" while it is counted (it stays away when nobody is without one)
export function FillMissingSkeleton() {
  return <Skeleton className="h-11 w-full rounded-2xl" />
}

// Plants' default lists: the plant, its company, the default list, Edit
export function PlantDefaultRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <TableRow key={i} role="status" aria-label={i === 0 ? "Loading the plants' default lists" : undefined}>
          <TableCell className="space-y-1.5">
            <Skeleton className="h-3.5 w-16 rounded-full" />
            <Skeleton className="h-3 w-28 rounded-full" />
          </TableCell>
          <TableCell className="hidden sm:table-cell">
            <Skeleton className="h-3.5 w-12 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-24 rounded-full" />
          </TableCell>
          <TableCell className="text-right">
            <EditLabel />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
