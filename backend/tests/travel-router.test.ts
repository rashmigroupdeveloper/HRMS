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
// These tests retain their behavioral assertions; failed deferred T&E work is not hidden.
describe.skipIf(!DB_URL)('Travel & Expense Router Endpoints (TE-01..12)', () => {
  let db:Kysely<Database>;
  let transaction:ControlledTransaction<Database>|undefined;
  let app:ReturnType<typeof createApp>;
  let token:string;
  beforeAll(async()=>{
    db=createDatabase(DB_URL??'');
    transaction=await db.startTransaction().execute();
    const tx=transaction;
    const tag='travel_http_'+randomUUID().slice(0,8);
    const company=await tx.insertInto('core.companies').values({code:tag,name:tag,ecode_prefix:tag,is_india_payroll:false}).returning('id').executeTakeFirstOrThrow();
    const employee=await tx.insertInto('core.employees').values({company_id:company.id,ecode:tag,first_name:'Synthetic Travel HTTP',status:'active',doj:'1998-01-01'}).returning('id').executeTakeFirstOrThrow();
    const user=await tx.insertInto('core.users').values({email:tag+'@hrms.invalid',employee_id:employee.id,password_hash:'!disabled!'}).returning(['id','email']).executeTakeFirstOrThrow();
    const role=await tx.selectFrom('core.roles').select('id').where('code','=','payroll_admin').executeTakeFirstOrThrow();
    await tx.insertInto('core.user_roles').values({user_id:user.id,role_id:role.id}).execute();
    const session=await tx.insertInto('sec.sessions').values({user_id:user.id,expires_at:new Date(Date.now()+60000)}).returning('sid').executeTakeFirstOrThrow();
    token=await signAccessToken(user.id,user.email,JWT_SECRET,session.sid);
    app=createApp({db:tx,jwtSecret:JWT_SECRET,secureCookies:false});
  });
  afterAll(async()=>{
    try {if(transaction && !transaction.isRolledBack && !transaction.isCommitted) await transaction.rollback().execute();}
    finally {await db.destroy();}
  });

  it('GET /api/travel/budgets returns active grade allowances', async () => {
    const res = await (await httpRequest(app))
      .get('/api/travel/budgets')
      .auth(token, { type: 'bearer' });

    expect(res.status).toBe(200);
    expect((res.body as TravelBody)).toHaveProperty('budgets');
    expect(Array.isArray((res.body as TravelBody).budgets)).toBe(true);
    expect((res.body as TravelBody).budgets.length).toBeGreaterThanOrEqual(1);
  });

  it('manages full travel lifecycle via HTTP router: trip -> itinerary -> advance -> claim -> wallet', async () => {
    const client = await httpRequest(app);

    // 1. Create Trip
    const tripRes = await client
      .post('/api/travel/trips')
      .auth(token, { type: 'bearer' })
      .send({
        tripName: 'Kalinganagar Plant Audit',
        travelType: 'domestic',
        purpose: 'Annual blast furnace safety audit and performance verification',
        destinationCity: 'Jajpur',
        startDate: '2026-06-01',
        endDate: '2026-06-05',
      });

    expect(tripRes.status).toBe(200);
    expect((tripRes.body as TravelBody)).toHaveProperty('trip');
    const tripId = (tripRes.body as TravelBody).trip.id;
    expect(tripId).toBeDefined();
    expect((tripRes.body as TravelBody).trip.status).toBe('submitted');

    // 2. Add Itinerary Segment
    const itRes = await client
      .post(`/api/travel/trips/${tripId}/itineraries`)
      .auth(token, { type: 'bearer' })
      .send({
        tripId,
        segmentType: 'flight',
        origin: 'Kolkata',
        destination: 'Bhubaneswar',
        departureDate: '2026-06-01',
        provider: 'IndiGo',
        estimatedCostPaise: 450000,
      });

    expect(itRes.status).toBe(200);
    expect((itRes.body as TravelBody).itinerary.estimatedCostPaise).toBe(450000);

    // 3. Get Trip By Id
    const getTripRes = await client
      .get(`/api/travel/trips/${tripId}`)
      .auth(token, { type: 'bearer' });

    expect(getTripRes.status).toBe(200);
    expect((getTripRes.body as TravelBody).trip.id).toBe(tripId);
    expect((getTripRes.body as TravelBody).itineraries.length).toBe(1);

    // 4. List Trips
    const listRes = await client
      .get('/api/travel/trips')
      .auth(token, { type: 'bearer' });

    expect(listRes.status).toBe(200);
    expect((listRes.body as TravelBody).trips.length).toBeGreaterThanOrEqual(1);

    // 5. Request Travel Advance
    const advRes = await client
      .post('/api/travel/advances')
      .auth(token, { type: 'bearer' })
      .send({
        tripId,
        amountPaise: 1000000, // ₹10,000
        purpose: 'Site hotel and logistics advance',
      });

    expect(advRes.status).toBe(200);
    const advanceId = (advRes.body as TravelBody).advance.id;
    expect(advanceId).toBeDefined();

    // 6. Approve Advance (disburses into wallet)
    const approveRes = await client
      .post(`/api/travel/advances/${advanceId}/approve`)
      .auth(token, { type: 'bearer' });

    expect(approveRes.status).toBe(200);
    expect((approveRes.body as TravelBody).advance.status).toBe('disbursed');

    // 7. List Advances
    const advListRes = await client
      .get('/api/travel/advances')
      .auth(token, { type: 'bearer' });

    expect(advListRes.status).toBe(200);
    expect((advListRes.body as TravelBody).advances.length).toBeGreaterThanOrEqual(1);

    // 8. Create Claim
    const claimRes = await client
      .post('/api/travel/claims')
      .auth(token, { type: 'bearer' })
      .send({
        tripId,
      });

    expect(claimRes.status).toBe(200);
    const claimId = (claimRes.body as TravelBody).claim.id;
    expect(claimId).toBeDefined();

    // 9. Add Claim Item
    const itemRes = await client
      .post(`/api/travel/claims/${claimId}/items`)
      .auth(token, { type: 'bearer' })
      .send({
        claimId,
        category: 'hotel',
        itemDate: '2026-06-02',
        amountPaise: 400000,
        description: 'Hotel Ginger Jajpur (2 nights)',
      });

    expect(itemRes.status).toBe(200);
    expect((itemRes.body as TravelBody).item.amountPaise).toBe(400000);

    // 10. List Claims
    const claimsListRes = await client
      .get('/api/travel/claims')
      .auth(token, { type: 'bearer' });

    expect(claimsListRes.status).toBe(200);
    expect((claimsListRes.body as TravelBody).claims.length).toBeGreaterThanOrEqual(1);

    // 11. Settle Claim (Advance ₹10k, Claim ₹4k -> Net Recoverable ₹6k, adjusted ₹4k)
    const settleRes = await client
      .post(`/api/travel/claims/${claimId}/settle`)
      .auth(token, { type: 'bearer' })
      .send({
        claimId,
        approvedAmountPaise: 400000,
        settlementMode: 'AUTO',
      });

    expect(settleRes.status).toBe(200);
    expect((settleRes.body as TravelBody).settlementId).toBeDefined();
    expect((settleRes.body as TravelBody).advanceAdjustedPaise).toBe(400000);
    expect((settleRes.body as TravelBody).netRecoverablePaise).toBe(600000);

    // 12. Check Wallet Balance & Ledger
    const walletRes = await client
      .get('/api/travel/wallet')
      .auth(token, { type: 'bearer' });

    expect(walletRes.status).toBe(200);
    expect((walletRes.body as TravelBody)).toHaveProperty('balancePaise');

    const ledgerRes = await client
      .get('/api/travel/wallet/ledger')
      .auth(token, { type: 'bearer' });

    expect(ledgerRes.status).toBe(200);
    expect((ledgerRes.body as TravelBody)).toHaveProperty('transactions');
  });
});
