/** LC-01/CORE-02/06: immutable source receipt and candidate creation commit together. */
import { sql, type Kysely } from 'kysely';
import { ORPCError } from '@orpc/server';
import type { Database } from '../../core/db/types.js';
import { inTransaction } from '../../core/db/database.js';
import { parseRupees } from '../../core/money/index.js';
import { istDateString } from '../../core/dates.js';
import { atsCompanyIds } from './company-scope.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { OnboardingService } from '../lifecycle/index.js';
import { acceptedOfferSchema, acceptanceDigest, type AcceptedOffer } from './contract.js';
export async function receiveAcceptedOffer(db: Kysely<Database>, raw: AcceptedOffer, actorUserId: number | null = null) {
  const input = acceptedOfferSchema.parse(raw);
  const digest = acceptanceDigest(input);
  if (new Date(input.acceptedAt).getTime() > Date.now())
    throw new ORPCError('BAD_REQUEST', { message: 'Candidate acceptance cannot be in the future' });
  if (parseRupees(input.offeredCtc) <= 0)
    throw new ORPCError('BAD_REQUEST', { message: 'Accepted annual CTC must be positive' });
  if (input.offerDate > istDateString(new Date(input.acceptedAt)))
    throw new ORPCError('BAD_REQUEST', { message: 'Offer date cannot follow acceptance' });
  const allowed = await atsCompanyIds(db);
  if (!allowed.includes(input.companyId))
    throw new ORPCError('FORBIDDEN', {
      message: 'Employing entity is outside the configured ATS connection scope',
    });
  return inTransaction(db, async (tx) => {
    // Serialize the immutable offer identity, not only a retry's event ID.
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${'hrms:ats-offer:' + String(input.offerId)},0))`.execute(
      tx,
    );
    const prior = await tx
      .selectFrom('core.ats_acceptance_receipts')
      .selectAll()
      .where((eb) =>
        eb.or([eb('event_id', '=', input.eventId), eb('ats_offer_id', '=', input.offerId)]),
      )
      .executeTakeFirst();
    if (prior) {
      if (prior.event_id !== input.eventId || prior.source_digest !== digest)
        throw new ORPCError('CONFLICT', {
          message:
            'This ATS offer already has a different accepted snapshot; HR reconciliation is required',
        });
      return { candidateId: prior.candidate_id, created: false };
    }
    const company = await tx
      .selectFrom('core.companies')
      .select('id')
      .where('id', '=', input.companyId)
      .forShare()
      .executeTakeFirst();
    if (!company)
      throw new ORPCError('BAD_REQUEST', { message: 'Select an existing HRMS employing entity' });
    const result = await OnboardingService.ingestCandidate(tx, {
      atsCandidateId: input.candidateId,
      loiReference: 'ATS-OFFER-' + String(input.offerId),
      companyId: input.companyId,
      fullName: input.fullName,
      personalEmail: input.personalEmail,
      mobile: input.mobile,
      positionTitle: input.positionTitle,
      offeredCtc: input.offeredCtc,
      probationMonths: input.probationMonths,
      probationSalaryPct: input.probationSalaryPct,
      proposedDoj: input.proposedDoj,
      offerDate: input.offerDate,
    });
    await tx
      .insertInto('core.ats_acceptance_receipts')
      .values({
        event_id: input.eventId,
        ats_offer_id: input.offerId,
        candidate_id: result.candidateId,
        source_digest: digest,
        accepted_at: new Date(input.acceptedAt),
        accepted_by_subject: input.acceptedBySubject,
        evidence_ref: input.evidenceRef,
      })
      .execute();
    await writeAudit(tx, {
      actorUserId,
      subjectEmployeeId: null,
      action: 'ats.acceptance_received',
      entity: 'core.onboarding_candidates',
      entityId: result.candidateId,
      newValue: JSON.stringify({
        eventId: input.eventId,
        offerId: input.offerId,
        acceptedBySubject: input.acceptedBySubject,
      }),
    });
    // No token is returned to ATS or persisted in the receipt. Delivery uses HRMS's own portal workflow.
    return { candidateId: result.candidateId, created: true };
  });
}
