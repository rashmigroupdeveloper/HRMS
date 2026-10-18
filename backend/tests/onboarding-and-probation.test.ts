/**
 * Stage 3.1 Test Suite — Onboarding Bridge & Probation Engine (Cards L01, L02).
 *
 * Verifies:
 * 1. Pre-join token generation, hash verification, single-use, and 72h expiration.
 * 2. Duplicate detection against employee master on email, mobile, and PAN.
 * 3. Unit composition of the conversion wizard: core.employees, core.users, probation salary,
 *    stakeholder tasks fan-out, and initial probation review.
 * 4. Task SLA tracking, auto-escalation sweep, and Kent biometric verification.
 * 5. Probation evaluation flow, confirmed-phase salary transition (100% CTC),
 *    and confirmation letter generation.
 * These fixtures do not prove native constraints, transaction atomicity,
 * delivered notifications or end-to-end workflow authorization.
 */

import { describe, it, expect, vi } from 'vitest';
import { fixtureDate, requireFixture, type FixtureRow, type FixtureWhere, type FixtureSelect, type FixtureInsert, type FixtureUpdate, type FixtureExpressionBuilder } from './lifecycle-fixtures.js';
import type { Kysely } from 'kysely';
import type { Database } from '../src/core/db/types.js';
import {
  PrejoinService,
  type PrejoinSubmissionData,
} from '../src/modules/lifecycle/onboarding/prejoin.service.js';
import {
  OnboardingService,
  type IngestCandidateInput,
  type ConvertCandidateInput,
  type ConversionActor,
} from '../src/modules/lifecycle/onboarding/onboarding.service.js';
import { TaskFanoutService } from '../src/modules/lifecycle/onboarding/task-fanout.service.js';
import { ProbationService } from '../src/modules/lifecycle/probation/probation.service.js';

// Native boundary suite proves cross-transaction identity locking; this is composition only.
vi.mock('../src/modules/settings/index.js',()=>({getTypedSetting:vi.fn().mockResolvedValue(72)}));
vi.mock('../src/modules/lifecycle/onboarding/joining-validation.js', async importOriginal => {
  const original = await importOriginal<typeof import('../src/modules/lifecycle/onboarding/joining-validation.js')>();
  return { ...original, validateJoiningAssignments: vi.fn().mockResolvedValue(undefined) };
});
vi.mock('../src/modules/lifecycle/onboarding/onboarding-locks.js', () => ({ lockOnboardingIdentities: vi.fn().mockResolvedValue(undefined) }));

