/**
 * Leave applications (LV-03/06/08/09, docs/04 §2): apply → 'leave'/'comp_off'
 * chain → approval inserts the ledger DEBIT and writes the day records, all in
 * the approving transaction. Cancellation is a RE-APPROVAL workflow that
 * reverses the debit (LV-08 — never a silent delete). Encashment and
 * Restricted Holidays ride their own seeded chains.
 */
import { sql, type Kysely, type Transaction } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { addDaysIso, formatDbDate, istDateString } from '../../core/dates.js';
import { getTypedSetting } from '../settings/index.js';
import { createRequest, type RequestRow, type WorkflowFinalStatus } from '../workflows/index.js';
import { getBalance, getLeaveType, type LeaveTypeRow } from './leave-core.service.js';

type Db = Kysely<Database> | Transaction<Database>;

interface SpanDay {
  iso: string;
  /** counts toward the requested days (sandwich rule applied) */
  counted: boolean;
  /** 0.5 for the half-day edges, else 1 */
  weight: number;
  /** gets a leave day-record on approval (full, non-holiday/WO days only) */
  writesRecord: boolean;
}

/** Sandwich rule (LV-03): 'exclude' skips holidays/week-offs inside the span;
 *  'include' counts them but never overwrites their H/WO day record. */
export async function computeLeaveSpan(
  db: Db,
  employee: { id: number; location_id: number | null },
  type: Pick<LeaveTypeRow, 'sandwich_rule'>,
  fromDate: string,
  toDate: string,
  fromHalf: boolean,
  toHalf: boolean,
): Promise<{ days: number; span: SpanDay[] }> {
  const span: SpanDay[] = [];
  for (let iso = fromDate; iso <= toDate; iso = addDaysIso(iso, 1)) {
    const holiday = await db
      .selectFrom('att.holidays')
      .select('id')
      .where('holiday_date', '=', sql<Date>`${iso}::date`)
      .where((eb) =>
        employee.location_id === null
          ? eb('location_id', 'is', null)
          : eb.or([eb('location_id', 'is', null), eb('location_id', '=', employee.location_id)]),
      )
      .executeTakeFirst();
    let offDay = holiday !== undefined;
    if (!offDay) {
      const roster = await db
        .selectFrom('att.rosters')
        .select('is_week_off')
        .where('employee_id', '=', employee.id)
        .where('work_date', '=', sql<Date>`${iso}::date`)
        .executeTakeFirst();
      offDay = roster ? roster.is_week_off : new Date(`${iso}T00:00:00Z`).getUTCDay() === 0;
    }

    const counted = type.sandwich_rule === 'include' || !offDay;
    const isHalf = (iso === fromDate && fromHalf) || (iso === toDate && toHalf);
    span.push({
      iso,
      counted,
      weight: isHalf ? 0.5 : 1,
      writesRecord: counted && !offDay && !isHalf,
    });
  }
  const days = span.filter((d) => d.counted).reduce((acc, d) => acc + d.weight, 0);
  return { days, span };
}

export interface ApplyLeaveParams {
  employeeId: number;
  requestedByUserId: number;
  leaveTypeCode: string;
  fromDate: string;
  toDate: string;
  fromHalf?: boolean | undefined;
  toHalf?: boolean | undefined;
  reason?: string | undefined;
}

