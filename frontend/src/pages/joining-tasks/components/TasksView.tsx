import { ExportButton } from '@/components/ExportButton'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Search, Undo2 } from 'lucide-react'
import { type CSSProperties, useState } from 'react'
import { Link } from 'react-router'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { TaskCardsSkeleton } from '@/components/skeletons/joining-tasks/TaskCardsSkeleton'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccess } from '@/hooks/useAccess'
import { client, orpc } from '@/lib/orpc'
import { cn, formatDate, formatDoneBy, initialsOf } from '@/lib/utils'
import { PersonChip, TeamChip } from './Chips'
import { daysFromToday, dueStatus, type JoiningTask, openTasksInput, type Scope } from './labels'

// The tasks of "My tasks" (scope MINE) and "All tasks" (scope ALL), redesigned 2026-11-20: a toolbar (to do / done, team,
// search, and quick filters with counts - overdue, due today, given to nobody), then one card per new employee with their
// tasks as one-line rows - a round tick to mark it done, the team, the due date as a status, and (All tasks) who it is
// given to, which HR can change.

type Quick = 'LATE' | 'TODAY' | 'NOBODY' | null

const isToday = (t: JoiningTask) => !t.doneAt && !t.overdue && daysFromToday(t.dueDate) <= 0
const QUICK: { value: Exclude<Quick, null>; label: string; test: (t: JoiningTask) => boolean; on: string; dot: string }[] = [
  { value: 'LATE', label: 'Overdue', test: (t) => t.overdue, on: 'bg-destructive/10 text-negative-ink ring-destructive/30', dot: 'bg-destructive' },
  { value: 'TODAY', label: 'Due today', test: isToday, on: 'bg-warning/15 text-warning-ink ring-warning/40', dot: 'bg-warning' },
  { value: 'NOBODY', label: 'Given to nobody', test: (t) => !t.assignedTo, on: 'bg-info/15 text-info-ink ring-info/40', dot: 'bg-info' },
]

const dayMonth = (date: Date) => date.toLocaleDateString('en-IN', { timeZone: 'UTC', day: '2-digit', month: 'short' })