interface ReturningFixtureUpdate extends FixtureUpdate {returning():ReturningFixtureUpdate;executeTakeFirst():Promise<{id:number}>}
describe('Phase 3, Stage 3.1 — Onboarding Bridge & Probation Management', () => {
  // In-memory state mock for isolated unit testing
  const candidatesStore: FixtureRow[] = [];
  let candidateRawToken = '';
  const employeesStore: FixtureRow[] = [];
  const usersStore: FixtureRow[] = [];
  const salariesStore: FixtureRow[] = [];
  const tasksStore: FixtureRow[] = [];
  const reviewsStore: FixtureRow[] = [];
  const lettersStore: FixtureRow[] = [];
  const companiesStore = [{ id: 1, ecode_prefix: 'RML', ecode_next_seq: 35390 }];

  const mockDb = {
    isTransaction: true, // Composition fixture; native suite proves transaction effects.
    selectFrom: (table: string) => {
      const b: FixtureSelect & { forUpdate: () => FixtureSelect } = {
        forUpdate: () => b,
        _where: [] as FixtureWhere[],
        _joins: [] as unknown[],
        selectAll: () => b,
        select: () => b,
        leftJoin: () => b,
        innerJoin: () => b,
        orderBy: () => b,
        where: (colOrFn: string | ((eb: FixtureExpressionBuilder) => unknown), op?: string, val?: unknown) => {
          if (typeof colOrFn === 'function') {
            const mockEb = (col: string, op1: string, val1: unknown) => ({ col, op: op1, val: val1 });
            mockEb.fn = (_name: string, columns: string[]) => columns[0] ?? '';
            mockEb.or = (arr: FixtureWhere[]) => {
              for (const item of arr) {
                if (item.col) b._where.push(item);
              }
            };
            colOrFn(mockEb);
          } else {
            b._where.push({ col: colOrFn, op, val });
          }
          return b;
        },
        executeTakeFirst: () => {
          if (table === 'core.onboarding_candidates') {
            const tokenHashWhere = b._where.find((w: FixtureWhere) => w.col === 'prejoin_token_hash');
            const idWhere = b._where.find((w: FixtureWhere) => w.col === 'id');
            if (tokenHashWhere) {
              const c = candidatesStore.find((x) => x['prejoin_token_hash'] === tokenHashWhere.val);
              return Promise.resolve(c ?? null);
            }
            if (idWhere) {
              const c = candidatesStore.find((x) => x.id === idWhere.val);
              return Promise.resolve(c ?? null);
            }
          }
          if (table === 'core.employees') {
            const emailWheres = b._where.filter((w: FixtureWhere) => w.col === 'personal_email' || w.col === 'work_email');
            const mobileWhere = b._where.find((w: FixtureWhere) => w.col === 'mobile');
            const panWhere = b._where.find((w: FixtureWhere) => w.col === 'pan');
            if (emailWheres.length > 0) {
              const targetVal = emailWheres[0]?.val;
              const e = employeesStore.find((x) => x['personal_email'] === targetVal || x['work_email'] === targetVal);
              return Promise.resolve(e ?? null);
            }
            if (mobileWhere) {
              const e = employeesStore.find((x) => x['mobile'] === mobileWhere.val);
              return Promise.resolve(e ?? null);
            }
            if (panWhere) {
              const e = employeesStore.find((x) => x['pan'] === panWhere.val);
              return Promise.resolve(e ?? null);
            }
          }
          if (table === 'core.companies') {
            return Promise.resolve(companiesStore[0]);
          }
          if (table === 'core.onboarding_tasks') {
            const idWhere = b._where.find((w: FixtureWhere) => w.col === 'id');
            const t = tasksStore.find((x) => x.id === idWhere?.val);
            return Promise.resolve(t ?? null);
          }
          if (table === 'core.probation_reviews') {
            const idWhere = b._where.find((w: FixtureWhere) => w.col === 'id');
            const r = reviewsStore.find((x) => x.id === idWhere?.val);
            return Promise.resolve(r ?? null);
          }
          if (table === 'pay.salary_structures') {
            return Promise.resolve({
              id: 100,
              name: 'Standard Staff Structure',
              company_id: 1,
              description: 'Standard staff salary structure',
              components: [
                { component_code: 'BASIC' },
                { component_code: 'HRA' },
                { component_code: 'SPECIAL_ALLOW' },
              ],
              is_active: true,
              created_at: new Date(),
              updated_at: new Date(),
            });
          }
          return Promise.resolve(null);
        },
        execute: () => {
          if (table === 'pay.salary_components') {
            return Promise.resolve([
              {
                id: 1,
                code: 'BASIC',
                name: 'Basic Pay',
                kind: 'earning',
                formula: 'round(GROSS * 0.50)',
                rounding: 'round',
                taxable: true,
                part_of_gross: true,
                part_of_pf_wages: true,
                prorate_on_lop: true,
                display_order: 1,
                is_active: true,
                created_at: new Date(),
              },
              {
                id: 2,
                code: 'HRA',
                name: 'House Rent Allowance',
                kind: 'earning',
                formula: 'round(BASIC * 0.50)',
                rounding: 'round',
                taxable: true,
                part_of_gross: true,
                part_of_pf_wages: false,
                prorate_on_lop: true,
                display_order: 2,
                is_active: true,
                created_at: new Date(),
              },
              {
                id: 3,
                code: 'SPECIAL_ALLOW',
                name: 'Special Allowance',
                kind: 'earning',
                formula: null,
                amount: 0,
                rounding: 'round',
                taxable: true,
                part_of_gross: true,
                part_of_pf_wages: false,
                prorate_on_lop: true,
                display_order: 3,
                is_active: true,
                created_at: new Date(),
              },
            ]);
          }
          if (table === 'core.onboarding_tasks') {
            const statusWhere = b._where.find((w: FixtureWhere) => w.col === 'status');
            const dueWhere = b._where.find((w: FixtureWhere) => w.col === 'due_date');
            if (statusWhere && dueWhere?.op === '<') {
              const overdue = tasksStore.filter((t) => t['status'] === 'open' && fixtureDate(t.due_date) < fixtureDate(dueWhere.val));
              return Promise.resolve(overdue);
            }
            return Promise.resolve(tasksStore);
          }
          if (table === 'core.probation_reviews as pr') {
            return Promise.resolve(
              reviewsStore.map((pr) => {
                const emp = employeesStore.find((e) => e.id === pr.employee_id) ?? {
                  ecode: 'RML035390',
                  first_name: 'Test',
                  last_name: 'Emp',
                  doj: '2026-01-01',
                };
                return {
                  id: pr.id,
                  employeeId: pr.employee_id,
                  ecode: emp.ecode,
                  first_name: emp.first_name,
                  last_name: emp.last_name,
                  departmentName: 'Production',
                  designationName: 'Graduate Trainee',
                  doj: emp.doj,
                  dueDate: pr.due_date,
                  managerRecommendation: pr['manager_recommendation'],
                  extensionMonths: pr['extension_months'],
                  reviewNotes: pr['review_notes'],
                  status: pr['status'],
                  outcome: pr['outcome'],
                  confirmationDate: pr.confirmation_date,
                };
              })
            );
          }
          if (table === 'core.probation_reviews') {
            const dueWhere = b._where.find((w: FixtureWhere) => w.col === 'due_date');
            if (dueWhere && Array.isArray(dueWhere.val)) {
              const valStrings = dueWhere.val.map(fixtureDate);
              const matched = reviewsStore.filter((r) => {
                const rDueStr = (r.due_date instanceof Date ? r.due_date.toISOString() : String(r.due_date)).slice(0, 10);
                return r['status'] === 'pending' && valStrings.includes(rDueStr);
              });
              return Promise.resolve(matched);
            }
            return Promise.resolve(reviewsStore);
          }
          return Promise.resolve([]);
        },
      };
      return b;
    },
    insertInto: (table: string) => {
      const b: FixtureInsert = {
        _val: {},
        values: (val: Partial<FixtureRow>) => {
          b._val = val;
          return b;
        },
        returning: () => b,
        executeTakeFirstOrThrow: () => {
          const id = Date.now() + Math.floor(Math.random() * 1000);
          const record = { id, ...b._val };
          if (table === 'core.onboarding_candidates') candidatesStore.push(record);
          if (table === 'core.employees') employeesStore.push(record);
          if (table === 'core.users') usersStore.push(record);
          if (table === 'pay.employee_salaries') salariesStore.push(record);
          if (table === 'core.onboarding_tasks') tasksStore.push(record);
          if (table === 'core.probation_reviews') reviewsStore.push(record);
          if (table === 'core.letters') lettersStore.push(record);
          return Promise.resolve({ id });
        },
        executeTakeFirst: () => {
          const id = Date.now() + Math.floor(Math.random() * 1000);
          const record = { id, ...b._val };
          if (table === 'core.letters') lettersStore.push(record);
          return Promise.resolve({ id });
        },
        execute: () => {
          const id = Date.now() + Math.floor(Math.random() * 1000);
          const record = { id, ...b._val };
          if (table === 'core.users') usersStore.push(record);
          if (table === 'core.onboarding_tasks') tasksStore.push(record);
          if (table === 'pay.employee_salaries') salariesStore.push(record);
          if (table === 'core.probation_reviews') reviewsStore.push(record);
          if (table === 'core.letters') lettersStore.push(record);
          return Promise.resolve();
        },
      };
      return b;
    },
    updateTable: (table: string) => {
      const b: ReturningFixtureUpdate = {
        returning:()=>b,
        executeTakeFirst:async()=>{await b.execute();const id=b._where.find(w=>w.col==='id')?.val;if(typeof id!=='number')throw new Error('Missing fixture candidate ID');return {id};},
        _set: {},
        _where: [] as FixtureWhere[],
        set: (patch: Partial<FixtureRow>) => {
          b._set = patch;
          return b;
        },
        where: (col: string, op: string, val: unknown) => {
          b._where.push({ col, op, val });
          return b;
        },
        execute: () => {
          const idWhere = b._where.find((w: FixtureWhere) => w.col === 'id');
          const empWhere = b._where.find((w: FixtureWhere) => w.col === 'employee_id');
          if (table === 'core.onboarding_candidates' && idWhere) {
            const target = candidatesStore.find((x) => x.id === idWhere.val);
            if (target) Object.assign(target, b._set);
          }
          if (table === 'core.employees') {
            const target = employeesStore.find((x) => x.id === (idWhere?.val ?? empWhere?.val));
            if (target) Object.assign(target, b._set);
          }
          if (table === 'core.onboarding_tasks') {
            const taskCodeWhere = b._where.find((w: FixtureWhere) => w.col === 'task_code');
            const matchingTasks = tasksStore.filter((x) => {
              if (idWhere && x.id !== idWhere.val) return false;
              if (empWhere && x.employee_id !== empWhere.val) return false;
              if (taskCodeWhere && x['task_code'] !== taskCodeWhere.val) return false;
              return true;
            });
            for (const t of matchingTasks) {
              Object.assign(t, b._set);
            }
          }
          if (table === 'core.probation_reviews' && idWhere) {
            const target = reviewsStore.find((x) => x.id === idWhere.val);
            if (target) Object.assign(target, b._set);
          }
          if (table === 'pay.employee_salaries' && empWhere) {
            const target = salariesStore.find((x) => x.employee_id === empWhere.val);
            if (target) Object.assign(target, b._set);
          }
          if (table === 'core.companies' && companiesStore[0]) {
            Object.assign(companiesStore[0], b._set);
          }
          return Promise.resolve();
        },
      };
      return b;
    },
  } as unknown as Kysely<Database>;

  describe('LC-01 — Pre-join Tokens & Candidate Intake', () => {
    it('generates a 72-hour secure token with SHA-256 hash', () => {
      const token = PrejoinService.generateToken(72);

      expect(token.rawToken.length).toBe(64); // 32 bytes hex
      expect(token.tokenHash.length).toBe(64); // SHA-256 hex
      expect(token.expiresAt.getTime()).toBeGreaterThan(Date.now() + 71 * 60 * 60 * 1000);
      expect(token.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 72 * 60 * 60 * 1000 + 1000);
    });

    it('ingests candidate from ATS and tracks prejoin token', async () => {
      const input: IngestCandidateInput = {
        fullName: 'Rahul Sen',
        personalEmail: 'rahul.sen@example.com',
        mobile: '9876543210',
        positionTitle: 'Junior Metallurgist',
        offeredCtc: 450000,
        probationMonths: 6,
        probationSalaryPct: 90,
        proposedDoj: '2026-08-01',
        offerDate: '2026-07-15',
        companyId: 1,
      };

      const res = await OnboardingService.ingestCandidate(mockDb, input);

      candidateRawToken=res.rawToken;
      expect(res.candidateId).toBeDefined();
      expect(res.rawToken).toBeDefined();

      const saved = requireFixture(candidatesStore.find((c) => c.id === res.candidateId));
      expect(saved).toBeDefined();
      expect(saved['full_name']).toBe('Rahul Sen');
      expect(saved['status']).toBe('awaiting_prejoin');
      expect(saved.prejoin_link_token).toBeNull();
    });

    it('submits pre-join profile and statutory information', async () => {
      const candidate = requireFixture(candidatesStore[0]);
      expect(candidate).toBeDefined();

      const submission: PrejoinSubmissionData = {
        presentAddress: 'Kharagpur Steel Township, Sector 4',
        permanentAddress: 'Kolkata, Salt Lake Block B',
        emergencyContactName: 'Bina Sen',
        emergencyContactPhone: '9876543211',
        emergencyContactRelation: 'Mother',
        pan: 'ABCPS1234F',
        aadhaar: '123456789012',
        bankName: 'State Bank of India',
        bankAccount: '12345678901',
        bankIfsc: 'SBIN0001234',
        bloodGroup: 'B+',
      };

      const result = await PrejoinService.submitPrejoinData(
        mockDb,
        candidateRawToken,
        submission
      );

      expect(result.success).toBe(true);
      expect(candidate['status']).toBe('prejoin_done');
      expect(candidate['prejoin_completed_at']).toBeDefined();
    });

    it('rejects expired pre-join tokens', async () => {
      // Create candidate with expired token
      const expiredCandidateId = 9999;
      const token = PrejoinService.generateToken(72);
      candidatesStore.push({
        id: expiredCandidateId,
        prejoin_token_hash: token.tokenHash,
        prejoin_token_expires_at: new Date(Date.now() - 1000).toISOString(), // expired in past
        status: 'link_sent',
      });

      // Validating an expired token should fail
      const check = await PrejoinService.validateToken(mockDb, token.rawToken);
      expect(check.isValid).toBe(false);
      expect(check.error).toContain('expired');
    });
  });

  describe('LC-01 — Duplicate Detection', () => {
    it('detects duplicate employees based on mobile or email', async () => {
      employeesStore.push({
        id: 1,
        ecode: 'RML000100',
        first_name: 'Existing',
        last_name: 'User',
        personal_email: 'existing.user@example.com',
        work_email: 'rml000100@rashmigroup.com',
        mobile: '9876500000',
        pan: 'EXTPAN1234',
      });

      const emailDup = await OnboardingService.checkDuplicate(
        mockDb,
        'existing.user@example.com',
        '9999999999'
      );
      expect(emailDup.hasDuplicate).toBe(true);
      expect(emailDup.duplicateField).toBe('email');
      expect(emailDup.existingEcode).toBe('RML000100');

      const mobileDup = await OnboardingService.checkDuplicate(
        mockDb,
        'new@example.com',
        '9876500000'
      );
      expect(mobileDup.hasDuplicate).toBe(true);
      expect(mobileDup.duplicateField).toBe('mobile');

      const noDup = await OnboardingService.checkDuplicate(
        mockDb,
        'unique@example.com',
        '9111111111'
      );
      expect(noDup.hasDuplicate).toBe(false);

      const panDup = await OnboardingService.checkDuplicate(
        mockDb,
        'unique2@example.com',
        '9111111112',
        'EXTPAN1234'
      );
      expect(panDup.hasDuplicate).toBe(true);
      expect(panDup.duplicateField).toBe('pan');
    });
  });

  describe('LC-01 & LC-02 — HR Conversion Wizard & Stakeholder Fan-out', () => {
    it('converts candidate to employee, generates e-code, and fans out tasks', async () => {
      const candidate = requireFixture(candidatesStore[0]);
      expect(candidate).toBeDefined();

      const convertInput: ConvertCandidateInput = {
        candidateId: candidate.id,
        joiningConfirmed: true,
        workEmail: 'synthetic-joining@hrms.invalid',
        companyId: 1,
        designationId: 10,
        departmentId: 5,
        locationId: 2,
        orgUnitId: 3,
        doj: '2026-08-01',
        salaryStructureId: 100,
      };

      // SQL allocation has a separate real-PostgreSQL concurrency suite. This
      // fixture covers composition only, never database atomicity/constraints.
      const allocation = vi.spyOn(OnboardingService, 'generateEcode').mockResolvedValueOnce('RML035390');
      const result = await OnboardingService.convertCandidate(mockDb, convertInput, { userId: 1, scope: { all: true, own: false, subtree: false, orgUnitIds: [], actorEmployeeId: null } }).finally(() => {
        allocation.mockRestore();
      });

      expect(result.employeeId).toBeDefined();
      expect(result.ecode).toMatch(/^RML\d{6}$/);

      // Verify employee record created
      const emp = requireFixture(employeesStore.find((e) => e.id === result.employeeId));
      expect(emp).toBeDefined();
      expect(emp['ecode']).toBe(result.ecode);
      expect(emp['first_name']).toBe('Rahul');
      expect(emp['contract_type']).toBe('probationary');
      expect(emp['biometric_registered']).toBe(false);

      // Verify user login created
      const user = requireFixture(usersStore.find((u) => u.employee_id === result.employeeId));
      expect(user).toBeDefined();
      expect(user['is_active']).toBe(false);

      // Verify probation salary assignment (90% of ₹4,50,000 = ₹4,05,000)
      const salary = requireFixture(salariesStore.find((s) => s.employee_id === result.employeeId));
      expect(salary).toBeDefined();
      expect(Number(salary.annual_ctc)).toBe(405000);

      // Verify candidate status updated
      expect(candidate['status']).toBe('converted');

      // Verify fan-out stakeholder tasks (5 standard tasks)
      const empTasks = tasksStore.filter((t) => t.employee_id === result.employeeId);
      expect(empTasks.length).toBe(5);
      expect(empTasks.some((t) => t['task_code'] === 'it_email')).toBe(true);
      expect(empTasks.some((t) => t['task_code'] === 'it_biometric')).toBe(true);

      // Verify initial probation review created with due date 6 months after DOJ
      const review = requireFixture(reviewsStore.find((r) => r.employee_id === result.employeeId));
      expect(review).toBeDefined();
      expect(review['status']).toBe('pending');
      expect(new Date(fixtureDate(review.due_date)).toISOString().slice(0, 10)).toBe('2027-02-01');
    });

    it('enforces conversion wizard validation guards and candidate status checks', async () => {
      const actor: ConversionActor = { userId: 1, scope: { all: true, own: false, subtree: false, orgUnitIds: [], actorEmployeeId: null } };
      const candidate = requireFixture(candidatesStore[0]);
      const baseInput: ConvertCandidateInput = {
        joiningConfirmed: true,
        candidateId: candidate.id,
        companyId: 1,
        designationId: 1,
        departmentId: 1,
        locationId: 2,
        orgUnitId: 3,
        doj: '2026-08-01',
        salaryStructureId: 100,
      };

      // 1. Missing or invalid actor
      await expect(
        OnboardingService.convertCandidate(mockDb, baseInput, undefined as unknown as ConversionActor),
      ).rejects.toThrow('An authenticated HR actor is required');

      // 2. Joining not confirmed
      await expect(
        OnboardingService.convertCandidate(mockDb, { ...baseInput, joiningConfirmed: false }, actor),
      ).rejects.toThrow('HR must explicitly confirm actual joining');

      // 3. Invalid DOJ format
      await expect(
        OnboardingService.convertCandidate(mockDb, { ...baseInput, doj: 'not-a-date' }, actor),
      ).rejects.toThrow('Actual joining date must be a valid calendar date');

      // 4. Future DOJ
      await expect(
        OnboardingService.convertCandidate(mockDb, { ...baseInput, doj: '2099-12-31' }, actor),
      ).rejects.toThrow('Actual joining date cannot be in the future');

      // 5. Candidate not found
      await expect(
        OnboardingService.convertCandidate(mockDb, { ...baseInput, candidateId: 99999 }, actor),
      ).rejects.toThrow('not found');

      // 6. Candidate already converted (candidate.id was converted in previous test)
      await expect(
        OnboardingService.convertCandidate(mockDb, baseInput, actor),
      ).rejects.toThrow('already converted');
    });

    it('does not fabricate Kent verification when the enrollment integration is unavailable', async () => {
      const emp = requireFixture(employeesStore[employeesStore.length - 1]);
      await expect(TaskFanoutService.verifyBiometricRegistration(mockDb,emp.id,1)).rejects.toThrow(/unavailable/i);
      expect(emp['biometric_registered']).toBe(false);
      const task = requireFixture(tasksStore.find(t=>t.employee_id===emp.id && t['task_code']==='it_biometric'));
      expect(task['status']).toBe('open');
    });

    it('escalates overdue stakeholder tasks past SLA due date', async () => {
      // Add a task due in the past
      tasksStore.push({
        id: 8888,
        employee_id: 1,
        task_code: 'admin_id_card',
        task_name: 'Print ID Card',
        status: 'open',
        due_date: '2026-07-01', // in past
      });

      const escalatedCount = await TaskFanoutService.checkTaskEscalations(
        mockDb,
        new Date('2026-08-01')
      );

      expect(escalatedCount).toBeGreaterThan(0);
      const overdueTask = requireFixture(tasksStore.find((t) => t.id === 8888));
      expect(overdueTask['status']).toBe('escalated');
      expect(overdueTask['escalated_at']).toBeDefined();
    });
  });

  describe('LC-04 — Probation Board & Confirmation Engine', () => {
    it('submits manager evaluation for probation review', async () => {
      const review = requireFixture(reviewsStore[0]);
      expect(review).toBeDefined();

      await ProbationService.submitEvaluation(mockDb, {
        reviewId: review.id,
        managerRecommendation: 'confirm',
        reviewNotes: 'Excellent performance during probation in rolling mill.',
        ratings: { technical: 5, safety: 5, punctuality: 4 },
      });

      expect(review['manager_recommendation']).toBe('confirm');
      expect(review['status']).toBe('under_review');
    });

    it('confirms employee, transitions to 100% CTC, and enqueues confirmation letter', async () => {
      const review = requireFixture(reviewsStore[0]);
      const empId = review.employee_id;

      const decision = await ProbationService.decideReview(mockDb, {
        reviewId: review.id,
        outcome: 'confirmed',
        decidedByUserId: 1,
        confirmationDate: '2027-02-01',
        confirmedAnnualCtc: 450000, // 100% full CTC
        salaryStructureId: 100,
        decisionNotes: 'Confirmed by Plant Head & HR Head.',
      });

      expect(decision.outcome).toBe('confirmed');
      expect(decision.confirmationLetterId).toBeDefined();

      // Check review outcome
      expect(review['outcome']).toBe('confirmed');
      expect(review['status']).toBe('completed');
      expect(new Date(fixtureDate(review.confirmation_date)).toISOString().slice(0, 10)).toBe('2027-02-01');

      // Check employee status advanced to permanent
      const emp = requireFixture(employeesStore.find((e) => e.id === empId));
      expect(emp['contract_type']).toBe('permanent');

      // Check new confirmed salary row with 100% CTC
      const newSalary = requireFixture(salariesStore[salariesStore.length - 1]);
      expect(Number(newSalary.annual_ctc)).toBe(450000);
      expect(new Date(fixtureDate(newSalary.effective_from)).toISOString().slice(0, 10)).toBe('2027-02-01');

      // Check confirmation letter created
      const letter = requireFixture(lettersStore.find((l) => l.employee_id === empId));
      expect(letter).toBeDefined();
      expect(letter['template_code']).toBe('CONFIRMATION_LETTER');
    });

    it('supports probation extension and triggers next review cycle', async () => {
      // Add new probation review to test extension
      const reviewToExtend: FixtureRow = {
        id: 7777,
        employee_id: 2,
        due_date: '2026-09-01',
        status: 'under_review',
        manager_recommendation: 'extend',
        extension_months: 2,
      };
      reviewsStore.push(reviewToExtend);

      const decision = await ProbationService.decideReview(mockDb, {
        reviewId: 7777,
        outcome: 'extended',
        decidedByUserId: 1,
        extensionMonths: 2,
        decisionNotes: 'Probation extended by 2 months for additional training.',
      });

      expect(decision.outcome).toBe('extended');
      expect(reviewToExtend['outcome']).toBe('extended');
      expect(reviewToExtend['status']).toBe('completed');

      // Check new subsequent review created with extended due date
      const nextReview = requireFixture(reviewsStore.find(
        (r) => r.employee_id === 2 && r['status'] === 'pending'
      ));
      expect(nextReview).toBeDefined();
      expect(new Date(fixtureDate(nextReview.due_date)).toISOString().slice(0, 10)).toBe('2026-11-01');
    });

    it('identifies upcoming probation due reviews for reminder alerts', async () => {
      reviewsStore.push({
        id: 5001,
        employee_id: 10,
        due_date: '2026-08-31', // exactly 30 days from 2026-08-01
        status: 'pending',
      });
      reviewsStore.push({
        id: 5002,
        employee_id: 11,
        due_date: '2026-08-15', // exactly 14 days from 2026-08-01
        status: 'pending',
      });
      reviewsStore.push({
        id: 5003,
        employee_id: 12,
        due_date: '2026-08-08', // exactly 7 days from 2026-08-01
        status: 'pending',
      });

      const alerts = await ProbationService.getUpcomingProbationAlerts(
        mockDb,
        new Date('2026-08-01')
      );

      expect(alerts.d30).toContain(5001);
      expect(alerts.d14).toContain(5002);
      expect(alerts.d7).toContain(5003);
    });

    it('covers ProbationService listReviews, separation decision, and input validations', async () => {
      // 1. listReviews without filter and with filter
      const allReviews = await ProbationService.listReviews(mockDb);
      expect(allReviews.length).toBeGreaterThanOrEqual(1);

      const pendingReviews = await ProbationService.listReviews(mockDb, { status: 'pending' });
      expect(Array.isArray(pendingReviews)).toBe(true);

      // 2. submitEvaluation non-existent review
      await expect(
        ProbationService.submitEvaluation(mockDb, {
          reviewId: 999999,
          managerRecommendation: 'confirm',
          reviewNotes: 'None',
        })
      ).rejects.toThrow(/not found/);

      // 3. submitEvaluation extension without valid months
      await expect(
        ProbationService.submitEvaluation(mockDb, {
          reviewId: 5001,
          managerRecommendation: 'extend',
          extensionMonths: 0,
          reviewNotes: 'Invalid extension',
        })
      ).rejects.toThrow(/valid duration/);

      // 4. decideReview non-existent review
      await expect(
        ProbationService.decideReview(mockDb, {
          reviewId: 999999,
          outcome: 'separated',
          decidedByUserId: 1,
        })
      ).rejects.toThrow(/not found/);

      // 5. decideReview outcome: separated
      reviewsStore.push({
        id: 6001,
        employee_id: 15,
        due_date: '2026-09-01',
        status: 'under_review',
      });
      const sepDecision = await ProbationService.decideReview(mockDb, {
        reviewId: 6001,
        outcome: 'separated',
        decidedByUserId: 1,
      });
      expect(sepDecision.outcome).toBe('separated');

      // 6. decideReview outcome: confirmed without salary adjustment
      reviewsStore.push({
        id: 6002,
        employee_id: 16,
        due_date: '2026-09-01',
        status: 'under_review',
      });
      employeesStore.push({
        id: 16,
        ecode: 'RML016',
        first_name: 'Confirm',
        last_name: 'Test',
      });
      const confDecision = await ProbationService.decideReview(mockDb, {
        reviewId: 6002,
        outcome: 'confirmed',
        decidedByUserId: 1,
      });
      expect(confDecision.outcome).toBe('confirmed');
    });

    it('validates OnboardingService.convertCandidate validation guards', async () => {
      const validCandidateInput: ConvertCandidateInput = {
        joiningConfirmed: true,
        candidateId: 1,
        companyId: 1,
        designationId: 1,
        departmentId: 1,
        locationId: 1,
        orgUnitId: 1,
        doj: '2026-06-01',
      };

      // 1. Missing actor
      await expect(
        OnboardingService.convertCandidate(mockDb, validCandidateInput, undefined)
      ).rejects.toThrow(/authenticated HR actor/);

      // 2. Joining unconfirmed
      await expect(
        OnboardingService.convertCandidate(
          mockDb,
          { ...validCandidateInput, joiningConfirmed: false },
          { userId: 1, scope: { all: true, own: false, subtree: false, actorEmployeeId: null, orgUnitIds: [] } }
        )
      ).rejects.toThrow(/explicitly confirm actual joining/);

      // 3. Invalid DOJ format
      await expect(
        OnboardingService.convertCandidate(
          mockDb,
          { ...validCandidateInput, doj: 'not-a-date' },
          { userId: 1, scope: { all: true, own: false, subtree: false, actorEmployeeId: null, orgUnitIds: [] } }
        )
      ).rejects.toThrow(/valid calendar date/);

      // 4. Future DOJ
      await expect(
        OnboardingService.convertCandidate(
          mockDb,
          { ...validCandidateInput, doj: '2099-01-01' },
          { userId: 1, scope: { all: true, own: false, subtree: false, actorEmployeeId: null, orgUnitIds: [] } }
        )
      ).rejects.toThrow(/cannot be in the future/);

      // 5. Candidate not found
      await expect(
        OnboardingService.convertCandidate(
          mockDb,
          { ...validCandidateInput, candidateId: 999999 },
          { userId: 1, scope: { all: true, own: false, subtree: false, actorEmployeeId: null, orgUnitIds: [] } }
        )
      ).rejects.toThrow(/not found/);
    });
  });
});
