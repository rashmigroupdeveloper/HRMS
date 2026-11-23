import { useQuery } from '@tanstack/react-query'
import { CircleAlert, CircleCheck, LayoutGrid, type LucideIcon, Plus, Search, Users } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/FormError'
import { CoverageStripSkeleton, HodsSkeleton } from '@/components/skeletons/organization/HodsSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { cn, formatMoment } from '@/lib/utils'
import { HodAvatar } from './HodAvatar'
import { HodDetail } from './HodDetail'
import { EndHodDialog, HandOverDialog, type Hod, HodHistoryDialog, type HodPerson, HodPlacesDrawer, PlaceHistoryDialog, type When } from './HodDialogs'
import { HodGapsDrawer } from './HodGapsDrawer'
import { HodPlacesMap } from './HodPlacesMap'
import { groupPlaces, type PlaceTotals, placeTotals, plural } from './hod-places'

// The Organization page's "Department heads" tab (BACKLOG 3e, changed with the user 2026-11-19; HOD appointments: View -
// changes need Edit covering each place). Every employee's HOD is whoever heads their plant + department.
// - The coverage strip: how many employees have an HOD now, and the gaps (they open the gap list).
// - "By HOD": the HODs (about 15-20 people) on the left, the chosen one's places on the right (on a phone, under them).
// - "By place": every place by company and plant with who heads it (HodPlacesMap).

type Open =
  | { kind: 'add'; preselect?: number[]; from?: When }
  | { kind: 'places' | 'handover' | 'history'; hod: Hod }
  | { kind: 'end'; person: HodPerson }
  | { kind: 'gaps' }
  | { kind: 'placeHistory'; title: string; places: { id: number; label: string }[] }
type View = 'hods' | 'places'

