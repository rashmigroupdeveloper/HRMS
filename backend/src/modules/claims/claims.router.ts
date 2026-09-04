/**
 * Phase 3.5 Stage T1 — the claims API.
 *
 * Two audiences, one module: an employee raising and tracking their own claims
 * (`claims.own`), and an approver clearing them (`claims.approve`). Nothing here
 * settles money into payroll yet — settlement lands with Stage T2 — so the
 * screen shows what genuinely exists and says so, rather than implying a payout
 * path that is not wired.
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { authed, withPermission } from '../../api/orpc.js';
import { paise } from '../../core/money/index.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import {
  approveClaim,
  budgetPosition,
  releaseClaim,
  routeClaimForApproval,
  submitClaim,
} from './claims.service.js';
import { numericToPaise, paiseToNumeric, readHeadroom } from './ledger.service.js';
import { formatDbDate, istDateString } from '../../core/dates.js';

const ISO_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

const budgetOutput = z.object({
  id: z.number().int(),
  reference: z.string(),
  title: z.string(),
  status: z.string(),
  travelType: z.string().nullable(),
  fromLocation: z.string().nullable(),
  toLocation: z.string().nullable(),
  periodFrom: z.string(),
  periodTo: z.string(),
  allowance: z.string(),
  reserved: z.string(),
  remaining: z.string(),
  currency: z.string(),
});

const claimOutput = z.object({
  id: z.number().int(),
  reference: z.string(),
  budgetId: z.number().int().nullable(),
  budgetTitle: z.string().nullable(),
  status: z.string(),
  claimedAmount: z.string(),
  approvedAmount: z.string().nullable(),
  periodFrom: z.string(),
  periodTo: z.string(),
  lineCount: z.number().int(),
  submittedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
});

// pg gives a DATE back as LOCAL midnight; toISOString() would report the
// previous day on any UTC+ server (prod is IST). formatDbDate inverts that.
const iso = formatDbDate;

/* ── The employee's own claims ───────────────────────────────────────────── */

const myBudgets = withPermission('claims.own')
  .route({
    method: 'GET',
    path: '/claims/my/budgets',
    summary: 'Budgets I can claim against, with their live headroom (TE-05)',
  })
  .output(z.object({ rows: z.array(budgetOutput) }))
  .handler(async ({ context }) => {
    if (context.user.employee_id === null) return { rows: [] };

    const budgets = await context.db
      .selectFrom('pay.budgets')
      .select([
        'id',
        'reference',
        'title',
        'status',
        'travel_type',
        'from_location',
        'to_location',
        'period_from',
        'period_to',
        'currency',
      ])
      .where('employee_id', '=', context.user.employee_id)
      .where('status', 'in', ['pending', 'approved'])
      .orderBy('period_from', 'desc')
      .limit(50)
      .execute();

    const rows = await Promise.all(
      budgets.map(async (b) => {
        const headroom = await readHeadroom(context.db, b.id);
        return {
          id: b.id,
          reference: b.reference,
          title: b.title,
          status: b.status,
          travelType: b.travel_type,
          fromLocation: b.from_location,
          toLocation: b.to_location,
          periodFrom: iso(b.period_from),
          periodTo: iso(b.period_to),
          allowance: paiseToNumeric(headroom?.allowance ?? paise(0)),
          reserved: paiseToNumeric(headroom?.reserved ?? paise(0)),
          remaining: paiseToNumeric(headroom?.remaining ?? paise(0)),
          currency: b.currency,
        };
      }),
    );
    return { rows };
  });

