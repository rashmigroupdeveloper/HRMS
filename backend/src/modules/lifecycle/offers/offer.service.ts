/**
 * SOW 3.1: an offer or letter of intent is drafted, checked against its CTC
 * breakup, and routed on offer_approval. Approval creates the pre-join
 * candidate. Rejection does not.
 */
import { z } from 'zod';
import type { Kysely, Transaction } from 'kysely';
import type { Database } from '../../../core/db/types.js';
import { writeAudit } from '../../../core/audit/audit.service.js';
import { cleanMasterLabel } from '../../../core/validation/master-text.js';
import { createRequest, type RequestRow, type WorkflowFinalStatus } from '../../workflows/index.js';
import { OnboardingService, type IngestCandidateInput } from '../onboarding/onboarding.service.js';

type Db = Kysely<Database> | Transaction<Database>;

const lineSchema = z.object({
  code: z.string().min(1),
  annualRupees: z.number().nonnegative(),
});

export const offerPayloadSchema = z.object({
  kind: z.enum(['offer', 'loi']),
  fullName: z.string().min(1),
  personalEmail: z.string().email(),
  mobile: z.string().min(8).max(15),
  positionTitle: z.string().min(1),
  designation: z.string().optional(),
  department: z.string().optional(),
  companyId: z.number().int().positive().optional(),
  offeredCtc: z.number().positive(),
  breakupAnnual: z.array(lineSchema).min(1),
  probationMonths: z.number().int().min(0).max(24).optional(),
  probationSalaryPct: z.number().positive().max(100).optional(),
  proposedDoj: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  offerDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type OfferPayload = z.infer<typeof offerPayloadSchema>;

/** CTC must equal the annual breakup. Half a rupee is rounding dust. */
export function assertCtcBreakup(annualRupees: number, lines: readonly { annualRupees: number }[]): void {
  const sum = lines.reduce((total, line) => total + line.annualRupees, 0);
  if (Math.abs(sum - annualRupees) > 0.5) {
    throw new Error(`CTC ${annualRupees.toFixed(2)} does not match the breakup total ${sum.toFixed(2)}`);
  }
}

export function renderOfferLetter(input: OfferPayload): string {
  const lines = input.breakupAnnual.map((line) => `${line.code}: ${line.annualRupees.toFixed(2)}`).join('\n');
  const title = input.kind === 'loi' ? 'Letter of intent' : 'Offer of employment';
  return [
    title,
    `Name: ${input.fullName}`,
    `Role: ${input.positionTitle}`,
    `Date: ${input.offerDate}`,
    `Proposed joining: ${input.proposedDoj}`,
    `Annual CTC: ${input.offeredCtc.toFixed(2)}`,
    'Breakup:',
    lines,
    `Probation: ${String(input.probationMonths ?? 6)} months at ${String(input.probationSalaryPct ?? 100)}% of CTC.`,
  ].join('\n');
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') return JSON.parse(value) as Record<string, unknown>;
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  throw new Error('Offer payload is missing');
}

export async function submitOffer(
  db: Kysely<Database>,
  params: { actorUserId: number; subjectEmployeeId: number; input: OfferPayload },
): Promise<{ requestId: number; letter: string }> {
  const designation = params.input.designation ? cleanMasterLabel(params.input.designation) : undefined;
  const department = params.input.department ? cleanMasterLabel(params.input.department) : undefined;
  const input: OfferPayload = {
    ...params.input,
    ...(designation ? { designation } : {}),
    ...(department ? { department } : {}),
  };
  assertCtcBreakup(input.offeredCtc, input.breakupAnnual);
  const letter = renderOfferLetter(input);
  const requestId = await createRequest(db, {
    definitionCode: 'offer_approval',
    subjectEmployeeId: params.subjectEmployeeId,
    requestedByUserId: params.actorUserId,
    payload: { ...input, letter },
  });
  await writeAudit(db, {
    actorUserId: params.actorUserId,
    action: 'create',
    entity: 'wf.requests',
    entityId: requestId,
    newValue: JSON.stringify({ kind: input.kind, fullName: input.fullName, offeredCtc: input.offeredCtc }),
  });
  return { requestId, letter };
}

/** Approval opens the pre-join record. The letter reference is the request id. */
export async function applyOfferOnFinal(
  db: Db,
  request: RequestRow,
  status: WorkflowFinalStatus,
): Promise<void> {
  if (status !== 'approved') return;
  const input = offerPayloadSchema.parse(asRecord(request.payload));
  const candidate: IngestCandidateInput = {
    loiReference: `${input.kind.toUpperCase()}-${String(request.id)}`,
    fullName: input.fullName,
    personalEmail: input.personalEmail,
    mobile: input.mobile,
    positionTitle: input.positionTitle,
    designation: input.designation ?? null,
    department: input.department ?? null,
    companyId: input.companyId ?? null,
    offeredCtc: input.offeredCtc,
    proposedDoj: input.proposedDoj,
    offerDate: input.offerDate,
    ...(input.probationMonths !== undefined ? { probationMonths: input.probationMonths } : {}),
    ...(input.probationSalaryPct !== undefined ? { probationSalaryPct: input.probationSalaryPct } : {}),
  };
  const created = await OnboardingService.ingestCandidate(db, candidate);
  await writeAudit(db, {
    actorUserId: request.requested_by,
    action: 'offer_approved',
    entity: 'core.onboarding_candidates',
    entityId: created.candidateId,
    newValue: candidate.loiReference ?? null,
  });
}
