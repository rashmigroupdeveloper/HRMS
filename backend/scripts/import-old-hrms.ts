// One-off import of companies and employees from the old HRMS database (../HRMS).
// Companies already imported get the fields added later (e-code prefix, India payroll, empty registrations).
//
//   npm run import:old-hrms -- <path to old HRMS backend/.env> [--dry-run]
//
// - Reads the old database with SELECT queries only.
// - Writes through the services (organization, employees), so all validation rules apply.
// - Created by: System (SYSTEM_ACTOR) - no one is logged in.
// - Safe to run again: companies / employees whose code already exists are skipped.
// - Never prints personal data, only codes and counts.
import { readFileSync } from 'node:fs'
import { prisma, PrismaClient, SYSTEM_ACTOR, type EmploymentType, type EmployeeStatus } from '#core/db/prisma'
import { employeesService } from '#modules/employees'
import { companiesService, plantsService } from '#modules/organization'
import { PrismaPg } from '@prisma/adapter-pg'
import { ORPCError } from '@orpc/server'
import { ZodError } from 'zod'

const [envPath, flag] = process.argv.slice(2)
if (!envPath) {
  console.error('Usage: npm run import:old-hrms -- <path to old HRMS backend/.env> [--dry-run]')
  process.exit(1)
}
const dryRun = flag === '--dry-run'

