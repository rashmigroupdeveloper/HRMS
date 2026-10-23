/**
 * Comprehensive Reports Catalog Integration Suite (docs/06 §R2-R6, R21, R23-R31, RPT-01..04).
 *
 * Exercises all report queries against PostgreSQL to verify schema joins, grouping,
 * filters, and KPI trend reconstruction.
 */

import 'dotenv/config';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import {
  reportR2Swipes,
  reportR2RawSwipes,
  reportR3Regularizations,
  reportR4Exceptions,
  reportR5Ot,
  reportR6AbsenceCases,
  reportR24Boarding,
  reportR27Headcount,
  reportR21Offers,
  reportR23Transfers,
  reportR25Probation,
  reportR26Attrition,
  reportR28Assets,
  reportR29Helpdesk,
  reportR30Policies,
  reportR31Claims,
} from '../src/modules/reports/reports.service.js';
import {
  buildKpiSnapshot,
  readKpiSnapshot,
  kpiTrend,
} from '../src/modules/reports/kpi-snapshot.service.js';
import {
  hrOpsDashboard,
  essHome,
  myAttendanceMonth,
  teamMonthGrid,
  businessUnitDashboard,
} from '../src/modules/reports/dashboard.service.js';
import { setSetting } from '../src/modules/settings/index.js';

const DB_URL = process.env['DATABASE_URL'];

