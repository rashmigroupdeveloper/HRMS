/**
 * Travel & Trip Management Service (TE-01..07).
 *
 * Implements:
 * 1. Trip request creation, itinerary segments, and status lifecycle.
 * 2. Grade-based budget allowances (TE-05).
 * 3. Travel advance workflow (TE-07) with automated wallet crediting on approval.
 */

import type { Database, TeTripsTable, TeTripItinerariesTable, TeBudgetsTable, TeAdvancesTable } from '../../core/db/types.js';
import type { Kysely, Selectable } from 'kysely';
import { WalletService } from './wallet.service.js';

export type TripRow = Selectable<TeTripsTable>;
export type ItineraryRow = Selectable<TeTripItinerariesTable>;
export type BudgetRow = Selectable<TeBudgetsTable>;
export type AdvanceRow = Selectable<TeAdvancesTable>;

export interface CreateTripInput {
  employeeId: number;
  companyId: number;
  tripName: string;
  travelType: 'domestic' | 'international';
  purpose: string;
  destinationCountry?: string | undefined;
  destinationCity: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  visaRequired?: boolean | undefined;
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
}

export interface RequestAdvanceInput {
  tripId: number;
  employeeId: number;
  amountPaise: number;
  purpose: string;
}

export class TravelService {
  private readonly walletService: WalletService;

  constructor(private readonly db: Kysely<Database>) {
    this.walletService = new WalletService(db);
  }

  /**
   * Retrieves list of trips with optional filters.
   */
  async getTrips(filters?: { employeeId?: number | undefined; status?: TripRow['status'] | 'all' | undefined }): Promise<TripRow[]> {
    let query = this.db.selectFrom('te.trips').selectAll();

    if (filters?.employeeId) {
      query = query.where('employee_id', '=', filters.employeeId);
    }
    if (filters?.status && filters.status !== 'all') {
      query = query.where('status', '=', filters.status);
    }

    return await query.orderBy('id', 'desc').execute();
  }

  /**
   * Retrieves single trip with itineraries and advances.
   */
  async getTripById(id: number): Promise<{
    trip: TripRow;
    itineraries: ItineraryRow[];
    advances: AdvanceRow[];
  }> {
    const trip = await this.db
      .selectFrom('te.trips')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!trip) {
      throw new Error(`Trip #${id} not found`);
    }

    const itineraries = await this.db
      .selectFrom('te.trip_itineraries')
      .selectAll()
      .where('trip_id', '=', id)
      .orderBy('departure_date', 'asc')
      .execute();

    const advances = await this.db
      .selectFrom('te.advances')
      .selectAll()
      .where('trip_id', '=', id)
      .orderBy('id', 'asc')
      .execute();

