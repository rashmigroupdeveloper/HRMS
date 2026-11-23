import { ORPCError } from '@orpc/server'

// Limits on repeated tries at the password-related APIs (2026-11-16, inspired by the old HRMS): per IP address 300 tries
// in 15 minutes, and per account 5 tries a minute for each action (sign in, forgot / reset password, change password,
// re-enter password). Counted in this process's memory - a restart starts afresh, which is fine for slowing down
// guessing; the lockout after wrong passwords (accounts) still applies on top.

const IP_MAX = 300
const IP_WINDOW_MS = 15 * 60_000
const ACCOUNT_MAX = 5
const ACCOUNT_WINDOW_MS = 60_000

// key -> the times of the tries still inside the window
const tries = new Map<string, number[]>()

function count(key: string, max: number, windowMs: number, now: number) {
  const recent = (tries.get(key) ?? []).filter((at) => at > now - windowMs)
  if (recent.length >= max) {
    tries.set(key, recent)
    const waitSeconds = Math.ceil((recent[0]! + windowMs - now) / 1000)
    throw new ORPCError('TOO_MANY_REQUESTS', {
      message: `Too many tries - wait ${waitSeconds < 60 ? `${waitSeconds} seconds` : `${Math.ceil(waitSeconds / 60)} minutes`} and try again`,
    })
  }
  recent.push(now)
  tries.set(key, recent)
}

// Forget windows that have passed (keeps the map small)
function sweep(now: number) {
  if (tries.size < 10_000) return
  for (const [key, times] of tries) if (!times.some((at) => at > now - IP_WINDOW_MS)) tries.delete(key)
}

// One try of `action` for `account` (employee code / e-mail, any case) from `ip`; throws 429 when over a limit
export function countPasswordTry(action: 'signIn' | 'requestReset' | 'resetWithCode' | 'changePassword' | 'confirmPassword', account: string, ip: string | null) {
  const now = Date.now()
  sweep(now)
  count(`ip:${ip ?? 'unknown'}`, IP_MAX, IP_WINDOW_MS, now)
  count(`${action}:${account.trim().toLowerCase()}`, ACCOUNT_MAX, ACCOUNT_WINDOW_MS, now)
}

// One more try of `action` at this login, whatever name it was reached by (employee code, work e-mail, a former code) - the
// same 5 a minute as for each name (2026-11-23: each name had its own count)
export function countAccountTry(action: 'signIn', accountId: number) {
  count(`${action}:#${accountId}`, ACCOUNT_MAX, ACCOUNT_WINDOW_MS, Date.now())
}
