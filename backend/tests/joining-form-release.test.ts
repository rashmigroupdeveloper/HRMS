import { prisma, SYSTEM_ACTOR } from '#core/db/prisma'
import { candidateDocumentsService, candidatesService } from '#modules/candidates'
import { designationsService } from '#modules/organization'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createCompany, createPlant } from './helpers/organization.js'
import { userWith } from './helpers/users.js'

// When the joining form opens (the user, 2026-11-20): chosen on the offer - at acceptance (joiningFormOnAcceptance), or
// later when HR sends its link (the default).
describe('joining form release', () => {
  let companyId: number
  let plantId: number
  let designationId: number
  const admin = userWith({ id: 0, employeeCode: 'SYSTEM' }, [], { isSuperAdmin: true })

  const offer = (joiningFormOnAcceptance?: boolean) => ({
    firstName: 'Candidate',
    mobile: '9876543210',
    companyId,
    plantId,
    designationId,
    joiningType: 'OVERSEAS' as const,
    employmentType: 'PERMANENT' as const,
    workforceCategory: 'WHITE_COLLAR' as const,
    annualCtc: 1_200_000,
    proposedJoiningDate: new Date(Date.UTC(2027, 0, 15)),
    ...(joiningFormOnAcceptance !== undefined && { joiningFormOnAcceptance }),
  })
  // a sent offer (the letter itself is not needed here)
  const sentOffer = async (joiningFormOnAcceptance?: boolean) => {
    const candidate = await candidatesService.createCandidate(offer(joiningFormOnAcceptance), admin)
    await candidatesService.recordOfferSent(candidate.id, `TEST/OFFER/${candidate.id}`, SYSTEM_ACTOR)
    return candidate.id
  }

  beforeAll(async () => {
    companyId = (await createCompany()).id
    plantId = (await createPlant(companyId)).id
    designationId = (await designationsService.createDesignation({ name: `Test Designation ${companyId}-${Date.now()}` }, SYSTEM_ACTOR)).id
  })
  afterAll(() => prisma.$disconnect())

  it('waits for HR by default: accepting does not open the joining form, sending the link does', async () => {
    const id = await sentOffer()
    const accepted = await candidatesService.recordOfferAccepted(id, SYSTEM_ACTOR)
    expect(accepted).toMatchObject({ status: 'ACCEPTED', joiningFormOnAcceptance: false, joiningFormOpenedAt: null })
    const opened = await candidatesService.recordJoiningFormOpened(id, 7)
    expect(opened.joiningFormOpenedAt).toBeInstanceOf(Date)
    // a second link keeps when it was first opened
    const again = await candidatesService.recordJoiningFormOpened(id, 8)
    expect(again.joiningFormOpenedAt).toEqual(opened.joiningFormOpenedAt)
  })

  it('opens the joining form at acceptance when the offer says so', async () => {
    const id = await sentOffer(true)
    const accepted = await candidatesService.recordOfferAccepted(id, SYSTEM_ACTOR)
    expect(accepted.joiningFormOpenedAt).toBeInstanceOf(Date)
  })

  it('changing the choice keeps a sent offer sent (it is not on the letter), but is locked once accepted', async () => {
    const id = await sentOffer()
    await expect(candidatesService.updateCandidate({ id, joiningFormOnAcceptance: true }, admin)).resolves.toMatchObject({
      status: 'OFFERED',
      joiningFormOnAcceptance: true,
    })
    await candidatesService.recordOfferAccepted(id, SYSTEM_ACTOR)
    await expect(candidatesService.updateCandidate({ id, joiningFormOnAcceptance: false }, admin)).rejects.toThrow('cannot change')
  })

  // documents an offer asks for on top of the pack's (the user, 2026-11-20)
  it("adds the offer's documents to the pack's compulsory ones, without duplicates", () => {
    const regular = candidateDocumentsService.requiredDocuments('REGULAR', false, ['CLASS_X_MARKSHEET', 'PHOTO'])
    expect(regular).toContain('CLASS_X_MARKSHEET')
    expect(regular.filter((t) => t === 'PHOTO')).toHaveLength(1)
    expect(regular).not.toContain('ESIC_FORM_1')
  })

  it('keeps a sent offer sent when the documents change, and lets them change after acceptance', async () => {
    const id = await sentOffer()
    await expect(candidatesService.updateCandidate({ id, extraRequiredDocuments: ['CLASS_X_MARKSHEET', 'CLASS_X_MARKSHEET'] }, admin)).resolves.toMatchObject({
      status: 'OFFERED',
      extraRequiredDocuments: ['CLASS_X_MARKSHEET'],
    })
    await candidatesService.recordOfferAccepted(id, SYSTEM_ACTOR)
    await expect(candidatesService.updateCandidate({ id, extraRequiredDocuments: ['GRADUATION_CERTIFICATE'] }, admin)).resolves.toMatchObject({
      extraRequiredDocuments: ['GRADUATION_CERTIFICATE'],
    })
  })
})

// A nominee under 18 needs a guardian; nobody else has one (the user, 2026-11-20)
describe('minor nominee guardian', () => {
  const born = (yearsAgo: number) => {
    const d = new Date()
    return new Date(Date.UTC(d.getFullYear() - yearsAgo, d.getMonth(), d.getDate()))
  }
  const nominee = (extra: Record<string, unknown>) => ({ scheme: 'GENERAL' as const, name: 'Aarav', relationship: 'Son', ...extra })

  it('asks the guardian for a nominee under 18 and refuses one for an adult', async () => {
    const { employeesSchemas } = await import('#modules/employees')
    const parse = (n: Record<string, unknown>) => employeesSchemas.nomineesSchema.safeParse([nominee(n)]).success
    expect(parse({ dateOfBirth: born(9) })).toBe(false)
    expect(parse({ dateOfBirth: born(9), guardianName: 'Anjali Rathore', guardianAddress: 'Salt Lake, Kolkata' })).toBe(true)
    expect(parse({ dateOfBirth: born(30), guardianName: 'Anjali Rathore', guardianAddress: 'Salt Lake, Kolkata' })).toBe(false)
    expect(parse({ dateOfBirth: born(30) })).toBe(true)
  })
})
