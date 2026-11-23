import { mobileSchema, nameSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'
import {
  addressesSchema,
  certificationSchema,
  checkMarriage,
  emergencyContactSchema,
  employeeCodeSchema,
  gratuityDeclarationsSchema,
  keptBankAccountSchema,
  keptFamilyMemberSchema,
  keptIdentityDocumentSchema,
  medicalInfoSchema,
  nomineesSchema,
  personalDetailsSchema,
  previousEmploymentSchema,
  qualificationSchema,
  statutorySchema,
} from '../employees.schema.js'

// HR edits an employee's records after joining (phase 5, decided 2026-11-16: employees change nothing themselves -
// they ask HR outside the system, HR makes the change here). The sections and rules are the joining form's (same
// schemas), so a record is always checked the same way. Saved numbers come back only as their last 4 digits and may be
// left out to keep them.

const onePerType = <T extends { type: string }>(items: T[]) => new Set(items.map((item) => item.type)).size === items.length

export const employeeFormSchema = z.object({
  // JF §2: the personal details, with the name and mobile (also on "Edit details")
  personal: personalDetailsSchema
    .extend({
      firstName: nameSchema.optional(),
      middleName: nameSchema.optional(),
      lastName: nameSchema.optional(),
      mobile: mobileSchema.optional(),
      alternateMobile: mobileSchema.optional(),
    })
    .superRefine(checkMarriage),
  addresses: addressesSchema,
  emergencyContacts: z.array(emergencyContactSchema).max(5),
  identityDocuments: z.array(keptIdentityDocumentSchema).max(5).refine(onePerType, 'Only one document of each type'),
  // the salary account
  bankAccount: keptBankAccountSchema,
  // EPF Form 11 / ESIC Form 1 answers - the PF member number stays on "PF and ESIC numbers", the Form F declarations
  // are their own section (as in the joining form)
  statutory: statutorySchema.omit({
    pfNumber: true,
    gratuityNoFamily: true,
    gratuityParentsNotDependent: true,
    gratuityHusbandsParentsNotDependent: true,
    gratuityHusbandExcludedOn: true,
  }),
  qualifications: z.array(qualificationSchema).max(15),
  certifications: z.array(certificationSchema).max(15),
  previousJobs: z.array(previousEmploymentSchema).max(15),
  familyMembers: z.array(keptFamilyMemberSchema).max(15),
  nominees: nomineesSchema,
  gratuity: gratuityDeclarationsSchema.omit({ gratuityNoFamily: true }),
  // health data - Medical information: Edit (checked in the service)
  medical: medicalInfoSchema,
})

export type EmployeeFormSection = keyof typeof employeeFormSchema.shape

export const getEmployeeFormInput = z.object({ employeeCode: employeeCodeSchema })

// Each section sent replaces that whole section; sections not sent are kept
export const saveEmployeeFormInput = employeeFormSchema.partial().extend({ employeeCode: employeeCodeSchema })
