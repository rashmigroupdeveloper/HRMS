import { combineScopes, hasLevelAt, scopeOf, SYSTEM_SCOPE, wholeCompanyScopeOf, type DataScope } from '#core/auth/scope'
import type { EmploymentType, Gender, JoiningType, WorkforceCategory } from '#core/db/prisma'
import { reportFile, reportSheet, type ReportField } from '#core/excel/report'
import type { CurrentUser } from '#core/rpc/procedures'
import { companiesService, designationsService, gradesService, plantsService } from '#modules/organization'
import { formatDate, today } from '#shared/utils/dates'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import { EMPLOYMENT_TYPE_LABEL, GENDER_LABEL, JOINING_TYPE_LABEL, WORKFORCE_LABEL, type organisationBoardInput } from '../employees.schema.js'
import * as employeesRepository from '../employees.repository.js'

// Organisation board (the user, 2026-11-28). Counts of people working now (active and on notice), classified by the
// employment type, workforce and joining type stored on the employee, and by grade and designation (the user,
// 2026-11-28). Gender too, only where the active role has Employee · Personal details View as well as Employee
// directory View (seesPart's rule, by place): a row partly outside it shows no gender at all (null), never a partial
// count, and an HOD's relationship alone shows none. Master Control keeps its decided classifications (no gender, grade
// or designation). No salary, and no names.
//
// Company cards when the active role's Employee directory & job View, or its Payroll View, covers at least one whole
// company (a Super Admin covers every company). Opening a company lists its departments. Otherwise department cards:
// the places those rows cover, plus the places the caller heads now. Payroll never stitches partial rows into a company.

const EMPLOYMENT = ['PERMANENT', 'CONTRACT', 'TRAINEE', 'CONSULTANT', 'APPRENTICE'] as const satisfies readonly EmploymentType[]
const WORKFORCE = ['WHITE_COLLAR', 'BLUE_COLLAR'] as const satisfies readonly WorkforceCategory[]
const JOINING = ['REGULAR', 'CONSULTANT_INTERN', 'OVERSEAS'] as const satisfies readonly JoiningType[]
const GENDERS = ['MALE', 'FEMALE', 'TRANSGENDER'] as const satisfies readonly Gender[]
// the key of "not recorded" (no gender / grade / designation on the record)
const NONE = 'NONE'
const NONE_LABEL = 'Not recorded'
type GenderKey = (typeof GENDERS)[number] | typeof NONE

type Counts = {
  headcount: number
  active: number
  onNotice: number
  // joining / leaving dates in the board's period (this month to today), whatever the status now
  joined: number
  left: number
  employmentType: Record<(typeof EMPLOYMENT)[number], number>
  workforceCategory: Record<(typeof WORKFORCE)[number], number>
  joiningType: Record<(typeof JOINING)[number], number>
  // null: not shown here (the role does not see personal details of everyone in this row)
  gender: Record<GenderKey, number> | null
  // by grade / designation id, NONE = not recorded
  grade: Record<string, number>
  designation: Record<string, number>
}

// the extra classifications this board shows, each value with its label (in display order)
export type Breakdown = { key: 'gender' | 'grade' | 'designation'; label: string; values: { key: string; label: string }[] }

export type OrganisationSlice = Counts & {
  companyId: number
  plantId: number | null
  departmentId: number | null
  code: string
  name: string
  place: string | null
}

export type OrganisationBoard = {
  level: 'COMPANY' | 'DEPARTMENT' | 'NONE'
  company: { id: number; code: string; name: string } | null
  slices: OrganisationSlice[]
  totals: Counts
  // the days `joined` / `left` cover: the first of this month to today (India), both included
  period: { from: Date; to: Date }
  breakdowns: Breakdown[]
}

