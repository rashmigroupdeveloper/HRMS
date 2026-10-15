/**
 * Pre-Join Intake & Self-Service Token Service (LC-01, SOW crosswalk).
 *
 * Implements:
 * - Cryptographic pre-join token generation with SHA-256 hash stored at rest.
 * - 72-hour expiration enforcement and single-use validation.
 * - Candidate profile, emergency contact, statutory ID, and bank proof submission.
 */

import { createHash, randomBytes } from 'crypto';
import type { Kysely } from 'kysely';
import type { Database } from '../../../core/db/types.js';

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
  pan: string;
  aadhaar: string;
  uan?: string | undefined;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  bloodGroup?: string | undefined;
}

export const PrejoinService = {
  /**
   * Generates a secure, single-use pre-join token valid for 72 hours.
   */
  generateToken(): PrejoinTokenResult {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

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
    rawToken: string
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

    if (candidate.status === 'converted') {
      return { isValid: false, error: 'Candidate has already completed onboarding and converted.' };
    }

    if (candidate.prejoin_completed_at) {
      return { isValid: false, error: 'Pre-join data has already been submitted.' };
    }

    if (candidate.prejoin_token_expires_at) {
      const expiry = new Date(candidate.prejoin_token_expires_at);
      if (Date.now() > expiry.getTime()) {
        return { isValid: false, error: 'Pre-join link has expired (72h limit exceeded).' };
      }
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
    data: PrejoinSubmissionData
  ): Promise<{ success: boolean; candidateId: number }> {
    const validation = await this.validateToken(db, rawToken);
    if (!validation.isValid || !validation.candidateId) {
      throw new Error(validation.error ?? 'Token validation failed.');
    }

    const candidateId = validation.candidateId;
    const now = new Date();

    await db
      .updateTable('core.onboarding_candidates')
      .set({
        prejoin_completed_at: now,
        prejoin_submitted_data: JSON.stringify(data),
        status: 'prejoin_done',
        updated_at: now,
      })
      .where('id', '=', candidateId)
      .execute();

    return {
      success: true,
      candidateId,
    };
  },
};
