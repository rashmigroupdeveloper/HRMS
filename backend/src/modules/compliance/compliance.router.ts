/**
 * Stage 5.7 — the compliance surface (CMP-15..CMP-20).
 *
 * Held by `hr_head` and `compliance`-scoped `hr_ops`, never by IT: these are
 * statutory obligations, not system settings. Filing evidence has its own
 * permission (`cmp.evidence.upload`) so recording a challan can be delegated
 * without also handing over the ability to rewrite the calendar itself.
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { getTypedSetting } from '../../core/settings/read.js';
import { parseAlertStages } from './expiry.js';
import {
  listRegistrations,
  registrationPosture,
  retireRegistration,
  upsertRegistration,
} from './registrations.service.js';
import {
  listCalendar,
  listEvidence,
  recordFiling,
  upsertCalendarItem,
  waiveItem,
} from './calendar.service.js';

const KIND = z.enum([
  'pf',
  'esic',
  'pt',
  'lwf',
  'factory_licence',
  'clra_licence',
  'shops',
  'single_registration',
  'other',
]);
const FREQUENCY = z.enum(['monthly', 'quarterly', 'half_yearly', 'annual', 'one_off']);
const ISO_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

const expiryOutput = z.object({
  state: z.enum(['perpetual', 'valid', 'expiring', 'expired']),
  daysRemaining: z.number().int().nullable(),
  stage: z.number().int().nullable(),
});

const registrationOutput = z.object({
  id: z.number().int(),
  companyId: z.number().int(),
  companyName: z.string(),
  locationId: z.number().int().nullable(),
  locationName: z.string().nullable(),
  kind: KIND,
  registrationNo: z.string(),
  issuingAuthority: z.string().nullable(),
  validFrom: z.string(),
  validTo: z.string().nullable(),
  renewalOwnerEmail: z.string().nullable(),
  notes: z.string().nullable(),
  expiry: expiryOutput,
});

/** One place reads the ladder, so every surface alerts on the same thresholds. */
async function alertStages(db: Parameters<typeof getTypedSetting>[0]): Promise<number[]> {
  const raw = await getTypedSetting(db, 'cmp.licence_alert_stages', 'string', '90,30,15,7');
  return parseAlertStages(raw);
}

const registrations = withPermission('cmp.licence.manage')
  .route({
    method: 'GET',
    path: '/compliance/registrations',
    summary: 'Statutory registrations and licences, with their expiry state (CMP-15/16)',
  })
  .input(
    z.object({
      companyId: z.number().int().optional(),
      locationId: z.number().int().optional(),
      kind: KIND.optional(),
      needsAttentionOnly: z.boolean().default(false),
    }),
  )
  .output(z.object({ rows: z.array(registrationOutput) }))
  .handler(async ({ input, context }) => {
    const rows = await listRegistrations(
      context.db,
      {
        ...(input.companyId === undefined ? {} : { companyId: input.companyId }),
        ...(input.locationId === undefined ? {} : { locationId: input.locationId }),
        ...(input.kind === undefined ? {} : { kind: input.kind }),
        needsAttentionOnly: input.needsAttentionOnly,
      },
      new Date(),
      await alertStages(context.db),
    );
    return { rows };
  });

const saveRegistration = withPermission('cmp.licence.manage')
  .route({
    method: 'POST',
    path: '/compliance/registrations',
    summary: 'Create or amend a registration/licence',
  })
  .input(
    z.object({
      id: z.number().int().optional(),
      companyId: z.number().int(),
      locationId: z.number().int().nullable(),
      kind: KIND,
      registrationNo: z.string().min(1).max(120),
      issuingAuthority: z.string().max(200).nullable(),
      validFrom: ISO_DATE,
      validTo: ISO_DATE.nullable(),
      renewalOwnerUserId: z.number().int().nullable(),
      documentPath: z.string().max(500).nullable(),
      notes: z.string().max(2000).nullable(),
    }),
  )
  .output(z.object({ id: z.number().int() }))
  .handler(async ({ input, context }) => {
    if (input.validTo !== null && input.validTo <= input.validFrom) {
      throw new ORPCError('BAD_REQUEST', { message: 'Valid-to must be after valid-from' });
    }
    // `id` is destructured out rather than spread: under exactOptionalPropertyTypes
    // an explicit `id: undefined` is not the same as an absent `id`.
    const { id: existingId, ...rest } = input;
    const id = await upsertRegistration(
      context.db,
      { ...rest, ...(existingId === undefined ? {} : { id: existingId }) },
      context.user.id,
    );
    return { id };
  });

const retire = withPermission('cmp.licence.manage')
  .route({
    method: 'POST',
    path: '/compliance/registrations/retire',
    summary: 'Retire a registration (kept for the record, never deleted)',
  })
  .input(z.object({ id: z.number().int(), reason: z.string().min(3).max(300) }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    await retireRegistration(context.db, input.id, context.user.id, input.reason);
    return { ok: true as const };
  });

