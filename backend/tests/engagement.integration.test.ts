/**
 * M10 Engagement — EN-01/02/03 (live Postgres).
 *
 * E1 an announcement reaches its AUDIENCE and nobody else (EN-01) — the whole
 *    point of the audience filter is that "everyone" is a choice, not a default.
 * E2 publishing is gated on `engagement.publish`; reading your own feed is not.
 * E3 an ANONYMOUS poll stores no identity at all — not in the response row and
 *    not in the results payload.
 * E4 an anonymous poll still dedupes one-person-one-response. This is the bug
 *    the shipped schema had: the unique index only covered `respondent_user_id`,
 *    which is NULL for anonymous polls, so an anonymous poll could be stuffed.
 * E5 a NAMED poll dedupes too, and its results may carry the author.
 * E6 a closed poll accepts nothing further.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { type Kysely } from 'kysely';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { hashPassword } from '../src/modules/auth/index.js';
import { TEST_RATE_LIMITS } from './helpers/rate-limits.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'integration-test-secret-at-least-32-chars!';
const run = describe.skipIf(!DB_URL);

interface Announcement {
  id: number;
  title: string;
}
interface Poll {
  id: number;
  question: string;
  isAnonymous: boolean;
  hasResponded: boolean;
}
interface PollResult {
  totalResponses: number;
  isAnonymous: boolean;
  options: { index: number; label: string; votes: number }[];
  comments: { comment: string; byEmail: string | null }[];
}

run('M10 Engagement — EN-01..03 (live Postgres)', () => {
  let db: Kysely<Database>;
  let app: Express;
  const stamp = Date.now();
  const tag = `ENG${String(stamp).slice(-6)}`;
  const password = 'engagement-pw-1!';
  const hrEmail = `eng-hr-${String(stamp)}@hrms.test`;
  const inEmail = `eng-in-${String(stamp)}@hrms.test`;
  const outEmail = `eng-out-${String(stamp)}@hrms.test`;
  let hrToken: string;
  let inToken: string;
  let outToken: string;
  let companyId: number;
  let inDeptId: number;
  let outDeptId: number;
  const announcementIds: number[] = [];
  const pollIds: number[] = [];

  const asHr = () => ({ Authorization: `Bearer ${hrToken}` });
  const asIn = () => ({ Authorization: `Bearer ${inToken}` });
  const asOut = () => ({ Authorization: `Bearer ${outToken}` });

  async function mkEmployeeUser(
    email: string,
    roleCode: string,
    ecodeSuffix: string,
    departmentId: number | null,
  ): Promise<void> {
    const emp = await db
      .insertInto('core.employees')
      .values({
        ecode: `${tag}${ecodeSuffix}`,
        company_id: companyId,
        first_name: `Eng ${ecodeSuffix}`,
        status: 'active',
        department_id: departmentId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const user = await db
      .insertInto('core.users')
      .values({ email, password_hash: await hashPassword(password), employee_id: emp.id })
      .returning('id')
      .executeTakeFirstOrThrow();
    const role = await db
      .selectFrom('core.roles')
      .select('id')
      .where('code', '=', roleCode)
      .executeTakeFirstOrThrow();
    await db
      .insertInto('core.user_roles')
      .values({ user_id: user.id, role_id: role.id, scope_org_unit_id: null })
      .execute();
  }

  async function login(email: string): Promise<string> {
    const res = await request(app).post('/api/auth/login').send({ identifier: email, password });
    expect(res.status).toBe(200);
    return (res.body as { accessToken: string }).accessToken;
  }

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false, rateLimits: TEST_RATE_LIMITS });

    const company = await db
      .selectFrom('core.companies')
      .select('id')
      .where('code', '=', 'RML')
      .executeTakeFirstOrThrow();
    companyId = company.id;

    const depts = await db
      .selectFrom('core.departments')
      .select('id')
      .orderBy('id')
      .limit(2)
      .execute();
    inDeptId = depts[0]?.id ?? 1;
    outDeptId = depts[1]?.id ?? 2;

    // hr_head holds engagement.publish at scope 'all' (docs/08 §2 grid).
    await mkEmployeeUser(hrEmail, 'hr_head', 'HR', inDeptId);
    await mkEmployeeUser(inEmail, 'employee', 'IN', inDeptId);
    await mkEmployeeUser(outEmail, 'employee', 'OU', outDeptId);

    hrToken = await login(hrEmail);
    inToken = await login(inEmail);
    outToken = await login(outEmail);
  });

  afterAll(async () => {
    if (pollIds.length > 0) {
      await db.deleteFrom('eng.poll_responses').where('poll_id', 'in', pollIds).execute();
      await db.deleteFrom('eng.polls').where('id', 'in', pollIds).execute();
    }
    if (announcementIds.length > 0) {
      await db.deleteFrom('eng.announcements').where('id', 'in', announcementIds).execute();
    }
    // Users with audit history are never hard-deleted (CORE-06): detach + deactivate.
    await db
      .updateTable('core.users')
      .set({ is_active: false, employee_id: null })
      .where('email', 'in', [hrEmail, inEmail, outEmail])
      .execute();
    await db.deleteFrom('core.employees').where('ecode', 'like', `${tag}%`).execute();
    await db.destroy();
  });

  async function publish(title: string, departmentIds?: number[]): Promise<number> {
    const res = await request(app)
      .post('/api/engagement/announcements')
      .set(asHr())
      .send({
        title,
        body: 'Body of the announcement.',
        ...(departmentIds ? { audience: { departmentIds } } : {}),
      });
    expect(res.status).toBe(200);
    const id = (res.body as { id: number }).id;
    announcementIds.push(id);
    return id;
  }

  async function createPoll(
    question: string,
    isAnonymous: boolean,
    departmentIds?: number[],
  ): Promise<number> {
    const res = await request(app)
      .post('/api/engagement/polls')
      .set(asHr())
      .send({
        question,
        options: ['Yes', 'No'],
        isAnonymous,
        ...(departmentIds ? { audience: { departmentIds } } : {}),
      });
    expect(res.status).toBe(200);
    const id = (res.body as { id: number }).id;
    pollIds.push(id);
    return id;
  }

  it('E1 an announcement reaches its audience and nobody else (EN-01)', async () => {
    const targetedTitle = `${tag} targeted`;
    const everyoneTitle = `${tag} everyone`;
    await publish(targetedTitle, [inDeptId]);
    await publish(everyoneTitle);

    const inFeed = await request(app).get('/api/engagement/announcements').set(asIn());
    const outFeed = await request(app).get('/api/engagement/announcements').set(asOut());
    expect(inFeed.status).toBe(200);
    expect(outFeed.status).toBe(200);

    const inTitles = (inFeed.body as Announcement[]).map((a) => a.title);
    const outTitles = (outFeed.body as Announcement[]).map((a) => a.title);

    expect(inTitles).toContain(targetedTitle);
    // The whole value of the audience filter is this line.
    expect(outTitles).not.toContain(targetedTitle);
    // An absent audience still means everyone — the default must stay useful.
    expect(inTitles).toContain(everyoneTitle);
    expect(outTitles).toContain(everyoneTitle);
  });

  it('E2 publishing needs engagement.publish; reading your own feed does not', async () => {
    const forbidden = await request(app)
      .post('/api/engagement/announcements')
      .set(asIn())
      .send({ title: `${tag} nope`, body: 'x' });
    expect(forbidden.status).toBe(403);

    // But an ordinary employee can always read what was addressed to them.
    const feed = await request(app).get('/api/engagement/announcements').set(asIn());
    expect(feed.status).toBe(200);

    // ...and cannot see the publisher's full catalogue.
    const catalogue = await request(app).get('/api/engagement/announcements/all').set(asIn());
    expect(catalogue.status).toBe(403);
  });

  it('E3 an anonymous poll stores and returns no identity (EN-02/03)', async () => {
    const pollId = await createPoll(`${tag} anonymous?`, true);

    const res = await request(app)
      .post(`/api/engagement/polls/${String(pollId)}/respond`)
      .set(asIn())
      .send({ optionIndex: 0, comment: 'said in confidence' });
    expect(res.status).toBe(200);

    // The row itself carries no user id — anonymity is a property of the DATA,
    // not of the query that happens to read it.
    const stored = await db
      .selectFrom('eng.poll_responses')
      .select(['respondent_user_id', 'respondent_hash'])
      .where('poll_id', '=', pollId)
      .execute();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.respondent_user_id).toBeNull();
    expect(stored[0]?.respondent_hash).toBeTruthy();

    const results = await request(app)
      .get(`/api/engagement/polls/${String(pollId)}/results`)
      .set(asHr());
    expect(results.status).toBe(200);
    const body = results.body as PollResult;
    expect(body.isAnonymous).toBe(true);
    expect(body.totalResponses).toBe(1);
    expect(body.options[0]?.votes).toBe(1);
    // The comment survives; the author does not.
    expect(body.comments).toHaveLength(1);
    expect(body.comments[0]?.byEmail).toBeNull();
  });

  it('E4 an anonymous poll still allows only one response per person', async () => {
    const pollId = await createPoll(`${tag} anonymous dedupe?`, true);

    const first = await request(app)
      .post(`/api/engagement/polls/${String(pollId)}/respond`)
      .set(asIn())
      .send({ optionIndex: 0 });
    expect(first.status).toBe(200);

    // Before the respondent_hash fix this second vote succeeded, and an
    // anonymous poll could be stuffed without limit.
    const second = await request(app)
      .post(`/api/engagement/polls/${String(pollId)}/respond`)
      .set(asIn())
      .send({ optionIndex: 1 });
    expect(second.status).toBe(400);

    // A DIFFERENT person is still free to answer.
    const other = await request(app)
      .post(`/api/engagement/polls/${String(pollId)}/respond`)
      .set(asOut())
      .send({ optionIndex: 1 });
    expect(other.status).toBe(200);

    const rows = await db
      .selectFrom('eng.poll_responses')
      .select('id')
      .where('poll_id', '=', pollId)
      .execute();
    expect(rows).toHaveLength(2);

    // The caller can see they have already answered, without anyone else learning it.
    const mine = await request(app).get('/api/engagement/polls').set(asIn());
    const poll = (mine.body as Poll[]).find((p) => p.id === pollId);
    expect(poll?.hasResponded).toBe(true);
  });

  it('E5 a named poll dedupes and may attribute its comments', async () => {
    const pollId = await createPoll(`${tag} named?`, false);

    const first = await request(app)
      .post(`/api/engagement/polls/${String(pollId)}/respond`)
      .set(asIn())
      .send({ optionIndex: 0, comment: 'happy to be quoted' });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/engagement/polls/${String(pollId)}/respond`)
      .set(asIn())
      .send({ optionIndex: 1 });
    expect(second.status).toBe(400);

    const results = await request(app)
      .get(`/api/engagement/polls/${String(pollId)}/results`)
      .set(asHr());
    const body = results.body as PollResult;
    expect(body.isAnonymous).toBe(false);
    expect(body.comments[0]?.byEmail).toBe(inEmail);
  });

  it('E6 a closed poll accepts nothing further', async () => {
    const pollId = await createPoll(`${tag} closing?`, false);

    const closed = await request(app)
      .post(`/api/engagement/polls/${String(pollId)}/close`)
      .set(asHr());
    expect(closed.status).toBe(200);

    const late = await request(app)
      .post(`/api/engagement/polls/${String(pollId)}/respond`)
      .set(asIn())
      .send({ optionIndex: 0 });
    expect(late.status).toBe(400);

    // A closed poll also drops off the ESS list.
    const mine = await request(app).get('/api/engagement/polls').set(asIn());
    expect((mine.body as Poll[]).some((p) => p.id === pollId)).toBe(false);
  });

  it('E1b a withdrawn announcement disappears from the feed but survives in the catalogue', async () => {
    const title = `${tag} withdrawn`;
    const id = await publish(title);

    const before = await request(app).get('/api/engagement/announcements').set(asIn());
    expect((before.body as Announcement[]).map((a) => a.title)).toContain(title);

    const res = await request(app)
      .post(`/api/engagement/announcements/${String(id)}/withdraw`)
      .set(asHr());
    expect(res.status).toBe(200);

    const after = await request(app).get('/api/engagement/announcements').set(asIn());
    expect((after.body as Announcement[]).map((a) => a.title)).not.toContain(title);

    // Withdrawal is a flag, never a delete: what was said stays on the record.
    const catalogue = await request(app).get('/api/engagement/announcements/all').set(asHr());
    expect((catalogue.body as Announcement[]).map((a) => a.title)).toContain(title);
  });
});
