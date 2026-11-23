import { createHash, randomBytes } from 'node:crypto'
import type { IncomingHttpHeaders } from 'node:http'
import { deleteCookie, getCookie, setCookie } from '@orpc/server/helpers'
import { env } from '../config/env.js'

// Session tokens and the cookie that carries them.
// The browser gets a random token in an httpOnly cookie (JavaScript cannot read it); the database keeps only its
// SHA-256 hash. SameSite=Strict means other websites cannot make the browser send it.

const COOKIE_NAME = 'hrms_session'
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict',
  secure: env.NODE_ENV === 'production',
  // Only API calls need it
  path: '/api',
} as const

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function readSessionToken(headers: IncomingHttpHeaders): string | undefined {
  return getCookie(new Headers({ cookie: headers.cookie ?? '' }), COOKIE_NAME)
}

export function writeSessionCookie(resHeaders: Headers | undefined, token: string, expires: Date): void {
  setCookie(resHeaders, COOKIE_NAME, token, { ...COOKIE_OPTIONS, expires })
}

export function clearSessionCookie(resHeaders: Headers | undefined): void {
  deleteCookie(resHeaders, COOKIE_NAME, COOKIE_OPTIONS)
}

// A candidate's session on their joining-form page (signed in with the offer link + a one-time code) - its own
// cookie, so it never mixes with an employee login in the same browser. No expiry date on the cookie: the server
// ends the session after an hour without use, and the browser drops the cookie when it closes.
const CANDIDATE_COOKIE_NAME = 'hrms_candidate'

export function readCandidateSessionToken(headers: IncomingHttpHeaders): string | undefined {
  return getCookie(new Headers({ cookie: headers.cookie ?? '' }), CANDIDATE_COOKIE_NAME)
}

export function writeCandidateSessionCookie(resHeaders: Headers | undefined, token: string): void {
  setCookie(resHeaders, CANDIDATE_COOKIE_NAME, token, COOKIE_OPTIONS)
}

export function clearCandidateSessionCookie(resHeaders: Headers | undefined): void {
  deleteCookie(resHeaders, CANDIDATE_COOKIE_NAME, COOKIE_OPTIONS)
}
