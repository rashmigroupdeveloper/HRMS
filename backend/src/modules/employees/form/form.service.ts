import { encrypt, fingerprint, last4 } from '#core/crypto/encryption'
import { prisma, type ActorId, type DbClient } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { stableJson } from '#core/audit/hash'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import { bankAccountSchema, familyMemberSchema, identityDocumentSchema, MEDICAL_CONSENT_TEXT, normaliseIdentityNumber } from '../employees.schema.js'
import { assertPart, checkEmploymentDates, getEmployeeFor, seesPart, type RecordPart } from '../employees.service.js'
import * as employeesRepository from '../employees.repository.js'
import * as formRepository from './form.repository.js'
import type { saveEmployeeFormInput } from './form.schema.js'

// HR edits an employee's records after joining (phase 5, 2026-11-16). Each section belongs to an area (split
// 2026-11-16, SECTION_AREA): seeing it needs that area's View, saving it its Edit - always with "Employee directory &
// job" View (the router). Canonical profile edits remain with HR; document submissions use employees.documents.*.
// - The sections are the joining form's and are checked with the same schemas (form.schema.ts).
// - Saved numbers (Aadhaar, PAN, passport, bank account, a family member's Aadhaar) leave only as their last 4 digits;
//   a number left empty keeps the saved one (identity documents by type, the bank account, a family member by name +
//   last 4). A new identity number may not belong to another employee.
// - A section replaces what was there; a list section that did not change is not rewritten (so the change history
//   only shows real changes).

type Row = formRepository.EmployeeFormRow
type Input = z.infer<typeof saveEmployeeFormInput>
type Section = Exclude<keyof Input, 'employeeCode'>

// Which area each section belongs to
const SECTION_AREA: Record<Section, RecordPart> = {
  personal: 'EMPLOYEE_PERSONAL_DETAILS',
  addresses: 'EMPLOYEE_PERSONAL_DETAILS',
  emergencyContacts: 'EMPLOYEE_PERSONAL_DETAILS',
  qualifications: 'EMPLOYEE_PERSONAL_DETAILS',
  certifications: 'EMPLOYEE_PERSONAL_DETAILS',
  previousJobs: 'EMPLOYEE_PERSONAL_DETAILS',
  familyMembers: 'EMPLOYEE_PERSONAL_DETAILS',
  nominees: 'EMPLOYEE_PERSONAL_DETAILS',
  gratuity: 'EMPLOYEE_PERSONAL_DETAILS',
  identityDocuments: 'EMPLOYEE_IDS_BANK',
  bankAccount: 'EMPLOYEE_IDS_BANK',
  statutory: 'EMPLOYEE_IDS_BANK',
  medical: 'MEDICAL',
}

const stripNulls = <T extends Record<string, unknown>>(row: T) =>
  Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null && v !== undefined)) as { [K in keyof T]?: NonNullable<T[K]> }

// The employee's records in the joining form's sections, numbers as their last 4 digits - only the sections the viewer
// may see (their area's View).
export async function getForm(viewer: CurrentUser, employeeCode: string) {
  // own record, or inside the viewer's data access ("not found" otherwise)
  const employee = await getEmployeeFor(viewer, employeeCode)
  const row = await getRow(employeeCode)
  const form = toForm(row, true)
  const shown = Object.fromEntries(Object.entries(form).filter(([section]) => seesPart(viewer, employee, SECTION_AREA[section as Section])))
  return { joiningType: row.joiningType, form: shown as Partial<typeof form> }
}

async function getRow(employeeCode: string, db?: DbClient) {
  const row = await formRepository.findForm(employeeCode, db)
  if (!row) throw new ORPCError('NOT_FOUND', { message: `No employee found with code ${employeeCode}` })
  return row
}

