/**
 * Concrete Stage 1.7 supporting reports — R2–R6, R24, R27 (docs/06).
 */
import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { Send } from 'lucide-react';
import { Button, Drawer, formatDateIN, TextField, StatusBadge, toast, type Column } from '../../ui';
import { SupportingReportPage } from './SupportingReportPage';
import { qs } from './report-utils';

// ── R2 ──────────────────────────────────────────────────────────────────────

interface R2Row {
  ecode: string;
  employeeName: string;
  workDate: string;
  status: 'P' | 'A' | 'HD' | 'WO' | 'H' | 'L' | 'OD' | 'CO' | 'UAB' | null;
  firstIn: string | null;
  lastOut: string | null;
  workedMinutes: number | null;
  lateMinutes: number | null;
  earlyExitMinutes: number | null;
  otMinutes: number | null;
  firstDoor: string | null;
  lastDoor: string | null;
  mappedLocation: string | null;
  majoritySwipeLocation: string | null;
  crossPlantFlag: boolean;
  rawSwipeCount: number;
  statusVsSwipes:
    | 'match'
    | 'status_without_swipes'
    | 'swipes_without_presence'
    | 'missing_day_record'
    | 'both_absent';
}

const r2Columns: Column<R2Row>[] = [
  {
    key: 'plant',
    header: 'Plant check',
    width: 'minmax(160px,1fr)',
    render: (r) => (
      <div className="text-xs">
        <StatusBadge tone={r.mappedLocation === null ? 'neutral' : r.crossPlantFlag ? 'warning' : 'positive'}>
          {r.mappedLocation === null ? 'Unmapped' : r.crossPlantFlag ? 'Cross-plant' : 'Mapped'}
        </StatusBadge>
        <p className="mt-1 text-ink-muted">
          {(r.mappedLocation ?? 'Unmapped') + ' · majority ' + (r.majoritySwipeLocation ?? '—')}
        </p>
      </div>
    ),
  },
  {
    key: 'emp',
    header: 'Employee',
    width: 'minmax(160px,1.2fr)',
    render: (r) => (
      <div>
        <p className="font-semibold text-ink">{r.employeeName}</p>
        <p className="text-xs text-ink-muted">{r.ecode}</p>
      </div>
    ),
  },
  { key: 'date', header: 'Date', width: '110px', render: (r) => formatDateIN(r.workDate) },
  {
    key: 'status',
    header: 'Status',
    width: '72px',
    render: (r) => (
      <StatusBadge tone={r.status === null ? 'negative' : 'neutral'}>
        {r.status ?? 'Not processed'}
      </StatusBadge>
    ),
  },
  {
    key: 'late',
    header: 'Late',
    width: '72px',
    numeric: true,
    render: (r) => r.lateMinutes ?? '—',
  },
  {
    key: 'early',
    header: 'Early',
    width: '72px',
    numeric: true,
    render: (r) => r.earlyExitMinutes ?? '—',
  },
  {
    key: 'ot',
    header: 'OT',
    width: '64px',
    numeric: true,
    render: (r) => r.otMinutes ?? '—',
  },
  {
    key: 'doors',
    header: 'Doors',
    width: 'minmax(140px,1fr)',
    render: (r) => (
      <span className="text-xs text-ink-muted">
        {(r.firstDoor ?? '—') + ' → ' + (r.lastDoor ?? '—')}
      </span>
    ),
  },
  {
    key: 'recon',
    header: 'vs swipes',
    width: '150px',
    render: (r) => (
      <StatusBadge
        tone={
          r.statusVsSwipes === 'missing_day_record'
            ? 'negative'
            : r.statusVsSwipes === 'match'
            ? 'positive'
            : r.statusVsSwipes === 'both_absent'
              ? 'neutral'
              : 'warning'
        }
      >
        {r.statusVsSwipes.replaceAll('_', ' ')}
      </StatusBadge>
    ),
  },
  {
    key: 'raw',
    header: 'Raw #',
    width: '72px',
    numeric: true,
    render: (r) => r.rawSwipeCount,
  },
];

interface R2RawSwipeRow {
  employeeNo: string; accessCard: string | null; shiftLabel: string | null; swipeTs: string;
  doorCode: string | null; longitude: string | null; latitude: string | null;
  locationType: string | null; mobileDeviceName: string | null; mobileDeviceId: string | null;
  swipeType: string | null; direction: string | null; remarks: string | null;
  permissionReason: string | null; signedBy: string | null; receivedAt: string; source: string;
}

