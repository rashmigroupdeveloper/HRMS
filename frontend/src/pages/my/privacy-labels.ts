/**
 * Pure labels for DPDP ESS surfaces (PRV-02..04, PRV-10).
 * Keep display strings out of the React tree so unit tests pin the vocabulary.
 */

type ConsentPurpose = 'photograph' | 'wellness' | 'bgv' | 'family' | 'alumni';
export type RightsKind = 'access' | 'correction' | 'erasure';
type LawfulBasis = 'employment' | 'consent' | 'legal_obligation';

const CONSENT_PURPOSE_LABEL: Record<ConsentPurpose, string> = {
  photograph: 'Photograph use',
  wellness: 'Wellness & health programmes',
  bgv: 'Background verification',
  family: 'Family / dependant data',
  alumni: 'Alumni contact',
};

const RIGHTS_KIND_LABEL: Record<RightsKind, string> = {
  access: 'Access my data',
  correction: 'Correct my data',
  erasure: 'Erase my data',
};

const LAWFUL_BASIS_LABEL: Record<LawfulBasis, string> = {
  employment: 'Employment',
  consent: 'Consent',
  legal_obligation: 'Legal obligation',
};

export function consentPurposeLabel(purpose: string): string {
  if (purpose in CONSENT_PURPOSE_LABEL) {
    return CONSENT_PURPOSE_LABEL[purpose as ConsentPurpose];
  }
  return purpose;
}

export function rightsKindLabel(kind: string): string {
  if (kind in RIGHTS_KIND_LABEL) {
    return RIGHTS_KIND_LABEL[kind as RightsKind];
  }
  return kind;
}

export function lawfulBasisLabel(basis: string): string {
  if (basis in LAWFUL_BASIS_LABEL) {
    return LAWFUL_BASIS_LABEL[basis as LawfulBasis];
  }
  return basis;
}

/** Retention in plain language — "2 years" beats "730 days" for a person. */
export function retentionLabel(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return 'Not set';
  if (days % 365 === 0) {
    const years = days / 365;
    return years === 1 ? '1 year' : `${String(years)} years`;
  }
  if (days % 30 === 0) {
    const months = days / 30;
    return months === 1 ? '1 month' : `${String(months)} months`;
  }
  return days === 1 ? '1 day' : `${String(days)} days`;
}
