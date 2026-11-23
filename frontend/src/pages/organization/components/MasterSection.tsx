import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, BadgeCheck, Building2, Check, CircleAlert, Factory, FileText, type LucideIcon, MapPin, Pencil, Plus, Search } from 'lucide-react'
import { Children, Fragment, isValidElement, useEffect, useRef, useState } from 'react'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/FormError'
import { SearchableSelect } from '@/components/SearchableSelect'
import { MasterRowsSkeleton } from '@/components/skeletons/organization/MasterRowsSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { cn } from '@/lib/utils'

// One organization master (companies, plants, departments...) and - with Organization: Edit - add, change, retire /
// re-activate. Entries are never deleted (employees point to them); a retired one stays listed, dimmed and tagged.
// The rows can be shown three ways (redesigned 2026-11-21 - one plain table for every master read badly):
// - a table (`columns`): several facts per row (plants, cost centres, work locations); `groupBy` puts them under headings
// - a list (`item`): short entries in several columns (designations, grades, salary components); `dense`: one line each,
//   flowing down the columns, for a long list (departments). With `columns` too, the list is what a phone shows.
// - list + detail (`item` + `detail`): many facts per entry (companies) - the list on the left, the chosen one on the right
// Status chips (Active - the default - / Retired / All) and the page's own `filters` (e.g. "missing employer details") narrow the rows.

export type MasterRow = { id: number; isActive: boolean }
export type Field = {
  name: string
  label: string
  required?: boolean
  // required only when this returns true for the other values (e.g. the PIN code for an Indian address)
  requiredWhen?: (values: Values) => boolean
  // set only when adding (e.g. a location's company)
  createOnly?: boolean
  hint?: string
  options?: { value: string; label: string }[]
  upperCase?: boolean
  // whole numbers only: anything but digits is dropped while typing; the value is the maximum number of digits
  digitsOnly?: number
  // pre-filled when adding (e.g. IN, Asia/Kolkata)
  defaultValue?: string
  // shown only when this returns true (e.g. state only for India); a hidden field is saved empty
  showWhen?: (values: Values) => boolean
  // choices that depend on the other values (e.g. Indian states when the country is India); none = a text box
  optionsFor?: (values: Values) => { value: string; label: string }[] | undefined
  // heading the field is grouped under (fields keep their order; consecutive fields share a heading)
  section?: string
  // takes the whole row in a two-column form
  wide?: boolean
  // a multi-line text box (e.g. an address)
  multiline?: boolean
  // example text in an empty text box (dropdowns always say "Search <label>…")
  placeholder?: string
  // other fields emptied when this one changes (e.g. country -> state / region)
  clears?: string[]
  // an optional field that can be emptied when changing an entry: the change then holds '' (the page sends null)
  clearable?: boolean
}
// `wrap`: long text (a name, an address) - gets a real width and may run onto a second line; everything else (codes,
// numbers) stays on one line
export type Column<T> = { label: string; value: (row: T) => React.ReactNode; wrap?: boolean }
// One entry in the list views: `lead` a small badge in front (a rank, an order), `title` and `subtitle` (a code), `tags`
// after the title (e.g. "Overseas", a warning)
export type Item = { lead?: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode; tags?: React.ReactNode }
// A page filter shown as a chip with its count; `warning`: rows that need attention (amber when there are any)
export type Filter<T> = { key: string; label: string; test: (row: T) => boolean; warning?: boolean }
type Values = Record<string, string>
type Status = 'all' | 'active' | 'retired'

