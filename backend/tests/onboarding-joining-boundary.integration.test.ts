/** LC-01/02, CORE-02/06: candidate forms never create employees before HR joining confirmation. */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, type Kysely, type Transaction } from 'kysely';
import type { Database } from '../src/core/db/types.js';
import { createDatabase } from '../src/core/db/database.js';
import { OnboardingService, TaskFanoutService, PrejoinService } from '../src/modules/lifecycle/index.js';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { httpRequest } from './http-client.js';
import { onboardingReferenceData } from '../src/modules/lifecycle/onboarding/onboarding-reference.js';
const application = { presentAddress:'Synthetic address', permanentAddress:'Synthetic permanent address', emergencyContactName:'Synthetic contact', emergencyContactPhone:'9000000000', emergencyContactRelation:'Parent', pan:'ABCDE1234F', aadhaar:'123456789012', bankName:'Synthetic bank', bankAccount:'12345678', bankIfsc:'ABCD0123456' };
const url = process.env['DATABASE_URL'];
const rollback = new Error('Intentional onboarding boundary rollback');
describe.skipIf(!url)('Actual joining boundary (native PostgreSQL)', () => {
  let db: Kysely<Database>;
  beforeAll(() => { db = createDatabase(url ?? ''); });
  afterAll(async () => { await db.destroy(); });
  async function fixture(run: (tx: Transaction<Database>, candidateId: number, companyId: number, userId: number) => Promise<void>) {
    try { await db.transaction().execute(async tx => {
      const tag = 'join_' + randomUUID().slice(0,8);
      const company = await tx.insertInto('core.companies').values({code:tag,name:tag,ecode_prefix:tag,is_india_payroll:false}).returning('id').executeTakeFirstOrThrow();
      const user = await tx.insertInto('core.users').values({email:tag+'@hrms.invalid',password_hash:'!disabled!'}).returning('id').executeTakeFirstOrThrow();
      const candidate = await tx.insertInto('core.onboarding_candidates').values({full_name:'Synthetic Joining',personal_email:tag+'candidate@hrms.invalid',mobile:tag,position_title:'Synthetic',company_id:company.id,category:'white_collar',offered_ctc:'0',proposed_doj:sql<Date>`'1998-09-30'::date`,offer_date:sql<Date>`'1998-09-01'::date`,updated_at:new Date(),status:'prejoin_done',prejoin_completed_at:new Date(),prejoin_submitted_data:JSON.stringify({...application,pan:randomUUID().replaceAll('-','').slice(0,10).toUpperCase()})}).returning('id').executeTakeFirstOrThrow();
      await run(tx,candidate.id,company.id,user.id); throw rollback;
    }); } catch(error) { if(error!==rollback) throw error; }
  }
  const input = (candidateId: number, companyId: number) => ({candidateId,companyId,designationId:1,departmentId:1,locationId:1,orgUnitId:1,doj:'1998-09-30',joiningConfirmed:true as const});
  const actor = (userId: number) => ({userId,scope:{all:true,own:false,subtree:false,orgUnitIds:[],actorEmployeeId:null}});
  const unchanged = async (tx: Transaction<Database>, companyId: number) => {
    expect((await tx.selectFrom('core.companies').select('ecode_next_seq').where('id','=',companyId).executeTakeFirstOrThrow()).ecode_next_seq).toBe(1);
    expect(await tx.selectFrom('core.employees').select('id').where('company_id','=',companyId).execute()).toHaveLength(0);
  };
  async function masters(tx: Kysely<Database>, companyId: number) {
    const tag = 'joining_master_' + randomUUID().slice(0,8);
    const department = await tx.insertInto('core.departments').values({name:tag}).returning('id').executeTakeFirstOrThrow();
    const designation = await tx.insertInto('core.designations').values({name:tag}).returning('id').executeTakeFirstOrThrow();
    const location = await tx.insertInto('core.locations').values({name:tag,company_id:companyId,state_code:'WB'}).returning('id').executeTakeFirstOrThrow();
    const unit=await tx.insertInto('core.org_units').values({name:tag,company_id:companyId}).returning('id').executeTakeFirstOrThrow();
    return {departmentId:department.id,designationId:designation.id,locationId:location.id,orgUnitId:unit.id};
  }
  async function client(tx:Transaction<Database>, userId:number, scope:'all'|'org_unit'='all',orgUnitId?:number) {
    const role=await tx.insertInto('core.roles').values({code:'join_role_'+randomUUID(),name:'Synthetic onboarding authority'}).returning('id').executeTakeFirstOrThrow();
    const permission=await tx.selectFrom('core.permissions').select('id').where('code','=','lifecycle.onboard.convert').executeTakeFirstOrThrow();
    await tx.insertInto('core.role_permissions').values({role_id:role.id,permission_id:permission.id,scope}).execute();
    await tx.insertInto('core.user_roles').values({user_id:userId,role_id:role.id,scope_org_unit_id:orgUnitId??null}).execute();
    const session=await tx.insertInto('sec.sessions').values({user_id:userId,expires_at:new Date(Date.now()+60000)}).returning('sid').executeTakeFirstOrThrow();
    const secret='synthetic-joining-contract-secret';
    const token=await signAccessToken(userId,'synthetic@hrms.invalid',secret,session.sid);
    return {request:await httpRequest(createApp({db:tx,jwtSecret:secret,secureCookies:false})),token};
  }
  it('exposes real company prefixes and company-bound master choices through the typed HTTP contract',async()=>fixture(async(tx,id,company,user)=>{
    const catalog=await masters(tx,company);
    const {request,token}=await client(tx,user);
    expect((await request.get('/api/lifecycle/onboarding-reference-data')).status).toBe(401);
    const response=await request.get('/api/lifecycle/onboarding-reference-data?companyId='+String(company)).auth(token,{type:'bearer'});
    expect(response.status).toBe(200);
    const body=response.body as {companies:{id:number;ecodePrefix:string}[];locations:{id:number}[]};
    expect(body.companies.find(c=>c.id===company)?.ecodePrefix).toBeDefined();
    expect(body.locations.map(l=>l.id)).toEqual([catalog.locationId]);
    const applicationResponse=await request.get(`/api/lifecycle/candidates/${id}/application`).auth(token,{type:'bearer'});
    expect(applicationResponse.status).toBe(200);
    const applicationBody=applicationResponse.body as {candidateId:number;profile:Record<string,unknown>};
    expect(applicationBody.candidateId).toBe(id);expect(applicationBody.profile['presentAddress']).toBe('Synthetic address');
    expect(applicationBody.profile['panProvided']).toBe(true);expect(applicationBody.profile['bankDetailsProvided']).toBe(true);
    for(const field of ['pan','aadhaar','uan','bankName','bankAccount','bankIfsc','prejoin_token_hash','prejoin_link_token']) expect(applicationBody.profile).not.toHaveProperty(field);

    expect((await onboardingReferenceData(tx,{...actor(user).scope,all:false},undefined)).companies).toEqual([]);
  }));
  it('lets scoped HR rotate an unsubmitted prejoin link without asserting delivery or exposing it to foreign scope',async()=>fixture(async(tx,id,company,user)=>{
    const original=PrejoinService.generateToken(1);
    await tx.updateTable('core.onboarding_candidates').set({status:'awaiting_prejoin',prejoin_completed_at:null,prejoin_submitted_data:null,prejoin_token_hash:original.tokenHash,prejoin_token_expires_at:original.expiresAt}).where('id','=',id).execute();
    const {request,token}=await client(tx,user);
    const endpoint=`/api/lifecycle/candidates/${id}/prejoin-link`;
    expect((await request.post(endpoint).send({candidateId:id})).status).toBe(401);
    const response=await request.post(endpoint).auth(token,{type:'bearer'}).send({candidateId:id});
    expect(response.status).toBe(200);expect(response.headers['cache-control']).toBe('no-store');
    const issued=response.body as {rawToken:string;expiresAt:string};expect(issued.rawToken).toBeTruthy();
    expect((await PrejoinService.validateToken(tx,original.rawToken)).isValid).toBe(false);
    expect((await PrejoinService.validateToken(tx,issued.rawToken)).isValid).toBe(true);
    const candidate=await tx.selectFrom('core.onboarding_candidates').select(['prejoin_link_token','prejoin_link_sent_at','status']).where('id','=',id).executeTakeFirstOrThrow();
    expect(candidate).toEqual({prejoin_link_token:null,prejoin_link_sent_at:null,status:'awaiting_prejoin'});
    const foreignUser=await tx.insertInto('core.users').values({email:randomUUID()+'@hrms.invalid',password_hash:'!disabled!'}).returning('id').executeTakeFirstOrThrow();
    const foreign=await client(tx,foreignUser.id,'org_unit');
    expect((await foreign.request.post(endpoint).auth(foreign.token,{type:'bearer'}).send({candidateId:id})).status).toBe(404);
    await unchanged(tx,company);
  }));
  it('enforces the actual joining confirmation and input types at the HTTP boundary',async()=>fixture(async(tx,id,company,user)=>{
    const {request,token}=await client(tx,user);
    const {joiningConfirmed:ignored,...withoutConfirmation}=input(id,company);
    expect(ignored).toBe(true);
    for(const payload of [withoutConfirmation,{...input(id,company),joiningConfirmed:false},{...input(id,company),departmentId:-1},{...input(id,company),workEmail:'invented invalid email'}]) {
      expect((await request.post('/api/lifecycle/candidates/convert').auth(token,{type:'bearer'}).send(payload)).status).toBe(400);
      await unchanged(tx,company);
    }
  }));
  it('rejects a scoped HR attempt outside its candidate population without exposing a candidate name',async()=>fixture(async(tx,id,company,user)=>{
    const {request,token}=await client(tx,user,'org_unit');
    const response=await request.post('/api/lifecycle/candidates/convert').auth(token,{type:'bearer'}).send(input(id,company));
    expect(response.status).toBe(403);expect(JSON.stringify(response.body)).not.toContain('Synthetic Joining');
    expect((await request.get(`/api/lifecycle/candidates/${id}/application`).auth(token,{type:'bearer'})).status).toBe(404);
    expect((await request.get('/api/lifecycle/onboarding-reference-data?companyId='+String(company)).auth(token,{type:'bearer'})).status).toBe(403);
    const candidates=await request.get('/api/lifecycle/candidates').auth(token,{type:'bearer'});
    expect(candidates.status).toBe(200);expect(candidates.body as {candidates:unknown[]}).toEqual({candidates:[]});
    await unchanged(tx,company);
  }));
  it('creates one permanent employee from the configured entity prefix only after joining confirmation', async () => fixture(async (tx,id,company,user) => {
    const catalog = await masters(tx,company);
    await unchanged(tx,company);
    const result = await OnboardingService.convertCandidate(tx,{...input(id,company),...catalog},actor(user));
    const prefix = (await tx.selectFrom('core.companies').select('ecode_prefix').where('id','=',company).executeTakeFirstOrThrow()).ecode_prefix;
    expect(result.ecode).toBe(prefix+'000001');
    expect(await tx.selectFrom('core.employees').select(['id','status','work_email']).where('id','=',result.employeeId).executeTakeFirstOrThrow()).toEqual({id:result.employeeId,status:'active',work_email:null});
    expect(await tx.selectFrom('core.users').select('id').where('employee_id','=',result.employeeId).execute()).toHaveLength(0);
    expect(await tx.selectFrom('core.onboarding_tasks').select('id').where('employee_id','=',result.employeeId).execute()).toHaveLength(5);
    const biometricTask=await tx.selectFrom('core.onboarding_tasks').select('id').where('employee_id','=',result.employeeId).where('task_code','=','it_biometric').executeTakeFirstOrThrow();
    await expect(TaskFanoutService.verifyBiometricRegistration(tx,result.employeeId,user)).rejects.toThrow(/unavailable/i);
    await expect(TaskFanoutService.completeTask(tx,biometricTask.id,user)).rejects.toThrow(/unavailable/i);
    expect((await tx.selectFrom('core.employees').select('biometric_registered').where('id','=',result.employeeId).executeTakeFirstOrThrow()).biometric_registered).toBe(false);
    expect((await tx.selectFrom('core.onboarding_tasks').select('status').where('id','=',biometricTask.id).executeTakeFirstOrThrow()).status).toBe('open');
    const {request,token}=await client(tx,user);
    expect((await request.post('/api/lifecycle/biometric/verify').auth(token,{type:'bearer'}).send({employeeId:result.employeeId})).status).toBe(503);
    expect((await request.post('/api/lifecycle/tasks/complete').auth(token,{type:'bearer'}).send({taskId:biometricTask.id})).status).toBe(503);
    const emailTask=await tx.selectFrom('core.onboarding_tasks').select('id').where('employee_id','=',result.employeeId).where('task_code','=','it_email').executeTakeFirstOrThrow();
    for(let attempt=0;attempt<2;attempt++) expect((await request.post('/api/lifecycle/tasks/complete').auth(token,{type:'bearer'}).send({taskId:emailTask.id,notes:'Synthetic setup evidence'})).status).toBe(200);
    expect(await tx.selectFrom('core.audit_log').select('id').where('entity','=','core.onboarding_tasks').where('entity_id','=',emailTask.id).execute()).toHaveLength(1);
    const restrictedUser=await tx.insertInto('core.users').values({email:randomUUID()+'@hrms.invalid',password_hash:'!disabled!'}).returning('id').executeTakeFirstOrThrow();
    const restricted=await client(tx,restrictedUser.id,'org_unit');
    expect((await restricted.request.post('/api/lifecycle/tasks/complete').auth(restricted.token,{type:'bearer'}).send({taskId:emailTask.id})).status).toBe(403);
    const hidden=await restricted.request.get('/api/lifecycle/tasks').auth(restricted.token,{type:'bearer'});
    expect(hidden.status).toBe(200);expect(hidden.body as {tasks:unknown[]}).toEqual({tasks:[]});


    expect(await tx.selectFrom('core.audit_log').select('id').where('actor_user_id','=',user).where('field','=','actual_joining_confirmed').execute()).toHaveLength(1);
    await expect(OnboardingService.convertCandidate(tx,{...input(id,company),...catalog},actor(user))).rejects.toThrow(/already converted/);
    expect((await tx.selectFrom('core.companies').select('ecode_next_seq').where('id','=',company).executeTakeFirstOrThrow()).ecode_next_seq).toBe(2);
  }));
  it('rejects a location belonging to another employing entity before allocating a code', async () => fixture(async (tx,id,company,user) => {
    const catalog = await masters(tx,company);
    const foreignCompany = await tx.insertInto('core.companies').values({code:'foreign_'+String(id),name:'Foreign '+String(id),ecode_prefix:'F'+String(id)}).returning('id').executeTakeFirstOrThrow();
    const foreign = await masters(tx,foreignCompany.id);
    await expect(OnboardingService.convertCandidate(tx,{...input(id,company),...catalog,locationId:foreign.locationId},actor(user))).rejects.toThrow(/location|entity/i);
    await unchanged(tx,company);
  }));
  it('rejects forged master IDs without creating employee records', async () => fixture(async (tx,id,company,user) => {
    const catalog = await masters(tx,company);
    for (const key of ['departmentId','designationId','gradeId','orgUnitId','reportingManagerId','salaryStructureId'] as const) {
      await expect(OnboardingService.convertCandidate(tx,{...input(id,company),...catalog,[key]:2147483647},actor(user))).rejects.toThrow(/assignment|department|designation|grade|unit|manager|structure/i);
      await unchanged(tx,company);
    }
  }));
  it('rejects a work email already used by an employee even without a login, without disclosing their identity',async()=>fixture(async(tx,id,company,user)=>{
    const catalog=await masters(tx,company);
    const other=await tx.insertInto('core.companies').values({code:'email_owner_'+String(id),name:'Synthetic email owner',ecode_prefix:'EO'+String(id)}).returning('id').executeTakeFirstOrThrow();
    const email='joining_collision_'+String(id)+'@hrms.invalid';
    await tx.insertInto('core.employees').values({company_id:other.id,ecode:'EMAILOWNER'+String(id),first_name:'Hidden identity',work_email:email.toUpperCase()}).execute();
    await expect(OnboardingService.convertCandidate(tx,{...input(id,company),...catalog,workEmail:email},actor(user))).rejects.toThrow('Duplicate candidate identity detected; authorized HR reconciliation is required.');
    await unchanged(tx,company);
    expect((await tx.selectFrom('core.onboarding_candidates').select('status').where('id','=',id).executeTakeFirstOrThrow()).status).toBe('prejoin_done');
  }));
  it('rejects a fabricated completed flag when the application itself is incomplete', async () => fixture(async (tx,id,company,user) => {
    const catalog = await masters(tx,company);
    await tx.updateTable('core.onboarding_candidates').set({prejoin_submitted_data:'{}'}).where('id','=',id).execute();
    await expect(OnboardingService.convertCandidate(tx,{...input(id,company),...catalog},actor(user))).rejects.toThrow(/application/i);
    await unchanged(tx,company);
  }));
  it('retains scoped HR authority after conversion by assigning the chosen real organizational unit',async()=>fixture(async(tx,id,company,user)=>{
    const catalog=await masters(tx,company);
    const scoped={...actor(user),scope:{...actor(user).scope,all:false,orgUnitIds:[catalog.orgUnitId]}};
    const employee=await OnboardingService.convertCandidate(tx,{...input(id,company),...catalog},scoped);
    expect((await tx.selectFrom('core.employees').select('org_unit_id').where('id','=',employee.employeeId).executeTakeFirstOrThrow()).org_unit_id).toBe(catalog.orgUnitId);
    const {request,token}=await client(tx,user,'org_unit',catalog.orgUnitId);
    const candidates=await request.get('/api/lifecycle/candidates').auth(token,{type:'bearer'});
    expect(candidates.status).toBe(200);expect((candidates.body as {candidates:{id:number}[]}).candidates.map(c=>c.id)).toContain(id);
    const tasks=await request.get('/api/lifecycle/tasks').auth(token,{type:'bearer'});
    expect(tasks.status).toBe(200);expect((tasks.body as {tasks:unknown[]}).tasks).toHaveLength(5);
  }));
  it('refuses a missing joining confirmation without consuming an e-code', async () => fixture(async (tx,id,company,user) => {
    await expect(OnboardingService.convertCandidate(tx,{...input(id,company),joiningConfirmed:false},actor(user))).rejects.toThrow(/joining/i);
    await unchanged(tx,company);
  }));
  it('refuses a future actual joining date', async () => fixture(async (tx,id,company,user) => {
    const future = `${new Date().getUTCFullYear()+1}-01-01`;
    await expect(OnboardingService.convertCandidate(tx,{...input(id,company),doj:future},actor(user))).rejects.toThrow(/future/i);
    await unchanged(tx,company);
  }));
  it('refuses an unsubmitted or no-show candidate even with a confirmation flag', async () => fixture(async (tx,id,company,user) => {
    for(const status of ['link_sent','no_show'] as const) {
      await tx.updateTable('core.onboarding_candidates').set({status,prejoin_completed_at:null}).where('id','=',id).execute();
      await expect(OnboardingService.convertCandidate(tx,input(id,company),actor(user))).rejects.toThrow(/completed|submitted/i);
      await unchanged(tx,company);
    }
  }));
  it('rejects changing the accepted candidate entity at conversion', async () => fixture(async (tx,id,company,user) => {
    await expect(OnboardingService.convertCandidate(tx,input(id,company+1),actor(user))).rejects.toThrow(/company|entity/i);
    await unchanged(tx,company);
  }));
  it('requires explicit HR actor context and does not accept implicit authority', async () => fixture(async (tx,id,company) => {
    await expect(OnboardingService.convertCandidate(tx,input(id,company))).rejects.toThrow(/HR|actor/i);
    await unchanged(tx,company);
  }));  it('rolls back employee, candidate, tasks and code cursor on a late audit failure', async () => {
    const tag = 'join_rollback_' + randomUUID().slice(0,8);
    const company = await db.insertInto('core.companies').values({code:tag,name:tag,ecode_prefix:tag,is_india_payroll:false}).returning('id').executeTakeFirstOrThrow();
    const catalog = await masters(db,company.id);
    const candidate = await db.insertInto('core.onboarding_candidates').values({full_name:'Synthetic rollback',personal_email:tag+'@hrms.invalid',mobile:tag,position_title:'Synthetic',company_id:company.id,category:'white_collar',offered_ctc:'0',proposed_doj:sql<Date>`'1998-09-30'::date`,offer_date:sql<Date>`'1998-09-01'::date`,updated_at:new Date(),status:'prejoin_done',prejoin_completed_at:new Date(),prejoin_submitted_data:JSON.stringify({...application,pan:randomUUID().replaceAll('-','').slice(0,10).toUpperCase()})}).returning('id').executeTakeFirstOrThrow();
    try {
      await expect(OnboardingService.convertCandidate(db,{...input(candidate.id,company.id),...catalog},actor(2147483647))).rejects.toMatchObject({code:'23503'});
      expect(await db.selectFrom('core.employees').select('id').where('company_id','=',company.id).execute()).toHaveLength(0);
      expect((await db.selectFrom('core.companies').select('ecode_next_seq').where('id','=',company.id).executeTakeFirstOrThrow()).ecode_next_seq).toBe(1);
      expect(await db.selectFrom('core.onboarding_candidates').select(['status','employee_id']).where('id','=',candidate.id).executeTakeFirstOrThrow()).toEqual({status:'prejoin_done',employee_id:null});
      expect(await db.selectFrom('core.onboarding_tasks').select('id').where('candidate_id','=',candidate.id).execute()).toHaveLength(0);
    } finally {
      await db.deleteFrom('core.onboarding_candidates').where('id','=',candidate.id).execute();
      await db.deleteFrom('core.locations').where('id','=',catalog.locationId).execute();
      await db.deleteFrom('core.departments').where('id','=',catalog.departmentId).execute();
      await db.deleteFrom('core.designations').where('id','=',catalog.designationId).execute();
      await db.deleteFrom('core.org_units').where('id','=',catalog.orgUnitId).execute();
      await db.deleteFrom('core.companies').where('id','=',company.id).execute();
    }
  });

});
