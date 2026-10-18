/** Internal human permissions and external confidential-client endpoints stay distinct. */
import { z } from 'zod';
import { ORPCError } from '@orpc/server';
import { base, withPermission } from '../../api/orpc.js';
import { verifyToken } from '../../core/auth/jwt.js';
import { clientAuthentication } from './config.js';
import {
  connectedStatus,
  linkAccount,
  unlinkAccount,
  authorize,
  redeem,
  introspect,
  revokeConnectedSession,
  searchExternalAccounts,
} from './service.js';
const own = withPermission('auth.sso');
const admin = withPermission('admin.users');
const verifier = z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/);
export const ssoRouter = {
  status: own
    .route({ method: 'GET', path: '/sso/status' })
    .input(z.object({}).optional())
    .output(
      z.object({ configured: z.boolean(), linked: z.boolean(), startUrl: z.string().nullable() }),
    )
    .handler(({ context }) => connectedStatus(context.db, context.user.id)),
  localAccounts: admin
    .route({ method: 'GET', path: '/sso/local-accounts' })
    .input(z.object({ q: z.string().trim().min(2).max(80) }))
    .output(
      z.array(
        z.object({
          userId: z.number(),
          email: z.string(),
          ecode: z.string().nullable(),
          name: z.string().nullable(),
        }),
      ),
    )
    .handler(async ({ context, input }) => {
      if (!context.permissionAccess.all) throw new ORPCError('FORBIDDEN');
      const q = input.q + '%';
      const rows = await context.db
        .selectFrom('core.users as u')
        .leftJoin('core.employees as e', 'e.id', 'u.employee_id')
        .select(['u.id', 'u.email', 'e.ecode', 'e.first_name', 'e.last_name'])
        .where('u.is_active', '=', true)
        .where((eb) =>
          eb.or([
            eb('u.email', 'ilike', q),
            eb('e.ecode', 'ilike', q),
            eb('e.first_name', 'ilike', q),
            eb('e.last_name', 'ilike', q),
          ]),
        )
        .orderBy('u.id')
        .limit(25)
        .execute();
      return rows.map((u) => ({
        userId: u.id,
        email: u.email,
        ecode: u.ecode,
        name: [u.first_name, u.last_name].filter(Boolean).join(' ') || null,
      }));
    }),
  links: admin
    .route({ method: 'GET', path: '/sso/links' })
    .input(z.object({ cursor: z.number().int().positive().optional() }).optional())
    .output(
      z.object({
        links: z.array(
          z.object({
            id: z.number(),
            userId: z.number(),
            email: z.string(),
            clientId: z.string(),
            externalSubject: z.string(),
            active: z.boolean(),
          }),
        ),
      }),
    )
    .handler(async ({ context, input }) => {
      if (!context.permissionAccess.all) throw new ORPCError('FORBIDDEN');
      const rows = await context.db
        .selectFrom('sec.app_links as l')
        .innerJoin('core.users as u', 'u.id', 'l.user_id')
        .select([
          'l.id',
          'l.user_id',
          'u.email',
          'l.client_id',
          'l.external_subject',
          'l.is_active',
        ])
        .where('l.id', '<', input?.cursor ?? Number.MAX_SAFE_INTEGER)
        .orderBy('l.id', 'desc')
        .limit(50)
        .execute();
      return {
        links: rows.map((l) => ({
          id: l.id,
          userId: l.user_id,
          email: l.email,
          clientId: l.client_id,
          externalSubject: l.external_subject,
          active: l.is_active,
        })),
      };
    }),
  externalAccounts: admin
    .route({ method: 'GET', path: '/sso/external-accounts' })
    .input(z.object({ q: z.string().trim().min(2).max(80) }))
    .output(
      z.object({
        accounts: z.array(
          z.object({
            subject: z.string(),
            name: z.string(),
            email: z.string(),
            employeeCode: z.string().nullable(),
          }),
        ),
      }),
    )
    .handler(({ context, input }) => {
      if (!context.permissionAccess.all) throw new ORPCError('FORBIDDEN');
      context.res.setHeader('Cache-Control', 'no-store');
      return searchExternalAccounts(input.q);
    }),
  link: admin
    .route({ method: 'POST', path: '/sso/links' })
    .input(
      z.object({
        userId: z.number().int().positive(),
        externalSubject: z.string().regex(/^[1-9]\d*$/),
        reason: z.string().trim().min(1).max(2000),
      }),
    )
    .output(z.object({ id: z.number() }))
    .handler(({ context, input }) => {
      if (!context.permissionAccess.all)
        throw new ORPCError('FORBIDDEN', {
          message: 'Group account-administration authority is required',
        });
      return linkAccount(context.db, input, context.user.id);
    }),
  unlink: admin
    .route({ method: 'POST', path: '/sso/links/{linkId}/unlink' })
    .input(
      z.object({ linkId: z.number().int().positive(), reason: z.string().trim().min(1).max(2000) }),
    )
    .output(z.object({ success: z.literal(true) }))
    .handler(({ context, input }) => {
      if (!context.permissionAccess.all)
        throw new ORPCError('FORBIDDEN', {
          message: 'Group account-administration authority is required',
        });
      return unlinkAccount(context.db, input.linkId, context.user.id, input.reason);
    }),
  authorize: own
    .route({ method: 'POST', path: '/sso/authorize' })
    .input(
      z.object({
        clientId: z.string(),
        redirectUri: z.string().url(),
        challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        state: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
      }),
    )
    .output(z.object({ redirectUrl: z.string().url() }))
    .handler(async ({ context, input }) => {
      const claims = await verifyToken(
        context.req.headers.authorization?.slice(7) ?? '',
        context.jwtSecret,
      );
      if (!claims?.sid) throw new ORPCError('UNAUTHORIZED');
      context.res.setHeader('Cache-Control', 'no-store');
      return authorize(context.db, context.user.id, claims.sid, input);
    }),
  token: base
    .route({ method: 'POST', path: '/sso/token' })
    .input(
      z.object({
        code: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        clientId: z.string(),
        redirectUri: z.string().url(),
        verifier,
      }),
    )
    .output(z.object({ assertion: z.string() }))
    .handler(({ context, input }) => {
      clientAuthentication(context.req.headers.authorization);
      if (!context.db) throw new ORPCError('SERVICE_UNAVAILABLE');
      context.res.setHeader('Cache-Control', 'no-store');
      return redeem(context.db, input);
    }),
  logout: base
    .route({ method: 'POST', path: '/sso/logout' })
    .input(
      z.object({
        linkId: z.number().int().positive(),
        sid: z.string().uuid(),
        linkNonce: z.string().uuid(),
      }),
    )
    .output(z.object({ success: z.literal(true) }))
    .handler(({ context, input }) => {
      clientAuthentication(context.req.headers.authorization);
      if (!context.db) throw new ORPCError('SERVICE_UNAVAILABLE');
      context.res.setHeader('Cache-Control', 'no-store');
      return revokeConnectedSession(context.db, input.linkId, input.sid, input.linkNonce);
    }),
  introspect: base
    .route({ method: 'POST', path: '/sso/introspect' })
    .input(
      z.object({
        linkId: z.number().int().positive(),
        sid: z.string().uuid(),
        linkNonce: z.string().uuid(),
      }),
    )
    .output(z.object({ active: z.boolean(), subject: z.string().nullable() }))
    .handler(({ context, input }) => {
      clientAuthentication(context.req.headers.authorization);
      if (!context.db) throw new ORPCError('SERVICE_UNAVAILABLE');
      context.res.setHeader('Cache-Control', 'no-store');
      return introspect(context.db, input.linkId, input.sid, input.linkNonce);
    }),
};