function toForm(row: Row, seesMedical: boolean) {
  const statutory = row.statutory ? stripNulls(row.statutory) : null
  const bank = row.bankAccounts[0]
  return {
    personal: stripNulls({
      firstName: row.firstName,
      middleName: row.middleName,
      lastName: row.lastName,
      mobile: row.mobile,
      alternateMobile: row.alternateMobile,
      fatherName: row.fatherName,
      motherName: row.motherName,
      gender: row.gender,
      dateOfBirth: row.dateOfBirth,
      placeOfBirth: row.placeOfBirth,
      maritalStatus: row.maritalStatus,
      spouseName: row.spouseName,
      marriageDate: row.marriageDate,
      countryOfOrigin: row.countryOfOrigin,
      nationality: row.nationality,
      religion: row.religion,
      category: row.category,
      bloodGroup: row.bloodGroup,
      heightCm: row.heightCm,
      weightKg: row.weightKg,
      identificationMark: row.identificationMark,
      hobbies: row.hobbies,
      isPhysicallyDisabled: row.isPhysicallyDisabled,
      disabilityType: row.disabilityType,
      disabilityPercent: row.disabilityPercent,
    }),
    addresses: row.addresses.map(stripNulls),
    emergencyContacts: row.emergencyContacts.map(stripNulls),
    identityDocuments: row.identityDocuments.map(({ numberEncrypted: _n, numberHash: _h, ...doc }) => stripNulls(doc)),
    bankAccount: bank ? stripNulls((({ accountNumberEncrypted: _a, isSalaryAccount: _s, ...rest }) => rest)(bank)) : undefined,
    statutory: statutory
      ? (({ pfNumber: _p, gratuityNoFamily: _g, gratuityParentsNotDependent: _a, gratuityHusbandsParentsNotDependent: _b, gratuityHusbandExcludedOn: _c, ...rest }) => rest)(statutory)
      : undefined,
    gratuity: statutory
      ? stripNulls({
          gratuityParentsNotDependent: statutory.gratuityParentsNotDependent,
          gratuityHusbandsParentsNotDependent: statutory.gratuityHusbandsParentsNotDependent,
          gratuityHusbandExcludedOn: statutory.gratuityHusbandExcludedOn,
        })
      : undefined,
    qualifications: row.qualifications.map(stripNulls),
    certifications: row.certifications.map(stripNulls),
    previousJobs: row.previousJobs.map(stripNulls),
    familyMembers: row.familyMembers.map(({ aadhaarEncrypted: _a, ...member }) => stripNulls(member)),
    nominees: row.nominees.map(stripNulls),
    medical: seesMedical && row.medicalInfo ? (({ consentAt: _c, consentById: _b, consentText: _t, ...rest }) => stripNulls(rest))(row.medicalInfo) : undefined,
  }
}

