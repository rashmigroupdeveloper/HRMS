import { ExportButton } from '@/components/ExportButton'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3, Plus, Search, SlidersHorizontal, Upload, X } from 'lucide-react'
import { useDeferredValue, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { EmployeePicker, type PickedEmployee } from '@/components/EmployeePicker'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { Pill } from '@/components/Pill'
import { SegmentedControl } from '@/components/SegmentedControl'
import { type RecordsCell, RecordsTableSkeleton } from '@/components/skeletons/employees/RecordsTableSkeleton'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAccess } from '@/hooks/useAccess'
import { client, orpc } from '@/lib/orpc'
import { cn, errorMessage, formatDate, toDateInput } from '@/lib/utils'
import { EmployeeDetailsDrawer } from './EmployeeDetailsDrawer'
import { ImportEmployeesDrawer } from './ImportEmployeesDrawer'
import { EMPLOYMENT_TYPE, type EmployeeRow, type EmployeeStatus, STATUS_LABEL, STATUS_TONE, WORKFORCE } from './labels'
import { SavedViews } from './SavedViews'

const PAGE_SIZE = 25

type ListInput = NonNullable<Parameters<typeof client.employees.list>[0]>
type Facets = Awaited<ReturnType<typeof client.employees.list>>['facets']
type SortKey = NonNullable<ListInput['sort']>

// The status segments of the directory (the status filter); "ALL" = any status
const STATUS_SEGMENTS = [
  { value: 'ACTIVE' as const, label: 'Active' },
  { value: 'ON_NOTICE' as const, label: 'On notice' },
  { value: 'EXITED' as const, label: 'Left' },
  { value: 'ALL' as const, label: 'All' },
]

// The filters with several values (2026-11-16): each one an address parameter holding a comma list, the facet the
// server counts it by, and the list input it fills
const FILTERS = [
  { param: 'company', label: 'Company', facet: 'companyId', input: 'companyIds', numeric: true },
  { param: 'plant', label: 'Plant', facet: 'plantId', input: 'plantIds', numeric: true },
  { param: 'location', label: 'Work location', facet: 'workLocationId', input: 'workLocationIds', numeric: true },
  { param: 'department', label: 'Department', facet: 'departmentId', input: 'departmentIds', numeric: true },
  { param: 'designation', label: 'Designation', facet: 'designationId', input: 'designationIds', numeric: true },
  { param: 'type', label: 'Employment type', facet: 'employmentType', input: 'employmentTypes', numeric: false },
  { param: 'workforce', label: 'Workforce', facet: 'workforceCategory', input: 'workforceCategories', numeric: false },
] as const
type FilterParam = (typeof FILTERS)[number]['param']
type Selection = Record<FilterParam, string[]>

// The table's columns besides the employee (always first). `sort`: clicking the header orders by it.
const COLUMNS = [
  { id: 'role', label: 'Role', sort: 'designation' },
  { id: 'company', label: 'Company', sort: 'company' },
  { id: 'department', label: 'Department', sort: 'department' },
  { id: 'joined', label: 'Joined', sort: 'joined' },
  { id: 'type', label: 'Employment type' },
  { id: 'workforce', label: 'Workforce' },
  { id: 'manager', label: 'Reports to' },
  { id: 'status', label: 'Status' },
] as const satisfies readonly { id: string; label: string; sort?: SortKey }[]
type ColumnId = (typeof COLUMNS)[number]['id']
const DEFAULT_COLUMNS: ColumnId[] = ['role', 'company', 'joined', 'status']

// The first day of this month, as the API's date
function monthStart() {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
}

const listOf = (value: string | null) => (value ? value.split(',').filter(Boolean) : [])

