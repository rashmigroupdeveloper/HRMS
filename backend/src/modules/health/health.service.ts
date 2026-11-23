import { ORPCError } from '@orpc/server'
import * as healthRepository from './health.repository.js'

// Is the API up, and can it reach the database? Throws SERVICE_UNAVAILABLE when the database is down.
export async function check() {
  try {
    await healthRepository.ping()
  } catch (error) {
    throw new ORPCError('SERVICE_UNAVAILABLE', { message: 'Database is unreachable', cause: error })
  }
  return { status: 'ok' as const, checkedAt: new Date() }
}