export function MasterSection<T extends MasterRow>({
  title,
  singular,
  rows,
  loading,
  columns,
  item,
  detail,
  groupBy,
  sort,
  dense,
  about,
  preview,
  searchText,
  filters,
  fields,
  canChange,
  shared,
  addShared,
  notice,
  toValues,
  create,
  update,
}: {
  title: string
  // "company", "location"... for button labels
  singular: string
  rows: T[]
  // still loading: a placeholder instead of "None yet"
  loading?: boolean
  // the table view
  columns?: Column<T>[]
  // the list view (and the left side of list + detail)
  item?: (row: T) => Item
  // list + detail: the chosen entry; `actions` are its Change / Retire buttons
  detail?: (row: T, actions: React.ReactNode) => React.ReactNode
  // headings for the table / list (rows keep their order inside a group; groups come in the order they first appear)
  groupBy?: (row: T) => { key: string | number; label: React.ReactNode }
  sort?: (a: T, b: T) => number
  // the list view as one-line entries flowing down the columns (a long list)
  dense?: boolean
  // one line under "Add <singular>" in the drawer: what the entry is for
  about?: React.ReactNode
  // the drawer's live preview: the entry as the list will show it, from what is typed so far
  preview?: (values: Values) => Item
  // what the search looks in (default: the text the columns / list entry show)
  searchText?: (row: T) => string
  filters?: Filter<T>[]
  fields: Field[]
  canChange: boolean
  // shared by every company (designations, regions...): changing it needs Organization Edit for all companies - else the
  // list is view only, with a line saying why (B13, 2026-11-21)
  shared?: boolean
  // only adding is shared (a new company); changing an entry is that company's own (checked by the backend)
  addShared?: boolean
  // one line above the rows (e.g. what a filter chip means)
  notice?: React.ReactNode
  // a row as form values (strings)
  toValues: (row: T) => Values
  create: (values: Values) => Promise<unknown>
  // `changes` = only the fields that changed (empty strings left out); `isActive` to retire / re-activate
  update: (id: number, changes: Values, isActive?: boolean) => Promise<unknown>
}) {
  const queryClient = useQueryClient()
  const group = useAccess().coversGroup('ORGANIZATION')
  const mayChange = canChange && (!shared || group)
  const mayAdd = mayChange && (!addShared || group)
  const [editing, setEditing] = useState<T | 'new' | null>(null)
  const done = () => void queryClient.invalidateQueries({ queryKey: orpc.organization.key() })
  const toggle = useMutation({ mutationFn: (row: T) => update(row.id, {}, !row.isActive), onSuccess: done })

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<Status>('active')
  const [filter, setFilter] = useState<string | null>(null)
  // the entry open on the right (list + detail; the first one until someone is picked)
  const [picked, setPicked] = useState<number | null>(null)

  const textOfRow =
    searchText ??
    ((row: T) => {
      if (columns) return columns.map((c) => textOf(c.value(row))).join(' ')
      const it = item?.(row)
      return it ? `${textOf(it.title)} ${textOf(it.subtitle)}` : ''
    })
  const retired = rows.filter((r) => !r.isActive).length
  const activeFilter = filters?.find((f) => f.key === filter)
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  // the rows of the chosen status (Active by default: retired entries only on asking)
  const base = rows.filter((row) => status === 'all' || row.isActive === (status === 'active'))
  const shown = base
    .filter((row) => !activeFilter || activeFilter.test(row))
    .filter((row) => {
      if (!words.length) return true
      const text = textOfRow(row).toLowerCase()
      return words.every((w) => text.includes(w))
    })
  if (sort) shown.sort(sort)
  const narrowed = shown.length !== base.length

  const actionsFor = (row: T, labelled?: boolean) =>
    mayChange && (
      <div className="flex shrink-0 justify-end gap-0.5">
        <Button
          variant={labelled ? 'secondary' : 'ghost'}
          size="sm"
          className={cn(!labelled && 'text-muted-foreground hover:text-foreground max-sm:size-9 max-sm:px-0', labelled && 'max-sm:h-9')}
          title={`Change this ${singular}`}
          aria-label={labelled ? undefined : `Change this ${singular}`}
          onClick={() => setEditing(row)}
        >
          <Pencil />
          {labelled && 'Change'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(!labelled && 'text-muted-foreground hover:text-foreground max-sm:size-9 max-sm:px-0', labelled && 'max-sm:h-9')}
          title={row.isActive ? 'Retire - it stays on existing records' : 'Re-activate'}
          aria-label={labelled ? undefined : row.isActive ? `Retire this ${singular}` : `Re-activate this ${singular}`}
          disabled={toggle.isPending}
          onClick={() => toggle.mutate(row)}
        >
          {row.isActive ? <Archive /> : <ArchiveRestore />}
          {labelled && (row.isActive ? 'Retire' : 'Re-activate')}
        </Button>
      </div>
    )

  const chips: { key: string; label: string; count: number; on: boolean; warning?: boolean; set: () => void }[] = [
    ...(retired > 0
      ? (
          [
            ['active', 'Active', rows.length - retired],
            ['retired', 'Retired', retired],
            ['all', 'All', rows.length],
          ] as const
        ).map(([key, label, count]) => ({ key, label, count, on: status === key, set: () => setStatus(key) }))
      : []),
    ...(filters ?? [])
      .map((f) => ({ f, count: rows.filter(f.test).length }))
      .filter(({ count }) => count > 0)
      .map(({ f, count }) => ({
        key: f.key,
        label: f.label,
        count,
        warning: f.warning,
        on: filter === f.key,
        set: () => setFilter((on) => (on === f.key ? null : f.key)),
      })),
  ]

  return (
    <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="flex items-baseline gap-2 text-lg font-light tracking-tight">
          {title}
          {loading ? (
            <Skeleton className="h-3 w-6 rounded-full" />
          ) : (
            <span className="text-xs font-normal tracking-normal text-muted-foreground tabular-nums">
              {narrowed ? `${shown.length} of ${base.length}` : base.length}
            </span>
          )}
        </h2>
        {chips.length > 0 && (
          <div role="group" aria-label="Show" className="flex flex-wrap gap-1 max-sm:order-last max-sm:w-full">
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-pressed={c.on}
                onClick={c.set}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors max-sm:h-9',
                  c.on
                    ? 'bg-hero text-hero-foreground'
                    : c.warning
                      ? 'bg-warning/15 text-warning-ink hover:bg-warning/25'
                      : 'bg-surface-2 text-muted-foreground hover:text-foreground',
                )}
              >
                {c.warning && <CircleAlert className="size-3.5" />}
                {c.label}
                <span className="tabular-nums opacity-70">{c.count.toLocaleString('en-IN')}</span>
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {rows.length >= 8 && (
            <div className="relative w-36 sm:w-56">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                aria-label={`Search ${title.toLowerCase()}`}
                placeholder="Search"
                className="h-9 rounded-full pl-8 sm:h-8"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          )}
          {mayAdd && (
            <Button variant="gold" size="sm" className="max-sm:h-9" onClick={() => setEditing('new')}>
              <Plus /> Add {singular}
            </Button>
          )}
        </div>
      </div>
      {notice && <p className="text-xs text-warning-ink">{notice}</p>}
      {canChange && !mayAdd && (
        <p className="text-xs text-muted-foreground">
          {mayChange ? `Adding a ${singular} needs` : `Shared by every company - changing it needs`} Organization: Edit for all companies.
        </p>
      )}
      <FormError error={toggle.error} />
      {loading ? (
        // the same view as the rows below, only the data missing
        detail && item ? (
          <MasterRowsSkeleton view="split" actions={mayChange} label={`Loading ${title.toLowerCase()}`} />
        ) : columns && item ? (
          <>
            <div className="max-sm:hidden">
              <MasterRowsSkeleton view="table" headings={columns.map((c) => c.label)} wide={columns.map((c) => !!c.wrap)} grouped={!!groupBy} actions={mayChange} label={`Loading ${title.toLowerCase()}`} />
            </div>
            <div className="sm:hidden">
              <MasterRowsSkeleton view="list" grouped={!!groupBy} label={`Loading ${title.toLowerCase()}`} />
            </div>
          </>
        ) : columns ? (
          <MasterRowsSkeleton view="table" headings={columns.map((c) => c.label)} wide={columns.map((c) => !!c.wrap)} grouped={!!groupBy} actions={mayChange} label={`Loading ${title.toLowerCase()}`} />
        ) : (
          <MasterRowsSkeleton view={dense ? 'dense' : 'list'} grouped={!!groupBy} label={`Loading ${title.toLowerCase()}`} />
        )
      ) : rows.length === 0 ? (
        <EmptyState title={`No ${title.toLowerCase()} yet`} hint={mayAdd ? `Add the first ${singular} with "Add ${singular}".` : undefined} />
      ) : shown.length === 0 ? (
        <p className="rounded-2xl bg-surface-2/50 px-3 py-6 text-sm text-muted-foreground">
          {words.length ? `Nothing matches "${query.trim()}".` : 'Nothing to show.'}
        </p>
      ) : detail && item ? (
        <SplitView rows={shown} item={item} detail={detail} picked={picked} onPick={setPicked} actionsFor={actionsFor} />
      ) : columns && item ? (
        <>
          <div className="max-sm:hidden">
            <TableView rows={shown} columns={columns} groupBy={groupBy} canChange={mayChange} actionsFor={actionsFor} />
          </div>
          <div className="sm:hidden">
            <ListView rows={shown} item={item} groupBy={groupBy} actionsFor={actionsFor} />
          </div>
        </>
      ) : columns ? (
        <TableView rows={shown} columns={columns} groupBy={groupBy} canChange={mayChange} actionsFor={actionsFor} />
      ) : item ? (
        <ListView rows={shown} item={item} groupBy={groupBy} dense={dense} actionsFor={actionsFor} />
      ) : null}

      {editing && (
        <MasterDialog
          singular={singular}
          preview={preview}
          // what a new one is for / which entry is being changed (the preview card shows it when there is one)
          description={editing === 'new' ? about : preview ? undefined : <Subject row={editing} item={item} columns={columns} />}
          fields={editing === 'new' ? fields : fields.filter((f) => !f.createOnly)}
          initial={editing === 'new' ? {} : toValues(editing)}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            if (editing === 'new') {
              await create(values)
            } else {
              const before = toValues(editing)
              const clearable = new Set(fields.filter((f) => f.clearable).map((f) => f.name))
              const changes = Object.fromEntries(Object.entries(values).filter(([k, v]) => v !== before[k] && (v !== '' || clearable.has(k))))
              await update(editing.id, changes)
            }
            done()
          }}
        />
      )}
    </section>
  )
}

