/**
 * Tax Declaration & Proof Verification Service (PAY-13).
 *
 * Manages employee investment declarations under Chapter VI-A (80C, 80D, 80CCD, 80G, etc.),
 * document proof attachments, and payroll admin verification workflow.
 * Authoritative sources: docs/04 §3, docs/10 §6.
 */

import { inTransaction } from '../../../core/db/database.js';
import { writeAudit } from '../../../core/audit/audit.service.js';
import { ConflictError, DomainError, NotFoundError } from '../../../core/errors/index.js';
import { assertEmployeesInScope, type EmployeeScope } from '../../../core/rbac/employee-scope.js';
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
  actorUserId?: number;
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
    financialYear: string,
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
      verifiedAmountPaise:
        r.verified_amount !== null ? fromRupees(Number(r.verified_amount)) : null,
      verifiedBy: r.verified_by,
      verifiedAt: r.verified_at ? new Date(r.verified_at as unknown as string | Date) : null,
      createdAt: new Date(r.created_at as unknown as string | Date),
    }));
  }

  async declareInvestment(
    input: DeclareInvestmentInput,
    scope?: EmployeeScope,
  ): Promise<TaxDeclarationRecord> {
    return inTransaction(this.db, async (db) => {
      if (scope) await assertEmployeesInScope(db, scope, [input.employeeId]);
      await db
        .selectFrom('core.employees')
        .select('id')
        .where('id', '=', input.employeeId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const existing = await db
        .selectFrom('pay.investment_declarations')
        .selectAll()
        .where('employee_id', '=', input.employeeId)
        .where('fy', '=', input.financialYear)
        .where('section', '=', input.section)
        .forUpdate()
        .executeTakeFirst();
      if (existing?.verified_at)
        throw new ConflictError('This declaration is already verified and locked');
      if (input.proofDocumentId) {
        const proof = await db
          .selectFrom('core.documents')
          .select('id')
          .where('id', '=', input.proofDocumentId)
          .where('owner_employee_id', '=', input.employeeId)
          .where('kind', '=', 'tax_proof')
          .where('status', '=', 'active')
          .executeTakeFirst();
        if (!proof) throw new DomainError('Attach an active tax proof owned by this employee');
      }
      const declaredRupees = toRupees(input.declaredAmountPaise).toFixed(2);

      const inserted = await db
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
          }),
        )
        .returningAll()
        .executeTakeFirstOrThrow();

      if (input.actorUserId !== undefined)
        await writeAudit(db, {
          actorUserId: input.actorUserId,
          subjectEmployeeId: input.employeeId,
          action: 'investment_declared',
          entity: 'pay.investment_declarations',
          entityId: inserted.id,
          newValue: JSON.stringify({ section: input.section, amount: declaredRupees }),
        });
      return {
        id: inserted.id,
        employeeId: inserted.employee_id,
        financialYear: inserted.fy,
        section: inserted.section,
        declaredAmountPaise: fromRupees(Number(inserted.declared_amount)),
        proofDocumentId: inserted.proof_document_id,
        verifiedAmountPaise:
          inserted.verified_amount !== null ? fromRupees(Number(inserted.verified_amount)) : null,
        verifiedBy: inserted.verified_by,
        verifiedAt: inserted.verified_at ? new Date(inserted.verified_at) : null,
        createdAt: new Date(inserted.created_at),
      };
    });
  }

  async verifyDeclaration(
    input: VerifyDeclarationInput,
    scope?: EmployeeScope,
  ): Promise<TaxDeclarationRecord> {
    return inTransaction(this.db, async (db) => {
      const target = await db
        .selectFrom('pay.investment_declarations')
        .select('employee_id')
        .where('id', '=', input.declarationId)
        .executeTakeFirst();
      if (!target) throw new NotFoundError('Declaration not found');
      if (scope) await assertEmployeesInScope(db, scope, [target.employee_id]);
      await db
        .selectFrom('core.employees')
        .select('id')
        .where('id', '=', target.employee_id)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const row = await db
        .selectFrom('pay.investment_declarations')
        .selectAll()
        .where('id', '=', input.declarationId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (row.verified_at)
        throw new ConflictError('This declaration is already verified and locked');
      if (input.verifiedAmountPaise > fromRupees(Number(row.declared_amount)))
        throw new DomainError('Verified amount cannot exceed the declared amount');
      if (input.verifiedAmountPaise > 0) {
        const proof =
          row.proof_document_id === null
            ? undefined
            : await db
                .selectFrom('core.documents')
                .select('id')
                .where('id', '=', row.proof_document_id)
                .where('owner_employee_id', '=', row.employee_id)
                .where('kind', '=', 'tax_proof')
                .where('status', '=', 'active')
                .executeTakeFirst();
        if (!proof)
          throw new DomainError(
            'An active tax proof owned by this employee is required for a positive verification',
          );
      }
      const verifiedRupees = toRupees(input.verifiedAmountPaise).toFixed(2);

      const updated = await db
        .updateTable('pay.investment_declarations')
        .set({
          verified_amount: verifiedRupees,
          verified_by: input.verifiedByUserId,
          verified_at: new Date() as unknown as never,
        })
        .where('id', '=', input.declarationId)
        .returningAll()
        .executeTakeFirstOrThrow();

      await writeAudit(db, {
        actorUserId: input.verifiedByUserId,
        subjectEmployeeId: row.employee_id,
        action: 'investment_verified',
        entity: 'pay.investment_declarations',
        entityId: row.id,
        oldValue: row.verified_amount,
        newValue: verifiedRupees,
      });
      return {
        id: updated.id,
        employeeId: updated.employee_id,
        financialYear: updated.fy,
        section: updated.section,
        declaredAmountPaise: fromRupees(Number(updated.declared_amount)),
        proofDocumentId: updated.proof_document_id,
        verifiedAmountPaise:
          updated.verified_amount !== null ? fromRupees(Number(updated.verified_amount)) : null,
        verifiedBy: updated.verified_by,
        verifiedAt: updated.verified_at ? new Date(updated.verified_at) : null,
        createdAt: new Date(updated.created_at),
      };
    });
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
