/**
 * SEC-02/03 — TOTP second factor for privileged roles.
 *
 * Design notes worth keeping:
 *  · A code is spent once. `last_used_step` blocks replay inside the 30s
 *    window, which is exactly the window a shoulder-surfer has.
 *  · Recovery codes are bcrypt hashes shown to the user exactly once. Losing a
 *    phone must not mean losing payroll access on a run day.
 *  · Enforcement is a POLICY value, not a constant: `off | grace | required`.
 *    Turning it straight to `required` would lock out every existing privileged
 *    user, so the default is `grace` and the UI nags (docs/05 §6 — the product
 *    escalates, it does not ambush).
 */
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { generateTotpSecret, matchTotpStep, otpauthUri } from '../../core/auth/totp.js';

const RECOVERY_CODE_COUNT = 10;
const SECRET_BYTES = 20; // RFC 4226 §4 recommends 160 bits.
const ISSUER = 'Rashmi HRMS';

export type MfaEnforcement = 'off' | 'grace' | 'required';

export interface MfaStatus {
  enrolled: boolean;
  confirmedAt: string | null;
  recoveryCodesRemaining: number;
}

export async function getMfaStatus(db: Kysely<Database>, userId: number): Promise<MfaStatus> {
  const enrolment = await db
    .selectFrom('sec.mfa_enrolments')
    .select(['id', 'confirmed_at'])
    .where('user_id', '=', userId)
    .where('disabled_at', 'is', null)
    .executeTakeFirst();

  if (enrolment === undefined) return { enrolled: false, confirmedAt: null, recoveryCodesRemaining: 0 };
  if (enrolment.confirmed_at === null) {
    return { enrolled: false, confirmedAt: null, recoveryCodesRemaining: 0 };
  }

  const remaining = await db
    .selectFrom('sec.mfa_recovery_codes')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('enrolment_id', '=', enrolment.id)
    .where('used_at', 'is', null)
    .executeTakeFirst();

  return {
    enrolled: true,
    confirmedAt: enrolment.confirmed_at.toISOString(),
    recoveryCodesRemaining: Number(remaining?.n ?? 0),
  };
}

export async function hasConfirmedMfa(db: Kysely<Database>, userId: number): Promise<boolean> {
  const row = await db
    .selectFrom('sec.mfa_enrolments')
    .select('id')
    .where('user_id', '=', userId)
    .where('disabled_at', 'is', null)
    .where('confirmed_at', 'is not', null)
    .executeTakeFirst();
  return row !== undefined;
}

/**
 * Start (or restart) enrolment. An unconfirmed attempt is replaced — a user who
 * abandoned a setup halfway must not be stuck with a secret they never saved.
 * A CONFIRMED enrolment is never silently replaced; it must be disabled first.
 */
export async function beginEnrolment(
  db: Kysely<Database>,
  userId: number,
  accountLabel: string,
): Promise<{ secret: string; otpauth: string } | { error: 'already_enrolled' }> {
  if (await hasConfirmedMfa(db, userId)) return { error: 'already_enrolled' };

  await db
    .deleteFrom('sec.mfa_enrolments')
    .where('user_id', '=', userId)
    .where('confirmed_at', 'is', null)
    .where('disabled_at', 'is', null)
    .execute();

  const secret = generateTotpSecret(randomBytes(SECRET_BYTES));
  await db.insertInto('sec.mfa_enrolments').values({ user_id: userId, secret }).execute();

  return { secret, otpauth: otpauthUri(secret, accountLabel, ISSUER) };
}

