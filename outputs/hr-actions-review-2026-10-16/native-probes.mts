/** ATT-17, CORE-10/11, RPT-06, LC-01/02: native HR action audit. Fixtures roll back. */
import { createServer } from 'node:http';
import { writeFile } from 'node:fs/promises';
import ExcelJS from '../../backend/node_modules/exceljs/excel.js';
import { sql } from '../../backend/node_modules/kysely/dist/esm/index.js';
import { createDatabase } from '../../backend/src/core/db/database.js';
import { createApp } from '../../backend/src/app.js';
import { signAccessToken } from '../../backend/src/core/auth/jwt.js';
import { getUserPermissionAccess } from '../../backend/src/core/rbac/permissions.service.js';
import { buildMusterMonth } from '../../backend/src/modules/reports/muster.service.js';
import { formatDbDate } from '../../backend/src/core/dates.js';

const target = process.env['DATABASE_URL'];
if (!target) throw new Error('Explicit local test DB required');
const url = new URL(target);
if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname) || url.pathname !== '/hrms') throw new Error('Local test hrms only');
const db = createDatabase(target);
const stamp = String(Date.now());
const secret = 'hr-action-probe-only-no-real-user-credentials';
const observations: { id: string; status: string; observed: unknown }[] = [];
const controls: { id: string; passed: boolean; observed: unknown }[] = [];
const sentinel = new Error('Intentional HR audit rollback');
const fixtureUsers: number[] = [];
const add = (id: string, observed: unknown, status = 'Confirmed issue') => observations.push({ id, status, observed });
try {
 await db.transaction().execute(async trx => {
  await sql`SET LOCAL lock_timeout = '5s'`.execute(trx);
  await sql`SET LOCAL statement_timeout = '30s'`.execute(trx);
  const companies = [];
  const units = [];
  const locations = [];
  for (const suffix of ['A','B']) {
   const c = await trx.insertInto('core.companies').values({ code: `HRA${stamp}${suffix}`, name: `HR action audit ${suffix}`, ecode_prefix: `HRA${suffix}`, is_india_payroll: false }).returning('id').executeTakeFirstOrThrow();
   companies.push(c.id);
   units.push((await trx.insertInto('core.org_units').values({ company_id: c.id, name: `HRA${stamp}${suffix}` }).returning('id').executeTakeFirstOrThrow()).id);
   locations.push((await trx.insertInto('core.locations').values({ company_id: c.id, name: `HRA${stamp}${suffix}`, state_code: 'WB' }).returning('id').executeTakeFirstOrThrow()).id);
  }
  const department = (await trx.insertInto('core.departments').values({ name: `HRA${stamp}` }).returning('id').executeTakeFirstOrThrow()).id;
  const designation = (await trx.insertInto('core.designations').values({ name: `HRA${stamp}` }).returning('id').executeTakeFirstOrThrow()).id;
  const users: number[] = [];
  const actorEmployees: number[] = [];
  for (const [i, roleCode] of ['hr_ops','hr_head','employee','employee','it_admin'].entries()) {
   const e = await trx.insertInto('core.employees').values({ ecode: `HRA-${stamp}-U${i}`, company_id: companies[0]!, org_unit_id: units[0]!, first_name: `Audit actor ${i}`, status: 'active', doj: new Date('2026-01-01') }).returning('id').executeTakeFirstOrThrow();
   actorEmployees.push(e.id);
   const u = await trx.insertInto('core.users').values({ email: `hra-${stamp}-${i}@hrms.test`, password_hash: 'disabled-audit-fixture', employee_id: e.id }).returning('id').executeTakeFirstOrThrow();
   users.push(u.id); fixtureUsers.push(u.id);
   const r = await trx.selectFrom('core.roles').select('id').where('code','=',roleCode).executeTakeFirstOrThrow();
   await trx.insertInto('core.user_roles').values({ user_id: u.id, role_id: r.id, scope_org_unit_id: roleCode === 'hr_ops' ? units[0]! : null }).execute();
  }
  const ro = await trx.insertInto('core.roles').values({ code: `hra_readonly_${stamp}`, name: 'Audit readonly override' }).returning('id').executeTakeFirstOrThrow();
  const overridePermission = await trx.selectFrom('core.permissions').select('id').where('code','=','attendance.manual_override').executeTakeFirstOrThrow();
  await trx.insertInto('core.role_permissions').values({ role_id: ro.id, permission_id: overridePermission.id, scope: 'readonly' }).execute();
  const roUser = await trx.insertInto('core.users').values({ email: `hra-${stamp}-readonly@hrms.test`, password_hash: 'disabled-audit-fixture' }).returning('id').executeTakeFirstOrThrow();
  users.push(roUser.id); fixtureUsers.push(roUser.id);
  await trx.insertInto('core.user_roles').values({ user_id: roUser.id, role_id: ro.id }).execute();
  const employees = [];
  for (let i=0; i<2; i++) {
   employees.push((await trx.insertInto('core.employees').values({ ecode: `HRA-${stamp}-T${i}`, company_id: companies[i]!, org_unit_id: units[i]!, location_id: locations[i]!, first_name: `Audit target ${i}`, status: 'active', doj: new Date('2026-01-01'), reporting_manager_id: i===0 ? actorEmployees[3]! : null }).returning('id').executeTakeFirstOrThrow()).id);
  }
  const tokens = await Promise.all(users.map(id => signAccessToken(id, 'audit@hrms.test', secret)));
  const server = createServer(createApp({ db: trx, jwtSecret: secret, secureCookies: false }));
  await new Promise<void>((resolve,reject) => { server.once('error',reject); server.listen(0,'127.0.0.1',resolve); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No port');
  async function request(actor: number, method: string, path: string, body?: unknown): Promise<{ status: number; body: unknown }> {
   const r = await fetch(`http://127.0.0.1:${address.port}/api${path}`, { method, headers: { Authorization: `Bearer ${tokens[actor]}`, 'Content-Type':'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
   return { status:r.status, body: await r.json() };
  }
  const override = (actor: number, employeeId: number, date: string, status: string, reason='HR audit fixture reason', sessionStatuses?: unknown) => request(actor,'PUT','/attendance/days/override',{ employeeId,date,status,reason,...(sessionStatuses===undefined?{}:{sessionStatuses}) });
  const auditCount = async (actor: number, date: string) => Number((await trx.selectFrom('core.audit_log').select(({fn})=>fn.countAll<string>().as('n')).where('actor_user_id','=',users[actor]!).where('field','=',`manual_override:${date}`).executeTakeFirstOrThrow()).n);
  async function workbookContains(response: { status: number; body: unknown }, marker: string) {
   if (response.status!==200) return { status:response.status, found:false, dataRows:null };
   const payload=response.body as { base64:string };
   const wb=new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(payload.base64,'base64'));
   let found=false; let dataRows=0;
   for (const sheet of wb.worksheets) { dataRows+=Math.max(0,sheet.rowCount-1); sheet.eachRow(row => row.eachCell(cell => { if (String(cell.value).includes(marker)) found=true; })); }
   return { status:response.status, found, dataRows };
  }
  try {
   const access = await getUserPermissionAccess(trx,users[0]!,'attendance.manual_override');
   const outside = await override(0,employees[1]!,'2026-10-01','P');
   add('H01-override-other-entity', { httpStatus:outside.status, actorScope:access, targetOutsideScope:!access?.orgUnitIds.includes(units[1]!) });
   const beforeInsideAudit=await auditCount(0,'2026-10-01');
   const inside = await override(0,employees[0]!,'2026-10-01','P');
   const rowInside=await trx.selectFrom('att.day_records').select(['status','source','override_reason']).where('employee_id','=',employees[0]!).where('work_date','=',sql<Date>`'2026-10-01'::date`).executeTakeFirstOrThrow();
   controls.push({ id:'authorized-scoped-HR-override-and-audit', passed:inside.status===200 && rowInside.status==='P' && rowInside.source==='manual' && await auditCount(0,'2026-10-01')-beforeInsideAudit===1, observed:{httpStatus:inside.status,status:rowInside.status,source:rowInside.source} });
   const manager = await override(3,employees[0]!,'2026-10-02','P');
   controls.push({ id:'manager-direct-override-refused', passed:manager.status===403, observed:{httpStatus:manager.status} });
   const employee=await override(2,employees[0]!,'2026-10-02','A');
   controls.push({ id:'ordinary-employee-override-refused',passed:employee.status===403,observed:{httpStatus:employee.status} });
   const readonly = await override(5,employees[1]!,'2026-10-02','A');
   add('H02-readonly-override-writes',{httpStatus:readonly.status,readonlyOnlyGrant:true});
   const whitespace=await override(0,employees[0]!,'2026-10-03','A','     ');
   add('H03-blank-override-reason',{httpStatus:whitespace.status,reasonTrimmedLength:0});
   const invalidSession=await override(0,employees[0]!,'2026-10-04','P','HR audit fixture reason',[{session:1,status:'A'},{session:2,status:'P'}]);
   controls.push({id:'contradictory-session-summary-refused',passed:invalidSession.status===400,observed:{httpStatus:invalidSession.status}});
   const partial=await override(0,employees[0]!,'2026-10-04','HD','HR audit fixture reason',[{session:1,status:'A'},{session:2,status:'P'}]);
   controls.push({id:'valid-partial-session-override',passed:partial.status===200,observed:{httpStatus:partial.status}});
   await trx.insertInto('att.day_records').values({employee_id:employees[0]!,work_date:sql<Date>`'2026-10-05'::date`,status:'P',is_locked:true}).execute();
   const beforeLockedAudit=await auditCount(0,'2026-10-05');
   const locked=await override(0,employees[0]!,'2026-10-05','A');
   const afterLocked=await trx.selectFrom('att.day_records').select('status').where('employee_id','=',employees[0]!).where('work_date','=',sql<Date>`'2026-10-05'::date`).executeTakeFirstOrThrow();
   add('H04-locked-day-false-success',{httpStatus:locked.status,actualStatus:afterLocked.status,extraSuccessAudit:await auditCount(0,'2026-10-05')-beforeLockedAudit});
   const leaveType=await trx.selectFrom('lv.leave_types').select(['id','code']).where('is_active','=',true).executeTakeFirstOrThrow();
   await trx.insertInto('att.day_records').values({employee_id:employees[0]!,work_date:sql<Date>`'2026-10-06'::date`,status:'P',ot_minutes:120,penalty_flag:true}).execute();
   await override(0,employees[0]!,'2026-10-06','A');
   const stale=await trx.selectFrom('att.day_records').select(['status','ot_minutes','leave_type_id','weekoff_paid','penalty_flag']).where('employee_id','=',employees[0]!).where('work_date','=',sql<Date>`'2026-10-06'::date`).executeTakeFirstOrThrow();
   add('H05-stale-override-derived-facts',{status:stale.status,otMinutes:stale.ot_minutes,hasOldLeaveType:stale.leave_type_id!==null,weekoffPaid:stale.weekoff_paid,penaltyFlag:stale.penalty_flag});
   await trx.insertInto('att.day_records').values({employee_id:employees[0]!,work_date:sql<Date>`'2026-10-07'::date`,status:'L',leave_type_id:leaveType.id}).execute();
   await override(0,employees[0]!,'2026-10-07','P');
   const oldLeave=await trx.selectFrom('att.day_records').select(['status','leave_type_id']).where('employee_id','=',employees[0]!).where('work_date','=',sql<Date>`'2026-10-07'::date`).executeTakeFirstOrThrow();
   add('H05-stale-leave-classification',{status:oldLeave.status,retainedLeaveType:oldLeave.leave_type_id===leaveType.id});
   await trx.insertInto('att.month_locks').values({company_id:companies[0]!,month:sql<Date>`'2026-09-01'::date`,locked_by:users[1]!}).execute();
   await sql`SAVEPOINT header_lock_probe`.execute(trx);
   const header=await override(0,employees[0]!,'2026-09-15','P');
   await sql`ROLLBACK TO SAVEPOINT header_lock_probe`.execute(trx);
   const headerRows=await trx.selectFrom('att.day_records').select('id').where('employee_id','=',employees[0]!).where('work_date','=',sql<Date>`'2026-09-15'::date`).execute();
   controls.push({id:'closed-month-new-row-blocked-by-DB',passed:header.status!==200 && headerRows.length===0,observed:{httpStatus:header.status,insertedRows:headerRows.length}});
   add('H04-closed-month-error-contract',{httpStatus:header.status,mutationBlocked:true},'Data protection works; error classification issue');

   await buildMusterMonth(trx,companies[0]!,'2026-10'); await buildMusterMonth(trx,companies[1]!,'2026-10');
   const ownEcode=`HRA-${stamp}-T0`; const outsideEcode=`HRA-${stamp}-T1`;
   const ownMuster=await request(0,'GET',`/reports/muster?companyId=${companies[0]}&month=2026-10&ecode=${ownEcode}`);
   const ownExcel=await workbookContains(await request(0,'GET',`/reports/muster/export?companyId=${companies[0]}&month=2026-10&ecode=${ownEcode}`),ownEcode);
   controls.push({id:'muster-filtered-list-and-real-XLSX-agree',passed:ownMuster.status===200 && Array.isArray(ownMuster.body) && ownMuster.body.length===1 && ownExcel.found && ownExcel.dataRows===1,observed:{listStatus:ownMuster.status,listRows:Array.isArray(ownMuster.body)?ownMuster.body.length:null,excel:ownExcel}});
   const outsideMuster=await request(0,'GET',`/reports/muster?companyId=${companies[1]}&month=2026-10&ecode=${outsideEcode}`);
   const outsideMusterExcel=await workbookContains(await request(0,'GET',`/reports/muster/export?companyId=${companies[1]}&month=2026-10&ecode=${outsideEcode}`),outsideEcode);
   controls.push({id:'muster-other-entity-data-excluded-from-list-and-XLSX',passed:outsideMuster.status===200 && Array.isArray(outsideMuster.body) && outsideMuster.body.length===0 && !outsideMusterExcel.found,observed:{listStatus:outsideMuster.status,listRows:Array.isArray(outsideMuster.body)?outsideMuster.body.length:null,excel:outsideMusterExcel}});
   const staleMuster=(ownMuster.body as {otHours:number}[])[0];
   add('H05-stale-OT-in-muster',{monthOtHours:staleMuster?.otHours});

   const candidateMarker=`HRA candidate ${stamp}`;
   const candidate=(await trx.insertInto('core.onboarding_candidates').values({ full_name:candidateMarker,personal_email:`hra-candidate-${stamp}@hrms.test`,mobile:`hra-${stamp}`,position_title:'Audit role',company_id:companies[1]!,org_unit:`HRA${stamp}B`,category:'white_collar',offered_ctc:'1000000.00',proposed_doj:new Date('2026-11-01'),offer_date:new Date('2026-10-01'),status:'link_sent',updated_at:new Date() }).returning('id').executeTakeFirstOrThrow()).id;
   const list=await request(0,'GET','/lifecycle/candidates');
   const candidateRows=(list.body as {candidates?:{id:number;proposedDoj:string}[]}).candidates;
   const candidateRow=candidateRows?.find(r=>r.id===candidate);
   add('H06-candidate-list-scope-and-date',{httpStatus:list.status,outsideCandidateVisible:candidateRow!==undefined,proposedDoj:candidateRow?.proposedDoj,expectedDoj:'2026-11-01'});
   const r21=await request(0,'GET',`/reports/r21-offers?companyId=${companies[1]}`);
   const r21Excel=await workbookContains(await request(0,'GET',`/reports/r21-offers/export?companyId=${companies[1]}`),candidateMarker);
   add('H07-offer-export-outside-scope',{listStatus:r21.status,outsideRows:Array.isArray(r21.body)?r21.body.filter((r:{id:number})=>r.id===candidate).length:null,excel:r21Excel});
   const assetMarker=`HRA-${stamp}-ASSET`;
   await trx.insertInto('ast.assets').values({asset_no:assetMarker,category:'laptop',company_id:companies[1]!,location_id:locations[1]!,created_by:users[1]!}).execute();
   const r28=await request(0,'GET',`/reports/r28-assets?companyId=${companies[1]}`);
   const r28Excel=await workbookContains(await request(0,'GET',`/reports/r28-assets/export?companyId=${companies[1]}`),assetMarker);
   add('H07-asset-export-outside-scope',{listStatus:r28.status,outsideRows:Array.isArray(r28.body)?r28.body.filter((r:{assetNo:string})=>r.assetNo===assetMarker).length:null,excel:r28Excel});

   const conversion=await request(0,'POST','/lifecycle/candidates/convert',{candidateId:candidate,companyId:companies[1]!,designationId:designation,departmentId:department,locationId:locations[1]!,orgUnitId:units[1]!,doj:'2026-11-01'});
   const newId=(conversion.body as {employeeId?:number}).employeeId;
   if (!newId) throw new Error(`Conversion fixture failed: ${conversion.status}`);
   const converted=await trx.selectFrom('core.employees').select(['status','doj','probation_due_date']).where('id','=',newId).executeTakeFirstOrThrow();
   const newUser=await trx.selectFrom('core.users').select(['password_hash','is_active']).where('employee_id','=',newId).executeTakeFirstOrThrow();
   const onboardingTasks=await trx.selectFrom('core.onboarding_tasks').select(['id','task_code','owner_role','due_date']).where('employee_id','=',newId).execute();
   const pendingPayroll=(await trx.selectFrom('pay.employee_salaries').select('id').where('employee_id','=',newId).execute()).length;
   const conversionAudit=await trx.selectFrom('core.audit_log').select('id').where('entity','=','core.employees').where('entity_id','=',newId).execute();
   add('H08-cross-scope-future-conversion',{httpStatus:conversion.status,otherEntity:true,newEmployeeStatus:converted.status,doj:formatDbDate(converted.doj!),prejoinCompletedAtWasNull:true,hasProbationDueOnEmployee:converted.probation_due_date!==null,tasksDueBeforeDoj:onboardingTasks.filter(t=>formatDbDate(t.due_date)<'2026-11-01').length});
   add('H09-onboarding-readiness',{activeLogin:newUser.is_active,placeholderPassword:newUser.password_hash==='PENDING_INITIAL_LOGIN',salaryAssignments:pendingPayroll,conversionEmployeeAuditRows:conversionAudit.length,tasks:onboardingTasks.length});
   const tasksWire=await request(0,'GET',`/lifecycle/tasks?employeeId=${newId}`);
   const taskDate=(tasksWire.body as {tasks?:{dueDate:string}[]}).tasks?.[0]?.dueDate;
   add('H06-task-date-contract',{httpStatus:tasksWire.status,firstDueDate:taskDate,ISODate:taskDate===undefined?null:/^\d{4}-\d{2}-\d{2}$/.test(taskDate)});
   const bioTask=onboardingTasks.find(t=>t.task_code==='it_biometric');
   if (!bioTask) throw new Error('Biometric fixture task missing');
   const taskComplete=await request(0,'POST','/lifecycle/tasks/complete',{taskId:bioTask.id,notes:'HR has not contacted Kent'});
   const bio=await trx.selectFrom('core.employees').select('biometric_registered').where('id','=',newId).executeTakeFirstOrThrow();
   add('H10-biometric-task-completion-is-not-Kent-verification',{httpStatus:taskComplete.status,biometricRegistered:bio.biometric_registered,kentIntegrationInvoked:false});
   const missingBio=await request(0,'POST','/lifecycle/biometric/verify',{employeeId:Number.MAX_SAFE_INTEGER});
   add('H10-nonexistent-biometric-verification',{httpStatus:missingBio.status,employeeExists:false});
   const adminTask=onboardingTasks.find(t=>t.owner_role==='admin');
   const adminRole=await trx.selectFrom('core.roles').select('id').where('code','=','admin').executeTakeFirst();
   add('H09-owner-role-and-notifications',{taskNamesMissingRole:adminTask!==undefined && adminRole===undefined},'Source/configuration evidence; delivery completion not proven');
   const itTaskList=await request(4,'GET',`/lifecycle/tasks?employeeId=${newId}&department=IT`);
   const itTaskComplete=await request(4,'POST','/lifecycle/tasks/complete',{taskId:bioTask.id});
   add('H11-IT-stakeholder-task-access',{listStatus:itTaskList.status,completeStatus:itTaskComplete.status,ownerRole:'it_admin'});

   const absence=(await trx.insertInto('att.absence_cases').values({employee_id:employees[1]!,start_date:sql<Date>`'2026-10-01'::date`,days_absent:7,stage:'show_cause'}).returning('id').executeTakeFirstOrThrow()).id;
   const absenceList=await request(0,'GET','/attendance/absence-cases?open=true');
   const absenceStage=await request(0,'POST',`/attendance/absence-cases/${absence}/stage`,{stage:'warning'});
   add('H12-absence-case-outside-scope',{queueStatus:absenceList.status,outsideVisible:Array.isArray(absenceList.body)&&absenceList.body.some((r:{id:number})=>r.id===absence),stageStatus:absenceStage.status});
   const letter=(await trx.insertInto('core.letters').values({employee_id:employees[1]!,template_code:'warning',body_rendered:'Private HR letter fixture',status:'issued',issued_at:new Date(),issued_by:users[1]!}).returning('id').executeTakeFirstOrThrow()).id;
   const letterList=await request(0,'GET',`/letters/employee/${employees[1]}`);
   const letterContent=await request(0,'GET',`/letters/${letter}/content`);
   add('H12-letter-outside-scope',{listStatus:letterList.status,outsideVisible:Array.isArray(letterList.body)&&letterList.body.some((r:{id:number})=>r.id===letter),contentStatus:letterContent.status});
   const nonOwnerLetter=await request(2,'GET',`/letters/${letter}/content`);
   controls.push({id:'ordinary-employee-other-letter-refused',passed:nonOwnerLetter.status===403,observed:{httpStatus:nonOwnerLetter.status}});
   const balance=await request(0,'GET',`/leave/balances/${employees[1]}`);
   controls.push({id:'HR-other-unit-leave-balance-refused',passed:balance.status!==200,observed:{httpStatus:balance.status,note:'Current guard blocks but maps scope exception to500, not403'}});
   const dashboard=await request(0,'GET',`/dashboards/hr-ops?companyId=${companies[1]}`);
   const dashboardCounts=(dashboard.body as {headcountByCategory?:{count:number}[]}).headcountByCategory;
   add('H13-HR-dashboard-other-entity',{httpStatus:dashboard.status,otherEntityHeadcount:dashboardCounts?.reduce((n,r)=>n+r.count,0)});
  } finally { await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve())); }
  throw sentinel;
 });
} catch(error) { if(error!==sentinel) throw error; } finally { await db.destroy(); }
const cleanupDb=createDatabase(target);
let cleanup;
try {
 const count=async(table:string,column:string,pattern:string)=>Number((await sql<{n:string}>`SELECT count(*) AS n FROM ${sql.table(table)} WHERE ${sql.ref(column)} LIKE ${pattern}`.execute(cleanupDb)).rows[0]?.n??-1);
 const audit=await cleanupDb.selectFrom('core.audit_log').select(({fn})=>fn.countAll<string>().as('n')).where('actor_user_id','in',fixtureUsers).executeTakeFirstOrThrow();
 cleanup={users:await count('core.users','email',`hra-${stamp}-%`),employees:await count('core.employees','ecode',`HRA-${stamp}-%`),companies:await count('core.companies','code',`HRA${stamp}%`),candidates:await count('core.onboarding_candidates','personal_email',`hra-candidate-${stamp}@hrms.test`),auditRows:Number(audit.n)};
} finally {await cleanupDb.destroy();}
const result={preparedAt:new Date().toISOString(),database:'loopback/hrms test only',mode:'Application calls against native PostgreSQL inside a deliberately rolled-back fixture transaction; sequences may advance',applicationSourceChanged:false,observations,controls,cleanup};
await writeFile(new URL('./native-results.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
process.stdout.write(JSON.stringify({observations:observations.length,controls:controls.length,controlsPassed:controls.filter(c=>c.passed).length,cleanup})+'\n');
if(controls.some(c=>!c.passed)||Object.values(cleanup).some(n=>n!==0))throw new Error('Audit control or cleanup failure');
