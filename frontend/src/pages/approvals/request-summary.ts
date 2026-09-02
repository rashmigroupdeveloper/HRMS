/**
 * Turn a workflow payload (leave, AR/OD, OT, letters, …) into rows a manager
 * can decide from. The inbox used to pretty-print JSON — recognition failure
 * on the #1 daily loop (docs/05 §3, P1-T12).
 *
 * Unknown keys still surface as labelled rows; ids stay in the technical dump.
 */
import { formatDateIN } from '../../ui/calendar';

interface SummaryRow {
  label: string;
  value: string;
}

interface RequestSummary {
  rows: SummaryRow[];
  preview: string;
  consequence: string;
}

const SKIP = new Set([
  'id',
  'requestId',
  'applicationId',
  'leaveTypeId',
  'restrictedHolidayId',
  'letterId',
  'employeeId',
  'workflowRequestId',
]);

const LABEL: Record<string, string> = {
  leaveType: 'Leave type',
  type: 'Type',
  kind: 'Kind',
  fromDate: 'From',
  from: 'From',
  toDate: 'To',
  to: 'To',
  date: 'Date',
  workDate: 'Work date',
  days: 'Days',
  detectedMinutes: 'Detected',
  minutes: 'Minutes',
  fromTime: 'From time',
  toTime: 'To time',
  reason: 'Reason',
  site: 'Site',
  name: 'Name',
  deadline: 'Decide by',
  templateCode: 'Template',
};

const KIND_LABEL: Record<string, string> = {
  AR: 'Attendance regularisation',
  OD: 'On duty',
  PERMISSION: 'Permission',
};

const KEY_ORDER = [
  'leaveType',
  'type',
  'kind',
  'fromDate',
  'from',
  'toDate',
  'to',
  'date',
  'workDate',
  'days',
  'detectedMinutes',
  'minutes',
  'fromTime',
  'toTime',
  'reason',
  'site',
  'name',
  'deadline',
  'templateCode',
] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T/;
const MINUTE_KEYS = new Set(['detectedMinutes', 'minutes']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function humanizeKey(key: string): string {
  const mapped = LABEL[key];
  if (mapped !== undefined) return mapped;
  const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes)) return String(minutes);
  const whole = Math.round(minutes);
  if (Math.abs(whole) < 60) return `${String(whole)} min`;
  const hours = Math.trunc(whole / 60);
  const rest = Math.abs(whole % 60);
  if (rest === 0) return `${String(hours)}h`;
  return `${String(hours)}h ${String(rest)}m`;
}

function formatInstant(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatScalar(key: string, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (MINUTE_KEYS.has(key)) return formatMinutes(value);
    return value.toLocaleString('en-IN');
  }
  if (typeof value !== 'string') return null;
  if (KIND_LABEL[value] !== undefined) return KIND_LABEL[value];
  if (ISO_DATE.test(value)) return formatDateIN(value);
  if (ISO_INSTANT.test(value)) return formatInstant(value);
  return value;
}

function orderedKeys(record: Record<string, unknown>): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const key of KEY_ORDER) {
    if (key in record && !SKIP.has(key)) {
      keys.push(key);
      seen.add(key);
    }
  }
  for (const key of Object.keys(record).sort()) {
    if (seen.has(key) || SKIP.has(key)) continue;
    keys.push(key);
  }
  return keys;
}

function rowsFromPayload(payload: unknown): SummaryRow[] {
  if (!isRecord(payload)) return [];
  const rows: SummaryRow[] = [];
  for (const key of orderedKeys(payload)) {
    const value = formatScalar(key, payload[key]);
    if (value === null) continue;
    rows.push({ label: humanizeKey(key), value });
  }
  return rows;
}

function dateSpan(record: Record<string, unknown>): string | null {
  const from = formatScalar('fromDate', record['fromDate'] ?? record['from']);
  const to = formatScalar('toDate', record['toDate'] ?? record['to']);
  if (from !== null && to !== null && from !== to) return `${from} to ${to}`;
  return from ?? to ?? formatScalar('date', record['workDate'] ?? record['date']);
}

function consequence(type: string, payload: unknown): string {
  if (!isRecord(payload)) {
    return 'Approving grants this request as submitted. Rejecting or sending it back needs a note.';
  }
  const span = dateSpan(payload);
  const days = formatScalar('days', payload['days']);
  const leave = formatScalar('leaveType', payload['leaveType'] ?? payload['type']);
  const detected = formatScalar(
    'detectedMinutes',
    payload['detectedMinutes'] ?? payload['minutes'],
  );
  const kind = formatScalar('kind', payload['kind']);

  if (type === 'overtime' || detected !== null) {
    return span === null
      ? `Approving records ${detected ?? 'detected overtime'} against the 48-hour rule.`
      : `Approving records ${detected ?? 'detected overtime'} for ${span}.`;
  }
  if (type === 'od' || kind === KIND_LABEL['OD']) {
    return span === null
      ? 'Approving marks the requested days as on duty.'
      : `Approving marks ${span} as on duty.`;
  }
  if (type === 'regularization' || kind === KIND_LABEL['AR']) {
    return span === null
      ? 'Approving marks the requested days as present.'
      : `Approving marks ${span} as present.`;
  }
  if (type === 'leave' || type === 'comp_off' || leave !== null) {
    const daysBit = days === null ? 'leave' : `${days} day${days === '1' ? '' : 's'}`;
    const typeBit = leave ?? 'leave';
    return span === null
      ? `Approving grants ${daysBit} of ${typeBit}.`
      : `Approving grants ${daysBit} of ${typeBit} (${span}).`;
  }
  if (type === 'leave_cancel') {
    return 'Approving cancels the leave and returns the days to the ledger.';
  }
  if (type === 'leave_encashment') {
    return days === null
      ? 'Approving encashes the requested leave days.'
      : `Approving encashes ${days} day${days === '1' ? '' : 's'}.`;
  }
  return 'Approving grants this request as submitted. Rejecting or sending it back needs a note.';
}

export function summarizeRequest(type: string, payload: unknown): RequestSummary {
  const rows = rowsFromPayload(payload);
  const previewParts: string[] = [];
  for (const row of rows) {
    if (previewParts[previewParts.length - 1] === row.value) continue;
    previewParts.push(row.value);
    if (previewParts.length === 3) break;
  }
  return {
    rows,
    preview: previewParts.join(' · '),
    consequence: consequence(type, payload),
  };
}

export function payloadAsJson(payload: unknown): string {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}
