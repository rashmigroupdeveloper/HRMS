import type { CurrentUser } from '#core/rpc/procedures'
import { assertGroupWide } from '#core/auth/scope'
import { prisma, type ActorId, type JoiningType, type LetterKind, type SalaryComponentKind, type DbClient } from '#core/db/prisma'
import { markupToDocument, renderLetterPdf, type LetterNode, type PdfBlock, type PdfCell, type PdfTable } from '#core/pdf/letter-pdf'
import { copyFile, deleteFile, isOldKey, namedOwner, readStoredFile, saveFile, type FilePlace } from '#core/storage/file-storage'
import { employeesService } from '#modules/employees'
import { cleanFileName, detectFileType } from '#shared/utils/file-type'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as letterTemplatesRepository from './letter-templates.repository.js'
import {
  TEMPLATE_IMAGE_PARTS,
  type createTemplateInput,
  type letterheadImageInput,
  type listLetterheadImagesInput,
  type previewTemplateInput,
  type setTemplateImageInput,
  type templateImageIdsSchema,
  type updateTemplateInput,
  type uploadTemplateImageInput,
} from './letter-templates.schema.js'

// Business rules for letter templates: the wording of the letters, edited by HR in a page-like editor, and writing a
// letter from it. A template is a rich-text document (core/pdf/letter-pdf.ts) with `field` tags - each kind of letter
// has its own fields (PLACEHOLDERS) - and `letterBlock`s (BLOCKS: the salary table, the stamp + signature). A field marked
// `optional` that has no value takes its whole line out (e.g. "Email ID: [e-mail]" for a candidate without e-mail);
// any other empty field stops the letter with a list of what is missing.
// The body is stored as the document's JSON; templates saved before the editor existed are plain text with a small
// markup and are read with markupToDocument (they become JSON when saved again).
// A template also carries its letterhead (header, footer, stamp + signature images): a template is a complete letter,
// and HR picks one when sending an offer (decided 2026-11-13). Its joining type only pre-selects it.

type Placeholder = { name: string; label: string; optional?: boolean }

// The fields of every letter to an employee (2026-11-16)
const EMPLOYEE_PLACEHOLDERS: Placeholder[] = [
  { name: 'letter_number', label: 'Letter number' },
  { name: 'letter_date', label: 'Date of the letter' },
  { name: 'salutation', label: 'Salutation (Mr. / Ms. ...)' },
  { name: 'name', label: 'Full name' },
  { name: 'first_name', label: 'First name' },
  { name: 'employee_code', label: 'Employee code' },
  { name: 'address', label: 'Address (present, else permanent - its line is left out when there is none)', optional: true },
  { name: 'company', label: 'Company name' },
  { name: 'designation', label: 'Designation' },
  { name: 'department', label: 'Department' },
  { name: 'grade', label: 'Grade' },
  { name: 'location', label: 'Work location' },
  { name: 'employment_type', label: 'Employment type' },
  { name: 'joining_date', label: 'Date of joining' },
  { name: 'probation_end_date', label: 'Probation ends on (its line is left out when there is none)', optional: true },
  { name: 'contract_end_date', label: 'Contract ends on (its line is left out when there is none)', optional: true },
]
const SALARY_PLACEHOLDERS: Placeholder[] = [
  { name: 'notice_probation', label: 'Notice period during probation, e.g. "one month"', optional: true },
  { name: 'notice_confirmed', label: 'Notice period after confirmation, e.g. "one month"', optional: true },
  { name: 'annual_ctc', label: 'Fixed CTC per year' },
  { name: 'monthly_ctc', label: 'Fixed CTC per month' },
  { name: 'performance_pay', label: 'Performance pay per year' },
  { name: 'total_ctc', label: 'Total CTC per year (fixed + performance pay)' },
]
const SIGNATURE_BLOCK = { name: 'signature', label: "Stamp + signature of the company's signatory" }
const CTC_BLOCK = { name: 'ctc_table', label: 'Salary breakup table (Annexure-I)' }

