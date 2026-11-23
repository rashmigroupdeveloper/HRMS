import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/FormError'
import { SharedListNote } from '@/components/SharedListNote'
import { RowsSkeleton } from '@/components/skeletons/common/RowsSkeleton'
import { TaskTypesSkeleton } from '@/components/skeletons/joining-tasks/TaskTypesSkeleton'
import { Button } from '@/components/ui/button'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { useAccess } from '@/hooks/useAccess'
import { orpc } from '@/lib/orpc'
import { cn, initialsOf } from '@/lib/utils'
import { PersonChip, TeamChip } from './Chips'
import { JOINING_TYPE, type JoiningType, type TaskType, teamDot } from './labels'

// The task list (2026-11-16): the tasks every new employee gets on the joining day, each with its team, due days, the
// joining types it is for and the person it is given to by default. "Joining task types": Edit changes it (2026-11-21); a change applies to
// employees joining from then on. Retired, never deleted. The team is a role with "Joining tasks: Edit" (2026-11-20).
// Shown (2026-11-20) in the order things happen: under a heading per day after joining ("Joining day", "Day 2"...), one
// line per task; the retired ones folded away at the end.
export function TaskTypesSection() {
  const queryClient = useQueryClient()
  // the list is shared by every company: Edit for all companies (B13)
  const canChange = useAccess().coversGroup('JOINING_TASK_TYPES')
  const types = useQuery(orpc.joiningTasks.types.list.queryOptions({ input: { includeInactive: canChange } }))
  const update = useMutation(orpc.joiningTasks.types.update.mutationOptions({ onSuccess: () => void queryClient.invalidateQueries({ queryKey: orpc.joiningTasks.key() }) }))
  const [editing, setEditing] = useState<TaskType | 'new' | null>(null)
  const [showRetired, setShowRetired] = useState(false)

  const active = types.data?.filter((t) => t.isActive) ?? []
  const retired = types.data?.filter((t) => !t.isActive) ?? []
  const days = [...new Set(active.map((t) => t.dueDays))].sort((a, b) => a - b)
  const lastDay = days[days.length - 1] ?? 0
  const nobody = active.filter((t) => !t.defaultAssignee).length
  const row = (t: TaskType) => <TypeRow key={t.id} type={t} canChange={canChange} busy={update.isPending} onEdit={() => setEditing(t)} onToggle={() => update.mutate({ id: t.id, isActive: !t.isActive })} />

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl bg-card py-2 pr-2 pl-4 shadow-card">
        <p className="text-sm text-muted-foreground">
          {active.length ? (
            <>
              <span className="font-medium text-foreground">
                {active.length} task{active.length === 1 ? '' : 's'}
              </span>{' '}
              for every new employee, {lastDay === 0 ? 'all on the joining day' : `over the first ${lastDay + 1} days`}
              {nobody > 0 && ` · ${nobody} without a default person (HR picks at joining)`}
            </>
          ) : (
            'The tasks every new employee gets'
          )}
          <span className="max-md:hidden"> · changes apply to employees joining from now on</span>
        </p>
        {canChange && (
          <Button variant="gold" size="sm" onClick={() => setEditing('new')}>
            <Plus /> Add a task
          </Button>
        )}
      </div>
      <SharedListNote area="JOINING_TASK_TYPES" label="Joining task types" className="px-1" />
      <FormError error={types.error ?? update.error} />
      {types.isPending && <TaskTypesSkeleton canChange={canChange} label="Loading the task list" />}
      {types.data && active.length === 0 && (
        <EmptyState className="py-8" title="No tasks on the list yet" hint={canChange ? 'Add the first one - e.g. "Create the e-mail ID" for IT.' : undefined} />
      )}
      {active.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-card shadow-card">
          {days.map((day) => {
            const list = active.filter((t) => t.dueDays === day)
            return (
              <div key={day}>
                <h3 className="flex items-center gap-2 border-b bg-surface-2/60 px-4 py-1.5 text-xs font-medium [&:not(:first-child)]:border-t">
                  <span className={cn('grid h-5 min-w-5 place-items-center rounded-full px-1.5 tabular-nums', day === 0 ? 'bg-hero text-hero-foreground' : 'bg-card')}>
                    {day === 0 ? 'D' : `+${day}`}
                  </span>
                  {day === 0 ? 'Joining day' : `${day} day${day === 1 ? '' : 's'} after joining`}
                  <span className="font-normal text-muted-foreground">· {list.length}</span>
                </h3>
                <ul className="divide-y">{list.map(row)}</ul>
              </div>
            )
          })}
        </div>
      )}
      {retired.length > 0 && (
        <div>
          <button
            type="button"
            aria-expanded={showRetired}
            onClick={() => setShowRetired((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground hover:bg-card hover:text-foreground"
          >
            <ChevronDown className={cn('size-3.5 transition-transform', !showRetired && '-rotate-90')} />
            Retired ({retired.length})
          </button>
          {showRetired && <ul className="mt-1 divide-y overflow-hidden rounded-2xl bg-card opacity-75 shadow-card">{retired.map(row)}</ul>}
        </div>
      )}
      {editing && <TaskTypeDialog type={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  )
}

// One task on the list: the task (and what exactly to do), its team, the joining types it is for, who gets it by default
function TypeRow({ type: t, canChange, busy, onEdit, onToggle }: { type: TaskType; canChange: boolean; busy: boolean; onEdit: () => void; onToggle: () => void }) {
  return (
    <li
      className={cn(
        'grid grid-cols-1 items-center gap-x-3 gap-y-1.5 px-4 py-2',
        canChange ? 'sm:grid-cols-[minmax(0,1fr)_8.5rem_11rem_13rem_6.5rem]' : 'sm:grid-cols-[minmax(0,1fr)_8.5rem_11rem_13rem]',
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">{t.name}</p>
        {t.description && (
          <p className="text-xs text-muted-foreground sm:truncate" title={t.description}>
            {t.description}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:contents">
        <div className="min-w-0">
          <TeamChip team={t.team} />
        </div>
        <p className="text-xs text-muted-foreground">{t.joiningTypes.length ? t.joiningTypes.map((j) => JOINING_TYPE[j]).join(', ') : 'Every joining type'}</p>
        <div className="min-w-0">
          {t.defaultAssignee ? (
            <PersonChip name={t.defaultAssignee.name} initials={initialsOf(t.defaultAssignee.name)} />
          ) : (
            <span className="text-xs text-muted-foreground italic">HR picks at joining</span>
          )}
        </div>
        {canChange && (
          <div className="flex items-center gap-0.5 max-sm:ml-auto sm:justify-end">
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${t.name}`} title="Edit" onClick={onEdit}>
              <Pencil />
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={busy} onClick={onToggle}>
              {t.isActive ? 'Retire' : 'Re-activate'}
            </Button>
          </div>
        )}
      </div>
    </li>
  )
}

// Adding / changing a task on the list (redesigned 2026-11-20): the task, its team (a role with "Joining tasks: Edit" -
// the user, 2026-11-20), when it is due (quick picks or any number of days), the joining types as toggles, the default
// person (a holder of the role), what exactly to do - and a preview of the line it makes on the list.
const DUE_PICKS = [0, 1, 2, 3, 7]

function TaskTypeDialog({ type, onClose }: { type: TaskType | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  // the teams: roles with "Joining tasks: Edit", each with its people
  const teams = useQuery(orpc.joiningTasks.assignees.queryOptions({ input: {} }))
  // what the form opened with - anything different is unsaved input
  const [initial] = useState(() => ({
    name: type?.name ?? '',
    roleId: type ? String(type.role.id) : '',
    description: type?.description ?? '',
    dueDays: String(type?.dueDays ?? 0),
    joiningTypes: type?.joiningTypes ?? ([] as JoiningType[]),
    defaultAssigneeCode: type?.defaultAssignee?.employeeCode ?? '',
  }))
  const [values, setValues] = useState(initial)
  const dirty = (Object.keys(values) as (keyof typeof values)[]).some((k) => String(values[k]) !== String(initial[k]))
  const done = {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orpc.joiningTasks.key() })
      onClose()
    },
  }
  const create = useMutation(orpc.joiningTasks.types.create.mutationOptions(done))
  const update = useMutation(orpc.joiningTasks.types.update.mutationOptions(done))
  const pending = create.isPending || update.isPending
  const set = (field: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }))
  const ready = values.name.trim() && values.roleId && /^\d+$/.test(values.dueDays)
  const days = /^\d+$/.test(values.dueDays) ? Number(values.dueDays) : null
  const toggleType = (j: JoiningType) =>
    setValues((v) => ({ ...v, joiningTypes: v.joiningTypes.includes(j) ? v.joiningTypes.filter((x) => x !== j) : [...v.joiningTypes, j] }))
  const team = teams.data?.find((t) => String(t.id) === values.roleId)
  // picking a team keeps the default person only if they are in it
  const pickTeam = (id: number) =>
    setValues((v) => ({
      ...v,
      roleId: String(id),
      defaultAssigneeCode: teams.data?.find((t) => t.id === id)?.people.some((p) => p.employeeCode === v.defaultAssigneeCode) ? v.defaultAssigneeCode : '',
    }))
  // the person picked, by name (also one who no longer holds the role)
  const person =
    team?.people.find((p) => p.employeeCode === values.defaultAssigneeCode)?.name ??
    (type?.defaultAssignee?.employeeCode === values.defaultAssigneeCode ? type?.defaultAssignee?.name : undefined)

  function save() {
    const data = {
      name: values.name,
      roleId: Number(values.roleId),
      description: values.description.trim() || null,
      dueDays: Number(values.dueDays),
      joiningTypes: values.joiningTypes,
      defaultAssigneeCode: values.defaultAssigneeCode || null,
    }
    if (type) update.mutate({ id: type.id, ...data })
    else create.mutate(data)
  }

  const chip = (on: boolean) =>
    cn(
      'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium ring-1 transition-colors',
      on ? 'bg-hero text-hero-foreground ring-hero' : 'text-muted-foreground ring-border hover:bg-surface-2 hover:text-foreground',
    )

  return (
    <FormDialog onOpenChange={(open) => !open && onClose()} dirty={dirty} className="rounded-3xl sm:max-w-xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-full bg-gold-soft">{type ? <Pencil className="size-3.5" /> : <Plus className="size-4" />}</span>
          {type ? 'Edit task' : 'Add a task'}
        </DialogTitle>
        <DialogDescription className="text-xs">For employees joining from now on - tasks already made keep what they were made with.</DialogDescription>
      </DialogHeader>
      <form
        id="task-type-form"
        className="-mx-4 max-h-[60vh] space-y-4 overflow-y-auto px-4 py-1"
        onSubmit={(e) => {
          e.preventDefault()
          if (ready && !pending) save()
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="tt-name" className="text-xs text-muted-foreground">
            Task<span className="text-negative-ink">*</span>
          </Label>
          <Input id="tt-name" autoFocus className="h-10 rounded-xl text-base" placeholder="e.g. Create the e-mail ID" value={values.name} onChange={set('name')} />
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            Team<span className="text-negative-ink">*</span>
          </p>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Team">
            {teams.isPending && <RowsSkeleton rows={3} className="flex gap-1.5 space-y-0" rowClassName="h-8 w-24 rounded-full" label="Loading the teams" />}
            {teams.data?.map((t) => (
              <button key={t.id} type="button" aria-pressed={values.roleId === String(t.id)} onClick={() => pickTeam(t.id)} className={chip(values.roleId === String(t.id))}>
                <span aria-hidden className={cn('size-2 rounded-full', teamDot(t.name))} />
                {t.name}
                <span className="opacity-60">· {t.people.length}</span>
              </button>
            ))}
            {type && !teams.data?.some((t) => t.id === type.role.id) && (
              <span className="text-xs text-warning-ink">{type.role.name} no longer gives "Joining tasks: Edit" - pick another team</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">The roles that give "Joining tasks: Edit" (Roles & access); the task goes to someone with that role.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tt-due" className="text-xs text-muted-foreground">
            Due<span className="text-negative-ink">*</span>
          </Label>
          <div className="flex flex-wrap items-center gap-1.5">
            {DUE_PICKS.map((d) => (
              <button key={d} type="button" aria-pressed={days === d} onClick={() => setValues((v) => ({ ...v, dueDays: String(d) }))} className={chip(days === d)}>
                {d === 0 ? 'Joining day' : `+${d} day${d === 1 ? '' : 's'}`}
              </button>
            ))}
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              or
              <Input id="tt-due" type="number" min={0} max={365} className="h-8 w-16 rounded-full text-center text-sm" value={values.dueDays} onChange={set('dueDays')} />
              days after joining
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">For</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Joining types">
            <button type="button" aria-pressed={values.joiningTypes.length === 0} onClick={() => setValues((v) => ({ ...v, joiningTypes: [] }))} className={chip(values.joiningTypes.length === 0)}>
              Every joining type
            </button>
            {(Object.keys(JOINING_TYPE) as JoiningType[]).map((j) => (
              <button key={j} type="button" aria-pressed={values.joiningTypes.includes(j)} onClick={() => toggleType(j)} className={chip(values.joiningTypes.includes(j))}>
                {values.joiningTypes.includes(j) && <Check className="size-3.5" />}
                {JOINING_TYPE[j]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tt-person" className="text-xs text-muted-foreground">
            Given to (by default)
          </Label>
          <NativeSelect
            id="tt-person"
            className="w-full [&_select]:h-10 [&_select]:rounded-xl"
            value={values.defaultAssigneeCode}
            disabled={!team}
            onChange={set('defaultAssigneeCode')}
          >
            <NativeSelectOption value="">{team ? 'Nobody - HR picks at joining' : 'Pick the team first'}</NativeSelectOption>
            {values.defaultAssigneeCode && type?.defaultAssignee?.employeeCode === values.defaultAssigneeCode && !team?.people.some((p) => p.employeeCode === values.defaultAssigneeCode) && (
              <NativeSelectOption value={values.defaultAssigneeCode}>{type.defaultAssignee.name} (not in this team)</NativeSelectOption>
            )}
            {team?.people.map((p) => (
              <NativeSelectOption key={p.employeeCode} value={p.employeeCode}>
                {p.name} ({p.employeeCode})
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <p className="text-xs text-muted-foreground">
            {team && !team.people.length ? `Nobody has the "${team.name}" role yet (Roles & access).` : 'People with the team\'s role.'}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tt-desc" className="text-xs text-muted-foreground">
            What exactly to do (optional)
          </Label>
          <Textarea id="tt-desc" rows={2} className="min-h-0 rounded-xl" maxLength={1000} placeholder="e.g. firstname.lastname@…, add to the plant group" value={values.description} onChange={set('description')} />
        </div>
      </form>

      {/* what the line on the list will look like */}
      <div className="rounded-xl bg-surface-2/70 px-3.5 py-2.5">
        <p className="mb-1 text-xs text-muted-foreground">Preview</p>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm">
          <span className={cn('font-medium', !values.name.trim() && 'text-muted-foreground italic')}>{values.name.trim() || 'Task name'}</span>
          {team && <TeamChip team={team.name} />}
          <span className="text-xs text-muted-foreground">
            {days === null ? 'due ?' : days === 0 ? 'on the joining day' : `${days} day${days === 1 ? '' : 's'} after joining`} ·{' '}
            {values.joiningTypes.length ? values.joiningTypes.map((j) => JOINING_TYPE[j]).join(', ') : 'every joining type'} ·{' '}
            {person ? `given to ${person}` : 'HR picks at joining'}
          </span>
        </div>
      </div>

      <FormError error={create.error ?? update.error ?? teams.error} />
      <DialogFooter className="rounded-b-3xl">
        <DialogCancel />
        <Button type="submit" form="task-type-form" variant="gold" disabled={!ready || pending}>
          {pending ? 'Saving…' : type ? 'Save' : 'Add task'}
        </Button>
      </DialogFooter>
    </FormDialog>
  )
}
