/**
 * Salary assignments and revisions: one row per employee revision. The CTC
 * breakup is resolved and checked at preview (same engine as the screen), so
 * a CTC the structure cannot satisfy is a row error before anything saves.
 */
import { z } from 'zod';
import type { BulkImporter } from '../../../core/bulk/index.js';
import { assignSalary, previewStructureBreakup } from '../../payroll-core/index.js';
import { attachEmployees, hasRowError, num, opt, rowError, rowWarning, str } from '../helpers.js';

const noContext = z.object({}).strict();
type NoCtx = z.infer<typeof noContext>;
const REASONS = ['joining', 'annual_increment', 'promotion', 'confirmation', 'correction', 'probation_start'] as const;
type Reason = (typeof REASONS)[number];

export const salaryAssignmentsImporter: BulkImporter<NoCtx> = {
  key: 'salary-assignments',
  title: 'Salary assignments and revisions',
  description: 'New joiner salaries, annual increments, promotions and corrections, effective from a date.',
  permission: 'salary.write',
  contextSchema: noContext,
  contextFields: [],
  columns: [
    { key: 'ecode', header: 'Employee code', aliases: ['ecode', 'employee no', 'employeeno'], type: 'string', required: true, help: 'E-code.' },
    { key: 'structure', header: 'Salary structure', aliases: ['structure', 'structure name', 'pay structure'], type: 'string', required: true, help: 'Structure name exactly as in Payroll → Structures.' },
    { key: 'effective_from', header: 'Effective from', aliases: ['effective date', 'wef'], type: 'date', required: true, help: 'Date the salary applies from.' },
    { key: 'annual_ctc', header: 'Annual CTC', aliases: ['ctc', 'ctc per annum', 'annual ctc (rs)'], type: 'money', required: true, min: 1, help: 'Annual cost to company.' },
    { key: 'phase', header: 'Phase', type: 'enum', options: ['confirmed', 'probation'], help: 'confirmed (default) or probation.' },
    { key: 'probation_percent', header: 'Probation %', aliases: ['probation pct'], type: 'number', min: 10, max: 100, help: 'Share of full salary during probation (e.g. 70, 80, 90). Default 80.' },
    { key: 'reason', header: 'Reason', aliases: ['revision reason'], type: 'enum', required: true, options: REASONS, help: 'Why the salary changes.' },
  ],
  instructions: ['The CTC must fit the structure (the preview shows the breakup check per row).', 'A later revision closes the previous one automatically.'],
  samples: [{ ecode: 'RML033901', structure: 'RML Staff Standard', effective_from: '2027-04-01', annual_ctc: 540000, phase: 'confirmed', probation_percent: null, reason: 'annual_increment' }],
  dynamicOptions: async (db) => ({ structure: (await db.selectFrom('pay.salary_structures').select('name').where('is_active', '=', true).orderBy('name').execute()).map((s) => s.name) }),
  rowKey: (v) => `${str(v['ecode']).toUpperCase()}|${str(v['effective_from'])}`,
  contextKey: () => 'salaries',
  authorize: () => Promise.resolve(null),
  validate: async ({ db, actor }, rows) => {
    const emps = await attachEmployees(db, actor.scope, rows);
    const structures = await db.selectFrom('pay.salary_structures').select(['id', 'name', 'company_id']).where('is_active', '=', true).execute();
    for (const row of rows) {
      if (hasRowError(row)) continue;
      const st = structures.find((s) => s.name.toLowerCase() === str(row.values['structure']).toLowerCase());
      if (!st) { rowError(row, 'Salary structure', 'Unknown or inactive structure'); continue; }
      const emp = emps.get(str(row.values['ecode']).toUpperCase());
      if (emp && st.company_id !== emp.companyId) { rowError(row, 'Salary structure', 'Structure belongs to another company'); continue; }
      row.values['structure_id'] = st.id;
      const phase = opt(row.values['phase']) ?? 'confirmed';
      if (phase === 'confirmed' && row.values['probation_percent'] !== null) rowWarning(row, 'Probation %', 'Ignored for a confirmed salary');
      try {
        const breakup = await previewStructureBreakup(db, {
          structure_id: st.id, annual_ctc_rupees: num(row.values['annual_ctc']),
          probation_percent: phase === 'probation' ? (row.values['probation_percent'] === null ? 80 : num(row.values['probation_percent'])) : undefined,
        });
        if (!breakup.validation.valid) rowError(row, 'Annual CTC', breakup.validation.message ?? 'CTC does not fit the structure');
        else row.values['monthly_gross'] = breakup.monthlyGross;
      } catch (error) {
        rowError(row, 'Salary structure', error instanceof Error ? error.message : 'Structure could not be evaluated');
      }
    }
  },
  commit: async ({ trx, actor }, rows, progress) => {
    for (const [i, row] of rows.entries()) {
      const phase = (opt(row.values['phase']) ?? 'confirmed') as 'confirmed' | 'probation';
      await assignSalary(trx, {
        employee_id: num(row.values['employee_id']), structure_id: num(row.values['structure_id']), effective_from: str(row.values['effective_from']),
        annual_ctc_rupees: num(row.values['annual_ctc']), phase,
        probation_percent: phase === 'probation' && row.values['probation_percent'] !== null ? num(row.values['probation_percent']) : undefined,
        revision_reason: str(row.values['reason']) as Reason,
      }, actor.userId);
      if ((i + 1) % 100 === 0) await progress(i + 1);
    }
    return { created: rows.length, updated: 0, skipped: 0 };
  },
};
