import { prisma } from '#core/db/prisma'
import { employeesService } from '#modules/employees'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as jobHistoryService from '../src/modules/employees/job-history/job-history.service.js'
import * as jobChangesService from '../src/modules/job-changes/job-changes.service.js'
import * as documentsService from '../src/modules/employees/documents/documents.service.js'
import * as layoffsService from '../src/modules/employees/layoffs/layoffs.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// Data access on employees (2026-11-18): the directory, its counts, a profile, changes and moves only inside the
// viewer's data access; outside it an employee is "not found"; the people search covers the whole group.
describe('employees inside and outside the data access', () => {
  let companyA: number
  let companyB: number
  let plantA1: number
  let plantA2: number
  let plantB1: number
  let inA1: { id: number; employeeCode: string }
  let inA2: { id: number; employeeCode: string }
  let inB: { id: number; employeeCode: string }
  let hrForA: ReturnType<typeof userWith>
  let hrForA1: ReturnType<typeof userWith>

  beforeAll(async () => {
    companyA = (await createCompany()).id
    companyB = (await createCompany()).id
    plantA1 = (await createPlant(companyA)).id
    plantA2 = (await createPlant(companyA)).id
    plantB1 = (await createPlant(companyB)).id
    inA1 = await createEmployee({ companyId: companyA, plantId: plantA1 })
    inA2 = await createEmployee({ companyId: companyA, plantId: plantA2 })
    inB = await createEmployee({ companyId: companyB, plantId: plantB1 })
    // HR for the whole of company A (the viewer is the employee in B, to show their own record stays visible)
    hrForA = userWith(inB, [{ access: { EMPLOYEES: 'WRITE', JOB_CHANGE_REQUEST: 'WRITE', SALARY: 'READ', JOB_CHANGE_APPROVAL: 'WRITE' }, rows: [row(companyA, null, null)] }])
    // HR for plant A1 only
    hrForA1 = userWith(inB, [{ access: { EMPLOYEES: 'WRITE', JOB_CHANGE_REQUEST: 'WRITE', JOB_CHANGE_APPROVAL: 'WRITE' }, rows: [row(companyA, plantA1, null)] }])
  })
  afterAll(() => prisma.$disconnect())

  it('lists, counts and filters only employees inside the data access', async () => {
    const page = await employeesService.listEmployees({ companyIds: [companyA, companyB], pageSize: 100 }, hrForA)
    const codes = page.items.map((e) => e.employeeCode)
    expect(codes).toEqual(expect.arrayContaining([inA1.employeeCode, inA2.employeeCode]))
    expect(codes).not.toContain(inB.employeeCode)
    // the filter counts never show company B
    expect(page.facets.companyId.map((f) => f.value)).not.toContain(companyB)
    // the plant filter
    const atA2 = await employeesService.listEmployees({ plantIds: [plantA2] }, hrForA)
    expect(atA2.items.map((e) => e.employeeCode)).toEqual([inA2.employeeCode])
    // a narrower viewer sees fewer, and the tiles count only those
    const narrow = await employeesService.listEmployees({ companyIds: [companyA] }, hrForA1)
    expect(narrow.items.map((e) => e.employeeCode)).toEqual([inA1.employeeCode])
    expect(narrow.summary.active).toBeLessThan(page.summary.active + 1)
  })

  it('opens a profile inside the data access, says "not found" outside it, and always shows one\'s own', async () => {
    await expect(employeesService.getByCodeFor(hrForA, inA2.employeeCode)).resolves.toMatchObject({ employeeCode: inA2.employeeCode })
    await expect(employeesService.getByCodeFor(hrForA1, inA2.employeeCode)).rejects.toThrow(`No employee found with code ${inA2.employeeCode}`)
    await expect(employeesService.getByCodeFor(hrForA1, inB.employeeCode)).resolves.toMatchObject({ employeeCode: inB.employeeCode })
    const ref = { employeeCode: inA2.employeeCode, companyId: companyA, plantId: plantA2, departmentId: null }
    expect(employeesService.seesPart(hrForA, ref, 'SALARY')).toBe(true)
    expect(employeesService.seesPart(hrForA1, ref, 'SALARY')).toBe(false)
  })

  it('changes, moves and adds only inside the data access', async () => {
    await expect(employeesService.updateEmployee({ employeeCode: inA1.employeeCode, firstName: 'Changed' }, hrForA1)).resolves.toBeDefined()
    await expect(employeesService.updateEmployee({ employeeCode: inA2.employeeCode, firstName: 'Changed' }, hrForA1)).rejects.toThrow('No employee found')
    // a move needs Edit where they go as well
    // (with a department running at the new plant - every employee has one)
    const departmentAtA2 = (await employeesService.getByCode(inA2.employeeCode)).department.id
    const departmentAtB1 = (await employeesService.getByCode(inB.employeeCode)).department.id
    await expect(employeesService.updateEmployee({ employeeCode: inA1.employeeCode, plantId: plantA2, departmentId: departmentAtA2 }, hrForA1)).rejects.toThrow('only move an employee')
    await expect(employeesService.updateEmployee({ employeeCode: inA1.employeeCode, plantId: plantA2, departmentId: departmentAtA2 }, hrForA)).resolves.toBeDefined()
    await expect(
      employeesService.addEmployee(
        { companyId: companyB, plantId: plantB1, departmentId: departmentAtB1, firstName: 'New', dateOfJoining: new Date(Date.UTC(2026, 0, 1)), joiningType: 'OVERSEAS', employmentType: 'PERMANENT', workforceCategory: 'WHITE_COLLAR' },
        hrForA,
      ),
    ).rejects.toThrow('inside your data access')
  })

  it("shows and changes lay offs, the job timeline and job changes only inside the data access (2026-11-19/20)", async () => {
    const viewOnlyA = userWith(inB, [{ access: { EMPLOYEES: 'READ' }, rows: [row(companyA, null, null, 'READ')] }])
    const layoff = { startDate: new Date(Date.UTC(2026, 5, 1)), reason: 'Plant shut' }
    // (an earlier test moves inA1 to plant A2 - one of its own at A1)
    const atA1 = await createEmployee({ companyId: companyA, plantId: plantA1 })
    // outside the data access: not found
    await expect(layoffsService.listLayoffs(hrForA1, inA2.employeeCode)).rejects.toThrow('No employee found')
    await expect(layoffsService.createLayoff({ employeeCode: inA2.employeeCode, ...layoff }, hrForA1)).rejects.toThrow('No employee found')
    await expect(jobHistoryService.listJobHistory(hrForA1, inA2.employeeCode)).rejects.toThrow('No employee found')
    await expect(jobHistoryService.jobAsOf(hrForA1, { employeeCode: inA2.employeeCode, date: new Date() })).rejects.toThrow('No employee found')
    await expect(
      jobChangesService.createJobChange({ employeeCode: inA2.employeeCode, effectiveFrom: new Date(Date.UTC(2099, 0, 1)), kind: 'OTHER', reason: 'Test', workforceCategory: 'BLUE_COLLAR' }, hrForA1),
    ).rejects.toThrow('No employee found')
    // View only: seen, not changed
    await expect(layoffsService.listLayoffs(viewOnlyA, inA2.employeeCode)).resolves.toEqual([])
    await expect(layoffsService.createLayoff({ employeeCode: inA2.employeeCode, ...layoff }, viewOnlyA)).rejects.toThrow()
    // inside: changed; one's own: seen
    await expect(layoffsService.createLayoff({ employeeCode: atA1.employeeCode, ...layoff }, hrForA1)).resolves.toBeDefined()
    await expect(jobHistoryService.listJobHistory(hrForA1, inB.employeeCode)).resolves.toBeDefined()
    // a transfer needs Edit where they go as well
    const departmentAtA2 = (await employeesService.getByCode(inA2.employeeCode)).department.id
    await expect(
      jobChangesService.createJobChange({ employeeCode: atA1.employeeCode, effectiveFrom: new Date(Date.UTC(2099, 0, 1)), kind: 'TRANSFER', reason: 'Test', plantId: plantA2, departmentId: departmentAtA2 }, hrForA1),
    ).rejects.toThrow('only move an employee')
  })

  it('searches people across the whole group for the pickers', async () => {
    const found = await employeesService.searchPeople({ query: inB.employeeCode })
    expect(found.map((p) => p.employeeCode)).toEqual([inB.employeeCode])
    expect(Object.keys(found[0]!).sort()).toEqual(['company', 'designation', 'employeeCode', 'name'])
  })
  it('the company directory and org chart: everyone working now in every company, basic fields only, for anyone', async () => {
    // a plain employee with no role at all, in company B
    const plain = userWith(inB, [{ access: {}, rows: [] }])
    const left = await createEmployee({ companyId: companyA, plantId: plantA1 })
    await prisma.employee.update({ where: { id: left.id }, data: { status: 'EXITED', dateOfLeaving: new Date(Date.UTC(2026, 5, 1)), updatedById: 0 } })
    await prisma.employee.update({ where: { id: inA2.id }, data: { reportingManagerId: inA1.id, updatedById: 0 } })
    await prisma.employee.update({ where: { id: inA1.id }, data: { reportingManagerId: inB.id, dateOfBirth: new Date(Date.UTC(1990, 4, 5)), updatedById: 0 } })

    const page = await employeesService.listDirectory(plain, { companyIds: [companyA, companyB], page: 1, pageSize: 100 })
    const codes = page.items.map((e) => e.employeeCode)
    expect(codes).toEqual(expect.arrayContaining([inA1.employeeCode, inA2.employeeCode, inB.employeeCode]))
    expect(codes).not.toContain(left.employeeCode)
    // basic fields only - no personal contacts, IDs or salary; the birthday without the year
    const card = page.items.find((e) => e.employeeCode === inA1.employeeCode)!
    expect(Object.keys(card).sort()).toEqual(
      ['birthday', 'bloodGroup', 'company', 'dateOfJoining', 'department', 'designation', 'directReports', 'employeeCode', 'name', 'plant', 'reportingManager', 'workEmail', 'workLocation'].sort(),
    )
    expect(card.birthday).toEqual({ day: 5, month: 5 })
    expect(card.directReports).toBe(1)
    // "my team": only who reports to the viewer (A1 reports to B, the plain viewer)
    const team = await employeesService.listDirectory(plain, { group: 'TEAM', page: 1, pageSize: 100 })
    expect(team.items.map((e) => e.employeeCode)).toEqual([inA1.employeeCode])
    // "my department": the viewer heads no post - nobody
    expect((await employeesService.listDirectory(plain, { group: 'DEPARTMENT', page: 1, pageSize: 100 })).total).toBe(0)

    // the org chart across companies: A2 -> A1 -> B
    const chart = await employeesService.orgChart(plain, { employeeCode: inA2.employeeCode })
    expect(chart.managers.map((m) => m.employeeCode)).toEqual([inA1.employeeCode, inB.employeeCode])
    expect((await employeesService.orgChart(plain, undefined)).reports.map((r) => r.employeeCode)).toContain(inA1.employeeCode)
    await expect(employeesService.orgChart(plain, { employeeCode: left.employeeCode })).rejects.toThrow('No employee found')
  })
})

