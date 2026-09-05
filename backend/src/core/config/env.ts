import { z } from 'zod';

/**
 * Environment contract — validated at the boundary, fail fast (docs/02 §8).
 * Parsed once at process start by the entrypoint; never read process.env
 * directly anywhere else.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(5100),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

    /**
     * Mail. Optional in development — the dev transport logs instead — but
     * REQUIRED in production by the refinement below. A production box with no
     * SMTP host is how PP-14 happened: notifications queued, nothing sent, and
     * nothing complained (audit finding [A2]).
     */
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASS: z.string().min(1).optional(),
    SMTP_FROM: z.string().min(3).optional(),

    /** CORS origin allowlist, comma-separated. Required in production. */
    CORS_ORIGIN: z.string().min(1).optional(),

    /**
     * Which biometric feed to run. `mock` generates deterministic synthetic
     * punches for every active employee — invaluable in development, and
     * catastrophic in production, where those punches land in the append-only
     * att.swipe_events and drive OT and pay (audit finding [A1]).
     *
     * Defaulting to `mock` is what made it dangerous: it was the only
     * implementation and nothing said so. It is now an explicit choice, and the
     * refinement below refuses `mock` in production.
     */
    ATT_CONNECTOR: z.enum(['mock', 'kent']).default('mock'),

    /** Local-disk storage root; the S3/SeaweedFS adapter lands in W1.4. */
    STORAGE_DIR: z.string().min(1).optional(),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;

    if (env.ATT_CONNECTOR === 'mock') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ATT_CONNECTOR'],
        message:
          'refusing to run the MOCK biometric feed in production — it would fabricate attendance ' +
          'into the append-only att.swipe_events and drive OT and pay. Set ATT_CONNECTOR=kent once ' +
          'the real feed is configured (P0-T01 / sponsor decision D15).',
      });
    }
    // Fail at BOOT, not at the first unsent payslip notification.
    for (const key of ['SMTP_HOST', 'SMTP_FROM', 'CORS_ORIGIN'] as const) {
      if (env[key] === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required when NODE_ENV=production`,
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  return parsed.data;
}
