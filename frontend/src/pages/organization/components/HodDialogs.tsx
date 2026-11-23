import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { EmployeePicker } from '@/components/EmployeePicker'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { HodHistorySkeleton } from '@/components/skeletons/organization/HodHistorySkeleton'
import { HodPlacesSkeleton } from '@/components/skeletons/organization/HodPlacesSkeleton'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { type client, orpc } from '@/lib/orpc'
import { cn, formatLastDay, formatMoment, fromDateInput, toDateInput } from '@/lib/utils'
import { HodAvatar } from './HodAvatar'
import { HodPlacesPicker } from './HodPlacesPicker'

// The Department heads tab's dialogs (BACKLOG 3e): add an HOD / change their places, hand their places over, end their
// appointments, their history, a place's history. A change takes effect now, or from a day - earlier (it was already made) or later (it is
// planned) - in India time for every plant (2026-11-19). The backend checks every rule again (data
// access, the moments, one HOD per place).

export type Hod = Awaited<ReturnType<typeof client.employees.hods.list>>[number]
// someone whose appointments can be ended: their code, name and places (a planned end, or not started yet) - and a
// leaver's leaving day (the end offered first)
export type HodPerson = {
  employeeCode: string
  name: string
  dateOfLeaving?: Date | null
  places: { id: number; label: string; canChange?: boolean; status?: string; startsAt?: Date; endsAt?: Date | null }[]
}

const sameSet = (a: Set<number>, b: Set<number>) => a.size === b.size && [...a].every((id) => b.has(id))
// one entry per place (someone may have two appointments of a place: now and again later)
const byPlace = <P extends { id: number }>(places: P[]) => [...new Map(places.map((p) => [p.id, p])).values()]
// "from 1 Dec" / "until 19 Nov" - what is planned for a place
function noteOf(place: HodPerson['places'][number]) {
  if (place.status === 'UPCOMING' && place.startsAt) return `from ${formatMoment(place.startsAt, true)}`
  return place.endsAt ? `until ${formatLastDay(place.endsAt, true)}` : undefined
}

// After a change: the HODs, places and gaps, the employees' profiles (their HOD) and the menu ("My department")
function useHodsChanged() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: orpc.employees.hods.key() })
    void queryClient.invalidateQueries({ queryKey: orpc.employees.getByCode.key() })
    void queryClient.invalidateQueries({ queryKey: orpc.accounts.me.key() })
  }
}

// --- when a change takes effect ---