// "Employee records" on the People page (Employee · Directory & job: View - the People page itself until 2026-11-21): the
// summary and buttons, stat tiles that
// filter the list, and one card with status segments, search, filters, columns and the table. Everything - search,
// filters (several values each), order, the columns shown - lives in the page address, so coming back from a profile
// shows the same list and a saved view keeps all of it.
export function EmployeeRecordsView() {
  const navigate = useNavigate()
  const { can } = useAccess()
  const [params, setParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)

  // the list's state, from the address
  const status = (params.get('status') ?? 'ACTIVE') as EmployeeStatus | 'ALL'
  const numbersPending = params.get('pending') === '1'
  const joinedThisMonth = params.get('joined') === 'month'
  const page = Math.max(1, Number(params.get('page')) || 1)
  const selection = Object.fromEntries(FILTERS.map((f) => [f.param, listOf(params.get(f.param))])) as Selection
  // the employees who report to this employee (their code)
  const manager = params.get('manager') ?? ''
  const [sortField, sortDirection] = (params.get('sort') ?? 'code-asc').split('-') as [SortKey, 'asc' | 'desc']
  const shownColumns = (params.get('cols') ? listOf(params.get('cols')) : DEFAULT_COLUMNS).filter((id): id is ColumnId => COLUMNS.some((c) => c.id === id))

  // the search box updates the address as you type; the list follows a moment later
  const [search, setSearch] = useState(params.get('q') ?? '')
  const deferredSearch = useDeferredValue(search.trim())
  useEffect(() => {
    if ((params.get('q') ?? '') === deferredSearch) return
    update({ q: deferredSearch || null, page: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the typed search settles
  }, [deferredSearch])

  // changes some address values (null removes one); `replace` keeps typing out of the back-button history
  function update(changes: Record<string, string | null>) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(changes)) {
          if (value === null) next.delete(key)
          else next.set(key, value)
        }
        return next
      },
      { replace: true },
    )
  }

  const companies = useQuery(orpc.organization.companies.list.queryOptions())
  const plants = useQuery(orpc.organization.plants.list.queryOptions())
  const locations = useQuery(orpc.organization.workLocations.list.queryOptions())
  const departments = useQuery(orpc.organization.departments.list.queryOptions())
  const designations = useQuery(orpc.organization.designations.list.queryOptions())
  // a value's name (masters by id; the fixed kinds by their label)
  const names: Record<FilterParam, Map<string, string>> = {
    company: new Map((companies.data ?? []).map((c) => [String(c.id), `${c.code} · ${c.name}`])),
    plant: new Map((plants.data ?? []).map((p) => [String(p.id), `${p.company.code} · ${p.plantCode} ${p.name}`])),
    location: new Map((locations.data ?? []).map((l) => [String(l.id), l.name])),
    department: new Map((departments.data ?? []).map((d) => [String(d.id), d.name])),
    designation: new Map((designations.data ?? []).map((d) => [String(d.id), d.name])),
    type: new Map(Object.entries(EMPLOYMENT_TYPE)),
    workforce: new Map(Object.entries(WORKFORCE)),
  }

  // the list's filters - also what the Excel export takes
  const filters = toInput(selection, {
    search: deferredSearch || undefined,
    reportingManagerCode: manager || undefined,
    status: status === 'ALL' ? undefined : status,
    numbersPending: numbersPending || undefined,
    joinedFrom: joinedThisMonth ? monthStart() : undefined,
    sort: sortField,
    direction: sortDirection,
  })
  const list = useQuery({
    ...orpc.employees.list.queryOptions({ input: { ...filters, page, pageSize: PAGE_SIZE } }),
    placeholderData: keepPreviousData,
  })
  const summary = list.data?.summary
  const total = list.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const last = Math.min(page * PAGE_SIZE, total)

  // one chip per filter in use (its values together), besides the status segment
  const chips: { key: string; label: string; clear: Record<string, null> }[] = [
    ...FILTERS.filter((f) => selection[f.param].length).map((f) => {
      const values = selection[f.param].map((v) => names[f.param].get(v) ?? '…')
      return { key: f.param, label: `${f.label}: ${values.length > 2 ? `${values.slice(0, 2).join(', ')} +${values.length - 2}` : values.join(', ')}`, clear: { [f.param]: null } }
    }),
    ...(manager ? [{ key: 'manager', label: `Reports to ${params.get('managerName') ?? manager}`, clear: { manager: null, managerName: null } }] : []),
    ...(numbersPending ? [{ key: 'pending', label: 'PF / ESIC numbers pending', clear: { pending: null } }] : []),
    ...(joinedThisMonth ? [{ key: 'joined', label: 'Joined this month', clear: { joined: null } }] : []),
  ]
  const filterCount = FILTERS.filter((f) => selection[f.param].length).length + (manager ? 1 : 0)
  const clearAll = () => {
    setSearch('')
    // the order and the columns are how the list looks, not what it shows - they stay
    // (and the People page's tab stays on these records)
    setParams(new URLSearchParams([['view', 'records'], ...(params.get('sort') ? [['sort', params.get('sort')!]] : []), ...(params.get('cols') ? [['cols', params.get('cols')!]] : [])]), {
      replace: true,
    })
  }
  // the tiles filter the list; the one matching the current view is outlined
  const tile = (changes: Record<string, string | null>) => () => update({ pending: null, joined: null, page: null, ...changes })
  const filtered = filterCount > 0 || !!deferredSearch
  // a header click: this column ascending, again descending
  const sortBy = (field: SortKey) =>
    update({ sort: field === sortField ? (sortDirection === 'asc' ? `${field}-desc` : null) : `${field}-asc`, page: null })
  const toggleColumn = (id: ColumnId) => {
    const next = shownColumns.includes(id) ? shownColumns.filter((c) => c !== id) : COLUMNS.map((c) => c.id).filter((c) => c === id || shownColumns.includes(c))
    update({ cols: next.join(',') === DEFAULT_COLUMNS.join(',') ? null : next.join(',') || 'none' })
  }

  // the table's header row - also on the skeleton while the list loads
  const head = (
    <TableRow>
      <SortHead label="Employee" field="name" className="w-2/5" current={sortField} direction={sortDirection} onSort={sortBy} />
      {COLUMNS.filter((c) => shownColumns.includes(c.id)).map((c) =>
        'sort' in c ? (
          <SortHead key={c.id} label={c.label} field={c.sort} className={columnClass(c.id)} current={sortField} direction={sortDirection} onSort={sortBy} />
        ) : (
          <TableHead key={c.id} className={columnClass(c.id)}>
            {c.label}
          </TableHead>
        ),
      )}
      <TableHead className="w-8" />
    </TableRow>
  )
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="max-w-2xl text-sm text-muted-foreground max-sm:hidden">
            {summary
              ? `${summary.active.toLocaleString('en-IN')} working now${summary.onNotice ? `, ${summary.onNotice} on notice` : ''}. Search by name or employee code, filter by where they work, open a profile.`
              : 'Everyone employed - search by name or employee code, filter by where they work, open a profile.'}
          </p>
        </div>
        {can('EMPLOYEES', 'WRITE') && (
          <div className="flex gap-2 max-sm:w-full">
            <Button variant="secondary" className="max-sm:flex-1" onClick={() => setImporting(true)}>
              <Upload /> Import from Excel
            </Button>
            <Button variant="gold" className="max-sm:flex-1" onClick={() => setAdding(true)}>
              <Plus /> Add employee
            </Button>
          </div>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile pending={list.isPending}
          tone="hero"
          label="Active"
          value={summary?.active}
          hint="working now"
          selected={status === 'ACTIVE' && !numbersPending && !joinedThisMonth}
          onClick={tile({ status: null })}
        />
        <StatTile pending={list.isPending} label="Joined this month" value={summary?.joinedThisMonth} hint="new joiners" selected={joinedThisMonth} onClick={tile({ status: 'ALL', joined: 'month' })} />
        {/* IDs / PF information - only with "Employee · IDs, bank & statutory" (the server sends null without it) */}
        {summary?.numbersPending !== null && (
          <StatTile pending={list.isPending}
            label="PF / ESIC numbers pending"
            value={summary?.numbersPending}
            hint="UAN, PF or ESIC number to record"
            selected={numbersPending}
            onClick={tile({ status: null, pending: '1' })}
          />
        )}
        <StatTile pending={list.isPending} tone="hatched" label="Left" value={summary?.exited} hint="exited employees" selected={status === 'EXITED' && !numbersPending && !joinedThisMonth} onClick={tile({ status: 'EXITED' })} />
      </div>

      <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-light tracking-tight">
            Directory {list.data && <span className="text-sm text-muted-foreground tabular-nums">· {total.toLocaleString('en-IN')}</span>}
            {list.isPending && <Skeleton className="ml-1 inline-block h-3 w-6 rounded-full align-middle" />}
          </h2>
          <SegmentedControl
            label="Employment status"
            tone="hero"
            value={status}
            options={STATUS_SEGMENTS}
            onChange={(key) => update({ status: key === 'ACTIVE' ? null : key, page: null })}
          />
        </div>

        {/* a phone: the search on a line of its own, then the four buttons as an even 2 x 2 */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <div className="relative col-span-2 sm:min-w-60 sm:flex-1">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search" className="h-10 rounded-full pl-10" placeholder="Search name or employee code" value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && (
              <button type="button" aria-label="Clear search" onClick={() => setSearch('')} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            )}
          </div>
          <Button variant="secondary" className="h-10 rounded-full px-4" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal /> Filters
            {filterCount > 0 && <span className="grid size-5 place-items-center rounded-full bg-hero text-xs text-hero-foreground tabular-nums">{filterCount}</span>}
          </Button>
          <Button variant="secondary" className="h-10 rounded-full px-4" aria-expanded={columnsOpen} onClick={() => setColumnsOpen((open) => !open)}>
            <Columns3 /> Columns
          </Button>
          <SavedViews
            current={params}
            onOpen={(query) => {
              const next = new URLSearchParams(query)
              next.set('view', 'records')
              setParams(next, { replace: true })
            }}
          />
          <ExportButton load={() => client.employees.export(filters)} disabled={!total} />
        </div>


        {/* the columns to show - ticked ones in the table, in this order; kept in the address (and saved views) */}
        {columnsOpen && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2/70 p-3">
            <span className="mr-1 text-xs font-medium text-muted-foreground">Show columns</span>
            {COLUMNS.map((c) => {
              const on = shownColumns.includes(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleColumn(c.id)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    on ? 'bg-hero text-hero-foreground' : 'bg-card text-muted-foreground shadow-card hover:text-foreground',
                  )}
                >
                  {c.label}
                </button>
              )
            })}
            {params.get('cols') && (
              <button type="button" onClick={() => update({ cols: null })} className="ml-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                Default columns
              </button>
            )}
          </div>
        )}

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
              <span key={chip.key} className="inline-flex items-center gap-1 rounded-full bg-gold-soft py-1 pr-1.5 pl-3 text-xs font-medium">
                {chip.label}
                <button type="button" aria-label={`Remove ${chip.label}`} onClick={() => update({ ...chip.clear, page: null })} className="grid size-5 place-items-center rounded-full hover:bg-foreground/10">
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <button type="button" onClick={clearAll} className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Clear all
            </button>
          </div>
        )}

        {list.isPending ? (
          <RecordsTableSkeleton
            head={head}
            columns={COLUMNS.filter((c) => shownColumns.includes(c.id)).map((c) => ({ className: columnClass(c.id), ...CELL_SHAPE[c.id] }))}
            label="Loading employees"
          />
        ) : list.error ? (
          <p className="py-10 text-center text-sm text-negative-ink">{errorMessage(list.error)}</p>
        ) : list.data.items.length === 0 ? (
          <div className="u-hatch rounded-2xl py-12 text-center">
            <p className="text-sm font-medium">No employees match.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtered || chips.length > 0 ? 'Try fewer filters, another status, or a different search.' : 'Nobody has this status.'}
            </p>
            {(filtered || chips.length > 0) && (
              <Button variant="secondary" size="sm" className="mt-4" onClick={clearAll}>
                Clear search and filters
              </Button>
            )}
          </div>
        ) : (
          <div className={cn('overflow-x-auto transition-opacity', list.isFetching && 'opacity-60')}>
            <Table>
              <TableHeader>
                {head}
              </TableHeader>
              <TableBody>
                {list.data.items.map((e) => (
                  <TableRow key={e.employeeCode} className="group cursor-pointer" onClick={() => void navigate(`/manage/employees/${e.employeeCode}`)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Initials name={e.name} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{e.name}</p>
                          {/* a phone has no Status column - the status sits under the name, beside the code */}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="text-xs text-muted-foreground tabular-nums">{e.employeeCode}</p>
                            <div className="sm:hidden">{cellOf('status', e)}</div>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    {COLUMNS.filter((c) => shownColumns.includes(c.id)).map((c) => (
                      <TableCell key={c.id} className={columnClass(c.id)}>
                        {cellOf(c.id, e)}
                      </TableCell>
                    ))}
                    {/* the row opens the profile */}
                    <TableCell className="w-8 text-muted-foreground">
                      <ChevronRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4 text-sm text-muted-foreground">
            <span className="tabular-nums">
              Showing {first}–{last} of {total.toLocaleString('en-IN')}
            </span>
            {pages > 1 && (
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1 || list.isFetching} onClick={() => update({ page: page - 1 > 1 ? String(page - 1) : null })}>
                  <ChevronLeft /> Previous
                </Button>
                <span className="tabular-nums">
                  Page {page} of {pages}
                </span>
                <Button variant="secondary" size="sm" disabled={page >= pages || list.isFetching} onClick={() => update({ page: String(page + 1) })}>
                  Next <ChevronRight />
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      {filtersOpen && (
        <FiltersDrawer
          current={selection}
          currentManager={manager ? { employeeCode: manager, name: params.get('managerName') ?? manager } : null}
          names={names}
          baseInput={{ ...filters, ...toInput(emptySelection(), {}) }}
          onApply={(values, picked) => {
            update({
              ...Object.fromEntries(FILTERS.map((f) => [f.param, values[f.param].length ? values[f.param].join(',') : null])),
              manager: picked?.employeeCode ?? null,
              managerName: picked?.name ?? null,
              page: null,
            })
            setFiltersOpen(false)
          }}
          onClose={() => setFiltersOpen(false)}
        />
      )}
      {adding && <EmployeeDetailsDrawer onClose={() => setAdding(false)} onAdded={(code) => void navigate(`/manage/employees/${code}`)} />}
      {importing && <ImportEmployeesDrawer onClose={() => setImporting(false)} />}
    </div>
  )
}

const emptySelection = () => Object.fromEntries(FILTERS.map((f) => [f.param, []])) as unknown as Selection

// The list input of a selection of filter values, with the other inputs
function toInput(selection: Selection, rest: Omit<ListInput, 'companyIds' | 'plantIds' | 'workLocationIds' | 'departmentIds' | 'designationIds' | 'employmentTypes' | 'workforceCategories'>): ListInput {
  const input: Record<string, unknown> = { ...rest }
  for (const f of FILTERS) {
    const values = selection[f.param]
    input[f.input] = values.length ? (f.numeric ? values.map(Number) : values) : undefined
  }
  return input as ListInput
}

// A phone shows the employee (with the status under the name) and the columns HR added; the usual ones need the width
const PHONE_HIDDEN: ColumnId[] = ['role', 'company', 'joined', 'status']
// each column's value as the skeleton draws it: one line, two lines or a pill, as wide as a typical value
const CELL_SHAPE: Record<ColumnId, Omit<RecordsCell, 'className'>> = {
  role: { shape: 'lines', width: 'w-36' },
  company: { shape: 'pill-line', width: 'w-24' },
  department: { shape: 'line', width: 'w-28' },
  joined: { shape: 'lines', width: 'w-20' },
  type: { shape: 'line', width: 'w-20' },
  workforce: { shape: 'line', width: 'w-24' },
  manager: { shape: 'lines', width: 'w-32' },
  status: { shape: 'pill', width: 'w-16' },
}
const columnClass = (id: ColumnId) => cn('sm:pl-6', PHONE_HIDDEN.includes(id) && 'hidden sm:table-cell')

// One table cell of an optional column; an empty one is a single muted dash
function cellOf(id: ColumnId, e: EmployeeRow) {
  switch (id) {
    case 'role':
      return (
        <>
          <p>{e.designation?.name ?? <span className="text-muted-foreground">—</span>}</p>
          {e.department && <p className="text-xs text-muted-foreground">{e.department.name}</p>}
        </>
      )
    case 'company':
      return (
        <>
          <span className="inline-flex rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium" title={e.company.name}>
            {e.company.code}
          </span>
          {e.workLocation && <p className="mt-1 text-xs text-muted-foreground">{e.workLocation.name}</p>}
        </>
      )
    case 'department':
      return e.department?.name ?? <span className="text-muted-foreground">—</span>
    case 'joined':
      return (
        <>
          <p className="tabular-nums">{formatDate(e.dateOfJoining)}</p>
          <p className="text-xs text-muted-foreground">{e.status === 'EXITED' ? 'left' : tenure(e.dateOfJoining)}</p>
        </>
      )
    case 'type':
      return EMPLOYMENT_TYPE[e.employmentType]
    case 'workforce':
      return WORKFORCE[e.workforceCategory].replace(/ \(.*\)$/, '')
    case 'manager':
      return e.reportingManager ? (
        <>
          <p>{e.reportingManager.name}</p>
          <p className="text-xs text-muted-foreground tabular-nums">{e.reportingManager.employeeCode}</p>
        </>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case 'status':
      return (
        <div className="flex items-center gap-1.5">
          <Pill tone={STATUS_TONE[e.status]} className="max-sm:py-0.5">
            {STATUS_LABEL[e.status]}
          </Pill>
          {/* PF / ESIC numbers still to be recorded after joining */}
          {e.pendingNumbers.length > 0 && (
            <Pill tone="warning" className="max-sm:py-0.5">
              <span title={`Still to record: ${e.pendingNumbers.join(', ')}`}>Numbers pending</span>
            </Pill>
          )}
        </div>
      )
  }
}

// A column header that orders the list (an arrow shows the order in use)
function SortHead({
  label,
  field,
  className,
  current,
  direction,
  onSort,
}: {
  label: string
  field: SortKey
  className?: string
  current: SortKey
  direction: 'asc' | 'desc'
  onSort: (field: SortKey) => void
}) {
  const active = current === field
  return (
    <TableHead className={className} aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}>
      <button type="button" onClick={() => onSort(field)} className={cn('inline-flex items-center gap-1 hover:text-foreground', active && 'text-foreground')}>
        {label}
        {active ? direction === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" /> : null}
      </button>
    </TableHead>
  )
}

// The filters: several values per filter, each with how many employees it shows (counted with the other filters and the
// list's search / status) - the counts and the total follow the ticks as they change - and who they report to
function FiltersDrawer({
  current,
  currentManager,
  names,
  baseInput,
  onApply,
  onClose,
}: {
  current: Selection
  currentManager: PickedEmployee | null
  names: Record<FilterParam, Map<string, string>>
  baseInput: ListInput
  onApply: (values: Selection, manager: PickedEmployee | null) => void
  onClose: () => void
}) {
  const [values, setValues] = useState(current)
  const [manager, setManager] = useState(currentManager)
  // bumped by "Clear" so the manager box starts afresh (no typed text left in it)
  const [resets, setResets] = useState(0)
  // the counts and the total for the ticks as they are now
  const preview = useQuery({
    ...orpc.employees.list.queryOptions({
      input: { ...baseInput, ...toInput(values, {}), reportingManagerCode: manager?.employeeCode ?? undefined, page: 1, pageSize: 1 },
    }),
    placeholderData: keepPreviousData,
  })
  const toggle = (param: FilterParam, value: string) =>
    setValues((v) => ({ ...v, [param]: v[param].includes(value) ? v[param].filter((x) => x !== value) : [...v[param], value] }))
  const clearAll = () => {
    setValues(emptySelection())
    setManager(null)
    setResets((n) => n + 1)
  }
  const total = preview.data?.total
  // ticks or the manager changed and not applied yet
  const sameTicks = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))
  const dirty = FILTERS.some((f) => !sameTicks(values[f.param], current[f.param])) || (manager?.employeeCode ?? '') !== (currentManager?.employeeCode ?? '')
  return (
    <FormDrawer
      onClose={onClose}
      dirty={dirty}
      title="Filter employees"
      description="Tick as many as you like - the numbers say how many employees each would show. The status is chosen on the list."
      footer={
        <>
          <Button variant="ghost" onClick={clearAll}>
            Clear
          </Button>
          <DrawerCancel />
          <Button variant="gold" onClick={() => onApply(values, manager)}>
            {total === undefined ? 'Show employees' : `Show ${total.toLocaleString('en-IN')} employee${total === 1 ? '' : 's'}`}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {FILTERS.map((f) => (
          <FacetList
            key={f.param}
            label={f.label}
            selected={values[f.param]}
            counts={preview.data?.facets[f.facet] ?? []}
            names={names[f.param]}
            onToggle={(value) => toggle(f.param, value)}
            onClear={() => setValues((v) => ({ ...v, [f.param]: [] }))}
          />
        ))}
        <div className="space-y-1.5">
          <Label htmlFor="filter-manager" className="text-[13px]">
            Reports to
          </Label>
          <EmployeePicker
            key={resets}
            id="filter-manager"
            value={manager?.employeeCode ?? ''}
            initial={manager}
            placeholder="Anyone - type a manager's name or code"
            className="w-full"
            onChange={setManager}
          />
        </div>
      </div>
    </FormDrawer>
  )
}

// One filter's values as ticks with their counts: the ticked ones first, then the most common; a search box for a long
// list; values that would show nobody are left out (unless ticked)
function FacetList({
  label,
  selected,
  counts,
  names,
  onToggle,
  onClear,
}: {
  label: string
  selected: string[]
  counts: Facets[keyof Facets]
  names: Map<string, string>
  onToggle: (value: string) => void
  onClear: () => void
}) {
  const [find, setFind] = useState('')
  const [showAll, setShowAll] = useState(false)
  const countOf = new Map(counts.filter((c) => c.value !== null).map((c) => [String(c.value), c.count]))
  const notSet = counts.find((c) => c.value === null)?.count ?? 0
  const options = [...new Set([...selected, ...countOf.keys()])]
    .map((value) => ({ value, label: names.get(value) ?? '…', count: countOf.get(value) ?? 0, on: selected.includes(value) }))
    .filter((o) => !find || o.label.toLowerCase().includes(find.toLowerCase()))
    .sort((a, b) => Number(b.on) - Number(a.on) || b.count - a.count || a.label.localeCompare(b.label))
  const visible = showAll || find ? options : options.slice(0, 8)
  const id = `facet-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <fieldset className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <legend className="text-[13px] font-medium">
          {label}
          {selected.length > 0 && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{selected.length} ticked</span>}
        </legend>
        {selected.length > 0 && (
          <button type="button" onClick={onClear} className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Clear
          </button>
        )}
      </div>
      {countOf.size + selected.length > 8 && (
        <Input id={id} aria-label={`Find a ${label.toLowerCase()}`} className="h-8 rounded-full text-xs" placeholder={`Find a ${label.toLowerCase()}`} value={find} onChange={(e) => setFind(e.target.value)} />
      )}
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">{find ? 'Nothing matches.' : 'No employees to filter here.'}</p>
      ) : (
        <ul className="space-y-0.5">
          {visible.map((o) => (
            <li key={o.value}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm hover:bg-surface-2/70">
                <Checkbox checked={o.on} onCheckedChange={() => onToggle(o.value)} />
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                <span className={cn('text-xs tabular-nums', o.count ? 'text-muted-foreground' : 'text-muted-foreground/50')}>{o.count.toLocaleString('en-IN')}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {!find && options.length > 8 && (
        <button type="button" onClick={() => setShowAll((s) => !s)} className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          {showAll ? 'Show fewer' : `Show all ${options.length}`}
        </button>
      )}
      {notSet > 0 && <p className="text-xs text-muted-foreground">{notSet.toLocaleString('en-IN')} without one</p>}
    </fieldset>
  )
}

function StatTile({
  pending,
  label,
  value,
  hint,
  tone,
  selected,
  onClick,
}: {
  // the list is loading: the number is a bar
  pending: boolean
  label: string
  value: number | undefined
  hint: string
  tone?: 'hero' | 'hatched'
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'rounded-2xl px-4 py-3 text-left shadow-card transition-shadow hover:shadow-float focus-visible:ring-3 focus-visible:ring-gold/40 focus-visible:outline-none',
        tone === 'hero' ? 'bg-hero text-hero-foreground' : 'bg-card',
        tone === 'hatched' && 'u-hatch',
        selected && 'ring-2 ring-hero ring-offset-2 ring-offset-background',
      )}
    >
      <p className={cn('text-sm', tone === 'hero' ? 'text-hero-foreground/75' : 'text-muted-foreground')}>{label}</p>
      {pending ? (
        <p className="mt-0.5 flex h-9 items-center">
          <Skeleton className={cn('h-7 w-12 rounded-lg', tone === 'hero' && 'bg-hero-foreground/10')} />
        </p>
      ) : (
        <p className="mt-0.5 text-3xl font-light tracking-tight tabular-nums">{value === undefined ? '—' : value.toLocaleString('en-IN')}</p>
      )}
      <p className={cn('text-xs max-sm:hidden', tone === 'hero' ? 'text-hero-foreground/75' : 'text-muted-foreground')}>{hint}</p>
    </button>
  )
}

// The first letters of the first and last name, in a circle
function Initials({ name }: { name: EmployeeRow['name'] }) {
  const words = name.split(/\s+/).filter(Boolean)
  const letters = ((words[0]?.[0] ?? '') + (words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '')).toUpperCase()
  return (
    <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-gold-soft text-xs font-semibold text-foreground">
      {letters || '?'}
    </span>
  )
}

// "2 yrs 3 mos", "5 mos", "joined today" - how long since joining
function tenure(joined: Date) {
  const [y, m, d] = toDateInput(joined).split('-').map(Number) as [number, number, number]
  const now = new Date()
  let months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m)
  if (now.getDate() < d) months--
  if (months <= 0) {
    const days = Math.floor((now.getTime() - new Date(y, m - 1, d).getTime()) / 86400000)
    return days <= 0 ? 'joined today' : `${days} ${days === 1 ? 'day' : 'days'}`
  }
  const years = Math.floor(months / 12)
  const rest = months % 12
  return [years && `${years} ${years === 1 ? 'yr' : 'yrs'}`, rest && `${rest} ${rest === 1 ? 'mo' : 'mos'}`].filter(Boolean).join(' ')
}

