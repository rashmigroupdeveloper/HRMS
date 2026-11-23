import { ChevronDown, Search } from 'lucide-react'
import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import type { client } from '@/lib/orpc'
import { cn, formatMoment } from '@/lib/utils'
import { groupPlaces } from './hod-places'

// Ticks the places an HOD heads (BACKLOG 3e - a place = a department at a plant of a company): companies open and close,
// a company or a plant can be ticked whole, each department shows who heads it now (and who next). Only the places the user may change
// (HOD appointments: Edit covering them) are offered.

export type HodPlace = Awaited<ReturnType<typeof client.employees.hods.places>>[number]

export function HodPlacesPicker({
  places,
  selected,
  onChange,
  person,
}: {
  // every place from employees.hods.places
  places: HodPlace[]
  selected: Set<number>
  onChange: (selected: Set<number>) => void
  // the HOD being chosen for, by code - their own places say so instead of their name
  person?: string
}) {
  const [search, setSearch] = useState('')
  // the companies opened by hand (the ones with ticks start open)
  const [opened, setOpened] = useState<Set<number>>(() => new Set(places.filter((p) => selected.has(p.id)).map((p) => p.company.id)))
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const choosable = places.filter((p) => p.canChange)
  const shown = choosable.filter((p) => words.every((w) => `${p.label} ${p.hod?.name ?? ''}`.toLowerCase().includes(w)))
  const companies = groupPlaces(shown)
  const tick = (ids: number[], on: boolean) => {
    const next = new Set(selected)
    for (const id of ids) {
      if (on) next.add(id)
      else next.delete(id)
    }
    onChange(next)
  }
  const toggleOpen = (id: number) =>
    setOpened((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (!choosable.length) return <p className="text-sm text-muted-foreground">No place inside your data access - a place is a department ticked at a plant (Plants tab).</p>
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" aria-label="Search places" placeholder="Company, plant or department" className="h-9 rounded-full pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {companies.length === 0 && <p className="text-sm text-muted-foreground">Nothing matches.</p>}
      {companies.map((company) => {
        const ids = company.places.map((p) => p.id)
        const ticked = ids.filter((id) => selected.has(id)).length
        const open = opened.has(company.id) || words.length > 0
        return (
          <section key={company.id} className="rounded-2xl bg-surface-2/60">
            <div className="flex items-center gap-2.5 px-3 py-2">
              <Checkbox
                aria-label={`Every place of ${company.code} · ${company.name}`}
                checked={ticked === ids.length}
                indeterminate={ticked > 0 && ticked < ids.length}
                onCheckedChange={(checked) => tick(ids, checked === true)}
              />
              <button type="button" className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left" aria-expanded={open} onClick={() => toggleOpen(company.id)}>
                <span className="truncate text-sm font-medium">
                  {company.code} · {company.name}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums">
                  {ticked} of {ids.length}
                  <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
                </span>
              </button>
            </div>
            {open && (
              <ul className="space-y-2 border-t border-border/60 px-3 py-2.5">
                {company.plants.map((plant) => {
                  const plantIds = plant.places.map((p) => p.id)
                  const all = plantIds.every((id) => selected.has(id))
                  return (
                    <li key={plant.id} className="space-y-1.5">
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
                        <Checkbox checked={all} indeterminate={!all && plantIds.some((id) => selected.has(id))} onCheckedChange={(checked) => tick(plantIds, checked === true)} />
                        {plant.plantCode} {plant.name}
                      </label>
                      <div className="flex flex-wrap gap-1.5 pl-6">
                        {plant.places.map((place) => (
                          <label
                            key={place.id}
                            className={cn(
                              'inline-flex cursor-pointer items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs',
                              selected.has(place.id) ? 'border-foreground/40' : 'border-border',
                              !place.isActive && 'border-dashed',
                            )}
                            title={place.isActive ? undefined : 'Retired at the plant - people placed there keep it'}
                          >
                            <Checkbox className="size-3.5" checked={selected.has(place.id)} onCheckedChange={(checked) => tick([place.id], checked === true)} />
                            {place.department.name}
                            {place.hod && (
                              <span className="text-muted-foreground">· {place.hod.employeeCode === person ? 'theirs' : place.hod.name}</span>
                            )}
                            {place.next && (
                              <span className="text-info-ink">
                                → {place.next.employeeCode === person ? 'theirs' : place.next.name} {formatMoment(place.next.from, true)}
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
