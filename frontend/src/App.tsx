/**
 * Dashboard (super-admin home). Warm Editorial (docs/05). Composition only —
 * no primitives invented here (docs/05 §0.1 firewall).
 *
 * Data below is PLACEHOLDER, shaped to the live EMS master (docs/11 §0) so the
 * layout is real; every block is wired to swap onto an oRPC query in Phase 1
 * (no figure here is a policy value — CLAUDE.md §1). Nothing developer-facing
 * (widget names, spec refs, "demo" copy) may render as UI text.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowUpRight,
  Bell,
  Search,
  SlidersHorizontal,
  Inbox,
  Lock,
  LogOut,
} from 'lucide-react';
import { LoginPage } from './pages/auth/LoginPage';
import { findDevUser, firstName } from './dev/devUsers';
import { todayLongIST } from './lib/date';
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

const NAV = ['Dashboard', 'People', 'Attendance', 'Leave', 'Payroll', 'Reports'];

interface Employee {
  ecode: string;
  name: string;
  designation: string;
  dept: string;
  entity: string;
  status: { tone: StatusTone; label: string };
}

// --- Placeholder data (Phase 1: replace with oRPC queries) --------------------

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
    dept: 'Production — Hot Mill',
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
    render: (r) => <StatusBadge tone={r.status.tone}>{r.status.label}</StatusBadge>,
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
    description: 'A. Saraf · “Approved”',
  },
  {
    title: 'HOD review',
    timestamp: 'Pending',
    state: 'current',
    description: 'Awaiting S. Sharma',
  },
  { title: 'HR posting', state: 'pending' },
];

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
  return { key: `d${String(day)}`, state, title: `Jun ${String(day)} · ${state}` };
});

const ENTITIES = [
  { code: 'RML', count: 667 },
  { code: 'RGH', count: 174 },
  { code: 'Reach Dredging', count: 96 },
  { code: 'RPL', count: 57 },
  { code: 'Koove', count: 30 },
  { code: 'eHoome IoT', count: 19 },
];

// --- Chrome -------------------------------------------------------------------

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
                (i === 0 ? 'bg-hero text-hero-ink' : 'text-ink-muted hover:text-ink')
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

function SectionHead({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <div className="flex items-baseline gap-2">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {meta !== undefined && <span className="text-xs text-ink-faint">{meta}</span>}
      </div>
      {action}
    </div>
  );
}

// --- Screen -------------------------------------------------------------------

export function App() {
  const [userid, setUserid] = useState<string | null>(null);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [approvalsCleared, setApprovalsCleared] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalized, setFinalized] = useState(false);

  if (userid === null) {
    return (
      <LoginPage
        onSuccess={(id) => {
          setUserid(id);
        }}
      />
    );
  }

  const greetingName = firstName(findDevUser(userid), userid);

  return (
    <div className="min-h-screen">
      <Masthead
        onSignOut={() => {
          setUserid(null);
        }}
      />

      <main className="mx-auto max-w-6xl space-y-10 px-6 py-8">
        {/* Greeting */}
        <div>
          <p className="text-sm text-ink-muted">{todayLongIST()}</p>
          <h1 className="mt-0.5 text-3xl font-light tracking-tight text-ink">
            Hello {greetingName}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Here’s the pulse across the group today.
          </p>
        </div>

        {/* Headline metrics */}
        <KpiPillRow
          pills={[
            { label: 'Headcount', value: 1066, state: 'filled' },
            { label: 'Absent today', value: 38, state: 'accent' },
            { label: 'Pending approvals', value: 12, state: 'hatched' },
            { label: 'Joiners this month', value: 24, state: 'outline' },
          ]}
        />

        {/* Attendance + travel spend */}
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
              1,012 present · 38 absent · 16 on leave, live across all sites.
            </p>
            <div className="mt-5">
              <Button variant="primary" trailingIcon={<ArrowUpRight />}>
                Open muster
              </Button>
            </div>
          </DarkCard>

          <Card className="lg:col-span-2">
            <CardHeader
              title="Travel claims vs budget"
              subtitle="Yatra Avedan · Q2 FY26"
              action={
                <IconButton label="Filter" icon={<SlidersHorizontal />} size="sm" />
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
              <SegmentedProgress label="Hotel" primary={64000} total={90000} prefix="₹" />
              <SegmentedProgress
                label="Daily allowance"
                primary={21000}
                total={30000}
                prefix="₹"
              />
            </div>
          </Card>
        </div>

        {/* People directory */}
        <section className="space-y-4">
          <SectionHead
            title="People"
            meta={`${String(EMPLOYEES.length)} of 1,066`}
            action={
              <Button variant="ghost" trailingIcon={<ArrowUpRight />}>
                View all
              </Button>
            }
          />
          <DataTable
            columns={EMP_COLUMNS}
            rows={EMPLOYEES}
            rowKey={(r) => r.ecode}
            onRowClick={setSelected}
            selectedKey={selected?.ecode}
          />
        </section>

        {/* Attendance record + workforce spread */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader title="My attendance" subtitle="June 2026" />
            <DotMatrix dots={ATT_DOTS} columns={7} />
          </Card>
          <Card>
            <CardHeader title="Workforce by entity" subtitle="14 legal entities" />
            <div className="flex flex-wrap gap-2">
              {ENTITIES.map((e, i) => (
                <Pill key={e.code} accent={i === 0}>
                  {e.code} · {e.count}
                </Pill>
              ))}
            </div>
          </Card>
        </div>

        {/* Approvals + payroll */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card padded={false}>
            {approvalsCleared ? (
              <EmptyState
                icon={<Inbox />}
                title="All caught up"
                description="No approvals waiting. New requests appear here the moment they’re raised."
              />
            ) : (
              <div className="p-6">
                <CardHeader title="Approvals" subtitle="1 pending" />
                <Timeline steps={APPROVAL_CHAIN} />
                <div className="mt-4">
                  <Button
                    variant="primary"
                    onClick={() => {
                      setApprovalsCleared(true);
                    }}
                  >
                    Approve &amp; clear
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Payroll — June 2026"
              subtitle="Locks the run and issues payslips."
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
                onClick={() => {
                  setFinalizeOpen(true);
                }}
              >
                Finalize run
              </Button>
            </div>
          </Card>
        </div>
      </main>

      {/* Row → detail drawer */}
      <Drawer
        open={selected !== null}
        onClose={() => {
          setSelected(null);
        }}
        title={selected?.name}
        subtitle={selected ? `${selected.designation} · ${selected.dept}` : ''}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setSelected(null);
              }}
            >
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
              <h3 className="mb-3 text-sm font-semibold text-ink">Request timeline</h3>
              <Timeline steps={APPROVAL_CHAIN} />
            </div>
          </div>
        )}
      </Drawer>

      {/* Irreversible action → typed confirm */}
      <ConfirmModal
        open={finalizeOpen}
        onClose={() => {
          setFinalizeOpen(false);
        }}
        onConfirm={() => {
          setFinalized(true);
        }}
        title="Finalize June 2026 payroll?"
        description="This locks the run and issues payslips. It cannot be undone without a super-admin reopen."
        confirmLabel="Finalize"
        typedConfirmation="FINALIZE JUNE 2026"
      />
    </div>
  );
}
