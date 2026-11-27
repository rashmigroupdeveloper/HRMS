// One employee and a temporary login for every role, so each role can be tried on a new database,
// plus one employee with no role for Employee self-service.
// Also makes a small company, plant and department for them to sit in, if those are not there yet.
//
//   npm run create-role-employees
//
// Safe to run again: a role that already has its employee is left as it is (the password is not reset).
// The password is temporary: it must be changed at the first sign-in. Created by System.
import { SYSTEM_ACTOR } from '#core/db/prisma'
import { accountsService } from '#modules/accounts'
import { employeesService } from '#modules/employees'
import { companiesService, departmentsService, plantsService } from '#modules/organization'
import { today } from '#shared/utils/dates'

const PASSWORD = 'Welcome@123'
const COMPANY_CODE = 'DEMO'
const PLANT_CODE = 'HO'
const DEPARTMENT_CODE = 'HR'
// No role: signs in to Employee self-service only.
const EMPLOYEE_EMAIL = 'employee@demo.example'

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
const loginOf = (roleName: string) => `${roleName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}@demo.example`

async function place() {
  const companies = await companiesService.listCompanies(true)
  let company = companies.find((c) => same(c.code, COMPANY_CODE))
  if (!company) {
    company = await companiesService.createCompany(
      {
        code: COMPANY_CODE,
        name: 'Demo Company',
        ecodePrefix: COMPANY_CODE,
        nextEmployeeNumber: 1,
        isIndiaPayroll: true,
        address: '1 Demo Street, Kolkata',
        postalCode: '700001',
        countryCode: 'IN',
        region: 'West Bengal',
        pfEstablishmentCode: 'WBCAL0012345',
        esicEmployerCode: '31000123450000001',
      },
      SYSTEM_ACTOR,
    )
    console.log(`Company ${company.code} ${company.name} added`)
  }

  const plants = await plantsService.listPlants({ companyId: company.id, includeInactive: true })
  let plant = plants.find((p) => same(p.plantCode, PLANT_CODE))
  if (!plant) {
    plant = await plantsService.createPlant(
      {
        companyId: company.id,
        plantCode: PLANT_CODE,
        name: 'Head Office',
        address: '1 Demo Street, Kolkata',
        postalCode: '700001',
        countryCode: 'IN',
        region: 'West Bengal',
      },
      SYSTEM_ACTOR,
    )
    console.log(`Plant ${plant.plantCode} ${plant.name} added`)
  }

  const departments = await departmentsService.listDepartments(true)
  let department = departments.find((d) => same(d.code, DEPARTMENT_CODE))
  if (!department) {
    department = await departmentsService.createDepartment({ code: DEPARTMENT_CODE, name: 'Human Resources' }, SYSTEM_ACTOR)
    console.log(`Department ${department.code} ${department.name} added`)
  }
  await plantsService.addPlantDepartments(plant.id, [department.id], SYSTEM_ACTOR)
  return { companyId: company.id, plantId: plant.id, departmentId: department.id }
}

try {
  const where = await place()
  const roles = [...(await accountsService.roleNames()).values()]
  let created = 0
  for (const roleName of roles) {
    const email = loginOf(roleName)
    const existing = await employeesService.findSummaryByLogin(email)
    if (existing) {
      console.log(`${roleName}: already there as ${existing.employeeCode} (${email})`)
      continue
    }
    const employee = await employeesService.createEmployee(
      {
        joiningType: 'REGULAR',
        employmentType: 'PERMANENT',
        workforceCategory: 'WHITE_COLLAR',
        dateOfJoining: today(),
        status: 'ACTIVE',
        firstName: roleName,
        workEmail: email,
        ...where,
      },
      SYSTEM_ACTOR,
    )
    const login = await accountsService.setPassword(employee.employeeCode, PASSWORD, roleName)
    created += 1
    console.log(`${roleName}: ${login.employeeCode}  ${email}`)
  }

  const existingEmployee = await employeesService.findSummaryByLogin(EMPLOYEE_EMAIL)
  if (existingEmployee) {
    console.log(`Employee: already there as ${existingEmployee.employeeCode} (${EMPLOYEE_EMAIL})`)
  } else {
    const employee = await employeesService.createEmployee(
      {
        joiningType: 'REGULAR',
        employmentType: 'PERMANENT',
        workforceCategory: 'WHITE_COLLAR',
        dateOfJoining: today(),
        status: 'ACTIVE',
        firstName: 'Employee',
        workEmail: EMPLOYEE_EMAIL,
        ...where,
      },
      SYSTEM_ACTOR,
    )
    const login = await accountsService.setPassword(employee.employeeCode, PASSWORD)
    created += 1
    console.log(`Employee: ${login.employeeCode}  ${EMPLOYEE_EMAIL}`)
  }

  if (created > 0) console.log(`Temporary password for the new logins: ${PASSWORD}  (must be changed at the first sign-in)`)
  else console.log('Nothing new to create.')
  process.exit(0)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
