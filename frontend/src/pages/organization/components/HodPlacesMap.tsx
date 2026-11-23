import { ChevronDown, CircleAlert, CircleCheck, History } from 'lucide-react'
import { useState } from 'react'
import { Pill } from '@/components/Pill'
import { cn, formatLastDay, formatMoment } from '@/lib/utils'
import { HodAvatar } from './HodAvatar'
import type { HodPlace } from './HodPlacesPicker'
import { groupPlaces, type PlantGroup, type PlaceTotals, plural } from './hod-places'

// The Department heads tab "By place" (BACKLOG 3e): every place inside the user's data access, by company and plant, with
// who heads it - the gaps first. Kept short: the companies with nothing to look at (no HOD, no employees waiting for one)
// fold into one line, the others come first when they have gaps; a company or a plant headed whole by one person is one
// line; in a company the plants with nothing to look at fold into "+N plants with no employees", and a plant's
// departments with no HOD and no employees into "+N with no employees". Each HOD of a plant is one chip with their
// departments - a click opens them; a department with employees but no HOD starts appointing someone (when the user may).
// A planned change shows where it happens (2026-11-19): "Maintenance until 19 Nov" on the HOD's chip, "Priya from 1 Dec"
// on a gap (India time). Each plant has a History button: who headed each of its departments, former HODs too (2026-11-20).

type HodOfPlace = NonNullable<HodPlace['hod']>

const sameHod = (places: HodPlace[]) => {
  const code = places[0]?.hod?.employeeCode
  return !!code && places.every((p) => p.hod?.employeeCode === code)
}
const needsHod = (p: HodPlace) => !p.hod && p.employees > 0
// nothing to look at: no HOD and no employees
const quiet = (p: HodPlace) => !p.hod && p.employees === 0
const toggled = (set: Set<number>, id: number) => {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}
// the dashed "+N ..." button that opens what is folded
const FOLD = 'inline-flex min-h-7 items-center rounded-full border border-dashed border-border px-2.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground'

