import type { CurrentUser } from '#core/rpc/procedures'
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { env } from '#core/config/env'
import { prisma, SYSTEM_ACTOR, type ActorId, type EmploymentType, type Salutation } from '#core/db/prisma'
import { sendMail } from '#core/mail/mailer'
import { copyFile, deleteFile, isOldKey, readStoredFile, saveFile, type FilePlace } from '#core/storage/file-storage'
import { employeesService } from '#modules/employees'
import { letterTemplatesService } from '#modules/letter-templates'
import { companiesService } from '#modules/organization'
import { today } from '#shared/utils/dates'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as candidatesService from '../candidates.service.js'
import * as documentsService from '../documents/documents.service.js'
import * as offerLettersRepository from './offer-letters.repository.js'
import type { acceptOnlineInput, declineOnlineInput } from './offer-letters.schema.js'

// The offer letter: written from the template HR picks when sending the offer (its wording and letterhead), frozen as a PDF, e-mailed to the candidate
// with a secret link, and answered by the candidate online (with a one-time code) - or on paper, recorded by HR with
// the signed copy.
//
// - Sending gives the offer its number (RML/OFFER/2026/0001) the first time; every send is a new revision of the
//   letter with the same number. Changing the offer terms after sending moves it back to DRAFT (candidates service).
// - The link works only for the newest letter, while the candidate is OFFERED and the offer is valid.
// - After an online or paper acceptance the same token opens the candidate's joining form (candidates.portal.*) on a
//   page of its own, APP_URL/joining-form/<token>: a one-time code signs them in. HR can send a new link
//   (newLink) while the candidate is ACCEPTED - then it is the joining-form link.
// - Only the SHA-256 of the link token and of the one-time code are stored.

// Stored as offer-letters/<company code>/<offer number>/rev-<n>/<date>_<random>.pdf
// (e.g. offer-letters/RML/RML-OFFER-2026-0001/rev-0/2026-11-13_9e8f7a6b.pdf)
const placeOf = (companyCode: string, offerNumber: string, revision: number): FilePlace => ({
  area: 'offer-letters',
  owner: [companyCode, offerNumber],
  what: `rev-${revision}`,
})
const CODE_MINUTES = 10
const CODE_RESEND_SECONDS = 60
// At most 5 codes in a row; the count starts again once no code was asked for during CODE_WINDOW_MINUTES (the user,
// 2026-11-20 - a candidate whose e-mails do not arrive is not blocked for good), when a code is used, or with HR's new link
const MAX_CODES_PER_LINK = 5
const CODE_WINDOW_MINUTES = 30
const MAX_WRONG_CODES = 5

const SALUTATION: Record<Salutation, string> = { MR: 'Mr.', MS: 'Ms.', MRS: 'Mrs.', DR: 'Dr.' }
const EMPLOYMENT_TYPE: Record<EmploymentType, string> = {
  PERMANENT: 'Permanent',
  CONTRACT: 'Contract',
  TRAINEE: 'Trainee',
  CONSULTANT: 'Consultant',
  APPRENTICE: 'Apprentice',
}

type Candidate = Awaited<ReturnType<typeof candidatesService.getCandidate>>
type LetterRow = NonNullable<Awaited<ReturnType<typeof offerLettersRepository.findById>>>

function conflict(message: string): never {
  throw new ORPCError('CONFLICT', { message })
}

const sha256 = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex')
const newToken = () => randomBytes(32).toString('base64url')
const linkOf = (token: string) => `${env.APP_URL.replace(/\/$/, '')}/offer/${token}`
// the same secret token, on the candidate's joining-form page (after acceptance)
const joiningFormLinkOf = (token: string) => `${env.APP_URL.replace(/\/$/, '')}/joining-form/${token}`
const codeHash = (letterId: number, code: string) => sha256(`${letterId}:${code}`)

const fullName = (c: { firstName: string; middleName: string | null; lastName: string | null }) =>
  [c.firstName, c.middleName, c.lastName].filter(Boolean).join(' ')

// "pr*****@gmail.com" - shown on the candidate's page so they know where the code went
function maskEmail(email: string) {
  const [user = '', domain = ''] = email.split('@')
  return `${user.slice(0, 2)}${'*'.repeat(Math.max(user.length - 2, 3))}@${domain}`
}

const pdfFile = (bytes: Uint8Array, name: string) => new File([new Uint8Array(bytes)], name, { type: 'application/pdf' })
// A letter is the full offer or the Letter of Intent sent before it (2026-11-16)
type SentKind = 'OFFER_LETTER' | 'LETTER_OF_INTENT'
const isLoi = (letter: { kind: string }) => letter.kind === 'LETTER_OF_INTENT'
const LETTER_WORD: Record<SentKind, string> = { OFFER_LETTER: 'offer letter', LETTER_OF_INTENT: 'Letter of Intent' }
const wordOf = (letter: { kind: string }) => LETTER_WORD[letter.kind as SentKind] ?? 'offer letter'
// the number on the letter: the LOI's own, or the offer's
const numberOf = (letter: { kind: string }, candidate: { offerNumber: string | null; loiNumber: string | null }) =>
  (isLoi(letter) ? candidate.loiNumber : candidate.offerNumber) ?? 'offer'
