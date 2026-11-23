import { prisma, SYSTEM_ACTOR } from '#core/db/prisma'
import { candidateDocumentsService, candidatesService } from '#modules/candidates'
import { employeesService } from '#modules/employees'
import { designationsService } from '#modules/organization'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// Health, ID and salary data need their own access, not only the record's (found in the 2026-11-23 review): the
// pre-employment medical on a profile showed to anyone who saw the profile; a candidate's ID / bank copies, medical
// documents and signed forms opened with Onboarding View alone.
describe('sensitive parts of a record', () => {
  let companyId: number
  let plantId: number
  const all = row(null, null, null, 'READ')

  beforeAll(async () => {
    companyId = (await createCompany()).id
    plantId = (await createPlant(companyId)).id
  })
  afterAll(() => prisma.$disconnect())

  it('shows the pre-employment medical on a profile only with Medical', async () => {
    const employee = await createEmployee({ companyId, plantId })
    // test data: the medical copied from onboarding on the joining day
    await prisma.employeeOnboarding.create({
      data: { employeeId: employee.id, medicalResult: 'FIT_WITH_RESTRICTIONS', medicalRestrictions: 'No work at height', createdById: 0, updatedById: 0 },
    })
    const directory = userWith({ id: 0, employeeCode: 'DIRVIEW' }, [{ access: { EMPLOYEES: 'READ' }, rows: [all] }])
    const doctor = userWith({ id: 0, employeeCode: 'MEDVIEW' }, [{ access: { EMPLOYEES: 'READ', MEDICAL: 'READ' }, rows: [all] }])

    const hidden = (await employeesService.getByCodeFor(directory, employee.employeeCode)).joining
    expect(hidden).toMatchObject({ medicalResult: null, medicalRestrictions: null, medicalHidden: true })
    const shown = (await employeesService.getByCodeFor(doctor, employee.employeeCode)).joining
    expect(shown).toMatchObject({ medicalResult: 'FIT_WITH_RESTRICTIONS', medicalRestrictions: 'No work at height', medicalHidden: false })
  })

  it("opens a candidate's ID copy only with IDs, bank & statutory too - an ordinary document with Onboarding View", async () => {
    const admin = userWith({ id: 0, employeeCode: 'SYSTEM' }, [], { isSuperAdmin: true })
    const designationId = (await designationsService.createDesignation({ name: `Sensitive test ${companyId}-${Date.now()}` }, SYSTEM_ACTOR)).id
    const candidate = await candidatesService.createCandidate(
      {
        firstName: 'Asha',
        mobile: '9876543210',
        personalEmail: 'sensitive.test@example.com',
        companyId,
        plantId,
        designationId,
        joiningType: 'REGULAR',
        employmentType: 'PERMANENT',
        workforceCategory: 'WHITE_COLLAR',
        annualCtc: 600_000,
        proposedJoiningDate: new Date(Date.UTC(2027, 0, 15)),
        joiningFormOnAcceptance: true,
      },
      admin,
    )
    await candidatesService.recordOfferSent(candidate.id, `TEST/SENSITIVE/${candidate.id}`, SYSTEM_ACTOR)
    await candidatesService.recordOfferAccepted(candidate.id, SYSTEM_ACTOR)
    const pdf =() => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0x25, 0x45, 0x4f, 0x46])], 'copy.pdf', { type: 'application/pdf' })
    const pan = await candidateDocumentsService.uploadDocument({ candidateId: candidate.id, type: 'PAN_COPY', file: pdf() }, SYSTEM_ACTOR)
    const degree = await candidateDocumentsService.uploadDocument({ candidateId: candidate.id, type: 'GRADUATION_CERTIFICATE', file: pdf() }, SYSTEM_ACTOR)

    const onboarding = userWith({ id: 0, employeeCode: 'ONBVIEW' }, [{ access: { ONBOARDING: 'READ' }, rows: [all] }])
    const withIds = userWith({ id: 0, employeeCode: 'IDSVIEW' }, [{ access: { ONBOARDING: 'READ', EMPLOYEE_IDS_BANK: 'READ' }, rows: [all] }])
    await expect(candidateDocumentsService.downloadDocument(pan.id, onboarding)).rejects.toThrow('IDs, bank & statutory')
    await expect(candidateDocumentsService.downloadDocument(pan.id, withIds)).resolves.toBeInstanceOf(File)
    await expect(candidateDocumentsService.downloadDocument(degree.id, onboarding)).resolves.toBeInstanceOf(File)
  })
})
