/**
 * Travel & Expense oRPC Router (TE-01..12).
 *
 * Exposes typed RPC procedures with explicit REST routes for:
 * - Trips & Itinerary lifecycle
 * - Grade-based Travel Budgets
 * - Travel Advances & Approval
 * - Claims & Multi-currency receipt capture
 * - Settlement Engine (TE-09) & Wallet Ledger (TE-08)
 */

import { z } from 'zod';
import { authed, withPermission } from '../../api/orpc.js';
import { TravelService } from './travel.service.js';
import { WalletService } from './wallet.service.js';
import { SettlementService } from './settlement.service.js';
import { assertTravelReadable, requireSelf, resolveListSubject } from './travel-access.js';

const tripItemSchema = z.object({
  id: z.number(),
  referenceNo: z.string(),
  employeeId: z.number(),
  companyId: z.number(),
  tripName: z.string(),
  travelType: z.enum(['domestic', 'international']),
  purpose: z.string(),
  destinationCountry: z.string(),
  destinationCity: z.string(),
  startDate: z.union([z.date(), z.string()]),
  endDate: z.union([z.date(), z.string()]),
  visaRequired: z.boolean(),
  visaStatus: z.string().nullable().optional(),
  status: z.string(),
  estimatedBudgetPaise: z.number(),
  approvedBudgetPaise: z.number(),
  cancellationReason: z.string().nullable().optional(),
  cancellationCostPaise: z.number().optional(),
  createdAt: z.union([z.date(), z.string()]),
  updatedAt: z.union([z.date(), z.string()]),
});

const itineraryItemSchema = z.object({
  id: z.number(),
  tripId: z.number(),
  segmentType: z.enum(['flight', 'train', 'bus', 'hotel', 'car', 'other']),
  origin: z.string(),
  destination: z.string(),
  departureDate: z.union([z.date(), z.string()]),
  arrivalDate: z.union([z.date(), z.string()]).nullable().optional(),
  provider: z.string().nullable().optional(),
  bookingReference: z.string().nullable().optional(),
  estimatedCostPaise: z.number(),
  actualCostPaise: z.number(),
  createdAt: z.union([z.date(), z.string()]),
});

const budgetItemSchema = z.object({
  id: z.number(),
  gradeLevel: z.string(),
  travelType: z.enum(['domestic', 'international']),
  flightClass: z.string(),
  hotelPerNightPaise: z.number(),
  dailyAllowancePaise: z.number(),
  localConveyancePaise: z.number(),
  isActive: z.boolean(),
});

const advanceItemSchema = z.object({
  id: z.number(),
  tripId: z.number(),
  employeeId: z.number(),
  amountPaise: z.number(),
  purpose: z.string(),
  status: z.string(),
  disbursedAt: z.union([z.date(), z.string()]).nullable().optional(),
  createdAt: z.union([z.date(), z.string()]),
  updatedAt: z.union([z.date(), z.string()]),
});

const claimItemDetailSchema = z.object({
  id: z.number(),
  claimId: z.number(),
  category: z.enum(['flight', 'train', 'bus', 'hotel', 'daily_allowance', 'local_travel', 'visa', 'food', 'misc']),
  itemDate: z.union([z.date(), z.string()]),
  amountPaise: z.number(),
  currency: z.string(),
  fxRateToInr: z.union([z.number(), z.string()]),
  inrAmountPaise: z.number(),
  receiptUrl: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  createdAt: z.union([z.date(), z.string()]),
});

const claimSchema = z.object({
  id: z.number(),
  referenceNo: z.string(),
  tripId: z.number(),
  employeeId: z.number(),
  totalClaimedPaise: z.number(),
  approvedAmountPaise: z.number(),
  advanceAdjustedPaise: z.number(),
  netPayablePaise: z.number(),
  netRecoverablePaise: z.number(),
  status: z.string(),
  settlementStatus: z.string(),
  createdAt: z.union([z.date(), z.string()]),
  updatedAt: z.union([z.date(), z.string()]),
});