// The revision of the letter among the letters of its kind (0 = the first Letter of Intent / the first full offer)
const revisionOfKind = (letter: { candidateId: number; kind: SentKind | LetterRow['kind']; revision: number }) =>
  offerLettersRepository.countEarlier(letter.candidateId, letter.kind, letter.revision)
const fileNameOf = (offerNumber: string, revision: number, kind: string = 'OFFER_LETTER') =>
  `${kind === 'LETTER_OF_INTENT' ? 'Letter of Intent' : 'Offer letter'} ${offerNumber.replace(/\//g, '-')}${revision > 0 ? ` rev ${revision}` : ''}.pdf`

// --- Writing the letter ---

// The letter PDF of this candidate - the full offer, or the Letter of Intent - with this number
async function writeOfferLetter(candidate: Candidate, offerNumber: string, templateId: number, kind: SentKind = 'OFFER_LETTER') {
  const { money, monthsInWords, letterDate, ctcTable } = letterTemplatesService
  const currency = candidate.ctcCurrency
  const name = fullName(candidate)
  const salutation = candidate.salutation ? SALUTATION[candidate.salutation] : undefined
  const totalCtc = candidate.annualCtc + (candidate.performancePayAnnual ?? 0)
  return letterTemplatesService.writeLetter({
    templateId,
    kind,
    title: `${kind === 'LETTER_OF_INTENT' ? 'Letter of Intent' : 'Offer letter'} ${offerNumber}`,
    values: {
      offer_number: offerNumber,
      loi_number: offerNumber,
      letter_date: letterDate(today()),
      salutation,
      name,
      first_name: candidate.firstName,
      address: candidate.address,
      email: candidate.personalEmail,
      mobile: candidate.mobile,
      company: candidate.company.name,
      designation: candidate.designation.name,
      department: candidate.department?.name,
      grade: candidate.grade?.name,
      location: candidate.workLocation?.name,
      employment_type: EMPLOYMENT_TYPE[candidate.employmentType],
      joining_date: letterDate(candidate.proposedJoiningDate),
      valid_until: letterDate(candidate.offerValidUntil),
      contract_end_date: letterDate(candidate.contractEndDate),
      probation_months: candidate.probationMonths?.toString(),
      notice_probation: monthsInWords(candidate.noticeMonthsProbation),
      notice_confirmed: monthsInWords(candidate.noticeMonthsConfirmed),
      annual_ctc: money(candidate.annualCtc, currency),
      monthly_ctc: money(candidate.annualCtc / 12, currency),
      performance_pay: candidate.performancePayAnnual ? money(candidate.performancePayAnnual, currency) : undefined,
      total_ctc: money(totalCtc, currency),
    },
    blocks: candidate.salaryLines.length
      ? {
          ctc_table: ctcTable({
            name: [salutation, name].filter(Boolean).join(' '),
            designation: candidate.designation.name,
            currency,
            lines: candidate.salaryLines.map((l) => ({ name: l.salaryComponent.name, kind: l.salaryComponent.kind, monthlyAmount: l.monthlyAmount })),
            performancePayAnnual: candidate.performancePayAnnual,
          }),
        }
      : {},
  })
}

// The offer letter templates HR can pick for this offer, and the one to pre-select (a ready one for its joining type)
export async function listTemplatesForOffer(candidateId: number, kind: SentKind = 'OFFER_LETTER', viewer: CurrentUser) {
  const candidate = await candidatesService.getCandidateFor(viewer, candidateId)
  const list = await letterTemplatesService.listTemplatesToSend(kind, candidate.joiningType)
  // a Letter of Intent only before the full offer: from a draft whose LOI was not accepted yet
  return { ...list, canSendLoi: candidate.status === 'DRAFT' && !candidate.loiAcceptedAt && !candidate.offerNumber }
}

// The kind of letter a template writes (only the full offer and the Letter of Intent are sent to candidates)
async function sentKindOf(templateId: number): Promise<SentKind> {
  const { kind } = await letterTemplatesService.getTemplate(templateId)
  if (kind !== 'OFFER_LETTER' && kind !== 'LETTER_OF_INTENT') throw new ORPCError('BAD_REQUEST', { message: 'Pick an offer letter or Letter of Intent template' })
  return kind
}

