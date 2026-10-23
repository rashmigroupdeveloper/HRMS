/**
 * Travel & Expense — employee journey aligned to live EMS, in the existing
 * Warm Editorial page: KPI row, pill tabs, section cards, charcoal wallet, drawers.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Briefcase, CheckCircle2, Clock, CreditCard, Plane, RefreshCw, Wallet } from 'lucide-react';
import { Button, DarkCard, Drawer, KpiPillRow, PageHeader, toast } from '../../ui';
import { apiFetch } from '../../lib/api';
import { AdvancePanel } from './AdvancePanel';
import { ClaimExpensePanel } from './ClaimExpensePanel';
import { CreateBudgetPanel } from './CreateBudgetPanel';
import { MyAdvancesPanel, MyBudgetsPanel, MyClaimsPanel, WalletPanel } from './TravelBoards';
import {
  SECTIONS,
  formatPaise,
  sectionFromPath,
  type AdvanceItem,
  type BudgetItem,
  type ClaimItem,
  type TravelSection,
  type WalletLedgerItem,
} from './travel-model';

const TABS: { id: TravelSection; label: string; icon: typeof Briefcase }[] = [
  { id: 'budgets', label: 'My Budgets', icon: Briefcase },
  { id: 'advances', label: 'My Advances', icon: CreditCard },
  { id: 'claims', label: 'My Claims', icon: Clock },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
];

function listSection(section: TravelSection): 'budgets' | 'claims' | 'advances' | 'wallet' {
  if (section === 'create') return 'budgets';
  if (section === 'claim' || section === 'claims') return 'claims';
  if (section === 'advance' || section === 'advances') return 'advances';
  if (section === 'wallet') return 'wallet';
  return 'budgets';
}

export function TravelPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const section = sectionFromPath(location.pathname);
  const list = listSection(section);
  const [loading, setLoading] = useState(false);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [claims, setClaims] = useState<ClaimItem[]>([]);
  const [advances, setAdvances] = useState<AdvanceItem[]>([]);
  const [balancePaise, setBalancePaise] = useState(0);
  const [ledger, setLedger] = useState<WalletLedgerItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [budgetRes, claimRes, advanceRes, walletRes, ledgerRes] = await Promise.all([
        apiFetch<{ items: BudgetItem[] }>('/api/travel/trips'),
        apiFetch<{ items: ClaimItem[] }>('/api/travel/claims'),
        apiFetch<{ items: AdvanceItem[] }>('/api/travel/advances'),
        apiFetch<{ balancePaise: number }>('/api/travel/wallet'),
        apiFetch<{ transactions: WalletLedgerItem[] }>('/api/travel/wallet/ledger'),
      ]);
      setBudgets(Array.isArray(budgetRes.items) ? budgetRes.items : []);
      setClaims(Array.isArray(claimRes.items) ? claimRes.items : []);
      setAdvances(Array.isArray(advanceRes.items) ? advanceRes.items : []);
      setBalancePaise(typeof walletRes.balancePaise === 'number' ? walletRes.balancePaise : 0);
      setLedger(Array.isArray(ledgerRes.transactions) ? ledgerRes.transactions : []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not load travel data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saved = () => {
    void load();
  };

  const openBudgets = budgets.filter((row) => row.status !== 'cancelled' && row.status !== 'rejected').length;
  const disbursedPaise = advances.reduce((sum, row) => sum + (row.status === 'disbursed' ? row.amountPaise : 0), 0);
  const pendingClaims = claims.filter((row) => row.settlementStatus === 'unsettled').length;
  const featured = budgets.find((row) => row.status === 'approved')
    ?? budgets.find((row) => row.status !== 'cancelled' && row.status !== 'rejected')
    ?? null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Travel & expense"
        title="Business travel"
        description="Raise a budget, take an advance, add receipts and settle what you spent."
        actions={(
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { void load(); }} aria-busy={loading}>
              <RefreshCw className={`mr-1.5 size-4 ${loading ? 'animate-spin' : ''}`} />
              Sync
            </Button>
            <div className="flex min-w-0 max-w-full overflow-x-auto rounded-full bg-surface-2 p-1 [scrollbar-width:none] [&>*]:shrink-0">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const current = list === tab.id;
                return (
                  <Button
                    key={tab.id}
                    size="sm"
                    variant={current ? 'hero' : 'ghost'}
                    aria-current={current ? 'page' : undefined}
                    onClick={() => {
                      const target = SECTIONS.find((item) => item.id === tab.id);
                      if (target) void navigate(target.to);
                    }}
                  >
                    <Icon className="mr-1.5 size-3.5" />
                    {tab.label}
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      />

      <KpiPillRow
        pills={[
          { label: 'Open budgets', value: openBudgets, state: 'filled', icon: <Briefcase />, to: '/travel/budgets' },
          { label: 'Wallet', value: balancePaise / 100, precision: 2, prefix: '₹', state: 'accent', icon: <Wallet />, to: '/travel/wallet' },
          { label: 'Pending claims', value: pendingClaims, state: 'hatched', icon: <Clock />, to: '/travel/claims' },
          { label: 'Disbursed', value: disbursedPaise / 100, precision: 2, prefix: '₹', state: 'outline', icon: <CreditCard />, to: '/travel/advances' },
        ]}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <DarkCard className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-hero-muted">Travel wallet</p>
            <p className="font-mono text-2xl font-light tracking-tight text-hero-ink">{formatPaise(balancePaise)}</p>
          </div>
          <ul className="space-y-3">
            <li className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-hero-ink text-hero" aria-hidden>
                <Plane className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-hero-ink">
                  {featured
                    ? (featured.originCity ? `${featured.originCity} to ${featured.destinationCity}` : featured.destinationCity)
                    : 'No journey yet'}
                </span>
                <span className="block truncate text-xs text-hero-muted">
                  {featured ? `${featured.status.replaceAll('_', ' ')} · ${featured.purpose}` : 'Create a budget to start'}
                </span>
              </span>
              {featured?.status === 'approved' ? (
                <CheckCircle2 className="size-4 shrink-0 text-accent" aria-hidden />
              ) : (
                <span className="size-2.5 shrink-0 rounded-full bg-hero-muted" aria-hidden />
              )}
            </li>
            <li className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-hero-ink text-hero" aria-hidden>
                <Briefcase className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-hero-ink">{openBudgets} open</span>
                <span className="block text-xs text-hero-muted">Budgets in progress</span>
              </span>
              {openBudgets === 0 ? (
                <CheckCircle2 className="size-4 shrink-0 text-accent" aria-hidden />
              ) : (
                <span className="size-2.5 shrink-0 rounded-full bg-hero-muted" aria-hidden />
              )}
            </li>
            <li className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-hero-ink text-hero" aria-hidden>
                <Clock className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-hero-ink">{pendingClaims} unsettled</span>
                <span className="block text-xs text-hero-muted">Claims waiting</span>
              </span>
              {pendingClaims === 0 ? (
                <CheckCircle2 className="size-4 shrink-0 text-accent" aria-hidden />
              ) : (
                <span className="size-2.5 shrink-0 rounded-full bg-hero-muted" aria-hidden />
              )}
            </li>
          </ul>
        </DarkCard>

        <div className="min-w-0">
          {list === 'budgets' && (
            <MyBudgetsPanel budgets={budgets} onChanged={saved} onCreate={() => { void navigate('/travel/budgets/new'); }} />
          )}
          {list === 'claims' && (
            <MyClaimsPanel claims={claims} budgets={budgets} onCreate={() => { void navigate('/travel/claims/new'); }} />
          )}
          {list === 'advances' && (
            <MyAdvancesPanel advances={advances} budgets={budgets} onCreate={() => { void navigate('/travel/advances/new'); }} />
          )}
          {list === 'wallet' && <WalletPanel ledger={ledger} />}
        </div>
      </div>

      <Drawer
        open={section === 'create'}
        onClose={() => { void navigate('/travel/budgets'); }}
        title="Create budget"
        subtitle="Domestic or international. This request is what gets approved."
        width={640}
      >
        <CreateBudgetPanel onSaved={saved} />
      </Drawer>
      <Drawer
        open={section === 'claim'}
        onClose={() => { void navigate('/travel/claims'); }}
        title="File expense claim"
        subtitle="Against an approved budget. Every line needs a receipt."
        width={640}
      >
        <ClaimExpensePanel budgets={budgets} onSaved={saved} />
      </Drawer>
      <Drawer
        open={section === 'advance'}
        onClose={() => { void navigate('/travel/advances'); }}
        title="Request travel advance"
        subtitle="Credited to the wallet once the budget is approved and this request is approved."
        width={520}
      >
        <AdvancePanel budgets={budgets} onSaved={saved} />
      </Drawer>
    </div>
  );
}
