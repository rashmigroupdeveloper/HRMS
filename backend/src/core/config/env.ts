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

    /** Local-disk storage root; the S3/SeaweedFS adapter lands in W1.4. */
    STORAGE_DIR: z.string().min(1).optional(),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
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
