import ExcelJS from 'exceljs'
import { prisma, SYSTEM_ACTOR } from '#core/db/prisma'
import { candidatesService } from '#modules/candidates'
import { designationsService } from '#modules/organization'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createCompany, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// Data access on offers (2026-11-18): the list, opening, creating, changing and moving an offer only inside the viewer's
// Onboarding data access; outside it a candidate is "not found".
describe('candidates inside and outside the data access', () => {
  let companyA: number
  let companyB: number
  let plantA: number
  let plantB: number
  let designationId: number
  let inA: number
  let inB: number
  let hrForA: ReturnType<typeof userWith>
  let viewerOfA: ReturnType<typeof userWith>
  const admin = userWith({ id: 0, employeeCode: 'SYSTEM' }, [], { isSuperAdmin: true })

  const offer = (companyId: number, plantId: number) => ({
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
  })

  beforeAll(async () => {
    companyA = (await createCompany()).id
    companyB = (await createCompany()).id
    plantA = (await createPlant(companyA)).id
    plantB = (await createPlant(companyB)).id
    designationId = (await designationsService.createDesignation({ name: `Test Designation ${companyA}-${Date.now()}` }, SYSTEM_ACTOR)).id
    inA = (await candidatesService.createCandidate(offer(companyA, plantA), admin)).id
    inB = (await candidatesService.createCandidate(offer(companyB, plantB), admin)).id
    hrForA = userWith({ id: 0, employeeCode: 'HRA' }, [{ access: { ONBOARDING: 'WRITE' }, rows: [row(companyA, null, null)] }])
    viewerOfA = userWith({ id: 0, employeeCode: 'VIEWA' }, [{ access: { ONBOARDING: 'WRITE' }, rows: [row(companyA, null, null, 'READ')] }])
  })
  afterAll(() => prisma.$disconnect())

  it('lists and opens only the offers inside the data access', async () => {
    const ids = (await candidatesService.listCandidates(undefined, hrForA)).map((c) => c.id)
    expect(ids).toContain(inA)
    expect(ids).not.toContain(inB)
    await expect(candidatesService.getCandidateDetails(inA, hrForA)).resolves.toMatchObject({ id: inA })
    await expect(candidatesService.getCandidateDetails(inB, hrForA)).rejects.toThrow(`No candidate found with id ${inB}`)
  })

  it('exports the selected lifecycle group without exposing candidates outside its data access',async()=>{
    const read=async(statuses:('DRAFT'|'ACCEPTED')[])=>{
      const file=await candidatesService.exportCandidates({statuses},hrForA)
      const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await file.arrayBuffer())
      const ids:number[]=[];workbook.worksheets[0]!.eachRow((row,n)=>{if(n>1)ids.push(Number(row.getCell(1).value))})
      return ids
    }
    expect(await read(['DRAFT'])).toContain(inA)
    expect(await read(['DRAFT'])).not.toContain(inB)
    expect(await read(['ACCEPTED'])).not.toContain(inA)
    expect(await read([])).toEqual([])
  })

  it('creates, changes and moves offers only inside the Edit data access', async () => {
    await expect(candidatesService.createCandidate(offer(companyB, plantB), hrForA)).rejects.toThrow('inside your data access')
    await expect(candidatesService.updateCandidate({ id: inA, firstName: 'Changed' }, hrForA)).resolves.toMatchObject({ firstName: 'Changed' })
    await expect(candidatesService.updateCandidate({ id: inA, companyId: companyB, plantId: plantB }, hrForA)).rejects.toThrow('inside your data access')
    // View only: no change
    await expect(candidatesService.updateCandidate({ id: inA, firstName: 'Again' }, viewerOfA)).rejects.toThrow('do not have access to change')
  })
})
