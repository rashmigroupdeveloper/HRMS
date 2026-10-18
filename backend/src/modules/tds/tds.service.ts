/**
 * TDS compliance (handover item 3; RQ-STAT-006/007/008, PAY-13, SOW 146/147):
 *  - ESS investment declarations inside a configurable window, proof attachment,
 *    regime choice; verified rows are locked (payroll verifies).
 *  - TDS challans and monthly reconciliation of deducted (finalized/paid runs)
 *    vs deposited per company.
 *  - Form 24Q quarterly data (Annexure I deductee rows + challans) and Form 16
 *    Part A/B per employee (incl. alumni), as JSON, CSV and PDF.
 * Software prepares the data; humans file with TRACES / the e-TDS utility.
 */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { csvCell } from '../../core/bulk/index.js';
import { istDateString } from '../../core/dates.js';
import { ConflictError, DomainError, NotFoundError } from '../../core/errors/index.js';
import { getTypedSetting } from '../settings/index.js';

/** Sections an employee may declare, with the statutory cap the engine applies (old regime). */
export const DECLARATION_SECTIONS: Record<string, { label: string; capRupees: number | null }> = {
  '80C': { label: '80C — PF/PPF/ELSS/LIC/tuition/home-loan principal', capRupees: 150000 },
  '80CCD1B': { label: '80CCD(1B) — additional NPS', capRupees: 50000 },
  '80D': { label: '80D — medical insurance (self/family)', capRupees: 25000 },
  '80TTA': { label: '80TTA — savings interest', capRupees: 10000 },
  '80E': { label: '80E — education-loan interest', capRupees: null },
  '80G': { label: '80G — donations (eligible amount)', capRupees: null },
};

