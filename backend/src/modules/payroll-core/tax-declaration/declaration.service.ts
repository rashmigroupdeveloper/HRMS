/**
 * Tax Declaration & Proof Verification Service (PAY-13).
 *
 * Manages employee investment declarations under Chapter VI-A (80C, 80D, 80CCD, 80G, etc.),
 * document proof attachments, and payroll admin verification workflow.
 * Authoritative sources: docs/04 §3, docs/10 §6.
 */

import { type Kysely } from 'kysely';
import { type Database } from '../../../core/db/types.js';
import { type Paise, paise, fromRupees, toRupees } from '../../../core/money/money.js';

export interface TaxDeclarationRecord {
  id: number;
  employeeId: number;
  financialYear: string;
  section: string;
  declaredAmountPaise: Paise;
  proofDocumentId: number | null;
  verifiedAmountPaise: Paise | null;
  verifiedBy: number | null;
  verifiedAt: Date | null;
  createdAt: Date;
}

export interface DeclareInvestmentInput {
  employeeId: number;
  financialYear: string;
  section: string;
  declaredAmountPaise: Paise;
  proofDocumentId?: number | null | undefined;
}

export interface VerifyDeclarationInput {
  declarationId: number;
  verifiedAmountPaise: Paise;
  verifiedByUserId: number;
}

export class TaxDeclarationService {
  constructor(private readonly db: Kysely<Database>) {}

  async listEmployeeDeclarations(
    employeeId: number,
    financialYear: string
  ): Promise<TaxDeclarationRecord[]> {
    const rows = await this.db
      .selectFrom('pay.investment_declarations')
      .selectAll()
      .where('employee_id', '=', employeeId)
      .where('fy', '=', financialYear)
      .orderBy('section', 'asc')
      .execute();

    return rows.map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      financialYear: r.fy,
      section: r.section,
      declaredAmountPaise: fromRupees(Number(r.declared_amount)),
      proofDocumentId: r.proof_document_id,
      verifiedAmountPaise: r.verified_amount !== null ? fromRupees(Number(r.verified_amount)) : null,
      verifiedBy: r.verified_by,
      verifiedAt: r.verified_at ? new Date(r.verified_at as unknown as string | Date) : null,
      createdAt: new Date(r.created_at as unknown as string | Date),
    }));
  }

  async declareInvestment(input: DeclareInvestmentInput): Promise<TaxDeclarationRecord> {
    const declaredRupees = toRupees(input.declaredAmountPaise).toFixed(2);

    const inserted = await this.db
      .insertInto('pay.investment_declarations')
      .values({
        employee_id: input.employeeId,
        fy: input.financialYear,
        section: input.section,
        declared_amount: declaredRupees,
        proof_document_id: input.proofDocumentId ?? null,
      })
      .onConflict((oc) =>
        oc.columns(['employee_id', 'fy', 'section']).doUpdateSet({
          declared_amount: declaredRupees,
          proof_document_id: input.proofDocumentId ?? null,
        })
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: inserted.id,
      employeeId: inserted.employee_id,
      financialYear: inserted.fy,
      section: inserted.section,
      declaredAmountPaise: fromRupees(Number(inserted.declared_amount)),
      proofDocumentId: inserted.proof_document_id,
      verifiedAmountPaise: inserted.verified_amount !== null ? fromRupees(Number(inserted.verified_amount)) : null,
      verifiedBy: inserted.verified_by,
      verifiedAt: inserted.verified_at ? new Date(inserted.verified_at) : null,
      createdAt: new Date(inserted.created_at),
    };
  }

  async verifyDeclaration(input: VerifyDeclarationInput): Promise<TaxDeclarationRecord> {
    const verifiedRupees = toRupees(input.verifiedAmountPaise).toFixed(2);

    const updated = await this.db
      .updateTable('pay.investment_declarations')
      .set({
        verified_amount: verifiedRupees,
        verified_by: input.verifiedByUserId,
        verified_at: new Date() as unknown as never,
      })
      .where('id', '=', input.declarationId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: updated.id,
      employeeId: updated.employee_id,
      financialYear: updated.fy,
      section: updated.section,
      declaredAmountPaise: fromRupees(Number(updated.declared_amount)),
      proofDocumentId: updated.proof_document_id,
      verifiedAmountPaise: updated.verified_amount !== null ? fromRupees(Number(updated.verified_amount)) : null,
      verifiedBy: updated.verified_by,
      verifiedAt: updated.verified_at ? new Date(updated.verified_at) : null,
      createdAt: new Date(updated.created_at),
    };
  }

  async getTotalVerifiedDeductions(employeeId: number, financialYear: string): Promise<Paise> {
    const rows = await this.listEmployeeDeclarations(employeeId, financialYear);
    let total = 0;
    for (const r of rows) {
      // Use verified amount if verified, otherwise zero or declared depending on cutoff
      const effective = r.verifiedAmountPaise ?? paise(0);
      total += effective;
    }
    return paise(total);
  }
}