export const PLACEHOLDERS: Record<LetterKind, Placeholder[]> = {
  OFFER_LETTER: [
    { name: 'offer_number', label: 'Offer number' },
    { name: 'letter_date', label: 'Date of the letter' },
    { name: 'salutation', label: 'Salutation (Mr. / Ms. ...)' },
    { name: 'name', label: 'Full name' },
    { name: 'first_name', label: 'First name' },
    { name: 'address', label: 'Address' },
    { name: 'email', label: 'Personal e-mail (its line is left out when there is none)', optional: true },
    { name: 'mobile', label: 'Mobile' },
    { name: 'company', label: 'Company name' },
    { name: 'designation', label: 'Designation' },
    { name: 'department', label: 'Department' },
    { name: 'grade', label: 'Grade' },
    { name: 'location', label: 'Work location (initial posting)' },
    { name: 'employment_type', label: 'Employment type' },
    { name: 'joining_date', label: 'Joining date' },
    { name: 'valid_until', label: 'Offer valid until' },
    { name: 'contract_end_date', label: 'Contract end date' },
    { name: 'probation_months', label: 'Probation (months)' },
    { name: 'notice_probation', label: 'Notice period during probation, e.g. "one month"' },
    { name: 'notice_confirmed', label: 'Notice period after confirmation, e.g. "one month"' },
    { name: 'annual_ctc', label: 'Fixed CTC per year' },
    { name: 'monthly_ctc', label: 'Fixed CTC per month' },
    { name: 'performance_pay', label: 'Performance pay per year' },
    { name: 'total_ctc', label: 'Total CTC per year (fixed + performance pay)' },
  ],
  // Sent before the full offer (2026-11-16) - usually without the salary breakup
  LETTER_OF_INTENT: [
    { name: 'loi_number', label: 'Letter of Intent number' },
    { name: 'letter_date', label: 'Date of the letter' },
    { name: 'salutation', label: 'Salutation (Mr. / Ms. ...)' },
    { name: 'name', label: 'Full name' },
    { name: 'first_name', label: 'First name' },
    { name: 'address', label: 'Address' },
    { name: 'email', label: 'Personal e-mail (its line is left out when there is none)', optional: true },
    { name: 'mobile', label: 'Mobile' },
    { name: 'company', label: 'Company name' },
    { name: 'designation', label: 'Designation' },
    { name: 'department', label: 'Department' },
    { name: 'grade', label: 'Grade' },
    { name: 'location', label: 'Work location' },
    { name: 'employment_type', label: 'Employment type' },
    { name: 'joining_date', label: 'Expected joining date' },
    { name: 'valid_until', label: 'Accept by (valid until)' },
    { name: 'annual_ctc', label: 'Fixed CTC per year' },
    { name: 'total_ctc', label: 'Total CTC per year (fixed + performance pay)' },
  ],
  APPOINTMENT_LETTER: [...EMPLOYEE_PLACEHOLDERS, ...SALARY_PLACEHOLDERS],
  CONFIRMATION_LETTER: [...EMPLOYEE_PLACEHOLDERS, { name: 'confirmation_date', label: 'Confirmed from (confirmation date)' }],
  EXPERIENCE_LETTER: [...EMPLOYEE_PLACEHOLDERS, { name: 'last_working_day', label: 'Last working day' }],
  RELIEVING_LETTER: [...EMPLOYEE_PLACEHOLDERS, { name: 'last_working_day', label: 'Last working day (relieved at the close of it)' }],
  // the salary in effect on the letter date (old HRMS, 2026-11-16)
  SALARY_CERTIFICATE: [...EMPLOYEE_PLACEHOLDERS, ...SALARY_PLACEHOLDERS],
}

// The blocks a letter can show (whole-width parts filled in when the letter is written)
export const BLOCKS: Record<LetterKind, { name: string; label: string }[]> = {
  OFFER_LETTER: [CTC_BLOCK, SIGNATURE_BLOCK],
  LETTER_OF_INTENT: [SIGNATURE_BLOCK],
  APPOINTMENT_LETTER: [CTC_BLOCK, SIGNATURE_BLOCK],
  CONFIRMATION_LETTER: [SIGNATURE_BLOCK],
  EXPERIENCE_LETTER: [SIGNATURE_BLOCK],
  RELIEVING_LETTER: [SIGNATURE_BLOCK],
  SALARY_CERTIFICATE: [CTC_BLOCK, SIGNATURE_BLOCK],
}

// The code of each kind in its letter numbers: RML/OFFER/2026/0001, RML/APPT/2026/0001...
const NUMBER_CODE: Record<LetterKind, string> = {
  OFFER_LETTER: 'OFFER',
  LETTER_OF_INTENT: 'LOI',
  APPOINTMENT_LETTER: 'APPT',
  CONFIRMATION_LETTER: 'CONF',
  EXPERIENCE_LETTER: 'EXP',
  RELIEVING_LETTER: 'REL',
  SALARY_CERTIFICATE: 'SAL',
}

