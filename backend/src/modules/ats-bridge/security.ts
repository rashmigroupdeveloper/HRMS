/** NFR-03: authenticated, body-bound ATS assertions; disabled until explicitly configured. */
import { jwtVerify } from 'jose';
import { ORPCError } from '@orpc/server';
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { getTypedSetting } from '../settings/index.js';
export async function verifyAtsAssertion(
  db: Kysely<Database>,
  header: string | undefined,
  digest: string,
) {
  const issuer = process.env['ATS_BRIDGE_ISSUER'];
  const secret = process.env['ATS_BRIDGE_SECRET'];
  if (process.env['ATS_BRIDGE_ENABLED'] !== 'true' || !issuer || !secret || secret.length < 32)
    throw new ORPCError('SERVICE_UNAVAILABLE', {
      message: 'ATS onboarding connection is not configured',
    });
  const maxSeconds = await getTypedSetting<number | null>(
    db,
    'integration.ats.assertion_max_seconds',
    'number',
    null,
  );
  if (maxSeconds === null || !Number.isSafeInteger(maxSeconds) || maxSeconds <= 0)
    throw new ORPCError('SERVICE_UNAVAILABLE', {
      message: 'ATS assertion lifetime is not configured',
    });
  const token = header?.match(/^Bearer ([^\s]+)$/)?.[1];
  if (!token)
    throw new ORPCError('UNAUTHORIZED', { message: 'A trusted ATS assertion is required' });
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'],
      issuer,
      audience: 'hrms:onboarding',
    });
    if (
      payload['payloadHash'] !== digest ||
      payload.sub !== 'ats-onboarding' ||
      !payload.iat ||
      !payload.exp ||
      payload.exp <= payload.iat ||
      payload.exp - payload.iat > maxSeconds ||
      payload.iat > Math.floor(Date.now() / 1000)
    )
      throw new Error('Assertion binding mismatch');
  } catch {
    throw new ORPCError('UNAUTHORIZED', { message: 'Invalid or expired ATS assertion' });
  }
}
