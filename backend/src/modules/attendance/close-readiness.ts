/** ATT-12/15: bounded company/period completeness, never a guessed day count. */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
export async function readCloseReadiness(
  db: Kysely<Database>,
  companyId: number,
  from: string,
  until: string,
  otMinMinutes: number,
) {
  const rows = await sql<{
    employees: number;
    missing_doj: number;
    missing_biometric: number;
    missing_days: number;
    unresolved_days: number;
    undetected_ot: number;
  }>`
    WITH population AS (
      SELECT e.id, e.doj, e.dol, e.attendance_mode, e.biometric_registered,
        greatest(coalesce(e.doj, ${from}::date), ${from}::date) AS starts,
        least(coalesce(e.dol + 1, ${until}::date), ${until}::date) AS ends
      FROM core.employees e
      WHERE e.company_id = ${companyId} AND e.status IN ('active','on_notice','exited')
        AND (e.doj IS NULL OR e.doj < ${until}::date)
        AND (e.dol IS NULL OR e.dol >= ${from}::date)
    )
    SELECT count(*)::int AS employees,
      count(*) FILTER (WHERE p.doj IS NULL)::int AS missing_doj,
      count(*) FILTER (WHERE p.attendance_mode = 'biometric' AND NOT p.biometric_registered)::int AS missing_biometric,
      coalesce(sum(greatest((p.ends - p.starts) - facts.actual_days, 0)),0)::int AS missing_days,
      coalesce(sum(facts.unresolved),0)::int AS unresolved_days,
      coalesce(sum(facts.undetected_ot),0)::int AS undetected_ot
    FROM population p
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS actual_days,
        count(*) FILTER (WHERE (d.status = 'WO' AND d.weekoff_paid IS NULL)
          OR (d.status = 'L' AND lt.id IS NULL))::int AS unresolved,
        count(*) FILTER (WHERE d.ot_minutes >= ${otMinMinutes} AND NOT EXISTS (
          SELECT 1 FROM att.overtime_entries o WHERE o.employee_id = p.id AND o.work_date = d.work_date
        ))::int AS undetected_ot
      FROM att.day_records d LEFT JOIN lv.leave_types lt ON lt.id = d.leave_type_id
      WHERE d.employee_id = p.id AND d.work_date >= p.starts AND d.work_date < p.ends
    ) facts ON true
  `.execute(db);
  const facts = rows.rows[0];
  if (!facts) throw new Error('Attendance completeness could not be established');
  const queued = await db
    .selectFrom('att.recompute_queue as q')
    .innerJoin('core.employees as e', 'e.id', 'q.employee_id')
    .select(({ fn }) => fn.countAll().as('n'))
    .where('e.company_id', '=', companyId)
    .where('q.work_date', '>=', sql<Date>`${from}::date`)
    .where('q.work_date', '<', sql<Date>`${until}::date`)
    .executeTakeFirstOrThrow();
  const leave = await db
    .selectFrom('lv.applications as l')
    .innerJoin('core.employees as e', 'e.id', 'l.employee_id')
    .select(({ fn }) => fn.countAll().as('n'))
    .where('e.company_id', '=', companyId)
    .where((eb) =>
      eb.or([
        eb('l.status', '=', 'pending'),
        eb.exists(
          eb
            .selectFrom('wf.requests as cancellation')
            .select('cancellation.id')
            .whereRef('cancellation.id', '=', 'l.cancel_workflow_request_id')
            .where('cancellation.status', 'in', ['pending', 'sent_back']),
        ),
      ]),
    )
    .where('l.from_date', '<', sql<Date>`${until}::date`)
    .where('l.to_date', '>=', sql<Date>`${from}::date`)
    .executeTakeFirstOrThrow();
  const unapplied = await db
    .selectFrom('att.regularizations as r')
    .innerJoin('wf.requests as w', 'w.id', 'r.workflow_request_id')
    .innerJoin('core.employees as e', 'e.id', 'r.employee_id')
    .select(({ fn }) => fn.countAll().as('n'))
    .where('e.company_id', '=', companyId)
    .where('w.status', '=', 'approved')
    .where('r.applied', '=', false)
    .where('r.from_date', '<', sql<Date>`${until}::date`)
    .where('r.to_date', '>=', sql<Date>`${from}::date`)
    .executeTakeFirstOrThrow();
  return {
    ...facts,
    queued: Number(queued.n),
    pending_leave: Number(leave.n),
    unapplied: Number(unapplied.n),
  };
}