// The next number of a letter of this kind for the company: <e-code prefix>/<kind code>/<year>/<running number of the
// company, kind and year> - one series per kind (2026-11-16). Call it in the transaction that saves the letter.
export async function nextLetterNumber(company: { id: number; ecodePrefix: string }, kind: LetterKind, actorId: ActorId, db?: DbClient) {
  const year = new Date().getFullYear()
  const next = await letterTemplatesRepository.nextNumber(company.id, kind, year, actorId, db)
  return `${company.ecodePrefix}/${NUMBER_CODE[kind]}/${year}/${String(next).padStart(4, '0')}`
}

// The words of a letter: placeholder name -> value (missing / empty = not available)
export type LetterValues = Record<string, string | null | undefined>

const SIGNATURE_WIDTH = 110

function badRequest(message: string): never {
  throw new ORPCError('BAD_REQUEST', { message })
}

// Every node of a document, depth first
function* nodesOf(node: LetterNode): Generator<LetterNode> {
  yield node
  for (const child of node.content ?? []) yield* nodesOf(child)
}
const nameOf = (node: LetterNode) => String(node.attrs?.name ?? '')

// Fields and blocks the letter kind does not have
function checkBody(kind: LetterKind, doc: LetterNode) {
  const fields = new Set(PLACEHOLDERS[kind].map((p) => p.name))
  const blocks = new Set(BLOCKS[kind].map((b) => b.name))
  const unknown = new Set<string>()
  for (const node of nodesOf(doc)) {
    if (node.type === 'field' && !fields.has(nameOf(node))) unknown.add(nameOf(node))
    if (node.type === 'letterBlock' && !blocks.has(nameOf(node))) unknown.add(nameOf(node))
  }
  if (unknown.size) badRequest(`Unknown fields in the letter: ${[...unknown].join(', ')}`)
}

// The stored body as a document (older templates are text with markup)
function documentOf(body: string): LetterNode {
  return body.trimStart().startsWith('{') ? (JSON.parse(body) as LetterNode) : markupToDocument(body)
}

// --- Formatting helpers for the values of a letter ---

const NUMBER_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']

// 1 -> "one month", 3 -> "three months"
export function monthsInWords(months: number | null | undefined): string | undefined {
  if (months === null || months === undefined) return undefined
  const words = NUMBER_WORDS[months] ?? String(months)
  return `${words} ${months === 1 ? 'month' : 'months'}`
}