export async function applyForLeave(
  db: Kysely<Database>,
  params: ApplyLeaveParams,
): Promise<{ id: number; workflowRequestId: number; days: number }> {
  if (params.fromDate > params.toDate) throw new Error('fromDate must be on or before toDate');
  const type = await getLeaveType(db, params.leaveTypeCode);
  const fromHalf = params.fromHalf ?? false;
  const toHalf = params.toHalf ?? false;
  if ((fromHalf || toHalf) && !type.allow_half_day) throw new Error(`${type.code} does not allow half days`);
  if (fromHalf && toHalf && params.fromDate === params.toDate) throw new Error('A single day cannot be two halves');

  const employee = await db
    .selectFrom('core.employees')
    .select(['id', 'location_id', 'gender', 'category'])
    .where('id', '=', params.employeeId)
    .executeTakeFirstOrThrow();
  if (type.applicable_gender !== null && employee.gender !== type.applicable_gender) {
    throw new Error(`${type.name} is not applicable for this employee`);
  }
  if (type.applicable_categories !== null && (employee.category === null || !type.applicable_categories.includes(employee.category))) {
    throw new Error(`${type.name} is not applicable for this employee category`);
  }

  const locked = await db
    .selectFrom('att.day_records')
    .select('id')
    .where('employee_id', '=', params.employeeId)
    .where('work_date', '>=', sql<Date>`${params.fromDate}::date`)
    .where('work_date', '<=', sql<Date>`${params.toDate}::date`)
    .where('is_locked', '=', true)
    .executeTakeFirst();
  if (locked) throw new Error('The period is locked for payroll — contact HR');

  const overlap = await db
    .selectFrom('lv.applications')
    .select('id')
    .where('employee_id', '=', params.employeeId)
    .where('status', 'in', ['pending', 'approved'])
    .where('from_date', '<=', sql<Date>`${params.toDate}::date`)
    .where('to_date', '>=', sql<Date>`${params.fromDate}::date`)
    .executeTakeFirst();
  if (overlap) throw new Error('An open or approved leave already covers these dates');

  const { days } = await computeLeaveSpan(db, employee, type, params.fromDate, params.toDate, fromHalf, toHalf);
  if (days <= 0) throw new Error('The requested span contains no countable leave days');
  if (type.max_per_request !== null && days > Number(type.max_per_request)) {
    throw new Error(`${type.code} allows at most ${Number(type.max_per_request)} days per request`);
  }
  if (type.is_paid) {
    const { available } = await getBalance(db, params.employeeId, type.id);
    if (available < days) throw new Error(`Insufficient ${type.code} balance: ${available} available, ${days} requested`);
  }

  let applicationId = 0;
  const workflowRequestId = await createRequest(
    db,
    {
      definitionCode: type.code === 'CO' ? 'comp_off' : 'leave',
      subjectEmployeeId: params.employeeId,
      requestedByUserId: params.requestedByUserId,
      payload: { leaveType: type.code, fromDate: params.fromDate, toDate: params.toDate, days, reason: params.reason ?? null },
    },
    async (trx, requestId) => {
      const inserted = await trx
        .insertInto('lv.applications')
        .values({
          employee_id: params.employeeId,
          leave_type_id: type.id,
          from_date: sql<Date>`${params.fromDate}::date` as unknown as Date,
          to_date: sql<Date>`${params.toDate}::date` as unknown as Date,
          from_half: fromHalf,
          to_half: toHalf,
          days: String(days),
          reason: params.reason ?? null,
          workflow_request_id: requestId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      applicationId = inserted.id;
    },
  );
  return { id: applicationId, workflowRequestId, days };
}

/** Completion hook ('leave' + 'comp_off'): approval = ledger debit + leave day
 *  records, atomic with the decision. LWP (is_paid=false) writes days but no
 *  ledger row — LOP flows to payroll from the day records. */
export async function applyLeaveOnFinal(db: Db, request: RequestRow, status: WorkflowFinalStatus): Promise<void> {
  const app = await db
    .selectFrom('lv.applications')
    .selectAll()
    .where('workflow_request_id', '=', request.id)
    .where('status', '=', 'pending')
    .executeTakeFirst();
  if (!app) return;

  if (status !== 'approved') {
    await db.updateTable('lv.applications').set({ status: 'rejected' }).where('id', '=', app.id).execute();
    return;
  }

  const type = await db.selectFrom('lv.leave_types').selectAll().where('id', '=', app.leave_type_id).executeTakeFirstOrThrow();
  let ledgerTxnId: number | null = null;
  if (type.is_paid) {
    const debit = await db
      .insertInto('lv.ledger')
      .values({
        employee_id: app.employee_id,
        leave_type_id: app.leave_type_id,
        txn_type: 'application',
        delta: String(-Number(app.days)),
        effective_date: app.from_date,
        reference_id: app.id,
        note: `leave ${formatDbDate(app.from_date)}..${formatDbDate(app.to_date)}`,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    ledgerTxnId = debit.id;
  }
  await db.updateTable('lv.applications').set({ status: 'approved', ledger_txn_id: ledgerTxnId }).where('id', '=', app.id).execute();

  const employee = await db.selectFrom('core.employees').select(['id', 'location_id']).where('id', '=', app.employee_id).executeTakeFirstOrThrow();
  const { span } = await computeLeaveSpan(db, employee, type, formatDbDate(app.from_date), formatDbDate(app.to_date), app.from_half, app.to_half);
  const row = {
    status: type.code === 'CO' ? ('CO' as const) : ('L' as const),
    leave_type_id: app.leave_type_id,
    source: 'regularized' as const,
    computed_at: new Date(),
  };
  for (const day of span.filter((d) => d.writesRecord)) {
    await db
      .insertInto('att.day_records')
      .values({ employee_id: app.employee_id, work_date: sql<Date>`${day.iso}::date` as unknown as Date, ...row })
      .onConflict((oc) =>
        oc
          .columns(['employee_id', 'work_date'])
          .doUpdateSet(row)
          .where('att.day_records.source', '<>', 'manual')
          .where('att.day_records.is_locked', '=', false),
      )
      .execute();
  }
}

/** LV-08: cancelling an APPROVED leave is a re-approval. */
export async function requestCancellation(
  db: Kysely<Database>,
  params: { applicationId: number; employeeId: number; requestedByUserId: number },
): Promise<number> {
  const app = await db.selectFrom('lv.applications').selectAll().where('id', '=', params.applicationId).executeTakeFirstOrThrow();
  if (app.employee_id !== params.employeeId) throw new Error('Not your application');
  if (app.status !== 'approved') throw new Error(`Only approved leave can be cancelled (this one is ${app.status})`);
  if (app.cancel_workflow_request_id !== null) {
    const open = await db
      .selectFrom('wf.requests')
      .select('status')
      .where('id', '=', app.cancel_workflow_request_id)
      .executeTakeFirst();
    if (open?.status === 'pending' || open?.status === 'sent_back') throw new Error('A cancellation request is already open');
  }

  return createRequest(
    db,
    {
      definitionCode: 'leave_cancel',
      subjectEmployeeId: app.employee_id,
      requestedByUserId: params.requestedByUserId,
      payload: { applicationId: app.id, days: Number(app.days), fromDate: formatDbDate(app.from_date), toDate: formatDbDate(app.to_date) },
    },
    async (trx, requestId) => {
      await trx.updateTable('lv.applications').set({ cancel_workflow_request_id: requestId }).where('id', '=', app.id).execute();
    },
  );
}

/** Completion hook ('leave_cancel'): reversal credit + days handed back to the
 *  recompute pipeline (source flips to 'auto' and the day re-derives from swipes). */
export async function applyCancelOnFinal(db: Db, request: RequestRow, status: WorkflowFinalStatus): Promise<void> {
  if (status !== 'approved') return;
  const app = await db
    .selectFrom('lv.applications')
    .selectAll()
    .where('cancel_workflow_request_id', '=', request.id)
    .where('status', '=', 'approved')
    .executeTakeFirst();
  if (!app) return;

  const type = await db.selectFrom('lv.leave_types').selectAll().where('id', '=', app.leave_type_id).executeTakeFirstOrThrow();
  if (type.is_paid) {
    await db
      .insertInto('lv.ledger')
      .values({
        employee_id: app.employee_id,
        leave_type_id: app.leave_type_id,
        txn_type: 'cancel',
        delta: app.days, // exact reversal of the application debit
        effective_date: app.from_date,
        reference_id: app.id,
        note: `cancelled leave ${formatDbDate(app.from_date)}..${formatDbDate(app.to_date)}`,
      })
      .execute();
  }
  await db.updateTable('lv.applications').set({ status: 'cancelled' }).where('id', '=', app.id).execute();

  for (let iso = formatDbDate(app.from_date); iso <= formatDbDate(app.to_date); iso = addDaysIso(iso, 1)) {
    await db
      .updateTable('att.day_records')
      .set({ source: 'auto', leave_type_id: null })
      .where('employee_id', '=', app.employee_id)
      .where('work_date', '=', sql<Date>`${iso}::date`)
      .where('source', '=', 'regularized')
      .where('leave_type_id', '=', app.leave_type_id)
      .where('is_locked', '=', false)
      .execute();
    await db
      .insertInto('att.recompute_queue')
      .values({ employee_id: app.employee_id, work_date: sql<Date>`${iso}::date` as unknown as Date })
      .onConflict((oc) => oc.doNothing())
      .execute();
  }
}

/** LV-06: employee-initiated encashment — its own 3-step chain; the debit lands
 *  on final approval (payout is a Phase-2 payroll input reading 'encash' rows). */
export async function requestEncashment(
  db: Kysely<Database>,
  params: { employeeId: number; requestedByUserId: number; leaveTypeCode: string; days: number },
): Promise<number> {
  if (params.days <= 0) throw new Error('days must be positive');
  const type = await getLeaveType(db, params.leaveTypeCode);
  if (!type.encashable) throw new Error(`${type.code} is not encashable`);
  const { available } = await getBalance(db, params.employeeId, type.id);
  if (available < params.days) throw new Error(`Insufficient ${type.code} balance: ${available} available`);

  const openEncash = await db
    .selectFrom('wf.requests')
    .select('id')
    .where('definition_code', '=', 'leave_encashment')
    .where('subject_employee_id', '=', params.employeeId)
    .where('status', 'in', ['pending', 'sent_back'])
    .executeTakeFirst();
  if (openEncash) throw new Error('An encashment request is already open');

  return createRequest(db, {
    definitionCode: 'leave_encashment',
    subjectEmployeeId: params.employeeId,
    requestedByUserId: params.requestedByUserId,
    payload: { leaveTypeId: type.id, leaveType: type.code, days: params.days },
  });
}

/** Completion hook ('leave_encashment'): debit, clamped to the live balance if
 *  it shrank while the request was in flight (clamp is audited). */
export async function applyEncashmentOnFinal(db: Db, request: RequestRow, status: WorkflowFinalStatus): Promise<void> {
  if (status !== 'approved') return;
  const payload = request.payload as { leaveTypeId?: number; days?: number };
  if (typeof payload.leaveTypeId !== 'number' || typeof payload.days !== 'number') return;

  const { balance } = await getBalance(db, request.subject_employee_id, payload.leaveTypeId);
  const days = Math.min(payload.days, balance);
  if (days <= 0) return;
  await db
    .insertInto('lv.ledger')
    .values({
      employee_id: request.subject_employee_id,
      leave_type_id: payload.leaveTypeId,
      txn_type: 'encash',
      delta: String(-days),
      effective_date: sql<Date>`${istDateString()}::date` as unknown as Date,
      reference_id: request.id,
      note: days < payload.days ? `encashment clamped ${payload.days} → ${days} (balance moved)` : 'encashment',
    })
    .execute();
  if (days < payload.days) {
    await writeAudit(db, {
      action: 'update',
      entity: 'lv.ledger',
      entityId: request.id,
      field: 'encash_clamped',
      oldValue: String(payload.days),
      newValue: String(days),
    });
  }
}

/** LV-09: pick a Restricted Holiday (cap per year is a setting). */
export async function selectRestrictedHoliday(
  db: Kysely<Database>,
  params: { employeeId: number; requestedByUserId: number; restrictedHolidayId: number },
): Promise<number> {
  const rh = await db.selectFrom('lv.restricted_holidays').selectAll().where('id', '=', params.restrictedHolidayId).executeTakeFirstOrThrow();
  const rhIso = formatDbDate(rh.holiday_date);
  if (rhIso < istDateString()) throw new Error('This restricted holiday is in the past');

  const employee = await db.selectFrom('core.employees').select('location_id').where('id', '=', params.employeeId).executeTakeFirstOrThrow();
  if (rh.location_id !== null && rh.location_id !== employee.location_id) {
    throw new Error('This restricted holiday is not published for your location');
  }

  const maxPerYear = await getTypedSetting(db, 'lv.rh_max_per_year', 'number', 2);
  const year = rhIso.slice(0, 4);
  const used = await db
    .selectFrom('lv.rh_selections as s')
    .innerJoin('lv.restricted_holidays as h', 'h.id', 's.restricted_holiday_id')
    .innerJoin('wf.requests as r', 'r.id', 's.workflow_request_id')
    .where('s.employee_id', '=', params.employeeId)
    .where('r.status', 'in', ['pending', 'sent_back', 'approved'])
    .where(sql<boolean>`to_char(h.holiday_date, 'YYYY') = ${year}`)
    .select(({ fn }) => fn.countAll<string>().as('n')) // pg COUNT arrives as a string
    .executeTakeFirstOrThrow();
  if (Number(used.n) >= maxPerYear) throw new Error(`Restricted-holiday limit reached (${maxPerYear}/year)`);

  return createRequest(
    db,
    {
      definitionCode: 'restricted_holiday',
      subjectEmployeeId: params.employeeId,
      requestedByUserId: params.requestedByUserId,
      payload: { restrictedHolidayId: rh.id, date: rhIso, name: rh.name },
    },
    async (trx, requestId) => {
      await trx
        .insertInto('lv.rh_selections')
        .values({ employee_id: params.employeeId, restricted_holiday_id: rh.id, workflow_request_id: requestId })
        .executeTakeFirstOrThrow();
    },
  );
}

/** Completion hook ('restricted_holiday'): the picked day becomes a personal
 *  holiday day-record (auto-approves at cutoff per the seeded chain). */
export async function applyRhOnFinal(db: Db, request: RequestRow, status: WorkflowFinalStatus): Promise<void> {
  const selection = await db
    .selectFrom('lv.rh_selections')
    .selectAll()
    .where('workflow_request_id', '=', request.id)
    .where('applied', '=', false)
    .executeTakeFirst();
  if (!selection || status !== 'approved') return;

  const rh = await db.selectFrom('lv.restricted_holidays').selectAll().where('id', '=', selection.restricted_holiday_id).executeTakeFirstOrThrow();
  const row = { status: 'H' as const, source: 'regularized' as const, computed_at: new Date() };
  await db
    .insertInto('att.day_records')
    .values({ employee_id: selection.employee_id, work_date: rh.holiday_date, ...row })
    .onConflict((oc) =>
      oc
        .columns(['employee_id', 'work_date'])
        .doUpdateSet(row)
        .where('att.day_records.source', '<>', 'manual')
        .where('att.day_records.is_locked', '=', false),
    )
    .execute();
  await db.updateTable('lv.rh_selections').set({ applied: true }).where('id', '=', selection.id).execute();
}
