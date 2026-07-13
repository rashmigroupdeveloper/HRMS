/**
 * Leave core — the LEDGER discipline (LV-02/04/05, docs/04 §2):
 * a balance is ALWAYS `SUM(lv.ledger.delta)`; the table is append-only at the
 * DB layer. This file owns every credit-side movement: monthly accrual,
 * comp-off earn from converted OT, comp-off expiry, year-end carry-forward,
 * and the audited manual adjustment.
 */
import { sql, type Kysely, type Selectable, type Transaction } from 'kysely';
import type { Database, LvLeaveTypesTable } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { addDaysIso, istDateString } from '../../core/dates.js';
import { getTypedSetting } from '../settings/index.js';
import { enqueueEvent } from '../notifications/index.js';

type Db = Kysely<Database> | Transaction<Database>;
export type LeaveTypeRow = Selectable<LvLeaveTypesTable>;

export async function getLeaveType(db: Db, code: string): Promise<LeaveTypeRow> {
  const type = await db.selectFrom('lv.leave_types').selectAll().where('code', '=', code).where('is_active', '=', true).executeTakeFirst();
  if (!type) throw new Error(`Unknown or inactive leave type: ${code}`);
  return type;
}

/** Balance = SUM(delta). Available subtracts everything already RESERVED —
 *  pending applications AND in-flight encashment requests — so two competing
 *  requests can never both pass the balance check (LV-03/06). */
export async function getBalance(db: Db, employeeId: number, leaveTypeId: number): Promise<{ balance: number; pending: number; available: number }> {
  const ledger = await db
    .selectFrom('lv.ledger')
    .select(({ fn }) => fn.coalesce(fn.sum('delta'), sql<string>`0`).as('total'))
    .where('employee_id', '=', employeeId)
    .where('leave_type_id', '=', leaveTypeId)
    .executeTakeFirstOrThrow();
  const pendingApps = await db
    .selectFrom('lv.applications')
    .select(({ fn }) => fn.coalesce(fn.sum('days'), sql<string>`0`).as('total'))
    .where('employee_id', '=', employeeId)
    .where('leave_type_id', '=', leaveTypeId)
    .where('status', '=', 'pending')
    .executeTakeFirstOrThrow();
  // Encashment requests carry their days in the workflow payload (no lv.applications
  // row), so reserve them here or an encashment + a leave could double-spend.
  const pendingEncash = await db
    .selectFrom('wf.requests')
    .select(sql<string>`coalesce(sum((payload->>'days')::numeric), 0)`.as('total'))
    .where('definition_code', '=', 'leave_encashment')
    .where('subject_employee_id', '=', employeeId)
    .where('status', 'in', ['pending', 'sent_back'])
    .where(sql<boolean>`(payload->>'leaveTypeId')::bigint = ${leaveTypeId}`)
    .executeTakeFirstOrThrow();
  const balance = Number(ledger.total);
  const pending = Number(pendingApps.total) + Number(pendingEncash.total);
  return { balance, pending, available: balance - pending };
}

/** Every active type with the employee's balance/pending/available (ESS tiles). */
export async function getBalances(db: Db, employeeId: number) {
  const types = await db.selectFrom('lv.leave_types').selectAll().where('is_active', '=', true).orderBy('code').execute();
  const out = [];
  for (const t of types) {
    out.push({ type: t, ...(await getBalance(db, employeeId, t.id)) });
  }
  return out;
}

/**
 * LV-02 — the monthly credit, idempotent BY THE DATABASE (one accrual per
 * employee × type × month, partial unique index). Runs for every active
 * employee: accrual is NEVER blocked by unapproved attendance (the greytHR
 * failure) — instead employees with unapproved prior-month days are flagged
 * to HR via the `leave.accrual_exceptions` event subscription.
 */
