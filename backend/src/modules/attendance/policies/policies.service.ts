import { assertAccess } from '#core/auth/access'
import { assertGroupWide, SYSTEM_SCOPE } from '#core/auth/scope'
import { prisma } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { employeesService } from '#modules/employees'
import { today } from '#shared/utils/dates'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as daysService from '../days/days.service.js'
import * as policiesRepository from './policies.repository.js'
import type { createPolicyInput, updatePolicyInput } from './policies.schema.js'

// Attendance policies (the user, 2026-11-22): the rules a day is judged by, apart from the shift's timing - the grace, the
// full / half day hours from the first in to the last out (the full day: the whole shift unless set), every Nth late day
// of a month losing its first half, and very late in / very early out making a half absent. Given on an employee's
// schedule; without one, the default policy. The same for every company (like shifts): changing them needs Attendance
// setup Edit for all companies.
// Dated (the user, 2026-11-23): the rules are versions, each from a date - a day is judged by the version in force on it,
// so the days before a change keep their rules even when worked out again later. A change from a day already passed
// works those days out again at once (not in a locked month).

// a new policy's first version - from the start
const FROM_THE_START = new Date(Date.UTC(2000, 0, 1))
const RULE_KEYS = ['graceMinutes', 'fullDayMinutes', 'halfDayMinutes', 'latesPerHalfDayCut', 'veryLateMinutes', 'veryEarlyMinutes'] as const

type Version = policiesRepository.PolicyRow['versions'][number]
const pickRules = (v: policiesRepository.Rules): policiesRepository.Rules => Object.fromEntries(RULE_KEYS.map((k) => [k, v[k]])) as policiesRepository.Rules
// the version in force on a day (the first one before it starts)
const versionOn = (versions: Version[], day: Date) => versions.filter((v) => v.effectiveFrom <= day).at(-1) ?? versions[0]!

// For the API: the rules in force today (with the date they run from), and every version - who set it
async function toPolicies(rows: policiesRepository.PolicyRow[]) {
  const person = await employeesService.lookupPeople(rows.flatMap((r) => r.versions.map((v) => v.updatedById)))
  const now = today()
  return rows.map(({ versions, ...policy }) => {
    const current = versionOn(versions, now)
    return {
      ...policy,
      ...pickRules(current),
      // the date the rules in force today run from (2000-01-01 = from the start)
      from: current.effectiveFrom,
      versions: versions.map((v) => ({ effectiveFrom: v.effectiveFrom, ...pickRules(v), current: v.id === current.id, upcoming: v.effectiveFrom > now, by: person(v.updatedById), at: v.updatedAt })),
    }
  })
}

export async function listPolicies(viewer: CurrentUser, includeInactive = false) {
  if (includeInactive) assertAccess(viewer.access, 'ATTENDANCE_SETUP', 'READ')
  return toPolicies(await policiesRepository.listPolicies(includeInactive))
}

async function getPolicy(id: number) {
  const policy = await policiesRepository.findPolicy(id)
  if (!policy) throw new ORPCError('NOT_FOUND', { message: `No attendance policy with id ${id}` })
  return policy
}

function check(p: { fullDayMinutes: number | null; halfDayMinutes: number }) {
  if (p.fullDayMinutes !== null && p.halfDayMinutes > p.fullDayMinutes) throw new ORPCError('BAD_REQUEST', { message: 'A half day cannot need more time than a full day' })
  if (p.halfDayMinutes <= 0) throw new ORPCError('BAD_REQUEST', { message: 'A half day needs some time' })
}

export async function createPolicy({ isDefault, name, ...rules }: z.infer<typeof createPolicyInput>, viewer: CurrentUser) {
  assertGroupWide(viewer, 'ATTENDANCE_SETUP', 'An attendance policy')
  check(rules)
  const id = await prisma.$transaction(async (tx) => {
    const created = await policiesRepository.createPolicy({ name, isDefault: isDefault ?? false }, pickRules(rules), FROM_THE_START, viewer.employeeId, tx)
    if (isDefault) await policiesRepository.clearDefault(created, viewer.employeeId, tx)
    return created
  })
  const [policy] = await toPolicies([await getPolicy(id)])
  return policy!
}

// The name, default, retired - and the rules from a date: the version in force that day with the changes, kept as the
// version from that date (one on the same date is replaced); later versions stay. From a day already passed: the days of
// the employees the policy covers are worked out again from then (never in a locked month).
export async function updatePolicy({ id, name, isDefault, isActive, effectiveFrom, ...ruleChanges }: z.infer<typeof updatePolicyInput>, viewer: CurrentUser) {
  assertGroupWide(viewer, 'ATTENDANCE_SETUP', 'An attendance policy')
  const current = await getPolicy(id)
  if (isActive === false && current.isDefault) throw new ORPCError('CONFLICT', { message: 'The default policy cannot be retired - make another policy the default first' })
  const changesRules = RULE_KEYS.some((k) => ruleChanges[k] !== undefined)
  if (changesRules && !effectiveFrom) throw new ORPCError('BAD_REQUEST', { message: 'Give the date the new rules apply from' })
  let rules: policiesRepository.Rules | null = null
  if (changesRules && effectiveFrom) {
    const base = pickRules(versionOn(current.versions, effectiveFrom))
    rules = { ...base, ...Object.fromEntries(Object.entries(ruleChanges).filter(([, v]) => v !== undefined)) }
    check(rules)
    if (effectiveFrom <= today()) await daysService.assertOpenDays([effectiveFrom])
  }
  await prisma.$transaction(async (tx) => {
    if (name !== undefined || isDefault || isActive !== undefined) {
      await policiesRepository.updatePolicy(id, { ...(name !== undefined && { name }), ...(isDefault && { isDefault }), ...(isActive !== undefined && { isActive }) }, viewer.employeeId, tx)
    }
    if (isDefault) await policiesRepository.clearDefault(id, viewer.employeeId, tx)
    if (rules && effectiveFrom) await policiesRepository.upsertVersion(id, effectiveFrom, rules, viewer.employeeId, tx)
  })
  // the days already passed from that date follow the new rules
  if (rules && effectiveFrom && effectiveFrom <= today()) {
    const ids = current.isDefault
      ? (await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, from: effectiveFrom, to: today() })).map((p) => p.id)
      : await policiesRepository.listEmployeeIdsOnPolicy(id)
    await daysService.recompute(ids, effectiveFrom, today())
  }
  const [policy] = await toPolicies([await getPolicy(id)])
  return policy!
}

// An active policy by id (a schedule names one)
export async function getActivePolicy(id: number) {
  const policy = await getPolicy(id)
  if (!policy.isActive) throw new ORPCError('BAD_REQUEST', { message: `${policy.name} is retired` })
  return policy
}
