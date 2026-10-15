/**
 * Onboarding Bridge Router (LC-01, LC-02, SOW crosswalk, SOW crosswalk).
 *
 * Exposes procedures for:
 * - Public Pre-join portal (token validation & data submission).
 * - ATS / LOI candidate ingestion.
 * - Duplicate checks & HR Conversion Wizard.
 * - Stakeholder onboarding tasks & Kent biometric verification.
 */

import { z } from 'zod';
import { ORPCError } from '@orpc/server';
import { base, withPermission } from '../../../api/orpc.js';
import { OnboardingService } from './onboarding.service.js';
import { PrejoinService } from './prejoin.service.js';
import { TaskFanoutService } from './task-fanout.service.js';

const PrejoinSubmissionSchema = z.object({
  presentAddress: z.string().min(5),
  permanentAddress: z.string().min(5),
  emergencyContactName: z.string().min(2),
  emergencyContactPhone: z.string().min(10),
  emergencyContactRelation: z.string().min(2),
  pan: z.string().length(10),
  aadhaar: z.string().length(12),
  uan: z.string().optional(),
  bankName: z.string().min(2),
  bankAccount: z.string().min(8),
  bankIfsc: z.string().length(11),
  bloodGroup: z.string().optional(),
});

export const onboardingRouter = {
  // Public Pre-join Portal: Validate Token
  validatePrejoinToken: base
    .route({ method: 'GET', path: '/lifecycle/prejoin/validate', summary: 'Validate candidate pre-join link token' })
    .input(z.object({ token: z.string() }))
    .output(
      z.object({
        isValid: z.boolean(),
        candidateId: z.number().optional(),
        candidateName: z.string().optional(),
        positionTitle: z.string().optional(),
        error: z.string().optional(),
      })
    )
    .handler(async ({ context, input }) => {
      if (!context.db) throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'Database unavailable' });
      const result = await PrejoinService.validateToken(context.db, input.token);
      if (!result.isValid || !result.candidateId) {
        return {
          isValid: false,
          error: result.error,
        };
      }

      const candidate = await context.db
        .selectFrom('core.onboarding_candidates')
        .select(['full_name', 'position_title'])
        .where('id', '=', result.candidateId)
        .executeTakeFirst();

      return {
        isValid: true,
        candidateId: result.candidateId,
        candidateName: candidate?.full_name,
        positionTitle: candidate?.position_title,
      };
    }),

  // Public Pre-join Portal: Submit Profile & Statutory Data
  submitPrejoin: base
    .route({ method: 'POST', path: '/lifecycle/prejoin/submit', summary: 'Submit pre-join details by candidate' })
    .input(
      z.object({
        token: z.string(),
        data: PrejoinSubmissionSchema,
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        candidateId: z.number(),
      })
    )
    .handler(async ({ context, input }) => {
      if (!context.db) throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'Database unavailable' });
      return PrejoinService.submitPrejoinData(context.db, input.token, input.data);
    }),

  // Admin / Recruiter: Ingest ATS candidate
  ingestCandidate: withPermission('lifecycle.onboard.convert')
    .route({ method: 'POST', path: '/lifecycle/candidates/ingest', summary: 'Ingest candidate from ATS/LOI' })
    .input(
      z.object({
        atsCandidateId: z.number().optional(),
        loiReference: z.string().optional(),
        fullName: z.string(),
        personalEmail: z.string().email(),
        mobile: z.string(),
        dob: z.string().optional(),
        address: z.string().optional(),
        totalExperienceYears: z.number().optional(),
        previousCompany: z.string().optional(),
        currentSalary: z.number().optional(),
        expectedSalary: z.number().optional(),
        positionTitle: z.string(),
        department: z.string().optional(),
        orgUnit: z.string().optional(),
        designation: z.string().optional(),
        companyId: z.number().optional(),
        category: z.enum(['white_collar', 'blue_collar', 'trainee', 'consultant', 'contract']).optional(),
        offeredCtc: z.number(),
        probationMonths: z.number().optional(),
        probationSalaryPct: z.number().optional(),
        proposedDoj: z.string(),
        offerDate: z.string(),
        workLocation: z.string().optional(),
      })
    )
    .output(
      z.object({
        candidateId: z.number(),
        rawToken: z.string(),
        expiresAt: z.date(),
      })
    )
    .handler(async ({ context, input }) => {
      return OnboardingService.ingestCandidate(context.db, input);
    }),

  // Admin / HR: List onboarding candidates
  listCandidates: withPermission('lifecycle.onboard.convert')
    .route({ method: 'GET', path: '/lifecycle/candidates', summary: 'List onboarding candidates' })
    .input(
      z.object({
        status: z.enum(['awaiting_prejoin', 'link_sent', 'prejoin_done', 'converted', 'no_show']).optional(),
      }).optional()
    )
    .output(
      z.object({
        candidates: z.array(
          z.object({
            id: z.number(),
            fullName: z.string(),
            personalEmail: z.string(),
            mobile: z.string(),
            positionTitle: z.string(),
            department: z.string().nullable(),
            companyId: z.number().nullable(),
            offeredCtc: z.string(),
            proposedDoj: z.string(),
            status: z.string(),
            prejoinCompletedAt: z.string().nullable(),
            employeeId: z.number().nullable(),
            hasPrejoinData: z.boolean(),
          })
        ),
      })
    )
    .handler(async ({ context, input }) => {
      let query = context.db.selectFrom('core.onboarding_candidates').selectAll();
      if (input?.status) {
        query = query.where('status', '=', input.status);
      }
      const rows = await query.orderBy('created_at', 'desc').execute();

      return {
        candidates: rows.map((r) => ({
          id: r.id,
          fullName: r.full_name,
          personalEmail: r.personal_email,
          mobile: r.mobile,
          positionTitle: r.position_title,
          department: r.department,
          companyId: r.company_id,
          offeredCtc: r.offered_ctc,
          proposedDoj: String(r.proposed_doj).slice(0, 10),
          status: r.status,
          prejoinCompletedAt: r.prejoin_completed_at ? String(r.prejoin_completed_at) : null,
          employeeId: r.employee_id,
          hasPrejoinData: r.prejoin_submitted_data !== null && r.prejoin_submitted_data !== undefined,
        })),
      };
    }),

  // HR Conversion Wizard: Check duplicate
  checkDuplicate: withPermission('lifecycle.onboard.convert')
    .route({ method: 'POST', path: '/lifecycle/candidates/check-duplicate', summary: 'Check duplicate candidate in master' })
    .input(
      z.object({
        email: z.string(),
        mobile: z.string(),
        pan: z.string().optional(),
      })
    )
    .output(
      z.object({
        hasDuplicate: z.boolean(),
        duplicateField: z.string().optional(),
        existingEcode: z.string().optional(),
        existingName: z.string().optional(),
      })
    )
    .handler(async ({ context, input }) => {
      return OnboardingService.checkDuplicate(context.db, input.email, input.mobile, input.pan);
    }),

  // HR Conversion Wizard: Convert candidate to employee
  convertCandidate: withPermission('lifecycle.onboard.convert')
    .route({ method: 'POST', path: '/lifecycle/candidates/convert', summary: 'Convert candidate to employee' })
    .input(
      z.object({
        candidateId: z.number(),
        companyId: z.number(),
        designationId: z.number(),
        departmentId: z.number(),
        locationId: z.number(),
        orgUnitId: z.number().optional(),
        gradeId: z.number().optional(),
        reportingManagerId: z.number().optional(),
        workEmail: z.string().optional(),
        doj: z.string(),
        salaryStructureId: z.number().optional(),
      })
    )
    .output(
      z.object({
        employeeId: z.number(),
        ecode: z.string(),
      })
    )
    .handler(async ({ context, input }) => {
      return OnboardingService.convertCandidate(context.db, input);
    }),

  // Stakeholder Onboarding Tasks: List tasks
  listTasks: withPermission('lifecycle.onboard.convert')
    .route({ method: 'GET', path: '/lifecycle/tasks', summary: 'List onboarding stakeholder tasks' })
    .input(
      z.object({
        employeeId: z.number().optional(),
        status: z.enum(['open', 'completed', 'escalated']).optional(),
        department: z.enum(['IT', 'Admin', 'HR', 'Payroll']).optional(),
      }).optional()
    )
    .output(
      z.object({
        tasks: z.array(
          z.object({
            id: z.number(),
            employeeId: z.number(),
            ecode: z.string(),
            employeeName: z.string(),
            taskCode: z.string(),
            taskName: z.string(),
            department: z.string(),
            ownerRole: z.string(),
            dueDate: z.string(),
            slaHours: z.number(),
            status: z.string(),
            notes: z.string().nullable(),
          })
        ),
      })
    )
    .handler(async ({ context, input }) => {
      let query = context.db
        .selectFrom('core.onboarding_tasks as t')
        .innerJoin('core.employees as e', 'e.id', 't.employee_id')
        .select([
          't.id',
          't.employee_id as employeeId',
          'e.ecode',
          'e.first_name',
          'e.last_name',
          't.task_code as taskCode',
          't.task_name as taskName',
          't.department',
          't.owner_role as ownerRole',
          't.due_date as dueDate',
          't.sla_hours as slaHours',
          't.status',
          't.notes',
        ]);

      if (input?.employeeId) {
        query = query.where('t.employee_id', '=', input.employeeId);
      }
      if (input?.status) {
        query = query.where('t.status', '=', input.status);
      }
      if (input?.department) {
        query = query.where('t.department', '=', input.department);
      }

      const rows = await query.orderBy('t.due_date', 'asc').execute();

      return {
        tasks: rows.map((r) => ({
          id: r.id,
          employeeId: r.employeeId,
          ecode: r.ecode,
          employeeName: `${r.first_name} ${r.last_name ?? ''}`.trim(),
          taskCode: r.taskCode,
          taskName: r.taskName,
          department: r.department,
          ownerRole: r.ownerRole,
          dueDate: String(r.dueDate).slice(0, 10),
          slaHours: r.slaHours,
          status: r.status,
          notes: r.notes,
        })),
      };
    }),

  // Complete Onboarding Task
  completeTask: withPermission('lifecycle.onboard.convert')
    .route({ method: 'POST', path: '/lifecycle/tasks/complete', summary: 'Mark onboarding task completed' })
    .input(
      z.object({
        taskId: z.number(),
        notes: z.string().optional(),
      })
    )
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ context, input }) => {
      const userId = context.user.id;
      await TaskFanoutService.completeTask(context.db, input.taskId, userId, input.notes);
      return { success: true };
    }),

  // Verify Kent Biometric Registration
  verifyBiometric: withPermission('lifecycle.onboard.convert')
    .route({ method: 'POST', path: '/lifecycle/biometric/verify', summary: 'Verify Kent biometric registration' })
    .input(z.object({ employeeId: z.number() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ context, input }) => {
      const userId = context.user.id;
      await TaskFanoutService.verifyBiometricRegistration(context.db, input.employeeId, userId);
      return { success: true };
    }),
};
