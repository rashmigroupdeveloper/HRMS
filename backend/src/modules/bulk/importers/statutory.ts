/**
 * Statutory rates and PT slabs. These tables are GROUP-wide reference data
 * (one PF/ESIC rate set, PT per state), so only a group-scoped payroll admin
 * may upload them; an entity-bound admin cannot change another entity's pay.
 */
import { z } from 'zod';
import { ForbiddenError } from '../../../core/errors/index.js';
import type { BulkImporter, ImportRun } from '../../../core/bulk/index.js';
import { addStatutoryRate, setPtSlabs, STATUTORY_PARAMS } from '../../payroll-core/index.js';
import { hasRowError, num, opt, rowError, str } from '../helpers.js';

const noContext = z.object({}).strict();
type NoCtx = z.infer<typeof noContext>;

function requireGroup(run: ImportRun<NoCtx>): Promise<null> {
  if (!run.actor.scope.all) return Promise.reject(new ForbiddenError('Statutory tables are group-wide; only a group-level payroll admin can upload them'));
  return Promise.resolve(null);
}

function isMonthStart(v: string): boolean {
  return /^\d{4}-\d{2}-01$/.test(v);
}

export const statutoryRatesImporter: BulkImporter<NoCtx> = {
  key: 'statutory-rates',
  title: 'Statutory rates',
  description: 'PF / ESIC / OT / Bonus parameters with an effective month (new rows; history is kept).',
  permission: 'payroll.run.manage',
  contextSchema: noContext,
  contextFields: [],
  columns: [
    { key: 'scheme', header: 'Scheme', type: 'enum', required: true, options: Object.keys(STATUTORY_PARAMS), help: 'PF, ESIC, OT or BONUS.' },
    { key: 'param', header: 'Parameter', type: 'string', required: true, help: `Parameter name, e.g. ${Object.entries(STATUTORY_PARAMS).map(([s, p]) => `${s}: ${p.join('/')}`).join('; ')}.` },
    { key: 'value', header: 'Value', type: 'number', required: true, min: 0, help: 'Percent values as numbers (12 = 12%). Amounts in the entity currency.' },
    { key: 'effective_from', header: 'Effective from', type: 'date', required: true, help: 'First day of the month the value applies from (YYYY-MM-01).' },
    { key: 'source_note', header: 'Source', aliases: ['source note', 'notification', 'reference'], type: 'string', required: true, maxLength: 300, help: 'Gazette / circular reference.' },
  ],
  instructions: ['Each row adds a dated value; earlier values stay for past months.', 'A month that is already finalized cannot be changed.'],
  samples: [{ scheme: 'ESIC', param: 'wage_ceiling', value: 21000, effective_from: '2027-04-01', source_note: 'ESIC notification (example)' }],
  rowKey: (v) => `${str(v['scheme'])}|${str(v['param'])}|${str(v['effective_from'])}`,
  contextKey: () => 'group',
  authorize: requireGroup,
  validate: (_run, rows) => {
    for (const row of rows) {
      if (hasRowError(row)) continue;
      const scheme = str(row.values['scheme']);
      const param = str(row.values['param']);
      if (!STATUTORY_PARAMS[scheme]?.includes(param)) rowError(row, 'Parameter', `${scheme} has no parameter "${param}" (allowed: ${(STATUTORY_PARAMS[scheme] ?? []).join(', ')})`);
      if (param.endsWith('_pct') && num(row.values['value']) > 100) rowError(row, 'Value', 'A percentage cannot exceed 100');
      if (!isMonthStart(str(row.values['effective_from']))) rowError(row, 'Effective from', 'Must be the first day of a month');
    }
    return Promise.resolve();
  },
  commit: async ({ trx, actor }, rows, progress) => {
    let n = 0;
    for (const row of rows) {
      await addStatutoryRate(trx, {
        scheme: str(row.values['scheme']), param: str(row.values['param']), value: num(row.values['value']),
        effectiveFrom: str(row.values['effective_from']), sourceNote: str(row.values['source_note']), actorUserId: actor.userId,
      });
      if (++n % 200 === 0) await progress(n);
    }
    return { created: n, updated: 0, skipped: 0 };
  },
};

