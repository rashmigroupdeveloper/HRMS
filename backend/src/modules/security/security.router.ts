/**
 * Stage 5.2 — the identity surface (SEC-01..11).
 *
 * Two audiences share this module deliberately:
 *  · the person, in `/my/privacy` — their sessions, their second factor, and
 *    the SEC-11 answer to "who looked at my record";
 *  · IT, in `/admin/security` — revoke a session, reset a lost second factor,
 *    read the access log.
 *
 * Nothing here is HR authority: `sec.*` permissions sit with it_admin and
 * super_admin, and resetting someone's factor is itself step-up gated.
 */
import { ORPCError } from '@orpc/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authed, authedWithStepUp, withPermission, withStepUp } from '../../api/orpc.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { VIOLATION_MESSAGES } from '../../core/auth/password-policy.js';
import {
  beginEnrolment,
  confirmEnrolment,
  disableMfa,
  getMfaStatus,
  hasConfirmedMfa,
  verifyMfaCode,
} from './mfa.service.js';
import { changePassword } from './security.service.js';
import {
  getMfaPolicy,
  getPasswordPolicy,
  getSessionPolicy,
} from '../../core/auth/security-policy.js';
import {
  listSessionsForUser,
  markSteppedUp,
  revokeAllForUser,
  revokeSession,
  type SessionRow,
} from '../../core/auth/session.js';
import { listAccessEvents, listAccessForSubject } from './access-log.service.js';

const sessionOutput = z.object({
  sid: z.string(),
  deviceLabel: z.string().nullable(),
  ip: z.string().nullable(),
  createdAt: z.string(),
  lastSeenAt: z.string(),
  expiresAt: z.string(),
  revokedAt: z.string().nullable(),
  revokeReason: z.string().nullable(),
  isCurrent: z.boolean(),
  steppedUp: z.boolean(),
});

function toSessionView(row: SessionRow, currentSid: string): z.infer<typeof sessionOutput> {
  return {
    sid: row.sid,
    deviceLabel: row.device_label,
    ip: row.ip,
    createdAt: row.created_at.toISOString(),
    lastSeenAt: row.last_seen_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    revokedAt: row.revoked_at?.toISOString() ?? null,
    revokeReason: row.revoke_reason,
    isCurrent: row.sid === currentSid,
    steppedUp: row.stepped_up_until !== null && row.stepped_up_until.getTime() > Date.now(),
  };
}

/* ── The person's own surfaces (/my/privacy) ─────────────────────────────── */

const mySessions = authed
  .route({ method: 'GET', path: '/security/my/sessions', summary: 'My active sessions (SEC-05)' })
  .output(z.object({ sessions: z.array(sessionOutput) }))
  .handler(async ({ context }) => {
    const rows = await listSessionsForUser(context.db, context.user.id, false);
    return { sessions: rows.map((r) => toSessionView(r, context.session.sid)) };
  });

const signOutEverywhere = authed
  .route({
    method: 'POST',
    path: '/security/my/sessions/revoke-all',
    summary: 'Sign out of every other device (SEC-05)',
  })
  .input(z.object({ includeCurrent: z.boolean().default(false) }))
  .output(z.object({ revoked: z.number().int() }))
  .handler(async ({ input, context }) => {
    const revoked = await revokeAllForUser(
      context.db,
      context.user.id,
      context.user.id,
      'signed out everywhere by the user',
      input.includeCurrent ? undefined : context.session.sid,
    );
    await writeAudit(context.db, {
      actorUserId: context.user.id,
      action: 'session_revoke_all',
      entity: 'sec.sessions',
      entityId: context.user.id,
      newValue: `${String(revoked)} session(s)`,
      ip: context.req.ip ?? null,
    });
    return { revoked };
  });

const revokeMySession = authed
  .route({
    method: 'POST',
    path: '/security/my/sessions/revoke',
    summary: 'End one of my own sessions',
  })
  .input(z.object({ sid: z.string().uuid() }))
  .output(z.object({ revoked: z.boolean() }))
  .handler(async ({ input, context }) => {
    const owned = await listSessionsForUser(context.db, context.user.id, true);
    if (!owned.some((row) => row.sid === input.sid)) {
      // Not "forbidden" — a session that is not yours simply does not exist to you.
      throw new ORPCError('NOT_FOUND', { message: 'Session not found' });
    }
    const count = await revokeSession(context.db, input.sid, context.user.id, 'ended by the user');
    return { revoked: count > 0 };
  });