const blank = (withGender: boolean): Counts => ({
  headcount: 0,
  active: 0,
  onNotice: 0,
  joined: 0,
  left: 0,
  employmentType: { PERMANENT: 0, CONTRACT: 0, TRAINEE: 0, CONSULTANT: 0, APPRENTICE: 0 },
  workforceCategory: { WHITE_COLLAR: 0, BLUE_COLLAR: 0 },
  joiningType: { REGULAR: 0, CONSULTANT_INTERN: 0, OVERSEAS: 0 },
  gender: withGender ? { MALE: 0, FEMALE: 0, TRANSGENDER: 0, NONE: 0 } : null,
  grade: {},
  designation: {},
})
const addTo = (record: Record<string, number>, key: string, n: number) => {
  record[key] = (record[key] ?? 0) + n
}

function periodOf(now = new Date()) {
  const to = today(now)
  return { from: new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1)), to }
}
const emptyBoard = (): OrganisationBoard => ({ level: 'NONE', company: null, slices: [], totals: blank(false), period: periodOf(), breakdowns: [] })
const notFound = (id: number) => new ORPCError('NOT_FOUND', { message: `No company found with id ${id}` })
const totalsOf = (slices: OrganisationSlice[], withGender: boolean): Counts => {
  const totals = blank(withGender)
  for (const slice of slices) {
    totals.headcount += slice.headcount
    totals.active += slice.active
    totals.onNotice += slice.onNotice
    totals.joined += slice.joined
    totals.left += slice.left
    for (const key of EMPLOYMENT) totals.employmentType[key] += slice.employmentType[key]
    for (const key of WORKFORCE) totals.workforceCategory[key] += slice.workforceCategory[key]
    for (const key of JOINING) totals.joiningType[key] += slice.joiningType[key]
    if (!slice.gender) totals.gender = null
    else if (totals.gender) for (const key of [...GENDERS, NONE] as const) totals.gender[key] += slice.gender[key]
    for (const [key, n] of Object.entries(slice.grade)) addTo(totals.grade, key, n)
    for (const [key, n] of Object.entries(slice.designation)) addTo(totals.designation, key, n)
  }
  return totals
}

function wholeCompanies(scope: DataScope): 'ALL' | number[] {
  if (scope.slices === 'ALL') return 'ALL'
  return [...new Set(scope.slices.flatMap((slice) => (slice.companyId !== null && slice.plantId === null && slice.departmentId === null ? [slice.companyId] : [])))]
}

function scopeTouches(scope: DataScope, companyId: number) {
  // A slice with no company is not a pass to open every company by id. Whole-group access is already ALL.
  return scope.slices === 'ALL' || scope.slices.some((slice) => slice.companyId === companyId)
}

type Row = Awaited<ReturnType<typeof employeesRepository.countOrganisation>>[number]
function add(bucket: Counts, row: Row, seesGender: (row: Row) => boolean) {
  if (row.status !== 'ACTIVE' && row.status !== 'ON_NOTICE') return
  const n = row._count._all
  bucket.headcount += n
  if (row.status === 'ACTIVE') bucket.active += n
  else bucket.onNotice += n
  bucket.employmentType[row.employmentType] += n
  bucket.workforceCategory[row.workforceCategory] += n
  bucket.joiningType[row.joiningType] += n
  if (!seesGender(row)) bucket.gender = null
  else if (bucket.gender) bucket.gender[row.gender ?? NONE] += n
  addTo(bucket.grade, row.gradeId === null ? NONE : String(row.gradeId), n)
  addTo(bucket.designation, row.designationId === null ? NONE : String(row.designationId), n)
}

type Link = Awaited<ReturnType<typeof plantsService.listAllPlantDepartments>>[number]
type JobLists = { grades: { id: number; code: string; name: string }[]; designations: { id: number; name: string }[] }

