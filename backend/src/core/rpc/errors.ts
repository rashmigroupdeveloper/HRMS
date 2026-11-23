import { ORPCError, ValidationError } from '@orpc/server'
import { ZodError } from 'zod'
import { Prisma } from '../db/prisma.js'

type Issue = { path?: readonly (PropertyKey | { key: PropertyKey })[]; message: string }
const toIssues = (issues: readonly Issue[]) =>
  issues.map((issue) => ({
    path: (issue.path ?? []).map((p) => String(typeof p === 'object' ? p.key : p)).join('.'),
    message: issue.message,
  }))

// Turns known errors into clean API errors the frontend can show.
// Anything else becomes a generic 500 - oRPC hides its details from the client.
export function toApiError(error: unknown): unknown {
  // Input failed its zod schema -> 400 with a list of { path, message }
  if (error instanceof ORPCError && error.code === 'BAD_REQUEST' && error.cause instanceof ValidationError) {
    return new ORPCError('BAD_REQUEST', { message: 'Validation failed', data: { issues: toIssues(error.cause.issues) }, cause: error.cause })
  }
  // A service validated data again with a module's schema (e.g. the candidate's form with the kept numbers put back,
  // or the joining day creating the employee) -> the same 400
  if (error instanceof ZodError) {
    return new ORPCError('BAD_REQUEST', { message: 'Validation failed', data: { issues: toIssues(error.issues) }, cause: error })
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return new ORPCError('CONFLICT', { message: 'A record with this value already exists', cause: error })
    }
    if (error.code === 'P2003') {
      return new ORPCError('CONFLICT', { message: 'Related record is missing or still in use', cause: error })
    }
    if (error.code === 'P2025') {
      return new ORPCError('NOT_FOUND', { message: 'Record not found', cause: error })
    }
    // a rule written into a migration by hand, reported with Postgres's own code: an exclusion constraint (e.g. two HOD
    // appointments of a post overlapping in time) or a check constraint
    const postgresCode = (error.meta?.driverAdapterError as { cause?: { originalCode?: string } } | undefined)?.cause?.originalCode
    if (postgresCode === '23P01') {
      return new ORPCError('CONFLICT', { message: 'This overlaps another record in time', cause: error })
    }
    if (postgresCode === '23514') {
      return new ORPCError('BAD_REQUEST', { message: 'A value breaks a rule of the database', cause: error })
    }
  }

  return error
}
