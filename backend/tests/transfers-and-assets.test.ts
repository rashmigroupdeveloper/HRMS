/**
 * Integration Tests: Lifecycle Transfers, Promotions, As-Of Reconstruction & Asset Invariants
 * Requirements: LC-05, AST-01..06; original SOW links live in the verified crosswalk.
 */

import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import {
  createTransferRequest,
  approveTransferRequest,
  rejectTransferRequest,
  getEmployeeHistoryTimeline,
  getEmployeeAsOfDate,
  listTransfers,
} from '../src/modules/lifecycle/transfers/transfer.service.js';
import {
  assignAsset,
  returnAsset,
  logMaintenance,
  upsertAsset,
  assetsHeldByEmployee,
} from '../src/modules/assets/assets.service.js';
import { requireFixture } from './lifecycle-fixtures.js';
import { hashPassword } from '../src/modules/auth/index.js';

const DB_URL = process.env['DATABASE_URL'];
const run = describe.skipIf(!DB_URL);

run('Phase 3, Stage 3.3 — Transfers, Promotions & Assets (Live Postgres)', () => {
  let db: Kysely<Database>;
  const stamp = Date.now();
  const tag = `TRF${String(stamp).slice(-6)}`;
  let testUser: { id: number };
  let company1Id: number;
  let company2Id: number;
  let dept1Id: number;
  let dept2Id: number;
  let loc1Id: number;
  let loc2Id: number;
  let locCompany2Id: number;
  let des1Id: number;
  let des2Id: number;
  let grade1Id: number;
  let grade2Id: number;
  let managerId: number;
  let newManagerId: number;
  let testEmpId: number;

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');

    // Setup user
    const user = await db
      .insertInto('core.users')
      .values({
        email: `transfers-${tag}@hrms.test`,
        password_hash: await hashPassword('password123'),
        employee_id: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    testUser = user;

    // Fetch or create companies (RML and RPL)
    const companies = await db.selectFrom('core.companies').select(['id', 'code']).execute();
    const rml = requireFixture(companies.find((c) => c.code === 'RML'));
    company1Id = rml.id;

    let rpl = companies.find((c) => c.code === 'RPL');
    rpl ??= await db
        .insertInto('core.companies')
        .values({
          code: `${tag}P`,
          name: 'Rashmi Poly Plast Test',
          ecode_prefix: `${tag}P`,
          is_india_payroll: true,
        })
        .returning(['id', 'code'])
        .executeTakeFirstOrThrow();
    company2Id = rpl.id;

    // Fetch or create departments
    const depts = await db.selectFrom('core.departments').select(['id', 'name']).execute();
    if (depts.length >= 2) {
      dept1Id = requireFixture(depts[0]).id;
      dept2Id = requireFixture(depts[1]).id;
    } else {
      const d1 = await db
        .insertInto('core.departments')
        .values({ name: `${tag} Engineering` })
        .returning('id')
        .executeTakeFirstOrThrow();
      const d2 = await db
        .insertInto('core.departments')
        .values({ name: `${tag} Operations` })
        .returning('id')
        .executeTakeFirstOrThrow();
      dept1Id = d1.id;
      dept2Id = d2.id;
    }

    // Fetch or create locations for company1
    const locs1 = await db.selectFrom('core.locations').select(['id', 'name']).where('company_id', '=', company1Id).execute();
    if (locs1.length >= 2) {
      loc1Id = requireFixture(locs1[0]).id;
      loc2Id = requireFixture(locs1[1]).id;
    } else {
      const l1 = await db
        .insertInto('core.locations')
        .values({ name: `${tag} Plant 1`, state_code: 'WB', company_id: company1Id })
        .returning('id')
        .executeTakeFirstOrThrow();
      const l2 = await db
        .insertInto('core.locations')
        .values({ name: `${tag} Plant 2`, state_code: 'WB', company_id: company1Id })
        .returning('id')
        .executeTakeFirstOrThrow();
      loc1Id = l1.id;
      loc2Id = l2.id;
    }

    // Fetch or create location for company2
    const locs2 = await db.selectFrom('core.locations').select(['id', 'name']).where('company_id', '=', company2Id).execute();
    if (locs2.length >= 1) {
      locCompany2Id = requireFixture(locs2[0]).id;
    } else {
      const l3 = await db
        .insertInto('core.locations')
        .values({ name: `${tag} Plant C2`, state_code: 'WB', company_id: company2Id })
        .returning('id')
        .executeTakeFirstOrThrow();
      locCompany2Id = l3.id;
    }

    // Fetch or create designations
    const desigs = await db.selectFrom('core.designations').select(['id', 'name']).execute();
    if (desigs.length >= 2) {
      des1Id = requireFixture(desigs[0]).id;
      des2Id = requireFixture(desigs[1]).id;
    } else {
      const dg1 = await db
        .insertInto('core.designations')
        .values({ name: `${tag} Engineer` })
        .returning('id')
        .executeTakeFirstOrThrow();
      const dg2 = await db
        .insertInto('core.designations')
        .values({ name: `${tag} Senior Manager` })
        .returning('id')
        .executeTakeFirstOrThrow();
      des1Id = dg1.id;
      des2Id = dg2.id;
    }

    // Fetch or create grades
    const grades = await db.selectFrom('core.grades').select(['id', 'code']).execute();
    if (grades.length >= 2) {
      grade1Id = requireFixture(grades[0]).id;
      grade2Id = requireFixture(grades[1]).id;
    } else {
      const g1 = await db
        .insertInto('core.grades')
        .values({ code: `${tag}M1`, name: 'Manager Grade 1', rank: 1 })
        .returning('id')
        .executeTakeFirstOrThrow();
      const g2 = await db
        .insertInto('core.grades')
        .values({ code: `${tag}M2`, name: 'Manager Grade 2', rank: 2 })
        .returning('id')
        .executeTakeFirstOrThrow();
      grade1Id = g1.id;
      grade2Id = g2.id;
    }

    // Managers
    const m1 = await db
      .insertInto('core.employees')
      .values({
        ecode: `${tag}M1`,
        first_name: 'Reporting',
        last_name: 'Manager',
        company_id: company1Id,
        status: 'active',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    managerId = m1.id;

    const m2 = await db
      .insertInto('core.employees')
      .values({
        ecode: `${tag}M2`,
        first_name: 'New',
        last_name: 'Manager',
        company_id: company1Id,
        status: 'active',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    newManagerId = m2.id;

    // Test Employee in initial baseline state
    const emp = await db
      .insertInto('core.employees')
      .values({
        ecode: `${tag}E1`,
        first_name: 'Vikram',
        last_name: 'Sharma',
        company_id: company1Id,
        department_id: dept1Id,
        location_id: loc1Id,
        designation_id: des1Id,
        grade_id: grade1Id,
        reporting_manager_id: managerId,
        status: 'active',
        doj: new Date('2024-01-01'),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    testEmpId = emp.id;
  });

  afterAll(async () => {
    try {
      // Preserve audit/history rows, but do not leave fixture users active,
      // requests pending, or assets allocated after this file completes.
      const pending = await db.selectFrom('core.transfers').select('id')
        .where('employee_id', '=', testEmpId).where('status', '=', 'pending').execute();
      for (const request of pending) {
        await rejectTransferRequest(db, request.id, 'Integration fixture completed', testUser.id);
      }
      for (const held of await assetsHeldByEmployee(db, testEmpId)) {
        await returnAsset(db, {
          assignmentId: held.assignmentId, condition: 'ok',
          actorUserId: testUser.id, ip: null,
        });
      }
      await db.transaction().execute(async tx => {
        await tx.updateTable('core.employees')
          .set({ status: 'exited', dol: new Date(), reporting_manager_id: null })
          .where('id', 'in', [testEmpId, managerId, newManagerId]).execute();
        await tx.updateTable('core.users').set({ is_active: false, employee_id: null })
          .where('id', '=', testUser.id).execute();
      });
    } finally {
      await db.destroy();
    }
  });

  describe('LC-05: Department, Location, and Manager Transfers', () => {
    it('creates a department & manager transfer request with proper validation', async () => {
      const req = await createTransferRequest(
        db,
        {
          employeeId: testEmpId,
          transferType: 'department',
          effectiveDate: '2025-03-01',
          targetDepartmentId: dept2Id,
          targetReportingManagerId: newManagerId,
          reason: 'Internal restructuring to Operations division',
        },
        testUser.id,
      );

      expect(req.id).toBeGreaterThan(0);
      expect(req.targetEcode).toBeNull();

      const list = await listTransfers(db, { employeeId: testEmpId, status: 'pending' });
      expect(list.total).toBeGreaterThanOrEqual(1);
      const found = list.rows.find((r) => r.id === req.id);
      expect(found).toBeDefined();
      expect(found?.transferType).toBe('department');
      expect(found?.targetDepartmentId).toBe(dept2Id);
      expect(found?.targetReportingManagerId).toBe(newManagerId);
    });

    it('approves department transfer: updates employee master and writes core.employee_history', async () => {
      const req = await createTransferRequest(
        db,
        {
          employeeId: testEmpId,
          transferType: 'department',
          effectiveDate: '2025-03-15',
          targetDepartmentId: dept2Id,
          targetReportingManagerId: newManagerId,
          reason: 'Approved division reorganization',
        },
        testUser.id,
      );

      const res = await approveTransferRequest(db, req.id, testUser.id);
      expect(res.success).toBe(true);

      // Verify employee record updated
      const updatedEmp = await db
        .selectFrom('core.employees')
        .select(['department_id', 'reporting_manager_id'])
        .where('id', '=', testEmpId)
        .executeTakeFirstOrThrow();

      expect(updatedEmp.department_id).toBe(dept2Id);
      expect(updatedEmp.reporting_manager_id).toBe(newManagerId);

      // Verify core.employee_history audit rows
      const history = await getEmployeeHistoryTimeline(db, testEmpId);
      const deptHistory = history.find((h) => h.field === 'department_id' && h.referenceId === req.id);
      expect(deptHistory).toBeDefined();
      expect(deptHistory?.oldValue).toBe(String(dept1Id));
      expect(deptHistory?.newValue).toBe(String(dept2Id));
      expect(deptHistory?.changeType).toBe('transfer_department');

      const mgrHistory = history.find((h) => h.field === 'reporting_manager_id' && h.referenceId === req.id);
      expect(mgrHistory).toBeDefined();
      expect(mgrHistory?.oldValue).toBe(String(managerId));
      expect(mgrHistory?.newValue).toBe(String(newManagerId));
      expect(mgrHistory?.changeType).toBe('manager_change');
    });

    it('approves location/plant transfer: records location change history', async () => {
      const req = await createTransferRequest(
        db,
        {
          employeeId: testEmpId,
          transferType: 'location',
          effectiveDate: '2025-05-01',
          targetLocationId: loc2Id,
          reason: 'Plant mobilization transfer to Plant 2',
        },
        testUser.id,
      );

      const res = await approveTransferRequest(db, req.id, testUser.id);
      expect(res.success).toBe(true);

      const updatedEmp = await db
        .selectFrom('core.employees')
        .select('location_id')
        .where('id', '=', testEmpId)
        .executeTakeFirstOrThrow();
      expect(updatedEmp.location_id).toBe(loc2Id);

      const history = await getEmployeeHistoryTimeline(db, testEmpId);
      const locHistory = history.find((h) => h.field === 'location_id' && h.referenceId === req.id);
      expect(locHistory).toBeDefined();
      expect(locHistory?.oldValue).toBe(String(loc1Id));
      expect(locHistory?.newValue).toBe(String(loc2Id));
    });
  });

  describe('LC-05: Promotion & Grade Change with Salary Revision', () => {
    it('approves promotion: updates designation, grade, and records salary revision CTC', async () => {
      const revisedCtc = 1200000; // ₹12,00,000 annual CTC
      const req = await createTransferRequest(
        db,
        {
          employeeId: testEmpId,
          transferType: 'promotion',
          effectiveDate: '2025-07-01',
          targetDesignationId: des2Id,
          targetGradeId: grade2Id,
          salaryRevisionAmount: revisedCtc,
          reason: 'Annual performance promotion to Senior Manager',
        },
        testUser.id,
      );

      const res = await approveTransferRequest(db, req.id, testUser.id);
      expect(res.success).toBe(true);

      const updatedEmp = await db
        .selectFrom('core.employees')
        .select(['designation_id', 'grade_id'])
        .where('id', '=', testEmpId)
        .executeTakeFirstOrThrow();

      expect(updatedEmp.designation_id).toBe(des2Id);
      expect(updatedEmp.grade_id).toBe(grade2Id);

      const history = await getEmployeeHistoryTimeline(db, testEmpId);
      const desHistory = history.find((h) => h.field === 'designation_id' && h.referenceId === req.id);
      expect(desHistory?.newValue).toBe(String(des2Id));

      const ctcHistory = history.find((h) => h.field === 'salary_revision_ctc' && h.referenceId === req.id);
      expect(Number(ctcHistory?.newValue)).toBe(revisedCtc);
    });

    it('rejects a transfer request with reason remarks', async () => {
      const req = await createTransferRequest(
        db,
        {
          employeeId: testEmpId,
          transferType: 'promotion',
          effectiveDate: '2025-08-01',
          targetDesignationId: des2Id,
          reason: 'Unverified promotion proposal',
        },
        testUser.id,
      );

      const res = await rejectTransferRequest(db, req.id, 'Management quota exceeded for this cycle', testUser.id);
      expect(res.success).toBe(true);

      const rejectedReq = await db
        .selectFrom('core.transfers')
        .select(['status', 'remarks'])
        .where('id', '=', req.id)
        .executeTakeFirstOrThrow();

      expect(rejectedReq.status).toBe('rejected');
      expect(rejectedReq.remarks).toBe('Management quota exceeded for this cycle');
    });
  });

  describe('LC-05: Inter-Entity Company Transfer (Company Movement)', () => {
    it('allocates new target e-code series and moves employee to new entity preserving active continuity', async () => {
      const initialEmp = await db
        .selectFrom('core.employees')
        .select(['company_id', 'ecode', 'status'])
        .where('id', '=', testEmpId)
        .executeTakeFirstOrThrow();

      expect(initialEmp.company_id).toBe(company1Id);
      expect(initialEmp.status).toBe('active');

      // Create inter-entity transfer
      const req = await createTransferRequest(
        db,
        {
          employeeId: testEmpId,
          transferType: 'inter_entity',
          effectiveDate: '2025-10-01',
          targetCompanyId: company2Id,
          targetLocationId: locCompany2Id,
          leaveTreatment: 'transfer',
          reason: 'Inter-entity group deployment from RML to Poly Plast',
        },
        testUser.id,
      );

      expect(req.targetEcode).toBeDefined();
      expect(req.targetEcode).toContain('000');

      const res = await approveTransferRequest(db, req.id, testUser.id);
      expect(res.success).toBe(true);
      expect(res.newEcode).toBe(req.targetEcode);

      // Verify employee record in target company
      const transferredEmp = await db
        .selectFrom('core.employees')
        .select(['company_id', 'ecode', 'status'])
        .where('id', '=', testEmpId)
        .executeTakeFirstOrThrow();

      expect(transferredEmp.company_id).toBe(company2Id);
      expect(transferredEmp.ecode).toBe(req.targetEcode);
      expect(transferredEmp.status).toBe('active'); // Employment continuity preserved!

      // Verify history logs company and ecode transition
      const history = await getEmployeeHistoryTimeline(db, testEmpId);
      const compHistory = history.find((h) => h.field === 'company_id' && h.referenceId === req.id);
      expect(compHistory?.oldValue).toBe(String(company1Id));
      expect(compHistory?.newValue).toBe(String(company2Id));

      const ecodeHistory = history.find((h) => h.field === 'ecode' && h.referenceId === req.id);
      expect(ecodeHistory?.oldValue).toBe(initialEmp.ecode);
      expect(ecodeHistory?.newValue).toBe(req.targetEcode);
    });
  });

  describe('LC-05: Historical Organization State Reconstruction (As-Of Date)', () => {
    it('reconstructs employee organization state as-of any past historical date', async () => {
      // Timeline of our testEmp:
      // Baseline: 2024-01-01 -> dept1Id, loc1Id, des1Id, company1Id
      // 2025-03-15: Dept transfer -> dept2Id
      // 2025-05-01: Location transfer -> loc2Id
      // 2025-07-01: Promotion -> des2Id
      // 2025-10-01: Inter-entity -> company2Id, targetEcode

      // 1. As-of 2025-02-01 (before any transfers)
      const asOfPast = await getEmployeeAsOfDate(db, testEmpId, '2025-02-01');
      expect(asOfPast.departmentId).toBe(dept1Id);
      expect(asOfPast.locationId).toBe(loc1Id);
      expect(asOfPast.designationId).toBe(des1Id);
      expect(asOfPast.companyId).toBe(company1Id);

      // 2. As-of 2025-04-01 (after dept transfer, but before location, promotion & entity transfer)
      const asOfMid = await getEmployeeAsOfDate(db, testEmpId, '2025-04-01');
      expect(asOfMid.departmentId).toBe(dept2Id);
      expect(asOfMid.locationId).toBe(loc1Id);
      expect(asOfMid.designationId).toBe(des1Id);
      expect(asOfMid.companyId).toBe(company1Id);

      // 3. As-of 2025-06-01 (after dept & loc transfer, but before promotion & entity transfer)
      const asOfAfterLoc = await getEmployeeAsOfDate(db, testEmpId, '2025-06-01');
      expect(asOfAfterLoc.departmentId).toBe(dept2Id);
      expect(asOfAfterLoc.locationId).toBe(loc2Id);
      expect(asOfAfterLoc.designationId).toBe(des1Id);
      expect(asOfAfterLoc.companyId).toBe(company1Id);

      // 4. As-of current date (2026-01-01) -> all changes effective
      const asOfCurrent = await getEmployeeAsOfDate(db, testEmpId, '2026-01-01');
      expect(asOfCurrent.departmentId).toBe(dept2Id);
      expect(asOfCurrent.locationId).toBe(locCompany2Id);
      expect(asOfCurrent.designationId).toBe(des2Id);
      expect(asOfCurrent.companyId).toBe(company2Id);
    });
  });

  describe('W01: Asset Allocation Concurrency & Invariants', () => {
    let assetId: number;
    const assetTag = `TEST-${tag}`;

    it('creates an asset allowing past warranty date (AST-02)', async () => {
      const created = await upsertAsset(db, {
        assetNo: assetTag,
        category: 'laptop',
        description: 'ThinkPad T14 Gen 4',
        serialNo: `SN-${tag}`,
        purchaseDate: '2023-01-10',
        warrantyTill: '2024-01-10', // PAST date explicitly allowed per AST-02!
        companyId: company1Id,
        actorUserId: testUser.id,
        ip: null,
      });

      expect(created.id).toBeGreaterThan(0);
      assetId = created.id;
    });

    it('enforces single active custodian: cannot assign asset to two employees simultaneously', async () => {
      // Allocate to testEmpId
      const firstAssign = await assignAsset(db, {
        assetId,
        holderKind: 'employee',
        employeeId: testEmpId,
        actorUserId: testUser.id,
        ip: null,
      });
      expect(firstAssign.assignmentId).toBeGreaterThan(0);

      // Attempt to allocate the same asset to managerId while still open -> MUST throw
      await expect(
        assignAsset(db, {
          assetId,
          holderKind: 'employee',
          employeeId: managerId,
          actorUserId: testUser.id,
          ip: null,
        }),
      ).rejects.toThrow(/already allocated/);

      // Clean return
      const ret = await returnAsset(db, {
        assignmentId: firstAssign.assignmentId,
        condition: 'ok',
        actorUserId: testUser.id,
        ip: null,
      });
      expect(ret.ok).toBe(true);
    });

    it('lost asset transitions to lost status and becomes strictly unallocatable', async () => {
      // Log maintenance incident as 'lost'
      await logMaintenance(db, {
        assetId,
        kind: 'lost',
        description: 'Hardware reported missing during field transit',
        actorUserId: testUser.id,
        ip: null,
      });

      const assetRow = await db
        .selectFrom('ast.assets')
        .select('status')
        .where('id', '=', assetId)
        .executeTakeFirstOrThrow();

      expect(assetRow.status).toBe('lost');

      // Attempting to assign lost asset MUST throw
      await expect(
        assignAsset(db, {
          assetId,
          holderKind: 'employee',
          employeeId: testEmpId,
          actorUserId: testUser.id,
          ip: null,
        }),
      ).rejects.toThrow(/cannot be allocated/);
    });

    it('accurately lists assets held by employee for exit clearance integration (AST-04)', async () => {
      // Create new asset for testEmp
      const asset2 = await upsertAsset(db, {
        assetNo: `${assetTag}-2`,
        category: 'phone',
        companyId: company1Id,
        actorUserId: testUser.id,
        ip: null,
      });

      await assignAsset(db, {
        assetId: asset2.id,
        holderKind: 'employee',
        employeeId: testEmpId,
        actorUserId: testUser.id,
        ip: null,
      });

      const held = await assetsHeldByEmployee(db, testEmpId);
      expect(held.length).toBeGreaterThanOrEqual(1);
      const found = held.find((a) => a.assetNo === `${assetTag}-2`);
      expect(found).toBeDefined();
      expect(found?.category).toBe('phone');
    });
  });
});