describe('lists fail closed and the "all" attendance view follows the data access', () => {
  it('shows nothing to a role without rows and only the covered employees in the attendance "All" view', async () => {
    const { listEmployees } = employeesService
    const companyC = (await createCompany()).id
    const companyD = (await createCompany()).id
    const plantC = (await createPlant(companyC)).id
    const plantD = (await createPlant(companyD)).id
    const inC = await createEmployee({ companyId: companyC, plantId: plantC })
    const inD = await createEmployee({ companyId: companyD, plantId: plantD })
    // a role given with no data-access rows covers nobody's records
    const noRows = userWith(inC, [{ access: { EMPLOYEES: 'READ', ATTENDANCE: 'READ' }, rows: [] }])
    expect((await listEmployees({ companyIds: [companyC, companyD] }, noRows)).items).toEqual([])
    // the attendance "All" view: only company C for an HR person of company C
    const { peopleInScope } = await import('../src/modules/attendance/days/days.service.js')
    const hrForC = userWith(inC, [{ access: { ATTENDANCE: 'READ' }, rows: [row(companyC, null, null)] }])
    const from = new Date(Date.UTC(2026, 5, 1))
    const people = await peopleInScope(hrForC, { scope: 'ALL', companyIds: [companyC, companyD] }, from, from)
    expect(people.map((p) => p.employeeCode)).toEqual([inC.employeeCode])
    expect(await peopleInScope(noRows, { scope: 'ALL', companyIds: [companyC, companyD] }, from, from)).toEqual([])
    expect(inD.employeeCode).toBeTruthy()
  })

})