// A calendar date as printed on letters: "01 Sep 2025"
export function letterDate(date: Date | null | undefined): string | undefined {
  if (!date) return undefined
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

// 840000 -> "8,40,000.00" for INR (Indian grouping), "840,000.00" otherwise
export function money(amount: number, currency: string): string {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

export type CtcTableInput = {
  name: string
  designation: string
  currency: string
  // monthly amounts; annual = monthly x 12
  lines: { name: string; kind: SalaryComponentKind; monthlyAmount: number }[]
  performancePayAnnual: number | null
}

// Annexure-I of the offer letter: the salary breakup with its sub-totals, as on the printed RML letter
export function ctcTable({ name, designation, currency, lines, performancePayAnnual }: CtcTableInput): PdfTable {
  const sum = (kind?: SalaryComponentKind) => lines.filter((l) => !kind || l.kind === kind).reduce((total, l) => total + l.monthlyAmount, 0)
  const row = (label: string, monthly: number | null, options: { bold?: boolean; shaded?: boolean } = {}): PdfCell[] => [
    { text: label, ...options },
    { text: monthly === null ? '' : money(monthly, currency), align: 'center', ...options },
    { text: monthly === null ? '' : money(monthly * 12, currency), align: 'center', ...options },
  ]
  const fixed = sum()
  const totalCtc = fixed * 12 + (performancePayAnnual ?? 0)
  return {
    kind: 'table',
    widths: ['*', 120, 120],
    rows: [
      [{ text: 'Name', bold: true, shaded: true }, { text: name, bold: true, align: 'center', colSpan: 2, shaded: true }],
      [{ text: 'Designation', bold: true, shaded: true }, { text: designation, bold: true, align: 'center', colSpan: 2, shaded: true }],
      [
        { text: 'CTC', bold: true, shaded: true },
        { text: `Monthly (In ${currency})`, bold: true, align: 'center', shaded: true },
        { text: `Annual (In ${currency})`, bold: true, align: 'center', shaded: true },
      ],
      row(`FIXED CTC Amount in ${currency}`, fixed, { bold: true }),
      ...lines.filter((l) => l.kind === 'EARNING').map((l) => row(l.name, l.monthlyAmount)),
      row('Monthly Gross', sum('EARNING'), { shaded: true }),
      ...lines.filter((l) => l.kind === 'EMPLOYER_CONTRIBUTION').map((l) => row(l.name, l.monthlyAmount)),
      row('Total', fixed, { bold: true, shaded: true }),
      ...(performancePayAnnual
        ? [
            [{ text: 'In addition to the above you will also be eligible for target-oriented earnings based on your performance.', align: 'center' as const, colSpan: 3 }],
            [
              { text: 'Performance pay (Target Oriented Earnings)', align: 'right' as const, colSpan: 2 },
              { text: money(performancePayAnnual, currency), align: 'center' as const },
            ],
          ]
        : []),
      [
        { text: 'Total CTC', bold: true, align: 'center', colSpan: 2, shaded: true },
        { text: money(totalCtc, currency), bold: true, align: 'center', shaded: true },
      ],
    ],
  }
}

// --- Templates (the "Letter templates" page) ---

type TemplateRow = NonNullable<Awaited<ReturnType<typeof letterTemplatesRepository.findById>>>
type ImageRef = { storageKey: string } | null
// A template's letterhead: the image ids, and the images with their storage keys
type TemplateImages = {
  headerImageId: number | null
  footerImageId: number | null
  signatureImageId: number | null
  headerImage: ImageRef
  footerImage: ImageRef
  signatureImage: ImageRef
}
type ImagePart = (typeof TEMPLATE_IMAGE_PARTS)[number]

// Stored as letter-templates/<id>-<name>/<part>/<date>_<random>.<ext> (e.g. letter-templates/1-offer-letter/HEADER/...)
const imagePlace = (template: { id: number; name: string }, part: ImagePart): FilePlace => ({
  area: 'letter-templates',
  owner: [namedOwner(template.id, template.name)],
  what: part,
})
const IMAGE_COLUMN = { HEADER: 'headerImageId', FOOTER: 'footerImageId', SIGNATURE: 'signatureImageId' } as const satisfies Record<
  ImagePart,
  keyof TemplateImages
>

// For the API: the storage keys stay inside - whether each letterhead image is there, the image ids (to show them -
// `letterTemplates.image`), and `ready` = all three (a letter can be sent from it)
function withImages<T extends TemplateImages>(template: T) {
  const { headerImageId, footerImageId, signatureImageId, headerImage, footerImage, signatureImage, ...row } = template
  const images = { header: headerImageId !== null, footer: footerImageId !== null, signature: signatureImageId !== null }
  const imageIds = { header: headerImageId, footer: footerImageId, signature: signatureImageId }
  return { ...row, images, imageIds, ready: images.header && images.footer && images.signature }
}

async function getTemplateRow(id: number) {
  const template = await letterTemplatesRepository.findById(id)
  if (!template) throw new ORPCError('NOT_FOUND', { message: `No letter template found with id ${id}` })
  return template
}

// The blocks a letter of this kind can use, for the editor: name, label and - for a table - the example table the
// preview PDF prints (the editor shows it on the page, so the pages break where the preview's do)
function blocksOf(kind: LetterKind) {
  return BLOCKS[kind].map((block) => ({ ...block, example: EXAMPLE_TABLES[kind][block.name] ?? null }))
}

// For the API: the body as a document, who created / last changed it, as { employeeCode, name }, and the fields and
// blocks it may use
async function toTemplate({ createdById, updatedById, body, ...template }: TemplateRow) {
  const person = await employeesService.lookupPeople([createdById, updatedById])
  return {
    ...withImages(template),
    body: documentOf(body),
    placeholders: PLACEHOLDERS[template.kind],
    blocks: blocksOf(template.kind),
    createdBy: person(createdById),
    updatedBy: person(updatedById),
  }
}

// Every kind of letter with the fields and blocks its templates may use - for a new template of that kind (2026-11-16)
export function listKinds() {
  return (Object.keys(PLACEHOLDERS) as LetterKind[]).map((kind) => ({ kind, placeholders: PLACEHOLDERS[kind], blocks: blocksOf(kind) }))
}

export async function listTemplates() {
  const rows = await letterTemplatesRepository.list()
  const person = await employeesService.lookupPeople(rows.map((r) => r.updatedById))
  return rows.map(({ updatedById, ...row }) => ({
    ...withImages(row),
    placeholders: PLACEHOLDERS[row.kind],
    blocks: blocksOf(row.kind),
    updatedBy: person(updatedById),
  }))
}

export async function getTemplate(id: number) {
  return toTemplate(await getTemplateRow(id))
}

export async function createTemplate({ body, imageIds, ...input }: z.infer<typeof createTemplateInput>, actorId: ActorId) {
  checkBody(input.kind, body)
  const images = await checkImageIds(imageIds)
  return toTemplate(await letterTemplatesRepository.create({ ...input, ...images, body: JSON.stringify(body) }, actorId))
}

// Letters already sent keep their wording - they are stored as PDFs.
export async function updateTemplate({ id, body, ...changes }: z.infer<typeof updateTemplateInput>, actorId: ActorId) {
  const current = await getTemplateRow(id)
  if (body !== undefined) checkBody(current.kind, body)
  return toTemplate(await letterTemplatesRepository.update(id, { ...changes, ...(body !== undefined && { body: JSON.stringify(body) }) }, actorId))
}

// --- Letterhead images (kept, never erased; one image can serve several templates) ---

// The image with this id, or NOT_FOUND
async function getImageRow(imageId: number) {
  const image = await letterTemplatesRepository.findImage(imageId)
  if (!image) throw new ORPCError('NOT_FOUND', { message: `No letterhead image found with id ${imageId}` })
  return image
}

// Picked image ids -> the template's columns; each must exist and be of its part
async function checkImageIds(imageIds: z.infer<typeof templateImageIdsSchema> | undefined) {
  const columns: Partial<Record<(typeof IMAGE_COLUMN)[ImagePart], number>> = {}
  for (const part of TEMPLATE_IMAGE_PARTS) {
    const imageId = imageIds?.[PART_FIELD[part]]
    if (imageId === undefined) continue
    const image = await getImageRow(imageId)
    if (image.part !== part) badRequest(`Image ${imageId} is a ${image.part.toLowerCase()} image, not a ${part.toLowerCase()} image`)
    columns[IMAGE_COLUMN[part]] = imageId
  }
  return columns
}

const PART_FIELD = { HEADER: 'header', FOOTER: 'footer', SIGNATURE: 'signature' } as const satisfies Record<ImagePart, string>

// A new letterhead image for the template (cut from the printed letterhead), PNG or JPEG only. The image it replaces
// is kept - it can be picked again (setImage).
export async function uploadImage({ id, part, file }: z.infer<typeof uploadTemplateImageInput>, actorId: ActorId) {
  const current = await getTemplateRow(id)
  const bytes = new Uint8Array(await file.arrayBuffer())
  const type = detectFileType(bytes)
  if (type !== 'image/png' && type !== 'image/jpeg') badRequest('Upload the letterhead as a PNG or JPG image')
  const storageKey = await saveFile(imagePlace(current, part), type, bytes)
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const image = await letterTemplatesRepository.createImage({ part, storageKey, fileName: cleanFileName(file.name, 'image'), mimeType: type }, actorId, tx)
      return letterTemplatesRepository.update(id, { [IMAGE_COLUMN[part]]: image.id }, actorId, tx)
    })
    return toTemplate(updated)
  } catch (error) {
    await deleteFile(storageKey) // nothing was saved -> no orphan file
    throw error
  }
}

