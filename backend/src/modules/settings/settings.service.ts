/**
 * Settings service — the home of every policy number (docs/04 §8: nothing
 * policy-like is hardcoded). Reads are typed; writes are AUDITED (old → new
 * lands in the hash-chained audit log).
 */
import type { Kysely, Transaction } from 'kysely';
import { z } from 'zod';
import type { Database, SettingsTable } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { getSetting, upsertSetting } from './settings.repository.js';

const valueSchemas = {
  number: z.number(),
  string: z.string(),
  boolean: z.boolean(),
  json: z.unknown(),
} as const;

export type SettingType = SettingsTable['value_type'];

/** Typed read; returns `fallback` when the key has never been set. */
export async function getTypedSetting<T>(
  db: Kysely<Database> | Transaction<Database>,
  key: string,
  type: SettingType,
  fallback: T,
): Promise<T> {
  const row = await getSetting(db, key);
  if (!row) return fallback;
  const parsed = valueSchemas[type].safeParse(row.value);
  if (!parsed.success) {
    throw new Error(`Setting ${key} holds a ${row.value_type}, expected ${type}`);
  }
  return parsed.data as T;
}

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
  valueSchemas[params.type].parse(params.value); // fail fast on type mismatch

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
