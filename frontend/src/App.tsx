/**
 * Stage 0.3 gallery shell (docs/05 §3, §5) — renders the Warm Editorial
 * component kit in a masthead + canvas layout with a live theme toggle, so the
 * kit is verifiable in light AND dark (Stage 0.3 exit criterion, plans/phase-0).
 *
 * This is a demo surface, NOT a real screen — real per-role screens land in
 * Phase 1+. Sample figures are drawn from the live EMS read (docs/11 §0:
 * 1,066 employees, real entities/departments) so the composition feels grounded.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowUpRight,
  Bell,
  Plus,
  Search,
  SlidersHorizontal,
  Phone,
  Inbox,
  Lock,
  LogOut,
} from 'lucide-react';
import { LoginPage } from './pages/auth/LoginPage';
import {
  Button,
  Card,
  CardHeader,
  ConfirmModal,
  DarkCard,
  DataTable,
  DotMatrix,
  Drawer,
  EmptyState,
  HatchFill,
  IconButton,
  KpiNumber,
  KpiPillRow,
  Pill,
  SegmentedProgress,
  StatusBadge,
  ThemeToggle,
  Timeline,
} from './ui';
import type { Column, Dot, StatusTone, TimelineStep } from './ui';

const NAV = [
  'Dashboard',
  'People',
  'Attendance',
  'Leave',
  'Payroll',
  'Reports',
];

interface Employee {
  ecode: string;
  name: string;
  designation: string;
  dept: string;
  entity: string;
  status: { tone: StatusTone; label: string };
}

// Sample rows — shape/format mirrors the live EMS master (docs/11 §0).
const EMPLOYEES: Employee[] = [
  {
    ecode: 'RML035384',
    name: 'Abhishek Kumar Gupta',
    designation: 'Accounts Executive',
    dept: 'Finance & Accounts',
    entity: 'RML',
    status: { tone: 'positive', label: 'Confirmed' },
  },
  {
    ecode: 'RML035072',
    name: 'Abhishek Saraf',
    designation: 'AGM — Accounts & Taxation',
    dept: 'Finance & Accounts',
    entity: 'RML',
    status: { tone: 'positive', label: 'Confirmed' },
  },
  {
    ecode: 'RDL002412',
    name: 'Ranjay Sengupta',
    designation: 'Advocate',
    dept: 'Land',
    entity: 'RDL',
    status: { tone: 'warning', label: 'Probation' },
  },
  {
    ecode: 'RML034574',
    name: 'Sandeep Sharma',
    designation: 'AGM CEO Cell',
    dept: 'Human Resource',
    entity: 'RML',
    status: { tone: 'info', label: 'On leave' },
  },
  {
    ecode: 'RGH001188',
    name: 'Priya Nair',
    designation: 'Process Engineer',
    dept: 'Production-Hotmill',
    entity: 'RGH',
    status: { tone: 'positive', label: 'Confirmed' },
  },
];

const EMP_COLUMNS: Column<Employee>[] = [
  {
    key: 'ecode',
    header: 'E-code',
    width: '130px',
    render: (r) => <span className="tabular-nums text-ink-muted">{r.ecode}</span>,
  },
  {
    key: 'name',
    header: 'Name',
    width: 'minmax(0,1.4fr)',
    render: (r) => <span className="font-medium text-ink">{r.name}</span>,
  },
  {
    key: 'designation',
    header: 'Designation',
    width: 'minmax(0,1.4fr)',
    render: (r) => r.designation,
  },
  {
    key: 'entity',
    header: 'Entity',
    width: '90px',
    render: (r) => <Pill>{r.entity}</Pill>,
  },
  {
    key: 'status',
    header: 'Status',
    width: '130px',
    render: (r) => (
      <StatusBadge tone={r.status.tone}>{r.status.label}</StatusBadge>
    ),
  },
];

const APPROVAL_CHAIN: TimelineStep[] = [
  {
    title: 'Submitted by employee',
    timestamp: '02 Jul 09:14',
    state: 'done',
    description: 'Leave request · 3 days',
  },
  {
    title: 'Reporting Manager approved',
    timestamp: '02 Jul 11:40',
    state: 'done',
    description: 'A. Saraf · "Approved"',
  },
  {
    title: 'HOD review',
    timestamp: 'Pending',
    state: 'current',
    description: 'Awaiting S. Sharma',
  },
  { title: 'HR posting', state: 'pending' },
];

// Sample month of attendance for the mini-viz.
const ATT_DOTS: Dot[] = Array.from({ length: 28 }, (_, i): Dot => {
  const day = i + 1;
  const weekend = day % 7 === 0 || day % 7 === 6;
  const state = weekend
    ? 'weekoff'
    : day === 12
      ? 'absent'
      : day === 19
        ? 'leave'
        : 'present';
  return {
    key: `d${String(day)}`,
    state,
    title: `Jun ${String(day)} · ${state}`,
  };
});

function Masthead({ onSignOut }: { onSignOut: () => void }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line/60 bg-[color-mix(in_srgb,var(--surface)_82%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full bg-hero text-sm font-bold text-hero-ink">
            R
          </span>
          <span className="text-sm font-semibold text-ink">Rashmi HRMS</span>
        </div>

        <nav className="ml-4 hidden items-center gap-1 rounded-full bg-surface-2 p-1 md:flex">
          {NAV.map((item, i) => (
            <button
              key={item}
              type="button"
              className={
                'u-press rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-(--motion-micro) ' +
                (i === 0
                  ? 'bg-hero text-hero-ink'
                  : 'text-ink-muted hover:text-ink')
              }
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <IconButton label="Search (⌘K)" icon={<Search />} />
          <IconButton label="Notifications" icon={<Bell />} />
          <ThemeToggle />
          <IconButton label="Sign out" icon={<LogOut />} onClick={onSignOut} />
        </div>
      </div>
    </header>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function App() {
  const [authed, setAuthed] = useState(false);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [showInbox, setShowInbox] = useState(true);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalized, setFinalized] = useState(false);

  if (!authed) {
    return (
      <LoginPage
        onSuccess={() => {
          setAuthed(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <Masthead
        onSignOut={() => {
          setAuthed(false);
        }}
      />

      <main className="mx-auto max-w-6xl space-y-10 px-6 py-8">
        {/* Greeting — the ESS signature moment (§6) */}
        <div>
          <p className="text-sm text-ink-muted">Tuesday, 6 July</p>
          <h1 className="mt-0.5 text-3xl font-light tracking-tight text-ink">
            Hello Rachna
          </h1>
        </div>

        {/* KPI pill row — the 4-state signature header */}
        <Section title="KPI pill row · 4 states">
          <KpiPillRow
            pills={[
              { label: 'Headcount', value: 1066, state: 'filled' },
              { label: 'Absent today', value: 38, state: 'accent' },
              { label: 'Pending approvals', value: 12, state: 'hatched' },
              { label: 'Joiners MTD', value: 24, state: 'outline' },
            ]}
          />
        </Section>

        {/* Hero + supporting cards */}
        <Section title="Hero card · content cards">
          <div className="grid gap-4 lg:grid-cols-3">
            <DarkCard className="lg:col-span-1">
              <p className="text-sm text-hero-muted">Attendance today</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-4xl font-semibold leading-none">
                  <KpiNumber value={94.8} precision={1} suffix="%" />
                </span>
                <StatusBadge tone="positive">On track</StatusBadge>
              </div>
              <p className="mt-3 text-sm text-hero-muted">
                1,012 present · 38 absent · 16 on leave. All Kent doors
                reporting.
              </p>
              <div className="mt-5">
                <Button variant="primary" trailingIcon={<ArrowUpRight />}>
                  Open muster
                </Button>
              </div>
            </DarkCard>

            <Card className="lg:col-span-2">
              <CardHeader
                title="Claim vs budget"
                subtitle="Yatra Avedan settlement — Q2 travel"
                action={
                  <IconButton
                    label="Filter"
                    icon={<SlidersHorizontal />}
                    size="sm"
                  />
                }
              />
              <div className="space-y-4">
                <SegmentedProgress
                  label="Airfare"
                  primary={82000}
                  secondary={18000}
                  total={140000}
                  prefix="₹"
                />
                <SegmentedProgress
                  label="Hotel"
                  primary={64000}
                  total={90000}
                  prefix="₹"
                />
                <SegmentedProgress
                  label="Daily allowance"
                  primary={21000}
                  total={30000}
                  prefix="₹"
                />
              </div>
            </Card>
          </div>
        </Section>

        {/* People table → drawer (row click). Selected row = solid gold (§7.4) */}
        <Section title="Data table → drawer · row click opens detail">
          <DataTable
            columns={EMP_COLUMNS}
            rows={EMPLOYEES}
            rowKey={(r) => r.ecode}
            onRowClick={setSelected}
            selectedKey={selected?.ecode}
          />
        </Section>

        {/* Attendance mini-viz + entity chips */}
        <Section title="Dot matrix · pills · status badges">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader
                title="My attendance"
                subtitle="June 2026 · gold = present"
              />
              <DotMatrix dots={ATT_DOTS} columns={7} />
            </Card>
            <Card>
              <CardHeader title="Group entities" subtitle="14 in scope" />
              <div className="flex flex-wrap gap-2">
                <Pill accent>RML · 667</Pill>
                <Pill>RGH · 174</Pill>
                <Pill>Reach Dredging · 96</Pill>
                <Pill>RPL · 57</Pill>
                <Pill>eHoome iOT · 19</Pill>
                <Pill>Koove · 30</Pill>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge tone="positive">Confirmed</StatusBadge>
                <StatusBadge tone="warning">Pending RM</StatusBadge>
                <StatusBadge tone="negative">Rejected</StatusBadge>
                <StatusBadge tone="info">On leave</StatusBadge>
                <StatusBadge tone="neutral">Draft</StatusBadge>
              </div>
            </Card>
          </div>
        </Section>

        {/* Empty state + typed-confirm modal */}
        <Section title="Empty state · timeline · typed-confirm modal">
          <div className="grid gap-4 md:grid-cols-2">
            <Card padded={false}>
              {showInbox ? (
                <div className="p-6">
                  <CardHeader title="Approvals" subtitle="1 pending" />
                  <Timeline steps={APPROVAL_CHAIN} />
                  <div className="mt-4">
                    <Button
                      variant="primary"
                      onClick={() => { setShowInbox(false); }}
                    >
                      Approve & clear
                    </Button>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={<Inbox />}
                  title="All caught up"
                  description="No approvals waiting. New requests land here the moment they’re raised."
                  action={
                    <Button
                      variant="secondary"
                      onClick={() => { setShowInbox(true); }}
                    >
                      Restore demo
                    </Button>
                  }
                />
              )}
            </Card>

            <Card>
              <CardHeader
                title="Payroll — June 2026"
                subtitle="The one place a heavy confirmation is right (§4.5)"
              />
              <div className="flex items-center gap-3">
                {finalized ? (
                  <StatusBadge tone="positive">Finalized</StatusBadge>
                ) : (
                  <StatusBadge tone="warning">Review</StatusBadge>
                )}
                <Button
                  variant="hero"
                  leadingIcon={<Lock />}
                  disabled={finalized}
                  onClick={() => { setFinalizeOpen(true); }}
                >
                  Finalize run
                </Button>
              </div>
            </Card>
          </div>
        </Section>

        {/* Buttons — all variants + states */}
        <Section title="Buttons · icon buttons · hatch">
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary</Button>
              <Button variant="hero">Hero</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="secondary" loading>
                Saving
              </Button>
              <Button variant="primary" disabled>
                Disabled
              </Button>
              <div className="mx-2 h-8 w-px bg-line" />
              <IconButton label="Add" icon={<Plus />} tone="accent" />
              <IconButton label="Call" icon={<Phone />} />
              <IconButton label="Open" icon={<ArrowUpRight />} tone="hero" />
              <HatchFill rounded className="h-10 w-28" />
            </div>
          </Card>
        </Section>

        <footer className="pt-2 text-xs text-ink-faint">
          Stage 0.3 · Warm Editorial kit · tokens verbatim from docs/05 §1 ·
          zero hardcoded hex in components
        </footer>
      </main>

      {/* Detail drawer (row → right drawer, container-transform, §3) */}
      <Drawer
        open={selected !== null}
        onClose={() => { setSelected(null); }}
        title={selected?.name}
        subtitle={selected ? `${selected.designation} · ${selected.dept}` : ''}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setSelected(null); }}>
              Close
            </Button>
            <Button variant="primary" trailingIcon={<ArrowUpRight />}>
              Open profile
            </Button>
          </div>
        }
      >
        {selected && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Pill accent>{selected.entity}</Pill>
              <Pill>{selected.ecode}</Pill>
              <StatusBadge tone={selected.status.tone}>
                {selected.status.label}
              </StatusBadge>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold text-ink">
                Request timeline
              </h3>
              <Timeline steps={APPROVAL_CHAIN} />
            </div>
          </div>
        )}
      </Drawer>

      {/* Typed-confirm for the irreversible action (§4.5, §8) */}
      <ConfirmModal
        open={finalizeOpen}
        onClose={() => { setFinalizeOpen(false); }}
        onConfirm={() => { setFinalized(true); }}
        title="Finalize June 2026 payroll?"
        description="This locks the run and issues payslips. It cannot be undone without a super-admin reopen."
        confirmLabel="Finalize"
        typedConfirmation="FINALIZE JUNE 2026"
      />
    </div>
  );
}