export function R2SwipesPage() {
  const [selected, setSelected] = useState<R2Row | null>(null);
  const [raw, setRaw] = useState<R2RawSwipeRow[]>([]);
  const [rawError, setRawError] = useState<string | null>(null);

  const openRaw = async (row: R2Row) => {
    setSelected(row);
    setRaw([]);
    setRawError(null);
    try {
      setRaw(await apiFetch<R2RawSwipeRow[]>(`/api/reports/r2-swipes/raw${qs({
        ecode: row.ecode, workDate: row.workDate,
      })}`));
    } catch (cause) {
      setRawError(cause instanceof Error ? cause.message : 'Could not load raw swipes.');
    }
  };

  return (
    <>
      <SupportingReportPage<R2Row>
        code="R2"
        title="Swipe detail"
        subtitle="First-in / last-out, mapped-versus-majority plant evidence, and lossless raw-swipe drill-down."
        listPath="/api/reports/r2-swipes"
        exportPath="/api/reports/r2-swipes/export"
        columns={r2Columns}
        rowKey={(r) => `${r.ecode}-${r.workDate}`}
        onRowClick={(row) => { void openRaw(row); }}
        selectedKey={selected ? `${selected.ecode}-${selected.workDate}` : undefined}
        mode="month"
        buildQuery={(f) => ({ companyId: Number(f.companyId), month: f.month, ecode: f.ecode || undefined })}
        parseRows={(body) => body as R2Row[]}
        filterFields={({ filters, set }) => (
          <TextField label="Emp ID (optional)" value={filters.ecode}
            onChange={(e) => { set({ ecode: e.currentTarget.value }); }} />
        )}
      />
      <Drawer open={selected !== null} onClose={() => { setSelected(null); }}
        title={selected ? `${selected.ecode} · ${formatDateIN(selected.workDate)}` : 'Raw swipes'}
        subtitle="All Kent fields retained exactly as ingested">
        {rawError ? <p className="text-sm text-negative" role="alert">{rawError}</p> : null}
        <div className="space-y-3">
          {raw.map((swipe, index) => (
            <div key={`${swipe.swipeTs}-${String(index)}`} className="rounded-tile bg-surface-2 p-4">
              <p className="font-semibold text-ink">{new Date(swipe.swipeTs).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {Object.entries(swipe).map(([key, value]) => (
                  <div key={key}><dt className="text-ink-muted">{key}</dt><dd className="break-words text-ink">{value ?? '—'}</dd></div>
                ))}
              </dl>
            </div>
          ))}
          {!rawError && raw.length === 0 ? <p className="text-sm text-ink-muted">No owned raw swipes.</p> : null}
        </div>
      </Drawer>
    </>
  );
}

// ── R3 ──────────────────────────────────────────────────────────────────────

interface R3Row {
  id: number;
  ecode: string;
  employeeName: string;
  kind: string;
  fromDate: string;
  toDate: string;
  reason: string;
  applied: boolean;
  workflowStatus: string;
  requestedStatus: string;
  timeline: {
    stepNo: number; approverName: string; delegatedFromName: string | null;
    action: string | null; comment: string | null; notifiedAt: string;
    actedAt: string | null; slaDueAt: string;
  }[];
}

const r3Columns: Column<R3Row>[] = [
  {
    key: 'emp',
    header: 'Employee',
    width: 'minmax(150px,1.2fr)',
    render: (r) => (
      <div>
        <p className="font-semibold text-ink">{r.employeeName}</p>
        <p className="text-xs text-ink-muted">{r.ecode}</p>
      </div>
    ),
  },
  { key: 'kind', header: 'Kind', width: '110px', render: (r) => r.kind },
  {
    key: 'period',
    header: 'Period',
    width: '160px',
    render: (r) => `${formatDateIN(r.fromDate)} → ${formatDateIN(r.toDate)}`,
  },
  {
    key: 'wf',
    header: 'Workflow',
    width: '110px',
    render: (r) => <StatusBadge tone="neutral">{r.workflowStatus}</StatusBadge>,
  },
  {
    key: 'applied',
    header: 'Applied',
    width: '90px',
    render: (r) => (
      <StatusBadge tone={r.applied ? 'positive' : 'neutral'}>
        {r.applied ? 'Yes' : 'No'}
      </StatusBadge>
    ),
  },
  {
    key: 'timeline',
    header: 'Approval receipts',
    width: 'minmax(260px,1.8fr)',
    render: (r) => (
      <ol className="space-y-1 text-xs">
        {r.timeline.map((step, index) => (
          <li key={`${String(step.stepNo)}-${String(index)}`}>
            <span className="font-medium text-ink">{step.approverName}</span>
            <span className="text-ink-muted"> · notified {new Date(step.notifiedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} · {step.action ?? 'pending'}</span>
            {step.actedAt ? <span className="text-ink-muted"> · acted {new Date(step.actedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span> : null}
          </li>
        ))}
      </ol>
    ),
  },
  {
    key: 'reason',
    header: 'Reason',
    width: 'minmax(160px,1.4fr)',
    render: (r) => <span className="text-sm text-ink-muted">{r.reason}</span>,
  },
];

export function R3RegularizationsPage() {
  return (
    <SupportingReportPage<R3Row>
      code="R3"
      title="AR / OD register"
      subtitle="Regularisation, permission and on-duty requests with workflow state."
      listPath="/api/reports/r3-regularizations"
      exportPath="/api/reports/r3-regularizations/export"
      columns={r3Columns}
      rowKey={(r) => String(r.id)}
      mode="company"
      buildQuery={(f) => ({
        companyId: Number(f.companyId),
        kind: f.kind || undefined,
        status: f.status || undefined,
      })}
      parseRows={(body) => body as R3Row[]}
      filterFields={({ filters, set }) => (
        <>
          <TextField
            label="Kind filter"
            placeholder="AR / OD / PERMISSION"
            value={filters.kind}
            onChange={(e) => {
              set({ kind: e.currentTarget.value });
            }}
          />
          <TextField
            label="Workflow status"
            placeholder="pending / approved…"
            value={filters.status}
            onChange={(e) => {
              set({ status: e.currentTarget.value });
            }}
          />
        </>
      )}
    />
  );
}

// ── R4 ──────────────────────────────────────────────────────────────────────

interface R4Row {
  ecode: string;
  employeeName: string;
  workDate: string;
  status: string;
  lateMinutes: number;
  earlyExitMinutes: number;
  monthlyExceptionCount: number;
  monthlyLateMinutes: number;
  monthlyEarlyExitMinutes: number;
  monthlyUabDays: number;
}

const r4Columns: Column<R4Row>[] = [
  {
    key: 'emp',
    header: 'Employee',
    width: 'minmax(160px,1.2fr)',
    render: (r) => (
      <div>
        <p className="font-semibold text-ink">{r.employeeName}</p>
        <p className="text-xs text-ink-muted">{r.ecode}</p>
      </div>
    ),
  },
  { key: 'date', header: 'Date', width: '110px', render: (r) => formatDateIN(r.workDate) },
  {
    key: 'status',
    header: 'Status',
    width: '80px',
    render: (r) => (
      <StatusBadge tone={r.status === 'UAB' ? 'negative' : 'warning'}>{r.status}</StatusBadge>
    ),
  },
  {
    key: 'late',
    header: 'Late mins',
    width: '90px',
    numeric: true,
    render: (r) => r.lateMinutes,
  },
  {
    key: 'month',
    header: 'Monthly summary',
    width: '190px',
    render: (r) => (
      <span className="text-xs text-ink-muted">
        {r.monthlyExceptionCount} exceptions · {r.monthlyLateMinutes} late · {r.monthlyEarlyExitMinutes} early · {r.monthlyUabDays} UAB
      </span>
    ),
  },
  {
    key: 'early',
    header: 'Early mins',
    width: '90px',
    numeric: true,
    render: (r) => r.earlyExitMinutes,
  },
];

export function R4ExceptionsPage() {
  return (
    <SupportingReportPage<R4Row>
      code="R4"
      title="Attendance exceptions"
      subtitle="Late arrivals, early exits and unauthorised absence for the month."
      listPath="/api/reports/r4-exceptions"
      exportPath="/api/reports/r4-exceptions/export"
      columns={r4Columns}
      rowKey={(r) => `${r.ecode}-${r.workDate}`}
      mode="month"
      buildQuery={(f) => ({ companyId: Number(f.companyId), month: f.month })}
      parseRows={(body) => body as R4Row[]}
    />
  );
}

// ── R5 ──────────────────────────────────────────────────────────────────────

interface R5Row {
  ecode: string;
  employeeName: string;
  workDate: string;
  detectedMinutes: number;
  claimedMinutes: number;
  approvedMinutes: number | null;
  status: string;
  managerEcode: string | null;
  managerName: string | null;
  decisionLatencyHours: number | null;
  within48h: boolean | null;
  convertedCompOff: boolean;
  compOffCreditId: number | null;
  payrollItemId: number | null;
  managerDecisionCount: number;
  managerAverageLatencyHours: number | null;
}

const r5Columns: Column<R5Row>[] = [
  {
    key: 'emp',
    header: 'Employee',
    width: 'minmax(150px,1.2fr)',
    render: (r) => (
      <div>
        <p className="font-semibold text-ink">{r.employeeName}</p>
        <p className="text-xs text-ink-muted">{r.ecode}</p>
      </div>
    ),
  },
  { key: 'date', header: 'Date', width: '110px', render: (r) => formatDateIN(r.workDate) },
  {
    key: 'det',
    header: 'Detected',
    width: '90px',
    numeric: true,
    render: (r) => r.detectedMinutes,
  },
  {
    key: 'app',
    header: 'Approved',
    width: '90px',
    numeric: true,
    render: (r) => r.approvedMinutes ?? '—',
  },
  {
    key: 'status',
    header: 'Status',
    width: '100px',
    render: (r) => (
      <StatusBadge
        tone={
          r.status === 'lapsed'
            ? 'negative'
            : r.status === 'approved'
              ? 'positive'
              : 'warning'
        }
      >
        {r.status}
      </StatusBadge>
    ),
  },
  {
    key: 'mgr',
    header: 'Manager',
    width: '140px',
    render: (r) => (
      <div><p>{r.managerName ?? '—'}</p><p className="text-xs text-ink-muted">{r.managerEcode ?? ''}</p></div>
    ),
  },
  {
    key: 'mgravg',
    header: 'Manager average',
    width: '130px',
    numeric: true,
    render: (r) => r.managerAverageLatencyHours === null
      ? '—'
      : `${String(r.managerAverageLatencyHours)} h / ${String(r.managerDecisionCount)} decisions`,
  },
  {
    key: 'lat',
    header: 'Latency h',
    width: '90px',
    numeric: true,
    render: (r) => r.decisionLatencyHours ?? '—',
  },
  {
    key: 'settlement',
    header: 'Settlement link',
    width: '130px',
    render: (r) => r.payrollItemId !== null
      ? `Payroll #${String(r.payrollItemId)}`
      : r.compOffCreditId !== null
        ? `Comp-off #${String(r.compOffCreditId)}`
        : 'Not settled',
  },
  {
    key: '48',
    header: '≤48h',
    width: '72px',
    render: (r) =>
      r.within48h === null ? (
        '—'
      ) : (
        <StatusBadge tone={r.within48h ? 'positive' : 'negative'}>
          {r.within48h ? 'Yes' : 'No'}
        </StatusBadge>
      ),
  },
];

export function R5OtPage() {
  return (
    <SupportingReportPage<R5Row>
      code="R5"
      title="Overtime register"
      subtitle="Detected vs claimed vs approved minutes with the 48-hour decision window."
      listPath="/api/reports/r5-ot"
      exportPath="/api/reports/r5-ot/export"
      columns={r5Columns}
      rowKey={(r) => `${r.ecode}-${r.workDate}`}
      mode="month"
      buildQuery={(f) => ({ companyId: Number(f.companyId), month: f.month })}
      parseRows={(body) => body as R5Row[]}
    />
  );
}

// ── R6 ──────────────────────────────────────────────────────────────────────

interface R6Row {
  id: number;
  ecode: string;
  employeeName: string;
  startDate: string;
  daysAbsent: number;
  stage: string;
  ownerName: string | null;
  letterId: number | null;
  letterStatus: string | null;
  letterContentPath: string | null;
  resolution: string | null;
}

const r6Columns: Column<R6Row>[] = [
  {
    key: 'emp',
    header: 'Employee',
    width: 'minmax(150px,1.2fr)',
    render: (r) => (
      <div>
        <p className="font-semibold text-ink">{r.employeeName}</p>
        <p className="text-xs text-ink-muted">{r.ecode}</p>
      </div>
    ),
  },
  { key: 'start', header: 'Start', width: '110px', render: (r) => formatDateIN(r.startDate) },
  {
    key: 'days',
    header: 'Days',
    width: '72px',
    numeric: true,
    render: (r) => r.daysAbsent,
  },
  {
    key: 'stage',
    header: 'Stage',
    width: '120px',
    render: (r) => (
      <StatusBadge tone={r.stage === 'show_cause' ? 'negative' : 'warning'}>{r.stage}</StatusBadge>
    ),
  },
  {
    key: 'owner',
    header: 'HR owner',
    width: '140px',
    render: (r) => r.ownerName ?? 'Unassigned',
  },
  {
    key: 'letter',
    header: 'Letter',
    width: '80px',
    render: (r) => r.letterContentPath === null
      ? '—'
      : <a className="font-medium text-ink underline decoration-accent underline-offset-4"
          href={r.letterContentPath} target="_blank" rel="noreferrer">
          #{String(r.letterId)} · {r.letterStatus ?? 'letter'}
        </a>,
  },
  {
    key: 'res',
    header: 'Resolution',
    width: '120px',
    render: (r) => r.resolution ?? 'open',
  },
];

export function R6AbsencePage() {
  return (
    <SupportingReportPage<R6Row>
      code="R6"
      title="Absence cases"
      subtitle="Continuous-absence watch and show-cause queue (ATT-10)."
      listPath="/api/reports/r6-absence"
      exportPath="/api/reports/r6-absence/export"
      columns={r6Columns}
      rowKey={(r) => String(r.id)}
      mode="company"
      buildQuery={(f) => ({
        companyId: Number(f.companyId),
        stage: f.stage || undefined,
        openOnly: f.openOnly || undefined,
      })}
      parseRows={(body) => body as R6Row[]}
      filterFields={({ filters, set }) => (
        <TextField
          label="Stage filter"
          placeholder="watch / show_cause…"
          value={filters.stage}
          onChange={(e) => {
            set({ stage: e.currentTarget.value });
          }}
        />
      )}
    />
  );
}

// ── R24 ─────────────────────────────────────────────────────────────────────

interface BoardingRow {
  ecode: string;
  name: string;
  designation: string | null;
  department: string | null;
  reportingManager: string | null;
  costCenter: string | null;
  location: string | null;
  doj: string | null;
  dol: string | null;
  exitReason: string | null;
  kind: 'join' | 'exit';
}

const r24Columns: Column<BoardingRow>[] = [
  {
    key: 'kind',
    header: 'Kind',
    width: '80px',
    render: (r) => (
      <StatusBadge tone={r.kind === 'join' ? 'positive' : 'warning'}>{r.kind}</StatusBadge>
    ),
  },
  {
    key: 'emp',
    header: 'Employee',
    width: 'minmax(150px,1.2fr)',
    render: (r) => (
      <div>
        <p className="font-semibold text-ink">{r.name}</p>
        <p className="text-xs text-ink-muted">{r.ecode}</p>
      </div>
    ),
  },
  { key: 'desig', header: 'Designation', width: '140px', render: (r) => r.designation ?? '—' },
  { key: 'dept', header: 'Department', width: '130px', render: (r) => r.department ?? '—' },
  { key: 'rm', header: 'RM', width: '130px', render: (r) => r.reportingManager ?? '—' },
  { key: 'cc', header: 'Cost centre', width: '100px', render: (r) => r.costCenter ?? '—' },
  {
    key: 'date',
    header: 'DOJ / DOL',
    width: '110px',
    render: (r) => (r.doj ?? r.dol) ? formatDateIN(r.doj ?? r.dol ?? '') : '—',
  },
];

export function R24BoardingPage() {
  const [sending, setSending] = useState(false);
  const sendNow = async () => {
    setSending(true);
    try {
      const result = await apiFetch<{ queued: number }>('/api/lifecycle/boarding-exit/send', {
        method: 'POST',
      });
      toast.success('Boarding & exit email queued', {
        description: `${String(result.queued)} recipient(s) — the 07:00 job sends the same payload.`,
      });
    } catch (cause) {
      toast.error('Send failed', {
        description: cause instanceof Error ? cause.message : 'Try again.',
      });
    } finally {
      setSending(false);
    }
  };
  return (
    <SupportingReportPage<BoardingRow>
      code="R24"
      title="Boarding & exits"
      subtitle="Date-range joiners and exits; the daily slice drives the 07:00 plant email (LC-03)."
      listPath="/api/reports/r24-boarding"
      exportPath="/api/reports/r24-boarding/export"
      columns={r24Columns}
      rowKey={(r) => `${r.kind}-${r.ecode}`}
      mode="range"
      buildQuery={(f) => ({
        companyId: Number(f.companyId),
        fromDate: f.fromDate,
        toDate: f.toDate,
      })}
      parseRows={(body) => {
        const data = body as { joins: BoardingRow[]; exits: BoardingRow[] };
        return [...data.joins, ...data.exits];
      }}
      extraActions={
        <Button
          variant="ghost"
          loading={sending}
          leadingIcon={<Send className="size-4" />}
          onClick={() => void sendNow()}
        >
          Send today’s email now
        </Button>
      }
    />
  );
}

// ── R27 ─────────────────────────────────────────────────────────────────────

interface R27Row {
  snapshotDate: string;
  status: string;
  company: string;
  location: string | null;
  category: string | null;
  department: string | null;
  grade: string | null;
  gender: string | null;
  ageBand: string;
  tenureBand: string;
  count: number;
}

const r27Columns: Column<R27Row>[] = [
  { key: 'date', header: 'Snapshot', width: '110px', render: (r) => formatDateIN(r.snapshotDate) },
  { key: 'company', header: 'Entity', width: '180px', render: (r) => r.company },
  { key: 'location', header: 'Plant', width: '130px', render: (r) => r.location ?? '—' },
  { key: 'status', header: 'Status', width: '120px', render: (r) => r.status },
  { key: 'cat', header: 'Category', width: '130px', render: (r) => r.category ?? '—' },
  { key: 'dept', header: 'Department', width: 'minmax(160px,1.2fr)', render: (r) => r.department ?? '—' },
  { key: 'grade', header: 'Grade', width: '90px', render: (r) => r.grade ?? '—' },
  { key: 'gender', header: 'Gender', width: '90px', render: (r) => r.gender ?? '—' },
  { key: 'age', header: 'Age band', width: '90px', render: (r) => r.ageBand },
  { key: 'tenure', header: 'Tenure', width: '110px', render: (r) => r.tenureBand },
  {
    key: 'n',
    header: 'Count',
    width: '90px',
    numeric: true,
    render: (r) => r.count.toLocaleString('en-IN'),
  },
];

export function R27HeadcountPage() {
  return (
    <SupportingReportPage<R27Row>
      code="R27"
      title="Headcount demographics"
      subtitle="Point-in-time or monthly trend by entity, plant, department, category, grade, gender, age and tenure."
      listPath="/api/reports/r27-headcount"
      exportPath="/api/reports/r27-headcount/export"
      columns={r27Columns}
      rowKey={(r) => [r.snapshotDate, r.company, r.location, r.status, r.category, r.department, r.grade, r.gender, r.ageBand, r.tenureBand].join('|')}
      mode="companyOptional"
      requireCompany={false}
      buildQuery={(f) => ({
        companyId: /^\d+$/.test(f.companyId) ? Number(f.companyId) : undefined,
        asOf: f.fromMonth && f.toMonth ? undefined : f.asOf,
        fromMonth: f.fromMonth || undefined,
        toMonth: f.toMonth || undefined,
      })}
      parseRows={(body) => body as R27Row[]}
      filterFields={({ filters, set }) => (
        <>
          <TextField label="Point in time" type="date" value={filters.asOf}
            onChange={(e) => { set({ asOf: e.currentTarget.value, fromMonth: '', toMonth: '' }); }} />
          <TextField label="Trend from (optional)" type="month" value={filters.fromMonth}
            onChange={(e) => { set({ fromMonth: e.currentTarget.value }); }} />
          <TextField label="Trend to (optional)" type="month" value={filters.toMonth}
            onChange={(e) => { set({ toMonth: e.currentTarget.value }); }} />
        </>
      )}
    />
  );
}
