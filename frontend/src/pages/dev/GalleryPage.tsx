/**
 * Design-system gallery — every Warm Editorial primitive in one scroll
 * (Stage 0.3 demo). Routed at `/dev/gallery` for super_admin. Not product IA.
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowUpRight,
  CalendarPlus,
  Inbox,
  Lock,
  SlidersHorizontal,
} from 'lucide-react';
import { LeaveApplyDrawer } from '../leave/LeaveApplyDrawer';
import {
  EMPTY_PEOPLE_FILTERS,
  PeopleFilterDrawer,
} from '../people/PeopleFilterDrawer';
import type { PeopleFilters } from '../people/PeopleFilterDrawer';
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
  MonthCalendar,
  Pill,
  SegmentedProgress,
  Skeleton,
  StatusBadge,
  Timeline,
  Tooltip,
  toast,
} from '../../ui';
import type {
  AttendanceDay,
  Column,
  Dot,
  StatusTone,
  TimelineStep,
} from '../../ui';

interface Employee {
  ecode: string;
  name: string;
  designation: string;
  dept: string;
  entity: string;
  status: { tone: StatusTone; label: string };
}

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

const MY_JULY: Partial<Record<number, AttendanceDay>> = {
  1: { state: 'present', note: 'In 08:58 · Out 18:04 · Gate 3' },
  2: { state: 'present', note: 'In 09:06 · Out 18:22 · Gate 3' },
  3: { state: 'absent', note: 'No swipe recorded' },
  4: { state: 'halfday', note: 'In 09:01 · Out 13:30 · GCS Saturday' },
  5: { state: 'weekoff' },
  6: { state: 'leave', note: 'Casual leave · approved' },
  7: { state: 'present', note: 'In 08:52 · Out 18:41 · Gate 1' },
  8: { state: 'present', note: 'In 09:00 · still in' },
  12: { state: 'weekoff' },
  19: { state: 'weekoff' },
  26: { state: 'weekoff' },
};

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

export function GalleryPage() {
  const [selected, setSelected] = useState<Employee | null>(null);
  const [approvalsCleared, setApprovalsCleared] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [peopleFilters, setPeopleFilters] =
    useState<PeopleFilters>(EMPTY_PEOPLE_FILTERS);
  const [entitiesLoading, setEntitiesLoading] = useState(true);

  useEffect(() => {
    setEntitiesLoading(true);
    const t = setTimeout(() => {
      setEntitiesLoading(false);
    }, 900);
    return () => {
      clearTimeout(t);
    };
  }, []);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">Design system</p>
          <h1 className="mt-0.5 text-3xl font-light tracking-tight text-ink">
            Component gallery
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Warm Editorial primitives — compose screens from these, never invent.
          </p>
        </div>
        <Button
          variant="secondary"
          leadingIcon={<CalendarPlus />}
          onClick={() => {
            setLeaveOpen(true);
          }}
        >
          Apply leave
        </Button>
      </div>

      <KpiPillRow
        pills={[
          { label: 'Headcount', value: 1066, state: 'filled' },
          { label: 'Absent today', value: 38, state: 'accent' },
          { label: 'Pending approvals', value: 12, state: 'hatched' },
          { label: 'Joiners this month', value: 24, state: 'outline' },
        ]}
      />

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

      <section className="space-y-4">
        <SectionHead
          title="People"
          meta={`${String(EMPLOYEES.length)} of 1,066`}
          action={
            <div className="flex items-center gap-1">
              <Tooltip label="Filter people">
                <IconButton
                  label="Filter people"
                  icon={<SlidersHorizontal />}
                  size="sm"
                  onClick={() => {
                    setFiltersOpen(true);
                  }}
                />
              </Tooltip>
            </div>
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="My attendance" subtitle="July 2026" />
          <MonthCalendar year={2026} month={7} days={MY_JULY} />
        </Card>
        <Card>
          <CardHeader title="Workforce by entity" subtitle="14 legal entities" />
          {entitiesLoading ? (
            <div aria-busy className="flex flex-wrap gap-2">
              {ENTITIES.map((e) => (
                <Skeleton key={e.code} className="h-7 w-24 rounded-full" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {ENTITIES.map((e, i) => (
                <Pill key={e.code} accent={i === 0}>
                  {e.code} · {e.count}
                </Pill>
              ))}
            </div>
          )}
        </Card>
      </div>

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
                    toast.success('Leave request approved', {
                      description: 'The employee and HR have been notified.',
                      action: {
                        label: 'Undo',
                        onClick: () => {
                          setApprovalsCleared(false);
                        },
                      },
                    });
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
              <h3 className="mb-3 text-sm font-semibold text-ink">June attendance</h3>
              <DotMatrix dots={ATT_DOTS} columns={7} />
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold text-ink">Request timeline</h3>
              <Timeline steps={APPROVAL_CHAIN} />
            </div>
          </div>
        )}
      </Drawer>

      <LeaveApplyDrawer
        open={leaveOpen}
        onClose={() => {
          setLeaveOpen(false);
        }}
      />

      <PeopleFilterDrawer
        open={filtersOpen}
        onClose={() => {
          setFiltersOpen(false);
        }}
        filters={peopleFilters}
        onChange={setPeopleFilters}
        onApply={() => {
          setFiltersOpen(false);
          toast.info('Filters applied', {
            description: 'Gallery demo — real directory is at /people.',
          });
        }}
      />

      <ConfirmModal
        open={finalizeOpen}
        onClose={() => {
          setFinalizeOpen(false);
        }}
        onConfirm={() => {
          setFinalized(true);
          toast.success('June 2026 payroll finalized', {
            description: 'Run locked · payslips issued to 1,066 employees.',
          });
        }}
        title="Finalize June 2026 payroll?"
        description="This locks the run and issues payslips. It cannot be undone without a super-admin reopen."
        confirmLabel="Finalize"
        typedConfirmation="FINALIZE JUNE 2026"
      />
    </div>
  );
}
