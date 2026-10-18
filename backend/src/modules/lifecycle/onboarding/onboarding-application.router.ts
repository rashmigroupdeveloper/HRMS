/** LC-01/CORE-10: HR can review submitted profile data without gaining unmasked statutory authority. */
import { z } from 'zod';
import { ORPCError } from '@orpc/server';
import { withPermission } from '../../../api/orpc.js';
import { companyScopeSql } from '../../../core/rbac/company-scope.js';
import { readCompletedApplication } from './joining-validation.js';
export const onboardingApplicationRouter = {
  reviewApplication: withPermission('lifecycle.onboard.convert')
    .route({
      method: 'GET',
      path: '/lifecycle/candidates/{candidateId}/application',
      summary:
        'Review a scoped submitted candidate application; statutory and bank values withheld',
    })
    .input(z.object({ candidateId: z.number().int().positive() }))
    .output(
      z.object({
        candidateId: z.number(),
        submittedAt: z.string(),
        profile: z.object({
          presentAddress: z.string(),
          permanentAddress: z.string(),
          emergencyContactName: z.string(),
          emergencyContactPhone: z.string(),
          emergencyContactRelation: z.string(),
          bloodGroup: z.string().nullable(),
          panProvided: z.boolean(),
          aadhaarProvided: z.boolean(),
          uanProvided: z.boolean(),
          bankDetailsProvided: z.boolean(),
        }),
      }),
    )
    .handler(async ({ context, input }) => {
      const candidate = await context.db
        .selectFrom('core.onboarding_candidates as c')
        .select(['c.id', 'c.status', 'c.prejoin_completed_at', 'c.prejoin_submitted_data'])
        .where('c.id', '=', input.candidateId)
        .where(
          companyScopeSql(
            { ...context.permissionAccess, actorEmployeeId: context.user.employee_id },
            'c.company_id',
          ),
        )
        .executeTakeFirst();
      if (!candidate)
        throw new ORPCError('NOT_FOUND', {
          message: 'Candidate application not available in your permitted population',
        });
      if (
        !['prejoin_done', 'converted'].includes(candidate.status) ||
        !candidate.prejoin_completed_at
      )
        throw new ORPCError('BAD_REQUEST', {
          message: 'The candidate has not submitted a completed application',
        });
      let data;
      try {
        data = readCompletedApplication(candidate.prejoin_submitted_data);
      } catch {
        throw new ORPCError('BAD_REQUEST', {
          message: 'The submitted application needs correction before HR review',
        });
      }
      return {
        candidateId: candidate.id,
        submittedAt: new Date(candidate.prejoin_completed_at).toISOString(),
        profile: {
          presentAddress: data.presentAddress,
          permanentAddress: data.permanentAddress,
          emergencyContactName: data.emergencyContactName,
          emergencyContactPhone: data.emergencyContactPhone,
          emergencyContactRelation: data.emergencyContactRelation,
          bloodGroup: data.bloodGroup ?? null,
          panProvided: data.pan.length > 0,
          aadhaarProvided: data.aadhaar.length > 0,
          uanProvided: Boolean(data.uan?.trim()),
          bankDetailsProvided: Boolean(data.bankName && data.bankAccount && data.bankIfsc),
        },
      };
    }),
};
