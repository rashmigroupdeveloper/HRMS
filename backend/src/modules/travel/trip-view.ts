import type { TripRow } from './travel.service.js';

/** API shape for a budget request (stored on te.trips). */
export function tripView(t: TripRow) {
  return {
    id: t.id,
    referenceNo: t.reference_no,
    employeeId: t.employee_id,
    companyId: t.company_id,
    tripName: t.trip_name,
    travelType: t.travel_type,
    destinationRegion: t.destination_region,
    purpose: t.purpose,
    destinationCountry: t.destination_country,
    destinationCity: t.destination_city,
    travelMonth: t.travel_month,
    originCity: t.origin_city,
    airfarePaise: t.airfare_paise,
    hotelPerNightPaise: t.hotel_per_night_paise,
    hotelNights: t.hotel_nights,
    dailyAllowancePerDayPaise: t.daily_allowance_per_day_paise,
    visaCostPaise: t.visa_cost_paise,
    overLimitJustification: t.over_limit_justification,
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
  };
}
