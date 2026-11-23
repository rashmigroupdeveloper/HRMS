import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowLeft, ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react'
import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/SearchableSelect'
import { ColleagueCardSkeleton } from '@/components/skeletons/employees/ColleagueCardSkeleton'
import { DirectoryListSkeleton } from '@/components/skeletons/employees/DirectoryListSkeleton'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { cn, initialsOf } from '@/lib/utils'
import { ColleagueCard } from './ColleagueCard'

const PAGE_SIZE = 50
type Group = 'TEAM' | 'DEPARTMENT' | 'ALL'
type Place = { companyId: string; plantId: string; departmentId: string }
const NO_PLACE: Place = { companyId: '', plantId: '', departmentId: '' }

// The Directory tab of the People page (the user, 2026-11-21 - like greytHR): My team (who reports to me - the default) · My department
// (whose HOD I am - only for an HOD) · Everyone (everyone working now in every company); search by name or code; one
// filter button for company -> plant -> department. The card of the one clicked on the right (on a phone: instead of the
// list, with a way back). Any logged-in employee - basic fields only (employees.directory).
export function DirectoryView({ onChart }: { onChart: (employeeCode: string) => void }) {
  const { me } = useAccess()
  const isHod = (me?.hodPosts ?? 0) > 0
  // opens on My team (the user, 2026-11-21) - Everyone for someone nobody reports to; a tab chosen by hand stays
  const [chosen, setGroup] = useState<Group | null>(null)
  const team = useQuery({ ...orpc.employees.directory.queryOptions({ input: { group: 'TEAM', pageSize: 1 } }), enabled: chosen === null })
  const group: Group = chosen ?? (team.data?.total === 0 ? 'ALL' : 'TEAM')
  const [search, setSearch] = useState('')
  const deferred = useDeferredValue(search.trim())
  const [place, setPlace] = useState<Place>(NO_PLACE)
  const [page, setPage] = useState(1)
  const [picked, setPicked] = useState<string | null>(null)
  const list = useQuery({
    ...orpc.employees.directory.queryOptions({
      input: {
        ...(group !== 'ALL' && { group }),
        search: deferred || undefined,
        companyIds: place.companyId ? [Number(place.companyId)] : undefined,
        plantIds: place.plantId ? [Number(place.plantId)] : undefined,
        departmentIds: place.departmentId ? [Number(place.departmentId)] : undefined,
        page,
        pageSize: PAGE_SIZE,
      },
    }),
    placeholderData: keepPreviousData,
  })
  // a manager clicked on a card who is not on this page of the list: found by code
  const pickedQuery = useQuery({
    ...orpc.employees.directory.queryOptions({ input: { search: picked ?? '', pageSize: 5 } }),
    enabled: !!picked && !list.data?.items.some((c) => c.employeeCode === picked),
  })
  const items = list.data?.items ?? []
  const shown = items.find((c) => c.employeeCode === picked) ?? pickedQuery.data?.items.find((c) => c.employeeCode === picked) ?? (picked ? undefined : items[0])
  const pages = Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE))
  const groups: [Group, string][] = [['TEAM', 'My team'], ...(isHod ? [['DEPARTMENT', 'My department'] as [Group, string]] : []), ['ALL', 'Everyone']]
  const empty =
    group === 'TEAM' && !deferred && !place.companyId
      ? { title: 'Nobody reports to you', hint: 'People whose reporting manager you are show here.' }
      : group === 'DEPARTMENT' && !deferred && !place.companyId
        ? { title: 'Nobody in your department yet', hint: 'The employees of the department you head show here.' }
        : { title: 'Nobody found', hint: 'Try another name or code, or clear the filter.' }

  return (
    <div className="grid items-start gap-3 lg:grid-cols-[24rem_minmax(0,1fr)]">
      <section className={cn('space-y-2 rounded-2xl bg-card p-2 shadow-card', picked && 'max-lg:hidden')}>
        <div role="tablist" aria-label="Whose list" className="flex gap-0.5 rounded-xl bg-surface-2/70 p-0.5">
          {groups.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={group === value}
              onClick={() => {
                setGroup(value)
                setPage(1)
                setPicked(null)
              }}
              className={cn(
                'flex-1 rounded-lg px-2 py-1.5 text-sm whitespace-nowrap transition-colors',
                group === value ? 'bg-card font-medium shadow-card' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search by name or employee code"
              placeholder="Name or employee code"
              className="h-9 rounded-xl pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <PlaceFilter
            value={place}
            onChange={(next) => {
              setPlace(next)
              setPage(1)
            }}
          />
        </div>
        <FormError error={list.error} />
        {list.data && (
          <p className="px-1 text-xs text-muted-foreground tabular-nums">
            {list.data.total.toLocaleString('en-IN')} {list.data.total === 1 ? 'person' : 'people'}
          </p>
        )}
        {list.isPending ? (
          <DirectoryListSkeleton rows={10} label="Loading people" />
        ) : !items.length ? (
          <EmptyState title={empty.title} hint={empty.hint} className="py-6" />
        ) : (
          <ul className="max-h-[calc(100svh-19rem)] space-y-0.5 overflow-y-auto pr-0.5">
            {items.map((c) => (
              <li key={c.employeeCode}>
                <button
                  type="button"
                  aria-current={shown?.employeeCode === c.employeeCode ? 'true' : undefined}
                  onClick={() => setPicked(c.employeeCode)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left',
                    shown?.employeeCode === c.employeeCode ? 'bg-gold-soft' : 'hover:bg-surface-2',
                  )}
                >
                  <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-muted-foreground">
                    {initialsOf(c.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-1.5">
                      <span className="truncate text-sm font-medium">{c.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{c.employeeCode}</span>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{[c.designation, c.department?.name, c.company.code].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <span className="tabular-nums">
              {page} / {pages}
            </span>
            <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        )}
      </section>
      <section className={cn('min-w-0 space-y-2', !picked && 'max-lg:hidden')}>
        {picked && (
          <Button variant="ghost" size="sm" className="-ml-2 lg:hidden" onClick={() => setPicked(null)}>
            <ArrowLeft /> Back to the list
          </Button>
        )}
        {shown ? <ColleagueCard c={shown} onPick={setPicked} onChart={onChart} /> : (picked || list.isPending) && <ColleagueCardSkeleton chart={!!onChart} label="Loading the card" />}
      </section>
    </div>
  )
}

// One round filter button ("Filter people") opening company -> plant -> department; a dot when a filter is on
function PlaceFilter({ value, onChange }: { value: Place; onChange: (next: Place) => void }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const companyId = Number(value.companyId) || 0
  const plantId = Number(value.plantId) || 0
  const companies = useQuery({ ...orpc.organization.companies.list.queryOptions(), enabled: open })
  const plants = useQuery({ ...orpc.organization.plants.list.queryOptions({ input: { companyId } }), enabled: open && companyId > 0 })
  const departments = useQuery({ ...orpc.organization.departments.list.queryOptions({ input: { plantId } }), enabled: open && plantId > 0 })
  const on = [value.companyId, value.plantId, value.departmentId].filter(Boolean).length
  // a click outside or Esc closes it
  useEffect(() => {
    if (!open) return
    // (the pickers' lists open outside the panel - a click in them is not "outside")
    const outside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (box.current?.contains(target) || target.closest('[role="listbox"], [role="option"]')) return
      setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  const field = (id: string, label: string, current: string, options: { value: string; label: string }[], disabled: boolean, change: (v: string) => void) => (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {/* the app's searchable picker (the native list was long and plain - the user, 2026-11-21) */}
      <SearchableSelect
        id={id}
        value={current}
        onChange={change}
        options={options}
        disabled={disabled}
        placeholder={disabled ? `Choose the ${label === 'Plant' ? 'company' : 'plant'} first` : `Every ${label.toLowerCase()} - type to search`}
      />
    </div>
  )
  return (
    <div ref={box} className="relative">
      <Button
        variant="secondary"
        size="icon"
        className="relative size-9 rounded-full"
        aria-label="Filter people"
        title="Filter people"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <SlidersHorizontal />
        {on > 0 && <span aria-hidden className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-gold ring-2 ring-card" />}
      </Button>
      {open && (
        <div role="dialog" aria-label="Filter people" className="absolute top-full right-0 z-20 mt-2 w-72 space-y-3 rounded-2xl bg-popover p-3 shadow-card ring-1 ring-border">
          {field(
            'filter-company',
            'Company',
            value.companyId,
            (companies.data ?? []).map((c) => ({ value: String(c.id), label: `${c.name} (${c.code})` })),
            false,
            (v) => onChange({ companyId: v, plantId: '', departmentId: '' }),
          )}
          {field(
            'filter-plant',
            'Plant',
            value.plantId,
            (plants.data ?? []).map((p) => ({ value: String(p.id), label: `${p.plantCode} · ${p.name}` })),
            !companyId,
            (v) => onChange({ ...value, plantId: v, departmentId: '' }),
          )}
          {field(
            'filter-department',
            'Department',
            value.departmentId,
            (departments.data ?? []).map((d) => ({ value: String(d.id), label: d.name })),
            !plantId,
            (v) => onChange({ ...value, departmentId: v }),
          )}
          <div className="flex justify-between gap-2">
            <Button variant="ghost" size="sm" disabled={!on} onClick={() => onChange(NO_PLACE)}>
              Clear
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
