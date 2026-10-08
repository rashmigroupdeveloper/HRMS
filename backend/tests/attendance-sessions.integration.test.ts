/** ATT-05: writes are contained in one rollback-only transaction; no cleanup deletes. */
import 'dotenv/config';
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { sql } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import { setManualStatus, recomputeDay } from '../src/modules/attendance/index.js';
import { myAttendanceMonth } from '../src/modules/reports/dashboard.service.js';
import { buildMusterMonth, listMuster, exportMusterExcel } from '../src/modules/reports/muster.service.js';

const url = process.env['DATABASE_URL'];
describe.skipIf(!url)('ATT-05 session persistence and export (rollback only)', () => {
  it('retains P:O through HR override, ESS, recompute protection and Excel without changing totals', async () => {
    const db = createDatabase(url ?? '');
    const rollback = new Error('rollback-only attendance fixture');
    try {
      await expect(db.transaction().execute(async (trx) => {
        const stamp = `SES${String(Date.now())}`;
        const company = await trx.insertInto('core.companies')
          .values({ code: stamp, name: 'Session test', ecode_prefix: 'SES' }).returning('id').executeTakeFirstOrThrow();
        const employee = await trx.insertInto('core.employees')
          .values({ company_id: company.id, ecode: stamp, first_name: 'Session fixture', status: 'active' }).returning('id').executeTakeFirstOrThrow();
        const actor = await trx.insertInto('core.users')
          .values({ email: `${stamp}@hrms.test`, password_hash: 'test-unused' }).returning('id').executeTakeFirstOrThrow();
        const sessions = [{ session: 1, status: 'P' }, { session: 2, status: 'O' }] as const;
        await setManualStatus(trx, {
          employeeId: employee.id, isoDate: '2026-10-05', status: 'P',
          sessionStatuses: [...sessions], reason: 'Approved half-session off fixture', actorUserId: actor.id,
        });
        const rows = await myAttendanceMonth(trx, employee.id, '2026-10');
        expect(rows[0]).toMatchObject({ status: 'P', sessionStatuses: sessions });
        expect(await recomputeDay(trx, employee.id, '2026-10-05')).toBe('skipped');
        await buildMusterMonth(trx, company.id, '2026-10');
        const muster = await listMuster(trx, { companyId: company.id, month: '2026-10' });
        expect(muster[0]).toMatchObject({ dayStatuses: { '05': 'P:O' }, present: 1, lopDays: 0, leaveByType: {} });
        const workbook = new ExcelJS.Workbook();
        const buffer = await exportMusterExcel(trx, { companyId: company.id, month: '2026-10' });
        await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
        const sheet = workbook.getWorksheet('Muster');
        const header = sheet?.getRow(1);
        let dayColumn = 0;
        header?.eachCell((cell, column) => { if (cell.value === 'Day 5') dayColumn = column; });
        expect(dayColumn).toBeGreaterThan(0);
        expect(sheet?.getRow(2).getCell(dayColumn).value).toBe('P:O');
        const audit = await trx.selectFrom('core.audit_log').select(['new_value'])
          .where('actor_user_id', '=', actor.id).where('field', '=', 'manual_override:2026-10-05').executeTakeFirstOrThrow();
        expect(JSON.parse(audit.new_value ?? '{}') as unknown).toMatchObject({ sessionStatuses: sessions });
        // Even the immutable audit insert is rolled back, rather than hard-deleted.
        throw rollback;
      })).rejects.toBe(rollback);
      const fixture = await sql<{ count: string }>`SELECT COUNT(*)::text AS count FROM core.companies WHERE name = 'Session test'`.execute(db);
      expect(fixture.rows[0]?.count).toBe('0');
    } finally {
      await db.destroy();
    }
  });
});
