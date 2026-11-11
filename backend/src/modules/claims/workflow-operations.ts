/** CLM-02/03 and M13: authoritative reimbursement workflow entry and final effects. */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { inTransaction } from '../../core/db/database.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import {
  ConflictError,
  DomainError,
  NotFoundError,
  ForbiddenError,
} from '../../core/errors/index.js';
import { parseRupees, decimalRupees, add, paise } from '../../core/money/index.js';
import { assertEmployeesInScope, type EmployeeScope } from '../../core/rbac/employee-scope.js';
import {
  createRequest,
  assertCurrentApprover,
  act,
  onWorkflowFinal,
  type RequestRow,
  type WorkflowFinalStatus,
} from '../workflows/index.js';
import { ClaimsService, type SubmitClaimParams, type DecideClaimParams } from './claims.service.js';

export async function submitRoutedClaim(
  db: Kysely<Database>,
  input: SubmitClaimParams,
  userId: number,
) {
  if (input.periodFrom > input.periodTo)
    throw new DomainError('Claim period end must be on or after its start');
  if (new Set(input.bills.map((b) => b.documentId)).size !== input.bills.length)
    throw new DomainError('Use a distinct receipt for each bill');
  let result = { claimId: 0, totalClaimedRupees: 0 };
  const requestId = await createRequest(
    db,
    {
      definitionCode: 'claim',
      subjectEmployeeId: input.employeeId,
      requestedByUserId: userId,
      payload: {
        claimTypeCode: input.claimTypeCode,
        periodFrom: input.periodFrom,
        periodTo: input.periodTo,
      },
    },
    async (trx, id) => {
      const employee = await trx
        .selectFrom('core.employees')
        .select('status')
        .where('id', '=', input.employeeId)
        .executeTakeFirstOrThrow();
      if (!['active', 'on_notice'].includes(employee.status))
        throw new DomainError('Only active employees may submit claims');
      const type = await trx
        .selectFrom('pay.claim_types')
        .select('id')
        .where('code', '=', input.claimTypeCode)
        .where('is_active', '=', true)
        .executeTakeFirst();
      if (!type) throw new DomainError('Choose an active reimbursement type');
      for (const bill of input.bills) {
        parseRupees(String(bill.amountRupees));
        const doc = await trx
          .selectFrom('core.documents')
          .select('id')
          .where('id', '=', bill.documentId)
          .where('owner_employee_id', '=', input.employeeId)
          .where('status', '=', 'active')
          .where('kind', '=', 'claim_bill')
          .executeTakeFirst();
        if (!doc) throw new DomainError('Attach an active receipt owned by you for each bill');
      }
      if (input.advanceLoanId) {
        const advance = await trx
          .selectFrom('pay.loans')
          .select('id')
          .where('id', '=', input.advanceLoanId)
          .where('employee_id', '=', input.employeeId)
          .where('loan_type', '=', 'travel_advance')
          .where('status', '=', 'active')
          .executeTakeFirst();
        if (!advance) throw new DomainError('Choose your own active travel advance');
      }
      result = await new ClaimsService(trx).submitClaim({ ...input, workflowRequestId: id });
      await trx
        .updateTable('wf.requests')
        .set({
          payload: JSON.stringify({
            claimId: result.claimId,
            claimTypeCode: input.claimTypeCode,
            periodFrom: input.periodFrom,
            periodTo: input.periodTo,
            totalClaimedRupees: result.totalClaimedRupees,
          }),
        })
        .where('id', '=', id)
        .execute();
      await writeAudit(trx, {
        actorUserId: userId,
        subjectEmployeeId: input.employeeId,
        action: 'claim_submitted',
        entity: 'pay.claims',
        entityId: result.claimId,
        newValue: JSON.stringify({ requestId: id, amount: result.totalClaimedRupees }),
      });
    },
  );
  return { ...result, requestId };
}

