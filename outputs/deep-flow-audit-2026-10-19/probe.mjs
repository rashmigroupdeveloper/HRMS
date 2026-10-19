// Synthetic, rollback-only service probes. No real employee values are printed.
// Run: cd backend && node_modules/.bin/tsx ../outputs/deep-flow-audit-2026-10-19/probe.mjs
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createDatabase } from '../../backend/src/core/db/database.ts';
import { ProbationService } from '../../backend/src/modules/lifecycle/probation/probation.service.ts';
import { OnboardingService } from '../../backend/src/modules/lifecycle/onboarding/onboarding.service.ts';
import { PayrollRunService } from '../../backend/src/modules/payroll-core/runs/run.service.ts';
import { ReconciliationService } from '../../backend/src/modules/payroll-core/reconciliation/reconciliation.service.ts';
import { BankFileService } from '../../backend/src/modules/payroll-outputs/bank/bank-file.service.ts';
import { insertSalaryRevision, findEffectiveSalary } from '../../backend/src/modules/payroll-core/salaries/assignment.repository.ts';
import { projectAnnualTax } from '../../backend/src/modules/payroll-core/runs/statutory-context.ts';
import { computeEmployeePayroll } from '../../backend/src/modules/payroll-core/engine/compute-engine.ts';
import { loanInstalment } from '../../backend/src/modules/payroll-core/runs/run-compute.service.ts';
import { generateAmortizationSchedule } from '../../backend/src/modules/loans/amortization.ts';
import { SeparationService } from '../../backend/src/modules/lifecycle/separation/separation.service.ts';
const require = createRequire(new URL('../../backend/package.json', import.meta.url));
require('dotenv').config({ path: new URL('../../backend/.env', import.meta.url).pathname });
const { sql } = require('kysely');
const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/hrms') throw Error('Authorized local hrms target required');
process.env.STORAGE_DIR = new URL('./synthetic-storage', import.meta.url).pathname;
const db = createDatabase(url.href);
const rollback = new Error('intentional audit rollback');
const results = [];
async function probe(id, run) {
  let observation;
  try {
    await db.transaction().execute(async tx => { observation = await run(tx); throw rollback; });
    throw Error('Rollback was not reached');
  } catch (error) {
    if (error !== rollback) { results.push({ id, status: 'PROBE_ERROR', error: String(error.message) }); return; }
  }
  results.push({ id, status: 'OBSERVED', ...observation, databaseRowsRolledBack: true });
}
async function base(tx, india = true) {
  const tag = 'AUD' + randomUUID().replaceAll('-', '').slice(0, 10);
  const company = await tx.insertInto('core.companies').values({code:tag,name:'Synthetic flow audit',ecode_prefix:tag,is_india_payroll:india}).returning('id').executeTakeFirstOrThrow();
  const actor = await tx.insertInto('core.users').values({email:tag+'@hrms.invalid',password_hash:'!disabled-audit-fixture!'}).returning('id').executeTakeFirstOrThrow();
  const emp = await tx.insertInto('core.employees').values({company_id:company.id,ecode:tag,first_name:'Synthetic audit employee',status:'active',doj:'2025-07-01',bank_account:'123456789012',bank_ifsc:'ABCD0123456',pf_applicable:false,esic_applicable:false}).returning('id').executeTakeFirstOrThrow();
  const structure = await tx.insertInto('pay.salary_structures').values({company_id:company.id,name:tag,components:sql`${JSON.stringify([{component_code:'BASIC',amount_rule:{type:'fixed',value:10000}}])}::jsonb`}).returning('id').executeTakeFirstOrThrow();
  return {tag, companyId:company.id,actorId:actor.id,employeeId:emp.id,structureId:structure.id};
}
async function salary(tx, f, from='2025-07-01', amount=1000000) {
  return insertSalaryRevision(tx,{employee_id:f.employeeId,structure_id:f.structureId,effective_from:from,annual_ctc:'120000.00',phase:'probation',component_amounts:{BASIC:amount},revision_reason:'joining',approved_by:f.actorId});
}
async function lockedRun(tx, f, type='regular') {
  let lock=await tx.selectFrom('att.month_locks').select('id').where('company_id','=',f.companyId).where('month','=',sql`'2025-07-01'::date`).executeTakeFirst();
  if (!lock) for(let day=1;day<=31;day++) await tx.insertInto('att.day_records').values({employee_id:f.employeeId,work_date:`2025-07-${String(day).padStart(2,'0')}`,status:'P',is_locked:true}).execute();
  lock ??= await tx.insertInto('att.month_locks').values({company_id:f.companyId,month:'2025-07-01',locked_by:f.actorId,locked_at:new Date()}).returning('id').executeTakeFirstOrThrow();
  const svc=new PayrollRunService(tx);
  const runId=await svc.createRun({companyId:f.companyId,month:'2025-07-01',actorUserId:f.actorId,attendanceLockId:lock.id,runType:type});
  await svc.lockInputs(runId,f.actorId);
  return {svc,runId,result:await svc.computeRun(runId,f.actorId)};
}
try {
  await probe('A01-confirmation-salary-and-date-gap',async tx=>{
    const f=await base(tx);await salary(tx,f);
    const review=await tx.insertInto('core.probation_reviews').values({employee_id:f.employeeId,due_date:'2025-10-01',status:'under_review'}).returning('id').executeTakeFirstOrThrow();
    await ProbationService.decideReview(tx,{reviewId:review.id,outcome:'confirmed',decidedByUserId:f.actorId,confirmationDate:'2025-10-01',confirmedAnnualCtc:120000, salaryStructureId:f.structureId});
    const confirmed=await findEffectiveSalary(tx,f.employeeId,'2025-10-01');
    const previousDay=await findEffectiveSalary(tx,f.employeeId,'2025-09-30');
    await ProbationService.decideReview(tx,{reviewId:review.id,outcome:'extended',decidedByUserId:f.actorId,extensionMonths:3});
    const current=await tx.selectFrom('core.probation_reviews').select(['status','outcome']).where('id','=',review.id).executeTakeFirstOrThrow();
    return {confirmedComponents:confirmed.component_amounts,previousDayHasSalary:Boolean(previousDay),completedDecisionRewritten:current.outcome};
  });
  await probe('A02-joining-without-salary-and-dropped-fields',async tx=>{
    const f=await base(tx);const tag=f.tag+'C';
    const dep=await tx.insertInto('core.departments').values({name:tag}).returning('id').executeTakeFirstOrThrow();
    const des=await tx.insertInto('core.designations').values({name:tag}).returning('id').executeTakeFirstOrThrow();
    const loc=await tx.insertInto('core.locations').values({company_id:f.companyId,name:tag,state_code:'WB'}).returning('id').executeTakeFirstOrThrow();
    const org=await tx.insertInto('core.org_units').values({company_id:f.companyId,name:tag}).returning('id').executeTakeFirstOrThrow();
    const app={presentAddress:'Synthetic address',permanentAddress:'Synthetic permanent address',emergencyContactName:'Synthetic contact',emergencyContactPhone:'9000000000',emergencyContactRelation:'Parent',pan:'QQQQQ9999Q',aadhaar:'123456789012',bankName:'Synthetic bank',bankAccount:'INVALID-ACCOUNT',bankIfsc:'XXXXXXXXXXX',gender:'female',maritalStatus:'married',fatherName:'Synthetic father',declarationAccepted:true};
    const c=await tx.insertInto('core.onboarding_candidates').values({full_name:'Synthetic Candidate',personal_email:tag+'@hrms.invalid',mobile:tag,position_title:'Synthetic',company_id:f.companyId,category:'white_collar',offered_ctc:'120000',probation_salary_pct:80,proposed_doj:'2025-07-01',offer_date:'2025-06-01',status:'prejoin_done',prejoin_completed_at:new Date(),prejoin_submitted_data:JSON.stringify(app)}).returning('id').executeTakeFirstOrThrow();
    const joined=await OnboardingService.convertCandidate(tx,{candidateId:c.id,companyId:f.companyId,designationId:des.id,departmentId:dep.id,locationId:loc.id,orgUnitId:org.id,doj:'2025-07-01',joiningConfirmed:true},{userId:f.actorId,scope:{all:true,own:false,subtree:false,orgUnitIds:[],actorEmployeeId:null}});
    const emp=await tx.selectFrom('core.employees').select(['gender','marital_status','bank_account','bank_ifsc']).where('id','=',joined.employeeId).executeTakeFirstOrThrow();
    const salaries=await tx.selectFrom('pay.employee_salaries').select('id').where('employee_id','=',joined.employeeId).execute();
    return {conversionSucceeded:true,salaryRows:salaries.length,genderStored:emp.gender,maritalStatusStored:emp.marital_status,invalidBankAccountAccepted:emp.bank_account===app.bankAccount,invalidIfscAccepted:emp.bank_ifsc===app.bankIfsc};
  });
  await probe('A03-missing-employee-reconciles',async tx=>{
    const f=await base(tx);await salary(tx,f);
    await tx.insertInto('core.employees').values({company_id:f.companyId,ecode:f.tag+'M',first_name:'Synthetic missing salary',status:'active',doj:'2025-07-01'}).execute();
    const run=await lockedRun(tx,f);
    const recon=await new ReconciliationService(tx).reconcileRun(run.runId);
    return {employeeCount:run.result.employeeCount,omittedCount:run.result.exceptions.length,reconciliationPassed:recon.isReconciled,anomalies:recon.anomalies};
  });
  await probe('A04-midmonth-revision-omitted',async tx=>{
    const f=await base(tx);await salary(tx,f);await salary(tx,f,'2025-07-15',1200000);
    const run=await lockedRun(tx,f);
    return {employeeCount:run.result.employeeCount,exceptionReasons:run.result.exceptions.map(x=>x.reason)};
  });
  await probe('A05-nonindia-offcycle-and-unapproved-bank-file',async tx=>{
    const f=await base(tx,false);await salary(tx,f);
    const regular=await lockedRun(tx,f);
    const offcycle=await lockedRun(tx,f,'off_cycle');
    const bank=await new BankFileService(tx).generateBankBatch(regular.runId,f.actorId);
    const state=await tx.selectFrom('pay.payroll_runs').select('status').where('id','=',regular.runId).executeTakeFirstOrThrow();
    return {nonIndiaRunComputed:regular.result.employeeCount===1,regularGrossPaise:regular.result.grossPaise,offcycleGrossPaise:offcycle.result.grossPaise,bankGeneratedAtStatus:state.status,bankRecordCount:bank.recordCount,bankTotalRupees:bank.totalAmountRupees};
  });
  await probe('A06-hra-treated-as-full-deduction',async tx=>{
    const f=await base(tx);
    const params={employeeId:f.employeeId,regime:'old',contractedMonthlyGrossPaise:20000000,monthlyPtPaise:20000,fy:'2025-26'};
    const before=await projectAnnualTax(tx,params);
    await tx.insertInto('pay.investment_declarations').values({employee_id:f.employeeId,fy:'2025-26',section:'HRA_RENT',declared_amount:'600000'}).execute();
    const after=await projectAnnualTax(tx,params);
    return {annualTaxBeforeRupees:before/100,annualTaxAfterRupees:after/100,taxReductionRupees:(before-after)/100};
  });
  const codes=['BASIC','DA','OT_ALLOW','OT'];
  const catalog=new Map(codes.map((code,i)=>[code,{code,name:code,kind:'earning',partOfGross:true,partOfPfWages:code==='BASIC',prorateOnLop:true,displayOrder:i}]));
  const rates={pfEeBp:1200,pfErBp:1200,epsBp:833,pfWageCeilingPaise:1500000,epsCapPaise:125000,edliBp:50,edliCapPaise:7500,pfAdminBp:50,esicEeBp:75,esicErBp:325,esicCeilingPaise:2100000,otDivisor:208,otMultiplier:2};
  const ot=computeEmployeePayroll({employeeId:1,salaryComponentsPaise:{BASIC:2000000,DA:500000,OT_ALLOW:300000},daysInMonth:30,payableDays:30,otMinutes:240,rates,pf:{applicable:false,wageBasis:'ACTUAL'},ptSlabs:[],stateCode:'WB'},catalog);
  results.push({id:'A07-g10-main-engine-ot',status:'OBSERVED',actualOtRupees:ot.lines.find(x=>x.componentCode==='OT').amountPaise/100,expectedUnroundedG10Rupees:1076.92,expectedRupeeRounded:1077});
  const schedule=generateAmortizationSchedule({loanType:'loan_flat',principal:1200000,annualInterestRate:12,tenureMonths:12});
  const instalment=loanInstalment({outstanding:'12000',emi:(schedule.monthlyEmi/100).toFixed(2),interest_rate:'12',loan_type:'loan_flat'});
  results.push({id:'A08-flat-loan-posting',status:'OBSERVED',schedulePrincipalRupees:schedule.schedule[0].principalPart/100,scheduleInterestRupees:schedule.schedule[0].interestPart/100,payrollPrincipalRupees:instalment.principalPaise/100,payrollInterestRupees:instalment.interestPaise/100});
  await probe('A09-fnf-leave-loan-and-tax',async tx=>{
    const f=await base(tx);await salary(tx,f);
    const s=await tx.insertInto('core.separations').values({employee_id:f.employeeId,initiated_by:'hr',reason:'Synthetic audit separation',resignation_date:'2025-07-01',notice_period_days:0,requested_lwd:'2025-07-15',approved_lwd:'2025-07-15',status:'approved',shortfall_days:'0'}).returning('id').executeTakeFirstOrThrow();
    for(const department of ['IT','Admin','Finance','HR']) await tx.insertInto('core.clearances').values({separation_id:s.id,department,status:'cleared',recovery_amount:'0',cleared_by:f.actorId,cleared_at:new Date()}).execute();
    const el=await tx.selectFrom('lv.leave_types').select('id').where('code','=','EL').executeTakeFirstOrThrow();
    await tx.insertInto('lv.ledger').values({employee_id:f.employeeId,leave_type_id:el.id,txn_type:'grant',delta:'10',effective_date:'2025-07-01',note:'Synthetic audit grant'}).execute();
    const loan=await tx.insertInto('pay.loans').values({employee_id:f.employeeId,loan_type:'emi_no_interest',principal:'1000',outstanding:'1000',emi:'100',start_month:'2025-07-01',tenure_months:10,status:'active'}).returning('id').executeTakeFirstOrThrow();
    const svc=new SeparationService(tx);
    const calc=await svc.computeFnf({separationId:s.id,userId:f.actorId});
    const paid=await svc.finalizeAndPayFnf({separationId:s.id,paidByUserId:f.actorId,paymentReference:'SYNTHETIC-AUDIT'});
    const remainingLoan=await tx.selectFrom('pay.loans').select(['outstanding','status']).where('id','=',loan.id).executeTakeFirstOrThrow();
    const ledger=await tx.selectFrom('lv.ledger').select('delta').where('employee_id','=',f.employeeId).where('leave_type_id','=',el.id).execute();
    return {settlementPaid:paid.status,daysPaidWithoutAttendanceLock:calc.daysPayable,tdsDefaultPaise:calc.deductions.tdsPaise,loanRecoveredPaise:calc.deductions.loanRecoveryPaise,loanAfterPayment:remainingLoan,elEncashedDays:10,elLedgerBalanceAfterPayment:ledger.reduce((s,r)=>s+Number(r.delta),0)};
  });
} finally {
  await db.destroy();
  await writeFile(new URL('./probe-results.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
  for(const r of results) console.log(JSON.stringify(r));
}