// Uses an image already uploaded (for this or another template) as the template's header / footer / stamp.
export async function setImage({ id, part, imageId }: z.infer<typeof setTemplateImageInput>, actorId: ActorId) {
  await getTemplateRow(id)
  const columns = await checkImageIds({ [PART_FIELD[part]]: imageId })
  return toTemplate(await letterTemplatesRepository.update(id, columns, actorId))
}

// The uploaded images of one part, newest first, with who uploaded them and the templates using them
export async function listImages({ part }: z.infer<typeof listLetterheadImagesInput>) {
  const rows = await letterTemplatesRepository.listImages(part)
  const person = await employeesService.lookupPeople(rows.map((r) => r.createdById))
  return rows.map(({ createdById, headerOf, footerOf, signatureOf, ...image }) => ({
    ...image,
    uploadedBy: person(createdById),
    usedBy: [...headerOf, ...footerOf, ...signatureOf],
  }))
}

// Gives letterhead images stored before the readable names (letterheads/<uuid>) their readable name. For
// scripts/rename-stored-files.ts; returns how many were renamed.
export async function renameOldFiles(actorId: ActorId) {
  let renamed = 0
  for (const image of await letterTemplatesRepository.listImageKeys()) {
    if (!isOldKey(image.storageKey)) continue
    // stored under a template that uses it (an unused one under its own id)
    const template = [...image.headerOf, ...image.footerOf, ...image.signatureOf][0]
    const place = template ? imagePlace(template, image.part) : { area: 'letter-templates', owner: [`image-${image.id}`], what: image.part }
    const type = image.mimeType === 'image/jpeg' ? 'image/jpeg' : 'image/png'
    const storageKey = await copyFile(image.storageKey, place, { type })
    try {
      await letterTemplatesRepository.updateImage(image.id, { storageKey }, actorId)
    } catch (error) {
      await deleteFile(storageKey)
      throw error
    }
    await deleteFile(image.storageKey)
    renamed++
  }
  return renamed
}

