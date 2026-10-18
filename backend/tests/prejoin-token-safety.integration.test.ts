/** LC-01/NFR-03/CORE-06: candidate links are hashed, finite and single-use without creating employees. */
import 'dotenv/config';
import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {sql,type Kysely,type Transaction} from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { OnboardingService, PrejoinService } from '../src/modules/lifecycle/index.js';
import { readCompletedApplication } from '../src/modules/lifecycle/onboarding/joining-validation.js';
const url=process.env['DATABASE_URL'];
const rollback=new Error('Intentional candidate token fixture rollback');
const application={presentAddress:'Synthetic address',permanentAddress:'Synthetic permanent address',emergencyContactName:'Synthetic contact',emergencyContactPhone:'9000000000',emergencyContactRelation:'Parent',pan:'ABCDE1234F',aadhaar:'123456789012',bankName:'Synthetic bank',bankAccount:'12345678',bankIfsc:'ABCD0123456'};
describe.skipIf(!url)('Prejoin token safety (native PostgreSQL)',()=>{
  let db:Kysely<Database>;
  beforeAll(()=>{db=createDatabase(url??'');});
  afterAll(async()=>{await db.destroy();});
  async function fixture(run:(tx:Transaction<Database>,companyId:number)=>Promise<void>){
    try{await db.transaction().execute(async tx=>{
      const tag='prejoin_'+randomUUID().slice(0,8);
      const company=await tx.insertInto('core.companies').values({code:tag,name:tag,ecode_prefix:tag,is_india_payroll:false}).returning('id').executeTakeFirstOrThrow();
      await tx.insertInto('core.settings').values({key:'lifecycle.prejoin_token_hours',value:'72',value_type:'number',description:'Synthetic token lifetime'}).onConflict(oc=>oc.column('key').doUpdateSet({value:'72',value_type:'number'})).execute();
      await run(tx,company.id);throw rollback;
    });}catch(error){if(error!==rollback)throw error;}
  }
  async function ingest(tx:Transaction<Database>,companyId:number){
    const tag=randomUUID();
    return OnboardingService.ingestCandidate(tx,{companyId,fullName:'Synthetic prejoin',personalEmail:tag+'@hrms.invalid',mobile:'9000000000',positionTitle:'Synthetic',offeredCtc:0,proposedDoj:'1998-09-30',offerDate:'1998-09-01'});
  }
  it('stores only a hash and does not claim the generated link was delivered',async()=>fixture(async(tx,company)=>{
    const result=await ingest(tx,company);
    const candidate=await tx.selectFrom('core.onboarding_candidates').selectAll().where('id','=',result.candidateId).executeTakeFirstOrThrow();
    expect(candidate.prejoin_link_token).toBeNull();expect(candidate.prejoin_link_sent_at).toBeNull();expect(candidate.status).toBe('awaiting_prejoin');
    expect(candidate.prejoin_token_hash).toBe(createHash('sha256').update(result.rawToken).digest('hex'));
    expect(await tx.selectFrom('core.employees').select('id').where('company_id','=',company).execute()).toHaveLength(0);
    expect((await tx.selectFrom('core.companies').select('ecode_next_seq').where('id','=',company).executeTakeFirstOrThrow()).ecode_next_seq).toBe(1);
  }));
  it('rejects raw token storage at the database boundary',async()=>fixture(async(tx,company)=>{
    const result=await ingest(tx,company);
    await sql`SAVEPOINT raw_token_guard`.execute(tx);
    await expect(tx.updateTable('core.onboarding_candidates').set({prejoin_link_token:'synthetic-credential'}).where('id','=',result.candidateId).execute()).rejects.toMatchObject({code:'23514',constraint:'prejoin_raw_token_forbidden'});
    await sql`ROLLBACK TO SAVEPOINT raw_token_guard`.execute(tx);
    expect((await tx.selectFrom('core.onboarding_candidates').select('prejoin_link_token').where('id','=',result.candidateId).executeTakeFirstOrThrow()).prejoin_link_token).toBeNull();
  }));
  it('rejects no-show candidates and missing expiry without mutating the application',async()=>fixture(async(tx,company)=>{
    const result=await ingest(tx,company);
    for(const change of [{status:'no_show' as const},{status:'awaiting_prejoin' as const,prejoin_token_expires_at:null}]){
      await tx.updateTable('core.onboarding_candidates').set(change).where('id','=',result.candidateId).execute();
      expect((await PrejoinService.validateToken(tx,result.rawToken)).isValid).toBe(false);
      await expect(PrejoinService.submitPrejoinData(tx,result.rawToken,application)).rejects.toThrow();
      expect((await tx.selectFrom('core.onboarding_candidates').select('prejoin_completed_at').where('id','=',result.candidateId).executeTakeFirstOrThrow()).prejoin_completed_at).toBeNull();
    }
  }));
  it('accepts exactly one of two simultaneous submissions and prevents later replay',async()=>fixture(async(tx,company)=>{
    const result=await ingest(tx,company);
    const outcomes=await Promise.allSettled([PrejoinService.submitPrejoinData(tx,result.rawToken,application),PrejoinService.submitPrejoinData(tx,result.rawToken,{...application,bankName:'Second synthetic bank'})]);
    expect(outcomes.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(outcomes.filter(r=>r.status==='rejected')).toHaveLength(1);
    expect((await PrejoinService.validateToken(tx,result.rawToken)).isValid).toBe(false);
    expect((await tx.selectFrom('core.onboarding_candidates').select('status').where('id','=',result.candidateId).executeTakeFirstOrThrow()).status).toBe('prejoin_done');
    expect(await tx.selectFrom('core.employees').select('id').where('company_id','=',company).execute()).toHaveLength(0);
  }));
  it('commits one submission across independent database connections and records one audit event',async()=>{
    const peer=createDatabase(url??'');
    const tag='prejoin_root_'+randomUUID();
    const token=PrejoinService.generateToken(1);
    const candidate=await db.insertInto('core.onboarding_candidates').values({full_name:'Synthetic independent submission',personal_email:tag+'@hrms.invalid',mobile:'9000000000',position_title:'Synthetic',category:'white_collar',offered_ctc:'0',proposed_doj:sql<Date>`'1998-09-30'::date`,offer_date:sql<Date>`'1998-09-01'::date`,updated_at:new Date(),status:'awaiting_prejoin',prejoin_token_hash:token.tokenHash,prejoin_token_expires_at:token.expiresAt}).returning('id').executeTakeFirstOrThrow();
    try{
      const banks=['Independent synthetic bank A','Independent synthetic bank B'];
      const outcomes=await Promise.allSettled([PrejoinService.submitPrejoinData(db,token.rawToken,{...application,bankName:banks[0]??''}),PrejoinService.submitPrejoinData(peer,token.rawToken,{...application,bankName:banks[1]??''})]);
      expect(outcomes.filter(r=>r.status==='fulfilled')).toHaveLength(1);
      expect(outcomes.filter(r=>r.status==='rejected')).toHaveLength(1);
      const saved=await db.selectFrom('core.onboarding_candidates').select(['status','employee_id','prejoin_link_token','prejoin_submitted_data']).where('id','=',candidate.id).executeTakeFirstOrThrow();
      expect(saved.status).toBe('prejoin_done');expect(saved.employee_id).toBeNull();expect(saved.prejoin_link_token).toBeNull();
      const profile=readCompletedApplication(saved.prejoin_submitted_data);
      const winner=outcomes.findIndex(r=>r.status==='fulfilled');expect(profile.bankName).toBe(banks[winner]);
      const audit=await db.selectFrom('core.audit_log').select(['new_value','scope_org_unit_id']).where('entity','=','core.onboarding_candidates').where('entity_id','=',candidate.id).where('field','=','status').execute();
      expect(audit).toEqual([{new_value:'prejoin_done',scope_org_unit_id:null}]);
      await expect(PrejoinService.submitPrejoinData(peer,token.rawToken,application)).rejects.toThrow('no longer accepting a prejoin submission');
    }finally{
      // No employee/account is created. Keep the immutable, non-sensitive audit event.
      await db.deleteFrom('core.onboarding_candidates').where('id','=',candidate.id).execute();
      await peer.destroy();
    }
  });
  it('expires at the exact boundary rather than accepting one last submission',async()=>fixture(async(tx,company)=>{
    const result=await ingest(tx,company);
    const clock=vi.spyOn(Date,'now').mockReturnValue(result.expiresAt.getTime());
    try{expect((await PrejoinService.validateToken(tx,result.rawToken)).isValid).toBe(false);}finally{clock.mockRestore();}
  }));
  it('does not store an incomplete application when the service is called directly',async()=>fixture(async(tx,company)=>{
    const result=await ingest(tx,company);
    for(const invalid of [{...application,bankAccount:''},{...application,presentAddress:'     '},{...application,pan:'          '}]) await expect(PrejoinService.submitPrejoinData(tx,result.rawToken,invalid)).rejects.toThrow(/application|bank|validation/i);
    expect((await tx.selectFrom('core.onboarding_candidates').select('prejoin_completed_at').where('id','=',result.candidateId).executeTakeFirstOrThrow()).prejoin_completed_at).toBeNull();
  }));
});
