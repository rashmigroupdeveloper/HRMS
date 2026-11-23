import { ArrowRightLeft, Check, Ellipsis, History, MapPinned, UserMinus } from 'lucide-react'
import { Pill } from '@/components/Pill'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn, formatDate, formatLastDay, formatMoment } from '@/lib/utils'
import type { Hod } from './HodDialogs'
import { HodAvatar } from './HodAvatar'
import { groupPlaces, type PlaceTotals, plural } from './hod-places'

// The Department heads tab's right side (BACKLOG 3e): one HOD - since when, how many employees have them - and the places
// they head, by company and plant. A whole company or a whole plant is one line ("Whole company", "All 18 departments"),
// so someone heading 200 places reads in a few lines; a planned end shows on the place ("until 19 Nov"), the places they
// will head later are listed under them (2026-11-19). The buttons only for places the user may change.
// `compact` (on a phone, under the HOD's row): without their initials and name - the row above shows them.

type Action = 'places' | 'handover' | 'history' | 'end'
type Place = Hod['places'][number]

const sum = (places: Place[]) => places.reduce((n, p) => n + p.employees, 0)

export function HodDetail({ hod, totals, compact, onOpen }: { hod: Hod; totals: PlaceTotals | undefined; compact?: boolean; onOpen: (action: Action) => void }) {
  const now = hod.places.filter((p) => p.status === 'CURRENT')
  const later = hod.places.filter((p) => p.status === 'UPCOMING')
  const companies = groupPlaces(now, totals)
  const changeable = hod.places.some((p) => p.canChange)
  const first = now.reduce<Place | null>((a, p) => (!a || p.startsAt < a.startsAt ? p : a), null)
  const facts = [
    first ? `HOD since ${formatMoment(first.startsAt)}` : 'Not HOD yet',
    plural(sum(now), 'employee'),
    plural(now.length, 'place'),
    ...(later.length ? [`${later.length} upcoming`] : []),
  ].join(' · ')

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {compact ? (
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
            <span className="tabular-nums">{hod.employeeCode}</span> · {facts}
          </p>
        ) : (
          <>
            <HodAvatar name={hod.name} code={hod.employeeCode} size="md" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-base font-medium">{hod.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{hod.employeeCode}</span>
                {hod.hasLeft && <Pill tone="negative">Has left</Pill>}
                {hod.leavingOn && <Pill tone="warning">Leaving {formatDate(hod.leavingOn)}</Pill>}
              </p>
              <p className="text-xs text-muted-foreground">{facts}</p>
            </div>
          </>
        )}
        <div className="flex flex-wrap gap-1.5">
          {changeable && (
            <>
              <Button variant="secondary" size="sm" className="max-sm:h-9" onClick={() => onOpen('places')}>
                <MapPinned /> Change places
              </Button>
              <Button variant="secondary" size="sm" className="max-sm:h-9" onClick={() => onOpen('handover')}>
                <ArrowRightLeft /> Hand over
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" className={cn('max-sm:h-9', changeable && 'max-lg:hidden')} onClick={() => onOpen('history')}>
            <History /> History
          </Button>
          {changeable && (
            <>
              <Button variant="ghost" size="sm" className="text-negative-ink hover:text-negative-ink max-lg:hidden" onClick={() => onOpen('end')}>
                <UserMinus /> End
              </Button>
              {/* narrower screens: History and End behind "…" so the buttons stay on one row */}
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="max-sm:h-9 lg:hidden" aria-label={`More for ${hod.name}`} />}>
                  <Ellipsis />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-2xl p-1.5 shadow-float ring-0">
                  <DropdownMenuItem className="rounded-xl px-3 py-2" onClick={() => onOpen('history')}>
                    <History /> History
                  </DropdownMenuItem>
                  <DropdownMenuItem className="rounded-xl px-3 py-2 text-negative-ink" onClick={() => onOpen('end')}>
                    <UserMinus /> End appointments
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {companies.map((company) => (
          <section key={company.id} className="overflow-hidden rounded-2xl border border-border/70">
            <header className="flex items-center gap-2 bg-surface-2/40 px-3 py-1.5">
              <span className="shrink-0 text-sm font-semibold">{company.code}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{company.name}</span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground tabular-nums">
                {wholeHere(company) ? (
                  <>
                    <span className="max-sm:hidden">
                      {plural(company.places.length, 'place')} · {plural(company.plants.length, 'plant')}
                    </span>
                    <Pill tone="positive">Whole company</Pill>
                  </>
                ) : totals ? (
                  `${company.places.length.toLocaleString('en-IN')} of ${plural(company.total, 'place')}`
                ) : (
                  plural(company.places.length, 'place')
                )}
              </span>
            </header>
            {!wholeHere(company) && (
              <ul className="divide-y divide-border/60 border-t border-border/60">
                {company.plants.map((plant) => (
                  <li key={plant.id} className="grid grid-cols-[minmax(0,1fr)] gap-x-3 gap-y-1.5 px-3 py-2 sm:grid-cols-[minmax(8rem,13rem)_minmax(0,1fr)]">
                    <p className="text-xs leading-6">
                      <span className="text-muted-foreground tabular-nums">{plant.plantCode}</span> <span className="font-medium">{plant.name}</span>
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {wholeHere(plant) ? (
                        <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-positive/15 px-2.5 text-xs font-medium text-positive-ink">
                          <Check className="size-3" />
                          All {plural(plant.places.length, 'department')}
                          {sum(plant.places) > 0 && <span className="font-normal opacity-80">· {plural(sum(plant.places), 'employee')}</span>}
                        </span>
                      ) : (
                        plant.places.map((place) => <DepartmentChip key={place.appointmentId} place={place} />)
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
        {later.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-dashed border-border">
            <header className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">Upcoming · {later.length}</header>
            <ul className="divide-y divide-border/60 border-t border-border/60">
              {later.map((place) => (
                <li key={place.appointmentId} className="flex flex-wrap items-baseline justify-between gap-x-3 px-3 py-1.5 text-sm">
                  <span>{place.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    from {formatMoment(place.startsAt)}
                    {place.endsAt && ` until ${formatLastDay(place.endsAt)}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

// a whole company / plant is one line - unless one of its places ends at a planned moment (shown on that place)
const wholeHere = (group: { whole: boolean; places: Place[] }) => group.whole && group.places.every((p) => !p.endsAt)

// One department they head at a plant, with how many employees have it, a planned end (and since when, on hover)
function DepartmentChip({ place }: { place: Place }) {
  return (
    <span
      title={`HOD since ${formatMoment(place.startsAt)}${place.endsAt ? ` until ${formatLastDay(place.endsAt)}` : ''} · ${plural(place.employees, 'employee')}${place.isActive ? '' : ' · retired at the plant'}`}
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full border bg-card px-2.5 text-xs',
        place.isActive ? 'border-border' : 'border-dashed text-muted-foreground',
      )}
    >
      {place.department.name}
      {place.employees > 0 && <span className="rounded-full bg-surface-2 px-1.5 text-muted-foreground tabular-nums">{place.employees}</span>}
      {place.endsAt && <span className="text-warning-ink">until {formatLastDay(place.endsAt, true)}</span>}
    </span>
  )
}