export async function runMonthlyAccrual(db: Kysely<Database>, monthStartIso?: string): Promise<{ credited: number; flagged: number }> {
  const monthStart = monthStartIso ?? `${istDateString().slice(0, 7)}-01`;

  const inserted = await sql<{ id: number }>`
    INSERT INTO lv.ledger (employee_id, leave_type_id, txn_type, delta, effective_date, note)
    SELECT e.id, t.id, 'accrual', t.accrual_per_month, ${monthStart}::date, 'monthly accrual'
    FROM core.employees e
    CROSS JOIN lv.leave_types t
    WHERE e.status IN ('active','on_notice')
      AND t.is_active AND t.accrual_per_month > 0
      AND (
        t.accrual_requires_service_months = 0
        OR (e.doj IS NOT NULL
            AND e.doj + make_interval(months => t.accrual_requires_service_months) <= ${monthStart}::date)
      )
      AND (t.applicable_gender IS NULL OR e.gender = t.applicable_gender)
      AND (t.applicable_categories IS NULL OR e.category = ANY (t.applicable_categories))
    ON CONFLICT (employee_id, leave_type_id, effective_date) WHERE txn_type = 'accrual' DO NOTHING
    RETURNING id
  `.execute(db);

  // PP-1 flag: prior-month unapproved absences (still 'A'/'UAB') → HR tile/event.
  const prevMonthStart = `${addDaysIso(monthStart, -1).slice(0, 7)}-01`;
  const flagged = await sql<{ employee_id: number }>`
    SELECT DISTINCT employee_id FROM att.day_records
    WHERE work_date >= ${prevMonthStart}::date AND work_date < ${monthStart}::date
      AND status IN ('A','UAB')
  `.execute(db);
  if (flagged.rows.length > 0) {
    await enqueueEvent(db, 'leave.accrual_exceptions', 'accrual_exceptions', {
      month: monthStart.slice(0, 7),
      count: flagged.rows.length,
      employeeIds: flagged.rows.slice(0, 100).map((r) => r.employee_id),
    });
  }

  return { credited: inserted.rows.length, flagged: flagged.rows.length };
}

/** Fraction policy (settings): ≥ full-day minutes → 1.0, ≥ half-day → 0.5, else 0. */
export async function compOffDaysForMinutes(db: Db, minutes: number): Promise<number> {
  const halfDayMinutes = await getTypedSetting(db, 'lv.comp_off_half_day_minutes', 'number', 240);
  const fullDayMinutes = await getTypedSetting(db, 'lv.comp_off_full_day_minutes', 'number', 480);
  return minutes >= fullDayMinutes ? 1 : minutes >= halfDayMinutes ? 0.5 : 0;
}

/**
 * LV-04 (+ the Stage-1.4 deferred hookup): a converted OT entry becomes a
 * comp-off CREDIT with an expiry window. Fraction policy and validity are
 * settings, not code.
 */