export function HodPlacesMap({
  places,
  totals,
  words,
  onlyGaps,
  canEdit,
  onPickHod,
  onAppoint,
  onHistory,
}: {
  // every place from employees.hods.places
  places: HodPlace[]
  totals: PlaceTotals
  // the search box, as lower-case words
  words: string[]
  // only the places with employees and no HOD
  onlyGaps: boolean
  canEdit: boolean
  onPickHod: (employeeCode: string) => void
  onAppoint: (postIds: number[]) => void
  // a plant's HOD history: its title and its departments (the ones headed now first)
  onHistory: (title: string, places: { id: number; label: string }[]) => void
}) {
  // opened or closed by hand: companies (against how they start), the folded companies, a company's folded plants, a
  // plant's folded departments
  const [flipped, setFlipped] = useState<Set<number>>(() => new Set())
  const [quietCompaniesOpen, setQuietCompaniesOpen] = useState(false)
  const [quietPlantsOpen, setQuietPlantsOpen] = useState<Set<number>>(() => new Set())
  const [quietPlacesOpen, setQuietPlacesOpen] = useState<Set<number>>(() => new Set())
  const filtered = onlyGaps || words.length > 0
  const shown = places.filter(
    (p) => (!onlyGaps || needsHod(p)) && words.every((w) => `${p.label} ${p.hod?.name ?? ''} ${p.hod?.employeeCode ?? ''}`.toLowerCase().includes(w)),
  )
  const allByCompany = new Map(groupPlaces(places).map((c) => [c.id, c.places]))
  const companies = groupPlaces(shown, totals)
    .map((company) => {
      const all = allByCompany.get(company.id) ?? []
      const headed = all.filter((p) => p.hod).length
      const missing = all.filter(needsHod).length
      return { company, all, headed, missing, busy: headed > 0 || missing > 0 }
    })
    // the gaps first, then the ones with HODs (each in A-Z order - the sort keeps it)
    .sort((a, b) => b.missing - a.missing || Number(b.headed > 0) - Number(a.headed > 0))
  const quietCompanies = filtered ? [] : companies.filter((c) => !c.busy)
  const listed = filtered || quietCompaniesOpen ? companies : companies.filter((c) => c.busy)
  const appoint = (p: HodPlace) => (canEdit && p.canChange ? onAppoint : undefined)

  if (companies.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-surface-2/50 px-3 py-6 text-sm text-muted-foreground">
        {onlyGaps && words.length === 0 ? (
          <>
            <CircleCheck className="size-4 text-positive-ink" /> Every place with employees has an HOD.
          </>
        ) : places.length === 0 ? (
          'No place inside your data access - a place is a department ticked at a plant (Plants tab).'
        ) : (
          'Nothing matches.'
        )}
      </p>
    )
  }
  return (
    <div className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70">
      {listed.map(({ company, all, headed, missing, busy }) => {
        const open = filtered || busy !== flipped.has(company.id)
        // the whole company (all of it shown) headed by one person
        const onePerson = company.whole && sameHod(company.places) ? company.places[0]!.hod : null
        // plants with nothing to look at fold - only when others have something and nothing is searched
        const fold = !filtered && company.plants.some((plant) => !plant.places.every(quiet))
        const quietPlants = fold ? company.plants.filter((plant) => plant.places.every(quiet)) : []
        const showQuietPlants = quietPlantsOpen.has(company.id)
        const plants = fold && !showQuietPlants ? company.plants.filter((plant) => !plant.places.every(quiet)) : company.plants
        return (
          <section key={company.id}>
            <button
              type="button"
              aria-expanded={open}
              disabled={filtered}
              onClick={() => setFlipped((set) => toggled(set, company.id))}
              className={cn('flex w-full items-center gap-2 px-3 py-2 text-left enabled:hover:bg-surface-2/70', open && 'bg-surface-2/40')}
            >
              <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', !open && '-rotate-90')} />
              <span className="shrink-0 text-sm font-semibold">{company.code}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{company.name}</span>
              {missing > 0 && (
                <Pill tone="warning" className="shrink-0">
                  {missing}
                  <span className="max-sm:hidden">{missing === 1 ? ' needs' : ' need'} an HOD</span>
                </Pill>
              )}
              {headed > 0 && (
                <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-border max-sm:hidden">
                  <span className="block h-full rounded-full bg-positive" style={{ width: `${(headed / all.length) * 100}%` }} />
                </span>
              )}
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                <span className="max-sm:hidden">
                  {headed.toLocaleString('en-IN')} of {plural(all.length, 'place')} headed
                </span>
                <span className="sm:hidden">
                  {headed}/{all.length}
                </span>
              </span>
            </button>
            {open &&
              (onePerson ? (
                <div className="border-t border-border/60 px-3 py-2">
                  <HeadChip hod={onePerson} onPick={onPickHod}>
                    whole company · {plural(company.plants.length, 'plant')}
                  </HeadChip>
                </div>
              ) : (
                <ul className="divide-y divide-border/60 border-t border-border/60">
                  {plants.map((plant) => (
                    <PlantRow
                      key={plant.id}
                      plant={plant}
                      // searching shows every match; a plant with only quiet departments shows them
                      quietOpen={words.length > 0 || plant.places.every(quiet) || quietPlacesOpen.has(plant.id)}
                      onToggleQuiet={() => setQuietPlacesOpen((set) => toggled(set, plant.id))}
                      onPickHod={onPickHod}
                      appoint={appoint}
                      onHistory={() =>
                        onHistory(
                          `HOD history · ${plant.plantCode} ${plant.name}`,
                          [...plant.places]
                            .sort((a, b) => Number(!!b.hod) - Number(!!a.hod) || a.department.name.localeCompare(b.department.name))
                            .map((p) => ({ id: p.id, label: p.department.name })),
                        )
                      }
                    />
                  ))}
                  {quietPlants.length > 0 && (
                    <li className="px-3 py-2">
                      <button type="button" className={FOLD} aria-expanded={showQuietPlants} onClick={() => setQuietPlantsOpen((set) => toggled(set, company.id))}>
                        {showQuietPlants ? `Hide the ${plural(quietPlants.length, 'plant')} with no employees` : `+${plural(quietPlants.length, 'plant')} with no HOD and no employees`}
                      </button>
                    </li>
                  )}
                </ul>
              ))}
          </section>
        )
      })}
      {quietCompanies.length > 0 && (
        <div className="px-3 py-2">
          <button type="button" className={FOLD} aria-expanded={quietCompaniesOpen} onClick={() => setQuietCompaniesOpen((open) => !open)}>
            {quietCompaniesOpen
              ? `Hide the ${plural(quietCompanies.length, 'company', 'companies')} with no HOD and no employees`
              : `+${plural(quietCompanies.length, 'company', 'companies')} with no HOD and no employees`}
          </button>
        </div>
      )}
    </div>
  )
}

