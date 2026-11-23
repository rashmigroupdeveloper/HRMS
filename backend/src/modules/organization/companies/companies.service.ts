import { assertGroupWide, assertWholeSlice } from '#core/auth/scope'
import { assertAccess } from '#core/auth/access'
import type { ActorId, DbClient } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as companiesRepository from './companies.repository.js'
import type { createCompanyInput, updateCompanyInput } from './companies.schema.js'

// Duplicate code / name / e-code prefix -> 409 and unknown id -> 404 are mapped centrally (core/rpc/errors.ts).
// (The letterhead of letters is on the letter templates, not on the companies - decided 2026-11-13.)

export function listCompanies(includeInactive = false) {
  return companiesRepository.list(includeInactive)
}

// For the API: active entries are for everyone (every form needs them); inactive ones need ORGANIZATION READ.
export function listCompaniesFor(viewer: CurrentUser, includeInactive = false) {
  if (includeInactive) assertAccess(viewer.access, 'ORGANIZATION', 'READ')
  return listCompanies(includeInactive)
}

// The company with this id; throws NOT_FOUND.
export async function getCompany(id: number, db?: DbClient) {
  const company = await companiesRepository.findById(id, db)
  if (!company) throw new ORPCError('NOT_FOUND', { message: `No company found with id ${id}` })
  return company
}

// A GSTIN contains the company PAN (characters 3-12) - as checked in the old HRMS
function assertGstinMatchesPan(pan: string | null | undefined, gstin: string | null | undefined) {
  if (pan && gstin && gstin.slice(2, 12) !== pan) {
    throw new ORPCError('BAD_REQUEST', { message: 'GSTIN characters 3-12 must be the company PAN' })
  }
}

// What EPF Form 11, ESIC Form 1 and Gratuity Form F print about the employer (2026-11-15): the address and state /
// region, an Indian address its 6-digit PIN code, and an India payroll company its PF establishment and ESIC employer
// codes (overseas entities have neither code, and abroad there may be no postal code). Checked whenever HR adds or saves
// a company; a company from the VBMS import may lack them until then (importCompany - the user, 2026-11-19).
type EmployerDetails = {
  address?: string | null
  region?: string | null
  countryCode?: string | null
  postalCode?: string | null
  isIndiaPayroll?: boolean
  pfEstablishmentCode?: string | null
  esicEmployerCode?: string | null
}
function assertEmployerDetails(company: EmployerDetails) {
  const noAddress = [!company.address?.trim() && 'address', !company.region?.trim() && 'state / region'].filter(Boolean)
  if (noAddress.length) throw new ORPCError('BAD_REQUEST', { message: `Give the company ${noAddress.join(' and ')}` })
  if ((company.countryCode ?? 'IN') === 'IN' && !/^\d{6}$/.test(company.postalCode ?? '')) {
    throw new ORPCError('BAD_REQUEST', { message: 'An Indian address needs its 6-digit PIN code' })
  }
  if (company.isIndiaPayroll !== false) {
    const missing = [!company.pfEstablishmentCode && 'PF establishment code', !company.esicEmployerCode && 'ESIC employer code'].filter(Boolean)
    if (missing.length) {
      throw new ORPCError('BAD_REQUEST', {
        message: `An India payroll company needs its ${missing.join(' and ')} (printed on EPF Form 11 and ESIC Form 1)`,
      })
    }
  }
}

// An employee code: the company's prefix + the number as at least 6 digits (old HRMS format, e.g. RML035385)
export function formatEmployeeCode(prefix: string, number: number) {
  return prefix + String(number).padStart(6, '0')
}

// The code the company's next employee would get (shown on forms before saving), or null when no series is set.
export function nextEmployeeCodeOf(company: { ecodePrefix: string; nextEmployeeNumber: number | null }) {
  return company.nextEmployeeNumber === null ? null : formatEmployeeCode(company.ecodePrefix, company.nextEmployeeNumber)
}

// Takes the company's next employee code from its series (decided 2026-11-16: one series per company). Call it inside
// the transaction that saves the employee - the company row stays locked until then. The caller skips a code that is
// already used (an imported or hand-typed one) by taking the next. Throws BAD_REQUEST when the series is not set yet.
export async function takeNextEmployeeCode(companyId: number, actorId: ActorId, db?: DbClient) {
  const company = await getCompany(companyId, db)
  const taken = company.nextEmployeeNumber === null ? null : await companiesRepository.takeNextEmployeeNumber(companyId, actorId, db)
  if (!taken) {
    throw new ORPCError('BAD_REQUEST', {
      message: `${company.name} has no employee code series yet - set its next employee number on the Organization page`,
    })
  }
  return formatEmployeeCode(taken.prefix, taken.number)
}

export function createCompany(input: z.infer<typeof createCompanyInput>, actorId: ActorId) {
  assertGstinMatchesPan(input.pan, input.gstin)
  assertEmployerDetails(input)
  return companiesRepository.create(input, actorId)
}

export async function updateCompany({ id, ...changes }: z.infer<typeof updateCompanyInput>, actorId: ActorId) {
  const current = await getCompany(id)
  assertGstinMatchesPan(changes.pan ?? current.pan, changes.gstin ?? current.gstin)
  // the details as they will be after the change
  assertEmployerDetails({
    address: changes.address ?? current.address,
    region: changes.region ?? current.region,
    countryCode: changes.countryCode ?? current.countryCode,
    postalCode: changes.postalCode ?? current.postalCode,
    isIndiaPayroll: changes.isIndiaPayroll ?? current.isIndiaPayroll,
    pfEstablishmentCode: changes.pfEstablishmentCode ?? current.pfEstablishmentCode,
    esicEmployerCode: changes.esicEmployerCode ?? current.esicEmployerCode,
  })
  return companiesRepository.update(id, changes, actorId)
}

// The VBMS import (scripts/import-vbms-masters.ts, the user 2026-11-19): a company with what VBMS has - its state /
// region, PIN and PF / ESIC codes (and maybe its address) stay empty until HR fills them in on the Organization page,
// which needs them all to save it. Codes and names stay unique (the database refuses a duplicate).
export type ImportedCompany = {
  code: string
  name: string
  ecodePrefix: string
  sapCompanyCode: string
  isIndiaPayroll: boolean
  countryCode: string
  address?: string
  gstin?: string
  isActive?: boolean
}
export function importCompany(input: ImportedCompany, actorId: ActorId) {
  return companiesRepository.create(input, actorId)
}

// ...and what a later import changes on a company (its code, name, SAP code; an address or GSTIN it had none of) -
// without the employer-details check, which is HR's when they save the company
export async function updateImportedCompany(id: number, changes: Partial<ImportedCompany>, actorId: ActorId) {
  await getCompany(id)
  return companiesRepository.update(id, changes, actorId)
}

// --- From the API (data access, A4 2026-11-18): a new company is for the whole group; a company's own details need Organization Edit for that whole company ---
export async function createCompanyFor(viewer: CurrentUser, input: z.infer<typeof createCompanyInput>) {
  assertGroupWide(viewer, 'ORGANIZATION', 'A new company')
  return createCompany(input, viewer.employeeId)
}
export async function updateCompanyFor(viewer: CurrentUser, input: z.infer<typeof updateCompanyInput>) {
  assertWholeSlice(viewer, 'ORGANIZATION', { companyId: input.id, plantId: null, departmentId: null }, "The company's details")
  return updateCompany(input, viewer.employeeId)
}
