import { prisma, type ApprovalKind, type ApprovalStatus } from '#core/db/prisma'
import { today } from '#shared/utils/dates'
import { createCompany, createEmployee, createPlant } from './organization.js'

// Synthetic report fixtures: direct writes let the reporting tests cover historical outcomes without running payroll
// or approval side effects. The test runner/preview must already be bound to its *_test database.
export async function createRequestReportFixture() {
  const company = await createCompany(), outsideCompany = await createCompany()
  const plant = await createPlant(company.id), outsidePlant = await createPlant(outsideCompany.id)
  const manager = await createEmployee({companyId:company.id,plantId:plant.id})
  const employee = await createEmployee({companyId:company.id,plantId:plant.id})
  const outside = await createEmployee({companyId:outsideCompany.id,plantId:outsidePlant.id})
  await prisma.employee.update({where:{id:employee.id},data:{reportingManagerId:manager.id}})
  const date = today(), type = await prisma.leaveType.findFirstOrThrow({select:{id:true}})
  const by = {createdById:0,updatedById:0}
  async function request(person: typeof employee, kind: ApprovalKind, status: ApprovalStatus, message: string, held = false) {
    const feature = kind === 'LEAVE' || kind === 'LEAVE_CANCEL' ? 'LEAVE' : kind === 'COMP_OFF' ? 'COMP_OFF' : kind === 'SHIFT_CHANGE' ? 'SHIFT_CHANGE' : 'REGULARIZATION'
    const record = await prisma.approvalRequest.create({data:{...by,employeeId:person.id,requestedById:person.id,feature,kinds:[kind],status,
      summary:`${kind.replaceAll('_',' ')} · ${date.toISOString().slice(0,10)}`,
      ...(held?{heldAt:new Date(),heldById:0,heldReason:'HR approver position is vacant'}:{}),
      ...(status!=='PENDING'?{closedAt:new Date(),closedById:manager.id}:{}),
      ...(status==='CANCELLED'?{cancelReason:'Plans changed; request withdrawn'}:{}),
      steps:{create:{...by,stepNo:1,approverType:'REPORTING_MANAGER',approverId:manager.id,status:status==='PENDING'?'OPEN':status==='APPROVED'?'APPROVED':status==='REJECTED'?'REJECTED':'CANCELLED',
        openedAt:new Date(),openedById:0,...(status!=='PENDING'?{decidedAt:new Date(),decidedById:manager.id,comment:status==='REJECTED'?'Please confirm the customer visit dates before applying again.':'Checked the attendance and handover; agreed.'}:{})}},
    },select:{id:true}})
    const base={...by,employeeId:person.id,approvalRequestId:record.id,status:status==='EXPIRED'?'REJECTED' as const:status,reason:message}
    if(kind==='LEAVE'||kind==='LEAVE_CANCEL'){
      const original=kind==='LEAVE_CANCEL'?await prisma.approvalRequest.create({data:{...by,employeeId:person.id,requestedById:person.id,feature:'LEAVE',kinds:['LEAVE'],status:'APPROVED',summary:'Original leave',createdAt:new Date('2020-01-01')},select:{id:true}}):null
      await prisma.leaveApplication.create({data:{...base,leaveTypeId:type.id,fromDate:date,toDate:date,days:1,
        ...(original?{approvalRequestId:original.id,cancelApprovalRequestId:record.id,cancelReason:message,status:'APPROVED'}:{}),
      }})
    }else if(kind==='COMP_OFF')await prisma.compOffClaim.create({data:{...base,workDate:date,days:1}})
    else if(kind==='SHIFT_CHANGE')await prisma.shiftChangeRequest.create({data:{...base,date,kind:'CHANGE'}})
    else await prisma.regularizationRequest.create({data:{...base,fromDate:date,toDate:date,kind:kind==='ON_DUTY'?'ON_DUTY':'MISSED_PUNCH',portion:'FULL_DAY'}})
    return record.id
  }
  const ids = [
    await request(employee,'LEAVE','PENDING','Family function. I have handed over the shift report to my colleague.'),
    await request(employee,'REGULARIZATION','APPROVED','I forgot to clock out after the maintenance job.\nI left at 18:30; please check the gate register.'),
    await request(employee,'ON_DUTY','REJECTED','Customer visit at the plant for commissioning and handover.'),
    await request(employee,'COMP_OFF','PENDING','Worked on Sunday to finish the stock count; requesting a compensatory day.'),
    await request(employee,'SHIFT_CHANGE','CANCELLED','Please move me to the morning shift for the training session.'),
    await request(employee,'LEAVE_CANCEL','PENDING','The appointment moved; I will attend work as usual.',true),
  ]
  const outsideId=await request(outside,'REGULARIZATION','PENDING','PRIVATE OUTSIDE TEAM MESSAGE')
  return {company,plant,manager,employee,outside,outsideCompany,date,ids,outsideId,request}
}
