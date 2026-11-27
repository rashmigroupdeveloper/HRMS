import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmployeePicker, type PickedEmployee } from '@/components/EmployeePicker'
import { FormError } from '@/components/FormError'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { orpc } from '@/lib/orpc'
import { formatDate, fromDateInput, toDateInput, todayDay } from '@/lib/utils'
import { NOT_TRACKED_NOTE } from './labels'

// "Attendance not tracked" (the user, 2026-11-27): someone who does not punch counts present on their working days.
// Two drawers on Schedules, so unsaved input is never lost by accident: marking one person or many (ticked there, or
// added here), and changing one person's marker - its last day, its reason - or removing it.

export type NotTrackedMarker = { id: number; fromDate: Date; toDate: Date | null; reason: string; current: boolean }

const splitCodes = (text: string) =>
  text
    .split(/[\s,;]+/)
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)

// Marks employees from a day - with a last day, or until ended
export function NotTrackedDrawer({ people: start, onClose, onSaved }: { people: PickedEmployee[]; onClose: () => void; onSaved?: () => void }) {
  const queryClient = useQueryClient()
  const [people, setPeople] = useState(start)
  const [picker, setPicker] = useState(0)
  const [pasted, setPasted] = useState('')
  const [initialFrom] = useState(() => toDateInput(todayDay()))
  const [from, setFrom] = useState(initialFrom)
  const [until, setUntil] = useState('')
  const [reason, setReason] = useState('')
  const mark = useMutation(
    orpc.attendance.exemptions.create.mutationOptions({
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
  const dirty = people.map((p) => p.employeeCode).join() !== start.map((p) => p.employeeCode).join() || pasted.trim() !== '' || from !== initialFrom || until !== '' || reason.trim() !== ''
  const one = start.length === 1 ? start[0]! : null
  const backwards = !!from && !!until && until < from
  return (
    <FormDrawer
      onClose={onClose}
      closed={mark.isSuccess}
      dirty={dirty && !mark.isSuccess}
      width={520}
      title={one ? `Attendance of ${one.name}` : start.length ? `Attendance of ${start.length} employees` : 'Mark attendance not tracked'}
      description={one ? `${one.employeeCode} · not tracked from the date below` : 'Not tracked for everyone below, from the date below'}
      footer={
        <>
          <DrawerCancel />
          <Button
            variant="gold"
            disabled={!codes.length || !from || backwards || reason.trim().length < 3 || mark.isPending}
            onClick={() => mark.mutate({ employeeCodes: codes, fromDate: fromDateInput(from)!, toDate: until ? (fromDateInput(until) ?? null) : null, reason: reason.trim() })}
          >
            {mark.isPending ? 'Saving…' : one && codes.length === 1 ? 'Mark not tracked' : `Mark ${codes.length} employee${codes.length === 1 ? '' : 's'}`}
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="ntd-from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input id="ntd-from" type="date" className="h-10 rounded-xl" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ntd-until" className="text-xs text-muted-foreground">
              Until (empty: until ended)
            </Label>
            <Input id="ntd-until" type="date" className="h-10 rounded-xl" min={from || undefined} value={until} onChange={(e) => setUntil(e.target.value)} />
          </div>
        </div>
        {backwards && <p role="alert" className="text-xs text-negative-ink">The last day is before the first day.</p>}
        <div className="space-y-1">
          <Label htmlFor="ntd-reason" className="text-xs text-muted-foreground">
            Why their attendance is not tracked
          </Label>
          <Input id="ntd-reason" className="h-10 rounded-xl" maxLength={300} placeholder="e.g. Senior management - does not punch" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <p className="text-xs text-muted-foreground">{NOT_TRACKED_NOTE}</p>
        <FormError error={mark.error} />
      </div>
    </FormDrawer>
  )
}

// Changes one person's marker: its last day and its reason - or removes it (set by mistake)
export function NotTrackedChangeDrawer({ person, marker, onClose }: { person: PickedEmployee; marker: NotTrackedMarker; onClose: () => void }) {
  const queryClient = useQueryClient()
  const initialUntil = marker.toDate ? toDateInput(marker.toDate) : ''
  const [until, setUntil] = useState(initialUntil)
  const [reason, setReason] = useState(marker.reason)
  const [removing, setRemoving] = useState(false)
  const saved = () => void queryClient.invalidateQueries({ queryKey: orpc.attendance.key() })
  const save = useMutation(orpc.attendance.exemptions.update.mutationOptions({ onSuccess: saved }))
  const remove = useMutation(orpc.attendance.exemptions.delete.mutationOptions({ onSuccess: saved }))
  const firstDay = toDateInput(marker.fromDate)
  const backwards = !!until && until < firstDay
  const dirty = until !== initialUntil || reason.trim() !== marker.reason
  const done = save.isSuccess || remove.isSuccess
  return (
    <>
      <FormDrawer
        onClose={onClose}
        closed={done}
        dirty={dirty && !done}
        width={480}
        title={`Attendance of ${person.name}`}
        description={`${person.employeeCode} · not tracked from ${formatDate(marker.fromDate)}`}
        footer={
          <>
            <Button variant="ghost" className="mr-auto gap-1.5 text-negative-ink" disabled={save.isPending || remove.isPending} onClick={() => setRemoving(true)}>
              <Trash2 className="size-4" aria-hidden /> Remove
            </Button>
            <DrawerCancel />
            <Button
              variant="gold"
              disabled={!dirty || backwards || reason.trim().length < 3 || save.isPending || remove.isPending}
              onClick={() => save.mutate({ id: marker.id, toDate: until ? (fromDateInput(until) ?? null) : null, reason: reason.trim() })}
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="ntc-until" className="text-xs text-muted-foreground">
              Until (empty: until ended)
            </Label>
            <Input id="ntc-until" type="date" className="h-10 rounded-xl" min={firstDay} value={until} onChange={(e) => setUntil(e.target.value)} />
            <p className="text-xs text-muted-foreground">Set the last day when they start to punch. The days after it are worked out from the punches again.</p>
          </div>
          {backwards && <p role="alert" className="text-xs text-negative-ink">The last day is before the first day - to take the marker away altogether, remove it.</p>}
          <div className="space-y-1">
            <Label htmlFor="ntc-reason" className="text-xs text-muted-foreground">
              Why their attendance is not tracked
            </Label>
            <Input id="ntc-reason" className="h-10 rounded-xl" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">{NOT_TRACKED_NOTE}</p>
          <FormError error={save.error ?? remove.error} />
        </div>
      </FormDrawer>
      {removing && (
        <ConfirmDialog
          title="Remove the marker?"
          description={`${person.name}'s attendance from ${formatDate(marker.fromDate)} is worked out from the punches again - a working day without a punch becomes absent. To stop it from a later day instead, set a last day.`}
          confirm={remove.isPending ? 'Removing…' : 'Remove'}
          pending={remove.isPending}
          onConfirm={() => remove.mutate({ id: marker.id }, { onSettled: () => setRemoving(false) })}
          onClose={() => { if (!remove.isPending) setRemoving(false) }}
        />
      )}
    </>
  )
}
