/**
 * The SMTP transport (audit W0-T30, finding [A2]).
 *
 * Until now the only transport was `devLogTransport`, and nothing drained the
 * queue in production anyway — so every approval request, every 07:00
 * boarding/exit report and every OT digest was written to `wf.notifications`
 * and never sent. That is PP-14 reproduced by construction: *"Chaitanya Sir has
 * not received a single notification"* is the single most-cited failure in the
 * source documents.
 *
 * Configuration is environment, validated at boot (core/config/env.ts). If SMTP
 * is not configured the resolver falls back to the dev transport and says so
 * loudly, because a mail server that is quietly absent is how this failure
 * happened the first time.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { logger } from '../../core/logger.js';
import type { NotificationTransport } from './transport.js';
import type { NotificationRow } from './notifications.repository.js';

export interface SmtpConfig {
  host: string;
  port: number;
  user?: string | undefined;
  pass?: string | undefined;
  from: string;
}

/**
 * Rendering is deliberately minimal here: the template catalog is a later
 * stage's work. What matters now is that a real message leaves the building
 * with the payload attached, so an approver has something actionable and the
 * `sent` row means what it says.
 */
function renderSubject(row: NotificationRow): string {
  return `[HRMS] ${row.template_code.replace(/_/g, ' ')}`;
}

function renderBody(row: NotificationRow): string {
  const payload = typeof row.payload === 'object' && row.payload !== null ? row.payload : {};
  const lines = Object.entries(payload as Record<string, unknown>)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join('\n');
  return `${row.template_code}\n\n${lines}\n`;
}

export class SmtpTransport implements NotificationTransport {
  private readonly mailer: Transporter;

  constructor(private readonly config: SmtpConfig) {
    this.mailer = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      // 465 is implicit TLS; 587 upgrades with STARTTLS. Never plaintext by
      // choice — statutory identifiers can appear in a payload.
      secure: config.port === 465,
      ...(config.user === undefined || config.pass === undefined
        ? {}
        : { auth: { user: config.user, pass: config.pass } }),
    });
  }

  async send(notification: NotificationRow): Promise<void> {
    if (notification.channel !== 'email') return; // in_app rows are read from the DB
    const to = notification.recipient_email;
    if (to === null || to === '') {
      // Throwing routes it through the retry → dead-letter path rather than
      // silently marking it sent.
      throw new Error(`notification ${String(notification.id)} has channel=email but no recipient_email`);
    }
    await this.mailer.sendMail({
      from: this.config.from,
      to,
      subject: renderSubject(notification),
      text: renderBody(notification),
    });
    logger.info({ id: notification.id, template: notification.template_code }, 'notification sent via smtp');
  }
}