const walletTransactionSchema = z.object({
  id: z.number(),
  walletId: z.number(),
  employeeId: z.number(),
  tripId: z.number().nullable().optional(),
  source: z.string(),
  type: z.enum(['credit', 'debit']),
  amountPaise: z.number(),
  balanceAfterPaise: z.number(),
  transactionReference: z.string(),
  notes: z.string().nullable().optional(),
  createdAt: z.union([z.date(), z.string()]),
});

export const travelRouter = {
  // ── Trips ─────────────────────────────────────────────────────────────
  listTrips: authed
    .route({ method: 'GET', path: '/travel/trips', summary: 'List travel trips' })
    .input(z.object({ employeeId: z.coerce.number().int().positive().optional(), status: z.enum(['draft','submitted','approved','rejected','in_progress','completed','cancelled','all']).optional() }).optional())
    .output(z.object({ trips: z.array(tripItemSchema), items: z.array(tripItemSchema) }))
    .handler(async ({ input, context }) => {
      const service = new TravelService(context.db);
      const subject = await resolveListSubject(context, input?.employeeId);
      if (subject.none) return { trips: [], items: [] };
      const trips = await service.getTrips({ employeeId: subject.employeeId, scope: subject.scope, status: input?.status });
      const mapped = trips.map((t) => ({
        id: t.id,
        referenceNo: t.reference_no,
        employeeId: t.employee_id,
        companyId: t.company_id,
        tripName: t.trip_name,
        travelType: t.travel_type,
        purpose: t.purpose,
        destinationCountry: t.destination_country,
        destinationCity: t.destination_city,
        startDate: t.start_date,
        endDate: t.end_date,
        visaRequired: t.visa_required,
        visaStatus: t.visa_status,
        status: t.status,
        estimatedBudgetPaise: t.estimated_budget_paise,
        approvedBudgetPaise: t.approved_budget_paise,
        cancellationReason: t.cancellation_reason,
        cancellationCostPaise: t.cancellation_cost_paise,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }));
      return { trips: mapped, items: mapped };
    }),

  getTripById: authed
    .route({ method: 'GET', path: '/travel/trips/{id}', summary: 'Get trip details with itineraries and advances' })
    .input(z.object({ id: z.coerce.number().int().positive() }))
    .output(
      z.object({
        trip: tripItemSchema,
        itineraries: z.array(itineraryItemSchema),
        advances: z.array(advanceItemSchema),
      })
    )
    .handler(async ({ input, context }) => {
      const service = new TravelService(context.db);
      const res = await service.getTripById(input.id);
      await assertTravelReadable(context, res.trip.employee_id, true);
      return {
        trip: {
          ...res.trip,
          referenceNo: res.trip.reference_no,
          employeeId: res.trip.employee_id,
          companyId: res.trip.company_id,
          tripName: res.trip.trip_name,
          travelType: res.trip.travel_type,
          purpose: res.trip.purpose,
          destinationCountry: res.trip.destination_country,
          destinationCity: res.trip.destination_city,
          startDate: res.trip.start_date,
          endDate: res.trip.end_date,
          visaRequired: res.trip.visa_required,
          visaStatus: res.trip.visa_status,
          status: res.trip.status,
          estimatedBudgetPaise: res.trip.estimated_budget_paise,
          approvedBudgetPaise: res.trip.approved_budget_paise,
          cancellationReason: res.trip.cancellation_reason,
          cancellationCostPaise: res.trip.cancellation_cost_paise,
          createdAt: res.trip.created_at,
          updatedAt: res.trip.updated_at,
        },
        itineraries: res.itineraries.map((i) => ({
          id: i.id,
          tripId: i.trip_id,
          segmentType: i.segment_type,
          origin: i.origin,
          destination: i.destination,
          departureDate: i.departure_date,
          arrivalDate: i.arrival_date,
          provider: i.provider,
          bookingReference: i.booking_reference,
          estimatedCostPaise: i.estimated_cost_paise,
          actualCostPaise: i.actual_cost_paise,
          createdAt: i.created_at,
        })),
        advances: res.advances.map((a) => ({
          id: a.id,
          tripId: a.trip_id,
          employeeId: a.employee_id,
          amountPaise: a.amount_paise,
          purpose: a.purpose,
          status: a.status,
          disbursedAt: a.disbursed_at,
          createdAt: a.created_at,
          updatedAt: a.updated_at,
        })),
      };
    }),

  createTrip: authed
    .route({ method: 'POST', path: '/travel/trips', summary: 'Raise new travel trip request' })
    .input(
      z.object({
        tripName: z.string().min(3),
        travelType: z.enum(['domestic', 'international']),
        purpose: z.string().min(5),
        destinationCountry: z.string().optional(),
        destinationCity: z.string().min(2),
        startDate: z.string(),
        endDate: z.string(),
        visaRequired: z.boolean().optional(),
      })
    )
    .output(z.object({ trip: tripItemSchema }))
    .handler(async ({ input, context }) => {
      const service = new TravelService(context.db);
      const empId = requireSelf(context);
      const employee = await context.db.selectFrom('core.employees').select('company_id').where('id', '=', empId).executeTakeFirstOrThrow();
      const trip = await service.createTrip({
        employeeId: empId,
        companyId: employee.company_id,
        requestedByUserId: context.user.id,
        tripName: input.tripName,
        travelType: input.travelType,
        purpose: input.purpose,
        destinationCountry: input.destinationCountry,
        destinationCity: input.destinationCity,
        startDate: input.startDate,
        endDate: input.endDate,
        visaRequired: input.visaRequired,
      });
      return {
        trip: {
          id: trip.id,
          referenceNo: trip.reference_no,
          employeeId: trip.employee_id,
          companyId: trip.company_id,
          tripName: trip.trip_name,
          travelType: trip.travel_type,
          purpose: trip.purpose,
          destinationCountry: trip.destination_country,
          destinationCity: trip.destination_city,
          startDate: trip.start_date,
          endDate: trip.end_date,
          visaRequired: trip.visa_required,
          visaStatus: trip.visa_status,
          status: trip.status,
          estimatedBudgetPaise: trip.estimated_budget_paise,
          approvedBudgetPaise: trip.approved_budget_paise,
          cancellationReason: trip.cancellation_reason,
          cancellationCostPaise: trip.cancellation_cost_paise,
          createdAt: trip.created_at,
          updatedAt: trip.updated_at,
        },
      };
    }),

  addItinerary: authed
    .route({ method: 'POST', path: '/travel/trips/{tripId}/itineraries', summary: 'Add travel itinerary segment' })
    .input(
      z.object({
        tripId: z.number(),
        segmentType: z.enum(['flight', 'train', 'bus', 'hotel', 'car', 'other']),
        origin: z.string(),
        destination: z.string(),
        departureDate: z.string(),
        arrivalDate: z.string().optional(),
        provider: z.string().optional(),
        bookingReference: z.string().optional(),
        estimatedCostPaise: z.number().optional(),
      })
    )
    .output(z.object({ itinerary: itineraryItemSchema }))
    .handler(async ({ input, context }) => {
      const service = new TravelService(context.db);
      const it = await service.addItinerary({ ...input, actorEmployeeId: context.user.employee_id });
      return {
        itinerary: {
          id: it.id,
          tripId: it.trip_id,
          segmentType: it.segment_type,
          origin: it.origin,
          destination: it.destination,
          departureDate: it.departure_date,
          arrivalDate: it.arrival_date,
          provider: it.provider,
          bookingReference: it.booking_reference,
          estimatedCostPaise: it.estimated_cost_paise,
          actualCostPaise: it.actual_cost_paise,
          createdAt: it.created_at,
        },
      };
    }),

  // ── Budgets ────────────────────────────────────────────────────────────
  listBudgets: authed
    .route({ method: 'GET', path: '/travel/budgets', summary: 'List travel budget allowances by grade' })
    .input(z.object({ travelType: z.enum(['domestic', 'international']).optional() }).optional())
    .output(z.object({ budgets: z.array(budgetItemSchema) }))
    .handler(async ({ input, context }) => {
      const service = new TravelService(context.db);
      const budgets = await service.getBudgets(input?.travelType);
      return {
        budgets: budgets.map((b) => ({
          id: b.id,
          gradeLevel: b.grade_level,
          travelType: b.travel_type,
          flightClass: b.flight_class,
          hotelPerNightPaise: b.hotel_per_night_paise,
          dailyAllowancePaise: b.daily_allowance_paise,
          localConveyancePaise: b.local_conveyance_paise,
          isActive: b.is_active,
        })),
      };
    }),

  // ── Advances ───────────────────────────────────────────────────────────
  listAdvances: authed
    .route({ method: 'GET', path: '/travel/advances', summary: 'List travel advances' })
    .input(z.object({ employeeId: z.coerce.number().int().positive().optional(), tripId: z.coerce.number().int().positive().optional() }).optional())
    .output(z.object({ advances: z.array(advanceItemSchema), items: z.array(advanceItemSchema) }))
    .handler(async ({ input, context }) => {
      const service = new TravelService(context.db);
      const subject = await resolveListSubject(context, input?.employeeId);
      if (subject.none) return { advances: [], items: [] };
      const advances = await service.getAdvances({ employeeId: subject.employeeId, scope: subject.scope, tripId: input?.tripId });
      const mapped = advances.map((a) => ({
        id: a.id,
        tripId: a.trip_id,
        employeeId: a.employee_id,
        amountPaise: a.amount_paise,
        purpose: a.purpose,
        status: a.status,
        disbursedAt: a.disbursed_at,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
      }));
      return { advances: mapped, items: mapped };
    }),

  requestAdvance: authed
    .route({ method: 'POST', path: '/travel/advances', summary: 'Request travel advance' })
    .input(
      z.object({
        tripId: z.number(),
        amountPaise: z.number().min(100),
        purpose: z.string().min(5),
      })
    )
    .output(z.object({ advance: advanceItemSchema }))
    .handler(async ({ input, context }) => {
      const service = new TravelService(context.db);
      const empId = requireSelf(context);
      const advance = await service.requestAdvance({
        tripId: input.tripId,
        employeeId: empId,
        requestedByUserId: context.user.id,
        amountPaise: input.amountPaise,
        purpose: input.purpose,
      });
      return {
        advance: {
          id: advance.id,
          tripId: advance.trip_id,
          employeeId: advance.employee_id,
          amountPaise: advance.amount_paise,
          purpose: advance.purpose,
          status: advance.status,
          disbursedAt: advance.disbursed_at,
          createdAt: advance.created_at,
          updatedAt: advance.updated_at,
        },
      };
    }),

  approveAdvance: withPermission('payroll.run.manage')
    .route({ method: 'POST', path: '/travel/advances/{advanceId}/approve', summary: 'Disburse an advance approved by the RM chain into the wallet' })
    .input(z.object({ advanceId: z.number() }))
    .output(z.object({ advance: advanceItemSchema }))
    .handler(async ({ input, context }) => {
      const service = new TravelService(context.db);
      const advance = await service.approveAdvance(input.advanceId, context.user.id);
      return {
        advance: {
          id: advance.id,
          tripId: advance.trip_id,
          employeeId: advance.employee_id,
          amountPaise: advance.amount_paise,
          purpose: advance.purpose,
          status: advance.status,
          disbursedAt: advance.disbursed_at,
          createdAt: advance.created_at,
          updatedAt: advance.updated_at,
        },
      };
    }),

  // ── Claims & Settlement ────────────────────────────────────────────────
  listClaims: authed
    .route({ method: 'GET', path: '/travel/claims', summary: 'List travel expense claims' })
    .input(z.object({ employeeId: z.coerce.number().int().positive().optional(), tripId: z.coerce.number().int().positive().optional() }).optional())
    .output(z.object({ claims: z.array(claimSchema), items: z.array(claimSchema) }))
    .handler(async ({ input, context }) => {
      const service = new SettlementService(context.db);
      const subject = await resolveListSubject(context, input?.employeeId);
      if (subject.none) return { claims: [], items: [] };
      const claims = await service.getClaims({ employeeId: subject.employeeId, scope: subject.scope, tripId: input?.tripId });
      const mapped = claims.map((c) => ({
        id: c.id,
        referenceNo: c.reference_no,
        tripId: c.trip_id,
        employeeId: c.employee_id,
        totalClaimedPaise: c.total_claimed_paise,
        approvedAmountPaise: c.approved_amount_paise,
        advanceAdjustedPaise: c.advance_adjusted_paise,
        netPayablePaise: c.net_payable_paise,
        netRecoverablePaise: c.net_recoverable_paise,
        status: c.status,
        settlementStatus: c.settlement_status,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }));
      return { claims: mapped, items: mapped };
    }),

  createClaim: authed
    .route({ method: 'POST', path: '/travel/claims', summary: 'Create new expense claim' })
    .input(z.object({ tripId: z.number() }))
    .output(z.object({ claim: claimSchema }))
    .handler(async ({ input, context }) => {
      const service = new SettlementService(context.db);
      const empId = requireSelf(context);
      const claim = await service.createClaim({
        tripId: input.tripId,
        employeeId: empId,
      });
      return {
        claim: {
          id: claim.id,
          referenceNo: claim.reference_no,
          tripId: claim.trip_id,
          employeeId: claim.employee_id,
          totalClaimedPaise: claim.total_claimed_paise,
          approvedAmountPaise: claim.approved_amount_paise,
          advanceAdjustedPaise: claim.advance_adjusted_paise,
          netPayablePaise: claim.net_payable_paise,
          netRecoverablePaise: claim.net_recoverable_paise,
          status: claim.status,
          settlementStatus: claim.settlement_status,
          createdAt: claim.created_at,
          updatedAt: claim.updated_at,
        },
      };
    }),

  addClaimItem: authed
    .route({ method: 'POST', path: '/travel/claims/{claimId}/items', summary: 'Add expense receipt item to claim' })
    .input(
      z.object({
        claimId: z.number(),
        category: z.enum(['flight', 'train', 'bus', 'hotel', 'daily_allowance', 'local_travel', 'visa', 'food', 'misc']),
        itemDate: z.string(),
        amountPaise: z.number().min(100),
        currency: z.string().optional(),
        fxRateToInr: z.number().optional(),
        receiptUrl: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .output(z.object({ item: claimItemDetailSchema }))
    .handler(async ({ input, context }) => {
      const service = new SettlementService(context.db);
      const item = await service.addClaimItem({ ...input, actorEmployeeId: context.user.employee_id });
      return {
        item: {
          id: item.id,
          claimId: item.claim_id,
          category: item.category,
          itemDate: item.item_date,
          amountPaise: item.amount_paise,
          currency: item.currency,
          fxRateToInr: Number(item.fx_rate_to_inr),
          inrAmountPaise: item.inr_amount_paise,
          receiptUrl: item.receipt_url,
          description: item.description,
          createdAt: item.created_at,
        },
      };
    }),

  submitClaim: authed
    .route({ method: 'POST', path: '/travel/claims/{claimId}/submit', summary: 'Submit my claim for reporting-manager approval' })
    .input(z.object({ claimId: z.coerce.number().int().positive() }))
    .output(z.object({ claim: claimSchema }))
    .handler(async ({ input, context }) => {
      const c = await new SettlementService(context.db).submitClaim({ claimId: input.claimId, actorEmployeeId: context.user.employee_id, actorUserId: context.user.id });
      return {
        claim: {
          id: c.id, referenceNo: c.reference_no, tripId: c.trip_id, employeeId: c.employee_id,
          totalClaimedPaise: c.total_claimed_paise, approvedAmountPaise: c.approved_amount_paise,
          advanceAdjustedPaise: c.advance_adjusted_paise, netPayablePaise: c.net_payable_paise,
          netRecoverablePaise: c.net_recoverable_paise, status: c.status, settlementStatus: c.settlement_status,
          createdAt: c.created_at, updatedAt: c.updated_at,
        },
      };
    }),

  settleClaim: withPermission('payroll.run.manage')
    .route({ method: 'POST', path: '/travel/claims/{claimId}/settle', summary: 'Reconcile claim against advance and settle' })
    .input(
      z.object({
        claimId: z.number(),
        approvedAmountPaise: z.number().optional(),
        settlementMode: z.enum(['AUTO', 'MANUAL']).optional(),
        recoveryChannel: z.enum(['payroll_deduction', 'wallet_carry_forward', 'direct_refund']).optional(),
      })
    )
    .output(
      z.object({
        settlementId: z.number(),
        netPayablePaise: z.number(),
        netRecoverablePaise: z.number(),
        advanceAdjustedPaise: z.number(),
        walletBalanceAfterPaise: z.number(),
      })
    )
    .handler(async ({ input, context }) => {
      const service = new SettlementService(context.db);
      const res = await service.settleClaim({
        claimId: input.claimId,
        approvedAmountPaise: input.approvedAmountPaise,
        settlementMode: input.settlementMode,
        recoveryChannel: input.recoveryChannel,
        settledByUserId: context.user.id,
      });
      return {
        settlementId: res.settlement.id,
        netPayablePaise: res.reconciliation.netPayablePaise,
        netRecoverablePaise: res.reconciliation.netRecoverablePaise,
        advanceAdjustedPaise: res.reconciliation.advanceAdjustedPaise,
        walletBalanceAfterPaise: res.reconciliation.walletBalanceAfterPaise,
      };
    }),

  // ── Wallet Ledger ──────────────────────────────────────────────────────
  getWallet: authed
    .route({ method: 'GET', path: '/travel/wallet', summary: 'Get employee travel wallet balance' })
    .input(z.object({ employeeId: z.coerce.number().int().positive().optional() }).optional())
    .output(
      z.object({
        balancePaise: z.number(),
        balanceRupees: z.number(),
        employeeId: z.number(),
      })
    )
    .handler(async ({ input, context }) => {
      const service = new WalletService(context.db);
      const empId = input?.employeeId ?? requireSelf(context);
      await assertTravelReadable(context, empId);
      const wallet = await service.getOrCreateWallet(empId);
      const balance = wallet.balance_paise;
      return {
        balancePaise: balance,
        balanceRupees: Math.round(balance / 100),
        employeeId: empId,
      };
    }),

  getWalletLedger: authed
    .route({ method: 'GET', path: '/travel/wallet/ledger', summary: 'Get immutable wallet transaction ledger' })
    .input(z.object({ employeeId: z.coerce.number().int().positive().optional() }).optional())
    .output(z.object({ transactions: z.array(walletTransactionSchema) }))
    .handler(async ({ input, context }) => {
      const service = new WalletService(context.db);
      const empId = input?.employeeId ?? requireSelf(context);
      await assertTravelReadable(context, empId);
      const txs = await service.getTransactions(empId);
      return {
        transactions: txs.map((t) => ({
          id: t.id,
          walletId: t.wallet_id,
          employeeId: t.employee_id,
          tripId: t.trip_id,
          source: t.source,
          type: t.type,
          amountPaise: t.amount_paise,
          balanceAfterPaise: t.balance_after_paise,
          transactionReference: t.transaction_reference,
          notes: t.notes,
          createdAt: t.created_at,
        })),
      };
    }),
};
