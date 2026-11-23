import { useQuery } from '@tanstack/react-query'
import { Expand, Minimize2, Minus, Plus, Search, Shrink, X } from 'lucide-react'
import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { FormError } from '@/components/FormError'
import { OrgChartSkeleton } from '@/components/skeletons/employees/OrgChartSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { orpc } from '@/lib/orpc'
import { cn, initialsOf } from '@/lib/utils'
import { type Colleague, ColleagueCard } from './ColleagueCard'

// The Org chart tab of the People page (the user, 2026-11-21 - "this is the org chart ui", like greytHR): a top-down tree
// from the top of the focused person's reporting line (default: oneself), opened along the way down to them. Under each
// card: how many report to them (a click opens their team, loaded then) or "–" (closes it). A click on a card shows its
// basic card at the side. Zoom in / out, fit (only shrinks a tree that does not fit), full screen; "Find someone" moves the focus. Any logged-in employee - basic
// fields only (employees.orgChart).

// a colour per level (the left edge of the cards), as in the example
const LEVEL = ['border-l-gold', 'border-l-info', 'border-l-positive', 'border-l-warning']

export function OrgChartView({ employeeCode, onMove }: { employeeCode: string | null; onMove: (employeeCode: string) => void }) {
  const focus = useQuery(orpc.employees.orgChart.queryOptions({ input: employeeCode ? { employeeCode } : undefined }))
  const [zoom, setZoom] = useState(1)
  const [picked, setPicked] = useState<Colleague | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const tree = useRef<HTMLUListElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const [full, setFull] = useState(false)
  const data = focus.data
  // the top of the reporting line, and the codes down to the focused person (opened)
  const top = data ? (data.managers.at(-1) ?? data.person) : null
  const path = data ? [...data.managers.map((m) => m.employeeCode), data.person.employeeCode] : []
  const focusCode = data?.person.employeeCode

  // the focused person in view once their branch is drawn
  useEffect(() => {
    if (!focusCode) return
    // scrolls only the chart's own box (scrollIntoView would move the whole page too)
    const timer = setTimeout(() => {
      const view = box.current
      const card = view?.querySelector<HTMLElement>(`[data-code="${focusCode}"]`)
      if (!view || !card) return
      const v = view.getBoundingClientRect()
      const c = card.getBoundingClientRect()
      view.scrollBy({ left: c.left - v.left - (v.width - c.width) / 2, top: c.top - v.top - (v.height - c.height) / 2, behavior: 'smooth' })
    }, 400)
    return () => clearTimeout(timer)
  }, [focusCode])

  // fit: the tree's own size (the list, not its full-width frame - measuring that made the chart smaller each time, the
  // user 2026-11-21) against the box; only shrinks, never past 100%
  const fit = () => {
    if (!box.current || !tree.current) return
    const width = tree.current.offsetWidth + 32
    const height = tree.current.offsetHeight + 48
    setZoom(Math.max(0.3, Math.min(1, box.current.clientWidth / width, box.current.clientHeight / height)))
  }
  // full screen: the chart alone on the screen (Esc or the button leaves it)
  useEffect(() => {
    const change = () => setFull(document.fullscreenElement === frame.current)
    document.addEventListener('fullscreenchange', change)
    return () => document.removeEventListener('fullscreenchange', change)
  }, [])
  const toggleFull = () => (document.fullscreenElement ? void document.exitFullscreen() : void frame.current?.requestFullscreen?.())
  const step = (by: number) => setZoom((z) => Math.round(Math.max(0.3, Math.min(1.5, z + by)) * 10) / 10)

  return (
    <div className="space-y-3">
      <FormError error={focus.error} />
      <div ref={frame} className={cn('relative bg-card', full ? 'flex flex-col' : 'rounded-2xl shadow-card')}>
        <div className="border-b p-3">
          <Jump onPick={onMove} />
        </div>
        <div ref={box} className={cn('overflow-auto', full ? 'min-h-0 flex-1' : 'h-[calc(100svh-15rem)] min-h-96')}>
          {!top ? (
            focus.isPending && <OrgChartSkeleton className="px-4 py-6" label="Loading the org chart" />
          ) : (
            <div style={{ zoom }} className="inline-block min-w-full px-4 py-6">
              <ul ref={tree} className="mx-auto flex w-max justify-center">
                {/* drawn afresh for each focused person, so their branch opens (the tree remembers what is open) */}
                <Branch key={focusCode} c={top} depth={0} path={path} focusCode={focusCode} onPick={setPicked} root />
              </ul>
            </div>
          )}
        </div>
        {/* zoom in, out, fit, full screen (bottom left - the card opens on the right) */}
        <div className="absolute bottom-3 left-3 flex flex-col gap-1 rounded-xl bg-card p-1 shadow-card">
          <Button variant="ghost" size="icon" aria-label="Zoom in" onClick={() => step(0.1)}>
            <Plus />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Zoom out" onClick={() => step(-0.1)}>
            <Minus />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Fit the chart on the screen" title="Fit on the screen" onClick={fit}>
            <Shrink />
          </Button>
          <Button variant="ghost" size="icon" aria-label={full ? 'Leave full screen' : 'Full screen'} title={full ? 'Leave full screen' : 'Full screen'} onClick={toggleFull}>
            {full ? <Minimize2 /> : <Expand />}
          </Button>
        </div>
        {picked && (
          <div className="absolute top-16 right-3 z-10 w-[min(26rem,calc(100%-1.5rem))]">
            <div className="relative">
              <Button variant="ghost" size="icon" aria-label="Close" className="absolute top-2 right-2 z-10" onClick={() => setPicked(null)}>
                <X />
              </Button>
              <ColleagueCard
                c={picked}
                onPick={(code) => {
                  setPicked(null)
                  onMove(code)
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// One person and, when opened, their team below - the lines are the borders of the list items (the classic CSS tree)
function Branch({
  c,
  depth,
  path,
  focusCode,
  onPick,
  root = false,
}: {
  c: Colleague
  depth: number
  path: string[]
  focusCode: string | undefined
  onPick: (c: Colleague) => void
  root?: boolean
}) {
  const [open, setOpen] = useState(path.slice(0, -1).includes(c.employeeCode))
  const team = useQuery({ ...orpc.employees.orgChart.queryOptions({ input: { employeeCode: c.employeeCode } }), enabled: open && c.directReports > 0 })
  const reports = team.data?.reports ?? []
  return (
    <li
      className={cn(
        'relative flex flex-col items-center px-2',
        // the joining lines: a half line to each side on top, and the line down into the card
        !root &&
          'pt-5 before:absolute before:top-0 before:right-1/2 before:h-5 before:w-1/2 before:border-t before:border-border after:absolute after:top-0 after:left-1/2 after:h-5 after:w-1/2 after:border-t after:border-l after:border-border first:before:border-0 last:after:border-0 last:before:border-r only:pt-5 only:before:hidden only:after:block only:after:border-t-0 only:after:border-l',
      )}
    >
      <button
        type="button"
        data-code={c.employeeCode}
        onClick={() => onPick(c)}
        className={cn(
          'flex w-60 items-center gap-2.5 rounded-xl border border-l-4 bg-card px-3 py-2 text-left shadow-card transition-colors hover:bg-surface-2',
          LEVEL[depth % LEVEL.length],
          c.employeeCode === focusCode && 'outline-2 outline-offset-2 outline-gold',
        )}
      >
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-muted-foreground">
          {initialsOf(c.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{c.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{c.designation ?? '—'}</span>
          <span className="block truncate text-xs text-muted-foreground tabular-nums">{c.employeeCode}</span>
        </span>
      </button>
      {c.directReports > 0 && (
        <>
          <span aria-hidden className="h-2 w-px bg-border" />
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? `Close ${c.name}'s team` : `Open ${c.name}'s team (${c.directReports})`}
            onClick={() => setOpen(!open)}
            className="min-w-7 rounded-md border bg-card px-1.5 text-xs text-muted-foreground tabular-nums shadow-card hover:text-foreground"
          >
            {open ? '–' : c.directReports}
          </button>
        </>
      )}
      {open && c.directReports > 0 && (
        <>
          <span aria-hidden className="h-5 w-px bg-border" />
          {team.isPending ? (
            <OrgChartSkeleton root={false} depth={depth + 1} team={Math.min(c.directReports, 4)} label={`Loading ${c.name}'s team`} />
          ) : (
            <ul className="flex justify-center">
              {reports.map((r) => (
                <Branch key={r.employeeCode} c={r} depth={depth + 1} path={path} focusCode={focusCode} onPick={onPick} />
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  )
}

// "Find someone": the directory search, the first few matches - the chart moves to them
function Jump({ onPick }: { onPick: (employeeCode: string) => void }) {
  const [text, setText] = useState('')
  const search = useDeferredValue(text.trim())
  const found = useQuery({ ...orpc.employees.directory.queryOptions({ input: { search, pageSize: 8 } }), enabled: search.length >= 2 })
  return (
    <div className="relative max-w-sm">
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input aria-label="Find someone in the chart" placeholder="Find someone - name or employee code" className="rounded-xl pl-9" value={text} onChange={(e) => setText(e.target.value)} />
      {search.length >= 2 && found.data && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl bg-popover p-1 shadow-card">
          {found.data.items.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Nobody found</li>}
          {found.data.items.map((c) => (
            <li key={c.employeeCode}>
              <button
                type="button"
                onClick={() => {
                  onPick(c.employeeCode)
                  setText('')
                }}
                className="w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-surface-2"
              >
                {c.name} <span className="text-muted-foreground tabular-nums">{c.employeeCode}</span>
                <span className="block truncate text-xs text-muted-foreground">{[c.designation, c.company.code].filter(Boolean).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
