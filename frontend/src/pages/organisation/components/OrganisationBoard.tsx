import { type ReactNode, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { ExportButton } from '@/components/ExportButton'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EMPLOYMENT_TYPE, JOINING_TYPE, WORKFORCE } from '@/lib/choices'
import { cn } from '@/lib/utils'
import { BOARD_CAPTION, BOARD_TITLE, CLASS_GROUPS, COLUMNS, COUNT_NOTE, DEPARTMENT_CAPTION, DRILL_CAPTION, GROUPING_LABEL, GROUPINGS, type Grouping, MONTH_LABEL, ROW, SPLIT_LABEL, SUMMARY_LABEL, VIEWS, type BoardView } from '../labels'

type Counts = {
  headcount: number
  active: number
  onNotice: number
  joined: number
  left: number
  employmentType: Record<string, number>
  workforceCategory: Record<string, number>
  joiningType: Record<string, number>
  // null: not shown here (the role does not see personal details of everyone in the row)
  gender: Record<string, number> | null
  grade: Record<string, number>
  designation: Record<string, number>
}
type Breakdown = { key: 'gender' | 'grade' | 'designation'; label: string; values: { key: string; label: string }[] }
type Slice = Counts & { companyId: number; plantId: number | null; departmentId: number | null; code: string; name: string; place: string | null }
type Board = { level: 'COMPANY' | 'DEPARTMENT' | 'NONE'; company: { id: number; code: string; name: string } | null; slices: Slice[]; totals: Counts; period: { from: Date; to: Date }; breakdowns: Breakdown[] }
type BaseGroup = (typeof CLASS_GROUPS)[number]['key']
type Group = BaseGroup | Breakdown['key']
// one classification value, as Employee records filters it (its address parameter)
export type PeopleFilter = { param: 'type' | 'workforce' | 'joining' | 'grade' | 'designation'; value: string }
// the people behind a count: one company / department (null = everyone on the board), optionally one classification value
export type PeopleHref = (slice: Slice | null, filter?: PeopleFilter) => string
// the joiners or leavers of the board's period behind a count (the joiners & leavers report)
export type MovementHref = (slice: Slice | null, kind: 'JOINER' | 'LEAVER') => string

// the department rows added up per plant (a plant row: no department; `place` keeps the plant's label)
function byPlant(slices: Slice[]): Slice[] {
  const plants = new Map<number, Slice & { departments: number }>()
  for (const s of slices) {
    if (s.plantId === null) continue
    const plant = plants.get(s.plantId) ?? {
      ...s, departmentId: null, code: '', name: s.place ?? '', place: null, departments: 0,
      headcount: 0, active: 0, onNotice: 0, joined: 0, left: 0, employmentType: {}, workforceCategory: {}, joiningType: {},
      gender: s.gender && {}, grade: {}, designation: {},
    }
    plant.departments++
    for (const key of ['headcount', 'active', 'onNotice', 'joined', 'left'] as const) plant[key] += s[key]
    for (const key of [...CLASS_GROUPS.map((g) => g.key), 'grade', 'designation'] as const) for (const [k, v] of Object.entries(s[key])) plant[key][k] = (plant[key][k] ?? 0) + v
    if (!s.gender) plant.gender = null
    else if (plant.gender) for (const [k, v] of Object.entries(s.gender)) plant.gender[k] = (plant.gender[k] ?? 0) + v
    plants.set(s.plantId, plant)
  }
  return [...plants.values()].map(({ departments, ...plant }) => ({ ...plant, place: `${departments} ${departments === 1 ? 'department' : 'departments'}` }))
}

