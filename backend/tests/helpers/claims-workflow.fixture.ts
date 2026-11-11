/** Rollback-only native claim/approval fixture shared by the regression's API and payroll legs. */
import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { Database } from '../../src/core/db/types.js';
import { createApp } from '../../src/app.js';
import { signAccessToken } from '../../src/core/auth/jwt.js';
export async function setupClaimsWorkflow(db: Kysely<Database>, secret: string) {
  let companyId = 0;
  let emp = 0;
  let receipt = 0;
  let foreignReceipt = 0;
  let secondReceipt = 0;
  let claimType = '';
  const tokens: Record<string, string> = {};
  const ids: Record<string, number> = {};
  const tx = await db.startTransaction().execute();
  const tag = `cw${randomUUID().slice(0, 7)}`;
  companyId = (
    await tx
      .insertInto('core.companies')
      .values({ code: tag, name: tag, ecode_prefix: tag })
      .returning('id')
      .executeTakeFirstOrThrow()
  ).id;
  for (const role of ['employee', 'manager', 'hr_head', 'payroll_admin']) {
    const e = await tx
      .insertInto('core.employees')
      .values({
        company_id: companyId,
        ecode: `${tag}${role}`,
        first_name: role,
        status: 'active',
        doj: '2020-01-01',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    if (role === 'employee') emp = e.id;
    const u = await tx
      .insertInto('core.users')
      .values({
        employee_id: e.id,
        email: `${tag}${role}@hrms.invalid`,
        password_hash: '!disabled!',
      })
      .returning(['id', 'email'])
      .executeTakeFirstOrThrow();
    ids[role] = u.id;
    const r = await tx
      .selectFrom('core.roles')
      .select('id')
      .where('code', '=', role)
      .executeTakeFirstOrThrow();
    await tx.insertInto('core.user_roles').values({ user_id: u.id, role_id: r.id }).execute();
    const session = await tx
      .insertInto('sec.sessions')
      .values({ user_id: u.id, expires_at: new Date(Date.now() + 600000) })
      .returning('sid')
      .executeTakeFirstOrThrow();
    tokens[role] = await signAccessToken(u.id, u.email, secret, session.sid);
    if (role === 'manager')
      await tx
        .updateTable('core.employees')
        .set({ reporting_manager_id: e.id })
        .where('id', '=', emp)
        .execute();
  }
  claimType = tag;
  await tx
    .insertInto('pay.claim_types')
    .values({
      code: tag,
      name: tag,
      entitlement_basis: 'annual',
      payout_component_code: 'OTHER_EARNINGS',
      bill_required: true,
    })
    .execute();
  receipt = (
    await tx
      .insertInto('core.documents')
      .values({
        owner_employee_id: emp,
        kind: 'claim_bill',
        path: `synthetic/${tag}.pdf`,
        original_name: 'receipt.pdf',
        mime: 'application/pdf',
        size_bytes: 10,
        uploaded_by: ids['employee'] ?? 0,
      })
      .returning('id')
      .executeTakeFirstOrThrow()
  ).id;
  secondReceipt = (
    await tx
      .insertInto('core.documents')
      .values({
        owner_employee_id: emp,
        kind: 'claim_bill',
        path: 'synthetic/second-receipt.pdf',
        original_name: 'second.pdf',
        mime: 'application/pdf',
        size_bytes: 10,
        uploaded_by: ids['employee'] ?? 0,
      })
      .returning('id')
      .executeTakeFirstOrThrow()
  ).id;
  foreignReceipt = (
    await tx
      .insertInto('core.documents')
      .values({
        owner_employee_id: null,
        kind: 'claim_bill',
        path: `synthetic/${tag}foreign.pdf`,
        original_name: 'other.pdf',
        mime: 'application/pdf',
        size_bytes: 10,
        uploaded_by: ids['hr_head'] ?? 0,
      })
      .returning('id')
      .executeTakeFirstOrThrow()
  ).id;
  await tx
    .updateTable('wf.definitions')
    .set({
      steps: JSON.stringify([
        { step: 1, approver: 'reporting_manager', slaHours: 72, onBreach: 'escalate' },
        {
          step: 2,
          approver: `user:${String(ids['hr_head'])}`,
          slaHours: 72,
          onBreach: 'escalate',
        },
      ]),
    })
    .where('code', '=', 'claim')
    .execute();
  const app = createApp({ db: tx, jwtSecret: secret, secureCookies: false });

  return {
    tx,
    app,
    companyId,
    emp,
    receipt,
    foreignReceipt,
    secondReceipt,
    claimType,
    tokens,
    ids,
  };
}
