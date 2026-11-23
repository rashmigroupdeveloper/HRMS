import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Search, Star, Trash2, Upload, X } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmployeePicker, type PickedEmployee } from '@/components/EmployeePicker'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/FormError'
import { SharedListNote } from '@/components/SharedListNote'
import { Pill } from '@/components/Pill'
import { PatternRowsSkeleton, ScheduleRowsSkeleton, ShiftRowsSkeleton, UploadRowsSkeleton } from '@/components/skeletons/attendance/SetupSkeleton'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAccess } from '@/hooks/useAccess'
import { client, orpc } from '@/lib/orpc'
import { cn, formatDate, formatDoneBy, fromDateInput, toDateInput, todayDay } from '@/lib/utils'
import { segment, SEGMENTS, SETUP_PARTS, UPLOAD_HINT, UPLOAD_TITLE, type Shift, WEEKDAYS } from './labels'
import { AppliesFrom, UpcomingPill } from './AppliesFrom'
import { MonthLockSetup } from './MonthLockSetup'
import { PoliciesSetup } from './PoliciesSetup'
import { RosterView } from './RosterView'

// The attendance setup (its own area since 2026-11-22 - Attendance setup: View, changing it: Edit): its parts are
// SETUP_PARTS (labels.ts); the open one is in the address (?part=roster - 2026-11-22)
type Part = (typeof SETUP_PARTS)[number][0]

export function SetupView() {
  const [params, setParams] = useSearchParams()
  const asked = params.get('part')
  const part: Part = SETUP_PARTS.some(([value]) => value === asked) ? (asked as Part) : 'punches'
  const setPart = (value: Part) => setParams(value === 'punches' ? {} : { part: value }, { replace: true })
  // Schedules: who follows what for View; the form to set them for Edit
  const canEdit = useAccess().can('ATTENDANCE_SETUP', 'WRITE')
  return (
    <div className="space-y-3">
      <div className={SEGMENTS}>
        {SETUP_PARTS.map(([value, label]) => (
          <button key={value} type="button" aria-pressed={part === value} onClick={() => setPart(value)} className={segment(part === value)}>
            {label}
          </button>
        ))}
      </div>
      {part === 'punches' && <Punches />}
      {part === 'shifts' && <Shifts />}
      {part === 'policies' && <PoliciesSetup card={Card} />}
      {part === 'assign' && <Schedules canEdit={canEdit} />}
      {part === 'roster' && <RosterView />}
      {part === 'holidays' && <Holidays />}
      {part === 'patterns' && <Patterns />}
      {part === 'lock' && <MonthLockSetup card={Card} />}
    </div>
  )
}

