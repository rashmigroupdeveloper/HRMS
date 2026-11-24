import { type DataScope, scopeWhere } from '#core/auth/scope'
import { createdBy, linesAsNumbers, prisma, updatedBy, type ActorId, type CandidateStatus, type DbClient, type NewRow, type Prisma } from '#core/db/prisma'

// Database access for candidates - the only file that queries the candidates table.

const candidateSelect = {
  id: true,
  // person
  salutation: true,
  firstName: true,
  middleName: true,
  lastName: true,
  mobile: true,
  personalEmail: true,
  address: true,
  // offer terms
  company: { select: { id: true, code: true, name: true } },
  plant: { select: { id: true, plantCode: true, name: true } },
  workLocation: { select: { id: true, name: true, countryCode: true } },
  department: { select: { id: true, name: true } },
  designation: { select: { id: true, name: true } },
  grade: { select: { id: true, name: true } },
  joiningType: true,
  employmentType: true,
  workforceCategory: true,
  annualCtc: true,
  performancePayAnnual: true,
  ctcCurrency: true,
  proposedJoiningDate: true,
  contractEndDate: true,
  offerValidUntil: true,
  probationMonths: true,
  noticeMonthsProbation: true,
  noticeMonthsConfirmed: true,
  offerNumber: true,
  // the Letter of Intent sent before the full offer (2026-11-16)
  loiNumber: true,
  loiAcceptedAt: true,
  // progress
  status: true,
  offerSentAt: true,
  acceptedAt: true,
  closedAt: true,
  closeReason: true,
  joiningConfirmedAt: true,
  // the joining form: opens at acceptance or when HR sends its link (2026-11-20); submitted (signed online) by the
  // candidate / sent back by HR
  joiningFormOnAcceptance: true,
  joiningFormOpenedAt: true,
  // the documents this offer asks for on top of the pack's (2026-11-20)
  extraRequiredDocuments: true,
  joiningFormSubmittedAt: true,
  joiningFormReturnedAt: true,
  // the employee created on the joining day (JOINED)
  employeeId: true,
  employee: { select: { employeeCode: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CandidateSelect

// One candidate: also the medical result (health data - not shown in lists) and who did each step.
const candidateDetailSelect = {
  ...candidateSelect,
  createdById: true,
  updatedById: true,
  offerSentById: true,
  acceptedById: true,
  loiAcceptedById: true,
  closedById: true,
  joiningConfirmedById: true,
  joiningFormOpenedById: true,
  // the candidate's online signature of the joining form, and HR's reason for sending it back
  joiningFormSubmittedById: true,
  joiningFormSignedName: true,
  joiningFormDeclaration: true,
  joiningFormSignIp: true,
  joiningFormSignUserAgent: true,
  joiningFormReturnedById: true,
  joiningFormReturnReason: true,
  medicalResult: true,
  medicalExamDate: true,
  medicalExaminer: true,
  medicalRestrictions: true,
  // the salary breakup, in the order of the salary components
  salaryLines: {
    select: { monthlyAmount: true, salaryComponent: { select: { id: true, name: true, kind: true } } },
    orderBy: [{ salaryComponent: { displayOrder: 'asc' } }, { salaryComponent: { name: 'asc' } }],
  },
} satisfies Prisma.CandidateSelect


// `scope`: whose candidates may be listed (data access - required, so no list can leave it out)
export function list(
  filter: { scope: DataScope; status?: CandidateStatus | undefined; companyId?: number | undefined },
  db: DbClient = prisma,
) {
  return db.candidate.findMany({
    where: {
      AND: [scopeWhere(filter.scope)],
      ...(filter.status !== undefined && { status: filter.status }),
      ...(filter.companyId !== undefined && { companyId: filter.companyId }),
    },
    orderBy: { createdAt: 'desc' },
    select: candidateSelect,
  })
}

// The salary breakup's amounts as numbers (2 decimals - 2026-11-24)
type DetailRecord = Prisma.CandidateGetPayload<{ select: typeof candidateDetailSelect }>
const withAmounts = (row: DetailRecord) => ({ ...row, salaryLines: linesAsNumbers(row.salaryLines) })
const maybeWithAmounts = (row: DetailRecord | null) => (row ? withAmounts(row) : null)

// The candidate with this id, or null.
export async function findById(id: number, db: DbClient = prisma) {
  return maybeWithAmounts(await db.candidate.findUnique({ where: { id }, select: candidateDetailSelect }))
}

export async function create(data: NewRow<Prisma.CandidateUncheckedCreateInput>, actorId: ActorId, db: DbClient = prisma) {
  return withAmounts(await db.candidate.create({ data: { ...data, ...createdBy(actorId) }, select: candidateDetailSelect }))
}

export async function update(id: number, data: Prisma.CandidateUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return withAmounts(await db.candidate.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: candidateDetailSelect }))
}

// Changes the candidate only while they are still in `status` (the one read before) - false when someone changed it a
// moment before (2026-11-23, the review: a candidate's accept and HR's withdraw at the same moment - the last write won)
export async function updateIfStatus(
  id: number,
  status: CandidateStatus | readonly CandidateStatus[],
  data: Prisma.CandidateUncheckedUpdateManyInput,
  actorId: ActorId,
  db: DbClient = prisma,
) {
  const result = await db.candidate.updateMany({
    where: { id, status: typeof status === 'string' ? status : { in: [...status] } },
    data: { ...data, ...updatedBy(actorId) },
  })
  return result.count === 1
}

// Replaces the offer's salary breakup with `lines`
export async function replaceSalaryLines(
  candidateId: number,
  lines: { salaryComponentId: number; monthlyAmount: number }[],
  actorId: ActorId,
  db: DbClient = prisma,
) {
  await db.candidateSalaryLine.deleteMany({ where: { candidateId } })
  if (lines.length) {
    await db.candidateSalaryLine.createMany({ data: lines.map((line) => ({ ...line, candidateId, ...createdBy(actorId) })) })
  }
}

// Offers sent whose "valid until" date has passed without an answer (the worker marks them expired)
// data access: a background job (offers past their date become EXPIRED) - every company, no logged-in person
export function listUnansweredExpired(today: Date, db: DbClient = prisma) {
  return db.candidate.findMany({ where: { status: 'OFFERED', offerValidUntil: { lt: today } }, select: { id: true } })
}

// Accepted candidates joining between these days whose joining is not confirmed yet
// data access: a background job - each HR person is e-mailed only about the candidates inside their data access (accountsService.mailRecipientsFor)
export function listUnconfirmedJoining(from: Date, to: Date, db: DbClient = prisma) {
  return db.candidate.findMany({
    where: { status: 'ACCEPTED', joiningConfirmedAt: null, proposedJoiningDate: { gte: from, lte: to } },
    orderBy: { proposedJoiningDate: 'asc' },
    // (where they are: each reminder goes only to HR whose data access covers them)
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      proposedJoiningDate: true,
      company: { select: { id: true, code: true } },
      plant: { select: { id: true } },
      department: { select: { id: true } },
    },
  })
}

// Every joining-form session of the candidate (candidates.portal) - ended when HR sends a new link (2026-11-23). Here, not in
// portal.repository: the offer letters (which send the link) cannot depend on the portal, which depends on them.
export function deletePortalSessions(candidateId: number, db: DbClient = prisma) {
  return db.candidateSession.deleteMany({ where: { candidateId } })
}
