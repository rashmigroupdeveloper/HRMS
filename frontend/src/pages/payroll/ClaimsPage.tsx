/**
 * Claims (M12, CLM-01..07) — docs/05 §4.5b.
 *
 * Three audiences on one module, tabbed by intent rather than split into three
 * routes. Until Phase 2 lands, the screen explains what people will get and
 * shows no invented balances.
 */
import { useState } from 'react';
import { Button, Card, CardHeader, DarkCard, PageHeader, Pill } from '../../ui';
import { PendingModule } from '../_shared/ModuleState';
import { useModuleResource } from '../_shared/useModuleResource';

type Tab = 'mine' | 'verify' | 'payout';

interface Claim {
  id: number;
  type: string;
  amountPaise: number;
  status: string;
}

const TABS: { code: Tab; label: string; blurb: string }[] = [
  {
    code: 'mine',
    label: 'My claims',
    blurb:
      'You will see what you can still claim this period, attach the bill, and follow what was paid.',
  },
  {
    code: 'verify',
    label: 'Verification',
    blurb:
      'Managers and HR will read the bill inline. A partial payment is a real action; a decline needs a reason.',
  },
  {
    code: 'payout',
    label: 'Payout',
    blurb:
      'Approved claims go into the salary run, or into a one-off bank file — never both for the same claim.',
  },
];

export function ClaimsPage() {
  const [tab, setTab] = useState<Tab>('mine');
  const claims = useModuleResource<Claim[]>('/api/claims');
  const active = TABS.find((t) => t.code === tab) ?? TABS[0];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Claims"
        title="Reimbursements"
        description="Claim medical, travel or other reimbursements here. Your bill stays attached from submit to payment, so nobody has to chase a screenshot."
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
          Claim it once. Keep the bill attached until it is paid.
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-7 text-hero-muted">
          You will submit against your grade entitlement, with the bill following every step.
          Until entitlements are live, this page stays empty rather than showing invented balances.
        </p>
      </DarkCard>

      <Card>
        <CardHeader title={active?.label ?? ''} subtitle={active?.blurb ?? ''} />
        <div className="flex flex-wrap gap-2">
          <Pill>Entitlement by grade</Pill>
          <Pill>Bill stays attached</Pill>
          <Pill>Partial approval</Pill>
          <Pill>A decline needs a reason</Pill>
        </div>
      </Card>

      {claims.pending || claims.data === null ? (
        <PendingModule
          phase="Phase 2"
          task="P2-T10"
          description="You will submit and settle claims here. Entitlements and payouts are still being built — we show nothing rather than invented balances."
        />
      ) : null}
    </div>
  );
}
