/**
 * Pre-Join Intake & Self-Service Token Service (LC-01, SOW crosswalk).
 *
 * Implements:
 * - Cryptographic pre-join token generation with SHA-256 hash stored at rest.
 * - Configured expiration and atomic single-use submission.
 * - Candidate profile, emergency contact, statutory ID, and bank proof submission.
 */

import { createHash, randomBytes } from 'crypto';
import type { Kysely } from 'kysely';
import { writeAudit } from '../../../core/audit/audit.service.js';
import { storeCandidateDocuments } from './joining-pack.js';
import { PrejoinSubmissionSchema } from './prejoin-schema.js';
import type { Database } from '../../../core/db/types.js';
import { inTransaction } from '../../../core/db/database.js';

export class PrejoinInputError extends Error {}
export class PrejoinConfigurationError extends Error {}

export interface PrejoinTokenResult {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface PrejoinSubmissionData {
  presentAddress: string;
  permanentAddress: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  pan?: string | undefined;
  aadhaar?: string | undefined;
  uan?: string | undefined;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  bloodGroup?: string | undefined;
}

export const PrejoinService = {
  /**
   * Generates a secure, single-use token with the configured lifetime.
   */
  generateToken(lifetimeHours: number): PrejoinTokenResult {
    if (!Number.isFinite(lifetimeHours) || lifetimeHours <= 0)
      throw new PrejoinConfigurationError(
        'Configure a positive prejoin link lifetime before issuing a link',
      );
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + lifetimeHours * 60 * 60 * 1000);
    if (!Number.isFinite(expiresAt.getTime()))
      throw new PrejoinConfigurationError('Configured prejoin link lifetime is invalid');

    return {
      rawToken,
      tokenHash,
      expiresAt,
    };
  },

  /**
   * Validates a candidate pre-join token.
   */
  async validateToken(
    db: Kysely<Database>,
    rawToken: string,
  ): Promise<{ isValid: boolean; candidateId?: number; error?: string }> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const candidate = await db
      .selectFrom('core.onboarding_candidates')
      .selectAll()
      .where('prejoin_token_hash', '=', tokenHash)
      .executeTakeFirst();

    if (!candidate) {
      return { isValid: false, error: 'Invalid or unknown pre-join token.' };
    }

    if (!['awaiting_prejoin', 'link_sent'].includes(candidate.status)) {
      return {
        isValid: false,
        error: 'This candidate is no longer accepting a prejoin submission.',
      };
    }

    if (candidate.prejoin_completed_at) {
      return { isValid: false, error: 'Pre-join data has already been submitted.' };
    }

    if (
      !candidate.prejoin_token_expires_at ||
      !Number.isFinite(new Date(candidate.prejoin_token_expires_at).getTime()) ||
      Date.now() >= new Date(candidate.prejoin_token_expires_at).getTime()
    ) {
      return { isValid: false, error: 'Pre-join link has expired or has no valid expiry.' };
    }

    return {
      isValid: true,
      candidateId: candidate.id,
    };
  },

  /**
   * Submits pre-join data entered by candidate.
   */
  async submitPrejoinData(
    db: Kysely<Database>,
    rawToken: string,
    data: PrejoinSubmissionData,
  ): Promise<{ success: boolean; candidateId: number }> {
    const application = PrejoinSubmissionSchema.safeParse(data);
    if (!application.success)
      throw new PrejoinInputError(
        'Complete all required prejoin application fields before submitting',
      );
    const submit = async (db: Kysely<Database>) => {
      const validation = await this.validateToken(db, rawToken);
      if (!validation.isValid || !validation.candidateId)
        throw new PrejoinInputError(validation.error ?? 'Prejoin token is unavailable');
      const now = new Date(Date.now());
      // The predicate, not the preceding read, enforces single use under racing requests.
      const { documents, ...stored } = application.data;
      const candidate = await db
        .updateTable('core.onboarding_candidates')
        .set({
          prejoin_completed_at: now,
          prejoin_submitted_data: JSON.stringify(stored),
          prejoin_link_token: null,
          status: 'prejoin_done',
          updated_at: now,
        })
        .where('id', '=', validation.candidateId)
        .where('prejoin_token_hash', '=', createHash('sha256').update(rawToken).digest('hex'))
        .where('prejoin_completed_at', 'is', null)
        .where('status', 'in', ['awaiting_prejoin', 'link_sent'])
        .where('prejoin_token_expires_at', '>', now)
        .returning('id')
        .executeTakeFirst();
      if (!candidate)
        throw new PrejoinInputError(
          'Prejoin link was already used, expired or is no longer available',
        );
      const person = await db.selectFrom('core.onboarding_candidates').select('full_name').where('id', '=', candidate.id).executeTakeFirst();
      await storeCandidateDocuments(
        db,
        candidate.id,
        person?.full_name ?? 'Candidate',
        documents,
        stored.formKind === 'overseas' ? undefined : stored.medicalNotes,
      );
      await writeAudit(db, {
        actorUserId: null,
        subjectEmployeeId: null,
        action: 'update',
        entity: 'core.onboarding_candidates',
        entityId: candidate.id,
        field: 'status',
        oldValue: 'awaiting_prejoin_or_link_sent',
        newValue: 'prejoin_done',
      });
      return { success: true, candidateId: candidate.id };
    };
    return db.isTransaction ? submit(db) : inTransaction(db, submit);
  },
};
