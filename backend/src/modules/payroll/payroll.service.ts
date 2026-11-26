import { ORPCError } from '@orpc/server'
import { assertAccess } from '#core/auth/access'
import { assertWholeSlice, levelOver, wholeCompanyScopeOf } from '#core/auth/scope'
import { prisma } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { attendanceService } from '#modules/attendance'
import { companiesService } from '#modules/organization'
import { employeesService } from '#modules/employees'
import * as payrollRepository from './payroll.repository.js'
import type { CreateInput, ListInput } from './payroll.schema.js'

export async function getSetup(viewer: CurrentUser, { payMonth }: { payMonth: Date }) {
  assertAccess(viewer.access, 'PAYROLL', 'READ')
  const [companies, period] = await Promise.all([companiesService.listCompanies(), attendanceService.getPayrollPeriod(payMonth.getUTCFullYear(), payMonth.getUTCMonth() + 1)])
  return { companies: companies.filter(c => c.isIndiaPayroll && levelOver(viewer, 'PAYROLL', { companyId: c.id, plantId: null, departmentId: null })).map(c => ({ id: c.id, code: c.code, name: c.name, canCreate: levelOver(viewer, 'PAYROLL', { companyId: c.id, plantId: null, departmentId: null }) === 'WRITE' })), attendanceFrom: period.from, attendanceTo: period.to }
}

export async function listRuns(viewer: CurrentUser, input: ListInput) {
  assertAccess(viewer.access, 'PAYROLL', 'READ')
  const result = await prisma.$transaction(tx => payrollRepository.list(wholeCompanyScopeOf(viewer, 'PAYROLL'), input, tx), { isolationLevel: 'RepeatableRead' })
  return { ...result, items: result.items.map(({ createdById: _created, updatedById: _updated, ...item }) => item) }
}

export async function getRun(viewer: CurrentUser, { id }: { id: number }) {
  assertAccess(viewer.access, 'PAYROLL', 'READ')
  const run = await payrollRepository.find(id, wholeCompanyScopeOf(viewer, 'PAYROLL'))
  if (!run) throw new ORPCError('NOT_FOUND', { message: 'No payroll run found' })
  const person = await employeesService.lookupPeople([run.createdById, run.updatedById])
  const { createdById, updatedById, ...safe } = run
  return { ...safe, createdBy: person(createdById), updatedBy: person(updatedById) }
}

export async function createRun(viewer: CurrentUser, input: CreateInput) {
  assertAccess(viewer.access, 'PAYROLL', 'WRITE')
  // Check scope before looking up the company, so outside-range IDs reveal nothing.
  if (!levelOver(viewer, 'PAYROLL', { companyId: input.companyId, plantId: null, departmentId: null })) throw new ORPCError('NOT_FOUND', { message: 'No payroll company found' })
  assertWholeSlice(viewer, 'PAYROLL', { companyId: input.companyId, plantId: null, departmentId: null }, 'Creating payroll')
  const run = await prisma.$transaction(async tx => {
    const company = await companiesService.getCompany(input.companyId, tx)
    if (!company.isActive || !company.isIndiaPayroll) throw new ORPCError('BAD_REQUEST', { message: 'Choose an active company enabled for India payroll' })
    const period = await attendanceService.getPayrollPeriod(input.payMonth.getUTCFullYear(), input.payMonth.getUTCMonth() + 1, tx)
    if (period.from.getTime() !== input.expectedAttendanceFrom.getTime() || period.to.getTime() !== input.expectedAttendanceTo.getTime()) throw new ORPCError('CONFLICT', { message: 'The attendance cycle changed. Close and reopen New payroll run to review its dates.' })
    if (await payrollRepository.findMonth(input.companyId, input.payMonth, tx)) throw new ORPCError('CONFLICT', { message: 'A payroll run already exists for this company and month. Open it from Payroll runs.' })
    return payrollRepository.create({ companyId: input.companyId, payMonth: input.payMonth, attendanceFrom: period.from, attendanceTo: period.to }, viewer.employeeId, tx)
  })
  return { id: run.id }
}
