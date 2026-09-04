/**
 * Stage 5.2 security POLICY reads (SEC-01/03/04/05).
 *
 * Every threshold here is a `core.settings` row (CLAUDE.md rule 2). The
 * in-code fallbacks exist so a fresh database is safe before `seed:settings`
 * runs, and they are IDENTICAL to the seeded values — a fallback that differs
 * from its seed is a silent second policy, which `tests/settings-seed.test.ts`
 * exists to prevent.
 *
 * In core/ rather than modules/security for the same reason as session.ts: the
 * API layer reads the idle window and step-up window on every request.
 */
import type { Kysely } from 'kysely';
import type { Database } from '../db/types.js';
import { getTypedSetting } from '../settings/read.js';
import { DEFAULT_PASSWORD_POLICY, type PasswordPolicy } from './password-policy.js';

/** `off` = no second factor · `grace` = nag with a deadline · `required` = block. */
export type MfaEnforcement = 'off' | 'grace' | 'required';

export interface SessionPolicy {
  /** Sliding window: no request for this long ends the session. */
  idleMinutes: number;
  /** Hard ceiling regardless of activity. */
  absoluteHours: number;
  /** How long a proven step-up keeps a session elevated. */
  stepUpMinutes: number;
}

export interface MfaPolicy {
  enforcement: MfaEnforcement;
  requiredRoles: string[];
  graceDays: number;
}

export async function getPasswordPolicy(db: Kysely<Database>): Promise<PasswordPolicy> {
  const [
    minLength,
    requireUpper,
    requireLower,
    requireDigit,
    requireSymbol,
    maxRepeatRun,
    historyDepth,
    blockCommon,
  ] = await Promise.all([
    getTypedSetting(db, 'sec.password_min_length', 'number', DEFAULT_PASSWORD_POLICY.minLength),
    getTypedSetting(db, 'sec.password_require_upper', 'boolean', DEFAULT_PASSWORD_POLICY.requireUpper),
    getTypedSetting(db, 'sec.password_require_lower', 'boolean', DEFAULT_PASSWORD_POLICY.requireLower),
    getTypedSetting(db, 'sec.password_require_digit', 'boolean', DEFAULT_PASSWORD_POLICY.requireDigit),
    getTypedSetting(db, 'sec.password_require_symbol', 'boolean', DEFAULT_PASSWORD_POLICY.requireSymbol),
    getTypedSetting(db, 'sec.password_max_repeat_run', 'number', DEFAULT_PASSWORD_POLICY.maxRepeatRun),
    getTypedSetting(db, 'sec.password_history_depth', 'number', DEFAULT_PASSWORD_POLICY.historyDepth),
    getTypedSetting(db, 'sec.password_block_common', 'boolean', DEFAULT_PASSWORD_POLICY.blockCommon),
  ]);

  return {
    minLength,
    requireUpper,
    requireLower,
    requireDigit,
    requireSymbol,
    maxRepeatRun,
    historyDepth,
    blockCommon,
  };
}

export async function getSessionPolicy(db: Kysely<Database>): Promise<SessionPolicy> {
  const [idleMinutes, absoluteHours, stepUpMinutes] = await Promise.all([
    getTypedSetting(db, 'sec.session_idle_minutes', 'number', 720),
    getTypedSetting(db, 'sec.session_absolute_hours', 'number', 168),
    getTypedSetting(db, 'sec.stepup_window_minutes', 'number', 10),
  ]);
  return { idleMinutes, absoluteHours, stepUpMinutes };
}

export async function getMfaPolicy(db: Kysely<Database>): Promise<MfaPolicy> {
  const [enforcement, roles, graceDays] = await Promise.all([
    getTypedSetting<MfaEnforcement>(db, 'sec.mfa_enforcement', 'string', 'grace'),
    getTypedSetting(
      db,
      'sec.mfa_required_roles',
      'string',
      'payroll_admin,hr_head,super_admin,it_admin,dpo,compliance_officer',
    ),
    getTypedSetting(db, 'sec.mfa_grace_days', 'number', 14),
  ]);
  return {
    enforcement,
    requiredRoles: roles.split(',').map((r) => r.trim()).filter((r) => r !== ''),
    graceDays,
  };
}

