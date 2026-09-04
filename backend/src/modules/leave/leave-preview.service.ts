/**
 * Live apply preview (LV-03 + SHF-08) — the same sandwich, blackout and
 * coverage numbers the POST will use. The drawer must not invent day counts.
 */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { evaluateLeaveCoverage, type LeaveCoverageImpact } from './coverage-check.service.js';
import { computeLeaveSpan } from './leave-apply.service.js';
import { findLeaveBlackouts, type LeaveBlackoutHit } from './leave-blackout.js';
import { getBalance, getLeaveType } from './leave-core.service.js';

export interface LeaveSkip {
  date: string;
  reason: 'holiday' | 'week_off';
}

export interface LeaveApplyPreview {
  days: number;
  available: number;
  remaining: number;
  skipped: LeaveSkip[];
  blackouts: LeaveBlackoutHit[];
  coverage: LeaveCoverageImpact;
  blocked: boolean;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export async function previewLeaveApply(
  db: Kysely<Database>,
  params: {
    employeeId: number;
    leaveTypeCode: string;
    from: string;
    to: string;
    fromHalf?: boolean;
    toHalf?: boolean;
  },
): Promise<LeaveApplyPreview> {
  if (params.from > params.to) throw new Error('fromDate must be on or before toDate');
  const type = await getLeaveType(db, params.leaveTypeCode);
  const fromHalf = params.fromHalf ?? false;
  const toHalf = params.toHalf ?? false;
  if ((fromHalf || toHalf) && !type.allow_half_day) throw new Error(`${type.code} does not allow half days`);
  if (fromHalf && toHalf && params.from === params.to) throw new Error('A single day cannot be two halves');

  const employee = await db
    .selectFrom('core.employees')
    .select(['id', 'location_id'])
    .where('id', '=', params.employeeId)
    .executeTakeFirstOrThrow();

  const { days, span } = await computeLeaveSpan(db, employee, type, params.from, params.to, fromHalf, toHalf);
  const { available } = await getBalance(db, params.employeeId, type.id);
  const blackouts = await findLeaveBlackouts(db, {
    locationId: employee.location_id,
    from: params.from,
    to: params.to,
  });
  const coverage = await evaluateLeaveCoverage(db, {
    employeeId: params.employeeId,
    from: params.from,
    to: params.to,
    fromHalf,
    toHalf,
  });
  const skipped: LeaveSkip[] = [];
  for (const day of span) {
    if (day.counted || day.skipReason === null) continue;
    skipped.push({ date: day.iso, reason: day.skipReason });
  }
  return {
    days,
    available,
    remaining: round1(available - days),
    skipped,
    blackouts,
    coverage,
    blocked: blackouts.length > 0 || coverage.blocked,
  };
}