export function fyLabel(isoDate: string): string {
  const [y = 0, m = 0] = isoDate.split('-').map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${String(start)}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** First month (YYYY-MM-01) of each FY month, April → March. */
export function fyMonths(fy: string): string[] {
  const start = Number(fy.slice(0, 4));
  return Array.from({ length: 12 }, (_, i) => {
    const m = ((i + 3) % 12) + 1;
    const y = m >= 4 ? start : start + 1;
    return `${String(y)}-${String(m).padStart(2, '0')}-01`;
  });
}

export function quarterMonths(fy: string, quarter: 1 | 2 | 3 | 4): string[] {
  return fyMonths(fy).slice((quarter - 1) * 3, quarter * 3);
}

interface Window { open: string; close: string }
/** Window as MM-DD pairs; a close earlier than open wraps into the next calendar year. */
export function inWindow(today: string, fy: string, w: Window): boolean {
  const start = Number(fy.slice(0, 4));
  const openYear = Number(w.open.slice(0, 2)) >= 4 ? start : start + 1;
  const closeYear = Number(w.close.slice(0, 2)) >= 4 ? start : start + 1;
  const open = `${String(openYear)}-${w.open}`;
  const close = `${String(closeYear)}-${w.close}`;
  return today >= open && today <= close;
}

export async function declarationWindows(db: Kysely<Database>): Promise<{ declaration: Window; proof: Window }> {
  return {
    declaration: await getTypedSetting<Window>(db, 'tax.declaration_window', 'json', { open: '04-01', close: '01-15' }),
    proof: await getTypedSetting<Window>(db, 'tax.proof_window', 'json', { open: '01-01', close: '02-28' }),
  };
}

export async function myDeclarations(db: Kysely<Database>, employeeId: number, fy: string) {
  const [rows, emp, windows] = await Promise.all([
    db.selectFrom('pay.investment_declarations').selectAll().where('employee_id', '=', employeeId).where('fy', '=', fy).orderBy('section').execute(),
    db.selectFrom('core.employees').select('tax_regime').where('id', '=', employeeId).executeTakeFirstOrThrow(),
    declarationWindows(db),
  ]);
  const today = istDateString();
  return {
    fy, regime: emp.tax_regime,
    declarationOpen: inWindow(today, fy, windows.declaration), proofOpen: inWindow(today, fy, windows.proof), windows,
    sections: Object.entries(DECLARATION_SECTIONS).map(([code, s]) => ({ code, ...s })),
    items: rows.map((r) => ({
      id: r.id, section: r.section, declaredRupees: Number(r.declared_amount), verifiedRupees: r.verified_amount === null ? null : Number(r.verified_amount),
      proofDocumentId: r.proof_document_id, status: r.verified_at !== null ? 'verified' as const : r.proof_document_id !== null ? 'proof_submitted' as const : 'declared' as const,
    })),
  };
}

export async function upsertMyDeclaration(db: Kysely<Database>, p: { employeeId: number; fy: string; section: string; amountRupees: number; proofDocumentId?: number | null | undefined; actorUserId: number }) {
  const def = DECLARATION_SECTIONS[p.section];
  if (!def) throw new DomainError(`Unknown section ${p.section}`);
  if (!(p.amountRupees >= 0) || !Number.isFinite(p.amountRupees)) throw new DomainError('Amount must be zero or more');
  if (def.capRupees !== null && p.amountRupees > def.capRupees * 4) throw new DomainError(`That is far above the ₹${def.capRupees.toLocaleString('en-IN')} limit for ${p.section}; check the amount`);
  const windows = await declarationWindows(db);
  const today = istDateString();
  const declOpen = inWindow(today, p.fy, windows.declaration);
  const proofOpen = inWindow(today, p.fy, windows.proof);
  const existing = await db.selectFrom('pay.investment_declarations').selectAll().where('employee_id', '=', p.employeeId).where('fy', '=', p.fy).where('section', '=', p.section).executeTakeFirst();
  if (existing?.verified_at) throw new ConflictError('This declaration is already verified by payroll and is locked');
  const changingAmount = existing === undefined || Number(existing.declared_amount) !== p.amountRupees;
  if (changingAmount && !declOpen) throw new DomainError('The declaration window is closed for this financial year');
  if (!changingAmount && p.proofDocumentId !== undefined && !proofOpen && !declOpen) throw new DomainError('The proof submission window is closed');
  if (p.proofDocumentId !== undefined && p.proofDocumentId !== null) {
    const doc = await db.selectFrom('core.documents').select(['id', 'owner_employee_id']).where('id', '=', p.proofDocumentId).executeTakeFirst();
    if (doc?.owner_employee_id !== p.employeeId) throw new DomainError('Proof document not found among your documents');
  }
  const amount = p.amountRupees.toFixed(2);
  const proof = p.proofDocumentId === undefined ? existing?.proof_document_id ?? null : p.proofDocumentId;
  const row = await db.insertInto('pay.investment_declarations')
    .values({ employee_id: p.employeeId, fy: p.fy, section: p.section, declared_amount: amount, proof_document_id: proof })
    .onConflict((oc) => oc.columns(['employee_id', 'fy', 'section']).doUpdateSet({ declared_amount: amount, proof_document_id: proof }))
    .returning('id').executeTakeFirstOrThrow();
  await writeAudit(db, { actorUserId: p.actorUserId, action: existing ? 'update' : 'create', entity: 'pay.investment_declarations', entityId: row.id, oldValue: existing ? existing.declared_amount : null, newValue: JSON.stringify({ section: p.section, amount, proof }), ip: null });
  return { id: row.id };
}

export async function setMyRegime(db: Kysely<Database>, employeeId: number, fy: string, regime: 'old' | 'new', actorUserId: number) {
  const windows = await declarationWindows(db);
  if (!inWindow(istDateString(), fy, windows.declaration)) throw new DomainError('Regime can only be changed while the declaration window is open');
  const before = await db.selectFrom('core.employees').select('tax_regime').where('id', '=', employeeId).executeTakeFirstOrThrow();
  await db.updateTable('core.employees').set({ tax_regime: regime }).where('id', '=', employeeId).execute();
  await writeAudit(db, { actorUserId, action: 'update', entity: 'core.employees', entityId: employeeId, field: 'tax_regime', oldValue: before.tax_regime, newValue: regime, ip: null });
  return { regime };
}

// ── Challans & reconciliation ─────────────────────────────────────────────

export async function addChallan(db: Kysely<Database>, p: { companyId: number; month: string; amountRupees: number; challanNo: string; bsrCode: string; paidOn: string; actorUserId: number }) {
  if (!/^\d{7}$/.test(p.bsrCode)) throw new DomainError('BSR code must be 7 digits');
  if (!/^\d{5}$/.test(p.challanNo)) throw new DomainError('Challan serial number must be 5 digits');
  if (!(p.amountRupees > 0)) throw new DomainError('Amount must be more than zero');
  const month = `${p.month.slice(0, 7)}-01`;
  if (p.paidOn < month) throw new DomainError('Paid-on date cannot be before the salary month');
  const dup = await db.selectFrom('pay.tds_challans').select('id').where('company_id', '=', p.companyId).where('bsr_code', '=', p.bsrCode).where('challan_no', '=', p.challanNo).where('paid_on', '=', sql<Date>`${p.paidOn}::date`).executeTakeFirst();
  if (dup) throw new ConflictError('This challan (BSR + serial + date) is already recorded');
  const row = await db.insertInto('pay.tds_challans').values({
    company_id: p.companyId, month: sql<Date>`${month}::date` as unknown as Date, amount: p.amountRupees.toFixed(2),
    challan_no: p.challanNo, bsr_code: p.bsrCode, paid_on: sql<Date>`${p.paidOn}::date` as unknown as Date,
  }).returning('id').executeTakeFirstOrThrow();
  await writeAudit(db, { actorUserId: p.actorUserId, action: 'create', entity: 'pay.tds_challans', entityId: row.id, newValue: JSON.stringify({ ...p, actorUserId: undefined }), ip: null });
  return { id: row.id };
}

export async function deleteChallan(db: Kysely<Database>, id: number, companyIds: number[] | null, actorUserId: number) {
  const row = await db.selectFrom('pay.tds_challans').selectAll().where('id', '=', id).executeTakeFirst();
  if (!row || (companyIds !== null && !companyIds.includes(row.company_id))) throw new NotFoundError('Challan not found');
  await db.deleteFrom('pay.tds_challans').where('id', '=', id).execute();
  await writeAudit(db, { actorUserId, action: 'delete', entity: 'pay.tds_challans', entityId: id, oldValue: JSON.stringify(row), ip: null });
  return { ok: true };
}

const iso = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
const paidRuns = ['finalized', 'paid'] as const;

/** TDS deducted per month (from finalized/paid runs of the company). */
async function deductedByMonth(db: Kysely<Database>, companyId: number, months: string[]) {
  const rows = await db.selectFrom('pay.payroll_item_lines as l')
    .innerJoin('pay.payroll_items as i', 'i.id', 'l.item_id')
    .innerJoin('pay.payroll_runs as r', 'r.id', 'i.run_id')
    .select([sql<string>`to_char(r.month, 'YYYY-MM-01')`.as('month'), sql<string>`sum(l.amount)`.as('tds')])
    .where('r.company_id', '=', companyId).where('l.component_code', '=', 'TDS')
    .where('r.status', 'in', paidRuns as unknown as never[])
    .where(sql<string>`to_char(r.month, 'YYYY-MM-01')`, 'in', months)
    .groupBy(sql`to_char(r.month, 'YYYY-MM-01')`).execute();
  return new Map(rows.map((r) => [r.month, Number(r.tds)]));
}

export async function listChallans(db: Kysely<Database>, companyId: number, fy: string) {
  const months = fyMonths(fy);
  const rows = await db.selectFrom('pay.tds_challans').selectAll().where('company_id', '=', companyId)
    .where(sql<string>`to_char(month, 'YYYY-MM-01')`, 'in', months).orderBy('month').orderBy('paid_on').execute();
  return rows.map((r) => ({ id: r.id, month: iso(r.month), amountRupees: Number(r.amount), challanNo: r.challan_no, bsrCode: r.bsr_code, paidOn: iso(r.paid_on) }));
}

export async function reconcile(db: Kysely<Database>, companyId: number, fy: string) {
  const months = fyMonths(fy);
  const deducted = await deductedByMonth(db, companyId, months);
  const challans = await listChallans(db, companyId, fy);
  const lines = months.map((m) => {
    const d = Math.round((deducted.get(m) ?? 0) * 100) / 100;
    const mine = challans.filter((c) => c.month === m);
    const dep = Math.round(mine.reduce((s, c) => s + c.amountRupees, 0) * 100) / 100;
    // Due date: 7th of the next month (30 April for March) — Rule 30.
    const [y = 0, mm = 0] = m.split('-').map(Number);
    const due = mm === 3 ? `${String(y)}-04-30` : `${String(mm === 12 ? y + 1 : y)}-${String(mm === 12 ? 1 : mm + 1).padStart(2, '0')}-07`;
    const late = mine.filter((c) => c.paidOn > due).length;
    return { month: m, deductedRupees: d, depositedRupees: dep, differenceRupees: Math.round((d - dep) * 100) / 100, challans: mine.length, dueDate: due, lateChallans: late,
      status: d === 0 && dep === 0 ? 'nil' as const : Math.abs(d - dep) < 0.5 ? (late > 0 ? 'late' as const : 'matched' as const) : d > dep ? 'short' as const : 'excess' as const };
  });
  const total = (k: 'deductedRupees' | 'depositedRupees') => Math.round(lines.reduce((s, l) => s + l[k], 0) * 100) / 100;
  return { companyId, fy, lines, totals: { deductedRupees: total('deductedRupees'), depositedRupees: total('depositedRupees'), differenceRupees: Math.round((total('deductedRupees') - total('depositedRupees')) * 100) / 100 } };
}

// ── Form 24Q / Form 16 ────────────────────────────────────────────────────

async function deducteeRows(db: Kysely<Database>, companyId: number, months: string[], employeeId?: number) {
  return db.selectFrom('pay.payroll_items as i')
    .innerJoin('pay.payroll_runs as r', 'r.id', 'i.run_id')
    .innerJoin('core.employees as e', 'e.id', 'i.employee_id')
    .leftJoin('pay.payroll_item_lines as l', (j) => j.onRef('l.item_id', '=', 'i.id').on('l.component_code', '=', 'TDS'))
    .select([
      'e.id as employeeId', 'e.ecode', 'e.first_name', 'e.last_name', 'e.pan', 'e.tax_regime',
      sql<string>`to_char(r.month, 'YYYY-MM-01')`.as('month'),
      sql<string>`sum(i.gross)`.as('gross'), sql<string>`coalesce(sum(l.amount), 0)`.as('tds'),
    ])
    .where('r.company_id', '=', companyId).where('r.status', 'in', paidRuns as unknown as never[])
    .where(sql<string>`to_char(r.month, 'YYYY-MM-01')`, 'in', months)
    .$if(employeeId !== undefined, (q) => q.where('e.id', '=', employeeId ?? 0))
    .groupBy(['e.id', 'e.ecode', 'e.first_name', 'e.last_name', 'e.pan', 'e.tax_regime', sql`to_char(r.month, 'YYYY-MM-01')`])
    .orderBy('e.ecode').orderBy(sql`to_char(r.month, 'YYYY-MM-01')`).execute();
}

export async function form24q(db: Kysely<Database>, companyId: number, fy: string, quarter: 1 | 2 | 3 | 4) {
  const months = quarterMonths(fy, quarter);
  const company = await db.selectFrom('core.companies').select(['code', 'name', 'tan', 'pan']).where('id', '=', companyId).executeTakeFirstOrThrow();
  const rows = await deducteeRows(db, companyId, months);
  const challans = (await listChallans(db, companyId, fy)).filter((c) => months.includes(c.month));
  const deductees = rows.map((r) => ({
    employeeId: r.employeeId, ecode: r.ecode, name: [r.first_name, r.last_name].filter(Boolean).join(' '), pan: r.pan ?? 'PANNOTAVBL',
    month: r.month, section: '192', amountPaidRupees: Number(r.gross), tdsRupees: Number(r.tds), regime: r.tax_regime,
  }));
  const warnings: string[] = [];
  if (!company.tan) warnings.push('Company TAN is missing (Admin → Org masters)');
  const noPan = new Set(deductees.filter((d) => d.pan === 'PANNOTAVBL').map((d) => d.ecode));
  if (noPan.size > 0) warnings.push(`${String(noPan.size)} employee(s) without PAN — TDS at 20% (s.206AA) may apply`);
  const totalTds = Math.round(deductees.reduce((s, d) => s + d.tdsRupees, 0) * 100) / 100;
  const totalDeposited = Math.round(challans.reduce((s, c) => s + c.amountRupees, 0) * 100) / 100;
  if (Math.abs(totalTds - totalDeposited) >= 0.5) warnings.push(`Deducted ₹${totalTds.toFixed(2)} vs deposited ₹${totalDeposited.toFixed(2)} for the quarter`);
  return {
    fy, quarter, months, deductor: { code: company.code, name: company.name, tan: company.tan, pan: company.pan },
    challans, deductees, totals: { deductees: new Set(deductees.map((d) => d.employeeId)).size, amountPaidRupees: Math.round(deductees.reduce((s, d) => s + d.amountPaidRupees, 0) * 100) / 100, tdsRupees: totalTds, depositedRupees: totalDeposited },
    warnings,
  };
}

export function form24qCsv(f: Awaited<ReturnType<typeof form24q>>): string {
  const out: string[] = [];
  out.push(['Form 24Q', `FY ${f.fy}`, `Q${String(f.quarter)}`, f.deductor.name, `TAN ${f.deductor.tan ?? ''}`].map((v) => csvCell(v)).join(','));
  out.push('');
  out.push(['Challan', 'Month', 'BSR code', 'Serial no', 'Paid on', 'Amount'].map((v) => csvCell(v)).join(','));
  for (const c of f.challans) out.push([csvCell('C'), csvCell(c.month), csvCell(c.bsrCode), csvCell(c.challanNo), csvCell(c.paidOn), c.amountRupees.toFixed(2)].join(','));
  out.push('');
  out.push(['Deductee', 'E-code', 'Name', 'PAN', 'Month', 'Section', 'Amount paid', 'TDS'].map((v) => csvCell(v)).join(','));
  for (const d of f.deductees) out.push([csvCell('D'), csvCell(d.ecode), csvCell(d.name), csvCell(d.pan), csvCell(d.month), csvCell(d.section), d.amountPaidRupees.toFixed(2), d.tdsRupees.toFixed(2)].join(','));
  return `\uFEFF${out.join('\r\n')}\r\n`;
}

export async function form16(db: Kysely<Database>, employeeId: number, fy: string) {
  const emp = await db.selectFrom('core.employees as e').innerJoin('core.companies as c', 'c.id', 'e.company_id')
    .select(['e.id', 'e.ecode', 'e.first_name', 'e.last_name', 'e.pan', 'e.tax_regime', 'e.company_id', 'c.name as companyName', 'c.tan', 'c.pan as companyPan', 'c.address'])
    .where('e.id', '=', employeeId).executeTakeFirst();
  if (!emp) throw new NotFoundError('Employee not found');
  const months = fyMonths(fy);
  const rows = await deducteeRows(db, emp.company_id, months, employeeId);
  if (rows.length === 0) throw new NotFoundError(`No finalized salary for FY ${fy} — Form 16 is not available`);
  const challans = await listChallans(db, emp.company_id, fy);
  const quarters = ([1, 2, 3, 4] as const).map((q) => {
    const qm = quarterMonths(fy, q);
    const mine = rows.filter((r) => qm.includes(r.month));
    return { quarter: q, amountPaidRupees: mine.reduce((s, r) => s + Number(r.gross), 0), tdsRupees: mine.reduce((s, r) => s + Number(r.tds), 0) };
  });
  const decl = await db.selectFrom('pay.investment_declarations').select(['section', 'declared_amount', 'verified_amount']).where('employee_id', '=', employeeId).where('fy', '=', fy).execute();
  const deductions = emp.tax_regime === 'old' ? decl.map((d) => {
    const cap = DECLARATION_SECTIONS[d.section]?.capRupees ?? null;
    const amt = Number(d.verified_amount ?? d.declared_amount);
    return { section: d.section, claimedRupees: amt, allowedRupees: cap === null ? amt : Math.min(cap, amt) };
  }) : [];
  const gross = quarters.reduce((s, q) => s + q.amountPaidRupees, 0);
  const standardDeduction = emp.tax_regime === 'new' ? 75000 : 50000;
  const chapterVia = deductions.reduce((s, d) => s + d.allowedRupees, 0);
  return {
    fy, assessmentYear: `${String(Number(fy.slice(0, 4)) + 1)}-${String((Number(fy.slice(0, 4)) + 2) % 100).padStart(2, '0')}`,
    employer: { name: emp.companyName, tan: emp.tan, pan: emp.companyPan, address: emp.address },
    employee: { ecode: emp.ecode, name: [emp.first_name, emp.last_name].filter(Boolean).join(' '), pan: emp.pan, regime: emp.tax_regime },
    partA: { quarters, totalTdsRupees: quarters.reduce((s, q) => s + q.tdsRupees, 0), challans: challans.length },
    partB: { grossSalaryRupees: gross, standardDeductionRupees: Math.min(standardDeduction, gross), deductions, chapterViaRupees: chapterVia, taxableIncomeRupees: Math.max(0, gross - standardDeduction - chapterVia) },
  };
}
