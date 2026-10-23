/**
 * Settings service — the home of every policy number (docs/04 §8: nothing
 * policy-like is hardcoded). Reads are typed; writes are AUDITED (old → new
 * lands in the hash-chained audit log).
 */
import type { Kysely, Transaction } from 'kysely';
import { z } from 'zod';
import type { Database, SettingsTable } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { getSetting, upsertSetting } from './settings.repository.js';

const valueSchemas = {
  number: z.number(),
  string: z.string(),
  boolean: z.boolean(),
  json: z.unknown(),
} as const;

export type SettingType = SettingsTable['value_type'];

/** Enumerated / ranged policy values that the engines would otherwise reject at run time (item 4). */
const POLICY_VALUES: Record<string, (value: unknown) => boolean> = {
  'doc.max_upload_bytes': v => typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 8_000_000,
  'cmp.licence_alert_stages': v => typeof v === 'string' && /^\d+(,\d+)*$/.test(v) && v.split(',').every(part => Number(part) > 0),
  'sec.stepup_window_minutes': (v) => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 60,
  'pay.lop_divisor': (v) => typeof v === 'string' && ['CALENDAR', 'FIXED_30', 'FIXED_26', 'WORKING_DAYS'].includes(v),
  'att.cycle_start_day': (v) => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 28,
  'att.sandwich_rule': (v) => typeof v === 'boolean',
  'att.materialize_lookback_days': (v) => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 400,
  'att.day_finalize_after_time': v => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
  'pay.pf_wage_base': (v) => typeof v === 'string' && ['ACTUAL', 'CEILING_15000'].includes(v),
  'pay.negative_net_policy': (v) => typeof v === 'string' && ['carry_forward', 'flag'].includes(v),
};

function validatePolicyValue(key: string, value: unknown): void {
  const check = POLICY_VALUES[key];
  if (check && !check(value)) throw new Error(`Invalid value ${JSON.stringify(value)} for ${key}`);
}

/** Typed read; returns `fallback` when the key has never been set. */
export async function getTypedSetting<T>(
  db: Kysely<Database> | Transaction<Database>,
  key: string,
  type: SettingType,
  fallback: T,
): Promise<T> {
  const row = await getSetting(db, key);
  if (!row) return fallback;
  const parsed = valueSchemas[type].safeParse(row.value);
  if (!parsed.success) {
    throw new Error(`Setting ${key} holds a ${row.value_type}, expected ${type}`);
  }
  return parsed.data as T;
}

/** Audited write — who changed which policy value from what to what (CORE-11). */
export async function setSetting(
  db: Kysely<Database>,
  params: {
    key: string;
    value: unknown;
    type: SettingType;
    description: string;
    actorUserId: number | null;
  },
): Promise<void> {
  valueSchemas[params.type].parse(params.value); // fail fast on type mismatch
  validatePolicyValue(params.key, params.value);

  const previous = await getSetting(db, params.key);
  await upsertSetting(db, {
    key: params.key,
    value: params.value,
    value_type: params.type,
    description: params.description,
    updated_by: params.actorUserId,
  });

  await writeAudit(db, {
    actorUserId: params.actorUserId,
    action: previous ? 'update' : 'create',
    entity: 'core.settings',
    field: params.key,
    oldValue: previous ? JSON.stringify(previous.value) : null,
    newValue: JSON.stringify(params.value),
  });
}
