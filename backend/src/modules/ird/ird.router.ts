/**
 * Stage 5.5 — POSH / grievance / whistleblower router (skeleton).
 *
 * Access model first: opening a POSH case requires `ird.posh.handle` AND
 * step-up. A caller without the permission gets FORBIDDEN (sponsor demo).
 * Filing is open to any authenticated employee; anonymous POSH and
 * whistleblower intake are public `base` procedures that store only a token
 * hash. IC listing is honest about an empty committee.
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { authed, base, withPermission, withStepUp } from '../../api/orpc.js';
import {
  fileGrievance,
  filePoshAnonymous,
  filePoshAuthenticated,
  fileWhistleblower,
  listGrievances,
  listIcMembers,
  listPoshCases,
  openPoshCase,
} from './ird.service.js';

const SUMMARY = z.string().trim().min(10).max(8000);

const icMemberOutput = z.object({
  id: z.number().int(),
  employeeId: z.number().int(),
  role: z.enum(['presiding_officer', 'member', 'external']),
  active: z.boolean(),
  appointedOn: z.string(),
});

/** Anyone signed in can see whether the IC exists — empty is a real answer. */
const listIc = authed
  .route({
    method: 'GET',
    path: '/ird/ic',
    summary: 'List Internal Committee members (empty until sponsor appoints)',
  })
  .input(z.object({}))
  .output(
    z.object({
      members: z.array(icMemberOutput),
      constituted: z.boolean(),
      banner: z.string(),
    }),
  )
  .handler(async ({ context }) => listIcMembers(context.db));

const listPosh = withPermission('ird.posh.handle')
  .route({
    method: 'GET',
    path: '/ird/posh/cases',
    summary: 'List POSH cases (handlers only)',
  })
  .input(z.object({}))
  .output(
    z.object({
      cases: z.array(
        z.object({
          id: z.number().int(),
          caseRef: z.string(),
          status: z.string(),
          filedAt: z.string(),
          isAnonymous: z.boolean(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => ({ cases: await listPoshCases(context.db) }));

/**
 * Open a POSH case — the sponsor demo surface. Permission failure → FORBIDDEN
 * before step-up is even considered (withStepUp checks permission first).
 */
const openPosh = withStepUp('ird.posh.handle')
  .route({
    method: 'GET',
    path: '/ird/posh/cases/{id}',
    summary: 'Open a POSH case (permission + step-up; access logged)',
  })
  .input(z.object({ id: z.coerce.number().int().positive() }))
  .output(
    z.object({
      id: z.number().int(),
      caseRef: z.string(),
      status: z.string(),
      filedAt: z.string(),
      isAnonymous: z.boolean(),
      summary: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const detail = await openPoshCase(context.db, {
      caseId: input.id,
      actorUserId: context.user.id,
      ip: context.req.ip ?? null,
    });
    if (!detail) throw new ORPCError('NOT_FOUND', { message: 'Case not found' });
    return detail;
  });

/** Authenticated employee filing — not anonymous. */
const filePosh = authed
  .route({
    method: 'POST',
    path: '/ird/posh/file',
    summary: 'File a POSH complaint as the signed-in employee',
  })
  .input(z.object({ summary: SUMMARY }))
  .output(z.object({ id: z.number().int(), caseRef: z.string() }))
  .handler(async ({ input, context }) =>
    filePoshAuthenticated(context.db, {
      userId: context.user.id,
      summary: input.summary,
      ip: context.req.ip ?? null,
    }),
  );

/**
 * Anonymous POSH intake (poster QR / public channel). Returns a claim token
 * once; only the hash is persisted. No user FK.
 */
const filePoshAnon = base
  .route({
    method: 'POST',
    path: '/ird/posh/file-anonymous',
    summary: 'Anonymous POSH intake — claim token returned once',
  })
  .input(z.object({ summary: SUMMARY }))
  .output(
    z.object({
      id: z.number().int(),
      caseRef: z.string(),
      claimToken: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    if (!context.db) {
      throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'Database unavailable' });
    }
    return filePoshAnonymous(context.db, {
      summary: input.summary,
      ip: context.req.ip ?? null,
    });
  });

const listGrievance = withPermission('ird.grievance.handle')
  .route({
    method: 'GET',
    path: '/ird/grievances',
    summary: 'List grievances for HR handlers',
  })
  .input(z.object({}))
  .output(
    z.object({
      grievances: z.array(
        z.object({
          id: z.number().int(),
          caseRef: z.string(),
          status: z.string(),
          filedAt: z.string(),
          filedByUserId: z.number().int(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => ({
    grievances: await listGrievances(context.db),
  }));

const fileGrievanceProc = authed
  .route({
    method: 'POST',
    path: '/ird/grievances/file',
    summary: 'File a workplace grievance (authenticated)',
  })
  .input(z.object({ summary: SUMMARY }))
  .output(z.object({ id: z.number().int(), caseRef: z.string() }))
  .handler(async ({ input, context }) =>
    fileGrievance(context.db, {
      userId: context.user.id,
      summary: input.summary,
      ip: context.req.ip ?? null,
    }),
  );

/** Public whistleblower channel — rate-limit stub, no PII stored. */
const fileWhistle = base
  .route({
    method: 'POST',
    path: '/ird/whistle/file',
    summary: 'Anonymous whistleblower intake (IP-rate-limited in app.ts)',
  })
  .input(z.object({ summary: SUMMARY }))
  .output(z.object({ id: z.number().int(), claimToken: z.string() }))
  .handler(async ({ input, context }) => {
    if (!context.db) {
      throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'Database unavailable' });
    }
    // Throttling is HTTP middleware (app.ts `intakeLimiter`), in front of this
    // route — not a domain check the domain cannot enforce.
    return fileWhistleblower(context.db, {
      summary: input.summary,
      ip: context.req.ip ?? null,
    });
  });

export const irdRouter = {
  listIc,
  listPosh,
  openPosh,
  filePosh,
  filePoshAnon,
  listGrievance,
  fileGrievance: fileGrievanceProc,
  fileWhistle,
};
