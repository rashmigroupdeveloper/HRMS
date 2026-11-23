import type { client } from '@/lib/orpc'

// Types and display labels of the Letter templates pages (typed from the API).

export type Template = Awaited<ReturnType<typeof client.letterTemplates.get>>
export type TemplateRow = Awaited<ReturnType<typeof client.letterTemplates.list>>[number]
export type JoiningType = NonNullable<Template['joiningType']>
export type Placeholder = Template['placeholders'][number]
// A block a letter can use (the salary table, the stamp + signature); a table comes with the example the preview prints
export type LetterBlockInfo = Template['blocks'][number]
export type ExampleTable = NonNullable<LetterBlockInfo['example']>
// The letter as a rich-text document (what the editor saves and the backend writes the PDF from)
export type LetterDocument = Template['body']

export const JOINING_TYPE: Record<JoiningType, string> = { REGULAR: 'Regular', CONSULTANT_INTERN: 'Consultant & Intern', OVERSEAS: 'Overseas' }
export type LetterKind = Template['kind']
export const KIND: Record<LetterKind, string> = {
  LETTER_OF_INTENT: 'Letter of Intent',
  OFFER_LETTER: 'Offer letter',
  APPOINTMENT_LETTER: 'Appointment letter',
  CONFIRMATION_LETTER: 'Confirmation letter',
  EXPERIENCE_LETTER: 'Experience letter',
  RELIEVING_LETTER: 'Relieving letter',
  SALARY_CERTIFICATE: 'Salary certificate',
}
// What each letter is for (the templates page), in this order
export const KIND_HINT: Record<LetterKind, string> = {
  LETTER_OF_INTENT: 'Sent to a candidate before the full offer; once accepted, the full offer follows.',
  OFFER_LETTER: 'Sent to a candidate with the salary breakup; accepting it opens the joining form.',
  APPOINTMENT_LETTER: 'Issued to the new employee automatically on the joining day.',
  CONFIRMATION_LETTER: 'Issued by HR when the probation ends and the employee is confirmed.',
  EXPERIENCE_LETTER: 'Issued by HR when the employee leaves.',
  RELIEVING_LETTER: 'Issued by HR on the last working day.',
  SALARY_CERTIFICATE: 'Issued by HR on request - states the salary in effect (e.g. for a bank loan).',
}
export const KIND_ORDER = Object.keys(KIND_HINT) as LetterKind[]
export const isLetterKind = (value: string | null): value is LetterKind => value !== null && value in KIND
