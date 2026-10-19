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
    // Sponsor vacancy decision: HR repairs routing, with recipients remaining runtime DATA.
    await db.insertInto('wf.event_subscriptions').values({ event_code: 'workflow.routing_held',
      recipient_kind: 'role', recipient_ref: 'hr_head' })
      .onConflict(oc => oc.columns(['event_code', 'recipient_kind', 'recipient_ref']).doNothing()).execute();
    const offer = WORKFLOW_DEFINITIONS.find((def) => def.code === 'offer_approval');
    const stored = await db.selectFrom('wf.definitions').select('steps').where('code', '=', 'offer_approval').executeTakeFirst();
    const approvers = Array.isArray(stored?.steps)
      ? (stored.steps as unknown[]).map((step) =>
          step && typeof step === 'object' && 'approver' in step
            ? String((step as { approver?: unknown }).approver)
            : '',
        )
      : [];
    // Only the original two-step seed is upgraded. A chain HR has edited is left alone.
    if (offer && approvers.join(',') === 'role:hr_head,role:ceo_cell') {
      await db.updateTable('wf.definitions')
        .set({ name: offer.name, steps: JSON.stringify(offer.steps) })
        .where('code', '=', 'offer_approval')
        .execute();
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
