import { ORPCError } from '@orpc/server'
import { prisma } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { accountsService } from '#modules/accounts'
import * as settingsRepository from './daily-movement-reports.repository.js'
import type { SaveSetting } from './daily-movement-reports.schema.js'

function assertSuperAdmin(viewer: CurrentUser) {
  if (!viewer.isSuperAdmin) throw new ORPCError('FORBIDDEN', { message: 'Activate your Super Admin role to configure daily movement reports.' })
}

async function roleChoices() {
  return accountsService.listRoleChoicesForAccess('EMPLOYEES', 'READ')
}

export async function getSetting(viewer: CurrentUser) {
  assertSuperAdmin(viewer)
  const [setting, roles] = await Promise.all([settingsRepository.find(), roleChoices()])
  return { setting: setting ?? { id: 1, isEnabled: false, hrHeadRole: null, sendAtMinutes: 540, coverage: 'PREVIOUS_DAY' as const, sendEmpty: true, updatedAt: null }, roles }
}

export async function saveSetting(viewer: CurrentUser, input: SaveSetting) {
  assertSuperAdmin(viewer)
  const roles = await roleChoices()
  if (!roles.some(role => role.id === input.hrHeadRoleId)) throw new ORPCError('BAD_REQUEST', { message: 'Choose an HR Head role with Employee directory & job View access.' })
  return prisma.$transaction(async tx => {
    const result = await settingsRepository.save(input, viewer.employeeId, tx)
    if (result.count !== 1) throw new ORPCError('CONFLICT', { message: 'These settings changed since you opened them. Close and reopen Email settings before saving.' })
    return settingsRepository.find(tx)
  })
}
