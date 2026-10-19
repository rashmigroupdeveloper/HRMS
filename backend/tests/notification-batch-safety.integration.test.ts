/** WF-02: a later persistence failure cannot roll back an earlier delivery receipt. */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Kysely } from 'kysely';
import type { Database } from '../src/core/db/types.js';
import { createDatabase } from '../src/core/db/database.js';
import { processQueue } from '../src/modules/notifications/index.js';
import * as repository from '../src/modules/notifications/notifications.repository.js';
function deferred() {
  let complete: (() => void) | undefined;
  const promise = new Promise<void>(resolve => { complete = resolve; });
  return { promise, resolve() { if (!complete) throw new Error('Deferred promise was not initialized'); complete(); } };
}
const url = process.env['DATABASE_URL'];
describe.skipIf(!url)('notification receipt isolation (native PostgreSQL)', () => {
  let db: Kysely<Database>;
  beforeAll(() => { db = createDatabase(url ?? ''); });
  afterAll(async () => { await db.destroy(); });
  it('preserves the first receipt when failure bookkeeping for a later message fails', async () => {
    const held = await db.startTransaction().execute();
    const ids: number[] = [];
    try {
      // Lock all unrelated deliverable rows without changing their state. Test
      // transports can only see our two committed synthetic notifications.
      await held.selectFrom('wf.notifications').select('id').where('status', 'in', ['queued', 'failed']).forUpdate().execute();
      const tag = 'batch_safety_' + randomUUID();
      const rows = await db.insertInto('wf.notifications').values([1, 2].map(index => ({ recipient_email: `${String(index)}-${tag}@hrms.invalid`, channel: 'email' as const, template_code: tag, payload: '{}' }))).returning('id').execute();
      ids.push(...rows.map(row => row.id));
      const first = ids[0]; const second = ids[1]; if (!first || !second) throw new Error('Fixture notifications missing');
      const sends: number[] = [];
      const failing = { send: (n: repository.NotificationRow) => { sends.push(n.id); return n.id === second ? Promise.reject(new Error('Synthetic transport outage')) : Promise.resolve(); } };
      const failure = new Error('Synthetic failure bookkeeping outage');
      vi.spyOn(repository, 'markFailed').mockRejectedValueOnce(failure);
      await expect(processQueue(db, failing, 2)).rejects.toThrow(failure);
      vi.restoreAllMocks();
      const receipt = await db.selectFrom('wf.notifications').select(['status', 'sent_at']).where('id', '=', first).executeTakeFirstOrThrow();
      expect(receipt.status).toBe('sent'); expect(receipt.sent_at).not.toBeNull();
      await processQueue(db, { send: n => { sends.push(n.id); return Promise.resolve(); } }, 2);
      expect(sends.filter(id => id === first)).toHaveLength(1);
      expect(sends.filter(id => id === second)).toHaveLength(2);
    } finally {
      vi.restoreAllMocks();
      if (!held.isRolledBack) await held.rollback().execute();
      if (ids.length) await db.deleteFrom('wf.notifications').where('id', 'in', ids).execute();
    }
  });
  it('concurrent drains never deliver a locked notification twice', async () => {
    const held = await db.startTransaction().execute();
    const ids: number[] = [];
    const blocked = deferred();
    let running: Promise<unknown> | undefined;
    try {
      await held.selectFrom('wf.notifications').select('id').where('status', 'in', ['queued', 'failed']).forUpdate().execute();
      const tag = 'concurrent_delivery_' + randomUUID();
      const rows = await db.insertInto('wf.notifications').values([1, 2].map(index => ({ recipient_email: `${String(index)}-${tag}@hrms.invalid`, channel: 'email' as const, template_code: tag, payload: '{}' }))).returning('id').execute();
      ids.push(...rows.map(row => row.id));
      const first = ids[0]; if (!first) throw new Error('Missing fixture');
      const sending = deferred();
      const sends: number[] = [];
      running = processQueue(db, { send: async n => {
        sends.push(n.id);
        if (n.id === first) { sending.resolve(); await blocked.promise; }
      } }, 2);
      await sending.promise;
      await processQueue(db, { send: n => { sends.push(n.id); return Promise.resolve(); } }, 2);
      blocked.resolve();
      await running;
      expect(sends.sort((a, b) => a - b)).toEqual([...ids].sort((a, b) => a - b));
      const receipts = await db.selectFrom('wf.notifications').select(['status', 'sent_at']).where('id', 'in', ids).execute();
      expect(receipts.every(row => row.status === 'sent' && row.sent_at !== null)).toBe(true);
      await expect(processQueue(held, { send: () => Promise.resolve() })).rejects.toThrow('root database');
    } finally {
      blocked.resolve();
      await running;
      if (!held.isRolledBack) await held.rollback().execute();
      if (ids.length) await db.deleteFrom('wf.notifications').where('id', 'in', ids).execute();
    }
  });

});
