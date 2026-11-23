import { outsideTransaction } from '../audit/capture.js'
import { decrypt, encrypt } from '../crypto/encryption.js'
import { createdBy, prisma, SYSTEM_ACTOR, updatedBy } from '../db/prisma.js'
import type { Job } from '../jobs/scheduler.js'
import type { Mail } from './mailer.js'

// Trying a failed e-mail again (2026-11-16, inspired by the old HRMS's mail queue): an e-mail the mail server refused
// is kept (encrypted - it may hold a temporary password or a code) and tried again by the worker after 1, 5, 15 and 60
// minutes - 5 tries in all. Sent: the row goes. After the last try: FAILED, the message wiped, kept 30 days for the
// record. The callers still tell HR the e-mail could not be sent now (and that it will be tried again).

export const MAX_TRIES = 5
const WAIT_MINUTES = [1, 5, 15, 60]
const KEEP_FAILED_DAYS = 30

type StoredMail = Omit<Mail, 'attachments'> & { attachments?: { filename: string; content: string; contentType: string }[] }

const nextAttempt = (tries: number) => new Date(Date.now() + (WAIT_MINUTES[tries - 1] ?? 60) * 60_000)

// Keeps an e-mail that failed on its first try. Saved on its own (not undone with the step that sent it).
export async function keepForRetry(mail: Mail, error: unknown) {
  const stored: StoredMail = { ...mail, attachments: mail.attachments?.map((a) => ({ ...a, content: a.content.toString('base64') })) }
  await outsideTransaction(() =>
    prisma.mailRetry.create({
      data: {
        recipient: mail.to,
        subject: mail.subject.slice(0, 300),
        messageEncrypted: encrypt(JSON.stringify(stored)),
        status: 'PENDING',
        attempts: 1,
        nextAttemptAt: nextAttempt(1),
        lastError: String((error as Error)?.message ?? error).slice(0, 500),
        ...createdBy(SYSTEM_ACTOR),
      },
    }),
  )
}

// The worker: tries the waiting e-mails that are due; removes old failed ones. `send` is the real sending (mailer).
export async function retryDueMails(send: (mail: Mail) => Promise<unknown>) {
  const due = await prisma.mailRetry.findMany({
    where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } },
    orderBy: { nextAttemptAt: 'asc' },
    take: 50,
    select: { id: true, attempts: true, messageEncrypted: true },
  })
  let sent = 0
  let failed = 0
  for (const row of due) {
    const stored = JSON.parse(decrypt(row.messageEncrypted!)) as StoredMail
    const mail: Mail = { ...stored, attachments: stored.attachments?.map((a) => ({ ...a, content: Buffer.from(a.content, 'base64') })) }
    try {
      await send(mail)
      await prisma.mailRetry.delete({ where: { id: row.id } })
      sent++
    } catch (error) {
      const attempts = row.attempts + 1
      const last = attempts >= MAX_TRIES
      if (last) failed++
      await prisma.mailRetry.update({
        where: { id: row.id },
        data: {
          attempts,
          lastError: String((error as Error)?.message ?? error).slice(0, 500),
          ...(last ? { status: 'FAILED', messageEncrypted: null } : { nextAttemptAt: nextAttempt(attempts) }),
          ...updatedBy(SYSTEM_ACTOR),
        },
      })
    }
  }
  const cleared = await prisma.mailRetry.deleteMany({ where: { status: 'FAILED', updatedAt: { lt: new Date(Date.now() - KEEP_FAILED_DAYS * 86_400_000) } } })
  return `${due.length} tried: ${sent} sent, ${failed} gave up${cleared.count ? `; ${cleared.count} old failed removed` : ''}`
}

export function mailJobs(send: (mail: Mail) => Promise<unknown>): Job[] {
  return [{ name: 'mail.retryFailedMails', schedule: { everyMinutes: 1 }, run: () => retryDueMails(send) }]
}
