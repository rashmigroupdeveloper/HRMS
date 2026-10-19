/**
 * Leave-planner / team calendar (SHF-08).
 */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { formatDbDate } from '../../core/dates.js';

export interface TeamCalendarDay {
  shiftCode: string | null;
  weekOff: boolean;
  leave: boolean;
  leavePending: boolean;
  blackout: string | null;
}

export interface TeamCalendarMember {
  employeeId: number;
  ecode: string;
  name: string;
  days: Record<string, TeamCalendarDay>;
}

export async function teamCalendar(
  db: Kysely<Database>,
  params: { employeeIds: number[]; from: string; to: string },
): Promise<TeamCalendarMember[]> {
  if (params.employeeIds.length === 0) return [];

  const team = await db
    .selectFrom('core.employees as e')
    .select(['e.id', 'e.ecode', 'e.first_name', 'e.last_name', 'e.location_id'])
    .where('e.id', 'in', params.employeeIds)
    .orderBy('e.ecode')
    .execute();

  const roster = await db
    .selectFrom('att.rosters as r')
    .leftJoin('att.shifts as s', 's.id', 'r.shift_id')
    .select(['r.employee_id', 'r.work_date', 'r.is_week_off', 's.code as shift_code'])
    .where('r.employee_id', 'in', params.employeeIds)
    .where('r.work_date', '>=', sql<Date>`${params.from}::date`)
    .where('r.work_date', '<=', sql<Date>`${params.to}::date`)
    .execute();

  const leave = await db
    .selectFrom('lv.applications')
    .select(['employee_id', 'from_date', 'to_date', 'status'])
    .where('employee_id', 'in', params.employeeIds)
    .where('status', 'in', ['pending', 'approved'])
    .where('from_date', '<=', sql<Date>`${params.to}::date`)
    .where('to_date', '>=', sql<Date>`${params.from}::date`)
    .execute();

  const blackouts = await db
    .selectFrom('att.leave_blackouts')
    .selectAll()
    .where('blackout_date', '>=', sql<Date>`${params.from}::date`)
    .where('blackout_date', '<=', sql<Date>`${params.to}::date`)
    .execute();

  return team.map((member) => {
    const days: Record<string, TeamCalendarDay> = {};
    for (const row of roster) {
      if (row.employee_id !== member.id) continue;
      const iso = formatDbDate(row.work_date);
      days[iso] = {
        shiftCode: row.shift_code,
        weekOff: row.is_week_off,
        leave: false,
        leavePending: false,
        blackout: null,
      };
    }
    for (const row of leave) {
      if (row.employee_id !== member.id) continue;
      const from = formatDbDate(row.from_date);
      const to = formatDbDate(row.to_date);
      for (const iso of Object.keys(days)) {
        if (from <= iso && iso <= to) {
          const cell = days[iso];
          if (!cell) continue;
          cell.leave = row.status === 'approved';
          cell.leavePending = row.status === 'pending';
        }
      }
    }
    for (const row of blackouts) {
      if (row.location_id !== null && row.location_id !== member.location_id) continue;
      const iso = formatDbDate(row.blackout_date);
      const cell = days[iso] ?? {
        shiftCode: null,
        weekOff: false,
        leave: false,
        leavePending: false,
        blackout: null,
      };
      cell.blackout = row.name;
      days[iso] = cell;
    }
    return {
      employeeId: member.id,
      ecode: member.ecode,
      name: member.last_name ? `${member.first_name} ${member.last_name}` : member.first_name,
      days,
    };
  });
}
