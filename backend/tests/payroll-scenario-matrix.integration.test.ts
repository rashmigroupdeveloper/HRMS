/**
 * Attendance → payroll scenario matrix (handover item 4). Cases and their
 * independently hand-computed expectations live in
 * docs/qa-handover/attendance-payroll/scripts/scenario-matrix.json (built by
 * build_matrix.py). Each payroll case is a synthetic company in a rolled-back
 * transaction: settings → attendance window → locked day facts → real payroll
 * run (create → lock inputs → compute) → compare days, gross, statutory lines, net.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import type { Database, DayStatus, SalaryComponentItem } from '../src/core/db/types.js';
import { createDatabase } from '../src/core/db/database.js';
import { addDaysIso } from '../src/core/dates.js';
import { resolveAttendanceWindow } from '../src/core/db/attendance-cycle.js';
import { findHoliday } from '../src/core/db/holiday-calendar.js';
import { setSetting } from '../src/modules/settings/index.js';
import { PayrollRunService } from '../src/modules/payroll-core/runs/run.service.js';
import { insertSalaryRevision } from '../src/modules/payroll-core/salaries/assignment.repository.js';
import { calculateGratuity } from '../src/modules/payroll-core/fnf/gratuity-calculator.js';
import { computeFnfSettlement } from '../src/modules/payroll-core/fnf/fnf-engine.js';

interface PayrollCase {
  id: string; kind: 'payroll'; title: string; month: string;
  settings: Record<string, string | number | boolean>;
  employee: { doj?: string; dol?: string; status?: string; esic?: boolean; regime?: 'old' | 'new'; pfBasis?: 'ACTUAL' | 'CEILING_15000' };
  salary: Record<string, number>; salaryAtPeriodStart?: Record<string, number>;
  days: Record<string, string>; afterCutoff?: Record<string, string>;
  holidays?: { date: string; scope: string }[]; declarations?: { section: string; amount: number }[]; otMinutes?: number;
  expect: Record<string, number>;
}
interface WindowCase { id: string; kind: 'window'; title: string; month: string; settings: Record<string, number>; previousLock?: { month: string; from: string; until: string }; expect: { from: string; until: string } }
interface HolidayCase { id: string; kind: 'holiday'; title: string; holidays: { date: string; scope: 'group' | 'company' | 'plant' | 'location' }[]; expect: Record<string, string[]> }
interface GratuityCase { id: string; kind: 'gratuity'; title: string; basic: number; doj: string; lwd: string; expect: { eligible: boolean; years: number; gratuity: number } }
interface FnfCase { id: string; kind: 'fnf'; title: string; params: { basic: number; gross: number; daysPayable: number; elBalanceDays: number; shortfallDays: number; doj: string; lwd: string }; expect: Record<string, number> }
type MatrixCase = PayrollCase | WindowCase | HolidayCase | GratuityCase | FnfCase;

const matrix = JSON.parse(readFileSync(new URL('../../docs/qa-handover/attendance-payroll/scripts/scenario-matrix.json', import.meta.url), 'utf8')) as { cases: MatrixCase[] };
const url = process.env['DATABASE_URL'];
const rollback = new Error('rollback scenario-matrix fixture');
const DEFAULTS: Record<string, string | number | boolean> = { 'pay.lop_divisor': 'CALENDAR', 'att.cycle_start_day': 1, 'att.sandwich_rule': false, 'pay.pf_wage_base': 'ACTUAL' };

async function inRollback(db: Kysely<Database>, fn: (trx: Kysely<Database>) => Promise<void>): Promise<void> {
  try {
    await db.transaction().execute(async (trx) => { await fn(trx); throw rollback; });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

async function applySettings(trx: Kysely<Database>, values: Record<string, string | number | boolean>) {
  for (const [key, value] of Object.entries({ ...DEFAULTS, ...values })) {
    const type = typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string';
    await setSetting(trx, { key, value, type, description: `matrix ${key}`, actorUserId: null });
  }
}

async function org(trx: Kysely<Database>, tag: string) {
  const company = await trx.insertInto('core.companies').values({ code: tag, name: `Matrix ${tag}`, ecode_prefix: tag.slice(0, 4) }).returning('id').executeTakeFirstOrThrow();
  const loc = await trx.insertInto('core.locations').values({ company_id: company.id, name: `${tag} WB`, state_code: 'WB' }).returning('id').executeTakeFirstOrThrow();
  const loc2 = await trx.insertInto('core.locations').values({ company_id: company.id, name: `${tag} WB2`, state_code: 'WB' }).returning('id').executeTakeFirstOrThrow();
  const plant = await trx.insertInto('core.plants').values({ company_id: company.id, plant_code: `${tag}P1`, name: `${tag} plant 1`, location_id: loc.id }).returning('id').executeTakeFirstOrThrow();
  const plant2 = await trx.insertInto('core.plants').values({ company_id: company.id, plant_code: `${tag}P2`, name: `${tag} plant 2`, location_id: loc2.id }).returning('id').executeTakeFirstOrThrow();
  return { companyId: company.id, locationId: loc.id, location2Id: loc2.id, plantId: plant.id, plant2Id: plant2.id };
}

function dayRow(code: string): { status: DayStatus; leave?: string; weekoffPaid?: boolean; sessions?: string } {
  const [status = 'P', leave, worked] = code.split(':');
  if (status === 'WO') return { status: 'WO', weekoffPaid: leave !== 'unpaid' };
  return { status: status as DayStatus, ...(leave ? { leave } : {}), ...(worked === 'worked' ? { sessions: JSON.stringify([{ session: 1, status: 'P' }, { session: 2, status: 'A' }]) } : {}) };
}

async function runPayrollCase(db: Kysely<Database>, c: PayrollCase): Promise<Record<string, number>> {
  let actual: Record<string, number> = {};
  await inRollback(db, async (trx) => {
    const tag = `MX${c.id}${String(Date.now()).slice(-6)}`;
    await applySettings(trx, c.settings);
    const o = await org(trx, tag);
    const user = await trx.insertInto('core.users').values({ email: `${tag.toLowerCase()}@hrms.invalid`, password_hash: '!disabled!' }).returning('id').executeTakeFirstOrThrow();
    const structure = await trx.insertInto('pay.salary_structures').values({ company_id: o.companyId, name: tag, components: sql<SalaryComponentItem[]>`${JSON.stringify([{ component_code: 'BASIC' }])}::jsonb` }).returning('id').executeTakeFirstOrThrow();
    const doj = c.employee.doj ?? '2020-01-01';
    const emp = await trx.insertInto('core.employees').values({
      company_id: o.companyId, ecode: `${tag}E`, first_name: c.id, status: (c.employee.status ?? 'active') as never, doj: doj as never,
      dol: (c.employee.dol ?? null) as never, location_id: o.locationId, plant_id: o.plantId, pf_applicable: true,
      esic_applicable: c.employee.esic ?? false, tax_regime: c.employee.regime ?? 'new', pf_wage_basis: c.employee.pfBasis ?? null,
    }).returning('id').executeTakeFirstOrThrow();
    const paise = (amounts: Record<string, number>) => Object.fromEntries(Object.entries(amounts).map(([k, v]) => [k, v * 100]));
    const revision = (from: string, amounts: Record<string, number>) => insertSalaryRevision(trx, { employee_id: emp.id, structure_id: structure.id, effective_from: from, annual_ctc: '1.00', phase: 'confirmed', component_amounts: paise(amounts), revision_reason: 'joining', approved_by: user.id });
    if (c.salaryAtPeriodStart) { await revision(doj, c.salaryAtPeriodStart); await revision(c.month, c.salary); } else await revision(doj, c.salary);
    for (const h of c.holidays ?? []) {
      await trx.insertInto('att.holidays').values({ holiday_date: h.date as never, name: `${c.id} holiday`, company_id: h.scope === 'group' ? null : o.companyId, plant_id: h.scope === 'plant' ? o.plantId : null, location_id: h.scope === 'location' ? o.locationId : null }).execute();
    }
    for (const d of c.declarations ?? []) {
      await trx.insertInto('pay.investment_declarations').values({ employee_id: emp.id, fy: '2026-27', section: d.section, declared_amount: d.amount.toFixed(2) }).execute();
    }
    const leaveTypes = new Map((await trx.selectFrom('lv.leave_types').select(['id', 'code']).execute()).map((l) => [l.code, l.id]));

    const window = await resolveAttendanceWindow(trx, o.companyId, c.month);
    const exitUntil = c.employee.dol ? addDaysIso(c.employee.dol, 1) : window.until;
    const from = doj > window.from ? doj : window.from;
    const until = exitUntil < window.until ? exitUntil : window.until;
    const write = async (iso: string, code: string, locked: boolean) => {
      const row = dayRow(code);
      await trx.insertInto('att.day_records').values({
        employee_id: emp.id, work_date: iso as never, status: row.status, is_locked: locked,
        leave_type_id: row.leave ? (leaveTypes.get(row.leave) ?? null) : null,
        weekoff_paid: row.weekoffPaid ?? null, session_statuses: row.sessions ?? null,
        worked_minutes: row.sessions ? 240 : 0,
      }).execute();
    };
    for (let iso = from; iso < until; iso = addDaysIso(iso, 1)) {
      const sunday = new Date(`${iso}T00:00:00Z`).getUTCDay() === 0;
      await write(iso, c.days[iso] ?? (sunday ? 'WO' : 'P'), true);
    }
    for (const [iso, code] of Object.entries(c.afterCutoff ?? {})) await write(iso, code, false);
    if (c.otMinutes) {
      await trx.insertInto('att.overtime_entries').values({ employee_id: emp.id, work_date: addDaysIso(c.month, 9) as never, detected_minutes: c.otMinutes, claimed_minutes: c.otMinutes, approved_minutes: c.otMinutes, status: 'approved', deadline_at: new Date() }).execute();
    }
    await trx.insertInto('att.month_locks').values({ company_id: o.companyId, month: c.month as never, locked_by: user.id, locked_at: new Date(), period_from: window.from as never, period_until: window.until as never }).execute();

    const service = new PayrollRunService(trx);
    const runId = await service.createRun({ companyId: o.companyId, month: c.month, actorUserId: user.id });
    await service.lockInputs(runId, user.id);
    const result = await service.computeRun(runId, user.id);
    expect(result.exceptions).toEqual([]);
    const item = await trx.selectFrom('pay.payroll_items').selectAll().where('run_id', '=', runId).where('employee_id', '=', emp.id).executeTakeFirstOrThrow();
    const lines = await trx.selectFrom('pay.payroll_item_lines').select(['component_code', 'amount']).where('item_id', '=', item.id).execute();
    const line = (code: string) => Number(lines.find((l) => l.component_code === code)?.amount ?? 0);
    actual = {
      days_in_month: Number(item.days_in_month), payable_days: Number(item.payable_days), gross: Number(item.gross), net: Number(item.net_pay),
      PF_EE: line('PF_EE'), ESI_EE: line('ESI_EE'), PT: line('PT'), TDS: line('TDS'), PF_ER: line('PF_ER'), EPS_ER: line('EPS_ER'), ESI_ER: line('ESI_ER'),
    };
  });
  return actual;
}

describe.skipIf(!url)('Attendance → payroll scenario matrix', () => {
  let db: Kysely<Database>;
  beforeAll(() => { db = createDatabase(url ?? ''); });
  afterAll(async () => { await db.destroy(); });

  for (const c of matrix.cases) {
    it(`${c.id} ${c.title}`, async () => {
      if (c.kind === 'payroll') {
        const actual = await runPayrollCase(db, c);
        const picked = Object.fromEntries(Object.keys(c.expect).map((k) => [k, actual[k]]));
        expect(picked).toEqual(c.expect);
      } else if (c.kind === 'window') {
        await inRollback(db, async (trx) => {
          await applySettings(trx, c.settings);
          const o = await org(trx, `MX${c.id}${String(Date.now()).slice(-6)}`);
          const user = await trx.insertInto('core.users').values({ email: `mx${c.id.toLowerCase()}${String(Date.now())}@hrms.invalid`, password_hash: '!disabled!' }).returning('id').executeTakeFirstOrThrow();
          if (c.previousLock) {
            await trx.insertInto('att.month_locks').values({ company_id: o.companyId, month: c.previousLock.month as never, locked_by: user.id, period_from: c.previousLock.from as never, period_until: c.previousLock.until as never }).execute();
          }
          expect(await resolveAttendanceWindow(trx, o.companyId, c.month)).toEqual(c.expect);
        });
      } else if (c.kind === 'holiday') {
        await inRollback(db, async (trx) => {
          const a = await org(trx, `MXA${String(Date.now()).slice(-6)}`);
          const b = await org(trx, `MXB${String(Date.now()).slice(-6)}`);
          for (const h of c.holidays) {
            await trx.insertInto('att.holidays').values({ holiday_date: h.date as never, name: h.scope, company_id: h.scope === 'group' ? null : a.companyId, plant_id: h.scope === 'plant' ? a.plantId : null, location_id: h.scope === 'location' ? a.locationId : null }).execute();
          }
          const who = {
            inPlant: { companyId: a.companyId, plantId: a.plantId, locationId: a.locationId },
            samCompanyOtherPlantOtherLocation: { companyId: a.companyId, plantId: a.plant2Id, locationId: a.location2Id },
            otherCompany: { companyId: b.companyId, plantId: b.plantId, locationId: b.locationId },
          };
          const got: Record<string, string[]> = {};
          for (const [k, subject] of Object.entries(who)) {
            got[k] = [];
            for (const h of c.holidays) if (await findHoliday(trx, subject, h.date)) got[k].push(h.date);
          }
          expect(got).toEqual(c.expect);
        });
      } else if (c.kind === 'gratuity') {
        const g = calculateGratuity({ basicMonthlyPaise: c.basic * 100, doj: c.doj, lastWorkingDay: c.lwd });
        expect({ eligible: g.isEligible, years: g.completedYearsRounded, gratuity: g.gratuityRupees }).toEqual(c.expect);
      } else {
        const p = c.params;
        const f = computeFnfSettlement({ employeeId: 1, separationId: 1, doj: p.doj, approvedLwd: p.lwd, daysPayable: p.daysPayable, basicMonthlyPaise: p.basic * 100, grossMonthlyPaise: p.gross * 100, elBalanceDays: p.elBalanceDays, shortfallDays: p.shortfallDays });
        expect({ gratuity: f.earnings.gratuityPaise / 100, leaveEncashment: f.earnings.leaveEncashmentPaise / 100, noticeRecovery: f.deductions.noticeRecoveryPaise / 100, net: f.netPayableRupees }).toEqual(c.expect);
      }
    });
  }
});
