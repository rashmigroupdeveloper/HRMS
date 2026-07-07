/**
 * Bootstrap/reset the break-glass super_admin account (docs/08 §1: 1–2 named
 * people, setup + emergencies only — all actions audit-logged).
 *
 * Usage: npx tsx scripts/create-admin.ts [email]
 * Prints the generated password ONCE. Idempotent: re-running resets the
 * password and reactivates the account.
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { loadEnv } from '../src/core/config/env.js';
import { createDatabase } from '../src/core/db/database.js';
import { hashPassword } from '../src/modules/auth/index.js';
import { writeAudit } from '../src/core/audit/audit.service.js';

const email = process.argv[2] ?? 'admin@rashmigroup.com';

async function main(): Promise<void> {
  const env = loadEnv();
  const db = createDatabase(env.DATABASE_URL);
  const password = `${crypto.randomBytes(9).toString('base64url')}-Hr1!`;

  try {
    const hash = await hashPassword(password);
    const user = await db
      .insertInto('core.users')
      .values({ email, password_hash: hash })
      .onConflict((oc) => oc.column('email').doUpdateSet({ password_hash: hash, is_active: true }))
      .returning('id')
      .executeTakeFirstOrThrow();

    const role = await db
      .selectFrom('core.roles')
      .select('id')
      .where('code', '=', 'super_admin')
      .executeTakeFirstOrThrow();
    await db
      .insertInto('core.user_roles')
      .values({ user_id: user.id, role_id: role.id, scope_org_unit_id: null })
      .onConflict((oc) => oc.columns(['user_id', 'role_id', 'scope_org_unit_id']).doNothing())
      .execute();

    await writeAudit(db, {
      action: 'grant',
      entity: 'core.user_roles',
      entityId: user.id,
      field: 'super_admin',
      newValue: 'bootstrap admin created/reset via scripts/create-admin.ts',
    });

    console.log('=== ADMIN ACCOUNT READY (password shown ONCE — store it safely) ===');
    console.log(`  user id : ${user.id}`);
    console.log(`  email   : ${email}`);
    console.log(`  password: ${password}`);
  } finally {
    await db.destroy();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