// One letterhead image as a file (the template page, thumbnails when picking).
export async function getImage({ imageId }: z.infer<typeof letterheadImageInput>) {
  const image = await getImageRow(imageId)
  return new File([new Uint8Array(await readStoredFile(image.storageKey))], image.fileName, { type: image.mimeType })
}

// --- Sending: which template ---

// The active templates of `kind` HR can pick from, and the one to pre-select: a ready one (all images) for the
// joining type, else a ready one for any joining type, else the first ready one
export async function listTemplatesToSend(kind: LetterKind, joiningType: JoiningType) {
  const templates = (await letterTemplatesRepository.listActive(kind)).map((t) => {
    const { id, name, joiningType: type, ready } = withImages(t)
    return { id, name, joiningType: type, ready }
  })
  const ready = templates.filter((t) => t.ready)
  const suggested = ready.find((t) => t.joiningType === joiningType) ?? ready.find((t) => t.joiningType === null) ?? ready[0]
  return { templates, suggestedId: suggested?.id ?? null }
}

// --- Writing a letter ---

// The letterhead images (a missing one is undefined)
type Letterhead = { header: ImageRef; footer: ImageRef; signature: ImageRef }
async function readImages(letterhead: Letterhead) {
  const read = async (image: ImageRef) => (image ? new Uint8Array(await readStoredFile(image.storageKey)) : undefined)
  const [header, footer, signature] = await Promise.all([read(letterhead.header), read(letterhead.footer), read(letterhead.signature)])
  return { header, footer, signature }
}

const letterheadOf = (template: TemplateImages): Letterhead => ({
  header: template.headerImage,
  footer: template.footerImage,
  signature: template.signatureImage,
})

// The document with every field replaced by its words. A line (up to a line break) with an empty optional field is
// left out - and a paragraph that is left empty that way too; any other empty field or a block without content is
// listed in `missing`.
function fillIn(kind: LetterKind, doc: LetterNode, values: LetterValues, blocks: Record<string, PdfBlock>) {
  const fields = new Map(PLACEHOLDERS[kind].map((p) => [p.name, p]))
  const blockLabels = new Map(BLOCKS[kind].map((b) => [b.name, b.label]))
  const missing = new Set<string>()
  // one line of a value: a line break inside it (e.g. an address) becomes ", "
  const valueOf = (name: string) => values[name]?.trim().replace(/\s*\n\s*/g, ', ') || undefined
  const droppedLine = (line: LetterNode[]) => line.some((n) => n.type === 'field' && fields.get(nameOf(n))?.optional && !valueOf(nameOf(n)))

  function inline(nodes: LetterNode[]): LetterNode[] {
    const lines: LetterNode[][] = [[]]
    for (const node of nodes) {
      if (node.type === 'hardBreak') lines.push([])
      else lines.at(-1)!.push(node)
    }
    return lines
      .filter((line) => !droppedLine(line))
      .flatMap((line, i) => [
        ...(i > 0 ? [{ type: 'hardBreak' }] : []),
        ...line.map((node): LetterNode => {
          if (node.type !== 'field') return node
          const value = valueOf(nameOf(node))
          if (!value) missing.add(fields.get(nameOf(node))?.label ?? nameOf(node))
          return { type: 'text', text: value ?? '', marks: node.marks }
        }),
      ])
  }

  function walk(node: LetterNode): LetterNode | null {
    if (node.type === 'letterBlock' && !blocks[nameOf(node)]) missing.add(blockLabels.get(nameOf(node)) ?? nameOf(node))
    if (node.type === 'paragraph') {
      const had = (node.content ?? []).length > 0
      const content = inline(node.content ?? [])
      // a paragraph whose every line was left out disappears (an empty paragraph stays an empty line)
      return had && content.length === 0 ? null : { ...node, content }
    }
    if (!node.content) return node
    return { ...node, content: node.content.map(walk).filter((n): n is LetterNode => n !== null) }
  }

  return { doc: walk(doc)!, missing }
}

