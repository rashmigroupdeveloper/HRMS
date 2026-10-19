/** DOC-02/CORE-08: actual HTTP authorization and storage calls, rollback fixtures. */
import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Database } from '../src/core/db/types.js';
import { createDatabase } from '../src/core/db/database.js';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import * as storage from '../src/core/storage/storage.js';
import { httpRequest } from './http-client.js';
const url = process.env['DATABASE_URL'];
describe.skipIf(!url)('scoped employee document vault', () => {
  let root: Kysely<Database>;
  beforeAll(() => {
    root = createDatabase(url ?? '');
  });
  afterAll(async () => {
    await root.destroy();
  });
  it('guards ownership, HR plant scope, identity-field authority and malformed uploads', async () => {
    const files = new Map<string, Buffer>();
    const put = vi.fn((key: string, value: Buffer | string) => {
      files.set(key, Buffer.from(value));
      return Promise.resolve();
    });
    const get = vi.fn((key: string) => {
      const value = files.get(key);
      return value ? Promise.resolve(value) : Promise.reject(new Error('Missing synthetic file'));
    });
    vi.spyOn(storage, 'getStorage').mockReturnValue({ put, get });
    const rollback = new Error('Intentional document vault rollback');
    try {
      await root.transaction().execute(async (db) => {
        const tag = 'vault_' + randomUUID();
        const company = await db
          .insertInto('core.companies')
          .values({ code: tag, name: tag, ecode_prefix: tag, is_india_payroll: false })
          .returning('id')
          .executeTakeFirstOrThrow();
        const units = await db
          .insertInto('core.org_units')
          .values(['A', 'B'].map((name) => ({ company_id: company.id, name: tag + name })))
          .returning('id')
          .execute();
        const unit = units[0]?.id;
        const otherUnit = units[1]?.id;
        if (!unit || !otherUnit) throw new Error('Missing units');
        const people = await db
          .insertInto('core.employees')
          .values(
            [unit, otherUnit].map((id, index) => ({
              company_id: company.id,
              org_unit_id: id,
              ecode: tag + String(index),
              first_name: 'Synthetic',
              doj: '2000-01-01',
              status: 'active' as const,
            })),
          )
          .returning('id')
          .execute();
        const owner = people[0]?.id;
        const foreign = people[1]?.id;
        if (!owner || !foreign) throw new Error('Missing people');
        await db
          .insertInto('core.permissions')
          .values(['doc.vault.own', 'doc.vault.manage'].map((code) => ({ code })))
          .onConflict((oc) => oc.doNothing())
          .execute();
        const role = await db
          .insertInto('core.roles')
          .values({ code: tag, name: tag })
          .returning('id')
          .executeTakeFirstOrThrow();
        const ownRole = await db
          .insertInto('core.roles')
          .values({ code: tag + '_own', name: tag })
          .returning('id')
          .executeTakeFirstOrThrow();
        for (const [roleId, code, scope] of [
          [role.id, 'doc.vault.manage', 'org_unit'],
          [ownRole.id, 'doc.vault.own', 'own'],
        ] as const) {
          const permission = await db
            .selectFrom('core.permissions')
            .select('id')
            .where('code', '=', code)
            .executeTakeFirstOrThrow();
          await db
            .insertInto('core.role_permissions')
            .values({ role_id: roleId, permission_id: permission.id, scope })
            .execute();
        }
        const ownerUser = await db
          .insertInto('core.users')
          .values({ email: tag + '@hrms.invalid', password_hash: '!disabled!', employee_id: owner })
          .returning('id')
          .executeTakeFirstOrThrow();
        const hr = await db
          .insertInto('core.users')
          .values({ email: tag + '-hr@hrms.invalid', password_hash: '!disabled!' })
          .returning('id')
          .executeTakeFirstOrThrow();
        await db
          .insertInto('core.user_roles')
          .values([
            { user_id: ownerUser.id, role_id: ownRole.id },
            { user_id: hr.id, role_id: role.id, scope_org_unit_id: unit },
          ])
          .execute();
        await db
          .insertInto('doc.types')
          .values({ code: tag, name: 'Synthetic identity', typically_expires: true })
          .execute();
        await db
          .insertInto('core.settings')
          .values({
            key: 'doc.identity_types',
            value: JSON.stringify(tag),
            value_type: 'string',
            description: 'Synthetic identity class',
          })
          .onConflict((oc) => oc.column('key').doUpdateSet({ value: JSON.stringify(tag) }))
          .execute();
        const key = 'synthetic-vault-test-key';
        const sessions = await db
          .insertInto('sec.sessions')
          .values(
            [ownerUser.id, hr.id].map((id) => ({
              user_id: id,
              expires_at: new Date(Date.now() + 600_000),
            })),
          )
          .returning(['user_id', 'sid'])
          .execute();
        const token = async (id: number) =>
          signAccessToken(
            id,
            'synthetic@hrms.invalid',
            key,
            sessions.find((row) => row.user_id === id)?.sid,
          );
        const ownerToken = await token(ownerUser.id);
        const hrToken = await token(hr.id);
        const request = await httpRequest(createApp({ db, jwtSecret: key, secureCookies: false }));
        expect(
          (await request.get('/api/documents/catalog').auth(hrToken, { type: 'bearer' })).status,
        ).toBe(200);
        const payload = {
          documentType: tag,
          fileName: 'private-identity.pdf',
          mime: 'application/pdf',
          content: Buffer.from('%PDF-1.4 synthetic').toString('base64'),
          expiresOn: '2099-10-19',
        };
        const created = await request
          .post('/api/documents/mine')
          .auth(ownerToken, { type: 'bearer' })
          .send(payload);
        expect(created.status).toBe(200);
        const retry = await request
          .post('/api/documents/mine')
          .auth(ownerToken, { type: 'bearer' })
          .send(payload);
        expect(retry.status).toBe(200);
        expect(retry.body).toEqual(created.body);
        expect(put).toHaveBeenCalledTimes(1);
        const id = (created.body as { id: number }).id;
        expect(
          (
            await db
              .selectFrom('core.documents')
              .select('expires_on')
              .where('id', '=', id)
              .executeTakeFirstOrThrow()
          ).expires_on
            ?.toISOString()
            .slice(0, 10),
        ).toBe('2099-10-19');
        // Legacy branch records classified the file by kind alone.
        await db
          .updateTable('core.documents')
          .set({ kind: tag, doc_type: null })
          .where('id', '=', id)
          .execute();
        expect(
          (
            await request
              .get(`/api/documents/mine/${String(id)}/content?purpose=Personal+record`)
              .auth(ownerToken, { type: 'bearer' })
          ).status,
        ).toBe(200);
        // Converted joining files use a generic kind plus the existing catalog FK.
        await db
          .updateTable('core.documents')
          .set({ kind: 'joining', doc_type: tag })
          .where('id', '=', id)
          .execute();
        const convertedRetry = await request
          .post('/api/documents/mine')
          .auth(ownerToken, { type: 'bearer' })
          .send(payload);
        expect(convertedRetry.body).toEqual(created.body);
        expect(put).toHaveBeenCalledTimes(1);
        expect(
          (
            await request
              .get(`/api/documents/${String(id)}/content?purpose=Identity+review`)
              .auth(hrToken, { type: 'bearer' })
          ).status,
        ).toBe(403);
        const list = await request.get('/api/documents').auth(hrToken, { type: 'bearer' });
        expect(list.status).toBe(200);
        expect((list.body as { rows: { id: number }[] }).rows.some((row) => row.id === id)).toBe(
          true,
        );
        expect(JSON.stringify(list.body)).not.toContain('private-identity.pdf');
        expect(
          (
            await request
              .post('/api/documents')
              .auth(hrToken, { type: 'bearer' })
              .send({ ...payload, employeeId: foreign })
          ).status,
        ).toBe(403);
        const fieldPermission = await db
          .selectFrom('core.permissions')
          .select('id')
          .where('code', '=', 'employee.statutory_ids.read')
          .executeTakeFirstOrThrow();
        await db
          .insertInto('core.role_permissions')
          .values({ role_id: role.id, permission_id: fieldPermission.id, scope: 'org_unit' })
          .execute();
        expect(
          (
            await request
              .get(`/api/documents/${String(id)}/content?purpose=Identity+review`)
              .auth(hrToken, { type: 'bearer' })
          ).status,
        ).toBe(200);
        // Catalog retention classes must protect joining bank/address/medical files
        // even if their codes are absent from the legacy identity-type setting.
        await db
          .updateTable('core.settings')
          .set({ value: JSON.stringify('') })
          .where('key', '=', 'doc.identity_types')
          .execute();
        await db
          .updateTable('doc.types')
          .set({ retention_class: 'statutory_id' })
          .where('code', '=', tag)
          .execute();
        const readHr = () =>
          request
            .get(`/api/documents/${String(id)}/content?purpose=Scoped+class+review`)
            .auth(hrToken, { type: 'bearer' });
        expect((await readHr()).status).toBe(200);
        for (const [classification, permissionCode] of [
          ['health', 'employee.medical.read'],
          ['employment', 'employee.compensation.read'],
        ] as const) {
          await db
            .updateTable('doc.types')
            .set({ retention_class: classification })
            .where('code', '=', tag)
            .execute();
          if (classification === 'employment')
            await db
              .insertInto('core.settings')
              .values({
                key: 'doc.compensation_types',
                value: JSON.stringify(tag),
                value_type: 'string',
                description: 'Synthetic compensation document classification',
              })
              .onConflict((oc) => oc.column('key').doUpdateSet({ value: JSON.stringify(tag) }))
              .execute();
          expect((await readHr()).status).toBe(403);
          await db
            .insertInto('core.permissions')
            .values({ code: permissionCode })
            .onConflict((oc) => oc.doNothing())
            .execute();
          const permission = await db
            .selectFrom('core.permissions')
            .select('id')
            .where('code', '=', permissionCode)
            .executeTakeFirstOrThrow();
          await db
            .insertInto('core.role_permissions')
            .values({ role_id: role.id, permission_id: permission.id, scope: 'org_unit' })
            .execute();
          expect((await readHr()).status).toBe(200);
          await db
            .deleteFrom('core.role_permissions')
            .where('role_id', '=', role.id)
            .where('permission_id', '=', permission.id)
            .execute();
          expect((await readHr()).status).toBe(403);
        }
        await db
          .updateTable('doc.types')
          .set({ retention_class: 'statutory_id' })
          .where('code', '=', tag)
          .execute();
        await db
          .deleteFrom('core.role_permissions')
          .where('role_id', '=', role.id)
          .where('permission_id', '=', fieldPermission.id)
          .execute();
        expect(
          (
            await request
              .get(`/api/documents/${String(id)}/content?purpose=Identity+review`)
              .auth(hrToken, { type: 'bearer' })
          ).status,
        ).toBe(403);
        const reads = get.mock.calls.length;
        await db
          .updateTable('core.documents')
          .set({ owner_employee_id: foreign })
          .where('id', '=', id)
          .execute();
        expect(
          (
            await request
              .get(`/api/documents/mine/${String(id)}/content?purpose=Personal+record`)
              .auth(ownerToken, { type: 'bearer' })
          ).status,
        ).toBe(404);
        expect(
          (
            await request
              .get(`/api/documents/${String(id)}/content?purpose=Identity+review`)
              .auth(hrToken, { type: 'bearer' })
          ).status,
        ).toBe(403);
        expect(get).toHaveBeenCalledTimes(reads);
        const writes = put.mock.calls.length;
        expect(
          (
            await request
              .post('/api/documents/mine')
              .auth(ownerToken, { type: 'bearer' })
              .send({ ...payload, expiresOn: null })
          ).status,
        ).toBe(400);

        expect(
          (
            await request
              .post('/api/documents/mine')
              .auth(ownerToken, { type: 'bearer' })
              .send({ ...payload, content: 'not base64' })
          ).status,
        ).toBe(400);
        expect(
          (
            await request
              .post('/api/documents/mine')
              .auth(ownerToken, { type: 'bearer' })
              .send({ ...payload, content: Buffer.from('<script>bad</script>').toString('base64') })
          ).status,
        ).toBe(400);
        expect(
          (
            await request
              .post('/api/documents/mine')
              .auth(ownerToken, { type: 'bearer' })
              .send({ ...payload, expiresOn: '2026-02-30' })
          ).status,
        ).toBe(400);
        expect(put).toHaveBeenCalledTimes(writes);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      vi.restoreAllMocks();
      files.clear();
    }
  });
});
