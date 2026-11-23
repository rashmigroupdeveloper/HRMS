import { prisma, SYSTEM_ACTOR } from '#core/db/prisma'
import { candidateDocumentsService, candidatesService } from '#modules/candidates'
import { designationsService } from '#modules/organization'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCompany, createPlant } from './helpers/organization.js'
import { userWith } from './helpers/users.js'

const sendMail = vi.hoisted(() => vi.fn(async () => 'SENT' as const))
vi.mock('#core/mail/mailer', () => ({ sendMail }))

// HR rejecting a document the candidate uploaded e-mails the candidate the reason (the user, 2026-11-20)
describe('document rejection e-mail', () => {
  let companyId: number
  let plantId: number
  let designationId: number
  const admin = userWith({ id: 0, employeeCode: 'SYSTEM' }, [], { isSuperAdmin: true })
  const pdf = () => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0x25, 0x45, 0x4f, 0x46])], 'pan.pdf', { type: 'application/pdf' })

  // an accepted candidate whose joining form is open (or not)
  const acceptedCandidate = async (formOpen: boolean) => {
    const candidate = await candidatesService.createCandidate(
      {
        firstName: 'Neha',
        mobile: '9876543210',
        personalEmail: 'rejection.test@example.com',
        companyId,
        plantId,
        designationId,
        joiningType: 'REGULAR',
        employmentType: 'PERMANENT',
        workforceCategory: 'WHITE_COLLAR',
        annualCtc: 600_000,
        proposedJoiningDate: new Date(Date.UTC(2027, 0, 15)),
        joiningFormOnAcceptance: formOpen,
      },
      admin,
    )
    await candidatesService.recordOfferSent(candidate.id, `TEST/REJECT/${candidate.id}`, SYSTEM_ACTOR)
    await candidatesService.recordOfferAccepted(candidate.id, SYSTEM_ACTOR)
    return candidate.id
  }
  const upload = (candidateId: number, actorId: number) =>
    candidateDocumentsService.uploadDocument({ candidateId, type: 'PAN_COPY', file: pdf() }, actorId)
  const reject = (id: number) => candidateDocumentsService.reviewDocument({ id, status: 'REJECTED', rejectionReason: 'The number cannot be read' }, admin)
  // the e-mail is sent in the background
  const settle = () => new Promise((r) => setTimeout(r, 50))

  beforeAll(async () => {
    companyId = (await createCompany()).id
    plantId = (await createPlant(companyId)).id
    designationId = (await designationsService.createDesignation({ name: `Test Designation ${companyId}-${Date.now()}` }, SYSTEM_ACTOR)).id
  })
  beforeEach(() => sendMail.mockClear())
  afterAll(() => prisma.$disconnect())

  it("e-mails the candidate the reason for a document they uploaded, once", async () => {
    const document = await upload(await acceptedCandidate(true), SYSTEM_ACTOR)
    await reject(document.id)
    await settle()
    expect(sendMail).toHaveBeenCalledTimes(1)
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'rejection.test@example.com', subject: expect.stringContaining('pan copy'), text: expect.stringContaining('The number cannot be read') }),
    )
    // rejecting it again (a changed reason) does not e-mail again
    await reject(document.id)
    await settle()
    expect(sendMail).toHaveBeenCalledTimes(1)
  })

  it('does not e-mail when the candidate has already uploaded a newer copy', async () => {
    const candidateId = await acceptedCandidate(true)
    const first = await upload(candidateId, SYSTEM_ACTOR)
    await upload(candidateId, SYSTEM_ACTOR)
    await reject(first.id)
    await settle()
    expect(sendMail).not.toHaveBeenCalled()
  })

  it("does not e-mail for HR's own upload, or before the joining form is open", async () => {
    await reject((await upload(await acceptedCandidate(true), 5)).id)
    await reject((await upload(await acceptedCandidate(false), SYSTEM_ACTOR)).id)
    await settle()
    expect(sendMail).not.toHaveBeenCalled()
  })
})
