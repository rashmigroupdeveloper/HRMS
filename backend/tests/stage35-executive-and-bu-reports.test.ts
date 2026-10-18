/**
 * Stage 3.5 Integration Tests — Executive Analytics & Business Unit Dashboards (RPT-03, RPT-04, C01, R21–R31).
 *
 * Covers:
 * 1. CEO Strategic KPI Dashboard (RPT-03):
 *    - Snapshot generation idempotence via buildKpiSnapshot;
 *    - 6 Core CEO Metrics: Manpower count, workforce demographics (age, tenure, gender diversity ratio % female),
 *      leadership density, operational attendance (absenteeism %, overtime hours), attrition cohorts (30/90/180/365d),
 *      productivity & cost (gross salary, overtime cost, burnout index, ot spend per ton);
 *    - Nightly job worker runExecutiveKpiDailyJob;
 *    - Zero-table-scan read via readKpiSnapshot;
 *    - Trend series via kpiTrend;
 *    - Executive leavers drill-down query.
 * 2. Plant Head Scoping Security (Fixing C01):
 *    - Plant head restricted to Kharagpur location cannot access Durgapur plant data;
 *    - Scoped operational metrics: presence %, shift compliance %, active overtime, pending approvals queue depth.
 * 3. Master Reports Catalog (R21–R31):
 *    - R21 (Offers & Candidates), R23 (Transfers & Promotions), R25 (Probation Due & Confirmations),
 *      R26 (Exit / Attrition Analysis), R28 (Asset Custody Register), R29 (Helpdesk SLA Analytics),
 *      R30 (Policy Compliance Matrix), R31 (Reimbursement Utilization);
 *    - Verification of Excel export buffer generation across all reports.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { httpRequest } from './http-client.js';
import { sql, type Kysely } from 'kysely';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { hashPassword } from '../src/modules/auth/index.js';
import {
  buildKpiSnapshot,
  readKpiSnapshot,
  kpiTrend,
  businessUnitDashboard,
  runExecutiveKpiDailyJob,
  reportR21Offers,
  exportR21Excel,
  reportR23Transfers,
  exportR23Excel,
  reportR25Probation,
  exportR25Excel,
  reportR26Attrition,
  exportR26Excel,
  reportR28Assets,
  exportR28Excel,
  reportR29Helpdesk,
  exportR29Excel,
  reportR30Policies,
  exportR30Excel,
  reportR31Claims,
  exportR31Excel,
} from '../src/modules/reports/index.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'integration-test-secret-at-least-32-chars!';
const run = describe.skipIf(!DB_URL);

run('Stage 3.5 — Executive Analytics & BU Dashboards (live Postgres)', () => {
  let db: Kysely<Database>;
  let app: Express;
  const stamp = Date.now();
  const password = 'stage35-test-pw-1!';
  const ceoEmail = `ceo-${String(stamp)}@hrms.test`;
  const plantHeadEmail = `planthead-${String(stamp)}@hrms.test`;

  let tokenCeo: string;
  let tokenPlantHead: string;

  let ceoUserId: number;
  let testCompanyId: number;
  let locKharagpurId: number;
  let locDurgapurId: number;
  let orgUnitKgpId: number;
  let orgUnitDgpId: number;
  let empKgpId: number;
  let empDgpId: number;
  let plantHeadEmpId: number;

  beforeAll(async () => {
    if (!DB_URL) throw new Error('Missing DB_URL');
    db = createDatabase(DB_URL);
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false });

    // 1. Create company
    const comp = await db
      .insertInto('core.companies')
      .values({
        code: `RML-35-${String(stamp).slice(-7)}`,
        name: `Rashmi Test Entity ${String(stamp)}`,
        ecode_prefix: `R${String(stamp).slice(-7)}`, // 3 digits collided with earlier committed runs
        is_india_payroll: true,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    testCompanyId = comp.id;

    // 2. Create locations: Kharagpur and Durgapur
    const loc1 = await db
      .insertInto('core.locations')
      .values({
        company_id: testCompanyId,
        name: `Kharagpur Plant ${String(stamp)}`,
        state_code: 'WB',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    locKharagpurId = loc1.id;

    const loc2 = await db
      .insertInto('core.locations')
      .values({
        company_id: testCompanyId,
        name: `Durgapur Plant ${String(stamp)}`,
        state_code: 'WB',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    locDurgapurId = loc2.id;

    // 3. Create Org Units
    const ou1 = await db
      .insertInto('core.org_units')
      .values({
        company_id: testCompanyId,
        name: `KGP Operations ${String(stamp)}`,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    orgUnitKgpId = ou1.id;

    const ou2 = await db
      .insertInto('core.org_units')
      .values({
        company_id: testCompanyId,
        name: `DGP Operations ${String(stamp)}`,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    orgUnitDgpId = ou2.id;

    // 4. Create sample employees
    const eKgp = await db
      .insertInto('core.employees')
      .values({
        ecode: `EKGP-${String(stamp).slice(-5)}`,
        first_name: 'Ananya',
        last_name: 'Sen',
        company_id: testCompanyId,
        location_id: locKharagpurId,
        org_unit_id: orgUnitKgpId,
        category: 'white_collar',
        gender: 'female',
        status: 'active',
        doj: sql<Date>`'2024-01-15'::date`,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    empKgpId = eKgp.id;

    const eDgp = await db
      .insertInto('core.employees')
      .values({
        ecode: `EDGP-${String(stamp).slice(-5)}`,
        first_name: 'Bikram',
        last_name: 'Roy',
        company_id: testCompanyId,
        location_id: locDurgapurId,
        org_unit_id: orgUnitDgpId,
        category: 'blue_collar',
        gender: 'male',
        status: 'active',
        doj: sql<Date>`'2023-05-10'::date`,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    empDgpId = eDgp.id;

    // 5. Create Plant Head employee profile mapped to Kharagpur
    const eHead = await db
      .insertInto('core.employees')
      .values({
        ecode: `EPH-${String(stamp).slice(-5)}`,
        first_name: 'Kharagpur',
        last_name: 'PlantHead',
        company_id: testCompanyId,
        location_id: locKharagpurId,
        org_unit_id: orgUnitKgpId,
        category: 'white_collar',
        gender: 'male',
        status: 'active',
        doj: sql<Date>`'2022-01-01'::date`,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    plantHeadEmpId = eHead.id;

    // 6. Create Users & Assign Roles
    const ceoUser = await db
      .insertInto('core.users')
      .values({
        email: ceoEmail,
        password_hash: await hashPassword(password),
        employee_id: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    ceoUserId = ceoUser.id;

    const roleCeo = await db.selectFrom('core.roles').select('id').where('code', '=', 'ceo_cell').executeTakeFirst();
    if (roleCeo) {
      await db.insertInto('core.user_roles').values({ user_id: ceoUser.id, role_id: roleCeo.id }).execute();
    }

    const phUser = await db
      .insertInto('core.users')
      .values({
        email: plantHeadEmail,
        password_hash: await hashPassword(password),
        employee_id: plantHeadEmpId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const rolePh = await db.selectFrom('core.roles').select('id').where('code', '=', 'plant_head').executeTakeFirst();
    if (rolePh) {
      await db
        .insertInto('core.user_roles')
        .values({
          user_id: phUser.id,
          role_id: rolePh.id,
          scope_org_unit_id: orgUnitKgpId,
        })
        .execute();
    }

    // Login CEO
    const resCeo = await (await httpRequest(app)).post('/api/auth/login').send({ identifier: ceoEmail, password });
    tokenCeo = (resCeo.body as { accessToken: string }).accessToken;

    // Login Plant Head
    const resPh = await (await httpRequest(app)).post('/api/auth/login').send({ identifier: plantHeadEmail, password });
    tokenPlantHead = (resPh.body as { accessToken: string }).accessToken;
    expect(tokenPlantHead).toBeDefined();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('1. Executive KPI snapshot computation is idempotent and computes 6 Core CEO Metrics', async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Compute first time
    const snap1 = await buildKpiSnapshot(db, { date: today });
    expect(snap1.snapshotDate).toBe(today);
    expect(snap1.metrics).toBeGreaterThan(10);

    // Idempotent recomputation must succeed cleanly without unique key constraint failure
    const snap2 = await buildKpiSnapshot(db, { date: today });
    expect(snap2.snapshotDate).toBe(today);
    expect(snap2.metrics).toBe(snap1.metrics);

    // Read frozen snapshot (zero table scan)
    const read = await readKpiSnapshot(db, { date: today });
    expect(read).not.toBeNull();
    expect(read?.snapshotDate).toBe(today);

    const metricsMap = new Map(read?.metrics.map((m) => [m.metric, m]));

    // Check Core CEO Metrics:
    expect(metricsMap.has('manpower_count')).toBe(true);
    expect(metricsMap.has('gender_diversity_ratio_pct')).toBe(true);
    expect(metricsMap.has('leadership_pct')).toBe(true);
    expect(metricsMap.has('absenteeism_pct')).toBe(true);
    expect(metricsMap.has('overtime_hours')).toBe(true);
    expect(metricsMap.has('leavers_mtd')).toBe(true);
    expect(metricsMap.has('attrition_rate_annualised_pct')).toBe(true);
    expect(metricsMap.has('new_hire_attrition_30d_pct')).toBe(true);
    expect(metricsMap.has('new_hire_attrition_90d_pct')).toBe(true);
    expect(metricsMap.has('new_hire_attrition_180d_pct')).toBe(true);
    expect(metricsMap.has('new_hire_attrition_365d_pct')).toBe(true);
    expect(metricsMap.has('burnout_index')).toBe(true);

    // Gender diversity should be > 0 because Ananya Sen is female
    const genderRatio = metricsMap.get('gender_diversity_ratio_pct');
    expect(genderRatio?.value).not.toBeNull();
    expect(Number(genderRatio?.value)).toBeGreaterThan(0);
  });

  it('2. Nightly worker job runExecutiveKpiDailyJob runs and records timestamp', async () => {
    const jobRes = await runExecutiveKpiDailyJob(db);
    expect(jobRes.snapshotDate).toBeDefined();
    expect(jobRes.metrics).toBeGreaterThan(0);
    expect(jobRes.timestamp).toBeDefined();
  });

  it('3. kpiTrend returns historical monthly series with gap preservation', async () => {
    const trend = await kpiTrend(db, { metric: 'manpower_count', months: 6 });
    expect(trend).toBeInstanceOf(Array);
    expect(trend.length).toBe(6);
    expect(trend[trend.length - 1]?.value).not.toBeNull();
  });

  it('4. C01 Scope Security: Plant Head for Kharagpur is blocked from inspecting Durgapur (403)', async () => {
    // Attempting to query Durgapur location while restricted to Kharagpur orgUnit / employee location
    await expect(
      businessUnitDashboard(db, {
        locationId: locDurgapurId,
        all: false,
        orgUnitIds: [orgUnitKgpId],
        actorEmployeeId: plantHeadEmpId,
      }),
    ).rejects.toThrow(/Forbidden/i);
  });

  it('5. Plant Head successfully queries own Kharagpur plant with scoped operational metrics', async () => {
    const bu = await businessUnitDashboard(db, {
      locationId: locKharagpurId,
      all: false,
      orgUnitIds: [orgUnitKgpId],
      actorEmployeeId: plantHeadEmpId,
    });

    expect(bu.scopeLabel).toContain('Location');
    expect(bu.headcountTotal).toBeGreaterThanOrEqual(1);
    expect(bu.presenceTodayPct === null || typeof bu.presenceTodayPct === 'number').toBe(true);
    expect(bu.shiftScheduleCompliancePct === null || typeof bu.shiftScheduleCompliancePct === 'number').toBe(true);
    expect(typeof bu.activeOvertimeHours).toBe('number');
    expect(typeof bu.pendingApprovalsCount).toBe('number');
  });

  it('6. Master Reports Catalog: R21 Offers and Candidates returns data and exports Excel', async () => {
    await db
      .insertInto('core.onboarding_candidates')
      .values({
        full_name: `Candidate ${String(stamp)}`,
        personal_email: `cand-${String(stamp)}@test.com`,
        mobile: '9876543210',
        position_title: 'Junior Metallurgist',
        company_id: testCompanyId,
        category: 'white_collar',
        offered_ctc: '650000',
        proposed_doj: sql<Date>`'2026-11-01'::date`,
        offer_date: sql<Date>`'2026-10-01'::date`,
        probation_salary_pct: 90,
        status: 'converted',
        updated_at: new Date(),
      })
      .execute();

    const list = await reportR21Offers(db, { companyId: testCompanyId });
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0]?.loiStatus).toBe('Accepted');
    expect(list[0]?.probationPercentage).toBe(90);

    const buf = await exportR21Excel(db, { companyId: testCompanyId });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(100);
  });

  it('7. Master Reports Catalog: R23 Internal Movements & Transfers returns data and exports Excel', async () => {
    await db
      .insertInto('core.transfers')
      .values({
        employee_id: empKgpId,
        transfer_type: 'location',
        effective_date: sql<Date>`'2026-11-15'::date`,
        status: 'approved',
        current_company_id: testCompanyId,
        target_company_id: testCompanyId,
        current_location_id: locKharagpurId,
        target_location_id: locDurgapurId,
        current_ecode: 'EKGP-01',
        reason: 'Operational plant balancing',
        created_by: ceoUserId,
      })
      .execute();

    const list = await reportR23Transfers(db, { companyId: testCompanyId });
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0]?.fromLocation).toContain('Kharagpur');
    expect(list[0]?.toLocation).toContain('Durgapur');

    const buf = await exportR23Excel(db, { companyId: testCompanyId });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(100);
  });

  it('8. Master Reports Catalog: R25 Probation Reviews returns data and exports Excel', async () => {
    await db
      .insertInto('core.probation_reviews')
      .values({
        employee_id: empKgpId,
        due_date: sql<Date>`'2026-07-15'::date`,
        status: 'pending',
        updated_at: new Date(),
      })
      .execute();

    const list = await reportR25Probation(db, { companyId: testCompanyId });
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0]?.isOverdue).toBe(true);

    const buf = await exportR25Excel(db, { companyId: testCompanyId });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(100);
  });

  it('9. Master Reports Catalog: R26 Attrition Analysis classifies Voluntary vs Involuntary and exports Excel', async () => {
    await db
      .insertInto('core.separations')
      .values({
        employee_id: empDgpId,
        initiated_by: 'employee',
        reason: 'Better opportunity',
        resignation_date: sql<Date>`'2026-09-01'::date`,
        notice_period_days: 30,
        requested_lwd: sql<Date>`'2026-09-30'::date`,
        approved_lwd: sql<Date>`'2026-09-30'::date`,
        status: 'completed',
      })
      .execute();

    const list = await reportR26Attrition(db, { companyId: testCompanyId });
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0]?.exitType).toBe('Voluntary');
    expect(list[0]?.noticePeriodDays).toBe(30);

    const buf = await exportR26Excel(db, { companyId: testCompanyId });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(100);
  });

  it('10. Master Reports Catalog: R28 Asset Custody Register returns data and exports Excel', async () => {
    const asset = await db
      .insertInto('ast.assets')
      .values({
        company_id: testCompanyId,
        asset_no: `AST-TEST-${String(stamp).slice(-5)}`,
        category: 'Laptop',
        description: 'ThinkPad T14 Gen 4',
        status: 'assigned',
        location_id: locKharagpurId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await db
      .insertInto('ast.assignments')
      .values({
        asset_id: asset.id,
        holder_kind: 'employee',
        employee_id: empKgpId,
        assigned_by: ceoUserId,
      })
      .execute();

    const list = await reportR28Assets(db, { companyId: testCompanyId });
    expect(list.length).toBeGreaterThanOrEqual(1);
    const assignedRow = list.find((a) => a.assetId === asset.id);
    expect(assignedRow).toBeDefined();
    expect(assignedRow?.holderName).toContain('Ananya');

    const buf = await exportR28Excel(db, { companyId: testCompanyId });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(100);
  });

  it('11. Master Reports Catalog: R29 Helpdesk SLA analytics and R30 Policy Compliance export Excel', async () => {
    const r29 = await reportR29Helpdesk(db);
    expect(r29).toBeInstanceOf(Array);
    const buf29 = await exportR29Excel(db);
    expect(buf29).toBeInstanceOf(Buffer);

    const r30 = await reportR30Policies(db);
    expect(r30).toBeInstanceOf(Array);
    const buf30 = await exportR30Excel(db);
    expect(buf30).toBeInstanceOf(Buffer);
  });

  it('12. Master Reports Catalog: R31 Reimbursements returns data and exports Excel', async () => {
    const ct = await db
      .insertInto('pay.claim_types')
      .values({
        code: `TRV-${String(stamp).slice(-4)}`,
        name: 'Travel Allowance',
        entitlement_basis: 'monthly',
        bill_required: true,
        payout_component_code: 'REIMB_TRV',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await db
      .insertInto('pay.claims')
      .values({
        employee_id: empKgpId,
        claim_type_id: ct.id,
        funding_kind: 'entitlement',
        period_from: sql<Date>`'2026-10-01'::date`,
        period_to: sql<Date>`'2026-10-05'::date`,
        claimed_amount: '4500.00',
        approved_amount: '4500.00',
        status: 'approved',
      })
      .execute();

    const list = await reportR31Claims(db, { companyId: testCompanyId });
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0]?.claimedAmount).toBe(4500);

    const buf = await exportR31Excel(db, { companyId: testCompanyId });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(100);
  });

  it('13. HTTP API: Executive snapshot rebuild and leavers drill-down endpoints', async () => {
    // Rebuild snapshot
    const resRebuild = await (await httpRequest(app))
      .post('/api/reports/executive/rebuild')
      .set({ Authorization: `Bearer ${tokenCeo}` })
      .send({});
    expect(resRebuild.status).toBe(200);
    const rebuildBody = resRebuild.body as { metrics: number };
    expect(rebuildBody.metrics).toBeGreaterThan(0);

    // Leavers drill-down
    const resLeavers = await (await httpRequest(app))
      .get('/api/reports/executive/leavers')
      .set({ Authorization: `Bearer ${tokenCeo}` });
    expect(resLeavers.status).toBe(200);
    const leaversBody = resLeavers.body as unknown[];
    expect(leaversBody).toBeInstanceOf(Array);
  });
});
