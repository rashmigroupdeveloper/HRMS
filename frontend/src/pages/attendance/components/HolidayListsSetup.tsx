import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Factory, ListChecks, Pencil, Plus, Search, Tags } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { SharedListNote } from '@/components/SharedListNote'
import { FillMissingSkeleton, HolidayCategoryRowsSkeleton, HolidayListRowsSkeleton, PlantDefaultRowsSkeleton } from '@/components/skeletons/attendance/HolidayListsSkeleton'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAccess } from '@/hooks/useAccess'
import { cn } from '@/lib/utils'
import { client, orpc } from '@/lib/orpc'
import { FILTER_SEARCH, FILTER_SELECT, HOLIDAY_TONES, toneOf } from './labels'
import { SetupCard } from './SetupCard'

// Holiday lists, the plants' default lists and the holiday categories (the user, 2026-11-24) - shown under the setup's
// Holidays. A list belongs to one company (Attendance setup Edit for that whole company) or every company (Edit for all
// companies); a plant's default needs Edit for that whole plant; the categories are shared by every company.

type HolidayList = Awaited<ReturnType<typeof client.attendance.holidayLists.list>>[number]
type Category = Awaited<ReturnType<typeof client.attendance.holidayCategories.list>>[number]
type Plant = Awaited<ReturnType<typeof client.organization.plants.list>>[number]
type HolidayTone = Category['tone']

export function HolidayListsSetup() {
  return (
    <>
      {/* min-w-0: a card never grows wider than its column (the phone's screen) */}
      <div className="grid gap-3 lg:grid-cols-[3fr_2fr] [&>*]:min-w-0">
        <Lists />
        <Categories />
      </div>
      <PlantDefaults />
    </>
  )
}

// whether the viewer may change a list of this company (null = every company)
function useMayChangeList() {
  const { coversGroup, coversWhole } = useAccess()
  return (companyId: number | null) => (companyId === null ? coversGroup('ATTENDANCE_SETUP') : coversWhole('ATTENDANCE_SETUP', 'WRITE', { companyId }))
}

const invalidate = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: orpc.attendance.holidayLists.key() })
  void queryClient.invalidateQueries({ queryKey: orpc.attendance.holidayCategories.key() })
}

// --- holiday lists ---