function Card({ title, hint, action, children }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-light tracking-tight">{title}</h2>
          {hint && <p className="max-w-prose text-sm text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

// --- punches ---


function Punches() {
  const queryClient = useQueryClient()
  const uploads = useQuery(orpc.attendance.punches.uploads.queryOptions())
  const unmatched = useQuery(orpc.attendance.punches.unmatched.queryOptions())
  const upload = useMutation(orpc.attendance.punches.upload.mutationOptions({ onSuccess: () => void queryClient.invalidateQueries({ queryKey: orpc.attendance.key() }) }))
  const link = useMutation(orpc.attendance.punches.link.mutationOptions({ onSuccess: () => void queryClient.invalidateQueries({ queryKey: orpc.attendance.key() }) }))
  const [linking, setLinking] = useState<Record<string, PickedEmployee | null>>({})
  const r = upload.data
  // View: the earlier uploads and the unmatched codes; uploading and linking need Edit (covering the employees)
  const canEdit = useAccess().can('ATTENDANCE_SETUP', 'WRITE')
  return (
    <div className="space-y-4">
      {canEdit && <Card title={UPLOAD_TITLE} hint={UPLOAD_HINT}>
        {/* the main action of this part: the whole block opens the file chooser */}
        <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-foreground/25 px-4 py-3 text-center text-sm hover:border-foreground/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
          <span className="flex items-center gap-2">
            <Upload className="size-4 text-muted-foreground" />
            {upload.isPending ? 'Uploading and working out the days…' : 'The machines’ file - .xlsx or .csv'}
          </span>
          <span className={cn('rounded-full px-4 py-1.5 text-sm font-medium', upload.isPending ? 'bg-surface-2 text-muted-foreground' : 'bg-gold text-gold-foreground')}>Choose file</span>
          <input
            type="file"
            accept=".xlsx,.csv,.txt"
            className="sr-only"
            disabled={upload.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) upload.mutate({ file })
              e.target.value = ''
            }}
          />
        </label>
        <FormError error={upload.error} />
        {r && (
          <div className="space-y-2 rounded-2xl bg-positive/10 px-4 py-3 text-sm text-positive-ink">
            <p>
              {r.rowCount} rows: <strong>{r.added} punches added</strong>, {r.duplicates} already there
              {r.unmatchedCodes > 0 && `, ${r.unmatchedCodes} code(s) matched no employee (below)`}
              {r.skipped > 0 && `, ${r.skipped} row(s) skipped`}.
            </p>
            {r.errors.length > 0 && <p className="text-xs text-warning-ink">{r.errors.slice(0, 5).join(' · ')}{r.errors.length > 5 ? ' …' : ''}</p>}
          </div>
        )}
      </Card>}

      {/* testing only: the dev build shows it, a production server refuses it (2026-11-22) */}
      {canEdit && import.meta.env.DEV && <ManualPunches />}

      {!!unmatched.data?.length && (
        <Card title="Unmatched punches" hint={canEdit ? "Codes on the machines that are no employee. Pick who the code belongs to - their punches move to that employee and the days are worked out." : "Codes on the machines that are no employee - linking them to an employee needs Attendance setup: Edit."}>
          <FormError error={link.error} />
          <ul className="divide-y">
            {unmatched.data.map((u) => (
              <li key={u.code} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <span className="min-w-32 font-mono font-medium">{u.code}</span>
                <span className="text-xs text-muted-foreground">
                  {u.punches} punch{u.punches === 1 ? '' : 'es'} · {formatDate(u.first)} – {formatDate(u.last)}
                </span>
                {canEdit && <div className="ml-auto flex w-full items-center gap-2 sm:w-auto sm:min-w-72">
                  <EmployeePicker value={linking[u.code]?.employeeCode ?? ''} onChange={(p) => setLinking((l) => ({ ...l, [u.code]: p }))} placeholder="Belongs to…" />
                  <Button size="sm" variant="secondary" disabled={!linking[u.code] || link.isPending} onClick={() => link.mutate({ code: u.code, employeeCode: linking[u.code]!.employeeCode })}>
                    Link
                  </Button>
                </div>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Earlier uploads">
        {uploads.isPending && <UploadRowsSkeleton label="Loading the uploads" />}
        {uploads.data?.length === 0 && <EmptyState className="py-6" title="Nothing uploaded yet" hint="Each upload is listed here with who did it and what it added." />}
        <ul className="divide-y text-sm">
          {uploads.data?.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="font-medium">{u.fileName}</span>
              <span className="text-xs text-muted-foreground">
                {formatDoneBy(u.createdAt, u.by)} · {u.addedCount} added, {u.duplicateCount} already there{u.unmatchedCount ? `, ${u.unmatchedCount} unmatched code(s)` : ''}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

// Punches typed by hand for one employee on one day - for testing the attendance only (the user, 2026-11-22)
function ManualPunches() {
  const queryClient = useQueryClient()
  const [person, setPerson] = useState<PickedEmployee | null>(null)
  const [date, setDate] = useState(toDateInput(todayDay()))
  const [times, setTimes] = useState('')
  const list = times.split(/[\s,;]+/).filter(Boolean)
  const add = useMutation(orpc.attendance.punches.addManual.mutationOptions({ onSuccess: () => void queryClient.invalidateQueries({ queryKey: orpc.attendance.key() }) }))
  return (
    <Card title="Add punches by hand" hint="For testing only - not on the live system. The punches of one employee on one day, on their work location's clock; the day is worked out again.">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1fr)_auto] sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="mp-person" className="text-xs text-muted-foreground">
            Employee
          </Label>
          <EmployeePicker id="mp-person" value={person?.employeeCode ?? ''} onChange={setPerson} className="h-10 w-full rounded-xl bg-card" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="mp-date" className="text-xs text-muted-foreground">
            Day
          </Label>
          <Input id="mp-date" type="date" className="h-10 rounded-xl" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="mp-times" className="text-xs text-muted-foreground">
            Times
          </Label>
          <Input id="mp-times" className="h-10 rounded-xl" placeholder="09:02 18:10" value={times} onChange={(e) => setTimes(e.target.value)} />
        </div>
        <Button
          variant="secondary"
          className="h-10"
          disabled={!person || !date || !list.length || add.isPending}
          onClick={() => add.mutate({ employeeCode: person!.employeeCode, date: fromDateInput(date)!, times: list })}
        >
          {add.isPending ? 'Adding…' : 'Add punches'}
        </Button>
      </div>
      <FormError error={add.error} />
      {add.data && (
        <p className="rounded-2xl bg-positive/10 px-3 py-2 text-sm text-positive-ink">
          {add.data.added} punch{add.data.added === 1 ? '' : 'es'} added{add.data.duplicates ? `, ${add.data.duplicates} already there` : ''} - the day is worked out again.
        </p>
      )}
    </Card>
  )
}

// --- shifts ---

function Shifts() {
  const shifts = useQuery(orpc.attendance.shifts.list.queryOptions({ input: { includeInactive: true } }))
  const [editing, setEditing] = useState<Shift | 'new' | null>(null)
  // shared by every company: Attendance setup Edit for all companies (B13)
  const canChange = useAccess().coversGroup('ATTENDANCE_SETUP')
  return (
    <Card
      title="Shifts"
      hint="When work starts and ends, the break and where the first half ends - how a day is judged is the attendance policy. A night shift simply ends at an earlier time (it ends the next day). Which days people work which shift is set in Schedule patterns."
      action={
        canChange && (
          <Button variant="gold" size="sm" onClick={() => setEditing('new')}>
            <Plus /> Add a shift
          </Button>
        )
      }
    >
      <SharedListNote area="ATTENDANCE_SETUP" label="Attendance setup" what="changing the shifts" />
      <FormError error={shifts.error} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Shift</TableHead>
            <TableHead>Time</TableHead>
            <TableHead className="hidden sm:table-cell">Break</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {shifts.isPending && <ShiftRowsSkeleton />}
          {shifts.data?.map((s) => (
            <TableRow key={s.id} className={s.isActive ? undefined : 'text-muted-foreground'}>
              <TableCell>
                <span className="font-medium">{s.name}</span> <span className="text-xs text-muted-foreground">{s.code}</span>
                <UpcomingPill versions={s.versions} />
                {!s.isActive && (
                  <Pill tone="neutral" className="ml-2">
                    Retired
                  </Pill>
                )}
              </TableCell>
              <TableCell className="tabular-nums">
                {s.start}–{s.end}
                {s.crossesMidnight && <span className="ml-1 text-xs text-muted-foreground">(next day)</span>}
                {s.halfSplit && <span className="ml-1 text-xs text-muted-foreground">· 1st half to {s.halfSplit}</span>}
              </TableCell>
              <TableCell className="hidden tabular-nums sm:table-cell">{s.breakMinutes}m</TableCell>
              <TableCell className="text-right">
                {canChange && (
                  <Button variant="ghost" size="sm" onClick={() => setEditing(s)}>
                    <Pencil /> Edit
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {editing && <ShiftDialog shift={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  )
}

function ShiftDialog({ shift, onClose }: { shift: Shift | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  // what the form opened with - anything different is unsaved input
  const [initial] = useState(() => ({
    code: shift?.code ?? '',
    name: shift?.name ?? '',
    start: shift?.start ?? '09:00',
    end: shift?.end ?? '18:00',
    brk: String(shift?.breakMinutes ?? 30),
    // where the first half ends ('' = the middle of the shift) - a half day (e.g. Saturday) ends there (2026-11-22)
    split: shift?.halfSplit ?? '',
    // the date changed times apply from (an existing shift - dated shifts, 2026-11-23)
    from: toDateInput(todayDay()),
  }))
  const [v, setV] = useState(initial)
  const dirty = (Object.keys(v) as (keyof typeof v)[]).some((k) => v[k] !== initial[k])
  const timingChanged = !!shift && (['start', 'end', 'brk', 'split'] as const).some((k) => v[k] !== initial[k])
  const done = {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orpc.attendance.key() })
      onClose()
    },
  }
  const create = useMutation(orpc.attendance.shifts.create.mutationOptions(done))
  const update = useMutation(orpc.attendance.shifts.update.mutationOptions(done))
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }))
  const data = {
    code: v.code,
    name: v.name,
    start: v.start,
    end: v.end,
    breakMinutes: Number(v.brk) || 0,
    halfSplit: v.split || null,
  }
  const field = (id: keyof typeof v, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1">
      <Label htmlFor={`sh-${id}`} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input id={`sh-${id}`} className="h-9 rounded-xl" value={String(v[id])} onChange={set(id)} {...props} />
    </div>
  )
  return (
    <FormDialog onOpenChange={(open) => !open && onClose()} dirty={dirty} className="rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{shift ? `Edit ${shift.name}` : 'Add a shift'}</DialogTitle>
          <DialogDescription>{shift ? 'A change of the times applies from the date you choose below.' : 'Its times apply once a pattern or a roster day names it.'}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {field('name', 'Name', { placeholder: 'e.g. Morning' })}
          {field('code', 'Short code (on the roster)', { placeholder: 'e.g. A', maxLength: 10 })}
          {field('start', 'Starts', { type: 'time' })}
          {field('end', 'Ends (earlier = next day)', { type: 'time' })}
          {field('brk', 'Unpaid break (minutes)', { type: 'number', min: 0, max: 240 })}
          {field('split', 'First half ends (empty = the middle)', { type: 'time' })}
        </div>
        <p className="text-xs text-muted-foreground">
          A half day (a pattern day marked ½, e.g. Saturday) works only the first half and ends at its time. The grace and the full / half day hours are in the attendance policy.
        </p>
        {timingChanged && <AppliesFrom id="sh-from" what="times" value={v.from} onChange={(from) => setV((x) => ({ ...x, from }))} />}
        <FormError error={create.error ?? update.error} />
        <DialogFooter>
          {shift && (
            <Button variant="ghost" className="mr-auto" disabled={update.isPending} onClick={() => update.mutate({ id: shift.id, isActive: !shift.isActive })}>
              {shift.isActive ? 'Retire' : 'Re-activate'}
            </Button>
          )}
          <DialogCancel />
          <Button
            variant="gold"
            disabled={!v.name.trim() || !v.code.trim() || (timingChanged && !v.from) || create.isPending || update.isPending}
            onClick={() => {
              if (!shift) return create.mutate(data)
              // the times only when changed - then with their date
              const { code, name, ...timing } = data
              update.mutate({ id: shift.id, code, name, ...(timingChanged && { ...timing, effectiveFrom: fromDateInput(v.from)! }) })
            }}
          >
            Save
          </Button>
        </DialogFooter>
    </FormDialog>
  )
}

// --- schedules (who follows which pattern - the user, 2026-11-23) ---

// what the schedule form opens with: "Change" on a row - that employee with their pattern and policy; "Give a schedule" -
// nobody yet
type ScheduleStart = { people: PickedEmployee[]; patternId: string; policyId: string }

// Who follows which pattern and policy today (the user, 2026-11-23), with search and filters - the place (company, plant,
// department, cost centre), the pattern, the policy. Edit changes schedules in a drawer: one employee from their row, or
// everyone ticked at once (tick all after filtering = everyone matching)
function Schedules({ canEdit }: { canEdit: boolean }) {
  const [search, setSearch] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [plantId, setPlantId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [costCenterId, setCostCenterId] = useState('')
  const [patternId, setPatternId] = useState('')
  const [policyId, setPolicyId] = useState('')
  const [editing, setEditing] = useState<ScheduleStart | null>(null)
  // the ticked employees (code -> name), kept while the filters change
  const [ticked, setTicked] = useState<Map<string, string>>(new Map())
  const patterns = useQuery(orpc.attendance.shifts.patterns.list.queryOptions({ input: { includeInactive: true } }))
  const policies = useQuery(orpc.attendance.policies.list.queryOptions({ input: { includeInactive: true } }))
  const companies = useQuery(orpc.organization.companies.list.queryOptions())
  const plants = useQuery({ ...orpc.organization.plants.list.queryOptions({ input: { companyId: Number(companyId) } }), enabled: !!companyId })
  const departments = useQuery(orpc.organization.departments.list.queryOptions({ input: plantId ? { plantId: Number(plantId) } : {} }))
  const costCenters = useQuery({ ...orpc.organization.costCenters.list.queryOptions({ input: { companyId: Number(companyId) } }), enabled: !!companyId })
  const ids = (v: string) => (v ? [Number(v)] : undefined)
  const rows = useQuery(
    orpc.attendance.shifts.schedules.queryOptions({
      input: {
        ...(search.trim() && { search: search.trim() }),
        companyIds: ids(companyId),
        plantIds: ids(plantId),
        departmentIds: ids(departmentId),
        costCenterIds: ids(costCenterId),
        ...(patternId && { patternId: Number(patternId) }),
        ...(policyId && { policyId: Number(policyId) }),
      },
    }),
  )
  const shown = rows.data ?? []
  const shownTicked = shown.filter((r) => ticked.has(r.employee.employeeCode)).length
  const allShown = shown.length > 0 && shownTicked === shown.length
  const tickShown = (on: boolean) =>
    setTicked((current) => {
      const next = new Map(current)
      for (const r of shown) {
        if (on) next.set(r.employee.employeeCode, r.employee.name)
        else next.delete(r.employee.employeeCode)
      }
      return next
    })
  const tick = (code: string, name: string, on: boolean) =>
    setTicked((current) => {
      const next = new Map(current)
      if (on) next.set(code, name)
      else next.delete(code)
      return next
    })
  const filtered = !!(search.trim() || companyId || plantId || departmentId || costCenterId || patternId || policyId)
  const clearFilters = () => {
    setSearch('')
    setCompanyId('')
    setPlantId('')
    setDepartmentId('')
    setCostCenterId('')
    setPatternId('')
    setPolicyId('')
  }
  return (
    <Card
      title="Schedules"
      hint="Each employee's schedule pattern and attendance policy today - “default” where none was given (the ★ pattern, the default policy) - since when, and a change already set for later. A new schedule runs from its date until changed again; days already passed from that date are worked out again. The roster is only for rare one-off changes."
      action={
        canEdit && (
          <Button variant="gold" size="sm" onClick={() => setEditing({ people: [], patternId: '', policyId: '' })}>
            <Plus /> Give a schedule
          </Button>
        )
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search employees" className="h-9 rounded-full pl-9" placeholder="Name or code" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <NativeSelect
          aria-label="Company"
          className="[&_select]:h-9 [&_select]:rounded-full"
          value={companyId}
          onChange={(e) => {
            setCompanyId(e.target.value)
            setPlantId('')
            setDepartmentId('')
            setCostCenterId('')
          }}
        >
          <NativeSelectOption value="">Every company</NativeSelectOption>
          {companies.data?.map((c) => (
            <NativeSelectOption key={c.id} value={String(c.id)}>
              {c.code}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Plant"
          className="[&_select]:h-9 [&_select]:rounded-full"
          value={plantId}
          disabled={!companyId}
          onChange={(e) => {
            setPlantId(e.target.value)
            setDepartmentId('')
          }}
        >
          <NativeSelectOption value="">{companyId ? 'Every plant' : 'Plant (pick a company)'}</NativeSelectOption>
          {plants.data?.map((p) => (
            <NativeSelectOption key={p.id} value={String(p.id)}>
              {p.plantCode} {p.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Department" className="[&_select]:h-9 [&_select]:rounded-full" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
          <NativeSelectOption value="">Every department</NativeSelectOption>
          {departments.data?.map((d) => (
            <NativeSelectOption key={d.id} value={String(d.id)}>
              {d.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Cost centre" className="[&_select]:h-9 [&_select]:rounded-full" value={costCenterId} disabled={!companyId} onChange={(e) => setCostCenterId(e.target.value)}>
          <NativeSelectOption value="">{companyId ? 'Every cost centre' : 'Cost centre (pick a company)'}</NativeSelectOption>
          {costCenters.data?.map((c) => (
            <NativeSelectOption key={c.id} value={String(c.id)}>
              {c.code} {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Schedule pattern" className="[&_select]:h-9 [&_select]:rounded-full" value={patternId} onChange={(e) => setPatternId(e.target.value)}>
          <NativeSelectOption value="">Every pattern</NativeSelectOption>
          {patterns.data?.map((p) => (
            <NativeSelectOption key={p.id} value={String(p.id)}>
              {p.isDefault ? '★ ' : ''}
              {p.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Attendance policy" className="[&_select]:h-9 [&_select]:rounded-full" value={policyId} onChange={(e) => setPolicyId(e.target.value)}>
          <NativeSelectOption value="">Every policy</NativeSelectOption>
          {policies.data?.map((p) => (
            <NativeSelectOption key={p.id} value={String(p.id)}>
              {p.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {rows.data && (
          <span className="text-xs text-muted-foreground">
            {rows.data.length} employee{rows.data.length === 1 ? '' : 's'}
          </span>
        )}
        {filtered && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>
      {canEdit && ticked.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-gold-soft/50 px-3 py-2 text-sm">
          <span className="font-medium">
            {ticked.size} employee{ticked.size === 1 ? '' : 's'} ticked
          </span>
          {ticked.size > shownTicked && <span className="text-xs text-muted-foreground">({ticked.size - shownTicked} not in this list)</span>}
          <span className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => setTicked(new Map())}>
            Untick all
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditing({ people: [...ticked].map(([employeeCode, name]) => ({ employeeCode, name })), patternId: '', policyId: '' })}
          >
            <Pencil /> Change their schedule
          </Button>
        </div>
      )}
      <FormError error={rows.error} />
      {rows.data?.length === 0 ? (
        <EmptyState className="py-6" title="Nobody matches" hint="Change the search or the filters." />
      ) : (
        <div className="max-h-[32rem] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {canEdit && (
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label={allShown ? 'Untick everyone in this list' : 'Tick everyone in this list'}
                      checked={allShown}
                      indeterminate={shownTicked > 0 && !allShown}
                      disabled={!shown.length}
                      onCheckedChange={(on) => tickShown(on)}
                    />
                  </TableHead>
                )}
                <TableHead>Employee</TableHead>
                <TableHead>Schedule pattern</TableHead>
                <TableHead>Policy</TableHead>
                <TableHead className="hidden sm:table-cell">Since</TableHead>
                <TableHead className="hidden md:table-cell">Next change</TableHead>
                {canEdit && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.isPending && <ScheduleRowsSkeleton change={canEdit} />}
              {rows.data?.map((r) => (
                <TableRow key={r.employee.employeeCode} data-state={ticked.has(r.employee.employeeCode) ? 'selected' : undefined}>
                  {canEdit && (
                    <TableCell>
                      <Checkbox
                        aria-label={`Tick ${r.employee.name}`}
                        checked={ticked.has(r.employee.employeeCode)}
                        onCheckedChange={(on) => tick(r.employee.employeeCode, r.employee.name, on)}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <span className="font-medium">{r.employee.name}</span> <span className="text-xs text-muted-foreground">{r.employee.employeeCode}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[r.employee.company, r.employee.plant, r.employee.department, r.employee.costCenter && `CC ${r.employee.costCenter}`].filter(Boolean).join(' · ')}
                    </span>
                  </TableCell>
                  <TableCell>
                    {r.pattern?.name ?? '—'}
                    {r.patternIsDefault && <span className="ml-1.5 text-xs text-muted-foreground">default</span>}
                  </TableCell>
                  <TableCell>
                    {r.policy?.name ?? '—'}
                    {r.policyIsDefault && <span className="ml-1.5 text-xs text-muted-foreground">default</span>}
                  </TableCell>
                  <TableCell className="hidden text-sm tabular-nums sm:table-cell">{r.since ? formatDate(r.since) : '—'}</TableCell>
                  <TableCell className="hidden text-sm md:table-cell">{r.next ? `${r.next.pattern?.name ?? '?'} from ${formatDate(r.next.from)}` : '—'}</TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setEditing({
                            people: [{ employeeCode: r.employee.employeeCode, name: r.employee.name }],
                            patternId: r.pattern ? String(r.pattern.id) : '',
                            policyId: r.policyIsDefault || !r.policy ? '' : String(r.policy.id),
                          })
                        }
                      >
                        <Pencil /> Change
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {editing && (
        <ScheduleDrawer
          start={editing}
          onClose={() => setEditing(null)}
          // saved for everyone ticked: untick them
          onSaved={() => editing.people.length > 1 && setTicked(new Map())}
        />
      )}
    </Card>
  )
}

const splitCodes = (text: string) =>
  text
    .split(/[\s,;]+/)
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)

// Gives employees a schedule pattern and policy from a date - in a drawer (unsaved input is never lost by accident)
function ScheduleDrawer({ start, onClose, onSaved }: { start: ScheduleStart; onClose: () => void; onSaved?: () => void }) {
  const queryClient = useQueryClient()
  const shifts = useQuery(orpc.attendance.shifts.list.queryOptions({ input: { includeInactive: true } }))
  const patterns = useQuery(orpc.attendance.shifts.patterns.list.queryOptions({ input: {} }))
  const policies = useQuery(orpc.attendance.policies.list.queryOptions({ input: {} }))
  const [people, setPeople] = useState(start.people)
  const [picker, setPicker] = useState(0)
  const [pasted, setPasted] = useState('')
  const [patternId, setPatternId] = useState(start.patternId)
  const [startWeek, setStartWeek] = useState(1)
  // the attendance policy ('' = the default one - 2026-11-22)
  const [policyId, setPolicyId] = useState(start.policyId)
  const [initialFrom] = useState(() => toDateInput(todayDay()))
  const [from, setFrom] = useState(initialFrom)
  const pattern = patterns.data?.find((p) => String(p.id) === patternId)
  const assign = useMutation(
    orpc.attendance.shifts.assign.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.attendance.key() })
        onSaved?.()
      },
    }),
  )
  const codes = [...new Set([...people.map((p) => p.employeeCode), ...splitCodes(pasted)])]
  // a long list of names is folded (all ticked after a filter can be hundreds)
  const [showAll, setShowAll] = useState(false)
  const FOLD = 12
  const dirty =
    people.map((p) => p.employeeCode).join() !== start.people.map((p) => p.employeeCode).join() ||
    pasted.trim() !== '' ||
    patternId !== start.patternId ||
    policyId !== start.policyId ||
    startWeek !== 1 ||
    from !== initialFrom
  const one = start.people.length === 1 ? start.people[0]! : null
  return (
    <FormDrawer
      onClose={onClose}
      closed={assign.isSuccess}
      dirty={dirty && !assign.isSuccess}
      width={560}
      title={one ? `Schedule of ${one.name}` : start.people.length ? `Schedule of ${start.people.length} employees` : 'Give a schedule'}
      description={one ? `${one.employeeCode} · from the date below until changed again` : 'The same pattern and policy for everyone below, from the date below until changed again'}
      footer={
        <>
          <DrawerCancel />
          <Button
            variant="gold"
            disabled={!codes.length || !pattern || !from || assign.isPending}
            onClick={() => assign.mutate({ employeeCodes: codes, patternId: Number(patternId), startWeek, policyId: policyId ? Number(policyId) : null, effectiveFrom: fromDateInput(from)! })}
          >
            {assign.isPending ? 'Saving…' : one && codes.length === 1 ? 'Save' : `Set for ${codes.length} employee${codes.length === 1 ? '' : 's'}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Employees</Label>
          <EmployeePicker
            key={picker}
            value=""
            onChange={(p) => {
              if (p && !people.some((x) => x.employeeCode === p.employeeCode)) setPeople((list) => [...list, p])
              setPicker((n) => n + 1)
            }}
            placeholder="Add an employee…"
          />
          {!one && (
            <textarea
              className="min-h-16 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm"
              placeholder="…or paste employee codes (one per line or comma-separated)"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
          )}
          {people.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(showAll ? people : people.slice(0, FOLD)).map((p) => (
                <span key={p.employeeCode} className="inline-flex items-center gap-1 rounded-full bg-gold-soft py-0.5 pr-1 pl-2.5 text-xs">
                  {p.name} ({p.employeeCode})
                  <button
                    type="button"
                    aria-label={`Remove ${p.name}`}
                    onClick={() => setPeople((l) => l.filter((x) => x.employeeCode !== p.employeeCode))}
                    className="grid size-4 place-items-center rounded-full hover:bg-foreground/10"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              {people.length > FOLD && (
                <button type="button" className="text-xs font-medium underline-offset-4 hover:underline" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? 'Show fewer' : `+${people.length - FOLD} more`}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="as-pattern" className="text-xs text-muted-foreground">
            Schedule pattern
          </Label>
          <NativeSelect
            id="as-pattern"
            className="w-full [&_select]:h-10 [&_select]:rounded-xl"
            value={patternId}
            onChange={(e) => {
              setPatternId(e.target.value)
              setStartWeek(1)
            }}
          >
            <NativeSelectOption value="">Choose…</NativeSelectOption>
            {patterns.data?.map((p) => (
              <NativeSelectOption key={p.id} value={String(p.id)}>
                {p.isDefault ? '★ ' : ''}
                {p.name} ({weeksOf(p.days.length)})
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        {pattern && (
          <div className="space-y-1.5">
            {Math.ceil(pattern.days.length / 7) > 1 && (
              <>
                <Label className="text-xs text-muted-foreground">The week of the start date is…</Label>
                <div className={SEGMENTS}>
                  {Array.from({ length: Math.ceil(pattern.days.length / 7) }, (_, i) => (
                    <button key={i} type="button" aria-pressed={startWeek === i + 1} onClick={() => setStartWeek(i + 1)} className={segment(startWeek === i + 1)}>
                      Week {i + 1}
                    </button>
                  ))}
                </div>
              </>
            )}
            <PatternWeeks pattern={pattern} shifts={shifts.data ?? []} highlight={startWeek} />
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="as-policy" className="text-xs text-muted-foreground">
              Attendance policy
            </Label>
            <NativeSelect id="as-policy" className="w-full [&_select]:h-10 [&_select]:rounded-xl" value={policyId} onChange={(e) => setPolicyId(e.target.value)}>
              <NativeSelectOption value="">The default policy{policies.data?.find((p) => p.isDefault) ? ` (${policies.data.find((p) => p.isDefault)!.name})` : ''}</NativeSelectOption>
              {policies.data
                ?.filter((p) => !p.isDefault)
                .map((p) => (
                  <NativeSelectOption key={p.id} value={String(p.id)}>
                    {p.name}
                  </NativeSelectOption>
                ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor="as-from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input id="as-from" type="date" className="h-10 rounded-xl" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
        </div>
        <FormError error={assign.error} />
      </div>
    </FormDrawer>
  )
}

// --- holidays ---

type Holiday = Awaited<ReturnType<typeof client.attendance.holidays.list>>[number]

function Holidays() {
  const queryClient = useQueryClient()
  const [year, setYear] = useState(todayDay().getUTCFullYear())
  const holidays = useQuery(orpc.attendance.holidays.list.queryOptions({ input: { year } }))
  const remove = useMutation(orpc.attendance.holidays.delete.mutationOptions({ onSuccess: () => void queryClient.invalidateQueries({ queryKey: orpc.attendance.key() }) }))
  const [editing, setEditing] = useState<Holiday | 'new' | null>(null)
  const companies = useQuery(orpc.organization.companies.list.queryOptions())
  // a holiday for every company needs Attendance setup Edit for all companies; one company's, Edit for that whole company (B13)
  const { coversGroup, coversWhole } = useAccess()
  const mayChange = (companyId: number | null) => (companyId === null ? coversGroup('ATTENDANCE_SETUP') : coversWhole('ATTENDANCE_SETUP', 'WRITE', { companyId }))
  const canAdd = mayChange(null) || !!companies.data?.some((c) => mayChange(c.id))
  return (
    <Card
      title="Holidays"
      hint="For every company, one company, and optionally one work location. A holiday on a day already passed works that day out again. Leave will use the same calendar."
      action={
        <div className="flex items-center gap-2">
          <NativeSelect className="[&_select]:h-9 [&_select]:rounded-full" aria-label="Year" value={String(year)} onChange={(e) => setYear(Number(e.target.value))}>
            {[year - 1, year, year + 1].map((y) => (
              <NativeSelectOption key={y} value={String(y)}>
                {y}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {canAdd && (
            <Button variant="gold" size="sm" onClick={() => setEditing('new')}>
              <Plus /> Add a holiday
            </Button>
          )}
        </div>
      }
    >
      <SharedListNote area="ATTENDANCE_SETUP" label="Attendance setup" what="a holiday for every company" />
      <FormError error={holidays.error ?? remove.error} />
      {holidays.data?.length === 0 && <EmptyState className="py-6" title={`No holidays in ${year} yet`} hint="A holiday counts for every company, or only for the company and work location you pick." />}
      <ul className="divide-y text-sm">
        {holidays.data?.map((h) => (
          <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              <span className="font-medium tabular-nums">{formatDate(h.date)}</span> · {h.name}
              <span className="ml-2 text-xs text-muted-foreground">{[h.company?.code ?? 'Every company', h.workLocation?.name].filter(Boolean).join(' · ')}</span>
            </span>
            {mayChange(h.companyId) && (
              <span className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setEditing(h)}>
                  <Pencil /> Edit
                </Button>
                <Button variant="ghost" size="sm" disabled={remove.isPending} onClick={() => remove.mutate({ id: h.id })}>
                  <Trash2 /> Remove
                </Button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {editing && <HolidayDialog holiday={editing === 'new' ? null : editing} mayChange={mayChange} onClose={() => setEditing(null)} />}
    </Card>
  )
}

// `mayChange`: whether the user may put a holiday for that company (null = every company) - only those are offered
function HolidayDialog({ holiday, mayChange, onClose }: { holiday: Holiday | null; mayChange: (companyId: number | null) => boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const companies = useQuery(orpc.organization.companies.list.queryOptions())
  const locations = useQuery(orpc.organization.workLocations.list.queryOptions())
  const allowed = companies.data?.filter((c) => mayChange(c.id)) ?? []
  const [date, setDate] = useState(toDateInput(holiday?.date ?? null))
  const [name, setName] = useState(holiday?.name ?? '')
  // a new holiday starts at "every company" only for those who may put one there - else at their first company
  const [companyId, setCompanyId] = useState(holiday ? (holiday.companyId ? String(holiday.companyId) : '') : mayChange(null) ? '' : String(allowed[0]?.id ?? ''))
  const [locationId, setLocationId] = useState(holiday?.workLocationId ? String(holiday.workLocationId) : '')
  const done = {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orpc.attendance.key() })
      onClose()
    },
  }
  const create = useMutation(orpc.attendance.holidays.create.mutationOptions(done))
  const update = useMutation(orpc.attendance.holidays.update.mutationOptions(done))
  const dirty =
    date !== toDateInput(holiday?.date ?? null) ||
    name !== (holiday?.name ?? '') ||
    companyId !== (holiday?.companyId ? String(holiday.companyId) : '') ||
    locationId !== (holiday?.workLocationId ? String(holiday.workLocationId) : '')
  const data = { date: fromDateInput(date)!, name, companyId: companyId ? Number(companyId) : null, workLocationId: locationId ? Number(locationId) : null }
  return (
    <FormDialog onOpenChange={(open) => !open && onClose()} dirty={dirty} className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{holiday ? 'Edit holiday' : 'Add a holiday'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="ho-date" className="text-xs text-muted-foreground">
              Date
            </Label>
            <Input id="ho-date" type="date" className="h-9 rounded-xl" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ho-name" className="text-xs text-muted-foreground">
              Name
            </Label>
            <Input id="ho-name" className="h-9 rounded-xl" placeholder="e.g. Diwali" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ho-company" className="text-xs text-muted-foreground">
              Company
            </Label>
            <NativeSelect id="ho-company" className="w-full [&_select]:h-9 [&_select]:rounded-xl" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              {mayChange(null) && <NativeSelectOption value="">Every company</NativeSelectOption>}
              {allowed.map((c) => (
                <NativeSelectOption key={c.id} value={String(c.id)}>
                  {c.code}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ho-location" className="text-xs text-muted-foreground">
              Work location
            </Label>
            <NativeSelect id="ho-location" className="w-full [&_select]:h-9 [&_select]:rounded-xl" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <NativeSelectOption value="">Every location</NativeSelectOption>
              {locations.data?.map((l) => (
                <NativeSelectOption key={l.id} value={String(l.id)}>
                  {l.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>
        <FormError error={create.error ?? update.error} />
        <DialogFooter>
          <DialogCancel />
          <Button variant="gold" disabled={!date || !name.trim() || create.isPending || update.isPending} onClick={() => (holiday ? update.mutate({ id: holiday.id, ...data }) : create.mutate(data))}>
            Save
          </Button>
        </DialogFooter>
    </FormDialog>
  )
}

// --- schedule patterns (one idea for everyone - the user, 2026-11-23) ---
// A pattern is weeks of Monday-Sunday; each day a shift, its first half only (½ - e.g. a half-day Saturday: half worked,
// half off) or off. It repeats for ever. The starred one is the default - for everyone never given a schedule.

type Pattern = Awaited<ReturnType<typeof client.attendance.shifts.patterns.list>>[number]

const weeksOf = (length: number) => (length % 7 === 0 ? `${length / 7} week${length === 7 ? '' : 's'}` : `${length} days`)

// A pattern as weeks of Monday-Sunday chips (`highlight`: the week to stress - the start week when assigning)
function PatternWeeks({ pattern, shifts, highlight }: { pattern: Pick<Pattern, 'days' | 'halfDays'>; shifts: Shift[]; highlight?: number }) {
  const code = (id: number) => shifts.find((s) => s.id === id)?.code ?? '?'
  const weeks = Array.from({ length: Math.ceil(pattern.days.length / 7) }, (_, w) => pattern.days.slice(w * 7, w * 7 + 7))
  return (
    <div className="overflow-x-auto">
      <table className="text-xs">
        <thead>
          <tr>
            {weeks.length > 1 && <th />}
            {WEEKDAYS.map((w) => (
              <th key={w.key} className="px-0.5 pb-1 text-center font-normal text-muted-foreground">
                {w.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, w) => (
            <tr key={w} className={cn(highlight !== undefined && highlight !== w + 1 && 'opacity-50')}>
              {weeks.length > 1 && <td className="pr-1.5 whitespace-nowrap text-muted-foreground">W{w + 1}</td>}
              {week.map((d, i) => {
                const half = pattern.halfDays.includes(w * 7 + i + 1)
                return (
                  <td key={i} className="p-0.5">
                    <span
                      className={cn(
                        'block min-w-11 rounded-md px-1.5 py-1 text-center font-medium whitespace-nowrap',
                        d === 0 ? 'bg-surface-2 text-muted-foreground' : half ? 'bg-gold-soft' : 'bg-hero/10',
                      )}
                    >
                      {d === 0 ? 'Off' : `${code(d)}${half ? ' ½' : ''}`}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Patterns() {
  const queryClient = useQueryClient()
  const patterns = useQuery(orpc.attendance.shifts.patterns.list.queryOptions({ input: { includeInactive: true } }))
  const shifts = useQuery(orpc.attendance.shifts.list.queryOptions({ input: { includeInactive: true } }))
  const [editing, setEditing] = useState<Pattern | 'new' | null>(null)
  // the pattern to make the default (asked first - it changes the schedule of everyone never given one)
  const [starring, setStarring] = useState<Pattern | null>(null)
  // shared by every company: Attendance setup Edit for all companies (B13)
  const canChange = useAccess().coversGroup('ATTENDANCE_SETUP')
  const makeDefault = useMutation(
    orpc.attendance.shifts.patterns.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.attendance.key() })
        setStarring(null)
      },
    }),
  )
  return (
    <Card
      title="Schedule patterns"
      hint="Weeks of Monday-Sunday that repeat: each day a shift, its first half only (½ - half worked, half off) or off - e.g. Mon A, Tue B, Wed C, Thu GEN, Fri GEN, Sat GEN ½, Sun Off. Give one to employees under Schedules. The starred pattern is the default: everyone never given one follows it - click another star to move it."
      action={
        canChange && (
          <Button variant="gold" size="sm" onClick={() => setEditing('new')}>
            <Plus /> Add a pattern
          </Button>
        )
      }
    >
      <SharedListNote area="ATTENDANCE_SETUP" label="Attendance setup" what="changing the schedule patterns" />
      <FormError error={patterns.error ?? makeDefault.error} />
      {patterns.isPending && <PatternRowsSkeleton />}
      <ul className="divide-y text-sm">
        {patterns.data?.map((p) => (
          <li key={p.id} className={cn('flex flex-wrap items-start gap-x-3 gap-y-2 py-3', !p.isActive && 'text-muted-foreground')}>
            {/* the default pattern: a gold star; another active pattern's star makes it the default */}
            {p.isDefault ? (
              <span className="grid size-7 shrink-0 place-items-center" title="The default pattern - for everyone never given a schedule">
                <Star className="size-4 fill-gold text-gold" aria-label="Default pattern" />
              </span>
            ) : p.isActive && canChange ? (
              <Button variant="ghost" size="icon-sm" className="shrink-0" title={`Make ${p.name} the default`} aria-label={`Make ${p.name} the default`} onClick={() => setStarring(p)}>
                <Star className="text-muted-foreground/60" />
              </Button>
            ) : (
              <span className="size-7 shrink-0" />
            )}
            <div className="min-w-0 flex-1 space-y-1.5">
              <p>
                <span className="font-medium">{p.name}</span> <span className="text-xs text-muted-foreground">{weeksOf(p.days.length)}</span>
                <UpcomingPill versions={p.versions} />
                {p.isDefault && (
                  <Pill tone="gold" className="ml-2">
                    Default
                  </Pill>
                )}
                {!p.isActive && (
                  <Pill tone="neutral" className="ml-2">
                    Retired
                  </Pill>
                )}
              </p>
              <PatternWeeks pattern={p} shifts={shifts.data ?? []} />
            </div>
            {canChange && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                <Pencil /> Edit
              </Button>
            )}
          </li>
        ))}
      </ul>
      {editing && <PatternDialog pattern={editing === 'new' ? null : editing} shifts={(shifts.data ?? []).filter((s) => s.isActive)} onClose={() => setEditing(null)} />}
      {starring && (
        <ConfirmDialog
          title={`Make ${starring.name} the default pattern?`}
          description={`Everyone never given a schedule follows ${starring.name} from today, instead of ${patterns.data?.find((p) => p.isDefault)?.name ?? 'the current default'}. The days before today keep the pattern they had.`}
          confirm="Make it the default"
          pending={makeDefault.isPending}
          onConfirm={() => makeDefault.mutate({ id: starring.id, isDefault: true })}
          onClose={() => setStarring(null)}
        />
      )}
    </Card>
  )
}

// a day in the editor: '0' off, '<id>' the shift, '<id>h' its first half only
const cellOf = (pattern: Pick<Pattern, 'days' | 'halfDays'>, n: number) => {
  const d = pattern.days[n] ?? 0
  return d === 0 ? '0' : `${d}${pattern.halfDays.includes(n + 1) ? 'h' : ''}`
}

function PatternDialog({ pattern, shifts, onClose }: { pattern: Pattern | null; shifts: Shift[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  // what the form opened with - anything different is unsaved input; a new pattern starts as one week, Sunday off
  const [initial] = useState(() => {
    const length = pattern ? Math.ceil(pattern.days.length / 7) * 7 : 7
    return { name: pattern?.name ?? '', cells: Array.from({ length }, (_, n) => (pattern ? cellOf(pattern, n) : n === 6 ? '0' : shifts[0] ? String(shifts[0].id) : '0')) }
  })
  const [name, setName] = useState(initial.name)
  const [cells, setCells] = useState(initial.cells)
  // the date changed days apply from (an existing pattern - dated patterns, 2026-11-23)
  const [from, setFrom] = useState(() => toDateInput(todayDay()))
  const weeks = cells.length / 7
  const daysChanged = !!pattern && cells.join(',') !== initial.cells.join(',')
  const dirty = name !== initial.name || cells.join(',') !== initial.cells.join(',')
  const done = {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orpc.attendance.key() })
      onClose()
    },
  }
  const create = useMutation(orpc.attendance.shifts.patterns.create.mutationOptions(done))
  const update = useMutation(orpc.attendance.shifts.patterns.update.mutationOptions(done))
  const days = cells.map((c) => Number.parseInt(c, 10))
  const halfDays = cells.flatMap((c, n) => (c.endsWith('h') ? [n + 1] : []))
  // more weeks copy the last one; fewer drop the last
  const setWeeks = (n: number) => setCells((list) => (n * 7 > list.length ? [...list, ...Array.from({ length: n * 7 - list.length }, (_, i) => list[list.length - 7 + (i % 7)]!)] : list.slice(0, n * 7)))
  return (
    <FormDialog onOpenChange={(open) => !open && onClose()} dirty={dirty} className="rounded-3xl sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{pattern ? `Edit ${pattern.name}` : 'Add a schedule pattern'}</DialogTitle>
        <DialogDescription>Each day: a shift, its first half only (½) or off. The weeks repeat in order.{pattern ? ' A change of the days applies from the date you choose below.' : ''}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor="pt-name" className="text-xs text-muted-foreground">
              Name
            </Label>
            <Input id="pt-name" className="h-9 rounded-xl" placeholder="e.g. Plant week, A/B fortnight" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Repeats every</span>
            <div className={SEGMENTS}>
              {[1, 2, 3, 4].map((n) => (
                <button key={n} type="button" aria-pressed={weeks === n} onClick={() => setWeeks(n)} className={segment(weeks === n)}>
                  {n} week{n === 1 ? '' : 's'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                {weeks > 1 && <th />}
                {WEEKDAYS.map((w) => (
                  <th key={w.key} className="px-0.5 pb-1 text-center font-normal text-muted-foreground">
                    {w.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: weeks }, (_, w) => (
                <tr key={w}>
                  {weeks > 1 && <td className="pr-1.5 whitespace-nowrap text-muted-foreground">W{w + 1}</td>}
                  {WEEKDAYS.map((wd, i) => {
                    const n = w * 7 + i
                    return (
                      <td key={wd.key} className="p-0.5">
                        <select
                          aria-label={`Week ${w + 1} ${wd.short}`}
                          value={cells[n]}
                          onChange={(e) => setCells((list) => list.map((c, j) => (j === n ? e.target.value : c)))}
                          className={cn(
                            'h-9 w-full min-w-16 rounded-lg border border-input px-1 text-xs font-medium',
                            cells[n] === '0' ? 'bg-surface-2 text-muted-foreground' : cells[n]!.endsWith('h') ? 'bg-gold-soft' : 'bg-card',
                          )}
                        >
                          <option value="0">Off</option>
                          {shifts.map((s) => (
                            <option key={s.id} value={String(s.id)}>
                              {s.code}
                            </option>
                          ))}
                          {shifts.map((s) => (
                            <option key={`${s.id}h`} value={`${s.id}h`}>
                              {s.code} ½
                            </option>
                          ))}
                        </select>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          ½ = only the shift's first half is worked (to its "first half ends" time); the second half is off - a half-day Saturday counts half a day worked, and leave on it 0.5.
        </p>
        {daysChanged && <AppliesFrom id="pt-from" what="days" value={from} onChange={setFrom} />}
      </div>
      <FormError error={create.error ?? update.error} />
      <DialogFooter>
        {pattern && !pattern.isDefault && (
          <Button variant="ghost" className="mr-auto" disabled={update.isPending} onClick={() => update.mutate({ id: pattern.id, isActive: !pattern.isActive })}>
            {pattern.isActive ? 'Retire' : 'Re-activate'}
          </Button>
        )}
        <DialogCancel />
        <Button
          variant="gold"
          disabled={!name.trim() || !days.some((d) => d !== 0) || (daysChanged && !from) || create.isPending || update.isPending}
          onClick={() =>
            pattern ? update.mutate({ id: pattern.id, name, ...(daysChanged && { days, halfDays, effectiveFrom: fromDateInput(from)! }) }) : create.mutate({ name, days, halfDays })
          }
        >
          Save
        </Button>
      </DialogFooter>
    </FormDialog>
  )
}
