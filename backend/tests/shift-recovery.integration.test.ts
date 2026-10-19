/** ATT-04/05/06/07/18: native swipes, split halves, request API and final watermark. */
import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../src/core/db/database.js';
import { addDaysIso, istDateString, istDateTime } from '../src/core/dates.js';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { getAbsenceFinalizationReadiness, recomputeDay, setManualStatus } from '../src/modules/attendance/index.js';
import { httpRequest } from './http-client.js';
const url = process.env['DATABASE_URL'];
describe.skipIf(!url)('recovered split-shift integration', () => {
  it('uses both stored sessions for swipes, AR/OD selection and device completeness', async () => {
    const root = createDatabase(url ?? '');
    const rollback = new Error('Intentional shift fixture rollback');
    try {
      await root.transaction().execute(async (db) => {
        const tag = `shift_${randomUUID()}`;
        const date = addDaysIso(istDateString(), -2);
        const at = (time: string) => istDateTime(date, time);
        const company = await db
          .insertInto('core.companies')
          .values({ code: tag, name: tag, ecode_prefix: tag, is_india_payroll: false })
          .returning('id')
          .executeTakeFirstOrThrow();
        const location = await db
          .insertInto('core.locations')
          .values({ company_id: company.id, name: tag, state_code: 'WB' })
          .returning('id')
          .executeTakeFirstOrThrow();
        const employee = await db
          .insertInto('core.employees')
          .values({
            company_id: company.id,
            location_id: location.id,
            ecode: tag,
            first_name: 'Synthetic split employee',
            status: 'active',
            attendance_mode: 'manual',
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        const user = await db
          .insertInto('core.users')
          .values({
            email: `${tag}@hrms.invalid`,
            employee_id: employee.id,
            password_hash: '!disabled!',
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        const role = await db
          .insertInto('core.roles')
          .values({ code: tag, name: tag })
          .returning('id')
          .executeTakeFirstOrThrow();
        const permission = await db
          .selectFrom('core.permissions')
          .select('id')
          .where('code', '=', 'attendance.own')
          .executeTakeFirstOrThrow();
        await db
          .insertInto('core.role_permissions')
          .values({ role_id: role.id, permission_id: permission.id, scope: 'own' })
          .execute();
        await db
          .insertInto('core.user_roles')
          .values({ user_id: user.id, role_id: role.id })
          .execute();
        const session = await db
          .insertInto('sec.sessions')
          .values({ user_id: user.id, expires_at: new Date(Date.now() + 600000) })
          .returning('sid')
          .executeTakeFirstOrThrow();
        const shift = await db
          .insertInto('att.shifts')
          .values({
            code: tag,
            name: tag,
            start_time: '09:00',
            end_time: '13:00',
            session2_start: '14:00',
            session2_end: '18:00',
            min_half_day_hours: '4',
            min_full_day_hours: '8',
            break_minutes: 0,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await db
          .insertInto('att.rosters')
          .values({
            employee_id: employee.id,
            work_date: sql<Date>`${date}::date`,
            shift_id: shift.id,
            is_week_off: false,
          })
          .execute();
        await sql`SELECT att.ensure_swipe_partition(${date}::date)`.execute(db);
        await db
          .insertInto('att.swipe_events')
          .values(
            [
              ['08:00', 'out'],
              ['09:00', 'in'],
              ['18:00', 'out'],
              ['19:00', 'in'],
            ].map(([time, direction]) => ({
              employee_id: employee.id,
              employee_no: tag,
              swipe_ts: at(time ?? ''),
              direction: direction ?? null,
              source: tag,
              received_at: new Date(),
            })),
          )
          .execute();
        expect(await recomputeDay(db, employee.id, date)).toBe('P');
        const day = await db
          .selectFrom('att.day_records')
          .selectAll()
          .where('employee_id', '=', employee.id)
          .where('work_date', '=', sql<Date>`${date}::date`)
          .executeTakeFirstOrThrow();
        expect(day).toMatchObject({
          first_in: at('09:00'),
          last_out: at('18:00'),
          worked_minutes: 480,
          ot_minutes: 0,
        });
        const secret = 'synthetic-split-shift-key';
        const token = await signAccessToken(user.id, `${tag}@hrms.invalid`, secret, session.sid);
        const request = await httpRequest(
          createApp({ db, jwtSecret: secret, secureCookies: false }),
        );
        const settingsPermission = await db
          .selectFrom('core.permissions')
          .select('id')
          .where('code', '=', 'admin.settings')
          .executeTakeFirstOrThrow();
        await db
          .insertInto('core.role_permissions')
          .values({ role_id: role.id, permission_id: settingsPermission.id, scope: 'all' })
          .execute();
        const catalogInput = {
          code: tag,
          name: tag,
          startTime: '09:00',
          endTime: '13:00',
          session2Start: '14:00',
          session2End: '18:00',
          minHalfDayHours: 4,
          minFullDayHours: 8,
          breakMinutes: 30,
          breakPaid: true,
          otStartOffsetMinutes: 30,
          lateSlabs: [],
          earlyExitSlabs: [],
        };
        const shiftPath = `/api/attendance/config/shifts/${tag}`;
        expect(
          (await request.put(shiftPath).auth(token, { type: 'bearer' }).send(catalogInput)).status,
        ).toBe(200);
        expect(
          (
            await request
              .put(shiftPath)
              .auth(token, { type: 'bearer' })
              .send({ ...catalogInput, startTime: '25:00' })
          ).status,
        ).toBe(400);
        expect(
          (
            await request
              .put(shiftPath)
              .auth(token, { type: 'bearer' })
              .send({ ...catalogInput, sessionSplit: '11:00' })
          ).status,
        ).toBe(400);
        // An older client may omit new optional controls; never erase them on edit.
        expect(
          (
            await request
              .put(shiftPath)
              .auth(token, { type: 'bearer' })
              .send({
                code: tag,
                name: tag,
                startTime: '09:00',
                endTime: '13:00',
                minHalfDayHours: 4,
                minFullDayHours: 8,
              })
          ).status,
        ).toBe(200);
        const catalog = await request
          .get('/api/attendance/config/shifts')
          .auth(token, { type: 'bearer' });
        expect(catalog.status).toBe(200);
        expect(
          (
            catalog.body as {
              code: string;
              breakPaid: boolean;
              otStartOffsetMinutes: number;
              session2Start: string;
            }[]
          ).find((row) => row.code === tag),
        ).toMatchObject({
          breakPaid: true,
          otStartOffsetMinutes: 30,
          session2Start: '14:00',
          session2End: '18:00',
        });
        await sql`SAVEPOINT invalid_policy_shape`.execute(db);
        await expect(db.updateTable('att.shifts').set({ late_slabs: JSON.stringify({}) }).where('id', '=', shift.id).execute()).rejects.toThrow(/shifts_policy_arrays/);
        await sql`ROLLBACK TO SAVEPOINT invalid_policy_shape`.execute(db);
        // Sponsor: a matching half-day penalty preserves P/P and daily P.
        const penaltyRules = [{ fromMin: 31, toMin: null, effect: 'half_day' }];
        expect((await request.put(shiftPath).auth(token, { type: 'bearer' })
          .send({ ...catalogInput, lateSlabs: penaltyRules })).status).toBe(200);
        expect((await request.put(shiftPath).auth(token, { type: 'bearer' })
          .send({ ...catalogInput, lateSlabs: [
            { fromMin: 0, toMin: 31, effect: 'late' }, ...penaltyRules,
          ] })).status).toBe(400); // inclusive boundary overlap
        const penaltyDate = addDaysIso(date, -1);
        const penaltyAt = (time: string) => istDateTime(penaltyDate, time);
        await db.insertInto('att.rosters').values({ employee_id: employee.id,
          work_date: sql<Date>`${penaltyDate}::date`, shift_id: shift.id, is_week_off: false }).execute();
        await sql`SELECT att.ensure_swipe_partition(${penaltyDate}::date)`.execute(db);
        await db.insertInto('att.swipe_events').values([
          { employee_id: employee.id, employee_no: tag, swipe_ts: penaltyAt('09:40'), direction: 'in', source: tag, received_at: new Date() },
          { employee_id: employee.id, employee_no: tag, swipe_ts: penaltyAt('18:00'), direction: 'out', source: tag, received_at: new Date() },
        ]).execute();
        expect(await recomputeDay(db, employee.id, penaltyDate)).toBe('P');
        const evaluated = await db.selectFrom('att.day_records').selectAll().where('employee_id', '=', employee.id)
          .where('work_date', '=', sql<Date>`${penaltyDate}::date`).executeTakeFirstOrThrow();
        expect(evaluated.status).toBe('P');
        expect(evaluated.session_statuses).toEqual([{ session: 1, status: 'P' }, { session: 2, status: 'P' }]);
        expect(evaluated.penalty_flag).toBe(true);
        const findings = [{ cause: 'late_arrival', minutes: 40, rule: penaltyRules[0] }];
        expect(evaluated.penalty_evaluation).toEqual(findings);
        const ess = await request.get(`/api/my/attendance?month=${penaltyDate.slice(0,7)}`).auth(token, { type: 'bearer' });
        expect(ess.status).toBe(200);
        expect((ess.body as { date: string; penaltyEvaluation: unknown }[]).find(d => d.date === penaltyDate))
          .toMatchObject({ status: 'P', penaltyFlag: true, penaltyEvaluation: findings });
        // A catalog edit does not rewrite a stored/locked historical finding.
        await db.updateTable('att.shifts').set({ late_slabs: '[]' }).where('id', '=', shift.id).execute();
        expect((await db.selectFrom('att.day_records').select('penalty_evaluation').where('id', '=', evaluated.id)
          .executeTakeFirstOrThrow()).penalty_evaluation).toEqual(findings);
        await sql`SAVEPOINT penalty_lock_proof`.execute(db);
        await db.updateTable('att.day_records').set({ is_locked: true }).where('id', '=', evaluated.id).execute();
        expect(await recomputeDay(db, employee.id, penaltyDate)).toBe('skipped');
        await expect(db.updateTable('att.day_records').set({ penalty_flag: false, penalty_evaluation: '[]' })
          .where('id', '=', evaluated.id).execute()).rejects.toThrow();
        await sql`ROLLBACK TO SAVEPOINT penalty_lock_proof`.execute(db);
        await setManualStatus(db, { employeeId: employee.id, isoDate: penaltyDate, status: 'P',
          actorUserId: user.id, reason: 'Synthetic correction clears derived penalty' });
        expect(await db.selectFrom('att.day_records').select(['penalty_flag','penalty_evaluation'])
          .where('id', '=', evaluated.id).executeTakeFirstOrThrow())
          .toEqual({ penalty_flag: false, penalty_evaluation: null });
        for (const value of [
          [{ cause: null, minutes: 40, rule: penaltyRules[0] }],
          [{ cause: 'late_arrival', minutes: 40, rule: { ...penaltyRules[0], effect: null } }],
          [{ cause: 'late_arrival', minutes: 10, rule: penaltyRules[0] }],
          [findings[0], findings[0]],
        ]) {
          const checked = await sql<{ valid: boolean }>`SELECT att.valid_penalty_evaluation(${JSON.stringify(value)}::jsonb) AS valid`.execute(db);
          expect(checked.rows[0]?.valid).toBe(false);
        }
        const schedule = await request
          .get(`/api/attendance/requests/schedule?date=${date}`)
          .auth(token, { type: 'bearer' });
        expect(schedule.status).toBe(200);
        expect((schedule.body as { windows: unknown[] }).windows).toEqual([
          {
            dayPortion: 'full_day',
            startsAt: at('09:00').toISOString(),
            endsAt: at('18:00').toISOString(),
          },
          {
            dayPortion: 'first_half',
            startsAt: at('09:00').toISOString(),
            endsAt: at('13:00').toISOString(),
          },
          {
            dayPortion: 'second_half',
            startsAt: at('14:00').toISOString(),
            endsAt: at('18:00').toISOString(),
          },
        ]);
        for (const [kind, dayPortion] of [
          ['AR', 'first_half'],
          ['OD', 'second_half'],
        ] as const) {
          const result = await request
            .post('/api/attendance/requests')
            .auth(token, { type: 'bearer' })
            .send({
              kind,
              dayPortion,
              fromDate: date,
              toDate: date,
              reason: 'Synthetic split session correction',
            });
          expect(result.status).toBe(200);
        }
        await db
          .updateTable('core.employees')
          .set({ attendance_mode: 'biometric', biometric_registered: true })
          .where('id', '=', employee.id)
          .execute();
        const device = await db
          .insertInto('att.devices')
          .values({ door_code: tag, location_id: location.id })
          .returning('id')
          .executeTakeFirstOrThrow();
        await db
          .insertInto('att.device_watermarks')
          .values({ device_id: device.id, watermark_ts: at('13:00') })
          .execute();
        expect(await getAbsenceFinalizationReadiness(db, employee.id, date)).toMatchObject({
          ready: false,
          shiftEndAt: at('18:00'),
        });
        await db
          .updateTable('att.device_watermarks')
          .set({ watermark_ts: at('18:00') })
          .where('device_id', '=', device.id)
          .execute();
        expect(await getAbsenceFinalizationReadiness(db, employee.id, date)).toMatchObject({
          ready: true,
        });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      await root.destroy();
    }
  });
});
