/**
 * Stage 5.3 — DPDP baseline, proved against live Postgres (PRV-01..06).
 *
 * Properties:
 *   1. Consent grant/withdraw appends consent_events; withdrawal is immediate.
 *   2. Rights request sets due_at from prv.rights_sla_days; refuse needs reason.
 *   3. Export pack masks PAN / Aadhaar / bank.
 *   4. Two-person purge: proposer cannot confirm.
 *   5. Notice ack is idempotent for the current version.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { getTypedSetting } from '../src/core/settings/read.js';
import {
  acknowledgeNotice,
  currentNotice,
  noticeStatus,
} from '../src/modules/privacy/notices.service.js';
import { listMyConsents, setConsent } from '../src/modules/privacy/consents.service.js';
import {
  createRightsRequest,
  fulfillRights,
  refuseRights,
} from '../src/modules/privacy/rights.service.js';
import { confirmPurge, proposePurge } from '../src/modules/privacy/retention.service.js';
import { buildAccessPack, maskStatutory } from '../src/modules/privacy/export.service.js';

const DB_URL = process.env['DATABASE_URL'];
const run = describe.skipIf(!DB_URL);

run('Stage 5.3 — DPDP privacy services (live Postgres)', () => {
  let db: Kysely<Database>;
  const stamp = Date.now();
  let employeeId: number;
  let userId: number;
  let dpoUserId: number;
  let adminUserId: number;

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');

    const company = await db
      .selectFrom('core.companies')
      .select('id')
      .orderBy('id')
      .executeTakeFirstOrThrow();

    const employee = await db
      .insertInto('core.employees')
      .values({
        ecode: `PRV${String(stamp).slice(-7)}`,
        company_id: company.id,
        first_name: 'Privacy',
        last_name: 'Subject',
        status: 'active',
        doj: new Date('2018-01-01'),
        pan: 'ABCDE1234F',
        aadhaar: '123456789012',
        bank_account: '12345678901234',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    employeeId = employee.id;

    const hash = '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUV';
    const user = await db
      .insertInto('core.users')
      .values({
        email: `prv-${String(stamp)}@hrms.test`,
        password_hash: hash,
        employee_id: employeeId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    userId = user.id;

    const dpo = await db
      .insertInto('core.users')
      .values({ email: `prv-dpo-${String(stamp)}@hrms.test`, password_hash: hash })
      .returning('id')
      .executeTakeFirstOrThrow();
    dpoUserId = dpo.id;

    const admin = await db
      .insertInto('core.users')
      .values({ email: `prv-admin-${String(stamp)}@hrms.test`, password_hash: hash })
      .returning('id')
      .executeTakeFirstOrThrow();
    adminUserId = admin.id;
  });

  afterAll(async () => {
    await db.deleteFrom('prv.consents').where('employee_id', '=', employeeId).execute().catch(() => undefined);
    await db
      .updateTable('core.users')
      .set({ is_active: false, employee_id: null })
      .where('id', 'in', [userId, dpoUserId, adminUserId])
      .execute()
      .catch(() => undefined);
    await db
      .updateTable('core.employees')
      .set({ status: 'exited' })
      .where('id', '=', employeeId)
      .execute()
      .catch(() => undefined);
    await db.destroy();
  });

  it('maskStatutory never returns the raw value', () => {
    expect(maskStatutory('ABCDE1234F')).toBe('******234F');
    expect(maskStatutory('123456789012')).not.toBe('123456789012');
    expect(maskStatutory(null)).toBeNull();
  });

  it('current employee notice can be acknowledged once', async () => {
    const notice = await currentNotice(db, 'employee');
    expect(notice).not.toBeNull();
    if (notice === null) return;
    expect(notice.isCurrent).toBe(true);

    const before = await noticeStatus(db, userId);
    expect(before.required).toBe(true);

    expect(await acknowledgeNotice(db, userId, notice.id, '127.0.0.1')).toBe('ok');
    expect(await acknowledgeNotice(db, userId, notice.id, '127.0.0.1')).toBe('ok');

    const after = await noticeStatus(db, userId);
    expect(after.required).toBe(false);
  });

  it('consent grant/withdraw writes append-only events and withdrawal is immediate', async () => {
    await setConsent(db, {
      employeeId,
      userId,
      purpose: 'photograph',
      granted: true,
    });
    let list = await listMyConsents(db, employeeId);
    expect(list.find((c) => c.purpose === 'photograph')?.granted).toBe(true);

    await setConsent(db, {
      employeeId,
      userId,
      purpose: 'photograph',
      granted: false,
    });
    list = await listMyConsents(db, employeeId);
    expect(list.find((c) => c.purpose === 'photograph')?.granted).toBe(false);

    const events = await db
      .selectFrom('prv.consent_events')
      .select(['action', 'purpose'])
      .where('employee_id', '=', employeeId)
      .where('purpose', '=', 'photograph')
      .orderBy('id')
      .execute();
    expect(events.map((e) => e.action)).toEqual(['grant', 'withdraw']);
  });

  it('rights request sets due_at from sla; refuse requires a reason; fulfill closes', async () => {
    const sla = await getTypedSetting(db, 'prv.rights_sla_days', 'number', 15);
    const before = Date.now();
    const created = await createRightsRequest(db, {
      employeeId,
      userId,
      kind: 'access',
      reason: 'I want a copy',
    });
    const row = await db
      .selectFrom('prv.rights_requests')
      .select('due_at')
      .where('id', '=', created.id)
      .executeTakeFirstOrThrow();
    const dueMs = row.due_at.getTime() - before;
    expect(dueMs).toBeGreaterThan(sla * 86_400_000 - 5_000);
    expect(dueMs).toBeLessThan(sla * 86_400_000 + 60_000);

    expect(await refuseRights(db, created.id, dpoUserId, '  ')).toBe('no_reason');
    expect(await refuseRights(db, created.id, dpoUserId, 'Statutory retention applies')).toBe('ok');

    const erasure = await createRightsRequest(db, {
      employeeId,
      userId,
      kind: 'erasure',
      reason: null,
    });
    expect(await fulfillRights(db, erasure.id, dpoUserId)).toBe('ok');
  });

  it('export pack masks statutory identifiers', async () => {
    const pack = await buildAccessPack(db, employeeId, dpoUserId);
    const emp = pack['employee'] as Record<string, unknown>;
    expect(emp['pan']).not.toBe('ABCDE1234F');
    expect(String(emp['pan'])).toMatch(/234F$/);
    expect(emp['aadhaar']).not.toBe('123456789012');
    expect(emp['bankAccount']).not.toBe('12345678901234');
  });

  it('two-person purge: proposing user cannot confirm', async () => {
    const proposal = await proposePurge(db, 'photograph', dpoUserId);
    expect(proposal).not.toBe('unknown_class');
    if (proposal === 'unknown_class') return;

    expect(await confirmPurge(db, proposal.id, dpoUserId)).toBe('same_user');
    expect(await confirmPurge(db, proposal.id, adminUserId)).toBe('ok');

    const log = await db
      .selectFrom('prv.purge_log')
      .selectAll()
      .where('proposal_id', '=', proposal.id)
      .executeTakeFirstOrThrow();
    expect(log.data_class).toBe('photograph');
    expect(log.rule).toMatch(/log-only|no attendance/i);
  });
});
