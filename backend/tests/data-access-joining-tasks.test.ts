import { prisma, SYSTEM_ACTOR } from '#core/db/prisma'
import { joiningTasksService } from '#modules/joining-tasks'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createRole, giveLogin } from './helpers/approvals.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { userWith } from './helpers/users.js'

// A joining task's team is a role with "Joining tasks: Edit"; the task goes to a holder of that role whose data access
// covers the new employee; at joining every task needs a person, or HR ticks "No joining tasks" (the user, 2026-11-20).
describe('joining task teams', () => {
  const admin = userWith({ id: 0, employeeCode: 'SYSTEM' }, [], { isSuperAdmin: true })
  const run = Math.random().toString(36).slice(2, 7).toUpperCase()
  let companyA: number
  let plantA: number
  let companyB: number
  let itRole: number
  let otherRole: number
  let itA: { id: number; employeeCode: string }
  let itB: { id: number; employeeCode: string }
  let other: { id: number; employeeCode: string }
  const joiner = () => ({ dateOfJoining: new Date(Date.UTC(2027, 0, 4)), joiningType: 'REGULAR' as const, companyId: companyA, plantId: plantA, departmentId: null })

  beforeAll(async () => {
    // task types are one list for every company: start from none (earlier runs leave theirs active)
    await prisma.joiningTaskType.updateMany({ where: { isActive: true }, data: { isActive: false, updatedById: SYSTEM_ACTOR } })
    companyA = (await createCompany()).id
    plantA = (await createPlant(companyA)).id
    companyB = (await createCompany()).id
    const plantB = (await createPlant(companyB)).id
    itRole = (await createRole({ JOINING_TASKS: 'WRITE' })).id
    otherRole = (await createRole({ JOINING_TASKS: 'WRITE' })).id
    itA = await createEmployee({ companyId: companyA, plantId: plantA })
    itB = await createEmployee({ companyId: companyB, plantId: plantB })
    other = await createEmployee({ companyId: companyA, plantId: plantA })
    // the IT person of company A, the IT person limited to company B, and someone of another team covering A
    await giveLogin(itA.id, [{ roleId: itRole, companyId: companyA }])
    await giveLogin(itB.id, [{ roleId: itRole, companyId: companyB }])
    await giveLogin(other.id, [{ roleId: otherRole, companyId: companyA }])
  })
  afterAll(async () => {
    await prisma.joiningTaskType.updateMany({ where: { name: { startsWith: `Test task ${run}` } }, data: { isActive: false, updatedById: SYSTEM_ACTOR } })
    await prisma.$disconnect()
  })

  it('shows the task types only with "Joining task types" - and the active ones to HR completing a joining', async () => {
    const doer = userWith(itA, [{ access: { JOINING_TASKS: 'WRITE' }, rows: [] }])
    await expect(joiningTasksService.listTaskTypes(doer)).rejects.toThrow()
    // Onboarding View alone: no longer (its own area since 2026-11-21)
    const onboardingView = userWith(other, [{ access: { ONBOARDING: 'READ' }, rows: [] }])
    await expect(joiningTasksService.listTaskTypes(onboardingView)).rejects.toThrow()
    const keeper = userWith(other, [{ access: { JOINING_TASK_TYPES: 'READ' }, rows: [] }])
    await expect(joiningTasksService.listTaskTypes(keeper, true)).resolves.toBeInstanceOf(Array)
    // HR completing a joining: the active ones, never the retired
    const retired = await joiningTasksService.createTaskType({ name: `Test task ${run} retired`, roleId: itRole, dueDays: 0, joiningTypes: [] }, admin)
    await joiningTasksService.updateTaskType({ id: retired.id, isActive: false }, admin)
    const hr = userWith(other, [{ access: { ONBOARDING: 'WRITE' }, rows: [] }])
    expect((await joiningTasksService.listTaskTypes(hr, true)).some((t) => t.id === retired.id)).toBe(false)
    expect((await joiningTasksService.listTaskTypes(keeper, true)).some((t) => t.id === retired.id)).toBe(true)
    // changing the list: "Joining task types: Edit" for all companies - Onboarding Edit is not enough
    await expect(joiningTasksService.updateTaskType({ id: retired.id, isActive: false }, userWith(other, [{ access: { ONBOARDING: 'WRITE' }, rows: [{ companyId: null, plantId: null, departmentId: null, level: 'WRITE' }] }]))).rejects.toThrow()
    const allCompanies = [{ companyId: null, plantId: null, departmentId: null, level: 'WRITE' as const }]
    await expect(joiningTasksService.updateTaskType({ id: retired.id, isActive: false }, userWith(other, [{ access: { JOINING_TASK_TYPES: 'WRITE' }, rows: allCompanies }]))).resolves.toMatchObject({ isActive: false })
    // ...and for one company only it is not enough either (the list is shared)
    await expect(joiningTasksService.updateTaskType({ id: retired.id, isActive: false }, userWith(other, [{ access: { JOINING_TASK_TYPES: 'WRITE' }, rows: [{ ...allCompanies[0]!, companyId: companyA }] }]))).rejects.toThrow()
  })

  it('needs "No joining tasks" ticked when no task applies', async () => {
    await expect(joiningTasksService.planJoiningTasks(joiner(), [], false)).rejects.toThrow('No joining tasks')
    await expect(joiningTasksService.planJoiningTasks(joiner(), [], true)).resolves.toEqual([])
  })

  it('takes only a role with "Joining tasks: Edit" as the team, and a holder of it as the default person', async () => {
    const noTasksRole = (await createRole({ EMPLOYEES: 'READ' })).id
    const base = { name: `Test task ${run} e-mail`, dueDays: 0, joiningTypes: [] }
    await expect(joiningTasksService.createTaskType({ ...base, roleId: noTasksRole }, admin)).rejects.toThrow('Joining tasks: Edit')
    await expect(joiningTasksService.createTaskType({ ...base, roleId: itRole, defaultAssigneeCode: other.employeeCode }, admin)).rejects.toThrow('role')
    const type = await joiningTasksService.createTaskType({ ...base, roleId: itRole }, admin)
    expect(type).toMatchObject({ team: expect.stringContaining('Test role'), defaultAssignee: null })
  })

  it('gives every task to a holder of its role covering the employee - never someone outside their data access', async () => {
    // the type made above has no default person: HR must pick one
    await expect(joiningTasksService.planJoiningTasks(joiner(), [], false)).rejects.toThrow('pick who does it')
    await expect(joiningTasksService.planJoiningTasks(joiner(), [], true)).rejects.toThrow('has joining tasks')
    const type = (await joiningTasksService.listTaskTypes(admin)).find((t) => t.name === `Test task ${run} e-mail`)!
    // company A's people of the IT role: only itA (itB's data access is company B)
    const teams = await joiningTasksService.listTeams({ companyId: companyA, plantId: plantA, departmentId: null })
    expect(teams.find((t) => t.id === itRole)?.people.map((p) => p.employeeCode)).toEqual([itA.employeeCode])
    await expect(joiningTasksService.planJoiningTasks(joiner(), [{ taskTypeId: type.id, assigneeCode: itB.employeeCode }], false)).rejects.toThrow('cannot be given')
    await expect(joiningTasksService.planJoiningTasks(joiner(), [{ taskTypeId: type.id, assigneeCode: other.employeeCode }], false)).rejects.toThrow('cannot be given')
    const plan = await joiningTasksService.planJoiningTasks(joiner(), [{ taskTypeId: type.id, assigneeCode: itA.employeeCode }], false)
    expect(plan.map((p) => p.assignedToId)).toEqual([itA.id])
  })

  it('leaves out the tasks HR unticked - unticking all of them is allowed', async () => {
    const type = (await joiningTasksService.listTaskTypes(admin)).find((t) => t.name === `Test task ${run} e-mail`)!
    // the only task type unticked: no task, no person needed, no "No joining tasks" tick needed
    await expect(joiningTasksService.planJoiningTasks(joiner(), [], false, [type.id])).resolves.toEqual([])
    // an id that is not one of the joining type's tasks
    await expect(joiningTasksService.planJoiningTasks(joiner(), [], false, [999_999_999])).rejects.toThrow('not one of')
  })

  it("reassigns a task only to someone of the task's team", async () => {
    const type = (await joiningTasksService.listTaskTypes(admin)).find((t) => t.name === `Test task ${run} e-mail`)!
    const employee = await createEmployee({ companyId: companyA, plantId: plantA })
    const plan = await joiningTasksService.planJoiningTasks(joiner(), [{ taskTypeId: type.id, assigneeCode: itA.employeeCode }], false)
    await joiningTasksService.createPlannedTasks(employee.id, joiner().dateOfJoining, plan, SYSTEM_ACTOR)
    const [task] = await joiningTasksService.listForEmployee(admin, employee.employeeCode)
    expect(task).toMatchObject({ team: type.team, roleId: itRole })
    await expect(joiningTasksService.assignTask({ id: task!.id, assigneeCode: other.employeeCode }, admin)).rejects.toThrow('cannot be given')
    await expect(joiningTasksService.assignTask({ id: task!.id, assigneeCode: itB.employeeCode }, admin)).rejects.toThrow('cannot be given')
  })

  it('keeps the note when "done" is undone, and again when it is marked done without a new one', async () => {
    const type = (await joiningTasksService.listTaskTypes(admin)).find((t) => t.name === `Test task ${run} e-mail`)!
    const employee = await createEmployee({ companyId: companyA, plantId: plantA })
    const plan = await joiningTasksService.planJoiningTasks(joiner(), [{ taskTypeId: type.id, assigneeCode: itA.employeeCode }], false)
    await joiningTasksService.createPlannedTasks(employee.id, joiner().dateOfJoining, plan, SYSTEM_ACTOR)
    const [task] = await joiningTasksService.listForEmployee(admin, employee.employeeCode)
    await joiningTasksService.completeTask({ id: task!.id, note: 'Laptop serial ABC123' }, admin)
    expect(await joiningTasksService.reopenTask(task!.id, admin)).toMatchObject({ doneAt: null, note: 'Laptop serial ABC123' })
    expect(await joiningTasksService.completeTask({ id: task!.id }, admin)).toMatchObject({ note: 'Laptop serial ABC123' })
    await joiningTasksService.reopenTask(task!.id, admin)
    expect(await joiningTasksService.completeTask({ id: task!.id, note: null }, admin)).toMatchObject({ note: null })
  })
})