// The entry a change drawer is about: its list entry (lead, name, code), or else its first column
function Subject<T extends MasterRow>({ row, item, columns }: { row: T; item?: (row: T) => Item; columns?: Column<T>[] }) {
  const it = item?.(row)
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-foreground">
      {it ? (
        <>
          {it.lead}
          <span className="font-medium">{it.title}</span>
          {it.subtitle && <span className="text-muted-foreground">{it.subtitle}</span>}
        </>
      ) : (
        columns?.[0]?.value(row)
      )}
      {!row.isActive && <RetiredTag />}
    </span>
  )
}

// "Retired" after an entry's name
export function RetiredTag() {
  return <span className="shrink-0 rounded-full border border-dashed border-border px-1.5 text-xs font-normal text-muted-foreground">Retired</span>
}

// Rows in groups (in the order the groups first appear)
function groupsOf<T>(rows: T[], groupBy: ((row: T) => { key: string | number; label: React.ReactNode }) | undefined) {
  if (!groupBy) return [{ key: '', label: null as React.ReactNode, rows }]
  const groups = new Map<string | number, { key: string | number; label: React.ReactNode; rows: T[] }>()
  for (const row of rows) {
    const { key, label } = groupBy(row)
    const group = groups.get(key) ?? groups.set(key, { key, label, rows: [] }).get(key)!
    group.rows.push(row)
  }
  return [...groups.values()]
}

