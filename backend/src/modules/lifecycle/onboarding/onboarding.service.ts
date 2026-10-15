/**
 * ATS Onboarding Bridge & Conversion Wizard (LC-01, SOW crosswalk).
 *
 * Implements:
 * - Candidate intake from ATS / LOI into core.onboarding_candidates.
 * - Duplicate checks against employee master.
 * - Atomic HR Conversion Wizard: ecode generation, core.employees creation,
 *   initial probation salary row creation, and stakeholder task fan-out.
 */

import type { Kysely } from 'kysely';
import type { Database, EmploymentCategory } from '../../../core/db/types.js';
import { allocateEmployeeCode } from '../../../core/employee-code.js';
import { PrejoinService, type PrejoinSubmissionData } from './prejoin.service.js';
import { TaskFanoutService } from './task-fanout.service.js';

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
  offeredCtc: number;
  probationMonths?: number | undefined;
  probationSalaryPct?: number | undefined;
  proposedDoj: string;
  offerDate: string;
  workLocation?: string | null | undefined;
}

export interface ConvertCandidateInput {
  candidateId: number;
  companyId: number;
  designationId: number;
  departmentId: number;
  locationId: number;
  orgUnitId?: number | null | undefined;
  gradeId?: number | null | undefined;
  reportingManagerId?: number | null | undefined;
  workEmail?: string | null | undefined;
  doj: string;
  salaryStructureId?: number | null | undefined;
}

export interface DuplicateCheckResult {
  hasDuplicate: boolean;
  duplicateField?: string | undefined;
  existingEcode?: string | undefined;
  existingName?: string | undefined;
}

function parsePrejoinData(raw: unknown): Partial<PrejoinSubmissionData> {
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
      return {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && raw !== null) {
    return raw;
  }
  return {};
}

export const OnboardingService = {
  /**
   * Ingests a new accepted candidate from ATS or LOI.
   */
  async ingestCandidate(
    db: Kysely<Database>,
    input: IngestCandidateInput
  ): Promise<{ candidateId: number; rawToken: string; expiresAt: Date }> {
    const tokenData = PrejoinService.generateToken();

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
        prejoin_link_token: tokenData.rawToken,
        prejoin_token_hash: tokenData.tokenHash,
        prejoin_token_expires_at: tokenData.expiresAt,
        prejoin_link_sent_at: new Date(),
        status: 'link_sent',
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
    pan?: string | null
  ): Promise<DuplicateCheckResult> {
    const cleanEmail = email.toLowerCase().trim();
    const cleanMobile = mobile.trim();

    // Check personal or work email
    const emailMatch = await db
      .selectFrom('core.employees')
      .select(['ecode', 'first_name', 'last_name', 'personal_email', 'work_email'])
      .where((eb) =>
        eb.or([
          eb('personal_email', '=', cleanEmail),
          eb('work_email', '=', cleanEmail),
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
      .selectFrom('core.employees')
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
        .selectFrom('core.employees')
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
    input: ConvertCandidateInput
  ): Promise<{ employeeId: number; ecode: string }> {
    const candidate = await db
      .selectFrom('core.onboarding_candidates')
      .selectAll()
      .where('id', '=', input.candidateId)
      .executeTakeFirst();

    if (!candidate) {
      throw new Error(`Candidate with id ${input.candidateId} not found.`);
    }

    if (candidate.status === 'converted') {
      throw new Error(`Candidate ${candidate.full_name} is already converted.`);
    }

    // Extract pre-join submitted data if available
    const prejoinData = parsePrejoinData(candidate.prejoin_submitted_data);

    // Run duplicate check
    const dup = await this.checkDuplicate(
      db,
      candidate.personal_email,
      candidate.mobile,
      prejoinData.pan
    );
    if (dup.hasDuplicate) {
      throw new Error(
        `Duplicate candidate detected! Matched existing employee ${dup.existingEcode} (${dup.existingName}) on ${dup.duplicateField}.`
      );
    }

    // Generate ecode
    const ecode = await this.generateEcode(db, input.companyId);

    // Split name into first and last name
    const nameParts = candidate.full_name.trim().split(/\s+/);
    const firstName = nameParts[0] ?? candidate.full_name;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

    const workEmail = input.workEmail
      ? input.workEmail.toLowerCase().trim()
      : `${ecode.toLowerCase()}@rashmigroup.com`;

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
        present_address: prejoinData.presentAddress ?? candidate.address ?? null,
        permanent_address: prejoinData.permanentAddress ?? candidate.address ?? null,
        emergency_contact_name: prejoinData.emergencyContactName ?? null,
        emergency_contact_phone: prejoinData.emergencyContactPhone ?? null,
        blood_group: prejoinData.bloodGroup ?? null,
        category: candidate.category,
        contract_type: 'probationary',
        doj: new Date(input.doj),
        status: 'active',
        designation_id: input.designationId,
        department_id: input.departmentId,
        location_id: input.locationId,
        org_unit_id: input.orgUnitId ?? null,
        grade_id: input.gradeId ?? null,
        reporting_manager_id: input.reportingManagerId ?? null,
        pan: prejoinData.pan ? prejoinData.pan.toUpperCase().trim() : null,
        aadhaar: prejoinData.aadhaar ? prejoinData.aadhaar.trim() : null,
        uan: prejoinData.uan ? prejoinData.uan.trim() : null,
        bank_name: prejoinData.bankName ?? null,
        bank_account: prejoinData.bankAccount ?? null,
        bank_ifsc: prejoinData.bankIfsc ? prejoinData.bankIfsc.toUpperCase().trim() : null,
        payment_mode: 'bank',
        biometric_registered: false,
        attendance_mode: 'biometric',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const employeeId = empInsert.id;

    // 2. Create core.users login record
    await db
      .insertInto('core.users')
      .values({
        email: workEmail,
        password_hash: 'PENDING_INITIAL_LOGIN',
        employee_id: employeeId,
        is_active: true,
      })
      .execute();

    // 3. Create initial probation salary record if structure provided
    if (input.salaryStructureId) {
      const probationPct = candidate.probation_salary_pct ?? 100;
      const offeredCtcNum = Number(candidate.offered_ctc);
      const probationCtc = (offeredCtcNum * probationPct) / 100;

      await db
        .insertInto('pay.employee_salaries')
        .values({
          employee_id: employeeId,
          structure_id: input.salaryStructureId,
          effective_from: new Date(input.doj),
          effective_to: new Date('9999-12-31'),
          annual_ctc: probationCtc.toFixed(2),
          phase: 'probation',
          component_amounts: {},
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

    // 6. Initialize probation review record
    const probationMonths = candidate.probation_months ?? 6;
    const [dojY, dojM, dojD] = input.doj.split('-').map(Number);
    const dueDate = new Date(Date.UTC(dojY ?? 2026, (dojM ?? 1) - 1 + probationMonths, dojD ?? 1))
      .toISOString()
      .slice(0, 10);
    await db
      .insertInto('core.probation_reviews')
      .values({
        employee_id: employeeId,
        due_date: new Date(dueDate),
        status: 'pending',
        updated_at: new Date(),
      })
      .execute();

    return {
      employeeId,
      ecode,
    };
  },
};
