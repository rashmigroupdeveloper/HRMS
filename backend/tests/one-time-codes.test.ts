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

// Found in the 2026-11-23 review: each wrong code read the count of wrong tries and wrote count + 1, so guesses sent at the
// same moment counted once - any number of guesses per code. Now each try is taken in the database before it is checked.
describe('wrong codes sent at the same moment', () => {
  const admin = userWith({ id: 0, employeeCode: 'SYSTEM' }, [], { isSuperAdmin: true })
  const proof = { ip: '203.0.113.9', userAgent: 'test' }

  it('counts every guess: after 5 wrong ones the code stops working, however many come at once', async () => {
    const companyId = (await createCompany()).id
    const plantId = (await createPlant(companyId)).id
    const designationId = (await designationsService.createDesignation({ name: `Guess test ${companyId}-${Date.now()}` }, SYSTEM_ACTOR)).id
    const templateId = (
      await prisma.letterTemplate.create({ data: { kind: 'OFFER_LETTER', name: `Guess template ${Date.now()}`, body: '{}', ...createdBy(SYSTEM_ACTOR) }, select: { id: true } })
    ).id
    const candidate = await candidatesService.createCandidate(
      {
        firstName: 'Guess',
        mobile: '9876543210',
        personalEmail: 'guess.test@example.com',
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
    await candidatesService.recordOfferSent(candidate.id, `TEST/GUESS/${candidate.id}`, SYSTEM_ACTOR)
    const token = randomBytes(32).toString('base64url')
    const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')
    const letter = await prisma.offerLetter.create({
      data: { candidateId: candidate.id, revision: 0, letterTemplateId: templateId, storageKey: `test/guess-${candidate.id}.pdf`, sha256: sha256(token), sentAt: new Date(), sentById: SYSTEM_ACTOR, linkTokenHash: sha256(token), ...createdBy(SYSTEM_ACTOR) },
      select: { id: true },
    })
    await offerLettersService.sendCode(token)
    // 12 guesses at once (a wrong guess is right once in a million - none of these is the code)
    const guesses = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => offerLettersService.declineOnline({ token, code: String(100000 + i * 7919) }, proof)))
    expect(guesses.every((g) => g.status === 'rejected')).toBe(true)
    const after = await prisma.offerLetter.findUniqueOrThrow({ where: { id: letter.id }, select: { otpFailedAttempts: true, otpHash: true } })
    expect(after.otpFailedAttempts).toBe(5)
    expect(after.otpHash).toBeNull()
    expect((await prisma.candidate.findUniqueOrThrow({ where: { id: candidate.id }, select: { status: true } })).status).toBe('OFFERED')
  })
})

// Found in the 2026-11-23 review: after the Letter of Intent was accepted online and then the full offer, the LOI's link
// still opened the joining form - and HR's "new link" (for a forwarded e-mail) changed only the newest letter's link and
// left everyone already signed in with it signed in.
describe('only the newest link opens the joining form', () => {
  const admin = userWith({ id: 0, employeeCode: 'SYSTEM' }, [], { isSuperAdmin: true })
  const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')

  it('refuses the accepted Letter of Intent\'s link, and a new link signs everyone out', async () => {
    const companyId = (await createCompany()).id
    const plantId = (await createPlant(companyId)).id
    const designationId = (await designationsService.createDesignation({ name: `Link test ${companyId}-${Date.now()}` }, SYSTEM_ACTOR)).id
    const templateId = (
      await prisma.letterTemplate.create({ data: { kind: 'OFFER_LETTER', name: `Link template ${Date.now()}`, body: '{}', ...createdBy(SYSTEM_ACTOR) }, select: { id: true } })
    ).id
    const candidate = await candidatesService.createCandidate(
      {
        firstName: 'Link',
        mobile: '9876543210',
        personalEmail: 'link.test@example.com',
        companyId,
        plantId,
        designationId,
        joiningType: 'OVERSEAS',
        employmentType: 'PERMANENT',
        workforceCategory: 'WHITE_COLLAR',
        annualCtc: 1_200_000,
        proposedJoiningDate: new Date(Date.UTC(2099, 0, 15)),
        offerValidUntil: new Date(Date.UTC(2099, 0, 10)),
        joiningFormOnAcceptance: true,
      },
      admin,
    )
    await candidatesService.recordOfferSent(candidate.id, `TEST/LINK/${candidate.id}`, SYSTEM_ACTOR)
    const letter = (revision: number, token: string, kind: 'LETTER_OF_INTENT' | 'OFFER_LETTER', accepted: boolean) =>
      prisma.offerLetter.create({
        data: {
          candidateId: candidate.id,
          revision,
          kind,
          letterTemplateId: templateId,
          storageKey: `test/link-${candidate.id}-${revision}.pdf`,
          sha256: sha256(token),
          sentAt: new Date(),
          sentById: SYSTEM_ACTOR,
          linkTokenHash: sha256(token),
          ...(accepted && { response: 'ACCEPTED' as const, respondedAt: new Date(), respondedById: SYSTEM_ACTOR }),
          ...createdBy(SYSTEM_ACTOR),
        },
      })
    const loiToken = randomBytes(32).toString('base64url')
    const offerToken = randomBytes(32).toString('base64url')
    await letter(0, loiToken, 'LETTER_OF_INTENT', true)
    await letter(1, offerToken, 'OFFER_LETTER', true)
    await candidatesService.recordOfferAccepted(candidate.id, SYSTEM_ACTOR)
    await candidatesService.recordJoiningFormOpened(candidate.id, SYSTEM_ACTOR)

    await expect(offerLettersService.sendCode(loiToken)).rejects.toThrow()
    expect((await offerLettersService.viewByToken(loiToken)).joiningFormOpen).toBe(false)
    expect((await offerLettersService.viewByToken(offerToken)).joiningFormOpen).toBe(true)

    // someone signed in with the link; HR sends a new one
    await prisma.candidateSession.create({ data: { candidateId: candidate.id, tokenHash: sha256(randomBytes(32).toString('base64url')), expiresAt: new Date(Date.now() + 3_600_000), ...createdBy(SYSTEM_ACTOR) } })
    await offerLettersService.sendPortalLink(candidate.id, SYSTEM_ACTOR)
    expect(await prisma.candidateSession.count({ where: { candidateId: candidate.id } })).toBe(0)
  })
})
