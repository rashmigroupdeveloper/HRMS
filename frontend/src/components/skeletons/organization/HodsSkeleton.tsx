import { ArrowRightLeft, ChevronDown, Ellipsis, History, MapPinned, UserMinus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const NAME = ['w-32', 'w-28', 'w-36', 'w-24']
const SUMMARY = ['w-24', 'w-36', 'w-28', 'w-32']
const CHIP = ['w-40', 'w-52', 'w-32', 'w-44']

// Loading placeholder for the Organization page's "Department heads" tab, drawn like the loaded view:
// - 'hods': the HODs on the left (initials, name, what they head, the employee count - the first one picked, dark) and
//   the picked one on the right (name, facts, the buttons in real text - disabled; `canEdit` adds the changing ones -
//   and a company box of plants with department chips); on a phone the list only
// - 'places': the places map - per company its heading row and per plant a row of HOD chips
export function HodsSkeleton({ view, canEdit = false, label = 'Loading' }: { view: 'hods' | 'places'; canEdit?: boolean; label?: string }) {
  if (view === 'places')
    return (
      <div role="status" aria-label={label} className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70">
        {[3, 2].map((plants, c) => (
          <div key={c}>
            <div className="flex items-center gap-2 bg-surface-2/40 px-3 py-2">
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              <Skeleton className="h-4 w-10 rounded-full" />
              <span className="min-w-0 flex-1">
                <Skeleton className="h-3 w-40 max-w-full rounded-full" />
              </span>
              <Skeleton className="h-3 w-28 rounded-full" />
            </div>
            <ul className="divide-y divide-border/60 border-t border-border/60">
              {Array.from({ length: plants }, (_, p) => (
                <li key={p} className="grid grid-cols-[minmax(0,1fr)] gap-x-3 gap-y-1.5 px-3 py-2 sm:grid-cols-[minmax(8rem,13rem)_minmax(0,1fr)]">
                  <span className="flex h-7 items-center">
                    <Skeleton className={cn('h-3 rounded-full', SUMMARY[(c + p) % 4])} />
                  </span>
                  <span className="flex min-w-0 flex-wrap items-center gap-1">
                    {Array.from({ length: 1 + ((c + p) % 3) }, (_, i) => (
                      <Skeleton key={i} className={cn('h-7 rounded-full', CHIP[(c + p + i) % 4])} />
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    )

  return (
    <div role="status" aria-label={label} className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
      <ul className="space-y-1">
        {Array.from({ length: 4 }, (_, i) => {
          const on = i === 0
          const tint = on && 'bg-hero-foreground/10'
          return (
            <li key={i}>
              <div className={cn('flex items-center gap-2.5 rounded-2xl px-2.5 py-2', on && 'bg-hero text-hero-foreground shadow-card')}>
                <Skeleton className={cn('size-8 shrink-0 rounded-full', tint)} />
                <span className="min-w-0 flex-1">
                  <span className="flex h-5 items-center">
                    <Skeleton className={cn('h-3.5 rounded-full', NAME[i % 4], tint)} />
                  </span>
                  <span className="flex h-4 items-center">
                    <Skeleton className={cn('h-3 rounded-full', SUMMARY[i % 4], tint)} />
                  </span>
                </span>
                <span className={cn('flex shrink-0 items-center gap-1', on ? 'text-hero-foreground' : 'text-muted-foreground')}>
                  <Users className="size-3.5" />
                  <Skeleton className={cn('h-3 w-3 rounded-full', tint)} />
                </span>
              </div>
              {/* a phone: the picked one's places open under them */}
              {on && (
                <div className="mt-1 mb-2 space-y-3 rounded-2xl border border-border/70 p-3 lg:hidden">
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-full max-w-72 rounded-full" />
                    <Skeleton className="h-3 w-24 rounded-full" />
                  </div>
                  <Actions canEdit={canEdit} />
                  <PlacesBox />
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <div className="space-y-3 border-l border-border/70 pl-5 max-lg:hidden">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <div className="flex h-6 items-center gap-2">
              <Skeleton className="h-4 w-36 rounded-full" />
              <Skeleton className="h-3 w-16 rounded-full" />
            </div>
            <div className="flex h-4 items-center">
              <Skeleton className="h-3 w-72 max-w-full rounded-full" />
            </div>
          </div>
          <Actions canEdit={canEdit} />
        </div>
        <PlacesBox />
      </div>
    </div>
  )
}

// The coverage strip while the places and gaps load: the empty bar, the share line and the three gap counters
export function CoverageStripSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-surface-2/60 px-3 py-2">
      <div className="flex min-w-56 flex-1 items-center gap-3">
        <span className="h-2 w-full max-w-48 rounded-full bg-border" />
        <span className="flex h-4 shrink-0 items-center">
          <Skeleton className="h-3 w-52 rounded-full" />
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 max-sm:hidden">
        {['w-32', 'w-36', 'w-36'].map((width, i) => (
          <span key={i} className="flex h-6 items-center px-2.5">
            <Skeleton className={cn('h-3 rounded-full', width)} />
          </span>
        ))}
      </div>
    </div>
  )
}

// The picked HOD's buttons in real text, disabled until the HODs arrive - as HodDetail: below a wide screen History and
// End sit behind "…"
function Actions({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {canEdit && (
        <>
          <Button variant="secondary" size="sm" className="max-sm:h-9" disabled>
            <MapPinned /> Change places
          </Button>
          <Button variant="secondary" size="sm" className="max-sm:h-9" disabled>
            <ArrowRightLeft /> Hand over
          </Button>
        </>
      )}
      <Button variant="ghost" size="sm" className={cn('max-sm:h-9', canEdit && 'max-lg:hidden')} disabled>
        <History /> History
      </Button>
      {canEdit && (
        <>
          <Button variant="ghost" size="sm" className="text-negative-ink max-lg:hidden" disabled>
            <UserMinus /> End
          </Button>
          <Button variant="ghost" size="sm" className="max-sm:h-9 lg:hidden" aria-label="More" disabled>
            <Ellipsis />
          </Button>
        </>
      )}
    </div>
  )
}

// A company box of the picked HOD's places: its heading, then per plant the department chips
function PlacesBox() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70">
      <div className="flex items-center gap-2 bg-surface-2/40 px-3 py-1.5">
        <Skeleton className="h-4 w-10 rounded-full" />
        <span className="min-w-0 flex-1">
          <Skeleton className="h-3 w-40 max-w-full rounded-full" />
        </span>
        <Skeleton className="h-3 w-24 rounded-full" />
      </div>
      <ul className="divide-y divide-border/60 border-t border-border/60">
        {['w-20', 'w-24'].map((plant, p) => (
          <li key={p} className="grid grid-cols-[minmax(0,1fr)] gap-x-3 gap-y-1.5 px-3 py-2 sm:grid-cols-[minmax(8rem,13rem)_minmax(0,1fr)]">
            <span className="flex h-6 items-center">
              <Skeleton className={cn('h-3 rounded-full', plant)} />
            </span>
            <span className="flex flex-wrap gap-1">
              <Skeleton className="h-6 w-14 rounded-full" />
              {p === 1 && <Skeleton className="h-6 w-24 rounded-full" />}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
