/**
 * Integration suites make dozens of legitimate logins. Rate limiting is proven
 * in tests/http-hardening.integration.test.ts with its own tight instance;
 * everywhere else it must not turn a valid fixture into a flake.
 */
export const TEST_RATE_LIMITS = {
  authPerIdentifier: 10_000,
  authPerAddress: 10_000,
  intakePerAddress: 10_000,
  globalPerAddress: 100_000,
} as const;
