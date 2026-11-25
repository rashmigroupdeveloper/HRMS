import { prisma, type DbClient, type Prisma } from '#core/db/prisma'
import { scopeWhere, type DataScope } from '#core/auth/scope'
import type { z } from 'zod'
import type { movementFilter } from './movements.schema.js'

export type MovementQuery = { scope: DataScope; filter: z.infer<typeof movementFilter> }
// A bounded snapshot of employee dates, never a reconstruction of exit workflows or historical placements.
export function listRecorded({ scope, filter: f }: MovementQuery, db: DbClient = prisma) {
  const between = { gte: f.from, lte: f.to }
  const events: Prisma.EmployeeWhereInput[] = []
  if (f.kind !== 'LEAVER') events.push({ dateOfJoining: between })
  if (f.kind !== 'JOINER') events.push({ dateOfLeaving: between })
  return db.employee.findMany({
    where: { AND: [scopeWhere(scope), { OR: events },
      ...(f.companyIds?.length ? [{ companyId: { in: f.companyIds } }] : []),
      ...(f.plantIds?.length ? [{ plantId: { in: f.plantIds } }] : []),
      ...(f.departmentIds?.length ? [{ departmentId: { in: f.departmentIds } }] : []),
      ...(f.search ? f.search.split(/\s+/).map(term => ({ OR: ['employeeCode', 'firstName', 'middleName', 'lastName'].map(key => ({ [key]: { contains: term, mode: 'insensitive' } })) } satisfies Prisma.EmployeeWhereInput)) : []),
    ] },
    orderBy: { employeeCode: 'asc' }, take: 20_001,
    select: { employeeCode: true, firstName: true, middleName: true, lastName: true, status: true,
      dateOfJoining: true, dateOfLeaving: true,
      company: { select: { id: true, name: true } }, plant: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } }, designation: { select: { name: true } },
    },
  })
}
