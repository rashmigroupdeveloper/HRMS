import { prisma, createdBy, updatedBy, type ActorId, type DbClient, type PayWarning } from '#core/db/prisma'

// Database access for a pay run's checks (payroll stage 5): the acknowledgements, and the few figures the warnings need
// that the other parts of payroll do not read. Every function takes a run (or a person of one) the service has found with
// whole-company Payroll scope.

// Every acknowledgement of the run
// data access: rows of one run the service found with whole-company Payroll scope
export function listAcks(payrollRunId: number, db: DbClient = prisma) {
  return db.payrollRunAcknowledgement.findMany({
    where: { runEmployee: { payrollRunId } },
    orderBy: { id: 'asc' },
    select: { id: true, payrollRunEmployeeId: true, warning: true, comment: true, createdAt: true, createdById: true, updatedAt: true, updatedById: true },
  })
}

// Acknowledges these warnings with one comment (a warning acknowledged before takes the new comment), inside the caller's
// transaction
export async function saveAcks(items: { payrollRunEmployeeId: number; warning: PayWarning }[], comment: string, actorId: ActorId, db: DbClient) {
  for (const item of items) {
    await db.payrollRunAcknowledgement.upsert({
      where: { payrollRunEmployeeId_warning: item },
      create: { ...item, comment, ...createdBy(actorId) },
      update: { comment, ...updatedBy(actorId) },
      select: { id: true },
    })
  }
}

// Removes the acknowledgements of these people of a run - their inputs changed, or a refresh drops them (through Prisma,
// so each removal stays in the change history)
export function deleteAcksOf(payrollRunEmployeeIds: number[], db: DbClient) {
  if (!payrollRunEmployeeIds.length) return Promise.resolve({ count: 0 })
  return db.payrollRunAcknowledgement.deleteMany({ where: { payrollRunEmployeeId: { in: payrollRunEmployeeIds } } })
}

// Each person's earned PF wages in the run: the earning lines of components marked "PF wages"
// data access: rows of one run the service found with whole-company Payroll scope
export async function pfWagesByPerson(payrollRunId: number, db: DbClient = prisma) {
  const groups = await db.payrollRunLine.groupBy({
    by: ['payrollRunEmployeeId'],
    where: { runEmployee: { payrollRunId }, salaryComponent: { kind: 'EARNING', pfWage: true } },
    _sum: { amount: true },
  })
  return new Map(groups.map((g) => [g.payrollRunEmployeeId, g._sum.amount?.toNumber() ?? 0]))
}

// The run of the month before for the same company, if there is one (the BIG_CHANGE warning)
// data access: the same company's run - the viewer has whole-company Payroll scope over it
export function findPreviousRun(companyId: number, payMonth: Date, db: DbClient = prisma) {
  return db.payrollRun.findUnique({ where: { companyId_payMonth: { companyId, payMonth } }, select: { id: true } })
}

// The people of a run by their employee (the previous run's figures by employee)
// data access: rows of one run of a company the viewer has whole-company Payroll scope over
export function listMembers(payrollRunId: number, db: DbClient = prisma) {
  return db.payrollRunEmployee.findMany({ where: { payrollRunId }, select: { id: true, employeeId: true, heldFor: true } })
}