export function TasksView({ scope }: { scope: Scope }) {
  const { can, me } = useAccess()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<'OPEN' | 'DONE'>('OPEN')
  const [team, setTeam] = useState('')
  const [search, setSearch] = useState('')
  const [quick, setQuick] = useState<Quick>(null)
  const input = team || search.trim() || status === 'DONE' ? { scope, status, team: team || undefined, search: search.trim() || undefined } : openTasksInput(scope)
  // keep showing the last answer while the next loads (no "Loading…" flash on every key typed in the search)
  const tasks = useQuery({ ...orpc.joiningTasks.list.queryOptions({ input }), placeholderData: keepPreviousData })
  const hr = can('ONBOARDING', 'WRITE')
  // the teams (roles with "Joining tasks: Edit") and their people - a task goes to someone of its own team
  const teams = useQuery({ ...orpc.joiningTasks.assignees.queryOptions({ input: {} }), enabled: scope === 'ALL' && hr })
  const peopleFor = (t: JoiningTask) =>
    t.roleId !== null
      ? (teams.data?.find((team) => team.id === t.roleId)?.people ?? [])
      : [...new Map(teams.data?.flatMap((team) => team.people.map((p) => [p.employeeCode, p] as const))).values()]
  const refresh = () => void queryClient.invalidateQueries({ queryKey: orpc.joiningTasks.key() })
  const reopen = useMutation(orpc.joiningTasks.reopen.mutationOptions({ onSuccess: refresh }))
  const assign = useMutation(orpc.joiningTasks.assign.mutationOptions({ onSuccess: refresh }))
  const [completing, setCompleting] = useState<JoiningTask | null>(null)
  // "Undo" asks first (2026-11-21); the note stays on the task
  const [undoing, setUndoing] = useState<JoiningTask | null>(null)
  // the person it is given to (with Edit), or HR
  const canMark = (t: JoiningTask) => hr || (t.assignedTo?.employeeCode === me?.employeeCode && can('JOINING_TASKS', 'WRITE'))

  const items = tasks.data?.items ?? []
  const quicks = status === 'OPEN' ? QUICK.filter((q) => q.value !== 'NOBODY' || scope === 'ALL') : []
  const active = quicks.find((q) => q.value === quick)
  const shown = active ? items.filter(active.test) : items
  // one group per new employee, in the list's order (oldest due first, so the most urgent person is on top)
  const groups = new Map<string, JoiningTask[]>()
  for (const t of shown) groups.set(t.employee.employeeCode, [...(groups.get(t.employee.employeeCode) ?? []), t])

  const showAssignee = scope === 'ALL'
  const done = status === 'DONE'
  // the row's columns from the sm breakpoint: tick, task, team, due, (given to), (undo)
  const columns = ['2.25rem', 'minmax(0,1fr)', '8.5rem', '11rem', ...(showAssignee ? ['14rem'] : []), ...(done ? ['5.5rem'] : [])].join(' ')

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-card p-2 shadow-card">
        <ExportButton className="order-last ml-auto" disabled={!shown.length || tasks.isFetching} load={() => client.joiningTasks.export({ ...input, ids: shown.map((t) => t.id) })} />
        <div className="flex gap-1 rounded-full bg-surface-2 p-1">
          {(['OPEN', 'DONE'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setStatus(value)
                setQuick(null)
              }}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
                status === value ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {value === 'OPEN' ? 'To do' : 'Done'}
            </button>
          ))}
        </div>
        <NativeSelect className="[&_select]:h-9 [&_select]:rounded-full" value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team">
          <NativeSelectOption value="">Every team</NativeSelectOption>
          {tasks.data?.teams.map((t) => (
            <NativeSelectOption key={t.team} value={t.team}>
              {t.team} ({t.open} to do)
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <div className="relative w-full sm:w-auto">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-9 w-full rounded-full pl-9 sm:w-56" placeholder="Name or employee code" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {quicks.length > 0 && (
          <div className="flex flex-wrap gap-1.5 sm:ml-auto">
            {quicks.map((q) => {
              const count = items.filter(q.test).length
              const on = quick === q.value
              return (
                <button
                  key={q.value}
                  type="button"
                  aria-pressed={on}
                  disabled={!count && !on}
                  onClick={() => setQuick(on ? null : q.value)}
                  className={cn(
                    'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium ring-1 transition-colors disabled:opacity-45',
                    on ? q.on : 'text-muted-foreground ring-border enabled:hover:bg-surface-2 enabled:hover:text-foreground',
                  )}
                >
                  <span aria-hidden className={cn('size-1.5 rounded-full', q.dot)} />
                  {q.label}
                  {tasks.isPending ? <Skeleton className="h-3 w-2 rounded-full" /> : <span className="font-semibold tabular-nums">{count}</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>
      <FormError error={tasks.error ?? reopen.error ?? assign.error} />
      {tasks.isPending && <TaskCardsSkeleton columns={columns} assignee={showAssignee} label="Loading joining tasks" />}
      {tasks.data && shown.length === 0 && (
        <EmptyState
          className="py-8"
          title={
            active
              ? `Nothing ${active.label.toLowerCase()}`
              : !done
                ? scope === 'MINE'
                  ? 'Nothing to do'
                  : 'No open joining tasks'
                : 'No tasks done yet'
          }
          hint={!active && !done && scope === 'MINE' ? 'Tasks given to you for new employees appear here.' : undefined}
        />
      )}
      {[...groups.values()].map((list) => {
        const e = list[0]!.employee
        const late = list.filter((t) => t.overdue).length
        const joins = daysFromToday(e.dateOfJoining) > 0
        return (
          <section key={e.employeeCode} className={cn('overflow-hidden rounded-2xl bg-card shadow-card', tasks.isPlaceholderData && 'opacity-60')}>
            <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-2.5">
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-gold-soft text-xs font-semibold">
                {initialsOf(e.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {can('EMPLOYEES') ? (
                    <Link to={`/manage/employees/${e.employeeCode}`} className="font-medium underline-offset-2 hover:underline">
                      {e.name}
                    </Link>
                  ) : (
                    <span className="font-medium">{e.name}</span>
                  )}{' '}
                  <span className="text-xs text-muted-foreground tabular-nums">{e.employeeCode}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">{[e.designation, e.department, e.company].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground max-sm:w-full max-sm:pl-12">
                <span>
                  {joins ? 'Joins' : 'Joined'} <span className="font-medium text-foreground tabular-nums">{formatDate(e.dateOfJoining)}</span>
                </span>
                {late > 0 && <Pill tone="negative">{late} overdue</Pill>}
                <span className="rounded-full bg-surface-2 px-2.5 py-1 font-medium tabular-nums">
                  {list.length} {done ? 'done' : 'to do'}
                </span>
              </div>
            </header>
            <ul className="divide-y">
              {list.map((t) => {
                const due = dueStatus(t)
                return (
                  <li
                    key={t.id}
                    style={{ '--cols': columns } as CSSProperties}
                    className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 px-4 py-2 sm:grid-cols-(--cols)"
                  >
                    <Tick task={t} canMark={canMark(t)} onMark={() => setCompleting(t)} />
                    <div className="min-w-0">
                      <p className={cn('text-sm font-medium', t.doneAt && 'text-muted-foreground')}>{t.name}</p>
                      {t.doneAt ? (
                        <p className="text-xs text-muted-foreground">
                          Done {formatDoneBy(t.doneAt, t.doneBy)}
                          {t.note && <span className="text-foreground"> · {t.note}</span>}
                        </p>
                      ) : (
                        <>
                          {t.description && (
                            <p className="text-xs text-muted-foreground sm:truncate" title={t.description}>
                              {t.description}
                            </p>
                          )}
                          {/* a note kept by an undo */}
                          {t.note && <p className="text-xs text-foreground sm:truncate">Note: {t.note}</p>}
                        </>
                      )}
                    </div>
                    {/* on a phone: one line under the task; from sm: the row's own columns */}
                    <div className="col-start-2 flex flex-wrap items-center gap-2 sm:contents">
                      <div className="min-w-0">
                        <TeamChip team={t.team} />
                      </div>
                      <div className="flex items-center gap-2" title={`Due ${formatDate(t.dueDate)}`}>
                        {/* only what needs attention gets colour: overdue and due today */}
                        {due.tone === 'negative' || due.tone === 'warning' ? (
                          <Pill tone={due.tone}>{due.text}</Pill>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t.doneAt ? 'Was due' : due.text}</span>
                        )}
                        <span className="text-xs text-muted-foreground tabular-nums">{dayMonth(t.dueDate)}</span>
                      </div>
                      {showAssignee && (
                        <div className="min-w-0 max-sm:w-full">
                          {hr && !t.doneAt ? (
                            <NativeSelect
                              aria-label={`Given to - ${t.name}`}
                              className={cn(
                                'w-full [&_select]:h-8 [&_select]:rounded-full [&_select]:text-xs',
                                // quiet while someone has it; stands out when nobody does (HR's thing to fix)
                                t.assignedTo
                                  ? '[&_select]:border-transparent [&_select]:bg-transparent [&_select]:shadow-none [&_select:hover]:border-border'
                                  : '[&_select]:border-info/50 [&_select]:bg-info/10 [&_select]:font-medium [&_select]:text-info-ink',
                              )}
                              value={t.assignedTo?.employeeCode ?? ''}
                              disabled={assign.isPending}
                              onChange={(e) => e.target.value && assign.mutate({ id: t.id, assigneeCode: e.target.value })}
                            >
                              <NativeSelectOption value="">Given to nobody yet</NativeSelectOption>
                              {/* the current person, even if they no longer have the access */}
                              {t.assignedTo?.employeeCode && !peopleFor(t).some((p) => p.employeeCode === t.assignedTo?.employeeCode) && (
                                <NativeSelectOption value={t.assignedTo.employeeCode}>{t.assignedTo.name}</NativeSelectOption>
                              )}
                              {peopleFor(t).map((p) => (
                                <NativeSelectOption key={p.employeeCode} value={p.employeeCode}>
                                  {p.name}
                                </NativeSelectOption>
                              ))}
                            </NativeSelect>
                          ) : t.assignedTo ? (
                            <PersonChip name={t.assignedTo.name} initials={initialsOf(t.assignedTo.name)} />
                          ) : (
                            <span className="text-xs font-medium text-info-ink">Given to nobody yet</span>
                          )}
                        </div>
                      )}
                      {done && (
                        <div className="sm:text-right">
                          {canMark(t) && (
                            <Button variant="ghost" size="sm" disabled={reopen.isPending} onClick={() => setUndoing(t)}>
                              <Undo2 /> Undo
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      {completing && <CompleteDialog task={completing} onClose={() => setCompleting(null)} />}
      {undoing && (
        <ConfirmDialog
          title={`Undo "${undoing.name}"?`}
          description={`It goes back to the to-do list for ${undoing.employee.name}.${undoing.note ? ' Its note is kept for when it is marked done again.' : ''}`}
          confirm="Undo done"
          pending={reopen.isPending}
          onConfirm={() => reopen.mutate({ id: undoing.id }, { onSuccess: () => setUndoing(null) })}
          onClose={() => setUndoing(null)}
        />
      )}
    </div>
  )
}

// The round tick at the start of a row: click it to mark the task done (when you may); filled green once done; dashed
// when it is someone else's to do
function Tick({ task, canMark, onMark }: { task: JoiningTask; canMark: boolean; onMark: () => void }) {
  const circle = 'grid size-6 place-items-center rounded-full border-2 transition-colors'
  if (task.doneAt)
    return (
      <span className="grid size-9 place-items-center" title="Done">
        <span className={cn(circle, 'border-positive bg-positive text-background')}>
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      </span>
    )
  if (!canMark)
    return (
      <span className="grid size-9 place-items-center" title="Given to someone else">
        <span className={cn(circle, 'border-dashed border-foreground/25')} />
      </span>
    )
  return (
    <button
      type="button"
      aria-label={`Mark done: ${task.name}`}
      title="Mark done"
      onClick={onMark}
      className="group grid size-9 place-items-center rounded-full transition-colors hover:bg-positive/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span
        className={cn(
          circle,
          task.overdue ? 'border-destructive/60' : 'border-foreground/30',
          'text-positive group-hover:border-positive group-focus-visible:border-positive',
        )}
      >
        <Check className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" strokeWidth={3} />
      </span>
    </button>
  )
}

// Marking a task done, with an optional note (e.g. "laptop serial ABC123")
function CompleteDialog({ task, onClose }: { task: JoiningTask; onClose: () => void }) {
  const queryClient = useQueryClient()
  // a note kept by an undo is filled in again
  const [note, setNote] = useState(task.note ?? '')
  const complete = useMutation(
    orpc.joiningTasks.complete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.joiningTasks.key() })
        onClose()
      },
    }),
  )
  const due = dueStatus(task)
  return (
    <FormDialog onOpenChange={(open) => !open && onClose()} dirty={note.trim() !== (task.note ?? '')} className="rounded-3xl sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{task.name}</DialogTitle>
        <DialogDescription>
          For {task.employee.name} ({task.employee.employeeCode}). Mark it done - add a note if useful.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap items-center gap-2">
        <TeamChip team={task.team} />
        <Pill tone={due.tone}>{due.text}</Pill>
        <span className="text-xs text-muted-foreground">{formatDate(task.dueDate)}</span>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="task-note" className="text-xs text-muted-foreground">
          Note (optional)
        </Label>
        <Input
          id="task-note"
          autoFocus
          className="h-10 rounded-xl"
          maxLength={500}
          placeholder="e.g. laptop serial ABC123"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <FormError error={complete.error} />
      <DialogFooter>
        <DialogCancel />
        <Button variant="gold" disabled={complete.isPending} onClick={() => complete.mutate({ id: task.id, note: note.trim() || null })}>
          <Check /> {complete.isPending ? 'Saving…' : 'Mark done'}
        </Button>
      </DialogFooter>
    </FormDialog>
  )
}