// The letter as it would be sent now from template `templateId` (the number is filled in when it is sent).
// BAD_REQUEST lists what is missing.
export async function previewOfferLetter(candidateId: number, templateId: number, viewer: CurrentUser) {
  const candidate = await candidatesService.getCandidateFor(viewer, candidateId)
  const kind = await sentKindOf(templateId)
  const number = (kind === 'LETTER_OF_INTENT' ? candidate.loiNumber : candidate.offerNumber) ?? '(given when sent)'
  const pdf = await writeOfferLetter(candidate, number, templateId, kind)
  return pdfFile(pdf, `${kind === 'LETTER_OF_INTENT' ? 'Letter of Intent' : 'Offer letter'} preview.pdf`)
}

// --- E-mails ---

// E-mails the letter and the link. Never fails the step it belongs to: the offer is already sent - on a mail error
// HR sees the message and can share the link or send a new one. When the server has no mail server set up
// (SMTP_HOST), the e-mail is only saved to the outbox: HR is told it was not sent, and it is not recorded as e-mailed.
async function emailLetter(candidate: Candidate, letter: LetterRow, offerNumber: string, token: string, pdf: Uint8Array, actorId: ActorId) {
  if (!candidate.personalEmail) return { emailedTo: null, emailError: null }
  const salutation = candidate.salutation ? `${SALUTATION[candidate.salutation]} ` : ''
  const rev = await revisionOfKind(letter)
  let result: Awaited<ReturnType<typeof sendMail>>
  try {
    result = await sendMail({
      to: candidate.personalEmail,
      subject: `${isLoi(letter) ? 'Letter of Intent' : 'Offer letter'} from ${candidate.company.name}`,
      text: [
        `Dear ${salutation}${fullName(candidate)},`,
        '',
        `Please find attached our ${wordOf(letter)} (${offerNumber}) for the position of ${candidate.designation.name} at ${candidate.company.name}.` +
          (rev > 0 ? ' It replaces the letter sent to you earlier.' : ''),
        ...(isLoi(letter) ? ['', 'Once you accept it, we will send you the full offer letter with all the terms.'] : []),
        '',
        `To accept or decline ${isLoi(letter) ? 'it' : 'the offer'}, open this link:`,
        linkOf(token),
        '',
        `The offer is valid until ${letterTemplatesService.letterDate(candidate.offerValidUntil)}. For any question, reply to this e-mail.`,
        '',
        'Regards,',
        `HR - ${candidate.company.name}`,
      ].join('\n'),
      attachments: [{ filename: fileNameOf(offerNumber, rev, letter.kind), content: Buffer.from(pdf), contentType: 'application/pdf' }],
    })
  } catch (error) {
    console.error(error)
    return { emailedTo: null, emailError: `The e-mail could not be sent: ${(error as Error).message}` }
  }
  if (result === 'SAVED_TO_OUTBOX') {
    return { emailedTo: null, emailError: 'E-mail is not set up on the server, so nothing was e-mailed (saved in the outbox folder).' }
  }
  await offerLettersRepository.update(letter.id, { emailedAt: new Date(), emailedById: actorId }, actorId)
  return { emailedTo: candidate.personalEmail, emailError: null }
}

// --- HR: sending and the letters of an offer ---

// DRAFT -> OFFERED: writes the letter (a new revision), stores it, gives the offer its number the first time, and
// e-mails the letter with the candidate's link. Returns the link once - only its hash is kept.
export async function sendOffer(candidateId: number, templateId: number, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  const candidate = await candidatesService.getCandidateFor(viewer, candidateId, 'WRITE')
  const kind = await sentKindOf(templateId)
  candidatesService.assertCanSend(candidate, kind)
  const token = newToken()
  let storageKey: string | undefined
  let result
  try {
    result = await prisma.$transaction(
      async (tx) => {
        // the LOI and the full offer each have their own number, given the first time
        let offerNumber = kind === 'LETTER_OF_INTENT' ? candidate.loiNumber : candidate.offerNumber
        if (!offerNumber) {
          const company = await companiesService.getCompany(candidate.company.id, tx)
          offerNumber = await letterTemplatesService.nextLetterNumber(company, kind, actorId, tx)
        }
        const pdf = new Uint8Array(await writeOfferLetter(candidate, offerNumber, templateId, kind))
        const latest = await offerLettersRepository.findLatest(candidateId, tx)
        const revision = latest ? latest.revision + 1 : 0
        storageKey = await saveFile(placeOf(candidate.company.code, offerNumber, revision), 'application/pdf', pdf)
        const letter = await offerLettersRepository.create(
          {
            candidateId,
            revision,
            kind,
            letterTemplateId: templateId,
            storageKey,
            sha256: sha256(pdf),
            sentAt: new Date(),
            sentById: actorId,
            linkTokenHash: sha256(token),
          },
          actorId,
          tx,
        )
        const updated =
          kind === 'LETTER_OF_INTENT'
            ? await candidatesService.recordLoiSent(candidateId, offerNumber, actorId, tx)
            : await candidatesService.recordOfferSent(candidateId, offerNumber, actorId, tx)
        return { letter, updated, pdf, offerNumber }
      },
      // writing the PDF takes a moment
      { timeout: 30_000 },
    )
  } catch (error) {
    // the letter's row rolled back -> no orphan file. Only here: once saved, the row points at the file, so a step
    // failing after it never deletes it (2026-11-23, the review)
    if (storageKey) await deleteFile(storageKey).catch(() => undefined)
    throw error
  }
  const email = await emailLetter(result.updated, result.letter, result.offerNumber, token, result.pdf, actorId)
  return { candidate: await candidatesService.toCandidateDetails(result.updated), link: linkOf(token), ...email }
}

