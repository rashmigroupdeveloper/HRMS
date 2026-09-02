/**
 * M9 Helpdesk — HD-01 / SOW-9 (live Postgres).
 *
 * H1 raising a ticket sets an SLA clock FROM THE CATEGORY and auto-acknowledges
 *    (a ticket without a deadline has no owner — SOW-9.2).
 * H2 routing assigns by category role, resolved through RBAC not hardcoded.
 * H3 the thread is append-only at the DATABASE (SOW-9.4 "query logs for audit"),
 *    and internal notes are hidden from the raiser.
 * H4 a ticket cannot be resolved without saying how.
 * H5 the escalation sweep raises breached tickets and is idempotent per window.
 * H6 anyone signed in may raise; only an agent may work the queue.
 * H7 the "HRMS platform" category is live from day one (docs/07 §4b).
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { sql, type Kysely } from 'kysely';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { hashPassword } from '../src/modules/auth/index.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'integration-test-secret-at-least-32-chars!';
const run = describe.skipIf(!DB_URL);

interface Ticket {
  id: number;
  ticketNo: string;
  slaDueAt: string;
}
interface TicketRow {
  id: number;
  ticketNo: string;
  status: string;
  breached: boolean;
  escalatedLevel: number;
  assigneeEmail: string | null;
  acknowledgedAt: string | null;
}
interface Message {
  body: string;
  isInternal: boolean;
}

run('M9 Helpdesk — HD-01 (live Postgres)', () => {
  let db: Kysely<Database>;
  let app: Express;
  const stamp = Date.now();
  const password = 'helpdesk-pw-1!';
  const agentEmail = `hd-agent-${String(stamp)}@hrms.test`;
  const staffEmail = `hd-staff-${String(stamp)}@hrms.test`;
  let agentToken: string;
  let staffToken: string;
  const ticketIds: number[] = [];

  const asAgent = () => ({ Authorization: `Bearer ${agentToken}` });
  const asStaff = () => ({ Authorization: `Bearer ${staffToken}` });

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
    const res = await request(app).post('/api/auth/login').send({ identifier: email, password });
    expect(res.status).toBe(200);
    return (res.body as { accessToken: string }).accessToken;
  }

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false });
    // it_admin holds helpdesk.agent per the docs/08 §2 grid; a plain employee does not.
    await mkUser(agentEmail, 'it_admin');
    await mkUser(staffEmail, 'employee');
    agentToken = await login(agentEmail);
    staffToken = await login(staffEmail);
  });

  afterAll(async () => {
    // `hd.ticket_messages` is append-only by DB trigger (SOW-9.4), so it
    // rejects DELETE as well as UPDATE — exactly like core.audit_log. Per the
    // repo convention (CLAUDE.md §6: "tests deactivate + detach, never
    // delete"), threaded tickets are CLOSED and left in place; only tickets
    // that never got a message are removed. A test that could wipe the audit
    // thread would be testing a weaker guarantee than the one we ship.
    if (ticketIds.length > 0) {
      const threaded = await db
        .selectFrom('hd.ticket_messages')
        .select('ticket_id')
        .distinct()
        .where('ticket_id', 'in', ticketIds)
        .execute();
      const keep = new Set(threaded.map((t) => t.ticket_id));
      const deletable = ticketIds.filter((id) => !keep.has(id));

      if (keep.size > 0) {
        await db
          .updateTable('hd.tickets')
          .set({ status: 'closed', resolution: 'test teardown', resolved_at: new Date() })
          .where('id', 'in', [...keep])
          .execute();
      }
      if (deletable.length > 0) {
        await db.deleteFrom('hd.tickets').where('id', 'in', deletable).execute();
      }
    }
    await db
      .updateTable('core.users')
      .set({ is_active: false })
      .where('email', 'in', [agentEmail, staffEmail])
      .execute();
    await db.destroy();
  });

  async function raise(category: string, subject: string): Promise<Ticket> {
    const res = await request(app)
      .post('/api/helpdesk/tickets')
      .set(asStaff())
      .send({ categoryCode: category, subject, body: 'Details of the issue.' });
    expect(res.status).toBe(200);
    const t = res.body as Ticket;
    ticketIds.push(t.id);
    return t;
  }

  it('H7 ships the "HRMS platform" category live from day one (docs/07 §4b)', async () => {
    const res = await request(app).get('/api/helpdesk/categories').set(asStaff());
    expect(res.status).toBe(200);
    const codes = (res.body as { code: string }[]).map((c) => c.code);
    // The rollout needs a supported channel for its OWN bugs, or feedback
    // arrives as corridor complaints and never gets fixed.
    expect(codes).toContain('hrms');
    expect(codes).toContain('payroll');
  });

  it('H1 sets the SLA clock from the category and auto-acknowledges', async () => {
    const before = Date.now();
    const ticket = await raise('it', 'Laptop will not boot');

    expect(ticket.ticketNo).toMatch(/^HD-\d{4}-\d{6}$/);
    // The IT category is seeded at 8 hours — the clock must reflect the
    // CATEGORY, not a hardcoded default.
    const due = new Date(ticket.slaDueAt).getTime();
    const hours = (due - before) / 3_600_000;
    expect(hours).toBeGreaterThan(7.5);
    expect(hours).toBeLessThan(8.5);

    const mine = (await request(app).get('/api/helpdesk/tickets/mine').set(asStaff()))
      .body as { rows: TicketRow[] };
    const row = mine.rows.find((r) => r.id === ticket.id);
    expect(row?.acknowledgedAt).not.toBeNull();
  });

  it('H2 routes to the category role, resolved through RBAC', async () => {
    const ticket = await raise('it', 'Printer offline');
    const queue = (await request(app).get('/api/helpdesk/tickets?status=open').set(asAgent()))
      .body as { rows: TicketRow[] };
    const row = queue.rows.find((r) => r.id === ticket.id);
    // The IT category routes to it_admin; our agent holds that role.
    expect(row?.assigneeEmail).not.toBeNull();
  });

  it('H3 the thread is append-only in the DB, and internal notes are hidden from the raiser', async () => {
    const ticket = await raise('hrms', 'Muster column missing');

    await request(app)
      .post(`/api/helpdesk/tickets/${String(ticket.id)}/reply`)
      .set(asStaff())
      .send({ ticketId: ticket.id, body: 'Adding more detail.' });
    await request(app)
      .post(`/api/helpdesk/tickets/${String(ticket.id)}/reply`)
      .set(asAgent())
      .send({ ticketId: ticket.id, body: 'Internal: looks like a filter bug.', isInternal: true });

    const staffView = (
      await request(app).get(`/api/helpdesk/tickets/${String(ticket.id)}/thread`).set(asStaff())
    ).body as Message[];
    const agentView = (
      await request(app).get(`/api/helpdesk/tickets/${String(ticket.id)}/thread`).set(asAgent())
    ).body as Message[];

    expect(staffView.some((m) => m.isInternal)).toBe(false);
    expect(agentView.some((m) => m.isInternal)).toBe(true);

    // SOW-9.4: history cannot be rewritten, even by direct SQL.
    await expect(
      db
        .updateTable('hd.ticket_messages')
        .set({ body: 'tampered' })
        .where('ticket_id', '=', ticket.id)
        .execute(),
    ).rejects.toThrow(/append-only/i);
  });

  it('H4 refuses to resolve a ticket without saying how', async () => {
    const ticket = await raise('facilities', 'Broken chair');

    const noReason = await request(app)
      .post(`/api/helpdesk/tickets/${String(ticket.id)}/status`)
      .set(asAgent())
      .send({ ticketId: ticket.id, status: 'resolved' });
    expect(noReason.status).toBe(400);

    const withReason = await request(app)
      .post(`/api/helpdesk/tickets/${String(ticket.id)}/status`)
      .set(asAgent())
      .send({ ticketId: ticket.id, status: 'resolved', resolution: 'Chair replaced.' });
    expect(withReason.status).toBe(200);
  });

  it('H5 escalates breached tickets and does not double-escalate in the same window', async () => {
    const ticket = await raise('it', 'Escalation probe');
    // Push the clock into the past so the sweep sees a genuine breach.
    await db
      .updateTable('hd.tickets')
      .set({ sla_due_at: sql`now() - INTERVAL '3 hours'` })
      .where('id', '=', ticket.id)
      .execute();

    const first = await request(app).post('/api/helpdesk/escalate').set(asAgent());
    expect(first.status).toBe(200);
    expect((first.body as { escalated: number }).escalated).toBeGreaterThan(0);

    const queue = (await request(app).get('/api/helpdesk/tickets?breachedOnly=true').set(asAgent()))
      .body as { rows: TicketRow[] };
    const row = queue.rows.find((r) => r.id === ticket.id);
    expect(row?.breached).toBe(true);
    expect(row?.escalatedLevel).toBe(1);

    // Immediately re-running must NOT escalate the same ticket again.
    await request(app).post('/api/helpdesk/escalate').set(asAgent());
    const after = (await request(app).get('/api/helpdesk/tickets?breachedOnly=true').set(asAgent()))
      .body as { rows: TicketRow[] };
    expect(after.rows.find((r) => r.id === ticket.id)?.escalatedLevel).toBe(1);
  });

  it('H6 anyone may raise a ticket; only an agent may work the queue', async () => {
    // Raising is intentionally NOT permission-gated — see the router comment.
    const raised = await request(app)
      .post('/api/helpdesk/tickets')
      .set(asStaff())
      .send({ categoryCode: 'hrms', subject: 'Cannot see my payslip', body: 'It is blank.' });
    expect(raised.status).toBe(200);
    ticketIds.push((raised.body as Ticket).id);

    const queue = await request(app).get('/api/helpdesk/tickets').set(asStaff());
    expect(queue.status).toBe(403);

    const resolve = await request(app)
      .post(`/api/helpdesk/tickets/${String((raised.body as Ticket).id)}/status`)
      .set(asStaff())
      .send({ ticketId: (raised.body as Ticket).id, status: 'closed', resolution: 'x' });
    expect(resolve.status).toBe(403);
  });
});
