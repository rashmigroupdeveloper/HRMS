/**
 * Settings service — the home of every policy number (docs/04 §8: nothing
 * policy-like is hardcoded). Reads are typed; writes are AUDITED (old → new
 * lands in the hash-chained audit log).
 */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { getSetting, upsertSetting } from './settings.repository.js';

// The typed READ lives in core (see core/settings/read.ts for why); it is
// re-exported here so every existing call site keeps its import path.
export { getTypedSetting, type SettingType } from '../../core/settings/read.js';
import { assertSettingValue, type SettingType } from '../../core/settings/read.js';

/** Audited write — who changed which policy value from what to what (CORE-11). */
export async function setSetting(
  db: Kysely<Database>,
  params: {
    key: string;
    value: unknown;
    type: SettingType;
    description: string;
    actorUserId: number | null;
  },
): Promise<void> {
  assertSettingValue(params.type, params.value); // fail fast on type mismatch

  const previous = await getSetting(db, params.key);
  await upsertSetting(db, {
    key: params.key,
    value: params.value,
    value_type: params.type,
    description: params.description,
    updated_by: params.actorUserId,
  });

  await writeAudit(db, {
    actorUserId: params.actorUserId,
    action: previous ? 'update' : 'create',
    entity: 'core.settings',
    field: params.key,
    oldValue: previous ? JSON.stringify(previous.value) : null,
    newValue: JSON.stringify(params.value),
  });
}