// Gives letters stored before the readable names (offer-letters/<uuid>) their readable name. For
// scripts/rename-stored-files.ts; returns how many were renamed.
export async function renameOldFiles(actorId: ActorId) {
  let renamed = 0
  for (const row of await offerLettersRepository.listStorageKeys()) {
    if (!isOldKey(row.storageKey)) continue
    const place = placeOf(row.candidate.company.code, row.candidate.offerNumber ?? 'no-number', row.revision)
    const storageKey = await copyFile(row.storageKey, place, { type: 'application/pdf', storedOn: row.createdAt })
    try {
      await offerLettersRepository.update(row.id, { storageKey }, actorId)
    } catch (error) {
      await deleteFile(storageKey)
      throw error
    }
    await deleteFile(row.storageKey)
    renamed++
  }
  return renamed
}

// A new link for the newest letter (the old link stops working), e-mailed again. Also gives the candidate fresh
// one-time codes. While the offer is open; after acceptance (ACCEPTED) it is the link to the joining-form page.
export async function newLink(candidateId: number, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  const candidate = await candidatesService.getCandidateFor(viewer, candidateId, 'WRITE')
  if (candidate.status === 'ACCEPTED') return sendPortalLink(candidateId, actorId)
  candidatesService.assertCanAnswer(candidate)
  const letter = await offerLettersRepository.findLatest(candidateId)
  if (!letter) conflict('This offer has no letter yet - send the offer first')
  const token = newToken()
  const updated = await offerLettersRepository.update(
    letter.id,
    { linkTokenHash: sha256(token), otpHash: null, otpValidUntil: null, otpFailedAttempts: 0, otpSentCount: 0, otpSentAt: null, otpSentById: null },
    actorId,
  )
  const pdf = new Uint8Array(await readStoredFile(letter.storageKey))
  const email = await emailLetter(candidate, updated, numberOf(updated, candidate), token, pdf, actorId)
  return { link: linkOf(token), ...email }
}

// After acceptance: a new link to the candidate's joining form (the old one stops working), e-mailed to them -
// with HR's reason when the form was sent back. HR sees whether the e-mail went out, as for the offer e-mail.
export async function sendPortalLink(candidateId: number, actorId: ActorId, sentBackReason?: string) {
  const candidate = await candidatesService.getCandidate(candidateId)
  if (candidate.status !== 'ACCEPTED') conflict(`The joining form link is only for an accepted offer; this candidate is ${candidate.status}`)
  const letter = await offerLettersRepository.findLatest(candidateId)
  if (!letter) conflict('This offer has no letter yet - send the offer first')
  const token = newToken()
  await prisma.$transaction(async (tx) => {
    await offerLettersRepository.update(
      letter.id,
      { linkTokenHash: sha256(token), otpHash: null, otpValidUntil: null, otpFailedAttempts: 0, otpSentCount: 0, otpSentAt: null, otpSentById: null },
      actorId,
      tx,
    )
    // an offer whose joining form waits for HR (joiningFormOnAcceptance false) opens it now
    await candidatesService.recordJoiningFormOpened(candidateId, actorId, tx)
    // whoever is signed in with the old link is signed out (2026-11-23: a forwarded link's session stayed open)
    await candidatesService.endPortalSessions(candidateId, tx)
  })
  if (!candidate.personalEmail) return { link: joiningFormLinkOf(token), emailedTo: null, emailError: null }
  const salutation = candidate.salutation ? `${SALUTATION[candidate.salutation]} ` : ''
  let result: Awaited<ReturnType<typeof sendMail>>
  try {
    result = await sendMail({
      to: candidate.personalEmail,
      subject: sentBackReason ? `Please update your joining form - ${candidate.company.name}` : `Your joining form - ${candidate.company.name}`,
      text: [
        `Dear ${salutation}${fullName(candidate)},`,
        '',
        ...(sentBackReason
          ? ['HR has looked at your joining form and asks you to change the following:', '', sentBackReason, '', 'Please make the changes and submit the form again:']
          : ['Please fill in your joining form and upload your documents here:']),
        joiningFormLinkOf(token),
        '',
        'This link replaces any link sent to you earlier. You will get a one-time code by e-mail to open it.',
        '',
        'Regards,',
        `HR - ${candidate.company.name}`,
      ].join('\n'),
    })
  } catch (error) {
    console.error(error)
    return { link: joiningFormLinkOf(token), emailedTo: null, emailError: `The e-mail could not be sent: ${(error as Error).message}` }
  }
  if (result === 'SAVED_TO_OUTBOX') {
    return { link: joiningFormLinkOf(token), emailedTo: null, emailError: 'E-mail is not set up on the server, so nothing was e-mailed (saved in the outbox folder).' }
  }
  return { link: joiningFormLinkOf(token), emailedTo: candidate.personalEmail, emailError: null }
}