// Records by id outside the data access (2026-11-23, the review): a document or lay off of someone outside the viewer's View
// said "No employee found with code <owner>" - their code and that the record exists. Now the same "not found" as an id
// that does not exist.
describe('documents and lay offs by id outside the data access', () => {
  it('answers exactly as for an id that does not exist', async () => {
    const companyA = (await createCompany()).id
    const companyB = (await createCompany()).id
    const inA = await createEmployee({ companyId: companyA, plantId: (await createPlant(companyA)).id })
    const inB = await createEmployee({ companyId: companyB, plantId: (await createPlant(companyB)).id })
    const everywhere = userWith(inA, [{ access: { EMPLOYEES: 'WRITE', EMPLOYEE_DOCUMENTS: 'WRITE' }, rows: [row(null, null, null)] }])
    const hrForA = userWith(inA, [{ access: { EMPLOYEES: 'WRITE', EMPLOYEE_DOCUMENTS: 'WRITE' }, rows: [row(companyA, null, null)] }])
    const pdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0x25, 0x45, 0x4f, 0x46])], 'copy.pdf', { type: 'application/pdf' })
    const document = await documentsService.uploadDocument({ employeeCode: inB.employeeCode, type: 'GRADUATION_CERTIFICATE', file: pdf }, everywhere)
    const layoff = await layoffsService.createLayoff({ employeeCode: inB.employeeCode, startDate: new Date(Date.UTC(2026, 5, 1)), reason: 'Plant shut' }, everywhere)
    const missing = 2_000_000_000
    const answer = (run: () => Promise<unknown>) =>
      run().then(
        () => 'opened',
        (error: Error) => error.message,
      )
    // the id of someone else's record gets the answer of a missing id - only the id differs
    const same = async (id: number, run: (id: number) => Promise<unknown>) =>
      expect((await answer(() => run(id))).replace(String(id), '#')).toBe((await answer(() => run(missing))).replace(String(missing), '#'))
    await same(document.id, (id) => documentsService.downloadDocument(hrForA, id))
    await same(document.id, (id) => documentsService.reviewDocument({ id, status: 'VERIFIED' }, hrForA))
    await same(layoff.id, (id) => layoffsService.updateLayoff({ id, reason: 'Changed' }, hrForA))
    await same(layoff.id, (id) => layoffsService.deleteLayoff(id, hrForA))
    expect(await answer(() => documentsService.downloadDocument(hrForA, document.id))).not.toContain(inB.employeeCode)
  })
})
