/** D4/CORE-10: explicitly approved legal entities for the configured ATS client. */
import type { Kysely } from 'kysely';
import { ORPCError } from '@orpc/server';
import type { Database } from '../../core/db/types.js';
import { getTypedSetting } from '../settings/index.js';
export async function atsCompanyIds(db: Kysely<Database>): Promise<number[]> {
  const allowed = await getTypedSetting<unknown>(db, 'integration.ats.company_ids', 'json', null);
  if (
    !Array.isArray(allowed) ||
    !allowed.every((id: unknown) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0) ||
    allowed.length === 0
  )
    throw new ORPCError('SERVICE_UNAVAILABLE', {
      message: 'ATS employing-entity scope is not configured',
    });
  return allowed as number[];
}
