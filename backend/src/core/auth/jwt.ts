/**
 * JWT utilities — HS256 via jose. Access 15 min, refresh 7 days (docs/02 §1).
 * Kept in core so both the auth module and the (future) authed procedure base
 * can verify without module cross-imports.
 */
import { SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';
const ISSUER = 'hrms-api';

const claimsSchema = z.object({
  sub: z.string(),
  email: z.string(),
  typ: z.enum(['access', 'refresh']),
  sid: z.string().uuid().optional(),
});

export interface TokenClaims {
  userId: number;
  email: string;
  typ: 'access' | 'refresh';
  sid?: string;
}

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

async function sign(
  userId: number,
  email: string,
  typ: 'access' | 'refresh',
  ttl: string | number,
  secret: string,
  sid?: string,
): Promise<string> {
  return new SignJWT({ email, typ, ...(sid ? { sid } : {}) })
    .setJti(randomUUID())
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(key(secret));
}

export function signAccessToken(userId: number, email: string, secret: string, sid?: string, expiresAt?: number): Promise<string> {
  return sign(userId, email, 'access', expiresAt ?? ACCESS_TTL, secret, sid);
}

export function signRefreshToken(userId: number, email: string, secret: string, sid?: string, expiresAt?: number): Promise<string> {
  return sign(userId, email, 'refresh', expiresAt ?? REFRESH_TTL, secret, sid);
}

/** Verifies signature + expiry + issuer; returns null on ANY failure (never throws). */
export async function verifyToken(token: string, secret: string): Promise<TokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { issuer: ISSUER });
    const parsed = claimsSchema.safeParse(payload);
    if (!parsed.success) return null;
    const userId = Number(parsed.data.sub);
    if (!Number.isSafeInteger(userId) || userId <= 0) return null;
    return { userId, email: parsed.data.email, typ: parsed.data.typ, ...(parsed.data.sid ? { sid: parsed.data.sid } : {}) };
  } catch {
    return null;
  }
}
