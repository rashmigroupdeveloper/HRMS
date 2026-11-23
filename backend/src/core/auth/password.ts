import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'

// Password hashing with Node's built-in scrypt (memory-hard, so guessing is slow even with a stolen database).
// Stored as "scrypt:<salt base64>:<hash base64>"; the password itself is never stored.

const KEY_LENGTH = 64
const OPTIONS: ScryptOptions = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, OPTIONS, (error, key) => (error ? reject(error) : resolve(key)))
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt)
  return `scrypt:${salt.toString('base64')}:${key.toString('base64')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split(':')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = await derive(password, Buffer.from(salt, 'base64'))
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

// 12 characters from an alphabet without look-alikes (no 0/O, 1/l/I), always with a letter and a digit.
// Used for temporary passwords (a new login, an admin reset) - they must be changed at the next sign-in.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
export function generatePassword(length = 12): string {
  for (;;) {
    const password = Array.from(randomBytes(length), (b) => ALPHABET[b % ALPHABET.length]).join('')
    if (/[A-Za-z]/.test(password) && /\d/.test(password)) return password
  }
}
