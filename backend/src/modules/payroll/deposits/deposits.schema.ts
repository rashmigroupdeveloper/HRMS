import { z } from 'zod'
import { DepositGapReason, StatutoryScheme } from '#core/db/prisma'
import { hasPaiseOnly } from '#shared/utils/money'

// Payroll stage 6 slice 3 (approved by the user 2026-11-28): statutory deposits - what the approved runs must deposit to
// PF, ESIC, professional tax and LWF, the returns / challans recorded, and the people left out of a PF or ESIC return

const id = z.number().int().positive()
const page = z.number().int().min(1).max(100000).default(1)
const pageSize = z.number().int().min(1).max(200).default(50)
// a calendar day (midnight UTC, as the date pickers send it)
const day = z.date().refine((d) => d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0, 'Choose a day')
// a pay month: its first day
const payMonth = day.refine((d) => d.getUTCDate() === 1, 'A pay month is given by its first day')
// a State as work locations name it (WorkLocation.stateCode), e.g. WB
const stateCode = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'A 2-letter State code, e.g. WB')
const money = z.number().min(0).max(9_999_999_999).refine(hasPaiseOnly, { message: 'At most 2 decimals' })
const reference = z.string().trim().min(1, 'Give the reference').max(100)
const note = z.string().trim().max(500)

// The schemes whose returns go person by person: the people left out of them are followed
export const PERSON_SCHEMES = ['PF', 'ESIC'] as const
export type PersonScheme = (typeof PERSON_SCHEMES)[number]
// Schemes deposited per State (the work location's State)
export const byState = (scheme: StatutoryScheme) => scheme === 'PROFESSIONAL_TAX' || scheme === 'LWF'

// Where a scheme's month stands. DEPOSITED: everything due is deposited; PEOPLE_LEFT_OUT: all but the people left out of the
// return; FILED_NOT_PAID: a return / challan made, not paid; SHORT: less deposited than due; MORE_THAN_DUE: more than due
// (to check); NOT_DEPOSITED: nothing yet
export const DEPOSIT_STATES = ['NOT_DEPOSITED', 'FILED_NOT_PAID', 'SHORT', 'MORE_THAN_DUE', 'PEOPLE_LEFT_OUT', 'DEPOSITED'] as const
export type DepositState = (typeof DEPOSIT_STATES)[number]

// The schemes' months in the scope: the open ones (anything not fully deposited) or all - of one company
export const listInput = z.object({ companyId: id.optional(), show: z.enum(['OPEN', 'ALL']).default('OPEN'), page, pageSize }).strict()

// One company's pay month
export const monthInput = z.object({ companyId: id, payMonth }).strict()

// The people of a month's PF or ESIC: all, the ones left out, the ones with no UAN / ESIC number not left out yet
export const peopleInput = z
  .object({
    companyId: id,
    payMonth,
    scheme: z.enum(PERSON_SCHEMES),
    show: z.enum(['ALL', 'LEFT_OUT', 'NO_NUMBER']).default('ALL'),
    search: z.string().trim().max(100).optional(),
    page,
    pageSize,
  })
  .strict()

const paid = z.object({ paidOn: day, paymentReference: reference }).strict()

// A return / challan filed (and maybe paid at once): professional tax and LWF of one State, PF and ESIC without one. `takeIn`:
// people left out of an earlier PF / ESIC return of the month this one takes in (a supplementary return) - in the same step,
// so the month never shows more deposited than due in between
export const recordInput = z
  .object({
    companyId: id,
    payMonth,
    scheme: z.enum(StatutoryScheme),
    stateCode: stateCode.nullable(),
    reference,
    filedOn: day,
    contributions: money,
    otherCharges: money.default(0),
    paid: paid.optional(),
    note: note.optional(),
    takeIn: z.array(id).min(1).max(1000).optional(),
  })
  .strict()
  .refine((d) => byState(d.scheme) === (d.stateCode !== null), { message: 'Professional tax and LWF are deposited per State (give it); PF and ESIC without one', path: ['stateCode'] })

// Corrections of a recorded return / challan; `paid` only for one already paid (its day and reference)
export const updateInput = z
  .object({ id, reference, filedOn: day, contributions: money, otherCharges: money, note: note.optional(), paid: paid.optional() })
  .strict()

export const markPaidInput = z.object({ id, paidOn: day, paymentReference: reference }).strict()

export const depositInput = z.object({ id }).strict()

// These people of a month's runs left out of the PF or ESIC return, with why
export const leaveOutInput = z
  .object({ companyId: id, payMonth, scheme: z.enum(PERSON_SCHEMES), personIds: z.array(id).min(1).max(1000), reason: z.enum(DepositGapReason), note: z.string().trim().max(300).optional() })
  .strict()
  .refine((d) => d.reason !== 'OTHER' || (d.note?.length ?? 0) >= 3, { message: 'Say what is wrong (at least 3 characters)', path: ['note'] })

// People left out, taken in by a later deposit of the same month and scheme - or not after all (null)
export const takeInInput = z.object({ gapIds: z.array(id).min(1).max(1000), depositId: id.nullable() }).strict()

// Marks of people left out taken away (marked by mistake) - only while not taken in
export const removeGapsInput = z.object({ gapIds: z.array(id).min(1).max(1000) }).strict()

export type ListInput = z.infer<typeof listInput>
export type MonthInput = z.infer<typeof monthInput>
export type PeopleInput = z.infer<typeof peopleInput>
export type RecordInput = z.infer<typeof recordInput>
export type UpdateInput = z.infer<typeof updateInput>
export type MarkPaidInput = z.infer<typeof markPaidInput>
export type LeaveOutInput = z.infer<typeof leaveOutInput>
export type TakeInInput = z.infer<typeof takeInInput>
export type RemoveGapsInput = z.infer<typeof removeGapsInput>
