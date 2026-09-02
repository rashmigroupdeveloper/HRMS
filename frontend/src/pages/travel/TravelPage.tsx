/**
 * Travel & Expense (M13, TE-01..12) — docs/05 §0.1 firewall applies hard here.
 *
 * Replaces Yatra Avedan: port its logic and data, never its MUI screens.
 * Until Phase 3.5 lands, the screen explains the wallet promise and shows no
 * invented balances.
 */
import { useState } from 'react';
import { Button, Card, CardHeader, DarkCard, PageHeader, Timeline } from '../../ui';
import type { TimelineStep } from '../../ui';
import { PendingModule } from '../_shared/ModuleState';
import { useModuleResource } from '../_shared/useModuleResource';

type Tab = 'trips' | 'advances' | 'claims' | 'wallet';

interface Trip {
  id: number;
  name: string;
  status: string;
}

const TABS: { code: Tab; label: string }[] = [
  { code: 'trips', label: 'Trips' },
  { code: 'advances', label: 'Advances' },
  { code: 'claims', label: 'Claims' },
  { code: 'wallet', label: 'Wallet' },
];

/** The trip → settlement cycle (TE-01/07/09/11). */
const CYCLE: TimelineStep[] = [
  {
    id: 'request',
    title: 'Ask for the trip',
    description: 'Where, why, and each leg — flight, train, bus, hotel, car. Visa when needed.',
    state: 'pending',
  },
  {
    id: 'budget',
    title: 'See the budget',
    description:
      'Air class, hotel per night, daily allowance — by grade. Over budget is flagged for a higher approval, never silently blocked.',
    state: 'pending',
  },
  {
    id: 'advance',
    title: 'Take an advance',
    description: 'Approval credits the wallet. A higher amount can add a CEO step.',
    state: 'pending',
  },
  {
    id: 'travel',
    title: 'Travel',
    description: 'Booked for you, or your own arrangement with a reason against the budget.',
    state: 'pending',
  },
  {
    id: 'claim',
    title: 'Claim the receipts',
    description: 'Each line has a receipt, a date, an amount, and a currency.',
    state: 'pending',
  },
  {
    id: 'settlement',
    title: 'Settle',
    description:
      'Claimed against the advance. What you still owe, or what the company still owes you — never a written-off difference.',
    state: 'pending',
  },
];

export function TravelPage() {
  const [tab, setTab] = useState<Tab>('trips');
  const trips = useModuleResource<Trip[]>('/api/travel/trips');

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Travel & expense"
        title="Business travel"
        description="Plan a work trip, take an advance, claim the receipts, and settle to the rupee — the wallet keeps advance and claim honest with each other."
        actions={
          <div className="flex rounded-full bg-surface-2 p-1">
            {TABS.map((t) => (
              <Button
                key={t.code}
                size="sm"
                variant={tab === t.code ? 'primary' : 'ghost'}
                onClick={() => {
                  setTab(t.code);
                }}
              >
                {t.label}
              </Button>
            ))}
          </div>
        }
      />

      <DarkCard padded={false} className="p-8 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hero-muted">
          What you will do here
        </p>
        <h2 className="mt-4 max-w-xl text-4xl font-light tracking-tight text-hero-ink">
          Ask for the trip. Come home settled to the rupee.
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-7 text-hero-muted">
          You will request travel, take an advance, attach receipts, and settle against a wallet
          that cannot drift. Until that ledger exists, we show nothing rather than invented
          balances.
        </p>
      </DarkCard>

      <Card>
        <CardHeader
          title="The journey"
          subtitle="The same approval engine as leave — including send-back at every step."
        />
        <Timeline steps={CYCLE} />
      </Card>

      {trips.pending || trips.data === null ? (
        <PendingModule
          phase="Phase 3.5"
          task="TE-01..12"
          description="You will book and settle travel here. The wallet is still being built — we show nothing rather than invented balances."
        />
      ) : null}
    </div>
  );
}
