/** CORE-09/10: wide profile visibility never widens the letter-specific population. */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';
import type { Database } from '../src/core/db/types.js';
import { createDatabase } from '../src/core/db/database.js';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { httpRequest } from './http-client.js';
const url = process.env['DATABASE_URL'];
describe.skipIf(!url)('scoped HR letter reads', () => {
  let db: Kysely<Database>;
  beforeAll(() => { db = createDatabase(url ?? ''); });
  afterAll(async () => { await db.destroy(); });
  it('guards both list and direct body by letters.issue scope, while ESS sees only own issued letters', async () => {
    const rollback = new Error('Intentional letter scope rollback');
    try { await db.transaction().execute(async tx => {
      const tag = 'letters_' + randomUUID();
      const company = await tx.insertInto('core.companies').values({ code: tag, name: tag, ecode_prefix: tag, is_india_payroll: false }).returning('id').executeTakeFirstOrThrow();
      const units = await tx.insertInto('core.org_units').values(['A', 'B'].map(name => ({ name: tag + name, company_id: company.id }))).returning('id').execute();
      const a = units[0]?.id; const b = units[1]?.id; if (!a || !b) throw new Error('Fixture units missing');
      const people = await tx.insertInto('core.employees').values([a, b].map((unit, index) => ({ company_id: company.id, org_unit_id: unit, ecode: tag + String(index), first_name: 'Synthetic', status: 'active' as const, doj: '2000-01-01' }))).returning('id').execute();
      const local = people[0]?.id; const foreign = people[1]?.id; if (!local || !foreign) throw new Error('Fixture people missing');
      const role = await tx.insertInto('core.roles').values({ code: tag, name: 'Synthetic scoped letter authority' }).returning('id').executeTakeFirstOrThrow();
      for (const [code, scope] of [['employee.read', 'all'], ['letters.issue', 'org_unit']] as const) {
        const p = await tx.selectFrom('core.permissions').select('id').where('code', '=', code).executeTakeFirstOrThrow();
        await tx.insertInto('core.role_permissions').values({ role_id: role.id, permission_id: p.id, scope }).execute();
      }
      const hr = await tx.insertInto('core.users').values({ email: tag + '@hrms.invalid', password_hash: '!disabled!' }).returning('id').executeTakeFirstOrThrow();
      await tx.insertInto('core.user_roles').values({ user_id: hr.id, role_id: role.id, scope_org_unit_id: a }).execute();
      const session = await tx.insertInto('sec.sessions').values({ user_id: hr.id, expires_at: new Date(Date.now() + 600_000) }).returning('sid').executeTakeFirstOrThrow();
      await tx.insertInto('core.letter_templates').values({ code: tag, name: tag, body_template: 'Synthetic', merge_fields: '[]', is_active: true }).execute();
      const letters = await tx.insertInto('core.letters').values([local, foreign].map(id => ({ employee_id: id, template_code: tag, body_rendered: id === local ? 'Synthetic local body' : 'Restricted foreign salary and exit reason', issued_at: new Date() }))).returning('id').execute();
      const ownLetter = letters[0]?.id; const foreignLetter = letters[1]?.id; if (!ownLetter || !foreignLetter) throw new Error('Fixture letters missing');
      const key = 'synthetic-letter-scope-key'; const request = await httpRequest(createApp({ db: tx, jwtSecret: key, secureCookies: false }));
      const token = await signAccessToken(hr.id, tag + '@hrms.invalid', key, session.sid);
      const get = (path: string) => request.get(path).auth(token, { type: 'bearer' });
      expect((await get(`/api/letters/employee/${String(local)}`)).status).toBe(200);
      const deniedList = await get(`/api/letters/employee/${String(foreign)}`);
      expect(deniedList.status).toBe(403);
      const deniedBody = await get(`/api/letters/${String(foreignLetter)}/content`);
      expect(deniedBody.status).toBe(403);
      expect(JSON.stringify(deniedBody.body)).not.toContain('Restricted foreign');
      expect((await get(`/api/letters/${String(ownLetter)}/content`)).status).toBe(200);
      // Removing letter authority must take effect even though employee.read remains global.
      await tx.deleteFrom('core.role_permissions').where('role_id', '=', role.id).where('permission_id', '=', (await tx.selectFrom('core.permissions').select('id').where('code', '=', 'letters.issue').executeTakeFirstOrThrow()).id).execute();
      expect((await get(`/api/letters/${String(ownLetter)}/content`)).status).toBe(403);
      // The same scoped account is now an employee owner with no letter authority.
      await tx.updateTable('core.users').set({ employee_id: local }).where('id', '=', hr.id).execute();
      const draft = await tx.insertInto('core.letters').values({ employee_id: local, template_code: tag, body_rendered: 'Unissued draft' }).returning('id').executeTakeFirstOrThrow();
      expect((await get(`/api/letters/${String(ownLetter)}/content`)).status).toBe(200);
      expect((await get(`/api/letters/${String(draft.id)}/content`)).status).toBe(403);
      expect((await get(`/api/letters/${String(foreignLetter)}/content`)).status).toBe(403);
      const mine = await get('/api/letters/mine');
      expect(mine.status).toBe(200);
      expect(JSON.stringify(mine.body)).toContain(String(ownLetter));
      expect(JSON.stringify(mine.body)).not.toContain('Unissued draft');
      throw rollback;
    }); } catch (error) { if (error !== rollback) throw error; }
  });
});
