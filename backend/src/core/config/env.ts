import { existsSync } from 'node:fs'
import { z } from 'zod'

// Load backend/.env in development (Node built-in). In production the real environment is used. Not in the tests: vitest.config.ts
// has loaded it already and taken SMTP_HOST out so tests never send real e-mail - loading it again here put it back
// (found 2026-11-23: test runs were talking to the real mail server).
if (existsSync('.env') && process.env.NODE_ENV !== 'test') process.loadEnvFile('.env')

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5200),
  // The one account permitted to use Master Control. Unset = disabled; the account's current work email must also
  // be core_developers@rashmigroup.com. Pinning the id prevents an editable email from granting this capability.
  MASTER_CONTROL_ACCOUNT_ID: z.coerce.number().int().positive().optional(),
  APP_RELEASE: z.string().trim().min(1).max(100).optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // Only for the automated tests (vitest.config.ts runs them with DATABASE_URL set to this) - never read by the app.
  // Its database name must end in _test: the tests add their own data to it on every run.
  TEST_DATABASE_URL: z.string().min(1).optional(),
  CORS_ORIGIN: z.string().default('http://localhost:5180'),
  // 32 random bytes, base64. Encrypts Aadhaar / PAN / passport / bank account numbers.
  // Losing it makes that data unreadable - back it up somewhere safe, never commit it.
  DATA_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, 'base64').length === 32, 'DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded'),
  // Folder for uploaded files (documents), relative to the backend folder or absolute. Back it up with the database.
  STORAGE_DIR: z.string().min(1).default('storage'),
  // Address of the web app as candidates open it - links in e-mails: the offer APP_URL/offer/<token>, the joining form
  // APP_URL/joining-form/<token>
  APP_URL: z.url().default('http://localhost:5180'),
  // Outgoing e-mail (offer letters, one-time codes). Without SMTP_HOST, .eml files are saved in STORAGE_DIR/outbox
  // instead of being sent (development / until IT gives the mail server details).
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  // true = TLS from the start (port 465); false = STARTTLS (port 587)
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  // Sender shown to candidates, e.g. "Rashmi Group HR <hr@rashmigroup.com>"
  MAIL_FROM: z.string().min(1).default('HRMS <no-reply@localhost>'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error(`Invalid environment variables:\n${z.prettifyError(parsed.error)}`)
  process.exit(1)
}

export const env = parsed.data
