/** LC-01: authorized HR issues/rotates a prejoining link without inventing delivery. */
import { z } from 'zod';
import { ORPCError } from '@orpc/server';
import { withPermission } from '../../../api/orpc.js';
import { inTransaction } from '../../../core/db/database.js';
import { assertCompanyInScope } from '../../../core/rbac/company-scope.js';
import { writeAudit } from '../../../core/audit/audit.service.js';
import { getTypedSetting } from '../../settings/index.js';
import { PrejoinService } from './prejoin.service.js';
export const prejoinLinkRouter = {
  issueLink: withPermission('lifecycle.onboard.convert')
    .route({
      method: 'POST',
      path: '/lifecycle/candidates/{candidateId}/prejoin-link',
      summary: 'Issue a new prejoin link; previous unsubmitted link becomes invalid',
    })
    .input(z.object({ candidateId: z.number().int().positive() }))
    .output(z.object({ rawToken: z.string(), expiresAt: z.date() }))
    .handler(async ({ context, input }) =>
      inTransaction(context.db, async (tx) => {
        const candidate = await tx
          .selectFrom('core.onboarding_candidates')
          .selectAll()
          .where('id', '=', input.candidateId)
          .forUpdate()
          .executeTakeFirst();
        if (!candidate?.company_id)
          throw new ORPCError('NOT_FOUND', { message: 'Candidate unavailable' });
        try {
          await assertCompanyInScope(
            tx,
            { ...context.permissionAccess, actorEmployeeId: context.user.employee_id },
            candidate.company_id,
          );
        } catch {
          throw new ORPCError('NOT_FOUND', { message: 'Candidate unavailable' });
        }
        if (
          !['awaiting_prejoin', 'link_sent'].includes(candidate.status) ||
          candidate.prejoin_completed_at !== null
        )
          throw new ORPCError('CONFLICT', {
            message: 'This candidate is no longer accepting a prejoin submission',
          });
        const hours = await getTypedSetting<number | null>(
          tx,
          'lifecycle.prejoin_token_hours',
          'number',
          null,
        );
        if (hours === null)
          throw new ORPCError('SERVICE_UNAVAILABLE', {
            message: 'Prejoin lifetime is not configured',
          });
        const token = PrejoinService.generateToken(hours);
        await tx
          .updateTable('core.onboarding_candidates')
          .set({
            prejoin_token_hash: token.tokenHash,
            prejoin_token_expires_at: token.expiresAt,
            prejoin_link_token: null,
            prejoin_link_sent_at: null,
            status: 'awaiting_prejoin',
            updated_at: new Date(),
          })
          .where('id', '=', candidate.id)
          .execute();
        await writeAudit(tx, {
          actorUserId: context.user.id,
          subjectEmployeeId: null,
          action: 'prejoin.link_issued',
          entity: 'core.onboarding_candidates',
          entityId: candidate.id,
          newValue: 'Unsubmitted link rotated; delivery not asserted',
        });
        context.res.setHeader('Cache-Control', 'no-store');
        return { rawToken: token.rawToken, expiresAt: token.expiresAt };
      }),
    ),
};
