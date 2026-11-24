import { scopeOf, SYSTEM_SCOPE } from '#core/auth/scope'
import { prisma } from '#core/db/prisma'
import { reportFile, reportSheet } from '#core/excel/report'
import type { CurrentUser } from '#core/rpc/procedures'
import { dayKey } from '#shared/utils/time'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as daysService from '../days/days.service.js'
import type { dayPunchesInput } from '../days/days.schema.js'
import * as reportsRepository from './reports.repository.js'
import type { reportFilter, reportInput } from './reports.schema.js'

const MAX_EXPORT = 20_000
const scopes = { TEAM: 'Current reporting team', DEPARTMENT: 'Current HOD department', ALL: 'Attendance View data access' }

async function queryFor(viewer: CurrentUser, filter: z.infer<typeof reportFilter>) {
  // Relationship reads use explicit authorized ids; ALL additionally keeps its row scope inside every repository query.
  const people = await daysService.peopleInScope(viewer, { scope: filter.scope }, filter.from, filter.to)
  return {
    query: { scope: filter.scope === 'ALL' ? scopeOf(viewer, 'ATTENDANCE', 'READ') : SYSTEM_SCOPE, employeeIds: people.map(p => p.id), filter },
    options: {
      companies: [...new Map(people.map(p => [p.companyId, { id: p.companyId, name: p.company.code }])).values()],
      plants: [...new Map(people.map(p => [p.plantId, { id: p.plantId, companyId: p.companyId, name: p.plant.name }])).values()],
      departments: [...new Map(people.filter(p => p.departmentId !== null).map(p => [p.departmentId!, { id: p.departmentId!, name: p.department?.name ?? 'Department' }])).values()],
    },
  }
}

type StoredRow = Awaited<ReturnType<typeof reportsRepository.list>>[number]
function toRows(rows: StoredRow[], groups: Awaited<ReturnType<typeof reportsRepository.peopleTotals>>) {
  const totals = new Map(groups.map(g => [g.employeeId, g]))
  return rows.map(({ employee: e, employeeId, ...r }) => ({
    ...r, employeeCode: e.employeeCode, employee: [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' '),
    company: e.company.code, plant: e.plant.name, department: e.department?.name ?? null,
    employeePeriodRows: totals.get(employeeId)?._count._all ?? 0,
    employeeLateMinutes: totals.get(employeeId)?._sum.lateMinutes ?? 0,
    employeeEarlyMinutes: totals.get(employeeId)?._sum.earlyMinutes ?? 0,
  }))
}

async function read(viewer: CurrentUser, input: z.infer<typeof reportInput>, exporting: boolean) {
  const { query, options } = await queryFor(viewer, input)
  const result = await prisma.$transaction(async tx => {
    const total = await reportsRepository.count(query, tx)
    if (exporting && total > MAX_EXPORT) throw new ORPCError('BAD_REQUEST', { message: 'More than 20,000 attendance days match. Narrow the dates or filters and export again.' })
    const page = Math.min(input.page, Math.max(1, Math.ceil(total / input.pageSize)))
    const rows = await reportsRepository.list(query, { skip: exporting ? 0 : (page - 1) * input.pageSize, take: exporting ? MAX_EXPORT : input.pageSize }, tx)
    const sums = await reportsRepository.totals(query, tx)
    const groups = await reportsRepository.peopleTotals(query, tx)
    const late = await reportsRepository.exceptionCount(query, 'LATE', tx)
    const early = await reportsRepository.exceptionCount(query, 'EARLY', tx)
    const absent = await reportsRepository.exceptionCount(query, 'ABSENT', tx)
    const missedPunch = await reportsRepository.exceptionCount(query, 'MISSED_PUNCH', tx)
    return {
      total, page, pageSize: input.pageSize, items: toRows(rows, groups),
      summary: { days: total, people: groups.length, workedMinutes: sums._sum.workedMinutes ?? 0,
        punches: sums._sum.punchCount ?? 0, lateMinutes: sums._sum.lateMinutes ?? 0, earlyMinutes: sums._sum.earlyMinutes ?? 0,
        late, early, absent, missedPunch },
    }
  }, { isolationLevel: 'RepeatableRead' })
  return { ...result, options }
}

export function getReport(viewer: CurrentUser, input: z.infer<typeof reportInput>) {
  return read(viewer, input, false)
}

