/**
 * Notification skeleton (WF-02): queue → transport with retry → dead-letter.
 * The transport is pluggable: DevLogTransport in development / default;
 * SmtpNotificationTransport (nodemailer) when SMTP host and credentials exist.
 * Nothing is ever silently dropped — undeliverable rows park in status 'dead'
 * for the ops dashboard.
 */
import type { Kysely } from 'kysely';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Database } from '../../core/db/types.js';
import { logger } from '../../core/logger.js';
import {
  claimDeliverable,
  insertNotification,
  listSubscribers,
  markFailed,
  markSent,
  type EnqueueInput,
  type NotificationRow,
} from './notifications.repository.js';
import { inTransaction } from '../../core/db/database.js';

const MAX_ATTEMPTS = 5;

export interface NotificationTransport {
  send(notification: NotificationRow): Promise<void>;
}

/** Development transport — structured log line instead of a real send. */
export const devLogTransport: NotificationTransport = {
  send(n) {
    logger.info(
      { id: n.id, channel: n.channel, template: n.template_code, to: n.recipient_user_id ?? n.recipient_email },
      'notification (dev transport)',
    );
    return Promise.resolve();
  },
};

export interface SmtpTransportOptions {
  host: string;
  port: number;
  secure?: boolean | undefined;
  auth?: { user: string; pass: string } | undefined;
  from?: string | undefined;
  db?: Kysely<Database> | undefined;
  transporter?: Transporter | undefined;
}

function formatTitle(code: string): string {
  return code
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatEmailSubject(templateCode: string, payload: Record<string, unknown>): string {
  if (templateCode === 'roster_deadline') {
    const month = typeof payload['month'] === 'string' ? ` for ${payload['month']}` : '';
    return `[Rashmi HRMS] Roster Submission Deadline${month}`;
  }
  if (templateCode === 'boarding_exit') {
    return '[Rashmi HRMS] Daily Onboarding & Exit Notification';
  }
  if (templateCode === 'CONFIRMATION_LETTER') {
    return '[Rashmi HRMS] Employment Confirmation Letter Issued';
  }
  if (templateCode === 'relieving_letter') {
    return '[Rashmi HRMS] Relieving Letter & Service Certificate';
  }
  if (templateCode === 'service_certificate') {
    return '[Rashmi HRMS] Service Certificate Issued';
  }
  return `[Rashmi HRMS] ${formatTitle(templateCode)}`;
}

export function formatEmailText(templateCode: string, payload: Record<string, unknown>): string {
  const details = Object.entries(payload)
    .filter(([, v]) => v !== undefined && v !== null && typeof v !== 'object')
    .map(([k, v]) => `  - ${formatTitle(k)}: ${String(v)}`)
    .join('\n');

  return (
    `Rashmi HRMS Notification\n\n` +
    `Event: ${formatTitle(templateCode)}\n\n` +
    (details ? `Details:\n${details}\n\n` : '') +
    `Please log in to your Rashmi HRMS portal for full details.\n\n` +
    `--\nRashmi HRMS Automated Dispatch (Do Not Reply)`
  );
}

export function formatEmailHtml(templateCode: string, payload: Record<string, unknown>): string {
  const rows = Object.entries(payload)
    .filter(([, v]) => v !== undefined && v !== null && typeof v !== 'object')
    .map(
      ([k, v]) =>
        `<tr><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: 600; color: #475569;">${formatTitle(k)}</td>` +
        `<td style="padding: 8px; border: 1px solid #e2e8f0; color: #1e293b;">${String(v)}</td></tr>`,
    )
    .join('');

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="border-bottom: 2px solid #e11d48; padding-bottom: 12px; margin-bottom: 20px;">
        <h2 style="margin: 0; color: #0f172a; font-size: 20px;">Rashmi Group HRMS</h2>
      </div>
      <h3 style="color: #334155; margin-top: 0; font-size: 16px;">${formatTitle(templateCode)}</h3>
      ${
        rows
          ? `<table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;"><tbody>${rows}</tbody></table>`
          : ''
      }
      <p style="color: #64748b; font-size: 14px; line-height: 1.5;">
        Please log in to your Rashmi HRMS portal to view full details and take necessary actions.
      </p>
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8;">
        This is an automated notification from Rashmi Group HRMS. Please do not reply directly to this email.
      </div>
    </div>
  `;
}

/** Production SMTP transport delivering real emails via nodemailer (WF-02, SOW C16). */
export class SmtpNotificationTransport implements NotificationTransport {
  private transporter: Transporter;
  private from: string;
  private db?: Kysely<Database> | undefined;

  constructor(options: SmtpTransportOptions) {
    this.from = options.from ?? 'Rashmi HRMS <noreply@rashmigroup.com>';
    this.db = options.db;
    this.transporter =
      options.transporter ??
      nodemailer.createTransport({
        host: options.host,
        port: options.port,
        secure: options.secure ?? options.port === 465,
        auth:
          options.auth?.user && options.auth.pass
            ? { user: options.auth.user, pass: options.auth.pass }
            : undefined,
      });
  }

  async send(n: NotificationRow): Promise<void> {
    if (n.channel !== 'email') {
      return;
    }

    let to = n.recipient_email;
    if (!to && n.recipient_user_id && this.db) {
      const user = await this.db
        .selectFrom('core.users')
        .select('email')
        .where('id', '=', n.recipient_user_id)
        .executeTakeFirst();
      to = user?.email ?? null;
    }

    if (!to) {
      throw new Error(`No recipient email address available for notification #${n.id}`);
    }

    let payload: Record<string, unknown> = {};
    if (typeof n.payload === 'string') {
      try {
        payload = JSON.parse(n.payload) as Record<string, unknown>;
      } catch {
        payload = { message: n.payload };
      }
    } else if (n.payload && typeof n.payload === 'object') {
      payload = n.payload as Record<string, unknown>;
    }

    const subject = formatEmailSubject(n.template_code, payload);
    const text = formatEmailText(n.template_code, payload);
    const html = formatEmailHtml(n.template_code, payload);

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      text,
      html,
    });
  }
}

