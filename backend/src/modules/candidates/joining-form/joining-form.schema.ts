import { employeesSchemas } from '#modules/employees'
import { idSchema, mobileSchema, nameSchema } from '#shared/schemas/common.schema'
import { z } from 'zod'

// The joining-form draft of a candidate: one section per employee table, validated with the employees module's
// own schemas, so the draft can always be turned into employee rows on the joining day.
// Filled by the candidate on their page (candidates.portal.*) and / or by HR (candidates.joiningForm.*).

const onePerType = <T extends { type: string }>(items: T[]) => new Set(items.map((item) => item.type)).size === items.length

export const joiningFormSchema = z.object({
  // JF §2. With the name as on the candidate's documents and their own mobile: HR types both on the offer and may
  // get them wrong, so the candidate (or HR) corrects them here - the offer stays as it was sent. Without them here
  // the offer's are used. (The personal e-mail is not part of the form: the candidate's codes go to it, so only HR
  // changes it, on the candidate.)
  personal: employeesSchemas.personalDetailsSchema
    .extend({
      firstName: nameSchema.optional(),
      middleName: nameSchema.optional(),
      lastName: nameSchema.optional(),
      mobile: mobileSchema.optional(),
      // a second number to reach them on (not on the offer)
      alternateMobile: mobileSchema.optional(),
    })
    .superRefine(employeesSchemas.checkMarriage),
  // JF §3
  // permanent and present (both needed to join - the present one may be a copy of the permanent), plus up to 3 others
  addresses: employeesSchemas.addressesSchema,
  // JF §9
  emergencyContacts: z.array(employeesSchemas.emergencyContactSchema).max(5),
  // JF §2 / §4
  identityDocuments: z
    .array(employeesSchemas.identityDocumentSchema)
    .max(5)
    .refine(onePerType, 'Only one document of each type'),
  // JF §5
  bankAccount: employeesSchemas.bankAccountSchema,
  // JF §4, EPF Form 11, ESIC Form 1. The PF member number is allotted by the employer after joining, so it is not
  // part of the draft
  statutory: employeesSchemas.statutorySchema.omit({
    pfNumber: true,
    // asked with the nominees (the `gratuity` section)
    gratuityNoFamily: true,
    gratuityParentsNotDependent: true,
    gratuityHusbandsParentsNotDependent: true,
    gratuityHusbandExcludedOn: true,
  }),
  // JF §6, §7, §8
  qualifications: z.array(employeesSchemas.qualificationSchema).max(15),
  certifications: z.array(employeesSchemas.certificationSchema).max(15),
  previousJobs: z.array(employeesSchemas.previousEmploymentSchema).max(15),
  // JF family details + ESIC Form 1 family
  familyMembers: z.array(employeesSchemas.familyMemberSchema).max(15),
  // "I have no family members to list" - lets someone with nobody to list complete the family details (decided
  // 2026-11-15). Only in the draft: on the joining day the employee simply has no family rows
  noFamilyMembers: z.boolean(),
  // JF §4 nominee, Gratuity Form F, ESIC Form 1
  nominees: employeesSchemas.nomineesSchema,
  // Gratuity Form F declarations (Regular) - saved with the PF / ESIC answers on the joining day. "I have no family"
  // is not asked: it is worked out from the family details and these answers (gratuityNoFamilyOf, 2026-11-15)
  gratuity: employeesSchemas.gratuityDeclarationsSchema.omit({ gratuityNoFamily: true }),
  // the "Employee Medical Information" pages (Regular and Consultant & Intern) - health data, given with consent
  medical: employeesSchemas.medicalInfoSchema.extend({
    consent: z.literal(true, { error: 'Please agree to share your medical information with the company' }),
  }),
})

export const JOINING_FORM_SECTIONS = Object.keys(joiningFormSchema.shape) as (keyof typeof joiningFormSchema.shape)[]
export type JoiningFormSection = (typeof JOINING_FORM_SECTIONS)[number]

// A draft can be incomplete: any section may be missing until the joining day.
export type JoiningForm = Partial<z.output<typeof joiningFormSchema>>

export const getJoiningFormInput = z.object({ candidateId: idSchema })

// Each section sent replaces that whole section; sections not sent are kept.
// `loadedAt`: when the form being edited was loaded - if someone else (HR / the candidate) changed one of the sent
// sections since then, the save is refused instead of silently overwriting their change.
export const saveJoiningFormInput = joiningFormSchema.partial().extend({ candidateId: idSchema, loadedAt: z.date().optional() })

// HR sends the submitted form back to the candidate for changes; the reason is e-mailed to them
export const sendBackJoiningFormInput = z.object({
  candidateId: idSchema,
  reason: z.string().trim().min(1, 'Tell the candidate what to change').max(1000),
})
