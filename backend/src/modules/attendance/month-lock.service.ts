/**
 * Month-lock checklist + freeze (ATT-12/15, docs/04 §1.6, doc 14 §8.5).
 * Lock only when all checklist items are green; freezes day_records via is_locked.
 */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { addDaysIso, istDateString } from '../../core/dates.js';
import { getTypedSetting } from '../settings/index.js';

export interface ChecklistItem {
  code: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface MonthLockChecklist {
  companyId: number;
  month: string; // YYYY-MM-01
  items: ChecklistItem[];
  canLock: boolean;
  alreadyLocked: boolean;
}

function monthStart(month: string): string {
  // accept YYYY-MM or YYYY-MM-01
  return month.length === 7 ? `${month}-01` : month;
}

function nextMonthStart(monthIso: string): string {
  const [y = 0, m = 0] = monthStart(monthIso).split('-').map(Number);
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return `${ny}-${String(nm).padStart(2, '0')}-01`;
}

export async function getMonthLockChecklist(
  db: Kysely<Database>,
  companyId: number,
  month: string,
): Promise<MonthLockChecklist> {
  const m = monthStart(month);
  const mEnd = nextMonthStart(m);
  const maxAge = await getTypedSetting(db, 'att.month_lock_pending_max_age_days', 'number', 7);
  const managerApprovalRequired = await getTypedSetting(
    db,
    'att.manager_approval_required_for_lock',
    'boolean',
    false,
  );
  const cutoff = addDaysIso(istDateString(), -maxAge);

  const existing = await db
    .selectFrom('att.month_locks')
    .select('id')
    .where('company_id', '=', companyId)
    .where('month', '=', sql<Date>`${m}::date`)
    .executeTakeFirst();

  // Pending regularizations older than maxAge
  const pendingReg = await db
    .selectFrom('att.regularizations as reg')
    .innerJoin('wf.requests as r', 'r.id', 'reg.workflow_request_id')
    .innerJoin('core.employees as e', 'e.id', 'reg.employee_id')
    .where('e.company_id', '=', companyId)
    .where('r.status', 'in', ['pending', 'sent_back'])
    .where('reg.from_date', '<', sql<Date>`${cutoff}::date`)
    .select(({ fn }) => fn.countAll<number>().as('n'))
    .executeTakeFirstOrThrow();

  // Pending OT past deadline or older than maxAge
  const pendingOt = await db
    .selectFrom('att.overtime_entries as o')
    .innerJoin('core.employees as e', 'e.id', 'o.employee_id')
    .where('e.company_id', '=', companyId)
    .where('o.status', '=', 'pending')
    .where('o.work_date', '<', sql<Date>`${cutoff}::date`)
    .select(({ fn }) => fn.countAll<number>().as('n'))
    .executeTakeFirstOrThrow();

  // Unmatched swipes in the month window
  const unmatched = await db
    .selectFrom('att.swipe_events')
    .where('employee_id', 'is', null)
    .where('swipe_ts', '>=', sql<Date>`${m}::timestamptz`)
    .where('swipe_ts', '<', sql<Date>`${mEnd}::timestamptz`)
    .select(({ fn }) => fn.countAll<number>().as('n'))
    .executeTakeFirstOrThrow();

  // Silent devices (active with last_seen older than threshold)
  const silentMinutes = await getTypedSetting(db, 'att.device_silent_minutes', 'number', 15);
  const silentCutoff = new Date(Date.now() - silentMinutes * 60_000);
  const silent = await db
    .selectFrom('att.devices as device')
    .leftJoin('core.locations as location', 'location.id', 'device.location_id')
    .where('device.is_active', '=', true)
    .where((eb) =>
      eb.or([
        eb('location.company_id', '=', companyId),
        eb('device.location_id', 'is', null),
      ]),
    )
    .where((eb) =>
      eb.or([
        eb('device.last_seen_at', 'is', null),
        eb('device.last_seen_at', '<', silentCutoff),
      ]),
    )
    .select(({ fn }) => fn.countAll<number>().as('n'))
    .executeTakeFirstOrThrow();

  // Lock is stricter than day finalization: every location serving a biometric
  // employee in the entity must have every active door complete beyond the
  // month, including the possible next-morning end of a final-day night shift.
  const watermarkCoverage = await sql<{
    pending_locations: number;
    unmapped_employees: number;
  }>`
    WITH biometric_employees AS (
      SELECT e.location_id
      FROM core.employees e
      WHERE e.company_id = ${companyId}
        AND e.attendance_mode = 'biometric'
        AND e.biometric_registered = true
        AND e.status IN ('active', 'on_notice', 'exited')
        AND (e.doj IS NULL OR e.doj < ${mEnd}::date)
        AND (e.dol IS NULL OR e.dol >= ${m}::date)
    ), required_locations AS (
      SELECT DISTINCT location_id
      FROM biometric_employees
      WHERE location_id IS NOT NULL
    ), incomplete_locations AS (
      SELECT required.location_id
      FROM required_locations required
      LEFT JOIN att.devices device
        ON device.location_id = required.location_id
       AND device.is_active = true
      LEFT JOIN att.device_watermarks watermark
        ON watermark.device_id = device.id
      GROUP BY required.location_id
      HAVING COUNT(device.id) = 0
         OR COUNT(*) FILTER (
              WHERE watermark.watermark_ts IS NULL
                 OR watermark.watermark_ts < ${mEnd}::date + interval '1 day'
            ) > 0
    )
    SELECT
      (SELECT COUNT(*)::int FROM incomplete_locations) AS pending_locations,
      (SELECT COUNT(*)::int FROM biometric_employees WHERE location_id IS NULL) AS unmapped_employees
  `.execute(db);
  const coverage = watermarkCoverage.rows[0] ?? {
    pending_locations: 0,
    unmapped_employees: 0,
  };
  const watermarkIssues = coverage.pending_locations + coverage.unmapped_employees;

  const items: ChecklistItem[] = [
    {
      code: 'pending_requests',
      label: `No pending AR/OD older than ${String(maxAge)} days`,
      ok: pendingReg.n === 0,
      detail: pendingReg.n === 0 ? 'Clear' : `${String(pendingReg.n)} open request(s)`,
    },
    {
      code: 'pending_ot',
      label: `No pending OT older than ${String(maxAge)} days`,
      ok: pendingOt.n === 0,
      detail: pendingOt.n === 0 ? 'Clear' : `${String(pendingOt.n)} pending OT`,
    },
    {
      code: 'unmatched_swipes',
      label: 'Unmatched swipe queue empty for month',
      ok: unmatched.n === 0,
      detail: unmatched.n === 0 ? 'Clear' : `${String(unmatched.n)} unmatched`,
    },
    {
      code: 'device_health',
      label: 'No silent active devices',
      ok: silent.n === 0,
      detail: silent.n === 0 ? 'All devices healthy' : `${String(silent.n)} silent door(s)`,
    },
    {
      code: 'manager_approvals',
      label: 'Managers have approved team attendance',
      ok: !managerApprovalRequired,
      detail: managerApprovalRequired
        ? 'Approval ledger is not implemented; lock remains blocked'
        : 'Approval precondition disabled by policy',
    },
    {
      code: 'sync_watermark',
      label: 'Every relevant device watermark covers the full month',
      ok: watermarkIssues === 0,
      detail: watermarkIssues === 0
        ? 'All biometric locations synchronized'
        : `${String(coverage.pending_locations)} location(s) incomplete; ${String(coverage.unmapped_employees)} employee(s) lack location mapping`,
    },
  ];

  return {
    companyId,
    month: m,
    items,
    canLock: items.every((i) => i.ok) && !existing,
    alreadyLocked: Boolean(existing),
  };
}

export async function lockMonth(
  db: Kysely<Database>,
  params: { companyId: number; month: string; actorUserId: number },
): Promise<{ id: number }> {
  return db.transaction().execute(async (trx) => {
    const requestedMonth = monthStart(params.month);
    await sql`SELECT pg_advisory_xact_lock(${params.companyId}, hashtext(${requestedMonth}))`.execute(trx);

    const checklist = await getMonthLockChecklist(trx, params.companyId, requestedMonth);
    if (checklist.alreadyLocked) throw new Error('Month is already locked');
    if (!checklist.canLock) {
      const bad = checklist.items.filter((item) => !item.ok).map((item) => item.code);
      throw new Error(`Month lock blocked: ${bad.join(', ')}`);
    }

    const m = checklist.month;
    const mEnd = nextMonthStart(m);
    const lock = await trx
      .insertInto('att.month_locks')
      .values({
        company_id: params.companyId,
        month: sql<Date>`${m}::date`,
        locked_by: params.actorUserId,
        checklist: JSON.stringify(checklist.items),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await sql`
      UPDATE att.day_records d
      SET is_locked = true
      FROM core.employees e
      WHERE d.employee_id = e.id
        AND e.company_id = ${params.companyId}
        AND d.work_date >= ${m}::date
        AND d.work_date < ${mEnd}::date
        AND d.is_locked = false
    `.execute(trx);

    await writeAudit(trx, {
      actorUserId: params.actorUserId,
      action: 'create',
      entity: 'att.month_locks',
      entityId: lock.id,
      field: 'lock',
      newValue: `company ${String(params.companyId)} month ${m}`,
    });

    return { id: lock.id };
  });
}

export async function isMonthLocked(
  db: Kysely<Database>,
  companyId: number,
  month: string,
): Promise<boolean> {
  const m = monthStart(month);
  const row = await db
    .selectFrom('att.month_locks')
    .select('id')
    .where('company_id', '=', companyId)
    .where('month', '=', sql<Date>`${m}::date`)
    .executeTakeFirst();
  return Boolean(row);
}

export { monthStart, nextMonthStart };
