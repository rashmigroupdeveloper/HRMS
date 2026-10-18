/** Read-only outcome audit: every fixture and application write rolls back. NFR-03, EN-01..03, CORE-13, HD-01. */
import { createServer } from 'node:http';
import { writeFile } from 'node:fs/promises';
import { sql } from '../../backend/node_modules/kysely/dist/esm/index.js';
import { createDatabase } from '../../backend/src/core/db/database.js';
import { createApp } from '../../backend/src/app.js';
import { signAccessToken, signRefreshToken } from '../../backend/src/core/auth/jwt.js';
import { recordLoginFailure } from '../../backend/src/modules/auth/auth.repository.js';
import { refresh } from '../../backend/src/modules/auth/auth.service.js';
import { policyAckStatus, policyAckReport } from '../../backend/src/modules/policies/policies.service.js';

const target = process.env['DATABASE_URL'];
if (!target) throw new Error('Explicit local test database required');
const url = new URL(target);
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/hrms') throw new Error('Local hrms test database only');
const db = createDatabase(target);
const secret = 'other-module-audit-fixture-secret-not-for-login';
const stamp = String(Date.now());
const probes: { id: string; expected: string; observed: unknown; reproduced: boolean }[] = [];
const fixtureUserIds: number[] = [];
const controls: { id: string; passed: boolean; observed: unknown }[] = [];
const sentinel = new Error('Intentional audit rollback');
const add = (id: string, expected: string, observed: unknown, reproduced: boolean) => probes.push({ id, expected, observed, reproduced });
try {
  await db.transaction().execute(async trx => {
    await sql`SET LOCAL lock_timeout = '5s'`.execute(trx);
    await sql`SET LOCAL statement_timeout = '30s'`.execute(trx);
    const companies = await trx.selectFrom('core.companies').select('id').orderBy('id').limit(2).execute();
    if (companies.length !== 2) throw new Error('Two seeded legal entities required');
    const dept = await trx.insertInto('core.departments').values({ name: `AUDIT34-${stamp}` }).returning('id').executeTakeFirstOrThrow();
    const employees: number[] = [];
    const users: number[] = [];
    for (const [i, roleCode] of ['hr_head', 'employee', 'employee', 'it_admin'].entries()) {
      const employee = await trx.insertInto('core.employees').values({
        ecode: `AUD34-${stamp}-${i}`, company_id: companies[i === 2 ? 1 : 0]!.id,
        first_name: `Audit ${i}`, status: 'active', department_id: i === 1 ? dept.id : null,
      }).returning('id').executeTakeFirstOrThrow();
      employees.push(employee.id);
      const user = await trx.insertInto('core.users').values({
        email: `audit34-${stamp}-${i}@hrms.test`, employee_id: employee.id,
        password_hash: 'disabled-fixture-no-password-login',
      }).returning('id').executeTakeFirstOrThrow();
      users.push(user.id);
      fixtureUserIds.push(user.id);
      const role = await trx.selectFrom('core.roles').select('id').where('code', '=', roleCode).executeTakeFirstOrThrow();
      await trx.insertInto('core.user_roles').values({ user_id: user.id, role_id: role.id }).execute();
    }
    const tokens = await Promise.all(users.map(id => signAccessToken(id, 'audit-fixture@hrms.test', secret)));
    const server = createServer(createApp({ db: trx, jwtSecret: secret, secureCookies: false }));
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing loopback port');
    const base = `http://127.0.0.1:${address.port}/api`;
    async function request(actor: number, method: string, path: string, body?: unknown): Promise<{ status: number; body: unknown }> {
      const response = await fetch(`${base}${path}`, { method, headers: {
        Authorization: `Bearer ${tokens[actor]}`, 'Content-Type': 'application/json',
      }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, body: await response.json() };
    }
    function idOf(response: { status: number; body: unknown }): number {
      const id = (response.body as { id?: number }).id;
      if (response.status !== 200 || !id) throw new Error(`Fixture creation failed (${response.status})`);
      return id;
    }
    try {
      const audience = { companyIds: [companies[0]!.id] };
      const announcementId = idOf(await request(0, 'POST', '/engagement/announcements', { title: `Audit private entity ${stamp}`, body: 'Entity restricted fixture', audience }));
      const feed = await request(2, 'GET', '/engagement/announcements');
      const outsideSaw = Array.isArray(feed.body) && feed.body.some((row: { id: number }) => row.id === announcementId);
      add('O01-announcement-company-audience', 'Other-company employee cannot see entity-targeted announcement', { httpStatus: feed.status, outsideSaw }, outsideSaw);
      const pollId = idOf(await request(0, 'POST', '/engagement/polls', { question: 'Entity fixture poll', options: ['Yes', 'No'], isAnonymous: true, audience }));
      const ballot = await request(2, 'POST', `/engagement/polls/${pollId}/respond`, { optionIndex: 0 });
      add('O01-poll-company-audience', 'Other-company employee cannot cast a ballot', { httpStatus: ballot.status }, ballot.status === 200);
      const entitySurveyId = idOf(await request(0, 'POST', '/engagement/surveys', { title: 'Entity fixture survey', questions: [{ id: 'q', prompt: 'Choice', type: 'choice', options: ['A', 'B'] }], isAnonymous: true, audience }));
      const surveyBallot = await request(2, 'POST', `/engagement/surveys/${entitySurveyId}/respond`, { answers: [{ questionId: 'q', answer: 'A' }] });
      add('O01-survey-company-audience', 'Other-company employee cannot answer targeted survey', { httpStatus: surveyBallot.status }, surveyBallot.status === 200);

      const duplicated = await request(0, 'POST', '/engagement/surveys', { title: 'Duplicate ids fixture', isAnonymous: true, questions: [
        { id: 'q', prompt: 'First question', type: 'choice', options: ['A', 'B'] },
        { id: 'q', prompt: 'Second question', type: 'text' },
      ] });
      add('O02-survey-duplicate-questions', 'Reject ambiguous duplicate question IDs before storing survey', { httpStatus: duplicated.status }, duplicated.status === 200);
      const invalidId = idOf(await request(0, 'POST', '/engagement/surveys', { title: 'Invalid choice fixture', isAnonymous: true, questions: [{ id: 'q', prompt: 'Choice', type: 'choice', options: ['A', 'B'], required: true }] }));
      const invalid = await request(1, 'POST', `/engagement/surveys/${invalidId}/respond`, { answers: [{ questionId: 'q', answer: 'NOT_A_PUBLISHED_OPTION' }] });
      const invalidResults = await request(0, 'GET', `/engagement/surveys/${invalidId}/results`);
      add('O03-survey-invalid-choice', 'Reject choice absent from the published options; do not add a phantom result option', { responseStatus: invalid.status, results: invalidResults.body }, invalid.status === 200);
      const duplicateId = idOf(await request(0, 'POST', '/engagement/surveys', { title: 'Duplicate answers fixture', isAnonymous: true, questions: [{ id: 'q', prompt: 'Choice', type: 'choice', options: ['A', 'B'] }] }));
      const duplicate = await request(1, 'POST', `/engagement/surveys/${duplicateId}/respond`, { answers: [{ questionId: 'q', answer: 'A' }, { questionId: 'q', answer: 'B' }] });
      const duplicateResults = await request(0, 'GET', `/engagement/surveys/${duplicateId}/results`);
      add('O03-survey-duplicate-answers', 'Reject two answers to the same single-valued question', { responseStatus: duplicate.status, results: duplicateResults.body }, duplicate.status === 200);
      const typeId = idOf(await request(0, 'POST', '/engagement/surveys', { title: 'Wrong rating type fixture', isAnonymous: true, questions: [{ id: 'q', prompt: 'Rating', type: 'rating', required: true }] }));
      const wrongType = await request(1, 'POST', `/engagement/surveys/${typeId}/respond`, { answers: [{ questionId: 'q', answer: 'banana' }] });
      const wrongTypeResults = await request(0, 'GET', `/engagement/surveys/${typeId}/results`);
      add('O03-survey-answer-type', 'Reject nonnumeric response to rating question before it is counted', { responseStatus: wrongType.status, results: wrongTypeResults.body }, wrongType.status === 200);
      const unknownId = idOf(await request(0, 'POST', '/engagement/surveys', { title: 'Unknown question fixture', isAnonymous: true, questions: [{ id: 'q', prompt: 'Optional feedback', type: 'text', required: false }] }));
      const unknown = await request(1, 'POST', `/engagement/surveys/${unknownId}/respond`, { answers: [{ questionId: 'ghost', answer: 'Not a real question' }] });
      const unknownResults = await request(0, 'GET', `/engagement/surveys/${unknownId}/results`);
      add('O03-survey-unknown-question', 'Reject unknown question IDs; no fake participation record', { responseStatus: unknown.status, results: unknownResults.body }, unknown.status === 200);

      const uiChoice = await request(0, 'POST', '/engagement/surveys', { title: 'Frontend choices payload', isAnonymous: true, questions: [{ id: 'q', prompt: 'Choice', type: 'choice', choices: ['A', 'B'] }] });
      add('O11-survey-screen-create-contract', 'Frontend choice-survey payload must match the backend options contract', { httpStatus: uiChoice.status, error: uiChoice.body }, uiChoice.status === 400);
      const uiAnswer = await request(2, 'POST', `/engagement/surveys/${invalidId}/respond`, { answers: { q: 'A' } });
      add('O11-survey-screen-submit-contract', 'Frontend answer object must match backend array of questionId/answer records', { httpStatus: uiAnswer.status }, uiAnswer.status === 400);
      const wireResult = invalidResults.body as { questions: unknown[]; questionResults?: unknown[] };
      add('O11-survey-screen-result-contract', 'Survey result screen requires fields returned by the actual API', { hasQuestions: Array.isArray(wireResult.questions), hasQuestionResults: Array.isArray(wireResult.questionResults), renderingMapWouldThrow: wireResult.questionResults === undefined }, Array.isArray(wireResult.questions) && wireResult.questionResults === undefined);

      const policyId = idOf(await request(0, 'POST', '/policies', { title: `Audit restricted policy ${stamp}`, effectiveDate: '2026-10-01', bodySummary: 'Restricted policy fixture', requiresAcknowledgment: true, audience: { departmentIds: [dept.id] } }));
      const content = await request(2, 'GET', `/policies/${policyId}/content`);
      const outsideAck = await request(2, 'POST', `/policies/${policyId}/ack`, {});
      await request(1, 'POST', `/policies/${policyId}/ack`, {});
      const tile = (await policyAckStatus(trx)).find(row => row.id === policyId);
      const report = await policyAckReport(trx, { policyId });
      add('O04-policy-audience-content', 'Outside-target employee cannot read restricted policy by guessing ID', { httpStatus: content.status }, content.status === 200);
      add('O04-policy-audience-ack-tile', 'Only eligible audience can acknowledge; tile and detail population agree', { outsideAckStatus: outsideAck.status, tile, reportRows: report.length }, outsideAck.status === 200 && tile?.pct === 200 && report.length === 1);

      const payrollCategory = await trx.selectFrom('hd.categories').select(['id', 'assignee_role_code']).where('code', '=', 'payroll').executeTakeFirstOrThrow();
      const insertTicket = async (suffix: string, closed = false) => trx.insertInto('hd.tickets').values({
        ticket_no: `AUDIT-${stamp}-${suffix}`, raised_by: users[1]!, category_id: payrollCategory.id,
        subject: 'Private payroll ticket fixture', body: 'Not an IT-category ticket',
        status: closed ? 'resolved' : 'open', sla_due_at: sql<Date>`now() - interval '1 hour'`,
        ...(closed ? { resolution: 'Original timely resolution', resolved_at: sql<Date>`now() - interval '2 hours'`, created_at: sql<Date>`now() - interval '3 hours'` } : {}),
      }).returning('id').executeTakeFirstOrThrow();
      const ticket = await insertTicket('private');
      await trx.insertInto('hd.ticket_messages').values({ ticket_id: ticket.id, author_user_id: users[0]!, body: 'Internal payroll-only fixture note', is_internal: true }).execute();
      const internal = await request(3, 'GET', `/helpdesk/tickets/${ticket.id}/thread`);
      const leakedInternal = Array.isArray(internal.body) && internal.body.some((row: { isInternal: boolean }) => row.isInternal);
      const crossReply = await request(3, 'POST', `/helpdesk/tickets/${ticket.id}/reply`, { body: 'IT actor modifies payroll ticket', isInternal: true });
      const crossStatus = await request(3, 'POST', `/helpdesk/tickets/${ticket.id}/status`, { status: 'resolved', resolution: 'Out-of-category actor resolved' });
      add('O05-helpdesk-category-scope', 'IT category agent cannot read payroll internal notes, reply, or resolve payroll tickets', { categoryRole: payrollCategory.assignee_role_code, threadStatus: internal.status, leakedInternal, replyStatus: crossReply.status, statusMutation: crossStatus.status }, leakedInternal && crossStatus.status === 200);
      const unrelatedThread = await request(2, 'GET', `/helpdesk/tickets/${ticket.id}/thread`);
      controls.push({ id: 'unrelated-ordinary-employee-refused', passed: unrelatedThread.status === 403, observed: { httpStatus: unrelatedThread.status } });
      const ownThread = await request(1, 'GET', `/helpdesk/tickets/${ticket.id}/thread`);
      const seesInternal = Array.isArray(ownThread.body) && ownThread.body.some((row: { isInternal: boolean }) => row.isInternal);
      controls.push({ id: 'owner-cannot-read-internal-notes', passed: ownThread.status === 200 && !seesInternal, observed: { httpStatus: ownThread.status, seesInternal } });
      await sql`SAVEPOINT duplicate_vote_control`.execute(trx);
      const duplicateVote = await request(2, 'POST', `/engagement/polls/${pollId}/respond`, { optionIndex: 1 });
      await sql`ROLLBACK TO SAVEPOINT duplicate_vote_control`.execute(trx);
      controls.push({ id: 'anonymous-poll-deduplication-retained', passed: duplicateVote.status === 400, observed: { httpStatus: duplicateVote.status } });
      const anon = await trx.selectFrom('eng.survey_responses').select(['respondent_user_id', 'respondent_hash']).where('survey_id', '=', invalidId).executeTakeFirstOrThrow();
      controls.push({ id: 'anonymous-survey-has-no-user-id', passed: anon.respondent_user_id === null && anon.respondent_hash !== null, observed: { hasUserId: anon.respondent_user_id !== null, hasHash: anon.respondent_hash !== null } });
      const reopenTicket = await insertTicket('reopen', true);
      const bypass = await request(0, 'POST', `/helpdesk/tickets/${reopenTicket.id}/status`, { status: 'pending' });
      const reopened = await trx.selectFrom('hd.tickets').select(['status', 'reopen_count', 'resolution', 'resolved_at']).where('id', '=', reopenTicket.id).executeTakeFirstOrThrow();
      add('O06-helpdesk-reopen-bypass', 'A resolved-to-active transition requires a reason and records a reopening', { httpStatus: bypass.status, row: reopened }, bypass.status === 200 && reopened.reopen_count === 0 && reopened.resolved_at === null);
      const closeTicket = await insertTicket('close', true);
      const close = await request(0, 'POST', `/helpdesk/tickets/${closeTicket.id}/status`, { status: 'closed', resolution: 'Administrative closure' });
      const late = await trx.selectFrom('hd.tickets').select(sql<boolean>`resolved_at > sla_due_at`.as('now_late')).where('id', '=', closeTicket.id).executeTakeFirstOrThrow();
      add('O07-helpdesk-resolution-time-rewrite', 'Closing an already resolved ticket preserves its original resolution time and SLA outcome', { httpStatus: close.status, changedTimelyToLate: late.now_late }, close.status === 200 && late.now_late);
      const noteTicket = await insertTicket('internal');
      await request(0, 'POST', `/helpdesk/tickets/${noteTicket.id}/reply`, { body: 'Private investigation only', isInternal: true });
      const noteRow = await trx.selectFrom('hd.tickets').select(['first_response_at', 'status']).where('id', '=', noteTicket.id).executeTakeFirstOrThrow();
      const ownerThread = await request(1, 'GET', `/helpdesk/tickets/${noteTicket.id}/thread`);
      add('O08-helpdesk-private-note-first-response', 'Customer first response metrics should not claim a reply that the customer cannot see', { firstResponseStamped: noteRow.first_response_at !== null, ownerVisibleMessages: Array.isArray(ownerThread.body) ? ownerThread.body.length : null }, noteRow.first_response_at !== null && Array.isArray(ownerThread.body) && ownerThread.body.length === 0);

      const month = new Date().toISOString().slice(0, 7);
      const performance = await request(0, 'GET', `/helpdesk/performance?month=${month}`);
      const perfRows = performance.body as { categoryCode: string; resolutionRatePct: number; resolutionRatePercent?: number }[];
      const payrollPerf = perfRows.find(row => row.categoryCode === 'payroll');
      add('O12-helpdesk-screen-performance-contract', 'Performance screen must use the API resolutionRatePct property', { httpStatus: performance.status, apiField: payrollPerf?.resolutionRatePct, hasFrontendExpectedField: payrollPerf?.resolutionRatePercent !== undefined, toFixedWouldThrow: payrollPerf !== undefined && payrollPerf.resolutionRatePercent === undefined }, payrollPerf !== undefined && payrollPerf.resolutionRatePercent === undefined);

      await Promise.all([recordLoginFailure(trx, users[2]!, 0), recordLoginFailure(trx, users[2]!, 0)]);
      const loginRow = await trx.selectFrom('core.users').select('failed_attempts').where('id', '=', users[2]!).executeTakeFirstOrThrow();
      add('O09-auth-lost-failure-increment', 'Two failure writes based on the same initial state must count two failed attempts', { failuresWritten: 2, stored: loginRow.failed_attempts }, loginRow.failed_attempts === 1);
      const oldToken = await signRefreshToken(users[2]!, 'audit-fixture@hrms.test', secret);
      const firstRefresh = await refresh(trx, secret, oldToken);
      const replayRefresh = await refresh(trx, secret, oldToken);
      add('O10-auth-refresh-replay', 'Tracked follow-up: stated rotation has no consumed-token invalidation; signed revocation policy is still required', { firstAccepted: firstRefresh.ok, reusedOriginalAccepted: replayRefresh.ok }, firstRefresh.ok && replayRefresh.ok);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
    throw sentinel;
  });
} catch (error) {
  if (error !== sentinel) throw error;
} finally {
  await db.destroy();
}
const checkDb = createDatabase(target);
let cleanup;
try {
  const count = async (table: 'core.users' | 'core.employees' | 'core.departments' | 'hd.tickets', column: string, prefix: string) => {
    const result = await sql<{ n: string }>`SELECT count(*) AS n FROM ${sql.table(table)} WHERE ${sql.ref(column)} LIKE ${prefix}`.execute(checkDb);
    return Number(result.rows[0]?.n ?? -1);
  };
  const audit = await checkDb.selectFrom('core.audit_log').select(({ fn }) => fn.countAll<string>().as('n')).where('actor_user_id', 'in', fixtureUserIds).executeTakeFirstOrThrow();
  cleanup = { users: await count('core.users', 'email', `audit34-${stamp}-%`), employees: await count('core.employees', 'ecode', `AUD34-${stamp}-%`), departments: await count('core.departments', 'name', `AUDIT34-${stamp}`), tickets: await count('hd.tickets', 'ticket_no', `AUDIT-${stamp}-%`), auditRows: Number(audit.n) };
} finally { await checkDb.destroy(); }
const report = { cleanup, observedAt: new Date().toISOString(), database: 'loopback/hrms (test only)', fixtureMode: 'one native PostgreSQL transaction, intentionally rolled back; sequence allocation may advance', applicationCodeModified: false, probes, controls };
await writeFile(new URL('./native-results.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(JSON.stringify({ probes: probes.length, observationsReproduced: probes.filter(p => p.reproduced).length, controlsPassed: controls.filter(c => c.passed).length, cleanup, rolledBack: true }) + '\n');
if (Object.values(cleanup).some(n => n !== 0) || controls.some(c => !c.passed)) throw new Error('Audit control or rollback verification failed');