// every value of each classification, in reading order, with its colour (the chart tokens)
const PARTS: Record<BaseGroup, { key: string; color: string }[]> = {
  employmentType: [
    { key: 'PERMANENT', color: 'bg-chart-3' },
    { key: 'CONTRACT', color: 'bg-chart-4' },
    { key: 'TRAINEE', color: 'bg-chart-1' },
    { key: 'CONSULTANT', color: 'bg-chart-2' },
    { key: 'APPRENTICE', color: 'bg-chart-5' },
  ],
  workforceCategory: [
    { key: 'WHITE_COLLAR', color: 'bg-chart-3' },
    { key: 'BLUE_COLLAR', color: 'bg-chart-4' },
  ],
  joiningType: [
    { key: 'REGULAR', color: 'bg-chart-3' },
    { key: 'CONSULTANT_INTERN', color: 'bg-chart-1' },
    { key: 'OVERSEAS', color: 'bg-chart-2' },
  ],
}
const LABELS: Record<BaseGroup, Record<string, string>> = { employmentType: EMPLOYMENT_TYPE, workforceCategory: WORKFORCE, joiningType: JOINING_TYPE }
// gender opens nobody: Employee records has no gender filter, as it would show gender to roles without personal details
const PARAM: Record<Group, PeopleFilter['param'] | null> = { employmentType: 'type', workforceCategory: 'workforce', joiningType: 'joining', gender: null, grade: 'grade', designation: 'designation' }
const PALETTE = ['bg-chart-3', 'bg-chart-4', 'bg-chart-1', 'bg-chart-2', 'bg-chart-5']
const OTHER_COLOR = 'bg-muted-foreground/35'
// the overview draws the board's biggest few values of a long list (grades, designations) and puts the rest in "Other"
const SHOWN = 4
const NONE = 'NONE'

type Value = { key: string; label: string; color: string; other?: boolean }
// every value of each group, in reading order, with its colour; `top` = the values the overview draws on their own
function groupsOf(board: Board) {
  const groups: { key: Group; label: string; values: Value[]; top: Set<string> }[] = CLASS_GROUPS.map((group) => {
    const values = PARTS[group.key].map((part) => ({ ...part, label: LABELS[group.key][part.key] ?? part.key }))
    return { key: group.key, label: group.label, values, top: new Set(values.map((v) => v.key)) }
  })
  for (const b of board.breakdowns) {
    const record = b.key === 'gender' ? (board.totals.gender ?? {}) : board.totals[b.key]
    const biggest = [...b.values].sort((x, y) => (record[y.key] ?? 0) - (record[x.key] ?? 0)).slice(0, b.values.length > SHOWN + 1 ? SHOWN : SHOWN + 1)
    const colorOf = new Map(biggest.map((v, i) => [v.key, PALETTE[i % PALETTE.length]!]))
    const values = b.values.map((v) => ({ ...v, color: colorOf.get(v.key) ?? OTHER_COLOR }))
    groups.push({ key: b.key, label: b.label, values, top: new Set(biggest.map((v) => v.key)) })
  }
  return groups
}
type BoardGroup = ReturnType<typeof groupsOf>[number]
const recordOf = (group: Group, counts: Counts) => (group === 'gender' ? counts.gender : counts[group])
const linkable = (group: Group, key: string) => PARAM[group] !== null && key !== NONE

const count = (n: number) => n.toLocaleString('en-IN')
const share = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

// the values with someone (null: not shown here); the values outside `top` added up as "Other"
function partsOf(group: BoardGroup, counts: Counts) {
  const record = recordOf(group.key, counts)
  if (!record) return null
  const parts: (Value & { value: number })[] = []
  let other = 0
  for (const v of group.values) {
    const value = record[v.key] ?? 0
    if (value === 0) continue
    if (group.top.has(v.key)) parts.push({ ...v, value })
    else other += value
  }
  return other > 0 ? [...parts, { key: 'OTHER', label: 'Other', color: OTHER_COLOR, other: true, value: other }] : parts
}
const NOT_SHOWN = 'Not shown - your role does not see personal details of everyone here'
const describe = (parts: NonNullable<ReturnType<typeof partsOf>>) => parts.map((p) => `${count(p.value)} ${p.label}`).join(', ')

function SplitBar({ parts, total, className }: { parts: NonNullable<ReturnType<typeof partsOf>>; total: number; className?: string }) {
  return (
    <div className={cn('flex h-2 w-full gap-0.5 overflow-hidden rounded-full', className)}>
      {parts.map((p) => <span key={p.key} className={cn('h-full min-w-1 first:rounded-l-full last:rounded-r-full', p.color)} style={{ width: `${(p.value / total) * 100}%` }} />)}
    </div>
  )
}

