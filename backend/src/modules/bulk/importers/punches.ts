/**
 * Attendance punches from the Kent "Employee Swipe Details" export (or the
 * template). Swipe times are wall-clock in the EMPLOYEE'S ENTITY timezone
 * (core.companies.timezone), never a hard-coded IST. Re-uploading the same
 * punches is harmless: (employee, time, door) is unique and existing punches
 * are skipped. Punches in a locked attendance month are refused.
 */
import { sql } from 'kysely';
import { z } from 'zod';
import { writeAudit } from '../../../core/audit/audit.service.js';
import type { BulkImporter } from '../../../core/bulk/index.js';
import { isMonthLocked } from '../../attendance/index.js';
import { attachEmployees, hasRowError, num, opt, rowError, str } from '../helpers.js';

const noContext = z.object({}).strict();
type NoCtx = z.infer<typeof noContext>;
const SOURCE = 'excel_import';

/** Direction comes from Status (KENT_RESEARCH §4.8); legacy templates that put IN/OUT in Swipe Type still work. */
function directionOf(status: Parameters<typeof str>[0], swipeType: Parameters<typeof str>[0]): 'in' | 'out' | null {
  for (const v of [status, swipeType]) {
    const t = str(v).trim().toLowerCase();
    if (t === 'in' || t === 'check in' || t === 'checkin') return 'in';
    if (t === 'out' || t === 'check out' || t === 'checkout') return 'out';
  }
  return null;
}

