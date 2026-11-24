import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { ExportButton } from '@/components/ExportButton'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { HolidayRowsSkeleton } from '@/components/skeletons/attendance/HolidayListsSkeleton'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useAccess } from '@/hooks/useAccess'
import { client, orpc } from '@/lib/orpc'
import { formatDate, fromDateInput, toDateInput, todayDay } from '@/lib/utils'
import { HOLIDAY_PORTION, toneOf } from './labels'

// The holidays of a year (2026-11-24 - each in the holiday lists that have it, with a category and the part of the day
// off). Changing one needs Attendance setup Edit over every list it is in (a company's list: that whole company; a list of
// every company: all companies) - only those holidays offer Edit, only those lists can be ticked.

type CardProps = { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }
type Holiday = Awaited<ReturnType<typeof client.attendance.holidays.list>>[number]
type Portion = Holiday['portion']
type Mode = Holiday['mode']

export function HolidaysSetup({ card: Card }: { card: (props: CardProps) => React.ReactNode }) {
  const queryClient = useQueryClient()
  const [year, setYear] = useState(todayDay().getUTCFullYear())
  // one list's holidays, or every list's ('')
  const [listId, setListId] = useState('')
  const holidays = useQuery(orpc.attendance.holidays.list.queryOptions({ input: { year, ...(listId && { holidayListId: Number(listId) }) } }))
  const lists = useQuery(orpc.attendance.holidayLists.list.queryOptions({ input: {} }))
  const refresh = () => void queryClient.invalidateQueries({ queryKey: orpc.attendance.key() })
  const remove = useMutation(orpc.attendance.holidays.delete.mutationOptions({ onSuccess: refresh }))
  const copy = useMutation(orpc.attendance.holidays.copyYear.mutationOptions({ onSuccess: refresh }))
  const [editing, setEditing] = useState<Holiday | 'new' | null>(null)
  const { can, coversGroup, coversWhole } = useAccess()
  const mayChange = (companyId: number | null) => (companyId === null ? coversGroup('ATTENDANCE_SETUP') : coversWhole('ATTENDANCE_SETUP', 'WRITE', { companyId }))
  // (while the lists load: anyone with Edit - so the toolbar does not jump when they arrive)
  const canAdd = lists.data ? lists.data.some((l) => mayChange(l.companyId)) : can('ATTENDANCE_SETUP', 'WRITE')
  return (
    <Card
      title="Holidays"
      hint="Each holiday is in the holiday lists that have it - everyone following one of them that day is off, the whole day or one half (the other half is worked). A list has one holiday a day. A holiday on a day already worked out works that month out again."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <ExportButton disabled={!holidays.data?.length || holidays.isFetching} load={() => client.attendance.exportSetup({ section: 'holidays', year })} />
          <NativeSelect className="[&_select]:h-9 [&_select]:rounded-full" aria-label="Year" value={String(year)} onChange={(e) => setYear(Number(e.target.value))}>
            {[year - 1, year, year + 1].map((y) => (
              <NativeSelectOption key={y} value={String(y)}>
                {y}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect className="[&_select]:h-9 [&_select]:rounded-full" aria-label="Holiday list" value={listId} onChange={(e) => setListId(e.target.value)}>
            <NativeSelectOption value="">Every list</NativeSelectOption>
            {lists.data?.map((l) => (
              <NativeSelectOption key={l.id} value={String(l.id)}>
                {l.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {canAdd && (
            <Button variant="secondary" size="sm" disabled={copy.isPending} onClick={() => copy.mutate({ year })}>
              <Copy /> {copy.isPending ? 'Copying…' : `Copy from ${year - 1}`}
            </Button>
          )}
          {canAdd && (
            <Button variant="gold" size="sm" onClick={() => setEditing('new')}>
              <Plus /> Add a holiday
            </Button>
          )}
        </div>
      }
    >
      <FormError error={holidays.error ?? remove.error ?? copy.error} />
      {copy.data && (
        <p className="text-sm text-positive-ink">
          Copied {copy.data.copied} holiday{copy.data.copied === 1 ? '' : 's'} from {year - 1}
          {copy.data.skipped ? ` - ${copy.data.skipped} left out (already there, a locked month, or lists you may not change)` : ''}. Move the festivals whose dates differ.
        </p>
      )}
      {holidays.isPending && <HolidayRowsSkeleton canChange={canAdd} />}
      {holidays.data?.length === 0 && (
        <EmptyState className="py-6" title={`No holidays in ${year}${listId ? ' in this list' : ''} yet`} hint={canAdd ? `Add them, or copy ${year - 1}'s and move the festivals whose dates differ.` : 'HR adds them.'} />
      )}
      <ul className="divide-y text-sm">
        {holidays.data?.map((h) => (
          <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium tabular-nums">{formatDate(h.date)}</span>
              <span>{h.name}</span>
              <Pill tone={toneOf(h.category.tone)}>{h.category.name}</Pill>
              {h.portion !== 'FULL_DAY' && <span className="text-xs text-muted-foreground">{HOLIDAY_PORTION[h.portion]}</span>}
              {/* taken on application from a leave balance (2026-11-24) */}
              {h.mode === 'ON_APPLICATION' && (
                <span className="text-xs text-info-ink">
                  On application · {h.leaveType?.code}
                  {h.allowHalfDay ? ' · half days too' : ''}
                </span>
              )}
              <span className="text-xs text-muted-foreground">{h.lists.map((l) => l.name).join(', ')}</span>
            </span>
            {h.lists.every((l) => mayChange(l.companyId)) && (
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

// Adds or changes a holiday: its date, name, category, the part of the day off and the lists that have it (only lists the
// viewer may change are offered)
function HolidayDialog({ holiday, mayChange, onClose }: { holiday: Holiday | null; mayChange: (companyId: number | null) => boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const lists = useQuery(orpc.attendance.holidayLists.list.queryOptions({ input: {} }))
  const categories = useQuery(orpc.attendance.holidayCategories.list.queryOptions({ input: {} }))
  // the lists in use the viewer may change, and those the holiday is in already (one retired since stays, to untick)
  const inUse = lists.data?.filter((l) => mayChange(l.companyId)) ?? []
  const offered = [
    ...inUse.map((l) => ({ id: l.id, name: l.name, company: l.company?.code ?? null, retired: false })),
    ...(holiday?.lists ?? []).filter((l) => !inUse.some((u) => u.id === l.id)).map((l) => ({ id: l.id, name: l.name, company: null, retired: true })),
  ]
  const start = {
    date: toDateInput(holiday?.date ?? null),
    name: holiday?.name ?? '',
    categoryId: holiday ? String(holiday.category.id) : '',
    portion: holiday?.portion ?? ('FULL_DAY' as Portion),
    mode: holiday?.mode ?? ('AUTOMATIC' as Mode),
    leaveTypeId: holiday?.leaveType ? String(holiday.leaveType.id) : '',
    allowHalfDay: holiday?.allowHalfDay ?? false,
    listIds: (holiday?.lists.map((l) => l.id) ?? []).sort().join(),
  }
  const [date, setDate] = useState(start.date)
  const [name, setName] = useState(start.name)
  const [categoryId, setCategoryId] = useState(start.categoryId)
  const [portion, setPortion] = useState<Portion>(start.portion)
  // how it is given (2026-11-24): everyone off, or taken on application from a leave type "only on its holiday dates"
  const [mode, setMode] = useState<Mode>(start.mode)
  const [leaveTypeId, setLeaveTypeId] = useState(start.leaveTypeId)
  const [allowHalfDay, setAllowHalfDay] = useState(start.allowHalfDay)
  const leaveTypes = useQuery(orpc.leave.types.list.queryOptions({ input: {} }))
  const holidayTypes = leaveTypes.data?.filter((t) => t.holidaysOnly) ?? []
  const [ticked, setTicked] = useState<Set<number>>(() => new Set(holiday?.lists.map((l) => l.id) ?? []))
  const toggle = (id: number, on: boolean) =>
    setTicked((current) => {
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  const done = {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orpc.attendance.key() })
      onClose()
    },
  }
  const create = useMutation(orpc.attendance.holidays.create.mutationOptions(done))
  const update = useMutation(orpc.attendance.holidays.update.mutationOptions(done))
  const listIds = [...ticked]
  const dirty =
    date !== start.date ||
    name !== start.name ||
    categoryId !== start.categoryId ||
    portion !== start.portion ||
    mode !== start.mode ||
    leaveTypeId !== start.leaveTypeId ||
    allowHalfDay !== start.allowHalfDay ||
    [...listIds].sort().join() !== start.listIds
  const onApplication = mode === 'ON_APPLICATION'
  const data = {
    date: fromDateInput(date)!,
    name,
    categoryId: Number(categoryId),
    holidayListIds: listIds,
    mode,
    // on application: a whole day, half days when allowed, from its leave type; automatic: the part of the day off
    portion: onApplication ? ('FULL_DAY' as Portion) : portion,
    leaveTypeId: onApplication && leaveTypeId ? Number(leaveTypeId) : null,
    allowHalfDay: onApplication && allowHalfDay,
  }
  const busy = create.isPending || update.isPending
  return (
    <FormDialog onOpenChange={(open) => !open && onClose()} dirty={dirty} className="rounded-3xl sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{holiday ? `Edit ${holiday.name}` : 'Add a holiday'}</DialogTitle>
        <DialogDescription>{onApplication ? 'Everyone following a ticked list may apply to take it, from their leave balance.' : 'Everyone following a ticked list that day is off.'}</DialogDescription>
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
          <Label htmlFor="ho-category" className="text-xs text-muted-foreground">
            Category
          </Label>
          <NativeSelect id="ho-category" className="w-full [&_select]:h-9 [&_select]:rounded-xl" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <NativeSelectOption value="">{categories.isPending ? 'Loading…' : 'Choose…'}</NativeSelectOption>
            {categories.data?.map((c) => (
              <NativeSelectOption key={c.id} value={String(c.id)}>
                {c.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ho-mode" className="text-xs text-muted-foreground">
            Given
          </Label>
          <NativeSelect id="ho-mode" className="w-full [&_select]:h-9 [&_select]:rounded-xl" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <NativeSelectOption value="AUTOMATIC">To everyone on the lists</NativeSelectOption>
            <NativeSelectOption value="ON_APPLICATION">On application</NativeSelectOption>
          </NativeSelect>
        </div>
        {onApplication ? (
          <div className="space-y-1">
            <Label htmlFor="ho-leave" className="text-xs text-muted-foreground">
              Taken from
            </Label>
            <NativeSelect id="ho-leave" className="w-full [&_select]:h-9 [&_select]:rounded-xl" value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
              <NativeSelectOption value="">{leaveTypes.isPending ? 'Loading…' : 'Choose…'}</NativeSelectOption>
              {holidayTypes.map((t) => (
                <NativeSelectOption key={t.id} value={String(t.id)}>
                  {t.name} ({t.code})
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="ho-portion" className="text-xs text-muted-foreground">
              Day off
            </Label>
            <NativeSelect id="ho-portion" className="w-full [&_select]:h-9 [&_select]:rounded-xl" value={portion} onChange={(e) => setPortion(e.target.value as Portion)}>
              {(Object.keys(HOLIDAY_PORTION) as Portion[]).map((p) => (
                <NativeSelectOption key={p} value={p}>
                  {HOLIDAY_PORTION[p]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        )}
      </div>
      {onApplication && (
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={allowHalfDay} onCheckedChange={(on) => setAllowHalfDay(on === true)} /> May be taken as a half day
          </label>
          <p className="text-xs text-muted-foreground">
            A working day for everyone on the lists unless they apply for it - approved like leave, from the balance HR gives (Team leave › Balances › Give days).
            {leaveTypes.isSuccess && !holidayTypes.length && ' No leave type is taken only on its holiday dates yet - tick that on one under Leave types first.'}
          </p>
        </div>
      )}
      <fieldset className="space-y-1.5">
        <legend className="text-xs text-muted-foreground">In the holiday lists</legend>
        {lists.isSuccess && !offered.length && <p className="text-sm text-warning-ink">No holiday list you may change yet - add one under Holiday lists below.</p>}
        <div className="grid gap-1.5 pt-1 sm:grid-cols-2">
          {offered.map((l) => (
            <label key={l.id} className="flex items-center gap-2 rounded-xl bg-surface-2/60 px-3 py-2 text-sm">
              <Checkbox checked={ticked.has(l.id)} onCheckedChange={(on) => toggle(l.id, on)} />
              <span className="min-w-0 truncate">{l.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">{l.retired ? 'Retired' : (l.company ?? 'Every company')}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {categories.isSuccess && !categories.data.length && <p className="text-sm text-warning-ink">No holiday category yet - add one under Holiday categories below.</p>}
      <FormError error={create.error ?? update.error ?? lists.error ?? categories.error ?? leaveTypes.error} />
      <DialogFooter>
        <DialogCancel />
        <Button
          variant="gold"
          disabled={!date || !name.trim() || !categoryId || !listIds.length || (onApplication && !leaveTypeId) || busy}
          onClick={() => (holiday ? update.mutate({ id: holiday.id, ...data }) : create.mutate(data))}
        >
          Save
        </Button>
      </DialogFooter>
    </FormDialog>
  )
}