// Every letter sent for this offer, newest first, with the candidate's online answer and its proof
export async function listOfferLetters(candidateId: number, viewer: CurrentUser) {
  await candidatesService.getCandidateFor(viewer, candidateId)
  const rows = await offerLettersRepository.listByCandidate(candidateId)
  const person = await employeesService.lookupPeople(rows.flatMap((r) => [r.sentById, r.emailedById]))
  return rows.map((r, i) => ({
    id: r.id,
    revision: r.revision,
    // the full offer or the Letter of Intent (2026-11-16)
    kind: r.kind,
    // the template it was written from
    template: r.letterTemplate,
    // the newest letter - the only one the candidate can still answer
    isCurrent: i === 0,
    sha256: r.sha256,
    sentAt: r.sentAt,
    sentBy: person(r.sentById),
    emailedAt: r.emailedAt,
    emailedBy: person(r.emailedById),
    response: r.response,
    respondedAt: r.respondedAt,
    responseName: r.responseName,
    responseIp: r.responseIp,
    responseUserAgent: r.responseUserAgent,
    declineReason: r.declineReason,
  }))
}

async function getLetter(id: number) {
  const letter = await offerLettersRepository.findById(id)
  if (!letter) throw new ORPCError('NOT_FOUND', { message: `No offer letter found with id ${id}` })
  return letter
}

// One sent letter, exactly as sent
export async function downloadOfferLetter(id: number, viewer: CurrentUser) {
  const letter = await getLetter(id)
  const candidate = await candidatesService.getCandidateFor(viewer, letter.candidateId)
  return pdfFile(await readStoredFile(letter.storageKey), fileNameOf(numberOf(letter, candidate), await revisionOfKind(letter), letter.kind))
}

// OFFERED -> ACCEPTED on paper: HR first uploads the signed copy (document SIGNED_OFFER_LETTER) as proof.
export async function acceptOnPaper(candidateId: number, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  const candidate = await candidatesService.getCandidateFor(viewer, candidateId, 'WRITE')
  candidatesService.assertCanAnswer(candidate)
  // the newest letter says what was accepted: the Letter of Intent (the full offer follows) or the offer; its signed
  // copy is uploaded after it was sent (a signed Letter of Intent does not accept the full offer)
  const latest = await offerLettersRepository.findLatest(candidateId)
  if (!(await documentsService.hasDocument(candidateId, 'SIGNED_OFFER_LETTER', latest?.sentAt))) {
    throw new ORPCError('BAD_REQUEST', { message: 'Upload the signed letter first (document "Signed offer letter")' })
  }
  const accepted = latest && isLoi(latest) ? await candidatesService.recordLoiAccepted(candidateId, actorId) : await candidatesService.recordOfferAccepted(candidateId, actorId)
  return candidatesService.toCandidateDetails(accepted)
}

// --- The candidate's page (public): everything goes through the secret link ---

type LinkState = 'OPEN' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'REPLACED' | 'CLOSED'

async function findByToken(token: string) {
  const letter = await offerLettersRepository.findByTokenHash(sha256(token))
  if (!letter) throw new ORPCError('NOT_FOUND', { message: 'This link is not valid. Ask HR for a new one.' })
  const candidate = await candidatesService.getCandidate(letter.candidateId)
  const latest = await offerLettersRepository.findLatest(letter.candidateId)
  let state: LinkState = 'OPEN'
  // an accepted letter whose offer was closed afterwards (withdrawn, backed out, no-show...) is closed, not accepted
  // (2026-11-23, the review: a withdrawn candidate still saw "accepted")
  if (letter.response === 'ACCEPTED' && candidatesService.isClosed(candidate.status)) state = 'CLOSED'
  else if (letter.response) state = letter.response
  // a newer letter was sent, or HR is preparing one (the offer went back to draft)
  else if (letter.id !== latest?.id || candidate.status === 'DRAFT') state = 'REPLACED'
  // accepted on paper (HR recorded it with the signed copy): the link opens the joining form like an online acceptance
  else if (candidate.status === 'ACCEPTED') state = 'ACCEPTED'
  // a Letter of Intent accepted on paper (the full offer is still to come)
  else if (isLoi(letter) && candidate.status === 'LOI_ACCEPTED') state = 'ACCEPTED'
  else if (candidate.status !== 'OFFERED') state = 'CLOSED'
  else if (candidate.offerValidUntil && candidate.offerValidUntil < today()) state = 'EXPIRED'
  // only the newest letter's link opens the joining form (2026-11-23: an accepted Letter of Intent's link kept opening it,
  // and HR's "new link" could not stop it)
  return { letter, candidate, state, isLatest: letter.id === latest?.id }
}