/** Factory resolving configured transport (SMTP if host configured, dev log otherwise). */
export function createNotificationTransport(
  config: {
    SMTP_HOST?: string | undefined;
    SMTP_PORT?: number | undefined;
    SMTP_SECURE?: boolean | undefined;
    SMTP_USER?: string | undefined;
    SMTP_PASS?: string | undefined;
    SMTP_FROM?: string | undefined;
  },
  db?: Kysely<Database>,
): NotificationTransport {
  if (config.SMTP_HOST) {
    return new SmtpNotificationTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT ?? 587,
      secure: config.SMTP_SECURE ?? false,
      auth:
        config.SMTP_USER && config.SMTP_PASS
          ? { user: config.SMTP_USER, pass: config.SMTP_PASS }
          : undefined,
      from: config.SMTP_FROM,
      db,
    });
  }
  return devLogTransport;
}

/** Queue one notification for a known recipient. */
export function enqueue(db: Kysely<Database>, input: EnqueueInput): Promise<number> {
  return insertNotification(db, input);
}

/**
 * Fan an EVENT out to its configured audience (wf.event_subscriptions) —
 * the per-event recipient matrix is data, editable without deploys (PP-26).
 * Role subscriptions notify every user currently holding the role.
 */
export async function enqueueEvent(
  db: Kysely<Database>,
  eventCode: string,
  templateCode: string,
  payload: Record<string, unknown>,
): Promise<number> {
  const subs = await listSubscribers(db, eventCode);
  let queued = 0;

  for (const sub of subs) {
    if (sub.recipient_kind === 'email') {
      await insertNotification(db, { recipientEmail: sub.recipient_ref, channel: 'email', templateCode, payload });
      queued += 1;
    } else if (sub.recipient_kind === 'user') {
      await insertNotification(db, {
        recipientUserId: Number(sub.recipient_ref),
        channel: 'in_app',
        templateCode,
        payload,
      });
      queued += 1;
    } else {
      const holders = await db
        .selectFrom('core.user_roles as ur')
        .innerJoin('core.roles as r', 'r.id', 'ur.role_id')
        .innerJoin('core.users as u', 'u.id', 'ur.user_id')
        .where('r.code', '=', sub.recipient_ref)
        .where('u.is_active', '=', true)
        .select('u.id as user_id')
        .distinct()
        .execute();
      for (const h of holders) {
        await insertNotification(db, { recipientUserId: h.user_id, channel: 'in_app', templateCode, payload });
        queued += 1;
      }
    }
  }
  return queued;
}

/**
 * Drain the queue once: claim → send → sent | failed(attempt++) | dead.
 * Called by the scheduler (Phase 1 wires pg-boss/cron); callable manually.
 */
export async function processQueue(
  db: Kysely<Database>,
  transport: NotificationTransport,
  batchSize = 50,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  await inTransaction(db, async (trx) => {
    const batch = await claimDeliverable(trx, batchSize);
    for (const notification of batch) {
      try {
        await transport.send(notification);
        await markSent(trx, notification.id);
        sent += 1;
      } catch (err) {
        await markFailed(trx, notification.id, err instanceof Error ? err.message : String(err), MAX_ATTEMPTS);
        failed += 1;
      }
    }
  });

  return { sent, failed };
}
