/** NFR-03/D4: exact client registration; absent configuration is an unavailable integration. */
import { ORPCError } from '@orpc/server';
import { createHash, timingSafeEqual } from 'node:crypto';
export function ssoConfig() {
  const id = process.env['SSO_ATS_CLIENT_ID'];
  const secret = process.env['SSO_ATS_CLIENT_SECRET'];
  const callback = process.env['SSO_ATS_REDIRECT_URI'];
  const issuer = process.env['SSO_ISSUER'];
  const accountUrl = process.env['SSO_ATS_ACCOUNT_URL'];
  const startUrl = process.env['SSO_ATS_START_URL'];
  if (
    process.env['SSO_ENABLED'] !== 'true' ||
    !id ||
    !secret ||
    secret.length < 32 ||
    !callback ||
    !issuer ||
    !accountUrl ||
    !startUrl
  )
    throw new ORPCError('SERVICE_UNAVAILABLE', {
      message: 'Connected ATS sign-in is not configured',
    });
  for (const value of [callback, issuer, accountUrl, startUrl]) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new ORPCError('SERVICE_UNAVAILABLE', {
        message: 'Invalid connected application URL configuration',
      });
    }
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol !== 'https:' &&
        !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)))
    )
      throw new ORPCError('SERVICE_UNAVAILABLE', {
        message: 'Connected application URLs require HTTPS or explicit loopback',
      });
  }
  return { id, secret, callback, issuer, accountUrl, startUrl };
}
export function clientAuthentication(header: string | undefined) {
  const config = ssoConfig();
  const token = header?.match(/^Bearer ([^\s]+)$/)?.[1] ?? '';
  if (
    !timingSafeEqual(
      createHash('sha256').update(token).digest(),
      createHash('sha256').update(config.secret).digest(),
    )
  )
    throw new ORPCError('UNAUTHORIZED', { message: 'Invalid connected application client' });
  return config;
}
export const codeHash = (value: string) => createHash('sha256').update(value).digest('hex');
