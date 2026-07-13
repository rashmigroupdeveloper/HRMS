/** All database access for the settings module. */
import type { Kysely, Selectable, Transaction } from 'kysely';
import type { Database, SettingsTable } from '../../core/db/types.js';

export type SettingRow = Selectable<SettingsTable>;

/** Reads accept a transaction too, so policy numbers can be resolved mid-txn
 *  (e.g. inside an atomic money decision). Writes stay Kysely-only. */
export function getSetting(db: Kysely<Database> | Transaction<Database>, key: string): Promise<SettingRow | undefined> {
  return db.selectFrom('core.settings').selectAll().where('key', '=', key).executeTakeFirst();
}

export function listSettings(db: Kysely<Database>): Promise<SettingRow[]> {
  return db.selectFrom('core.settings').selectAll().orderBy('key').execute();
}

export async function upsertSetting(
  db: Kysely<Database>,
  row: {
    key: string;
    value: unknown;
    value_type: SettingsTable['value_type'];
    description: string;
    updated_by: number | null;
  },
): Promise<void> {
  await db
    .insertInto('core.settings')
    .values({ ...row, value: JSON.stringify(row.value) })
    .onConflict((oc) =>
      oc.column('key').doUpdateSet({
        value: JSON.stringify(row.value),
        value_type: row.value_type,
        description: row.description,
        updated_by: row.updated_by,
      }),
    )
    .execute();
}
