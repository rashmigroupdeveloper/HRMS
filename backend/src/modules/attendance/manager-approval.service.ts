/**
 * Manager attendance-approval ledger (ATT-12, Stage 1.7 P1-T07 / P1-T42).
 * Managers attest that their team's month attendance is ready for lock.
 * Month-lock checklist consumes this ledger when the policy setting is on.
 */
import { sql, type Kysely } from 'kysely';
import { resolveAttendanceWindow } from '../../core/db/attendance-cycle.js';
import type { Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import {
  attendanceTransaction,
  assertAttendanceMonthOpen,
  AttendanceMutationError,
} from './attendance-mutation.js';

/** Local helpers — avoid circular import with month-lock.service. */
function monthStart(month: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])(-01)?$/.test(month))
    throw new AttendanceMutationError('BAD_REQUEST', 'Month must be YYYY-MM or YYYY-MM-01');
  return month.length === 7 ? `${month}-01` : month;
}

export interface ManagerApprovalRow {
  managerEmployeeId: number;
  managerEcode: string;
  managerName: string;
  reportCount: number;
  approved: boolean;
  approvedAt: string | null;
  approvedByUserId: number | null;
  note: string | null;
}

function fullName(first: string, last: string | null): string {
  return last ? `${first} ${last}` : first;
}

/** Managers who have ≥1 in-scope report in the company×month window. */
export async function listManagersWithReports(
  db: Kysely<Database>,
  companyId: number,
  month: string,
): Promise<{ managerEmployeeId: number; reportCount: number }[]> {
  const { from: m, until: mEnd } = await resolveAttendanceWindow(db, companyId, monthStart(month));
  const rows = await db
    .selectFrom('core.employees as e')
    .select(['e.reporting_manager_id as manager_id'])
    .select((eb) => eb.fn.countAll<number>().as('n'))
    .where('e.company_id', '=', companyId)
    .where('e.reporting_manager_id', 'is not', null)
    .where('e.status', 'in', ['active', 'on_notice', 'exited'])
    .where((eb) => eb.or([eb('e.doj', 'is', null), eb('e.doj', '<', sql<Date>`${mEnd}::date`)]))
    .where((eb) => eb.or([eb('e.dol', 'is', null), eb('e.dol', '>=', sql<Date>`${m}::date`)]))
    .groupBy('e.reporting_manager_id')
    .execute();

  const out: { managerEmployeeId: number; reportCount: number }[] = [];
  for (const r of rows) {
    if (r.manager_id === null) continue;
    out.push({
      managerEmployeeId: r.manager_id,
      reportCount: typeof r.n === 'number' ? r.n : Number(r.n),
    });
  }
  return out;
}

export async function getManagerApprovalLedger(
  db: Kysely<Database>,
  companyId: number,
  month: string,
): Promise<ManagerApprovalRow[]> {
  const m = monthStart(month);
  const managers = await listManagersWithReports(db, companyId, month);
  if (managers.length === 0) return [];

  const managerIds = managers.map((row) => row.managerEmployeeId);
  const people = await db
    .selectFrom('core.employees')
    .select(['id', 'ecode', 'first_name', 'last_name'])
    .where('id', 'in', managerIds)
    .execute();
  const personById = new Map(people.map((p) => [p.id, p]));

  const approvals = await db
    .selectFrom('att.manager_month_approvals')
    .selectAll()
    .where('company_id', '=', companyId)
    .where('month', '=', sql<Date>`${m}::date`)
    .where('manager_employee_id', 'in', managerIds)
    .orderBy('id', 'desc')
    .execute();
  const approvalByManager = new Map<number, (typeof approvals)[number]>();
  for (const approval of approvals) {
    if (!approvalByManager.has(approval.manager_employee_id)) {
      approvalByManager.set(approval.manager_employee_id, approval);
    }
  }

  return managers
    .map((mgr) => {
      const person = personById.get(mgr.managerEmployeeId);
      const approval = approvalByManager.get(mgr.managerEmployeeId);
      return {
        managerEmployeeId: mgr.managerEmployeeId,
        managerEcode: person?.ecode ?? `id:${String(mgr.managerEmployeeId)}`,
        managerName: person ? fullName(person.first_name, person.last_name) : 'Unknown',
        reportCount: mgr.reportCount,
        approved: approval?.event_type === 'approve',
        approvedAt:
          approval?.event_type === 'approve' ? new Date(approval.approved_at).toISOString() : null,
        approvedByUserId:
          approval?.event_type === 'approve' ? (approval.approved_by_user_id ?? null) : null,
        note: approval?.note ?? null,
      };
    })
    .sort((a, b) => a.managerEcode.localeCompare(b.managerEcode));
}

export async function countPendingManagerApprovals(
  db: Kysely<Database>,
  companyId: number,
  month: string,
): Promise<{ total: number; pending: number }> {
  const ledger = await getManagerApprovalLedger(db, companyId, month);
  const pending = ledger.filter((row) => !row.approved).length;
  return { total: ledger.length, pending };
}

export async function approveManagerMonth(
  db: Kysely<Database>,
  params: {
    companyId: number;
    month: string;
    managerEmployeeId: number;
    actorUserId: number;
    note?: string | undefined;
  },
): Promise<{ ok: true }> {
  return attendanceTransaction(db, async (db) => {
    const m = monthStart(params.month);
    await db
      .selectFrom('core.employees')
      .select('id')
      .where('company_id', '=', params.companyId)
      .orderBy('id')
      .forUpdate()
      .execute();
    await assertAttendanceMonthOpen(db, params.companyId, m);
    const managers = await listManagersWithReports(db, params.companyId, m);
    if (!managers.some((manager) => manager.managerEmployeeId === params.managerEmployeeId)) {
      throw new Error('Manager has no in-scope reports for this company and month');
    }
    const locked = await db
      .selectFrom('att.month_locks')
      .select('id')
      .where('company_id', '=', params.companyId)
      .where('month', '=', sql<Date>`${m}::date`)
      .executeTakeFirst();
    if (locked) throw new Error('Attendance month is already locked');

    await db
      .insertInto('att.manager_month_approvals')
      .values({
        company_id: params.companyId,
        month: sql<Date>`${m}::date` as unknown as Date,
        manager_employee_id: params.managerEmployeeId,
        approved_by_user_id: params.actorUserId,
        event_type: 'approve',
        note: params.note ?? null,
      })
      .execute();

    await writeAudit(db, {
      actorUserId: params.actorUserId,
      action: 'approve',
      entity: 'att.manager_month_approvals',
      subjectEmployeeId: params.managerEmployeeId,
      field: `company ${String(params.companyId)} month ${m} manager ${String(params.managerEmployeeId)}`,
      newValue: params.note ?? 'approved',
    });

    return { ok: true as const };
  });
}