export function DepartmentHeadsTab() {
  const access = useAccess()
  const canEdit = access.can('HOD_APPOINTMENTS', 'WRITE')
  const hods = useQuery(orpc.employees.hods.list.queryOptions())
  const places = useQuery(orpc.employees.hods.places.queryOptions())
  const gaps = useQuery(orpc.employees.hods.gaps.queryOptions())
  const [open, setOpen] = useState<Open | null>(null)
  const [view, setView] = useState<View>('hods')
  const [search, setSearch] = useState('')
  // "By place": only the places with employees and no HOD
  const [onlyGaps, setOnlyGaps] = useState(false)
  // the HOD shown on the right (the first one until someone is picked)
  const [picked, setPicked] = useState<string | null>(null)
  const close = () => setOpen(null)
  const rows = hods.data ?? []
  // "whole company / plant" only where the user's data access covers all of it
  const totals = places.data && placeTotals(places.data, (where) => access.coversWhole('HOD_APPOINTMENTS', 'READ', where))
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const shown = rows.filter((hod) => {
    const text = `${hod.name} ${hod.employeeCode} ${hod.places.map((p) => p.label).join(' ')}`.toLowerCase()
    return words.every((w) => text.includes(w))
  })
  const selected = shown.find((hod) => hod.employeeCode === picked) ?? shown[0]
  const openFor = (hod: Hod) => (action: 'places' | 'handover' | 'history' | 'end') =>
    setOpen(action === 'end' ? { kind: 'end', person: { employeeCode: hod.employeeCode, name: hod.name, dateOfLeaving: hod.leavingOn, places: hod.places } } : { kind: action, hod })
  const g = gaps.data

  return (
    <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="mr-auto flex items-baseline gap-2 text-lg font-light tracking-tight" title="Every employee's HOD is whoever heads their department at their plant">
          HODs
          {hods.isPending ? (
            <Skeleton className="h-3 w-4 rounded-full" />
          ) : (
            <span className="text-xs font-normal tracking-normal text-muted-foreground tabular-nums">{rows.length}</span>
          )}
        </h2>
        {view === 'places' && (
          <button
            type="button"
            aria-pressed={onlyGaps}
            onClick={() => setOnlyGaps((on) => !on)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors max-sm:h-9',
              onlyGaps ? 'bg-warning/15 text-warning-ink hover:bg-warning/25' : 'bg-surface-2 text-muted-foreground hover:text-foreground',
            )}
          >
            <CircleAlert className="size-3.5" /> Only gaps
          </button>
        )}
        <ViewSwitch view={view} onChange={setView} />
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label={view === 'hods' ? 'Search HODs' : 'Search places'}
              placeholder={view === 'hods' ? 'Search HODs, places' : 'Search places, HODs'}
              className="h-9 rounded-full pl-8 sm:h-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {canEdit && (
            <Button variant="gold" size="sm" className="max-sm:h-9" onClick={() => setOpen({ kind: 'add' })}>
              <Plus /> Add HOD
            </Button>
          )}
        </div>
      </div>

      {places.data && g ? (
        <CoverageStrip places={places.data} gaps={g} onOpen={() => setOpen({ kind: 'gaps' })} />
      ) : (
        (places.isPending || gaps.isPending) && <CoverageStripSkeleton />
      )}
      <FormError error={hods.error ?? places.error ?? gaps.error} />

      {hods.isPending || (view === 'places' && places.isPending) ? (
        <HodsSkeleton view={view} canEdit={canEdit} label={view === 'hods' ? 'Loading the HODs' : 'Loading the places'} />
      ) : view === 'places' ? (
        places.data &&
        totals && (
          <HodPlacesMap
            places={places.data}
            totals={totals}
            words={words}
            onlyGaps={onlyGaps}
            canEdit={canEdit}
            onPickHod={(code) => {
              setView('hods')
              setSearch('')
              setPicked(code)
            }}
            onAppoint={(postIds) => setOpen({ kind: 'add', preselect: postIds })}
            onHistory={(title, list) => setOpen({ kind: 'placeHistory', title, places: list })}
          />
        )
      ) : rows.length === 0 ? (
        <EmptyState
          title="No HODs yet"
          hint="An HOD heads departments at plants: every employee's HOD is whoever heads their department at their plant. Until a place has one, its employees' approvals go to HR."
        />
      ) : shown.length === 0 ? (
        <p className="rounded-2xl bg-surface-2/50 px-3 py-6 text-sm text-muted-foreground">Nothing matches &quot;{search.trim()}&quot;.</p>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
          <ul className="space-y-1 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
            {shown.map((hod) => (
              <li key={hod.employeeCode}>
                <HodRow hod={hod} totals={totals} selected={hod === selected} onSelect={() => setPicked(hod.employeeCode)} />
                {/* on a phone the chosen HOD's places open under them */}
                {hod === selected && (
                  <div className="mt-1 mb-2 rounded-2xl border border-border/70 p-3 lg:hidden">
                    <HodDetail hod={hod} totals={totals} compact onOpen={openFor(hod)} />
                  </div>
                )}
              </li>
            ))}
          </ul>
          {selected && (
            <div className="border-l border-border/70 pl-5 max-lg:hidden">
              <HodDetail hod={selected} totals={totals} onOpen={openFor(selected)} />
            </div>
          )}
        </div>
      )}

      {open?.kind === 'add' && <HodPlacesDrawer preselect={open.preselect} from={open.from} onClose={close} />}
      {open?.kind === 'places' && <HodPlacesDrawer hod={open.hod} onClose={close} />}
      {open?.kind === 'handover' && <HandOverDialog hod={open.hod} onClose={close} />}
      {open?.kind === 'history' && <HodHistoryDialog person={open.hod} onClose={close} />}
      {open?.kind === 'placeHistory' && <PlaceHistoryDialog title={open.title} places={open.places} onClose={close} />}
      {open?.kind === 'end' && <EndHodDialog person={open.person} onClose={close} />}
      {open?.kind === 'gaps' && g && (
        <HodGapsDrawer
          gaps={g}
          canEdit={canEdit}
          onClose={close}
          onAppoint={(postIds, from) => setOpen({ kind: 'add', preselect: postIds, from })}
          onEnd={(person) => setOpen({ kind: 'end', person })}
        />
      )}
    </section>
  )
}

