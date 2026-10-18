import { dayPortionLabel } from '../attendance/attendance-portion';
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
  status: string;
  firstIn: string | null;
  lastOut: string | null;
  workedMinutes: number | null;
  lateMinutes: number;
  earlyExitMinutes: number;
  otMinutes: number;
  firstDoor: string | null;
  lastDoor: string | null;
  mappedLocation: string | null;
  majoritySwipeLocation: string | null;
  crossPlantFlag: boolean;
  rawSwipeCount: number;
  statusVsSwipes: string;
}

const r2Columns: Column<R2Row>[] = [
  {
    key: 'plant',
    header: 'Plant check',
    width: 'minmax(160px,1fr)',
    render: (r) => (
      <div className="text-xs">
        <StatusBadge tone={r.crossPlantFlag ? 'warning' : 'positive'}>
          {r.crossPlantFlag ? 'Cross-plant' : 'Mapped'}
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
    render: (r) => <StatusBadge tone="neutral">{r.status}</StatusBadge>,
  },
  {
    key: 'late',
    header: 'Late',
    width: '72px',
    numeric: true,
    render: (r) => r.lateMinutes,
  },
  {
    key: 'early',
    header: 'Early',
    width: '72px',
    numeric: true,
    render: (r) => r.earlyExitMinutes,
  },
  {
    key: 'ot',
    header: 'OT',
    width: '64px',
    numeric: true,
    render: (r) => r.otMinutes,
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
          r.statusVsSwipes === 'match'
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
        {rawError ? <p className="text-sm text-negative-ink" role="alert">{rawError}</p> : null}
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
  dayPortion: string;
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
  { key: 'dayPortion', header: 'Attendance half', width: '130px', render: r => dayPortionLabel(r.dayPortion) },
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

// ── R21 Offers and Candidates ───────────────────────────────────────────────

interface R21Row {
  candidateName: string;
  personalEmail: string;
  mobile: string;
  positionTitle: string;
  department: string | null;
  orgUnit: string | null;
  designation: string | null;
  category: string;
  offeredCtc: number;
  proposedDoj: string;
  offerDate: string;
  probationMonths: number | null;
  probationPercentage: number | null;
  workLocation: string | null;
  loiStatus: string;
  onboardingStatus: string;
}

const r21Columns: Column<R21Row>[] = [
  {
    key: 'candidate',
    header: 'Candidate',
    width: 'minmax(180px,1.2fr)',
    render: (r) => (
      <div>
        <p className="font-semibold text-ink">{r.candidateName}</p>
        <p className="text-xs text-ink-muted">{r.personalEmail} · {r.mobile}</p>
      </div>
    ),
  },
  { key: 'role', header: 'Position & Dept', width: '160px', render: (r) => (
    <div>
      <p className="text-ink">{r.positionTitle}</p>
      <p className="text-xs text-ink-muted">{r.department ?? r.orgUnit ?? '—'}</p>
    </div>
  )},
  { key: 'cat', header: 'Category', width: '110px', render: (r) => r.category.replace('_', ' ') },
  { key: 'offerDate', header: 'Offer Date', width: '100px', render: (r) => formatDateIN(r.offerDate) },
  { key: 'doj', header: 'Proposed DOJ', width: '100px', render: (r) => formatDateIN(r.proposedDoj) },
  { key: 'ctc', header: 'Offered CTC', width: '110px', numeric: true, render: (r) => `₹${r.offeredCtc.toLocaleString('en-IN')}` },
  { key: 'probation', header: 'Probation', width: '90px', numeric: true, render: (r) => r.probationPercentage ? `${String(r.probationPercentage)}%` : '—' },
  {
    key: 'status',
    header: 'LOI Status',
    width: '120px',
    render: (r) => (
      <StatusBadge tone={r.loiStatus === 'Accepted' ? 'positive' : r.loiStatus === 'Rejected' ? 'negative' : 'warning'}>
        {r.loiStatus}
      </StatusBadge>
    ),
  },
];

export function R21OffersPage() {
  return (
    <SupportingReportPage<R21Row>
      code="R21"
      title="Offers & Candidates Register"
      subtitle="Recruitment pipeline, LOI conversions, proposed joinings and probation salary terms."
      listPath="/api/reports/r21-offers"
      exportPath="/api/reports/r21-offers/export"
      columns={r21Columns}
      rowKey={(r) => `${r.candidateName}-${r.offerDate}`}
      mode="companyOptional"
      requireCompany={false}
      buildQuery={(f) => ({
        companyId: /^\d+$/.test(f.companyId) ? Number(f.companyId) : undefined,
      })}
      parseRows={(body) => body as R21Row[]}
    />
  );
}

// ── R23 Internal Movements & Transfers ──────────────────────────────────────

interface R23Row {
  transferId: number;
  employeeName: string;
  currentEcode: string;
  targetEcode: string | null;
  transferType: string;
  effectiveDate: string;
  status: string;
  fromCompany: string;
  toCompany: string | null;
  fromDepartment: string | null;
  toDepartment: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  fromDesignation: string | null;
  toDesignation: string | null;
  fromGrade: string | null;
  toGrade: string | null;
  reason: string | null;
}

const r23Columns: Column<R23Row>[] = [
  {
    key: 'emp',
    header: 'Employee',
    width: 'minmax(160px,1.2fr)',
    render: (r) => (
      <div>
        <p className="font-semibold text-ink">{r.employeeName}</p>
        <p className="text-xs text-ink-muted">{r.currentEcode}{r.targetEcode ? ` → ${r.targetEcode}` : ''}</p>
      </div>
    ),
  },
  { key: 'type', header: 'Type', width: '120px', render: (r) => <StatusBadge tone="neutral">{r.transferType.replace('_', ' ')}</StatusBadge> },
  { key: 'effDate', header: 'Effective', width: '100px', render: (r) => formatDateIN(r.effectiveDate) },
  {
    key: 'movement',
    header: 'From → To',
    width: 'minmax(200px,1.5fr)',
    render: (r) => (
      <div className="text-xs">
        <p className="text-ink">{r.fromDepartment ?? '—'} → {r.toDepartment ?? r.fromDepartment ?? '—'}</p>
        <p className="text-ink-muted">{r.fromLocation ?? '—'} → {r.toLocation ?? r.fromLocation ?? '—'}</p>
      </div>
    ),
  },
  { key: 'reason', header: 'Reason', width: 'minmax(140px,1fr)', render: (r) => <span className="text-xs text-ink-muted">{r.reason ?? '—'}</span> },
  { key: 'status', header: 'Status', width: '90px', render: (r) => <StatusBadge tone={r.status === 'approved' ? 'positive' : 'warning'}>{r.status}</StatusBadge> },
];

export function R23TransfersPage() {
  return (
    <SupportingReportPage<R23Row>
      code="R23"
      title="Internal Movements & Transfers"
      subtitle="Promotions, inter-department transfers, plant relocations and inter-company transfers."
      listPath="/api/reports/r23-transfers"
      exportPath="/api/reports/r23-transfers/export"
      columns={r23Columns}
      rowKey={(r) => String(r.transferId)}
      mode="companyOptional"
      requireCompany={false}
      buildQuery={(f) => ({
        companyId: /^\d+$/.test(f.companyId) ? Number(f.companyId) : undefined,
      })}
      parseRows={(body) => body as R23Row[]}
    />
  );
}

// ── R25 Probation Reviews ───────────────────────────────────────────────────

interface R25Row {
  reviewId: number;
  employeeName: string;
  ecode: string;
  department: string | null;
  designation: string | null;
  doj: string;
  dueDate: string;
  status: string;
  outcome: string | null;
  managerRecommendation: string | null;
  extensionMonths: number | null;
  isOverdue: boolean;
  reviewNotes: string | null;
}

const r25Columns: Column<R25Row>[] = [
  {
    key: 'emp',
    header: 'Employee',
    width: 'minmax(160px,1.2fr)',
    render: (r) => (
      <div>
        <p className="font-semibold text-ink">{r.employeeName}</p>
        <p className="text-xs text-ink-muted">{r.ecode} · {r.department ?? '—'}</p>
      </div>
    ),
  },
  { key: 'doj', header: 'DOJ', width: '100px', render: (r) => formatDateIN(r.doj) },
  {
    key: 'due',
    header: 'Due Date',
    width: '120px',
    render: (r) => (
      <div>
        <p className="text-ink">{formatDateIN(r.dueDate)}</p>
        {r.isOverdue && <StatusBadge tone="negative">Overdue</StatusBadge>}
      </div>
    ),
  },
  { key: 'rec', header: 'Recommendation', width: '130px', render: (r) => r.managerRecommendation ?? 'Pending' },
  { key: 'outcome', header: 'Outcome', width: '110px', render: (r) => r.outcome ? <StatusBadge tone={r.outcome === 'confirmed' ? 'positive' : 'warning'}>{r.outcome}</StatusBadge> : '—' },
  { key: 'notes', header: 'Notes', width: 'minmax(140px,1fr)', render: (r) => <span className="text-xs text-ink-muted">{r.reviewNotes ?? '—'}</span> },
];

export function R25ProbationPage() {
  return (
    <SupportingReportPage<R25Row>
      code="R25"
      title="Probation Reviews & Confirmations"
      subtitle="Evaluation schedules, manager assessments, extension tracking and overdue reviews."
      listPath="/api/reports/r25-probation"
      exportPath="/api/reports/r25-probation/export"
      columns={r25Columns}
      rowKey={(r) => String(r.reviewId)}
      mode="companyOptional"
      requireCompany={false}
      buildQuery={(f) => ({
        companyId: /^\d+$/.test(f.companyId) ? Number(f.companyId) : undefined,
      })}
      parseRows={(body) => body as R25Row[]}
    />
  );
}

// ── R26 Attrition Analysis ──────────────────────────────────────────────────

interface R26Row {
  separationId: number;
  employeeName: string;
  ecode: string;
  department: string | null;
  location: string | null;
  category: string | null;
  doj: string;
  tenureMonths: number;
  tenureBand: string;
  resignationDate: string;
  lwd: string | null;
  reason: string | null;
  exitType: 'Voluntary' | 'Involuntary';
  noticePeriodDays: number | null;
  shortfallDays: number | null;
  fnfStatus: string | null;
}

const r26Columns: Column<R26Row>[] = [
  {
    key: 'emp',
    header: 'Employee',
    width: 'minmax(160px,1.2fr)',
    render: (r) => (
      <div>
        <p className="font-semibold text-ink">{r.employeeName}</p>
        <p className="text-xs text-ink-muted">{r.ecode} · {r.department ?? '—'}</p>
      </div>
    ),
  },
  { key: 'exitType', header: 'Exit Type', width: '110px', render: (r) => <StatusBadge tone={r.exitType === 'Voluntary' ? 'neutral' : 'negative'}>{r.exitType}</StatusBadge> },
  { key: 'tenure', header: 'Tenure', width: '110px', render: (r) => <span>{r.tenureBand} ({r.tenureMonths}m)</span> },
  { key: 'dates', header: 'Resigned / LWD', width: '140px', render: (r) => (
    <div className="text-xs">
      <p className="text-ink">{formatDateIN(r.resignationDate)}</p>
      <p className="text-ink-muted">{r.lwd ? `LWD: ${formatDateIN(r.lwd)}` : '—'}</p>
    </div>
  )},
  { key: 'notice', header: 'Notice (Shortfall)', width: '120px', render: (r) => `${String(r.noticePeriodDays ?? 0)}d (${String(r.shortfallDays ?? 0)}d)` },
  { key: 'reason', header: 'Reason', width: 'minmax(150px,1fr)', render: (r) => <span className="text-xs text-ink-muted">{r.reason ?? '—'}</span> },
];

export function R26AttritionPage() {
  return (
    <SupportingReportPage<R26Row>
      code="R26"
      title="Attrition & Exit Analysis"
      subtitle="Voluntary vs involuntary attrition, tenure bands, notice shortfalls and reasons for exit."
      listPath="/api/reports/r26-attrition"
      exportPath="/api/reports/r26-attrition/export"
      columns={r26Columns}
      rowKey={(r) => String(r.separationId)}
      mode="companyOptional"
      requireCompany={false}
      buildQuery={(f) => ({
        companyId: /^\d+$/.test(f.companyId) ? Number(f.companyId) : undefined,
      })}
      parseRows={(body) => body as R26Row[]}
    />
  );
}

// ── R28 Asset Custody Register ──────────────────────────────────────────────

interface R28Row {
  assetId: number;
  assetNo: string;
  category: string;
  brand: string | null;
  model: string | null;
  serialNo: string | null;
  status: string;
  location: string | null;
  holderKind: string | null;
  holderName: string | null;
  holderEcode: string | null;
  assignedAt: string | null;
  warrantyExpiry: string | null;
}

const r28Columns: Column<R28Row>[] = [
  {
    key: 'asset',
    header: 'Asset Tag',
    width: 'minmax(150px,1fr)',
    render: (r) => (
      <div>
        <p className="font-semibold text-ink">{r.assetNo}</p>
        <p className="text-xs text-ink-muted">{r.category} · {r.model ?? r.brand ?? '—'}</p>
      </div>
    ),
  },
  { key: 'serial', header: 'Serial No', width: '130px', render: (r) => <span className="font-mono text-xs">{r.serialNo ?? '—'}</span> },
  { key: 'status', header: 'Status', width: '100px', render: (r) => <StatusBadge tone={r.status === 'assigned' ? 'positive' : 'neutral'}>{r.status}</StatusBadge> },
  {
    key: 'holder',
    header: 'Assigned Custodian',
    width: 'minmax(160px,1.2fr)',
    render: (r) => r.holderName ? (
      <div>
        <p className="font-medium text-ink">{r.holderName}</p>
        <p className="text-xs text-ink-muted">{r.holderEcode ?? '—'} · {r.location ?? '—'}</p>
      </div>
    ) : (
      <span className="text-ink-muted">In Inventory</span>
    ),
  },
  { key: 'assignedAt', header: 'Assigned On', width: '100px', render: (r) => r.assignedAt ? formatDateIN(r.assignedAt) : '—' },
  { key: 'warranty', header: 'Warranty Till', width: '100px', render: (r) => r.warrantyExpiry ? formatDateIN(r.warrantyExpiry) : '—' },
];

export function R28AssetsPage() {
  return (
    <SupportingReportPage<R28Row>
      code="R28"
      title="Asset Custody Register"
      subtitle="Complete hardware and property inventory, employee allocations, serials and warranty tracking."
      listPath="/api/reports/r28-assets"
      exportPath="/api/reports/r28-assets/export"
      columns={r28Columns}
      rowKey={(r) => String(r.assetId)}
      mode="companyOptional"
      requireCompany={false}
      buildQuery={(f) => ({
        companyId: /^\d+$/.test(f.companyId) ? Number(f.companyId) : undefined,
      })}
      parseRows={(body) => body as R28Row[]}
    />
  );
}

// ── R29 Helpdesk SLA Performance ───────────────────────────────────────────

interface R29Row {
  month: string;
  category: string;
  totalTickets: number;
  resolvedTickets: number;
  slaBreachedTickets: number;
  slaHitPct: number;
  avgFirstResponseHours: number | null;
  avgResolutionHours: number | null;
  reopenedTickets: number;
}

const r29Columns: Column<R29Row>[] = [
  { key: 'month', header: 'Month', width: '100px', render: (r) => r.month },
  { key: 'cat', header: 'Category', width: '140px', render: (r) => r.category },
  { key: 'total', header: 'Total Tickets', width: '100px', numeric: true, render: (r) => r.totalTickets },
  { key: 'resolved', header: 'Resolved', width: '90px', numeric: true, render: (r) => r.resolvedTickets },
  {
    key: 'slaHit',
    header: 'SLA Hit Rate',
    width: '120px',
    numeric: true,
    render: (r) => (
      <StatusBadge tone={r.slaHitPct >= 90 ? 'positive' : r.slaHitPct >= 75 ? 'warning' : 'negative'}>
        {r.slaHitPct.toFixed(1)}%
      </StatusBadge>
    ),
  },
  { key: 'breached', header: 'Breaches', width: '90px', numeric: true, render: (r) => r.slaBreachedTickets },
  { key: 'respTime', header: 'Avg Response', width: '110px', numeric: true, render: (r) => r.avgFirstResponseHours ? `${r.avgFirstResponseHours.toFixed(1)}h` : '—' },
  { key: 'resTime', header: 'Avg Resolution', width: '110px', numeric: true, render: (r) => r.avgResolutionHours ? `${r.avgResolutionHours.toFixed(1)}h` : '—' },
];

export function R29HelpdeskPage() {
  return (
    <SupportingReportPage<R29Row>
      code="R29"
      title="Helpdesk SLA Analytics"
      subtitle="Monthly ticket volumes, SLA resolution hit rates, response latency and auto-escalations."
      listPath="/api/reports/r29-helpdesk"
      exportPath="/api/reports/r29-helpdesk/export"
      columns={r29Columns}
      rowKey={(r) => `${r.month}-${r.category}`}
      mode="companyOptional"
      requireCompany={false}
      buildQuery={() => ({})}
      parseRows={(body) => body as R29Row[]}
    />
  );
}

// ── R30 Policy Compliance Matrix ────────────────────────────────────────────

interface R30Row {
  policyId: number;
  policyCode: string;
  policyTitle: string;
  version: number;
  mandatory: boolean;
  effectiveDate: string;
  targetedEmployees: number;
  acknowledgedEmployees: number;
  pendingEmployees: number;
  compliancePct: number;
}

const r30Columns: Column<R30Row>[] = [
  {
    key: 'policy',
    header: 'Policy',
    width: 'minmax(220px,1.5fr)',
    render: (r) => (
      <div>
        <p className="font-semibold text-ink">{r.policyTitle}</p>
        <p className="text-xs text-ink-muted">Code: {r.policyCode} · v{r.version} {r.mandatory ? '· Mandatory' : ''}</p>
      </div>
    ),
  },
  { key: 'effDate', header: 'Effective Date', width: '110px', render: (r) => formatDateIN(r.effectiveDate) },
  { key: 'target', header: 'Targeted', width: '90px', numeric: true, render: (r) => r.targetedEmployees },
  { key: 'ack', header: 'Acknowledged', width: '100px', numeric: true, render: (r) => r.acknowledgedEmployees },
  { key: 'pending', header: 'Pending', width: '90px', numeric: true, render: (r) => r.pendingEmployees },
  {
    key: 'pct',
    header: 'Compliance %',
    width: '120px',
    numeric: true,
    render: (r) => (
      <StatusBadge tone={r.compliancePct >= 95 ? 'positive' : r.compliancePct >= 75 ? 'warning' : 'negative'}>
        {r.compliancePct.toFixed(1)}%
      </StatusBadge>
    ),
  },
];

export function R30PoliciesPage() {
  return (
    <SupportingReportPage<R30Row>
      code="R30"
      title="Policy Compliance Matrix"
      subtitle="Mandatory workplace policies, employee acknowledgment rates, and pending compliance backlog."
      listPath="/api/reports/r30-policies"
      exportPath="/api/reports/r30-policies/export"
      columns={r30Columns}
      rowKey={(r) => String(r.policyId)}
      mode="companyOptional"
      requireCompany={false}
      buildQuery={() => ({})}
      parseRows={(body) => body as R30Row[]}
    />
  );
}

// ── R31 Reimbursement Utilization ───────────────────────────────────────────

interface R31Row {
  claimId: number;
  employeeName: string;
  ecode: string;
  department: string | null;
  claimType: string;
  periodFrom: string;
  periodTo: string;
  claimedAmount: number;
  approvedAmount: number | null;
  status: string;
  billsCount: number;
  verifiedBillsCount: number;
  paidInRunId: number | null;
  rejectionReason: string | null;
}

const r31Columns: Column<R31Row>[] = [
  {
    key: 'emp',
    header: 'Employee',
    width: 'minmax(160px,1.2fr)',
    render: (r) => (
      <div>
        <p className="font-semibold text-ink">{r.employeeName}</p>
        <p className="text-xs text-ink-muted">{r.ecode} · {r.department ?? '—'}</p>
      </div>
    ),
  },
  { key: 'type', header: 'Expense Type', width: '130px', render: (r) => r.claimType },
  { key: 'period', header: 'Claim Period', width: '130px', render: (r) => `${formatDateIN(r.periodFrom)} - ${formatDateIN(r.periodTo)}` },
  { key: 'claimed', header: 'Claimed', width: '110px', numeric: true, render: (r) => `₹${r.claimedAmount.toLocaleString('en-IN')}` },
  { key: 'approved', header: 'Approved', width: '110px', numeric: true, render: (r) => r.approvedAmount !== null ? `₹${r.approvedAmount.toLocaleString('en-IN')}` : '—' },
  { key: 'bills', header: 'Bills (Verified)', width: '110px', numeric: true, render: (r) => `${String(r.billsCount)} (${String(r.verifiedBillsCount)})` },
  { key: 'status', header: 'Status', width: '100px', render: (r) => <StatusBadge tone={r.status === 'approved' || r.status === 'paid' ? 'positive' : r.status === 'rejected' ? 'negative' : 'warning'}>{r.status}</StatusBadge> },
];

export function R31ClaimsPage() {
  return (
    <SupportingReportPage<R31Row>
      code="R31"
      title="Reimbursement Utilization"
      subtitle="Travel, conveyance and expense claims, receipt audits, approvals and settlement tracking."
      listPath="/api/reports/r31-claims"
      exportPath="/api/reports/r31-claims/export"
      columns={r31Columns}
      rowKey={(r) => String(r.claimId)}
      mode="companyOptional"
      requireCompany={false}
      buildQuery={(f) => ({
        companyId: /^\d+$/.test(f.companyId) ? Number(f.companyId) : undefined,
      })}
      parseRows={(body) => body as R31Row[]}
    />
  );
}