// Gender's values always (zeros too); grades by seniority and designations biggest first, only those someone holds, then
// "not recorded" when someone has none
function breakdownsOf(totals: Counts, withGender: boolean, job: JobLists | null): Breakdown[] {
  const list: Breakdown[] = []
  if (withGender) {
    list.push({ key: 'gender', label: 'Gender', values: [...GENDERS.map((key) => ({ key, label: GENDER_LABEL[key] })), { key: NONE, label: NONE_LABEL }] })
  }
  if (!job) return list
  const held = (record: Record<string, number>, key: string) => (record[key] ?? 0) > 0
  const none = (record: Record<string, number>) => (held(record, NONE) ? [{ key: NONE, label: NONE_LABEL }] : [])
  const grades = job.grades.filter((g) => held(totals.grade, String(g.id))).map((g) => ({ key: String(g.id), label: `${g.code} · ${g.name}` }))
  const designations = job.designations
    .filter((d) => held(totals.designation, String(d.id)))
    .sort((a, b) => totals.designation[String(b.id)]! - totals.designation[String(a.id)]! || a.name.localeCompare(b.name))
    .map((d) => ({ key: String(d.id), label: d.name }))
  list.push({ key: 'grade', label: 'Grade', values: [...grades, ...none(totals.grade)] })
  list.push({ key: 'designation', label: 'Designation', values: [...designations, ...none(totals.designation)] })
  return list
}

// `onlyCompanyIds` null lists every company (active, or inactive with someone still working). Department cards keep a
// headed post even when nobody else works there.
async function present(args: {
  scope: DataScope
  companyId?: number
  postIds?: number[]
  exceptId?: number
  level: 'COMPANY' | 'DEPARTMENT'
  company: { id: number; code: string; name: string } | null
  onlyCompanyIds: 'ALL' | number[] | null
  keepPostIds?: number[]
  // whose gender the board may count (by the row's place); undefined = no gender at all
  seesGender?: (place: { companyId: number; plantId: number; departmentId: number | null }) => boolean
  // grade and designation breakdowns (not on Master Control)
  jobDetails: boolean
}): Promise<OrganisationBoard> {
  const period = periodOf()
  const withGender = args.seesGender !== undefined
  const seesGender = (row: Row) => !!args.seesGender && row.plantId !== null && args.seesGender({ companyId: row.companyId, plantId: row.plantId, departmentId: row.departmentId })
  const fresh = () => blank(withGender)
  const filter = { scope: args.scope, companyId: args.companyId, postIds: args.postIds, exceptId: args.exceptId }
  const [rows, movements, companies, links, grades, designations] = await Promise.all([
    employeesRepository.countOrganisation(filter),
    employeesRepository.countOrganisationMovements({ ...filter, ...period }),
    companiesService.listCompanies(true),
    plantsService.listAllPlantDepartments(),
    args.jobDetails ? gradesService.listGrades(true) : [],
    args.jobDetails ? designationsService.listDesignations(true) : [],
  ])
  const finish = (slices: OrganisationSlice[]) => {
    const totals = totalsOf(slices, withGender)
    if (!args.jobDetails) for (const slice of [...slices, totals]) Object.assign(slice, { grade: {}, designation: {} })
    return { totals, breakdowns: breakdownsOf(totals, withGender, args.jobDetails ? { grades, designations } : null) }
  }
  // joiners and leavers into the buckets, by the same key as the headcount
  type Moved = (typeof movements.joined)[number]
  const addMovements = <K>(buckets: Map<K, Counts>, keyOf: (row: Moved) => K, allowed?: (row: Moved) => boolean) => {
    for (const [field, list] of [['joined', movements.joined], ['left', movements.left]] as const) {
      for (const row of list) {
        if (allowed && !allowed(row)) continue
        const bucket = buckets.get(keyOf(row)) ?? fresh()
        bucket[field] += row._count._all
        buckets.set(keyOf(row), bucket)
      }
    }
  }
  const moved = (counts: Counts | undefined) => !!counts && (counts.headcount > 0 || counts.joined > 0 || counts.left > 0)
  const linkById = new Map(links.map((link) => [link.id, link]))
  const linkByPlace = new Map(links.map((link) => [`${link.plant.id}:${link.department.id}`, link]))
  if (args.level === 'COMPANY') {
    const allowed = args.onlyCompanyIds === 'ALL' || args.onlyCompanyIds === null ? null : new Set(args.onlyCompanyIds)
    const byCompany = new Map<number, Counts>()
    for (const row of rows) {
      if (allowed && !allowed.has(row.companyId)) continue
      const bucket = byCompany.get(row.companyId) ?? fresh()
      add(bucket, row, seesGender)
      byCompany.set(row.companyId, bucket)
    }
    addMovements(byCompany, (row) => row.companyId, (row) => !allowed || allowed.has(row.companyId))
    const shown = companies.filter((company) => (allowed ? allowed.has(company.id) : company.isActive || moved(byCompany.get(company.id))))
    const slices = shown
      .map((company): OrganisationSlice => ({
        companyId: company.id,
        plantId: null,
        departmentId: null,
        code: company.code,
        name: company.name,
        place: null,
        ...(byCompany.get(company.id) ?? fresh()),
      }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code))
    return { level: 'COMPANY', company: null, slices, period, ...finish(slices) }
  }
  const byPlace = new Map<string, Counts>()
  for (const row of rows) {
    const key = `${row.plantId}:${row.departmentId}`
    const bucket = byPlace.get(key) ?? fresh()
    add(bucket, row, seesGender)
    byPlace.set(key, bucket)
  }
  addMovements(byPlace, (row) => `${row.plantId}:${row.departmentId}`)
  const showCompany = args.company === null
  const sliceOf = (link: Link, counts: Counts): OrganisationSlice => ({
    companyId: link.plant.company.id,
    plantId: link.plant.id,
    departmentId: link.department.id,
    code: link.department.code,
    name: link.department.name,
    place: showCompany ? `${link.plant.company.code} · ${link.plant.plantCode} ${link.plant.name}` : `${link.plant.plantCode} ${link.plant.name}`,
    ...counts,
  })
  const slices: OrganisationSlice[] = []
  const seen = new Set<string>()
  for (const [key, counts] of byPlace) {
    if (!moved(counts)) continue
    const link = linkByPlace.get(key)
    if (!link) continue
    if (args.company && link.plant.company.id !== args.company.id) continue
    slices.push(sliceOf(link, counts))
    seen.add(key)
  }
  for (const postId of args.keepPostIds ?? []) {
    const link = linkById.get(postId)
    if (!link || (args.company && link.plant.company.id !== args.company.id)) continue
    const key = `${link.plant.id}:${link.department.id}`
    if (seen.has(key)) continue
    slices.push(sliceOf(link, fresh()))
    seen.add(key)
  }
  slices.sort((a, b) => (a.place ?? '').localeCompare(b.place ?? '') || a.name.localeCompare(b.name))
  return { level: 'DEPARTMENT', company: args.company, slices, period, ...finish(slices) }
}

