import type { exportTasksInput } from './joining-tasks.schema.js'
import { reportFile, reportSheet } from '#core/excel/report'
import { assertAccess, hasAccess } from '#core/auth/access'
import { assertGroupWide, hasLevelAt, type Placement, scopeOf } from '#core/auth/scope'
import { env } from '#core/config/env'
import { prisma, type ActorId, type DbClient, type JoiningType } from '#core/db/prisma'
import { sendMail } from '#core/mail/mailer'
import type { CurrentUser } from '#core/rpc/procedures'
import { accountsService } from '#modules/accounts'
import { employeesService } from '#modules/employees'
import { formatDate, today } from '#shared/utils/dates'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as joiningTasksRepository from './joining-tasks.repository.js'
import type { assigneesInput, assignTaskInput, completeTaskInput, createTaskTypeInput, listTasksInput, taskAssigneesSchema, updateTaskTypeInput } from './joining-tasks.schema.js'

// Joining tasks (2026-11-16 - the old HRMS's "stakeholder tasks"): the tasks other teams do for a new employee (e-mail
// ID, laptop, ID card...). HR keeps the list of task types (Onboarding: Edit), each with a default person. On the
// joining day every active type for the employee's joining type becomes a task with a due date, given to one person
// of the task's team - a role with "Joining tasks: Edit" (the user, 2026-11-20) - whose data access covers the new
// employee: the default, or whoever HR picks (an IT person never gets HR's tasks). HR must give every task to someone
// to complete the joining, or - when no task applies - tick "No joining tasks". My tasks shows
// each person the tasks given to them; HR (Onboarding) sees all of them, reassigns them and can mark any done. Each
// morning everyone is reminded of their tasks due or overdue.

const DAY = 86_400_000