export async function exportReport(viewer: CurrentUser, input: z.infer<typeof reportFilter>) {
  const data = await read(viewer, { ...input, page: 1, pageSize: 100 }, true)
  const title = input.mode === 'DETAIL' ? 'Attendance detail' : 'Attendance exceptions'
  const selected = (ids: number[] | undefined, values: { id: number; name: string }[]) => ids?.length ? ids.map(id => values.find(v => v.id === id)?.name ?? String(id)).join(', ') : 'All within scope'
  return reportFile([
    reportSheet(title, data.items, [
      { header: 'Employee code', text: true, value: r => r.employeeCode }, { header: 'Employee', width: 26, value: r => r.employee },
      { header: 'Company', value: r => r.company }, { header: 'Plant', width: 24, value: r => r.plant }, { header: 'Department', width: 24, value: r => r.department },
      { header: 'Work date', date: true, value: r => r.date }, { header: 'Status', value: r => r.status },
      { header: 'First half', value: r => r.firstHalf }, { header: 'Second half', value: r => r.secondHalf }, { header: 'Punch-derived status', value: r => r.autoStatus },
      { header: 'Shift', value: r => r.shift?.code },
      // ISO timestamps retain the offset/instant regardless of the server or Excel user's time zone.
      { header: 'First punch (UTC ISO)', width: 27, text: true, value: r => r.firstIn?.toISOString() },
      { header: 'Last punch (UTC ISO)', width: 27, text: true, value: r => r.lastOut?.toISOString() },
      { header: 'Punch count', value: r => r.punchCount }, { header: 'Worked minutes', value: r => r.workedMinutes },
      { header: 'Late minutes', value: r => r.lateMinutes }, { header: 'Early minutes', value: r => r.earlyMinutes },
      { header: 'Matching days for employee', value: r => r.employeePeriodRows },
      { header: 'Employee late minutes (filtered period)', value: r => r.employeeLateMinutes },
      { header: 'Employee early minutes (filtered period)', value: r => r.employeeEarlyMinutes }, { header: 'Calculation note', width: 55, value: r => r.note },
    ]),
    reportSheet('Summary', Object.entries(data.summary).map(([key, value]) => [({ days: 'Matching attendance days', people: 'Distinct employees', workedMinutes: 'Worked minutes', punches: 'Stored punch count', lateMinutes: 'Late minutes', earlyMinutes: 'Early minutes', late: 'Days with late arrival', early: 'Days with early departure', absent: 'Days with an absent half', missedPunch: 'Days with a missed punch' } as Record<string, string>)[key]!, value] as const), [{ header: 'Metric', value: r => r[0] }, { header: 'Value', value: r => r[1] }]),
  ], {
    title, preparedBy: `${viewer.name} (${viewer.employeeCode})`,
    coverage: 'All matching stored attendance days, not just the displayed page. Current placement and team/HOD membership. Missing/uncomputed days are not inferred as absence. Absent and missed-punch counts include either half; exception categories overlap. Times are exact UTC ISO instants; the work date follows attendance shift ownership. Employee totals follow every active filter. No OT entitlement or penalties are inferred.',
    filters: [{ label: 'People', value: scopes[input.scope] }, { label: 'Calendar work dates (inclusive)', value: `${dayKey(input.from)} to ${dayKey(input.to)}` },
      { label: 'Company', value: selected(input.companyIds, data.options.companies) }, { label: 'Plant', value: selected(input.plantIds, data.options.plants) },
      { label: 'Department', value: selected(input.departmentIds, data.options.departments) }, { label: 'Work location IDs', value: input.workLocationIds?.join(', ') || 'All within scope' },
      { label: 'Search', value: input.search || 'Everyone' }, { label: 'Status', value: input.status ?? 'Every status' },
      { label: 'Exception', value: input.mode === 'EXCEPTIONS' ? input.exception : 'Not applied in detail view' }],
  }, `attendance-${input.mode.toLowerCase()}-${dayKey(input.from)}-${dayKey(input.to)}`)
}

export async function exportPunches(viewer: CurrentUser, input: z.infer<typeof dayPunchesInput>) {
  const rows = await daysService.getDayPunches(viewer, input)
  if (rows.length > MAX_EXPORT) throw new ORPCError('BAD_REQUEST', { message: 'More than 20,000 punches belong to this work date. Review the source data before exporting.' })
  return reportFile([reportSheet('Raw punches', rows, [
    { header: 'Machine employee code', text: true, value: r => r.employeeCode },
    { header: 'Punch timestamp (UTC ISO)', width: 27, text: true, value: r => r.at.toISOString() },
    { header: 'Local time', text: true, value: r => r.time }, { header: 'Time zone', value: r => r.timezone }, { header: 'Device', value: r => r.device },
    { header: 'Source', value: r => r.source }, { header: 'Upload reference', value: r => r.uploadId }, { header: 'Upload file', width: 35, value: r => r.uploadFile },
    { header: 'Stored at (UTC ISO)', width: 27, text: true, value: r => r.storedAt.toISOString() },
  ])], {
    title: 'Raw punches', preparedBy: `${viewer.name} (${viewer.employeeCode})`,
    coverage: 'Stored punches assigned to the selected attendance work date by the existing shift calculation, including night shifts. Not the machine payload or all rejected/duplicate input rows. No card, door, GPS or direction metadata is stored in this schema.',
    filters: [{ label: 'Employee', value: input.employeeCode }, { label: 'Work date', value: dayKey(input.date) }],
  }, `raw-punches-${input.employeeCode}-${dayKey(input.date)}`)
}
