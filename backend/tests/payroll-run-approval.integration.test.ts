/**
 * PAY-03 / docs/14 §3: Payroll maker-checker approval authorization tests.
 * - Two-person rule: maker cannot self-approve.
 * - Approver must hold an authorized HR/Executive co-sign role (hr_head, super_admin, or ceo_cell).
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
          /lacks the required role \(hr_head, super_admin, or ceo_cell\)/,
        );

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

        // Scenario D: Checker is a super_admin -> must also succeed
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
            employee_id: hrHeadEmp.id,
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

        await service.approveRun(run2.id, superAdminUser.id);

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
