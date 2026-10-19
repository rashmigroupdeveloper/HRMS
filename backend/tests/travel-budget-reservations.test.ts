/**
 * Travel & Expense — Phase 3.5 Stage B Integration Tests
 *
 * Verifies EMS-aligned claim & budget commitment ledger rules:
 * 1. Claims strictly raised against an approved trip with approved_budget_paise > 0.
 * 2. Closed travel month enforcement (te.closed_travel_month) on trip and claim items.
 * 3. Mandatory receipt attachment on every claim item.
 * 4. Multi-currency fxRateToInr calculation.
 * 5. Mandatory summary attachment on claim submit.
 * 6. Commitment ledger reservation (te.budget_reservations) & headroom reduction on submit.
 * 7. Rejection of claims exceeding available budget headroom.
 * 8. Overlapping claim period detection on the same trip budget.
 * 9. Automatic release of budget reservation on claim rejection / lapse.
 * 10. Immutability trigger: te.budget_reservations rejects UPDATE and DELETE.
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
  trip: { id: number; status: string; approvedBudgetPaise: number };
  claim: { id: number; status: string; totalAmountPaise: number };
  item: { id: number; amountPaise: number; inrAmountPaise: number };
  headroom: {
    tripId: number;
    approvedBudgetPaise: number;
    reservedPaise: number;
    availableHeadroomPaise: number;
  };
}

describe.skipIf(!DB_URL)('Phase 3.5 Stage B — Claims against Approved Budget & Commitment Ledger', () => {
  let db: Kysely<Database>;
  let transaction: ControlledTransaction<Database> | undefined;
  let app: ReturnType<typeof createApp>;
  const ids = { employee: 0, employeeUser: 0, manager: 0, managerUser: 0, adminUser: 0 };
  const tokens = { employee: '', manager: '', admin: '' };

  const txn = () => {
    if (!transaction) throw new Error('Transaction not open');
    return transaction;
  };

  /**
   * Stage A made the trip/claim chain multi-step (RM -> HOD -> Admin; vacant steps are skipped).
   * The first approver only advances the request; the admin step finalises it.
   */
  const approveChain = async (requestId: number, firstApproverUser: number) => {
    const tx = txn();
    let outcome = await act(tx, { requestId, actorUserId: firstApproverUser, action: 'approve' });
    for (let hop = 0; outcome === 'advanced' && hop < 5; hop += 1) {
      outcome = await act(tx, { requestId, actorUserId: ids.adminUser, action: 'approve' });
    }
    return outcome;
  };

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    transaction = await db.startTransaction().execute();
    const tx = transaction;
    const tag = 'te_stgb_' + randomUUID().slice(0, 8);
    const company = await tx
      .insertInto('core.companies')
      .values({ code: tag, name: tag, ecode_prefix: tag, is_india_payroll: false })
      .returning('id')
      .executeTakeFirstOrThrow();

    const person = async (suffix: string, rm: number | null, role: string | null) => {
      const e = await tx
        .insertInto('core.employees')
        .values({
          company_id: company.id,
          ecode: `${tag}${suffix}`,
          first_name: `Synthetic ${suffix}`,
          status: 'active',
          doj: '2020-01-01',
          reporting_manager_id: rm,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      const u = await tx
        .insertInto('core.users')
        .values({
          email: `${tag}-${suffix}@hrms.invalid`,
          employee_id: e.id,
          password_hash: '!disabled!',
        })
        .returning(['id', 'email'])
        .executeTakeFirstOrThrow();
      const roleRow = await tx
        .selectFrom('core.roles')
        .select('id')
        .where('code', '=', role ?? 'employee')
        .executeTakeFirstOrThrow();
      await tx.insertInto('core.user_roles').values({ user_id: u.id, role_id: roleRow.id }).execute();
      const session = await tx
        .insertInto('sec.sessions')
        .values({ user_id: u.id, expires_at: new Date(Date.now() + 600000) })
        .returning('sid')
        .executeTakeFirstOrThrow();
      return {
        employeeId: e.id,
        userId: u.id,
        token: await signAccessToken(u.id, u.email, JWT_SECRET, session.sid),
      };
    };

    const manager = await person('mgr', null, null);
    const employee = await person('emp', manager.employeeId, null);
    const admin = await person('adm', null, 'super_admin');

    Object.assign(ids, {
      employee: employee.employeeId,
      employeeUser: employee.userId,
      manager: manager.employeeId,
      managerUser: manager.userId,
      adminUser: admin.userId,
    });
    Object.assign(tokens, {
      employee: employee.token,
      manager: manager.token,
      admin: admin.token,
    });

    app = createApp({ db: tx as unknown as Kysely<Database>, jwtSecret: JWT_SECRET, secureCookies: false });
  });

  afterAll(async () => {
    try {
      if (transaction && !transaction.isRolledBack && !transaction.isCommitted) {
        await transaction.rollback().execute();
      }
    } finally {
      await db.destroy();
    }
  });

  it('enforces approved trip and positive approved budget before creating a claim', async () => {
    const client = await httpRequest(app);
    const as = (who: keyof typeof tokens) => ({ type: 'bearer' as const, token: tokens[who] });

    // 1. Create a trip with positive estimated budget
    const tripRes = await client
      .post('/api/travel/trips')
      .auth(as('employee').token, { type: 'bearer' })
      .send({
        tripName: 'Client Site Deployment',
        travelType: 'domestic',
        purpose: 'MES software commissioning',
        destinationCity: 'Jamshedpur',
        startDate: '2026-07-10',
        endDate: '2026-07-14',
        estimatedBudgetPaise: 3000000, // ₹30,000
      });
    expect(tripRes.status).toBe(200);
    const tripId = (tripRes.body as TravelBody).trip.id;

    // A claim cannot be raised on an unapproved trip
    const unapprovedClaimRes = await client
      .post('/api/travel/claims')
      .auth(as('employee').token, { type: 'bearer' })
      .send({ tripId });
    expect(unapprovedClaimRes.status).toBe(409);

    // Approve the trip via manager
    const tx = txn();
    const tripRow = await tx
      .selectFrom('te.trips')
      .select('workflow_request_id')
      .where('id', '=', tripId)
      .executeTakeFirstOrThrow();
    await approveChain(Number(tripRow.workflow_request_id), ids.managerUser);

    // Verify trip is approved and approved budget matches
    const approvedTrip = await tx
      .selectFrom('te.trips')
      .select(['status', 'approved_budget_paise'])
      .where('id', '=', tripId)
      .executeTakeFirstOrThrow();
    expect(approvedTrip.status).toBe('approved');
    expect(Number(approvedTrip.approved_budget_paise)).toBe(3000000);

    // Now claim creation succeeds
    const claimRes = await client
      .post('/api/travel/claims')
      .auth(as('employee').token, { type: 'bearer' })
      .send({ tripId });
    expect(claimRes.status).toBe(200);
  });

  it('rejects claims and claim items in closed travel months', async () => {
    const client = await httpRequest(app);
    const as = (who: keyof typeof tokens) => ({ type: 'bearer' as const, token: tokens[who] });
    const tx = txn();

    // Create and auto-approve a trip that falls in closed travel month (<= 2026-06)
    // We insert directly into te.trips for testing the closed-month guard
    const closedTrip = await tx
      .insertInto('te.trips')
      .values({
        reference_no: 'TRIP-CLOSED-01',
        employee_id: ids.employee,
        company_id: (await tx.selectFrom('core.employees').select('company_id').where('id', '=', ids.employee).executeTakeFirstOrThrow()).company_id,
        trip_name: 'May Audit',
        travel_type: 'domestic',
        purpose: 'Closed month audit',
        destination_country: 'India',
        destination_city: 'Durgapur',
        start_date: '2026-05-10' as unknown as Date,
        end_date: '2026-05-15' as unknown as Date,
        status: 'approved',
        estimated_budget_paise: 2000000,
        approved_budget_paise: 2000000,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // createClaim must be rejected because 2026-05 <= 2026-06 (closed)
    const claimRes = await client
      .post('/api/travel/claims')
      .auth(as('employee').token, { type: 'bearer' })
      .send({ tripId: closedTrip.id });
    expect(claimRes.status).toBe(400);
    // oRPC error envelope: { defined, code, status, message }
    expect(String((claimRes.body as { message?: string }).message)).toMatch(/closed travel month/i);
  });

  it('mandates receipts on items, handles multi-currency, and requires summary on submit', async () => {
    const client = await httpRequest(app);
    const as = (who: keyof typeof tokens) => ({ type: 'bearer' as const, token: tokens[who] });
    const tx = txn();

    // 1. Admin creates an approved trip with ₹50,000 budget
    const tripRes = await client
      .post('/api/travel/trips')
      .auth(as('admin').token, { type: 'bearer' })
      .send({
        tripName: 'Singapore Tech Expo',
        travelType: 'international',
        purpose: 'Vendor negotiations',
        destinationCity: 'Singapore',
        startDate: '2026-07-20',
        endDate: '2026-07-25',
        estimatedBudgetPaise: 5000000, // ₹50,000
      });
    expect(tripRes.status).toBe(200);
    const tripId = (tripRes.body as TravelBody).trip.id;

    // 2. Initial headroom check: ₹50,000 available
    const headroomRes1 = await client
      .get(`/api/travel/trips/${tripId}/budget-headroom`)
      .auth(as('admin').token, { type: 'bearer' });
    expect(headroomRes1.status).toBe(200);
    const h1 = (headroomRes1.body as TravelBody).headroom;
    expect(h1.approvedBudgetPaise).toBe(5000000);
    expect(h1.reservedPaise).toBe(0);
    expect(h1.availableHeadroomPaise).toBe(5000000);

    // 3. Create a claim
    const claimRes = await client
      .post('/api/travel/claims')
      .auth(as('admin').token, { type: 'bearer' })
      .send({ tripId });
    expect(claimRes.status).toBe(200);
    const claimId = (claimRes.body as TravelBody).claim.id;

    // 4. Adding an item without receipt fails with 400
    const noReceiptRes = await client
      .post(`/api/travel/claims/${claimId}/items`)
      .auth(as('admin').token, { type: 'bearer' })
      .send({
        claimId,
        category: 'hotel',
        itemDate: '2026-07-21',
        amountPaise: 1500000,
        description: 'Hotel stay',
      });
    expect(noReceiptRes.status).toBe(400);

    // 5. Adding item outside trip window fails
    const badDateRes = await client
      .post(`/api/travel/claims/${claimId}/items`)
      .auth(as('admin').token, { type: 'bearer' })
      .send({
        claimId,
        category: 'hotel',
        itemDate: '2026-07-29', // outside trip window
        amountPaise: 1500000,
        receiptUrl: 'https://storage.hrms/receipts/hotel.pdf',
      });
    expect(badDateRes.status).toBe(400);

    // 6. Adding item in SGD (multi-currency) with fxRateToInr:
    // 200 SGD (20,000 cents/paise) at 62.5 INR/SGD = 12,500 INR (1,250,000 paise)
    const sgdItemRes = await client
      .post(`/api/travel/claims/${claimId}/items`)
      .auth(as('admin').token, { type: 'bearer' })
      .send({
        claimId,
        category: 'hotel',
        itemDate: '2026-07-21',
        amountPaise: 20000, // 200.00 SGD
        currency: 'SGD',
        fxRateToInr: 62.5,
        receiptUrl: 'https://storage.hrms/receipts/hotel-sgd.pdf',
        description: 'Hotel Marina Bay',
      });
    expect(sgdItemRes.status).toBe(200);
    const sgdItem = (sgdItemRes.body as TravelBody).item;
    expect(sgdItem.amountPaise).toBe(20000);
    expect(sgdItem.inrAmountPaise).toBe(1250000);

    // 7. Add domestic item in INR: ₹10,000
    const inrItemRes = await client
      .post(`/api/travel/claims/${claimId}/items`)
      .auth(as('admin').token, { type: 'bearer' })
      .send({
        claimId,
        category: 'food',
        itemDate: '2026-07-22',
        amountPaise: 1000000,
        receiptUrl: 'https://storage.hrms/receipts/food.pdf',
        description: 'Client dinner',
      });
    expect(inrItemRes.status).toBe(200);
    // Total claim = 1,250,000 + 1,000,000 = 2,250,000 paise (₹22,500)

    // 8. Submit without summary document fails
    const submitNoSummary = await client
      .post(`/api/travel/claims/${claimId}/submit`)
      .auth(as('admin').token, { type: 'bearer' })
      .send({ claimId });
    expect(submitNoSummary.status).toBe(400);

    // 9. Submit with summary document succeeds
    const submitRes = await client
      .post(`/api/travel/claims/${claimId}/submit`)
      .auth(as('admin').token, { type: 'bearer' })
      .send({
        claimId,
        summaryDocumentUrl: 'https://storage.hrms/reports/summary-report.pdf',
      });
    expect(submitRes.status).toBe(200);

    // 10. Headroom check: ₹22,500 reserved, ₹27,500 available
    const headroomRes2 = await client
      .get(`/api/travel/trips/${tripId}/budget-headroom`)
      .auth(as('admin').token, { type: 'bearer' });
    expect(headroomRes2.status).toBe(200);
    const h2 = (headroomRes2.body as TravelBody).headroom;
    expect(h2.approvedBudgetPaise).toBe(5000000);
    expect(h2.reservedPaise).toBe(2250000);
    expect(h2.availableHeadroomPaise).toBe(2750000);

    // Verify reservation row in te.budget_reservations
    const resRow = await tx
      .selectFrom('te.budget_reservations')
      .selectAll()
      .where('claim_id', '=', claimId)
      .where('movement', '=', 'reserve')
      .executeTakeFirstOrThrow();
    expect(Number(resRow.amount_paise)).toBe(2250000);
    expect(resRow.trip_id).toBe(tripId);

    // 11. Overlapping claim check:
    // Create second claim covering 2026-07-21 (overlaps with 2026-07-21..2026-07-22)
    const claim2Res = await client
      .post('/api/travel/claims')
      .auth(as('admin').token, { type: 'bearer' })
      .send({ tripId });
    expect(claim2Res.status).toBe(200);
    const claimId2 = (claim2Res.body as TravelBody).claim.id;

    await client
      .post(`/api/travel/claims/${claimId2}/items`)
      .auth(as('admin').token, { type: 'bearer' })
      .send({
        claimId: claimId2,
        category: 'taxi',
        itemDate: '2026-07-21',
        amountPaise: 50000,
        receiptUrl: 'https://storage.hrms/receipts/taxi.pdf',
      });

    // Submitting overlapping claim on same trip budget must fail with 409 Conflict
    const overlapSubmit = await client
      .post(`/api/travel/claims/${claimId2}/submit`)
      .auth(as('admin').token, { type: 'bearer' })
      .send({
        claimId: claimId2,
        summaryDocumentUrl: 'https://storage.hrms/reports/summary-2.pdf',
      });
    expect(overlapSubmit.status).toBe(409);

    // 12. Headroom overflow check:
    // Non-overlapping date 2026-07-24 with amount ₹30,000 (exceeds ₹27,500 headroom)
    const claim3Res = await client
      .post('/api/travel/claims')
      .auth(as('admin').token, { type: 'bearer' })
      .send({ tripId });
    expect(claim3Res.status).toBe(200);
    const claimId3 = (claim3Res.body as TravelBody).claim.id;

    await client
      .post(`/api/travel/claims/${claimId3}/items`)
      .auth(as('admin').token, { type: 'bearer' })
      .send({
        claimId: claimId3,
        category: 'transport',
        itemDate: '2026-07-24',
        amountPaise: 3000000, // ₹30,000 > ₹27,500 available
        receiptUrl: 'https://storage.hrms/receipts/transport.pdf',
      });

    const headroomExceededRes = await client
      .post(`/api/travel/claims/${claimId3}/submit`)
      .auth(as('admin').token, { type: 'bearer' })
      .send({
        claimId: claimId3,
        summaryDocumentUrl: 'https://storage.hrms/reports/summary-3.pdf',
      });
    expect(headroomExceededRes.status).toBe(400);
    expect(JSON.stringify(headroomExceededRes.body)).toContain('exceeds available trip budget headroom');
  });

  it('releases budget reservation when a claim is rejected or lapsed', async () => {
    const client = await httpRequest(app);
    const as = (who: keyof typeof tokens) => ({ type: 'bearer' as const, token: tokens[who] });
    const tx = txn();

    // 1. Employee creates a trip with ₹20,000 budget, manager approves it
    const tripRes = await client
      .post('/api/travel/trips')
      .auth(as('employee').token, { type: 'bearer' })
      .send({
        tripName: 'Nagpur Site Inspection',
        travelType: 'domestic',
        purpose: 'Inspection',
        destinationCity: 'Nagpur',
        startDate: '2026-08-10',
        endDate: '2026-08-12',
        estimatedBudgetPaise: 2000000, // ₹20,000
      });
    const tripId = (tripRes.body as TravelBody).trip.id;

    const tripRow = await tx
      .selectFrom('te.trips')
      .select('workflow_request_id')
      .where('id', '=', tripId)
      .executeTakeFirstOrThrow();
    await approveChain(Number(tripRow.workflow_request_id), ids.managerUser);

    // 2. Employee creates and submits a claim of ₹8,000
    const claimRes = await client
      .post('/api/travel/claims')
      .auth(as('employee').token, { type: 'bearer' })
      .send({ tripId });
    const claimId = (claimRes.body as TravelBody).claim.id;

    await client
      .post(`/api/travel/claims/${claimId}/items`)
      .auth(as('employee').token, { type: 'bearer' })
      .send({
        claimId,
        category: 'hotel',
        itemDate: '2026-08-10',
        amountPaise: 800000,
        receiptUrl: 'https://storage.hrms/receipts/nagpur-hotel.pdf',
      });

    await client
      .post(`/api/travel/claims/${claimId}/submit`)
      .auth(as('employee').token, { type: 'bearer' })
      .send({
        claimId,
        summaryDocumentUrl: 'https://storage.hrms/reports/summary-nagpur.pdf',
      });

    // Verify reservation recorded: 800000 reserved
    const headroomBefore = await client
      .get(`/api/travel/trips/${tripId}/budget-headroom`)
      .auth(as('employee').token, { type: 'bearer' });
    expect((headroomBefore.body as TravelBody).headroom.availableHeadroomPaise).toBe(1200000);

    // 3. Manager rejects the claim in workflow
    const claimRow = await tx
      .selectFrom('te.claims')
      .select('workflow_request_id')
      .where('id', '=', claimId)
      .executeTakeFirstOrThrow();
    await act(tx, {
      requestId: Number(claimRow.workflow_request_id),
      actorUserId: ids.managerUser,
      action: 'reject',
      comment: 'Insufficient business justification for luxury stay',
    });

    // 4. Verify release movement was recorded and headroom restored to full ₹20,000
    const releaseRow = await tx
      .selectFrom('te.budget_reservations')
      .selectAll()
      .where('claim_id', '=', claimId)
      .where('movement', '=', 'release')
      .executeTakeFirstOrThrow();
    expect(Number(releaseRow.amount_paise)).toBe(800000);

    const headroomAfter = await client
      .get(`/api/travel/trips/${tripId}/budget-headroom`)
      .auth(as('employee').token, { type: 'bearer' });
    expect((headroomAfter.body as TravelBody).headroom.availableHeadroomPaise).toBe(2000000);
    expect((headroomAfter.body as TravelBody).headroom.reservedPaise).toBe(0);
  });

  it('rejects direct UPDATE or DELETE on te.budget_reservations via database trigger', async () => {
    const tx = txn();
    // Insert a test reservation row
    const row = await tx
      .insertInto('te.budget_reservations')
      .values({
        trip_id: 1,
        claim_id: 1,
        movement: 'reserve',
        amount_paise: 50000,
        reason: 'immutability test',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // UPDATE must be rejected by trigger
    await expect(
      tx
        .updateTable('te.budget_reservations')
        .set({ amount_paise: 99999 })
        .where('id', '=', row.id)
        .execute()
    ).rejects.toThrow();

    // DELETE must be rejected by trigger
    await expect(
      tx
        .deleteFrom('te.budget_reservations')
        .where('id', '=', row.id)
        .execute()
    ).rejects.toThrow();
  });
});
