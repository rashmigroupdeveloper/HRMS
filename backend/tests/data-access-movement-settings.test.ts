import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma, SYSTEM_ACTOR, type DailyMovementReportSetting } from '#core/db/prisma'
import * as service from '../src/modules/daily-movement-reports/daily-movement-reports.service.js'
import { saveSetting } from '../src/modules/daily-movement-reports/daily-movement-reports.schema.js'
import * as rolesService from '../src/modules/accounts/roles/roles.service.js'
import { userWith, row } from './helpers/users.js'

const admin = userWith({ id: 0, employeeCode: 'SYSTEM' }, [], { isSuperAdmin: true })
const limited = userWith({ id: 0, employeeCode: 'LIMITED' }, [{ access: { ACCESS: 'WRITE', EMPLOYEES: 'WRITE' }, rows: [row(1, null, null)] }])
const groupAdmin = userWith({ id: 0, employeeCode: 'GROUP' }, [{ access: { ACCESS: 'WRITE', EMPLOYEES: 'WRITE' }, rows: [row(null, null, null)] }])
const base = { sendAtMinutes: 540, coverage: 'PREVIOUS_DAY' as const, sendEmpty: true, expectedUpdatedAt: null }

describe('daily movement report settings: active Super Admin only', () => {
  let previous: DailyMovementReportSetting | null = null
  let captured = false
  let roleId: number
  let noAccessRoleId: number
  beforeAll(async () => {
    previous = await prisma.dailyMovementReportSetting.findUnique({ where: { id: 1 } })
    captured = true
    await prisma.dailyMovementReportSetting.deleteMany({ where: { id: 1 } })
    const tag = Math.random().toString(36).slice(2, 10)
    roleId = (await rolesService.createRole({ name: `Movement head ${tag}`, access: { EMPLOYEES: 'READ' } }, admin)).id
    noAccessRoleId = (await rolesService.createRole({ name: `Movement other ${tag}`, access: {} }, admin)).id
  })
  afterAll(async () => {
    if (captured) {
      await prisma.dailyMovementReportSetting.deleteMany({ where: { id: 1 } })
      if (previous) await prisma.dailyMovementReportSetting.create({ data: previous })
    }
    await prisma.$disconnect()
  })

  it('denies scoped and group-wide ACCESS Edit, including an assigned but inactive Super Admin', async () => {
    for (const viewer of [limited, groupAdmin, { ...groupAdmin, availableRoles: [{ id: 1, name: 'Assigned Super Admin' }] }]) {
      await expect(service.getSetting(viewer)).rejects.toMatchObject({ code: 'FORBIDDEN' })
      await expect(service.saveSetting(viewer, { ...base, hrHeadRoleId: roleId })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    }
    expect(await prisma.dailyMovementReportSetting.count()).toBe(0)
  })

  it('returns approved defaults without creating a row or choosing a role', async () => {
    const result = await service.getSetting(admin)
    expect(result.setting).toMatchObject({ isEnabled: false, hrHeadRole: null, sendAtMinutes: 540, coverage: 'PREVIOUS_DAY', sendEmpty: true, updatedAt: null })
    expect(result.roles.some(r => r.id === roleId)).toBe(true)
    expect(result.roles.some(r => r.id === noAccessRoleId)).toBe(false)
    expect(await prisma.dailyMovementReportSetting.count()).toBe(0)
  })

  it('rejects unknown/non-reporting roles and validates time, coverage and activation input', async () => {
    for (const id of [noAccessRoleId, 2147483647]) await expect(service.saveSetting(admin, { ...base, hrHeadRoleId: id })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    const valid = { ...base, hrHeadRoleId: roleId }
    for (const change of [{ sendAtMinutes: -1 }, { sendAtMinutes: 1440 }, { sendAtMinutes: 1.5 }, { coverage: 'WEEK' }, { hrHeadRoleId: 0 }, { isEnabled: true }, { createdById: 999 }]) expect(saveSetting.safeParse({ ...valid, ...change }).success).toBe(false)
    expect(saveSetting.safeParse({ ...valid, sendAtMinutes: 0 }).success).toBe(true)
    expect(saveSetting.safeParse({ ...valid, sendAtMinutes: 1439 }).success).toBe(true)
  })

  it('saves with audit attribution, stays disabled, and rejects duplicate creation and stale edits', async () => {
    const saved = await service.saveSetting(admin, { ...base, hrHeadRoleId: roleId })
    expect(saved).toMatchObject({ isEnabled: false, hrHeadRole: { id: roleId }, sendAtMinutes: 540, coverage: 'PREVIOUS_DAY', sendEmpty: true })
    expect(await prisma.dailyMovementReportSetting.findUnique({ where: { id: 1 } })).toMatchObject({ createdById: SYSTEM_ACTOR, updatedById: SYSTEM_ACTOR })
    await expect(service.saveSetting(admin, { ...base, hrHeadRoleId: roleId })).rejects.toMatchObject({ code: 'CONFLICT' })
    const updated = await service.saveSetting(admin, { ...base, hrHeadRoleId: roleId, sendAtMinutes: 600, coverage: 'TODAY', sendEmpty: false, expectedUpdatedAt: saved!.updatedAt })
    expect(updated).toMatchObject({ sendAtMinutes: 600, coverage: 'TODAY', sendEmpty: false, isEnabled: false })
    await expect(service.saveSetting(admin, { ...base, hrHeadRoleId: roleId, expectedUpdatedAt: saved!.updatedAt })).rejects.toMatchObject({ code: 'CONFLICT' })
    expect((await service.getSetting(admin)).setting).toMatchObject({ sendAtMinutes: 600 })
  })

  it('enforces singleton/time constraints and protects the selected role from deletion', async () => {
    const data = { hrHeadRoleId: roleId, createdById: 0, updatedById: 0 }
    await expect(prisma.dailyMovementReportSetting.create({ data: { ...data, id: 2 } })).rejects.toThrow()
    await expect(prisma.dailyMovementReportSetting.update({ where: { id: 1 }, data: { sendAtMinutes: 1440 } })).rejects.toThrow()
    await expect(prisma.role.delete({ where: { id: roleId } })).rejects.toThrow()
  })
})