// The caller's board. `postIds` are the posts they head now (worked out by the employees service).
export async function boardForViewer(viewer: CurrentUser, input: z.infer<typeof organisationBoardInput>, postIds: number[]): Promise<OrganisationBoard> {
  const people = scopeOf(viewer, 'EMPLOYEES', 'READ')
  const payroll = wholeCompanyScopeOf(viewer, 'PAYROLL', 'READ')
  const scope = combineScopes([people, payroll])
  const whole = wholeCompanies(scope)
  const personal = scopeOf(viewer, 'EMPLOYEE_PERSONAL_DETAILS', 'READ')
  const seesGender = personal.slices === 'ALL' || personal.slices.length > 0
    ? (place: Parameters<typeof hasLevelAt>[2]) => hasLevelAt(viewer, 'EMPLOYEES', place, 'READ') && hasLevelAt(viewer, 'EMPLOYEE_PERSONAL_DETAILS', place, 'READ')
    : undefined
  const shows = { seesGender, jobDetails: true }
  const covers = (companyId: number) => whole === 'ALL' || whole.includes(companyId)
  if (input.companyId !== undefined) {
    const id = input.companyId
    const viaPeople = scopeTouches(people, id)
    const postsHere = await postsOfCompany(postIds, id)
    if (!covers(id) && !viaPeople && postsHere.length === 0) throw notFound(id)
    const company = await companiesService.getCompany(id)
    const broad = covers(id)
    return present({
      scope: broad ? scope : viaPeople ? people : combineScopes([]),
      companyId: id,
      postIds: broad ? undefined : postsHere,
      exceptId: broad || viaPeople ? undefined : viewer.employeeId,
      level: 'DEPARTMENT',
      company: { id: company.id, code: company.code, name: company.name },
      onlyCompanyIds: null,
      keepPostIds: broad ? undefined : postsHere,
      ...shows,
    })
  }
  if (whole === 'ALL' || whole.length > 0) {
    return present({ scope, level: 'COMPANY', company: null, onlyCompanyIds: whole, ...shows })
  }
  const peopleHas = people.slices !== 'ALL' && people.slices.length > 0
  if (!peopleHas && postIds.length === 0) return emptyBoard()
  return present({
    scope: peopleHas ? people : combineScopes([]),
    postIds: people.slices === 'ALL' ? undefined : postIds,
    exceptId: peopleHas ? undefined : viewer.employeeId,
    level: 'DEPARTMENT',
    company: null,
    onlyCompanyIds: null,
    keepPostIds: postIds,
    ...shows,
  })
}