export const punchesImporter: BulkImporter<NoCtx> = {
  key: 'punches',
  title: 'Attendance punches (biometric / Kent)',
  description: 'Swipe-in/out records. Upload the Kent "Employee Swipe Details" export as-is, or use the template.',
  permission: 'attendance.manual_override',
  contextSchema: noContext,
  contextFields: [],
  columns: [
    { key: 'ecode', header: 'Employee No', aliases: ['employee code', 'ecode', 'employeeno', 'emp code'], type: 'string', required: true, help: 'E-code.' },
    { key: 'name', header: 'Employee Name', aliases: ['name'], type: 'string', help: 'For your reference; not imported.' },
    { key: 'swipe_at', header: 'Swipe Date', aliases: ['swipe time', 'punch time', 'swipe date time', 'date time'], type: 'datetime', required: true, help: 'Local date and time of the swipe, e.g. 16 Jun 2025 15:03:40.' },
    { key: 'door', header: 'Door/Address', aliases: ['door', 'door code', 'device', 'address'], type: 'string', maxLength: 120, help: 'Door or device (blank = manual upload).' },
    { key: 'access_card', header: 'Access Card', aliases: ['card', 'card no'], type: 'string', maxLength: 40, help: 'Optional.' },
    { key: 'shift', header: 'Shift', type: 'string', maxLength: 40, help: 'Optional shift label from the device.' },
    { key: 'swipe_type', header: 'Swipe Type', aliases: ['type'], type: 'string', maxLength: 20, help: 'Source tag from the export (e.g. "Astra" = greytHR sync agent). Not a direction.' },
    { key: 'status', header: 'Status', aliases: ['direction', 'in out', 'in/out'], type: 'string', maxLength: 20, help: 'IN / OUT when the device records it. Blank = first-in/last-out.' },
    { key: 'received_on', header: 'Received On', aliases: ['received at', 'received'], type: 'datetime', help: 'When the swipe reached the cloud (keeps the device-to-cloud lag). Blank = upload time.' },
    { key: 'longitude', header: 'Longitude', type: 'number', min: -180, max: 180, help: 'Mobile punches only.' },
    { key: 'latitude', header: 'Latitude', type: 'number', min: -90, max: 90, help: 'Mobile punches only.' },
    { key: 'location_type', header: 'Location Type', type: 'string', maxLength: 40, help: 'Optional.' },
    { key: 'device_name', header: 'Mobile Device Name', type: 'string', maxLength: 80, help: 'Optional.' },
    { key: 'device_id', header: 'Mobile Device Id', type: 'string', maxLength: 80, help: 'Optional.' },
    { key: 'remarks', header: 'Remarks', type: 'string', maxLength: 300, help: 'Optional.' },
    { key: 'permission_reason', header: 'Permission Reason', type: 'string', maxLength: 300, help: 'Optional.' },
    { key: 'signed_by', header: 'Signed In/Out By', aliases: ['signed by'], type: 'string', maxLength: 80, help: 'Optional.' },
  ],
  instructions: ['Times are local to the employee\'s entity (e.g. IST for Indian units).', 'Punches already in the system are skipped, so re-uploading a day is safe.', 'Months whose attendance is locked cannot take new punches.'],
  samples: [
    { ecode: 'RML033625', name: 'Prateek Kumar Singh', swipe_at: '16 Jun 2026 09:02:11', door: 'KGP-MAIN-GATE-1', swipe_type: 'Kent', status: 'IN', received_on: '16 Jun 2026 09:04:30' },
    { ecode: 'RML033625', name: 'Prateek Kumar Singh', swipe_at: '16 Jun 2026 18:07:45', door: 'KGP-MAIN-GATE-1', swipe_type: 'Kent', status: 'OUT' },
  ],
  rowKey: (v) => `${str(v['ecode']).toUpperCase()}|${str(v['swipe_at'])}|${str(v['door']).toUpperCase()}`,
  contextKey: () => 'punches',
  authorize: () => Promise.resolve(null),
  validate: async ({ db, actor }, rows) => {
    const emps = await attachEmployees(db, actor.scope, rows);
    const companies = await db.selectFrom('core.companies').select(['id', 'timezone']).execute();
    const tz = new Map(companies.map((c) => [c.id, c.timezone]));
    const lockCache = new Map<string, boolean>();
    const now = Date.now();
    for (const row of rows) {
      if (hasRowError(row)) continue;
      const emp = emps.get(str(row.values['ecode']).toUpperCase());
      if (!emp) continue;
      const at = str(row.values['swipe_at']);
      const key = `${String(emp.companyId)}|${at.slice(0, 7)}`;
      let locked = lockCache.get(key);
      if (locked === undefined) { locked = await isMonthLocked(db, emp.companyId, `${at.slice(0, 7)}-01`); lockCache.set(key, locked); }
      if (locked) { rowError(row, 'Swipe Date', `Attendance for ${at.slice(0, 7)} is locked`); continue; }
      if (Date.parse(`${at.replace(' ', 'T')}Z`) > now + 36 * 3600 * 1000) rowError(row, 'Swipe Date', 'Swipe is in the future');
      row.values['timezone'] = tz.get(emp.companyId) ?? 'UTC';
    }
  },
  commit: async ({ trx, actor }, rows, progress) => {
    const months = [...new Set(rows.map((r) => str(r.values['swipe_at']).slice(0, 7)))];
    // Partition by UTC month: also cover the neighbouring month for swipes near midnight on the 1st.
    const bounds = new Set<string>();
    for (const m of months) {
      const d = new Date(`${m}-01T00:00:00Z`);
      bounds.add(m);
      bounds.add(new Date(d.getTime() - 86400000).toISOString().slice(0, 7));
    }
    for (const m of bounds) await sql`SELECT att.ensure_swipe_partition(${`${m}-01`}::date)`.execute(trx);
    let created = 0;
    const chunk = 500;
    for (let i = 0; i < rows.length; i += chunk) {
      const slice = rows.slice(i, i + chunk);
      const res = await trx.insertInto('att.swipe_events').values(slice.map((r) => ({
        employee_id: num(r.values['employee_id']),
        employee_no: str(r.values['ecode']),
        access_card: opt(r.values['access_card']),
        shift_label: opt(r.values['shift']),
        swipe_ts: sql<Date>`(${str(r.values['swipe_at'])}::timestamp AT TIME ZONE ${str(r.values['timezone'])})` as unknown as Date,
        door_code: opt(r.values['door']) ?? 'MANUAL-UPLOAD',
        longitude: r.values['longitude'] === null ? null : String(r.values['longitude']),
        latitude: r.values['latitude'] === null ? null : String(r.values['latitude']),
        location_type: opt(r.values['location_type']),
        mobile_device_name: opt(r.values['device_name']),
        mobile_device_id: opt(r.values['device_id']),
        swipe_type: opt(r.values['swipe_type']),
        direction: directionOf(r.values['status'], r.values['swipe_type']),
        remarks: opt(r.values['remarks']),
        permission_reason: opt(r.values['permission_reason']),
        signed_by: opt(r.values['signed_by']),
        received_at: (opt(r.values['received_on'])
          ? sql<Date>`(${str(r.values['received_on'])}::timestamp AT TIME ZONE ${str(r.values['timezone'])})`
          : sql<Date>`now()`) as unknown as Date,
        source: SOURCE,
      }))).onConflict((oc) => oc.columns(['employee_no', 'swipe_ts', 'door_code']).doNothing()).executeTakeFirst();
      created += Number(res.numInsertedOrUpdatedRows ?? 0n);
      await progress(Math.min(i + chunk, rows.length));
    }
    await writeAudit(trx, { actorUserId: actor.userId, action: 'bulk_create', entity: 'att.swipe_events', field: 'punches', newValue: JSON.stringify({ created, skipped: rows.length - created }), ip: actor.ip });
    return { created, updated: 0, skipped: rows.length - created, notes: rows.length - created > 0 ? [`${String(rows.length - created)} punch(es) already existed and were skipped`] : [] };
  },
};
