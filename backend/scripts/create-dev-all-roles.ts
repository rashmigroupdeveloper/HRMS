/**
 * Local-dev only: one login with every assignable role so you can exercise the
 * full nav matrix without switching accounts (docs/08 §1 — roles are additive).
 *
 * manager / senior_manager are normally derived from reporting_tree; for dev we
 * grant them explicitly. ESS still needs an employee link — this script creates
 * a minimal active employee when none exists.
 *
 * Usage: npx tsx scripts/create-dev-all-roles.ts [email]
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { loadEnv } from '../src/core/config/env.js';
import { createDatabase } from '../src/core/db/database.js';
import { ROLES, type RoleCode } from '../src/core/rbac/seed-data.js';
import { hashPassword } from '../src/modules/auth/index.js';
import { writeAudit } from '../src/core/audit/audit.service.js';

const email = process.argv[2] ?? 'dev@rashmigroup.com';

/** All ten role codes — including derived ones, granted for local QA only. */
const ALL_ROLE_CODES: RoleCode[] = ROLES.map((r) => r.code);

async function main(): Promise<void> {
  const env = loadEnv();
  const db = createDatabase(env.DATABASE_URL);
  const password = `${crypto.randomBytes(9).toString('base64url')}-Dv1!`;

  try {
    const hash = await hashPassword(password);
    let user = await db
      .selectFrom('core.users')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirst();

    if (user) {
      await db
        .updateTable('core.users')
        .set({ password_hash: hash, is_active: true })
        .where('id', '=', user.id)
        .execute();
    } else {
      user = await db
        .insertInto('core.users')
        .values({ email, password_hash: hash })
        .returningAll()
        .executeTakeFirstOrThrow();
    }

    const roleRows = await db.selectFrom('core.roles').select(['id', 'code']).execute();
    const roleByCode = new Map(roleRows.map((r) => [r.code, r.id]));

    for (const code of ALL_ROLE_CODES) {
      const roleId = roleByCode.get(code);
      if (roleId === undefined) {
        throw new Error(`Role missing from DB — run npm run seed:rbac first: ${code}`);
      }
      await db
        .insertInto('core.user_roles')
        .values({ user_id: user.id, role_id: roleId, scope_org_unit_id: null })
        .onConflict((oc) => oc.columns(['user_id', 'role_id', 'scope_org_unit_id']).doNothing())
        .execute();
    }

    let employeeId = user.employee_id;
    if (employeeId === null) {
      const company = await db
        .selectFrom('core.companies')
        .select('id')
        .where('code', '=', 'RML')
        .executeTakeFirst();
      if (company) {
        const stamp = String(Date.now()).slice(-8);
        const row = await db
          .insertInto('core.employees')
          .values({
            ecode: `DEV${stamp}`,
            company_id: company.id,
            first_name: 'Dev',
            last_name: 'All-Roles',
            work_email: email,
            status: 'active',
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        employeeId = row.id;
        await db
          .updateTable('core.users')
          .set({ employee_id: employeeId })
          .where('id', '=', user.id)
          .execute();
      }
    }

    await writeAudit(db, {
      actorUserId: user.id,
      action: 'grant',
      entity: 'core.user_roles',
      entityId: user.id,
      field: 'all_roles_dev',
      newValue: ALL_ROLE_CODES.join(','),
      subjectEmployeeId: employeeId,
    });

    const assigned = await db
      .selectFrom('core.user_roles as ur')
      .innerJoin('core.roles as r', 'r.id', 'ur.role_id')
      .where('ur.user_id', '=', user.id)
      .select('r.code')
      .orderBy('r.code')
      .execute();

    console.log('=== DEV ALL-ROLES ACCOUNT (local only — password shown ONCE) ===');
    console.log(`  user id     : ${user.id}`);
    console.log(`  email       : ${email}`);
    console.log(`  password    : ${password}`);
    console.log(`  employee id : ${employeeId ?? '(none — seed RML company first)'}`);
    console.log(`  roles (${assigned.length}): ${assigned.map((r) => r.code).join(', ')}`);
  } finally {
    await db.destroy();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
