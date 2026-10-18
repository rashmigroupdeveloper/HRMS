/** CORE-02: every caller uses the same DB-locked per-company sequence. */
import { sql, type Kysely } from 'kysely';
import type { Database } from './db/types.js';
import { inTransaction } from './db/database.js';

async function allocate(db: Kysely<Database>, companyId: number): Promise<string> {
  await db.selectFrom('core.companies').select('id')
    .where('id', '=', companyId).forUpdate().executeTakeFirstOrThrow();

  // Legacy imports/test fixtures may have used numbers without advancing the
  // cursor. Consume already-used numbers while retaining the company's row
  // lock; never reset a cursor or guess a prefix from the entity display code.
  for (;;) {
    const result = await sql<{ ecode: string }>`SELECT core.next_ecode(${companyId}) AS ecode`.execute(db);
    const code = result.rows[0]?.ecode;
    if (typeof code !== 'string' || code.length === 0) {
      throw new Error('Employee code allocator returned no code');
    }
    const existing = await db.selectFrom('core.employees').select('id')
      .where('ecode', '=', code).executeTakeFirst();
    if (!existing) return code;
  }
}

export async function allocateEmployeeCode(db: Kysely<Database>, companyId: number): Promise<string> {
  return db.isTransaction ? allocate(db, companyId) : inTransaction(db, tx => allocate(tx, companyId));
}
