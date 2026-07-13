/**
 * LC-03 / R24 — the daily boarding & exit report (PP-6/PP-26: the email HR was
 * refused for a year). Every morning, joins and exits of the previous day go
 * to the configured audience — Plant Head, HR, Business Head, CEO Cell — and
 * the send happens EVEN WHEN THE DAY IS EMPTY ("runs without exception"), so
 * a silent day is provably a no-movement day, never a broken job.
 *
 * Recipients are DATA: wf.event_subscriptions rows for 'lifecycle.boarding_exit'.
 */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { addDaysIso, formatDbDate, istDateString } from '../../core/dates.js';
import { enqueueEvent } from '../notifications/index.js';

export interface BoardingRow {
  ecode: string;
  name: string;
  designation: string | null;
  department: string | null;
  company: string;
  reportingManager: string | null;
  date: string;
}

export interface ExitRow extends BoardingRow {
  exitReason: string | null;
}

export interface BoardingExitReport {
  from: string;
  to: string;
  joins: BoardingRow[];
  exits: ExitRow[];
}

/** R24 columns: joins (name, ecode, designation, dept, RM, DOJ) and exits (+ reason, DOL). */
export async function boardingExitReport(db: Kysely<Database>, fromIso: string, toIso: string): Promise<BoardingExitReport> {
  const base = db
    .selectFrom('core.employees as e')
    .innerJoin('core.companies as c', 'c.id', 'e.company_id')
    .leftJoin('core.designations as dg', 'dg.id', 'e.designation_id')
    .leftJoin('core.departments as dp', 'dp.id', 'e.department_id')
    .leftJoin('core.employees as rm', 'rm.id', 'e.reporting_manager_id')
    .select([
      'e.ecode',
      'e.first_name',
      'e.last_name',
      'e.exit_reason',
      'e.doj',
      'e.dol',
      'c.code as company',
      'dg.name as designation',
      'dp.name as department',
      'rm.first_name as rm_first',
      'rm.last_name as rm_last',
    ]);

  const joins = await base
    .where('e.doj', '>=', sql<Date>`${fromIso}::date`)
    .where('e.doj', '<=', sql<Date>`${toIso}::date`)
    .orderBy('c.code')
    .orderBy('e.ecode')
    .execute();
  const exits = await base
    .where('e.dol', '>=', sql<Date>`${fromIso}::date`)
    .where('e.dol', '<=', sql<Date>`${toIso}::date`)
    .orderBy('c.code')
    .orderBy('e.ecode')
    .execute();

  const name = (first: string, last: string | null): string => (last ? `${first} ${last}` : first);
  const rmName = (first: string | null, last: string | null): string | null => (first ? name(first, last) : null);

  return {
    from: fromIso,
    to: toIso,
    joins: joins.map((r) => ({
      ecode: r.ecode,
      name: name(r.first_name, r.last_name),
      designation: r.designation,
      department: r.department,
      company: r.company,
      reportingManager: rmName(r.rm_first, r.rm_last),
      date: formatDbDate(r.doj ?? new Date()),
    })),
    exits: exits.map((r) => ({
      ecode: r.ecode,
      name: name(r.first_name, r.last_name),
      designation: r.designation,
      department: r.department,
      company: r.company,
      reportingManager: rmName(r.rm_first, r.rm_last),
      date: formatDbDate(r.dol ?? new Date()),
      exitReason: r.exit_reason,
    })),
  };
}

/** The 07:00 IST job body: yesterday's movement to the subscribed audience —
 *  queued unconditionally, empty day included. Returns recipients queued. */
export async function sendBoardingExitEmail(db: Kysely<Database>, dateIso?: string): Promise<number> {
  const date = dateIso ?? addDaysIso(istDateString(), -1);
  const report = await boardingExitReport(db, date, date);
  return enqueueEvent(db, 'lifecycle.boarding_exit', 'boarding_exit_daily', {
    date,
    joinCount: report.joins.length,
    exitCount: report.exits.length,
    joins: report.joins,
    exits: report.exits,
  });
}
