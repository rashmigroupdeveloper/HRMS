import { z } from 'zod';

/**
 * Environment contract — validated at the boundary, fail fast (docs/02 §8).
 * Parsed once at process start by the entrypoint; never read process.env
 * directly anywhere else.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5100),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  // z.coerce.boolean() turns the string "false" into true — parse explicitly.
  SMTP_SECURE: z.enum(['true', 'false', '1', '0']).default('false').transform((v) => v === 'true' || v === '1'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('Rashmi HRMS <noreply@rashmigroup.com>'),
  /** Public URL of the SPA — used in e-mailed links (password reset, approvals). */
  // C-04 client decision: super_admin break-glass co-sign of payroll runs (default off).
  PAYROLL_SUPER_ADMIN_COSIGN: z.enum(['true', 'false']).default('false'),
  APP_BASE_URL: z.string().url().default('http://localhost:5173'),
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
