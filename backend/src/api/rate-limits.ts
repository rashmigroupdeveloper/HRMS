/** NFR-03: operational limits apply before database access (docs/02 §8). */
export interface RateLimits {
  authPerIdentifier: number;
  authPerAddress: number;
  intakePerAddress?: number;
  globalPerAddress: number;
}

export function rateLimitsFromEnv(env: NodeJS.ProcessEnv = process.env): RateLimits {
  const num = (key: string, fallback: number): number => {
    const raw = env[key];
    if (raw === undefined) return fallback;
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new Error(`${key} must be a positive integer`);
    }
    return parsed;
  };
  const res: RateLimits = {
    authPerIdentifier: num('RATE_LIMIT_AUTH_PER_IDENTIFIER', 5),
    authPerAddress: num('RATE_LIMIT_AUTH_PER_ADDRESS', 300),
    globalPerAddress: num('RATE_LIMIT_GLOBAL_PER_ADDRESS', 100),
  };
  if (env['RATE_LIMIT_INTAKE_PER_ADDRESS'] !== undefined) {
    res.intakePerAddress = num('RATE_LIMIT_INTAKE_PER_ADDRESS', 10);
  }
  return res;
}
