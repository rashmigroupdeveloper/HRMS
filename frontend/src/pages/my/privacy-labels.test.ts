import { describe, expect, it } from 'vitest';
import {
  consentPurposeLabel,
  lawfulBasisLabel,
  retentionLabel,
  rightsKindLabel,
} from './privacy-labels';

describe('privacy-labels', () => {
  it('names every consent purpose in plain language', () => {
    expect(consentPurposeLabel('photograph')).toBe('Photograph use');
    expect(consentPurposeLabel('wellness')).toBe('Wellness & health programmes');
    expect(consentPurposeLabel('bgv')).toBe('Background verification');
    expect(consentPurposeLabel('family')).toBe('Family / dependant data');
    expect(consentPurposeLabel('alumni')).toBe('Alumni contact');
  });

  it('falls back to the raw code for unknown purposes', () => {
    expect(consentPurposeLabel('newsletter')).toBe('newsletter');
  });

  it('labels rights kinds the way the form shows them', () => {
    expect(rightsKindLabel('access')).toBe('Access my data');
    expect(rightsKindLabel('correction')).toBe('Correct my data');
    expect(rightsKindLabel('erasure')).toBe('Erase my data');
  });

  it('labels lawful bases for the processing register', () => {
    expect(lawfulBasisLabel('employment')).toBe('Employment');
    expect(lawfulBasisLabel('consent')).toBe('Consent');
    expect(lawfulBasisLabel('legal_obligation')).toBe('Legal obligation');
  });

  it('renders retention in years or months when the count divides cleanly', () => {
    expect(retentionLabel(365)).toBe('1 year');
    expect(retentionLabel(730)).toBe('2 years');
    expect(retentionLabel(30)).toBe('1 month');
    expect(retentionLabel(90)).toBe('3 months');
    expect(retentionLabel(45)).toBe('45 days');
    expect(retentionLabel(0)).toBe('Not set');
  });
});
