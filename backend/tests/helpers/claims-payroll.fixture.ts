import {verifyTravelFinanceScope} from './travel-finance-scope.fixture.js';
/** Sponsor correction: reimbursement is a distinct payment, population grant and artifact. */
import { expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { ControlledTransaction } from 'kysely';
import type { Database } from '../../src/core/db/types.js';
import type { createApp } from '../../src/app.js';
import { signAccessToken } from '../../src/core/auth/jwt.js';
import { httpRequest } from '../http-client.js';
export async function verifyClaimPayroll(
  tx: ControlledTransaction<Database>,
  app: ReturnType<typeof createApp>,
  companyId: number,
  emp: number,
  _ids: Record<string, number>,
  claimId: number,
  auth: (role: string) => string,
) {
  const c = await httpRequest(app);
  // Salary authority alone grants no reimbursement payment access.
  expect(
    (await c.get('/api/claims/payments').set('Authorization', auth('payroll_admin'))).status,
  ).toBe(403);
  expect(
    (
      await c
        .post('/api/claims/route-payout')
        .set('Authorization', auth('payroll_admin'))
        .send({ claimId, payoutMethod: 'payroll_run', runId: 1 })
    ).status,
  ).toBe(403);
  const tag = `finance${randomUUID().slice(0, 8)}`;
  const org = await tx
    .insertInto('core.org_units')
    .values({ company_id: companyId, name: tag })
    .returning('id')
    .executeTakeFirstOrThrow();
  await tx
    .updateTable('core.employees')
    .set({ org_unit_id: org.id, bank_account: '000000000000', bank_ifsc: 'TEST0000001' })
    .where('id', '=', emp)
    .execute();
  const user = await tx
    .insertInto('core.users')
    .values({ email: `${tag}@hrms.invalid`, password_hash: '!disabled!' })
    .returning(['id', 'email'])
    .executeTakeFirstOrThrow();
  const role = await tx
    .insertInto('core.roles')
    .values({ code: tag, name: 'Independent reimbursement operator' })
    .returning('id')
    .executeTakeFirstOrThrow();
  for (const code of ['claims.payout.view', 'claims.payout.manage', 'claims.payout.confirm']) {
    const permission = await tx
      .selectFrom('core.permissions')
      .select('id')
      .where('code', '=', code)
      .executeTakeFirstOrThrow();
    await tx
      .insertInto('core.role_permissions')
      .values({ role_id: role.id, permission_id: permission.id, scope: 'org_unit' })
      .execute();
  }
  await tx
    .insertInto('core.user_roles')
    .values({ user_id: user.id, role_id: role.id, scope_org_unit_id: org.id })
    .execute();
  const session = await tx
    .insertInto('sec.sessions')
    .values({ user_id: user.id, expires_at: new Date(Date.now() + 600000) })
    .returning('sid')
    .executeTakeFirstOrThrow();
  const secret =
    process.env['JWT_SECRET'] ?? 'synthetic-jwt-test-secret-at-least-32-characters-long';
  const finance = `Bearer ${await signAccessToken(user.id, user.email, secret, session.sid)}`;
  expect(
    (await c.post('/api/payroll/runs/list').set('Authorization', finance).send({})).status,
  ).toBe(403);
  expect(
    (
      await c
        .post('/api/claims/route-payout')
        .set('Authorization', finance)
        .send({ claimId, payoutMethod: 'payroll_run', runId: 1 })
    ).status,
  ).toBe(409);
  await verifyTravelFinanceScope(tx,app,emp,companyId,finance,auth('payroll_admin'));
  const eligible = await c.get('/api/claims/payments/eligible').set('Authorization', finance);
  expect(eligible.status).toBe(200);
  expect((eligible.body as { claimId: number }[]).some((row) => row.claimId === claimId)).toBe(
    true,
  );
  const created = await c
    .post('/api/claims/payments')
    .set('Authorization', finance)
    .send({ claimIds: [claimId] });
  expect(created.status).toBe(200);
  const id = (created.body as { id: number }).id;
  expect(
    (
      await c
        .post('/api/claims/payments')
        .set('Authorization', finance)
        .send({ claimIds: [claimId] })
    ).status,
  ).toBe(409);
  expect(
    (
      await c
        .post(`/api/claims/payments/${String(id)}/paid`)
        .set('Authorization', finance)
        .send({ id, paymentReference: 'SYNTHETIC-REIMB' })
    ).status,
  ).toBe(409);
  // A nullable org-unit must not bypass the independent population filter.
  await tx.updateTable('core.employees').set({org_unit_id:null}).where('id','=',emp).execute();
  const hidden=await c.get('/api/claims/payments').set('Authorization',finance);
  expect(hidden.status).toBe(200);expect((hidden.body as {id:number}[]).some(b=>b.id===id)).toBe(false);
  expect((await c.post(`/api/claims/payments/${String(id)}/bank-file`).set('Authorization',finance).send({id})).status).toBe(403);
  await tx.updateTable('core.employees').set({org_unit_id:org.id}).where('id','=',emp).execute();
  // A drifted accepted amount cannot be exported as a transfer.
  await tx.updateTable('pay.claims').set({approved_amount:'99.00'}).where('id','=',claimId).execute();
  expect((await c.post(`/api/claims/payments/${String(id)}/bank-file`).set('Authorization',finance).send({id})).status).toBe(409);
  await tx.updateTable('pay.claims').set({approved_amount:'100.00'}).where('id','=',claimId).execute();
  const bank = await c
    .post(`/api/claims/payments/${String(id)}/bank-file`)
    .set('Authorization', finance)
    .send({ id });
  expect(bank.status).toBe(200);
  expect(Buffer.from((bank.body as { base64: string }).base64, 'base64').toString()).toContain(
    '100.00',
  );
  expect(
    (
      await c
        .post(`/api/claims/payments/${String(id)}/bank-file`)
        .set('Authorization', auth('payroll_admin'))
        .send({ id })
    ).status,
  ).toBe(403);
  const guarded=await tx.savepoint('reimbursement_item_guard').execute();
  await expect(guarded.updateTable('pay.reimbursement_batch_items').set({amount:'1.00'}).where('batch_id','=',id).execute()).rejects.toThrow(/immutable/);
  await guarded.rollbackToSavepoint('reimbursement_item_guard').execute();
  await guarded.releaseSavepoint('reimbursement_item_guard').execute();
  const referenceGuard=await tx.savepoint('reimbursement_reference_guard').execute();
  await expect(referenceGuard.updateTable('pay.reimbursement_batches').set({status:'paid',paid_by:user.id,paid_at:new Date(),payment_reference:null}).where('id','=',id).execute()).rejects.toThrow();
  await referenceGuard.rollbackToSavepoint('reimbursement_reference_guard').execute();
  await referenceGuard.releaseSavepoint('reimbursement_reference_guard').execute();
  const before = await tx
    .selectFrom('pay.claims')
    .selectAll()
    .where('id', '=', claimId)
    .executeTakeFirstOrThrow();
  expect(before.status).toBe('approved');
  expect(before.paid_in_run_id).toBeNull();
  expect(before.paid_in_batch_id).toBeNull();
  expect(before.reimbursement_batch_id).toBe(id);
  expect(
    await tx.selectFrom('pay.inputs').select('id').where('claim_id', '=', claimId).execute(),
  ).toHaveLength(0);
  const paid = await c
    .post(`/api/claims/payments/${String(id)}/paid`)
    .set('Authorization', finance)
    .send({ id, paymentReference: 'SYNTHETIC-REIMB' });
  expect(paid.status).toBe(200);
  expect(
    (
      await tx
        .selectFrom('pay.claims')
        .select('status')
        .where('id', '=', claimId)
        .executeTakeFirstOrThrow()
    ).status,
  ).toBe('paid');
  expect(
    (
      await c
        .post(`/api/claims/payments/${String(id)}/paid`)
        .set('Authorization', finance)
        .send({ id, paymentReference: 'DUPLICATE' })
    ).status,
  ).toBe(409);
  expect(
    await tx
      .selectFrom('pay.payroll_runs')
      .select('id')
      .where('company_id', '=', companyId)
      .execute(),
  ).toHaveLength(0);
}
