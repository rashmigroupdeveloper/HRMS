/**
 * ATS Onboarding Bridge & Conversion Wizard (LC-01, SOW crosswalk).
 *
 * Implements:
 * - Candidate intake from ATS / LOI into core.onboarding_candidates.
 * - Duplicate checks against employee master.
 * - Atomic HR Conversion Wizard: ecode generation, core.employees creation,
 *   initial probation salary row creation, and stakeholder task fan-out.
 */

import { z } from 'zod';
import type { ConvertCandidateInput } from './onboarding-types.js';
import { istDateString, addMonthsIso } from '../../../core/dates.js';
import { fromRupees, toRupees } from '../../../core/money/index.js';
import { writeAudit } from '../../../core/audit/audit.service.js';
import { employeeScopeSql, type EmployeeScope } from '../../../core/rbac/employee-scope.js';
import { assertCompanyInScope } from '../../../core/rbac/company-scope.js';
import type { Kysely } from 'kysely';
import type { Database, EmploymentCategory } from '../../../core/db/types.js';
import { allocateEmployeeCode } from '../../../core/employee-code.js';
import { getTypedSetting } from '../../settings/index.js';
import {
  getStructure,
  listComponents,
  resolveSalaryStructure,
  structureLineNode,
  type ComponentFormulaNode,
} from '../../payroll-core/index.js';
import { PrejoinService, PrejoinConfigurationError } from './prejoin.service.js';
import { lockOnboardingIdentities } from './onboarding-locks.js';
import { readCompletedApplication, validateJoiningAssignments } from './joining-validation.js';
import { TaskFanoutService } from './task-fanout.service.js';
import { inTransaction } from '../../../core/db/database.js';

export interface IngestCandidateInput {
  atsCandidateId?: number | null | undefined;
  loiReference?: string | null | undefined;
  fullName: string;
  personalEmail: string;
  mobile: string;
  dob?: string | null | undefined;
  address?: string | null | undefined;
  totalExperienceYears?: number | null | undefined;
  previousCompany?: string | null | undefined;
  currentSalary?: number | null | undefined;
  expectedSalary?: number | null | undefined;
  positionTitle: string;
  department?: string | null | undefined;
  orgUnit?: string | null | undefined;
  designation?: string | null | undefined;
  companyId?: number | null | undefined;
  category?: EmploymentCategory | undefined;
  offeredCtc: number | string;
  probationMonths?: number | undefined;
  probationSalaryPct?: number | undefined;
  proposedDoj: string;
  offerDate: string;
  workLocation?: string | null | undefined;
}

export interface ConversionActor { userId: number; scope: EmployeeScope }

export type { ConvertCandidateInput } from './onboarding-types.js';

export interface DuplicateCheckResult {
  hasDuplicate: boolean;
  duplicateField?: string | undefined;
  existingEcode?: string | undefined;
  existingName?: string | undefined;
}


