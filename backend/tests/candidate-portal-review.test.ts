import { createHash, randomBytes } from 'node:crypto'
import { createdBy, prisma, SYSTEM_ACTOR } from '#core/db/prisma'
import { candidateDocumentsService, candidatePortalService, candidatesService, offerLettersService } from '#modules/candidates'
import { designationsService } from '#modules/organization'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createCompany, createPlant } from './helpers/organization.js'
import { userWith } from './helpers/users.js'

// The candidate's offer link and joining-form page - found in the 2026-11-23 review: a failed submit used up the signing
// code, uploads had no count limit, and a withdrawn candidate's page still said "accepted".
describe('the candidate portal (2026-11-23 review)', () => {
  const admin = userWith({ id: 0, employeeCode: 'SYSTEM' }, [], { isSuperAdmin: true })
  const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')
  const proof = { ip: '203.0.113.9', userAgent: 'test' }
  const pdf = () => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0x25, 0x45, 0x4f, 0x46])], 'copy.pdf', { type: 'application/pdf' })
  let companyId: number
  let plantId: number
  let designationId: number
  let templateId: number

  // an accepted offer whose joining form is open, with its (accepted) letter and a known link token
  async function acceptedCandidate() {
    const candidate = await candidatesService.createCandidate(
      {
        firstName: 'Portal',
        lastName: 'Test',
        mobile: '9876543210',
        personalEmail: 'portal.test@example.com',
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
    await candidatesService.recordOfferSent(candidate.id, `TEST/PORTAL/${candidate.id}`, SYSTEM_ACTOR)
    const token = randomBytes(32).toString('base64url')
    const letter = await prisma.offerLetter.create({
      data: {
        candidateId: candidate.id,
        revision: 0,
        letterTemplateId: templateId,
        storageKey: `test/portal-${candidate.id}.pdf`,
        sha256: sha256(token),
        sentAt: new Date(),
        sentById: SYSTEM_ACTOR,
        linkTokenHash: sha256(token),
        response: 'ACCEPTED',
        respondedAt: new Date(),
        respondedById: SYSTEM_ACTOR,
        ...createdBy(SYSTEM_ACTOR),
      },
      select: { id: true },
    })
    await candidatesService.recordOfferAccepted(candidate.id, SYSTEM_ACTOR)
    return { candidateId: candidate.id, token, letterId: letter.id }
  }

  beforeAll(async () => {
    companyId = (await createCompany()).id
    plantId = (await createPlant(companyId)).id
    designationId = (await designationsService.createDesignation({ name: `Portal test ${companyId}-${Date.now()}` }, SYSTEM_ACTOR)).id
    templateId = (
      await prisma.letterTemplate.create({ data: { kind: 'OFFER_LETTER', name: `Portal template ${Date.now()}`, body: '{}', ...createdBy(SYSTEM_ACTOR) }, select: { id: true } })
    ).id
  })
  afterAll(() => prisma.$disconnect())

  it('keeps the signing code when the submit is refused (an unfinished form)', async () => {
    const { candidateId, letterId } = await acceptedCandidate()
    // the code the candidate got (only its hash is stored - set a known one)
    await prisma.offerLetter.update({ where: { id: letterId }, data: { otpHash: sha256(`${letterId}:123456`), otpValidUntil: new Date(Date.now() + 600_000) } })
    await expect(candidatePortalService.submit(candidateId, { code: '123456', name: 'Portal Test', agreed: true }, proof)).rejects.toThrow(/Please complete these first/)
    const after = await prisma.offerLetter.findUniqueOrThrow({ where: { id: letterId }, select: { otpHash: true, otpFailedAttempts: true } })
    expect(after).toEqual({ otpHash: sha256(`${letterId}:123456`), otpFailedAttempts: 0 })
    // checking it alone keeps it; it is used once the form is saved
    await offerLettersService.checkSigningCode(candidateId, '123456')
    expect((await prisma.offerLetter.findUniqueOrThrow({ where: { id: letterId }, select: { otpHash: true } })).otpHash).not.toBeNull()
    await offerLettersService.signingCodeUsed(candidateId)
    expect((await prisma.offerLetter.findUniqueOrThrow({ where: { id: letterId }, select: { otpHash: true } })).otpHash).toBeNull()
  })

  it('refuses an 11th file of one type and a 61st file in all', async () => {
    const { candidateId } = await acceptedCandidate()
    for (let i = 0; i < 10; i++) await candidatePortalService.uploadDocument(candidateId, { type: 'AADHAAR_COPY', file: pdf() })
    await expect(candidatePortalService.uploadDocument(candidateId, { type: 'AADHAAR_COPY', file: pdf() })).rejects.toThrow(/10 files for "Aadhaar.*the most allowed/i)
    // a removed file still counts (it is kept)
    const [first] = (await candidateDocumentsService.listForCandidate(candidateId)).filter((d) => d.type === 'AADHAAR_COPY')
    await candidatePortalService.removeDocument(candidateId, first!.id)
    await expect(candidatePortalService.uploadDocument(candidateId, { type: 'AADHAAR_COPY', file: pdf() })).rejects.toThrow(/the most allowed/)
    // 59 of their own and 1 of HR's: HR's uploads do not count, so the 60th of their own is taken, the 61st is not
    await candidateDocumentsService.uploadDocument({ candidateId, type: 'PAN_COPY', file: pdf() }, 5)
    for (const type of ['PAN_COPY', 'PASSPORT_COPY', 'BANK_PROOF', 'CLASS_X_MARKSHEET', 'CLASS_XII_MARKSHEET'] as const) {
      for (let i = 0; i < (type === 'CLASS_XII_MARKSHEET' ? 9 : 10); i++) await candidateDocumentsService.uploadDocument({ candidateId, type, file: pdf() }, SYSTEM_ACTOR)
    }
    await candidatePortalService.uploadDocument(candidateId, { type: 'GRADUATION_CERTIFICATE', file: pdf() })
    await expect(candidatePortalService.uploadDocument(candidateId, { type: 'GRADUATION_CERTIFICATE', file: pdf() })).rejects.toThrow(/uploaded 60 files - the most allowed/)
  })

  it('shows a withdrawn offer as closed, not accepted', async () => {
    const { candidateId, token } = await acceptedCandidate()
    expect(await offerLettersService.viewByToken(token)).toMatchObject({ state: 'ACCEPTED', joiningFormOpen: true })
    await candidatesService.closeCandidate({ id: candidateId, outcome: 'WITHDRAWN', reason: 'Position closed' }, SYSTEM_ACTOR)
    expect(await offerLettersService.viewByToken(token)).toMatchObject({ state: 'CLOSED', joiningFormOpen: false, joiningFormNext: null })
    await expect(offerLettersService.checkJoiningFormCode(token, '123456')).rejects.toThrow('Your joining form is closed')
  })
})
