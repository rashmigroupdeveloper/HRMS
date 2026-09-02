/**
 * ESS payslip + YTD tax (PAY-06/PAY-13) — docs/05 §4.5 "ESS payslip view".
 *
 * The employee-facing half of payroll: month picker, the fixed RML payslip
 * template, and a YTD tax card carrying the regime and a link into the
 * declaration flow. Statutory identifiers (PAN/UAN/PF no./bank) are
 * permission-masked here exactly as they are everywhere else (CLAUDE.md §5).
 */
import { useState } from 'react';
import { Download, FileText, Percent, Wallet } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  DarkCard,
  EmptyState,
  KpiNumber,
  PageHeader,
  Pill,
  Skeleton,
  StatusBadge,
  TextField,
} from '../../ui';
import { useModuleResource } from '../_shared/useModuleResource';

interface Payslip {
  month: string;
  netPaise: number;
  lines: { label: string; amountPaise: number; calcNote: string }[];
}

function currentMonth(): string {
  const now = new Date();
  return `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function rupees(paise: number): number {
  return paise / 100;
}

/** The payslip field block confirmed against the live greytHR slip (09 §2). */
const TEMPLATE_FIELDS = [
  'Employee name & e-code',
  'PAN · UAN · PF number (masked)',
  'Bank account (masked)',
  'Payable days · LOP days',
  'Earnings: BASIC · HRA · MEDICAL · SPECIAL · EDUCATION',
  'Deductions: PF · PT · TDS · recoveries',
  'Net pay in words',
  'Leave balance footer',
];

export function MyPayPage() {
  const [month, setMonth] = useState(currentMonth());
  const payslip = useModuleResource<Payslip>(`/api/my/payslip?month=${month}`);
  const slip = payslip.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="This month, already selected"
        title="My pay"
        description="Your RML payslip and the tax year behind it. No sample figures — a fabricated net is indistinguishable from a real one."
        actions={
          <div className="w-44">
            <TextField
              label="Month"
              type="month"
              value={month}
              onChange={(event) => {
                setMonth(event.currentTarget.value);
              }}
            />
          </div>
        }
      />

      {payslip.loading && (
        <div role="status" aria-busy="true" aria-label="Loading payslip" className="space-y-6">
          <Skeleton variant="block" className="h-40 rounded-card" />
          <Skeleton variant="block" className="h-64 rounded-card" />
        </div>
      )}

      {payslip.error && (
        <Card>
          <EmptyState
            icon={<Wallet />}
            title="Payslip could not be loaded"
            description={payslip.error}
            action={
              <Button variant="primary" onClick={payslip.reload}>
                Try again
              </Button>
            }
          />
        </Card>
      )}

      {!payslip.loading && !payslip.error && slip && (
        <DarkCard className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <p className="text-xs font-medium tracking-tight text-hero-muted">Net for {slip.month}</p>
            <p className="mt-3 text-5xl font-light text-accent">
              <KpiNumber value={rupees(slip.netPaise)} prefix="₹" precision={2} />
            </p>
            <p className="mt-2 text-sm text-hero-muted">
              {String(slip.lines.length)} lines already computed · every amount carries its working
            </p>
          </div>
        </DarkCard>
      )}

      {!payslip.loading && !payslip.error && !slip && (
        <DarkCard>
          <p className="text-xs font-medium tracking-tight text-hero-muted">Your first payslip</p>
          <p className="mt-3 text-3xl font-light">Lands here after payroll runs</p>
          <p className="mt-3 max-w-xl text-sm leading-6 text-hero-muted">
            {payslip.pending
              ? 'The payroll engine is still being built for this month. Nothing is shown rather than a number that was never computed.'
              : 'When this month is processed, net pay will count up once on this card — the same figure that hits your bank.'}
          </p>
        </DarkCard>
      )}

      {!payslip.loading && !payslip.error && (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title={slip ? 'This slip' : 'What your slip will include'}
            subtitle={
              slip
                ? 'Each line below is explainable — tap the note under the amount'
                : 'Fixed RML template (PAY-06) — a slip from any month reads the same'
            }
            action={
              slip ? (
                <StatusBadge tone="positive">{String(slip.lines.length)} lines</StatusBadge>
              ) : (
                <StatusBadge tone="neutral">Awaiting payroll</StatusBadge>
              )
            }
          />
          {slip ? (
            <ul className="space-y-2">
              {slip.lines.map((line) => (
                <li
                  key={line.label}
                  className="flex items-start justify-between gap-4 rounded-row bg-surface-2 px-4 py-2.5"
                >
                  <div>
                    <p className="text-sm text-ink">{line.label}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">{line.calcNote}</p>
                  </div>
                  <span className="tabular-nums text-sm text-ink">
                    ₹{rupees(line.amountPaise).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-2">
              {TEMPLATE_FIELDS.map((field) => (
                <li
                  key={field}
                  className="flex items-center gap-3 rounded-row bg-surface-2 px-4 py-2.5 text-sm text-ink-muted"
                >
                  <FileText className="size-4 shrink-0 text-ink-faint" />
                  {field}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Year-to-date tax" subtitle="Declared only after you submit a regime" />
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-row bg-surface-2 px-4 py-3">
                <span className="flex items-center gap-2 text-sm text-ink-muted">
                  <Percent className="size-4" /> Regime
                </span>
                <Pill>Not declared</Pill>
              </div>
              <div className="flex items-center justify-between rounded-row bg-surface-2 px-4 py-3">
                <span className="flex items-center gap-2 text-sm text-ink-muted">
                  <Wallet className="size-4" /> Tax deducted YTD
                </span>
                <span className="text-sm text-ink-faint">—</span>
              </div>
              <div className="flex items-center justify-between rounded-row bg-surface-2 px-4 py-3">
                <span className="flex items-center gap-2 text-sm text-ink-muted">
                  <Download className="size-4" /> Form 16 Part B
                </span>
                <span className="text-sm text-ink-faint">Year end</span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Declarations" subtitle="Proofs verified before year-end" />
            <EmptyState
              icon={<Percent />}
              title="Nothing to declare until the window opens"
              description="When HR opens the proof window you will upload investments here and see the monthly tax projection update. No estimated tax is shown until then."
            />
          </Card>
        </div>
      </div>
      )}
    </div>
  );
}
