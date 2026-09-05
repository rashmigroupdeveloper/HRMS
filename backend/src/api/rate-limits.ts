/**
 * Rate-limit ceilings (audit W0-T37, findings [D4] [D5]).
 *
 * Its own module so that `AppDeps` (api/handler.ts) and the middleware wiring
 * (app.ts) can both name the type without app.ts and handler.ts importing each
 * other — dependency-cruiser's `no-circular` rule, which is right: a cycle
 * there would mean neither could be reasoned about alone.
 *
 * TWO layers, because one is always wrong here. Rashmi's employees sit behind a
 * handful of office and plant egress addresses, so a tight per-address login
 * limit would block the 09:00 rush — the limiter causing the outage it exists
 * to prevent. The audit's own numbers make the point: 30 failed logins landed
 * in one second, and a per-address ceiling of 30/15min would have throttled a
 * plant gate as readily as an attacker.
 *
 *   · authPerIdentifier — per (address + identifier). Tight. Brute-forcing ONE
 *     account is stopped well before the account lockout an attacker could
 *     otherwise weaponise to lock all 1,066 employees out on the 28th.
 *   · authPerAddress — generous. Enough for a plant's morning; not enough for
 *     someone walking the whole employee master from one host.
 *
 * These are environment configuration, not `core.settings` policy: a limiter
 * has to decide before any database read, and a per-request settings lookup
 * would itself be the load problem.
 */
export interface RateLimits {
  authPerIdentifier: number;
  authPerAddress: number;
  intakePerAddress: number;
  globalPerAddress: number;
}

/** Defaults are the production values. */
export function rateLimitsFromEnv(env: NodeJS.ProcessEnv = process.env): RateLimits {
  const num = (key: string, fallback: number): number => {
    const raw = env[key];
    const parsed = raw === undefined ? Number.NaN : Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  return {
    authPerIdentifier: num('RATE_LIMIT_AUTH_PER_IDENTIFIER', 10),
    authPerAddress: num('RATE_LIMIT_AUTH_PER_ADDRESS', 300),
    intakePerAddress: num('RATE_LIMIT_INTAKE_PER_ADDRESS', 10),
    globalPerAddress: num('RATE_LIMIT_GLOBAL_PER_ADDRESS', 600),
  };
}
