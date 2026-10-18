/**
 * Leave balance adjustments and opening balances. "adjust" adds the signed
 * days; "set_balance" posts the difference so the balance becomes the given
 * value (migration from the legacy system). Every change is a ledger row.
 */
import { z } from 'zod';
import type { BulkImporter } from '../../../core/bulk/index.js';
import { adjustBalance, getBalance } from '../../leave/index.js';
import { attachEmployees, hasRowError, num, rowError, rowWarning, str } from '../helpers.js';

const noContext = z.object({}).strict();
type NoCtx = z.infer<typeof noContext>;

export const leaveBalancesImporter: BulkImporter<NoCtx> = {
  key: 'leave-balances',
  title: 'Leave balances and adjustments',
  description: 'Add or deduct leave days, or set opening balances, per employee and leave type.',
  permission: 'leave.admin',
  contextSchema: noContext,
  contextFields: [],
  columns: [
    { key: 'ecode', header: 'Employee code', aliases: ['ecode', 'employee no', 'employeeno', 'emp code'], type: 'string', required: true, help: 'E-code.' },
    { key: 'leave_type', header: 'Leave type', aliases: ['leave_type', 'leave code', 'type'], type: 'string', required: true, help: 'Leave type code (CL, SL, EL, CO…).' },
    { key: 'mode', header: 'Mode', type: 'enum', options: ['adjust', 'set_balance'], help: 'adjust (default): add/deduct Days. set_balance: make the balance equal to Days.' },
    { key: 'days', header: 'Days', aliases: ['delta', 'balance', 'value'], type: 'number', required: true, min: -365, max: 365, help: 'Days, in steps of 0.5. Negative deducts (adjust mode).' },
    { key: 'note', header: 'Reason', aliases: ['note', 'remarks'], type: 'string', required: true, maxLength: 300, help: 'Shown in the employee\'s leave ledger.' },
  ],
  instructions: ['Use set_balance for go-live opening balances; use adjust for corrections.', 'Each employee + leave type can appear once per file.'],
  samples: [
    { ecode: 'RML033625', leave_type: 'EL', mode: 'set_balance', days: 12.5, note: 'Opening balance from greytHR (31-Mar)' },
    { ecode: 'RML033901', leave_type: 'CL', mode: 'adjust', days: -1, note: 'Correction: CL taken on 12-Apr not recorded' },
  ],
  dynamicOptions: async (db) => ({ leave_type: (await db.selectFrom('lv.leave_types').select('code').orderBy('code').execute()).map((t) => t.code) }),
  rowKey: (v) => `${str(v['ecode']).toUpperCase()}|${str(v['leave_type']).toUpperCase()}`,
  contextKey: () => 'ledger',
  authorize: () => Promise.resolve(null),
  validate: async ({ db, actor }, rows) => {
    await attachEmployees(db, actor.scope, rows);
    const types = await db.selectFrom('lv.leave_types').select(['id', 'code']).execute();
    for (const row of rows) {
      if (hasRowError(row)) continue;
      const days = num(row.values['days']);
      if (Math.round(days * 2) !== days * 2) { rowError(row, 'Days', 'Use whole or half days (0.5 steps)'); continue; }
      const type = types.find((t) => t.code === str(row.values['leave_type']));
      if (!type) { rowError(row, 'Leave type', 'Unknown leave type'); continue; }
      const mode = str(row.values['mode']) || 'adjust';
      const current = await getBalance(db, num(row.values['employee_id']), type.id);
      const delta = mode === 'set_balance' ? Math.round((days - current.balance) * 2) / 2 : days;
      if (mode === 'set_balance' && days < 0) rowError(row, 'Days', 'A balance cannot be negative');
      else if (delta === 0) rowWarning(row, 'Days', `Balance is already ${String(current.balance)} — no change will be posted`);
      else if (current.balance + delta < 0) rowError(row, 'Days', `Would make the balance negative (current ${String(current.balance)})`);
      row.values['delta'] = delta;
      row.values['current_balance'] = current.balance;
    }
  },
  commit: async ({ trx, actor }, rows, progress) => {
    let created = 0;
    let skipped = 0;
    for (const [i, row] of rows.entries()) {
      const delta = num(row.values['delta']);
      if (delta === 0) { skipped++; continue; }
      await adjustBalance(trx, { employeeId: num(row.values['employee_id']), leaveTypeCode: str(row.values['leave_type']), delta, note: `Bulk: ${str(row.values['note'])}`, actorUserId: actor.userId });
      created++;
      if ((i + 1) % 200 === 0) await progress(i + 1);
    }
    return { created, updated: 0, skipped };
  },
};
