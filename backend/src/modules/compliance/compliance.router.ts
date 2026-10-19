/**
 * Compliance oRPC router (Phase 5 Stage 5.7 · CMP-15..20).
 *
 * Enforces organization unit scoping, input validation, and exact dates.
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { withPermission } from '../../api/orpc.js';
import { getTypedSetting } from '../settings/index.js';
import { parseAlertStages } from './expiry.js';
import {
  listRegistrations,
  registrationPosture,
  retireRegistration,
  sendRegistrationAlert,
  upsertRegistration,
} from './registrations.service.js';
import {
  listCalendar,
  listEvidence,
  recordFiling,
  sendCalendarReminder,
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
const ISO_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

async function alertStages(db: Kysely<Database>): Promise<number[]> {
  const raw = await getTypedSetting(db, 'cmp.licence_alert_stages', 'string', '90,30,15,7');
  return parseAlertStages(raw);
}

async function resolveAllowedCompanyIds(
  db: Kysely<Database>,
  access: { all: boolean; orgUnitIds: readonly number[] },
): Promise<Set<number> | null> {
  if (access.all) return null;
  const units = await db.selectFrom('core.org_units').select(['id', 'company_id']).execute();
  return new Set(
    units.filter((u) => access.orgUnitIds.includes(u.id)).map((u) => u.company_id),
  );
}

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
  expiry: z.object({
    state: z.enum(['perpetual', 'valid', 'expiring', 'expired']),
    daysRemaining: z.number().int().nullable(),
    stage: z.number().int().nullable(),
  }),
});

const registrations = withPermission('cmp.licence.manage')
  .route({
    method: 'GET',
    path: '/compliance/registrations',
    summary: 'List statutory registrations and licences with their expiry status (CMP-15/16)',
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
    const allowedCompanyIds = await resolveAllowedCompanyIds(context.db, context.permissionAccess);
    const rows = await listRegistrations(
      context.db,
      {
        ...(input.companyId === undefined ? {} : { companyId: input.companyId }),
        ...(input.locationId === undefined ? {} : { locationId: input.locationId }),
        ...(input.kind === undefined ? {} : { kind: input.kind }),
        needsAttentionOnly: input.needsAttentionOnly,
        allowedCompanyIds,
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
    const allowedCompanyIds = await resolveAllowedCompanyIds(context.db, context.permissionAccess);
    if (allowedCompanyIds !== null && !allowedCompanyIds.has(input.companyId)) {
      throw new ORPCError('FORBIDDEN', {
        message: 'Organization unit scope does not permit managing registrations for this company',
      });
    }

    if (input.validTo !== null && input.validTo <= input.validFrom) {
      throw new ORPCError('BAD_REQUEST', { message: 'Valid-to must be after valid-from' });
    }

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
    const allowedCompanyIds = await resolveAllowedCompanyIds(context.db, context.permissionAccess);
    const [companies, calendarRows] = await Promise.all([
      registrationPosture(context.db, today, await alertStages(context.db), allowedCompanyIds),
      listCalendar(
        context.db,
        { lookaheadDays: 0, includeSettled: false, allowedCompanyIds },
        today,
      ),
    ]);
    return {
      companies,
      overdueFilings: calendarRows.filter((item) => item.status === 'overdue').length,
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
    const allowedCompanyIds = await resolveAllowedCompanyIds(context.db, context.permissionAccess);
    const lookaheadDays =
      input.lookaheadDays ??
      (await getTypedSetting(context.db, 'cmp.calendar_lookahead_days', 'number', 60));
    const rows = await listCalendar(
      context.db,
      {
        ...(input.companyId === undefined ? {} : { companyId: input.companyId }),
        lookaheadDays,
        includeSettled: input.includeSettled,
        allowedCompanyIds,
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
    const allowedCompanyIds = await resolveAllowedCompanyIds(context.db, context.permissionAccess);
    if (allowedCompanyIds !== null && !allowedCompanyIds.has(input.companyId)) {
      throw new ORPCError('FORBIDDEN', {
        message: 'Organization unit scope does not permit managing obligations for this company',
      });
    }

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

const remindCalendar = withPermission('cmp.calendar.manage')
  .route({
    method: 'POST',
    path: '/compliance/calendar/remind',
    summary: 'Send an immediate reminder receipt to the obligation owner',
  })
  .input(z.object({ itemId: z.number().int() }))
  .output(
    z.object({
      ok: z.boolean(),
      receipt: z
        .object({
          notificationId: z.number().int(),
          recipientUserId: z.number().int(),
        })
        .optional(),
      error: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    return sendCalendarReminder(context.db, input.itemId, context.user.id);
  });

const remindRegistration = withPermission('cmp.licence.manage')
  .route({
    method: 'POST',
    path: '/compliance/registrations/remind',
    summary: 'Send an immediate expiry alert receipt to the licence renewal owner',
  })
  .input(z.object({ registrationId: z.number().int() }))
  .output(
    z.object({
      ok: z.boolean(),
      receipt: z
        .object({
          notificationId: z.number().int(),
          recipientUserId: z.number().int(),
        })
        .optional(),
      error: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    return sendRegistrationAlert(
      context.db,
      input.registrationId,
      context.user.id,
      await alertStages(context.db),
    );
  });

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
  remindCalendar,
  remindRegistration,
};