export async function creditCompOffForOvertime(
  db: Db,
  params: { otEntryId: number; employeeId: number; workDateIso: string; minutes: number; actorUserId: number },
): Promise<number> {
  const validityDays = await getTypedSetting(db, 'lv.comp_off_validity_days', 'number', 90);

  const days = await compOffDaysForMinutes(db, params.minutes);
  if (days === 0) {
    const halfDayMinutes = await getTypedSetting(db, 'lv.comp_off_half_day_minutes', 'number', 240);
    throw new Error(`Comp-off needs at least ${halfDayMinutes} approved minutes (got ${params.minutes})`);
  }

  const co = await getLeaveType(db, 'CO');
  const credit = await db
    .insertInto('lv.ledger')
    .values({
      employee_id: params.employeeId,
      leave_type_id: co.id,
      txn_type: 'comp_off_earn',
      delta: String(days),
      effective_date: sql<Date>`${params.workDateIso}::date` as unknown as Date,
      expiry_date: sql<Date>`${addDaysIso(params.workDateIso, validityDays)}::date` as unknown as Date,
      reference_id: params.otEntryId,
      note: `OT ${params.minutes} min on ${params.workDateIso} → ${days} comp-off`,
      created_by: params.actorUserId,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  await db.updateTable('att.overtime_entries').set({ comp_off_credit_id: credit.id }).where('id', '=', params.otEntryId).execute();
  return credit.id;
}

/**
 * LV-04 expiry sweep (daily): unused comp-off past its window lapses.
 * Consumption is FIFO-generous (spends expired credits first), so
 * lapse = max(0, balance − still-live credits) — idempotent: a second run the
 * same day computes 0.
 */
export async function runCompOffExpiry(db: Kysely<Database>, asOfIso?: string): Promise<number> {
  const asOf = asOfIso ?? istDateString();
  const co = await getLeaveType(db, 'CO');

  const rows = await sql<{ employee_id: number; lapse: string }>`
    SELECT employee_id,
           GREATEST(0, SUM(delta) - SUM(delta) FILTER (
             WHERE delta > 0 AND (expiry_date IS NULL OR expiry_date >= ${asOf}::date)
           )) AS lapse
    FROM lv.ledger
    WHERE leave_type_id = ${co.id}
    GROUP BY employee_id
    HAVING GREATEST(0, SUM(delta) - SUM(delta) FILTER (
             WHERE delta > 0 AND (expiry_date IS NULL OR expiry_date >= ${asOf}::date)
           )) > 0
  `.execute(db);

  for (const row of rows.rows) {
    await db
      .insertInto('lv.ledger')
      .values({
        employee_id: row.employee_id,
        leave_type_id: co.id,
        txn_type: 'lapse',
        delta: String(-Number(row.lapse)),
        effective_date: sql<Date>`${asOf}::date` as unknown as Date,
        note: `comp-off expired as of ${asOf}`,
      })
      .execute();
  }
  return rows.rows.length;
}

/**
 * Year-end job (docs/04 §2): for capped types, balance above max_carry_forward
 * lapses into the new year. Boundary = calendar year (default pending P0-T06
 * sign-off). Idempotent for a given yearEnd: re-run lapses only NEW excess.
 */
export async function runYearEndCarryForward(db: Kysely<Database>, yearEndIso: string): Promise<number> {
  const types = await db
    .selectFrom('lv.leave_types')
    .selectAll()
    .where('is_active', '=', true)
    .where('max_carry_forward', 'is not', null)
    .execute();

  let lapsedEmployees = 0;
  for (const type of types) {
    const cap = Number(type.max_carry_forward);
    const rows = await sql<{ employee_id: number; excess: string }>`
      SELECT employee_id, SUM(delta) - ${cap} AS excess
      FROM lv.ledger
      WHERE leave_type_id = ${type.id} AND effective_date <= ${yearEndIso}::date
      GROUP BY employee_id
      HAVING SUM(delta) > ${cap}
    `.execute(db);

    for (const row of rows.rows) {
      await db
        .insertInto('lv.ledger')
        .values({
          employee_id: row.employee_id,
          leave_type_id: type.id,
          txn_type: 'lapse',
          delta: String(-Number(row.excess)),
          effective_date: sql<Date>`${yearEndIso}::date` as unknown as Date,
          note: `year-end carry-forward cap ${cap} (${type.code})`,
        })
        .execute();
      lapsedEmployees += 1;
    }
  }
  return lapsedEmployees;
}

/** leave.admin manual correction — note is mandatory (DB CHECK) and audited. */
export async function adjustBalance(
  db: Kysely<Database>,
  params: { employeeId: number; leaveTypeCode: string; delta: number; note: string; actorUserId: number },
): Promise<number> {
  if (params.delta === 0) throw new Error('Adjustment delta cannot be zero');
  const type = await getLeaveType(db, params.leaveTypeCode);
  const row = await db
    .insertInto('lv.ledger')
    .values({
      employee_id: params.employeeId,
      leave_type_id: type.id,
      txn_type: 'adjustment',
      delta: String(params.delta),
      effective_date: sql<Date>`${istDateString()}::date` as unknown as Date,
      note: params.note,
      created_by: params.actorUserId,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await writeAudit(db, {
    actorUserId: params.actorUserId,
    action: 'create',
    entity: 'lv.ledger',
    entityId: row.id,
    field: `adjustment:${params.leaveTypeCode}:${params.employeeId}`,
    newValue: `${params.delta} — ${params.note}`,
  });
  return row.id;
}
