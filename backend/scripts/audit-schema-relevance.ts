/** CORE-08/NFR-04: metadata-only snapshot for the sponsor's field relevance audit. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sql } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import { logger } from '../src/core/logger.js';

interface Column {
  table_name: string;
  column_name: string;
  position: number;
  data_type: string;
  not_null: boolean;
  default_expression: string | null;
  identity_kind: string;
  generated_kind: string;
  comment: string | null;
  table_comment: string | null;
  constraints: { name: string; kind: string; definition: string; validated: boolean }[];
}
interface Table {
  table_name: string;
  kind: string;
  triggers: { name: string; function: string; enabled: string }[];
  indexes: { name: string; definition: string; valid: boolean }[];
}
async function main(): Promise<void> {
  const url = process.env['TEST_DATABASE_URL'];
  if (!url) throw new Error('Use run-local-check.mjs with the authorized TEST database');
  const target = new URL(url);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    target.pathname !== '/hrms'
  ) {
    throw new Error('Field audit permits the authorized loopback hrms TEST database only');
  }
  const output = resolve('../outputs/schema-relevance-2026-10-19');
  const db = createDatabase(url);
  try {
    const snapshot = await db
      .transaction()
      .setAccessMode('read only')
      .setIsolationLevel('repeatable read')
      .execute(async (trx) => {
        const mode = await sql<{
          read_only: string;
          server_version: string;
        }>`SELECT current_setting('transaction_read_only') AS read_only, current_setting('server_version') AS server_version`.execute(
          trx,
        );
        if (mode.rows[0]?.read_only !== 'on')
          throw new Error('Read-only transaction was not established');
        const columns = await sql<Column>`
        SELECT n.nspname || '.' || c.relname AS table_name, a.attname AS column_name,
          a.attnum::integer AS position, format_type(a.atttypid,a.atttypmod) AS data_type,
          a.attnotnull AS not_null, pg_get_expr(d.adbin,d.adrelid) AS default_expression,
          a.attidentity AS identity_kind, a.attgenerated AS generated_kind,
          col_description(c.oid,a.attnum) AS comment, obj_description(c.oid,'pg_class') AS table_comment,
          COALESCE((SELECT jsonb_agg(jsonb_build_object('name',k.conname,'kind',k.contype,
            'definition',pg_get_constraintdef(k.oid),'validated',k.convalidated) ORDER BY k.conname)
            FROM pg_constraint k WHERE k.conrelid=c.oid AND a.attnum=ANY(k.conkey)), '[]'::jsonb) AS constraints
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
        LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
        WHERE n.nspname NOT IN ('pg_catalog','information_schema','pgboss')
          AND n.nspname NOT LIKE 'pg_%' AND c.relkind IN ('r','p','m','v') AND NOT c.relispartition
        ORDER BY n.nspname,c.relname,a.attnum
      `.execute(trx);
        const tables = await sql<Table>`
        SELECT n.nspname || '.' || c.relname AS table_name,c.relkind AS kind,
          COALESCE((SELECT jsonb_agg(jsonb_build_object('name',t.tgname,'function',p.oid::regproc::text,'enabled',t.tgenabled) ORDER BY t.tgname)
            FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid WHERE t.tgrelid=c.oid AND NOT t.tgisinternal),'[]'::jsonb) AS triggers,
          COALESCE((SELECT jsonb_agg(jsonb_build_object('name',ic.relname,'definition',pg_get_indexdef(i.indexrelid),'valid',i.indisvalid) ORDER BY ic.relname)
            FROM pg_index i JOIN pg_class ic ON ic.oid=i.indexrelid WHERE i.indrelid=c.oid),'[]'::jsonb) AS indexes
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname NOT IN ('pg_catalog','information_schema','pgboss')
          AND n.nspname NOT LIKE 'pg_%' AND c.relkind IN ('r','p','m','v') AND NOT c.relispartition
        ORDER BY n.nspname,c.relname
      `.execute(trx);
        return {
          captured_at: new Date().toISOString(),
          read_only: true,
          server_version: mode.rows[0].server_version,
          scope:
            'Logical application tables/views; child partitions inherit parent fields. pg-boss/system catalogs excluded. No business row values read.',
          columns: columns.rows,
          tables: tables.rows,
        };
      });
    await mkdir(output, { recursive: true });
    await writeFile(
      resolve(output, 'database-metadata.json'),
      JSON.stringify(snapshot, null, 2) + '\n',
    );
    logger.info(
      { tables: snapshot.tables.length, columns: snapshot.columns.length, output },
      'Read-only schema snapshot complete',
    );
  } finally {
    await db.destroy();
  }
}
main().catch((error: unknown) => {
  logger.error(error, 'Schema snapshot failed');
  process.exitCode = 1;
});