const posture = withPermission('cmp.licence.manage')
  .route({
    method: 'GET',
    path: '/compliance/posture',
    summary: 'Per-entity compliance posture — who is about to have a problem (CMP-19)',
  })
  .output(
    z.object({
      companies: z.array(
        z.object({
          companyId: z.number().int(),
          companyName: z.string(),
          expired: z.number().int(),
          expiring: z.number().int(),
          valid: z.number().int(),
          perpetual: z.number().int(),
        }),
      ),
      overdueFilings: z.number().int(),
    }),
  )
  .handler(async ({ context }) => {
    const today = new Date();
    const [companies, calendar] = await Promise.all([
      registrationPosture(context.db, today, await alertStages(context.db)),
      listCalendar(context.db, { lookaheadDays: 0, includeSettled: false }, today),
    ]);
    return {
      companies,
      overdueFilings: calendar.filter((item) => item.status === 'overdue').length,
    };
  });

const calendarItemOutput = z.object({
  id: z.number().int(),
  companyId: z.number().int(),
  companyName: z.string(),
  obligationCode: z.string(),
  title: z.string(),
  frequency: FREQUENCY,
  periodLabel: z.string(),
  dueOn: z.string(),
  ownerEmail: z.string().nullable(),
  status: z.enum(['due', 'overdue', 'filed', 'waived']),
  daysUntilDue: z.number().int(),
  evidenceCount: z.number().int(),
  filedAt: z.string().nullable(),
  waivedReason: z.string().nullable(),
});

const calendar = withPermission('cmp.calendar.manage')
  .route({
    method: 'GET',
    path: '/compliance/calendar',
    summary: 'Statutory obligations due, overdue and settled (CMP-17)',
  })
  .input(
    z.object({
      companyId: z.number().int().optional(),
      lookaheadDays: z.number().int().min(0).max(365).optional(),
      includeSettled: z.boolean().default(false),
    }),
  )
  .output(z.object({ rows: z.array(calendarItemOutput) }))
  .handler(async ({ input, context }) => {
    const lookaheadDays =
      input.lookaheadDays ??
      (await getTypedSetting(context.db, 'cmp.calendar_lookahead_days', 'number', 60));
    const rows = await listCalendar(
      context.db,
      {
        ...(input.companyId === undefined ? {} : { companyId: input.companyId }),
        lookaheadDays,
        includeSettled: input.includeSettled,
      },
      new Date(),
    );
    return { rows };
  });

const saveCalendarItem = withPermission('cmp.calendar.manage')
  .route({
    method: 'POST',
    path: '/compliance/calendar',
    summary: 'Create or amend a calendar obligation',
  })
  .input(
    z.object({
      id: z.number().int().optional(),
      companyId: z.number().int(),
      obligationCode: z.string().min(2).max(60),
      title: z.string().min(2).max(200),
      frequency: FREQUENCY,
      periodLabel: z.string().min(1).max(60),
      dueOn: ISO_DATE,
      ownerUserId: z.number().int().nullable(),
      registrationId: z.number().int().nullable(),
    }),
  )
  .output(z.object({ id: z.number().int() }))
  .handler(async ({ input, context }) => {
    const { id: existingId, ...rest } = input;
    const id = await upsertCalendarItem(
      context.db,
      { ...rest, ...(existingId === undefined ? {} : { id: existingId }) },
      context.user.id,
    );
    return { id };
  });

const file = withPermission('cmp.evidence.upload')
  .route({
    method: 'POST',
    path: '/compliance/calendar/file',
    summary: 'Record a filing WITH its evidence — the two are one transaction (CMP-18)',
  })
  .input(
    z.object({
      itemId: z.number().int(),
      reference: z.string().min(2).max(120),
      documentPath: z.string().max(500).nullable(),
      remark: z.string().max(500).nullable(),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    const result = await recordFiling(context.db, input, context.user.id);
    if (!result.ok) {
      throw new ORPCError(result.reason === 'not_found' ? 'NOT_FOUND' : 'CONFLICT', {
        message:
          result.reason === 'not_found'
            ? 'That obligation no longer exists'
            : 'That obligation has already been filed or waived',
      });
    }
    return { ok: true as const };
  });

const waive = withPermission('cmp.calendar.manage')
  .route({
    method: 'POST',
    path: '/compliance/calendar/waive',
    summary: 'Settle an obligation without evidence — reason mandatory, audited separately',
  })
  .input(z.object({ itemId: z.number().int(), reason: z.string().min(3).max(300) }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    const result = await waiveItem(context.db, input, context.user.id);
    if (!result.ok) {
      throw new ORPCError(result.reason === 'not_found' ? 'NOT_FOUND' : 'CONFLICT', {
        message:
          result.reason === 'not_found'
            ? 'That obligation no longer exists'
            : 'That obligation has already been filed or waived',
      });
    }
    return { ok: true as const };
  });

const evidence = withPermission('cmp.calendar.manage')
  .route({
    method: 'GET',
    path: '/compliance/calendar/evidence',
    summary: 'The evidence behind a filing (append-only)',
  })
  .input(z.object({ itemId: z.number().int() }))
  .output(
    z.object({
      rows: z.array(
        z.object({
          reference: z.string(),
          remark: z.string().nullable(),
          recordedAt: z.string(),
          filedByEmail: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => ({
    rows: await listEvidence(context.db, input.itemId),
  }));

export const complianceRouter = {
  registrations,
  saveRegistration,
  retire,
  posture,
  calendar,
  saveCalendarItem,
  file,
  waive,
  evidence,
};