const myAccessHistory = authed
  .route({
    method: 'GET',
    path: '/security/my/access-history',
    summary: 'Who looked at my record, and why (SEC-11 / DPDP)',
  })
  .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }))
  .output(
    z.object({
      available: z.boolean(),
      events: z.array(
        z.object({
          occurredAt: z.string(),
          actorName: z.string().nullable(),
          actorEmail: z.string(),
          resource: z.string(),
          fieldClass: z.string(),
          purpose: z.string(),
          recordCount: z.number().int(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    // A pure-admin account with no employee link has no record to be read.
    if (context.user.employee_id === null) return { available: false, events: [] };
    const events = await listAccessForSubject(context.db, context.user.employee_id, input.limit);
    return { available: true, events };
  });

/* ── Second factor ───────────────────────────────────────────────────────── */

const myMfa = authed
  .route({ method: 'GET', path: '/security/my/mfa', summary: 'My second-factor status' })
  .output(
    z.object({
      enrolled: z.boolean(),
      confirmedAt: z.string().nullable(),
      recoveryCodesRemaining: z.number().int(),
      required: z.boolean(),
      enforcement: z.enum(['off', 'grace', 'required']),
      graceDays: z.number().int(),
    }),
  )
  .handler(async ({ context }) => {
    const [status, policy, roles] = await Promise.all([
      getMfaStatus(context.db, context.user.id),
      getMfaPolicy(context.db),
      context.db
        .selectFrom('core.user_roles as ur')
        .innerJoin('core.roles as r', 'r.id', 'ur.role_id')
        .select('r.code')
        .where('ur.user_id', '=', context.user.id)
        .execute(),
    ]);
    const held = new Set(roles.map((r) => r.code));
    return {
      ...status,
      required: policy.requiredRoles.some((role) => held.has(role)),
      enforcement: policy.enforcement,
      graceDays: policy.graceDays,
    };
  });

const beginMfa = authed
  .route({ method: 'POST', path: '/security/my/mfa/begin', summary: 'Start TOTP enrolment' })
  .output(z.object({ secret: z.string(), otpauth: z.string() }))
  .handler(async ({ context }) => {
    const result = await beginEnrolment(context.db, context.user.id, context.user.email);
    if ('error' in result) {
      throw new ORPCError('CONFLICT', {
        message: 'Two-step verification is already on. Turn it off before setting it up again.',
      });
    }
    return result;
  });

const confirmMfa = authed
  .route({
    method: 'POST',
    path: '/security/my/mfa/confirm',
    summary: 'Prove the authenticator is in sync and receive recovery codes',
  })
  .input(z.object({ code: z.string().min(6).max(8) }))
  .output(z.object({ recoveryCodes: z.array(z.string()) }))
  .handler(async ({ input, context }) => {
    const result = await confirmEnrolment(context.db, context.user.id, input.code);
    if (!result.ok) {
      throw new ORPCError('BAD_REQUEST', {
        message:
          result.reason === 'no_pending'
            ? 'Start the setup again — nothing is waiting to be confirmed.'
            : 'That code did not match. Check your phone’s clock and try the current code.',
      });
    }
    await writeAudit(context.db, {
      actorUserId: context.user.id,
      action: 'mfa_enrolled',
      entity: 'sec.mfa_enrolments',
      entityId: context.user.id,
      ip: context.req.ip ?? null,
    });
    return { recoveryCodes: result.recoveryCodes };
  });

const turnOffMfa = authedWithStepUp
  .route({
    method: 'POST',
    path: '/security/my/mfa/disable',
    summary: 'Turn off my second factor (step-up required)',
  })
  .output(z.object({ disabled: z.boolean() }))
  .handler(async ({ context }) => {
    const disabled = await disableMfa(context.db, context.user.id, context.user.id);
    await writeAudit(context.db, {
      actorUserId: context.user.id,
      action: 'mfa_disabled',
      entity: 'sec.mfa_enrolments',
      entityId: context.user.id,
      ip: context.req.ip ?? null,
    });
    return { disabled };
  });

/* ── Step-up (SEC-04) ────────────────────────────────────────────────────── */

const stepUp = authed
  .route({
    method: 'POST',
    path: '/security/step-up',
    summary: 'Re-authenticate to elevate this session for a short window',
  })
  .input(z.object({ password: z.string().min(1), code: z.string().optional() }))
  .output(z.object({ steppedUpUntil: z.string() }))
  .handler(async ({ input, context }) => {
    const valid = await bcrypt.compare(input.password, context.user.password_hash);
    if (!valid) throw new ORPCError('UNAUTHORIZED', { message: 'That password is not right' });

    // If the account has a second factor, step-up must clear it too — otherwise
    // a stolen password alone would re-open everything MFA was added to protect.
    if (await hasConfirmedMfa(context.db, context.user.id)) {
      const code = input.code ?? '';
      const verified = await verifyMfaCode(context.db, context.user.id, code);
      if (!verified.ok) {
        throw new ORPCError('UNAUTHORIZED', {
          message:
            verified.reason === 'replayed'
              ? 'That code was already used. Wait for the next one.'
              : 'That verification code is not right',
          data: { code: 'MFA_REQUIRED' },
        });
      }
    }

    const policy = await getSessionPolicy(context.db);
    const until = await markSteppedUp(context.db, context.session.sid, policy.stepUpMinutes);
    await writeAudit(context.db, {
      actorUserId: context.user.id,
      action: 'step_up',
      entity: 'sec.sessions',
      entityId: context.user.id,
      ip: context.req.ip ?? null,
    });
    return { steppedUpUntil: until.toISOString() };
  });

/* ── Password ────────────────────────────────────────────────────────────── */

const passwordPolicy = authed
  .route({
    method: 'GET',
    path: '/security/password-policy',
    summary: 'The live password rules, so the form can state them up front',
  })
  .output(
    z.object({
      minLength: z.number().int(),
      requireUpper: z.boolean(),
      requireLower: z.boolean(),
      requireDigit: z.boolean(),
      requireSymbol: z.boolean(),
      maxRepeatRun: z.number().int(),
      historyDepth: z.number().int(),
    }),
  )
  .handler(async ({ context }) => {
    const policy = await getPasswordPolicy(context.db);
    return {
      minLength: policy.minLength,
      requireUpper: policy.requireUpper,
      requireLower: policy.requireLower,
      requireDigit: policy.requireDigit,
      requireSymbol: policy.requireSymbol,
      maxRepeatRun: policy.maxRepeatRun,
      historyDepth: policy.historyDepth,
    };
  });

const changeMyPassword = authed
  .route({ method: 'POST', path: '/security/my/password', summary: 'Change my own password' })
  .input(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(1) }))
  .output(z.object({ ok: z.literal(true), otherSessionsRevoked: z.number().int() }))
  .handler(async ({ input, context }) => {
    const employee = context.user.employee_id === null
      ? undefined
      : await context.db
          .selectFrom('core.employees')
          .select('ecode')
          .where('id', '=', context.user.employee_id)
          .executeTakeFirst();

    const identifiers = [context.user.email.split('@')[0] ?? '', employee?.ecode ?? ''].filter(
      (value) => value !== '',
    );

    const result = await changePassword(context.db, {
      userId: context.user.id,
      newPassword: input.newPassword,
      actorUserId: context.user.id,
      identifiers,
      currentPassword: input.currentPassword,
    });

    if (!result.ok) {
      if (result.reason === 'wrong_current') {
        throw new ORPCError('UNAUTHORIZED', { message: 'Your current password is not right' });
      }
      if (result.reason === 'reused') {
        throw new ORPCError('BAD_REQUEST', {
          message: 'You have used this password before. Choose one you have not used.',
        });
      }
      throw new ORPCError('BAD_REQUEST', {
        message: result.violations.map((v) => VIOLATION_MESSAGES[v]).join(' · '),
        data: { violations: result.violations },
      });
    }

    // A password change ends every other session — that is the whole point of
    // changing it after a suspected compromise.
    const otherSessionsRevoked = await revokeAllForUser(
      context.db,
      context.user.id,
      context.user.id,
      'password changed',
      context.session.sid,
    );
    await writeAudit(context.db, {
      actorUserId: context.user.id,
      action: 'password_changed',
      entity: 'core.users',
      entityId: context.user.id,
      ip: context.req.ip ?? null,
    });
    return { ok: true as const, otherSessionsRevoked };
  });

/* ── IT surfaces (/admin/security) ───────────────────────────────────────── */

const userSessions = withPermission('sec.session.revoke')
  .route({
    method: 'GET',
    path: '/security/admin/sessions',
    summary: "Someone else's active sessions",
  })
  .input(z.object({ userId: z.number().int() }))
  .output(z.object({ sessions: z.array(sessionOutput) }))
  .handler(async ({ input, context }) => {
    const rows = await listSessionsForUser(context.db, input.userId, false);
    return { sessions: rows.map((r) => toSessionView(r, context.session.sid)) };
  });

const revokeUserSessions = withPermission('sec.session.revoke')
  .route({
    method: 'POST',
    path: '/security/admin/sessions/revoke',
    summary: 'End someone else’s sessions — takes effect on their next request',
  })
  .input(
    z.object({
      userId: z.number().int(),
      sid: z.string().uuid().optional(),
      reason: z.string().min(3).max(200),
    }),
  )
  .output(z.object({ revoked: z.number().int() }))
  .handler(async ({ input, context }) => {
    const revoked =
      input.sid === undefined
        ? await revokeAllForUser(context.db, input.userId, context.user.id, input.reason)
        : await revokeSession(context.db, input.sid, context.user.id, input.reason);
    await writeAudit(context.db, {
      actorUserId: context.user.id,
      action: 'session_revoked',
      entity: 'sec.sessions',
      entityId: input.userId,
      newValue: `${String(revoked)} session(s): ${input.reason}`,
      ip: context.req.ip ?? null,
    });
    return { revoked };
  });

const resetUserMfa = withStepUp('sec.mfa.manage')
  .route({
    method: 'POST',
    path: '/security/admin/mfa/reset',
    summary: 'Clear someone’s second factor after a lost phone (step-up + audit)',
  })
  .input(z.object({ userId: z.number().int(), reason: z.string().min(3).max(200) }))
  .output(z.object({ reset: z.boolean() }))
  .handler(async ({ input, context }) => {
    const reset = await disableMfa(context.db, input.userId, context.user.id);
    await writeAudit(context.db, {
      actorUserId: context.user.id,
      action: 'mfa_reset',
      entity: 'sec.mfa_enrolments',
      entityId: input.userId,
      newValue: input.reason,
      ip: context.req.ip ?? null,
    });
    return { reset };
  });

const mfaCoverage = withPermission('sec.mfa.manage')
  .route({
    method: 'GET',
    path: '/security/admin/mfa/coverage',
    summary: 'Who in a required role has not enrolled yet',
  })
  .output(
    z.object({
      enforcement: z.enum(['off', 'grace', 'required']),
      graceDays: z.number().int(),
      rows: z.array(
        z.object({
          userId: z.number().int(),
          email: z.string(),
          roles: z.array(z.string()),
          enrolled: z.boolean(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => {
    const policy = await getMfaPolicy(context.db);
    if (policy.requiredRoles.length === 0) {
      return { enforcement: policy.enforcement, graceDays: policy.graceDays, rows: [] };
    }

    const users = await context.db
      .selectFrom('core.user_roles as ur')
      .innerJoin('core.roles as r', 'r.id', 'ur.role_id')
      .innerJoin('core.users as u', 'u.id', 'ur.user_id')
      .select(['u.id as user_id', 'u.email', 'r.code as role_code'])
      .where('r.code', 'in', policy.requiredRoles)
      .where('u.is_active', '=', true)
      .execute();

    const byUser = new Map<number, { email: string; roles: string[] }>();
    for (const row of users) {
      const entry = byUser.get(row.user_id) ?? { email: row.email, roles: [] };
      entry.roles.push(row.role_code);
      byUser.set(row.user_id, entry);
    }

    const enrolled = new Set(
      (
        await context.db
          .selectFrom('sec.mfa_enrolments')
          .select('user_id')
          .where('disabled_at', 'is', null)
          .where('confirmed_at', 'is not', null)
          .execute()
      ).map((r) => r.user_id),
    );

    return {
      enforcement: policy.enforcement,
      graceDays: policy.graceDays,
      rows: [...byUser.entries()]
        .map(([userId, entry]) => ({
          userId,
          email: entry.email,
          roles: entry.roles.sort(),
          enrolled: enrolled.has(userId),
        }))
        .sort((a, b) => Number(a.enrolled) - Number(b.enrolled) || a.email.localeCompare(b.email)),
    };
  });

const accessLog = withPermission('audit.read')
  .route({
    method: 'GET',
    path: '/security/admin/access-log',
    summary: 'Every sensitive read, with its stated purpose (SEC-10)',
  })
  .input(
    z.object({
      actorUserId: z.number().int().optional(),
      fieldClass: z
        .enum(['statutory_id', 'compensation', 'bank', 'health', 'disciplinary'])
        .optional(),
      sinceDays: z.number().int().min(1).max(365).default(30),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(200).default(50),
    }),
  )
  .output(
    z.object({
      total: z.number().int(),
      rows: z.array(
        z.object({
          occurredAt: z.string(),
          actorName: z.string().nullable(),
          actorEmail: z.string(),
          subjectEmployeeId: z.number().int().nullable(),
          resource: z.string(),
          fieldClass: z.string(),
          purpose: z.string(),
          recordCount: z.number().int(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const since = new Date(Date.now() - input.sinceDays * 24 * 60 * 60 * 1000);
    return listAccessEvents(context.db, {
      ...(input.actorUserId === undefined ? {} : { actorUserId: input.actorUserId }),
      ...(input.fieldClass === undefined ? {} : { fieldClass: input.fieldClass }),
      since,
      limit: input.pageSize,
      offset: (input.page - 1) * input.pageSize,
    });
  });

export const securityRouter = {
  mySessions,
  revokeMySession,
  signOutEverywhere,
  myAccessHistory,
  myMfa,
  beginMfa,
  confirmMfa,
  turnOffMfa,
  stepUp,
  passwordPolicy,
  changeMyPassword,
  userSessions,
  revokeUserSessions,
  resetUserMfa,
  mfaCoverage,
  accessLog,
};
