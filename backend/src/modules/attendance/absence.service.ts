/**
 * Absenteeism engine (ATT-10/11, docs/04 §1.5, PP-7) — the automated vigilance
 * HR asked Protiviti for 26 times. Daily 06:00 IST scan of yesterday's records:
 *
 *   UAB day            → alert employee + RM + the configured audience
 *   run ≥ watch_days   → open att.absence_cases (stage 'watch')
 *   run ≥ show_cause_days → stage 'show_cause' + HR queue event; HR issues the
 *                           show-cause letter THROUGH the system (CORE-09)
 *   return/regularized/exit → case closes with its resolution
 *
 * Escalation to 'warning'/'termination_review' is a deliberate HR ACTION
 * (audited endpoint), never automatic — PP-7 is a strict human process.
 * Thresholds are settings; week-offs/holidays are neutral (they neither break
 * nor extend a run of absence).
 */
import { sql, type Kysely, type Selectable, type Transaction } from 'kysely';
import type { AttAbsenceCasesTable, Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { addDaysIso, formatDbDate, istDateString } from '../../core/dates.js';
import { assertEmployeesInScope, employeeScopeSql, type EmployeeScope } from '../../core/rbac/employee-scope.js';
import { getTypedSetting } from '../settings/index.js';
import { enqueue, enqueueEvent } from '../notifications/index.js';
import { issueLetter } from '../letters/index.js';

type Db = Kysely<Database> | Transaction<Database>;
export type AbsenceCaseRow = Selectable<AttAbsenceCasesTable>;

const ABSENT: readonly string[] = ['A', 'UAB'];
const NEUTRAL: readonly string[] = ['WO', 'H'];

function computeRunLength(
  records: { work_date: Date; status: string }[],
  endIso: string,
): { length: number; startIso: string } {
  let length = 0;
  let startIso = endIso;
  let expected = endIso;
  for (const row of records) {
    const iso = formatDbDate(row.work_date);
    if (iso !== expected) break; // a gap (no record) ends the run
    if (ABSENT.includes(row.status)) {
      length += 1;
      startIso = iso;
    } else if (!NEUTRAL.includes(row.status)) {
      break; // any present-ish day ends the run
    }
    expected = addDaysIso(iso, -1);
  }
  return { length, startIso };
}

/** Walk back from `endIso`: consecutive absent days (WO/H neutral). Returns the
 *  run length and its first absent day. */
export async function absenceRun(db: Db, employeeId: number, endIso: string): Promise<{ length: number; startIso: string }> {
  const rows = await db
    .selectFrom('att.day_records')
    .select(['work_date', 'status'])
    .where('employee_id', '=', employeeId)
    .where('work_date', '<=', sql<Date>`${endIso}::date`)
    .orderBy('work_date', 'desc')
    .limit(90)
    .execute();

  return computeRunLength(rows, endIso);
}

export interface AbsenceScanResult {
  absentees: number;
  casesOpened: number;
  casesEscalated: number;
  casesClosed: number;
}

/** The daily job body. `scanDateIso` defaults to yesterday (IST). Idempotent —
 *  re-running a day updates the same cases to the same state. */
export async function runAbsenceScan(db: Kysely<Database>, scanDateIso?: string): Promise<AbsenceScanResult> {
  const scanDate = scanDateIso ?? addDaysIso(istDateString(), -1);
  const watchDays = await getTypedSetting(db, 'att.absence_watch_days', 'number', 4);
  const showCauseDays = await getTypedSetting(db, 'att.absence_show_cause_days', 'number', 7);

  const absentRows = await db
    .selectFrom('att.day_records as d')
    .innerJoin('core.employees as e', 'e.id', 'd.employee_id')
    .where('d.work_date', '=', sql<Date>`${scanDate}::date`)
    .where('d.status', 'in', [...ABSENT] as ('A' | 'UAB')[])
    .where('e.status', 'in', ['active', 'on_notice'])
    .select(['d.employee_id', 'e.ecode', 'e.first_name', 'e.reporting_manager_id'])
    .execute();

  const result: AbsenceScanResult = { absentees: absentRows.length, casesOpened: 0, casesEscalated: 0, casesClosed: 0 };
  if (absentRows.length === 0) return result;

  const employeeIds = absentRows.map((r) => r.employee_id);

  // 1. Batch-fetch active user accounts for employees and their managers
  const userRefs = new Set<number>();
  for (const r of absentRows) {
    userRefs.add(r.employee_id);
    if (r.reporting_manager_id) userRefs.add(r.reporting_manager_id);
  }
  const userRows = await db
    .selectFrom('core.users')
    .select(['id', 'employee_id'])
    .where('employee_id', 'in', [...userRefs])
    .where('is_active', '=', true)
    .execute();
  const userIdByEmp = new Map<number, number>();
  for (const u of userRows) {
    if (u.employee_id !== null) userIdByEmp.set(u.employee_id, u.id);
  }

  // 2. Batch-fetch open absence cases
  const existingOpenCases = await db
    .selectFrom('att.absence_cases')
    .selectAll()
    .where('employee_id', 'in', employeeIds)
    .where('closed_at', 'is', null)
    .execute();
  const openCaseByEmp = new Map<number, Selectable<AttAbsenceCasesTable>>();
  for (const c of existingOpenCases) {
    openCaseByEmp.set(c.employee_id, c);
  }

  // 3. Batch-fetch recent day records for all absent employees (up to 90 days back)
  const minLookbackIso = addDaysIso(scanDate, -90);
  const recentRecords = await db
    .selectFrom('att.day_records')
    .select(['employee_id', 'work_date', 'status'])
    .where('employee_id', 'in', employeeIds)
    .where('work_date', '<=', sql<Date>`${scanDate}::date`)
    .where('work_date', '>=', sql<Date>`${minLookbackIso}::date`)
    .orderBy('work_date', 'desc')
    .execute();

  const recordsByEmp = new Map<number, { work_date: Date; status: string }[]>();
  for (const r of recentRecords) {
    let list = recordsByEmp.get(r.employee_id);
    if (!list) {
      list = [];
      recordsByEmp.set(r.employee_id, list);
    }
    list.push({ work_date: r.work_date, status: r.status });
  }

  for (const row of absentRows) {
    // ATT-11: alert the employee and the RM (their user accounts, if any).
    for (const employeeRef of [row.employee_id, row.reporting_manager_id]) {
      if (employeeRef === null) continue;
      const recipientUserId = userIdByEmp.get(employeeRef);
      if (recipientUserId) {
        await enqueue(db, {
          recipientUserId,
          channel: 'in_app',
          templateCode: 'uab_alert',
          payload: { employeeId: row.employee_id, ecode: row.ecode, date: scanDate },
        });
      }
    }

    const empRecords = recordsByEmp.get(row.employee_id) ?? [];
    const run = computeRunLength(empRecords, scanDate);
    const open = openCaseByEmp.get(row.employee_id);

    if (open) {
      const escalate = open.stage === 'watch' && run.length >= showCauseDays;
      await db
        .updateTable('att.absence_cases')
        .set(escalate ? { days_absent: run.length, stage: 'show_cause' } : { days_absent: run.length })
        .where('id', '=', open.id)
        .execute();
      if (escalate) {
        result.casesEscalated += 1;
        await enqueueEvent(db, 'attendance.absence_show_cause', 'absence_show_cause', {
          caseId: open.id,
          employeeId: row.employee_id,
          ecode: row.ecode,
          daysAbsent: run.length,
          startDate: formatDbDate(open.start_date),
        });
      }
    } else if (run.length >= watchDays) {
      const stage = run.length >= showCauseDays ? 'show_cause' : 'watch';
      const opened = await db
        .insertInto('att.absence_cases')
        .values({
          employee_id: row.employee_id,
          start_date: sql<Date>`${run.startIso}::date` as unknown as Date,
          days_absent: run.length,
          stage,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      result.casesOpened += 1;
      if (stage === 'show_cause') {
        result.casesEscalated += 1;
        await enqueueEvent(db, 'attendance.absence_show_cause', 'absence_show_cause', {
          caseId: opened.id,
          employeeId: row.employee_id,
          ecode: row.ecode,
          daysAbsent: run.length,
          startDate: run.startIso,
        });
      }
    }
  }

  // One aggregate event for the configured hierarchy/HR audience (ATT-11).
  if (absentRows.length > 0) {
    await enqueueEvent(db, 'attendance.uab_daily', 'uab_daily', {
      date: scanDate,
      count: absentRows.length,
      employees: absentRows.slice(0, 100).map((r) => ({ ecode: r.ecode, name: r.first_name })),
    });
  }

  // Close cases whose employee is back (present-ish day), regularized, or exited.
  const activeCases = await db
    .selectFrom('att.absence_cases as ac')
    .innerJoin('core.employees as e', 'e.id', 'ac.employee_id')
    .where('ac.closed_at', 'is', null)
    .select(['ac.id', 'ac.employee_id', 'e.status as employee_status'])
    .execute();

  const activeEmpIds = activeCases
    .filter((c) => c.employee_status !== 'exited')
    .map((c) => c.employee_id);

  const scanDayRecords = activeEmpIds.length > 0
    ? await db
        .selectFrom('att.day_records')
        .select(['employee_id', 'status', 'source'])
        .where('employee_id', 'in', activeEmpIds)
        .where('work_date', '=', sql<Date>`${scanDate}::date`)
        .execute()
    : [];
  const scanDayByEmp = new Map<number, { employee_id: number; status: string; source: string }>();
  for (const d of scanDayRecords) {
    scanDayByEmp.set(d.employee_id, d);
  }

  for (const c of activeCases) {
    let resolution: 'returned' | 'regularized' | 'exited' | null = null;
    if (c.employee_status === 'exited') {
      resolution = 'exited';
    } else {
      const day = scanDayByEmp.get(c.employee_id);
      if (day && !ABSENT.includes(day.status) && !NEUTRAL.includes(day.status)) {
        resolution = day.source === 'regularized' ? 'regularized' : 'returned';
      }
    }
    if (resolution) {
      await db.updateTable('att.absence_cases').set({ resolution, closed_at: new Date() }).where('id', '=', c.id).execute();
      result.casesClosed += 1;
    }
  }

  return result;
}

/** PP-7's human steps: HR escalates a case (forward-only), audited. */
export async function setAbsenceCaseStage(
  db: Kysely<Database>,
  params: { caseId: number; stage: 'warning' | 'termination_review'; actorUserId: number; scope?: EmployeeScope },
): Promise<void> {
  const order = ['watch', 'show_cause', 'warning', 'termination_review'];
  const current = await db.selectFrom('att.absence_cases').selectAll().where('id', '=', params.caseId).executeTakeFirstOrThrow();
  // CORE-10: the case subject must be inside the caller's permitted data scope.
  if (params.scope) await assertEmployeesInScope(db, params.scope, [current.employee_id]);
  if (current.closed_at !== null) throw new Error('Case is closed');
  if (order.indexOf(params.stage) <= order.indexOf(current.stage)) {
    throw new Error(`Stage can only move forward (currently ${current.stage})`);
  }
  await db
    .updateTable('att.absence_cases')
    .set({ stage: params.stage, hr_owner_id: params.actorUserId })
    .where('id', '=', params.caseId)
    .execute();
  await writeAudit(db, {
    actorUserId: params.actorUserId,
    action: 'update',
    entity: 'att.absence_cases',
    entityId: params.caseId,
    field: 'stage',
    oldValue: current.stage,
    newValue: params.stage,
  });
}

/** HR issues the show-cause/warning letter FROM the case — rendered, archived,
 *  routed through the signature chain, and linked back (docs/04 §1.5). */
export async function issueAbsenceCaseLetter(
  db: Kysely<Database>,
  params: { caseId: number; templateCode: 'show_cause' | 'warning'; actorUserId: number; responseDays?: number | undefined; scope?: EmployeeScope },
): Promise<{ letterId: number; workflowRequestId: number | null }> {
  const absenceCase = await db.selectFrom('att.absence_cases').selectAll().where('id', '=', params.caseId).executeTakeFirstOrThrow();
  // CORE-10: the case subject must be inside the caller's permitted data scope.
  if (params.scope) await assertEmployeesInScope(db, params.scope, [absenceCase.employee_id]);
  if (absenceCase.closed_at !== null) throw new Error('Case is closed');

  const extraFields: Record<string, string> =
    params.templateCode === 'show_cause'
      ? {
          absence_start_date: formatDbDate(absenceCase.start_date),
          days_absent: String(absenceCase.days_absent),
          response_days: String(params.responseDays ?? (await getTypedSetting(db, 'att.show_cause_response_days', 'number', 7))),
        }
      : { warning_reason: `Continuous unauthorised absence since ${formatDbDate(absenceCase.start_date)} (${absenceCase.days_absent} days)` };

  const issued = await issueLetter(db, {
    employeeId: absenceCase.employee_id,
    templateCode: params.templateCode,
    extraFields,
    requestedByUserId: params.actorUserId,
  });
  await db
    .updateTable('att.absence_cases')
    .set({ letter_id: issued.letterId, hr_owner_id: params.actorUserId })
    .where('id', '=', params.caseId)
    .execute();
  return { letterId: issued.letterId, workflowRequestId: issued.workflowRequestId };
}

/** The HR case queue (open first, most days-absent on top), narrowed to the
 *  caller's permitted data scope (CORE-10). */
export async function listAbsenceCases(db: Kysely<Database>, onlyOpen: boolean, scope?: EmployeeScope) {
  let q = db
    .selectFrom('att.absence_cases as ac')
    .innerJoin('core.employees as e', 'e.id', 'ac.employee_id')
    .where(employeeScopeSql(scope, 'e'))
    .select(['ac.id', 'ac.employee_id', 'e.ecode', 'e.first_name', 'e.last_name', 'ac.start_date', 'ac.days_absent', 'ac.stage', 'ac.letter_id', 'ac.resolution', 'ac.closed_at']);
  if (onlyOpen) q = q.where('ac.closed_at', 'is', null);
  return q.orderBy('ac.closed_at', 'asc').orderBy('ac.days_absent', 'desc').limit(500).execute();
}
