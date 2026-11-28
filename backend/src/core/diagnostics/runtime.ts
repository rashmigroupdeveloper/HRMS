import { constants } from 'node:fs'
import { access, statfs } from 'node:fs/promises'
import { resolve } from 'node:path'
import { env } from '../config/env.js'

// Read-only filesystem probe. No filenames, paths, hostnames, environment values or secret material leave this module.
export async function storageStatus() {
  try {
    const path = resolve(env.STORAGE_DIR)
    await access(path, constants.R_OK | constants.W_OK)
    const fs = await statfs(path)
    return { available: true, freeBytes: fs.bavail * fs.bsize, totalBytes: fs.blocks * fs.bsize }
  } catch {
    return { available: false, freeBytes: null, totalBytes: null }
  }
}

export function runtimeStatus() {
  const memory = process.memoryUsage()
  return {
    environment: env.NODE_ENV,
    release: env.APP_RELEASE ?? null,
    node: process.version,
    uptimeSeconds: Math.floor(process.uptime()),
    memoryBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
    heapTotalBytes: memory.heapTotal,
    mailMode: env.SMTP_HOST ? 'SMTP_CONFIGURED' as const : 'LOCAL_OUTBOX' as const,
  }
}
