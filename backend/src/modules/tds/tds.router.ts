/** TDS compliance API (handover item 3). ESS under /tax/me/*; payroll under /tax/* (company scope enforced). */
import { z } from 'zod';
import { createDocument } from '../../core/storage/documents.js';
import { authed, withPermission } from '../../api/orpc.js';
import { companiesInScope, requireCompanyInScope } from '../../core/rbac/company-scope.js';
import { assertEmployeesInScope } from '../../core/rbac/employee-scope.js';
import { DomainError, NotFoundError } from '../../core/errors/index.js';
import { istDateString } from '../../core/dates.js';
import { renderForm16Pdf } from './form16-pdf.js';
import {
  DECLARATION_SECTIONS, addChallan, deleteChallan, form16, form24q, form24qCsv, fyLabel, listChallans, myDeclarations, reconcile, setMyRegime, upsertMyDeclaration,
} from './tds.service.js';

const fy = z.string().regex(/^\d{4}-\d{2}$/).refine((v) => (Number(v.slice(0, 4)) + 1) % 100 === Number(v.slice(5)), 'FY must look like 2026-27');
const fileOut = z.object({ filename: z.string(), base64: z.string() });
const json = z.record(z.string(), z.unknown());

function own(employeeId: number | null): number {
  if (employeeId === null) throw new NotFoundError('No employee profile is linked to your account');
  return employeeId;
}