    return { trip, itineraries, advances };
  }

  /**
   * Creates a new trip request.
   */
  async createTrip(input: CreateTripInput): Promise<TripRow> {
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    const referenceNo = `TRIP-${year}-${rand}`;

    return await this.db
      .insertInto('te.trips')
      .values({
        reference_no: referenceNo,
        employee_id: input.employeeId,
        company_id: input.companyId,
        trip_name: input.tripName,
        travel_type: input.travelType,
        purpose: input.purpose,
        destination_country: input.destinationCountry ?? 'India',
        destination_city: input.destinationCity,
        start_date: new Date(input.startDate),
        end_date: new Date(input.endDate),
        visa_required: input.visaRequired ?? false,
        visa_status: input.visaRequired ? 'applied' : 'not_applicable',
        status: 'submitted',
        estimated_budget_paise: 0,
        approved_budget_paise: 0,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /**
   * Adds an itinerary segment to a trip.
   */
  async addItinerary(input: AddItineraryInput): Promise<ItineraryRow> {
    const trip = await this.db
      .selectFrom('te.trips')
      .selectAll()
      .where('id', '=', input.tripId)
      .executeTakeFirst();

    if (!trip) {
      throw new Error(`Trip #${input.tripId} not found`);
    }

    const cost = input.estimatedCostPaise ?? 0;

    const segment = await this.db
      .insertInto('te.trip_itineraries')
      .values({
        trip_id: input.tripId,
        segment_type: input.segmentType,
        origin: input.origin,
        destination: input.destination,
        departure_date: new Date(input.departureDate),
        arrival_date: input.arrivalDate ? new Date(input.arrivalDate) : null,
        provider: input.provider ?? null,
        booking_reference: input.bookingReference ?? null,
        estimated_cost_paise: cost,
        actual_cost_paise: 0,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Update trip estimated budget
    const newBudget = trip.estimated_budget_paise + cost;
    await this.db
      .updateTable('te.trips')
      .set({
        estimated_budget_paise: newBudget,
        updated_at: new Date(),
      })
      .where('id', '=', input.tripId)
      .execute();

    return segment;
  }

  /**
   * Approves a trip request.
   */
  async approveTrip(tripId: number, approverUserId: number): Promise<TripRow> {
    // Deferred T&E: actor persistence/approval workflow still requires implementation.
    void approverUserId;
    const trip = await this.db
      .selectFrom('te.trips')
      .selectAll()
      .where('id', '=', tripId)
      .executeTakeFirst();

    if (!trip) {
      throw new Error(`Trip #${tripId} not found`);
    }

    return await this.db
      .updateTable('te.trips')
      .set({
        status: 'approved',
        approved_budget_paise: trip.estimated_budget_paise,
        updated_at: new Date(),
      })
      .where('id', '=', tripId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /**
   * Cancels a trip request.
   */
  async cancelTrip(tripId: number, reason: string, costPaise = 0): Promise<TripRow> {
    const trip = await this.db
      .selectFrom('te.trips')
      .selectAll()
      .where('id', '=', tripId)
      .executeTakeFirst();

    if (!trip) {
      throw new Error(`Trip #${tripId} not found`);
    }

    return await this.db
      .updateTable('te.trips')
      .set({
        status: 'cancelled',
        cancellation_reason: reason,
        cancellation_cost_paise: costPaise,
        updated_at: new Date(),
      })
      .where('id', '=', tripId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /**
   * Retrieves active budget rules by grade.
   */
  async getBudgets(travelType?: 'domestic' | 'international'  ): Promise<BudgetRow[]> {
    let query = this.db.selectFrom('te.budgets').selectAll().where('is_active', '=', true);

    if (travelType) {
      query = query.where('travel_type', '=', travelType);
    }

    return await query.orderBy('grade_level', 'asc').execute();
  }

  /**
   * Requests a travel advance linked to a trip (TE-07).
   */
  async requestAdvance(input: RequestAdvanceInput): Promise<AdvanceRow> {
    const trip = await this.db
      .selectFrom('te.trips')
      .selectAll()
      .where('id', '=', input.tripId)
      .executeTakeFirst();

    if (!trip) {
      throw new Error(`Trip #${input.tripId} not found`);
    }

    return await this.db
      .insertInto('te.advances')
      .values({
        trip_id: input.tripId,
        employee_id: input.employeeId,
        amount_paise: input.amountPaise,
        purpose: input.purpose,
        status: 'requested',
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /**
   * Approves a travel advance and automatically credits the employee wallet (TE-08).
   */
  async approveAdvance(advanceId: number, approverUserId: number): Promise<AdvanceRow> {
    // Deferred T&E: actor persistence/approval workflow still requires implementation.
    void approverUserId;
    const advance = await this.db
      .selectFrom('te.advances')
      .selectAll()
      .where('id', '=', advanceId)
      .executeTakeFirst();

    if (!advance) {
      throw new Error(`Advance #${advanceId} not found`);
    }

    if (advance.status === 'approved' || advance.status === 'disbursed') {
      throw new Error(`Advance #${advanceId} is already approved`);
    }

    // 1. Credit the employee wallet via WalletService
    const txRef = `TX-ADV-${advance.id}-${Date.now()}`;
    await this.walletService.credit({
      employeeId: advance.employee_id,
      amountPaise: advance.amount_paise,
      source: 'ADVANCE',
      transactionReference: txRef,
      tripId: advance.trip_id,
      notes: `Advance disbursed for Trip #${advance.trip_id}: ${advance.purpose}`,
    });

    // 2. Mark advance as approved / disbursed
    return await this.db
      .updateTable('te.advances')
      .set({
        status: 'disbursed',
        disbursed_at: new Date(),
        updated_at: new Date(),
      })
      .where('id', '=', advanceId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /**
   * Retrieves advances list.
   */
  async getAdvances(filters?: { employeeId?: number | undefined; tripId?: number | undefined }): Promise<AdvanceRow[]> {
    let query = this.db.selectFrom('te.advances').selectAll();

    if (filters?.employeeId) {
      query = query.where('employee_id', '=', filters.employeeId);
    }
    if (filters?.tripId) {
      query = query.where('trip_id', '=', filters.tripId);
    }

    return await query.orderBy('id', 'desc').execute();
  }
}
