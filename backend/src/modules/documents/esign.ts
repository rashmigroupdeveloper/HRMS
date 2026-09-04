/**
 * DOC-06 — e-signature provider interface (skeleton only).
 *
 * Aadhaar eSign / DSC will sit behind this swappable contract — the same pattern
 * as KentConnector and booking adapters. No vendor is wired in Stage 5.4; the
 * vault stores unsigned files and the envelope model lands with P5-T31.
 */
export type ESignEnvelopeStatus =
  | 'draft'
  | 'awaiting_signers'
  | 'completed'
  | 'declined'
  | 'expired';

export interface ESignSigner {
  employeeId: number;
  role: 'employee' | 'employer' | 'witness';
  status: 'pending' | 'signed' | 'declined';
  signedAt: Date | null;
}

export interface ESignEnvelope {
  id: string;
  documentId: number;
  status: ESignEnvelopeStatus;
  signers: ESignSigner[];
  completedCertificatePath: string | null;
}

/**
 * Future provider. Implementations (Aadhaar eSign OTP, DSC, etc.) register here
 * without changing vault upload or expiry code.
 */
export interface ESignProvider {
  createEnvelope(input: {
    documentId: number;
    signers: { employeeId: number; role: ESignSigner['role'] }[];
  }): Promise<ESignEnvelope>;
  getEnvelope(envelopeId: string): Promise<ESignEnvelope>;
  /** Verify tamper-evident completion certificate; throw if bytes were altered. */
  verifyCompletion(envelopeId: string): Promise<boolean>;
}
