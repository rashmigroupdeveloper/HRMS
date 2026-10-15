/**
 * Probation Board & Confirmation Router (LC-04, PAY-02, SOW crosswalk).
 *
 * Exposes procedures for:
 * - Listing probation reviews with status filters.
 * - Submitting Reporting Manager evaluations (confirm/extend/separate).
 * - Deciding review outcomes, transitioning salary phase (100% CTC), and issuing letters.
 * - Retrieving upcoming probation alerts (due in 30, 14, 7 days).
 */

import { z } from 'zod';
import { withPermission } from '../../../api/orpc.js';
import { ProbationService } from './probation.service.js';

export const probationRouter = {
  // List probation reviews
  listReviews: withPermission('lifecycle.confirmation.approve')
    .route({ method: 'GET', path: '/lifecycle/probation/reviews', summary: 'List probation reviews' })
    .input(
      z.object({
        status: z.enum(['pending', 'under_review', 'completed']).optional(),
      }).optional()
    )
    .output(
      z.object({
        reviews: z.array(
          z.object({
            id: z.number(),
            employeeId: z.number(),
            ecode: z.string(),
            name: z.string(),
            department: z.string().nullable(),
            designation: z.string().nullable(),
            doj: z.string().nullable(),
            dueDate: z.string(),
            managerRecommendation: z.enum(['confirm', 'extend', 'separate']).nullable(),
            extensionMonths: z.number().nullable(),
            reviewNotes: z.string().nullable(),
            status: z.enum(['pending', 'under_review', 'completed']),
            outcome: z.enum(['confirmed', 'extended', 'separated']).nullable(),
            confirmationDate: z.string().nullable(),
          })
        ),
      })
    )
    .handler(async ({ context, input }) => {
      const reviews = await ProbationService.listReviews(context.db, { status: input?.status });
      return { reviews };
    }),

  // Submit Manager Evaluation
  submitEvaluation: withPermission('lifecycle.confirmation.approve')
    .route({ method: 'POST', path: '/lifecycle/probation/evaluate', summary: 'Submit manager probation evaluation' })
    .input(
      z.object({
        reviewId: z.number(),
        managerRecommendation: z.enum(['confirm', 'extend', 'separate']),
        extensionMonths: z.number().min(1).max(6).optional(),
        reviewNotes: z.string().min(5),
        ratings: z.record(z.string(), z.number()).optional(),
      })
    )
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ context, input }) => {
      await ProbationService.submitEvaluation(context.db, input);
      return { success: true };
    }),

  // Execute Confirmation / Extension / Separation Decision
  decideReview: withPermission('lifecycle.confirmation.approve')
    .route({ method: 'POST', path: '/lifecycle/probation/decide', summary: 'Execute probation decision and confirmed salary transition' })
    .input(
      z.object({
        reviewId: z.number(),
        outcome: z.enum(['confirmed', 'extended', 'separated']),
        confirmationDate: z.string().optional(),
        confirmedAnnualCtc: z.number().optional(),
        salaryStructureId: z.number().optional(),
        extensionMonths: z.number().optional(),
        decisionNotes: z.string().optional(),
      })
    )
    .output(
      z.object({
        outcome: z.string(),
        confirmationLetterId: z.number().optional(),
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.user.id;
      return ProbationService.decideReview(context.db, {
        ...input,
        decidedByUserId: userId,
      });
    }),

  // Upcoming Due Reminders (30d, 14d, 7d)
  getUpcomingAlerts: withPermission('lifecycle.confirmation.approve')
    .route({ method: 'GET', path: '/lifecycle/probation/alerts', summary: 'Get upcoming probation reviews due in 30, 14, 7 days' })
    .input(z.object({ referenceDate: z.string().optional() }).optional())
    .output(
      z.object({
        d30ReviewIds: z.array(z.number()),
        d14ReviewIds: z.array(z.number()),
        d7ReviewIds: z.array(z.number()),
      })
    )
    .handler(async ({ context, input }) => {
      const refDate = input?.referenceDate ? new Date(input.referenceDate) : new Date();
      const res = await ProbationService.getUpcomingProbationAlerts(context.db, refDate);
      return {
        d30ReviewIds: res.d30,
        d14ReviewIds: res.d14,
        d7ReviewIds: res.d7,
      };
    }),
};
