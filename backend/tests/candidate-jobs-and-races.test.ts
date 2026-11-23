import { createHash } from 'node:crypto'
import { createdBy, prisma, SYSTEM_ACTOR } from '#core/db/prisma'
import { readStoredFile } from '#core/storage/file-storage'
import { candidatesService, offerLettersService } from '#modules/candidates'
import { employeeLettersService } from '#modules/employee-letters'
import { designationsService } from '#modules/organization'
import { today } from '#shared/utils/dates'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRole, giveLogin } from './helpers/approvals.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { userWith } from './helpers/users.js'

// Found in the 2026-11-23 review: HR's joining reminder listed joinings that can no longer be confirmed; one error stopped
// the nightly offer expiry; a step failing after a letter was saved deleted its PDF; a candidate's accept and HR's
// withdraw at the same moment - the last write won.

// every e-mail "goes out" (no real mail server) - so the steps after it run
const sendMail = vi.hoisted(() => vi.fn(async () => 'SENT' as const))
vi.mock('#core/mail/mailer', () => ({ sendMail }))

// what the test makes happen between the steps of the code under test
const hooks = vi.hoisted(() => ({
  // runs once, right after a candidate was read (as if someone changed it at that moment)
  afterRead: null as null | ((id: number) => Promise<void>),
  // reading this candidate fails
  failReadOf: null as number | null,
  // a step after the letter was saved fails
  failAfterSave: false,
}))
vi.mock('../src/modules/candidates/candidates.repository.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/modules/candidates/candidates.repository.js')>()
  return {
    ...original,
    findById: async (...args: Parameters<typeof original.findById>) => {
      if (hooks.failReadOf === args[0]) throw new Error('test: this candidate cannot be read')
      const row = await original.findById(...args)
      const afterRead = hooks.afterRead
      if (afterRead) {
        hooks.afterRead = null
        await afterRead(args[0])
      }
      return row
    },
  }
})
// letters: no real PDF (a template needs a letterhead) - the bytes of a tiny PDF
vi.mock('#modules/letter-templates', async (importOriginal) => {
  const original = await importOriginal<typeof import('#modules/letter-templates')>()
  const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0x25, 0x45, 0x4f, 0x46])
  return { ...original, letterTemplatesService: { ...original.letterTemplatesService, writeLetter: async () => bytes } }
})
vi.mock('../src/modules/employee-letters/employee-letters.repository.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/modules/employee-letters/employee-letters.repository.js')>()
  return {
    ...original,
    setEmailedTo: async (...args: Parameters<typeof original.setEmailedTo>) => {
      if (hooks.failAfterSave) throw new Error('test: recording the e-mail failed')
      return original.setEmailedTo(...args)
    },
  }
})
vi.mock('../src/modules/candidates/offer-letters/offer-letters.repository.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/modules/candidates/offer-letters/offer-letters.repository.js')>()
  return {
    ...original,
    update: async (...args: Parameters<typeof original.update>) => {
      if (hooks.failAfterSave && 'emailedAt' in args[1]) throw new Error('test: recording the e-mail failed')
      return original.update(...args)
    },
  }
})

