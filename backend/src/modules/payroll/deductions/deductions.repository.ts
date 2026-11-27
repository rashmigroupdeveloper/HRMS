import { prisma, type DbClient } from '#core/db/prisma'

// Database access for the deductions (payroll stage 4): what earlier pay runs of the tax year gave the same people -
// their taxable earnings and income tax - for the month's TDS.

// Every line of the people's earlier runs of the tax year (pay months from..before `beforePayMonth`, any company of the
// group: a transfer keeps one year's tax), other than this run, with what the TDS needs of each component
// data access: the people of one pay run (found with whole-company Payroll scope); their own earlier pay in the tax year
// is needed for their income tax whichever company paid it
export async function listEarlierTaxLines(employeeIds: number[], taxYearFrom: Date, beforePayMonth: Date, exceptRunId: number, db: DbClient = prisma) {
  const rows = await db.payrollRunLine.findMany({
    where: { runEmployee: { employeeId: { in: employeeIds }, run: { id: { not: exceptRunId }, payMonth: { gte: taxYearFrom, lt: beforePayMonth } } } },
    select: {
      amount: true,
      salaryComponent: { select: { kind: true, taxable: true, statutoryRole: true } },
      runEmployee: { select: { employeeId: true, run: { select: { payMonth: true } } } },
    },
  })
  return rows.map((r) => ({
    employeeId: r.runEmployee.employeeId,
    payMonth: r.runEmployee.run.payMonth,
    amount: r.amount.toNumber(),
    kind: r.salaryComponent.kind,
    taxable: r.salaryComponent.taxable,
    statutoryRole: r.salaryComponent.statutoryRole,
  }))
}
