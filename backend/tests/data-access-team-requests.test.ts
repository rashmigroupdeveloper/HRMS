import ExcelJS from 'exceljs'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '#core/db/prisma'
import { IST_OFFSET_MS } from '#shared/utils/dates'
import { hodsService } from '#modules/employees'
import * as reports from '../src/modules/approvals/reports/reports.service.js'
import * as reportsRepository from '../src/modules/approvals/reports/reports.repository.js'
import { createRequestReportFixture } from './helpers/request-reports.js'
import { asAsync } from './helpers/spies.js'
import { row, userWith } from './helpers/users.js'

async function workbook(file:File) {const book=new ExcelJS.Workbook();await book.xlsx.load(await file.arrayBuffer());return book}
describe('combined team requests, messages and remarks',()=>{
  let fixture:Awaited<ReturnType<typeof createRequestReportFixture>>
  let manager:ReturnType<typeof userWith>
  const input=()=>({scope:'TEAM' as const,from:fixture.date,to:fixture.date,dateBy:'WORK_DATES' as const,page:1,pageSize:25})
  beforeAll(async()=>{fixture=await createRequestReportFixture();manager=userWith(fixture.manager,[])})
  afterEach(()=>vi.restoreAllMocks())
  afterAll(()=>prisma.$disconnect())
  it('combines all request types and outcomes for the actual team, excluding an outside request even when its approval names this manager',async()=>{
    const result=await reports.getReport(manager,input())
    expect(result.total).toBe(7) // original approved leave and its separate cancellation request both count
    expect(result.items.map(r=>r.id)).toEqual(expect.arrayContaining(fixture.ids))
    expect(result.items.map(r=>r.id)).not.toContain(fixture.outsideId)
    expect(result.items.map(r=>r.kind)).toEqual(expect.arrayContaining(['Leave','Leave cancellation','Regularisation','On duty','Comp off','Shift change']))
    const regularisation=result.items.find(r=>r.kind==='Regularisation')!
    expect(regularisation.reason).toContain('18:30; please check the gate register.')
    expect(regularisation.decisions[0]?.comment).toBe('Checked the attendance and handover; agreed.')
    expect(result.items.find(r=>r.kind==='On duty')?.decisions[0]?.comment).toContain('customer visit dates')
    expect(result.items.find(r=>r.kind==='Leave cancellation')?.reason).toBe('The appointment moved; I will attend work as usual.')
  })
  it('distinguishes waiting and held requests and filters exact types, employees and date basis',async()=>{
    expect((await reports.getReport(manager,{...input(),status:'HELD'})).items.map(r=>r.kind)).toEqual(['Leave cancellation'])
    const waiting=await reports.getReport(manager,{...input(),status:'PENDING'})
    expect(waiting.items.map(r=>r.kind).sort()).toEqual(['Comp off','Leave'])
    expect((await reports.getReport(manager,{...input(),kind:'ON_DUTY'})).items.map(r=>r.status)).toEqual(['Rejected'])
    expect((await reports.getReport(manager,{...input(),search:fixture.outside.employeeCode})).total).toBe(0)
    const future=new Date(fixture.date.getTime()+10*86400000)
    const id=await fixture.request(fixture.employee,'REGULARIZATION','PENDING','Cross-period work dates')
    await prisma.regularizationRequest.update({where:{approvalRequestId:id},data:{fromDate:future,toDate:future}})
    expect((await reports.getReport(manager,input())).items.map(r=>r.id)).not.toContain(id)
    const raised=await reports.getReport(manager,{...input(),dateBy:'RAISED'})
    expect(raised.items.map(r=>r.id)).toContain(id)
    expect(raised.items.map(r=>r.id)).not.toContain(fixture.outsideId)
  })
  it('"Raised" days are India days: ten past midnight belongs to the new day, ten to midnight to the day before',async()=>{
    const midnight=fixture.date.getTime()-IST_OFFSET_MS // the moment fixture.date starts in India
    const yesterday=new Date(fixture.date.getTime()-86400000)
    const early=await fixture.request(fixture.employee,'REGULARIZATION','PENDING','Raised just after midnight')
    const late=await fixture.request(fixture.employee,'REGULARIZATION','PENDING','Raised just before midnight')
    await prisma.approvalRequest.update({where:{id:early},data:{createdAt:new Date(midnight+10*60000)}})
    await prisma.approvalRequest.update({where:{id:late},data:{createdAt:new Date(midnight-10*60000)}})
    const raisedOn=async(day:Date)=>(await reports.getReport(manager,{...input(),from:day,to:day,dateBy:'RAISED'})).items.map(r=>r.id)
    const today=await raisedOn(fixture.date),before=await raisedOn(yesterday)
    expect(today).toContain(early)
    expect(today).not.toContain(late)
    expect(before).toContain(late)
    expect(before).not.toContain(early)
  })
  it('keeps area-specific role scopes separate from relationships',async()=>{
    const leaveOnly=userWith(fixture.manager,[{access:{LEAVE:'READ'},rows:[row(fixture.company.id,null,null,'READ')]}])
    const result=await reports.getReport(leaveOnly,{...input(),scope:'ALL'})
    expect(result.items.every(r=>['Leave','Leave cancellation','Comp off'].includes(r.kind))).toBe(true)
    expect(result.items.length).toBeGreaterThan(0)
    const attendanceOnly=userWith(fixture.manager,[{access:{ATTENDANCE:'READ'},rows:[row(fixture.outsideCompany.id,null,null,'READ')]}])
    const outside=await reports.getReport(attendanceOnly,{...input(),scope:'ALL'})
    expect(outside.items.map(r=>r.id)).toContain(fixture.outsideId)
    expect(outside.items.map(r=>r.employeeCode)).not.toContain(fixture.employee.employeeCode)
    await expect(reports.getReport(manager,{...input(),scope:'ALL'})).rejects.toMatchObject({code:'FORBIDDEN'})
  })
  it('uses actual HOD appointments independently of role access',async()=>{
    expect((await reports.getReport(manager,{...input(),scope:'DEPARTMENT'})).total).toBe(0)
    const person=await prisma.employee.findUniqueOrThrow({where:{id:fixture.employee.id},select:{hodPostId:true}})
    await hodsService.appointHod({employeeCode:fixture.manager.employeeCode,postIds:[person.hodPostId!]},userWith(fixture.manager,[],{isSuperAdmin:true}))
    const report=await reports.getReport(manager,{...input(),scope:'DEPARTMENT'})
    expect(report.items.map(r=>r.id)).toEqual(expect.arrayContaining(fixture.ids))
    expect(report.items.map(r=>r.id)).not.toContain(fixture.outsideId)
  })
  it('exports all pages with full messages and step history, preserving stored decisions',async()=>{
    const first=await reports.getReport(manager,{...input(),pageSize:2})
    const second=await reports.getReport(manager,{...input(),pageSize:2,page:2})
    expect(first.items.length).toBe(2)
    expect(second.items.every(r=>!first.items.some(a=>a.id===r.id))).toBe(true)
    const before=await prisma.approvalRequest.findMany({where:{id:{in:fixture.ids}},select:{id:true,status:true,updatedAt:true}})
    const book=await workbook(await reports.exportReport(manager,input()))
    const sheet=book.getWorksheet('Team requests')!, history=book.getWorksheet('Approval history')!
    expect(sheet.rowCount-1).toBe(first.total)
    const text=sheet.getSheetValues().flat(2).join(' ')
    expect(text).toContain('18:30; please check the gate register.')
    expect(text).not.toContain('PRIVATE OUTSIDE TEAM MESSAGE')
    expect(history.getSheetValues().flat(2).join(' ')).toContain('confirm the customer visit dates')
    expect(book.getWorksheet('Review notes')).toBeDefined()
    expect(await prisma.approvalRequest.findMany({where:{id:{in:fixture.ids}},select:{id:true,status:true,updatedAt:true}})).toEqual(before)
    expect((await reports.getReport(manager,{...input(),page:999})).items.length).toBeGreaterThan(0)
  })
  it('rejects inverted/oversized date ranges and never silently truncates a large export',async()=>{
    await expect(reports.getReport(manager,{...input(),to:new Date(fixture.date.getTime()-86400000)})).rejects.toMatchObject({code:'BAD_REQUEST'})
    await expect(reports.exportReport(manager,{...input(),to:new Date(fixture.date.getTime()+367*86400000)})).rejects.toMatchObject({code:'BAD_REQUEST'})
    vi.spyOn(asAsync(reportsRepository),'count').mockResolvedValue(20_001)
    await expect(reports.exportReport(manager,input())).rejects.toMatchObject({code:'BAD_REQUEST',message:expect.stringContaining('20,000')})
  })
})