describe('candidates: jobs and changes at the same moment (2026-11-23 review)', () => {
  const admin = userWith({ id: 0, employeeCode: 'SYSTEM' }, [], { isSuperAdmin: true })
  const day = 86_400_000
  let companyId: number
  let plantId: number
  let designationId: number

  const newCandidate = (terms: { proposedJoiningDate?: Date; offerValidUntil?: Date } = {}) =>
    candidatesService.createCandidate(
      {
        firstName: 'Race',
        lastName: `Test ${Date.now()}`,
        mobile: '9876543210',
        personalEmail: 'race.test@example.com',
        companyId,
        plantId,
        designationId,
        joiningType: 'OVERSEAS',
        employmentType: 'PERMANENT',
        workforceCategory: 'WHITE_COLLAR',
        annualCtc: 1_200_000,
        proposedJoiningDate: terms.proposedJoiningDate ?? new Date(Date.UTC(2099, 0, 15)),
        offerValidUntil: terms.offerValidUntil ?? new Date(Date.UTC(2099, 0, 10)),
      },
      admin,
    )
  const sentOffer = async (terms?: Parameters<typeof newCandidate>[0]) => {
    const candidate = await newCandidate(terms)
    await candidatesService.recordOfferSent(candidate.id, `TEST/RACE/${candidate.id}`, SYSTEM_ACTOR)
    return candidate.id
  }
  const statusOf = async (id: number) => (await prisma.candidate.findUniqueOrThrow({ where: { id }, select: { status: true } })).status

  beforeAll(async () => {
    companyId = (await createCompany()).id
    plantId = (await createPlant(companyId)).id
    designationId = (await designationsService.createDesignation({ name: `Race test ${companyId}-${Date.now()}` }, SYSTEM_ACTOR)).id
  })
  beforeEach(() => {
    sendMail.mockClear()
    Object.assign(hooks, { afterRead: null, failReadOf: null, failAfterSave: false })
  })
  afterAll(() => prisma.$disconnect())

  it("HR's withdraw does not overwrite an accept saved a moment before", async () => {
    const id = await sentOffer()
    hooks.afterRead = (candidateId) => prisma.candidate.update({ where: { id: candidateId }, data: { status: 'ACCEPTED', acceptedAt: new Date(), acceptedById: SYSTEM_ACTOR } }).then(() => undefined)
    await expect(candidatesService.closeCandidate({ id, outcome: 'WITHDRAWN', reason: 'Position closed' }, SYSTEM_ACTOR)).rejects.toThrow('changed a moment ago')
    expect(await statusOf(id)).toBe('ACCEPTED')
  })

  it('an accept does not overwrite a withdraw saved a moment before', async () => {
    const id = await sentOffer()
    hooks.afterRead = (candidateId) =>
      prisma.candidate.update({ where: { id: candidateId }, data: { status: 'WITHDRAWN', closedAt: new Date(), closedById: SYSTEM_ACTOR, closeReason: 'Position closed' } }).then(() => undefined)
    await expect(candidatesService.recordOfferAccepted(id, SYSTEM_ACTOR)).rejects.toThrow('changed a moment ago')
    expect(await statusOf(id)).toBe('WITHDRAWN')
  })

  it('the nightly expiry goes on past an offer that fails, and counts it', async () => {
    const past = { proposedJoiningDate: new Date(today().getTime() + 30 * day), offerValidUntil: new Date(today().getTime() - 2 * day) }
    const failing = await sentOffer(past)
    const fine = await sentOffer(past)
    hooks.failReadOf = failing
    const result = await candidatesService.expireUnansweredOffers()
    expect(result.failed).toBeGreaterThanOrEqual(1)
    expect(await statusOf(failing)).toBe('OFFERED')
    expect(await statusOf(fine)).toBe('EXPIRED')
  })

  it('reminds HR only of joinings they can still confirm (from tomorrow), inside their data access', async () => {
    const joiningToday = await sentOffer({ proposedJoiningDate: today(), offerValidUntil: today() })
    const joiningTomorrow = await sentOffer({ proposedJoiningDate: new Date(today().getTime() + day), offerValidUntil: today() })
    for (const id of [joiningToday, joiningTomorrow]) await candidatesService.recordOfferAccepted(id, SYSTEM_ACTOR)
    // an HR person whose Onboarding: Edit covers only this company
    const hr = await createEmployee({ companyId, plantId })
    const email = `hr.${hr.employeeCode.toLowerCase()}@example.com`
    await prisma.employee.update({ where: { id: hr.id }, data: { workEmail: email } })
    await giveLogin(hr.id, [{ roleId: (await createRole({ ONBOARDING: 'WRITE' })).id, companyId }])
    await candidatesService.remindUnconfirmedJoining(3)
    const mine = (sendMail.mock.calls as unknown as [unknown][]).map(([mail]) => mail as { to: string; text: string }).filter((mail) => mail.to === email)
    expect(mine).toHaveLength(1)
    expect(mine[0]!.text).toContain(`/onboarding/${joiningTomorrow}`)
    expect(mine[0]!.text).not.toContain(`/onboarding/${joiningToday}`)
    // a joining today cannot be confirmed (why it is left out)
    await expect(candidatesService.confirmJoining(joiningToday, admin)).rejects.toThrow('has already come')
  })

  it("keeps an employee letter's PDF when a step after saving it fails", async () => {
    const employee = await createEmployee({ companyId, plantId })
    await prisma.employee.update({ where: { id: employee.id }, data: { workEmail: `letter.${employee.employeeCode.toLowerCase()}@example.com` } })
    const template = await prisma.letterTemplate.create({ data: { kind: 'EXPERIENCE_LETTER', name: `Race letter ${Date.now()}`, body: '{}', ...createdBy(SYSTEM_ACTOR) }, select: { id: true } })
    hooks.failAfterSave = true
    await expect(
      employeeLettersService.issueLetter(
        { employeeCode: employee.employeeCode, kind: 'EXPERIENCE_LETTER', templateId: template.id, lastWorkingDay: new Date(Date.UTC(2026, 5, 30)) },
        admin,
      ),
    ).rejects.toThrow('recording the e-mail failed')
    const saved = await prisma.employeeLetter.findFirstOrThrow({ where: { employeeId: employee.id }, select: { storageKey: true } })
    await expect(readStoredFile(saved.storageKey)).resolves.toBeInstanceOf(Buffer)
  })

  it("keeps an offer letter's PDF when a step after saving it fails", async () => {
    const candidate = await newCandidate()
    const template = await prisma.letterTemplate.create({ data: { kind: 'OFFER_LETTER', name: `Race offer ${Date.now()}`, body: '{}', ...createdBy(SYSTEM_ACTOR) }, select: { id: true } })
    hooks.failAfterSave = true
    await expect(offerLettersService.sendOffer(candidate.id, template.id, admin)).rejects.toThrow('recording the e-mail failed')
    const saved = await prisma.offerLetter.findFirstOrThrow({ where: { candidateId: candidate.id }, select: { storageKey: true, sha256: true } })
    const file = await readStoredFile(saved.storageKey)
    expect(createHash('sha256').update(file).digest('hex')).toBe(saved.sha256)
  })
})
