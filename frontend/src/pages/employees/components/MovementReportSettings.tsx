import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FormDialog, DialogCancel } from '@/components/FormDialog'
import { FormError } from '@/components/FormError'
import { SearchableSelect } from '@/components/SearchableSelect'
import { MovementSettingsSkeleton } from '@/components/skeletons/employees/MovementSettingsSkeleton'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { orpc, type client } from '@/lib/orpc'

type Data = Awaited<ReturnType<typeof client.dailyMovementReports.settings.get>>
const timeOf = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

export function MovementReportSettings({ close }: { close: () => void }) {
  const query = useQuery(orpc.dailyMovementReports.settings.get.queryOptions())
  return query.data ? <SettingsForm data={query.data} close={close} /> : <FormDialog onOpenChange={close} className="sm:max-w-lg">
    <SettingsHeader />
    {query.isPending ? <MovementSettingsSkeleton /> : <FormError error={query.error} />}
    <DialogFooter>{query.isError && <Button variant="secondary" onClick={() => void query.refetch()}>Try again</Button>}<DialogCancel />{query.isPending && <Button disabled>Save settings</Button>}</DialogFooter>
  </FormDialog>
}

function SettingsHeader() {
  return <DialogHeader><DialogTitle>Daily movement email</DialogTitle><DialogDescription>Save the schedule and HR Head role. Email delivery and additional recipients will be connected in the next stage; no emails are sent yet.</DialogDescription></DialogHeader>
}

function SettingsForm({ data, close }: { data: Data; close: () => void }) {
  // Snapshot the opened settings: refetches must never replace unsaved input or its concurrency token.
  const [initial] = useState(data.setting)
  const [role, setRole] = useState(String(initial.hrHeadRole?.id ?? ''))
  const [time, setTime] = useState(timeOf(initial.sendAtMinutes))
  const [coverage, setCoverage] = useState(initial.coverage)
  const [sendEmpty, setSendEmpty] = useState(initial.sendEmpty)
  const queryClient = useQueryClient()
  const save = useMutation({ ...orpc.dailyMovementReports.settings.save.mutationOptions(), onSuccess: saved => {
    if (saved) queryClient.setQueryData(orpc.dailyMovementReports.settings.get.queryOptions().queryKey, { ...data, setting: saved })
    void queryClient.invalidateQueries({ queryKey: orpc.dailyMovementReports.settings.get.key() })
    close()
  } })
  const dirty = role !== String(initial.hrHeadRole?.id ?? '') || time !== timeOf(initial.sendAtMinutes) || coverage !== initial.coverage || sendEmpty !== initial.sendEmpty
  const valid = data.roles.some(r => String(r.id) === role) && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  return <FormDialog onOpenChange={() => { if (!save.isPending) close() }} dirty={dirty && !save.isSuccess} className="sm:max-w-lg">
    <SettingsHeader />
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (!valid || save.isPending) return; const [hours, minutes] = time.split(':').map(Number); save.mutate({ hrHeadRoleId: Number(role), sendAtMinutes: hours * 60 + minutes, coverage, sendEmpty, expectedUpdatedAt: initial.updatedAt }) }}>
      <fieldset disabled={save.isPending} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="movement-head-role">HR Head role</Label><SearchableSelect id="movement-head-role" value={role} onChange={setRole} options={data.roles.map(r => ({ value: String(r.id), label: r.name }))} placeholder="Choose a role" className="h-9 w-full" disabled={save.isPending} /><p className="text-xs text-muted-foreground">Requires Employee directory &amp; job View access. Selecting a role does not grant access.</p>{role && !data.roles.some(r => String(r.id) === role) && <p role="alert" className="text-sm text-negative-ink">The saved role no longer has the required access. Choose another role.</p>}{!data.roles.length && <p className="text-sm text-negative-ink">Give a role Employee directory &amp; job View access in Roles &amp; access, then reopen these settings.</p>}</div>
        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label htmlFor="movement-send-time">Send time · IST</Label><Input id="movement-send-time" className="h-9" type="time" required value={time} onChange={e => setTime(e.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="movement-coverage">Report covers</Label><NativeSelect id="movement-coverage" className="w-full [&_select]:h-9" value={coverage} onChange={e => setCoverage(e.target.value as typeof coverage)}><NativeSelectOption value="PREVIOUS_DAY">Previous day</NativeSelectOption><NativeSelectOption value="TODAY">Same day</NativeSelectOption></NativeSelect></div></div>
        <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm"><Checkbox checked={sendEmpty} onCheckedChange={setSendEmpty} disabled={save.isPending} />Send a summary on days with no movements</label>
      </fieldset>
      <FormError error={save.error} />
      <DialogFooter><DialogCancel disabled={save.isPending} /><Button type="submit" disabled={!valid || save.isPending || (!dirty && initial.updatedAt !== null)}>{save.isPending ? 'Saving…' : 'Save settings'}</Button></DialogFooter>
    </form>
  </FormDialog>
}