describe.skipIf(!DB_URL)('Reports Catalog & KPI Snapshot Suite (Live Postgres)', () => {
  let db: Kysely<Database>;
  let companyId: number;

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    const company = await db
      .selectFrom('core.companies')
      .select('id')
      .where('code', '=', 'RML')
      .executeTakeFirst();
    companyId = company?.id ?? 1;
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('R2: executes daily swipe report with and without ecode filter', async () => {
    const resAll = await reportR2Swipes(db, {
      companyId,
      month: '2026-06',
    });
    expect(Array.isArray(resAll)).toBe(true);

    const resSingle = await reportR2Swipes(db, {
      companyId,
      month: '2026-06',
      ecode: 'NON_EXISTENT_ECODE',
    });
    expect(Array.isArray(resSingle)).toBe(true);
    expect(resSingle.length).toBe(0);
  });

  it('R2 Raw: executes raw swipe drill-down query', async () => {
    const raw = await reportR2RawSwipes(db, {
      ecode: 'DEV44439925',
      workDate: '2026-06-01',
    });
    expect(Array.isArray(raw)).toBe(true);
  });

  it('R3: executes attendance regularization report with filters', async () => {
    const res = await reportR3Regularizations(db, {
      companyId,
      status: 'pending',
    });
    expect(Array.isArray(res)).toBe(true);

    const resFiltered = await reportR3Regularizations(db, {
      companyId,
      kind: 'missed_swipe',
    });
    expect(Array.isArray(resFiltered)).toBe(true);
  });

  it('R4: executes exceptions report', async () => {
    const res = await reportR4Exceptions(db, companyId, '2026-06');
    expect(Array.isArray(res)).toBe(true);
  });

  it('R5: executes overtime report', async () => {
    const res = await reportR5Ot(db, companyId, '2026-06');
    expect(Array.isArray(res)).toBe(true);
  });

  it('R6: executes absence cases report with openOnly toggle', async () => {
    const all = await reportR6AbsenceCases(db, { companyId });
    expect(Array.isArray(all)).toBe(true);

    const open = await reportR6AbsenceCases(db, { companyId, openOnly: true });
    expect(Array.isArray(open)).toBe(true);

    const staged = await reportR6AbsenceCases(db, { companyId, stage: 'notice_1' });
    expect(Array.isArray(staged)).toBe(true);
  });

  it('R24: executes boarding report for joins and exits', async () => {
    const res = await reportR24Boarding(db, '2026-01-01', '2026-12-31', companyId);
    expect(res).toHaveProperty('joins');
    expect(res).toHaveProperty('exits');
    expect(Array.isArray(res.joins)).toBe(true);
    expect(Array.isArray(res.exits)).toBe(true);
  });

  it('R27: executes point-in-time headcount report with dimensions', async () => {
    const res = await reportR27Headcount(db, {
      companyId,
      asOf: '2026-06-30',
    });
    expect(Array.isArray(res)).toBe(true);

    const resMonths = await reportR27Headcount(db, {
      companyId,
      fromMonth: '2026-01',
      toMonth: '2026-06',
    });
    expect(Array.isArray(resMonths)).toBe(true);

    // Cross-year rollover month iteration (Dec -> Jan)
    const resRollover = await reportR27Headcount(db, {
      companyId,
      fromMonth: '2025-11',
      toMonth: '2026-02',
    });
    expect(Array.isArray(resRollover)).toBe(true);

    // Invalid month format returns empty array
    const resInvalid = await reportR27Headcount(db, {
      companyId,
      fromMonth: 'invalid',
      toMonth: 'invalid',
    });
    expect(resInvalid).toEqual([]);
  });

  it('R21: executes offers report with status filters', async () => {
    const res = await reportR21Offers(db, { companyId, fromDate: '2026-01-01', toDate: '2026-12-31' });
    expect(Array.isArray(res)).toBe(true);

    const resPrejoin = await reportR21Offers(db, { companyId, status: 'prejoin_done' });
    expect(Array.isArray(resPrejoin)).toBe(true);

    const resConverted = await reportR21Offers(db, { companyId, status: 'converted' });
    expect(Array.isArray(resConverted)).toBe(true);
  });

  it('R23: executes transfers report', async () => {
    const res = await reportR23Transfers(db, { companyId, fromDate: '2026-01-01', toDate: '2026-12-31' });
    expect(Array.isArray(res)).toBe(true);
  });

  it('R25: executes probation tracking report with status filters', async () => {
    const res = await reportR25Probation(db, { companyId });
    expect(Array.isArray(res)).toBe(true);

    const resPending = await reportR25Probation(db, { companyId, status: 'pending' });
    expect(Array.isArray(resPending)).toBe(true);

    const resCompleted = await reportR25Probation(db, { companyId, status: 'completed' });
    expect(Array.isArray(resCompleted)).toBe(true);
  });

  it('R26: executes attrition report', async () => {
    const res = await reportR26Attrition(db, { companyId, fromDate: '2026-01-01', toDate: '2026-12-31' });
    expect(Array.isArray(res)).toBe(true);
  });

  it('R28: executes assets register report with status and category filters', async () => {
    const res = await reportR28Assets(db, { companyId });
    expect(Array.isArray(res)).toBe(true);

    const resAssigned = await reportR28Assets(db, { companyId, status: 'assigned' });
    expect(Array.isArray(resAssigned)).toBe(true);

    const resCategory = await reportR28Assets(db, { companyId, category: 'laptop' });
    expect(Array.isArray(resCategory)).toBe(true);
  });

  it('R29: executes helpdesk ticket analytics report', async () => {
    const res = await reportR29Helpdesk(db, { month: '2026-06' });
    expect(Array.isArray(res)).toBe(true);
  });

  it('R30: executes policy acknowledgment compliance report', async () => {
    const res = await reportR30Policies(db);
    expect(Array.isArray(res)).toBe(true);

  });

  it('R31: executes expense claims report with status filters', async () => {
    const res = await reportR31Claims(db, { companyId, fromDate: '2026-01-01', toDate: '2026-12-31' });
    expect(Array.isArray(res)).toBe(true);

    const resApproved = await reportR31Claims(db, { companyId, status: 'approved' });
    expect(Array.isArray(resApproved)).toBe(true);

    const resPaid = await reportR31Claims(db, { companyId, status: 'paid' });
    expect(Array.isArray(resPaid)).toBe(true);
  });

  it('KPI Snapshot: builds, reads, and queries trends across months with production output', async () => {
    // 1. Build snapshot without output units
    const buildRes = await buildKpiSnapshot(db, { date: '2026-06-30' });
    expect(buildRes.snapshotDate).toBe('2026-06-30');
    expect(buildRes.metrics).toBeGreaterThan(0);

    // 2. Set monthly production output units to exercise productivity and cost per unit branches
    await setSetting(db, {
      key: 'reporting.monthly_output_units',
      value: 50000,
      type: 'number',
      description: 'Monthly production units for KPI metrics',
      actorUserId: null,
    });

    const buildWithOutput = await buildKpiSnapshot(db, { date: '2026-06-30' });
    expect(buildWithOutput.metrics).toBeGreaterThan(0);

    // Reset setting back to 0
    await setSetting(db, {
      key: 'reporting.monthly_output_units',
      value: 0,
      type: 'number',
      description: 'Monthly production units for KPI metrics',
      actorUserId: null,
    });

    const snapshot = await readKpiSnapshot(db, { date: '2026-06-30' });
    expect(snapshot).not.toBeNull();
    expect(snapshot?.snapshotDate).toBe('2026-06-30');
    expect(Array.isArray(snapshot?.metrics)).toBe(true);
    expect(snapshot?.metrics.length).toBeGreaterThan(0);

    // Read historical before any snapshot existed -> null
    const ancient = await readKpiSnapshot(db, { date: '1970-01-01' });
    expect(ancient).toBeNull();

    // Query trend across 6 months and 12 months with category
    const trend6 = await kpiTrend(db, { metric: 'manpower_count', months: 6 });
    expect(Array.isArray(trend6)).toBe(true);
    expect(trend6.length).toBe(6);
    expect(trend6[0]).toHaveProperty('label');
    expect(trend6[0]).toHaveProperty('date');

    const trend12 = await kpiTrend(db, { metric: 'absenteeism_pct', months: 12, category: 'total' });
    expect(Array.isArray(trend12)).toBe(true);
    expect(trend12.length).toBe(12);
  });

  it('Dashboards: exercises HR Ops, ESS Home, My Attendance, Team Grid, and BU Dashboard', async () => {
    // 1. hrOpsDashboard global and scoped to company
    const hrGlobal = await hrOpsDashboard(db);
    expect(hrGlobal).toHaveProperty('headcountByCategory');
    expect(hrGlobal).toHaveProperty('absentToday');
    expect(hrGlobal).toHaveProperty('policyAckPercent');

    const hrComp = await hrOpsDashboard(db, companyId);
    expect(hrComp).toHaveProperty('joinersMtd');
    expect(hrComp).toHaveProperty('exitsMtd');

    // 2. businessUnitDashboard
    const buAll = await businessUnitDashboard(db, { all: true });
    expect(buAll).toHaveProperty('headcount');
    expect(buAll).toHaveProperty('otHoursMtd');

    const buComp = await businessUnitDashboard(db, { companyId, all: true });
    expect(buComp.headcountTotal).toBeGreaterThanOrEqual(0);

    const buRestrictedEmpty = await businessUnitDashboard(db, { all: false, orgUnitIds: [] });
    expect(buRestrictedEmpty.headcountTotal).toBe(0);

    // 3. ESS and Manager Dashboards if an employee exists
    const emp = await db
      .selectFrom('core.employees')
      .select(['id', 'reporting_manager_id'])
      .where('status', '=', 'active')
      .limit(1)
      .executeTakeFirst();

    if (emp) {
      const ess = await essHome(db, emp.id);
      expect(ess).toHaveProperty('greetingName');
      expect(ess).toHaveProperty('leaveBalances');

      const attMonth = await myAttendanceMonth(db, emp.id, '2026-06');
      expect(Array.isArray(attMonth)).toBe(true);

      const managerId = emp.reporting_manager_id ?? emp.id;
      const teamDirects = await teamMonthGrid(db, managerId, '2026-06', false);
      expect(Array.isArray(teamDirects)).toBe(true);

      const teamSubtree = await teamMonthGrid(db, managerId, '2026-06', true);
      expect(Array.isArray(teamSubtree)).toBe(true);
    }
  });
});
