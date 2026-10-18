/**
 * Travel & Expense (M13, TE-01..12) — Warm Editorial Design System.
 *
 * Implements:
 * 1. Trip planning & itineraries (TE-01..04).
 * 2. Advance requests & wallet credit on approval (TE-07, TE-08).
 * 3. Expense claims & multi-currency receipts (TE-10).
 * 4. Automated settlement engine (TE-09) & immutable wallet transaction ledger.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  MapPin,
  Plane,
  Plus,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  DarkCard,
  DataTable,
  Drawer,
  EmptyState,
  PageHeader,
  StatusBadge,
  TextField,
  Select,
  toast,
  type Column,
  type StatusTone,
  StatGrid, StatTile,
} from '../../ui';
import { apiFetch } from '../../lib/api';

type Tab = 'trips' | 'advances' | 'claims' | 'wallet';

interface TripItem {
  id: number;
  referenceNo: string;
  tripName: string;
  travelType: 'domestic' | 'international';
  purpose: string;
  destinationCountry: string;
  destinationCity: string;
  startDate: string;
  endDate: string;
  visaRequired: boolean;
  status: string;
  estimatedBudgetPaise: number;
  approvedBudgetPaise: number;
  createdAt: string;
}

interface AdvanceItem {
  id: number;
  tripId: number;
  amountPaise: number;
  purpose: string;
  status: string;
  disbursedAt?: string | null;
  createdAt: string;
}

interface ClaimItem {
  id: number;
  referenceNo: string;
  tripId: number;
  totalClaimedPaise: number;
  approvedAmountPaise: number;
  advanceAdjustedPaise: number;
  netPayablePaise: number;
  netRecoverablePaise: number;
  status: string;
  settlementStatus: string;
  createdAt: string;
}

interface WalletLedgerItem {
  id: number;
  source: string;
  type: 'credit' | 'debit';
  amountPaise: number;
  balanceAfterPaise: number;
  transactionReference: string;
  notes?: string | null;
  createdAt: string;
}

const TABS: { code: Tab; label: string; icon: typeof Plane }[] = [
  { code: 'trips', label: 'Trips', icon: Plane },
  { code: 'advances', label: 'Advances', icon: CreditCard },
  { code: 'claims', label: 'Claims', icon: FileText },
  { code: 'wallet', label: 'Travel Wallet', icon: Wallet },
];

export function TravelPage() {
  const [tab, setTab] = useState<Tab>('trips');
  const [isLoading, setIsLoading] = useState(false);

  // Data states
  const [trips, setTrips] = useState<TripItem[]>([]);
  const [advances, setAdvances] = useState<AdvanceItem[]>([]);
  const [claims, setClaims] = useState<ClaimItem[]>([]);
  const [walletBalancePaise, setWalletBalancePaise] = useState<number>(0);
  const [walletLedger, setWalletLedger] = useState<WalletLedgerItem[]>([]);

  // Drawers
  const [showNewTripDrawer, setShowNewTripDrawer] = useState(false);
  const [showNewAdvanceDrawer, setShowNewAdvanceDrawer] = useState(false);
  const [showNewClaimDrawer, setShowNewClaimDrawer] = useState(false);

  // Form inputs
  const [tripName, setTripName] = useState('');
  const [travelType, setTravelType] = useState<'domestic' | 'international'>('domestic');
  const [purpose, setPurpose] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));

  const [advanceTripId, setAdvanceTripId] = useState<number | ''>('');
  const [advanceAmountRupees, setAdvanceAmountRupees] = useState('');
  const [advancePurpose, setAdvancePurpose] = useState('');

  const [claimTripId, setClaimTripId] = useState<number | ''>('');
  const [claimCategory, setClaimCategory] = useState<'hotel' | 'flight' | 'train' | 'food' | 'misc'>('hotel');
  const [claimAmountRupees, setClaimAmountRupees] = useState('');
  const [claimDescription, setClaimDescription] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Load Trips
      const tripsRes = await apiFetch<{ items: TripItem[] }>('/api/travel/trips');
      if (Array.isArray(tripsRes.items)) {
        setTrips(tripsRes.items);
      }

      // 2. Load Advances
      const advRes = await apiFetch<{ items: AdvanceItem[] }>('/api/travel/advances');
      if (Array.isArray(advRes.items)) {
        setAdvances(advRes.items);
      }

      // 3. Load Claims
      const claimsRes = await apiFetch<{ items: ClaimItem[] }>('/api/travel/claims');
      if (Array.isArray(claimsRes.items)) {
        setClaims(claimsRes.items);
      }

      // 4. Load Wallet & Ledger
      const walletRes = await apiFetch<{ balancePaise: number }>('/api/travel/wallet');
      if (typeof walletRes.balancePaise === 'number') {
        setWalletBalancePaise(walletRes.balancePaise);
      }

      const ledgerRes = await apiFetch<{ transactions: WalletLedgerItem[] }>('/api/travel/wallet/ledger');
      if (Array.isArray(ledgerRes.transactions)) {
        setWalletLedger(ledgerRes.transactions);
      }
    } catch (e: unknown) {
      // No sample data: show the real failure.
      toast.error(e instanceof Error ? e.message : 'Could not load data. Please retry.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Handle Trip Submission
  const handleCreateTrip = async () => {
    if (!tripName.trim() || !destinationCity.trim()) {
      toast.error('Details required', { description: 'Please enter trip name and destination' });
      return;
    }
    try {
      await apiFetch('/api/travel/trips', {
        method: 'POST',
        body: JSON.stringify({
          tripName,
          travelType,
          purpose,
          destinationCity,
          startDate,
          endDate,
        }),
      });
      toast.success('Trip Created', { description: 'Travel request submitted for approval.' });
      setShowNewTripDrawer(false);
      setTripName('');
      setPurpose('');
      setDestinationCity('');
      void loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Creation failed';
      toast.error('Failed to create trip', { description: msg });
    }
  };

  // Handle Advance Request
  const handleRequestAdvance = async () => {
    if (!advanceTripId) {
      toast.error('Trip required', { description: 'Please select an associated trip' });
      return;
    }
    const amountPaise = Math.round(Number(advanceAmountRupees) * 100);
    try {
      await apiFetch('/api/travel/advances', {
        method: 'POST',
        body: JSON.stringify({
          tripId: advanceTripId,
          amountPaise,
          purpose: advancePurpose || 'Travel expense advance',
        }),
      });
      toast.success('Advance Requested', {
        description: `Advance of ₹${Number(advanceAmountRupees).toLocaleString('en-IN')} submitted.`,
      });
      setShowNewAdvanceDrawer(false);
      void loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      toast.error('Failed to request advance', { description: msg });
    }
  };

  // Handle Claim Submission
  const handleCreateClaim = async () => {
    if (!claimTripId) {
      toast.error('Trip required', { description: 'Please select an associated trip' });
      return;
    }
    try {
      const claim = await apiFetch<{ claim: { id: number } }>('/api/travel/claims', {
        method: 'POST',
        body: JSON.stringify({ tripId: claimTripId }),
      });

      // Add expense line item
      const amountPaise = Math.round(Number(claimAmountRupees) * 100);
      await apiFetch(`/api/travel/claims/${String(claim.claim.id)}/items`, {
        method: 'POST',
        body: JSON.stringify({
          claimId: claim.claim.id,
          category: claimCategory,
          itemDate: new Date().toISOString().slice(0, 10),
          amountPaise,
          description: claimDescription,
        }),
      });

      toast.success('Claim Filed', {
        description: `Expense claim created with item ₹${Number(claimAmountRupees).toLocaleString('en-IN')}.`,
      });
      setShowNewClaimDrawer(false);
      void loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Filing failed';
      toast.error('Failed to file claim', { description: msg });
    }
  };

  // Table Columns
  const tripColumns: Column<TripItem>[] = [
    {
      key: 'reference',
      header: 'Reference',
      render: (r: TripItem) => (
        <span className="font-mono text-xs font-semibold text-ink">{r.referenceNo}</span>
      ),
    },
    {
      key: 'tripName',
      header: 'Trip Name',
      render: (r: TripItem) => (
        <div>
          <p className="font-medium text-ink">{r.tripName}</p>
          <p className="text-xs text-ink-muted truncate max-w-xs">{r.purpose}</p>
        </div>
      ),
    },
    {
      key: 'travelType',
      header: 'Type',
      render: (r: TripItem) => (
        <span className="capitalize text-xs text-ink-muted font-medium">
          {r.travelType}
        </span>
      ),
    },
    {
      key: 'destination',
      header: 'Destination',
      render: (r: TripItem) => (
        <div className="flex items-center gap-1.5 text-xs text-ink">
          <MapPin className="h-3.5 w-3.5 text-ink-muted" />
          <span>{r.destinationCity}</span>
        </div>
      ),
    },
    {
      key: 'dates',
      header: 'Dates',
      render: (r: TripItem) => (
        <span className="text-xs text-ink-muted">
          {r.startDate} to {r.endDate}
        </span>
      ),
    },
    {
      key: 'budget',
      header: 'Budget',
      numeric: true,
      render: (r: TripItem) => (
        <span className="font-mono text-xs font-medium text-ink">
          ₹{(r.estimatedBudgetPaise / 100).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r: TripItem) => {
        const tone: StatusTone =
          r.status === 'approved' ? 'positive' : r.status === 'cancelled' ? 'negative' : 'warning';
        return <StatusBadge tone={tone}>{r.status}</StatusBadge>;
      },
    },
  ];

  const advanceColumns: Column<AdvanceItem>[] = [
    {
      key: 'tripId',
      header: 'Trip ID',
      render: (r: AdvanceItem) => <span className="font-mono text-xs text-ink">Trip #{r.tripId}</span>,
    },
    {
      key: 'purpose',
      header: 'Purpose',
      render: (r: AdvanceItem) => <span className="text-sm text-ink">{r.purpose}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      numeric: true,
      render: (r: AdvanceItem) => (
        <span className="font-mono text-xs font-semibold text-ink">
          ₹{(r.amountPaise / 100).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r: AdvanceItem) => {
        const tone: StatusTone =
          r.status === 'disbursed' || r.status === 'approved' ? 'positive' : 'warning';
        return <StatusBadge tone={tone}>{r.status}</StatusBadge>;
      },
    },
    {
      key: 'createdAt',
      header: 'Requested At',
      render: (r: AdvanceItem) => (
        <span className="text-xs text-ink-muted">{new Date(r.createdAt).toLocaleDateString()}</span>
      ),
    },
  ];

  const claimColumns: Column<ClaimItem>[] = [
    {
      key: 'referenceNo',
      header: 'Claim Ref',
      render: (r: ClaimItem) => <span className="font-mono text-xs font-semibold text-ink">{r.referenceNo}</span>,
    },
    {
      key: 'totalClaimed',
      header: 'Total Claimed',
      numeric: true,
      render: (r: ClaimItem) => (
        <span className="font-mono text-xs font-medium text-ink">
          ₹{(r.totalClaimedPaise / 100).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'advanceAdjusted',
      header: 'Adjusted Advance',
      numeric: true,
      render: (r: ClaimItem) => (
        <span className="font-mono text-xs text-ink-muted">
          ₹{(r.advanceAdjustedPaise / 100).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'netSettlement',
      header: 'Net Settlement',
      numeric: true,
      render: (r: ClaimItem) => {
        if (r.netPayablePaise > 0) {
          return (
            <span className="font-mono text-xs text-positive-ink font-medium">
              +₹{(r.netPayablePaise / 100).toLocaleString('en-IN')} (Payable)
            </span>
          );
        }
        if (r.netRecoverablePaise > 0) {
          return (
            <span className="font-mono text-xs text-negative-ink font-medium">
              -₹{(r.netRecoverablePaise / 100).toLocaleString('en-IN')} (Payroll Deduction)
            </span>
          );
        }
        return <span className="font-mono text-xs text-ink-muted">₹0 (Zero Parity)</span>;
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (r: ClaimItem) => {
        const tone: StatusTone = r.settlementStatus === 'settled' ? 'positive' : 'warning';
        return <StatusBadge tone={tone}>{r.settlementStatus}</StatusBadge>;
      },
    },
  ];

  const ledgerColumns: Column<WalletLedgerItem>[] = [
    {
      key: 'createdAt',
      header: 'Date & Time',
      render: (r: WalletLedgerItem) => (
        <span className="text-xs text-ink-muted">
          {new Date(r.createdAt).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </span>
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (r: WalletLedgerItem) => <span className="font-mono text-xs text-ink">{r.transactionReference}</span>,
    },
    {
      key: 'source',
      header: 'Source',
      render: (r: WalletLedgerItem) => <span className="text-xs font-medium text-ink">{r.source}</span>,
    },
    {
      key: 'movement',
      header: 'Movement',
      render: (r: WalletLedgerItem) => (
        <StatusBadge tone={r.type === 'credit' ? 'positive' : 'warning'}>
          {r.type.toUpperCase()}
        </StatusBadge>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      numeric: true,
      render: (r: WalletLedgerItem) => {
        const prefix = r.type === 'credit' ? '+' : '-';
        const color = r.type === 'credit' ? 'text-positive-ink' : 'text-negative-ink';
        return (
          <span className={`font-mono text-xs font-semibold ${color}`}>
            {prefix}₹{(r.amountPaise / 100).toLocaleString('en-IN')}
          </span>
        );
      },
    },
    {
      key: 'balanceAfter',
      header: 'Balance After',
      numeric: true,
      render: (r: WalletLedgerItem) => (
        <span className="font-mono text-xs font-bold text-ink">
          ₹{(r.balanceAfterPaise / 100).toLocaleString('en-IN')}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Travel & Expense"
        title="Business travel"
        description="Plan trips, take an advance, add receipts and settle what you spent."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => void loadData()}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
              Sync
            </Button>
            <div className="flex min-w-0 max-w-full overflow-x-auto rounded-full bg-surface-2 p-1 [scrollbar-width:none] [&>*]:shrink-0">
              {TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <Button
                    key={t.code}
                    size="sm"
                    variant={tab === t.code ? 'primary' : 'ghost'}
                    onClick={() => { setTab(t.code); }}
                  >
                    <Icon className="h-3.5 w-3.5 mr-1.5" />
                    {t.label}
                  </Button>
                );
              })}
            </div>
          </div>
        }
      />

      {/* KPI Ribbon — the wallet is today's one gold figure (TE-08). */}
      <StatGrid>
        <StatTile label="Active trips" icon={<Briefcase />} value={trips.filter((t) => t.status !== 'cancelled').length} />
        <StatTile
          label="Disbursed advances"
          icon={<CreditCard />}
          value={advances.reduce((acc, a) => acc + (a.status === 'disbursed' ? a.amountPaise : 0), 0) / 100}
          prefix="₹"
        />
        <StatTile tone="hatched" label="Pending claims" icon={<Clock />} value={claims.filter((c) => c.settlementStatus === 'unsettled').length} />
        <StatTile tone="accent" label="Wallet balance" icon={<ShieldCheck />} value={walletBalancePaise / 100} prefix="₹" hint="Advances less settled claims" />
      </StatGrid>

      {/* Main Content by Tab */}
      {tab === 'trips' && (
        <Card>
          <CardHeader
            title="Business Trips"
            subtitle="Authoritative travel requisitions with grade-level policy adherence"
            action={
              <Button size="sm" onClick={() => { setShowNewTripDrawer(true); }}>
                <Plus className="h-4 w-4 mr-1.5" />
                Plan New Trip
              </Button>
            }
          />
          {trips.length === 0 ? (
            <EmptyState
              icon={<Plane className="h-6 w-6" />}
              title="No trips requested"
              description="Plan your next work trip to book flights, hotels, and request advances."
            />
          ) : (
            <DataTable
              columns={tripColumns}
              rows={trips}
              rowKey={(r) => String(r.id)}
            />
          )}
        </Card>
      )}

      {tab === 'advances' && (
        <Card>
          <CardHeader
            title="Travel Advances"
            subtitle="Approved advances automatically credit the employee travel wallet"
            action={
              <Button size="sm" onClick={() => { setShowNewAdvanceDrawer(true); }}>
                <Plus className="h-4 w-4 mr-1.5" />
                Request Advance
              </Button>
            }
          />
          {advances.length === 0 ? (
            <EmptyState
              icon={<CreditCard className="h-6 w-6" />}
              title="No advances on record"
              description="Request an advance against an approved trip to disburse funds into your wallet."
            />
          ) : (
            <DataTable
              columns={advanceColumns}
              rows={advances}
              rowKey={(r) => String(r.id)}
            />
          )}
        </Card>
      )}

      {tab === 'claims' && (
        <Card>
          <CardHeader
            title="Expense Claims & Reimbursements"
            subtitle="Itemized claims reconciled directly against advance balances in the wallet"
            action={
              <Button size="sm" onClick={() => { setShowNewClaimDrawer(true); }}>
                <Plus className="h-4 w-4 mr-1.5" />
                File Expense Claim
              </Button>
            }
          />
          {claims.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="No claims filed"
              description="Submit receipts and travel expenses against completed trips for settlement."
            />
          ) : (
            <DataTable
              columns={claimColumns}
              rows={claims}
              rowKey={(r) => String(r.id)}
            />
          )}
        </Card>
      )}

      {tab === 'wallet' && (
        <div className="space-y-6">
          <DarkCard padded={false} className="p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <p className="text-xs font-semibold text-hero-muted flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-positive-ink" />
                  Immutable Ledger Guarantee
                </p>
                <h3 className="mt-2 text-3xl font-light text-hero-ink font-mono">
                  ₹{(walletBalancePaise / 100).toLocaleString('en-IN')}
                </h3>
                <p className="mt-2 text-sm text-hero-muted max-w-xl">
                  Wallet balance is the strict mathematical sum of all ledger credits and debits. Any unspent advance is recovered via payroll deduction; excess approved expenses are disbursed as reimbursement.
                </p>
              </div>
              <div className="bg-surface-1/10 rounded-xl p-4 border border-white/10 text-xs space-y-2">
                <div className="flex items-center gap-2 text-hero-ink">
                  <CheckCircle2 className="h-4 w-4 text-positive-ink" />
                  <span>Append-Only DB Trigger Verified</span>
                </div>
                <div className="flex items-center gap-2 text-hero-ink">
                  <CheckCircle2 className="h-4 w-4 text-positive-ink" />
                  <span>Zero Write-off Reconciliation Policy</span>
                </div>
              </div>
            </div>
          </DarkCard>

          <Card>
            <CardHeader
              title="Wallet Audit Trail & Transaction Ledger"
              subtitle="Full chronological history of advances, claim settlements, and recoveries"
            />
            {walletLedger.length === 0 ? (
              <EmptyState
                icon={<Wallet className="h-6 w-6" />}
                title="Wallet ledger empty"
                description="Transactions will appear here as advances are disbursed and claims are settled."
              />
            ) : (
              <DataTable
                columns={ledgerColumns}
                rows={walletLedger}
                rowKey={(r) => String(r.id)}
              />
            )}
          </Card>
        </div>
      )}

      {/* Drawer: Plan New Trip */}
      <Drawer
        open={showNewTripDrawer}
        onClose={() => { setShowNewTripDrawer(false); }}
        title="Plan New Business Trip"
        subtitle="Domestic or International travel requisition"
      >
        <div className="space-y-4">
          <TextField
            label="Trip Title"
            value={tripName}
            onChange={(e) => { setTripName(e.target.value); }}
            placeholder="e.g. Kalinganagar Plant Audit"
          />

          <Select
            label="Travel Classification"
            value={travelType}
            onChange={(val) => { setTravelType(val as 'domestic' | 'international'); }}
            options={[
              { value: 'domestic', label: 'Domestic (India)' },
              { value: 'international', label: 'International' },
            ]}
          />

          <TextField
            label="Destination City"
            value={destinationCity}
            onChange={(e) => { setDestinationCity(e.target.value); }}
            placeholder="e.g. Jajpur, Odisha"
          />

          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Departure Date"
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); }}
            />
            <TextField
              label="Return Date"
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); }}
            />
          </div>

          <TextField
            label="Purpose of Travel"
            value={purpose}
            onChange={(e) => { setPurpose(e.target.value); }}
            placeholder="State the commercial justification for travel"
          />

          <div className="pt-4 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setShowNewTripDrawer(false); }}>
              Cancel
            </Button>
            <Button onClick={() => { void handleCreateTrip(); }}>
              Submit Trip Requisition
            </Button>
          </div>
        </div>
      </Drawer>

      {/* Drawer: Request Advance */}
      <Drawer
        open={showNewAdvanceDrawer}
        onClose={() => { setShowNewAdvanceDrawer(false); }}
        title="Request Travel Advance"
        subtitle="Advance funds credited directly to wallet on approval"
      >
        <div className="space-y-4">
          <Select
            label="Select Associated Trip"
            value={advanceTripId ? String(advanceTripId) : null}
            onChange={(val) => { setAdvanceTripId(val ? Number(val) : ''); }}
            options={trips.map((t) => ({
              value: String(t.id),
              label: `${t.referenceNo} - ${t.tripName}`,
            }))}
          />

          <TextField
            label="Advance Amount (₹)"
            type="number"
            value={advanceAmountRupees}
            onChange={(e) => { setAdvanceAmountRupees(e.target.value); }}
            placeholder="10000"
          />

          <TextField
            label="Justification"
            value={advancePurpose}
            onChange={(e) => { setAdvancePurpose(e.target.value); }}
            placeholder="e.g. Hotel deposit, site conveyance, emergency contingency"
          />

          <div className="pt-4 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setShowNewAdvanceDrawer(false); }}>
              Cancel
            </Button>
            <Button onClick={() => { void handleRequestAdvance(); }}>
              Submit Advance Request
            </Button>
          </div>
        </div>
      </Drawer>

      {/* Drawer: File Expense Claim */}
      <Drawer
        open={showNewClaimDrawer}
        onClose={() => { setShowNewClaimDrawer(false); }}
        title="File Expense Claim"
        subtitle="Submit itemized receipts for settlement against advance"
      >
        <div className="space-y-4">
          <Select
            label="Select Associated Trip"
            value={claimTripId ? String(claimTripId) : null}
            onChange={(val) => { setClaimTripId(val ? Number(val) : ''); }}
            options={trips.map((t) => ({
              value: String(t.id),
              label: `${t.referenceNo} - ${t.tripName}`,
            }))}
          />

          <Select
            label="Expense Category"
            value={claimCategory}
            onChange={(val) => { setClaimCategory(val as 'hotel' | 'flight' | 'train' | 'food' | 'misc'); }}
            options={[
              { value: 'hotel', label: 'Hotel & Lodging' },
              { value: 'flight', label: 'Airfare' },
              { value: 'train', label: 'Train / Rail' },
              { value: 'food', label: 'Meals & Daily Allowance' },
              { value: 'misc', label: 'Miscellaneous' },
            ]}
          />

          <TextField
            label="Receipt Amount (₹)"
            type="number"
            value={claimAmountRupees}
            onChange={(e) => { setClaimAmountRupees(e.target.value); }}
            placeholder="5000"
          />

          <TextField
            label="Description / Vendor"
            value={claimDescription}
            onChange={(e) => { setClaimDescription(e.target.value); }}
            placeholder="e.g. Ginger Hotel Bhubaneswar (3 nights)"
          />

          <div className="pt-4 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setShowNewClaimDrawer(false); }}>
              Cancel
            </Button>
            <Button onClick={() => { void handleCreateClaim(); }}>
              Submit Expense Claim
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
