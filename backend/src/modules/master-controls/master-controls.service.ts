import { accountsService } from '#modules/accounts'
import type { CurrentUser } from '#core/rpc/procedures'
import { runtimeStatus, storageStatus } from '#core/diagnostics/runtime'
import * as controlsRepository from './master-controls.repository.js'
import type { RunsInput } from './master-controls.schema.js'

// Error text can contain employee details or credentials. Return only a fixed diagnosis; raw errors stay server-side.
export function failureAdvice(error: string | null) {
  const text = (error ?? '').toLowerCase()
  if (/timeout|timed out|etimedout/.test(text)) return { category: 'Timed out', next: 'Check the dependency and worker logs before retrying the owning workflow.' }
  if (/econn|connection|unreachable|enotfound|eai_again/.test(text)) return { category: 'Connection failed', next: 'Check database or mail connectivity from the server.' }
  if (/permission|eacces|authentication|credentials/.test(text)) return { category: 'Access refused', next: 'Check service credentials and filesystem permissions on the server.' }
  if (/worker stopped/.test(text)) return { category: 'Worker interrupted', next: 'Check worker supervision and confirm the original operation before resuming.' }
  return { category: 'Job failed', next: 'Inspect server logs for this job and start time. Use its owning workflow to recover.' }
}

export async function getOverview(viewer: CurrentUser) {
  await accountsService.assertMasterControl(viewer)
  const checkedAt = new Date()
  const since = new Date(checkedAt.getTime() - 24 * 60 * 60_000)
  const started = performance.now()
  await controlsRepository.ping()
  const databaseMs = Math.round(performance.now() - started)
  const [counts, timeline, worker, mail, waiting, storage, migrations] = await Promise.all([
    controlsRepository.jobCounts(since), controlsRepository.jobTimeline(since), controlsRepository.workerActivity(),
    controlsRepository.mailCounts(), controlsRepository.waitingMail(), storageStatus(),
    controlsRepository.migrations().catch(() => null),
  ])
  const count = (status: string) => counts.find(row => row.status === status)?._count._all ?? 0
  const pending = mail.find(row => row.status === 'PENDING')
  const failed = mail.find(row => row.status === 'FAILED')
  // A recent run is evidence of worker activity, not a dedicated heartbeat or proof every job is healthy.
  const workerRecent = Boolean(worker && checkedAt.getTime() - worker.startedAt.getTime() <= 3 * 60_000)
  return {
    checkedAt, since, databaseMs, runtime: runtimeStatus(), storage, migrations,
    jobs: { ok: count('OK'), failed: count('FAILED'), running: count('RUNNING'), total: counts.reduce((n, row) => n + row._count._all, 0), timeline },
    worker: { evidence: worker, recent: workerRecent },
    mail: { pending: pending?._count._all ?? 0, failed: failed?._count._all ?? 0, oldestPendingAt: pending?._min.createdAt ?? null, items: waiting },
  }
}

export async function listRuns(viewer: CurrentUser, input: RunsInput) {
  await accountsService.assertMasterControl(viewer)
  const since = new Date(Date.now() - input.hours * 60 * 60_000)
  const result = await controlsRepository.listRuns(input, since)
  return { ...result, pageSize: 20, items: result.items.map(({ error, ...run }) => ({
    ...run, durationMs: run.finishedAt ? Math.max(0, run.finishedAt.getTime() - run.startedAt.getTime()) : null,
    failure: run.status === 'FAILED' ? failureAdvice(error) : null,
  })) }
}