// "By HOD" | "By place"
function ViewSwitch({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  const views: [View, string, LucideIcon][] = [
    ['hods', 'By HOD', Users],
    ['places', 'By place', LayoutGrid],
  ]
  return (
    <div role="group" aria-label="Show" className="inline-flex rounded-full bg-surface-2 p-0.5">
      {views.map(([value, label, Icon]) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          onClick={() => onChange(value)}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors max-sm:h-9',
            view === value ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  )
}

// One HOD in the list: initials, name, what they head in a few words, how many employees have them
function HodRow({ hod, totals, selected, onSelect }: { hod: Hod; totals: PlaceTotals | undefined; selected: boolean; onSelect: () => void }) {
  const employees = hod.places.reduce((n, p) => n + (p.status === 'CURRENT' ? p.employees : 0), 0)
  const tag = (text: string, tone: 'negative' | 'warning') => (
    <span
      className={cn(
        'shrink-0 rounded-full px-1.5 text-xs font-medium',
        selected ? 'bg-hero-foreground/20 text-hero-foreground' : tone === 'negative' ? 'bg-destructive/10 text-negative-ink' : 'bg-warning/15 text-warning-ink',
      )}
    >
      {text}
    </span>
  )
  return (
    <button
      type="button"
      aria-pressed={selected}
      title={hod.employeeCode}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-2xl px-2.5 py-2 text-left transition-colors',
        selected ? 'bg-hero text-hero-foreground shadow-card' : 'hover:bg-surface-2/80',
      )}
    >
      <HodAvatar name={hod.name} code={hod.employeeCode} inverted={selected} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{hod.name}</span>
          {hod.hasLeft && tag('Left', 'negative')}
          {hod.leavingOn && tag('Leaving', 'warning')}
        </span>
        <span className={cn('block truncate text-xs', selected ? 'text-hero-muted' : 'text-muted-foreground')}>{summaryOf(hod, totals)}</span>
      </span>
      <span className={cn('flex shrink-0 items-center gap-1 text-xs tabular-nums', selected ? 'text-hero-foreground' : 'text-muted-foreground')} title={plural(employees, 'employee')}>
        <Users className="size-3.5" />
        {employees.toLocaleString('en-IN')}
      </span>
    </button>
  )
}

// What an HOD heads now in a few words: "Whole OMPL, RDL" / "Maintenance, Electrical · 1101 RML HQ" / "12 places · 3 plants ·
// RML" - or, before their first place starts, "Starts 1 Dec"
function summaryOf(hod: Hod, totals: PlaceTotals | undefined) {
  const places = hod.places.filter((p) => p.status === 'CURRENT')
  if (!places.length) {
    const first = hod.places[0]
    return first ? `Starts ${formatMoment(first.startsAt, true)}` : ''
  }
  const companies = groupPlaces(places, totals)
  const plants = companies.flatMap((c) => c.plants)
  if (companies.every((c) => c.whole)) return `Whole ${companies.map((c) => c.code).join(', ')}`
  if (plants.length === 1 && places.length <= 2) return `${places.map((p) => p.department.name).join(', ')} · ${plants[0]!.plantCode} ${plants[0]!.name}`
  return [plural(places.length, 'place'), plural(plants.length, 'plant'), companies.length === 1 ? companies[0]!.code : plural(companies.length, 'company', 'companies')].join(' · ')
}

// The coverage strip: employees with an HOD now out of all (every employee has a department, so an HOD post -
// 2026-11-19), and the gaps - each opens the gap list
function CoverageStrip({
  places,
  gaps,
  onOpen,
}: {
  places: { hod: unknown; employees: number }[]
  gaps: { vacant: unknown[]; ending: unknown[]; leavers: unknown[] }
  onOpen: () => void
}) {
  const covered = places.reduce((n, p) => n + (p.hod ? p.employees : 0), 0)
  const total = places.reduce((n, p) => n + p.employees, 0)
  const share = total ? covered / total : 1
  // [how many, the label, the short label on a phone]
  const counters: [number, string, string][] = [
    [gaps.vacant.length, gaps.vacant.length === 1 ? 'place needs an HOD' : 'places need an HOD', gaps.vacant.length === 1 ? 'place' : 'places'],
    [gaps.ending.length, gaps.ending.length === 1 ? 'place loses its HOD' : 'places lose their HOD', 'ending'],
    [gaps.leavers.length, gaps.leavers.length === 1 ? 'leaver heads places' : 'leavers head places', 'leavers'],
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-surface-2/60 px-3 py-2">
      <div className="flex min-w-56 flex-1 items-center gap-3">
        <span className="h-2 w-full max-w-48 overflow-hidden rounded-full bg-border">
          <span className={cn('block h-full rounded-full', share === 1 ? 'bg-positive' : 'bg-warning')} style={{ width: `${Math.round(share * 100)}%` }} />
        </span>
        <p className="shrink-0 text-xs">
          <span className="font-semibold tabular-nums">{Math.round(share * 100)}%</span>
          <span className="text-muted-foreground">
            {' '}
            · {covered.toLocaleString('en-IN')} of {plural(total, 'employee')} have an HOD
          </span>
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {counters.map(([n, label, short]) => (
          <button
            key={label}
            type="button"
            onClick={onOpen}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors max-sm:py-2',
              // on a phone only the gaps there are
              n > 0 ? 'bg-warning/15 text-warning-ink hover:bg-warning/25' : 'text-muted-foreground hover:bg-card max-sm:hidden',
            )}
          >
            {n > 0 ? <CircleAlert className="size-3.5" /> : <CircleCheck className="size-3.5 text-positive-ink" />}
            <span className="font-semibold tabular-nums">{n.toLocaleString('en-IN')}</span>
            <span className="max-sm:hidden">{label}</span>
            <span className="sm:hidden">{short}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
