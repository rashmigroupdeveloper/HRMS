import { prisma, createdBy, updatedBy, type ActorId, type DbClient, type EmploymentType, type WorkforceCategory } from '#core/db/prisma'

// Database access for a pay run's people and their salary copy (payroll stage 2). Every function takes the run's id:
// the service has already found the run with whole-company Payroll scope, so these rows are reached only through it.

export type SegmentRow = {
  fromDate: Date
  toDate: Date
  plantId: number
  departmentId: number
  costCenterId: number | null
  employmentType: EmploymentType
  workforceCategory: WorkforceCategory
  employeeSalaryId: number | null
  annualCtc: number | null
  currency: string | null
  lines: { salaryComponentId: number; monthlyAmount: number }[]
}
export type PersonRow = { employeeId: number; employeeCode: string; segments: SegmentRow[] }

// The people already in the run, with whether inputs were typed for them (a refresh never drops those)
// data access: rows of one run the service found with whole-company Payroll scope
export function listMembers(payrollRunId: number, db: DbClient = prisma) {
  return db.payrollRunEmployee.findMany({
    where: { payrollRunId },
    select: { id: true, employeeId: true, employeeCode: true, _count: { select: { inputs: true } } },
  })
}

// Rewrites the run's copy: removes every segment (and its lines), removes the people who no longer belong and have no
// inputs, updates or adds the others, then writes the new segments and lines. Inside the caller's transaction.
export async function replaceCopy(payrollRunId: number, people: PersonRow[], dropIds: number[], actorId: ActorId, db: DbClient) {
  await db.payrollRunSalarySegment.deleteMany({ where: { runEmployee: { payrollRunId } } })
  if (dropIds.length) await db.payrollRunEmployee.deleteMany({ where: { payrollRunId, id: { in: dropIds } } })
  const existing = new Map((await listMembers(payrollRunId, db)).map((m) => [m.employeeId, m]))
  for (const person of people) {
    const member = existing.get(person.employeeId)
    if (member && member.employeeCode !== person.employeeCode) {
      await db.payrollRunEmployee.update({ where: { id: member.id }, data: { employeeCode: person.employeeCode, ...updatedBy(actorId) }, select: { id: true } })
    }
  }
  const added = people.filter((p) => !existing.has(p.employeeId))
  const created = added.length
    ? await db.payrollRunEmployee.createManyAndReturn({
        data: added.map((p) => ({ payrollRunId, employeeId: p.employeeId, employeeCode: p.employeeCode, ...createdBy(actorId) })),
        select: { id: true, employeeId: true },
      })
    : []
  const memberId = new Map<number, number>([...existing.values()].map((m) => [m.employeeId, m.id]))
  for (const row of created) memberId.set(row.employeeId, row.id)

  const segments = people.flatMap((p) => p.segments.map((s) => ({ person: memberId.get(p.employeeId)!, segment: s })))
  if (!segments.length) return
  const saved = await db.payrollRunSalarySegment.createManyAndReturn({
    data: segments.map(({ person, segment: { lines: _lines, ...s } }) => ({ payrollRunEmployeeId: person, ...s, ...createdBy(actorId) })),
    select: { id: true, payrollRunEmployeeId: true, fromDate: true },
  })
  const segmentId = new Map(saved.map((s) => [`${s.payrollRunEmployeeId}:${s.fromDate.getTime()}`, s.id]))
  const lines = segments.flatMap(({ person, segment }) =>
    segment.lines.map((line) => ({ segmentId: segmentId.get(`${person}:${segment.fromDate.getTime()}`)!, ...line, ...createdBy(actorId) })),
  )
  if (lines.length) await db.payrollRunSalaryLine.createMany({ data: lines })
}

// Every person of the run with their segments, lines (with each component's kind) and how many inputs they have - for
// the list, which filters, searches and pages in the service (a run is one company: a few thousand people at most)
// data access: rows of one run the service found with whole-company Payroll scope
export async function listPeople(payrollRunId: number, db: DbClient = prisma) {
  const rows = await db.payrollRunEmployee.findMany({
    where: { payrollRunId },
    orderBy: { employeeCode: 'asc' },
    select: {
      id: true,
      employeeId: true,
      employeeCode: true,
      _count: { select: { inputs: true } },
      segments: {
        orderBy: { fromDate: 'asc' },
        select: {
          fromDate: true,
          toDate: true,
          employeeSalaryId: true,
          annualCtc: true,
          currency: true,
          lines: { select: { monthlyAmount: true, salaryComponent: { select: { kind: true } } } },
        },
      },
    },
  })
  return rows.map((row) => ({
    ...row,
    segments: row.segments.map((s) => ({ ...s, lines: s.lines.map((l) => ({ kind: l.salaryComponent.kind, monthlyAmount: l.monthlyAmount.toNumber() })) })),
  }))
}

// One person of the run with everything copied for them
export async function findPerson(payrollRunId: number, personId: number, db: DbClient = prisma) {
  const row = await db.payrollRunEmployee.findFirst({
    where: { id: personId, payrollRunId },
    select: {
      id: true,
      employeeId: true,
      employeeCode: true,
      segments: {
        orderBy: { fromDate: 'asc' },
        select: {
          id: true,
          fromDate: true,
          toDate: true,
          employmentType: true,
          workforceCategory: true,
          employeeSalaryId: true,
          annualCtc: true,
          currency: true,
          plant: { select: { id: true, plantCode: true, name: true } },
          department: { select: { id: true, code: true, name: true } },
          costCenter: { select: { id: true, code: true, name: true } },
          employeeSalary: { select: { effectiveFrom: true, reason: true } },
          lines: {
            orderBy: [{ salaryComponent: { displayOrder: 'asc' } }, { salaryComponent: { name: 'asc' } }],
            select: { monthlyAmount: true, salaryComponent: { select: { id: true, name: true, code: true, kind: true } } },
          },
        },
      },
    },
  })
  return row && { ...row, segments: row.segments.map((s) => ({ ...s, lines: s.lines.map((l) => ({ ...l, monthlyAmount: l.monthlyAmount.toNumber() })) })) }
}

// How many people the run has, and how many have days with no salary (for the run's header)
// data access: rows of one run the service found with whole-company Payroll scope
export async function countPeople(payrollRunId: number, db: DbClient = prisma) {
  const [people, withoutSalary] = await Promise.all([
    db.payrollRunEmployee.count({ where: { payrollRunId } }),
    db.payrollRunEmployee.count({ where: { payrollRunId, segments: { some: { annualCtc: null } } } }),
  ])
  return { people, withoutSalary }
}