export async function decideRoutedClaim(
  db: Kysely<Database>,
  input: DecideClaimParams,
  scope: EmployeeScope,
  verificationScope?: EmployeeScope,
) {
  return inTransaction(db, async (trx) => {
    const target = await trx
      .selectFrom('pay.claims')
      .select(['employee_id', 'workflow_request_id'])
      .where('id', '=', input.claimId)
      .executeTakeFirst();
    if (!target) throw new NotFoundError('Claim not found');
    await assertEmployeesInScope(trx, scope, [target.employee_id]);
    await trx
      .selectFrom('core.employees')
      .select('id')
      .where('id', '=', target.employee_id)
      .forUpdate()
      .executeTakeFirstOrThrow();
    const claim = await trx
      .selectFrom('pay.claims')
      .selectAll()
      .where('id', '=', input.claimId)
      .forUpdate()
      .executeTakeFirstOrThrow();
    if (!['pending', 'verified'].includes(claim.status))
      throw new ConflictError('This claim has already reached a final decision');
    if (!claim.workflow_request_id)
      throw new ConflictError(
        'This legacy claim has no approval chain; HR must reconcile its routing before a decision',
      );
    await assertCurrentApprover(trx, claim.workflow_request_id, input.decidedByUserId);
    const requested =
      input.approvedAmountRupees === undefined
        ? parseRupees(claim.approved_amount ?? claim.claimed_amount)
        : parseRupees(String(input.approvedAmountRupees));
    const ceiling = parseRupees(claim.approved_amount ?? claim.claimed_amount);
    if (requested < 0 || requested > ceiling)
      throw new DomainError(
        'Approved amount cannot exceed the claimed amount or an earlier partial approval',
      );
    if (input.action === 'partially_approve' && (requested <= 0 || !input.rejectionReason?.trim()))
      throw new DomainError('Partial approval needs a positive amount and an explanation');
    if (input.action === 'reject' && !input.rejectionReason?.trim())
      throw new DomainError('A rejection reason is required');
    const existingBills = await trx
      .selectFrom('pay.claim_bills')
      .select(['id', 'verified'])
      .where('claim_id', '=', claim.id)
      .execute();
    const billIds = existingBills.map((b) => b.id);
    if ((input.billVerifications ?? []).some((b) => !billIds.includes(b.billId)))
      throw new DomainError('Bill does not belong to this claim');
    const changesVerification = (input.billVerifications ?? []).some(
      (b) => existingBills.find((existing) => existing.id === b.billId)?.verified !== b.verified,
    );
    if (changesVerification) {
      if (!verificationScope)
        throw new ForbiddenError('Receipt verification requires delegated claims.verify authority');
      await assertEmployeesInScope(trx, verificationScope, [claim.employee_id]);
    }
    for (const bill of input.billVerifications ?? [])
      await trx
        .updateTable('pay.claim_bills')
        .set({ verified: bill.verified, verified_by: input.decidedByUserId })
        .where('id', '=', bill.billId)
        .where('claim_id', '=', claim.id)
        .execute();
    await trx
      .updateTable('pay.claims')
      .set({
        approved_amount: decimalRupees(requested),
        rejection_reason: input.rejectionReason ?? claim.rejection_reason,
      })
      .where('id', '=', claim.id)
      .execute();
    await act(trx, {
      requestId: claim.workflow_request_id,
      actorUserId: input.decidedByUserId,
      action: input.action === 'reject' ? 'reject' : 'approve',
      comment: input.rejectionReason,
    });
    await writeAudit(trx, {
      actorUserId: input.decidedByUserId,
      subjectEmployeeId: claim.employee_id,
      action: 'claim_decision_details',
      entity: 'pay.claims',
      entityId: claim.id,
      oldValue: JSON.stringify({
        approvedAmount: claim.approved_amount,
        verification: existingBills,
      }),
      newValue: JSON.stringify({
        approvedAmount: decimalRupees(requested),
        verification: input.billVerifications ?? [],
        action: input.action,
      }),
    });
    const after = await trx
      .selectFrom('pay.claims')
      .select(['status', 'approved_amount'])
      .where('id', '=', claim.id)
      .executeTakeFirstOrThrow();
    return { status: after.status, approvedAmountRupees: Number(after.approved_amount ?? 0) };
  });
}

async function applyClaimFinal(
  db: Kysely<Database>,
  request: RequestRow,
  status: WorkflowFinalStatus,
) {
  const claim = await db
    .selectFrom('pay.claims')
    .selectAll()
    .where('workflow_request_id', '=', request.id)
    .where('employee_id', '=', request.subject_employee_id)
    .forUpdate()
    .executeTakeFirst();
  if (!claim) throw new DomainError('The claim linked to this workflow is missing');
  if (!['pending', 'verified'].includes(claim.status))
    throw new ConflictError('Claim has already reached a final decision');
  if (status === 'approved') {
    const type =
      claim.claim_type_id === null
        ? undefined
        : await db
            .selectFrom('pay.claim_types')
            .select('bill_required')
            .where('id', '=', claim.claim_type_id)
            .executeTakeFirst();
    const verified = await db
      .selectFrom('pay.claim_bills')
      .select('amount')
      .where('claim_id', '=', claim.id)
      .where('verified', '=', true)
      .execute();
    const substantiated = verified.reduce(
      (total, bill) => add(total, parseRupees(bill.amount)),
      paise(0),
    );
    if (
      type?.bill_required &&
      substantiated < parseRupees(claim.approved_amount ?? claim.claimed_amount)
    )
      throw new ConflictError(
        'Verify enough bill evidence to cover the approved amount before final approval',
      );
  }
  await db
    .updateTable('pay.claims')
    .set({
      status: status === 'approved' ? 'approved' : 'rejected',
      approved_amount:
        status === 'approved' ? (claim.approved_amount ?? claim.claimed_amount) : '0.00',
      decided_at: new Date(),
    })
    .where('id', '=', claim.id)
    .execute();
}
let registered = false;
export function registerClaimsWorkflowHooks() {
  if (registered) return;
  registered = true;
  onWorkflowFinal('claim', applyClaimFinal);
}
