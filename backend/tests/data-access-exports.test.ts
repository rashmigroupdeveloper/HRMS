import ExcelJS from 'exceljs'
import { afterAll,beforeAll,describe,expect,it } from 'vitest'
import { prisma } from '#core/db/prisma'
import { today } from '#shared/utils/dates'
import * as days from '../src/modules/attendance/days/days.service.js'
import * as attendance from '../src/modules/attendance/attendance.service.js'
import * as rosters from '../src/modules/attendance/rosters/rosters.service.js'
import * as leave from '../src/modules/leave/applications/applications.service.js'
import * as employees from '../src/modules/employees/employees.service.js'
import * as approvals from '../src/modules/approvals/approvals.service.js'
import * as tasks from '../src/modules/joining-tasks/joining-tasks.service.js'
import * as hods from '../src/modules/employees/hods/hods.service.js'
import * as organization from '../src/modules/organization/organization.service.js'
import { createCompany,createEmployee,createPlant } from './helpers/organization.js'
import { row,userWith } from './helpers/users.js'
async function cells(file:File,sheetName?:string){const book=new ExcelJS.Workbook();await book.xlsx.load(await file.arrayBuffer());const rows:string[]=[];for(const sheet of book.worksheets.filter(s=>sheetName?s.name===sheetName:s.name!=='Review notes'))sheet.eachRow(r=>r.eachCell(c=>rows.push(c.text)));return rows}
describe('review exports preserve list access',()=>{
 let a:Awaited<ReturnType<typeof createEmployee>>,b:typeof a,viewer:ReturnType<typeof userWith>,companyA:number,companyB:number
 beforeAll(async()=>{
   companyA=(await createCompany()).id;companyB=(await createCompany()).id
   a=await createEmployee({companyId:companyA,plantId:(await createPlant(companyA)).id})
   b=await createEmployee({companyId:companyB,plantId:(await createPlant(companyB)).id})
   viewer=userWith(a,[{access:{ATTENDANCE:'READ',ATTENDANCE_SETUP:'READ',LEAVE:'READ',EMPLOYEES:'READ',ONBOARDING:'READ',HOD_APPOINTMENTS:'READ'},rows:[row(companyA,null,null,'READ')]}])
   for(const person of [a,b])await prisma.joiningTask.create({data:{employeeId:person.id,name:'Export isolation task',team:'Export test',dueDate:today(),createdById:0,updatedById:0}})
   const type=await prisma.leaveType.findFirstOrThrow({select:{id:true}})
   for(const person of [a,b]){
     const request=await prisma.approvalRequest.create({data:{feature:'LEAVE',kinds:['LEAVE'],employeeId:person.id,requestedById:person.id,summary:'Export isolation leave',heldAt:new Date(),heldById:0,heldReason:'Export test',createdById:0,updatedById:0},select:{id:true}})
     await prisma.leaveApplication.create({data:{employeeId:person.id,leaveTypeId:type.id,fromDate:today(),toDate:today(),days:1,reason:'Export isolation leave',status:'PENDING',approvalRequestId:request.id,createdById:0,updatedById:0}})
   }
 })
 afterAll(()=>prisma.$disconnect())
 it('exports only in-range people on the day board, schedules and roster',async()=>{
   const date=today()
   for(const file of [await days.exportBoard(viewer,{scope:'ALL',date}),await attendance.exportSetup(viewer,{section:'schedules'}),await rosters.exportGrid(viewer,{from:date,to:date})]){
     const values=await cells(file);expect(values).toContain(a.employeeCode);expect(values).not.toContain(b.employeeCode)
   }
 })
 it('refuses an out-of-range employee month, while own month remains available without a role',async()=>{
   const now=today(),input={year:now.getUTCFullYear(),month:now.getUTCMonth()+1}
   await expect(days.exportMonth(viewer,{...input,employeeCode:b.employeeCode})).rejects.toMatchObject({code:'NOT_FOUND'})
   const own=await days.exportMonth(userWith(a,[]),input)
   expect(own.name).toContain(a.employeeCode)
 })
 it('preserves team relationships and basic fields for the public directory',async()=>{
   const team=await cells(await employees.exportDirectory(userWith(a,[]),{group:'TEAM'}))
   expect(team).not.toContain(b.employeeCode)
   const everyone=await cells(await employees.exportDirectory(userWith(a,[]),{companyIds:[companyB]}))
   expect(everyone).toContain(b.employeeCode);expect(everyone).not.toContain('Salary');expect(everyone).not.toContain('PAN')
 })
 it('keeps own leave export identity-bound and held requests permission-bound',async()=>{
   const own=await cells(await leave.exportMine(userWith(a,[])),'Review notes')
   expect(own.join(' ')).toContain(a.employeeCode);expect(own.join(' ')).not.toContain(b.employeeCode)
   await expect(approvals.exportApprovals(userWith(a,[]),{mode:'held'})).rejects.toMatchObject({code:'FORBIDDEN'})
 })

 it('filters selected task IDs through the authorized list, and filters leave and held reports by company',async()=>{
   const outside=await prisma.joiningTask.findFirstOrThrow({where:{employeeId:b.id},select:{id:true}})
   const forged=await cells(await tasks.exportTasks({scope:'ALL',status:'OPEN',ids:[outside.id]},viewer))
   expect(forged).not.toContain(b.employeeCode)
   const visible=await cells(await tasks.exportTasks({scope:'ALL',status:'OPEN'},viewer))
   expect(visible).toContain(a.employeeCode);expect(visible).not.toContain(b.employeeCode)
   const applications=await cells(await leave.exportApplications(viewer,{scope:'ALL',from:today(),to:today()}))
   expect(applications).toContain(a.employeeCode);expect(applications).not.toContain(b.employeeCode)
   const repairer=userWith(a,[{access:{APPROVAL_CHAINS:'WRITE'},rows:[row(companyA,null,null)]}])
   const held=await cells(await approvals.exportApprovals(repairer,{mode:'held'}))
   expect(held).toContain(a.employeeCode);expect(held).not.toContain(b.employeeCode)
 })
 it('keeps HOD coverage inside the selected role range and department exports inside actual appointments',async()=>{
   const heads=await cells(await hods.exportHods(viewer,{view:'heads'}))
   const ca=await prisma.company.findUniqueOrThrow({where:{id:companyA},select:{code:true}})
   const cb=await prisma.company.findUniqueOrThrow({where:{id:companyB},select:{code:true}})
   expect(heads).toContain(ca.code);expect(heads).not.toContain(cb.code)
   const department=await cells(await hods.exportHods(viewer,{view:'department'}))
   expect(department).not.toContain(b.employeeCode)
 })
 it('does not treat client-selected master IDs as authority to read retired lists',async()=>{
   await expect(organization.exportOrganization(userWith(a,[]),{section:'companies',ids:[companyA,companyB]})).rejects.toMatchObject({code:'FORBIDDEN'})
 })
})
