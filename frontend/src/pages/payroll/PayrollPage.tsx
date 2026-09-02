/**
 * Payroll run console (M4, PAY-03) — docs/05 §4.5, "the most careful UI in the
 * product". Until the Phase-2 engine lands this screen shows the real structure
 * and no invented money — a fake net-pay figure is indistinguishable from a
 * real one.
 */
import { FileSpreadsheet, Landmark, Receipt } from 'lucide-react';
import { Card, CardHeader, DarkCard, PageHeader, Pill, StatusBadge, Timeline } from '../../ui';
import type { TimelineStep } from '../../ui';
import { PendingModule } from '../_shared/ModuleState';
import { useModuleResource } from '../_shared/useModuleResource';

/** The `pay.payroll_runs` state machine (docs/03 §10, PAY-03). */
const RUN_STATES = [
  {
    code: 'draft',
    label: 'Draft',
    gate: 'The month is opened. Nothing has been calculated yet.',
  },
  {
    code: 'inputs_locked',
    label: 'Inputs locked',
    gate: 'Attendance is frozen, and this month’s inputs can no longer change.',
  },
  {
    code: 'computed',
    label: 'Computed',
    gate: 'Every rupee is calculated. You can read the register, not edit the past.',
  },
  {
    code: 'under_review',
    label: 'Under review',
    gate: 'Biggest month-to-month changes rise to the top. Negative nets are flagged, never hidden.',
  },
  {
    code: 'approved',
    label: 'Approved',
    gate: 'An independent check has matched the register to the paisa.',
  },
  {
    code: 'finalized',
    label: 'Finalized',
    gate: 'Locked. Two people sign — payroll admin and HR head.',
  },
] as const;

/** Statutory outputs a finalized run produces (PAY-05/09–13). */
const OUTPUTS = [
  { code: 'payslips', label: 'Payslips', note: 'The same RML template, every month', icon: Receipt },
  { code: 'bank', label: 'Bank file', note: 'Who gets paid, with payment holds left out', icon: Landmark },
  { code: 'jv', label: 'Journal voucher', note: 'The posting finance sends to SAP', icon: FileSpreadsheet },
  { code: 'ecr', label: 'PF ECR', note: 'The file EPFO expects', icon: FileSpreadsheet },
  { code: 'esic', label: 'ESIC return', note: 'The monthly ESIC filing', icon: FileSpreadsheet },
  { code: 'pt', label: 'PT register', note: 'West Bengal professional tax', icon: FileSpreadsheet },
  { code: 'tds', label: 'TDS / 24Q', note: 'Tax deducted, both regimes', icon: FileSpreadsheet },
] as const;

interface PayrollRun {
  id: number;
  month: string;
  state: string;
  employeeCount: number;
  grossPaise: number;
  netPaise: number;
}

export function PayrollPage() {
  const runs = useModuleResource<PayrollRun[]>('/api/payroll/runs');

  const steps: TimelineStep[] = RUN_STATES.map((state) => ({
    id: state.code,
    title: state.label,
    description: state.gate,
    state: 'pending',
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Payroll"
        title="Payroll"
        description="This is where the monthly salary run happens — lock the month, check every rupee, then issue payslips and the files the bank and PF office need."
        actions={<StatusBadge tone="neutral">No open run</StatusBadge>}
      />

      <DarkCard padded={false} className="p-8 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hero-muted">
          What you will do here
        </p>
        <h2 className="mt-4 max-w-xl text-4xl font-light tracking-tight text-hero-ink">
          Run one month. Explain every rupee.
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-7 text-hero-muted">
          You will lock attendance, compute salaries, review the register, then issue payslips and
          statutory files. Until the engine is ready, this page stays empty rather than showing
          invented figures.
        </p>
      </DarkCard>

      <Card>
        <CardHeader
          title="How a run moves"
          subtitle="Each step has to earn the next, so nobody has to guess why the month will not advance."
        />
        <Timeline steps={steps} />
      </Card>

      <Card>
        <CardHeader
          title="What a finished month gives you"
          subtitle="Nothing is offered for download until it actually exists."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OUTPUTS.map((output) => (
            <div key={output.code} className="flex items-start gap-3 rounded-row bg-surface-2 p-4">
              <output.icon className="mt-0.5 size-5 shrink-0 text-ink-faint" />
              <div>
                <p className="text-sm font-semibold text-ink">{output.label}</p>
                <p className="mt-0.5 text-xs leading-5 text-ink-muted">{output.note}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="The review you will see"
          subtitle="People × days payable · leave without pay · gross · deductions · net · change vs last month."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Pill>Payable days</Pill>
          <Pill>Leave without pay</Pill>
          <Pill>Gross</Pill>
          <Pill>PF / ESIC / PT / TDS</Pill>
          <Pill>Net</Pill>
          <Pill>Change vs last month</Pill>
        </div>
        <p className="mt-4 text-sm leading-6 text-ink-muted">
          Every payslip line will carry a plain-language note — so a number can be explained, not
          just trusted.
        </p>
      </Card>

      {runs.pending || runs.data === null ? (
        <PendingModule
          phase="Phase 2"
          task="P2-T03 / P2-T04"
          description="You will run payroll here. The engine is still being built — we show nothing rather than invented figures."
        />
      ) : null}
    </div>
  );
}