export const ptSlabsImporter: BulkImporter<NoCtx> = {
  key: 'pt-slabs',
  title: 'Professional tax slabs',
  description: 'PT slabs per state and effective month. Each state + month in the file REPLACES that slab table.',
  permission: 'payroll.run.manage',
  contextSchema: noContext,
  contextFields: [],
  columns: [
    { key: 'state_code', header: 'State', aliases: ['state code', 'pt state'], type: 'string', required: true, maxLength: 2, help: 'Two-letter state code (WB, OD, MH…).' },
    { key: 'min_monthly', header: 'From (monthly)', aliases: ['min monthly', 'min'], type: 'money', required: true, min: 0, help: 'Lower bound of the monthly wage band (inclusive).' },
    { key: 'max_monthly', header: 'To (monthly)', aliases: ['max monthly', 'max'], type: 'money', min: 0, help: 'Upper bound (inclusive). Leave blank on the highest slab.' },
    { key: 'amount', header: 'PT amount', aliases: ['amount', 'tax'], type: 'money', required: true, min: 0, help: 'Monthly PT for the band.' },
    { key: 'effective_from', header: 'Effective from', type: 'date', required: true, help: 'First day of the month (YYYY-MM-01).' },
    { key: 'basis', header: 'Basis', type: 'enum', options: ['earned_monthly', 'contracted_monthly'], help: 'earned_monthly (default) or contracted_monthly.' },
  ],
  instructions: ['Give every slab of a state for that month: the upload replaces the whole table for each state + month.', 'Bands must not overlap; only the highest band may be open-ended.'],
  samples: [
    { state_code: 'WB', min_monthly: 0, max_monthly: 10000, amount: 0, effective_from: '2027-04-01', basis: 'earned_monthly' },
    { state_code: 'WB', min_monthly: 10000.01, max_monthly: null, amount: 200, effective_from: '2027-04-01', basis: 'earned_monthly' },
  ],
  rowKey: (v) => `${str(v['state_code']).toUpperCase()}|${str(v['effective_from'])}|${String(v['min_monthly'])}`,
  contextKey: () => 'group',
  authorize: requireGroup,
  validate: (_run, rows) => {
    for (const row of rows) {
      if (hasRowError(row)) continue;
      if (!/^[A-Za-z]{2}$/.test(str(row.values['state_code']))) rowError(row, 'State', 'Use the two-letter state code');
      if (!isMonthStart(str(row.values['effective_from']))) rowError(row, 'Effective from', 'Must be the first day of a month');
      const max = row.values['max_monthly'];
      if (max !== null && typeof max === 'number' && max < num(row.values['min_monthly'])) rowError(row, 'To (monthly)', 'Ends before it starts');
    }
    // Band checks per state + month (overlap / open-ended) — reported on every row of the group.
    const groups = new Map<string, typeof rows>();
    for (const row of rows.filter((r) => !hasRowError(r))) {
      const k = `${str(row.values['state_code']).toUpperCase()}|${str(row.values['effective_from'])}`;
      groups.set(k, [...(groups.get(k) ?? []), row]);
    }
    for (const group of groups.values()) {
      const sorted = [...group].sort((a, b) => num(a.values['min_monthly']) - num(b.values['min_monthly']));
      sorted.forEach((row, i) => {
        const next = sorted[i + 1];
        const max = row.values['max_monthly'];
        if (max === null && next) rowError(row, 'To (monthly)', 'Only the highest slab can be open-ended');
        if (next && typeof max === 'number' && num(next.values['min_monthly']) <= max) rowError(next, 'From (monthly)', `Overlaps the slab starting ${String(row.values['min_monthly'])}`);
        const basis = opt(row.values['basis']) ?? 'earned_monthly';
        if (basis !== (opt(sorted[0]?.values['basis'] ?? null) ?? 'earned_monthly')) rowError(row, 'Basis', 'All slabs of one state + month must use the same basis');
      });
    }
    return Promise.resolve();
  },
  commit: async ({ trx, actor }, rows) => {
    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const k = `${str(row.values['state_code']).toUpperCase()}|${str(row.values['effective_from'])}`;
      groups.set(k, [...(groups.get(k) ?? []), row]);
    }
    let n = 0;
    for (const [key, group] of groups) {
      const [state = '', effectiveFrom = ''] = key.split('|');
      const basis = (opt(group[0]?.values['basis'] ?? null) ?? 'earned_monthly') as 'earned_monthly' | 'contracted_monthly';
      const res = await setPtSlabs(trx, {
        stateCode: state, effectiveFrom, basis, actorUserId: actor.userId,
        slabs: group.map((r) => ({ minMonthly: num(r.values['min_monthly']), maxMonthly: r.values['max_monthly'] === null ? null : num(r.values['max_monthly']), amount: num(r.values['amount']) })),
      });
      n += res.count;
    }
    return { created: n, updated: 0, skipped: 0, notes: [`${String(groups.size)} state/month slab table(s) replaced`] };
  },
};
