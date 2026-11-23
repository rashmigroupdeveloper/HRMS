import { createHash, randomBytes } from 'node:crypto'
import { createdBy, prisma, SYSTEM_ACTOR } from '#core/db/prisma'
import { candidatesService, offerLettersService } from '#modules/candidates'
import { designationsService } from '#modules/organization'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createCompany, createPlant } from './helpers/organization.js'
import { userWith } from './helpers/users.js'

// The candidate's one-time codes (2026-11-20): at most 5 in a row - the count starts again after 30 minutes without a
// code (a candidate whose e-mails do not arrive is not blocked for good) and when a code is used, e.g. to accept.
describe('one-time codes on the offer link', () => {
  const admin = userWith({ id: 0, employeeCode: 'SYSTEM' }, [], { isSuperAdmin: true })
  const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')
  let companyId: number
  let plantId: number
  let designationId: number
  let templateId: number

  // a sent offer with a known link token (the letter PDF itself is not needed here)
  async function sentOffer() {
    const candidate = await candidatesService.createCandidate(
      {
        firstName: 'Code',
        lastName: 'Test',
        mobile: '9876543210',
        personalEmail: 'code.test@example.com',
        companyId,
        plantId,
        designationId,
        joiningType: 'OVERSEAS',
        employmentType: 'PERMANENT',
        workforceCategory: 'WHITE_COLLAR',
        annualCtc: 1_200_000,
        proposedJoiningDate: new Date(Date.UTC(2099, 0, 15)),
        offerValidUntil: new Date(Date.UTC(2099, 0, 10)),
      },
      admin,
    )
    await candidatesService.recordOfferSent(candidate.id, `TEST/OFFER/${candidate.id}`, SYSTEM_ACTOR)
    const token = randomBytes(32).toString('base64url')
    const letter = await prisma.offerLetter.create({
      data: {
        candidateId: candidate.id,
        revision: 0,
        letterTemplateId: templateId,
        storageKey: `test/offer-${candidate.id}-${token.slice(0, 8)}.pdf`,
        sha256: sha256(token),
        sentAt: new Date(),
        sentById: SYSTEM_ACTOR,
        linkTokenHash: sha256(token),
        ...createdBy(SYSTEM_ACTOR),
      },
      select: { id: true },
    })
    return { token, letterId: letter.id }
  }
  // as if the last code had been sent `minutes` ago
  const lastCodeAgo = (letterId: number, minutes: number) =>
    prisma.offerLetter.update({ where: { id: letterId }, data: { otpSentAt: new Date(Date.now() - minutes * 60_000) } })

  beforeAll(async () => {
    companyId = (await createCompany()).id
    plantId = (await createPlant(companyId)).id
    designationId = (await designationsService.createDesignation({ name: `Test Designation ${companyId}-${Date.now()}` }, SYSTEM_ACTOR)).id
    templateId = (
      await prisma.letterTemplate.create({
        data: { kind: 'OFFER_LETTER', name: `Test template ${Date.now()}`, body: '{}', ...createdBy(SYSTEM_ACTOR) },
        select: { id: true },
      })
    ).id
  })
  afterAll(() => prisma.$disconnect())

  it('stops after 5 codes in a row and allows them again after 30 minutes without a code', async () => {
    const { token, letterId } = await sentOffer()
    for (let i = 0; i < 5; i++) {
      await offerLettersService.sendCode(token)
      await lastCodeAgo(letterId, 2) // past the one-a-minute rule
    }
    await expect(offerLettersService.sendCode(token)).rejects.toThrow(/Too many codes were asked for\. Please try again in 2\d minutes/)
    await lastCodeAgo(letterId, 31)
    await expect(offerLettersService.sendCode(token)).resolves.toMatchObject({ validMinutes: 10 })
    const letter = await prisma.offerLetter.findUniqueOrThrow({ where: { id: letterId }, select: { otpSentCount: true } })
    expect(letter.otpSentCount).toBe(1)
  })

  it('starts the count again when the code is used to accept', async () => {
    const { token, letterId } = await sentOffer()
    for (let i = 0; i < 3; i++) {
      await offerLettersService.sendCode(token)
      await lastCodeAgo(letterId, 2)
    }
    // the code the candidate got (only its hash is stored - set a known one)
    await prisma.offerLetter.update({ where: { id: letterId }, data: { otpHash: sha256(`${letterId}:123456`), otpValidUntil: new Date(Date.now() + 600_000) } })
    await offerLettersService.acceptOnline({ token, code: '123456', name: 'Code Test' }, { ip: null, userAgent: null })
    const letter = await prisma.offerLetter.findUniqueOrThrow({ where: { id: letterId }, select: { otpSentCount: true, otpFailedAttempts: true, response: true } })
    expect(letter).toEqual({ otpSentCount: 0, otpFailedAttempts: 0, response: 'ACCEPTED' })
  })
})
