/**
 * Local-dev only: one login per role, shared password (default password123).
 * Idempotent — re-run resets passwords and ensures exactly one role per account.
 *
 * Usage:
 *   npx tsx scripts/create-dev-role-accounts.ts
 *   npx tsx scripts/create-dev-role-accounts.ts my-secret-pw
 *
 * Emails: `<role_code>@rashmigroup.com` (e.g. hr_ops@rashmigroup.com)
 */
import 'dotenv/config';
import { loadEnv } from '../src/core/config/env.js';
import { createDatabase } from '../src/core/db/database.js';
import { ROLES, type RoleCode } from '../src/core/rbac/seed-data.js';
import { hashPassword } from '../src/modules/auth/index.js';
import { writeAudit } from '../src/core/audit/audit.service.js';

const password = process.argv[2] ?? 'password123';

function emailForRole(code: RoleCode): string {
  return `${code}@rashmigroup.com`;
}

function ecodeForRole(code: RoleCode, seq: number): string {
  const tag = code.replace(/_/g, '').slice(0, 6).toUpperCase();
  return `DEV${tag}${String(seq).padStart(3, '0')}`;
}

/**
 * Point `subjectRole`'s employee at `managerRole`'s employee as reporting_manager.
 * Idempotent — skips the write when already linked; audits only when changed.
 */
async function linkReportingManager(
  db: ReturnType<typeof createDatabase>,
  args: {
    subjectRole: RoleCode;
    managerRole: RoleCode;
    employeeIdByRole: Map<RoleCode, number>;
    userIdByRole: Map<RoleCode, number>;
  },
): Promise<void> {
  const subjectId = args.employeeIdByRole.get(args.subjectRole);
  const managerId = args.employeeIdByRole.get(args.managerRole);
  if (subjectId === undefined || managerId === undefined) return;
  if (subjectId === managerId) return;

  const current = await db
    .selectFrom('core.employees')
    .select('reporting_manager_id')
    .where('id', '=', subjectId)
    .executeTakeFirst();
  if (current?.reporting_manager_id === managerId) {
    console.log(`  reporting tree   ${args.subjectRole} → ${args.managerRole} (already set)`);
    return;
  }

  await db
    .updateTable('core.employees')
    .set({ reporting_manager_id: managerId })
    .where('id', '=', subjectId)
    .execute();

  await writeAudit(db, {
    actorUserId: args.userIdByRole.get(args.managerRole) ?? null,
    action: 'update',
    entity: 'core.employees',
    entityId: subjectId,
    field: 'reporting_manager_id',
    oldValue: current?.reporting_manager_id === null ? null : String(current?.reporting_manager_id ?? ''),
    newValue: String(managerId),
    subjectEmployeeId: subjectId,
  });

  console.log(`  reporting tree   ${args.subjectRole} → ${args.managerRole}`);
}

async function main(): Promise<void> {
  const env = loadEnv();
  const db = createDatabase(env.DATABASE_URL);
  const hash = await hashPassword(password);

  try {
    const company = await db
      .selectFrom('core.companies')
      .select('id')
      .where('code', '=', 'RML')
      .executeTakeFirst();
    if (!company) {
      throw new Error('RML company missing — run npm run migrate first');
    }

    const roleRows = await db.selectFrom('core.roles').select(['id', 'code']).execute();
    const roleByCode = new Map(roleRows.map((r) => [r.code as RoleCode, r.id]));

    console.log('=== DEV ROLE ACCOUNTS (local only) ===');
    console.log(`  shared password: ${password}`);
    console.log('');

    /** role code → employee id — used after the loop for the reporting tree. */
    const employeeIdByRole = new Map<RoleCode, number>();
    const userIdByRole = new Map<RoleCode, number>();

    let seq = 1;
    for (const { code, name } of ROLES) {
      const email = emailForRole(code);
      const roleId = roleByCode.get(code);
      if (roleId === undefined) {
        throw new Error(`Role missing — run npm run seed:rbac: ${code}`);
      }

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

      // Exactly one role on this account — drop any others from prior experiments.
      await db.deleteFrom('core.user_roles').where('user_id', '=', user.id).execute();
      await db
        .insertInto('core.user_roles')
        .values({ user_id: user.id, role_id: roleId, scope_org_unit_id: null })
        .execute();

      let employeeId = user.employee_id;
      if (employeeId === null) {
        const existing = await db
          .selectFrom('core.employees')
          .select('id')
          .where('work_email', '=', email)
          .executeTakeFirst();
        if (existing) {
          employeeId = existing.id;
        } else {
          const row = await db
            .insertInto('core.employees')
            .values({
              ecode: ecodeForRole(code, seq),
              company_id: company.id,
              first_name: name.split('(')[0]?.trim() ?? code,
              last_name: 'Dev',
              work_email: email,
              status: 'active',
            })
            .returning('id')
            .executeTakeFirstOrThrow();
          employeeId = row.id;
        }
        await db
          .updateTable('core.users')
          .set({ employee_id: employeeId })
          .where('id', '=', user.id)
          .execute();
      }

      employeeIdByRole.set(code, employeeId);
      userIdByRole.set(code, user.id);

      await writeAudit(db, {
        actorUserId: user.id,
        action: 'grant',
        entity: 'core.user_roles',
        entityId: user.id,
        field: code,
        newValue: 'dev role account bootstrap',
        subjectEmployeeId: employeeId,
      });

      console.log(`  ${code.padEnd(16)} ${email}`);
      seq += 1;
    }

    // Stage 1.11 playable: manager@… sees a team on /team calendar + roster.
    // employee → manager; manager → senior_manager when that role account exists.
    await linkReportingManager(db, {
      subjectRole: 'employee',
      managerRole: 'manager',
      employeeIdByRole,
      userIdByRole,
    });
    await linkReportingManager(db, {
      subjectRole: 'manager',
      managerRole: 'senior_manager',
      employeeIdByRole,
      userIdByRole,
    });

    console.log('');
    console.log('  Sign in with email or e-code in the same field. Re-run to reset passwords.');
  } finally {
    await db.destroy();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
