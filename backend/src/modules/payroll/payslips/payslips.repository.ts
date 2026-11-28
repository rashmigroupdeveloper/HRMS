import { prisma, createdBy, updatedBy, type ActorId, type DbClient } from '#core/db/prisma'

// Database access for payslips (payroll stage 6: Payslip and the run's release columns). A run's rows are reached only
// through a run the service has found with whole-company Payroll scope - or, for the background job, a released run.

// a person with pay worked out has at least one earning line
const workedOut = { lines: { some: { OR: [{ kind: 'EARNING' as const }, { kind: null }] } } }

// What a payslip needs from the run's own copy, for each person (or only those asked for): their code in the run, and the
// stretch at the period's end - its department, plant, work location and the monthly amount of each salary component
// data access: rows of one run the service found with whole-company Payroll scope (or a released run, for the job)
export function listPeople(payrollRunId: number, personIds: number[] | undefined, db: DbClient = prisma) {
  return db.payrollRunEmployee.findMany({
    where: { payrollRunId, ...(personIds && { id: { in: personIds } }) },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      employeeId: true,
      employeeCode: true,
      segments: {
        orderBy: { fromDate: 'desc' },
        take: 1,
        select: {
          department: { select: { name: true } },
          plant: { select: { name: true } },
          workLocation: { select: { name: true } },
          lines: { select: { salaryComponentId: true, monthlyAmount: true } },
        },
      },
    },
  })
}

// What was worked out for these people of the run (or all of them), in the payslip's order
// data access: rows of one run the service found with whole-company Payroll scope (or a released run, for the job)
export async function listLines(payrollRunId: number, personIds: number[] | undefined, db: DbClient = prisma) {
  const rows = await db.payrollRunLine.findMany({
    where: { runEmployee: { payrollRunId, ...(personIds && { id: { in: personIds } }) } },
    orderBy: [{ salaryComponent: { displayOrder: 'asc' } }, { salaryComponent: { name: 'asc' } }],
    select: { payrollRunEmployeeId: true, amount: true, kind: true, salaryComponent: { select: { id: true, name: true } } },
  })
  return rows.map((r) => ({ personId: r.payrollRunEmployeeId, amount: r.amount.toNumber(), component: { ...r.salaryComponent, kind: r.kind } }))
}

// Releases the run's payslips with this template - only a final run not released yet: false when someone released it a
// moment before (or it is not final)
export async function release(payrollRunId: number, templateId: number, actorId: ActorId, db: DbClient = prisma) {
  const { count } = await db.payrollRun.updateMany({
    where: { id: payrollRunId, status: 'FINALISED', payslipsReleasedAt: null },
    data: { payslipTemplateId: templateId, payslipsReleasedAt: new Date(), payslipsReleasedById: actorId, ...updatedBy(actorId) },
  })
  return count > 0
}

// How many of the run's people have pay worked out, and how many of them have their payslip made
// data access: counts of one run the service found with whole-company Payroll scope
export async function countMade(payrollRunId: number, db: DbClient = prisma) {
  const [total, made] = await Promise.all([
    db.payrollRunEmployee.count({ where: { payrollRunId, ...workedOut } }),
    db.payslip.count({ where: { runEmployee: { payrollRunId } } }),
  ])
  return { total, made }
}

// People of released runs whose payslip is not made yet (with pay worked out), oldest release first, at most `limit`
// data access: the background job makes the payslips of every released run, as System
export function listToMake(limit: number, runIds?: number[], db: DbClient = prisma) {
  return db.payrollRunEmployee.findMany({
    where: { payslip: null, run: { payslipsReleasedAt: { not: null } }, ...workedOut, ...(runIds && { payrollRunId: { in: runIds } }) },
    orderBy: [{ run: { payslipsReleasedAt: 'asc' } }, { id: 'asc' }],
    take: limit,
    select: {
      id: true,
      run: { select: { id: true, companyId: true, payMonth: true, attendanceFrom: true, attendanceTo: true, payslipTemplateId: true } },
    },
  })
}

export function create(payrollRunEmployeeId: number, storageKey: string, actorId: ActorId, db: DbClient = prisma) {
  return db.payslip.create({ data: { payrollRunEmployeeId, storageKey, ...createdBy(actorId) }, select: { id: true } })
}

// One person's payslip in a run, once it is made
export function findInRun(payrollRunId: number, payrollRunEmployeeId: number, db: DbClient = prisma) {
  return db.payslip.findFirst({
    where: { payrollRunEmployeeId, runEmployee: { payrollRunId } },
    select: { storageKey: true, runEmployee: { select: { employeeCode: true, run: { select: { payMonth: true } } } } },
  })
}

// Which people of the run have their payslip made (the run page shows a download for them)
// data access: rows of one run the service found with whole-company Payroll scope
export async function listMadeIn(payrollRunId: number, db: DbClient = prisma) {
  const rows = await db.payslip.findMany({ where: { runEmployee: { payrollRunId } }, select: { payrollRunEmployeeId: true } })
  return new Set(rows.map((r) => r.payrollRunEmployeeId))
}

// One's own payslips: every run whose payslips are released and that pays them, newest month first - with the payslip
// once it is made
// data access: one's own record - the logged-in employee's id, never one from the request
export function listOwn(employeeId: number, db: DbClient = prisma) {
  return db.payrollRunEmployee.findMany({
    where: { employeeId, run: { payslipsReleasedAt: { not: null } }, ...workedOut },
    orderBy: [{ run: { payMonth: 'desc' } }, { id: 'desc' }],
    select: {
      id: true,
      employeeCode: true,
      payslip: { select: { id: true, createdAt: true } },
      run: { select: { payMonth: true, attendanceFrom: true, attendanceTo: true, company: { select: { code: true, name: true } } } },
    },
  })
}

// One of one's own payslips (only from a released run)
// data access: one's own record - the logged-in employee's id, never one from the request
export function findOwn(id: number, employeeId: number, db: DbClient = prisma) {
  return db.payslip.findFirst({
    where: { id, runEmployee: { employeeId, run: { payslipsReleasedAt: { not: null } } } },
    select: { storageKey: true, runEmployee: { select: { employeeCode: true, run: { select: { payMonth: true } } } } },
  })
}

// An employee's payslip files (a company transfer moves them to the folder of the new code)
// data access: one employee's files, moved by the job-change step that changes their code
export function listFilesOf(employeeId: number, db: DbClient = prisma) {
  return db.payslip.findMany({
    where: { runEmployee: { employeeId } },
    select: { id: true, storageKey: true, runEmployee: { select: { run: { select: { payMonth: true } } } } },
  })
}

export function updateStorageKey(id: number, storageKey: string, actorId: ActorId, db: DbClient = prisma) {
  return db.payslip.update({ where: { id }, data: { storageKey, ...updatedBy(actorId) }, select: { id: true } })
}
