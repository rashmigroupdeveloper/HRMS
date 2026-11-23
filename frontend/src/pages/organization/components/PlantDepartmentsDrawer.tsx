import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Search, X } from 'lucide-react'
import { useState } from 'react'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { FormError } from '@/components/FormError'
import { PlantDepartmentsSkeleton } from '@/components/skeletons/organization/PlantDepartmentsSkeleton'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { orpc } from '@/lib/orpc'
import { cn } from '@/lib/utils'

// The departments that run at a plant (company -> plant -> department, as VBMS - 2026-11-18): an employee or candidate at
// the plant can only be placed in one of them. Organization: Edit ticks them; Organization: View only sees them.
// Redesigned 2026-11-21: the ticked ones on top as chips (x unticks, a new one is marked), the full list below with a
// search and an All / Ticked / Not ticked switch.

type Plant = { id: number; plantCode: string; name: string; company: { code: string; name: string } }
type Department = { id: number; name: string; code: string; isActive: boolean }
type Show = 'all' | 'ticked' | 'unticked'

export function PlantDepartmentsDrawer({ plant, canChange, onClose }: { plant: Plant; canChange: boolean; onClose: () => void }) {
  const active = useQuery(orpc.organization.departments.list.queryOptions())
  // the plant's own (retired ones too - they stay ticked until removed)
  const linked = useQuery(orpc.organization.departments.list.queryOptions({ input: { plantId: plant.id, includeInactive: true } }))
  const ready = active.data && linked.data
  return ready ? (
    <DepartmentsForm plant={plant} canChange={canChange} onClose={onClose} active={active.data} linked={linked.data} />
  ) : (
    <FormDrawer
      onClose={onClose}
      title="Departments"
      description={<PlantLine plant={plant} />}
      width={640}
      footer={
        <>
          {canChange && <span className="mr-auto text-xs text-muted-foreground">No changes yet</span>}
          <DrawerCancel />
          {canChange && (
            <Button variant="gold" disabled>
              Save
            </Button>
          )}
        </>
      }
    >
      <FormError error={active.error ?? linked.error} />
      {!active.error && !linked.error && <PlantDepartmentsSkeleton canChange={canChange} label="Loading the departments" />}
    </FormDrawer>
  )
}

// The plant the drawer is about: its code, name and company
function PlantLine({ plant }: { plant: Plant }) {
  return (
    <span className="flex flex-wrap items-baseline gap-x-2 text-foreground">
      <span className="text-muted-foreground tabular-nums">{plant.plantCode}</span>
      <span className="font-medium">{plant.name}</span>
      <span className="text-muted-foreground">
        · {plant.company.code} {plant.company.name}
      </span>
    </span>
  )
}

