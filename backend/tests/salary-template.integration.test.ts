/** E2E-029: one CTC template per grade, assigned to employees of any CTC; structure company must match. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { ControlledTransaction, Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { createStructure, previewStructureBreakup } from '../src/modules/payroll-core/structures/structure.service.js';
import { assignSalary } from '../src/modules/payroll-core/salaries/salary.service.js';

const DB_URL = process.env['DATABASE_URL'];

describe.skipIf(!DB_URL)('CTC salary templates', () => {
  let db: Kysely<Database>;
  let tx: ControlledTransaction<Database>;
  let company = 0;
  let other = 0;
  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    tx = await db.startTransaction().execute();
    const tag = ('ST' + randomUUID().slice(0, 5)).toUpperCase();
    company = (await tx.insertInto('core.companies').values({ code: tag, name: tag, ecode_prefix: tag }).returning('id').executeTakeFirstOrThrow()).id;
    other = (await tx.insertInto('core.companies').values({ code: `${tag}O`, name: `${tag}O`, ecode_prefix: `${tag}O` }).returning('id').executeTakeFirstOrThrow()).id;
  });
  afterAll(async () => {
    try { if (!tx.isRolledBack && !tx.isCommitted) await tx.rollback().execute(); } finally { await db.destroy(); }
  });

  it('assigns one grade template to two CTCs and refuses another company', async () => {
    const structure = await createStructure(tx, { name: 'Grade M1', company_id: company, components: [
      { component_code: 'BASIC', amount_rule: 'CTC * 0.40' },
      { component_code: 'HRA' },                                  // catalog: BASIC * 0.50
      { component_code: 'EPS_ER' },                               // catalog: PF_WAGES_CAPPED * 0.0833
      { component_code: 'SPECIAL_ALLOW' },                        // balance to CTC
    ] }, null);
    const preview = await previewStructureBreakup(tx, { structure_id: structure.id, annual_ctc_rupees: 600000 });
    expect(preview).toMatchObject({ monthly: { BASIC: 20000, HRA: 10000, EPS_ER: 1250, SPECIAL_ALLOW: 18750 } });
    for (const [i, ctc] of [[1, 600000], [2, 900000]] as const) {
      const unit = (await tx.insertInto('core.org_units').values({ company_id: company, name: `u${String(i)}` }).returning('id').executeTakeFirstOrThrow()).id;
      const emp = (await tx.insertInto('core.employees').values({ company_id: company, org_unit_id: unit, ecode: `ST${randomUUID().slice(0, 6)}`, first_name: 'T', status: 'active', doj: '2026-01-01' }).returning('id').executeTakeFirstOrThrow()).id;
      const row = await assignSalary(tx, { employee_id: emp, structure_id: structure.id, effective_from: '2026-01-01', annual_ctc_rupees: ctc, revision_reason: 'joining' }, null);
      const raw: unknown = row.component_amounts;
      const amounts = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, number>;
      expect(amounts['BASIC']).toBe(Math.round(ctc / 12 * 0.4) * 100);
      expect(Object.values(amounts).reduce((a, b) => a + b, 0)).toBe(ctc / 12 * 100);
    }
    const otherUnit = (await tx.insertInto('core.org_units').values({ company_id: other, name: 'o' }).returning('id').executeTakeFirstOrThrow()).id;
    const stranger = (await tx.insertInto('core.employees').values({ company_id: other, org_unit_id: otherUnit, ecode: `ST${randomUUID().slice(0, 6)}`, first_name: 'O', status: 'active', doj: '2026-01-01' }).returning('id').executeTakeFirstOrThrow()).id;
    await expect(assignSalary(tx, { employee_id: stranger, structure_id: structure.id, effective_from: '2026-01-01', annual_ctc_rupees: 600000, revision_reason: 'joining' }, null)).rejects.toThrow(/another company/);
    await expect(createStructure(tx, { name: 'Bad', company_id: company, components: [{ component_code: 'BASIC', amount_rule: 'CTC_TYPO * 0.4' }] }, null)).rejects.toThrow(/uses CTC_TYPO/);
  });
});