function assertOpen(state: LinkState) {
  const message: Record<Exclude<LinkState, 'OPEN'>, string> = {
    ACCEPTED: 'You have already accepted this letter.',
    DECLINED: 'You have already declined this offer.',
    EXPIRED: 'This offer has expired. Please contact HR.',
    REPLACED: 'This letter has been replaced by a newer one. Please use the link in the latest e-mail.',
    CLOSED: 'This offer is no longer open. Please contact HR.',
  }
  if (state !== 'OPEN') conflict(message[state])
}

// What the candidate's page shows
export async function viewByToken(token: string) {
  const { letter, candidate, state, isLatest } = await findByToken(token)
  return {
    state,
    // the full offer or the Letter of Intent (2026-11-16), and the number on it
    kind: letter.kind as SentKind,
    offerNumber: numberOf(letter, candidate),
    // among the letters of its kind
    revision: await revisionOfKind(letter),
    sentAt: letter.sentAt,
    name: [candidate.salutation ? SALUTATION[candidate.salutation] : null, fullName(candidate)].filter(Boolean).join(' '),
    // what the candidate must type to accept
    fullName: fullName(candidate),
    company: candidate.company.name,
    designation: candidate.designation.name,
    joiningDate: candidate.proposedJoiningDate,
    validUntil: candidate.offerValidUntil,
    // where the one-time code goes; none = the offer can only be answered on paper / through HR
    codeEmail: candidate.personalEmail ? maskEmail(candidate.personalEmail) : null,
    respondedAt: letter.respondedAt,
    // accepted and not joined yet: the link opens the candidate's joining form (candidates.portal.*)
    joiningFormOpen: isPortalOpen(state, candidate, isLatest),
    // after accepting the offer, what the page tells the candidate (it shows no joining-form button - 2026-11-20):
    // EMAILED = the link to the joining form was e-mailed to them; FROM_HR = HR will send it
    joiningFormNext: state === 'ACCEPTED' && candidate.status === 'ACCEPTED' ? (candidate.joiningFormOpenedAt ? ('EMAILED' as const) : ('FROM_HR' as const)) : null,
  }
}

export async function downloadByToken(token: string) {
  const { letter, candidate } = await findByToken(token)
  return pdfFile(await readStoredFile(letter.storageKey), fileNameOf(numberOf(letter, candidate), await revisionOfKind(letter), letter.kind))
}