const myClaims = withPermission('claims.own')
  .route({ method: 'GET', path: '/claims/my', summary: 'My claims and their state' })
  .output(z.object({ rows: z.array(claimOutput) }))
  .handler(async ({ context }) => {
    if (context.user.employee_id === null) return { rows: [] };

    const rows = await context.db
      .selectFrom('pay.claims as c')
      .leftJoin('pay.budgets as b', 'b.id', 'c.budget_id')
      .select((eb) => [
        'c.id',
        'c.reference',
        'c.budget_id',
        'c.status',
        'c.claimed_amount',
        'c.approved_amount',
        'c.period_from',
        'c.period_to',
        'c.submitted_at',
        'c.rejection_reason',
        'b.title as budget_title',
        eb
          .selectFrom('pay.claim_lines as l')
          .select((inner) => inner.fn.countAll<string>().as('n'))
          .whereRef('l.claim_id', '=', 'c.id')
          .as('line_count'),
      ])
      .where('c.employee_id', '=', context.user.employee_id)
      .orderBy('c.created_at', 'desc')
      .limit(100)
      .execute();

    return {
      rows: rows.map((r) => ({
        id: r.id,
        reference: r.reference,
        budgetId: r.budget_id,
        budgetTitle: r.budget_title,
        status: r.status,
        claimedAmount: r.claimed_amount,
        approvedAmount: r.approved_amount,
        periodFrom: iso(r.period_from),
        periodTo: iso(r.period_to),
        lineCount: Number(r.line_count ?? 0),
        submittedAt: r.submitted_at?.toISOString() ?? null,
        rejectionReason: r.rejection_reason,
      })),
    };
  });