// Every company, counts only. The caller is master-controls, after assertMasterControl — never an employees route.
export async function installationOrganisationBoard(input: z.infer<typeof organisationBoardInput>): Promise<OrganisationBoard> {
  if (input.companyId !== undefined) {
    const company = await companiesService.getCompany(input.companyId)
    return present({
      scope: SYSTEM_SCOPE,
      companyId: company.id,
      level: 'DEPARTMENT',
      company: { id: company.id, code: company.code, name: company.name },
      onlyCompanyIds: null,
      jobDetails: false,
    })
  }
  return present({ scope: SYSTEM_SCOPE, level: 'COMPANY', company: null, onlyCompanyIds: 'ALL', jobDetails: false })
}

// The board as Excel: one row per company or department, each classification value a column, the total last. Counts only.
export function boardFile(board: OrganisationBoard, details: { preparedBy: string; coverage: string }) {
  const companies = board.level === 'COMPANY'
  type Line = Counts & { code: string; name: string; place: string | null }
  const lines: Line[] = [...board.slices, { ...board.totals, code: '', name: 'Total', place: null }]
  const fields: ReportField<Line>[] = [
    { header: companies ? 'Company code' : 'Department code', value: (r) => r.code, text: true },
    { header: companies ? 'Company' : 'Department', value: (r) => r.name, width: 32 },
    ...(companies ? [] : [{ header: 'Plant', value: (r: Line) => r.place, width: 32 }]),
    { header: 'Working now', value: (r) => r.headcount },
    { header: 'Active', value: (r) => r.active },
    { header: 'On notice', value: (r) => r.onNotice },
    { header: `Joined ${formatDate(board.period.from)} to ${formatDate(board.period.to)}`, value: (r) => r.joined },
    { header: `Left ${formatDate(board.period.from)} to ${formatDate(board.period.to)}`, value: (r) => r.left },
    ...EMPLOYMENT.map((key) => ({ header: `Employment - ${EMPLOYMENT_TYPE_LABEL[key]}`, value: (r: Line) => r.employmentType[key] })),
    ...WORKFORCE.map((key) => ({ header: `Workforce - ${WORKFORCE_LABEL[key]}`, value: (r: Line) => r.workforceCategory[key] })),
    ...JOINING.map((key) => ({ header: `Joining - ${JOINING_TYPE_LABEL[key]}`, value: (r: Line) => r.joiningType[key] })),
    // gender: "not shown" where the role does not see personal details of everyone in the row
    ...board.breakdowns.flatMap((group) =>
      group.values.map((v) => ({
        header: `${group.label} - ${v.label}`,
        value: (r: Line) => (group.key === 'gender' ? (r.gender ? r.gender[v.key as GenderKey] : 'not shown') : (r[group.key][v.key] ?? 0)),
      })),
    ),
  ]
  const code = board.company?.code.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return reportFile(
    [reportSheet(companies ? 'Companies' : 'Departments', lines, fields)],
    { title: board.company ? `${board.company.name} - headcount by department` : 'Organisation headcount', ...details },
    code ? `organisation-${code}` : 'organisation',
  )
}

async function postsOfCompany(postIds: number[], companyId: number) {
  if (!postIds.length) return []
  const links = await plantsService.listAllPlantDepartments()
  const wanted = new Set(postIds)
  return links.filter((link) => wanted.has(link.id) && link.plant.company.id === companyId).map((link) => link.id)
}
