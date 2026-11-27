// TEST DATA ONLY - imports every employee of HR's "Employee Master Report" Excel (kept in private/, never committed)
// and makes up what the file does not have, so the app can be tried with the real number of people (the user,
// 2026-11-27: "fake what is not there, managers by your choice, it can be wrong"). Never run it on the live database.
//
//   npm run import:employee-master -w backend -- "../private/Employee Master Report.xlsx" [--top <code>] [--dry-run]
//
// --top <code>: the most senior person of each company (no one above them in the file) reports to this employee, so
// the whole group shows as one org chart (the user, 2026-11-27: under the Super Admin, SUPERADMIN).
//
// From the file: employee code, name, date of joining, e-mail (-> personal e-mail), phone, marital status, company,
// department, designation, grade. Made up: gender, date of birth, plant (the cost centre picks one of the company's
// plants, so a cost centre stays together), employment type / category / joining type (from the grade and the
// company), and the reporting manager (someone more senior in the same company - same plant and department first).
// Departments, designations and grades not there yet are added. Every employee gets a login with the password
// test@12345, which does not have to be changed at sign-in.
//
// - Writes through the services (organization, employees, accounts), so the validation rules apply. Created by System.
// - Safe to run again: employees whose code exists are skipped (their login is still set).
// - Prints only codes and counts, never personal data.
import ExcelJS from 'exceljs'
import { createHash } from 'node:crypto'
import { fullAccess } from '#core/auth/access'
import { ALL_OF_GROUP } from '#core/auth/scope'
import type { CurrentUser } from '#core/rpc/procedures'
import { prisma, SYSTEM_ACTOR, type EmploymentType, type MaritalStatus, type WorkforceCategory } from '#core/db/prisma'
import { accountsService } from '#modules/accounts'
import { employeesService } from '#modules/employees'
import { companiesService, departmentsService, designationsService, gradesService, plantsService } from '#modules/organization'
import { emailSchema, mobileSchema } from '#shared/schemas/common.schema'
import { ZodError } from 'zod'

const PASSWORD = 'test@12345'
const MAX_REPORTS = 20

const args = process.argv.slice(2)
const filePath = args[0]
if (!filePath || filePath.startsWith('--')) {
  console.error('Usage: npm run import:employee-master -w backend -- <path to Employee Master Report.xlsx> [--top <code>] [--dry-run]')
  process.exit(1)
}
const dryRun = args.includes('--dry-run')
const topCode = args.includes('--top') ? args[args.indexOf('--top') + 1]?.trim().toUpperCase() : undefined

// The script acts as System with every access (no one is logged in) - for employeesService.updateEmployee
const SYSTEM_VIEWER: CurrentUser = {
  sessionId: -1, accountId: -1, employeeId: SYSTEM_ACTOR, employeeCode: 'SYSTEM', name: 'System', roles: [], availableRoles: [],
  activeRoleId: null, activeRoleIsFallback: false, isSuperAdmin: true, access: fullAccess(),
  grants: [{ access: fullAccess(), rows: [{ ...ALL_OF_GROUP, level: 'WRITE' }] }], mustChangePassword: false, passwordConfirmedUntil: new Date(Date.now() + 3_600_000),
}

// The file's company names -> our company codes (written as the file spells them; "Rashmi Group" -> RML)
const COMPANY: Record<string, string> = {
  'rashmi metaliks limited': 'RML',
  'rashmi group': 'RML',
  'rashmi green hydrogen steel ltd': 'RGHSPL',
  'reach dredging limited': 'RDL',
  'rashmi 6 paradigm limited': 'R6PL',
  'rashmi 6 paradigm ltd': 'R6PL',
  'koove iot pvt. limited': 'KIPL',
  'ehoome iot pvt. limited': 'EIPL',
  'koove organic chemical pvt. limited': 'KOCPL',
  'koove organic chemicals pvt limited': 'KOCPL',
  'rashmi metaliks bahrain w.l.l': 'RMB',
  'pt reach dredging limited indo green venture': 'RIGV',
  'rashmi pipes and fittings fzco dubai': 'RPF',
  'rashmi rare earth limited': 'RREL',
  'rashmi metalix ltd': 'RMXL',
  'rashmi metaliks uk limited': 'RMUK',
  'reach mining tz limited': 'RMTZ',
}

