/** Background commit uses its own connection, so it runs outside any fixture transaction. */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '../src/core/db/database.js';
import { commitImport, previewImport, getJob } from '../src/core/bulk/index.js';
import { holidaysImporter } from '../src/modules/bulk/importers/holidays.js';

const DB_URL = process.env['DATABASE_URL'];
const tag = 'bg' + randomUUID().slice(0, 5);

describe.skipIf(!DB_URL)('bulk import background commit', () => {
  it('large files commit in the background with progress (real transaction, polled)', async () => {
    const live = createDatabase(DB_URL ?? '');
    const email = `${tag}@hrms.invalid`;
    try {
      const user = await live.insertInto('core.users').values({ email, password_hash: '!disabled!' }).returning('id').executeTakeFirstOrThrow();
      const actor = { userId: user.id, scope: { all: true, own: false, subtree: false, orgUnitIds: [], actorEmployeeId: null }, ip: null };
      const lines = ['Date,Holiday,Location', ...[1, 2, 3].map((d) => `2101-01-0${String(d)},BG ${tag} ${String(d)},`)];
      const job = await previewImport({ db: live, importer: holidaysImporter, actor, filename: 'bg.csv', bytes: Buffer.from(lines.join('\n')), rawContext: {} });
      const started = await commitImport({ db: live, importer: holidaysImporter, actor, jobId: job.jobId, backgroundThreshold: 1 });
      expect(started.status).toBe('committing');
      let status = started.status;
      for (let i = 0; i < 50 && status === 'committing'; i++) {
        await new Promise((r) => setTimeout(r, 50));
        status = (await getJob(live, job.jobId, actor)).status;
      }
      const done = await getJob(live, job.jobId, actor);
      expect(done.status).toBe('committed');
      expect(done.processedRows).toBe(3);
      expect(done.result?.created).toBe(3);
    } finally {
      await live.deleteFrom('att.holidays').where("name", "like", "BG %").execute();
      await live.destroy();
    }
  });

});