function Lists() {
  const lists = useQuery(orpc.attendance.holidayLists.list.queryOptions({ input: { includeInactive: true } }))
  const companies = useQuery(orpc.organization.companies.list.queryOptions())
  const mayChange = useMayChangeList()
  const canAdd = mayChange(null) || !!companies.data?.some((c) => mayChange(c.id))
  const [editing, setEditing] = useState<HolidayList | 'new' | null>(null)
  return (
    <SetupCard
      icon={ListChecks}
      title="Holiday lists"
      count={lists.data?.filter((l) => l.isActive).length}
      summary="Each employee follows one list and gets its holidays"
      hint="Each employee follows one list and gets its holidays - two people at the same plant may follow different lists. A list is one company's, or every company's."
      action={
        canAdd && (
          <Button variant="gold" size="sm" onClick={() => setEditing('new')}>
            <Plus /> Add a list
          </Button>
        )
      }
    >
      <FormError error={lists.error} />
      {lists.data?.length === 0 && <EmptyState className="py-6" title="No holiday lists yet" hint="Add the first list - e.g. Corporate, or one per plant." />}
      <Table className={lists.data?.length === 0 ? 'hidden' : undefined}>
        <TableHeader>
          <TableRow>
            <TableHead>List</TableHead>
            <TableHead className="sm:w-32">Company</TableHead>
            <TableHead className="hidden sm:table-cell sm:w-40">Default for</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {lists.isPending && <HolidayListRowsSkeleton />}
          {lists.data?.map((l) => (
            <TableRow key={l.id} className={l.isActive ? undefined : 'text-muted-foreground'}>
              <TableCell className="whitespace-normal">
                <span className="font-medium">{l.name}</span>
                {!l.isActive && (
                  <Pill tone="neutral" className="ml-2">
                    Retired
                  </Pill>
                )}
              </TableCell>
              <TableCell className="whitespace-normal">{l.company?.code ?? 'Every company'}</TableCell>
              <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">{l.defaultPlants.map((p) => p.plantCode).join(', ') || '—'}</TableCell>
              <TableCell className="text-right">
                {mayChange(l.companyId) && (
                  <Button variant="ghost" size="icon" aria-label={`Edit ${l.name}`} title="Edit" onClick={() => setEditing(l)}>
                    <Pencil />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {editing && <ListDialog list={editing === 'new' ? null : editing} mayChange={mayChange} onClose={() => setEditing(null)} />}
    </SetupCard>
  )
}

function ListDialog({ list, mayChange, onClose }: { list: HolidayList | null; mayChange: (companyId: number | null) => boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const companies = useQuery(orpc.organization.companies.list.queryOptions())
  const allowed = companies.data?.filter((c) => mayChange(c.id)) ?? []
  const [name, setName] = useState(list?.name ?? '')
  // a new list starts at "every company" only for those who may make one there - else at their first company
  const [companyId, setCompanyId] = useState(list ? (list.companyId ? String(list.companyId) : '') : mayChange(null) ? '' : String(allowed[0]?.id ?? ''))
  const done = {
    onSuccess: () => {
      invalidate(queryClient)
      onClose()
    },
  }
  const create = useMutation(orpc.attendance.holidayLists.create.mutationOptions(done))
  const update = useMutation(orpc.attendance.holidayLists.update.mutationOptions(done))
  const dirty = name !== (list?.name ?? '') || companyId !== (list?.companyId ? String(list.companyId) : '')
  const data = { name, companyId: companyId ? Number(companyId) : null }
  const busy = create.isPending || update.isPending
  return (
    <FormDialog onOpenChange={(open) => !open && onClose()} dirty={dirty} className="rounded-3xl sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{list ? `Edit ${list.name}` : 'Add a holiday list'}</DialogTitle>
        <DialogDescription>Employees will follow a list from a date; a plant's default list is given to those who join it.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="hl-name" className="text-xs text-muted-foreground">
            Name
          </Label>
          <Input id="hl-name" className="h-9 rounded-xl" placeholder="e.g. Corporate" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="hl-company" className="text-xs text-muted-foreground">
            Company
          </Label>
          <NativeSelect id="hl-company" className="w-full [&_select]:h-9 [&_select]:rounded-xl" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            {mayChange(null) && <NativeSelectOption value="">Every company</NativeSelectOption>}
            {allowed.map((c) => (
              <NativeSelectOption key={c.id} value={String(c.id)}>
                {c.code}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
      <FormError error={create.error ?? update.error} />
      <DialogFooter>
        {list && (
          <Button variant="ghost" className="mr-auto" disabled={busy} onClick={() => update.mutate({ id: list.id, isActive: !list.isActive })}>
            {list.isActive ? 'Retire' : 'Re-activate'}
          </Button>
        )}
        <DialogCancel />
        <Button variant="gold" disabled={!name.trim() || busy} onClick={() => (list ? update.mutate({ id: list.id, ...data }) : create.mutate(data))}>
          Save
        </Button>
      </DialogFooter>
    </FormDialog>
  )
}

// --- holiday categories ---

function Categories() {
  const categories = useQuery(orpc.attendance.holidayCategories.list.queryOptions({ input: { includeInactive: true } }))
  const canChange = useAccess().coversGroup('ATTENDANCE_SETUP')
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  return (
    <SetupCard
      icon={Tags}
      title="Holiday categories"
      summary="National, Festival… - each in its colour"
      hint="Labels for holidays - National, Festival, Election… - each in its colour on the calendars."
      action={
        canChange && (
          <Button variant="gold" size="sm" onClick={() => setEditing('new')}>
            <Plus /> Add
          </Button>
        )
      }
    >
      <SharedListNote area="ATTENDANCE_SETUP" label="Attendance setup" what="changing the categories" />
      <FormError error={categories.error} />
      {categories.isPending && <HolidayCategoryRowsSkeleton />}
      {categories.data?.length === 0 && <EmptyState className="py-6" title="No categories yet" hint="Add e.g. National, Festival." />}
      <ul className="divide-y">
        {categories.data?.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 py-1.5">
            <span className={cn('flex items-center gap-2', !c.isActive && 'opacity-60')}>
              <Pill tone={toneOf(c.tone)}>{c.name}</Pill>
              {!c.isActive && <span className="text-xs text-muted-foreground">Retired</span>}
            </span>
            {canChange && (
              <Button variant="ghost" size="icon" aria-label={`Edit ${c.name}`} title="Edit" onClick={() => setEditing(c)}>
                <Pencil />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {editing && <CategoryDialog category={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </SetupCard>
  )
}

function CategoryDialog({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(category?.name ?? '')
  const [tone, setTone] = useState<HolidayTone>(category?.tone ?? 'INFO')
  const done = {
    onSuccess: () => {
      invalidate(queryClient)
      onClose()
    },
  }
  const create = useMutation(orpc.attendance.holidayCategories.create.mutationOptions(done))
  const update = useMutation(orpc.attendance.holidayCategories.update.mutationOptions(done))
  const dirty = name !== (category?.name ?? '') || tone !== (category?.tone ?? 'INFO')
  const busy = create.isPending || update.isPending
  return (
    <FormDialog onOpenChange={(open) => !open && onClose()} dirty={dirty} className="rounded-3xl sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{category ? `Edit ${category.name}` : 'Add a holiday category'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-1">
        <Label htmlFor="hc-name" className="text-xs text-muted-foreground">
          Name
        </Label>
        <Input id="hc-name" className="h-9 rounded-xl" placeholder="e.g. National" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <fieldset className="space-y-1">
        <legend className="text-xs text-muted-foreground">Colour</legend>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {HOLIDAY_TONES.map((t) => (
            <button key={t.value} type="button" aria-pressed={tone === t.value} onClick={() => setTone(t.value)} className={cn('rounded-full p-0.5 ring-offset-2 ring-offset-card', tone === t.value && 'ring-2 ring-ring')}>
              <Pill tone={t.tone}>{t.label}</Pill>
            </button>
          ))}
        </div>
      </fieldset>
      <FormError error={create.error ?? update.error} />
      <DialogFooter>
        {category && (
          <Button variant="ghost" className="mr-auto" disabled={busy} onClick={() => update.mutate({ id: category.id, isActive: !category.isActive })}>
            {category.isActive ? 'Retire' : 'Re-activate'}
          </Button>
        )}
        <DialogCancel />
        <Button variant="gold" disabled={!name.trim() || busy} onClick={() => (category ? update.mutate({ id: category.id, name, tone }) : create.mutate({ name, tone }))}>
          Save
        </Button>
      </DialogFooter>
    </FormDialog>
  )
}

// --- the plants' default lists ---

function PlantDefaults() {
  const plants = useQuery(orpc.organization.plants.list.queryOptions())
  const lists = useQuery(orpc.attendance.holidayLists.list.queryOptions({ input: { includeInactive: true } }))
  const { coversWhole } = useAccess()
  const [editing, setEditing] = useState<Plant | null>(null)
  // a hundred plants (VBMS): one company at a time - at first the first company listed; a search looks at every plant
  const [picked, setPicked] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const defaultOf = (plantId: number) => lists.data?.find((l) => l.defaultPlants.some((p) => p.id === plantId))
  const companies = [...new Map((plants.data ?? []).map((p) => [p.company.id, p.company])).values()].sort((a, b) => a.code.localeCompare(b.code))
  const companyId = picked ?? String(companies[0]?.id ?? '')
  const term = search.trim().toLowerCase()
  const shown = (plants.data ?? []).filter((p) => (term ? `${p.plantCode} ${p.name}`.toLowerCase().includes(term) : !companyId || String(p.company.id) === companyId))
  const withDefault = plants.data?.filter((p) => defaultOf(p.id)).length ?? 0
  // the employees without a holiday list (inside the viewer's Edit data access) - counted, then given their plant's default
  const queryClient = useQueryClient()
  const canEdit = useAccess().can('ATTENDANCE_SETUP', 'WRITE')
  const missing = useQuery({ ...orpc.attendance.holidayLists.fillMissing.queryOptions({ input: { dryRun: true } }), enabled: canEdit })
  const fill = useMutation(
    orpc.attendance.holidayLists.fillMissing.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.attendance.key() })
      },
    }),
  )
  return (
    <SetupCard
      icon={Factory}
      title="Plants' default lists"
      count={plants.data && lists.data ? `${withDefault} of ${plants.data.length} set` : undefined}
      summary="The list given to people who join the plant"
      hint="The list offered when someone joins the plant, and given by “Fill in” to its employees without a list. HR changes a person's list on Schedules; moving plant keeps it."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect aria-label="Company" className={FILTER_SELECT} value={companyId} disabled={!plants.data || !!term} onChange={(e) => setPicked(e.target.value)}>
            <NativeSelectOption value="">Every company</NativeSelectOption>
            {companies.map((c) => (
              <NativeSelectOption key={c.id} value={String(c.id)}>
                {c.code}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search every plant" className={cn(FILTER_SEARCH, 'w-44')} placeholder="Any plant" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      }
    >
      <FormError error={plants.error ?? lists.error ?? missing.error ?? fill.error} />
      {/* employees without a list get no holidays: offered to fill in from their plants' defaults (2026-11-24) */}
      {canEdit && missing.isPending && <FillMissingSkeleton />}
      {missing.data && missing.data.withoutList > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-warning/15 px-3 py-2 text-sm text-warning-ink">
          <span className="font-medium">
            {missing.data.withoutList} employee{missing.data.withoutList === 1 ? ' has' : 's have'} no holiday list - no holidays
          </span>
          {missing.data.noDefault.length > 0 && (
            <span className="text-xs">
              Waiting for a plant default: {missing.data.noDefault.slice(0, 4).map((p) => `${p.plant} (${p.employees})`).join(', ')}
              {missing.data.noDefault.length > 4 ? ` +${missing.data.noDefault.length - 4} more` : ''}
            </span>
          )}
          <span className="flex-1" />
          {missing.data.toGive > 0 && (
            <Button variant="secondary" size="sm" disabled={fill.isPending} onClick={() => fill.mutate({})}>
              {fill.isPending ? 'Giving…' : `Give ${missing.data.toGive} their plant's default`}
            </Button>
          )}
        </div>
      )}
      {plants.data?.length === 0 && <EmptyState className="py-6" title="No plants yet" hint="Plants are added on the Organization page." />}
      {plants.data && plants.data.length > 0 && shown.length === 0 && <EmptyState className="py-6" title="No plant matches" hint="Try another code or name." />}
      <Table className={shown.length === 0 && plants.data ? 'hidden' : undefined}>
        <TableHeader>
          <TableRow>
            <TableHead>Plant</TableHead>
            <TableHead className="hidden sm:table-cell sm:w-32">Company</TableHead>
            <TableHead className="sm:w-56">Default list</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(plants.isPending || lists.isPending) && <PlantDefaultRowsSkeleton />}
          {lists.data &&
            shown.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="whitespace-normal">
                  <span className="font-medium">{p.plantCode}</span>
                  <span className="block text-xs text-muted-foreground">
                    {p.name}
                    {/* the company column is hidden on a phone */}
                    <span className="sm:hidden"> · {p.company.code}</span>
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">{p.company.code}</TableCell>
                <TableCell className="whitespace-normal">{defaultOf(p.id)?.name ?? <span className="text-muted-foreground">None yet</span>}</TableCell>
                <TableCell className="text-right">
                  {coversWhole('ATTENDANCE_SETUP', 'WRITE', { companyId: p.company.id, plantId: p.id }) && (
                    <Button variant="ghost" size="icon" aria-label={`Edit ${p.plantCode}`} title="Edit" onClick={() => setEditing(p)}>
                      <Pencil />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
      {editing && lists.data && <PlantDefaultDialog plant={editing} lists={lists.data} current={defaultOf(editing.id) ?? null} onClose={() => setEditing(null)} />}
    </SetupCard>
  )
}

function PlantDefaultDialog({ plant, lists, current, onClose }: { plant: Plant; lists: HolidayList[]; current: HolidayList | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [listId, setListId] = useState(current ? String(current.id) : '')
  const save = useMutation(
    orpc.attendance.holidayLists.setPlantDefault.mutationOptions({
      onSuccess: () => {
        invalidate(queryClient)
        onClose()
      },
    }),
  )
  // the lists in use of the plant's company or of every company
  const offered = lists.filter((l) => l.isActive && (l.companyId === null || l.companyId === plant.company.id))
  return (
    <FormDialog onOpenChange={(open) => !open && onClose()} dirty={listId !== (current ? String(current.id) : '')} className="rounded-3xl sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Default list of {plant.plantCode}</DialogTitle>
        <DialogDescription>Offered when someone joins the plant, and given by “Fill in” to its employees without a list - the employees who have one keep it.</DialogDescription>
      </DialogHeader>
      <div className="space-y-1">
        <Label htmlFor="pd-list" className="text-xs text-muted-foreground">
          Holiday list
        </Label>
        <NativeSelect id="pd-list" className="w-full [&_select]:h-9 [&_select]:rounded-xl" value={listId} onChange={(e) => setListId(e.target.value)}>
          <NativeSelectOption value="">No default</NativeSelectOption>
          {offered.map((l) => (
            <NativeSelectOption key={l.id} value={String(l.id)}>
              {l.name}
              {l.company ? '' : ' (every company)'}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <FormError error={save.error} />
      <DialogFooter>
        <DialogCancel />
        <Button variant="gold" disabled={save.isPending} onClick={() => save.mutate({ plantId: plant.id, holidayListId: listId ? Number(listId) : null })}>
          Save
        </Button>
      </DialogFooter>
    </FormDialog>
  )
}
