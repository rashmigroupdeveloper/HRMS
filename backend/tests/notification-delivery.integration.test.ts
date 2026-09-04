/**
 * NOTIFICATION DELIVERY, END TO END — regression net for docs/audit finding [A2].
 *
 * The audit's single most consequential functional finding: `processQueue` had
 * no production caller and the only transport logged instead of sending, so
 * every approval request, every 07:00 boarding/exit report and every OT digest
 * was written to `wf.notifications` and never delivered. PP-14 — *"Chaitanya Sir
 * has not received a single notification"* — reproduced by construction, in the
 * system built to prevent it.
 *
 * Two things are proven here, because fixing one without the other proves
 * nothing:
 *   1. the QUEUE drains — a queued row reaches `sent`, and a failing transport
 *      retries and then dead-letters rather than vanishing;
 *   2. the SMTP TRANSPORT actually puts a message on the wire — asserted
 *      against a real socket-level SMTP receiver, not a mock of one, so the
 *      only thing still outstanding for production is the host and credentials
 *      (sponsor decision D17).
 */
import 'dotenv/config';
import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { enqueue, processQueue, type NotificationTransport } from '../src/modules/notifications/index.js';
import { SmtpTransport } from '../src/modules/notifications/smtp.transport.js';

const DB_URL = process.env['DATABASE_URL'];
const run = describe.skipIf(!DB_URL);

/**
 * A minimal SMTP receiver — enough of RFC 5321 for a client to complete a
 * transaction. Deliberately a real TCP server rather than a stub of nodemailer:
 * a mocked transport would have passed happily throughout the period the system
 * was delivering nothing.
 */
function startSmtpSink(): Promise<{ port: number; messages: string[]; close: () => Promise<void> }> {
  const messages: string[] = [];
  const server = net.createServer((socket) => {
    let inData = false;
    let buffer = '';
    socket.write('220 sink ESMTP\r\n');
    socket.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      if (inData) {
        buffer += text;
        if (buffer.includes('\r\n.\r\n')) {
          messages.push(buffer);
          inData = false;
          buffer = '';
          socket.write('250 OK queued\r\n');
        }
        return;
      }
      for (const line of text.split('\r\n').filter(Boolean)) {
        const verb = line.slice(0, 4).toUpperCase();
        if (verb === 'EHLO' || verb === 'HELO') socket.write('250-sink\r\n250 SIZE 10485760\r\n');
        else if (verb === 'MAIL' || verb === 'RCPT') socket.write('250 OK\r\n');
        else if (verb === 'DATA') { inData = true; socket.write('354 End data with <CRLF>.<CRLF>\r\n'); }
        else if (verb === 'QUIT') { socket.write('221 Bye\r\n'); socket.end(); }
        else socket.write('250 OK\r\n');
      }
    });
    socket.on('error', () => { /* client hang-ups are normal here */ });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      resolve({
        port,
        messages,
        close: () => new Promise<void>((done) => { server.close(() => { done(); }); }),
      });
    });
  });
}

run('notification delivery (WF-02, finding A2)', () => {
  let db: Kysely<Database>;
  const stamp = Date.now();
  const recipient = `sink-${stamp}@hrms.invalid`;

  beforeAll(() => { db = createDatabase(DB_URL ?? ''); });
  afterAll(async () => {
    await db.deleteFrom('wf.notifications').where('recipient_email', 'like', `sink-%@hrms.invalid`).execute();
    await db.destroy();
  });

  it('drains a queued notification through to `sent`', async () => {
    const id = await enqueue(db, {
      recipientEmail: recipient,
      channel: 'email',
      templateCode: 'approval_pending',
      payload: { requestId: 4242 },
    });

    const captured: number[] = [];
    const transport: NotificationTransport = {
      send(n) { captured.push(n.id); return Promise.resolve(); },
    };
    const result = await processQueue(db, transport, 100);
    expect(result.sent).toBeGreaterThan(0);
    expect(captured).toContain(id);

    const row = await db
      .selectFrom('wf.notifications').select(['status', 'sent_at'])
      .where('id', '=', id).executeTakeFirstOrThrow();
    expect(row.status).toBe('sent');
    expect(row.sent_at).not.toBeNull();
  });

  it('retries a failing transport and dead-letters rather than losing the message', async () => {
    const id = await enqueue(db, {
      recipientEmail: recipient,
      channel: 'email',
      templateCode: 'approval_pending',
      payload: { requestId: 4243 },
    });

    const alwaysFailing: NotificationTransport = {
      send() { return Promise.reject(new Error('mail server refused')); },
    };
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await processQueue(db, alwaysFailing, 100);
    }

    const row = await db
      .selectFrom('wf.notifications').select(['status', 'attempts', 'last_error'])
      .where('id', '=', id).executeTakeFirstOrThrow();
    // Never silently dropped: it ends up somewhere a person can find it.
    expect(row.status).toBe('dead');
    expect(row.attempts).toBeGreaterThanOrEqual(5);
    expect(row.last_error).toContain('mail server refused');
  });

  it('the SMTP transport puts a real message on the wire', async () => {
    const sink = await startSmtpSink();
    try {
      const transport = new SmtpTransport({
        host: '127.0.0.1',
        port: sink.port,
        from: 'hrms@rashmigroup.test',
      });
      const id = await enqueue(db, {
        recipientEmail: recipient,
        channel: 'email',
        templateCode: 'boarding_exit_report',
        payload: { joins: 3, exits: 1 },
      });
      const row = await db
        .selectFrom('wf.notifications').selectAll().where('id', '=', id).executeTakeFirstOrThrow();

      await transport.send(row);

      expect(sink.messages).toHaveLength(1);
      const wire = sink.messages[0] ?? '';
      expect(wire).toContain(recipient);
      expect(wire).toContain('boarding_exit_report');
      // The payload has to survive to the message body, or the approver gets a
      // notification that tells them nothing.
      expect(wire).toContain('joins: 3');
    } finally {
      await sink.close();
    }
  }, 30_000);

  it('refuses an email notification with no recipient instead of marking it sent', async () => {
    const transport = new SmtpTransport({ host: '127.0.0.1', port: 1, from: 'hrms@rashmigroup.test' });
    await expect(
      transport.send({
        id: 1, channel: 'email', recipient_email: null, recipient_user_id: null,
        template_code: 't', payload: {}, status: 'queued', attempts: 0,
        last_error: null, sent_at: null, created_at: new Date(), updated_at: new Date(),
      } as never),
    ).rejects.toThrow(/no recipient_email/);
  });
});
