import { prisma, type DbClient } from '#core/db/prisma'

// Database access for a run's salary register (payroll stage 6). Rows of one run the service has found with
// whole-company Payroll scope.

// Every person of the run in code order: their code in the run, why their pay is held (if it is), and the placement of the
// stretch at the period's end
// data access: rows of one run the service found with whole-company Payroll scope
export function listPeople(payrollRunId: number, db: DbClient = prisma) {
  return db.payrollRunEmployee.findMany({
    where: { payrollRunId },
    orderBy: { employeeCode: 'asc' },
    select: {
      id: true,
      employeeId: true,
      employeeCode: true,
      heldFor: true,
      segments: {
        orderBy: { fromDate: 'desc' },
        take: 1,
        select: {
          department: { select: { name: true } },
          plant: { select: { name: true } },
          costCenter: { select: { code: true } },
          workLocation: { select: { name: true } },
        },
      },
    },
  })
}
