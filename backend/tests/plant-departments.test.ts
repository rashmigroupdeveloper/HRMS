import { prisma, SYSTEM_ACTOR } from '#core/db/prisma'
import { employeesService } from '#modules/employees'
import { departmentsService, plantsService } from '#modules/organization'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createCompany, createDepartment, createEmployee, createPlant } from './helpers/organization.js'
import { userWith } from './helpers/users.js'

// Company -> plant -> department (2026-11-18): which departments run at a plant, retiring a link that people have, and
// the placement rules for employees.
describe('departments at a plant', () => {
  let companyId: number
  let plantId: number
  let otherPlantId: number
  let foreignPlantId: number
  let used: number
  let unused: number
  let neverLinked: number

  const departmentsAt = async (id: number) => (await departmentsService.listDepartments(false, id)).map((d) => d.id).sort()

  beforeAll(async () => {
    companyId = (await createCompany()).id
    plantId = (await createPlant(companyId)).id
    otherPlantId = (await createPlant(companyId)).id
    foreignPlantId = (await createPlant((await createCompany()).id)).id
    used = (await createDepartment()).id
    unused = (await createDepartment()).id
    neverLinked = (await createDepartment()).id
    expect(await plantsService.setPlantDepartments({ id: plantId, departmentIds: [used, unused] }, SYSTEM_ACTOR)).toEqual({ added: 2, removed: 0 })
  })
  afterAll(() => prisma.$disconnect())
  // changes made by a super admin (data access is tested in data-access-*.test.ts)
  const admin = userWith({ id: 0, employeeCode: 'SYSTEM' }, [], { isSuperAdmin: true })

  it('accepts a department of the plant and refuses the rest', async () => {
    await expect(plantsService.assertPlacement({ companyId, plantId, departmentId: used }, { plant: true, department: true })).resolves.toBeUndefined()
    await expect(plantsService.assertPlacement({ companyId, plantId: foreignPlantId }, { plant: true, department: true })).rejects.toThrow(
      "not one of the company's plants",
    )
    await expect(plantsService.assertPlacement({ companyId, plantId, departmentId: neverLinked }, { plant: true, department: true })).rejects.toThrow(
      'does not run at plant',
    )
  })

  it('retires a link people have, deletes one nobody used, and brings a retired one back', async () => {
    const employee = await createEmployee({ companyId, plantId, departmentId: used })

    // unticking both: the used one is retired (the employee keeps it), the unused one deleted
    expect(await plantsService.setPlantDepartments({ id: plantId, departmentIds: [] }, SYSTEM_ACTOR)).toEqual({ added: 0, removed: 2 })
    expect(await departmentsAt(plantId)).toEqual([])
    const kept = await employeesService.getByCode(employee.employeeCode)
    expect(kept.department?.id).toBe(used)

    // the employee keeps it on an unrelated change, but nobody new is placed in it
    await expect(employeesService.updateEmployee({ employeeCode: employee.employeeCode, firstName: 'Renamed' }, admin)).resolves.toBeDefined()
    await expect(createEmployee({ companyId, plantId, departmentId: used })).rejects.toThrow('does not run at plant')

    // ticking it again brings the retired link back; the deleted one is added anew
    expect(await plantsService.setPlantDepartments({ id: plantId, departmentIds: [used, unused] }, SYSTEM_ACTOR)).toEqual({ added: 2, removed: 0 })
    expect(await departmentsAt(plantId)).toEqual([used, unused].sort())
  })

  it('refuses a move to a plant where the department does not run', async () => {
    const employee = await createEmployee({ companyId, plantId, departmentId: used })
    await expect(employeesService.updateEmployee({ employeeCode: employee.employeeCode, plantId: otherPlantId }, admin)).rejects.toThrow(
      'does not run at plant',
    )
    // with a department that runs there it may move (a department is never cleared - every employee has one, 2026-11-19)
    const there = (await createDepartment()).id
    await plantsService.addPlantDepartments(otherPlantId, [there], SYSTEM_ACTOR)
    await expect(employeesService.updateEmployee({ employeeCode: employee.employeeCode, plantId: otherPlantId, departmentId: there }, admin)).resolves.toBeDefined()
  })
})