const oldUrl = readFileSync(envPath, 'utf8')
  .match(/^\s*DATABASE_URL\s*=\s*(.+)$/m)?.[1]
  ?.trim()
  .replace(/^["']|["']$/g, '')
if (!oldUrl) throw new Error(`DATABASE_URL not found in ${envPath}`)
const old = new PrismaClient({ adapter: new PrismaPg({ connectionString: oldUrl }) })

type OldCompany = {
  id: number
  code: string
  name: string
  ecode_prefix: string
  // the number the old HRMS would give next in the company's code series
  next_seq: number | null
  is_india_payroll: boolean
  address: string | null
  pf: string | null
  esic: string | null
  pan: string | null
  tan: string | null
  gstin: string | null
  pt: string | null
}
type OldEmployee = {
  ecode: string
  company_id: number
  is_india_payroll: boolean
  first_name: string
  last_name: string | null
  gender: string | null
  dob: string | null
  marital_status: string | null
  blood_group: string | null
  personal_email: string | null
  work_email: string | null
  mobile: string | null
  category: string | null
  contract_type: string | null
  contract_end_date: string | null
  doj: string | null
  dol: string | null
  status: string
  probation_due_date: string | null
  confirmation_date: string | null
}

// "YYYY-MM-DD" -> Date at UTC midnight (calendar dates must not shift with the time zone)
const day = (s: string | null) => (s ? new Date(`${s}T00:00:00Z`) : undefined)
const opt = <T>(v: T | null) => v ?? undefined

// Old "onboarding" employees have not joined yet - in the new HRMS they are candidates, so they are skipped
const STATUS: Record<string, EmployeeStatus> = {
  active: 'ACTIVE',
  on_notice: 'ON_NOTICE',
  exited: 'EXITED',
}
const GENDER = { male: 'MALE', female: 'FEMALE', transgender: 'TRANSGENDER' } as const
const MARITAL = { single: 'SINGLE', unmarried: 'SINGLE', married: 'MARRIED', widowed: 'WIDOWED', widow: 'WIDOWED', widower: 'WIDOWED', divorced: 'DIVORCED', divorcee: 'DIVORCED', separated: 'SEPARATED' } as const
const BLOOD = { 'a+': 'A_POSITIVE', 'a-': 'A_NEGATIVE', 'b+': 'B_POSITIVE', 'b-': 'B_NEGATIVE', 'ab+': 'AB_POSITIVE', 'ab-': 'AB_NEGATIVE', 'o+': 'O_POSITIVE', 'o-': 'O_NEGATIVE' } as const
const lookup = <M extends Record<string, string>>(map: M, v: string | null) =>
  v ? (map[v.trim().toLowerCase() as keyof M] as M[keyof M] | undefined) : undefined

// Old: category (white_collar / blue_collar / trainee / consultant / contract) + contract_type
// (permanent / temporary / probationary / consultant / fixed_term / apprentice)
function employmentType(e: OldEmployee): EmploymentType {
  if (e.contract_type === 'apprentice') return 'APPRENTICE'
  if (e.category === 'consultant' || e.contract_type === 'consultant') return 'CONSULTANT'
  if (e.category === 'trainee') return 'TRAINEE'
  if (e.category === 'contract' || e.contract_type === 'temporary' || e.contract_type === 'fixed_term') return 'CONTRACT'
  return 'PERMANENT' // permanent, probationary
}

async function main() {
  console.log(dryRun ? 'DRY RUN - nothing will be written\n' : '')

  // --- Companies ---
  const oldCompanies = await old.$queryRaw<OldCompany[]>`
    select id::int, code, name, ecode_prefix, ecode_next_seq::int next_seq, is_india_payroll, address, pf_establishment_code pf, esic_code esic,
      pan, tan, gstin, pt_registration_no pt
    from core.companies order by id`
  const ours = await companiesService.listCompanies(true)
  const existing = new Map(ours.map((c) => [c.code, c.id]))
  let companiesUpdated = 0
  const companyIdByOldId = new Map<number, number>()
  let companiesCreated = 0
  for (const c of oldCompanies) {
    const code = c.code.trim().toUpperCase()
    let id = existing.get(code)
    if (id === undefined) {
      // A company needs its address, state / region, PIN and (India payroll) PF / ESIC codes since 2026-11-15, and the
      // old HRMS has no state or PIN - a company not here yet is left for HR to add on the Organization page (its
      // employees are then skipped as "unknown company")
      console.log(`  company ${code} "${c.name.trim()}" is not in the new HRMS - add it on the Organization page (the old HRMS has no state / PIN)`)
      companiesCreated++
    } else {
      // Already imported: bring over the fields added later (e-code prefix, India payroll, the code series' next
      // number), never overwriting what HR has filled in since
      const mine = ours.find((o) => o.id === id)!
      const changes = {
        ...(mine.ecodePrefix !== c.ecode_prefix.trim().toUpperCase() && { ecodePrefix: c.ecode_prefix.trim().toUpperCase() }),
        ...(mine.isIndiaPayroll !== c.is_india_payroll && { isIndiaPayroll: c.is_india_payroll }),
        // (1 = the series was never used there - the real number comes from HR then)
        ...(mine.nextEmployeeNumber === null && c.next_seq && c.next_seq > 1 && { nextEmployeeNumber: c.next_seq }),
        ...(!mine.pan && c.pan && { pan: c.pan }),
        ...(!mine.tan && c.tan && { tan: c.tan }),
        ...(!mine.gstin && c.gstin && { gstin: c.gstin }),
        ...(!mine.ptRegistrationNo && c.pt && { ptRegistrationNo: c.pt }),
      }
      if (Object.keys(changes).length) {
        if (!dryRun) await companiesService.updateCompany({ id, ...changes }, SYSTEM_ACTOR)
        companiesUpdated++
      }
    }
    if (id !== undefined) companyIdByOldId.set(c.id, id)
  }
  console.log(`Companies: ${oldCompanies.length} in old HRMS, ${companiesCreated} to add by hand, ${oldCompanies.length - companiesCreated} already present (${companiesUpdated} ${dryRun ? 'would be ' : ''}updated)`)

  // --- Employees ---
  const oldEmployees = await old.$queryRaw<OldEmployee[]>`
    select e.ecode, e.company_id::int, c.is_india_payroll, e.first_name, e.last_name, e.gender, e.dob::text,
           e.marital_status, e.blood_group, e.personal_email, e.work_email, e.mobile, e.category, e.contract_type,
           e.contract_end_date::text, e.doj::text, e.dol::text, e.status, e.probation_due_date::text, e.confirmation_date::text
    from core.employees e join core.companies c on c.id = e.company_id order by e.id`

  // The old HRMS has no reliable plant per employee: each gets the company's first active plant (lowest plant code),
  // as the employees already in the new HRMS did on 2026-11-18 - HR corrects it on the employee's profile
  const firstPlantOf = new Map<number, number>()
  for (const plant of await plantsService.listPlants(undefined)) {
    if (!firstPlantOf.has(plant.company.id)) firstPlantOf.set(plant.company.id, plant.id)
  }

  let created = 0
  let skipped = 0
  const problems: string[] = []
  const missing = { gender: 0, dateOfBirth: 0 }
  for (const e of oldEmployees) {
    const employeeCode = e.ecode.trim().toUpperCase()
    try {
      await employeesService.getByCode(employeeCode)
      skipped++
      continue
    } catch (err) {
      if (!(err instanceof ORPCError && err.code === 'NOT_FOUND')) throw err
    }

    const status = STATUS[e.status]
    if (!status) {
      problems.push(`${employeeCode}: status "${e.status}" - not an employee yet (enter as a candidate), skipped`)
      continue
    }
    const companyId = companyIdByOldId.get(e.company_id)
    if (companyId === undefined && !dryRun) {
      problems.push(`${employeeCode}: company not imported`)
      continue
    }
    const plantId = companyId === undefined ? undefined : firstPlantOf.get(companyId)
    if (plantId === undefined && !dryRun) {
      problems.push(`${employeeCode}: the company has no active plant - add one on the Organization page`)
      continue
    }
    // Every employee needs a department (2026-11-19), but this import does not bring the old departments across yet
    // (BACKLOG "Old-HRMS import: departments") - so no employee is created. To import them, map the old department to
    // one running at the employee's plant here.
    const departmentId: number | undefined = undefined
    if (departmentId === undefined) {
      problems.push(`${employeeCode}: no department - this import does not bring the old departments across yet, skipped`)
      continue
    }
    const dateOfJoining = day(e.doj)
    if (!dateOfJoining) {
      problems.push(`${employeeCode}: no date of joining in old HRMS`)
      continue
    }
    const type = employmentType(e)
    const data: Parameters<typeof employeesService.createEmployee>[0] = {
      employeeCode,
      // Old HRMS has no joining type: overseas company -> OVERSEAS; consultant / trainee -> CONSULTANT_INTERN; else REGULAR
      joiningType: !e.is_india_payroll ? 'OVERSEAS' : type === 'CONSULTANT' || type === 'TRAINEE' ? 'CONSULTANT_INTERN' : 'REGULAR',
      employmentType: type,
      workforceCategory: e.category === 'blue_collar' ? 'BLUE_COLLAR' : 'WHITE_COLLAR',
      dateOfJoining,
      contractEndDate: day(e.contract_end_date),
      probationEndDate: day(e.probation_due_date),
      confirmationDate: day(e.confirmation_date),
      dateOfLeaving: day(e.dol),
      status,
      // (undefined only in a dry run, where companies are not created)
      companyId: companyId ?? 0,
      plantId: plantId ?? 0,
      departmentId,
      firstName: e.first_name,
      lastName: opt(e.last_name),
      gender: lookup(GENDER, e.gender),
      dateOfBirth: day(e.dob),
      maritalStatus: lookup(MARITAL, e.marital_status),
      bloodGroup: lookup(BLOOD, e.blood_group),
      workEmail: opt(e.work_email),
      personalEmail: opt(e.personal_email),
      mobile: opt(e.mobile),
    }
    if (!dryRun) {
      try {
        await employeesService.createEmployee(data, SYSTEM_ACTOR)
      } catch (err) {
        if (!(err instanceof ZodError)) throw err
        problems.push(`${employeeCode}: ${err.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`)
        continue
      }
    }
    if (!data.gender) missing.gender++
    if (!data.dateOfBirth) missing.dateOfBirth++
    created++
  }
  console.log(`Employees: ${oldEmployees.length} in old HRMS, ${created} ${dryRun ? 'would be ' : ''}created, ${skipped} already present, ${problems.length} failed`)
  for (const p of problems) console.log(`  ! ${p}`)
  if (missing.gender) console.log(`  - ${missing.gender} imported without gender (empty in old HRMS) - HR must fill it in`)
  if (missing.dateOfBirth) console.log(`  - ${missing.dateOfBirth} imported without date of birth`)

  // --- What the old HRMS has that is NOT imported ---
  const [notImported] = await old.$queryRaw<Record<string, number>[]>`
    select count(reporting_manager_id)::int reporting_manager, count(pan)::int pan, count(aadhaar)::int aadhaar,
           count(uan)::int uan, count(esic_ip_number)::int esic, count(bank_account)::int bank_account,
           count(present_address)::int present_address, count(permanent_address)::int permanent_address,
           count(emergency_contact_name)::int emergency_contact, count(designation_id)::int designation,
           count(department_id)::int department, count(location_id)::int location, count(grade_id)::int grade
    from core.employees`
  const leftOver = Object.entries(notImported ?? {}).filter(([, n]) => n > 0)
  console.log(
    leftOver.length
      ? `Not imported (no matching data/field yet): ${leftOver.map(([k, n]) => `${k}=${n}`).join(', ')}`
      : 'Not imported: nothing - the old HRMS has no other employee data',
  )
}

try {
  await main()
} finally {
  await old.$disconnect()
  await prisma.$disconnect()
}