export const OnboardingService = {
  /**
   * Ingests a new accepted candidate from ATS or LOI.
   */
  async ingestCandidate(
    db: Kysely<Database>,
    input: IngestCandidateInput
  ): Promise<{ candidateId: number; rawToken: string; expiresAt: Date }> {
    const lifetimeHours=await getTypedSetting<number|null>(db,'lifecycle.prejoin_token_hours','number',null);
    if(lifetimeHours===null) throw new PrejoinConfigurationError('Configure the prejoin link lifetime before issuing a link');
    const tokenData = PrejoinService.generateToken(lifetimeHours);

    const insertResult = await db
      .insertInto('core.onboarding_candidates')
      .values({
        ats_candidate_id: input.atsCandidateId ?? null,
        loi_reference: input.loiReference ?? null,
        full_name: input.fullName,
        personal_email: input.personalEmail.toLowerCase().trim(),
        mobile: input.mobile.trim(),
        dob: input.dob ?? null,
        address: input.address ?? null,
        total_experience_years: input.totalExperienceYears !== undefined && input.totalExperienceYears !== null ? String(input.totalExperienceYears) : null,
        previous_company: input.previousCompany ?? null,
        current_salary: input.currentSalary !== undefined && input.currentSalary !== null ? String(input.currentSalary) : null,
        expected_salary: input.expectedSalary !== undefined && input.expectedSalary !== null ? String(input.expectedSalary) : null,
        position_title: input.positionTitle,
        department: input.department ?? null,
        org_unit: input.orgUnit ?? null,
        designation: input.designation ?? null,
        company_id: input.companyId ?? null,
        category: input.category ?? 'white_collar',
        offered_ctc: String(input.offeredCtc),
        probation_months: input.probationMonths ?? 6,
        probation_salary_pct: input.probationSalaryPct ?? 100,
        proposed_doj: new Date(input.proposedDoj),
        offer_date: new Date(input.offerDate),
        work_location: input.workLocation ?? null,
        prejoin_link_token: null,
        prejoin_token_hash: tokenData.tokenHash,
        prejoin_token_expires_at: tokenData.expiresAt,
        prejoin_link_sent_at: null,
        status: 'awaiting_prejoin',
        updated_at: new Date(),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    return {
      candidateId: insertResult.id,
      rawToken: tokenData.rawToken,
      expiresAt: tokenData.expiresAt,
    };
  },

  /**
   * Checks for duplicate candidate against employee master.
   */
  async checkDuplicate(
    db: Kysely<Database>,
    email: string,
    mobile: string,
    pan?: string | null,
    scope?: EmployeeScope,
  ): Promise<DuplicateCheckResult> {
    const cleanEmail = email.toLowerCase().trim();
    const cleanMobile = mobile.trim();

    // Check personal or work email
    const emailMatch = await db
      .selectFrom('core.employees').where(employeeScopeSql(scope,'core.employees'))
      .select(['ecode', 'first_name', 'last_name', 'personal_email', 'work_email'])
      .where((eb) =>
        eb.or([
          eb(eb.fn<string>('lower', ['personal_email']), '=', cleanEmail),
          eb(eb.fn<string>('lower', ['work_email']), '=', cleanEmail),
        ])
      )
      .executeTakeFirst();

    if (emailMatch) {
      return {
        hasDuplicate: true,
        duplicateField: 'email',
        existingEcode: emailMatch.ecode,
        existingName: `${emailMatch.first_name} ${emailMatch.last_name ?? ''}`.trim(),
      };
    }

    // Check mobile
    const mobileMatch = await db
      .selectFrom('core.employees').where(employeeScopeSql(scope,'core.employees'))
      .select(['ecode', 'first_name', 'last_name', 'mobile'])
      .where('mobile', '=', cleanMobile)
      .executeTakeFirst();

    if (mobileMatch) {
      return {
        hasDuplicate: true,
        duplicateField: 'mobile',
        existingEcode: mobileMatch.ecode,
        existingName: `${mobileMatch.first_name} ${mobileMatch.last_name ?? ''}`.trim(),
      };
    }

    // Check PAN if provided
    if (pan && pan.trim().length > 0) {
      const cleanPan = pan.toUpperCase().trim();
      const panMatch = await db
        .selectFrom('core.employees').where(employeeScopeSql(scope,'core.employees'))
        .select(['ecode', 'first_name', 'last_name'])
        .where('pan', '=', cleanPan)
        .executeTakeFirst();

      if (panMatch) {
        return {
          hasDuplicate: true,
          duplicateField: 'pan',
          existingEcode: panMatch.ecode,
          existingName: `${panMatch.first_name} ${panMatch.last_name ?? ''}`.trim(),
        };
      }
    }

    return { hasDuplicate: false };
  },

  /**
   * Generates the next sequential e-code for the given legal entity.
   */
  async generateEcode(db: Kysely<Database>, companyId: number): Promise<string> {
    return allocateEmployeeCode(db, companyId);
  },

  /**
   * Atomic HR Conversion Wizard: Candidate -> Employee + User + Salary + Fanout Tasks + Probation Review.
   */
  async convertCandidate(
    db: Kysely<Database>,
    input: ConvertCandidateInput,
    actor?: ConversionActor,
  ): Promise<{ employeeId: number; ecode: string }> {
    if (!actor || !Number.isSafeInteger(actor.userId) || actor.userId <= 0) throw new Error('An authenticated HR actor is required for conversion');
    if (!z.literal(true).safeParse(input.joiningConfirmed).success) throw new Error('HR must explicitly confirm actual joining before creating an employee');
    const actualDoj = z.string().date().safeParse(input.doj);
    if (!actualDoj.success) throw new Error('Actual joining date must be a valid calendar date');
    if (input.doj > istDateString()) throw new Error('Actual joining date cannot be in the future');
    const convert = async (db: Kysely<Database>) => {
    const candidate = await db
      .selectFrom('core.onboarding_candidates')
      .selectAll()
      .where('id', '=', input.candidateId)
      .forUpdate()
      .executeTakeFirst();

    if (!candidate) {
      throw new Error(`Candidate with id ${input.candidateId} not found.`);
    }

    if (candidate.company_id === null) throw new Error('Candidate must have an accepted employing entity');
    if (!actor.scope.all) await assertCompanyInScope(db, actor.scope, candidate.company_id);

    if (candidate.status === 'converted') {
      throw new Error(`Candidate ${candidate.full_name} is already converted.`);
    }

    if (candidate.company_id !== input.companyId) throw new Error('Candidate company must match its accepted employing entity');
    if (candidate.status !== 'prejoin_done' || !candidate.prejoin_completed_at || !candidate.prejoin_submitted_data) throw new Error('A completed and submitted pre-join application is required before HR confirms joining');
    // Legacy source org-unit text is not authority. Restricted HR needs whole
    // entity coverage until a verified candidate org-unit FK is mapped.


    // Extract the completed application, never invent a submitted state.
    const prejoinData = readCompletedApplication(candidate.prejoin_submitted_data);
    await validateJoiningAssignments(db, input, actor.scope);

    const normalizedWorkEmail = input.workEmail?.toLowerCase().trim();
    const workEmail = normalizedWorkEmail === undefined || normalizedWorkEmail.length === 0 ? null : normalizedWorkEmail;
    await lockOnboardingIdentities(db, candidate.personal_email, candidate.mobile, prejoinData.pan, workEmail);
    // Run duplicate check after acquiring all identity locks.
    const dup = await this.checkDuplicate(
      db,
      candidate.personal_email,
      candidate.mobile,
      prejoinData.pan
    );
    const workEmailDuplicate = workEmail === null ? null : await this.checkDuplicate(db, workEmail, candidate.mobile, prejoinData.pan);
    if (dup.hasDuplicate || workEmailDuplicate?.hasDuplicate) {
      throw new Error(
        'Duplicate candidate identity detected; authorized HR reconciliation is required.'
      );
    }

    // Generate ecode
    const ecode = await this.generateEcode(db, input.companyId);

    // Split name into first and last name
    const nameParts = candidate.full_name.trim().split(/\s+/);
    const firstName = nameParts[0] ?? candidate.full_name;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

    // 1. Create core.employees record
    const empInsert = await db
      .insertInto('core.employees')
      .values({
        ecode,
        company_id: input.companyId,
        first_name: firstName,
        last_name: lastName,
        dob: candidate.dob ? new Date(candidate.dob) : null,
        personal_email: candidate.personal_email,
        work_email: workEmail,
        mobile: candidate.mobile,
        present_address: prejoinData.presentAddress,
        permanent_address: prejoinData.permanentAddress,
        emergency_contact_name: prejoinData.emergencyContactName,
        emergency_contact_phone: prejoinData.emergencyContactPhone,
        blood_group: prejoinData.bloodGroup ?? null,
        category: candidate.category,
        contract_type: 'probationary',
        doj: new Date(input.doj),
        status: 'active',
        designation_id: input.designationId,
        department_id: input.departmentId,
        location_id: input.locationId,
        org_unit_id: input.orgUnitId,
        grade_id: input.gradeId ?? null,
        reporting_manager_id: input.reportingManagerId ?? null,
        pan: prejoinData.pan ? prejoinData.pan.toUpperCase().trim() : null,
        aadhaar: prejoinData.aadhaar ? prejoinData.aadhaar.trim() : null,
        uan: prejoinData.uan ? prejoinData.uan.trim() : null,
        bank_name: prejoinData.bankName,
        bank_account: prejoinData.bankAccount,
        bank_ifsc: prejoinData.bankIfsc ? prejoinData.bankIfsc.toUpperCase().trim() : null,
        payment_mode: 'bank',
        biometric_registered: false,
        attendance_mode: 'biometric',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const employeeId = empInsert.id;

    // 2. Create core.users login record
    if (workEmail !== null) await db
      .insertInto('core.users')
      .values({
        email: workEmail,
        password_hash: '!awaiting_identity_provisioning!',
        employee_id: employeeId,
        is_active: false,
      })
      .execute();

    // 3. Create initial probation salary record if structure provided
    if (input.salaryStructureId) {
      const probationPct = candidate.probation_salary_pct;
      const offeredCtcPaise = fromRupees(Number(candidate.offered_ctc));

      // Resolve approved company structure into canonical component breakdown
      const struct = await getStructure(db, input.salaryStructureId);
      if (!struct) {
        throw new Error(`Salary structure #${input.salaryStructureId} not found`);
      }

      const allComponents = await listComponents(db);
      const compMap = new Map(allComponents.map((c) => [c.code, c]));
      const nodes: ComponentFormulaNode[] = struct.components.map((item) => {
        const meta = compMap.get(item.component_code);
        if (!meta) {
          throw new Error(`Salary component '${item.component_code}' not found in component catalog`);
        }
        return structureLineNode(item, meta);
      });

      const evaluated = resolveSalaryStructure({
        nodes,
        annualCtcPaise: offeredCtcPaise,
        probationPercent: probationPct !== null && probationPct < 100 ? probationPct : undefined,
      });

      const componentAmounts: Record<string, number> = {};
      for (const [code, amt] of Object.entries(evaluated.monthly)) {
        componentAmounts[code] = amt;
      }

      await db
        .insertInto('pay.employee_salaries')
        .values({
          employee_id: employeeId,
          structure_id: input.salaryStructureId,
          effective_from: new Date(input.doj),
          effective_to: new Date('9999-12-31'),
          annual_ctc: toRupees(evaluated.annualCtc).toFixed(2),
          phase: 'probation',
          component_amounts: componentAmounts,
          probation_percent: probationPct !== null ? probationPct.toFixed(2) : null,
          revision_reason: 'joining',
          approved_by: actor.userId,
          approved_at: new Date(),
        })
        .execute();
    }

    // 4. Update candidate status to converted
    await db
      .updateTable('core.onboarding_candidates')
      .set({
        status: 'converted',
        employee_id: employeeId,
        updated_at: new Date(),
      })
      .where('id', '=', input.candidateId)
      .execute();

    // 5. Fan out onboarding stakeholder checklist tasks (IT, Admin, HR Ops)
    await TaskFanoutService.fanoutTasksForEmployee(db, employeeId, candidate.id);

    // 6. Initialize probation review record driven by settings and calendar-safe month addition
    const defaultMonths = await getTypedSetting(db, 'probation.default_months', 'number', 6);
    const probationMonths = candidate.probation_months ?? defaultMonths;
    const dueDate = addMonthsIso(input.doj, probationMonths);
    await db
      .insertInto('core.probation_reviews')
      .values({
        employee_id: employeeId,
        due_date: new Date(dueDate),
        status: 'pending',
        updated_at: new Date(),
      })
      .execute();

    await writeAudit(db, {
      actorUserId: actor.userId, subjectEmployeeId: employeeId,
      action: 'create', entity: 'core.employees', entityId: employeeId,
      field: 'actual_joining_confirmed',
      newValue: JSON.stringify({ candidateId: candidate.id, atsCandidateId: candidate.ats_candidate_id,
        loiReference: candidate.loi_reference, companyId: input.companyId, actualDoj: input.doj,
        completedApplicationReviewed: true, joiningConfirmed: true, ecode }),
    });
    return { employeeId, ecode };
    };
    return db.isTransaction ? convert(db) : inTransaction(db, convert);
  },
};
