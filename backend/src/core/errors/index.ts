/**
 * Typed domain errors + the single mapping from "anything a service threw" to
 * an HTTP-safe ORPCError (C-20 / A-10 / A-11 / A-23 / B-20).
 *
 * Rules:
 *  - Services throw `DomainError` subclasses for business-rule refusals; the
 *    API layer turns them into 4xx with the authored message.
 *  - A bare `Error` thrown by a service is treated as a business-rule refusal
 *    (400) — historic services throw plain Errors with user-facing text.
 *  - Postgres data/constraint errors become friendly 400/409 messages; the raw
 *    driver text ("numeric field overflow", constraint names) never crosses the
 *    wire.
 *  - Programmer errors (TypeError, ReferenceError, …) stay 500 and are logged
 *    with their stack.
 */
export type DomainErrorCode = 'BAD_REQUEST' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT';

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  constructor(message: string, code: DomainErrorCode = 'BAD_REQUEST') {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'You are not allowed to do this') {
    super(message, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'Not found') {
    super(message, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export interface MappedError {
  code: DomainErrorCode | 'INTERNAL_SERVER_ERROR';
  status: number;
  message: string;
  /** true when the failure is a server defect and must be logged at error level. */
  defect: boolean;
}

const STATUS: Record<MappedError['code'], number> = {
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
};

function mapped(code: MappedError['code'], message: string, defect = false): MappedError {
  return { code, status: STATUS[code], message, defect };
}

interface PgLikeError {
  code: string;
  message: string;
  constraint?: string;
  column?: string;
  severity?: string;
}

function isPgError(err: unknown): err is PgLikeError {
  return (
    typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string'
    && /^[0-9A-Z]{5}$/.test(err.code) && 'severity' in err
  );
}

/** Friendly sentences for named constraints the UI can hit. */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  employees_pan_format: 'PAN must look like ABCDE1234F',
  employees_aadhaar_format: 'Aadhaar must be 12 digits and cannot start with 0 or 1',
  employees_uan_format: 'UAN must be 12 digits',
  employees_esic_format: 'ESIC IP number must be 10 or 17 digits',
  employees_ifsc_format: 'IFSC must look like SBIN0001234',
  employees_bank_account_format: 'Bank account number must be 9 to 18 digits',
  employees_pan_unique: 'This PAN is already registered to another employee',
  employees_aadhaar_unique: 'This Aadhaar is already registered to another employee',
  employees_uan_unique: 'This UAN is already registered to another employee',
  employees_esic_unique: 'This ESIC IP number is already registered to another employee',
  separations_one_open_per_employee: 'An open resignation already exists for this employee',
  claims_budget_present: 'This claim needs a budget',
};

function mapPgError(err: PgLikeError): MappedError {
  const known = err.constraint ? CONSTRAINT_MESSAGES[err.constraint] : undefined;
  if (known) return mapped(err.code === '23505' ? 'CONFLICT' : 'BAD_REQUEST', known);
  switch (err.code) {
    case '22003':
      return mapped('BAD_REQUEST', 'A number is out of the allowed range');
    case '22007':
    case '22008':
      return mapped('BAD_REQUEST', 'A date or time is not valid');
    case '22P02':
      return mapped('BAD_REQUEST', 'A value has the wrong format');
    case '22001':
      return mapped('BAD_REQUEST', 'A value is too long');
    case '23505':
      return mapped('CONFLICT', 'This record already exists');
    case '23503':
      return mapped('BAD_REQUEST', 'A referenced record does not exist or is still in use');
    case '23502':
      return mapped('BAD_REQUEST', `A required value is missing${err.column ? ` (${err.column})` : ''}`);
    case '23514':
      return mapped('BAD_REQUEST', 'The values break a data rule — check dates, amounts and formats');
    case '23P01':
      return mapped('CONFLICT', 'This overlaps an existing record for the same period');
    case 'P0001':
      // RAISE EXCEPTION from our own triggers: authored business messages.
      return mapped('BAD_REQUEST', err.message);
    case '40001':
    case '40P01':
      return mapped('CONFLICT', 'Another change happened at the same time — please retry');
    default:
      return mapped('INTERNAL_SERVER_ERROR', 'Internal server error', true);
  }
}

const FORBIDDEN_HINT = /outside your permitted|not the current approver|not your |only the requester|can only (view|act|access)|not allowed|permission/i;
const NOT_FOUND_HINT = /\bnot found\b/i;

export function mapError(err: unknown): MappedError {
  if (err instanceof DomainError) return mapped(err.code, err.message);
  if (isPgError(err)) return mapPgError(err);
  // A plain Error (exact class) from a service is a business-rule refusal.
  if (err instanceof Error && Object.getPrototypeOf(err) === Error.prototype) {
    if (FORBIDDEN_HINT.test(err.message)) return mapped('FORBIDDEN', err.message);
    if (NOT_FOUND_HINT.test(err.message)) return mapped('NOT_FOUND', err.message);
    return mapped('BAD_REQUEST', err.message);
  }
  return mapped('INTERNAL_SERVER_ERROR', 'Internal server error', true);
}