function fullName(e: { firstName: string; middleName: string | null; lastName: string | null }) {
  return [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ')
}

// --- Who can be given a task ---

// The teams: the roles that give "Joining tasks: Edit", each with its holders who can sign in. With `placement`: only the
// holders whose data access on that role covers a new employee there - the people that employee's tasks can go to.
export function listTeams(placement?: Placement) {
  return accountsService.listRolesWithAccess('JOINING_TASKS', 'WRITE', placement)
}
type Team = Awaited<ReturnType<typeof listTeams>>[number]
// For the joining dialog and All tasks (Onboarding: View) and the task type form (Joining task types: View - 2026-11-21)
export function listAssignees(viewer: CurrentUser, input?: z.infer<typeof assigneesInput>) {
  if (!hasAccess(viewer.access, 'ONBOARDING', 'READ') && !hasAccess(viewer.access, 'JOINING_TASK_TYPES', 'READ')) {
    throw new ORPCError('FORBIDDEN', { message: 'You do not have access to this' })
  }
  return listTeams(input?.placement)
}

const placementOf = (e: { companyId: number; plantId: number; departmentId: number | null }): Placement => ({
  companyId: e.companyId,
  plantId: e.plantId,
  departmentId: e.departmentId,
})

// The team (role) a task type names; 400 when the role does not give "Joining tasks: Edit"
function teamOf(teams: Team[], roleId: number) {
  const team = teams.find((t) => t.id === roleId)
  if (!team) throw new ORPCError('BAD_REQUEST', { message: 'The team must be a role that gives "Joining tasks: Edit" (Roles & access)' })
  return team
}

// The employee id of a holder of the team's role, by employee code; 400 otherwise
function pickFromTeam(team: Pick<Team, 'name' | 'people'>, employeeCode: string) {
  const person = team.people.find((p) => p.employeeCode === employeeCode)
  if (!person) throw new ORPCError('BAD_REQUEST', { message: `${employeeCode} cannot be given ${team.name}'s tasks - they need the "${team.name}" role covering the employee` })
  return person.id
}

// Task types are the same for every company: changing them needs "Joining task types: Edit" for all companies (A4,
// 2026-11-18; its own area since 2026-11-21)
function assertTypesChangeable(viewer: CurrentUser) {
  assertGroupWide(viewer, 'JOINING_TASK_TYPES', 'The list of joining tasks')
}

// --- The list of task types ---

// The whole list, retired ones too, for those who keep it ("Joining task types: View", the user 2026-11-21) - not for
// those who only do the tasks; HR completing a joining (Onboarding: Edit) gets the active ones, for the joining dialog
export async function listTaskTypes(viewer: CurrentUser, includeInactive = false) {
  const keepsList = hasAccess(viewer.access, 'JOINING_TASK_TYPES', 'READ')
  if (!keepsList && !hasAccess(viewer.access, 'ONBOARDING', 'WRITE')) throw new ORPCError('FORBIDDEN', { message: 'You do not have access to this' })
  const rows = await joiningTasksRepository.listTypes(keepsList && includeInactive)
  const person = await employeesService.lookupPeople(rows.map((r) => r.defaultAssigneeId))
  // `team`: the role's name, as shown on the page
  return rows.map(({ defaultAssigneeId, ...row }) => ({ ...row, team: row.role.name, defaultAssignee: person(defaultAssigneeId) }))
}

async function getTaskType(id: number) {
  const type = await joiningTasksRepository.findType(id)
  if (!type) throw new ORPCError('NOT_FOUND', { message: `No joining task type with id ${id}` })
  return type
}

async function toTaskType({ defaultAssigneeId, ...type }: Awaited<ReturnType<typeof getTaskType>>) {
  const person = await employeesService.lookupPeople([defaultAssigneeId])
  return { ...type, team: type.role.name, defaultAssignee: person(defaultAssigneeId) }
}

// The team must be a role that gives "Joining tasks: Edit"; the default person (optional) a holder of it
export async function createTaskType({ defaultAssigneeCode, ...input }: z.infer<typeof createTaskTypeInput>, viewer: CurrentUser) {
  assertTypesChangeable(viewer)
  const actorId = viewer.employeeId
  const team = teamOf(await listTeams(), input.roleId)
  const defaultAssigneeId = defaultAssigneeCode ? pickFromTeam(team, defaultAssigneeCode) : null
  return toTaskType(await joiningTasksRepository.createType({ ...input, description: input.description ?? null, defaultAssigneeId }, actorId))
}

// Changing a type changes only the tasks made from then on (a task keeps the name, team, due date and person it was
// made with). A new team needs a default person from it (or none).
export async function updateTaskType({ id, defaultAssigneeCode, ...changes }: z.infer<typeof updateTaskTypeInput>, viewer: CurrentUser) {
  assertTypesChangeable(viewer)
  const actorId = viewer.employeeId
  const type = await getTaskType(id)
  let defaultAssigneeId: number | null | undefined = defaultAssigneeCode === null ? null : undefined
  if (changes.roleId !== undefined || defaultAssigneeCode) {
    const team = teamOf(await listTeams(), changes.roleId ?? type.role.id)
    if (defaultAssigneeCode) defaultAssigneeId = pickFromTeam(team, defaultAssigneeCode)
    // the default person stays only if they hold the new team's role
    else if (defaultAssigneeCode === undefined && type.defaultAssigneeId !== null && !team.people.some((p) => p.id === type.defaultAssigneeId)) {
      throw new ORPCError('BAD_REQUEST', { message: `The default person does not have the "${team.name}" role - pick one from it, or nobody` })
    }
  }
  return toTaskType(await joiningTasksRepository.updateType(id, { ...changes, ...(defaultAssigneeId !== undefined && { defaultAssigneeId }) }, actorId))
}

// --- The tasks ---

type TaskRow = joiningTasksRepository.TaskRow

// For the API: the employee as { employeeCode, name, ... }, the people as { employeeCode, name }, and overdue
async function toTasks(rows: TaskRow[]) {
  const person = await employeesService.lookupPeople(rows.flatMap((r) => [r.doneById, r.assignedToId]))
  const day = today()
  return rows.map(({ doneById, assignedToId, employee, taskType, ...task }) => ({
    ...task,
    // the team's role (reassigning offers its holders); null for a task whose type is gone
    roleId: taskType?.roleId ?? null,
    overdue: !task.doneAt && task.dueDate < day,
    assignedTo: person(assignedToId),
    doneBy: person(doneById),
    employee: {
      employeeCode: employee.employeeCode,
      name: fullName(employee),
      dateOfJoining: employee.dateOfJoining,
      status: employee.status,
      company: employee.company.code,
      department: employee.department?.name ?? null,
      designation: employee.designation?.name ?? null,
    },
  }))
}

// My tasks: the tasks given to me, or (Onboarding: View) every task; the open ones (oldest due first) or the latest 200
// done; with the open tasks per team (for the filter)
export async function listTasks(input: z.infer<typeof listTasksInput>, viewer: CurrentUser) {
  if (input.scope === 'ALL') assertAccess(viewer.access, 'ONBOARDING', 'READ')
  else assertAccess(viewer.access, 'JOINING_TASKS', 'READ')
  const assignedToId = input.scope === 'MINE' ? viewer.employeeId : undefined
  const done = input.status === 'DONE'
  // data access: all tasks - of new employees inside the viewer's Onboarding View range; mine - inside their "Joining
  // tasks" range
  const scope = input.scope === 'ALL' ? scopeOf(viewer, 'ONBOARDING', 'READ') : scopeOf(viewer, 'JOINING_TASKS', 'READ')
  const [rows, teams] = await Promise.all([
    joiningTasksRepository.listTasks({ scope, done, assignedToId, team: input.team, search: input.search, take: done ? 200 : 1000 }),
    joiningTasksRepository.countOpenByTeam(assignedToId, scope),
  ])
  return { items: await toTasks(rows), teams: teams.map((t) => ({ team: t.team, open: t._count._all })) }
}

// One employee's joining tasks (the profile's Record tab): own record, or "Employee · Directory & job" View
export async function listForEmployee(viewer: CurrentUser, employeeCode: string) {
  // own record, or inside the viewer's data access ("not found" otherwise)
  const employee = await employeesService.getEmployeeFor(viewer, employeeCode)
  return toTasks(await joiningTasksRepository.listByEmployee(employee.id))
}

type NewEmployee = { dateOfJoining: Date; joiningType: JoiningType; companyId: number; plantId: number; departmentId: number | null }
// What the joining day will make: each task type with the person who does it
export type TaskPlan = { type: Awaited<ReturnType<typeof joiningTasksRepository.listTypesFor>>[number]; assignedToId: number | null }[]

// The joining day's tasks, checked before anything is saved (the user, 2026-11-20): every active task type of the joining
// type that HR did not untick (`skip` - not needed for this employee) goes to a holder of its team's role whose data access
// covers the new employee - the person HR picked, else the type's default. No task may be left without a person; when no
// task type applies at all HR must say so (`noJoiningTasks`). Unticking every task is allowed (HR's own choice).
export async function planJoiningTasks(
  employee: NewEmployee,
  picks: z.infer<typeof taskAssigneesSchema>,
  noJoiningTasks: boolean,
  skip: number[] = [],
): Promise<TaskPlan> {
  const all = await joiningTasksRepository.listTypesFor(employee.joiningType)
  const unknown = skip.filter((id) => !all.some((t) => t.id === id))
  if (unknown.length) throw new ORPCError('BAD_REQUEST', { message: "A task left out is not one of this joining type's tasks - reload the page" })
  // every task unticked: no tasks - HR's own choice
  if (all.length && all.every((t) => skip.includes(t.id))) return []
  const types = all.filter((t) => !skip.includes(t.id))
  if (!types.length) {
    if (!noJoiningTasks) {
      throw new ORPCError('BAD_REQUEST', {
        message: 'No joining tasks are set up for this joining type - tick "No joining tasks for this employee" to complete the joining without them',
      })
    }
    return []
  }
  if (noJoiningTasks) {
    throw new ORPCError('BAD_REQUEST', { message: 'This employee has joining tasks - give each one to a person instead of ticking "No joining tasks"' })
  }
  const teams = await listTeams(placementOf(employee))
  const picked = new Map(picks.map((p) => [p.taskTypeId, p.assigneeCode]))
  return types.map((type) => {
    const team = teams.find((t) => t.id === type.role.id)
    if (!team?.people.length) {
      throw new ORPCError('BAD_REQUEST', {
        message: `"${type.name}": nobody with the "${type.role.name}" role covers this employee - give the role to someone for this company / plant (Roles & access)`,
      })
    }
    const code = picked.get(type.id)
    const assignedToId = code ? pickFromTeam(team, code) : (team.people.find((p) => p.id === type.defaultAssigneeId)?.id ?? null)
    if (assignedToId === null) throw new ORPCError('BAD_REQUEST', { message: `"${type.name}": pick who does it (someone with the "${type.role.name}" role)` })
    return { type, assignedToId }
  })
}

// Makes the planned tasks, due from the date of joining - inside the joining day's transaction. Returns how many.
export async function createPlannedTasks(employeeId: number, dateOfJoining: Date, plan: TaskPlan, actorId: ActorId, db?: DbClient) {
  if (!plan.length) return 0
  await joiningTasksRepository.createTasks(
    plan.map(({ type, assignedToId }) => ({
      employeeId,
      taskTypeId: type.id,
      name: type.name,
      team: type.role.name,
      description: type.description,
      dueDate: new Date(dateOfJoining.getTime() + type.dueDays * DAY),
      assignedToId,
    })),
    actorId,
    db,
  )
  return plan.length
}

// The tasks of an employee who did not join through onboarding (HR added them directly), from their profile: each to the
// type's default person if they still hold the role covering the employee, else nobody yet (HR gives it on Joining tasks)
async function createForEmployee(employee: NewEmployee & { id: number }, actorId: ActorId, db?: DbClient) {
  const types = await joiningTasksRepository.listTypesFor(employee.joiningType, db)
  const teams = await listTeams(placementOf(employee))
  const holds = (roleId: number, id: number | null) => id !== null && !!teams.find((t) => t.id === roleId)?.people.some((p) => p.id === id)
  return createPlannedTasks(
    employee.id,
    employee.dateOfJoining,
    types.map((type) => ({ type, assignedToId: holds(type.role.id, type.defaultAssigneeId) ? type.defaultAssigneeId : null })),
    actorId,
    db,
  )
}

// "Make joining tasks" for an employee who did not join through onboarding (HR added them directly) - once; given to
// the default people
export async function createForEmployeeCode(employeeCode: string, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  const found = await employeesService.getByCode(employeeCode)
  const employee = { ...found, companyId: found.company.id, plantId: found.plant.id, departmentId: found.department?.id ?? null }
  // HR (Onboarding: Edit) covering the employee
  if (!hasLevelAt(viewer, 'ONBOARDING', placementOf(employee), 'WRITE')) throw new ORPCError('NOT_FOUND', { message: `No employee found with code ${employeeCode}` })
  return prisma.$transaction(async (tx) => {
    if ((await joiningTasksRepository.countByEmployee(employee.id, tx)) > 0) {
      throw new ORPCError('CONFLICT', { message: `${employeeCode} already has joining tasks` })
    }
    const made = await createForEmployee(employee, actorId, tx)
    if (!made) {
      throw new ORPCError('BAD_REQUEST', { message: 'There are no active joining tasks for this joining type - add them to the task list first' })
    }
    return { made }
  })
}

async function getTask(id: number) {
  const task = await joiningTasksRepository.findTask(id)
  if (!task) throw new ORPCError('NOT_FOUND', { message: `No joining task with id ${id}` })
  return task
}

// A task is marked done (or undone) by the person it is given to (with "Joining tasks: Edit") or by HR (Onboarding:
// Edit) - each covering the new employee (data access)
function assertCanMark(viewer: CurrentUser, task: TaskRow) {
  const at = placementOf(task.employee)
  if (hasLevelAt(viewer, 'ONBOARDING', at, 'WRITE')) return
  if (task.assignedToId === viewer.employeeId && hasLevelAt(viewer, 'JOINING_TASKS', at, 'WRITE')) return
  throw new ORPCError('FORBIDDEN', { message: 'This task is given to someone else' })
}

// Done, with an optional note (e.g. "laptop serial ABC123"): `note` left out keeps the note the task has (one kept by an
// undo), `null` clears it
export async function completeTask({ id, note }: z.infer<typeof completeTaskInput>, viewer: CurrentUser) {
  const task = await getTask(id)
  assertCanMark(viewer, task)
  if (task.doneAt) throw new ORPCError('CONFLICT', { message: 'This task is already done' })
  const updated = await joiningTasksRepository.updateTask(id, { doneAt: new Date(), doneById: viewer.employeeId, ...(note !== undefined && { note }) }, viewer.employeeId)
  return (await toTasks([updated]))[0]!
}

// Undo "done" (marked by mistake) - the note stays (e.g. the laptop serial), ready when it is marked done again (the user,
// 2026-11-21: an undo wiped it)
export async function reopenTask(id: number, viewer: CurrentUser) {
  const task = await getTask(id)
  assertCanMark(viewer, task)
  if (!task.doneAt) throw new ORPCError('CONFLICT', { message: 'This task is not done' })
  const updated = await joiningTasksRepository.updateTask(id, { doneAt: null, doneById: null }, viewer.employeeId)
  return (await toTasks([updated]))[0]!
}

// HR gives an open task to someone else (e.g. the person is on leave)
export async function assignTask({ id, assigneeCode }: z.infer<typeof assignTaskInput>, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  const task = await getTask(id)
  // HR covering the new employee; the person given it must cover them too (data access)
  const at = placementOf(task.employee)
  if (!hasLevelAt(viewer, 'ONBOARDING', at, 'WRITE')) throw new ORPCError('FORBIDDEN', { message: 'You do not have access to this task' })
  if (task.doneAt) throw new ORPCError('CONFLICT', { message: 'This task is already done' })
  // a holder of the task's team role (its type's role now) covering the employee
  const teams = await listTeams(at)
  const team = task.taskType ? teams.find((t) => t.id === task.taskType!.roleId) : undefined
  const assignedToId = pickFromTeam(team ?? { name: task.team, people: task.taskType ? [] : teams.flatMap((t) => t.people) }, assigneeCode)
  const updated = await joiningTasksRepository.updateTask(id, { assignedToId }, actorId)
  return (await toTasks([updated]))[0]!
}

// The morning reminder (worker): each person gets their own open tasks due today or overdue; the ones given to nobody
// go to HR (Onboarding: Edit) to give them to someone
export async function remindDueTasks() {
  const day = today()
  const tasks = await joiningTasksRepository.listOpenDueBy(day)
  if (!tasks.length) return 'nothing due'
  const line = (t: TaskRow) => {
    const late = Math.round((day.getTime() - t.dueDate.getTime()) / DAY)
    return `- [${t.team}] ${t.name} - ${fullName(t.employee)} (${t.employee.employeeCode}), due ${formatDate(t.dueDate)}${late > 0 ? ` - ${late} day(s) overdue` : ' - due today'}`
  }
  const byPerson = new Map<number, TaskRow[]>()
  const nobody: TaskRow[] = []
  for (const task of tasks) {
    if (task.assignedToId === null) nobody.push(task)
    else byPerson.set(task.assignedToId, [...(byPerson.get(task.assignedToId) ?? []), task])
  }
  const mails: { to: { email: string; name: string; employeeCode: string }; intro: string; tasks: TaskRow[] }[] = []
  for (const person of await employeesService.listMailContacts([...byPerson.keys()])) {
    mails.push({ to: person, intro: 'These joining tasks given to you are due today or overdue:', tasks: byPerson.get(person.id)! })
  }
  if (nobody.length) {
    // HR only about the new employees inside their data access
    const placed = nobody.map((task) => ({ task, placement: placementOf(task.employee) }))
    for (const { person, items } of await accountsService.mailRecipientsFor('ONBOARDING', 'WRITE', placed)) {
      mails.push({ to: person, intro: 'These joining tasks are due today or overdue and are not given to anyone yet - please give them to someone:', tasks: items.map((i) => i.task) })
    }
  }
  for (const mail of mails) {
    await sendMail({
      to: mail.to.email,
      subject: `Joining tasks: ${mail.tasks.length} due or overdue`,
      text: [
        `Dear ${mail.to.name},`,
        '',
        mail.intro,
        '',
        ...mail.tasks.map(line),
        '',
        `Open My tasks: ${env.APP_URL}/manage/joining-tasks`,
        '',
        'This reminder is sent every morning while a task is due or overdue.',
      ].join('\n'),
    }).catch((error: unknown) => console.error(`[mail] joining tasks reminder to ${mail.to.employeeCode} failed:`, error))
  }
  return `${tasks.length} task(s), ${mails.length} reminder(s) sent`
}

export async function exportTasks(input: z.infer<typeof exportTasksInput>, viewer: CurrentUser) {
  const data = await listTasks(input, viewer)
  const wanted = input.ids ? new Set(input.ids) : null
  const items = data.items.filter((row) => !wanted || wanted.has(row.id))
  return reportFile([reportSheet('Joining tasks', items, [
    { header: 'Employee code', value: r => r.employee.employeeCode, text: true }, { header: 'Employee', value: r => r.employee.name, width: 30 },
    { header: 'Company', value: r => r.employee.company }, { header: 'Department', value: r => r.employee.department, width: 25 },
    { header: 'Task', value: r => r.name, width: 32 }, { header: 'Team', value: r => r.team, width: 25 },
    { header: 'Due date', value: r => r.dueDate, date: true }, { header: 'Assigned to', value: r => r.assignedTo?.name, width: 28 },
    { header: 'Status', value: r => r.doneAt ? 'Done' : r.overdue ? 'Overdue' : 'Open' }, { header: 'Done at', value: r => r.doneAt, dateTime: true },
    { header: 'Done by', value: r => r.doneBy?.name, width: 28 },
  ])], { title: 'Joining tasks', preparedBy: `${viewer.name} (${viewer.employeeCode})`, coverage: input.status === 'DONE' ? 'The latest 200 completed tasks matching the current task filters, as on this tab.' : 'Up to 1,000 open tasks matching the current task filters, as on this tab.', filters: [{ label: 'View', value: input.scope }, { label: 'Status', value: input.status }, { label: 'Search', value: input.search ?? 'None' }, { label: 'Team', value: input.team ?? 'All teams' }] }, 'joining-tasks')
}

export async function exportTaskTypes(viewer: CurrentUser, includeInactive = false) {
  const rows = await listTaskTypes(viewer, includeInactive)
  return reportFile([reportSheet('Joining task types', rows, [
    { header: 'Task', value: r => r.name, width: 32 }, { header: 'Description', value: r => r.description, width: 45 }, { header: 'Team', value: r => r.team },
    { header: 'Due days after joining', value: r => r.dueDays }, { header: 'Joining types', value: r => r.joiningTypes.join(', ') || 'All' },
    { header: 'Default assignee', value: r => r.defaultAssignee?.name, width: 28 }, { header: 'Status', value: r => r.isActive ? 'Active' : 'Retired' },
  ])], { title: 'Joining task types', preparedBy: `${viewer.name} (${viewer.employeeCode})`, coverage: includeInactive ? 'Authorized task types, including retired types where allowed.' : 'Active joining task types.' }, 'joining-task-types')
}
