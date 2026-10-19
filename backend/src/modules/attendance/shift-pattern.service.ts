/**
 * Cyclic / rotating pattern templates (SHF-04).
 */
import { type Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { addDaysIso } from '../../core/dates.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { applyRosterEntries } from './roster.service.js';

export interface PatternDay {
  shiftCode: string | null;
  weekOff: boolean;
}

export interface ShiftPattern {
  code: string;
  name: string;
  cycle: PatternDay[];
}

function parseCycle(value: unknown): PatternDay[] {
  if (!Array.isArray(value)) return [];
  const days: PatternDay[] = [];
  for (const item of rawList(value)) {
    const shiftCode = item['shiftCode'];
    const weekOff = item['weekOff'] === true;
    days.push({
      shiftCode: typeof shiftCode === 'string' && shiftCode !== '' ? shiftCode : null,
      weekOff,
    });
  }
  return days;
}

function rawList(value: unknown[]): Record<string, unknown>[] {
  return value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
}

export async function listPatterns(db: Kysely<Database>): Promise<ShiftPattern[]> {
  const rows = await db.selectFrom('att.shift_patterns').selectAll().orderBy('code').execute();
  return rows.map((row) => ({ code: row.code, name: row.name, cycle: parseCycle(row.cycle) }));
}

export async function upsertPattern(
  db: Kysely<Database>,
  params: { actorUserId: number; pattern: ShiftPattern; ip: string | null },
): Promise<void> {
  if (params.pattern.cycle.length === 0) throw new Error('A pattern needs at least one day in the cycle');
  await db
    .insertInto('att.shift_patterns')
    .values({
      code: params.pattern.code,
      name: params.pattern.name,
      cycle: JSON.stringify(params.pattern.cycle),
      created_by: params.actorUserId,
    })
    .onConflict((oc) =>
      oc.column('code').doUpdateSet({
        name: params.pattern.name,
        cycle: JSON.stringify(params.pattern.cycle),
        created_by: params.actorUserId,
      }),
    )
    .execute();
  await writeAudit(db, {
    actorUserId: params.actorUserId,
    action: 'update',
    entity: 'att.shift_patterns',
    field: params.pattern.code,
    newValue: `${params.pattern.name} · ${String(params.pattern.cycle.length)}-day cycle`,
    ip: params.ip,
  });
}

export interface PatternApplyPreview {
  employeeId: number;
  date: string;
  shiftCode: string | null;
  weekOff: boolean;
}

export async function previewPatternApply(
  db: Kysely<Database>,
  params: { code: string; from: string; to: string; employeeIds: number[] },
): Promise<PatternApplyPreview[]> {
  const pattern = await db
    .selectFrom('att.shift_patterns')
    .selectAll()
    .where('code', '=', params.code)
    .executeTakeFirst();
  if (!pattern) throw new Error(`Unknown pattern: ${params.code}`);
  const cycle = parseCycle(pattern.cycle);
  if (cycle.length === 0) throw new Error('Pattern cycle is empty');
  if (params.from > params.to) throw new Error('from must be on or before to');

  const out: PatternApplyPreview[] = [];
  let offset = 0;
  for (let iso = params.from; iso <= params.to; iso = addDaysIso(iso, 1)) {
    const day = cycle[offset % cycle.length];
    offset += 1;
    if (!day) continue;
    for (const employeeId of params.employeeIds) {
      out.push({ employeeId, date: iso, shiftCode: day.shiftCode, weekOff: day.weekOff || day.shiftCode === null });
    }
  }
  return out;
}

export async function commitPatternApply(
  db: Kysely<Database>,
  params: {
    actorUserId: number;
    code: string;
    from: string;
    to: string;
    employeeIds: number[];
    ip: string | null;
    reason?: string | null;
  },
): Promise<{ upserted: number; preview: PatternApplyPreview[] }> {
  const preview = await previewPatternApply(db, params);
  const entries = preview.map((row) => ({
    employeeId: row.employeeId,
    date: row.date,
    shiftCode: row.shiftCode,
    weekOff: row.weekOff,
  }));

  const codes = [...new Set(entries.map((e) => e.shiftCode).filter((c): c is string => c !== null))];
  const shifts =
    codes.length === 0
      ? []
      : await db.selectFrom('att.shifts').select(['id', 'code']).where('code', 'in', codes).where('is_active', '=', true).execute();
  const ids = new Map(shifts.map((s) => [s.code, s.id]));
  const missing = codes.find((c) => !ids.has(c));
  if (missing !== undefined) throw new Error(`Unknown or inactive shift: ${missing}`);

  const upserted = await applyRosterEntries(db, {
    actorUserId: params.actorUserId,
    reason: params.reason ?? null,
    ip: params.ip,
    entries: entries.map((e) => ({
      employeeId: e.employeeId,
      date: e.date,
      shiftId: e.weekOff ? null : (ids.get(e.shiftCode ?? '') ?? null),
      weekOff: e.weekOff,
    })),
  });
  return { upserted, preview };
}
