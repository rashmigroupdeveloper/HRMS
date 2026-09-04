/**
 * SEC-01 — password policy. Every threshold is DATA (`core.settings`), never a
 * constant in a handler (CLAUDE.md rule 2), so this module is a pure checker
 * that is handed a policy; `security.service.ts` is what reads the settings.
 *
 * The checker returns EVERY violation, not the first. A form that reveals one
 * rule at a time is the archetypal micro-frustration docs/05 §6 bans.
 */

export type PasswordViolation =
  | 'min_length'
  | 'require_upper'
  | 'require_lower'
  | 'require_digit'
  | 'require_symbol'
  | 'repeat_run'
  | 'common'
  | 'contains_identifier';

export interface PasswordPolicy {
  minLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireDigit: boolean;
  requireSymbol: boolean;
  /** Longest run of one repeated character that is still allowed. */
  maxRepeatRun: number;
  /** How many previous hashes to keep and refuse (enforced by the service). */
  historyDepth: number;
  blockCommon: boolean;
}

export type PasswordCheck = { ok: true } | { ok: false; violations: PasswordViolation[] };

/**
 * Seeded into `core.settings` at migration time; this constant exists so a
 * fresh install is safe before anyone has touched settings.
 */
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 10,
  requireUpper: true,
  requireLower: true,
  requireDigit: true,
  requireSymbol: false,
  maxRepeatRun: 3,
  historyDepth: 5,
  blockCommon: true,
};

/**
 * Base words that make a password guessable regardless of the digits and
 * symbols bolted on. Matched against the password with digits/symbols removed,
 * so `Welcome@123`, `welcome1` and `W3lcome!` all collapse to the same base.
 */
const COMMON_BASES = new Set([
  'password', 'passw', 'pass', 'welcome', 'qwerty', 'qwertyui', 'asdf', 'zxcv',
  'admin', 'administrator', 'root', 'login', 'user', 'guest', 'test', 'demo',
  'letmein', 'changeme', 'secret', 'iloveyou', 'monkey', 'dragon', 'football',
  'abc', 'abcd', 'aaaa', 'temp', 'hrms', 'rashmi', 'rashmigroup', 'india',
]);

/** Lowercase, drop everything that is not a letter — the guessable "stem". */
function stem(password: string): string {
  return password.toLowerCase().replace(/[^a-z]/g, '');
}

function longestRepeatRun(password: string): number {
  let longest = 0;
  let run = 0;
  let previous = '';
  for (const char of password) {
    run = char === previous ? run + 1 : 1;
    previous = char;
    if (run > longest) longest = run;
  }
  return longest;
}

export function checkPassword(
  password: string,
  policy: PasswordPolicy,
  context: { identifiers?: readonly string[] } = {},
): PasswordCheck {
  const violations: PasswordViolation[] = [];

  if (password.length < policy.minLength) violations.push('min_length');
  if (policy.requireUpper && !/[A-Z]/.test(password)) violations.push('require_upper');
  if (policy.requireLower && !/[a-z]/.test(password)) violations.push('require_lower');
  if (policy.requireDigit && !/\d/.test(password)) violations.push('require_digit');
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) violations.push('require_symbol');
  if (longestRepeatRun(password) > policy.maxRepeatRun) violations.push('repeat_run');
  if (policy.blockCommon && COMMON_BASES.has(stem(password))) violations.push('common');

  const lowered = password.toLowerCase();
  const identifiers = context.identifiers ?? [];
  const leaks = identifiers.some((id) => id.length >= 4 && lowered.includes(id.toLowerCase()));
  if (leaks) violations.push('contains_identifier');

  return violations.length === 0 ? { ok: true } : { ok: false, violations };
}

/** Human sentences for the UI — one per violation, no jargon, no scolding. */
export const VIOLATION_MESSAGES: Readonly<Record<PasswordViolation, string>> = {
  min_length: 'Too short',
  require_upper: 'Needs a capital letter',
  require_lower: 'Needs a small letter',
  require_digit: 'Needs a number',
  require_symbol: 'Needs a symbol',
  repeat_run: 'Too many of the same character in a row',
  common: 'Too easy to guess',
  contains_identifier: 'Cannot contain your employee code or email',
};
