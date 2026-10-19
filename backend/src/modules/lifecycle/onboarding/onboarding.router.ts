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
import { prejoinLinkRouter } from './prejoin-link.router.js';
import { ORPCError } from '@orpc/server';
import { base, withPermission } from '../../../api/orpc.js';
import { OnboardingService } from './onboarding.service.js';
import { PrejoinService, PrejoinInputError, PrejoinConfigurationError } from './prejoin.service.js';
import { PrejoinSubmissionSchema } from './prejoin-schema.js';
import { onboardingApplicationRouter } from './onboarding-application.router.js';
import { onboardingReferenceData } from './onboarding-reference.js';
import { companyScopeSql, assertCompanyInScope } from '../../../core/rbac/company-scope.js';
import { formatDbDate } from '../../../core/dates.js';
import { employeeScopeSql, assertEmployeesInScope } from '../../../core/rbac/employee-scope.js';
import { TaskFanoutService, KentEnrollmentUnavailable } from './task-fanout.service.js';
import { offerPayloadSchema, submitOffer } from '../offers/offer.service.js';



const referenceOption = z.object({id:z.number(),name:z.string()});
export const onboardingRouter = {
  ...onboardingApplicationRouter,
  ...prejoinLinkRouter,
  referenceData: withPermission('lifecycle.onboard.convert')
    .route({method:'GET',path:'/lifecycle/onboarding-reference-data',summary:'Scoped legal-entity prefixes and real onboarding master choices'})
    .input(z.object({companyId:z.number().int().positive().optional()}).optional())
    .output(z.object({companies:z.array(referenceOption.extend({ecodePrefix:z.string()})),departments:z.array(referenceOption),designations:z.array(referenceOption),orgUnits:z.array(referenceOption),locations:z.array(referenceOption),salaryStructures:z.array(referenceOption)}))
    .handler(async ({context,input}) => {
      try { return await onboardingReferenceData(context.db,{...context.permissionAccess,actorEmployeeId:context.user.employee_id},input?.companyId); }
      catch(cause) { if(cause instanceof Error && cause.message.includes('permitted data scope')) throw new ORPCError('FORBIDDEN',{message:cause.message}); throw cause; }
    }),
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
        category: z.string().optional(),
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
        .select(['full_name', 'position_title', 'category'])
        .where('id', '=', result.candidateId)
        .executeTakeFirst();

      return {
        isValid: true,
        candidateId: result.candidateId,
        candidateName: candidate?.full_name,
        positionTitle: candidate?.position_title,
        category: candidate?.category,
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
      try {return await PrejoinService.submitPrejoinData(context.db,input.token,input.data);}
      catch(cause){if(cause instanceof PrejoinInputError) throw new ORPCError('BAD_REQUEST',{message:cause.message});throw cause;}
    }),

  // Admin / Recruiter: Ingest ATS candidate
  ingestCandidate: withPermission('lifecycle.onboard.convert')
    .route({ method: 'POST', path: '/lifecycle/candidates/ingest', summary: 'Ingest candidate from ATS/LOI' })
    .input(
      z.object({
        atsCandidateId: z.number().optional(),
        loiReference: z.string().optional(),
        fullName: z.string().trim().min(1),
        personalEmail: z.string().email(),
        mobile: z.string().trim().min(10),
        dob: z.string().date().optional(),
        address: z.string().optional(),
        totalExperienceYears: z.number().optional(),
        previousCompany: z.string().optional(),
        currentSalary: z.number().optional(),
        expectedSalary: z.number().optional(),
        positionTitle: z.string().trim().min(1),
        department: z.string().optional(),
        orgUnit: z.string().optional(),
        designation: z.string().optional(),
        companyId: z.number().int().positive(),
        category: z.enum(['white_collar', 'blue_collar', 'trainee', 'consultant', 'contract']).optional(),
        offeredCtc: z.number().finite().nonnegative(),
        probationMonths: z.number().int().positive().optional(),
        probationSalaryPct: z.number().int().positive().max(100).optional(),
        proposedDoj: z.string().date(),
        offerDate: z.string().date(),
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
      if (!input.companyId) throw new ORPCError('BAD_REQUEST',{message:'Select the accepted employing company'});
      try { await assertCompanyInScope(context.db,{...context.permissionAccess,actorEmployeeId:context.user.employee_id},input.companyId); }
      catch { throw new ORPCError('FORBIDDEN',{message:'Company outside your permitted data scope'}); }
      try {return await OnboardingService.ingestCandidate(context.db,input);}
      catch(cause){if(cause instanceof PrejoinConfigurationError) throw new ORPCError('SERVICE_UNAVAILABLE',{message:cause.message});throw cause;}
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
      let query = context.db.selectFrom('core.onboarding_candidates as candidate').selectAll('candidate')
        .where(companyScopeSql({...context.permissionAccess,actorEmployeeId:context.user.employee_id},'candidate.company_id'));
      if (input?.status) {
        query = query.where('candidate.status', '=', input.status);
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
          proposedDoj: formatDbDate(r.proposed_doj),
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
      return OnboardingService.checkDuplicate(context.db, input.email, input.mobile, input.pan, {...context.permissionAccess,actorEmployeeId:context.user.employee_id});
    }),

  // HR Conversion Wizard: Convert candidate to employee
  convertCandidate: withPermission('lifecycle.onboard.convert')
    .route({ method: 'POST', path: '/lifecycle/candidates/convert', summary: 'Convert candidate to employee' })
    .input(
      z.object({
        candidateId: z.number().int().positive(),
        joiningConfirmed: z.literal(true),
        companyId: z.number().int().positive(),
        designationId: z.number().int().positive(),
        departmentId: z.number().int().positive(),
        locationId: z.number().int().positive(),
        orgUnitId: z.number().int().positive(),
        gradeId: z.number().int().positive().optional(),
        reportingManagerId: z.number().int().positive().optional(),
        workEmail: z.string().trim().email().optional(),
        doj: z.string().date(),
        salaryStructureId: z.number().int().positive().optional(),
      })
    )
    .output(
      z.object({
        employeeId: z.number(),
        ecode: z.string(),
      })
    )
    .handler(async ({ context, input }) => {
      try {
        return await OnboardingService.convertCandidate(context.db, input, { userId: context.user.id,
          scope: { ...context.permissionAccess, actorEmployeeId: context.user.employee_id } });
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Conversion could not be completed';
        throw new ORPCError(message.includes('permitted data scope') ? 'FORBIDDEN' : 'BAD_REQUEST', { message });
      }
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
        .where(employeeScopeSql({...context.permissionAccess,actorEmployeeId:context.user.employee_id},'e'))
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
          dueDate: formatDbDate(r.dueDate),
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
      try { await TaskFanoutService.completeTask(context.db, input.taskId, userId, input.notes, {...context.permissionAccess,actorEmployeeId:context.user.employee_id}); }
      catch(cause) {
        if(cause instanceof KentEnrollmentUnavailable) throw new ORPCError('SERVICE_UNAVAILABLE',{message:cause.message});
        if(cause instanceof Error && cause.message.includes('permitted data scope')) throw new ORPCError('FORBIDDEN',{message:cause.message});
        throw cause;
      }
      return { success: true };
    }),

  // Verify Kent Biometric Registration
  verifyBiometric: withPermission('lifecycle.onboard.convert')
    .route({ method: 'POST', path: '/lifecycle/biometric/verify', summary: 'Verify Kent biometric registration' })
    .input(z.object({ employeeId: z.number() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ context, input }) => {
      const userId = context.user.id;
      try {
        await assertEmployeesInScope(context.db,{...context.permissionAccess,actorEmployeeId:context.user.employee_id},[input.employeeId]);
        await TaskFanoutService.verifyBiometricRegistration(context.db, input.employeeId, userId);
      } catch(cause) {
        if(cause instanceof KentEnrollmentUnavailable) throw new ORPCError('SERVICE_UNAVAILABLE',{message:cause.message});
        if(cause instanceof Error && cause.message.includes('permitted data scope')) throw new ORPCError('FORBIDDEN',{message:cause.message});
        throw cause;
      }
      return { success: true };
    }),

  submitOffer: withPermission('lifecycle.onboard.convert')
    .route({ method: 'POST', path: '/lifecycle/offers', summary: 'Draft an offer or LOI and send it for approval (SOW 3.1)' })
    .input(offerPayloadSchema)
    .output(z.object({ requestId: z.number(), letter: z.string() }))
    .handler(async ({ context, input }) => {
      if (context.user.employee_id === null) {
        throw new ORPCError('BAD_REQUEST', { message: 'Your account has no employee profile linked, so the approval chain has no initiator.' });
      }
      try {
        return await submitOffer(context.db, { actorUserId: context.user.id, subjectEmployeeId: context.user.employee_id, input });
      } catch (cause) {
        if (cause instanceof Error && cause.message.includes('does not match')) throw new ORPCError('BAD_REQUEST', { message: cause.message });
        throw cause;
      }
    }),
};
