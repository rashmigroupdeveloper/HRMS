import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, CircleCheck, CircleX, FileText, ListChecks, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { EmployeePicker } from '@/components/EmployeePicker'
import { DrawerCancel, FormDrawer } from '@/components/FormDrawer'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { orpc } from '@/lib/orpc'
import { cn, errorMessage, fromDateInput, toDateInput, todayDay } from '@/lib/utils'
import { JoiningChecklistSkeleton } from '@/components/skeletons/onboarding/JoiningChecklistSkeleton'
import { type Candidate, CHECK_GROUPS, fullName } from './labels'
import { PrintFormsButton } from './PrintForms'

// The joining day: the checklist (joining form, medical, required documents verified) and what HR types in
// (employee code, actual joining date, work e-mail, reporting manager, holiday list, probation end) and who does each joining task (2026-11-16 - the
// task's default person, changeable). Completing it creates the employee, their joining tasks and the appointment letter.
export function JoiningDialog({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) {
  return <JoiningForm candidate={candidate} onClose={onClose} />
}

// End of probation for an offer of `months` months: the day before the same date that many months after joining
// (01 Sep + 6 months -> 28 Feb / 29 Feb). None when the offer has no probation.
function probationEnd(dateOfJoining: string, months: number | null): string {
  if (!dateOfJoining || !months) return ''
  const start = new Date(`${dateOfJoining}T00:00:00Z`)
  const year = start.getUTCFullYear()
  const month = start.getUTCMonth() + months
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const end = new Date(Date.UTC(year, month, Math.min(start.getUTCDate(), lastDay)))
  end.setUTCDate(end.getUTCDate() - 1)
  return toDateInput(end)
}

function JoiningForm({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) {
  const queryClient = useQueryClient()
  const checklist = useQuery({ ...orpc.candidates.joining.checklist.queryOptions({ input: { candidateId: candidate.id } }), staleTime: 0 })
  const [today] = useState(() => toDateInput(todayDay()))
  const proposed = toDateInput(candidate.proposedJoiningDate)
  // who the new employee reports to (their employee code)
  const [managerCode, setManagerCode] = useState('')
  // the holiday list followed from the date of joining (the user, 2026-11-24): the plant's default, until HR picks another
  // ('' = none - no holidays until HR gives one); the lists in use of the candidate's company or of every company
  const holidayLists = useQuery(orpc.attendance.holidayLists.list.queryOptions({ input: {} }))
  const usableLists = (holidayLists.data ?? []).filter((l) => l.companyId === null || l.companyId === candidate.company.id)
  const plantDefault = usableLists.find((l) => l.defaultPlants.some((p) => p.id === candidate.plant.id))
  const [listPicked, setListPicked] = useState<string | null>(null)
  const holidayListId = listPicked ?? (plantDefault ? String(plantDefault.id) : '')
  const [startDate] = useState(proposed > today ? today : proposed)
  const [dateOfJoining, setDateOfJoining] = useState(startDate)
  const [workEmail, setWorkEmail] = useState('')
  // suggested from the offer's probation months and the joining date, until HR types another date
  const [probationTyped, setProbationTyped] = useState<string | null>(null)
  const probationEndDate = probationTyped ?? probationEnd(dateOfJoining, candidate.probationMonths)
  // the joining tasks this employee gets (the active ones for the joining type) and who does each: someone of the task's
  // team (role) whose data access covers the new employee - the default person, until HR picks another. Each task starts
  // ticked; HR unticks the ones this employee does not need. Every ticked task needs a person; with no task type at all HR
  // ticks "No joining tasks" (the user, 2026-11-20).
  const taskTypes = useQuery(orpc.joiningTasks.types.list.queryOptions())
  const teams = useQuery(
    orpc.joiningTasks.assignees.queryOptions({
      input: { placement: { companyId: candidate.company.id, plantId: candidate.plant.id, departmentId: candidate.department?.id ?? null } },
    }),
  )
  const tasks = (taskTypes.data ?? []).filter((t) => !t.joiningTypes.length || t.joiningTypes.includes(candidate.joiningType))
  const [picked, setPicked] = useState<Record<number, string>>({})
  const [noTasks, setNoTasks] = useState(false)
  // the tasks HR unticked (not needed for this employee)
  const [skipped, setSkipped] = useState<Set<number>>(() => new Set())
  const toggleTask = (id: number) =>
    setSkipped((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const peopleFor = (t: (typeof tasks)[number]) => teams.data?.find((team) => team.id === t.role.id)?.people ?? []
  // (a default person who no longer holds the role covering this employee is not offered)
  const personOf = (t: (typeof tasks)[number]) =>
    picked[t.id] ?? (peopleFor(t).some((p) => p.employeeCode === t.defaultAssignee?.employeeCode) ? t.defaultAssignee!.employeeCode! : '')
  const tasksReady = taskTypes.isSuccess && teams.isSuccess && (tasks.length ? tasks.every((t) => skipped.has(t.id) || personOf(t)) : noTasks)
  const complete = useMutation(
    orpc.candidates.joining.complete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.candidates.key() })
        void queryClient.invalidateQueries({ queryKey: orpc.employees.key() })
      },
    }),
  )

  if (complete.data) {
    return (
      <FormDrawer
        onClose={onClose}
        width={640}
        title={<>Joined</>}
        description={
          <>
            {fullName(candidate)} is now employee <strong className="text-foreground">{complete.data.employeeCode}</strong>. The joining
            form, documents and IDs moved to the employee record.
            {complete.data.joiningTasks > 0 && ` ${complete.data.joiningTasks} joining task(s) were given out.`}
          </>
        }
        footer={
          <>
            <DrawerCancel>Close</DrawerCancel>
            <Button variant="gold" nativeButton={false} render={<Link to={`/manage/employees/${complete.data.employeeCode}`} />}>
              Open employee profile
            </Button>
          </>
        }
      >
        {/* the appointment letter, issued automatically - or why not (HR issues it from the profile's Letters tab) */}
        {complete.data.appointmentLetter.issued ? (
          <p className="flex items-start gap-2 rounded-2xl bg-positive/10 px-4 py-3 text-sm text-positive-ink">
            <FileText className="mt-0.5 size-4 shrink-0" />
            <span>
              Appointment letter <strong>{complete.data.appointmentLetter.letterNumber}</strong> issued
              {complete.data.appointmentLetter.emailedTo ? ` and e-mailed to ${complete.data.appointmentLetter.emailedTo}.` : ' - not e-mailed; download it from the profile’s Letters tab.'}
            </span>
          </p>
        ) : (
          <p className="flex items-start gap-2 rounded-2xl bg-warning/15 px-4 py-3 text-sm text-warning-ink">
            <FileText className="mt-0.5 size-4 shrink-0" />
            <span>The appointment letter was not issued: {complete.data.appointmentLetter.reason}. Issue it from the profile&apos;s Letters tab.</span>
          </p>
        )}
        {/* the employee's login, created with them: e-mailed, or the temporary password to hand over (shown once) */}
        {complete.data.login.emailedTo ? (
          <p className="flex items-start gap-2 rounded-2xl bg-positive/10 px-4 py-3 text-sm text-positive-ink">
            <CircleCheck className="mt-0.5 size-4 shrink-0" />
            <span>
              Their login - employee code and a temporary password - was e-mailed to <strong>{complete.data.login.emailedTo}</strong>. They choose their
              own password the first time they sign in.
            </span>
          </p>
        ) : (
          <div className="space-y-2 rounded-2xl bg-warning/15 px-4 py-3 text-sm text-warning-ink">
            <p className="font-medium">The login could not be e-mailed (no personal e-mail, or the e-mail failed). Give them these - shown only now:</p>
            <p className="font-mono text-base text-foreground">
              {complete.data.employeeCode} · {complete.data.login.temporaryPassword}
            </p>
            <p>They choose their own password the first time they sign in. Lost it? Reset it on the Roles & access page.</p>
          </div>
        )}
      </FormDrawer>
    )
  }

  const items = checklist.data?.items ?? []
  const ready = checklist.data?.ready ?? false
  // anything typed or picked that differs from what the form opened with
  const dirty = !!managerCode.trim() || listPicked !== null || dateOfJoining !== startDate || !!workEmail.trim() || probationTyped !== null || Object.keys(picked).length > 0 || noTasks || skipped.size > 0
  return (
    <FormDrawer
      onClose={onClose}
      dirty={dirty && !complete.isPending}
      width={640}
      title={<>Complete joining</>}
      description={
        <>
          {fullName(candidate)} becomes an employee. The items in red must be done first; the ones in amber (medical, verified documents) and the
          background checks can still be done later.
        </>
      }
      footer={
        <>
          <DrawerCancel />
          <Button
            variant="gold"
            // (the holiday lists loaded: the plant's default is chosen, never "no list" by a slow or failed load)
            disabled={!ready || !dateOfJoining || !tasksReady || !holidayLists.isSuccess || complete.isPending}
            onClick={() =>
              complete.mutate({
                candidateId: candidate.id,
                reportingManagerCode: managerCode || undefined,
                holidayListId: holidayListId ? Number(holidayListId) : undefined,
                dateOfJoining: fromDateInput(dateOfJoining)!,
                workEmail: workEmail.trim() || undefined,
                probationEndDate: fromDateInput(probationEndDate) ?? undefined,
                taskAssignees: tasks.filter((t) => !skipped.has(t.id) && personOf(t)).map((t) => ({ taskTypeId: t.id, assigneeCode: personOf(t) })),
                skipTaskTypeIds: tasks.filter((t) => skipped.has(t.id)).map((t) => t.id),
                noJoiningTasks: tasks.length ? undefined : noTasks,
              })
            }
          >
            <UserPlus /> {complete.isPending ? 'Creating employee…' : 'Complete joining'}
          </Button>
        </>
      }
    >
      <section className="space-y-2">
        <p className="text-sm font-medium">Checklist</p>
        {checklist.isPending ? (
          <JoiningChecklistSkeleton label="Checking the joining checklist" />
        ) : checklist.error ? (
          <p className="text-sm text-negative-ink">{errorMessage(checklist.error)}</p>
        ) : (
          <div className="space-y-4">
            {CHECK_GROUPS.map((group) => {
              const mine = items.filter((i) => i.who === group.who)
              if (!mine.length) return null
              const done = mine.filter((i) => i.ok).length
              return (
                <div key={group.who} className="space-y-1.5">
                  <p className="flex items-baseline justify-between gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {group.title}
                    <span className="tabular-nums normal-case">
                      {done} of {mine.length} done
                    </span>
                  </p>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs text-muted-foreground">{group.help}</p>
                    {group.who === 'HR' && <PrintFormsButton candidate={candidate} />}
                  </div>
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {mine.map((i) => (
                      <li
                        key={i.key}
                        className={cn('flex items-start gap-2 rounded-2xl px-3 py-2 text-sm', i.ok ? 'bg-positive/10' : i.required ? 'bg-destructive/10' : 'bg-warning/15')}
                      >
                        {i.ok ? (
                          <CircleCheck className="mt-0.5 size-4 shrink-0 text-positive-ink" />
                        ) : !i.required ? (
                          <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning-ink" />
                        ) : (
                          <CircleX className="mt-0.5 size-4 shrink-0 text-negative-ink" />
                        )}
                        <span>
                          {i.label}
                          {i.detail && <span className="block text-xs text-muted-foreground">{i.detail}</span>}
                          {!i.ok && !i.required && <span className="block text-xs text-warning-ink">Not needed to join - can be done later</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Employee code</Label>
          {/* the next of the company's series, given when joining is completed */}
          <p className="flex h-9 items-center rounded-xl bg-surface-2/80 px-3 text-sm tabular-nums">
            {checklist.data?.nextEmployeeCode ?? <span className="text-muted-foreground">No code series - see the checklist</span>}
          </p>
          <p className="text-xs text-muted-foreground">The next code of {candidate.company.code}&apos;s series.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="join-date">Date of joining *</Label>
          <Input id="join-date" type="date" value={dateOfJoining} max={today} onChange={(e) => setDateOfJoining(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="join-email">Work e-mail</Label>
          <Input id="join-email" type="email" value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} placeholder="optional" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="join-manager">Reporting manager</Label>
          <EmployeePicker id="join-manager" value={managerCode} onChange={(picked) => setManagerCode(picked?.employeeCode ?? '')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="join-holidays">Holiday list</Label>
          <NativeSelect id="join-holidays" className="w-full" value={holidayListId} disabled={holidayLists.isPending} onChange={(e) => setListPicked(e.target.value)}>
            <NativeSelectOption value="">{holidayLists.isPending ? 'Loading…' : 'No holiday list'}</NativeSelectOption>
            {usableLists.map((l) => (
              <NativeSelectOption key={l.id} value={String(l.id)}>
                {l.name}
                {l.id === plantDefault?.id ? ` (${candidate.plant.plantCode}'s default)` : ''}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <p className={cn('text-xs', holidayListId ? 'text-muted-foreground' : 'text-warning-ink')}>
            {holidayListId ? 'From the date of joining - HR can change it later on Attendance setup > Schedules.' : 'No holidays until HR gives a list.'}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="join-probation">Probation ends</Label>
          <Input id="join-probation" type="date" value={probationEndDate} onChange={(e) => setProbationTyped(e.target.value)} />
          {candidate.probationMonths ? (
            <p className="text-xs text-muted-foreground">Suggested from the offer: {candidate.probationMonths} months from the date of joining.</p>
          ) : null}
        </div>
      </section>

      {/* no task for this joining type: HR says so before the joining can be completed (the user, 2026-11-20) */}
      {taskTypes.isSuccess && tasks.length === 0 && (
        <section className="space-y-2 rounded-2xl bg-warning/15 px-4 py-3 text-sm text-warning-ink">
          <p className="flex items-start gap-2">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              No joining tasks are set up{taskTypes.data.length ? ' for this joining type' : ''} - nobody (IT, Admin...) will be given work for this
              employee. Add them on{' '}
              <Link to="/manage/joining-tasks" className="underline underline-offset-2">
                Joining checklist &gt; Task types
              </Link>
              , or confirm:
            </span>
          </p>
          <label className="flex items-center gap-2 pl-6 font-medium text-foreground">
            <Checkbox checked={noTasks} onCheckedChange={(checked) => setNoTasks(checked === true)} />
            No joining tasks for this employee
          </label>
        </section>
      )}

      {/* who does each joining task - someone of its team (role) covering this employee; every task needs one */}
      {tasks.length > 0 && (
        <section className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <ListChecks className="size-4" /> Joining tasks
          </p>
          <p className="text-xs text-muted-foreground">
            Untick a task this employee does not need; give each ticked task to someone of its team - they see it on their Joining checklist page.
            {tasks.length > 0 && skipped.size === tasks.length && ' No task will be made for this employee.'}
          </p>
          <ul className="space-y-1.5">
            {tasks.map((t) => {
              const people = peopleFor(t)
              const off = skipped.has(t.id)
              return (
                <li
                  key={t.id}
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-2 rounded-2xl px-3 py-2 text-sm',
                    off ? 'bg-surface-2/40 text-muted-foreground' : personOf(t) ? 'bg-surface-2/70' : 'bg-warning/15',
                  )}
                >
                  <label className="flex items-center gap-2">
                    <Checkbox checked={!off} onCheckedChange={() => toggleTask(t.id)} aria-label={`${t.name} - needed for this employee`} />
                    <span className={cn(off && 'line-through')}>
                      {t.name} <span className="text-xs text-muted-foreground">· {t.team}</span>
                    </span>
                  </label>
                  {off ? (
                    <span className="text-xs">Not needed</span>
                  ) : teams.isSuccess && !people.length ? (
                    <span className="text-xs text-negative-ink">Nobody with the "{t.team}" role covers this employee (Roles & access)</span>
                  ) : (
                    <NativeSelect
                      aria-label={`Who does: ${t.name}`}
                      className="[&_select]:h-8 [&_select]:rounded-xl [&_select]:text-xs"
                      value={personOf(t)}
                      disabled={teams.isPending}
                      onChange={(e) => setPicked((current) => ({ ...current, [t.id]: e.target.value }))}
                    >
                      <NativeSelectOption value="">Pick who does it…</NativeSelectOption>
                      {people.map((p) => (
                        <NativeSelectOption key={p.employeeCode} value={p.employeeCode}>
                          {p.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <FormError error={complete.error ?? taskTypes.error ?? teams.error ?? holidayLists.error} />
    </FormDrawer>
  )
}