async function render(options: {
  kind: LetterKind
  body: LetterNode
  values: LetterValues
  blocks: Record<string, PdfBlock>
  // the letterhead images used (none: no letterhead)
  images?: Letterhead | undefined
  // a real letter must have the full letterhead; a preview shows whatever there is
  requireLetterhead: boolean
  title: string
}) {
  const { kind, body, values, title } = options
  const blocks = { ...options.blocks }
  const letterhead = options.images ? await readImages(options.images) : undefined
  if (options.requireLetterhead && !(letterhead?.header && letterhead.footer && letterhead.signature)) {
    badRequest("This template has no complete letterhead - upload its header, footer and stamp + signature on the Letter templates page")
  }
  blocks.signature = letterhead?.signature
    ? { kind: 'image', data: letterhead.signature, width: SIGNATURE_WIDTH }
    : { kind: 'note', text: '[stamp + signature - not uploaded for this template yet]' }

  const { doc, missing } = fillIn(kind, body, values, blocks)
  if (missing.size) badRequest(`The letter needs: ${[...missing].join(', ')}`)
  return renderLetterPdf({ doc, blocks, header: letterhead?.header, footer: letterhead?.footer, title })
}

// A letter of `kind` from the active template `templateId` (its wording and letterhead), filled with `values`.
// BAD_REQUEST: the template is retired / of another kind, has no complete letterhead, or the letter needs something
// that is missing (listed).
export async function writeLetter(options: {
  templateId: number
  kind: LetterKind
  values: LetterValues
  blocks: Record<string, PdfBlock>
  title: string
}) {
  const template = await getTemplateRow(options.templateId)
  if (!template.isActive || template.kind !== options.kind) badRequest(`"${template.name}" cannot be used - pick an active template of this kind of letter`)
  return render({ ...options, body: documentOf(template.body), images: letterheadOf(template), requireLetterhead: true })
}

function EXAMPLE_EMPLOYEE(letterNumber: string): LetterValues {
  return {
    letter_number: letterNumber,
    letter_date: letterDate(new Date()),
    salutation: 'Mr.',
    name: 'Rahul Kumar Sharma',
    first_name: 'Rahul',
    employee_code: 'RML035384',
    address: '12 Park Street, Kolkata, West Bengal - 700016',
    company: 'Rashmi Metaliks Limited',
    designation: 'Junior Graduate Engineer',
    department: 'Production',
    grade: 'M1',
    location: 'Kharagpur',
    employment_type: 'Permanent',
    joining_date: '01 Dec 2026',
    probation_end_date: '31 May 2027',
    contract_end_date: undefined,
  }
}
const EXAMPLE_SALARY: LetterValues = {
  notice_probation: 'one month',
  notice_confirmed: 'one month',
  annual_ctc: money(840000, 'INR'),
  monthly_ctc: money(70000, 'INR'),
  performance_pay: money(120000, 'INR'),
  total_ctc: money(960000, 'INR'),
}

const EXAMPLE_VALUES: Record<LetterKind, LetterValues> = {
  OFFER_LETTER: {
    offer_number: 'RML/OFFER/2026/0001',
    letter_date: letterDate(new Date()),
    salutation: 'Mr.',
    name: 'Rahul Kumar Sharma',
    first_name: 'Rahul',
    address: '12 Park Street, Kolkata, West Bengal - 700016',
    email: 'rahul.sharma@example.com',
    mobile: '9876543210',
    company: 'Rashmi Metaliks Limited',
    designation: 'Junior Graduate Engineer',
    department: 'Production',
    grade: 'M1',
    location: 'Kharagpur',
    employment_type: 'Permanent',
    joining_date: '01 Dec 2026',
    valid_until: '20 Nov 2026',
    contract_end_date: '30 Nov 2027',
    probation_months: '6',
    notice_probation: 'one month',
    notice_confirmed: 'one month',
    annual_ctc: money(840000, 'INR'),
    monthly_ctc: money(70000, 'INR'),
    performance_pay: money(120000, 'INR'),
    total_ctc: money(960000, 'INR'),
  },
  LETTER_OF_INTENT: {
    loi_number: 'RML/LOI/2026/0001',
    letter_date: letterDate(new Date()),
    salutation: 'Mr.',
    name: 'Rahul Kumar Sharma',
    first_name: 'Rahul',
    address: '12 Park Street, Kolkata, West Bengal - 700016',
    email: 'rahul.sharma@example.com',
    mobile: '9876543210',
    company: 'Rashmi Metaliks Limited',
    designation: 'Junior Graduate Engineer',
    department: 'Production',
    grade: 'M1',
    location: 'Kharagpur',
    employment_type: 'Permanent',
    joining_date: '01 Dec 2026',
    valid_until: '20 Nov 2026',
    annual_ctc: money(840000, 'INR'),
    total_ctc: money(960000, 'INR'),
  },
  APPOINTMENT_LETTER: { ...EXAMPLE_EMPLOYEE('RML/APPT/2026/0001'), ...EXAMPLE_SALARY },
  CONFIRMATION_LETTER: { ...EXAMPLE_EMPLOYEE('RML/CONF/2027/0001'), confirmation_date: '01 Jun 2027' },
  EXPERIENCE_LETTER: { ...EXAMPLE_EMPLOYEE('RML/EXP/2029/0001'), last_working_day: '31 Mar 2029' },
  RELIEVING_LETTER: { ...EXAMPLE_EMPLOYEE('RML/REL/2029/0001'), last_working_day: '31 Mar 2029' },
  SALARY_CERTIFICATE: { ...EXAMPLE_EMPLOYEE('RML/SAL/2027/0001'), ...EXAMPLE_SALARY },
}