// One plant: one chip per HOD with their departments, the departments that need an HOD, and the rest folded
function PlantRow({
  plant,
  quietOpen,
  onToggleQuiet,
  onPickHod,
  appoint,
  onHistory,
}: {
  plant: PlantGroup<HodPlace>
  quietOpen: boolean
  onToggleQuiet: () => void
  onPickHod: (employeeCode: string) => void
  // how to appoint someone to a place - when the user may
  appoint: (place: HodPlace) => ((postIds: number[]) => void) | undefined
  onHistory: () => void
}) {
  const rest = plant.places.filter(quiet)
  const gaps = plant.places.filter(needsHod)
  const heads = new Map<string, { hod: HodOfPlace; places: HodPlace[] }>()
  for (const place of plant.places) {
    if (!place.hod) continue
    const entry = heads.get(place.hod.employeeCode) ?? { hod: place.hod, places: [] }
    entry.places.push(place)
    heads.set(place.hod.employeeCode, entry)
  }
  return (
    <li className="grid grid-cols-[minmax(0,1fr)] gap-x-3 gap-y-1.5 px-3 py-2 sm:grid-cols-[minmax(8rem,13rem)_minmax(0,1fr)]">
      <p className="flex items-center gap-1 py-0.5 text-xs leading-6">
        <span className="text-muted-foreground tabular-nums">{plant.plantCode}</span> <span className="font-medium">{plant.name}</span>
        <button
          type="button"
          onClick={onHistory}
          aria-label={`HOD history of ${plant.plantCode} ${plant.name}`}
          title="HOD history - who headed each department"
          className="ml-0.5 grid size-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <History className="size-3.5" />
        </button>
      </p>
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {plant.whole && sameHod(plant.places) ? (
          <HeadChip hod={plant.places[0]!.hod!} onPick={onPickHod}>
            all {plural(plant.places.length, 'department')}
          </HeadChip>
        ) : (
          <>
            {[...heads.values()].map(({ hod, places }) => (
              <HeadChip
                key={hod.employeeCode}
                hod={hod}
                onPick={onPickHod}
                title={`${hod.name} heads ${places.map((p) => p.department.name).join(', ')} (since ${formatMoment(hod.since)})`}
              >
                {places.map((p) => (p.hod?.until ? `${p.department.name} until ${formatLastDay(p.hod.until, true)}` : p.department.name)).join(', ')}
              </HeadChip>
            ))}
            {gaps.map((place) => (
              <Gap key={place.id} place={place} onAppoint={appoint(place)} />
            ))}
            {rest.length > 0 &&
              (quietOpen ? (
                <span className="px-1 py-0.5 text-xs leading-6 text-muted-foreground">
                  <span className="font-medium">No HOD, no employees:</span>{' '}
                  {rest.map((place, i) => {
                    const onAppoint = appoint(place)
                    return (
                      <span key={place.id}>
                        {i > 0 && ', '}
                        {onAppoint ? (
                          <button
                            type="button"
                            className="decoration-dashed underline-offset-4 hover:text-foreground hover:underline"
                            title="Appoint an HOD"
                            onClick={() => onAppoint([place.id])}
                          >
                            {place.department.name}
                          </button>
                        ) : (
                          place.department.name
                        )}
                      </span>
                    )
                  })}
                  {rest.length < plant.places.length && (
                    <button type="button" className="ml-2 font-medium text-foreground hover:underline" onClick={onToggleQuiet}>
                      Hide
                    </button>
                  )}
                </span>
              ) : (
                <button type="button" onClick={onToggleQuiet} className={FOLD}>
                  +{rest.length} with no employees
                </button>
              ))}
          </>
        )}
      </div>
    </li>
  )
}

// "(AK) Anil Kumar · Maintenance, Electrical" - opens that HOD
function HeadChip({ hod, onPick, title, children }: { hod: HodOfPlace; onPick: (employeeCode: string) => void; title?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={() => onPick(hod.employeeCode)}
      className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border border-border bg-card pr-2.5 pl-0.5 text-xs transition-colors hover:border-foreground/30 sm:max-w-md"
    >
      <HodAvatar name={hod.name} code={hod.employeeCode} size="xs" />
      <span className="min-w-0 truncate">
        <span className="font-medium">{hod.name}</span> <span className="text-muted-foreground">· {children}</span>
      </span>
    </button>
  )
}

// A department with employees but no HOD - their approvals go to HR; a click appoints someone (when the user may)
function Gap({ place, onAppoint }: { place: HodPlace; onAppoint?: (postIds: number[]) => void }) {
  const className = 'inline-flex h-7 items-center gap-1.5 rounded-full bg-warning/15 px-2.5 text-xs font-medium text-warning-ink'
  const body = (
    <>
      <CircleAlert className="size-3.5" />
      {place.department.name}
      <span className="font-normal tabular-nums opacity-80">{plural(place.employees, 'employee')}</span>
      {place.next && (
        <span className="font-normal opacity-80">
          · {place.next.name} from {formatMoment(place.next.from, true)}
        </span>
      )}
    </>
  )
  return onAppoint ? (
    <button type="button" title="Appoint an HOD" onClick={() => onAppoint([place.id])} className={cn(className, 'transition-colors hover:bg-warning/25')}>
      {body}
    </button>
  ) : (
    <span className={className}>{body}</span>
  )
}
