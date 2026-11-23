import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto'
import { env } from '../config/env.js'

// Field-level encryption for sensitive numbers (Aadhaar, PAN, passport, bank account).
// - encrypt / decrypt: AES-256-GCM; stored as "v1:<base64 of iv + auth tag + ciphertext>"
// - fingerprint: keyed HMAC-SHA256, so duplicates can be detected without storing the plain number
// Both keys are derived from DATA_ENCRYPTION_KEY, so only one secret has to be kept safe.

const masterKey = Buffer.from(env.DATA_ENCRYPTION_KEY, 'base64')
const encryptionKey = Buffer.from(hkdfSync('sha256', masterKey, '', 'hrms:field-encryption:v1', 32))
const fingerprintKey = Buffer.from(hkdfSync('sha256', masterKey, '', 'hrms:field-fingerprint:v1', 32))

const VERSION = 'v1'
const IV_LENGTH = 12
const TAG_LENGTH = 16

export function encrypt(plain: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return `${VERSION}:${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64')}`
}

export function decrypt(token: string): string {
  const [version, payload] = token.split(':')
  if (version !== VERSION || !payload) throw new Error('Unsupported encrypted value')
  const data = Buffer.from(payload, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey, data.subarray(0, IV_LENGTH))
  decipher.setAuthTag(data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH))
  return Buffer.concat([decipher.update(data.subarray(IV_LENGTH + TAG_LENGTH)), decipher.final()]).toString('utf8')
}

// Same input -> same fingerprint. Callers normalise first (e.g. strip spaces, upper-case).
export function fingerprint(plain: string): string {
  return createHmac('sha256', fingerprintKey).update(plain).digest('hex')
}

// Last 4 characters, for masked display such as XXXX-XXXX-1234.
export function last4(plain: string): string {
  return plain.slice(-4)
}
