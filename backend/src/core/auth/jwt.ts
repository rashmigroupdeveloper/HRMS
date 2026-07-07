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
});

export interface TokenClaims {
  userId: number;
  email: string;
  typ: 'access' | 'refresh';
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
): Promise<string> {
  return new SignJWT({ email, typ })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(key(secret));
}

export function signAccessToken(userId: number, email: string, secret: string): Promise<string> {
  return sign(userId, email, 'access', ACCESS_TTL, secret);
}

export function signRefreshToken(userId: number, email: string, secret: string): Promise<string> {
  return sign(userId, email, 'refresh', REFRESH_TTL, secret);
}

/** Verifies signature + expiry + issuer; returns null on ANY failure (never throws). */
export async function verifyToken(token: string, secret: string): Promise<TokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { issuer: ISSUER });
    const parsed = claimsSchema.safeParse(payload);
    if (!parsed.success) return null;
    const userId = Number(parsed.data.sub);
    if (!Number.isInteger(userId)) return null;
    return { userId, email: parsed.data.email, typ: parsed.data.typ };
  } catch {
    return null;
  }
}
