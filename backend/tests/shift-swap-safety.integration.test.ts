/** SHF-07/CORE-10/11: authoritative paired scope and frozen roster snapshots. */
import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../src/core/db/database.js';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { act } from '../src/modules/workflows/index.js';
import { requestShiftSwap } from '../src/modules/attendance/shift-swap.service.js';
import { httpRequest } from './http-client.js';
const url = process.env['DATABASE_URL'];
describe.skipIf(!url)('shift swap approval safety', () => {
  it('applies the pair atomically, rejects stale week-offs and out-of-scope counterparts', async () => {
    const db = createDatabase(url ?? '');
    const rollback = new Error('Intentional paired swap fixture rollback');
    try {
      await db.transaction().execute(async (tx) => {
        const tag = `swap_${randomUUID()}`;
        const company = await tx
          .insertInto('core.companies')
          .values({ code: tag, name: tag, ecode_prefix: tag, is_india_payroll: false })
          .returning('id')
          .executeTakeFirstOrThrow();
        const manager = await tx
          .insertInto('core.employees')
          .values({
            company_id: company.id,
            ecode: `${tag}M`,
            first_name: 'Synthetic manager',
            status: 'active',
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        const people = await tx
          .insertInto('core.employees')
          .values(
            ['A', 'B'].map((name) => ({
              company_id: company.id,
              ecode: tag + name,
              first_name: `Synthetic ${name}`,
              reporting_manager_id: manager.id,
              status: 'active' as const,
            })),
          )
          .returning('id')
          .execute();
        const a = people[0]?.id;
        const b = people[1]?.id;
        if (!a || !b) throw new Error('Missing pair');
        const users = await tx
          .insertInto('core.users')
          .values(
            [manager.id, a, b].map((employeeId) => ({
              employee_id: employeeId,
              email: `${tag}_${String(employeeId)}@hrms.invalid`,
              password_hash: '!disabled!',
            })),
          )
          .returning(['id', 'employee_id'])
          .execute();
        const managerUser = users.find((user) => user.employee_id === manager.id)?.id;
        const userA = users.find((user) => user.employee_id === a)?.id;
        const userB = users.find((user) => user.employee_id === b)?.id;
        if (!managerUser || !userA || !userB) throw new Error('Missing accounts');
        const role = await tx
          .insertInto('core.roles')
          .values({ code: tag, name: tag })
          .returning('id')
          .executeTakeFirstOrThrow();
        const permission = await tx
          .selectFrom('core.permissions')
          .select('id')
          .where('code', '=', 'attendance.roster.write')
          .executeTakeFirstOrThrow();
        await tx
          .insertInto('core.role_permissions')
          .values({ role_id: role.id, permission_id: permission.id, scope: 'subtree' })
          .execute();
        await tx
          .insertInto('core.user_roles')
          .values({ user_id: managerUser, role_id: role.id })
          .execute();
        const steps = JSON.stringify([
          { step: 1, approver: `user:${String(managerUser)}`, slaHours: 48, onBreach: 'escalate' },
        ]);
        await tx
          .insertInto('wf.definitions')
          .values({ code: 'shift_swap', name: 'Synthetic swap chain', steps })
          .onConflict((oc) => oc.column('code').doUpdateSet({ steps, is_active: true }))
          .execute();
        const shifts = await tx
          .insertInto('att.shifts')
          .values(
            ['09:00', '10:00'].map((start, index) => ({
              code: `${tag}${String(index)}`,
              name: tag,
              start_time: start,
              end_time: index === 0 ? '17:00' : '18:00',
              min_half_day_hours: '4',
              min_full_day_hours: '8',
              break_minutes: 0,
            })),
          )
          .returning('id')
          .execute();
        const first = shifts[0]?.id;
        const second = shifts[1]?.id;
        if (!first || !second) throw new Error('Missing shifts');
        const secret = 'synthetic-paired-swap-key';
        const request = await httpRequest(
          createApp({ db: tx, jwtSecret: secret, secureCookies: false }),
        );
        const roster = async (date: string) => {
          await tx
            .insertInto('att.rosters')
            .values(
              [
                { employee_id: a, shift_id: first },
                { employee_id: b, shift_id: second },
              ].map((row) => ({ ...row, work_date: sql<Date>`${date}::date`, is_week_off: false })),
            )
            .execute();
        };
        const raise = (date: string) =>
          requestShiftSwap(tx, {
            requesterEmployeeId: a,
            requestedByUserId: userA,
            counterpartEmployeeId: b,
            workDate: date,
            kind: 'swap',
            reason: 'Synthetic schedule exchange',
          });
        await roster('2030-01-08');
        const successful = await raise('2030-01-08');
        expect(
          await act(tx, {
            requestId: successful.workflowRequestId,
            actorUserId: managerUser,
            action: 'approve',
          }),
        ).toBe('approved');
        const after = await tx
          .selectFrom('att.rosters')
          .select(['employee_id', 'shift_id'])
          .where('employee_id', 'in', [a, b])
          .where('work_date', '=', sql<Date>`'2030-01-08'::date`)
          .execute();
        expect(after.find((row) => row.employee_id === a)?.shift_id).toBe(second);
        expect(after.find((row) => row.employee_id === b)?.shift_id).toBe(first);
        expect(
          (
            await tx
              .selectFrom('att.shift_swaps')
              .select('applied')
              .where('id', '=', successful.id)
              .executeTakeFirstOrThrow()
          ).applied,
        ).toBe(true);
        await roster('2030-01-09');
        const stale = await raise('2030-01-09');
        await expect(
          requestShiftSwap(tx, {
            requesterEmployeeId: b,
            requestedByUserId: userB,
            counterpartEmployeeId: a,
            workDate: '2030-01-09',
            kind: 'swap',
            reason: 'Opposite pending proposal',
          }),
        ).rejects.toThrow(/already in progress/);
        await tx
          .updateTable('att.rosters')
          .set({ is_week_off: true })
          .where('employee_id', '=', b)
          .where('work_date', '=', sql<Date>`'2030-01-09'::date`)
          .execute();
        await sql`SAVEPOINT stale_approval`.execute(tx);
        await expect(
          act(tx, {
            requestId: stale.workflowRequestId,
            actorUserId: managerUser,
            action: 'approve',
          }),
        ).rejects.toThrow(/roster was modified/);
        await sql`ROLLBACK TO SAVEPOINT stale_approval`.execute(tx);
        expect(
          (
            await tx
              .selectFrom('att.shift_swaps')
              .select('applied')
              .where('id', '=', stale.id)
              .executeTakeFirstOrThrow()
          ).applied,
        ).toBe(false);
        await roster('2030-01-11');
        const inactive = await raise('2030-01-11');
        await tx.updateTable('core.employees').set({ status: 'exited', dol: sql<Date>`'2030-01-10'::date` }).where('id', '=', b).execute();
        await sql`SAVEPOINT inactive_swap_approval`.execute(tx);
        await expect(act(tx, { requestId: inactive.workflowRequestId, actorUserId: managerUser, action: 'approve' }))
          .rejects.toThrow(/must still be active/);
        await sql`ROLLBACK TO SAVEPOINT inactive_swap_approval`.execute(tx);
        expect((await tx.selectFrom('att.shift_swaps').select('applied').where('id', '=', inactive.id)
          .executeTakeFirstOrThrow()).applied).toBe(false);
        expect((await tx.selectFrom('wf.requests').select('status').where('id', '=', inactive.workflowRequestId)
          .executeTakeFirstOrThrow()).status).toBe('pending');
        await tx.updateTable('core.employees').set({ status: 'active', dol: null }).where('id', '=', b).execute();
        await roster('2030-01-10');
        const moved = await raise('2030-01-10');
        await tx
          .updateTable('core.employees')
          .set({ reporting_manager_id: null })
          .where('id', '=', b)
          .execute();
        await sql`SAVEPOINT scoped_approval`.execute(tx);
        await expect(
          act(tx, {
            requestId: moved.workflowRequestId,
            actorUserId: managerUser,
            action: 'approve',
          }),
        ).rejects.toThrow(/scope/);
        await sql`ROLLBACK TO SAVEPOINT scoped_approval`.execute(tx);
        expect(
          (
            await tx
              .selectFrom('att.shift_swaps')
              .select('applied')
              .where('id', '=', moved.id)
              .executeTakeFirstOrThrow()
          ).applied,
        ).toBe(false);
        const session = await tx
          .insertInto('sec.sessions')
          .values({ user_id: userA, expires_at: new Date(Date.now() + 600000) })
          .returning('sid')
          .executeTakeFirstOrThrow();
        const token = await signAccessToken(userA, `${tag}@hrms.invalid`, secret, session.sid);
        expect(
          (
            await request
              .post('/api/workflows/requests')
              .auth(token, { type: 'bearer' })
              .send({ definitionCode: 'shift_swap', payload: { counterpartEmployeeId: b } })
          ).status,
        ).toBe(400);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      await db.destroy();
    }
  });
});