// The file's grades, cleaned (typos joined): grade code, name, rank (lower = more senior)
const GRADE: Record<string, [string, string, number]> = {
  'director family': ['DIR', 'Director Family', 10],
  'president family': ['PRES', 'President Family', 11],
  'gm family': ['GM', 'GM Family', 20],
  'manager family': ['MGR', 'Manager Family', 30],
  management: ['MGMT', 'Management', 35],
  'senior grade': ['SR', 'Senior Grade', 40],
  'sr grade': ['SR', 'Senior Grade', 40],
  staff_2: ['STAFF2', 'Staff 2', 45],
  staff_1: ['STAFF1', 'Staff 1', 46],
  staff: ['STAFF1', 'Staff 1', 46],
  'junior grade': ['JR', 'Junior Grade', 50],
  'jounier grade': ['JR', 'Junior Grade', 50],
  general: ['GEN', 'General', 52],
  consultant: ['CONS', 'Consultant', 55],
  probation: ['PROB', 'Probation', 58],
  contractual: ['CONT', 'Contractual', 60],
  trainee: ['TRN', 'Trainee', 62],
  intern: ['INT', 'Intern', 63],
  worker: ['WKR', 'Worker', 70],
  rrel_worker: ['WKR', 'Worker', 70],
}
const UNKNOWN_GRADE: [string, string, number] = ['WKR', 'Worker', 70]

const MARITAL: Record<string, MaritalStatus> = { married: 'MARRIED', single: 'SINGLE', separated: 'SEPARATED', widowed: 'WIDOWED' }

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()
const key = (s: string) => clean(s).toLowerCase()
// a stable number from a text, so the made-up values are the same on every run
const hash = (s: string) => createHash('sha1').update(s).digest().readUInt32BE(0)
const addYears = (d: Date, years: number) => new Date(Date.UTC(d.getUTCFullYear() + years, d.getUTCMonth(), d.getUTCDate()))

type Row = {
  code: string
  firstName: string
  lastName?: string
  dateOfJoining: Date
  email?: string
  mobile?: string
  maritalStatus?: MaritalStatus
  company: string
  costCentre: string
  designation: string
  department: string
  grade: [string, string, number]
}

async function readRows(): Promise<{ rows: Row[]; problems: string[] }> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(filePath!)
  const ws = wb.worksheets[0]!
  const head = (ws.getRow(1).values as unknown[]).slice(1).map((v) => clean(String(v ?? '')))
  const col = (name: string) => {
    const i = head.indexOf(name)
    if (i === -1) throw new Error(`Column "${name}" not found in the first sheet`)
    return i + 1
  }
  const c = {
    code: col('Employee Number'), name: col('Employee Name'), doj: col('Date-Of-Joining'), email: col('Email'), phone: col('Phone'),
    marital: col('Marital Status'), costCentre: col('Curr.Costcenter'), designation: col('Curr.Designation'), company: col('Curr.Company'),
    department: col('Curr.Department'), grade: col('Grade'),
  }
  const rows: Row[] = []
  const problems: string[] = []
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const text = (n: number) => clean(row.getCell(n).text ?? '')
    const code = text(c.code).toUpperCase()
    if (!code) continue
    const dojCell = row.getCell(c.doj).value
    const doj = dojCell instanceof Date ? dojCell : new Date(`${text(c.doj).replace(/"/g, '').slice(0, 10)}T00:00:00Z`)
    if (Number.isNaN(doj.getTime())) {
      problems.push(`${code}: date of joining not readable`)
      continue
    }
    const [first, ...rest] = text(c.name).split(' ')
    const email = emailSchema.safeParse(text(c.email))
    const mobile = mobileSchema.safeParse(text(c.phone).replace(/\D/g, '').slice(-10))
    rows.push({
      code,
      firstName: first || code,
      lastName: rest.join(' ') || undefined,
      dateOfJoining: new Date(Date.UTC(doj.getUTCFullYear(), doj.getUTCMonth(), doj.getUTCDate())),
      email: email.success ? email.data : undefined,
      mobile: mobile.success ? mobile.data : undefined,
      maritalStatus: MARITAL[key(text(c.marital))],
      company: key(text(c.company)),
      costCentre: key(text(c.costCentre)),
      designation: text(c.designation),
      department: text(c.department),
      grade: GRADE[key(text(c.grade))] ?? UNKNOWN_GRADE,
    })
  }
  return { rows, problems }
}

function employmentOf(row: Row, isIndia: boolean) {
  const g = row.grade[0]
  const employmentType: EmploymentType =
    g === 'CONS' ? 'CONSULTANT' : g === 'TRN' || g === 'INT' ? 'TRAINEE' : g === 'CONT' ? 'CONTRACT' : 'PERMANENT'
  const workforceCategory: WorkforceCategory = g === 'WKR' || g === 'TRN' ? 'BLUE_COLLAR' : 'WHITE_COLLAR'
  const joiningType = !isIndia ? 'OVERSEAS' : employmentType === 'CONSULTANT' || employmentType === 'TRAINEE' ? 'CONSULTANT_INTERN' : 'REGULAR'
  return { employmentType, workforceCategory, joiningType } as const
}

