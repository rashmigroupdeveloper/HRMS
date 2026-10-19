/**
 * Travel & Trip Management Service (TE-01..07).
 *
 * Implements:
 * 1. Trip request creation, itinerary segments, and status lifecycle.
 * 2. Grade-based budget allowances (TE-05).
 * 3. Travel advance workflow (TE-07) with automated wallet crediting on approval.
 */

import type { Database, TeTripsTable, TeTripItinerariesTable, TeBudgetsTable, TeAdvancesTable } from '../../core/db/types.js';
import { sql, type Kysely, type Selectable, type Transaction } from 'kysely';
import { writeAudit } from '../../core/audit/audit.service.js';
import { ConflictError, DomainError, ForbiddenError, NotFoundError } from '../../core/errors/index.js';
import { employeeScopeSql, type EmployeeScope } from '../../core/rbac/employee-scope.js';
import { createRequest } from '../workflows/index.js';
import { assertDate, assertWithinTrip } from './travel-utils.js';
import { WalletService } from './wallet.service.js';
import { inTransaction } from '../../core/db/database.js';

export type TripRow = Selectable<TeTripsTable>;
export type ItineraryRow = Selectable<TeTripItinerariesTable>;
export type BudgetRow = Selectable<TeBudgetsTable>;
export type AdvanceRow = Selectable<TeAdvancesTable>;

export interface CreateTripInput {
  employeeId: number;
  companyId: number;
  tripName: string;
  travelType: 'domestic' | 'international';
  destinationRegion?: 'domestic' | 'sea' | 'africa' | 'middle_east' | 'europe' | 'americas' | 'other' | undefined;
  purpose: string;
  destinationCountry?: string | undefined;
  destinationCity: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  visaRequired?: boolean | undefined;
  estimatedBudgetPaise?: number | undefined;
  requestedByUserId: number;
}

export interface AddItineraryInput {
  tripId: number;
  segmentType: 'flight' | 'train' | 'bus' | 'hotel' | 'car' | 'other';
  origin: string;
  destination: string;
  departureDate: string; // ISO string
  arrivalDate?: string | undefined;
  provider?: string | undefined;
  bookingReference?: string | undefined;
  estimatedCostPaise?: number | undefined;
  actorEmployeeId: number | null;
}

export interface RequestAdvanceInput {
  tripId: number;
  employeeId: number;
  amountPaise: number;
  purpose: string;
  requestedByUserId: number;
}

type Db = Kysely<Database> | Transaction<Database>;

function scopeFilter(scope: EmployeeScope | undefined) {
  return sql<boolean>`employee_id IN (SELECT e.id FROM core.employees e WHERE ${employeeScopeSql(scope, 'e')})`;
}

/** Workflow final hooks for the travel chains (registered in workflow-hooks.ts). */
export async function applyTripOnFinal(db: Db, request: { id: number }, status: 'approved' | 'rejected' | 'lapsed'): Promise<void> {
  const trip = await db.selectFrom('te.trips').selectAll().where('workflow_request_id', '=', request.id).executeTakeFirst();
  if (trip?.status !== 'submitted') return;
  await db
    .updateTable('te.trips')
    .set(status === 'approved'
      ? { status: 'approved', approved_budget_paise: trip.estimated_budget_paise, updated_at: new Date() }
      : { status: 'rejected', updated_at: new Date() })
    .where('id', '=', trip.id)
    .execute();
}

export async function applyAdvanceOnFinal(db: Db, request: { id: number }, status: 'approved' | 'rejected' | 'lapsed'): Promise<void> {
  await db
    .updateTable('te.advances')
    .set({ status: status === 'approved' ? 'approved' : 'rejected', updated_at: new Date() })
    .where('workflow_request_id', '=', request.id)
    .where('status', '=', 'requested')
    .execute();
}

export class TravelService {
  private readonly walletService: WalletService;

  constructor(private readonly db: Kysely<Database>) {
    this.walletService = new WalletService(db);
  }

  async getTrips(filters?: { employeeId?: number | undefined; scope?: EmployeeScope | undefined; status?: TripRow['status'] | 'all' | undefined }): Promise<TripRow[]> {
    let query = this.db.selectFrom('te.trips').selectAll();
    if (filters?.employeeId) query = query.where('employee_id', '=', filters.employeeId);
    if (filters?.scope) query = query.where(scopeFilter(filters.scope));
    if (filters?.status && filters.status !== 'all') query = query.where('status', '=', filters.status);
    return await query.orderBy('id', 'desc').execute();
  }

  async getTripById(id: number): Promise<{ trip: TripRow; itineraries: ItineraryRow[]; advances: AdvanceRow[] }> {
    const trip = await this.db.selectFrom('te.trips').selectAll().where('id', '=', id).executeTakeFirst();
    if (!trip) throw new NotFoundError(`Trip #${String(id)} not found`);
    const itineraries = await this.db.selectFrom('te.trip_itineraries').selectAll().where('trip_id', '=', id).orderBy('departure_date', 'asc').execute();
    const advances = await this.db.selectFrom('te.advances').selectAll().where('trip_id', '=', id).orderBy('id', 'asc').execute();
    return { trip, itineraries, advances };
  }

