/**
 * Travel & Expense Router HTTP Integration Tests (TE-01..12).
 *
 * Verifies:
 * - GET /api/travel/budgets (seeded grade entitlements)
 * - POST /api/travel/trips & GET /api/travel/trips
 * - POST /api/travel/trips/{tripId}/itineraries
 * - POST /api/travel/advances & GET /api/travel/advances
 * - POST /api/travel/claims & GET /api/travel/claims
 * - GET /api/travel/wallet & GET /api/travel/wallet/ledger
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app.js';
import { httpRequest } from './http-client.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { randomUUID } from 'node:crypto';
import type { Kysely, ControlledTransaction } from 'kysely';
import type { Database } from '../src/core/db/types.js';
import { createDatabase } from '../src/core/db/database.js';
import { act } from '../src/modules/workflows/index.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'synthetic-jwt-test-secret-at-least-32-characters-long';

interface TravelBody {
  budgets:unknown[];trip:{id:number;status:string};trips:unknown[];
  itinerary:{estimatedCostPaise:number};itineraries:unknown[];
  advance:{id:number;status:string};advances:unknown[];claim:{id:number};claims:unknown[];
  item:{amountPaise:number};settlementId:number;advanceAdjustedPaise:number;netRecoverablePaise:number;
  balancePaise:number;transactions:unknown[];
}
// Synthetic transaction only: never select an existing person or grant them a role.
describe.skipIf(!DB_URL)('Travel & Expense Router Endpoints (TE-01..12, C-02, P-23)', () => {
  let db:Kysely<Database>;
  let transaction:ControlledTransaction<Database>|undefined;
  let app:ReturnType<typeof createApp>;
  const ids = { employee: 0, employeeUser: 0, manager: 0, managerUser: 0, outsider: 0, payrollUser: 0 };
  const tokens = { employee: '', manager: '', outsider: '', payroll: '' };
  beforeAll(async()=>{
    db=createDatabase(DB_URL??'');
    transaction=await db.startTransaction().execute();
    const tx=transaction;
    const tag='travel_http_'+randomUUID().slice(0,8);
    const company=await tx.insertInto('core.companies').values({code:tag,name:tag,ecode_prefix:tag,is_india_payroll:false}).returning('id').executeTakeFirstOrThrow();
    const person=async(suffix:string, rm:number|null, role:string|null)=>{
      const e=await tx.insertInto('core.employees').values({company_id:company.id,ecode:`${tag}${suffix}`,first_name:`Synthetic ${suffix}`,status:'active',doj:'1998-01-01',reporting_manager_id:rm}).returning('id').executeTakeFirstOrThrow();
      const u=await tx.insertInto('core.users').values({email:`${tag}-${suffix}@hrms.invalid`,employee_id:e.id,password_hash:'!disabled!'}).returning(['id','email']).executeTakeFirstOrThrow();
      const roleRow=await tx.selectFrom('core.roles').select('id').where('code','=',role ?? 'employee').executeTakeFirstOrThrow();
      await tx.insertInto('core.user_roles').values({user_id:u.id,role_id:roleRow.id}).execute();
      const session=await tx.insertInto('sec.sessions').values({user_id:u.id,expires_at:new Date(Date.now()+600000)}).returning('sid').executeTakeFirstOrThrow();
      return { employeeId:e.id, userId:u.id, token: await signAccessToken(u.id,u.email,JWT_SECRET,session.sid) };
    };
    const manager=await person('mgr',null,null);
    const employee=await person('emp',manager.employeeId,null);
    const outsider=await person('out',null,null);
    const payroll=await person('pay',null,'payroll_admin');
    Object.assign(ids,{employee:employee.employeeId,employeeUser:employee.userId,manager:manager.employeeId,managerUser:manager.userId,outsider:outsider.employeeId,payrollUser:payroll.userId});
    Object.assign(tokens,{employee:employee.token,manager:manager.token,outsider:outsider.token,payroll:payroll.token});
    app=createApp({db:tx,jwtSecret:JWT_SECRET,secureCookies:false});
  });
  afterAll(async()=>{
    try {if(transaction && !transaction.isRolledBack && !transaction.isCommitted) await transaction.rollback().execute();}
    finally {await db.destroy();}
  });
  const txn = (): ControlledTransaction<Database> => { if (!transaction) throw new Error('transaction not started'); return transaction; };
  const approveAs = async (table:'te.trips'|'te.advances'|'te.claims', id:number, userId:number) => {
    const tx = txn();
    const row = await tx.selectFrom(table).select('workflow_request_id').where('id','=',id).executeTakeFirstOrThrow();
    expect(row.workflow_request_id).not.toBeNull();
    return act(tx, { requestId: Number(row.workflow_request_id), actorUserId: userId, action: 'approve' });
  };

  it('GET /api/travel/budgets returns active grade allowances', async () => {
    const res = await (await httpRequest(app)).get('/api/travel/budgets').auth(tokens.employee, { type: 'bearer' });
    expect(res.status).toBe(200);
    expect(Array.isArray((res.body as TravelBody).budgets)).toBe(true);
  });

  it('runs trip → RM approval → advance chain → disbursal → claim approval → settlement, refusing every shortcut', async () => {
    const client = await httpRequest(app);
    const as = (who: keyof typeof tokens) => ({ type: 'bearer' as const, token: tokens[who] });
    const post = (path:string, who: keyof typeof tokens, body:object={}) => client.post(path).auth(as(who).token,{type:'bearer'}).send(body);
    const get = (path:string, who: keyof typeof tokens) => client.get(path).auth(as(who).token,{type:'bearer'});

    // Inverted dates are refused (P-23).
    expect((await post('/api/travel/trips','employee',{tripName:'Inverted',travelType:'domestic',purpose:'Inverted trip dates check',destinationCity:'Jajpur',startDate:'2026-06-05',endDate:'2026-06-01'})).status).toBe(400);

    const tripRes = await post('/api/travel/trips','employee',{tripName:'Kalinganagar Plant Audit',travelType:'domestic',purpose:'Annual blast furnace safety audit',destinationCity:'Jajpur',startDate:'2026-06-01',endDate:'2026-06-05'});
    expect(tripRes.status).toBe(200);
    const tripId = (tripRes.body as TravelBody).trip.id;
    expect((tripRes.body as TravelBody).trip.status).toBe('submitted');

    // Segment outside the trip window is refused; inside is accepted.
    expect((await post(`/api/travel/trips/${tripId}/itineraries`,'employee',{tripId,segmentType:'flight',origin:'Kolkata',destination:'Bhubaneswar',departureDate:'2026-07-01'})).status).toBe(400);
    const itRes = await post(`/api/travel/trips/${tripId}/itineraries`,'employee',{tripId,segmentType:'flight',origin:'Kolkata',destination:'Bhubaneswar',departureDate:'2026-06-01',estimatedCostPaise:450000});
    expect(itRes.status).toBe(200);

    // C-02 / B-05: another employee can neither read nor act on this trip or wallet.
    expect((await get(`/api/travel/trips/${tripId}`,'outsider')).status).toBe(403);
    expect((await post(`/api/travel/trips/${tripId}/itineraries`,'outsider',{tripId,segmentType:'hotel',origin:'X',destination:'Y',departureDate:'2026-06-02'})).status).toBe(403);
    expect((await post('/api/travel/advances','outsider',{tripId,amountPaise:100000,purpose:'Advance on someone else trip'})).status).toBe(403);
    expect((await get(`/api/travel/wallet?employeeId=${ids.employee}`,'outsider')).status).toBe(403);
    expect((await get(`/api/travel/trips?employeeId=${ids.employee}`,'outsider')).status).toBe(403);
    expect(((await get('/api/travel/trips','outsider')).body as TravelBody).trips).toHaveLength(0);
    // The reporting manager may view the trip they approve.
    expect((await get(`/api/travel/trips/${tripId}`,'manager')).status).toBe(200);

    // Advance: requested → payroll cannot disburse before the RM chain approves.
    const advRes = await post('/api/travel/advances','employee',{tripId,amountPaise:1000000,purpose:'Site hotel and logistics advance'});
    expect(advRes.status).toBe(200);
    const advanceId = (advRes.body as TravelBody).advance.id;
    expect((advRes.body as TravelBody).advance.status).toBe('requested');
    expect((await post(`/api/travel/advances/${advanceId}/approve`,'payroll')).status).toBe(409);

    // A claim cannot be raised on an unapproved trip.
    expect((await post('/api/travel/claims','employee',{tripId})).status).toBe(409);
    expect(await approveAs('te.trips', tripId, ids.managerUser)).toBe('approved');
    expect(['approved','advanced']).toContain(await approveAs('te.advances', advanceId, ids.managerUser));
    const approvedAdvance = await (txn()).selectFrom('te.advances').select('status').where('id','=',advanceId).executeTakeFirstOrThrow();
    expect(approvedAdvance.status).toBe('approved');
    const disburse = await post(`/api/travel/advances/${advanceId}/approve`,'payroll');
    expect(disburse.status).toBe(200);
    expect((disburse.body as TravelBody).advance.status).toBe('disbursed');

    const claimRes = await post('/api/travel/claims','employee',{tripId});
    expect(claimRes.status).toBe(200);
    const claimId = (claimRes.body as TravelBody).claim.id;
    expect((await post(`/api/travel/claims/${claimId}/items`,'employee',{claimId,category:'hotel',itemDate:'2026-06-20',amountPaise:400000})).status).toBe(400);
    expect((await post(`/api/travel/claims/${claimId}/items`,'outsider',{claimId,category:'hotel',itemDate:'2026-06-02',amountPaise:400000})).status).toBe(403);
    const itemRes = await post(`/api/travel/claims/${claimId}/items`,'employee',{claimId,category:'hotel',itemDate:'2026-06-02',amountPaise:400000,description:'Hotel (2 nights)'});
    expect(itemRes.status).toBe(200);

    // Draft claims cannot be settled (P-23).
    expect((await post(`/api/travel/claims/${claimId}/settle`,'payroll',{claimId,approvedAmountPaise:400000})).status).toBe(409);
    expect((await post(`/api/travel/claims/${claimId}/submit`,'employee')).status).toBe(200);
    expect(await approveAs('te.claims', claimId, ids.managerUser)).toBe('approved');

    const settleRes = await post(`/api/travel/claims/${claimId}/settle`,'payroll',{claimId,approvedAmountPaise:400000,settlementMode:'AUTO'});
    expect(settleRes.status).toBe(200);
    expect((settleRes.body as TravelBody).advanceAdjustedPaise).toBe(400000);
    expect((settleRes.body as TravelBody).netRecoverablePaise).toBe(600000);
    expect((await post(`/api/travel/claims/${claimId}/settle`,'payroll',{claimId})).status).toBe(409);

    const walletRes = await get('/api/travel/wallet','employee');
    expect(walletRes.status).toBe(200);
    expect((walletRes.body as TravelBody).balancePaise).toBe(0);
    const ledgerRes = await get('/api/travel/wallet/ledger','employee');
    expect((ledgerRes.body as TravelBody).transactions).toHaveLength(2);
    // Payroll (travel desk) may read the employee's wallet; a user without an employee gets a clean 400.
    expect((await get(`/api/travel/wallet?employeeId=${ids.employee}`,'payroll')).status).toBe(200);
  });
});
