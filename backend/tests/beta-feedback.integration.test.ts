import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import type { ControlledTransaction, Kysely } from 'kysely';
import { sql } from 'kysely';
import type { MigrationBuilder } from 'node-pg-migrate';
import { up } from '../migrations/1753200000000_beta-feedback.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { httpRequest } from './http-client.js';
import { devLogTransport } from '../src/modules/notifications/index.js';
import { screenshotBytes } from '../src/modules/feedback/feedback.service.js';

const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=';
it('validates screenshot bytes, MIME, size and canonical base64', () => {
  expect(screenshotBytes({ mime: 'image/png', base64: png }, 1000).length).toBeGreaterThan(0);
  expect(() => screenshotBytes({ mime: 'image/jpeg', base64: png }, 1000)).toThrow(/type/);
  expect(() => screenshotBytes({ mime: 'image/png', base64: png }, 1)).toThrow(/size/);
  expect(() => screenshotBytes({ mime: 'image/png', base64: `${png}!` }, 1000)).toThrow(/valid/);
});
const url = process.env['DATABASE_URL'];
const secret =
  process.env['JWT_SECRET'] ?? 'synthetic-beta-feedback-test-secret-at-least-32-characters';
describe.skipIf(!url)('BETA-01 feedback API', () => {
  let db: Kysely<Database>;
  let tx: ControlledTransaction<Database>;
  let app: ReturnType<typeof createApp>;
  const tokens: Record<string, string> = {};
  const ids: Record<string, number> = {};
  const files: string[] = [];
  let reportId = 0;
  let requestId = '';
  beforeAll(async () => {
    db = createDatabase(url ?? '');
    tx = await db.startTransaction().execute();
    const exists = await sql<{
      table: string | null;
    }>`SELECT to_regclass('hd.beta_feedback')::text AS table`.execute(tx);
    if (!exists.rows[0]?.table) {
      let ddl = '';
      up({
        sql: (text: string) => {
          ddl += text;
        },
      } as unknown as MigrationBuilder);
      await sql.raw(ddl).execute(tx);
    }
    const company = await tx.selectFrom('core.companies').select('id').executeTakeFirstOrThrow();
    const tag = randomUUID().slice(0, 8);
    const employee = await tx
      .insertInto('core.employees')
      .values({
        company_id: company.id,
        ecode: `BETA${tag}`,
        first_name: 'Beta',
        last_name: 'Reporter',
        status: 'active',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const [name, role] of [
      ['owner', 'employee'],
      ['other', 'employee'],
      ['reviewer', 'it_admin'],
    ] as const) {
      const u = await tx
        .insertInto('core.users')
        .values({
          email: `${tag}-${name}@hrms.invalid`,
          password_hash: '!disabled!',
          employee_id: name === 'owner' ? employee.id : null,
        })
        .returning(['id', 'email'])
        .executeTakeFirstOrThrow();
      const r = await tx
        .selectFrom('core.roles')
        .select('id')
        .where('code', '=', role)
        .executeTakeFirstOrThrow();
      await tx
        .insertInto('core.user_roles')
        .values({ user_id: u.id, role_id: r.id, scope_org_unit_id: null })
        .execute();
      const session = await tx
        .insertInto('sec.sessions')
        .values({ user_id: u.id, expires_at: new Date(Date.now() + 600000) })
        .returning('sid')
        .executeTakeFirstOrThrow();
      ids[name] = u.id;
      tokens[name] = await signAccessToken(u.id, u.email, secret, session.sid);
    }
    app = createApp({
      db: tx,
      jwtSecret: secret,
      secureCookies: false,
      appBaseUrl: 'https://hrms.invalid',
    });
  });
  afterAll(async () => {
    if (!tx.isCommitted && !tx.isRolledBack) await tx.rollback().execute();
    await db.destroy();
    for (const file of files) await unlink(file).catch(() => undefined);
  });
  const call = async (
    method: 'get' | 'post' | 'patch',
    actor: string,
    route: string,
    body?: object,
  ) => {
    const client = await httpRequest(app);
    const r = client[method](route)
      .set('Authorization', `Bearer ${tokens[actor] ?? ''}`);
    return body ? r.send(body) : r;
  };
  it('takes identity from the server, stores screenshot privately, queues one email and handles retry', async () => {
    requestId = randomUUID();
    const body = {
      requestId,
      pagePath: '/people',
      pageTitle: 'People',
      body: 'The search did not return the expected employee.',
      screenshot: { mime: 'image/png', base64: png },
    };
    const response = await call('post', 'owner', '/api/beta-feedback', body);
    expect(response.status).toBe(200);
    reportId = (response.body as { id: number }).id;
    const stored = await tx
      .selectFrom('hd.beta_feedback')
      .selectAll()
      .where('id', '=', reportId)
      .executeTakeFirstOrThrow();
    expect(stored.user_name).toBe('Beta Reporter');
    expect(stored.user_id).toBe(ids['owner']);
    expect(stored.role_codes).toContain('employee');
    const doc = await tx
      .selectFrom('core.documents')
      .select(['path', 'owner_employee_id'])
      .where('id', '=', stored.screenshot_document_id ?? 0)
      .executeTakeFirstOrThrow();
    files.push(
      path.resolve(
        process.env['STORAGE_DIR'] ?? path.join(process.cwd(), 'var', 'storage'),
        doc.path,
      ),
    );
    expect(doc.owner_employee_id).toBeNull();
    const retry = await call('post', 'owner', '/api/beta-feedback', body);
    expect(retry.body).toEqual(response.body);
    expect(
      (await call('post', 'owner', '/api/beta-feedback', { ...body, body: 'Changed after retry' }))
        .status,
    ).toBe(400);
    const email = await tx
      .selectFrom('wf.notifications')
      .selectAll()
      .where('template_code', '=', 'beta_feedback')
      .where(sql<string>`payload->>'reportId'`, '=', String(reportId))
      .execute();
    expect(
      email.filter((n) => n.recipient_email === 'core_developers@rashmigroup.com'),
    ).toHaveLength(1);
    const mail = email.find((n) => n.recipient_email === 'core_developers@rashmigroup.com');
    if (!mail) throw new Error('Notification missing');
    await expect(devLogTransport.send(mail)).rejects.toThrow(/SMTP is not configured/);
    expect(
      (await call('get', 'owner', `/api/beta-feedback/${String(reportId)}/screenshot`)).body,
    ).toMatchObject({ mime: 'image/png', base64: png });
  });
  it('prevents spoofing, unsafe paths, unauthenticated access and cross-user screenshot access', async () => {
    const body = { requestId: randomUUID(), pagePath: '/people', pageTitle: '', body: 'Feedback' };
    expect(
      (await call('post', 'owner', '/api/beta-feedback', { ...body, name: 'Someone else' })).status,
    ).toBe(400);
    for (const pagePath of [
      'https://evil.invalid',
      '//evil.invalid',
      '/people?token=private',
      '/people#secret',
    ])
      expect(
        (await call('post', 'owner', '/api/beta-feedback', { ...body, pagePath })).status,
      ).toBe(400);
    expect((await call('post', 'unknown', '/api/beta-feedback', body)).status).toBe(401);
    expect(
      (await call('get', 'other', `/api/beta-feedback/${String(reportId)}/screenshot`)).status,
    ).toBe(403);
    expect((await call('get', 'owner', '/api/beta-feedback')).status).toBe(403);
    expect(
      (
        await call('patch', 'owner', `/api/beta-feedback/${String(reportId)}`, {
          status: 'resolved',
        })
      ).status,
    ).toBe(403);
    expect((await call('post', 'other', '/api/beta-feedback', { ...body, requestId })).status).toBe(
      403,
    );
  });
  it('lets IT reviewers read, resolve and reopen a report', async () => {
    const inbox = await call('get', 'reviewer', '/api/beta-feedback?limit=1');
    expect(inbox.status).toBe(200);
    expect((inbox.body as { rows: unknown[] }).rows).toHaveLength(1);
    expect(
      (await call('get', 'reviewer', `/api/beta-feedback/${String(reportId)}`)).body,
    ).toMatchObject({ id: reportId, name: 'Beta Reporter' });
    expect(
      (await call('get', 'reviewer', `/api/beta-feedback/${String(reportId)}/screenshot`)).status,
    ).toBe(200);
    for (const status of ['resolved', 'new'])
      expect(
        (await call('patch', 'reviewer', `/api/beta-feedback/${String(reportId)}`, { status }))
          .status,
      ).toBe(200);
  });
});
