/**
 * Typed policy reads — the FOUNDATION half of `core.settings`.
 *
 * Why this lives in core/ and not in modules/settings: nearly every module
 * reads policy, and so does the API layer (session idle window, step-up
 * window). Routing those reads through the settings *module* would pull that
 * module's router — and therefore `api/orpc.ts` — into the dependency graph of
 * anything orpc itself depends on, which is a cycle.
 *
 * Reading is foundation; WRITING is a feature (audited, permissioned) and
 * stays in `modules/settings`.
 */
import type { Kysely, Transaction } from 'kysely';
import { z } from 'zod';
import type { Database, SettingsTable } from '../db/types.js';

const valueSchemas = {
  number: z.number(),
  string: z.string(),
  boolean: z.boolean(),
  json: z.unknown(),
} as const;

export type SettingType = SettingsTable['value_type'];

/** Fail-fast validation for writes (the write path itself stays in the module). */
export function assertSettingValue(type: SettingType, value: unknown): void {
  valueSchemas[type].parse(value);
}

async function readSettingRow(
  db: Kysely<Database> | Transaction<Database>,
  key: string,
): Promise<{ value: unknown; value_type: SettingType } | undefined> {
  return db
    .selectFrom('core.settings')
    .select(['value', 'value_type'])
    .where('key', '=', key)
    .executeTakeFirst();
}

/** Typed read; returns `fallback` when the key has never been set. */
export async function getTypedSetting<T>(
  db: Kysely<Database> | Transaction<Database>,
  key: string,
  type: SettingType,
  fallback: T,
): Promise<T> {
  const row = await readSettingRow(db, key);
  if (!row) return fallback;
  const parsed = valueSchemas[type].safeParse(row.value);
  if (!parsed.success) {
    throw new Error(`Setting ${key} holds a ${row.value_type}, expected ${type}`);
  }
  return parsed.data as T;
}