function DepartmentsForm({
  plant,
  canChange,
  onClose,
  active,
  linked,
}: {
  plant: Plant
  canChange: boolean
  onClose: () => void
  active: Department[]
  linked: Department[]
}) {
  const queryClient = useQueryClient()
  const [start] = useState(() => new Set(linked.map((d) => d.id)))
  const [chosen, setChosen] = useState(start)
  const [query, setQuery] = useState('')
  const [show, setShow] = useState<Show>(canChange ? 'all' : 'ticked')
  const [closed, setClosed] = useState(false)

  // every active department, plus a retired one the plant still has
  const all = [...active, ...linked.filter((d) => !active.some((a) => a.id === d.id))].sort((a, b) => a.name.localeCompare(b.name))
  const ticked = all.filter((d) => chosen.has(d.id))
  const term = query.trim().toLowerCase()
  const shown = all.filter(
    (d) => (show === 'all' || chosen.has(d.id) === (show === 'ticked')) && (!term || `${d.name} ${d.code}`.toLowerCase().includes(term)),
  )
  const added = ticked.filter((d) => !start.has(d.id)).length
  const removed = [...start].filter((id) => !chosen.has(id)).length
  const dirty = added + removed > 0

  const save = useMutation(
    orpc.organization.plants.setDepartments.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.organization.key() })
        setClosed(true)
      },
    }),
  )
  const toggle = (id: number, on: boolean) =>
    setChosen((current) => {
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  // tick / untick every department the list shows
  const setShown = (on: boolean) =>
    setChosen((current) => {
      const next = new Set(current)
      for (const d of shown) {
        if (on) next.add(d.id)
        else next.delete(d.id)
      }
      return next
    })
  const narrowed = Boolean(term) || show !== 'all'

  return (
    <FormDrawer
      onClose={onClose}
      closed={closed}
      dirty={dirty && !closed}
      width={640}
      title="Departments"
      description={<PlantLine plant={plant} />}
      footer={
        <>
          <span className="mr-auto text-xs text-muted-foreground tabular-nums">
            {dirty ? (
              <span className="font-medium text-foreground">{[added && `${added} added`, removed && `${removed} removed`].filter(Boolean).join(' · ')}</span>
            ) : canChange ? (
              'No changes yet'
            ) : null}
          </span>
          <DrawerCancel />
          {canChange && (
            <Button variant="gold" disabled={!dirty || save.isPending} onClick={() => save.mutate({ id: plant.id, departmentIds: [...chosen] })}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          )}
        </>
      }
    >
      {/* what runs here now: the ticked ones as chips */}
      <section className="space-y-2 rounded-2xl bg-surface-2/50 p-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-sm">
            <span className="font-semibold tabular-nums">{ticked.length}</span>
            <span className="text-muted-foreground"> of {all.length} departments run here</span>
          </p>
          <span className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-border">
            <span className="block h-full rounded-full bg-hero" style={{ width: `${all.length ? (ticked.length / all.length) * 100 : 0}%` }} />
          </span>
        </div>
        {ticked.length === 0 ? (
          <p className="text-xs text-warning-ink">None yet - nobody can be placed at this plant until departments are ticked.</p>
        ) : (
          <ul className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
            {ticked.map((d) => {
              const isNew = !start.has(d.id)
              return (
                <li
                  key={d.id}
                  className={cn(
                    'inline-flex h-7 items-center gap-1 rounded-full border bg-card pr-1 pl-2.5 text-xs',
                    isNew ? 'border-gold bg-gold-soft' : 'border-border',
                    !d.isActive && 'border-dashed text-muted-foreground',
                    !canChange && 'pr-2.5',
                  )}
                  title={[d.code !== d.name && d.code, !d.isActive && 'retired', isNew && 'new - not saved yet'].filter(Boolean).join(' · ') || undefined}
                >
                  {d.name}
                  {canChange && (
                    <button
                      type="button"
                      aria-label={`Untick ${d.name}`}
                      onClick={() => toggle(d.id, false)}
                      className="grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Employees and candidates here can only be placed in these. Unticking one where people are placed keeps it for them - nobody new can be placed in it.
        </p>
      </section>

      {canChange && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-40 flex-1 max-sm:basis-full">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                aria-label="Search departments"
                placeholder="Search departments"
                className="h-9 rounded-full pl-8 sm:h-8"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div role="group" aria-label="Show" className="inline-flex rounded-full bg-surface-2 p-0.5">
              {(
                [
                  ['all', 'All'],
                  ['ticked', 'Ticked'],
                  ['unticked', 'Not ticked'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={show === value}
                  onClick={() => setShow(value)}
                  className={cn(
                    'h-7 rounded-full px-2.5 text-xs font-medium transition-colors max-sm:h-8',
                    show === value ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {shown.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="mr-auto tabular-nums">{narrowed ? `${shown.length} shown` : `${all.length} departments`}</span>
              <Button variant="ghost" size="sm" onClick={() => setShown(true)}>
                <Check /> Tick {narrowed ? 'these' : 'all'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShown(false)}>
                <X /> Untick {narrowed ? 'these' : 'all'}
              </Button>
            </div>
          )}
          {shown.length === 0 ? (
            <p className="rounded-2xl bg-surface-2/50 px-3 py-6 text-sm text-muted-foreground">
              {term ? `Nothing matches "${query.trim()}".` : show === 'ticked' ? 'No departments ticked.' : 'Every department is ticked.'}
            </p>
          ) : (
            <ul className="grid gap-x-2 gap-y-0.5 sm:grid-cols-2">
              {shown.map((d) => (
                <li key={d.id}>
                  <label
                    className={cn(
                      'flex min-h-8 cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm transition-colors max-sm:min-h-10',
                      chosen.has(d.id) ? 'bg-surface-2/70 hover:bg-surface-2' : 'hover:bg-muted/60',
                    )}
                  >
                    <Checkbox checked={chosen.has(d.id)} onCheckedChange={(on) => toggle(d.id, on === true)} />
                    <span className="min-w-0 truncate" title={d.code !== d.name ? `${d.name} · ${d.code}` : d.name}>
                      {d.name}
                    </span>
                    {!d.isActive && <span className="shrink-0 text-xs text-muted-foreground">retired</span>}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <FormError error={save.error} />
    </FormDrawer>
  )
}