  /** Raises a trip and routes it through the travel approval chain ('travel_trip'). */
  async createTrip(input: CreateTripInput): Promise<TripRow> {
    const start = assertDate(input.startDate, 'Start date');
    const end = assertDate(input.endDate, 'End date');
    if (end < start) throw new DomainError('End date cannot be before the start date');
    const referenceNo = `TRIP-${start.slice(0, 4)}-${String(Date.now()).slice(-6)}${String(Math.floor(Math.random() * 90 + 10))}`;
    const country = input.destinationCountry ?? (input.travelType === 'domestic' ? 'India' : 'International');
    const region: 'domestic' | 'sea' | 'africa' | 'middle_east' | 'europe' | 'americas' | 'other' =
      input.travelType === 'domestic'
        ? 'domestic'
        : input.destinationRegion ?? (
            ['singapore', 'malaysia', 'thailand', 'vietnam', 'indonesia', 'philippines', 'sea'].some((c) => country.toLowerCase().includes(c))
              ? 'sea'
              : ['tanzania', 'nigeria', 'kenya', 'south africa', 'egypt', 'ghana', 'africa'].some((c) => country.toLowerCase().includes(c))
                ? 'africa'
                : 'other'
          );
    const estimatedPaise = input.estimatedBudgetPaise ?? 0;
    let tripId = 0;
    await createRequest(
      this.db,
      {
        definitionCode: 'travel_trip',
        subjectEmployeeId: input.employeeId,
        requestedByUserId: input.requestedByUserId,
        payload: {
          tripName: input.tripName,
          destinationCity: input.destinationCity,
          destinationCountry: country,
          travelType: input.travelType,
          destinationRegion: region,
          estimatedBudgetPaise: estimatedPaise,
          startDate: start,
          endDate: end,
        },
      },
      async (trx, requestId) => {
        const row = await trx
          .insertInto('te.trips')
          .values({
            reference_no: referenceNo,
            employee_id: input.employeeId,
            company_id: input.companyId,
            trip_name: input.tripName,
            travel_type: input.travelType,
            destination_region: region,
            purpose: input.purpose,
            destination_country: country,
            destination_city: input.destinationCity,
            start_date: sql<Date>`${start}::date`,
            end_date: sql<Date>`${end}::date`,
            visa_required: input.visaRequired ?? false,
            visa_status: input.visaRequired ? 'applied' : 'not_applicable',
            status: 'submitted',
            estimated_budget_paise: estimatedPaise,
            approved_budget_paise: 0,
            workflow_request_id: requestId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        tripId = row.id;
        await writeAudit(trx, { actorUserId: input.requestedByUserId, action: 'create', entity: 'te.trips', entityId: row.id, newValue: referenceNo });
      },
    );
    return (await this.getTripById(tripId)).trip;
  }

  async addItinerary(input: AddItineraryInput): Promise<ItineraryRow> {
    const trip = await this.db.selectFrom('te.trips').selectAll().where('id', '=', input.tripId).executeTakeFirst();
    if (!trip) throw new NotFoundError(`Trip #${String(input.tripId)} not found`);
    if (trip.employee_id !== input.actorEmployeeId) throw new ForbiddenError('You can only change your own trips');
    if (!['draft', 'submitted', 'approved', 'in_progress'].includes(trip.status)) {
      throw new ConflictError(`Cannot add segments to a ${trip.status} trip`);
    }
    const departure = assertDate(input.departureDate, 'Departure date');
    assertWithinTrip(trip, departure, 'Departure date');
    let arrival: string | null = null;
    if (input.arrivalDate) {
      arrival = assertDate(input.arrivalDate, 'Arrival date');
      if (arrival < departure) throw new DomainError('Arrival date cannot be before the departure date');
      assertWithinTrip(trip, arrival, 'Arrival date');
    }
    const cost = input.estimatedCostPaise ?? 0;
    if (!Number.isInteger(cost) || cost < 0) throw new DomainError('Estimated cost must be a non-negative whole number of paise');
    return inTransaction(this.db, async (trx) => {
      const segment = await trx
        .insertInto('te.trip_itineraries')
        .values({
          trip_id: input.tripId,
          segment_type: input.segmentType,
          origin: input.origin,
          destination: input.destination,
          departure_date: sql<Date>`${departure}::date`,
          arrival_date: arrival ? sql<Date>`${arrival}::date` : null,
          provider: input.provider ?? null,
          booking_reference: input.bookingReference ?? null,
          estimated_cost_paise: cost,
          actual_cost_paise: 0,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await trx
        .updateTable('te.trips')
        .set({ estimated_budget_paise: sql<number>`estimated_budget_paise + ${cost}`, updated_at: new Date() })
        .where('id', '=', input.tripId)
        .execute();
      return segment;
    });
  }

  async cancelTrip(tripId: number, reason: string, costPaise = 0): Promise<TripRow> {
    const trip = await this.db.selectFrom('te.trips').selectAll().where('id', '=', tripId).executeTakeFirst();
    if (!trip) throw new NotFoundError(`Trip #${String(tripId)} not found`);
    return await this.db
      .updateTable('te.trips')
      .set({ status: 'cancelled', cancellation_reason: reason, cancellation_cost_paise: costPaise, updated_at: new Date() })
      .where('id', '=', tripId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async getBudgets(travelType?: 'domestic' | 'international'): Promise<BudgetRow[]> {
    let query = this.db.selectFrom('te.budgets').selectAll().where('is_active', '=', true);
    if (travelType) query = query.where('travel_type', '=', travelType);
    return await query.orderBy('grade_level', 'asc').execute();
  }

  /** Advance on the caller's OWN trip, routed RM → functional manager (P-23). */
  async requestAdvance(input: RequestAdvanceInput): Promise<AdvanceRow> {
    const trip = await this.db.selectFrom('te.trips').selectAll().where('id', '=', input.tripId).executeTakeFirst();
    if (!trip) throw new NotFoundError(`Trip #${String(input.tripId)} not found`);
    if (trip.employee_id !== input.employeeId) throw new ForbiddenError('You can only request an advance on your own trip');
    if (!['submitted', 'approved', 'in_progress'].includes(trip.status)) {
      throw new ConflictError(`Cannot request an advance on a ${trip.status} trip`);
    }
    if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) throw new DomainError('Advance amount must be a positive whole number of paise');
    let advanceId = 0;
    await createRequest(
      this.db,
      {
        definitionCode: 'travel_advance_domestic',
        subjectEmployeeId: input.employeeId,
        requestedByUserId: input.requestedByUserId,
        payload: { tripId: input.tripId, amountPaise: input.amountPaise, purpose: input.purpose },
      },
      async (trx, requestId) => {
        const row = await trx
          .insertInto('te.advances')
          .values({ trip_id: input.tripId, employee_id: input.employeeId, amount_paise: input.amountPaise, purpose: input.purpose, status: 'requested', workflow_request_id: requestId })
          .returning('id')
          .executeTakeFirstOrThrow();
        advanceId = row.id;
        await writeAudit(trx, { actorUserId: input.requestedByUserId, action: 'create', entity: 'te.advances', entityId: row.id, newValue: String(input.amountPaise) });
      },
    );
    return this.db.selectFrom('te.advances').selectAll().where('id', '=', advanceId).executeTakeFirstOrThrow();
  }

  /** Disburses an advance the approval chain already approved into the wallet (TE-08). */
  async approveAdvance(advanceId: number, approverUserId: number): Promise<AdvanceRow> {
    return inTransaction(this.db, async (trx) => {
      const advance = await trx.selectFrom('te.advances').selectAll().where('id', '=', advanceId).forUpdate().executeTakeFirst();
      if (!advance) throw new NotFoundError(`Advance #${String(advanceId)} not found`);
      if (advance.status === 'disbursed') throw new ConflictError(`Advance #${String(advanceId)} is already disbursed`);
      if (advance.status !== 'approved') {
        throw new ConflictError(`Advance #${String(advanceId)} is ${advance.status}; it must be approved by the reporting manager chain before disbursal`);
      }
      const approver = await trx.selectFrom('core.users').select('employee_id').where('id', '=', approverUserId).executeTakeFirst();
      if (approver?.employee_id === advance.employee_id) throw new ForbiddenError('You cannot disburse your own advance');
      await new WalletService(trx).credit({
        employeeId: advance.employee_id,
        amountPaise: advance.amount_paise,
        source: 'ADVANCE',
        transactionReference: `TX-ADV-${String(advance.id)}`,
        tripId: advance.trip_id,
        notes: `Advance disbursed for Trip #${String(advance.trip_id)}: ${advance.purpose}`,
      });
      await writeAudit(trx, { actorUserId: approverUserId, action: 'disburse', entity: 'te.advances', entityId: advance.id, newValue: String(advance.amount_paise) });
      return await trx
        .updateTable('te.advances')
        .set({ status: 'disbursed', disbursed_at: new Date(), updated_at: new Date() })
        .where('id', '=', advanceId)
        .returningAll()
        .executeTakeFirstOrThrow();
    });
  }

  async getAdvances(filters?: { employeeId?: number | undefined; tripId?: number | undefined; scope?: EmployeeScope | undefined }): Promise<AdvanceRow[]> {
    let query = this.db.selectFrom('te.advances').selectAll();
    if (filters?.employeeId) query = query.where('employee_id', '=', filters.employeeId);
    if (filters?.scope) query = query.where(scopeFilter(filters.scope));
    if (filters?.tripId) query = query.where('trip_id', '=', filters.tripId);
    return await query.orderBy('id', 'desc').execute();
  }
}
