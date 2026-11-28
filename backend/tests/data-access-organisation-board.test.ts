import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma, SYSTEM_ACTOR } from '#core/db/prisma'
import { today } from '#shared/utils/dates'
import { plantsService } from '#modules/organization'
import * as employeesService from '../src/modules/employees/employees.service.js'
import * as hodsService from '../src/modules/employees/hods/hods.service.js'
import { installationOrganisationBoard } from '../src/modules/employees/organisation/organisation.service.js'
import { createCompany, createDepartment, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

describe('organisation board', () => {
  let companyA: number, companyB: number, plantA: number, dept1: number, dept2: number
  let hod: Awaited<ReturnType<typeof createEmployee>>
  let colleague: Awaited<ReturnType<typeof createEmployee>>
  beforeAll(async () => {
    companyA = (await createCompany()).id
    companyB = (await createCompany()).id
    plantA = (await createPlant(companyA)).id
    const plantB = (await createPlant(companyB)).id
    hod = await createEmployee({ companyId: companyA, plantId: plantA })
    dept1 = hod.department!.id
    colleague = await createEmployee({ companyId: companyA, plantId: plantA, departmentId: dept1 })
    await createEmployee({ companyId: companyA, plantId: plantA, departmentId: dept1, leavesOn: new Date(Date.UTC(2026, 5, 1)) })
    const exited = await createEmployee({ companyId: companyA, plantId: plantA, departmentId: dept1 })
    await prisma.employee.update({ where: { id: exited.id }, data: { status: 'EXITED', dateOfLeaving: new Date(Date.UTC(2026, 1, 1)) } })
    await prisma.employee.update({ where: { id: colleague.id }, data: { employmentType: 'CONTRACT', workforceCategory: 'BLUE_COLLAR', joiningType: 'REGULAR' } })
    dept2 = (await createDepartment()).id
    await plantsService.addPlantDepartments(plantA, [dept2], SYSTEM_ACTOR)
    await createEmployee({ companyId: companyA, plantId: plantA, departmentId: dept2 })
    await createEmployee({ companyId: companyB, plantId: plantB })
    await hodsService.appointHod({ employeeCode: hod.employeeCode, postIds: [hod.hodPostId!] }, userWith(hod, [], { isSuperAdmin: true }))
  })
  afterAll(() => prisma.$disconnect())

  it('shows whole companies to directory and payroll access, and departments after a company is opened', async () => {
    const hr = userWith(colleague, [{ access: { EMPLOYEES: 'READ' }, rows: [row(companyA, null, null)] }])
    const companies = await employeesService.organisationBoard(hr, {})
    expect(companies.level).toBe('COMPANY')
    expect(companies.slices.map((slice) => slice.companyId)).toEqual([companyA])
    expect(companies.slices[0]).toMatchObject({
      headcount: 4,
      active: 3,
      onNotice: 1,
      employmentType: { PERMANENT: 3, CONTRACT: 1, TRAINEE: 0, CONSULTANT: 0, APPRENTICE: 0 },
      workforceCategory: { WHITE_COLLAR: 3, BLUE_COLLAR: 1 },
      joiningType: { REGULAR: 1, CONSULTANT_INTERN: 0, OVERSEAS: 3 },
    })
    const departments = await employeesService.organisationBoard(hr, { companyId: companyA })
    expect(departments.level).toBe('DEPARTMENT')
    expect(departments.company?.id).toBe(companyA)
    expect(departments.slices.map((slice) => slice.departmentId).sort()).toEqual([dept1, dept2].sort())
    expect(departments.slices.find((slice) => slice.departmentId === dept1)?.headcount).toBe(3)
    expect(departments.slices.find((slice) => slice.departmentId === dept2)?.headcount).toBe(1)
    await expect(employeesService.organisationBoard(hr, { companyId: companyB })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('keeps a partial directory row on its departments and lets whole-company payroll open every department', async () => {
    const partial = userWith(colleague, [{ access: { EMPLOYEES: 'READ' }, rows: [row(companyA, plantA, dept1)] }])
    const own = await employeesService.organisationBoard(partial, {})
    expect(own.level).toBe('DEPARTMENT')
    expect(own.slices.map((slice) => slice.departmentId)).toEqual([dept1])
    expect(own.totals.headcount).toBe(3)
    expect((await employeesService.organisationBoard(partial, { companyId: companyA })).slices.map((slice) => slice.departmentId)).toEqual([dept1])
    await expect(employeesService.organisationBoard(partial, { companyId: companyB })).rejects.toMatchObject({ code: 'NOT_FOUND' })

    const payroll = userWith(colleague, [{ access: { PAYROLL: 'READ' }, rows: [row(companyA, null, null)] }])
    expect((await employeesService.organisationBoard(payroll, {})).slices.map((slice) => slice.companyId)).toEqual([companyA])
    expect((await employeesService.organisationBoard(payroll, { companyId: companyA })).slices).toHaveLength(2)

    const mixed = userWith(colleague, [
      { access: { EMPLOYEES: 'READ' }, rows: [row(companyA, plantA, dept1)] },
      { access: { PAYROLL: 'READ' }, rows: [row(companyA, null, null)] },
    ])
    expect((await employeesService.organisationBoard(mixed, {})).level).toBe('COMPANY')
    expect((await employeesService.organisationBoard(mixed, { companyId: companyA })).slices).toHaveLength(2)
  })

  it('gives an HOD their departments, and nothing to a role with neither access', async () => {
    const head = userWith(hod, [])
    const board = await employeesService.organisationBoard(head, {})
    expect(board.level).toBe('DEPARTMENT')
    expect(board.slices).toHaveLength(1)
    expect(board.slices[0]).toMatchObject({
      departmentId: dept1,
      headcount: 2,
      active: 1,
      onNotice: 1,
      employmentType: { PERMANENT: 1, CONTRACT: 1 },
      workforceCategory: { WHITE_COLLAR: 1, BLUE_COLLAR: 1 },
      joiningType: { REGULAR: 1, OVERSEAS: 1 },
    })
    expect(JSON.stringify(board)).not.toMatch(/employeeCode|firstName/)
    expect((await employeesService.organisationBoard(userWith(colleague, [{ access: { ATTENDANCE: 'READ' }, rows: [row(null, null, null)] }]), {})).level).toBe('NONE')
  })

  it('exports exactly the board the caller sees, and refuses a role that covers nothing', async () => {
    const hr = userWith(colleague, [{ access: { EMPLOYEES: 'READ' }, rows: [row(companyA, null, null)] }])
    const file = await employeesService.exportOrganisationBoard(hr, {})
    expect(file.name).toBe('organisation.xlsx')
    expect(file.size).toBeGreaterThan(0)
    const drill = await employeesService.exportOrganisationBoard(hr, { companyId: companyA })
    expect(drill.name).toMatch(/^organisation-.+\.xlsx$/)
    await expect(employeesService.exportOrganisationBoard(hr, { companyId: companyB })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    const nobody = userWith(colleague, [{ access: { ATTENDANCE: 'READ' }, rows: [row(null, null, null)] }])
    await expect(employeesService.exportOrganisationBoard(nobody, {})).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('lists the people behind a count: working now, by joining type, inside the directory scope', async () => {
    const hr = userWith(colleague, [{ access: { EMPLOYEES: 'READ' }, rows: [row(companyA, null, null)] }])
    const working = await employeesService.listEmployees({ status: 'WORKING', companyIds: [companyA, companyB] }, hr)
    expect(working.total).toBe(4)
    const regular = await employeesService.listEmployees({ status: 'WORKING', companyIds: [companyA], joiningTypes: ['REGULAR'] }, hr)
    expect(regular.items.map((item) => item.employeeCode)).toEqual([colleague.employeeCode])
    expect((await employeesService.listEmployees({ status: 'WORKING', companyIds: [companyB] }, hr)).total).toBe(0)
  })

  it('counts this month\'s joiners and leavers, exited people included, inside the same coverage', async () => {
    const exited = await prisma.employee.findFirstOrThrow({ where: { companyId: companyA, status: 'EXITED' }, select: { id: true } })
    await prisma.employee.update({ where: { id: colleague.id }, data: { dateOfJoining: today() } })
    await prisma.employee.update({ where: { id: exited.id }, data: { dateOfLeaving: today() } })
    const hr = userWith(colleague, [{ access: { EMPLOYEES: 'READ' }, rows: [row(companyA, null, null)] }])
    const companies = await employeesService.organisationBoard(hr, {})
    expect(companies.period.to).toEqual(today())
    expect(companies.slices[0]).toMatchObject({ companyId: companyA, headcount: 4, joined: 1, left: 1 })
    expect(companies.totals).toMatchObject({ joined: 1, left: 1 })
    const departments = await employeesService.organisationBoard(hr, { companyId: companyA })
    expect(departments.slices.find((slice) => slice.departmentId === dept1)).toMatchObject({ joined: 1, left: 1 })
    expect(departments.slices.find((slice) => slice.departmentId === dept2)).toMatchObject({ joined: 0, left: 0 })
    expect((await employeesService.organisationBoard(userWith(hod, []), {})).totals).toMatchObject({ joined: 1, left: 1 })
    const other = userWith(colleague, [{ access: { EMPLOYEES: 'READ' }, rows: [row(companyB, null, null)] }])
    expect((await employeesService.organisationBoard(other, {})).totals).toMatchObject({ joined: 0, left: 0 })
  })

  it('splits by grade and designation, and shows gender only where personal details are covered', async () => {
    const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const actor = { createdById: SYSTEM_ACTOR, updatedById: SYSTEM_ACTOR }
    const grade = await prisma.grade.create({ data: { code: `G${tag}`, name: `Grade ${tag}`, rank: 50, ...actor } })
    const designation = await prisma.designation.create({ data: { name: `Designation ${tag}`, ...actor } })
    await prisma.employee.update({ where: { id: colleague.id }, data: { gender: 'FEMALE', gradeId: grade.id, designationId: designation.id } })

    const directory = userWith(colleague, [{ access: { EMPLOYEES: 'READ' }, rows: [row(companyA, null, null)] }])
    const plain = await employeesService.organisationBoard(directory, {})
    expect(plain.breakdowns.map((b) => b.key)).toEqual(['grade', 'designation'])
    expect(plain.slices[0]!.gender).toBeNull()
    expect(plain.slices[0]!.grade[String(grade.id)]).toBe(1)
    expect(plain.slices[0]!.designation[String(designation.id)]).toBe(1)
    expect(plain.breakdowns.find((b) => b.key === 'grade')?.values.map((v) => v.key)).toContain(String(grade.id))
    const byGrade = await employeesService.listEmployees({ status: 'WORKING', gradeIds: [grade.id] }, directory)
    expect(byGrade.items.map((item) => item.employeeCode)).toEqual([colleague.employeeCode])

    const personal = userWith(colleague, [{ access: { EMPLOYEES: 'READ', EMPLOYEE_PERSONAL_DETAILS: 'READ' }, rows: [row(companyA, null, null)] }])
    const full = await employeesService.organisationBoard(personal, {})
    expect(full.breakdowns.map((b) => b.key)).toEqual(['gender', 'grade', 'designation'])
    expect(full.slices[0]!.gender).toMatchObject({ FEMALE: 1, MALE: 0 })
    expect(full.totals.gender?.FEMALE).toBe(1)

    // personal details on one department only: no partial company count, the other department not shown
    const mixed = userWith(colleague, [
      { access: { EMPLOYEES: 'READ' }, rows: [row(companyA, null, null)] },
      { access: { EMPLOYEES: 'READ', EMPLOYEE_PERSONAL_DETAILS: 'READ' }, rows: [row(companyA, plantA, dept1)] },
    ])
    expect((await employeesService.organisationBoard(mixed, {})).slices[0]!.gender).toBeNull()
    const departments = await employeesService.organisationBoard(mixed, { companyId: companyA })
    expect(departments.slices.find((s) => s.departmentId === dept1)?.gender?.FEMALE).toBe(1)
    expect(departments.slices.find((s) => s.departmentId === dept2)?.gender).toBeNull()
    expect(departments.totals.gender).toBeNull()

    expect((await employeesService.organisationBoard(userWith(hod, []), {})).breakdowns.map((b) => b.key)).toEqual(['grade', 'designation'])
    const installation = await installationOrganisationBoard({})
    expect(installation.breakdowns).toEqual([])
    expect(installation.slices.every((s) => s.gender === null && Object.keys(s.grade).length === 0)).toBe(true)
  })

  it('lets a super admin see every company in this fixture', async () => {
    const board = await employeesService.organisationBoard(userWith(hod, [], { isSuperAdmin: true }), {})
    expect(board.level).toBe('COMPANY')
    expect(board.slices.map((slice) => slice.companyId)).toEqual(expect.arrayContaining([companyA, companyB]))
    expect(board.slices.find((slice) => slice.companyId === companyB)?.headcount).toBeGreaterThanOrEqual(1)
  })
})
