/** CLM-04: independent reimbursement payment lifecycle, never a salary run/input. */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { inTransaction } from '../../core/db/database.js';
import {
  assertEmployeesInScope,
  employeeScopeSql,
  type EmployeeScope,
} from '../../core/rbac/employee-scope.js';
import { ConflictError, DomainError, NotFoundError } from '../../core/errors/index.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { add, paise, parseRupees, decimalRupees } from '../../core/money/index.js';
import { createDocument, readDocument } from '../../core/storage/documents.js';
import { csvCell } from '../../core/bulk/index.js';

export async function eligibleClaims(db: Kysely<Database>, scope: EmployeeScope) {
  const rows = await db
    .selectFrom('pay.claims as c')
    .innerJoin('core.employees as e', 'e.id', 'c.employee_id')
    .innerJoin('core.companies as co', 'co.id', 'e.company_id')
    .innerJoin('wf.requests as w', 'w.id', 'c.workflow_request_id')
    .select([
      'c.id',
      'c.employee_id',
      'e.ecode',
      'e.first_name',
      'e.last_name',
      'co.id as companyId',
      'co.name as companyName',
      'c.approved_amount',
    ])
    .where(employeeScopeSql(scope, 'e'))
    .where('c.status', '=', 'approved')
    .where('w.status', '=', 'approved')
    .where('w.definition_code', '=', 'claim')
    .whereRef('w.subject_employee_id', '=', 'c.employee_id')
    .where('c.reimbursement_batch_id', 'is', null)
    .where('c.paid_in_run_id', 'is', null)
    .where('c.paid_in_batch_id', 'is', null)
    .where('c.advance_loan_id', 'is', null)
    .orderBy('c.id', 'desc')
    .limit(500)
    .execute();
  return rows.map((r) => ({
    claimId: r.id,
    employeeId: r.employee_id,
    ecode: r.ecode,
    name: [r.first_name, r.last_name].filter(Boolean).join(' '),
    companyId: r.companyId,
    companyName: r.companyName,
    amountRupees: Number(r.approved_amount ?? 0),
  }));
}
export async function createReimbursementBatch(
  db: Kysely<Database>,
  claimIds: number[],
  userId: number,
  scope: EmployeeScope,
) {
  if (new Set(claimIds).size !== claimIds.length) throw new DomainError('Select each claim once');
  return inTransaction(db, async (trx) => {
    const targets = await trx
      .selectFrom('pay.claims')
      .select(['id', 'employee_id'])
      .where('id', 'in', claimIds)
      .execute();
    if (targets.length !== claimIds.length) throw new NotFoundError('A selected claim is missing');
    const employees = [...new Set(targets.map((t) => t.employee_id))].sort((a, b) => a - b);
    await assertEmployeesInScope(trx, scope, employees);
    await trx
      .selectFrom('core.employees')
      .select('id')
      .where('id', 'in', employees)
      .orderBy('id')
      .forUpdate()
      .execute();
    await assertEmployeesInScope(trx, scope, employees);
    const claims = await trx
      .selectFrom('pay.claims as c')
      .innerJoin('core.employees as e', 'e.id', 'c.employee_id')
      .selectAll('c')
      .select('e.company_id')
      .where('c.id', 'in', claimIds)
      .orderBy('c.id')
      .forUpdate('c')
      .execute();
    const companyId = claims[0]?.company_id;
    if (!companyId) throw new DomainError('Select approved claims');

    const workflowRequestIds = claims
      .map((c) => c.workflow_request_id)
      .filter((id): id is number => id !== null);

    const validRequests = workflowRequestIds.length > 0
      ? await trx
          .selectFrom('wf.requests')
          .select(['id', 'subject_employee_id'])
          .where('id', 'in', workflowRequestIds)
          .where('definition_code', '=', 'claim')
          .where('status', '=', 'approved')
          .execute()
      : [];
    const validRequestByPair = new Set(
      validRequests.map((r) => `${String(r.id)}:${String(r.subject_employee_id)}`),
    );

    let total = paise(0);
    for (const c of claims) {
      if (c.company_id !== companyId)
        throw new DomainError('Create a separate reimbursement batch for each company');
      if (
        c.status !== 'approved' ||
        c.reimbursement_batch_id !== null ||
        c.paid_in_run_id !== null ||
        c.paid_in_batch_id !== null
      )
        throw new ConflictError('A selected claim is already reserved, paid or not approved');
      if (c.advance_loan_id)
        throw new ConflictError(
          'Complete the travel-wallet settlement before a separate reimbursement payment',
        );
      if (
        c.workflow_request_id === null ||
        !validRequestByPair.has(`${String(c.workflow_request_id)}:${String(c.employee_id)}`)
      )
        throw new ConflictError('A selected claim has no completed approval-chain evidence');
      const amount = parseRupees(c.approved_amount ?? '0');
      if (amount <= 0) throw new DomainError('A payment must have a positive approved amount');
      total = add(total, amount);
    }
    const batch = await trx
      .insertInto('pay.reimbursement_batches')
      .values({ company_id: companyId, total_amount: decimalRupees(total), created_by: userId })
      .returning('id')
      .executeTakeFirstOrThrow();
    await trx
      .insertInto('pay.reimbursement_batch_items')
      .values(
        claims.map((c) => ({
          batch_id: batch.id,
          claim_id: c.id,
          employee_id: c.employee_id,
          amount: c.approved_amount ?? '0',
        })),
      )
      .execute();
    await trx
      .updateTable('pay.claims')
      .set({ reimbursement_batch_id: batch.id })
      .where('id', 'in', claimIds)
      .execute();
    await writeAudit(trx, {
      actorUserId: userId,
      action: 'reimbursement_batch_created',
      entity: 'pay.reimbursement_batches',
      entityId: batch.id,
      newValue: JSON.stringify({ claimIds, total: decimalRupees(total) }),
    });
    return { id: batch.id };
  });
}
async function scopedBatch(db: Kysely<Database>, id: number, scope: EmployeeScope) {
  const batch = await db
    .selectFrom('pay.reimbursement_batches')
    .selectAll()
    .where('id', '=', id)
    .forUpdate()
    .executeTakeFirst();
  if (!batch) throw new NotFoundError('Reimbursement batch not found');
  const items = await db
    .selectFrom('pay.reimbursement_batch_items')
    .selectAll()
    .where('batch_id', '=', id)
    .orderBy('id')
    .execute();
  if (items.length === 0) throw new ConflictError('Reimbursement batch has no items');
  const total = items.reduce((sum, item) => add(sum, parseRupees(item.amount)), paise(0));
  if (total !== parseRupees(batch.total_amount))
    throw new ConflictError('Reimbursement item total differs from batch total');
  await assertEmployeesInScope(
    db,
    scope,
    items.map((i) => i.employee_id),
  );
  return { batch, items };
}
async function validateReservations(
  db: Kysely<Database>,
  id: number,
  items: Awaited<ReturnType<typeof scopedBatch>>['items'],
) {
  const claims = await db
    .selectFrom('pay.claims')
    .select(['id', 'employee_id', 'status', 'approved_amount', 'reimbursement_batch_id'])
    .where(
      'id',
      'in',
      items.map((i) => i.claim_id),
    )
    .orderBy('id')
    .forUpdate()
    .execute();
  if (
    claims.length !== items.length ||
    claims.some((c) => {
      const item = items.find((i) => i.claim_id === c.id);
      return (
        c.employee_id !== item?.employee_id ||
        c.status !== 'approved' ||
        c.reimbursement_batch_id !== id ||
        parseRupees(c.approved_amount ?? '0') !== parseRupees(item.amount)
      );
    })
  )
    throw new ConflictError(
      'Claim reservation or approved amount changed; reconcile the payment before confirmation',
    );
  return claims;
}
export async function listReimbursementBatches(db: Kysely<Database>, scope: EmployeeScope) {
  const allowed = employeeScopeSql(scope, 'e');
  const rows = await db
    .selectFrom('pay.reimbursement_batches as b')
    .innerJoin('core.companies as co', 'co.id', 'b.company_id')
    .select([
      'b.id',
      'b.company_id',
      'co.name',
      'b.status',
      'b.total_amount',
      'b.payment_reference',
    ])
    .where(
      sql<boolean>`NOT EXISTS(SELECT 1 FROM pay.reimbursement_batch_items i JOIN core.employees e ON e.id=i.employee_id WHERE i.batch_id=b.id AND (${allowed}) IS NOT TRUE)`,
    )
    .orderBy('b.id', 'desc')
    .limit(100)
    .execute();
  return rows.map((r) => ({
    id: r.id,
    companyId: r.company_id,
    companyName: r.name,
    status: r.status,
    totalRupees: Number(r.total_amount),
    paymentReference: r.payment_reference,
  }));
}
export async function reimbursementBankFile(
  db: Kysely<Database>,
  id: number,
  userId: number,
  scope: EmployeeScope,
) {
  return inTransaction(db, async (trx) => {
    const { batch, items } = await scopedBatch(trx, id, scope);
    if (batch.status === 'cancelled')
      throw new ConflictError('This reimbursement batch was cancelled');
    let documentId = batch.bank_document_id;
    if (documentId === null) {
      if (batch.status !== 'draft')
        throw new ConflictError('Prepared reimbursement bank artifact is missing');
      await validateReservations(trx, id, items);
      const rows = await trx
        .selectFrom('core.employees')
        .select(['id', 'ecode', 'first_name', 'last_name', 'bank_account', 'bank_ifsc'])
        .where(
          'id',
          'in',
          items.map((i) => i.employee_id),
        )
        .execute();
      const totals = new Map<number, ReturnType<typeof paise>>();
      for (const item of items)
        totals.set(
          item.employee_id,
          add(totals.get(item.employee_id) ?? paise(0), parseRupees(item.amount)),
        );
      const lines = ['employee_code,beneficiary,account_number,ifsc,amount,reference'];
      for (const row of rows) {
        if (
          !/^\d{9,18}$/.test(row.bank_account ?? '') ||
          !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(row.bank_ifsc ?? '')
        )
          throw new DomainError(
            `Complete valid bank details for ${row.ecode} before preparing payment`,
          );
        lines.push(
          [
            row.ecode,
            [row.first_name, row.last_name].filter(Boolean).join(' '),
            row.bank_account,
            row.bank_ifsc,
            decimalRupees(totals.get(row.id) ?? paise(0)),
            `REIMB-${String(id)}`,
          ]
            .map((v) => csvCell(v ?? ''))
            .join(','),
        );
      }
      documentId = await createDocument(trx, {
        ownerEmployeeId: null,
        kind: 'reimbursement_bank',
        originalName: `reimbursement-${String(id)}.csv`,
        mime: 'text/csv',
        content: lines.join('\r\n'),
        uploadedBy: userId,
      });
      await trx
        .updateTable('pay.reimbursement_batches')
        .set({ status: 'prepared', bank_document_id: documentId })
        .where('id', '=', id)
        .execute();
    }
    await writeAudit(trx, {
      actorUserId: userId,
      action: 'reimbursement_bank_downloaded',
      entity: 'pay.reimbursement_batches',
      entityId: id,
      newValue: 'Separate reimbursement bank export',
    });
    const doc = await readDocument(trx, documentId);
    return { filename: doc.originalName, mime: doc.mime, base64: doc.content.toString('base64') };
  });
}
export async function markReimbursementPaid(
  db: Kysely<Database>,
  id: number,
  reference: string,
  userId: number,
  scope: EmployeeScope,
) {
  return inTransaction(db, async (trx) => {
    const { batch, items } = await scopedBatch(trx, id, scope);
    if (batch.status !== 'prepared' || batch.bank_document_id === null)
      throw new ConflictError(
        'Prepare the separate reimbursement bank file before confirming payment',
      );
    if (reference.trim().length < 3)
      throw new DomainError('Enter the reimbursement transfer reference');
    const claims = await validateReservations(trx, id, items);
    await trx
      .updateTable('pay.claims')
      .set({ status: 'paid' })
      .where(
        'id',
        'in',
        claims.map((c) => c.id),
      )
      .execute();
    await trx
      .updateTable('pay.reimbursement_batches')
      .set({
        status: 'paid',
        paid_by: userId,
        paid_at: new Date(),
        payment_reference: reference.trim(),
      })
      .where('id', '=', id)
      .execute();
    for (const c of claims)
      await writeAudit(trx, {
        actorUserId: userId,
        subjectEmployeeId: c.employee_id,
        action: 'claim_paid_by_reimbursement',
        entity: 'pay.claims',
        entityId: c.id,
        oldValue: 'approved',
        newValue: JSON.stringify({ batchId: id, reference: reference.trim() }),
      });
    await writeAudit(trx, {
      actorUserId: userId,
      action: 'reimbursement_batch_paid',
      entity: 'pay.reimbursement_batches',
      entityId: id,
      newValue: reference.trim(),
    });
    return { success: true };
  });
}