// E-mails a 6-digit code (valid 10 minutes) to the candidate's address; a new one at most every 60 seconds and
// at most 5 in a row (again after 30 minutes without a code). The candidate does not wait for the mail server: the code is saved, the e-mail is started in
// the background and the answer is "sent" at once. A failed e-mail is only logged on the server - the candidate
// asks for a new code after a minute (unlike HR's offer e-mail, where HR is told whether it went out).
// After acceptance the same code signs the candidate in to their joining form, and signs the submitted form.
export async function sendCode(token: string) {
  const { letter, candidate, state, isLatest } = await findByToken(token)
  const forJoiningForm = isPortalOpen(state, candidate, isLatest)
  if (!forJoiningForm) assertOpen(state)
  if (!candidate.personalEmail) conflict('There is no e-mail address for you on this offer. Please contact HR.')
  if (letter.otpSentAt && Date.now() - letter.otpSentAt.getTime() < CODE_RESEND_SECONDS * 1000) {
    conflict('A code was sent less than a minute ago. Please wait a moment before asking for another.')
  }
  // the count of codes in a row: it starts again after CODE_WINDOW_MINUTES without a code
  const windowEnds = letter.otpSentAt ? letter.otpSentAt.getTime() + CODE_WINDOW_MINUTES * 60_000 : 0
  const sentInRow = windowEnds > Date.now() ? letter.otpSentCount : 0
  if (sentInRow >= MAX_CODES_PER_LINK) {
    const minutes = Math.ceil((windowEnds - Date.now()) / 60_000)
    conflict(`Too many codes were asked for. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or ask HR for a new link.`)
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const now = new Date()
  await offerLettersRepository.update(
    letter.id,
    {
      otpHash: codeHash(letter.id, code),
      otpValidUntil: new Date(now.getTime() + CODE_MINUTES * 60_000),
      otpFailedAttempts: 0,
      otpSentCount: sentInRow + 1,
      otpSentAt: now,
      otpSentById: SYSTEM_ACTOR,
    },
    SYSTEM_ACTOR,
  )
  void sendMail({
    to: candidate.personalEmail,
    subject: forJoiningForm ? `Your code for your joining form - ${candidate.company.name}` : `Your code to answer the offer from ${candidate.company.name}`,
    text: [
      `Your one-time code is ${code}`,
      '',
      `It is valid for ${CODE_MINUTES} minutes. If you did not ask for it, you can ignore this e-mail.`,
    ].join('\n'),
  }).catch((error: unknown) => console.error(`[mail] the one-time code e-mail for offer letter ${letter.id} failed:`, error))
  return { sentTo: maskEmail(candidate.personalEmail), validMinutes: CODE_MINUTES }
}

// Checks the code; a wrong one counts, and after 5 wrong tries the code stops working (ask for a new one)
async function checkCode(letter: LetterRow, code: string) {
  if (!letter.otpHash || !letter.otpValidUntil || letter.otpValidUntil < new Date()) {
    throw new ORPCError('BAD_REQUEST', { message: 'The code has expired or was not requested. Ask for a new code.' })
  }
  // every try is counted before the code is compared (a right one is cleared by codeUsed)
  const tries = await offerLettersRepository.takeCodeTry(letter.id, letter.otpHash, MAX_WRONG_CODES, SYSTEM_ACTOR)
  if (tries === null) throw new ORPCError('BAD_REQUEST', { message: 'Too many wrong tries - ask for a new code.' })
  const expected = Buffer.from(letter.otpHash, 'hex')
  const given = Buffer.from(codeHash(letter.id, code), 'hex')
  if (timingSafeEqual(expected, given)) {
    await offerLettersRepository.giveBackCodeTry(letter.id, SYSTEM_ACTOR)
    return
  }
  const failed = tries
  const dead = failed >= MAX_WRONG_CODES
  if (dead) await offerLettersRepository.update(letter.id, { otpHash: null, otpValidUntil: null }, SYSTEM_ACTOR)
  throw new ORPCError('BAD_REQUEST', {
    message: dead ? 'Wrong code. Too many wrong tries - ask for a new code.' : `Wrong code. ${MAX_WRONG_CODES - failed} tries left.`,
  })
}

// After acceptance the link opens the joining form while the candidate is ACCEPTED (until joining / withdrawal) - once
// it was opened for them: at acceptance, or by HR sending its link (joiningFormOnAcceptance, 2026-11-20)
function isPortalOpen(state: LinkState, candidate: Candidate, isLatest: boolean) {
  return isLatest && state === 'ACCEPTED' && candidate.status === 'ACCEPTED' && candidate.joiningFormOpenedAt !== null
}

// A used code is cleared; the count of codes sent starts again, so the candidate can sign in again on later days
function codeUsed(letterId: number) {
  return offerLettersRepository.update(letterId, { otpHash: null, otpValidUntil: null, otpFailedAttempts: 0, otpSentCount: 0 }, SYSTEM_ACTOR)
}

// Signing in to the joining form: the link (of an accepted offer, candidate still ACCEPTED) + the code.
// Returns the candidate's id.
export async function checkJoiningFormCode(token: string, code: string) {
  const { letter, candidate, state, isLatest } = await findByToken(token)
  if (!isPortalOpen(state, candidate, isLatest)) {
    conflict(state === 'OPEN' ? 'The joining form opens once you have accepted the offer.' : 'Your joining form is closed. Please contact HR.')
  }
  await checkCode(letter, code)
  await codeUsed(letter.id)
  return candidate.id
}

// Signing the submitted joining form: the code e-mailed to the signed-in candidate (asked for on their page). Only
// checked here - signingCodeUsed clears it once the form is saved, so a submit refused after the check keeps the code
// (2026-11-23, the review: a failed submit used it up)
export async function checkSigningCode(candidateId: number, code: string) {
  const letter = await offerLettersRepository.findLatest(candidateId)
  if (!letter) conflict('Your joining form is closed. Please contact HR.')
  await checkCode(letter, code)
}

// The form was submitted with the code: the code is used
export async function signingCodeUsed(candidateId: number) {
  const letter = await offerLettersRepository.findLatest(candidateId)
  if (letter) await codeUsed(letter.id)
}

const sameName = (a: string, b: string) => a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase()

type Proof = { ip: string | null; userAgent: string | null }

// The candidate accepts online: right code + their full name typed as on the letter. The offer becomes ACCEPTED
// (by System); the letter keeps the proof (name, time, IP, browser) next to the SHA-256 of the exact PDF, and the
// candidate is e-mailed the accepted letter with that proof.
export async function acceptOnline({ token, code, name }: z.infer<typeof acceptOnlineInput>, proof: Proof) {
  const { letter, candidate, state } = await findByToken(token)
  assertOpen(state)
  await checkCode(letter, code)
  if (!sameName(name, fullName(candidate))) {
    throw new ORPCError('BAD_REQUEST', { message: `Type your full name exactly as it is on the letter: ${fullName(candidate)}` })
  }
  const acceptedAt = new Date()
  await prisma.$transaction(async (tx) => {
    await offerLettersRepository.update(
      letter.id,
      {
        response: 'ACCEPTED',
        respondedAt: acceptedAt,
        respondedById: SYSTEM_ACTOR,
        responseName: name.trim(),
        responseIp: proof.ip,
        responseUserAgent: proof.userAgent?.slice(0, 500) ?? null,
        // the code is used: cleared, and the count of codes starts again (as codeUsed), so the codes asked for while
        // answering do not use up the joining form's (2026-11-20)
        otpHash: null,
        otpValidUntil: null,
        otpFailedAttempts: 0,
        otpSentCount: 0,
      },
      SYSTEM_ACTOR,
      tx,
    )
    if (isLoi(letter)) await candidatesService.recordLoiAccepted(candidate.id, SYSTEM_ACTOR, tx)
    else await candidatesService.recordOfferAccepted(candidate.id, SYSTEM_ACTOR, tx)
  })
  void emailAcceptance(candidate, letter, token, { acceptedAt, name: name.trim(), ip: proof.ip }).catch((error: unknown) =>
    console.error(`[mail] the acceptance e-mail for offer letter ${letter.id} failed:`, error),
  )
  return viewByToken(token)
}

const acceptedTime = (date: Date) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(date) + ' IST'

// After an online acceptance: the candidate gets their own copy of what they accepted - the letter itself and the
// proof. A copy outside our system: if the stored letter (or its SHA-256) were ever changed, it would no longer match.
// Started in the background like the code e-mail (the candidate does not wait); a failure is only logged.
async function emailAcceptance(candidate: Candidate, letter: LetterRow, token: string, accepted: { acceptedAt: Date; name: string; ip: string | null }) {
  const offerNumber = numberOf(letter, candidate)
  const loi = isLoi(letter)
  const rev = await revisionOfKind(letter)
  const pdf = await readStoredFile(letter.storageKey)
  const salutation = candidate.salutation ? `${SALUTATION[candidate.salutation]} ` : ''
  await sendMail({
    to: candidate.personalEmail!,
    subject: `You have accepted the ${loi ? 'Letter of Intent' : 'offer'} from ${candidate.company.name} (${offerNumber})`,
    text: [
      `Dear ${salutation}${fullName(candidate)},`,
      '',
      `Thank you for accepting our ${loi ? 'Letter of Intent' : 'offer'} for the position of ${candidate.designation.name} at ${candidate.company.name}.`,
      'This e-mail is your record of the acceptance. The letter you accepted is attached - please keep it.',
      '',
      `${loi ? 'Letter of Intent:' : 'Offer letter:    '} ${offerNumber}${rev > 0 ? ` (revision ${rev})` : ''}`,
      `Accepted on:      ${acceptedTime(accepted.acceptedAt)}`,
      `Name typed:       ${accepted.name}`,
      `From IP address:  ${accepted.ip ?? 'not known'}`,
      `Confirmed with:   a one-time code sent to ${candidate.personalEmail}`,
      `Letter SHA-256:   ${letter.sha256}`,
      '',
      'The SHA-256 is the fingerprint of the attached PDF: any change to the file would change it.',
      '',
      ...(loi
        ? ['Next step: we will send you the full offer letter with all the terms.', 'If you did not accept this Letter of Intent, reply to this e-mail at once.']
        : [
            `Your joining date is ${letterTemplatesService.letterDate(candidate.proposedJoiningDate)}.`,
            '',
            ...(candidate.joiningFormOnAcceptance
              ? ['Next step: please fill in your joining form and upload your documents here:', joiningFormLinkOf(token)]
              : ['Next step: HR will send you the link to your joining form, where you fill in your details and upload your documents.']),
            'If you did not accept this offer, reply to this e-mail at once.',
          ]),
      '',
      'Regards,',
      `HR - ${candidate.company.name}`,
    ].join('\n'),
    attachments: [{ filename: fileNameOf(offerNumber, rev, letter.kind), content: Buffer.from(pdf), contentType: 'application/pdf' }],
  })
}

// The candidate declines online (right code; reason optional). The offer becomes DECLINED (by System).
export async function declineOnline({ token, code, reason }: z.infer<typeof declineOnlineInput>, proof: Proof) {
  const { letter, candidate, state } = await findByToken(token)
  assertOpen(state)
  await checkCode(letter, code)
  await prisma.$transaction(async (tx) => {
    await offerLettersRepository.update(
      letter.id,
      {
        response: 'DECLINED',
        respondedAt: new Date(),
        respondedById: SYSTEM_ACTOR,
        responseIp: proof.ip,
        responseUserAgent: proof.userAgent?.slice(0, 500) ?? null,
        declineReason: reason ?? null,
        otpHash: null,
        otpValidUntil: null,
      },
      SYSTEM_ACTOR,
      tx,
    )
    await candidatesService.recordOfferDeclined(candidate.id, reason ? `Declined online: ${reason}` : 'Declined online', SYSTEM_ACTOR, tx)
  })
  return viewByToken(token)
}
