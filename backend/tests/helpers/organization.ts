import { SYSTEM_ACTOR } from '#core/db/prisma'
import { employeesService } from '#modules/employees'
import { companiesService, departmentsService, plantsService } from '#modules/organization'

// Test data, created through the services (all their rules apply) as System. The test database is never wiped, so
// every code and name carries this run's random tag plus a running number - runs and test files never clash.
const run = Math.random().toString(36).slice(2, 7).toUpperCase().padEnd(5, '0')
let next = 0
const unique = () => `${run}${String(++next).padStart(2, '0')}`

// An overseas company (no PIN, PF or ESIC needed) with its own code series
export async function createCompany() {
  const n = unique()
  return companiesService.createCompany(
    {
      code: `TC${n}`,
      name: `Test Company ${n}`,
      // a letter, then up to 9 letters / digits
      ecodePrefix: `T${n}`,
      nextEmployeeNumber: 1,
      isIndiaPayroll: false,
      address: 'Test street 1',
      countryCode: 'AE',
      region: 'Dubai',
    },
    SYSTEM_ACTOR,
  )
}

export async function createPlant(companyId: number) {
  const n = unique()
  return plantsService.createPlant({ companyId, plantCode: `P${n}`, name: `Test Plant ${n}` }, SYSTEM_ACTOR)
}

export async function createDepartment() {
  const n = unique()
  return departmentsService.createDepartment({ code: `D${n}`, name: `Test Department ${n}` }, SYSTEM_ACTOR)
}

// A department running at the plant for tests that do not care which: one per plant, made the first time
const generalOf = new Map<number, number>()
async function generalDepartment(plantId: number) {
  let id = generalOf.get(plantId)
  if (id === undefined) {
    id = (await createDepartment()).id
    await plantsService.addPlantDepartments(plantId, [id], SYSTEM_ACTOR)
    generalOf.set(plantId, id)
  }
  return id
}

// An active employee placed at the plant and department (every employee has one - 2026-11-19; without one given, a
// department of its own running at the plant), with a code of its own; `leavesOn`: on notice, leaving that day
export async function createEmployee(placement: { companyId: number; plantId: number; departmentId?: number; leavesOn?: Date }) {
  const { leavesOn, ...place } = placement
  const n = unique()
  return employeesService.createEmployee(
    {
      employeeCode: `TE${n}`,
      joiningType: 'OVERSEAS',
      employmentType: 'PERMANENT',
      workforceCategory: 'WHITE_COLLAR',
      dateOfJoining: new Date(Date.UTC(2026, 0, 1)),
      status: leavesOn ? 'ON_NOTICE' : 'ACTIVE',
      dateOfLeaving: leavesOn,
      firstName: `Employee ${n}`,
      ...place,
      departmentId: place.departmentId ?? (await generalDepartment(place.plantId)),
    },
    SYSTEM_ACTOR,
  )
}
