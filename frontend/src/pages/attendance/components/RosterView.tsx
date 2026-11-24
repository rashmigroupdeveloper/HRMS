import { ExportButton } from '@/components/ExportButton'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, Search, Send, X } from 'lucide-react'
import { useState } from 'react'
import { EmployeePicker, type PickedEmployee } from '@/components/EmployeePicker'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { RosterRowsSkeleton } from '@/components/skeletons/attendance/SetupSkeleton'
import { Button } from '@/components/ui/button'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { client, orpc } from '@/lib/orpc'
import { cn, formatDate, fromDateInput, toDateInput, todayDay } from '@/lib/utils'
import { ROSTER_HINT } from './labels'

const DAY = 86_400_000
// the Monday of a day's week
const mondayOf = (d: Date) => new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY)

type Planned = { kind: string; shiftId: number | null; holiday: string | null; halfDay: boolean }

// The roster - exceptions only (the user, 2026-11-22), a part of the attendance setup (Attendance setup: View sees it, Edit
// changes it - managers no longer roster): every day follows the person's schedule pattern (Schedules); the
// roster holds only rare one-off changes. Listed: the days in two weeks that differ from the default,
// as a draft until published (attendance follows only published days). "Change a day" adds one; setting a day
// back to its default takes it off. A published day also changes through an approved shift-change request.
// A warning: less than 11 hours of rest, or more than 48 hours that week (publishing is still allowed).
export function RosterView() {
  const queryClient = useQueryClient()
  const [start, setStart] = useState(() => mondayOf(todayDay()))
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const to = new Date(start.getTime() + 13 * DAY)
  const grid = useQuery({
    ...orpc.attendance.rosters.grid.queryOptions({ input: { from: start, to, search: search.trim() || undefined, onlyChanges: true } }),
    placeholderData: keepPreviousData,
  })
  const refresh = () => void queryClient.invalidateQueries({ queryKey: orpc.attendance.key() })
  const save = useMutation(orpc.attendance.rosters.save.mutationOptions({ onSuccess: refresh }))
  const clear = useMutation(orpc.attendance.rosters.clear.mutationOptions({ onSuccess: refresh }))
  const publish = useMutation(orpc.attendance.rosters.publish.mutationOptions({ onSuccess: refresh }))
  const data = grid.data
  const shiftCode = (id: number | null | undefined) => (id === null ? 'Off' : (data?.shifts.find((s) => s.id === id)?.code ?? '?'))
  const defaultLabel = (p: Planned) => (p.kind === 'HOLIDAY' ? `Holiday${p.holiday ? ` (${p.holiday})` : ''}` : p.kind === 'WEEKLY_OFF' ? 'Off' : `${shiftCode(p.shiftId)}${p.halfDay ? ' (half day)' : ''}`)
  // every changed day, by date then name
  const changes = (data?.rows ?? [])
    .flatMap((row) => row.cells.filter((c) => c.entry).map((c) => ({ row, cell: c, entry: c.entry! })))
    .sort((a, b) => a.cell.date.getTime() - b.cell.date.getTime() || a.row.name.localeCompare(b.row.name))
  const drafts = changes.filter((c) => !c.entry.published)
  const busy = save.isPending || clear.isPending

  // back to the default: a draft is taken out; a published day (HR) is set to the default, which takes its row out
  const remove = (employeeCode: string, date: Date, published: boolean, planned: Planned) => {
    if (!published) clear.mutate({ cells: [{ employeeCode, date }] })
    else save.mutate({ cells: [{ employeeCode, date, shiftId: planned.kind === 'WEEKLY_OFF' ? null : planned.shiftId! }] })
  }

  return (
    <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ExportButton className="order-last" disabled={!data?.rows.length || grid.isFetching} load={() => client.attendance.rosters.export({from:start,to,search:search.trim()||undefined,onlyChanges:true})} />
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" aria-label="Previous two weeks" onClick={() => setStart(new Date(start.getTime() - 14 * DAY))}>
              <ChevronLeft />
            </Button>
            <span className="text-sm font-medium tabular-nums">
              {formatDate(start)} – {formatDate(to)}
            </span>
            <Button variant="ghost" size="icon" aria-label="Next two weeks" onClick={() => setStart(new Date(start.getTime() + 14 * DAY))}>
              <ChevronRight />
            </Button>
          </div>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-9 w-full rounded-full pl-9 sm:w-48" placeholder="Name or code" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        {data?.canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
              <Plus /> Change a day
            </Button>
            {/* gold only when there is something to publish */}
            {drafts.length > 0 && (
              <Button
                variant="gold"
                size="sm"
                disabled={publish.isPending}
                onClick={() => publish.mutate({ employeeCodes: [...new Set(drafts.map((d) => d.row.employeeCode))], from: start, to })}
              >
                <Send /> {publish.isPending ? 'Publishing…' : `Publish ${drafts.length} draft day${drafts.length === 1 ? '' : 's'}`}
              </Button>
            )}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{ROSTER_HINT}</p>
      <FormError error={grid.error ?? save.error ?? clear.error ?? publish.error} />
      {publish.data && <p className="rounded-2xl bg-positive/10 px-4 py-2 text-sm text-positive-ink">Published {publish.data.published} day(s) - attendance follows them now.</p>}
      {grid.isPending && <RosterRowsSkeleton label="Loading the roster" />}
      {data && changes.length === 0 && (
        <EmptyState
          className="py-6"
          title="No changes in these two weeks"
          hint={search.trim() ? 'Nobody matches the search.' : 'Everyone follows their schedule pattern.'}
        />
      )}
      {changes.length > 0 && (
        <div className={cn('overflow-x-auto', grid.isFetching && 'opacity-70')}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-28">Day</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead className="hidden sm:table-cell">Default</TableHead>
                <TableHead>Changed to</TableHead>
                <TableHead className="text-right">Status</TableHead>
                {data?.canEdit && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {changes.map(({ row, cell, entry }) => {
                const canRemove = data!.canEdit && (!entry.published || (cell.planned.kind !== 'HOLIDAY' && !cell.planned.halfDay))
                return (
                  <TableRow key={`${row.employeeCode}-${cell.date.toISOString()}`}>
                    <TableCell className="tabular-nums">{formatDate(cell.date)}</TableCell>
                    <TableCell className="max-w-0 sm:max-w-none">
                      <p className="truncate font-medium">{row.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.employeeCode}</p>
                    </TableCell>
                    <TableCell className="hidden text-xs text-foreground/70 sm:table-cell">{defaultLabel(cell.planned)}</TableCell>
                    <TableCell>
                      <span className="font-medium">{shiftCode(entry.shiftId)}</span>
                      {cell.warnings.length > 0 && <p className="text-xs text-negative-ink">{cell.warnings.join(' · ')}</p>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Pill tone={entry.published ? 'positive' : 'gold'}>{entry.published ? 'Published' : 'Draft'}</Pill>
                    </TableCell>
                    {data?.canEdit && (
                      <TableCell className="text-right">
                        {canRemove && (
                          <Button variant="ghost" size="icon" aria-label={`Back to the default for ${row.name} on ${formatDate(cell.date)}`} disabled={busy} onClick={() => remove(row.employeeCode, cell.date, entry.published, cell.planned)}>
                            <X />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {adding && data && <ChangeDayDialog shifts={data.shifts} onClose={() => setAdding(false)} />}
    </section>
  )
}

// One day of one person: a shift or off - saved as a draft (HR's change to a published day stays published). Shows what
// the day is by default; choosing that takes the day off the roster.
function ChangeDayDialog({ shifts, onClose }: { shifts: { id: number; code: string; name: string; start: string; end: string }[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [person, setPerson] = useState<PickedEmployee | null>(null)
  const [date, setDate] = useState(toDateInput(new Date(todayDay().getTime() + DAY)))
  const [value, setValue] = useState('')
  const day = fromDateInput(date)
  // the person's default that day (and a change already there)
  const current = useQuery({
    ...orpc.attendance.rosters.grid.queryOptions({ input: { from: day ?? todayDay(), to: day ?? todayDay(), search: person?.employeeCode } }),
    enabled: !!person && !!day,
  })
  const cell = current.data?.rows.find((r) => r.employeeCode === person?.employeeCode)?.cells[0]
  const code = (id: number | null) => (id === null ? 'Off' : (shifts.find((s) => s.id === id)?.code ?? '?'))
  const save = useMutation(
    orpc.attendance.rosters.save.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.attendance.key() })
        onClose()
      },
    }),
  )
  return (
    <FormDialog onOpenChange={(open) => !open && onClose()} dirty={!!person || value !== ''} className="rounded-3xl sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Change a day</DialogTitle>
        <DialogDescription>A one-off change from the person&apos;s schedule pattern. It is a draft until published.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="cd-person" className="text-xs text-muted-foreground">
            Employee
          </Label>
          <EmployeePicker id="cd-person" value={person?.employeeCode ?? ''} onChange={setPerson} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cd-date" className="text-xs text-muted-foreground">
              Day
            </Label>
            <Input id="cd-date" type="date" className="h-10 rounded-xl" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd-value" className="text-xs text-muted-foreground">
              Works
            </Label>
            <NativeSelect id="cd-value" className="w-full [&_select]:h-10 [&_select]:rounded-xl" value={value} onChange={(e) => setValue(e.target.value)}>
              <NativeSelectOption value="">Choose…</NativeSelectOption>
              {shifts.map((s) => (
                <NativeSelectOption key={s.id} value={String(s.id)}>
                  {s.code} · {s.start}–{s.end}
                </NativeSelectOption>
              ))}
              <NativeSelectOption value="off">Off</NativeSelectOption>
            </NativeSelect>
          </div>
        </div>
        {cell && (
          <p className="text-xs text-muted-foreground">
            By default that day: <span className="font-medium text-foreground">{cell.planned.kind === 'HOLIDAY' ? 'Holiday' : cell.planned.kind === 'WEEKLY_OFF' ? 'Off' : code(cell.planned.shiftId)}</span>
            {cell.entry && ` · changed to ${code(cell.entry.shiftId)} (${cell.entry.published ? 'published' : 'draft'})`}
          </p>
        )}
      </div>
      <FormError error={save.error ?? current.error} />
      <DialogFooter>
        <DialogCancel />
        <Button
          variant="gold"
          disabled={!person || !day || !value || save.isPending}
          onClick={() => save.mutate({ cells: [{ employeeCode: person!.employeeCode, date: day!, shiftId: value === 'off' ? null : Number(value) }] })}
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </FormDialog>
  )
}
