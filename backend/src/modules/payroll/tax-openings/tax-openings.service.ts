import { ORPCError } from '@orpc/server'
import { assertAccess } from '#core/auth/access'
import { levelOver, wholeCompanyScopeOf } from '#core/auth/scope'
import { prisma } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { employeesService } from '#modules/employees'
import * as openingsRepository from './tax-openings.repository.js'
import type { OpeningsListInput, SaveOpeningInput } from './tax-openings.schema.js'

// Payroll stage 4 (approved by the user 2026-11-27): opening tax figures - what an employee earned and had deducted as
// income tax earlier in a tax year outside this system (greytHR before the go-live, a previous employer - Form 122).
// The monthly TDS spreads the rest of the year's tax over the months left. People's records, so whose rows: whole-company
// Payroll scope by the employee's company (as pay runs: a plant-level row never counts); changing needs Payroll Edit
// covering that company, never for one's own record. The amounts are salary figures: listed only to a viewer who also
// has Salary View covering the employee's company (the rule of 2026-11-26 - Payroll alone never shows salaries); without
// it the row shows who and up to when, and cannot be changed (it can still be added).

const companySlice = (companyId: number) => ({ companyId, plantId: null, departmentId: null })
const nameOf = (e: { firstName: string; middleName: string | null; lastName: string | null }) => employeesService.fullName(e)

export async function listOpenings(viewer: CurrentUser, input: OpeningsListInput) {
  assertAccess(viewer.access, 'PAYROLL', 'READ')
  const { items, total } = await openingsRepository.list(wholeCompanyScopeOf(viewer, 'PAYROLL'), input)
  const person = await employeesService.lookupPeople(items.map((r) => r.updatedById))
  return {
    items: items.map(({ employee, updatedById, taxableIncome, taxDeducted, ...row }) => {
      const shown = levelOver(viewer, 'SALARY', companySlice(employee.companyId)) !== undefined
      return {
        ...row,
        taxableIncome: shown ? taxableIncome : null,
        taxDeducted: shown ? taxDeducted : null,
        amountsHidden: !shown,
        employee: { employeeCode: employee.employeeCode, name: nameOf(employee) },
        updatedBy: person(updatedById),
        canChange: shown && levelOver(viewer, 'PAYROLL', companySlice(employee.companyId)) === 'WRITE' && employee.id !== viewer.employeeId,
      }
    }),
    total,
  }
}

// The employee's company must be inside the viewer's whole-company Payroll scope (outside: NOT_FOUND), at Edit
// (View only: FORBIDDEN), and never the viewer themselves
function assertCanChange(viewer: CurrentUser, employee: { id: number; employeeCode: string; companyId: number }) {
  const level = levelOver(viewer, 'PAYROLL', companySlice(employee.companyId))
  if (!level) throw new ORPCError('NOT_FOUND', { message: `No employee ${employee.employeeCode} found` })
  if (level !== 'WRITE') throw new ORPCError('FORBIDDEN', { message: 'Opening tax figures - changing them needs Payroll Edit for the whole company' })
  if (employee.id === viewer.employeeId) throw new ORPCError('FORBIDDEN', { message: 'Nobody enters their own tax figures - ask a colleague with Payroll access' })
}

export async function saveOpening(viewer: CurrentUser, { id, employeeCode, taxYearFrom, ...figures }: SaveOpeningInput) {
  assertAccess(viewer.access, 'PAYROLL', 'WRITE')
  const data = { ...figures, note: figures.note ?? null }
  return prisma.$transaction(async (tx) => {
    if (id) {
      const current = await openingsRepository.find(id, tx)
      if (!current) throw new ORPCError('NOT_FOUND', { message: 'No such opening tax figures' })
      assertCanChange(viewer, current.employee)
      if (current.employee.employeeCode !== employeeCode || current.taxYearFrom.getTime() !== taxYearFrom.getTime()) {
        throw new ORPCError('BAD_REQUEST', { message: 'The employee and tax year of saved figures stay - remove them and add new ones instead' })
      }
      return openingsRepository.update(id, data, viewer.employeeId, tx)
    }
    const employee = await employeesService.findForPayroll(employeeCode, tx)
    if (!employee) throw new ORPCError('NOT_FOUND', { message: `No employee ${employeeCode} found` })
    assertCanChange(viewer, employee)
    // (the same employee and tax year twice: CONFLICT, mapped centrally)
    return openingsRepository.create({ ...data, employeeId: employee.id, taxYearFrom }, viewer.employeeId, tx)
  })
}

export async function deleteOpening(viewer: CurrentUser, { id }: { id: number }) {
  assertAccess(viewer.access, 'PAYROLL', 'WRITE')
  return prisma.$transaction(async (tx) => {
    const current = await openingsRepository.find(id, tx)
    if (!current) throw new ORPCError('NOT_FOUND', { message: 'No such opening tax figures' })
    assertCanChange(viewer, current.employee)
    return openingsRepository.deleteOpening(id, tx)
  })
}

// The opening figures of a tax year for a run's people (working out TDS - the run was found with whole-company Payroll
// scope first)
export function openingsFor(employeeIds: number[], taxYearFrom: Date, db?: import('#core/db/prisma').DbClient) {
  return openingsRepository.listForEmployees(employeeIds, taxYearFrom, db)
}