// now; a day (+ a time if needed), India time; for an end, "no end" (takes back a planned end)
export type When = { mode: 'now' | 'day' | 'none'; day: string; time: string }
const NOW: When = { mode: 'now', day: '', time: '' }
// A start at this moment in India time: its day, and the time unless it is midnight - e.g. the successor
// of an HOD who stops then (the gap list's "Appoint next")
export function whenAt(at: Date): When {
  const timeZone = 'Asia/Kolkata'
  const time = at.toLocaleTimeString('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  return { mode: 'day', day: at.toLocaleDateString('en-CA', { timeZone }), time: time === '00:00' ? '' : time }
}
const sameWhen = (a: When, b: When) => a.mode === b.mode && (a.mode !== 'day' || (a.day === b.day && a.time === b.time))
const whenReady = (w: When) => w.mode !== 'day' || !!w.day
// for the API: none = now; a day = its start (an end: the end of the last day), or that minute of it
function toClock(w: When) {
  if (w.mode !== 'day' || !w.day) return undefined
  const [hours, minutes] = w.time ? w.time.split(':').map(Number) : []
  return { day: fromDateInput(w.day)!, minute: w.time ? hours! * 60 + minutes! : undefined }
}

function WhenField({ id, value, onChange, end, keep }: { id: string; value: When; onChange: (when: When) => void; end?: boolean; keep?: boolean }) {
  // today by the browser's clock ("YYYY-MM-DD")
  const [today] = useState(() => new Date().toLocaleDateString('en-CA'))
  const modes: [When['mode'], string][] = [
    ['now', 'Now'],
    ['day', end ? 'After a last day' : 'From a day'],
    ...(keep ? [['none', 'No end'] as [When['mode'], string]] : []),
  ]
  const hint =
    value.mode === 'now'
      ? end
        ? 'They stop at this moment.'
        : 'From this moment.'
      : value.mode === 'none'
        ? 'Takes back the planned end - they stay HOD.'
        : end
          ? value.time
            ? `They stop at ${value.time} on that day (India time).`
            : 'They stop at the end of that day.'
          : value.time
            ? `From ${value.time} on that day (India time).`
            : 'From the start of that day. An earlier day records a change already made; a later one plans it.'
  return (
    <div className="space-y-1.5">
      <div role="radiogroup" aria-label={end ? 'When they stop' : 'When they start'} className="inline-flex rounded-full bg-surface-2 p-0.5">
        {modes.map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={value.mode === mode}
            onClick={() => onChange({ ...value, mode, day: value.day || today })}
            className={cn(
              'inline-flex h-8 items-center rounded-full px-3 text-xs font-medium transition-colors max-sm:h-9',
              value.mode === mode ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {value.mode === 'day' && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor={`${id}-day`} className="text-xs text-muted-foreground">
              {end ? 'Last day *' : 'First day *'}
            </Label>
            <Input id={`${id}-day`} type="date" className="w-40" value={value.day} onChange={(e) => onChange({ ...value, day: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-time`} className="text-xs text-muted-foreground">
              {end ? 'Until (optional)' : 'At (optional)'}
            </Label>
            <Input id={`${id}-time`} type="time" className="w-32" value={value.time} onChange={(e) => onChange({ ...value, time: e.target.value })} />
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

// --- the dialogs ---

// Add an HOD (pick the person) - or change an HOD's places: tick the places they head; the ones ticked anew start at the
// moment chosen (replacing whoever heads them then), the ones unticked end at that moment
// `from`: the moment offered first (else now)
export function HodPlacesDrawer({ hod, preselect, from, onClose }: { hod?: Hod; preselect?: number[]; from?: When; onClose: () => void }) {
  const changed = useHodsChanged()
  const places = useQuery(orpc.employees.hods.places.queryOptions())
  const [code, setCode] = useState(hod?.employeeCode ?? '')
  const [start] = useState<When>(from ?? NOW)
  const [when, setWhen] = useState<When>(start)
  // the places they head (or will) that the user may change (Change places) - or the ones to start with (the gap list)
  const [initial] = useState(() => new Set(hod ? hod.places.filter((p) => p.canChange).map((p) => p.id) : (preselect ?? [])))
  const [selected, setSelected] = useState(initial)
  const [closed, setClosed] = useState(false)
  const current = hod ? initial : new Set<number>()
  const added = [...selected].filter((id) => !current.has(id))
  const removed = [...current].filter((id) => !selected.has(id))
  const byId = new Map((places.data ?? []).map((p) => [p.id, p]))
  const replacing = added.filter((id) => {
    const holder = byId.get(id)?.hod
    return holder && holder.employeeCode !== code
  }).length
  const appoint = useMutation(
    orpc.employees.hods.appoint.mutationOptions({
      onSuccess: () => {
        changed()
        setClosed(true)
      },
    }),
  )
  const dirty = (!hod && !!code) || !sameSet(selected, initial) || !sameWhen(when, start)
  return (
    <FormDrawer
      onClose={onClose}
      closed={closed}
      dirty={dirty && !appoint.isPending}
      width={720}
      title={hod ? `Places of ${hod.name}` : 'Add an HOD'}
      description={
        hod
          ? 'Tick the places they head. The ones ticked anew start at the moment below; the ones unticked end at that moment (one not started yet is cancelled).'
          : 'Pick the person and tick the places they head - a place is a department at a plant. Whoever heads a ticked place then is replaced at that moment.'
      }
      footer={
        <>
          <DrawerCancel />
          <Button
            variant="gold"
            disabled={!code || !whenReady(when) || added.length + removed.length === 0 || appoint.isPending}
            onClick={() => appoint.mutate({ employeeCode: code, from: toClock(when), postIds: added, endPostIds: removed.length ? removed : undefined })}
          >
            {appoint.isPending ? 'Saving…' : hod ? 'Save places' : `Appoint to ${added.length} place${added.length === 1 ? '' : 's'}`}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        {hod ? (
          <p className="text-sm">
            <span className="font-medium">{hod.name}</span> <span className="text-xs text-muted-foreground tabular-nums">{hod.employeeCode}</span>
          </p>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="hod-person" className="text-xs text-muted-foreground">
              HOD *
            </Label>
            <EmployeePicker id="hod-person" value={code} onChange={(picked) => setCode(picked?.employeeCode ?? '')} />
          </div>
        )}
        <WhenField id="hod-from" value={when} onChange={setWhen} />
      </div>
      {(added.length > 0 || removed.length > 0) && (
        <p className="text-xs text-muted-foreground">
          {added.length > 0 && `${added.length} place${added.length === 1 ? '' : 's'} added${replacing ? ` (${replacing} with another HOD now - replaced at that moment)` : ''}`}
          {added.length > 0 && removed.length > 0 && ' · '}
          {removed.length > 0 && `${removed.length} taken away at the same moment`}
        </p>
      )}
      <FormError error={places.error ?? appoint.error} />
      {places.isPending ? (
        <HodPlacesSkeleton label="Loading the places" />
      ) : (
        <HodPlacesPicker places={places.data ?? []} selected={selected} onChange={setSelected} person={code || undefined} />
      )}
    </FormDrawer>
  )
}

// Hand an HOD's places (all, or the ones ticked) over to another person - from now or a day; their appointments end then
export function HandOverDialog({ hod, onClose }: { hod: Hod; onClose: () => void }) {
  const changed = useHodsChanged()
  const mine = byPlace(hod.places.filter((p) => p.canChange && p.status === 'CURRENT'))
  const [code, setCode] = useState('')
  const [when, setWhen] = useState<When>(NOW)
  const [ticked, setTicked] = useState(() => new Set(mine.map((p) => p.id)))
  const appoint = useMutation(
    orpc.employees.hods.appoint.mutationOptions({
      onSuccess: () => {
        changed()
        onClose()
      },
    }),
  )
  return (
    <FormDialog
      dirty={(!!code || ticked.size !== mine.length || !sameWhen(when, NOW)) && !appoint.isSuccess}
      className="rounded-3xl sm:max-w-lg"
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogHeader>
        <DialogTitle>Hand over {hod.name}&apos;s places</DialogTitle>
        <DialogDescription>The new HOD heads the ticked places from the moment below; {hod.name}&apos;s appointments there end at that very moment.</DialogDescription>
      </DialogHeader>
      <div className="space-y-1">
        <Label htmlFor="handover-to" className="text-xs text-muted-foreground">
          New HOD *
        </Label>
        <EmployeePicker id="handover-to" value={code} excludeCode={hod.employeeCode} onChange={(picked) => setCode(picked?.employeeCode ?? '')} />
      </div>
      <WhenField id="handover-from" value={when} onChange={setWhen} />
      <PlaceTicks places={mine.map((p) => ({ id: p.id, label: p.label, note: noteOf(p) }))} ticked={ticked} onChange={setTicked} />
      <FormError error={appoint.error} />
      <DialogFooter>
        <DialogCancel />
        <Button
          variant="gold"
          disabled={!code || !whenReady(when) || !ticked.size || appoint.isPending}
          onClick={() => appoint.mutate({ employeeCode: code, from: toClock(when), postIds: [...ticked] })}
        >
          {appoint.isPending ? 'Saving…' : `Hand over ${ticked.size}`}
        </Button>
      </DialogFooter>
    </FormDialog>
  )
}

// End someone's appointments on the ticked places - now, or after a last day (planned, or already past); an appointment not
// started yet is cancelled; "No end" takes back a planned end. A leaver's leaving day is offered first (their real last
// day - also for one who left already, so the history is right)
export function EndHodDialog({ person, onClose }: { person: HodPerson; onClose: () => void }) {
  const changed = useHodsChanged()
  const mine = byPlace(person.places.filter((p) => p.canChange !== false))
  const [start] = useState<When>(() => (person.dateOfLeaving ? { mode: 'day', day: toDateInput(person.dateOfLeaving), time: '' } : NOW))
  const [when, setWhen] = useState<When>(start)
  const [ticked, setTicked] = useState(() => new Set(mine.map((p) => p.id)))
  // "No end" only when a ticked place has a planned end
  const keep = mine.some((p) => ticked.has(p.id) && !!p.endsAt)
  const mode = !keep && when.mode === 'none' ? NOW : when
  const end = useMutation(
    orpc.employees.hods.end.mutationOptions({
      onSuccess: () => {
        changed()
        onClose()
      },
    }),
  )
  return (
    <FormDialog dirty={(!sameWhen(mode, start) || ticked.size !== mine.length) && !end.isSuccess} className="rounded-3xl sm:max-w-lg" onOpenChange={(open) => !open && onClose()}>
      <DialogHeader>
        <DialogTitle>End {person.name}&apos;s appointments</DialogTitle>
        <DialogDescription>
          After the end the ticked places have no HOD until someone is appointed (the gap list). A place they have not started yet is cancelled.
        </DialogDescription>
      </DialogHeader>
      <WhenField id="end-hod" value={mode} onChange={setWhen} end keep={keep} />
      <PlaceTicks places={mine.map((p) => ({ id: p.id, label: p.label, note: noteOf(p) }))} ticked={ticked} onChange={setTicked} />
      <FormError error={end.error} />
      <DialogFooter>
        <DialogCancel />
        <Button
          variant={mode.mode === 'none' ? 'gold' : 'destructive'}
          disabled={!whenReady(mode) || !ticked.size || end.isPending}
          onClick={() => end.mutate({ employeeCode: person.employeeCode, lastDay: mode.mode === 'none' ? null : toClock(mode), postIds: [...ticked] })}
        >
          {end.isPending ? 'Saving…' : mode.mode === 'none' ? `Keep ${ticked.size}` : `End ${ticked.size}`}
        </Button>
      </DialogFooter>
    </FormDialog>
  )
}

// The places of one HOD as ticks (all ticked to start with), with what is planned for each
function PlaceTicks({ places, ticked, onChange }: { places: { id: number; label: string; note?: string }[]; ticked: Set<number>; onChange: (ticked: Set<number>) => void }) {
  const all = places.length > 0 && places.every((p) => ticked.has(p.id))
  return (
    <div className="space-y-1.5 rounded-2xl bg-surface-2/60 px-3 py-2.5">
      <label className="flex items-center gap-2 text-xs font-semibold">
        <Checkbox checked={all} onCheckedChange={(checked) => onChange(new Set(checked === true ? places.map((p) => p.id) : []))} />
        Places · {ticked.size} of {places.length}
      </label>
      <ul className="max-h-64 space-y-1 overflow-y-auto pl-1">
        {places.map((place) => (
          <li key={place.id}>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={ticked.has(place.id)}
                onCheckedChange={(checked) => {
                  const next = new Set(ticked)
                  if (checked === true) next.add(place.id)
                  else next.delete(place.id)
                  onChange(next)
                }}
              />
              <span>
                {place.label}
                {place.note && <span className="text-xs text-muted-foreground"> · {place.note}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

// The places someone headed, heads or will head, from when to when (India time - "who was the HOD on 15-05"); a place
// opens its own history (everyone who headed it)
export function HodHistoryDialog({ person, onClose }: { person: { employeeCode: string; name: string }; onClose: () => void }) {
  const history = useQuery(orpc.employees.hods.history.queryOptions({ input: { employeeCode: person.employeeCode } }))
  const [place, setPlace] = useState<{ id: number; label: string } | null>(null)
  if (place) return <PlaceHistoryDialog places={[place]} onClose={() => setPlace(null)} />
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-3xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{person.name} as HOD</DialogTitle>
          <DialogDescription>The places they headed, the latest first (India time).</DialogDescription>
        </DialogHeader>
        <FormError error={history.error} />
        {history.isPending ? (
          <HodHistorySkeleton label="Loading their HOD history" />
        ) : !history.data?.length ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <ul className="max-h-[60vh] divide-y overflow-y-auto">
            {history.data.map((row) => {
              return (
                <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 text-sm">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      className="text-left underline-offset-4 hover:underline"
                      title="Everyone who headed this place"
                      onClick={() => setPlace({ id: row.post.id, label: row.post.label })}
                    >
                      {row.post.label}
                    </button>
                    {row.status === 'UPCOMING' && <Pill tone="info">Upcoming</Pill>}
                    {row.status === 'CURRENT' && row.endsAt && <Pill tone="warning">Ending</Pill>}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatMoment(row.startsAt)} → {row.endsAt ? formatLastDay(row.endsAt) : row.status === 'UPCOMING' ? 'no end' : 'now'}
                    {row.appointedBy && ` · by ${row.appointedBy.name}`}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Who headed a place, from when to when - former HODs too, the latest first (India time; the user, 2026-11-20). With
// several places (a plant's departments) one is picked from a list.
export function PlaceHistoryDialog({ title, places, onClose }: { title?: string; places: { id: number; label: string }[]; onClose: () => void }) {
  const [postId, setPostId] = useState(places[0]?.id ?? 0)
  const place = places.find((p) => p.id === postId) ?? places[0]
  const history = useQuery({ ...orpc.employees.hods.history.queryOptions({ input: { postId } }), enabled: postId > 0 })
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-3xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title ?? `HOD history · ${place?.label ?? ''}`}</DialogTitle>
          <DialogDescription>Everyone who headed {places.length > 1 ? 'the department' : 'this place'}, the latest first (India time).</DialogDescription>
        </DialogHeader>
        {places.length > 1 && (
          <NativeSelect aria-label="Department" className="w-full [&_select]:h-9 [&_select]:rounded-xl" value={String(postId)} onChange={(e) => setPostId(Number(e.target.value))}>
            {places.map((p) => (
              <NativeSelectOption key={p.id} value={String(p.id)}>
                {p.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
        <FormError error={history.error} />
        {history.isPending ? (
          <HodHistorySkeleton person label="Loading the HOD history" />
        ) : !history.data?.length ? (
          <p className="text-sm text-muted-foreground">Nobody has headed it yet.</p>
        ) : (
          <ol className="max-h-[60vh] divide-y overflow-y-auto">
            {history.data.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <HodAvatar name={row.name} code={row.employeeCode} size="xs" />
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{row.name}</span> <span className="text-xs text-muted-foreground">{row.employeeCode}</span>
                  </span>
                  {row.status === 'UPCOMING' && <Pill tone="info">Upcoming</Pill>}
                  {row.status === 'CURRENT' && <Pill tone={row.endsAt ? 'warning' : 'positive'}>{row.endsAt ? 'Ending' : 'Now'}</Pill>}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatMoment(row.startsAt)} → {row.endsAt ? formatLastDay(row.endsAt) : row.status === 'UPCOMING' ? 'no end' : 'now'}
                  {row.appointedBy && ` · by ${row.appointedBy.name}`}
                </span>
              </li>
            ))}
          </ol>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
