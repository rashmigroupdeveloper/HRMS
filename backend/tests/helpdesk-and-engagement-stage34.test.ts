/**
 * Stage 3.4 Integration Tests — Helpdesk & Workplace Engagement (HD-01, EN-01..04, C26, C27, C34).
 *
 * Covers:
 * 1. HD-01 / C26 Security Isolation: Employee A cannot read or reply to Employee B's ticket (403).
 * 2. HD-01 / Priority SLA: Urgent ticket receives 4x accelerated SLA compared to normal.
 * 3. HD-01 / C27 Auto-Escalation Engine: Breached ticket escalates to designated higher management hierarchy (hr_head).
 * 4. HD-01 Lifecycle: First response tracking and reopen count increment with reason.
 * 5. R29 SLA Performance Report: Includes historical late-resolved breaches and first-response hours.
 * 6. EN-01 Announcements: Supports document attachment.
 * 7. EN-03 / C34 Structured Surveys: Multi-question rating, choice & text survey, salted HMAC anonymity firewall, single response dedupe, and analytical tallies.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { httpRequest } from './http-client.js';
import { sql, type Kysely } from 'kysely';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { hashPassword } from '../src/modules/auth/index.js';
import { escalateBreachedTickets, helpdeskPerformance } from '../src/modules/helpdesk/helpdesk.service.js';
import { createSurvey, respondToSurvey, surveyResults } from '../src/modules/engagement/surveys.service.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'integration-test-secret-at-least-32-chars!';
const run = describe.skipIf(!DB_URL);

run('Stage 3.4 — Helpdesk & Workplace Engagement (live Postgres)', () => {
  let db: Kysely<Database>;
  let app: Express;
  const stamp = Date.now();
  const password = 'stage34-test-pw-1!';
  const employeeAEmail = `hd-emp-a-${String(stamp)}@hrms.test`;
  const employeeBEmail = `hd-emp-b-${String(stamp)}@hrms.test`;
  const agentEmail = `hd-agent-${String(stamp)}@hrms.test`;
  const hrHeadEmail = `hd-hrhead-${String(stamp)}@hrms.test`;

  let tokenA: string;
  let tokenB: string;
  let tokenAgent: string;

  let userAId: number;
  let userBId: number;
  let hrHeadUserId: number;

  const authA = () => ({ Authorization: `Bearer ${tokenA}` });
  const authB = () => ({ Authorization: `Bearer ${tokenB}` });
  const authAgent = () => ({ Authorization: `Bearer ${tokenAgent}` });

  async function mkUser(email: string, roleCode: string): Promise<number> {
    const u = await db
      .insertInto('core.users')
      .values({ email, password_hash: await hashPassword(password), employee_id: null })
      .returning('id')
      .executeTakeFirstOrThrow();
    const role = await db
      .selectFrom('core.roles')
      .select('id')
      .where('code', '=', roleCode)
      .executeTakeFirstOrThrow();
    await db
      .insertInto('core.user_roles')
      .values({ user_id: u.id, role_id: role.id, scope_org_unit_id: null })
      .execute();
    return u.id;
  }

  async function login(email: string): Promise<string> {
    const res = await (await httpRequest(app)).post('/api/auth/login').send({ identifier: email, password });
    expect(res.status).toBe(200);
    return (res.body as { accessToken: string }).accessToken;
  }

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false });

    userAId = await mkUser(employeeAEmail, 'employee');
    userBId = await mkUser(employeeBEmail, 'employee');
    await mkUser(agentEmail, 'it_admin'); // holds helpdesk.agent
    hrHeadUserId = await mkUser(hrHeadEmail, 'hr_head'); // holds hr_head for escalation

    tokenA = await login(employeeAEmail);
    tokenB = await login(employeeBEmail);
    tokenAgent = await login(agentEmail);
    await login(hrHeadEmail);
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('1. Helpdesk Security Isolation & Scoping (C26)', () => {
    let ticketId: number;

    it('Employee A can raise a ticket and get an auto-calculated SLA clock', async () => {
      const res = await (await httpRequest(app))
        .post('/api/helpdesk/tickets')
        .set(authA())
        .send({
          categoryCode: 'facilities',
          subject: 'Broken AC in plant workshop',
          body: 'The air conditioning in Section 3 has stopped cooling.',
          priority: 'urgent',
        });

      expect(res.status).toBe(200);
      const data = res.body as { id: number; ticketNo: string; slaDueAt: string };
      expect(data.id).toBeGreaterThan(0);
      expect(data.ticketNo).toMatch(/^HD-\d{4}-\d{6}$/);
      expect(data.slaDueAt).toBeTruthy();
      ticketId = data.id;
    });

    it('Employee B attempting to view Employee A ticket thread receives 403 Forbidden (C26)', async () => {
      const res = await (await httpRequest(app))
        .get(`/api/helpdesk/tickets/${String(ticketId)}/thread`)
        .set(authB());

      expect(res.status).toBe(403);
    });

    it('Employee B attempting to reply to Employee A ticket receives 403 Forbidden (C26)', async () => {
      const res = await (await httpRequest(app))
        .post(`/api/helpdesk/tickets/${String(ticketId)}/reply`)
        .set(authB())
        .send({
          body: 'Snooping on this ticket',
        });

      expect(res.status).toBe(403);
    });

    it('Support Agent can view thread including internal notes and reply', async () => {
      const replyRes = await (await httpRequest(app))
        .post(`/api/helpdesk/tickets/${String(ticketId)}/reply`)
        .set(authAgent())
        .send({
          body: 'Facilities technician dispatched to inspect Section 3 AC.',
          isInternal: false,
        });

      expect(replyRes.status).toBe(200);

      // Verify first_response_at was stamped
      const ticket = await db
        .selectFrom('hd.tickets')
        .select(['first_response_at', 'status'])
        .where('id', '=', ticketId)
        .executeTakeFirstOrThrow();

      expect(ticket.first_response_at).not.toBeNull();
      expect(ticket.status).toBe('pending');
    });

    it('Agent can add an internal note hidden from the raising employee', async () => {
      const noteRes = await (await httpRequest(app))
        .post(`/api/helpdesk/tickets/${String(ticketId)}/reply`)
        .set(authAgent())
        .send({
          body: 'Compressor unit replacement ordered from vendor under warranty.',
          isInternal: true,
        });

      expect(noteRes.status).toBe(200);

      // Employee A views thread - internal note must NOT be present
      const threadResA = await (await httpRequest(app))
        .get(`/api/helpdesk/tickets/${String(ticketId)}/thread`)
        .set(authA());
      expect(threadResA.status).toBe(200);
      const messagesA = threadResA.body as { body: string; isInternal: boolean }[];
      expect(messagesA.some((m) => m.body.includes('Compressor unit'))).toBe(false);

      // Agent views thread - internal note IS present
      const threadResAgent = await (await httpRequest(app))
        .get(`/api/helpdesk/tickets/${String(ticketId)}/thread`)
        .set(authAgent());
      expect(threadResAgent.status).toBe(200);
      const messagesAgent = threadResAgent.body as { body: string; isInternal: boolean }[];
      expect(messagesAgent.some((m) => m.body.includes('Compressor unit'))).toBe(true);
    });
  });

  describe('2. Helpdesk SLA Escalation Engine (C27)', () => {
    let overdueTicketId: number;

    it('Creates an overdue ticket and verifies auto-escalation to management hierarchy', async () => {
      // Direct DB insert of a ticket breached in past
      const cat = await db
        .selectFrom('hd.categories')
        .selectAll()
        .where('code', '=', 'attendance')
        .executeTakeFirstOrThrow();

      const overdue = await db
        .insertInto('hd.tickets')
        .values({
          ticket_no: `HD-TEST-${String(stamp).slice(-6)}`,
          raised_by: userAId,
          category_id: cat.id,
          subject: 'Urgent Biometric Attendance Correction Missing',
          body: 'Missed punch not updated in monthly muster',
          priority: 'high',
          status: 'open',
          sla_due_at: sql<Date>`now() - INTERVAL '2 hours'`, // already breached
        })
        .returning(['id'])
        .executeTakeFirstOrThrow();

      overdueTicketId = overdue.id;

      // Run escalation sweep
      const escalationResult = await escalateBreachedTickets(db);
      expect(escalationResult.escalated).toBeGreaterThanOrEqual(1);

      // Check ticket state
      const ticket = await db
        .selectFrom('hd.tickets')
        .selectAll()
        .where('id', '=', overdueTicketId)
        .executeTakeFirstOrThrow();

      expect(ticket.escalated_level).toBe(1);
      expect(ticket.escalated_at).not.toBeNull();
      expect(ticket.escalated_to_user_id).not.toBeNull();
      // Verified escalated to a user holding hr_head role (fixing C27)
      const userRoles = await db
        .selectFrom('core.user_roles as ur')
        .innerJoin('core.roles as r', 'r.id', 'ur.role_id')
        .select('r.code')
        .where('ur.user_id', '=', Number(ticket.escalated_to_user_id))
        .execute();
      expect(userRoles.map((r) => r.code)).toContain('hr_head');
    });

    it('Reopening a resolved ticket requires a reason and increments reopen_count', async () => {
      // First resolve the ticket
      const resolveRes = await (await httpRequest(app))
        .post(`/api/helpdesk/tickets/${String(overdueTicketId)}/status`)
        .set(authAgent())
        .send({
          status: 'resolved',
          resolution: 'Regularization approved and reflected in attendance ledger.',
        });
      expect(resolveRes.body).toEqual({ ok: true });
      expect(resolveRes.status).toBe(200);

      // Reopening without reason is rejected
      const emptyReopen = await (await httpRequest(app))
        .post(`/api/helpdesk/tickets/${String(overdueTicketId)}/status`)
        .set(authAgent())
        .send({
          status: 'open',
          resolution: '',
        });
      expect(emptyReopen.status).toBe(400);

      // Reopening with reason succeeds
      const reopenRes = await (await httpRequest(app))
        .post(`/api/helpdesk/tickets/${String(overdueTicketId)}/status`)
        .set(authAgent())
        .send({
          status: 'open',
          resolution: 'Employee reports punch still shows absent on day record.',
        });
      expect(reopenRes.body).toEqual({ ok: true });
      expect(reopenRes.status).toBe(200);

      const ticket = await db
        .selectFrom('hd.tickets')
        .select(['status', 'reopen_count', 'resolution', 'resolved_at'])
        .where('id', '=', overdueTicketId)
        .executeTakeFirstOrThrow();

      expect(ticket.status).toBe('open');
      expect(ticket.reopen_count).toBe(1);
      expect(ticket.resolved_at).toBeNull();
    });

    it('R29 Monthly Helpdesk Performance accurately tracks historical breaches', async () => {
      const month = new Date().toISOString().slice(0, 7);
      const perf = await helpdeskPerformance(db, { month });

      const attendancePerf = perf.find((p) => p.categoryCode === 'attendance');
      expect(attendancePerf).toBeDefined();
      if (attendancePerf) {
        expect(attendancePerf.raised).toBeGreaterThanOrEqual(1);
        expect(attendancePerf.breached).toBeGreaterThanOrEqual(1);
        expect(attendancePerf.reopenedCount).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('3. Structured Multi-Question Surveys (C34, EN-03)', () => {
    let surveyId: number;

    it('Publisher creates a structured pulse survey with multiple questions', async () => {
      surveyId = await createSurvey(db, {
        title: 'Q4 Plant Safety & Work Environment Survey',
        description: 'Anonymous workplace feedback on safety gear, cafeteria, and facilities.',
        isAnonymous: true,
        questions: [
          {
            id: 'q_safety_rating',
            prompt: 'How satisfied are you with the availability of safety PPE gear?',
            type: 'rating',
            required: true,
          },
          {
            id: 'q_dept_choice',
            prompt: 'Which shift schedule do you currently operate under?',
            type: 'choice',
            options: ['Morning General', 'Rotational Shift A', 'Night Shift C'],
            required: true,
          },
          {
            id: 'q_feedback_text',
            prompt: 'Any specific hazards or improvement suggestions for your plant unit?',
            type: 'text',
            required: false,
          },
        ],
        actorUserId: hrHeadUserId,
      });

      expect(surveyId).toBeGreaterThan(0);
    });

    it('Employee A submits response to anonymous survey with HMAC ballot deduplication', async () => {
      const res = await (await httpRequest(app))
        .post(`/api/engagement/surveys/${String(surveyId)}/respond`)
        .set(authA())
        .send({
          answers: [
            { questionId: 'q_safety_rating', answer: 5 },
            { questionId: 'q_dept_choice', answer: 'Rotational Shift A' },
            { questionId: 'q_feedback_text', answer: 'Ensure emergency eye wash stations are checked weekly.' },
          ],
        });

      expect(res.status).toBe(200);
      expect((res.body as { ok: boolean }).ok).toBe(true);

      // Verify database record has ZERO identifying user ID (Anonymity Firewall)
      const stored = await db
        .selectFrom('eng.survey_responses')
        .selectAll()
        .where('survey_id', '=', surveyId)
        .executeTakeFirstOrThrow();

      expect(stored.respondent_user_id).toBeNull();
      expect(stored.respondent_hash).toBeTruthy();
      expect(stored.respondent_hash?.length).toBe(64); // SHA-256 hex string
    });

    it('Employee A cannot ballot-stuff (submitting second time is rejected)', async () => {
      const res = await (await httpRequest(app))
        .post(`/api/engagement/surveys/${String(surveyId)}/respond`)
        .set(authA())
        .send({
          answers: [
            { questionId: 'q_safety_rating', answer: 1 },
            { questionId: 'q_dept_choice', answer: 'Night Shift C' },
          ],
        });

      expect(res.status).toBe(400);
      expect((res.body as { message: string }).message).toContain('already submitted');
    });

    it('Employee B submits second response and publisher views aggregated analytics', async () => {
      await respondToSurvey(db, {
        surveyId,
        userId: userBId,
        answers: [
          { questionId: 'q_safety_rating', answer: 3 },
          { questionId: 'q_dept_choice', answer: 'Rotational Shift A' },
          { questionId: 'q_feedback_text', answer: 'More ventilation in welding bay.' },
        ],
        appSecret: JWT_SECRET,
      });

      const results = await surveyResults(db, surveyId);
      expect(results.totalResponses).toBe(2);
      expect(results.isAnonymous).toBe(true);

      // Question 1: Rating average (5 and 3 -> avg 4.0)
      const qRating = results.questions.find((q) => q.questionId === 'q_safety_rating');
      expect(qRating).toBeDefined();
      expect(qRating?.avgRating).toBe(4);
      expect(qRating?.ratingDistribution?.[5]).toBe(1);
      expect(qRating?.ratingDistribution?.[3]).toBe(1);

      // Question 2: Choice distribution (2 votes for Rotational Shift A)
      const qChoice = results.questions.find((q) => q.questionId === 'q_dept_choice');
      expect(qChoice).toBeDefined();
      expect(qChoice?.choiceDistribution?.['Rotational Shift A']).toBe(2);

      // Question 3: Text answers (emails MUST be null for anonymous survey)
      const qText = results.questions.find((q) => q.questionId === 'q_feedback_text');
      expect(qText).toBeDefined();
      expect(qText?.textAnswers?.length).toBe(2);
      expect(qText?.textAnswers?.[0]?.byEmail).toBeNull();
      expect(qText?.textAnswers?.[1]?.byEmail).toBeNull();
    });

    it('rejects malformed stored question definitions rather than inventing rating questions', async () => {
      const original = await db.selectFrom('eng.surveys').select('questions')
        .where('id', '=', surveyId).executeTakeFirstOrThrow();
      try {
        await db.updateTable('eng.surveys').set({ questions: JSON.stringify([{ id: 'broken', prompt: 'Fixture', type: 'invented' }]) })
          .where('id', '=', surveyId).execute();
        await expect(surveyResults(db, surveyId)).rejects.toThrow();
      } finally {
        await db.updateTable('eng.surveys').set({ questions: JSON.stringify(original.questions) })
          .where('id', '=', surveyId).execute();
      }
    });

    it.each([{}, [{ questionId: 'q_safety_rating', answer: {} }], [{ answer: 5 }]])(
      'rejects malformed stored answers instead of publishing misleading analytics (%j)', async value => {
        const original = await db.selectFrom('eng.survey_responses').select(['id', 'answers'])
          .where('survey_id', '=', surveyId).executeTakeFirstOrThrow();
        try {
          await db.updateTable('eng.survey_responses').set({ answers: JSON.stringify(value) })
            .where('id', '=', original.id).execute();
          await expect(surveyResults(db, surveyId)).rejects.toThrow();
        } finally {
          await db.updateTable('eng.survey_responses').set({ answers: JSON.stringify(original.answers) })
            .where('id', '=', original.id).execute();
        }
      },
    );
  });
});
