import { assertPasswordConfirmed } from '#core/auth/confirm'
import { assertGroupWide } from '#core/auth/scope'
import type { CurrentUser } from '#core/rpc/procedures'
import { employeesService } from '#modules/employees'
import type { z } from 'zod'
import * as securityRepository from './security.repository.js'
import type { updateSecurityRulesInput } from './security.schema.js'

// The security rules (2026-11-16, inspired by the old HRMS's Settings page): lockout, how long a sign-in lasts, the
// password rules, how long codes and a re-entered password count. Kept in one row; until it is saved the defaults
// below apply. Read by the accounts service on every sign-in / password change (kept for a few seconds in memory).

export type SecurityRules = z.infer<typeof updateSecurityRulesInput>

export const DEFAULT_RULES: SecurityRules = {
  maxFailedLogins: 5,
  lockMinutes: 15,
  // 7 days from signing in (as the old HRMS)
  sessionHours: 7 * 24,
  minPasswordLength: 10,
  passwordHistory: 5,
  resetCodeMinutes: 10,
  confirmPasswordMinutes: 10,
}

const CACHE_MS = 10_000
let cached: { rules: SecurityRules; at: number } | null = null

// The rules in force
export async function getRules(): Promise<SecurityRules> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.rules
  const row = await securityRepository.find()
  const rules = row ? (({ updatedAt: _a, updatedById: _b, ...r }) => r)(row) : DEFAULT_RULES
  cached = { rules, at: Date.now() }
  return rules
}

// For the Roles & access page: the rules, whether they are still the defaults, and who changed them last
export async function getSecurityRules() {
  const row = await securityRepository.find()
  const person = await employeesService.lookupPeople([row?.updatedById])
  return {
    rules: row ? (({ updatedAt: _a, updatedById: _b, ...r }) => r)(row) : DEFAULT_RULES,
    defaults: DEFAULT_RULES,
    isDefault: !row,
    updatedAt: row?.updatedAt ?? null,
    updatedBy: person(row?.updatedById),
  }
}

// Changing the rules needs the password re-entered (like changing roles); they apply from the next sign-in / password
// change (a sign-in already made keeps its end time)
export async function updateSecurityRules(rules: z.infer<typeof updateSecurityRulesInput>, user: CurrentUser) {
  assertPasswordConfirmed(user)
  // the same rules for every company: needs Roles & access Edit for all companies (A4, 2026-11-18)
  assertGroupWide(user, 'ACCESS', 'The security rules')
  await securityRepository.save(rules, user.employeeId)
  cached = null
  return getSecurityRules()
}

// What the password pages tell the person (also before signing in - forgot password)
export async function passwordRule() {
  const { minPasswordLength, passwordHistory } = await getRules()
  return { minLength: minPasswordLength, history: passwordHistory }
}
