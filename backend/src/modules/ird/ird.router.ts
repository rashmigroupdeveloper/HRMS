/**
 * Stage 5.5 — POSH / grievance / whistleblower router.
 *
 * Access model:
 * - Opening a POSH case requires `ird.posh.handle` AND password step-up, and
 *   is strictly scoped to assigned inquiry officers or active Presiding Officers.
 * - Non-assigned handlers receive 403 FORBIDDEN and an access-log refusal.
 * - Anonymous POSH and whistleblower channels are public `base` endpoints returning
 *   single-use claim tokens, with rate limiting at the HTTP middleware boundary.
 * - IC listing provides an honest empty banner until sponsor appointments are made.
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { authed, base, withPermission, withStepUp } from '../../api/orpc.js';
import {
  assignPoshCase,
  fileGrievance,
  filePoshAnonymous,
  filePoshAuthenticated,
  fileWhistleblower,
  getPoshClaimStatus,
  getWhistleClaimStatus,
  listGrievances,
  listIcMembers,
  listMyGrievances,
  listMyPoshCases,
  listPoshCases,
  listWhistleblowerReports,
  openPoshCase,
} from './ird.service.js';

const SUMMARY = z.string().trim().min(10).max(8000);
const CLAIM_TOKEN = z.string().trim().length(64);

const icMemberOutput = z.object({
  id: z.number().int(),
  employeeId: z.number().int(),
  role: z.enum(['presiding_officer', 'member', 'external']),
  active: z.boolean(),
  appointedOn: z.string(),
});

/** Anyone signed in can inspect whether the IC is constituted. */
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

/**
 * List POSH cases — scoped strictly by assigned-case isolation.
 * Presiding Officers see all cases; assigned handlers see their assigned cases only.
 */
const listPosh = withPermission('ird.posh.handle')
  .route({
    method: 'GET',
    path: '/ird/posh/cases',
    summary: 'List assigned POSH cases (handlers only, isolated to assigned cases)',
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
  .handler(async ({ context }) => ({
    cases: await listPoshCases(context.db, context.user.id),
  }));

/** ESS status check: authenticated employee can list cases they filed. */
const listMyPosh = authed
  .route({
    method: 'GET',
    path: '/ird/posh/my-cases',
    summary: 'List POSH complaints filed by the signed-in employee',
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
  .handler(async ({ context }) => ({
    cases: await listMyPoshCases(context.db, context.user.id),
  }));

/**
 * Open a POSH case — permission + step-up + assigned-case isolation.
 * Throws FORBIDDEN and logs a refusal if caller is not assigned to this case.
 */
const openPosh = withStepUp('ird.posh.handle')
  .route({
    method: 'GET',
    path: '/ird/posh/cases/{id}',
    summary: 'Open a POSH case (step-up required; restricted to assigned officers; access logged)',
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

/** Assign an investigator or inquiry officer to a POSH case. */
const assignPosh = withStepUp('ird.posh.handle')
  .route({
    method: 'POST',
    path: '/ird/posh/cases/{id}/assign',
    summary: 'Assign an inquiry officer to a POSH case (step-up required)',
  })
  .input(
    z.object({
      id: z.coerce.number().int().positive(),
      targetUserId: z.number().int().positive(),
      role: z.enum(['presiding_officer', 'investigator', 'member']).optional(),
    }),
  )
  .output(
    z.object({
      success: z.boolean(),
      caseId: z.number().int(),
      targetUserId: z.number().int(),
    }),
  )
  .handler(async ({ input, context }) =>
    assignPoshCase(context.db, {
      caseId: input.id,
      targetUserId: input.targetUserId,
      role: input.role,
      actorUserId: context.user.id,
      ip: context.req.ip ?? null,
    }),
  );

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
 * Anonymous POSH intake (QR poster / public channel).
 * Returns claim token once; only the SHA-256 hash is stored.
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

/** Anonymous POSH status check using single-use claim token. */
const checkPoshClaim = base
  .route({
    method: 'POST',
    path: '/ird/posh/claim-status',
    summary: 'Check anonymous POSH complaint status with claim token',
  })
  .input(z.object({ claimToken: CLAIM_TOKEN }))
  .output(
    z.object({
      caseRef: z.string(),
      status: z.string(),
      filedAt: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    if (!context.db) {
      throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'Database unavailable' });
    }
    return getPoshClaimStatus(context.db, input.claimToken);
  });

/** List grievances for HR handlers. */
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

/** ESS status check: authenticated employee can list grievances they filed. */
const listMyGrievance = authed
  .route({
    method: 'GET',
    path: '/ird/grievances/mine',
    summary: 'List grievances filed by the signed-in employee',
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
    grievances: await listMyGrievances(context.db, context.user.id),
  }));

/** File a workplace grievance (authenticated). */
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

/** Public whistleblower channel — anonymous, claim token returned once. */
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
    return fileWhistleblower(context.db, {
      summary: input.summary,
      ip: context.req.ip ?? null,
    });
  });

/** Public whistleblower status check using claim token. */
const checkWhistleClaim = base
  .route({
    method: 'POST',
    path: '/ird/whistle/claim-status',
    summary: 'Check anonymous whistleblower report status with claim token',
  })
  .input(z.object({ claimToken: CLAIM_TOKEN }))
  .output(
    z.object({
      status: z.string(),
      filedAt: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    if (!context.db) {
      throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'Database unavailable' });
    }
    return getWhistleClaimStatus(context.db, input.claimToken);
  });

/** List whistleblower reports for handlers with ird.whistle.intake. */
const listWhistle = withPermission('ird.whistle.intake')
  .route({
    method: 'GET',
    path: '/ird/whistle/reports',
    summary: 'List whistleblower reports for triage handlers',
  })
  .input(z.object({}))
  .output(
    z.object({
      reports: z.array(
        z.object({
          id: z.number().int(),
          status: z.string(),
          filedAt: z.string(),
          summary: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => ({
    reports: await listWhistleblowerReports(context.db),
  }));

export const irdRouter = {
  listIc,
  listPosh,
  listMyPosh,
  openPosh,
  assignPosh,
  filePosh,
  filePoshAnon,
  checkPoshClaim,
  listGrievance,
  listMyGrievance,
  fileGrievance: fileGrievanceProc,
  fileWhistle,
  checkWhistleClaim,
  listWhistle,
};
