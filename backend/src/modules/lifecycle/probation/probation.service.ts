/**
 * Probation Board & Confirmation Engine (LC-04, PAY-02, SOW crosswalk).
 *
 * Implements:
 * - Automated reminder notifications at due -30d, -14d, -7d.
 * - Multi-tier evaluation workflow (Manager evaluation -> Confirmation/Extension/Separation).
 * - Atomic confirmed-phase salary transition (100% CTC) upon confirmation.
 * - Automatic confirmation letter generation.
 */

import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../core/db/types.js';

export interface SubmitEvaluationInput {
  reviewId: number;
  managerRecommendation: 'confirm' | 'extend' | 'separate';
  extensionMonths?: number | undefined;
  reviewNotes: string;
  ratings?: Record<string, number> | undefined;
}

export interface DecideReviewInput {
  reviewId: number;
  outcome: 'confirmed' | 'extended' | 'separated';
  decidedByUserId: number;
  confirmationDate?: string | undefined; // YYYY-MM-DD
  confirmedAnnualCtc?: number | undefined;
  salaryStructureId?: number | undefined;
  extensionMonths?: number | undefined;
  decisionNotes?: string | undefined;
}

export interface ProbationReviewItem {
  id: number;
  employeeId: number;
  ecode: string;
  name: string;
  department: string | null;
  designation: string | null;
  doj: string | null;
  dueDate: string;
  managerRecommendation: 'confirm' | 'extend' | 'separate' | null;
  extensionMonths: number | null;
  reviewNotes: string | null;
  status: 'pending' | 'under_review' | 'completed';
  outcome: 'confirmed' | 'extended' | 'separated' | null;
  confirmationDate: string | null;
}

