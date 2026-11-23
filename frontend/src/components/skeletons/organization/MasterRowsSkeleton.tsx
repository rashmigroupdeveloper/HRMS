import { Archive, Pencil } from 'lucide-react'
import { Fragment } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

const TITLE = ['w-36', 'w-28', 'w-44', 'w-24', 'w-32', 'w-40']
const CELL = ['w-20', 'w-48', 'w-16', 'w-28', 'w-24', 'w-36']
// a short value (a code, a number) and a long one (a name, an address)
const SHORT = ['w-10', 'w-16', 'w-12', 'w-20']
const LONG = ['w-64', 'w-48', 'w-72', 'w-56']

// Loading placeholder for an organization master's rows (MasterSection), drawn like the view the master uses:
// - 'table': the real table with the real column `headings` (`wide`: the columns of long text - longer bars), `grouped`
//   adds the company heading rows, `actions` the pencil and retire icons on the right
// - 'list': the bordered entries in up to four columns (`grouped`: under heading lines); 'dense': one-line entries
//   flowing down the columns
// - 'split': the entries on the left (the first one picked, dark) and the picked entry's card on the right (with
//   `actions` its Change / Retire buttons, disabled)
export function MasterRowsSkeleton({
  view,
  headings = [],
  wide = [],
  grouped = false,
  actions = false,
  label = 'Loading',
}: {
  view: 'table' | 'list' | 'dense' | 'split'
  headings?: string[]
  wide?: boolean[]
  grouped?: boolean
  actions?: boolean
  label?: string
}) {
  if (view === 'table')
    return (
      <div role="status" aria-label={label}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {headings.map((heading) => (
                <TableHead key={heading} className="h-8 text-xs text-muted-foreground">
                  {heading}
                </TableHead>
              ))}
              {actions && <TableHead className="h-8" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }, (_, r) => (
              <Fragment key={r}>
                {grouped && r % 3 === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={headings.length + (actions ? 1 : 0)} className="bg-surface-2/50 py-1.5">
                      <span className="flex h-4 items-center gap-2">
                        <Skeleton className="h-3 w-10 rounded-full" />
                        <Skeleton className="h-3 w-36 rounded-full" />
                      </span>
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="hover:bg-transparent">
                  {headings.map((heading, i) => (
                    <TableCell key={heading} className="py-2">
                      <span className="flex h-7 items-center">
                        <Skeleton className={cn('h-3.5 rounded-full', i === 0 ? TITLE[r % TITLE.length] : (wide[i] ? LONG : SHORT)[(r + i) % 4])} />
                      </span>
                    </TableCell>
                  ))}
                  {actions && (
                    <TableCell className="py-1 text-right">
                      <span className="flex justify-end gap-0.5 text-muted-foreground/50">
                        <span className="grid size-8 place-items-center">
                          <Pencil className="size-4" />
                        </span>
                        <span className="grid size-8 place-items-center">
                          <Archive className="size-4" />
                        </span>
                      </span>
                    </TableCell>
                  )}
                </TableRow>
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    )

  if (view === 'dense')
    return (
      <ul role="status" aria-label={label} className="gap-x-4 sm:columns-2 lg:columns-3 xl:columns-4">
        {Array.from({ length: 40 }, (_, i) => (
          <li key={i} className="flex min-h-8 break-inside-avoid items-center px-2 py-1 max-sm:min-h-10">
            <Skeleton className={cn('h-3.5 rounded-full', ['w-16', 'w-28', 'w-20', 'w-36', 'w-12', 'w-24', 'w-32'][(i * 3) % 7])} />
          </li>
        ))}
      </ul>
    )

  if (view === 'list')
    return (
      <div role="status" aria-label={label} className="space-y-3">
        {(grouped ? [4, 4] : [8]).map((entries, g) => (
          <section key={g} className="space-y-1.5">
            {grouped && (
              <div className="flex h-4 items-center gap-2 after:h-px after:flex-1 after:bg-border">
                <Skeleton className="h-3 w-40 rounded-full" />
              </div>
            )}
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: entries }, (_, i) => (
                <li key={i} className="flex min-h-11 flex-col justify-center gap-1.5 rounded-xl border border-border/70 py-2 pr-1 pl-2.5">
                  <Skeleton className={cn('h-3.5 rounded-full', TITLE[(g + i) % TITLE.length])} />
                  <Skeleton className="h-3 w-10 rounded-full" />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    )

  // split: the entries, then the picked one's card (on a phone under its row, as the real SplitView)
  return (
    <div role="status" aria-label={label} className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
      <ul className="space-y-1">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i}>
            <div className={cn('flex items-center gap-2.5 rounded-2xl px-2.5 py-2', i === 0 && 'bg-hero shadow-card')}>
              <Skeleton className={cn('h-8 w-12 shrink-0 rounded-full', i === 0 && 'bg-hero-foreground/10')} />
              <span className="min-w-0 flex-1">
                <span className="flex h-5 items-center">
                  <Skeleton className={cn('h-3.5 rounded-full', TITLE[i % TITLE.length], i === 0 && 'bg-hero-foreground/10')} />
                </span>
                <span className="flex h-4 items-center">
                  <Skeleton className={cn('h-3 w-16 rounded-full', i === 0 && 'bg-hero-foreground/10')} />
                </span>
              </span>
            </div>
            {i === 0 && (
              <div className="mt-1 mb-2 rounded-2xl border border-border/70 p-3 lg:hidden">
                <PickedCard actions={actions} />
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="border-l border-border/70 pl-5 max-lg:hidden">
        <PickedCard actions={actions} />
      </div>
    </div>
  )
}

// The picked entry's card: a header (with `actions` its Change / Retire buttons, disabled) and two boxes of label / value
// pairs - its own labels are the page's, so bars
function PickedCard({ actions }: { actions: boolean }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-10 w-14 rounded-full" />
        <div className="min-w-44 flex-1 space-y-1.5">
          <Skeleton className="h-4.5 w-56 max-w-full rounded-full" />
          <Skeleton className="h-3 w-36 rounded-full" />
        </div>
        {actions && (
          <div className="flex shrink-0 gap-0.5">
            <Button variant="secondary" size="sm" className="max-sm:h-9" disabled>
              <Pencil /> Change
            </Button>
            <Button variant="ghost" size="sm" className="max-sm:h-9" disabled>
              <Archive /> Retire
            </Button>
          </div>
        )}
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {[4, 3].map((pairs, b) => (
          <div key={b} className="space-y-3 rounded-2xl border border-border/70 p-3">
            <Skeleton className="h-3.5 w-28 rounded-full" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {Array.from({ length: pairs }, (_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-20 rounded-full" />
                  <Skeleton className={cn('h-3.5 max-w-full rounded-full', CELL[(b + i) % CELL.length])} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