/** Proves the user's app is in sync before we start relying on it. */
export async function confirmEnrolment(
  db: Kysely<Database>,
  userId: number,
  code: string,
  nowMs = Date.now(),
): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; reason: 'no_pending' | 'bad_code' }> {
  const pending = await db
    .selectFrom('sec.mfa_enrolments')
    .select(['id', 'secret'])
    .where('user_id', '=', userId)
    .where('confirmed_at', 'is', null)
    .where('disabled_at', 'is', null)
    .executeTakeFirst();

  if (!pending) return { ok: false, reason: 'no_pending' };

  const step = matchTotpStep(pending.secret, code.trim(), nowMs);
  if (step === null) return { ok: false, reason: 'bad_code' };

  const plain = Array.from({ length: RECOVERY_CODE_COUNT }, () => newRecoveryCode());
  const hashes = await Promise.all(plain.map((c) => bcrypt.hash(c, 10)));

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('sec.mfa_enrolments')
      .set({ confirmed_at: new Date(), last_used_step: step })
      .where('id', '=', pending.id)
      .execute();
    await trx
      .insertInto('sec.mfa_recovery_codes')
      .values(hashes.map((code_hash) => ({ enrolment_id: pending.id, code_hash })))
      .execute();
  });

  return { ok: true, recoveryCodes: plain };
}

export type MfaVerification =
  | { ok: true; usedRecoveryCode: boolean }
  | { ok: false; reason: 'not_enrolled' | 'bad_code' | 'replayed' };

/** Accepts a live TOTP code or an unused recovery code. */
export async function verifyMfaCode(
  db: Kysely<Database>,
  userId: number,
  code: string,
  nowMs = Date.now(),
): Promise<MfaVerification> {
  const enrolment = await db
    .selectFrom('sec.mfa_enrolments')
    .select(['id', 'secret', 'last_used_step'])
    .where('user_id', '=', userId)
    .where('disabled_at', 'is', null)
    .where('confirmed_at', 'is not', null)
    .executeTakeFirst();

  if (!enrolment) return { ok: false, reason: 'not_enrolled' };

  const cleaned = code.trim().replace(/\s/g, '');
  const step = matchTotpStep(enrolment.secret, cleaned, nowMs);

  if (step !== null) {
    if (enrolment.last_used_step !== null && step <= enrolment.last_used_step) {
      return { ok: false, reason: 'replayed' };
    }
    await db
      .updateTable('sec.mfa_enrolments')
      .set({ last_used_step: step })
      .where('id', '=', enrolment.id)
      .execute();
    return { ok: true, usedRecoveryCode: false };
  }

  return verifyRecoveryCode(db, enrolment.id, cleaned);
}

async function verifyRecoveryCode(
  db: Kysely<Database>,
  enrolmentId: number,
  candidate: string,
): Promise<MfaVerification> {
  const codes = await db
    .selectFrom('sec.mfa_recovery_codes')
    .select(['id', 'code_hash'])
    .where('enrolment_id', '=', enrolmentId)
    .where('used_at', 'is', null)
    .execute();

  const normalised = candidate.toUpperCase();
  for (const row of codes) {
    // Sequential on purpose: at most 10 rows, and a parallel bcrypt burst
    // costs more than the short scan it would replace.
    const matches = await bcrypt.compare(normalised, row.code_hash);
    if (matches) {
      await db
        .updateTable('sec.mfa_recovery_codes')
        .set({ used_at: new Date() })
        .where('id', '=', row.id)
        .execute();
      return { ok: true, usedRecoveryCode: true };
    }
  }
  return { ok: false, reason: 'bad_code' };
}

/** Disabling keeps the row: who turned off someone's second factor, and when. */
export async function disableMfa(
  db: Kysely<Database>,
  userId: number,
  byUserId: number,
): Promise<boolean> {
  const result = await db
    .updateTable('sec.mfa_enrolments')
    .set({ disabled_at: new Date(), disabled_by_user_id: byUserId })
    .where('user_id', '=', userId)
    .where('disabled_at', 'is', null)
    .executeTakeFirst();
  return Number(result.numUpdatedRows) > 0;
}

/** Crockford-ish, ambiguity-free, and readable aloud over a phone line. */
function newRecoveryCode(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = randomBytes(8);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length] ?? '2');
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}`;
}
