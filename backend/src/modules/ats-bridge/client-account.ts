/** CORE-10: body-bound client proof resolves only an explicit active RBAC principal. */
import { ORPCError } from '@orpc/server';
import type { AppContext } from '../../api/orpc.js';
import { getTypedSetting } from '../settings/index.js';
import { acceptedOfferSchema, acceptanceDigest } from './contract.js';
import { verifyAtsAssertion } from './security.js';

export async function atsClientAccount(context: AppContext): Promise<number> {
  if (!context.db) throw new ORPCError('SERVICE_UNAVAILABLE', { message: 'Database unavailable' });
  const payload: unknown = context.req.method === 'GET' ? {} : context.req.body;
  const canonical = context.req.method === 'GET' ? {} : acceptedOfferSchema.parse(payload);
  await verifyAtsAssertion(
    context.db,
    context.req.headers.authorization,
    acceptanceDigest(canonical),
  );
  const userId = await getTypedSetting<number | null>(
    context.db,
    'integration.ats.service_user_id',
    'number',
    null,
  );
  if (userId === null || !Number.isSafeInteger(userId) || userId <= 0) {
    throw new ORPCError('SERVICE_UNAVAILABLE', {
      message: 'ATS integration account is not configured',
    });
  }
  return userId;
}