// Saves the sections sent, in one transaction, then returns the form as it is now.
export async function saveForm(viewer: CurrentUser, { employeeCode, ...sections }: Input) {
  // each section sent needs Edit on its area, covering where the employee is (data access)
  const employee = await getEmployeeFor(viewer, employeeCode)
  for (const section of Object.keys(sections) as Section[]) {
    if (sections[section] !== undefined) assertPart(viewer, employee, SECTION_AREA[section], 'WRITE')
  }
  const actorId = viewer.employeeId
  await prisma.$transaction(async (tx) => {
    const row = await getRow(employeeCode, tx)
    const id = row.id
    // the same rows, in any order (the database keeps its own order, e.g. addresses by type)
    const same = (a: unknown[], b: unknown[]) => stableJson(a.map(stableJson).sort()) === stableJson(b.map(stableJson).sort())

    if (sections.personal) {
      const { firstName, middleName, lastName, mobile, alternateMobile, ...personal } = sections.personal
      checkEmploymentDates({
        dateOfBirth: personal.dateOfBirth,
        dateOfJoining: row.dateOfJoining,
        employmentType: row.employmentType,
        contractEndDate: row.contractEndDate,
        probationEndDate: row.probationEndDate,
        confirmationDate: row.confirmationDate,
      })
      // the whole section is replaced: an answer left out is cleared (the name and mobile are kept when not sent)
      const cleared = Object.fromEntries(PERSONAL_FIELDS.map((field) => [field, personal[field] ?? null]))
      await employeesRepository.update(
        id,
        {
          ...cleared,
          isPhysicallyDisabled: personal.isPhysicallyDisabled ?? false,
          ...(firstName !== undefined && { firstName }),
          middleName: middleName ?? null,
          lastName: lastName ?? null,
          ...(mobile !== undefined && { mobile }),
          alternateMobile: alternateMobile ?? null,
        },
        actorId,
        tx,
      )
    }
    if (sections.addresses && !same(sections.addresses, row.addresses.map(stripNulls))) {
      await formRepository.replaceAddresses(id, sections.addresses, actorId, tx)
    }
    if (sections.emergencyContacts && !same(sections.emergencyContacts, row.emergencyContacts.map(stripNulls))) {
      await formRepository.replaceEmergencyContacts(id, sections.emergencyContacts, actorId, tx)
    }
    if (sections.identityDocuments) await saveIdentityDocuments(row, sections.identityDocuments, actorId, tx)
    if (sections.bankAccount) await saveBankAccount(row, sections.bankAccount, actorId, tx)
    if (sections.statutory) {
      const answers = Object.fromEntries(STATUTORY_FIELDS.map((field) => [field, (sections.statutory as Record<string, unknown>)[field] ?? null]))
      // these three are yes / no answers that are never empty: left out = No
      for (const field of ['pfApplicable', 'esicApplicable', 'isInternationalWorker']) answers[field] ??= false
      await formRepository.upsertStatutory(id, answers, actorId, tx)
    }
    if (sections.gratuity) {
      await formRepository.upsertStatutory(
        id,
        {
          gratuityParentsNotDependent: sections.gratuity.gratuityParentsNotDependent ?? null,
          gratuityHusbandsParentsNotDependent: sections.gratuity.gratuityHusbandsParentsNotDependent ?? null,
          gratuityHusbandExcludedOn: sections.gratuity.gratuityHusbandExcludedOn ?? null,
        },
        actorId,
        tx,
      )
    }
    if (sections.qualifications && !same(sections.qualifications, row.qualifications.map(stripNulls))) {
      await formRepository.replaceQualifications(id, sections.qualifications, actorId, tx)
    }
    if (sections.certifications && !same(sections.certifications, row.certifications.map(stripNulls))) {
      await formRepository.replaceCertifications(id, sections.certifications, actorId, tx)
    }
    if (sections.previousJobs && !same(sections.previousJobs, row.previousJobs.map(stripNulls))) {
      await formRepository.replacePreviousJobs(id, sections.previousJobs, actorId, tx)
    }
    if (sections.familyMembers) await saveFamilyMembers(row, sections.familyMembers, actorId, tx)
    if (sections.nominees && !same(sections.nominees, row.nominees.map(stripNulls))) {
      await formRepository.replaceNominees(id, sections.nominees, actorId, tx)
    }
    if (sections.medical) {
      const answers = Object.fromEntries(MEDICAL_FIELDS.map((field) => [field, (sections.medical as Record<string, unknown>)[field] ?? null]))
      // someone without medical information yet (e.g. added directly): the consent was given to HR, now
      const consent = row.medicalInfo ? {} : { consentAt: new Date(), consentById: actorId, consentText: MEDICAL_CONSENT_TEXT }
      await formRepository.upsertMedicalInfo(id, { ...answers, conditions: sections.medical.conditions ?? [], sports: sections.medical.sports ?? [], ...consent }, actorId, tx)
    }
  })
  return getForm(viewer, employeeCode)
}

// --- the numbers ---

const missing = (what: string): never => {
  throw new ORPCError('BAD_REQUEST', { message: `Enter the ${what}` })
}

async function saveIdentityDocuments(row: Row, docs: NonNullable<Input['identityDocuments']>, actorId: ActorId, db: DbClient) {
  const rows = []
  for (const doc of docs) {
    const saved = row.identityDocuments.find((s) => s.type === doc.type)
    const { number, ...details } = doc
    if (number === undefined) {
      // kept: the saved number stays as it is
      if (!saved) missing(`${doc.type.replace('_', ' ').toLowerCase()} number`)
      rows.push({ ...details, numberEncrypted: saved!.numberEncrypted, numberLast4: saved!.numberLast4, numberHash: saved!.numberHash })
      continue
    }
    const checked = identityDocumentSchema.parse({ ...details, number: normaliseIdentityNumber(number) })
    const numberHash = fingerprint(checked.number)
    const owner = await formRepository.findOtherIdentityOwner(row.id, doc.type, numberHash, db)
    if (owner) throw new ORPCError('CONFLICT', { message: `This ${doc.type} number already belongs to employee ${owner.employee.employeeCode} (${owner.employee.status})` })
    const { number: plain, ...rest } = checked
    rows.push({ ...rest, numberEncrypted: encrypt(plain), numberLast4: last4(plain), numberHash })
  }
  const unchanged = stableJson(rows.map(stripNulls).map(stableJson).sort()) === stableJson(row.identityDocuments.map(stripNulls).map(stableJson).sort())
  if (!unchanged) await formRepository.replaceIdentityDocuments(row.id, rows, actorId, db)
}

