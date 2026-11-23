import { ChevronRight } from 'lucide-react'
import { Pill } from '@/components/Pill'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

const NAME = ['w-24', 'w-16', 'w-20', 'w-28', 'w-14']
const DESCRIPTION = [['w-56', 'w-48'], ['w-60', 'w-52', 'w-32'], ['w-52', 'w-40'], ['w-56', 'w-56', 'w-24'], ['w-48']]
const AREA = ['w-20', 'w-24', 'w-16', 'w-28', 'w-20', 'w-24']

// Loading placeholder for the access grid of Roles & access, drawn like AccessGrid: its card with the real title,
// description (it depends on `canChange`) and legend, the table with the real "Role" and "Employees" headings (the area
// names come with the data - bars), per role its name, description and "Changed" line and per area the level picker
// (`canChange`, its None / View / Edit in real text, nothing chosen) or a pill; on a phone one block per role; and the
// "What View and Edit allow" line under it. `areas` = how many area columns.
export function AccessGridSkeleton({ rows = 5, areas = 8, canChange = false, label = 'Loading' }: { rows?: number; areas?: number; canChange?: boolean; label?: string }) {
  const cell = (key: number) =>
    canChange ? (
      <span key={key} className="inline-flex gap-0.5 rounded-full bg-card p-0.5 shadow-card">
        {['None', 'View', 'Edit'].map((choice) => (
          <span key={choice} className="flex h-9 items-center rounded-full px-3 text-xs text-muted-foreground md:h-7 md:px-2">
            {choice}
          </span>
        ))}
      </span>
    ) : (
      <Skeleton key={key} className="mx-auto h-6 w-14 rounded-full" />
    )
  return (
    <section role="status" aria-label={label} className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h2 className="text-lg font-light tracking-tight">Access grid</h2>
          <p className="text-xs text-muted-foreground">
            {canChange
              ? 'Pick a level to change it - it is saved at once and applies straight away to everyone with that role.'
              : 'What each role may do in each part of the system.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Pill tone="positive">Edit</Pill> see and change
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Pill tone="info">View</Pill> see only
          </span>
          <Pill tone="neutral">No access</Pill>
        </div>
      </div>

      {/* a phone: one block per role, its areas as a list */}
      <ul className="space-y-3 md:hidden">
        {Array.from({ length: Math.min(rows, 3) }, (_, r) => (
          <li key={r} className="rounded-2xl bg-surface-2/60 p-3">
            <RoleInfo r={r} />
            <Skeleton className="mt-1 h-3 w-20 rounded-full" />
            <ul className="mt-2 divide-y divide-border/70 border-t border-border/70">
              {Array.from({ length: areas }, (_, a) => (
                <li key={a} className="flex items-center justify-between gap-3 py-1">
                  <Skeleton className={cn('h-3.5 rounded-full', AREA[(r + a) % AREA.length])} />
                  {cell(a)}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <div className="max-md:hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-64 align-bottom text-xs text-muted-foreground">Role</TableHead>
              {Array.from({ length: areas }, (_, a) => (
                <TableHead key={a} className="w-30 min-w-30 px-1.5 py-1.5 align-bottom">
                  <span className="flex flex-col items-center gap-1">
                    {a % 2 === 0 && <Skeleton className="h-3 w-20 rounded-full" />}
                    <Skeleton className={cn('h-3 rounded-full', AREA[a % AREA.length])} />
                  </span>
                </TableHead>
              ))}
              <TableHead className="px-3 text-center align-bottom text-xs">Employees</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }, (_, r) => (
              <TableRow key={r} className="hover:bg-transparent">
                <TableCell className="min-w-64 py-1.5 align-top">
                  <RoleInfo r={r} />
                </TableCell>
                {Array.from({ length: areas }, (_, a) => (
                  <TableCell key={a} className="px-1.5 py-1.5 text-center">
                    {cell(a)}
                  </TableCell>
                ))}
                <TableCell className="text-center">
                  <Skeleton className="mx-auto h-3.5 w-4 rounded-full" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-2xl bg-surface-2 px-4 py-2 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
          What View and Edit allow in each area
        </p>
      </div>
    </section>
  )
}

// a role's name, description lines and "Changed ..." line, each as tall as its text
function RoleInfo({ r }: { r: number }) {
  return (
    <div className="max-w-64">
      <div className="flex h-7 items-center">
        <Skeleton className={cn('h-4 rounded-full', NAME[r % NAME.length])} />
      </div>
      {DESCRIPTION[r % DESCRIPTION.length]!.map((width, i) => (
        <div key={i} className="flex h-4 items-center">
          <Skeleton className={cn('h-3 max-w-full rounded-full', width)} />
        </div>
      ))}
      <div className="flex h-4 items-center">
        <Skeleton className="h-3 w-44 max-w-full rounded-full" />
      </div>
    </div>
  )
}
