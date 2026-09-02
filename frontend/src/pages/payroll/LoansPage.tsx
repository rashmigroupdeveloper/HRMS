/**
 * Loans & advances (M11, LN-01..04) — docs/04.
 *
 * Balance is a LEDGER, never a counter: outstanding is the SUM of immutable
 * posting rows. Until Phase 2 lands, the screen explains that promise and
 * shows no invented balances.
 */
import { CalendarClock, Coins, Landmark, Receipt } from 'lucide-react';
import { Card, CardHeader, DarkCard, PageHeader } from '../../ui';
import { PendingModule } from '../_shared/ModuleState';
import { useModuleResource } from '../_shared/useModuleResource';

interface Loan {
  id: number;
  type: string;
  principalPaise: number;
  outstandingPaise: number;
}

const LOAN_TYPES = [
  { label: 'Reducing balance', note: 'Interest on what is still owed' },
  { label: 'Flat rate', note: 'Interest on the original amount' },
  { label: 'Equal instalments, no interest', note: 'A staff advance recovered in even parts' },
  { label: 'Salary advance', note: 'Taken back in full from the next salary' },
];

export function LoansPage() {
  const loans = useModuleResource<Loan[]>('/api/loans');

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Loans & advances"
        title="Loans"
        description="Apply for a staff loan or advance, see what you still owe, and watch each instalment come off your salary — every rupee explained."
      />

      <DarkCard padded={false} className="p-8 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hero-muted">
          What you will do here
        </p>
        <h2 className="mt-4 max-w-xl text-4xl font-light tracking-tight text-hero-ink">
          Borrow, repay, always see what you still owe.
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-7 text-hero-muted">
          You will apply, get a schedule, and watch each instalment post as its own row. A mistake
          is reversed, never overwritten. Until that ledger exists, this page stays empty rather
          than showing invented balances.
        </p>
      </DarkCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Kinds of loan"
            subtitle="Each one has its own interest and recovery rhythm."
          />
          <div className="space-y-2">
            {LOAN_TYPES.map((type) => (
              <div key={type.label} className="flex items-start gap-3 rounded-row bg-surface-2 p-4">
                <Coins className="mt-0.5 size-5 shrink-0 text-ink-faint" />
                <div>
                  <p className="text-sm font-semibold text-ink">{type.label}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{type.note}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="How a loan will move"
            subtitle="You find out if you are eligible before anyone else is asked to approve."
          />
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-row bg-surface-2 p-4">
              <CalendarClock className="mt-0.5 size-5 shrink-0 text-ink-faint" />
              <p className="text-sm leading-6 text-ink-muted">
                The application checks grade and existing loans first, so you are not waiting on
                three approvals to hear “no”.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-row bg-surface-2 p-4">
              <Receipt className="mt-0.5 size-5 shrink-0 text-ink-faint" />
              <p className="text-sm leading-6 text-ink-muted">
                Each salary run posts the instalment as a deduction and a ledger row you can read.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-row bg-surface-2 p-4">
              <Landmark className="mt-0.5 size-5 shrink-0 text-ink-faint" />
              <p className="text-sm leading-6 text-ink-muted">
                Older SAP loan balances come in as opening rows, so history reconciles from day
                one.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {loans.pending || loans.data === null ? (
        <PendingModule
          phase="Phase 2"
          task="P2-T09"
          description="You will manage loans here. The ledger is still being built — we show nothing rather than invented balances."
        />
      ) : null}
    </div>
  );
}