async function saveBankAccount(row: Row, input: NonNullable<Input['bankAccount']>, actorId: ActorId, db: DbClient) {
  const saved = row.bankAccounts[0]
  const { accountNumber, ...details } = input
  const number = accountNumber ? bankAccountSchema.shape.accountNumber.parse(accountNumber) : undefined
  if (!number && !saved) missing('bank account number')
  const account = {
    bankName: details.bankName,
    branch: details.branch ?? null,
    accountHolderName: details.accountHolderName,
    ifsc: details.ifsc ?? null,
    accountType: details.accountType,
    accountNumberEncrypted: number ? encrypt(number) : saved!.accountNumberEncrypted,
    accountNumberLast4: number ? last4(number) : saved!.accountNumberLast4,
  }
  const before = saved && { bankName: saved.bankName, branch: saved.branch, accountHolderName: saved.accountHolderName, ifsc: saved.ifsc, accountType: saved.accountType }
  const after = { bankName: account.bankName, branch: account.branch, accountHolderName: account.accountHolderName, ifsc: account.ifsc, accountType: account.accountType }
  if (saved && !number && stableJson(before) === stableJson(after)) return
  await formRepository.replaceSalaryAccount(row.id, account, actorId, db)
}

async function saveFamilyMembers(row: Row, members: NonNullable<Input['familyMembers']>, actorId: ActorId, db: DbClient) {
  const rows = members.map(({ aadhaarLast4, aadhaar, ...member }) => {
    familyMemberSchema.parse({ ...member, aadhaar })
    if (aadhaar) return { ...member, aadhaarEncrypted: encrypt(aadhaar), aadhaarLast4: last4(aadhaar) }
    if (!aadhaarLast4) return member
    // kept: the same person (name) with the same last 4 digits
    const kept = row.familyMembers.find((s) => s.aadhaarEncrypted && s.aadhaarLast4 === aadhaarLast4 && s.name.trim().toLowerCase() === member.name.trim().toLowerCase())
    if (!kept) missing(`Aadhaar number of ${member.name} again`)
    return { ...member, aadhaarEncrypted: kept!.aadhaarEncrypted, aadhaarLast4: kept!.aadhaarLast4 }
  })
  const unchanged = stableJson(rows.map(stripNulls).map(stableJson).sort()) === stableJson(row.familyMembers.map(stripNulls).map(stableJson).sort())
  if (!unchanged) await formRepository.replaceFamilyMembers(row.id, rows, actorId, db)
}

// The columns each replaced section clears when left out
const PERSONAL_FIELDS = [
  'fatherName',
  'motherName',
  'gender',
  'dateOfBirth',
  'placeOfBirth',
  'maritalStatus',
  'spouseName',
  'marriageDate',
  'countryOfOrigin',
  'nationality',
  'religion',
  'category',
  'bloodGroup',
  'heightCm',
  'weightKg',
  'identificationMark',
  'hobbies',
  'disabilityType',
  'disabilityPercent',
] as const
const STATUTORY_FIELDS = [
  'pfApplicable',
  'uan',
  'epfRelative',
  'aadhaarMobile',
  'isInternationalWorker',
  'wasEpfMember',
  'wasEpsMember',
  'previousPfNumber',
  'previousExitDate',
  'schemeCertificateNumber',
  'ppoNumber',
  'firstEpfEnrolledOn',
  'firstEpfWages',
  'isEpfMemberBeforeSep2014',
  'epfWithdrawn',
  'epsWithdrawn',
  'epsWithdrawnAfterSep2014',
  'esicApplicable',
  'esicIpNumber',
  'esicBranchOffice',
  'esicDispensary',
  'previousEsicIpNumber',
  'previousEmployerCode',
  'previousEmployerName',
  'previousEmployerAddress',
  'previousEmployerContact',
] as const
const MEDICAL_FIELDS = [
  'otherConditions',
  'takesMedication',
  'medications',
  'hasPhysicalLimitations',
  'physicalLimitations',
  'hadSurgery',
  'surgeries',
  'hasAllergies',
  'allergies',
  'familyHeartDisease',
  'familyDiabetes',
  'familyHighBloodPressure',
  'familyCancer',
  'familyStroke',
  'familyMentalHealth',
  'familyGeneticDisorders',
  'familyOther',
  'hasHereditaryCondition',
  'hereditaryCondition',
  'needsHealthLeave',
  'healthLeave',
  'smokes',
  'drinksAlcohol',
  'exercisesRegularly',
  'exerciseFrequency',
  'needsEmergencyCare',
  'emergencyCare',
  'otherSports',
  'sportsFrequency',
] as const
