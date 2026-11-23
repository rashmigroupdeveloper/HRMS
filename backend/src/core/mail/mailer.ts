import { lookup } from 'node:dns/promises'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import nodemailer from 'nodemailer'
import { env } from '../config/env.js'
import { keepForRetry, mailJobs as retryJobs, MAX_TRIES } from './retry.js'

// Outgoing e-mail. With SMTP_HOST set, e-mails go out through that mail server. Without it (development, or until
// IT gives the mail server details) nothing is sent: each e-mail is saved as an .eml file in <STORAGE_DIR>/outbox/
// (open it with any mail program) and a line is logged - so every flow can still be tested end to end.
// sendMail says which happened, so callers never tell HR an e-mail went out when it was only saved. When the mail
// server refuses an e-mail, it is kept and tried again by the worker (retry.ts, 2026-11-16); sendMail still fails, with
// a message saying so.

export type MailAttachment = { filename: string; content: Buffer; contentType: string }

export type Mail = {
  to: string
  subject: string
  // Plain text body (every mail program can show it)
  text: string
  attachments?: MailAttachment[]
}

const OUTBOX = resolve(env.STORAGE_DIR, 'outbox')

const outboxTransport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' })

// The mail server is found with the operating system's lookup (the one browsers use), not nodemailer's own DNS
// queries: on a PC whose DNS list holds a server that never answers (2026-11-20: Windows Internet Connection Sharing
// on 127.0.0.1), nodemailer's queries time out before its own fallback runs, and no e-mail leaves. Looked up on every
// send, so a changed address is picked up; the certificate is still checked against SMTP_HOST (servername).
async function smtpTransport(smtpHost: string) {
  const { address } = await lookup(smtpHost)
  return nodemailer.createTransport({
    host: address,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    tls: { servername: smtpHost },
    ...(env.SMTP_USER && { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }),
  })
}

const transport = () => (env.SMTP_HOST ? smtpTransport(env.SMTP_HOST) : Promise.resolve(outboxTransport))

export async function sendMail(mail: Mail): Promise<'SENT' | 'SAVED_TO_OUTBOX'> {
  let info: unknown
  try {
    info = await (await transport()).sendMail({ from: env.MAIL_FROM, ...mail })
  } catch (error) {
    if (!env.SMTP_HOST) throw error
    await keepForRetry(mail, error).catch((keepError: unknown) => console.error('[mail] could not keep the e-mail for a retry:', keepError))
    throw new Error(`${(error as Error).message} - it will be tried again automatically (up to ${MAX_TRIES} tries)`, { cause: error })
  }
  if (env.SMTP_HOST) return 'SENT'
  // Not sent: keep it in the outbox folder
  await mkdir(OUTBOX, { recursive: true })
  const file = join(OUTBOX, `${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}.eml`)
  await writeFile(file, (info as unknown as { message: Buffer }).message)
  console.info(`[mail] SMTP_HOST is not set - e-mail to ${mail.to} ("${mail.subject}") saved to ${file}`)
  return 'SAVED_TO_OUTBOX'
}

// The worker's job that tries kept e-mails again (src/worker.ts)
async function sendOnly(mail: Mail) {
  await (await transport()).sendMail({ from: env.MAIL_FROM, ...mail })
}
export const mailJobs = retryJobs(sendOnly)
