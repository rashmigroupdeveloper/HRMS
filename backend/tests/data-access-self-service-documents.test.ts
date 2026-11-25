import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '#core/db/prisma'
import * as documents from '../src/modules/employees/documents/documents.service.js'
import { uploadEmployeeDocumentInput } from '../src/modules/employees/documents/documents.schema.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

const pdf = () => new File(['%PDF-1.4\nSynthetic document for review\n%%EOF'], 'synthetic.pdf', { type: 'application/pdf' })

describe('employee self-submitted documents stay under HR review', () => {
  let owner: Awaited<ReturnType<typeof createEmployee>>
  let colleague: typeof owner
  let outside: typeof owner
  let self: ReturnType<typeof userWith>
  let hr: ReturnType<typeof userWith>
  let readOnly: ReturnType<typeof userWith>
  let otherHr: ReturnType<typeof userWith>
  let ownHr: ReturnType<typeof userWith>
  beforeAll(async () => {
    const a = await createCompany(), b = await createCompany()
    const pa = await createPlant(a.id), pb = await createPlant(b.id)
    owner = await createEmployee({ companyId: a.id, plantId: pa.id })
    colleague = await createEmployee({ companyId: a.id, plantId: pa.id })
    outside = await createEmployee({ companyId: b.id, plantId: pb.id })
    const manager = await createEmployee({ companyId: a.id, plantId: pa.id })
    const grants = { EMPLOYEES: 'READ' as const, EMPLOYEE_DOCUMENTS: 'WRITE' as const, EMPLOYEE_IDS_BANK: 'READ' as const }
    self = userWith(owner, [])
    hr = userWith(manager, [{ access: grants, rows: [row(a.id, null, null)] }])
    ownHr = userWith(owner, hr.grants)
    readOnly = userWith(owner, [{ access: { EMPLOYEES: 'READ', EMPLOYEE_DOCUMENTS: 'READ' }, rows: [row(a.id, null, null)] }])
    otherHr = userWith(outside, [{ access: grants, rows: [row(b.id, null, null)] }])
  })
  afterAll(() => prisma.$disconnect())

  it('a roleless owner uploads, sees and downloads their own pending file with truthful attribution', async () => {
    const input = uploadEmployeeDocumentInput.parse({ employeeCode: owner.employeeCode, type: 'AADHAAR_COPY', file: pdf(), verificationStatus: 'VERIFIED', reviewedById: colleague.id })
    const uploaded = await documents.uploadDocument(input, self)
    expect(uploaded).toMatchObject({ verificationStatus: 'PENDING', reviewedAt: null, reviewedBy: null, uploadedBy: { employeeCode: owner.employeeCode } })
    expect((await documents.listDocuments(self, owner.employeeCode)).some(d => d.id === uploaded.id && !d.locked)).toBe(true)
    expect(await (await documents.downloadDocument(self, uploaded.id)).text()).toContain('Synthetic document')
    const stored = await prisma.employeeDocument.findUniqueOrThrow({ where: { id: uploaded.id }, select: { storageKey: true, createdById: true } })
    expect(stored.createdById).toBe(owner.id)
    expect(stored.storageKey).toContain(`employees/${owner.employeeCode}/AADHAAR_COPY/`)
  })

  it('an owner cannot upload to another employee, including a visible read-only colleague', async () => {
    await expect(documents.uploadDocument({ employeeCode: colleague.employeeCode, type: 'PHOTO', file: pdf() }, self)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(documents.uploadDocument({ employeeCode: colleague.employeeCode, type: 'PHOTO', file: pdf() }, readOnly)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(documents.uploadDocument({ employeeCode: outside.employeeCode, type: 'PHOTO', file: pdf() }, hr)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('only another scoped HR reviewer may verify or reject, and rejection permits a fresh submission', async () => {
    const uploaded = await documents.uploadDocument({ employeeCode: owner.employeeCode, type: 'GRADUATION_CERTIFICATE', file: pdf() }, self)
    await expect(documents.reviewDocument({ id: uploaded.id, status: 'VERIFIED' }, self)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(documents.reviewDocument({ id: uploaded.id, status: 'VERIFIED' }, ownHr)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(documents.reviewDocument({ id: uploaded.id, status: 'VERIFIED' }, otherHr)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(documents.deleteDocument({ id: uploaded.id, reason: 'Trying to remove a submission' }, self)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(documents.restoreDocument(uploaded.id, self)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const rejected = await documents.reviewDocument({ id: uploaded.id, status: 'REJECTED', rejectionReason: 'Please upload a legible scan' }, hr)
    expect(rejected).toMatchObject({ verificationStatus: 'REJECTED', rejectionReason: 'Please upload a legible scan' })
    const replacement = await documents.uploadDocument({ employeeCode: owner.employeeCode, type: 'GRADUATION_CERTIFICATE', file: pdf() }, self)
    const verified = await documents.reviewDocument({ id: replacement.id, status: 'VERIFIED' }, hr)
    expect(verified).toMatchObject({ verificationStatus: 'VERIFIED', reviewedBy: { employeeCode: hr.employeeCode } })
    expect((await documents.listDocuments(self, owner.employeeCode)).find(d => d.id === uploaded.id)?.rejectionReason).toBe('Please upload a legible scan')
  })

  it('pending employee evidence cannot satisfy consent; a verified copy survives a pending replacement', async () => {
    const uploaded = await documents.uploadDocument({ employeeCode: owner.employeeCode, type: 'BGV_CONSENT_FORM', file: pdf() }, self)
    expect(await documents.hasDocument(owner.id, 'BGV_CONSENT_FORM')).toBe(false)
    await documents.reviewDocument({ id: uploaded.id, status: 'VERIFIED' }, hr)
    expect(await documents.hasDocument(owner.id, 'BGV_CONSENT_FORM')).toBe(true)
    const newer = await documents.uploadDocument({ employeeCode: owner.employeeCode, type: 'BGV_CONSENT_FORM', file: pdf() }, self)
    expect(await documents.hasDocument(owner.id, 'BGV_CONSENT_FORM')).toBe(true)
    expect((await documents.listDocuments(self, owner.employeeCode)).find(d => d.id === uploaded.id)?.verificationStatus).toBe('VERIFIED')
    await documents.reviewDocument({ id: newer.id, status: 'REJECTED', rejectionReason: 'The scan is not signed' }, hr)
    expect(await documents.hasDocument(owner.id, 'BGV_CONSENT_FORM')).toBe(true)
  })

  it('still checks the real file type, empty files and the 5 MB limit', async () => {
    await expect(documents.uploadDocument({ employeeCode: owner.employeeCode, type: 'PHOTO', file: new File(['not an image'], 'fake.png') }, self)).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    expect(uploadEmployeeDocumentInput.safeParse({ employeeCode: owner.employeeCode, type: 'PHOTO', file: new File([], 'empty.pdf') }).success).toBe(false)
    expect(uploadEmployeeDocumentInput.safeParse({ employeeCode: owner.employeeCode, type: 'PHOTO', file: new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.pdf') }).success).toBe(false)
  })
})
