// Creates the first super admin of an empty database: an employee record and its login with the "Super Admin" role
// (nobody can sign in yet to add one on the pages).
//
//   npm run create-admin -- --company <code> --plant <plant code> --department "<name>" --name "<first [last]>"
//                           [--code <employee code>] [--password <password>]
//
// - The place must exist (e.g. after `npm run import:vbms`): a company, one of its plants and a department running there.
// - The code: --code, else the next of the company's series (set on the Organization page or by the import).
// - Created by System; a Regular / Permanent / White collar employee who joined today - correct it later on the pages.
// - The password is temporary: it must be changed at the first sign-in. Without --password a random one is generated
//   and printed ONCE - hand it over safely.
// After that, people are added and roles given on the pages (or with `npm run set-password` for an existing employee).
import { generatePassword } from '#core/auth/password'
import { SYSTEM_ACTOR } from '#core/db/prisma'
import { accountsService } from '#modules/accounts'
import { employeesService } from '#modules/employees'
import { companiesService, departmentsService, plantsService } from '#modules/organization'
import { today } from '#shared/utils/dates'

const args = process.argv.slice(2)
const option = (name: string) => {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]?.trim()
}
const companyCode = option('--company')
const plantCode = option('--plant')
const departmentName = option('--department')
const fullName = option('--name')
if (!companyCode || !plantCode || !departmentName || !fullName) {
  console.error('Usage: npm run create-admin -- --company <code> --plant <plant code> --department "<name>" --name "<first [last]>" [--code <code>] [--password <password>]')
  process.exit(1)
}
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

try {
  const company = (await companiesService.listCompanies()).find((c) => same(c.code, companyCode))
  if (!company) throw new Error(`No active company with code ${companyCode}`)
  const plant = (await plantsService.listPlants({ companyId: company.id })).find((p) => same(p.plantCode, plantCode))
  if (!plant) throw new Error(`No active plant ${plantCode} in ${company.code}`)
  const department = (await departmentsService.listDepartments(false, plant.id)).find((d) => same(d.name, departmentName))
  if (!department) throw new Error(`No department "${departmentName}" running at plant ${plant.plantCode} ${plant.name}`)
  const [firstName, ...rest] = fullName.split(/\s+/)

  const created = await employeesService.createEmployee(
    {
      employeeCode: option('--code')?.toUpperCase(),
      joiningType: 'REGULAR',
      employmentType: 'PERMANENT',
      workforceCategory: 'WHITE_COLLAR',
      dateOfJoining: today(),
      status: 'ACTIVE',
      companyId: company.id,
      plantId: plant.id,
      departmentId: department.id,
      firstName: firstName!,
      lastName: rest.join(' ') || undefined,
    },
    SYSTEM_ACTOR,
  )
  const password = option('--password') ?? generatePassword()
  const result = await accountsService.setPassword(created.employeeCode, password, 'Super Admin')
  console.log(`Created ${result.employeeCode} (${result.name}) at ${company.code} · ${plant.plantCode} ${plant.name} · ${department.name}`)
  console.log(`Login with roles: ${result.roles.join(', ')}`)
  console.log(`Temporary password: ${password}  (must be changed at the first sign-in)`)
  process.exit(0)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
