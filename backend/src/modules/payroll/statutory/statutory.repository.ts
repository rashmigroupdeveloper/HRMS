import { prisma, createdBy, updatedBy, type ActorId, type DbClient, type Gender, type StatutoryParameter, type StatutoryScheme, type TaxRegime } from '#core/db/prisma'

// Database access for the statutory settings (payroll stage 4): one list for the whole group - not people's records.

const audit = { createdAt: true, createdById: true, updatedAt: true, updatedById: true } as const
const num = (d: { toNumber(): number }) => d.toNumber()

// --- The payroll settings row (stage 5): one row, id 1 ---

export function findPayrollSetting(db: DbClient = prisma) {
  return db.payrollSetting.findUnique({
    where: { id: 1 },
    select: { tdsCountsDraftRuns: true, bigChangePercent: true, epsAgeSoonMonths: true, paymentDueDays: true, depositReminderDays: true, updatedAt: true, updatedById: true },
  })
}

export function savePayrollSetting(
  data: { tdsCountsDraftRuns: boolean; bigChangePercent: number; epsAgeSoonMonths: number; paymentDueDays: number; depositReminderDays: number },
  actorId: ActorId,
  db: DbClient = prisma,
) {
  return db.payrollSetting.upsert({ where: { id: 1 }, create: { id: 1, ...data, ...createdBy(actorId) }, update: { ...data, ...updatedBy(actorId) }, select: { id: true } })
}

// --- Rates ---

export async function listRates(db: DbClient = prisma) {
  const rows = await db.statutoryRate.findMany({ orderBy: [{ parameter: 'asc' }, { effectiveFrom: 'desc' }], select: { id: true, parameter: true, effectiveFrom: true, value: true, reference: true, ...audit } })
  return rows.map((r) => ({ ...r, value: num(r.value) }))
}

export function createRate(data: { parameter: StatutoryParameter; effectiveFrom: Date; value: number; reference: string }, actorId: ActorId, db: DbClient = prisma) {
  return db.statutoryRate.create({ data: { ...data, ...createdBy(actorId) }, select: { id: true } })
}

export function updateRate(id: number, data: { parameter: StatutoryParameter; effectiveFrom: Date; value: number; reference: string }, actorId: ActorId, db: DbClient = prisma) {
  return db.statutoryRate.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: { id: true } })
}

export function deleteRate(id: number, db: DbClient = prisma) {
  return db.statutoryRate.delete({ where: { id }, select: { id: true } })
}

// --- Professional tax slabs ---

export type PtSlabRow = { gender: Gender | null; wagesFrom: number; wagesTo: number | null; amount: number; specialMonth: number | null; specialAmount: number | null }

export function listPtSlabs(db: DbClient = prisma) {
  return db.professionalTaxSlab.findMany({
    orderBy: [{ stateCode: 'asc' }, { effectiveFrom: 'desc' }, { gender: 'asc' }, { wagesFrom: 'asc' }],
    select: { id: true, stateCode: true, effectiveFrom: true, gender: true, wagesFrom: true, wagesTo: true, amount: true, specialMonth: true, specialAmount: true, reference: true, ...audit },
  })
}

export function deletePtSet(stateCode: string, effectiveFrom: Date, db: DbClient) {
  return db.professionalTaxSlab.deleteMany({ where: { stateCode, effectiveFrom } })
}

export function createPtSet(stateCode: string, effectiveFrom: Date, reference: string, slabs: PtSlabRow[], actorId: ActorId, db: DbClient) {
  return db.professionalTaxSlab.createMany({ data: slabs.map((s) => ({ ...s, stateCode, effectiveFrom, reference, ...createdBy(actorId) })) })
}

// --- Labour welfare fund ---

export async function listLwf(db: DbClient = prisma) {
  const rows = await db.labourWelfareRate.findMany({
    orderBy: [{ stateCode: 'asc' }, { effectiveFrom: 'desc' }],
    select: { id: true, stateCode: true, effectiveFrom: true, employeeAmount: true, employerAmount: true, months: true, reference: true, ...audit },
  })
  return rows.map((r) => ({ ...r, employeeAmount: num(r.employeeAmount), employerAmount: num(r.employerAmount) }))
}

type LwfData = { stateCode: string; effectiveFrom: Date; employeeAmount: number; employerAmount: number; months: number[]; reference: string }

export function createLwf(data: LwfData, actorId: ActorId, db: DbClient = prisma) {
  return db.labourWelfareRate.create({ data: { ...data, ...createdBy(actorId) }, select: { id: true } })
}

export function updateLwf(id: number, data: LwfData, actorId: ActorId, db: DbClient = prisma) {
  return db.labourWelfareRate.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: { id: true } })
}

export function deleteLwf(id: number, db: DbClient = prisma) {
  return db.labourWelfareRate.delete({ where: { id }, select: { id: true } })
}

// --- Due dates of the statutory deposits (stage 6 slice 3) ---

export function listDueDates(db: DbClient = prisma) {
  return db.statutoryDueDate.findMany({
    orderBy: [{ scheme: 'asc' }, { stateCode: 'asc' }, { effectiveFrom: 'desc' }],
    select: { id: true, scheme: true, stateCode: true, effectiveFrom: true, day: true, reference: true, ...audit },
  })
}

type DueDateData = { scheme: StatutoryScheme; stateCode: string | null; effectiveFrom: Date; day: number; reference: string }

export function createDueDate(data: DueDateData, actorId: ActorId, db: DbClient = prisma) {
  return db.statutoryDueDate.create({ data: { ...data, ...createdBy(actorId) }, select: { id: true } })
}

export function updateDueDate(id: number, data: DueDateData, actorId: ActorId, db: DbClient = prisma) {
  return db.statutoryDueDate.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: { id: true } })
}

export function deleteDueDate(id: number, db: DbClient = prisma) {
  return db.statutoryDueDate.delete({ where: { id }, select: { id: true } })
}

// --- Income-tax slabs ---

export type TaxSlabRow = { incomeFrom: number; incomeTo: number | null; ratePercent: number }

export async function listTaxSlabs(db: DbClient = prisma) {
  const rows = await db.incomeTaxSlab.findMany({
    orderBy: [{ taxYearFrom: 'desc' }, { regime: 'asc' }, { incomeFrom: 'asc' }],
    select: { id: true, regime: true, taxYearFrom: true, incomeFrom: true, incomeTo: true, ratePercent: true, reference: true, ...audit },
  })
  return rows.map((r) => ({ ...r, ratePercent: num(r.ratePercent) }))
}

export function deleteTaxSet(regime: TaxRegime, taxYearFrom: Date, db: DbClient) {
  return db.incomeTaxSlab.deleteMany({ where: { regime, taxYearFrom } })
}

export function createTaxSet(regime: TaxRegime, taxYearFrom: Date, reference: string, slabs: TaxSlabRow[], actorId: ActorId, db: DbClient) {
  return db.incomeTaxSlab.createMany({ data: slabs.map((s) => ({ ...s, regime, taxYearFrom, reference, ...createdBy(actorId) })) })
}
