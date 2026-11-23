import { createHash } from 'node:crypto'

// The hash chain of the change history: every row's fingerprint covers its content and the fingerprint of the row
// before it, so changing or removing any row breaks every fingerprint after it.

// The "row before" of the very first row
export const GENESIS_HASH = '0'.repeat(64)

// What a row's fingerprint covers - the columns as stored
export type HashedEntry = {
  createdAt: Date
  createdById: number
  action: string
  model: string | null
  recordId: number | null
  employeeId: number | null
  candidateId: number | null
  source: string | null
  changes: unknown
  details: unknown
  ip: string | null
  userAgent: string | null
}

export function hashEntry(previousHash: string, entry: HashedEntry): string {
  const content = stableJson([
    previousHash,
    entry.createdAt.toISOString(),
    entry.createdById,
    entry.action,
    entry.model,
    entry.recordId,
    entry.employeeId,
    entry.candidateId,
    entry.source,
    entry.changes ?? null,
    entry.details ?? null,
    entry.ip,
    entry.userAgent,
  ])
  return createHash('sha256').update(content).digest('hex')
}

// JSON with object keys sorted at every level: the database (jsonb) does not keep the key order, so the fingerprint
// must not depend on it
export function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`
}