function Segments<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { key: T; label: string }[]; onChange: (key: T) => void }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full bg-surface-2 p-0.5">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={value === option.key}
          onClick={() => onChange(option.key)}
          className={cn('rounded-full px-3 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring', value === option.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

// a count that opens the people behind it (no link for nobody, or without `href`)
function CountLink({ value, href, label, className }: { value: number; href?: string; label: string; className?: string }) {
  if (value === 0) return <span className={cn('text-muted-foreground/60', className)}>–</span>
  if (!href) return <span className={className}>{count(value)}</span>
  return <Link to={href} aria-label={label} className={cn('rounded underline decoration-muted-foreground/40 decoration-dotted underline-offset-4 outline-none hover:decoration-foreground hover:decoration-solid focus-visible:ring-2 focus-visible:ring-ring', className)}>{count(value)}</Link>
}

const DARK = { band: 'bg-hero text-hero-foreground', muted: 'text-hero-muted', track: 'bg-hero-foreground/10', notice: 'text-gold' }
const LIGHT = { band: 'bg-card', muted: 'text-muted-foreground', track: 'bg-surface-2', notice: 'text-warning-ink' }

// Company rows open a department board (`companyHref`); department rows open their people (`peopleHref`, given only with
// access to Employee records) unless `onSelect` makes them buttons (the HOD page picks a post). The table shows every
// classification value as a column; each count opens those people. `onExport`: the same board as Excel.
// `limit` + `moreHref`: a short version for a home page, linking to the whole board. `light`: a light summary, for a
// page that already has a dark block above it.
// Department boards group by department or by plant (the departments added up). Joined / left: the board's period
// (this month), each count opening the joiners & leavers report (`movementHref`).
export function OrganisationBoard({ board, companyHref, peopleHref, movementHref, onBack, onSelect, onExport, heading = 'h2', limit, moreHref, light = false }: {
  board: Board
  companyHref?: (companyId: number) => string
  peopleHref?: PeopleHref
  movementHref?: MovementHref
  onBack?: () => void
  onSelect?: (slice: Slice) => void
  onExport?: () => Promise<Blob>
  heading?: 'h1' | 'h2'
  limit?: number
  moreHref?: string
  light?: boolean
}) {
  const [lens, setLens] = useState<Group>('employmentType')
  const [view, setView] = useState<BoardView>('overview')
  const [grouping, setGrouping] = useState<Grouping>('department')
  if (board.level === 'NONE') return null
  const isCompanies = board.level === 'COMPANY' && !board.company
  const byPlants = !isCompanies && grouping === 'plant'
  const caption = board.company ? DRILL_CAPTION : isCompanies ? BOARD_CAPTION : DEPARTMENT_CAPTION
  const Title = heading
  const groups = groupsOf(board)
  const lensGroup = groups.find((g) => g.key === lens) ?? groups[0]!
  const sorted = [...(byPlants ? byPlant(board.slices) : board.slices)].sort((a, b) => b.headcount - a.headcount || a.name.localeCompare(b.name))
  const rows = limit ? sorted.slice(0, limit) : sorted
  const lensLabel = lensGroup.label
  const totals = board.totals
  const tone = light ? LIGHT : DARK
  const select = byPlants ? undefined : onSelect
  const rowHref = (slice: Slice) => (isCompanies ? companyHref?.(slice.companyId) : select ? undefined : peopleHref?.(slice))
  const rowsLabel = isCompanies ? 'Companies' : byPlants ? 'Plants' : 'Departments'
  const nameColumn = isCompanies ? COLUMNS.companies : byPlants ? COLUMNS.plants : COLUMNS.departments
  return (
    <section className="space-y-4" aria-labelledby="organisation-board-title">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {board.company && onBack && (
            <nav aria-label="Breadcrumb" className="mb-1.5 flex items-center gap-1 text-sm text-muted-foreground">
              <button type="button" onClick={onBack} className="-ml-1 inline-flex items-center gap-0.5 rounded-md px-1 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                <ChevronLeft aria-hidden className="size-4" />{BOARD_TITLE}
              </button>
              <span aria-hidden>/</span>
              <span className="truncate text-foreground">{board.company.code}</span>
            </nav>
          )}
          <Title id="organisation-board-title" className={cn('leading-tight font-light tracking-tight', heading === 'h1' ? 'text-[26px] sm:text-[30px]' : 'text-xl')}>
            {board.company?.name ?? BOARD_TITLE}
          </Title>
          <p className="mt-1 text-sm text-muted-foreground">{caption}</p>
        </div>
        <div className="flex items-center gap-2">
          {peopleHref && (
            <Link to={peopleHref(null)} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm outline-none hover:bg-card/70 focus-visible:ring-2 focus-visible:ring-ring">
              View people <ArrowRight aria-hidden className="size-4" />
            </Link>
          )}
          {onExport && <ExportButton load={onExport} title="Export these counts to Excel" />}
        </div>
      </header>

      {/* the summary: everyone covered, and each classification as one bar */}
      <div className={cn('grid gap-5 rounded-3xl p-5 shadow-card sm:p-6 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] lg:gap-8', tone.band)}>
        <div>
          <p className={cn('text-xs', tone.muted)}>{SUMMARY_LABEL}</p>
          <p className="mt-1 text-[44px] leading-none font-light tracking-tight tabular-nums">{count(totals.headcount)}</p>
          <p className={cn('mt-2 text-xs', tone.muted)}>
            <span className="tabular-nums">{count(totals.active)}</span> active · <span className={cn('tabular-nums', totals.onNotice > 0 && tone.notice)}>{count(totals.onNotice)}</span> on notice
          </p>
          <p className={cn('mt-3 text-xs', tone.muted)}>{MONTH_LABEL}</p>
          <p className="mt-1 flex gap-4 text-sm">
            <span><CountLink value={totals.joined} href={movementHref?.(null, 'JOINER')} label="Joined this month: view them" /> joined</span>
            <span><CountLink value={totals.left} href={movementHref?.(null, 'LEAVER')} label="Left this month: view them" /> left</span>
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-6">
        {groups.map((group) => {
          const parts = partsOf(group, totals)
          return (
            <div key={group.key} className="min-w-0">
              <p className={cn('text-xs', tone.muted)}>{group.label}</p>
              {parts === null ? <p className={cn('mt-3 text-sm', tone.muted)}>{NOT_SHOWN}</p> : parts.length === 0 ? <p className={cn('mt-3 text-sm', tone.muted)}>Nobody yet</p> : (
                <>
                  <SplitBar parts={parts} total={totals.headcount} className={cn('mt-3', tone.track)} />
                  <ul className="mt-3 space-y-1.5" aria-label={`${group.label}: ${describe(parts)}`}>
                    {parts.map((p) => {
                      const param = PARAM[group.key]
                      const href = param && linkable(group.key, p.key) && !p.other ? peopleHref?.(null, { param, value: p.key }) : undefined
                      const body = (
                        <>
                          <span aria-hidden className={cn('size-2 shrink-0 rounded-full', p.color)} />
                          <span className="min-w-0 flex-1 truncate">{p.label}</span>
                          <span className="tabular-nums">{count(p.value)}</span>
                          <span className={cn('w-9 text-right text-xs tabular-nums', tone.muted)}>{share(p.value, totals.headcount)}%</span>
                        </>
                      )
                      return (
                        <li key={p.key}>
                          {href
                            ? <Link to={href} aria-label={`${p.label}: ${count(p.value)} - view people`} className="-mx-1.5 flex items-center gap-2 rounded-md px-1.5 text-sm outline-none hover:bg-current/5 focus-visible:ring-2 focus-visible:ring-ring">{body}</Link>
                            : <span className="flex items-center gap-2 text-sm">{body}</span>}
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </div>
          )
        })}
        </div>
      </div>

      <div className="rounded-3xl bg-card shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3 sm:px-6">
          <h3 className="text-base font-normal">
            {rowsLabel} <span className="text-muted-foreground tabular-nums">{count(sorted.length)}</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {view === 'overview' && (
              <>
                <span className="hidden text-xs text-muted-foreground sm:inline">{SPLIT_LABEL}</span>
                <Segments label={SPLIT_LABEL} value={lensGroup.key} options={groups} onChange={setLens} />
              </>
            )}
            {!isCompanies && <Segments label={GROUPING_LABEL} value={grouping} options={GROUPINGS} onChange={setGrouping} />}
            <Segments label="View" value={view} options={VIEWS} onChange={setView} />
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="border-t border-border/60 px-5 py-8 text-sm text-muted-foreground sm:px-6">Nobody is working here now.</p>
        ) : view === 'table' ? (
          <BoardTable groups={groups} rows={rows} totals={totals} nameColumn={nameColumn} rowHref={rowHref} onSelect={select} peopleHref={peopleHref} movementHref={movementHref} />
        ) : (
          <>
            {/* one row per company or department, biggest first */}
            <div className={cn(ROW, 'hidden border-y border-border/60 py-2 text-[11px] text-muted-foreground md:grid')} aria-hidden>
              <span>{nameColumn}</span>
              <span className="text-right">{COLUMNS.people}</span>
              <span>{lensLabel}</span>
              <span />
            </div>
            <ul className="divide-y divide-border/60 border-t border-border/60 md:border-t-0">
              {rows.map((slice) => {
                const href = rowHref(slice)
                const parts = partsOf(lensGroup, slice)
                const label = `${slice.name}${slice.place ? `, ${slice.place}` : ''}: ${count(slice.headcount)} working now. ${lensLabel}: ${parts ? describe(parts) || 'nobody' : 'not shown'}`
                return (
                  <li key={keyOf(slice)}>
                    <Row href={href} onClick={select ? () => select(slice) : undefined} label={label}>
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{slice.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[slice.code, slice.place].filter(Boolean).join(' · ')}
                          {slice.joined > 0 && <span className="text-positive-ink"> · {count(slice.joined)} joined</span>}
                          {slice.left > 0 && <span className="text-negative-ink"> · {count(slice.left)} left</span>}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block text-lg leading-none font-light tabular-nums">{count(slice.headcount)}</span>
                        <span className={cn('mt-1 block text-[11px] tabular-nums', slice.onNotice > 0 ? 'text-warning-ink' : 'text-muted-foreground')}>
                          {slice.onNotice > 0 ? `${count(slice.onNotice)} on notice` : `${share(slice.headcount, totals.headcount)}% of all`}
                        </span>
                      </span>
                      <span className="col-span-2 min-w-0 md:col-span-1">
                        {parts === null ? <span className="text-xs text-muted-foreground">Not shown</span> : parts.length === 0 ? <span className="text-xs text-muted-foreground">Nobody</span> : (
                          <>
                            <SplitBar parts={parts} total={slice.headcount} className="bg-surface-2" />
                            <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                              {parts.map((p) => (
                                <span key={p.key} className="inline-flex items-center gap-1">
                                  <span aria-hidden className={cn('size-1.5 rounded-full', p.color)} />
                                  <span className="text-foreground tabular-nums">{count(p.value)}</span> {p.label}
                                </span>
                              ))}
                            </span>
                          </>
                        )}
                      </span>
                      <span className="hidden justify-end md:flex">{(href || select) && <ChevronRight aria-hidden className="size-4 text-muted-foreground" />}</span>
                    </Row>
                  </li>
                )
              })}
            </ul>
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-5 py-3 sm:px-6">
          <p className="text-[11px] text-muted-foreground">{COUNT_NOTE}</p>
          {moreHref && (
            <Link to={moreHref} className="inline-flex items-center gap-1 rounded-md text-xs outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
              {limit && sorted.length > limit ? `All ${count(sorted.length)}` : 'Open the dashboard'} <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

const keyOf = (slice: Slice) => `${slice.companyId}-${slice.plantId ?? 'all'}-${slice.departmentId ?? 'all'}`

// Every classification value as a column, grouped; the total last. Counts open those people.
function BoardTable({ groups: all, rows, totals, nameColumn, rowHref, onSelect, peopleHref, movementHref }: {
  groups: BoardGroup[]
  rows: Slice[]
  totals: Counts
  nameColumn: string
  rowHref: (slice: Slice) => string | undefined
  onSelect?: (slice: Slice) => void
  peopleHref?: PeopleHref
  movementHref?: MovementHref
}) {
  const groups = all.filter((group) => group.values.length > 0)
  const num = 'text-right tabular-nums'
  const edge = 'border-l border-border/60'
  const cells = (slice: Slice | null, counts: Counts) =>
    groups.flatMap((group) => {
      const record = recordOf(group.key, counts)
      const param = PARAM[group.key]
      return group.values.map((part, i) => (
        <TableCell key={`${group.key}-${part.key}`} className={cn(num, i === 0 && edge)}>
          {record === null ? <span title={NOT_SHOWN} className="text-muted-foreground/60">·</span> : (
            <CountLink
              value={record[part.key] ?? 0}
              href={param && linkable(group.key, part.key) ? peopleHref?.(slice, { param, value: part.key }) : undefined}
              label={`${slice?.name ?? 'Everyone'}, ${part.label}: view people`}
            />
          )}
        </TableCell>
      ))
    })
  const movementCells = (slice: Slice | null, counts: Counts) => (
    <>
      <TableCell className={cn(num, edge)}><CountLink value={counts.joined} href={movementHref?.(slice, 'JOINER')} label={`${slice?.name ?? 'Everyone'}: joined this month`} className={counts.joined ? 'text-positive-ink' : undefined} /></TableCell>
      <TableCell className={num}><CountLink value={counts.left} href={movementHref?.(slice, 'LEAVER')} label={`${slice?.name ?? 'Everyone'}: left this month`} className={counts.left ? 'text-negative-ink' : undefined} /></TableCell>
    </>
  )
  return (
    <Table className="text-sm">
      <TableHeader>
        <TableRow className="border-t border-border/60 hover:bg-transparent">
          <TableHead rowSpan={2} className="sticky left-0 z-10 min-w-44 bg-card pl-5 align-bottom sm:pl-6">{nameColumn}</TableHead>
          <TableHead colSpan={3} className={cn('text-center text-[11px]', edge)}>{COLUMNS.people}</TableHead>
          <TableHead colSpan={2} className={cn('text-center text-[11px]', edge)}>{MONTH_LABEL}</TableHead>
          {groups.map((group) => <TableHead key={group.key} colSpan={group.values.length} className={cn('text-center text-[11px]', edge)}>{group.label}</TableHead>)}
        </TableRow>
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(num, edge)}>Working now</TableHead>
          <TableHead className={num}>Active</TableHead>
          <TableHead className={num}>On notice</TableHead>
          <TableHead className={cn(num, edge)}>Joined</TableHead>
          <TableHead className={num}>Left</TableHead>
          {groups.flatMap((group) => group.values.map((part, i) => (
            <TableHead key={`${group.key}-${part.key}`} className={cn(num, 'whitespace-nowrap', i === 0 && edge)}>{part.label}</TableHead>
          )))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((slice) => {
          const href = rowHref(slice)
          return (
            <TableRow key={keyOf(slice)}>
              <TableCell className="sticky left-0 z-10 max-w-64 bg-card pl-5 sm:pl-6">
                {href ? <Link to={href} className="block truncate rounded outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">{slice.name}</Link>
                  : onSelect ? <button type="button" onClick={() => onSelect(slice)} className="block max-w-full truncate rounded text-left outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">{slice.name}</button>
                  : <span className="block truncate">{slice.name}</span>}
                <span className="block truncate text-xs text-muted-foreground">{[slice.code, slice.place].filter(Boolean).join(' · ')}</span>
              </TableCell>
              <TableCell className={cn(num, edge, 'font-medium')}><CountLink value={slice.headcount} href={peopleHref?.(slice)} label={`${slice.name}: view people`} /></TableCell>
              <TableCell className={num}>{slice.active ? count(slice.active) : <span className="text-muted-foreground/60">–</span>}</TableCell>
              <TableCell className={cn(num, slice.onNotice > 0 && 'text-warning-ink')}>{slice.onNotice ? count(slice.onNotice) : <span className="text-muted-foreground/60">–</span>}</TableCell>
              {movementCells(slice, slice)}
              {cells(slice, slice)}
            </TableRow>
          )
        })}
      </TableBody>
      <TableFooter className="bg-surface-2/60 font-medium">
        <TableRow className="hover:bg-transparent">
          <TableCell className="sticky left-0 z-10 bg-surface-2 pl-5 sm:pl-6">Total</TableCell>
          <TableCell className={cn(num, edge)}><CountLink value={totals.headcount} href={peopleHref?.(null)} label="Everyone: view people" /></TableCell>
          <TableCell className={num}>{count(totals.active)}</TableCell>
          <TableCell className={num}>{count(totals.onNotice)}</TableCell>
          {movementCells(null, totals)}
          {cells(null, totals)}
        </TableRow>
      </TableFooter>
    </Table>
  )
}

function Row({ href, onClick, label, children }: { href?: string; onClick?: () => void; label: string; children: ReactNode }) {
  const className = cn(ROW, 'w-full py-3.5 text-left outline-none focus-visible:bg-surface-2/60')
  if (href) return <Link to={href} aria-label={label} className={cn(className, 'hover:bg-surface-2/50')}>{children}</Link>
  if (onClick) return <button type="button" onClick={onClick} aria-label={label} className={cn(className, 'hover:bg-surface-2/50')}>{children}</button>
  return <div aria-label={label} className={className}>{children}</div>
}