const EXAMPLE_LINES: CtcTableInput['lines'] = [
  { name: 'Basic', kind: 'EARNING', monthlyAmount: 21000 },
  { name: 'HRA', kind: 'EARNING', monthlyAmount: 10500 },
  { name: 'Conveyance', kind: 'EARNING', monthlyAmount: 2000 },
  { name: 'Special Allowance', kind: 'EARNING', monthlyAmount: 32970 },
  { name: 'Employer Contribution to PF', kind: 'EMPLOYER_CONTRIBUTION', monthlyAmount: 2520 },
  { name: 'Employer Contribution to Gratuity', kind: 'EMPLOYER_CONTRIBUTION', monthlyAmount: 1010 },
]

// The example tables of each kind of letter (in the preview PDF and on the editor's page)
const EXAMPLE_CTC = () => ctcTable({ name: 'Mr. Rahul Kumar Sharma', designation: 'Junior Graduate Engineer', currency: 'INR', lines: EXAMPLE_LINES, performancePayAnnual: 120000 })
const EXAMPLE_TABLES: Record<LetterKind, Partial<Record<string, PdfTable>>> = {
  OFFER_LETTER: { ctc_table: EXAMPLE_CTC() },
  LETTER_OF_INTENT: {},
  APPOINTMENT_LETTER: { ctc_table: EXAMPLE_CTC() },
  CONFIRMATION_LETTER: {},
  EXPERIENCE_LETTER: {},
  RELIEVING_LETTER: {},
  SALARY_CERTIFICATE: { ctc_table: EXAMPLE_CTC() },
}

// The (possibly unsaved) wording filled with example values, as a PDF
export async function previewTemplate({ kind, body, id, imageIds }: z.infer<typeof previewTemplateInput>) {
  checkBody(kind, body)
  // a saved template: its own letterhead; a new one: the images picked for it
  const picked = async (imageId: number | undefined): Promise<ImageRef> => (imageId ? { storageKey: (await getImageRow(imageId)).storageKey } : null)
  const images = id
    ? letterheadOf(await getTemplateRow(id))
    : { header: await picked(imageIds?.header), footer: await picked(imageIds?.footer), signature: await picked(imageIds?.signature) }
  const example = EXAMPLE_VALUES[kind]
  const pdf = await render({
    kind,
    body,
    values: example,
    blocks: EXAMPLE_TABLES[kind] as Record<string, PdfBlock>,
    images,
    requireLetterhead: false,
    title: 'Letter preview',
  })
  return new File([new Uint8Array(pdf)], 'letter-preview.pdf', { type: 'application/pdf' })
}

// --- From the API (data access, A4 2026-11-18): the letters are the same for every company - Letter templates Edit for all companies ---
export async function createTemplateFor(viewer: CurrentUser, input: z.infer<typeof createTemplateInput>) {
  assertGroupWide(viewer, 'LETTER_TEMPLATES', 'A letter template')
  return createTemplate(input, viewer.employeeId)
}
export async function updateTemplateFor(viewer: CurrentUser, input: z.infer<typeof updateTemplateInput>) {
  assertGroupWide(viewer, 'LETTER_TEMPLATES', 'A letter template')
  return updateTemplate(input, viewer.employeeId)
}
export async function uploadImageFor(viewer: CurrentUser, input: z.infer<typeof uploadTemplateImageInput>) {
  assertGroupWide(viewer, 'LETTER_TEMPLATES', 'A letter template')
  return uploadImage(input, viewer.employeeId)
}
export async function setImageFor(viewer: CurrentUser, input: z.infer<typeof setTemplateImageInput>) {
  assertGroupWide(viewer, 'LETTER_TEMPLATES', 'A letter template')
  return setImage(input, viewer.employeeId)
}