// The table view: the first column keeps in view (with the retired tag) and the row's buttons stay on the right while a
// wide table scrolls sideways
function TableView<T extends MasterRow>({
  rows,
  columns,
  groupBy,
  canChange,
  actionsFor,
}: {
  rows: T[]
  columns: Column<T>[]
  groupBy?: (row: T) => { key: string | number; label: React.ReactNode }
  canChange: boolean
  actionsFor: (row: T) => React.ReactNode
}) {
  const [attachScroll, scroll] = useSideScroll(rows.length)
  const pinFirst = columns.length > 3
  const span = columns.length + (canChange ? 1 : 0)
  return (
    <div ref={attachScroll} className="relative">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((c, i) => (
              <TableHead key={c.label} className={cn('h-8 text-xs text-muted-foreground', i === 0 && pinFirst && PIN_LEFT, i === 0 && pinFirst && scroll.left && SHADE_RIGHT)}>
                {c.label}
              </TableHead>
            ))}
            {canChange && <TableHead className={cn('h-8', PIN_RIGHT, scroll.right && SHADE_LEFT)} />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupsOf(rows, groupBy).map((group) => (
            <Fragment key={group.key}>
              {groupBy && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={span} className="bg-surface-2/50 py-1.5">
                    <span className="sticky left-3 flex items-center gap-2 text-xs">
                      {group.label}
                      <span className="text-muted-foreground tabular-nums">· {group.rows.length}</span>
                    </span>
                  </TableCell>
                </TableRow>
              )}
              {group.rows.map((row) => (
                <TableRow key={row.id} className={cn('group/row', !row.isActive && 'text-muted-foreground')}>
                  {columns.map((c, i) => (
                    <TableCell
                      key={c.label}
                      className={cn(
                        'py-2',
                        c.wrap && 'min-w-44 whitespace-normal sm:min-w-56',
                        i === 0 && pinFirst && PIN_LEFT,
                        i === 0 && pinFirst && PIN_HOVER,
                        i === 0 && pinFirst && scroll.left && SHADE_RIGHT,
                      )}
                    >
                      {i === 0 && !row.isActive ? (
                        <span className="flex items-center gap-2">
                          {c.value(row)}
                          <RetiredTag />
                        </span>
                      ) : (
                        c.value(row)
                      )}
                    </TableCell>
                  ))}
                  {canChange && <TableCell className={cn('py-1 text-right', PIN_RIGHT, PIN_HOVER, scroll.right && SHADE_LEFT)}>{actionsFor(row)}</TableCell>}
                </TableRow>
              ))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
      {/* more to the right and no pinned buttons to carry the shade: a soft fade on the edge */}
      {scroll.right && !canChange && <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-card to-transparent" />}
    </div>
  )
}

// The list view: short entries in up to four columns, the buttons on the right of each (with a mouse: on hover)
function ListView<T extends MasterRow>({
  rows,
  item,
  groupBy,
  dense,
  actionsFor,
}: {
  rows: T[]
  item: (row: T) => Item
  groupBy?: (row: T) => { key: string | number; label: React.ReactNode }
  dense?: boolean
  actionsFor: (row: T) => React.ReactNode
}) {
  if (dense)
    return (
      <ul className="gap-x-4 sm:columns-2 lg:columns-3 xl:columns-4">
        {rows.map((row) => {
          const it = item(row)
          return (
            <li
              key={row.id}
              className={cn(
                'group/item relative flex min-h-8 break-inside-avoid items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-surface-2/70 max-sm:min-h-10',
                !row.isActive && 'text-muted-foreground',
              )}
            >
              <span className="min-w-0 flex-1 text-sm">
                <span className="font-medium">{it.title}</span>
                {it.subtitle && <span className="ml-1.5 text-xs text-muted-foreground">{it.subtitle}</span>}
              </span>
              {!row.isActive && <RetiredTag />}
              <HoverActions>{actionsFor(row)}</HoverActions>
            </li>
          )
        })}
      </ul>
    )
  return (
    <div className="space-y-3">
      {groupsOf(rows, groupBy).map((group) => (
        <section key={group.key} className="space-y-1.5">
          {groupBy && (
            <h3 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground after:h-px after:flex-1 after:bg-border">
              {group.label}
              <span className="font-normal tabular-nums">{group.rows.length}</span>
            </h3>
          )}
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {group.rows.map((row) => {
              const it = item(row)
              return (
                <li
                  key={row.id}
                  className={cn(
                    'group/item relative flex min-h-11 items-center gap-2.5 rounded-xl border py-1 pr-1 pl-2.5 transition-colors',
                    row.isActive ? 'border-border/70 hover:border-border hover:bg-surface-2/50' : 'border-dashed border-border text-muted-foreground',
                  )}
                >
                  {it.lead}
                  <span className="min-w-0 flex-1 py-0.5">
                    <span className="flex items-center gap-1.5">
                      <span className="line-clamp-2 text-sm font-medium break-words">{it.title}</span>
                      {it.tags}
                      {!row.isActive && <RetiredTag />}
                    </span>
                    {it.subtitle && <span className="block truncate text-xs text-muted-foreground">{it.subtitle}</span>}
                  </span>
                  <HoverActions>{actionsFor(row)}</HoverActions>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

// A list entry's buttons: with a mouse they float over the entry's right end on hover / focus (so a long list is not a
// wall of icons and the names get the whole width); on a touch screen they stay in place
function HoverActions({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return (
    <span className="shrink-0 pointer-fine:absolute pointer-fine:inset-y-0 pointer-fine:right-1 pointer-fine:flex pointer-fine:items-center pointer-fine:rounded-r-xl pointer-fine:bg-linear-to-l pointer-fine:from-card pointer-fine:from-70% pointer-fine:pl-6 pointer-fine:opacity-0 pointer-fine:group-focus-within/item:opacity-100! pointer-fine:group-hover/item:opacity-100!">
      {children}
    </span>
  )
}

// List + detail: the entries on the left, the chosen one on the right (on a phone, under its row - as the Department
// heads tab)
function SplitView<T extends MasterRow>({
  rows,
  item,
  detail,
  picked,
  onPick,
  actionsFor,
}: {
  rows: T[]
  item: (row: T) => Item
  detail: (row: T, actions: React.ReactNode) => React.ReactNode
  picked: number | null
  onPick: (id: number) => void
  actionsFor: (row: T, labelled?: boolean) => React.ReactNode
}) {
  const selected = rows.find((r) => r.id === picked) ?? rows[0]!
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
      <ul className="space-y-1 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:pr-1">
        {rows.map((row) => {
          const it = item(row)
          const on = row === selected
          return (
            <li key={row.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onPick(row.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-2xl px-2.5 py-2 text-left transition-colors',
                  on ? 'bg-hero text-hero-foreground shadow-card' : 'hover:bg-surface-2/80',
                  !row.isActive && !on && 'text-muted-foreground',
                )}
              >
                {it.lead}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{it.title}</span>
                    {!row.isActive && <RetiredTag />}
                  </span>
                  {it.subtitle && <span className={cn('block truncate text-xs', on ? 'text-hero-muted' : 'text-muted-foreground')}>{it.subtitle}</span>}
                </span>
                {it.tags}
              </button>
              {on && <div className="mt-1 mb-2 rounded-2xl border border-border/70 p-3 lg:hidden">{detail(row, actionsFor(row, true))}</div>}
            </li>
          )
        })}
      </ul>
      <div className="border-l border-border/70 pl-5 max-lg:hidden">{detail(selected, actionsFor(selected, true))}</div>
    </div>
  )
}

function MasterDialog({
  singular,
  preview,
  description,
  fields,
  initial,
  onClose,
  onSave,
}: {
  singular: string
  preview?: (values: Values) => Item
  description?: React.ReactNode
  fields: Field[]
  initial: Values
  onClose: () => void
  onSave: (values: Values) => Promise<void>
}) {
  const isNew = Object.keys(initial).length === 0
  // the values the form opened with - anything different is unsaved input
  const [start] = useState<Values>(() =>
    Object.fromEntries(fields.map((f) => [f.name, initial[f.name] ?? (isNew ? (f.defaultValue ?? '') : '')])),
  )
  const [values, setValues] = useState<Values>(start)
  const dirty = fields.some((f) => (values[f.name] ?? '') !== (start[f.name] ?? ''))
  const visible = fields.filter((f) => !f.showWhen || f.showWhen(values))
  // after saving, the drawer slides out and then calls onClose
  const [saved, setSaved] = useState(false)
  const save = useMutation({
    mutationFn: () => onSave(Object.fromEntries(fields.map((f) => [f.name, visible.includes(f) ? values[f.name]! : '']))),
    onSuccess: () => setSaved(true),
  })
  const isRequired = (f: Field) => f.required || (f.requiredWhen?.(values) ?? false)
  const emptyRequired = visible.filter((f) => isRequired(f) && !values[f.name]?.trim()).length
  const missing = emptyRequired > 0
  const twoColumns = fields.length > 5
  // changing an entry: the fields changed so far (each marked, with what it was)
  const changed = isNew ? [] : visible.filter((f) => (values[f.name] ?? '') !== (start[f.name] ?? ''))
  const shownAs = (f: Field, value: string) => (f.optionsFor ? f.optionsFor(start) : f.options)?.find((o) => o.value === value)?.label ?? value
  const required = visible.filter(isRequired)
  const sections = sectionsOf(visible)
  // the section cards, for the section bar to scroll to
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const sectionState = (items: Field[]) =>
    items.some((f) => isRequired(f) && !values[f.name]?.trim()) ? 'missing' : items.some((f) => changed.includes(f)) ? 'changed' : 'done'

  return (
    <FormDrawer
      onClose={onClose}
      closed={saved}
      dirty={dirty && !saved}
      title={isNew ? `Add ${singular}` : `Change ${singular}`}
      description={description}
      width={fields.length > 5 ? 680 : 460}
      footer={
        <>
          <span className="mr-auto text-xs text-muted-foreground tabular-nums">
            {/* why Save is off: required fields still empty (e.g. a company from the VBMS import) */}
            {emptyRequired > 0 && (!isNew || dirty) ? (
              <span className="font-medium text-warning-ink">
                {emptyRequired} required {emptyRequired === 1 ? 'field' : 'fields'} (<span className="text-destructive">*</span>) still empty
                {changed.length > 0 && <span className="font-normal text-muted-foreground"> · {changed.length} {changed.length === 1 ? 'change' : 'changes'}</span>}
              </span>
            ) : isNew ? (
              <>
                <span className="text-destructive">*</span> required
              </>
            ) : changed.length ? (
              <span className="font-medium text-foreground">
                {changed.length} {changed.length === 1 ? 'change' : 'changes'}
              </span>
            ) : (
              'No changes yet'
            )}
          </span>
          <DrawerCancel />
          <Button variant="gold" disabled={missing || (!isNew && !dirty) || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      {/* stays on top while the form scrolls: the live preview and - for a long form - the section bar */}
      <div className="sticky top-0 z-10 -mx-6 space-y-2 bg-card px-6 pb-2">
        {preview && <PreviewCard item={preview({ ...initial, ...values })} singular={singular} filled={required.length - emptyRequired} total={required.length} />}
        {sections.length > 1 && (
          <nav aria-label="Sections" className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
            {sections.map(({ heading, items }) => {
              const Icon = SECTION_ICONS[heading] ?? FileText
              const state = sectionState(items)
              return (
                <button
                  key={heading}
                  type="button"
                  onClick={() => sectionRefs.current[heading]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-hero hover:text-hero-foreground"
                >
                  <Icon className="size-3.5" />
                  {heading}
                  {state === 'missing' ? (
                    <span aria-label="fields missing" className="size-1.5 rounded-full bg-warning" />
                  ) : state === 'changed' ? (
                    <span aria-label="changed" className="size-1.5 rounded-full bg-gold" />
                  ) : (
                    <Check aria-label="complete" className="size-3.5 text-positive-ink" />
                  )}
                </button>
              )
            })}
          </nav>
        )}
      </div>
      {sections.map(({ heading, items }) => (
        <section
          key={heading || 'fields'}
          ref={(el) => {
            sectionRefs.current[heading] = el
          }}
          className={cn('scroll-mt-36 space-y-3', heading && 'rounded-2xl border border-border/70 p-3 transition-colors focus-within:border-foreground/25 sm:p-4')}
        >
          {heading && <SectionHeading heading={heading} state={sectionState(items)} />}
          <div className={cn('grid gap-x-4 gap-y-4', twoColumns && 'sm:grid-cols-2')}>
            {items.map((f) => {
              const id = `master-${f.name}`
              const options = f.optionsFor ? f.optionsFor(values) : f.options
              const set = (value: string) =>
                setValues((v) =>
                  v[f.name] === value ? v : { ...v, ...Object.fromEntries((f.clears ?? []).map((other) => [other, ''])), [f.name]: value },
                )
              return (
                <div key={f.name} className={cn('space-y-1.5', f.wide && 'sm:col-span-2')}>
                  <Label htmlFor={id} className="text-[13px]">
                    {f.label}
                    {isRequired(f) && (
                      <span aria-hidden className="text-destructive">
                        *
                      </span>
                    )}
                    {changed.includes(f) && <span className="ml-auto rounded-full bg-gold-soft px-1.5 text-xs font-normal">changed</span>}
                  </Label>
                  {options && options.length > 3 ? (
                    <SearchableSelect
                      id={id}
                      placeholder={`Search ${f.label.toLowerCase()}…`}
                      value={values[f.name] ?? ''}
                      options={options}
                      onChange={set}
                    />
                  ) : options ? (
                    <NativeSelect id={id} className="w-full" value={values[f.name]} onChange={(e) => set(e.target.value)}>
                      {!f.defaultValue && <NativeSelectOption value="">Choose…</NativeSelectOption>}
                      {options.map((o) => (
                        <NativeSelectOption key={o.value} value={o.value}>
                          {o.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  ) : f.multiline ? (
                    <Textarea
                      id={id}
                      rows={2}
                      placeholder={f.placeholder}
                      value={values[f.name]}
                      onChange={(e) => set(e.target.value)}
                      className="min-h-16 resize-none"
                    />
                  ) : (
                    <Input
                      id={id}
                      placeholder={f.placeholder}
                      value={values[f.name]}
                      inputMode={f.digitsOnly ? 'numeric' : undefined}
                      onChange={(e) => {
                        const raw = e.target.value
                        set(f.digitsOnly ? raw.replace(/\D/g, '').slice(0, f.digitsOnly) : f.upperCase ? raw.toUpperCase() : raw)
                      }}
                    />
                  )}
                  {changed.includes(f) ? (
                    <p className="truncate text-xs text-muted-foreground">
                      Was: <span className="text-foreground">{start[f.name] ? shownAs(f, start[f.name]!) : 'empty'}</span>
                    </p>
                  ) : (
                    f.hint && <p className="text-xs leading-relaxed text-muted-foreground">{f.hint}</p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}
      <FormError error={save.error} />
    </FormDrawer>
  )
}

// A form section's icon (by its heading)
const SECTION_ICONS: Record<string, LucideIcon> = { Company: Building2, Plant: Factory, Registrations: BadgeCheck, Address: MapPin }

function SectionHeading({ heading, state }: { heading: string; state: 'missing' | 'changed' | 'done' }) {
  const Icon = SECTION_ICONS[heading] ?? FileText
  return (
    <h3 className="flex items-center gap-2 text-sm font-medium">
      <span className="grid size-7 place-items-center rounded-lg bg-surface-2 text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      {heading}
      <span className="ml-auto text-xs font-normal">
        {state === 'missing' ? (
          <span className="text-warning-ink">Needs filling</span>
        ) : state === 'changed' ? (
          <span className="rounded-full bg-gold-soft px-1.5">Changed</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-positive-ink">
            <Check className="size-3.5" /> Complete
          </span>
        )}
      </span>
    </h3>
  )
}

// The drawer's live preview: the entry as the list will show it, and how many required fields are filled
function PreviewCard({ item, singular, filled, total }: { item: Item; singular: string; filled: number; total: number }) {
  const hasTitle = textOf(item.title).trim() !== ''
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-hero p-3 text-hero-foreground shadow-card">
      {item.lead}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-hero-muted">Preview</p>
        <p className="truncate text-base font-medium">{hasTitle ? item.title : <span className="text-hero-muted">New {singular}</span>}</p>
        {item.subtitle && textOf(item.subtitle).trim() !== '' && <p className="truncate text-xs text-hero-muted">{item.subtitle}</p>}
      </div>
      {total > 0 && <ProgressRing filled={filled} total={total} />}
    </div>
  )
}

// Required fields filled, as a ring ("4/6"; a tick when all are)
function ProgressRing({ filled, total }: { filled: number; total: number }) {
  const r = 16
  const length = 2 * Math.PI * r
  const done = filled >= total
  return (
    <span className="relative grid size-11 shrink-0 place-items-center" title={`${filled} of ${total} required fields filled`}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="20" cy="20" r={r} fill="none" strokeWidth="3.5" className="stroke-hero-foreground/15" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - filled / total)}
          className={cn('transition-[stroke-dashoffset] duration-500', done ? 'stroke-positive' : 'stroke-gold')}
        />
      </svg>
      {done ? <Check className="size-4 text-positive" /> : <span className="text-xs font-semibold tabular-nums">{`${filled}/${total}`}</span>}
    </span>
  )
}

// A column that stays in view while the table scrolls sideways (the first one; the row's buttons), with a soft shade on
// the side the rest of the table slides under
const PIN_LEFT = 'sticky left-0 z-10 bg-card'
const PIN_RIGHT = 'sticky right-0 z-10 bg-card'
const PIN_HOVER = 'group-hover/row:bg-[color-mix(in_srgb,var(--muted)_50%,var(--card))]'
const SHADE_RIGHT = 'after:pointer-events-none after:absolute after:inset-y-0 after:left-full after:w-5 after:bg-linear-to-r after:from-foreground/12 after:to-transparent'
const SHADE_LEFT = 'before:pointer-events-none before:absolute before:inset-y-0 before:right-full before:w-5 before:bg-linear-to-l before:from-foreground/12 before:to-transparent'

// Whether the table inside `ref` can still be scrolled to the left / right (for the shades above); `rowCount`: looked
// at again when the rows change
function useSideScroll(rowCount: number) {
  // the wrapper, kept as state (a callback ref) so the effect runs once it is on the page
  const [wrapper, setWrapper] = useState<HTMLDivElement | null>(null)
  const [state, setState] = useState({ left: false, right: false })
  useEffect(() => {
    const box = wrapper?.querySelector<HTMLElement>('[data-slot="table-container"]')
    if (!box) return
    const read = () => {
      const left = box.scrollLeft > 1
      const right = box.scrollLeft + box.clientWidth < box.scrollWidth - 1
      setState((s) => (s.left === left && s.right === right ? s : { left, right }))
    }
    read()
    box.addEventListener('scroll', read, { passive: true })
    const observer = new ResizeObserver(read)
    observer.observe(box)
    if (box.firstElementChild) observer.observe(box.firstElementChild)
    return () => {
      box.removeEventListener('scroll', read)
      observer.disconnect()
    }
  }, [wrapper, rowCount])
  return [setWrapper, state] as const
}

// The text a cell shows (for the search)
function textOf(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join(' ')
  if (isValidElement<{ children?: React.ReactNode }>(node)) return Children.toArray(node.props.children).map(textOf).join(' ')
  return ''
}

// Consecutive fields with the same `section` form one group
function sectionsOf(fields: Field[]) {
  const groups: { heading: string; items: Field[] }[] = []
  for (const field of fields) {
    const heading = field.section ?? ''
    const last = groups.at(-1)
    if (last && last.heading === heading) last.items.push(field)
    else groups.push({ heading, items: [field] })
  }
  return groups
}