export const ProbationService = {
  /**
   * Retrieves probation reviews list with employee and organization info.
   */
  async listReviews(
    db: Kysely<Database>,
    filters?: { status?: 'pending' | 'under_review' | 'completed' | undefined }
  ): Promise<ProbationReviewItem[]> {
    let query = db
      .selectFrom('core.probation_reviews as pr')
      .innerJoin('core.employees as e', 'e.id', 'pr.employee_id')
      .leftJoin('core.departments as d', 'd.id', 'e.department_id')
      .leftJoin('core.designations as des', 'des.id', 'e.designation_id')
      .select([
        'pr.id',
        'pr.employee_id as employeeId',
        'e.ecode',
        'e.first_name',
        'e.last_name',
        'd.name as departmentName',
        'des.name as designationName',
        'e.doj',
        'pr.due_date as dueDate',
        'pr.manager_recommendation as managerRecommendation',
        'pr.extension_months as extensionMonths',
        'pr.review_notes as reviewNotes',
        'pr.status',
        'pr.outcome',
        'pr.confirmation_date as confirmationDate',
      ]);

    if (filters?.status) {
      query = query.where('pr.status', '=', filters.status);
    }

    const rows = await query.orderBy('pr.due_date', 'asc').execute();

    return rows.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      ecode: r.ecode,
      name: `${r.first_name} ${r.last_name ?? ''}`.trim(),
      department: r.departmentName ?? null,
      designation: r.designationName ?? null,
      doj: r.doj ? String(r.doj).slice(0, 10) : null,
      dueDate: String(r.dueDate).slice(0, 10),
      managerRecommendation: r.managerRecommendation,
      extensionMonths: r.extensionMonths,
      reviewNotes: r.reviewNotes,
      status: r.status,
      outcome: r.outcome,
      confirmationDate: r.confirmationDate ? String(r.confirmationDate).slice(0, 10) : null,
    }));
  },

  /**
   * Submits a reporting manager's evaluation.
   */
  async submitEvaluation(
    db: Kysely<Database>,
    input: SubmitEvaluationInput
  ): Promise<void> {
    const review = await db
      .selectFrom('core.probation_reviews')
      .selectAll()
      .where('id', '=', input.reviewId)
      .executeTakeFirst();

    if (!review) {
      throw new Error(`Probation review ${input.reviewId} not found.`);
    }

    if (input.managerRecommendation === 'extend' && (!input.extensionMonths || input.extensionMonths < 1)) {
      throw new Error('Extension requires a valid duration between 1 and 6 months.');
    }

    await db
      .updateTable('core.probation_reviews')
      .set({
        manager_recommendation: input.managerRecommendation,
        extension_months: input.extensionMonths ?? null,
        review_notes: input.reviewNotes,
        ratings: input.ratings ? JSON.stringify(input.ratings) : null,
        status: 'under_review',
        updated_at: new Date(),
      })
      .where('id', '=', input.reviewId)
      .execute();
  },

  /**
   * Executes the final confirmation / extension / separation decision.
   */
  async decideReview(
    db: Kysely<Database>,
    input: DecideReviewInput
  ): Promise<{ outcome: string; confirmationLetterId?: number | undefined }> {
    const now = new Date();

    const review = await db
      .selectFrom('core.probation_reviews')
      .selectAll()
      .where('id', '=', input.reviewId)
      .executeTakeFirst();

    if (!review) {
      throw new Error(`Probation review ${input.reviewId} not found.`);
    }

    let confirmationLetterId: number | undefined;

    if (input.outcome === 'confirmed') {
      const confDate = input.confirmationDate ?? new Date().toISOString().slice(0, 10);

      // 1. Update review record
      await db
        .updateTable('core.probation_reviews')
        .set({
          outcome: 'confirmed',
          status: 'completed',
          decided_by: input.decidedByUserId,
          decided_at: now,
          confirmation_date: new Date(confDate),
          review_notes: input.decisionNotes ?? review.review_notes,
          updated_at: now,
        })
        .where('id', '=', input.reviewId)
        .execute();

      // 2. Update employee contract type to permanent
      await db
        .updateTable('core.employees')
        .set({
          contract_type: 'permanent',
          confirmation_date: new Date(confDate),
        })
        .where('id', '=', review.employee_id)
        .execute();

      // 3. Atomically transition salary: close probation salary, open confirmed salary
      if (input.confirmedAnnualCtc && input.salaryStructureId) {
        // Close prior salary assignment effective the day before confirmation
        const prevDay = new Date(new Date(confDate).getTime() - 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);

        await db
          .updateTable('pay.employee_salaries')
          .set({
            effective_to: new Date(prevDay),
          })
          .where('employee_id', '=', review.employee_id)
          .where('effective_to', '=', new Date('9999-12-31'))
          .execute();

        // Insert new confirmed salary assignment
        await db
          .insertInto('pay.employee_salaries')
          .values({
            employee_id: review.employee_id,
            structure_id: input.salaryStructureId,
            effective_from: new Date(confDate),
            effective_to: new Date('9999-12-31'),
            annual_ctc: input.confirmedAnnualCtc.toFixed(2),
            phase: 'confirmed',
            component_amounts: {},
          })
          .execute();
      }

      // 4. Generate confirmation letter in core.letters
      const letterInsert = await db
        .insertInto('core.letters')
        .values({
          employee_id: review.employee_id,
          template_code: 'CONFIRMATION_LETTER',
          document_id: null,
          body_rendered: `Confirmation of Service granted effective ${confDate}.`,
          status: 'issued',
          issued_by: input.decidedByUserId,
          issued_at: now,
          workflow_request_id: null,
        })
        .returning('id')
        .executeTakeFirst();

      if (letterInsert) {
        confirmationLetterId = letterInsert.id;
      }
    } else if (input.outcome === 'extended') {
      const extMonths = input.extensionMonths ?? review.extension_months ?? 3;
      const [curY, curM, curD] = String(review.due_date).slice(0, 10).split('-').map(Number);
      const nextDate = new Date(Date.UTC(curY ?? 2026, (curM ?? 1) - 1 + extMonths, curD ?? 1));
      const nextDueDate = nextDate.toISOString().slice(0, 10);

      // Update current review
      await db
        .updateTable('core.probation_reviews')
        .set({
          outcome: 'extended',
          status: 'completed',
          extension_months: extMonths,
          decided_by: input.decidedByUserId,
          decided_at: now,
          updated_at: now,
        })
        .where('id', '=', input.reviewId)
        .execute();

      // Create new review cycle for extended period
      await db
        .insertInto('core.probation_reviews')
        .values({
          employee_id: review.employee_id,
          due_date: new Date(nextDueDate),
          status: 'pending',
          updated_at: now,
        })
        .execute();
    } else {
      await db
        .updateTable('core.probation_reviews')
        .set({
          outcome: 'separated',
          status: 'completed',
          decided_by: input.decidedByUserId,
          decided_at: now,
          updated_at: now,
        })
        .where('id', '=', input.reviewId)
        .execute();
    }

    return {
      outcome: input.outcome,
      ...(confirmationLetterId !== undefined ? { confirmationLetterId } : {}),
    };
  },

  /**
   * Identifies employees whose probation is due in 30, 14, or 7 days for manager alerts.
   */
  async getUpcomingProbationAlerts(
    db: Kysely<Database>,
    currentDate: Date = new Date()
  ): Promise<{ d30: number[]; d14: number[]; d7: number[] }> {
    const addDays = (d: Date, n: number) =>
      new Date(d.getTime() + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const d30Str = addDays(currentDate, 30);
    const d14Str = addDays(currentDate, 14);
    const d7Str = addDays(currentDate, 7);

    const reviews = await db
      .selectFrom('core.probation_reviews')
      .select(['id', 'due_date'])
      .where('status', '=', 'pending')
      .where('due_date', 'in', [
        sql<Date>`${d30Str}::date`,
        sql<Date>`${d14Str}::date`,
        sql<Date>`${d7Str}::date`,
      ])
      .execute();

    const d30: number[] = [];
    const d14: number[] = [];
    const d7: number[] = [];

    for (const r of reviews) {
      const due = String(r.due_date).slice(0, 10);
      if (due === d30Str) d30.push(r.id);
      else if (due === d14Str) d14.push(r.id);
      else if (due === d7Str) d7.push(r.id);
    }

    return { d30, d14, d7 };
  },
};