const createClaim = withPermission('claims.own')
  .route({ method: 'POST', path: '/claims/my', summary: 'Start a claim against a budget' })
  .input(
    z.object({
      budgetId: z.number().int(),
      /**
       * D4 — the live contract. 'save' stores a draft that reserves NOTHING;
       * 'submit' commits the amount against the budget in the same call. Two
       * separate calls would leave a window where a draft exists but its money
       * is unaccounted for.
       */
      intent: z.enum(['save', 'submit']).default('save'),
      periodFrom: ISO_DATE,
      periodTo: ISO_DATE,
      lines: z
        .array(
          z.object({
            claimTypeCode: z.string().min(2).max(40),
            description: z.string().max(300).nullable(),
            spentOn: ISO_DATE,
            billNo: z.string().max(80).nullable(),
            amount: z.number().positive(),
          }),
        )
        .min(1),
    }),
  )
  .output(
    z.object({
      id: z.number().int(),
      reference: z.string(),
      status: z.string(),
      reservedAmount: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    if (context.user.employee_id === null) {
      throw new ORPCError('FORBIDDEN', { message: 'This login has no employee record' });
    }

    const budget = await context.db
      .selectFrom('pay.budgets')
      .select(['id', 'employee_id', 'status'])
      .where('id', '=', input.budgetId)
      .executeTakeFirst();

    if (budget?.employee_id !== context.user.employee_id) {
      // Not "forbidden" — someone else's budget simply does not exist to you.
      throw new ORPCError('NOT_FOUND', { message: 'Budget not found' });
    }

    // Spec §6 step 3 — checked BEFORE anything is created. An earlier version
    // created the claim and then refused the submit, which left an orphan draft
    // holding the budget's single active-claim slot forever.
    if (input.intent === 'submit' && budget.status !== 'approved') {
      throw new ORPCError('CONFLICT', { message: 'Selected budget is not approved' });
    }

    // Spec §8 — one active claim per budget. Only a REJECTED claim frees it, so
    // a draft blocks a second one too. Enforced here for the message, and by a
    // partial unique index so no other path can slip past it.
    const active = await context.db
      .selectFrom('pay.claims')
      .select(['reference'])
      .where('budget_id', '=', input.budgetId)
      .where('status', '<>', 'rejected')
      .executeTakeFirst();
    if (active) {
      throw new ORPCError('CONFLICT', {
        message: `This budget already has an active claim (${active.reference}). Only one claim per budget is allowed.`,
      });
    }

    const types = await context.db
      .selectFrom('pay.claim_types')
      .select(['id', 'code'])
      .where('is_active', '=', true)
      .execute();
    const typeByCode = new Map(types.map((t) => [t.code, t.id]));

    const total = input.lines.reduce((sum, line) => sum + Math.round(line.amount * 100), 0);
    const reference = `CLM${Date.now().toString().slice(-9)}`;

    const id = await context.db.transaction().execute(async (trx) => {
      const claim = await trx
        .insertInto('pay.claims')
        .values({
          reference,
          employee_id: context.user.employee_id ?? 0,
          budget_id: input.budgetId,
          period_from: input.periodFrom,
          period_to: input.periodTo,
          claimed_amount: paiseToNumeric(paise(total)),
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      for (const line of input.lines) {
        const typeId = typeByCode.get(line.claimTypeCode);
        if (typeId === undefined) {
          throw new ORPCError('BAD_REQUEST', {
            message: `Unknown expense type: ${line.claimTypeCode}`,
          });
        }
        const minor = paise(Math.round(line.amount * 100));
        await trx
          .insertInto('pay.claim_lines')
          .values({
            claim_id: claim.id,
            claim_type_id: typeId,
            description: line.description,
            spent_on: line.spentOn,
            bill_no: line.billNo,
            original_amount: paiseToNumeric(minor),
            amount: paiseToNumeric(minor),
          })
          .execute();
      }
      return claim.id;
    });

    if (input.intent === 'save') {
      return { id, reference, status: 'draft', reservedAmount: '0.00' };
    }

    const submitted = await submitClaim(context.db, {
      claimId: id,
      actorUserId: context.user.id,
    });
    if (!submitted.ok) {
      // Spec §6: a refused submit creates NOTHING. Leaving the row behind would
      // occupy the budget's one active-claim slot with a claim the person never
      // successfully filed, and they could never try again.
      await context.db.deleteFrom('pay.claim_lines').where('claim_id', '=', id).execute();
      await context.db.deleteFrom('pay.claims').where('id', '=', id).execute();

      const data =
        submitted.reason === 'category_cap'
          ? { cap: submitted.cap }
          : submitted.reason === 'refused'
            ? { decision: submitted.decision }
            : {};
      throw new ORPCError('CONFLICT', { message: submitted.message, data });
    }

    // The money is committed; now put it in front of an approver. Failing to
    // route would leave a claim holding budget with nobody asked to decide.
    await routeClaimForApproval(context.db, {
      claimId: id,
      employeeId: context.user.employee_id,
      requestedByUserId: context.user.id,
    });

    return {
      id,
      reference,
      status: 'submitted',
      reservedAmount: paiseToNumeric(paise(submitted.reservedMinor)),
    };
  });

const submit = withPermission('claims.own')
  .route({
    method: 'POST',
    path: '/claims/my/submit',
    summary: 'Submit a claim — commits the amount against the budget (TE-06)',
  })
  .input(z.object({ claimId: z.number().int() }))
  .output(z.object({ reservedAmount: z.string() }))
  .handler(async ({ input, context }) => {
    const owned = await context.db
      .selectFrom('pay.claims')
      .select('id')
      .where('id', '=', input.claimId)
      .where('employee_id', '=', context.user.employee_id ?? 0)
      .executeTakeFirst();
    if (!owned) throw new ORPCError('NOT_FOUND', { message: 'Claim not found' });

    const result = await submitClaim(context.db, {
      claimId: input.claimId,
      actorUserId: context.user.id,
    });

    if (!result.ok) {
      // The refusal carries the limit and the shortfall, so the screen never
      // has to recompute them to explain itself.
      if (result.reason === 'refused') {
        throw new ORPCError('CONFLICT', {
          message: result.message,
          data: { decision: result.decision },
        });
      }
      if (result.reason === 'category_cap') {
        // The refusal names the category, its ceiling and the shortfall, so the
        // screen can say which line is over rather than just "too much".
        throw new ORPCError('CONFLICT', {
          message: result.message,
          data: { cap: result.cap },
        });
      }
      throw new ORPCError(result.reason === 'not_found' ? 'NOT_FOUND' : 'CONFLICT', {
        message: result.message,
      });
    }

    await routeClaimForApproval(context.db, {
      claimId: input.claimId,
      employeeId: context.user.employee_id ?? 0,
      requestedByUserId: context.user.id,
    });

    await writeAudit(context.db, {
      actorUserId: context.user.id,
      action: 'submit',
      entity: 'pay.claims',
      entityId: input.claimId,
      newValue: paiseToNumeric(paise(result.reservedMinor)),
    });

    return { reservedAmount: paiseToNumeric(paise(result.reservedMinor)) };
  });

const deleteClaim = withPermission('claims.own')
  .route({
    method: 'POST',
    path: '/claims/my/delete',
    summary: 'Discard a claim — returns any commitment it held to the budget',
  })
  .input(z.object({ claimId: z.number().int() }))
  .output(z.object({ releasedAmount: z.string() }))
  .handler(async ({ input, context }) => {
    const claim = await context.db
      .selectFrom('pay.claims')
      .select(['id', 'status'])
      .where('id', '=', input.claimId)
      .where('employee_id', '=', context.user.employee_id ?? 0)
      .executeTakeFirst();
    if (!claim) throw new ORPCError('NOT_FOUND', { message: 'Claim not found' });
    if (claim.status === 'approved' || claim.status === 'settled') {
      throw new ORPCError('CONFLICT', {
        message: 'An approved claim cannot be discarded — ask HR to reverse it',
      });
    }

    // Discarding MUST give the budget its headroom back, or the budget slowly
    // starves on money nothing is spending. This is the same release path a
    // rejection uses, deliberately.
    const result = await releaseClaim(context.db, {
      claimId: input.claimId,
      actorUserId: context.user.id,
      outcome: 'rejected',
      reason: 'discarded by the claimant',
    });

    return {
      releasedAmount: result.ok ? paiseToNumeric(paise(result.releasedMinor)) : '0.00',
    };
  });

const createBudget = withPermission('claims.own')
  .route({
    method: 'POST',
    path: '/claims/my/budgets',
    summary: 'Raise a travel budget — the request and its estimate are one object (TE-01/05)',
  })
  .input(
    z.object({
      title: z.string().min(3).max(160),
      purpose: z.string().max(500).nullable(),
      travelType: z.enum(['domestic', 'international']).nullable(),
      fromLocation: z.string().max(120).nullable(),
      toLocation: z.string().max(120).nullable(),
      travelStart: ISO_DATE.nullable(),
      travelEnd: ISO_DATE.nullable(),
      nights: z.number().int().min(0).max(365).nullable(),
      allowance: z.number().positive(),
    }),
  )
  .output(z.object({ id: z.number().int(), reference: z.string() }))
  .handler(async ({ input, context }) => {
    if (context.user.employee_id === null) {
      throw new ORPCError('FORBIDDEN', { message: 'This login has no employee record' });
    }
    const employee = await context.db
      .selectFrom('core.employees')
      .select(['company_id', 'cost_center_id'])
      .where('id', '=', context.user.employee_id)
      .executeTakeFirstOrThrow();

    const reference = `BGT${Date.now().toString().slice(-9)}`;
    const created = await context.db
      .insertInto('pay.budgets')
      .values({
        reference,
        title: input.title,
        purpose: input.purpose,
        employee_id: context.user.employee_id,
        company_id: employee.company_id,
        cost_center_id: employee.cost_center_id,
        // istDateString, not toISOString: after 18:30 UTC the UTC date is
        // already yesterday in IST, which would back-date the budget period.
        period_from: input.travelStart ?? istDateString(),
        period_to: input.travelEnd ?? input.travelStart ?? istDateString(),
        travel_type: input.travelType,
        from_location: input.fromLocation,
        to_location: input.toLocation,
        travel_start: input.travelStart,
        travel_end: input.travelEnd,
        nights: input.nights,
        allowance: paiseToNumeric(paise(Math.round(input.allowance * 100))),
        status: 'pending',
      })
      .returning(['id', 'reference'])
      .executeTakeFirstOrThrow();

    await writeAudit(context.db, {
      actorUserId: context.user.id,
      action: 'create',
      entity: 'pay.budgets',
      entityId: created.id,
      newValue: `${created.reference} ${input.title}`,
    });
    return created;
  });

const decideBudget = withPermission('claims.approve')
  .route({
    method: 'POST',
    path: '/claims/budgets/decide',
    summary: 'Approve or reject a budget — nothing can be claimed until it is approved',
  })
  .input(
    z.object({
      budgetId: z.number().int(),
      outcome: z.enum(['approved', 'rejected']),
      approvedAllowance: z.number().positive().optional(),
      reason: z.string().max(300).optional(),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    const budget = await context.db
      .selectFrom('pay.budgets')
      .select(['id', 'status', 'allowance', 'reference'])
      .where('id', '=', input.budgetId)
      .executeTakeFirst();
    if (!budget) throw new ORPCError('NOT_FOUND', { message: 'Budget not found' });
    if (budget.status !== 'pending') {
      throw new ORPCError('CONFLICT', { message: 'That budget has already been decided' });
    }

    if (input.outcome === 'rejected') {
      const reason = input.reason?.trim() ?? '';
      if (reason.length < 3) {
        throw new ORPCError('BAD_REQUEST', { message: 'Say why the budget is refused' });
      }
      await context.db
        .updateTable('pay.budgets')
        .set({ status: 'rejected', rejection_reason: reason })
        .where('id', '=', input.budgetId)
        .execute();
    } else {
      // An approver may grant less than the ask; the ledger then draws on the
      // granted figure, never on the request (live approvedBudget behaviour).
      const granted =
        input.approvedAllowance === undefined
          ? numericToPaise(budget.allowance)
          : paise(Math.round(input.approvedAllowance * 100));
      await context.db
        .updateTable('pay.budgets')
        .set({
          status: 'approved',
          approved_allowance: paiseToNumeric(granted),
          approved_by_user_id: context.user.id,
          approved_at: new Date(),
        })
        .where('id', '=', input.budgetId)
        .execute();
    }

    await writeAudit(context.db, {
      actorUserId: context.user.id,
      action: input.outcome,
      entity: 'pay.budgets',
      entityId: input.budgetId,
      newValue: `${budget.reference} ${input.outcome}`,
    });
    return { ok: true as const };
  });

const claimTypes = authed
  .route({ method: 'GET', path: '/claims/types', summary: 'The expense taxonomy' })
  .output(
    z.object({
      rows: z.array(
        z.object({ code: z.string(), name: z.string(), requiresBill: z.boolean() }),
      ),
    }),
  )
  .handler(async ({ context }) => {
    const rows = await context.db
      .selectFrom('pay.claim_types')
      .select(['code', 'name', 'requires_bill'])
      .where('is_active', '=', true)
      .orderBy('sort_order')
      .execute();
    return {
      rows: rows.map((r) => ({ code: r.code, name: r.name, requiresBill: r.requires_bill })),
    };
  });

/* ── Approver surfaces ───────────────────────────────────────────────────── */

const pending = withPermission('claims.approve')
  .route({ method: 'GET', path: '/claims/pending', summary: 'Claims awaiting my decision' })
  .output(z.object({ rows: z.array(claimOutput.extend({ employeeName: z.string() })) }))
  .handler(async ({ context }) => {
    const rows = await context.db
      .selectFrom('pay.claims as c')
      .innerJoin('core.employees as e', 'e.id', 'c.employee_id')
      .leftJoin('pay.budgets as b', 'b.id', 'c.budget_id')
      .select((eb) => [
        'c.id',
        'c.reference',
        'c.budget_id',
        'c.status',
        'c.claimed_amount',
        'c.approved_amount',
        'c.period_from',
        'c.period_to',
        'c.submitted_at',
        'c.rejection_reason',
        'b.title as budget_title',
        'e.first_name',
        'e.last_name',
        'e.ecode',
        eb
          .selectFrom('pay.claim_lines as l')
          .select((inner) => inner.fn.countAll<string>().as('n'))
          .whereRef('l.claim_id', '=', 'c.id')
          .as('line_count'),
      ])
      .where('c.status', '=', 'submitted')
      .orderBy('c.submitted_at')
      .limit(100)
      .execute();

    return {
      rows: rows.map((r) => ({
        id: r.id,
        reference: r.reference,
        budgetId: r.budget_id,
        budgetTitle: r.budget_title,
        status: r.status,
        claimedAmount: r.claimed_amount,
        approvedAmount: r.approved_amount,
        periodFrom: iso(r.period_from),
        periodTo: iso(r.period_to),
        lineCount: Number(r.line_count ?? 0),
        submittedAt: r.submitted_at?.toISOString() ?? null,
        rejectionReason: r.rejection_reason,
        employeeName: `${r.first_name}${r.last_name === null ? '' : ` ${r.last_name}`} (${r.ecode})`,
      })),
    };
  });

const decide = withPermission('claims.approve')
  .route({
    method: 'POST',
    path: '/claims/decide',
    summary: 'Approve, reject or send back — a rejection returns the budget commitment',
  })
  .input(
    z.object({
      claimId: z.number().int(),
      outcome: z.enum(['approved', 'rejected', 'sent_back']),
      reason: z.string().max(300).optional(),
      approvedAmount: z.number().positive().optional(),
    }),
  )
  .output(z.object({ ok: z.literal(true), releasedAmount: z.string() }))
  .handler(async ({ input, context }) => {
    if (input.outcome === 'approved') {
      const result = await approveClaim(context.db, {
        claimId: input.claimId,
        actorUserId: context.user.id,
        ...(input.approvedAmount === undefined
          ? {}
          : { approvedAmount: paise(Math.round(input.approvedAmount * 100)) }),
      });
      if (!result.ok) throw new ORPCError('CONFLICT', { message: result.message });
      return { ok: true as const, releasedAmount: '0.00' };
    }

    const reason = input.reason?.trim() ?? '';
    if (reason.length < 3) {
      // CLM-03: a decline always carries a reason. Enforced here and by CHECK.
      throw new ORPCError('BAD_REQUEST', {
        message: 'Say why — the person needs to know what to change',
      });
    }

    const result = await releaseClaim(context.db, {
      claimId: input.claimId,
      actorUserId: context.user.id,
      outcome: input.outcome,
      reason,
    });
    if (!result.ok) throw new ORPCError('CONFLICT', { message: result.message });

    await writeAudit(context.db, {
      actorUserId: context.user.id,
      action: input.outcome,
      entity: 'pay.claims',
      entityId: input.claimId,
      newValue: reason,
    });

    return {
      ok: true as const,
      releasedAmount: paiseToNumeric(paise(result.releasedMinor)),
    };
  });

const budgetDetail = withPermission('claims.approve')
  .route({ method: 'GET', path: '/claims/budget', summary: 'A budget and its live position' })
  .input(z.object({ budgetId: z.number().int() }))
  .output(
    z.object({
      budgetId: z.number().int(),
      reference: z.string(),
      title: z.string(),
      status: z.string(),
      allowance: z.string(),
      reserved: z.string(),
      remaining: z.string(),
      approved: z.boolean(),
    }),
  )
  .handler(async ({ input, context }) => {
    const position = await budgetPosition(context.db, input.budgetId);
    if (!position) throw new ORPCError('NOT_FOUND', { message: 'Budget not found' });
    return position;
  });

export const claimsRouter = {
  myBudgets,
  createBudget,
  myClaims,
  createClaim,
  submit,
  deleteClaim,
  claimTypes,
  pending,
  decide,
  decideBudget,
  budgetDetail,
};
