/**
 * JWT utilities — HS256 via jose. Access 15 min, refresh 7 days (docs/02 §1).
 * Kept in core so both the auth module and the (future) authed procedure base
 * can verify without module cross-imports.
 */
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';

const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';
const ISSUER = 'hrms-api';

const claimsSchema = z.object({
  sub: z.string(),
  email: z.string(),
  typ: z.enum(['access', 'refresh']),
  /**
   * SEC-05 — the session this token belongs to. `sec.sessions` is the authority
   * on whether it is still live, which is what makes revoke take effect on the
   * next request. Optional in the schema only so a token minted before this
   * claim existed fails cleanly at the session lookup rather than at parsing.
   */
  sid: z.string().uuid().optional(),
});

export interface TokenClaims {
  userId: number;
  email: string;
  typ: 'access' | 'refresh';
  sid: string | undefined;
}

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

async function sign(
  userId: number,
  email: string,
  typ: 'access' | 'refresh',
  ttl: string,
  secret: string,
  sid: string,
): Promise<string> {
  return new SignJWT({ email, typ, sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(key(secret));
}

export function signAccessToken(
  userId: number,
  email: string,
  secret: string,
  sid: string,
): Promise<string> {
  return sign(userId, email, 'access', ACCESS_TTL, secret, sid);
}

export function signRefreshToken(
  userId: number,
  email: string,
  secret: string,
  sid: string,
): Promise<string> {
  return sign(userId, email, 'refresh', REFRESH_TTL, secret, sid);
}

/** Verifies signature + expiry + issuer; returns null on ANY failure (never throws). */
export async function verifyToken(token: string, secret: string): Promise<TokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { issuer: ISSUER });
    const parsed = claimsSchema.safeParse(payload);
    if (!parsed.success) return null;
    const userId = Number(parsed.data.sub);
    if (!Number.isInteger(userId)) return null;
    return {
      userId,
      email: parsed.data.email,
      typ: parsed.data.typ,
      sid: parsed.data.sid,
    };
  } catch {
    return null;
  }
}
