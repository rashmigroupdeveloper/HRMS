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
});

type Env = z.infer<typeof envSchema>; // re-export when first consumed outside this module

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  return parsed.data;
}
