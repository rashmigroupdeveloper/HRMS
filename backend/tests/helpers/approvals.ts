import { prisma, type AccessArea, type AccessLevel } from '#core/db/prisma'

// Test data for approvals: approvers are found from real logins and their roles, so these create them directly (as
// System). Every name carries this run's random tag - runs and test files never clash.
const run = Math.random().toString(36).slice(2, 7).toUpperCase()
let next = 0
const by = { createdById: 0, updatedById: 0 }

// A role of the test's own, with this access
export function createRole(access: Partial<Record<AccessArea, AccessLevel>> = {}) {
  return prisma.role.create({
    data: {
      name: `Test role ${run}${++next}`,
      ...by,
      permissions: { create: Object.entries(access).map(([area, level]) => ({ area: area as AccessArea, level: level as AccessLevel, ...by })) },
    },
    select: { id: true, name: true },
  })
}

// A login for the employee, holding each role for one company or several (null = every company)
export function giveLogin(employeeId: number, grants: { roleId: number; companyId: number | null | number[] }[]) {
  return prisma.userAccount.create({
    data: {
      employeeId,
      passwordHash: 'not-a-real-password',
      ...by,
      roles: {
        create: grants.map((g) => ({
          roleId: g.roleId,
          ...by,
          scopes: { create: (Array.isArray(g.companyId) ? g.companyId : [g.companyId]).map((companyId) => ({ companyId, level: 'WRITE' as const, ...by })) },
        })),
      },
    },
    select: { id: true },
  })
}

// The role marked as the fallback approver (seeded "Admin")
export async function fallbackRoleId() {
  const role = await prisma.role.findFirst({ where: { isApprovalFallback: true }, select: { id: true } })
  if (!role) throw new Error('No fallback approver role in the test database')
  return role.id
}
