import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Checkbox, DatePicker, Select, TextField, Textarea, toast } from '../../ui';
import { apiFetch } from '../../lib/api';
import {
  formatPaise,
  inclusiveDays,
  monthBounds,
  monthOptions,
  rupeesToPaise,
  type BudgetItem,
} from './travel-model';

interface BudgetFormErrors {
  travelMonth?: string;
  purpose?: string;
  origin?: string;
  destination?: string;
  region?: string;
  country?: string;
  startDate?: string;
  endDate?: string;
  airfare?: string;
  hotelRate?: string;
  allowance?: string;
  visaCost?: string;
  nights?: string;
}

const REGIONS = [
  { value: 'sea', label: 'South-East Asia' },
  { value: 'africa', label: 'Africa' },
  { value: 'middle_east', label: 'Middle East' },
  { value: 'europe', label: 'Europe' },
  { value: 'americas', label: 'Americas' },
  { value: 'other', label: 'Other' },
];

/**
 * Create Budget — the live EMS request. Domestic or international, one travel
 * month, then airfare, hotel, daily allowance and visa. Draft or submit.
 */
export function CreateBudgetPanel({ onSaved }: { onSaved: () => void }) {
  const navigate = useNavigate();
  const months = useMemo(() => monthOptions(), []);
  const [travelType, setTravelType] = useState<'domestic' | 'international'>('domestic');
  const [travelMonth, setTravelMonth] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [purpose, setPurpose] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [country, setCountry] = useState('India');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [airfare, setAirfare] = useState('');
  const [hotelRate, setHotelRate] = useState('');
  const [nights, setNights] = useState('');
  const [allowance, setAllowance] = useState('');
  const [visaCost, setVisaCost] = useState('');
  const [visaRequired, setVisaRequired] = useState(false);
  const [justification, setJustification] = useState('');
  const [errors, setErrors] = useState<BudgetFormErrors>({});
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null);

  const bounds = travelMonth ? monthBounds(travelMonth) : null;
  const days = startDate && endDate ? inclusiveDays(startDate, endDate) : 0;
  const nightCount = nights.trim() === '' ? 0 : Number(nights);
  const airfarePaise = rupeesToPaise(airfare);
  const hotelPaise = rupeesToPaise(hotelRate);
  const allowancePaise = rupeesToPaise(allowance);
  const visaPaise = travelType === 'international' ? rupeesToPaise(visaCost) : 0;
  const totalPaise =
    airfarePaise !== null && hotelPaise !== null && allowancePaise !== null && visaPaise !== null && Number.isInteger(nightCount) && days > 0
      ? airfarePaise + hotelPaise * nightCount + allowancePaise * days + visaPaise
      : airfarePaise !== null && hotelPaise !== null && allowancePaise !== null && visaPaise !== null
        ? airfarePaise + (Number.isInteger(nightCount) ? hotelPaise * nightCount : 0) + visaPaise
        : 0;

  const validate = (): boolean => {
    const next: BudgetFormErrors = {};
    if (!travelMonth) next.travelMonth = 'Select a travel month';
    if (purpose.trim().length < 5) next.purpose = 'Purpose must be at least 5 characters';
    if (origin.trim().length < 2) next.origin = 'Enter where you are travelling from';
    if (destination.trim().length < 2) next.destination = 'Enter where you are travelling to';
    if (travelType === 'international' && !region) next.region = 'Select a region';
    if (travelType === 'international' && country.trim().length < 2) next.country = 'Enter the destination country';
    if (!startDate) next.startDate = 'Select a travel start date';
    if (!endDate) next.endDate = 'Select a travel end date';
    if (startDate && endDate && endDate < startDate) next.endDate = 'Travel end cannot be before travel start';
    if (travelMonth && startDate && !startDate.startsWith(travelMonth)) next.startDate = 'Travel start must fall in the travel month';
    if (travelMonth && endDate && !endDate.startsWith(travelMonth)) next.endDate = 'Travel end must fall in the travel month';
    if (airfarePaise === null) next.airfare = 'Enter a rupee amount with at most 2 decimals';
    if (hotelPaise === null) next.hotelRate = 'Enter a rupee amount with at most 2 decimals';
    if (allowancePaise === null) next.allowance = 'Enter a rupee amount with at most 2 decimals';
    if (visaPaise === null) next.visaCost = 'Enter a rupee amount with at most 2 decimals';
    if (nights.trim() !== '' && !/^\d+$/.test(nights.trim())) next.nights = 'Nights must be a whole number';
    if ((hotelPaise ?? 0) > 0 && nightCount < 1) next.nights = 'Number of nights is required when a hotel budget per night is entered';
    if (nightCount > 0 && (hotelPaise ?? 0) === 0) next.hotelRate = 'Hotel budget per night is required when the number of nights is entered';
    setErrors(next);
    return Object.values(next).every((value) => value === undefined);
  };

  const save = async (saveAs: 'draft' | 'submit') => {
    if (!validate()) return;
    if (saveAs === 'submit' && totalPaise <= 0) {
      toast.error('Add at least one budget item before submitting');
      return;
    }
    setSaving(saveAs);
    try {
      await apiFetch<{ trip: BudgetItem }>('/api/travel/trips', {
        method: 'POST',
        body: JSON.stringify({
          tripName: `${origin.trim()} to ${destination.trim()}`,
          travelType,
          destinationRegion: travelType === 'domestic' ? 'domestic' : region,
          purpose: purpose.trim(),
          destinationCountry: travelType === 'domestic' ? 'India' : country.trim(),
          destinationCity: destination.trim(),
          originCity: origin.trim(),
          travelMonth,
          startDate,
          endDate,
          visaRequired: travelType === 'international' && (visaRequired || (visaPaise ?? 0) > 0),
          airfarePaise: airfarePaise ?? 0,
          hotelPerNightPaise: hotelPaise ?? 0,
          hotelNights: nightCount,
          dailyAllowancePerDayPaise: allowancePaise ?? 0,
          visaCostPaise: visaPaise ?? 0,
          overLimitJustification: justification.trim() || undefined,
          saveAs,
        }),
      });
      toast.success(saveAs === 'draft' ? 'Budget saved as draft' : 'Budget submitted for approval');
      onSaved();
      void navigate('/travel/budgets');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not save the budget');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-8">
      <FormGroup title="Journey">
        <Select
          label="Travel type"
          required
          value={travelType}
          onChange={(value) => {
            const next = value === 'international' ? 'international' : 'domestic';
            setTravelType(next);
            if (next === 'domestic') setCountry('India');
          }}
          options={[
            { value: 'domestic', label: 'Domestic' },
            { value: 'international', label: 'International' },
          ]}
        />
        <Select
          label="Travel month"
          required
          value={travelMonth}
          onChange={setTravelMonth}
          options={months}
          error={errors.travelMonth}
          placeholder="Select a travel month"
        />
        {travelType === 'international' && (
          <Select label="Region" required value={region} onChange={setRegion} options={REGIONS} error={errors.region} placeholder="Select a region" />
        )}
        <TextField label="Purpose of travel" required value={purpose} onChange={(e) => { setPurpose(e.target.value); }} error={errors.purpose} className="sm:col-span-2" />
        <TextField label="Travel from" required value={origin} onChange={(e) => { setOrigin(e.target.value); }} error={errors.origin} />
        <TextField label="Travel to" required value={destination} onChange={(e) => { setDestination(e.target.value); }} error={errors.destination} />
        {travelType === 'international' && (
          <TextField label="Country" required value={country} onChange={(e) => { setCountry(e.target.value); }} error={errors.country} />
        )}
      </FormGroup>
      <FormGroup title="When">
        <DatePicker label="Travel start" required value={startDate} onChange={setStartDate} min={bounds?.min} max={bounds?.max} error={errors.startDate} disabled={!travelMonth} hint={travelMonth ? undefined : 'Select a travel month first'} />
        <DatePicker label="Travel end" required value={endDate} onChange={setEndDate} min={startDate ?? bounds?.min} max={bounds?.max} error={errors.endDate} disabled={!startDate} hint={startDate ? undefined : 'Select a travel start date first'} />
      </FormGroup>
      <FormGroup title="Cost">
        <TextField label="Lowest logical airfare (₹)" inputMode="decimal" value={airfare} onChange={(e) => { setAirfare(e.target.value); }} error={errors.airfare} hint="Leave blank if you are not flying" />
        <TextField label="Hotel budget / night (₹)" inputMode="decimal" value={hotelRate} onChange={(e) => { setHotelRate(e.target.value); }} error={errors.hotelRate} />
        <TextField label="No. of nights" inputMode="numeric" value={nights} onChange={(e) => { setNights(e.target.value); }} error={errors.nights} />
        <TextField label="Total hotel budget" value={hotelPaise !== null && Number.isInteger(nightCount) ? formatPaise(hotelPaise * nightCount) : '—'} disabled />
        <TextField label="Daily allowance / day (₹)" inputMode="decimal" value={allowance} onChange={(e) => { setAllowance(e.target.value); }} error={errors.allowance} />
        <TextField label="Total daily allowance" value={allowancePaise !== null && days > 0 ? formatPaise(allowancePaise * days) : '—'} disabled hint={days > 0 ? `${String(days)} travel days` : 'Set travel dates to total the allowance'} />
        {travelType === 'international' && (
          <>
            <Checkbox label="Visa required" checked={visaRequired} onChange={(e) => { setVisaRequired(e.target.checked); }} />
            <TextField label="Visa cost (₹)" inputMode="decimal" value={visaCost} onChange={(e) => { setVisaCost(e.target.value); }} error={errors.visaCost} />
          </>
        )}
        <Textarea
          label="Justification"
          value={justification}
          onChange={(e) => { setJustification(e.target.value); }}
          hint="Explain why the daily spend exceeds the approved limit, when it does."
          className="sm:col-span-2"
          maxLength={500}
        />
      </FormGroup>
      <div className="flex items-end justify-between gap-4 rounded-card bg-surface-2 px-5 py-4">
        <p className="text-sm text-ink-muted">Estimated budget</p>
        <p className="font-mono text-3xl font-light tabular-nums text-ink">{formatPaise(totalPaise)}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" loading={saving === 'submit'} disabled={saving !== null} onClick={() => { void save('submit'); }}>
          Submit budget
        </Button>
        <Button variant="secondary" loading={saving === 'draft'} disabled={saving !== null} onClick={() => { void save('draft'); }}>
          Save draft
        </Button>
      </div>
    </div>
  );
}

function FormGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-lg font-light tracking-tight text-ink">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