export const tdsRouter = {
  myDeclarations: authed
    .route({ method: 'GET', path: '/tax/me/declarations', summary: 'My investment declarations, regime and window status' })
    .input(z.object({ fy: fy.optional() }).optional())
    .output(json)
    .handler(async ({ input, context }) => myDeclarations(context.db, own(context.user.employee_id), input?.fy ?? fyLabel(istDateString()))),
  declare: authed
    .route({ method: 'POST', path: '/tax/me/declarations', summary: 'Declare (or attach proof for) an investment section' })
    .input(z.object({ fy, section: z.enum(Object.keys(DECLARATION_SECTIONS) as [string, ...string[]]), amountRupees: z.number().min(0).max(10_000_000), proofDocumentId: z.number().int().positive().nullable().optional() }))
    .output(z.object({ id: z.number() }))
    .handler(({ input, context }) => upsertMyDeclaration(context.db, { employeeId: own(context.user.employee_id), ...input, actorUserId: context.user.id })),
  uploadProof: authed
    .route({ method: 'POST', path: '/tax/me/proofs', summary: 'Upload an investment proof (PDF/JPG/PNG, max 5 MB) owned by me' })
    .input(z.object({ filename: z.string().min(1).max(200), base64: z.string().min(1).max(7_000_000) }))
    .output(z.object({ documentId: z.number() }))
    .handler(async ({ input, context }) => {
      const employeeId = own(context.user.employee_id);
      const ext = (/\.(pdf|jpe?g|png)$/i.exec(input.filename)?.[1] ?? '').toLowerCase();
      if (!ext) throw new DomainError('Proof must be a PDF, JPG or PNG');
      const content = Buffer.from(input.base64, 'base64');
      if (content.length === 0 || content.length > 5 * 1024 * 1024) throw new DomainError('Proof must be between 1 byte and 5 MB');
      const mime = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg';
      return { documentId: await createDocument(context.db, { ownerEmployeeId: employeeId, kind: 'tax_proof', originalName: input.filename, mime, content, uploadedBy: context.user.id }) };
    }),
  setRegime: authed
    .route({ method: 'POST', path: '/tax/me/regime', summary: 'Choose old or new tax regime (declaration window only)' })
    .input(z.object({ fy, regime: z.enum(['old', 'new']) }))
    .output(z.object({ regime: z.enum(['old', 'new']) }))
    .handler(({ input, context }) => setMyRegime(context.db, own(context.user.employee_id), input.fy, input.regime, context.user.id)),
  myForm16: authed
    .route({ method: 'GET', path: '/tax/me/form16', summary: 'My Form 16 for a financial year (also for alumni)' })
    .input(z.object({ fy, format: z.enum(['json', 'pdf']).default('json') }))
    .output(z.union([json, fileOut]))
    .handler(async ({ input, context }) => {
      const f = await form16(context.db, own(context.user.employee_id), input.fy);
      return input.format === 'pdf' ? { filename: `Form16-${f.employee.ecode}-${input.fy}.pdf`, base64: renderForm16Pdf(f).toString('base64') } : f;
    }),

  challans: withPermission('payroll.run.view', 'read')
    .route({ method: 'GET', path: '/tax/challans', summary: 'TDS challans of a company for a FY' })
    .input(z.object({ companyId: z.coerce.number().int().positive(), fy }))
    .output(z.array(json))
    .handler(async ({ input, context }) => { await requireCompanyInScope(context, input.companyId); return listChallans(context.db, input.companyId, input.fy); }),
  addChallan: withPermission('payroll.run.manage')
    .route({ method: 'POST', path: '/tax/challans', summary: 'Record a TDS challan (ITNS 281) — audited' })
    .input(z.object({ companyId: z.number().int().positive(), month: z.string().regex(/^\d{4}-\d{2}(-01)?$/), amountRupees: z.number().positive().max(1e10), challanNo: z.string().trim(), bsrCode: z.string().trim(), paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .output(z.object({ id: z.number() }))
    .handler(async ({ input, context }) => { await requireCompanyInScope(context, input.companyId); return addChallan(context.db, { ...input, actorUserId: context.user.id }); }),
  deleteChallan: withPermission('payroll.run.manage')
    .route({ method: 'DELETE', path: '/tax/challans/{id}', summary: 'Delete a mistyped challan — audited' })
    .input(z.object({ id: z.coerce.number().int().positive() }))
    .output(z.object({ ok: z.boolean() }))
    .handler(async ({ input, context }) => deleteChallan(context.db, input.id, await companiesInScope(context), context.user.id)),
  reconciliation: withPermission('payroll.run.view', 'read')
    .route({ method: 'GET', path: '/tax/reconciliation', summary: 'TDS deducted vs deposited, month by month' })
    .input(z.object({ companyId: z.coerce.number().int().positive(), fy }))
    .output(json)
    .handler(async ({ input, context }) => { await requireCompanyInScope(context, input.companyId); return reconcile(context.db, input.companyId, input.fy); }),
  form24q: withPermission('payroll.reports', 'read')
    .route({ method: 'GET', path: '/tax/form24q', summary: 'Form 24Q quarterly data (Annexure I + challans) as JSON or CSV' })
    .input(z.object({ companyId: z.coerce.number().int().positive(), fy, quarter: z.coerce.number().int().min(1).max(4), format: z.enum(['json', 'csv']).default('json') }))
    .output(z.union([json, fileOut]))
    .handler(async ({ input, context }) => {
      await requireCompanyInScope(context, input.companyId);
      const f = await form24q(context.db, input.companyId, input.fy, input.quarter as 1 | 2 | 3 | 4);
      return input.format === 'csv' ? { filename: `Form24Q-${f.deductor.code}-${input.fy}-Q${String(input.quarter)}.csv`, base64: Buffer.from(form24qCsv(f), 'utf8').toString('base64') } : f;
    }),
  form16: withPermission('payroll.reports', 'read')
    .route({ method: 'GET', path: '/tax/form16', summary: 'Form 16 for an employee (payroll; data scope enforced)' })
    .input(z.object({ employeeId: z.coerce.number().int().positive().optional(), ecode: z.string().trim().min(1).max(32).optional(), fy, format: z.enum(['json', 'pdf']).default('json') }))
    .output(z.union([json, fileOut]))
    .handler(async ({ input, context }) => {
      let employeeId = input.employeeId;
      if (employeeId === undefined) {
        if (input.ecode === undefined) throw new DomainError('employeeId or ecode is required');
        const row = await context.db.selectFrom('core.employees').select('id').where('ecode', '=', input.ecode.toUpperCase()).executeTakeFirst();
        if (!row) throw new NotFoundError('Employee not found');
        employeeId = row.id;
      }
      await assertEmployeesInScope(context.db, { ...context.permissionAccess, actorEmployeeId: context.user.employee_id }, [employeeId]);
      const f = await form16(context.db, employeeId, input.fy);
      return input.format === 'pdf' ? { filename: `Form16-${f.employee.ecode}-${input.fy}.pdf`, base64: renderForm16Pdf(f).toString('base64') } : f;
    }),
};
