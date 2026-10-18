/**
 * PAY-03 / docs/14 §3: Payroll maker-checker approval authorization tests.
 * - Two-person rule: maker cannot self-approve.
 * - Approver must hold payroll.run.cosign — hr_head only (docs/08 §2, C-04);
 *   super_admin and ceo_cell cannot co-sign.
 * - Approval state transition updates run and records hash-chained audit evidence.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';
import type { Database } from '../src/core/db/types.js';
import { createDatabase } from '../src/core/db/database.js';
import { PayrollRunService } from '../src/modules/payroll-core/runs/run.service.js';

const url = process.env['DATABASE_URL'];
const rollback = new Error('rollback payroll run approval fixture');

describe.skipIf(!url)('Payroll Run Maker-Checker and Co-Sign Authorization', () => {
  let db: Kysely<Database>;

  beforeAll(() => {
    db = createDatabase(url ?? '');
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('enforces two-person rule and authorized co-sign role before approving a payroll run', async () => {
    try {
      await db.transaction().execute(async (trx) => {
        const stamp = `APR${String(Date.now())}`;

        // 1. Setup Company & Employees
        const company = await trx
          .insertInto('core.companies')
          .values({
            code: stamp,
            name: `Test Run Company ${stamp}`,
            ecode_prefix: 'APR',
          })
          .returning('id')
          .executeTakeFirstOrThrow();

        const makerEmp = await trx
          .insertInto('core.employees')
          .values({
            company_id: company.id,
            ecode: `${stamp}M`,
            first_name: 'Maker',
            status: 'active',
            doj: '2026-01-01',
          })
          .returning('id')
          .executeTakeFirstOrThrow();

        const regularEmp = await trx
          .insertInto('core.employees')
          .values({
            company_id: company.id,
            ecode: `${stamp}R`,
            first_name: 'Regular',
            status: 'active',
            doj: '2026-01-01',
          })
          .returning('id')
          .executeTakeFirstOrThrow();

        const hrHeadEmp = await trx
          .insertInto('core.employees')
          .values({
            company_id: company.id,
            ecode: `${stamp}H`,
            first_name: 'HR Head',
            status: 'active',
            doj: '2026-01-01',
          })
          .returning('id')
          .executeTakeFirstOrThrow();

        // 2. Setup Users
        const makerUser = await trx
          .insertInto('core.users')
          .values({
            email: `maker-${stamp}@example.com`,
            password_hash: '!test!',
            employee_id: makerEmp.id,
            is_active: true,
          })
          .returning('id')
          .executeTakeFirstOrThrow();

        const regularUser = await trx
          .insertInto('core.users')
          .values({
            email: `regular-${stamp}@example.com`,
            password_hash: '!test!',
            employee_id: regularEmp.id,
            is_active: true,
          })
          .returning('id')
          .executeTakeFirstOrThrow();

        const hrHeadUser = await trx
          .insertInto('core.users')
          .values({
            email: `hrhead-${stamp}@example.com`,
            password_hash: '!test!',
            employee_id: hrHeadEmp.id,
            is_active: true,
          })
          .returning('id')
          .executeTakeFirstOrThrow();

        // 3. Assign Roles
        const payrollAdminRole = await trx
          .selectFrom('core.roles')
          .select('id')
          .where('code', '=', 'payroll_admin')
          .executeTakeFirstOrThrow();

        const employeeRole = await trx
          .selectFrom('core.roles')
          .select('id')
          .where('code', '=', 'employee')
          .executeTakeFirstOrThrow();

        const hrHeadRole = await trx
          .selectFrom('core.roles')
          .select('id')
          .where('code', '=', 'hr_head')
          .executeTakeFirstOrThrow();

        await trx.insertInto('core.user_roles').values([
          { user_id: makerUser.id, role_id: payrollAdminRole.id },
          { user_id: regularUser.id, role_id: employeeRole.id },
          { user_id: hrHeadUser.id, role_id: hrHeadRole.id },
        ]).execute();

        // 4. Create attendance month lock & payroll run in 'under_review' status
        const lock = await trx
          .insertInto('att.month_locks')
          .values({
            company_id: company.id,
            month: '2026-10-01',
            locked_by: makerUser.id,
            locked_at: new Date(),
          })
          .returning('id')
          .executeTakeFirstOrThrow();

        const run = await trx
          .insertInto('pay.payroll_runs')
          .values({
            company_id: company.id,
            month: '2026-10-01' as unknown as Date,
            run_type: 'regular',
            status: 'under_review',
            attendance_lock_id: lock.id,
            notes: 'Maker-checker test run',
          })
          .returning('id')
          .executeTakeFirstOrThrow();

        // 5. Insert audit log indicating makerUser computed this run
        await trx
          .insertInto('core.audit_log')
          .values({
            actor_user_id: makerUser.id,
            entity: 'pay.payroll_runs',
            entity_id: run.id,
            action: 'payroll_run_computed',
            prev_hash: '0000000000000000000000000000000000000000000000000000000000000000',
            row_hash: '1111111111111111111111111111111111111111111111111111111111111111',
          })
          .execute();

        const service = new PayrollRunService(trx);

        // Scenario A: Maker attempts self-approval -> must reject
        await expect(service.approveRun(run.id, makerUser.id)).rejects.toThrow(
          /Two-person authorization violation/,
        );

        // Scenario B: Checker has only regular 'employee' role -> must reject
        await expect(service.approveRun(run.id, regularUser.id)).rejects.toThrow(
          /Only the HR Head can co-sign/,
        );

        // Scenario B2: super_admin and ceo_cell do not hold the co-sign either (C-04).
        for (const code of ['super_admin', 'ceo_cell']) {
          const role = await trx.selectFrom('core.roles').select('id').where('code', '=', code).executeTakeFirstOrThrow();
          await trx.insertInto('core.user_roles').values({ user_id: regularUser.id, role_id: role.id }).execute();
          await expect(service.approveRun(run.id, regularUser.id)).rejects.toThrow(/Only the HR Head can co-sign/);
        }
        // Break-glass opt-in (client decision) lets super_admin pass the role gate; the
        // two-person rule still applies, so the maker can never co-sign its own run.
        process.env['PAYROLL_SUPER_ADMIN_COSIGN'] = 'true';
        try {
          const sa = await trx.selectFrom('core.roles').select('id').where('code', '=', 'super_admin').executeTakeFirstOrThrow();
          await trx.insertInto('core.user_roles').values({ user_id: makerUser.id, role_id: sa.id }).execute();
          await expect(service.approveRun(run.id, makerUser.id)).rejects.toThrow(/Two-person authorization violation/);
          const run2 = await trx.insertInto('pay.payroll_runs').values({
            company_id: company.id, month: '2026-10-01' as unknown as Date, run_type: 'off_cycle',
            status: 'under_review', attendance_lock_id: lock.id, notes: 'Break-glass test run',
          }).returning('id').executeTakeFirstOrThrow();
          await trx.insertInto('core.audit_log').values({
            actor_user_id: makerUser.id, entity: 'pay.payroll_runs', entity_id: run2.id, action: 'payroll_run_computed',
            prev_hash: '0'.repeat(64), row_hash: '2'.repeat(64),
          }).execute();
          await service.approveRun(run2.id, regularUser.id);
          const approved = await trx.selectFrom('pay.payroll_runs').select('status').where('id', '=', run2.id).executeTakeFirstOrThrow();
          expect(approved.status).toBe('approved');
        } finally {
          delete process.env['PAYROLL_SUPER_ADMIN_COSIGN'];
        }

        // Scenario C: Checker is an authorized hr_head -> must succeed!
        await service.approveRun(run.id, hrHeadUser.id);

        const updatedRun = await trx
          .selectFrom('pay.payroll_runs')
          .select(['status', 'approved_by'])
          .where('id', '=', run.id)
          .executeTakeFirstOrThrow();

        expect(updatedRun.status).toBe('approved');
        expect(updatedRun.approved_by).toBe(hrHeadUser.id);

        // Verify audit log has payroll_run_approved recorded
        const approvalAudit = await trx
          .selectFrom('core.audit_log')
          .select(['action', 'actor_user_id'])
          .where('entity', '=', 'pay.payroll_runs')
          .where('entity_id', '=', run.id)
          .where('action', '=', 'payroll_run_approved')
          .executeTakeFirst();

        expect(approvalAudit).toBeDefined();
        expect(approvalAudit?.actor_user_id).toBe(hrHeadUser.id);

        // Scenario D: Checker is a super_admin -> refused unless break-glass is enabled
        const superAdminRole = await trx
          .selectFrom('core.roles')
          .select('id')
          .where('code', '=', 'super_admin')
          .executeTakeFirstOrThrow();

        const superAdminUser = await trx
          .insertInto('core.users')
          .values({
            email: `superadmin-${stamp}@example.com`,
            password_hash: '!test!',
            // users_employee_unique: one login per employee — the break-glass admin has none.
            employee_id: null,
            is_active: true,
          })
          .returning('id')
          .executeTakeFirstOrThrow();

        await trx.insertInto('core.user_roles').values({
          user_id: superAdminUser.id,
          role_id: superAdminRole.id,
        }).execute();

        const run2 = await trx
          .insertInto('pay.payroll_runs')
          .values({
            company_id: company.id,
            month: '2026-11-01' as unknown as Date,
            run_type: 'regular',
            status: 'under_review',
            attendance_lock_id: lock.id,
            notes: 'Super admin approval test run',
          })
          .returning('id')
          .executeTakeFirstOrThrow();

        await trx
          .insertInto('core.audit_log')
          .values({
            actor_user_id: makerUser.id,
            entity: 'pay.payroll_runs',
            entity_id: run2.id,
            action: 'payroll_run_computed',
            prev_hash: '0000000000000000000000000000000000000000000000000000000000000000',
            row_hash: '2222222222222222222222222222222222222222222222222222222222222222',
          })
          .execute();

        // CD-1 (docs/08 §2): super_admin break-glass co-sign is refused by default…
        await expect(service.approveRun(run2.id, superAdminUser.id)).rejects.toThrow(/Only the HR Head/);
        // …and allowed only when the client opts in.
        process.env['PAYROLL_SUPER_ADMIN_COSIGN'] = 'true';
        try {
          await service.approveRun(run2.id, superAdminUser.id);
        } finally {
          delete process.env['PAYROLL_SUPER_ADMIN_COSIGN'];
        }

        const updatedRun2 = await trx
          .selectFrom('pay.payroll_runs')
          .select(['status', 'approved_by'])
          .where('id', '=', run2.id)
          .executeTakeFirstOrThrow();

        expect(updatedRun2.status).toBe('approved');
        expect(updatedRun2.approved_by).toBe(superAdminUser.id);

        throw rollback;
      });
    } catch (err) {
      if (err !== rollback) throw err;
    }
  });
});
