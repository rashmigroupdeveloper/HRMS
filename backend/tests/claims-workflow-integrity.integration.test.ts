import { verifyClaimPayroll } from './helpers/claims-payroll.fixture.js';
/** M13/CLM-02..04: claim submission must notify the actual chain; one step never means paid. */
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import type { Kysely, ControlledTransaction } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import type { createApp } from '../src/app.js';
import { setupClaimsWorkflow } from './helpers/claims-workflow.fixture.js';
import { httpRequest } from './http-client.js';
const url = process.env['DATABASE_URL'];
const secret = process.env['JWT_SECRET'] ?? 'synthetic-jwt-test-secret-at-least-32-characters-long';
describe.skipIf(!url)('Claims workflow integrity', () => {
  let db: Kysely<Database>;
  let tx: ControlledTransaction<Database>;
  let app: ReturnType<typeof createApp>;
  let companyId = 0;
  let emp = 0;
  let receipt = 0;
  let foreignReceipt = 0;
  let secondReceipt = 0;
  let claimType = '';
  let claimId = 0;
  let requestId = 0;
  const tokens: Record<string, string> = {};
  const ids: Record<string, number> = {};
  beforeAll(async () => {
    db = createDatabase(url ?? '');
    const fixture = await setupClaimsWorkflow(db, secret);
    ({ tx, app, companyId, emp, receipt, foreignReceipt, secondReceipt, claimType } = fixture);
    Object.assign(tokens, fixture.tokens);
    Object.assign(ids, fixture.ids);
  });
  afterAll(async () => {
    try {
      await tx.rollback().execute();
    } finally {
      await db.destroy();
    }
  });
  const auth = (role: string) => `Bearer ${tokens[role] ?? ''}`;
  const payload = (doc = receipt) => ({
    claimTypeCode: claimType,
    periodFrom: '2097-01-01',
    periodTo: '2097-01-31',
    bills: [
      { documentId: doc, billNo: 'SYNTHETIC', amountRupees: 123.45 },
      { documentId: secondReceipt, billNo: 'SYNTHETIC-2', amountRupees: 76.55 },
    ],
  });
  it('refuses somebody else’s receipt and invalid periods/paise', async () => {
    const c = await httpRequest(app);
    expect(
      (
        await c
          .post('/api/claims/submit')
          .set('Authorization', auth('employee'))
          .send(payload(foreignReceipt))
      ).status,
    ).toBe(400);
    expect(
      (
        await c
          .post('/api/claims/submit')
          .set('Authorization', auth('employee'))
          .send({ ...payload(), periodFrom: '2097-02-30' })
      ).status,
    ).toBe(400);
    expect(
      (
        await c
          .post('/api/claims/submit')
          .set('Authorization', auth('employee'))
          .send({ ...payload(), bills: [{ documentId: receipt, amountRupees: 1.001 }] })
      ).status,
    ).toBe(400);
  });
  it('stores a real uploaded receipt and audits employee/manager downloads of the submitted bill', async () => {
    const c = await httpRequest(app);
    const base64 = Buffer.from('%PDF-1.4\nSYNTHETIC RECEIPT\n%%EOF').toString('base64');
    expect(
      (
        await c
          .post('/api/claims/receipts')
          .set('Authorization', auth('employee'))
          .send({ filename: 'receipt.pdf', base64: Buffer.from('not a PDF').toString('base64') })
      ).status,
    ).toBe(400);
    const upload = await c
      .post('/api/claims/receipts')
      .set('Authorization', auth('employee'))
      .send({ filename: 'receipt.pdf', base64 });
    expect(upload.status).toBe(200);
    const documentId = (upload.body as { documentId: number }).documentId;
    const submitted = await c
      .post('/api/claims/submit')
      .set('Authorization', auth('employee'))
      .send(payload(documentId));
    expect(submitted.status).toBe(200);
    const bill = await tx
      .selectFrom('pay.claim_bills')
      .select('id')
      .where('claim_id', '=', (submitted.body as { claimId: number }).claimId)
      .where('document_id', '=', documentId)
      .executeTakeFirstOrThrow();
    const own = await c
      .get(`/api/claims/me/receipts/${String(bill.id)}`)
      .set('Authorization', auth('employee'));
    expect(own.status).toBe(200);
    expect((own.body as { base64: string }).base64).toBe(base64);
    const review = await c
      .get(`/api/claims/receipts/${String(bill.id)}`)
      .set('Authorization', auth('manager'));
    expect(review.status).toBe(200);
    expect((review.body as { base64: string }).base64).toBe(base64);
    expect(
      await tx
        .selectFrom('core.audit_log')
        .select('id')
        .where('entity', '=', 'core.documents')
        .where('entity_id', '=', documentId)
        .where('action', '=', 'claim_receipt_read')
        .execute(),
    ).toHaveLength(2);
  });
  it('creates the workflow atomically and surfaces the claim with a notification receipt in manager inbox', async () => {
    const c = await httpRequest(app);
    const response = await c
      .post('/api/claims/submit')
      .set('Authorization', auth('employee'))
      .send(payload());
    expect(response.status).toBe(200);
    claimId = (response.body as { claimId: number }).claimId;
    const claim = await tx
      .selectFrom('pay.claims')
      .selectAll()
      .where('id', '=', claimId)
      .executeTakeFirstOrThrow();
    expect(claim.claimed_amount).toBe('200.00');
    expect(claim.workflow_request_id).not.toBeNull();
    requestId = claim.workflow_request_id ?? 0;
    const inbox = await c.get('/api/workflows/inbox').set('Authorization', auth('manager'));
    expect(inbox.status).toBe(200);
    expect(JSON.stringify(inbox.body)).toContain(`"requestId":${String(requestId)}`);
    expect(
      (
        await tx
          .selectFrom('wf.request_steps')
          .select('notified_at')
          .where('request_id', '=', requestId)
          .executeTakeFirstOrThrow()
      ).notified_at,
    ).not.toBeNull();
  });
  it('rejects unassigned decisions, keeps claim pending after RM and applies the final checker only once', async () => {
    const c = await httpRequest(app);
    const unverified = await tx
      .selectFrom('pay.claim_bills')
      .select('id')
      .where('claim_id', '=', claimId)
      .orderBy('id')
      .executeTakeFirstOrThrow();
    expect(
      (
        await c
          .post('/api/claims/decide')
          .set('Authorization', auth('manager'))
          .send({
            claimId,
            action: 'approve',
            billVerifications: [{ billId: unverified.id, verified: true }],
          })
      ).status,
    ).toBe(403);
    expect(
      (
        await tx
          .selectFrom('pay.claim_bills')
          .select('verified')
          .where('id', '=', unverified.id)
          .executeTakeFirstOrThrow()
      ).verified,
    ).toBe(false);

    expect(
      (
        await c
          .post('/api/claims/decide')
          .set('Authorization', auth('hr_head'))
          .send({ claimId, action: 'approve' })
      ).status,
    ).toBe(403);
    expect(
      (
        await c
          .post('/api/claims/decide')
          .set('Authorization', auth('manager'))
          .send({ claimId, action: 'approve', approvedAmountRupees: 200.01 })
      ).status,
    ).toBe(400);
    expect(
      (
        await c
          .post('/api/claims/decide')
          .set('Authorization', auth('manager'))
          .send({ claimId, action: 'approve' })
      ).status,
    ).toBe(200);
    expect(
      (
        await tx
          .selectFrom('pay.claims')
          .select('status')
          .where('id', '=', claimId)
          .executeTakeFirstOrThrow()
      ).status,
    ).toBe('pending');
    const bill = await tx
      .selectFrom('pay.claim_bills')
      .select('id')
      .where('claim_id', '=', claimId)
      .executeTakeFirstOrThrow();
    expect(
      (
        await c
          .post('/api/claims/decide')
          .set('Authorization', auth('hr_head'))
          .send({
            claimId,
            action: 'partially_approve',
            approvedAmountRupees: 100,
            rejectionReason: 'Synthetic substantiated amount',
            billVerifications: [{ billId: bill.id, verified: true }],
          })
      ).status,
    ).toBe(200);
    const claim = await tx
      .selectFrom('pay.claims')
      .selectAll()
      .where('id', '=', claimId)
      .executeTakeFirstOrThrow();
    expect(claim.status).toBe('approved');
    expect(claim.approved_amount).toBe('100.00');
    expect(
      (
        await c
          .post('/api/claims/decide')
          .set('Authorization', auth('hr_head'))
          .send({ claimId, action: 'approve' })
      ).status,
    ).toBe(409);
  });
  it('keeps another employee’s pending claims and receipts outside the manager subtree', async () => {
    const c = await httpRequest(app);
    const other = await tx
      .selectFrom('core.users')
      .select('employee_id')
      .where('id', '=', ids['hr_head'] ?? 0)
      .executeTakeFirstOrThrow();
    const type = await tx
      .selectFrom('pay.claim_types')
      .select('id')
      .where('code', '=', claimType)
      .executeTakeFirstOrThrow();
    const foreign = await tx
      .insertInto('pay.claims')
      .values({
        employee_id: other.employee_id ?? 0,
        claim_type_id: type.id,
        funding_kind: 'entitlement',
        period_from: new Date('2097-01-01'),
        period_to: new Date('2097-01-31'),
        claimed_amount: '50.00',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const bill = await tx
      .insertInto('pay.claim_bills')
      .values({ claim_id: foreign.id, document_id: foreignReceipt, amount: '50.00' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const pending = await c.get('/api/claims/pending').set('Authorization', auth('manager'));
    expect(pending.status).toBe(200);
    expect((pending.body as { id: number }[]).some((row) => row.id === foreign.id)).toBe(false);
    expect(
      (
        await c
          .post('/api/claims/decide')
          .set('Authorization', auth('manager'))
          .send({ claimId: foreign.id, action: 'approve' })
      ).status,
    ).toBe(403);
    expect(
      (await c.get(`/api/claims/receipts/${String(bill.id)}`).set('Authorization', auth('manager')))
        .status,
    ).toBe(403);
  });
  it('refuses every legacy salary/bank-batch routing attempt from payroll-only access',async()=>{
    const c=await httpRequest(app);
    for(const body of [{claimId,payoutMethod:'off_cycle_batch',batchId:1},{claimId,payoutMethod:'payroll_run',runId:1}])expect((await c.post('/api/claims/route-payout').set('Authorization',auth('payroll_admin')).send(body)).status).toBe(403);
    expect((await tx.selectFrom('pay.claims').select('status').where('id','=',claimId).executeTakeFirstOrThrow()).status).toBe('approved');
  });
  it('pays the ₹100 reimbursement separately with its own scopes and no salary input or run', async () => {
    await verifyClaimPayroll(tx, app, companyId, emp, ids, claimId, auth);
  });
});
