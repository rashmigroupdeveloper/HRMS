/** NFR-03: approved defaults are seeded and runtime policy is validated. */
import type { Kysely } from 'kysely';
import { z } from 'zod';
import type { Database } from '../../core/db/types.js';
import { getTypedSetting } from '../settings/index.js';

const schema = z.object({
  failureThreshold: z.number().int().positive().max(32767),
  lockBaseMinutes: z.number().int().positive(),
  lockMaxMinutes: z.number().int().positive(),
  accessTtlSeconds: z.number().int().positive(),
  refreshTtlSeconds: z.number().int().positive(),
}).refine(p => p.lockMaxMinutes >= p.lockBaseMinutes && p.refreshTtlSeconds >= p.accessTtlSeconds,
  'Invalid authentication policy bounds');
export type AuthPolicy = z.infer<typeof schema>;
export async function readAuthPolicy(db: Kysely<Database>): Promise<AuthPolicy> {
  const [failureThreshold, lockBaseMinutes, lockMaxMinutes, accessTtlSeconds, refreshTtlSeconds] = await Promise.all([
    getTypedSetting(db, 'auth.failure_threshold', 'number', 5),
    getTypedSetting(db, 'auth.lock_base_minutes', 'number', 15),
    getTypedSetting(db, 'auth.lock_max_minutes', 'number', 120),
    getTypedSetting(db, 'auth.access_ttl_seconds', 'number', 900),
    getTypedSetting(db, 'auth.refresh_ttl_seconds', 'number', 604800),
  ]);
  return schema.parse({ failureThreshold, lockBaseMinutes, lockMaxMinutes, accessTtlSeconds, refreshTtlSeconds });
}
