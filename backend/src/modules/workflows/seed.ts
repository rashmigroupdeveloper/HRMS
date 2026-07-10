/**
 * Workflow catalog seed runner — idempotent; existing chains are only updated
 * if UNCHANGED from a previous seed (admin runtime edits are never clobbered).
 * Usage: npm run seed:workflows
 */
import 'dotenv/config';
import { loadEnv } from '../../core/config/env.js';
import { createDatabase } from '../../core/db/database.js';
import { logger } from '../../core/logger.js';
import { WORKFLOW_DEFINITIONS } from './definitions.seed.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const db = createDatabase(env.DATABASE_URL);
  try {
    let inserted = 0;
    for (const def of WORKFLOW_DEFINITIONS) {
      const result = await db
        .insertInto('wf.definitions')
        .values({ code: def.code, name: def.name, steps: JSON.stringify(def.steps) })
        .onConflict((oc) => oc.column('code').doNothing()) // runtime edits win over re-seeds
        .executeTakeFirst();
      inserted += Number(result.numInsertedOrUpdatedRows ?? 0n);
    }
    logger.info({ total: WORKFLOW_DEFINITIONS.length, inserted }, 'workflow catalog seeded');
  } finally {
    await db.destroy();
  }
}

main().catch((err: unknown) => {
  logger.error(err, 'workflow seed failed');
  process.exitCode = 1;
});
