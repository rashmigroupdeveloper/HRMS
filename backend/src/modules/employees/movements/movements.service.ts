import { ORPCError } from '@orpc/server'
import { assertAccess } from '#core/auth/access'
import { scopeOf } from '#core/auth/scope'
import { reportFile, reportSheet } from '#core/excel/report'
import type { CurrentUser } from '#core/rpc/procedures'
import { today } from '#shared/utils/dates'
import type { z } from 'zod'
import * as movementsRepository from './movements.repository.js'
import type { movementFilter, movementInput } from './movements.schema.js'

const MAX_EVENTS = 20_000
export const MOVEMENT_COVERAGE = 'Recorded employee joining/leaving dates, inclusive. Current placement and current employee code/name/status, not historical placement. Includes directly added/imported employees. Future dates are marked; leaving dates do not confirm resignation approval, clearance or settlement. Rehire/exit history not represented by the current employee record is not reconstructed.'
type Filter = z.infer<typeof movementFilter>
const key = (d: Date) => d.toISOString().slice(0, 10)
async function snapshot(viewer: CurrentUser, input: Filter) {
  assertAccess(viewer.access, 'EMPLOYEES', 'READ')
  const rows = await movementsRepository.listRecorded({ scope: scopeOf(viewer, 'EMPLOYEES', 'READ'), filter: input })
  const limit = () => new ORPCError('BAD_REQUEST', { message: 'This report exceeds 20,000 events. Narrow the date or place filters and try again.' })
  if (rows.length > MAX_EVENTS) throw limit()
  const asOf = today()
  const items = rows.flatMap(r => {
    const person = { employeeCode: r.employeeCode, name: [r.firstName, r.middleName, r.lastName].filter(Boolean).join(' '), status: r.status,
      company: r.company, plant: r.plant, department: r.department, designation: r.designation?.name ?? null }
    const events: { kind: 'JOINER' | 'LEAVER'; date: Date }[] = []
    if (input.kind !== 'LEAVER' && r.dateOfJoining >= input.from && r.dateOfJoining <= input.to) events.push({ kind: 'JOINER', date: r.dateOfJoining })
    if (input.kind !== 'JOINER' && r.dateOfLeaving && r.dateOfLeaving >= input.from && r.dateOfLeaving <= input.to) events.push({ kind: 'LEAVER', date: r.dateOfLeaving })
    return events.map(e => ({ ...person, ...e, future: e.date > asOf }))
  }).sort((a, b) => a.date.getTime() - b.date.getTime() || a.employeeCode.localeCompare(b.employeeCode) || a.kind.localeCompare(b.kind))
  if (items.length > MAX_EVENTS) throw limit()
  const option = (values: { id: number; name: string }[]) => [...new Map(values.map(v => [v.id, v])).values()].sort((a, b) => a.name.localeCompare(b.name))
  return { items, asOf, total: items.length,
    summary: { joiners: items.filter(r => r.kind === 'JOINER').length, leavers: items.filter(r => r.kind === 'LEAVER').length, people: new Set(items.map(r => r.employeeCode)).size, future: items.filter(r => r.future).length },
    options: { companies: option(rows.map(r => r.company)), plants: option(rows.map(r => r.plant)), departments: option(rows.flatMap(r => r.department ? [r.department] : [])) },
  }
}
export async function listMovements(viewer: CurrentUser, input: z.infer<typeof movementInput>) {
  const { items, ...rest } = await snapshot(viewer, input)
  return { ...rest, items: items.slice((input.page - 1) * input.pageSize, input.page * input.pageSize), page: input.page, pageSize: input.pageSize }
}
export async function exportMovements(viewer: CurrentUser, input: Filter) {
  const report = await snapshot(viewer, input)
  return reportFile([
    reportSheet('Joiners and leavers', report.items, [
      { header: 'Recorded date', date: true, width: 18, value: r => r.date },
      { header: 'Event', width: 24, value: r => r.kind === 'JOINER' ? 'Joining date' : 'Leaving date' },
      { header: 'Future date', width: 14, value: r => r.future ? 'Yes' : 'No' },
      { header: 'Employee code', width: 18, text: true, value: r => r.employeeCode },
      { header: 'Name', width: 28, value: r => r.name },
      { header: 'Company (current)', width: 28, value: r => r.company.name },
      { header: 'Plant (current)', width: 24, value: r => r.plant.name },
      { header: 'Department (current)', width: 24, value: r => r.department?.name },
      { header: 'Designation (current)', width: 24, value: r => r.designation },
      { header: 'Employment status (current)', width: 24, value: r => r.status.replaceAll('_', ' ') },
    ]),
    reportSheet('Summary', Object.entries({ 'Joining events': report.summary.joiners, 'Leaving events': report.summary.leavers, 'Distinct people': report.summary.people, 'Future dated events': report.summary.future }), [
      { header: 'Metric', width: 28, value: r => r[0] }, { header: 'Count', value: r => r[1] },
    ]),
  ], { title: 'Recorded joiners and leavers', preparedBy: `${viewer.name} (${viewer.employeeCode})`, coverage: MOVEMENT_COVERAGE,
    filters: [{ label: 'Inclusive dates', value: `${key(input.from)} to ${key(input.to)}` }, { label: 'Event type', value: input.kind },
      { label: 'Employee search', value: input.search || 'Everyone in scope' },
      ...(['companyIds', 'plantIds', 'departmentIds'] as const).map(k => ({ label: ({ companyIds: 'Companies', plantIds: 'Plants', departmentIds: 'Departments' } as const)[k], value: input[k]?.map(id => { const options = k === 'companyIds' ? report.options.companies : k === 'plantIds' ? report.options.plants : report.options.departments; return options.find(o => o.id === id)?.name ?? 'Selected place (no matching events)' }).join(', ') || 'All within authorized scope' })),
      { label: 'Date used to mark future events', value: key(report.asOf) }],
  }, `joiners-leavers-${key(input.from)}-${key(input.to)}`)
}