// a made-up date of birth: 20 - 40 years before joining, never under 18 today
function birthDateOf(row: Row) {
  const h = hash(`dob:${row.code}`)
  const dob = addYears(row.dateOfJoining, -(20 + (h % 21)))
  dob.setUTCDate(dob.getUTCDate() - (h % 365))
  const latest = addYears(new Date(), -18)
  return dob < latest ? dob : latest
}

async function main() {
  console.log(dryRun ? 'DRY RUN - nothing will be written\n' : '')

  const { rows, problems } = await readRows()
  console.log(`File: ${rows.length} employees`)

  // --- Companies and plants ---
  const companies = new Map((await companiesService.listCompanies(true)).map((co) => [co.code, co]))
  const unknownCompanies = new Set(rows.filter((r) => !COMPANY[r.company] || !companies.has(COMPANY[r.company]!)).map((r) => r.company))
  if (unknownCompanies.size) throw new Error(`Companies not mapped: ${[...unknownCompanies].join(' | ')}`)
  const plantsOf = new Map<number, number[]>()
  for (const plant of await plantsService.listPlants(undefined)) {
    plantsOf.set(plant.company.id, [...(plantsOf.get(plant.company.id) ?? []), plant.id])
  }
  for (const code of new Set(rows.map((r) => COMPANY[r.company]!))) {
    if (!plantsOf.get(companies.get(code)!.id)?.length) throw new Error(`Company ${code} has no active plant`)
  }

  // --- Masters: departments, designations, grades (added when missing) ---
  const departments = new Map((await departmentsService.listDepartments(true)).map((d) => [key(d.name), d.id]))
  const departmentCodes = new Set((await departmentsService.listDepartments(true)).map((d) => d.code.toUpperCase()))
  const designations = new Map((await designationsService.listDesignations(true)).map((d) => [key(d.name), d.id]))
  const grades = new Map((await gradesService.listGrades(true)).map((g) => [g.code, g.id]))
  const added = { departments: 0, designations: 0, grades: 0, plantDepartments: 0 }

  for (const name of new Set(rows.map((r) => r.department))) {
    if (departments.has(key(name))) continue
    added.departments++
    if (dryRun) continue
    let code = name.toUpperCase().replace(/[^A-Z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 40) || 'DEPT'
    while (departmentCodes.has(code)) code = `${code.slice(0, 40)}.${added.departments}`
    departmentCodes.add(code)
    const d = await departmentsService.createDepartment({ code, name: name.slice(0, 100) }, SYSTEM_ACTOR)
    departments.set(key(name), d.id)
  }
  for (const name of new Set(rows.map((r) => r.designation))) {
    if (designations.has(key(name))) continue
    added.designations++
    if (dryRun) continue
    const d = await designationsService.createDesignation({ name: name.slice(0, 100) }, SYSTEM_ACTOR)
    designations.set(key(name), d.id)
  }
  for (const [code, name, rank] of new Map(rows.map((r) => [r.grade[0], r.grade])).values()) {
    if (grades.has(code)) continue
    added.grades++
    if (dryRun) continue
    const g = await gradesService.createGrade({ code, name, rank }, SYSTEM_ACTOR)
    grades.set(code, g.id)
  }

  // --- Placement: the cost centre picks one of the company's plants; the department is added to that plant ---
  const placed = rows.map((row) => {
    const company = companies.get(COMPANY[row.company]!)!
    const plants = plantsOf.get(company.id)!
    const plantId = plants[hash(`${company.code}:${row.costCentre}`) % plants.length]!
    return { row, company, plantId }
  })
  if (!dryRun) {
    const pairs = new Map<number, Set<number>>()
    for (const p of placed) pairs.set(p.plantId, (pairs.get(p.plantId) ?? new Set()).add(departments.get(key(p.row.department))!))
    for (const [plantId, ids] of pairs) added.plantDepartments += await plantsService.addPlantDepartments(plantId, [...ids], SYSTEM_ACTOR)
  }
  console.log(`Masters ${dryRun ? 'to add' : 'added'}: ${added.departments} departments, ${added.designations} designations, ${added.grades} grades, ${added.plantDepartments} plant-departments`)

  // --- Employees, most senior first, so each one's manager already exists ---
  placed.sort((a, b) => a.row.grade[2] - b.row.grade[2] || a.row.dateOfJoining.getTime() - b.row.dateOfJoining.getTime())
  type Made = { id: number; rank: number; companyId: number; plantId: number; departmentKey: string; reports: number }
  const made: Made[] = []
  const usedEmails = new Set<string>()
  let created = 0
  let skipped = 0
  let withoutManager = 0

  // the closest more senior person, narrowest group first (same plant + department, same plant, same company),
  // with fewer than MAX_REPORTS direct reports; null for the most senior of a company
  const managerFor = (companyId: number, plantId: number, departmentKey: string, rank: number, code: string) => {
    const seniors = made.filter((m) => m.companyId === companyId && m.rank < rank)
    for (const group of [
      seniors.filter((m) => m.plantId === plantId && m.departmentKey === departmentKey),
      seniors.filter((m) => m.plantId === plantId),
      seniors,
    ]) {
      const open = group.filter((m) => m.reports < MAX_REPORTS)
      if (!open.length) continue
      const closest = Math.max(...open.map((m) => m.rank))
      const pick = open.filter((m) => m.rank === closest)
      return pick[hash(`mgr:${code}`) % pick.length]!
    }
    return null
  }

  for (const [i, { row, company, plantId }] of placed.entries()) {
    const departmentKey = key(row.department)
    const existing = await employeesService.findSummaryByCode(row.code)
    if (existing) {
      skipped++
      made.push({ id: existing.id, rank: row.grade[2], companyId: company.id, plantId, departmentKey, reports: 0 })
      continue
    }
    const manager = managerFor(company.id, plantId, departmentKey, row.grade[2], row.code)
    if (!manager) withoutManager++
    const personalEmail = row.email && !usedEmails.has(row.email) ? row.email : undefined
    if (personalEmail) usedEmails.add(personalEmail)
    const data: Parameters<typeof employeesService.createEmployee>[0] = {
      employeeCode: row.code,
      ...employmentOf(row, company.isIndiaPayroll),
      dateOfJoining: row.dateOfJoining,
      status: 'ACTIVE',
      companyId: company.id,
      plantId,
      departmentId: departments.get(departmentKey) ?? 0,
      designationId: designations.get(key(row.designation)),
      gradeId: grades.get(row.grade[0]),
      reportingManagerId: manager?.id,
      firstName: row.firstName,
      lastName: row.lastName,
      gender: hash(`g:${row.code}`) % 100 < 85 ? 'MALE' : 'FEMALE',
      dateOfBirth: birthDateOf(row),
      maritalStatus: row.maritalStatus,
      personalEmail,
      mobile: row.mobile,
    }
    if (dryRun) {
      if (manager) manager.reports++
      made.push({ id: -(i + 1), rank: row.grade[2], companyId: company.id, plantId, departmentKey, reports: 0 })
      created++
      continue
    }
    try {
      const employee = await employeesService.createEmployee(data, SYSTEM_ACTOR)
      if (manager) manager.reports++
      made.push({ id: employee.id, rank: row.grade[2], companyId: company.id, plantId, departmentKey, reports: 0 })
      created++
    } catch (err) {
      problems.push(`${row.code}: ${err instanceof ZodError ? err.issues.map((x) => `${x.path.join('.')} ${x.message}`).join('; ') : err instanceof Error ? err.message : String(err)}`)
    }
    if ((created + skipped) % 250 === 0) console.log(`  ... ${created + skipped} of ${placed.length}`)
  }
  console.log(`Employees: ${created} ${dryRun ? 'would be ' : ''}created, ${skipped} already there, ${withoutManager} without a manager (most senior of their company), ${problems.length} failed`)
  for (const p of problems) console.log(`  ! ${p}`)

  // --- --top: each company's most senior people (no manager) report to that employee ---
  if (topCode) {
    const top = await employeesService.findSummaryByCode(topCode)
    if (!top) throw new Error(`No employee with code ${topCode} (--top)`)
    let linked = 0
    for (const { row } of placed) {
      if (row.code === topCode) continue
      const employee = await employeesService.getByCode(row.code).catch(() => null)
      if (!employee || employee.reportingManager) continue
      if (!dryRun) await employeesService.updateEmployee({ employeeCode: row.code, reportingManagerCode: topCode }, SYSTEM_VIEWER)
      linked++
    }
    console.log(`Top: ${linked} ${dryRun ? 'would report' : 'now report'} to ${topCode}`)
  }

  // --- Logins: test@12345 for everyone in the file, not to be changed at sign-in ---
  if (!dryRun) {
    let logins = 0
    for (const { row } of placed) {
      if (!(await employeesService.findSummaryByCode(row.code))) continue
      await accountsService.setPassword(row.code, PASSWORD, undefined, { temporary: false })
      if (++logins % 250 === 0) console.log(`  ... ${logins} logins`)
    }
    console.log(`Logins: ${logins} set to ${PASSWORD}`)
  }
}

try {
  await main()
} finally {
  await prisma.$disconnect()
}
