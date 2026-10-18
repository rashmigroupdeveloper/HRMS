/**
 * WF-02 / C16: SMTP notification transport, email template formatting, and queue delivery tests.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Transporter } from 'nodemailer';
import type { Kysely } from 'kysely';
import type { Database } from '../src/core/db/types.js';
import type { NotificationRow } from '../src/modules/notifications/notifications.repository.js';
import {
  createNotificationTransport,
  devLogTransport,
  formatEmailHtml,
  formatEmailSubject,
  formatEmailText,
  SmtpNotificationTransport,
} from '../src/modules/notifications/notifications.service.js';

describe('Notification formatting and SMTP delivery transport', () => {
  it('formats custom email subjects per template code', () => {
    expect(formatEmailSubject('roster_deadline', { month: '2026-11' })).toBe(
      '[Rashmi HRMS] Roster Submission Deadline for 2026-11',
    );
    expect(formatEmailSubject('boarding_exit', {})).toBe(
      '[Rashmi HRMS] Daily Onboarding & Exit Notification',
    );
    expect(formatEmailSubject('CONFIRMATION_LETTER', {})).toBe(
      '[Rashmi HRMS] Employment Confirmation Letter Issued',
    );
    expect(formatEmailSubject('relieving_letter', {})).toBe(
      '[Rashmi HRMS] Relieving Letter & Service Certificate',
    );
    expect(formatEmailSubject('custom_event_alert', {})).toBe(
      '[Rashmi HRMS] Custom Event Alert',
    );
  });

  it('formats plain text and html bodies with payload table', () => {
    const payload = { employee_name: 'Anup Kumar', ecode: 'RML035384', effective_date: '2026-11-01' };
    const text = formatEmailText('CONFIRMATION_LETTER', payload);
    expect(text).toContain('Employee Name: Anup Kumar');
    expect(text).toContain('Ecode: RML035384');
    expect(text).toContain('Rashmi HRMS Automated Dispatch');

    const html = formatEmailHtml('CONFIRMATION_LETTER', payload);
    expect(html).toContain('Rashmi Group HRMS');
    expect(html).toContain('Employee Name');
    expect(html).toContain('Anup Kumar');
  });

  it('bypasses SMTP transport for in_app notifications', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'msg-1' });
    const transport = new SmtpNotificationTransport({
      host: 'smtp.example.com',
      port: 587,
      transporter: { sendMail } as unknown as Transporter,
    });

    const inAppRow: NotificationRow = {
      id: 101,
      recipient_user_id: 1,
      recipient_email: null,
      channel: 'in_app',
      template_code: 'wf_step_assigned',
      payload: JSON.stringify({ step: 'HR Review' }),
      status: 'queued',
      attempts: 0,
      sent_at: null,
      read_at: null,
      last_error: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await transport.send(inAppRow);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('dispatches email via nodemailer to recipient_email', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'msg-2' });
    const transport = new SmtpNotificationTransport({
      host: 'smtp.example.com',
      port: 587,
      from: 'Rashmi HR <hr@rashmigroup.com>',
      transporter: { sendMail } as unknown as Transporter,
    });

    const emailRow: NotificationRow = {
      id: 102,
      recipient_user_id: null,
      recipient_email: 'finance@rashmigroup.com',
      channel: 'email',
      template_code: 'roster_deadline',
      payload: JSON.stringify({ month: '2026-10' }),
      status: 'queued',
      attempts: 0,
      sent_at: null,
      read_at: null,
      last_error: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await transport.send(emailRow);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Rashmi HR <hr@rashmigroup.com>',
        to: 'finance@rashmigroup.com',
        subject: '[Rashmi HRMS] Roster Submission Deadline for 2026-10',
      }),
    );
  });

  it('resolves email from user table when recipient_user_id is supplied', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'msg-3' });
    const mockDb = {
      selectFrom: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            executeTakeFirst: vi.fn().mockResolvedValue({ email: 'user42@rashmigroup.com' }),
          }),
        }),
      }),
    };

    const transport = new SmtpNotificationTransport({
      host: 'smtp.example.com',
      port: 587,
      transporter: { sendMail } as unknown as Transporter,
      db: mockDb as unknown as Kysely<Database>,
    });

    const emailRow: NotificationRow = {
      id: 103,
      recipient_user_id: 42,
      recipient_email: null,
      channel: 'email',
      template_code: 'boarding_exit',
      payload: { count: 3 },
      status: 'queued',
      attempts: 0,
      sent_at: null,
      read_at: null,
      last_error: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await transport.send(emailRow);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user42@rashmigroup.com',
      }),
    );
  });

  it('throws error if recipient email cannot be resolved', async () => {
    const sendMail = vi.fn();
    const transport = new SmtpNotificationTransport({
      host: 'smtp.example.com',
      port: 587,
      transporter: { sendMail } as unknown as Transporter,
    });

    const brokenRow: NotificationRow = {
      id: 104,
      recipient_user_id: null,
      recipient_email: null,
      channel: 'email',
      template_code: 'boarding_exit',
      payload: {},
      status: 'queued',
      attempts: 0,
      sent_at: null,
      read_at: null,
      last_error: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await expect(transport.send(brokenRow)).rejects.toThrow(
      'No recipient email address available for notification #104',
    );
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('createNotificationTransport returns Smtp transport when SMTP_HOST is configured, otherwise devLogTransport', () => {
    const dev = createNotificationTransport({});
    expect(dev).toBe(devLogTransport);

    const smtp = createNotificationTransport({
      SMTP_HOST: 'smtp.mail.com',
      SMTP_PORT: 465,
      SMTP_USER: 'test',
      SMTP_PASS: 'secret',
    });
    expect(smtp).toBeInstanceOf(SmtpNotificationTransport);
  });
});
