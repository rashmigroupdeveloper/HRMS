import { ORPCError } from '@orpc/client'

// Errors on the candidate's pages (offer + joining form). The candidate is outside the company, so they only see
// messages written for them: the answer of an expected failure (wrong code, missing field...), the field messages of
// a validation error (without the internal field paths), or a general line - never a server's internal description.

export function candidateMessage(error: unknown): string {
  if (error instanceof TypeError) return 'Cannot reach the server. Check your internet connection and try again.'
  if (error instanceof ORPCError) {
    const issues = (error.data as { issues?: { message: string }[] } | undefined)?.issues
    if (issues?.length) return [...new Set(issues.map((issue) => issue.message))].join(' · ')
    if (error.status < 500) return error.message
  }
  return 'Something went wrong on our side. Please try again in a few minutes - if it keeps happening, contact HR.'
}
