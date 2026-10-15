/** PAY-03/04/08/16: compute results inside the caller's locked run transaction. */
import type { Kysely, Selectable } from 'kysely';
import { sql } from 'kysely';
import type { Database, PayrollRunsTable } from '../../../core/db/types.js';
import { addDaysIso, formatDbDate } from '../../../core/dates.js';
import { writeAudit } from '../../../core/audit/audit.service.js';
import {
  type Paise,
  paise,
  toRupees,
  parseRupees,
  decimalRupees,
} from '../../../core/money/index.js';
import { validateRunTransition } from './run-state-machine.js';
import { readLockedPayableDays } from './attendance.repository.js';
import { computeEmployeePayroll, type ComponentMetadata } from '../engine/compute-engine.js';
import { SalaryHoldsService } from '../holds/holds.service.js';
import { salarySnapshotToPaise } from '../salaries/salary-snapshot.js';

export interface RunComputationResult {
  employeeCount: number;
  grossPaise: Paise;
  netPaise: Paise;
  negativeNetCount: number;
}

export async function computeLockedRun(
  trx: Kysely<Database>,
  run: Selectable<PayrollRunsTable>,
  actorUserId: number,
): Promise<RunComputationResult> {
  const runId = run.id;

  const validation = validateRunTransition({
    fromStatus: run.status,
    toStatus: 'computed',
    attendanceLockId: run.attendance_lock_id,
    actorUserId,
  });

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const monthStr = formatDbDate(run.month);
  const [year = 0, month = 0] = monthStr.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthUntil = addDaysIso(monthStr, daysInMonth);
  const attendanceLock = await trx
    .selectFrom('att.month_locks')
    .select('id')
    .where('id', '=', run.attendance_lock_id)
    .where('company_id', '=', run.company_id)
    .where('month', '=', sql<Date>`${monthStr}::date`)
    .executeTakeFirst();
  if (!attendanceLock)
    throw new Error('Payroll attendance lock must belong to this company and month.');

  // Include employees whose employment actually overlaps this payroll period.
  const employees = await trx
    .selectFrom('core.employees')
    .select(['id', 'doj', 'dol', 'status'])
    .where('company_id', '=', run.company_id)
    .where('status', 'in', ['active', 'on_notice', 'exited'])
    .where((eb) => eb.or([eb('doj', 'is', null), eb('doj', '<', sql<Date>`${monthUntil}::date`)]))
    .where((eb) => eb.or([eb('dol', 'is', null), eb('dol', '>=', sql<Date>`${monthStr}::date`)]))
    .execute();

  // 2. Load component catalog
  const rawComponents = await trx.selectFrom('pay.salary_components').selectAll().execute();

  const catalog = new Map<string, ComponentMetadata>();
  for (const c of rawComponents) {
    catalog.set(c.code, {
      code: c.code,
      name: c.name,
      kind: c.kind,
      partOfGross: c.part_of_gross,
      partOfPfWages: c.part_of_pf_wages,
      prorateOnLop: c.prorate_on_lop,
      displayOrder: c.display_order,
    });
  }

  // 4. Load variable inputs for this run
  const variableInputs = await trx
    .selectFrom('pay.inputs')
    .selectAll()
    .where('run_id', '=', runId)
    .execute();

  const inputsByEmp = new Map<
    number,
    { componentCode: string; amountPaise: Paise; note: string }[]
  >();
  for (const inp of variableInputs) {
    const list = inputsByEmp.get(inp.employee_id) ?? [];
    list.push({
      componentCode: inp.component_code,
      amountPaise: parseRupees(inp.amount),
      note: inp.note,
    });
    inputsByEmp.set(inp.employee_id, list);
  }

  // 5. Load scheduled arrears for this run
  const arrearsRows = await trx
    .selectFrom('pay.arrears')
    .selectAll()
    .where((eb) =>
      eb.or([
        eb('paid_in_run_id', '=', runId),
        eb('paid_in_run_id', 'is', null).and('for_month', '<=', monthStr as unknown as Date),
      ]),
    )
    .execute();

  const arrearsByEmp = new Map<
    number,
    { componentCode: string; amountPaise: Paise; note?: string }[]
  >();
  for (const arr of arrearsRows) {
    const list = arrearsByEmp.get(arr.employee_id) ?? [];
    list.push({
      componentCode: arr.component_code,
      amountPaise: parseRupees(arr.amount),
      note: `Arrears for ${String(arr.for_month)}`,
    });
    arrearsByEmp.set(arr.employee_id, list);
  }

  // Process employees and persist inside a transaction
  // Clear any prior draft computations for this run
  await trx.deleteFrom('pay.payroll_items').where('run_id', '=', runId).execute();

  let totalGrossPaise = paise(0);
  let totalNetPaise = paise(0);
  let negativeNetCount = 0;
  let computedCount = 0;

  for (const emp of employees) {
    if (!emp.doj) throw new Error(`Employee #${String(emp.id)} has no joining date.`);
    const from = formatDbDate(emp.doj) > monthStr ? formatDbDate(emp.doj) : monthStr;
    const exitUntil = emp.dol ? addDaysIso(formatDbDate(emp.dol), 1) : monthUntil;
    const until = exitUntil < monthUntil ? exitUntil : monthUntil;
    const salaries = await trx
      .selectFrom('pay.employee_salaries')
      .selectAll()
      .where('employee_id', '=', emp.id)
      .where('effective_from', '<', sql<Date>`${until}::date`)
      .where('effective_to', '>', sql<Date>`${from}::date`)
      .execute();
    const salaryRow = salaries[0];
    if (
      salaries.length !== 1 ||
      !salaryRow ||
      formatDbDate(salaryRow.effective_from) > from ||
      formatDbDate(salaryRow.effective_to) < until
    ) {
      throw new Error(
        `Employee #${String(emp.id)} requires complete effective salary segments for ${from} to ${until}.`,
      );
    }
    if (Object.keys(salaryRow.component_amounts).length === 0) {
      throw new Error(`Employee #${String(emp.id)} has an empty salary component snapshot.`);
    }
    const componentAmountsPaise = salarySnapshotToPaise(salaryRow.component_amounts);
    const payableDays = await readLockedPayableDays(trx, emp.id, from, until);
    // Approved OT consumption and configured rate policy are still required
    // before OT can be included. Detected day-record minutes are not pay.
    const approvedOt = await trx
      .selectFrom('att.overtime_entries')
      .select('id')
      .where('employee_id', '=', emp.id)
      .where('status', '=', 'approved')
      .where('payroll_item_id', 'is', null)
      .where('comp_off_credit_id', 'is', null)
      .where('work_date', '>=', sql<Date>`${from}::date`)
      .where('work_date', '<', sql<Date>`${until}::date`)
      .executeTakeFirst();
    if (approvedOt)
      throw new Error(
        `Employee #${String(emp.id)} has approved OT awaiting configured rate and consumption integration.`,
      );
    const otMinutes = 0;

    // Check hold status
    const hold = await new SalaryHoldsService(trx).getActiveHold(emp.id, monthStr);

    const computed = computeEmployeePayroll(
      {
        employeeId: emp.id,
        salaryComponentsPaise: componentAmountsPaise,
        daysInMonth,
        payableDays,
        otMinutes,
        variableInputs: inputsByEmp.get(emp.id) ?? [],
        arrears: arrearsByEmp.get(emp.id) ?? [],
        hold,
      },
      catalog,
    );

    if (computed.isNegativeNet) {
      negativeNetCount++;
    }

    totalGrossPaise = paise(totalGrossPaise + computed.grossPaise);
    totalNetPaise = paise(totalNetPaise + computed.netPayPaise);
    computedCount++;

    // Persist payroll item
    const item = await trx
      .insertInto('pay.payroll_items')
      .values({
        run_id: runId,
        employee_id: emp.id,
        days_in_month: String(computed.daysInMonth),
        payable_days: String(computed.payableDays),
        lop_days: String(computed.lopDays),
        lop_reversal_days: String(computed.lopReversalDays),
        ot_minutes: computed.otMinutes,
        gross: decimalRupees(computed.grossPaise),
        total_deductions: decimalRupees(computed.totalDeductionsPaise),
        net_pay: decimalRupees(computed.netPayPaise),
        payment_status: computed.paymentStatus,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // Persist item lines
    if (computed.lines.length > 0) {
      await trx
        .insertInto('pay.payroll_item_lines')
        .values(
          computed.lines.map((l) => ({
            item_id: item.id,
            component_code: l.componentCode,
            amount: decimalRupees(l.amountPaise),
            calc_note: l.calcNote,
          })),
        )
        .execute();
    }
  }

  // Mark run as computed
  await trx
    .updateTable('pay.payroll_runs')
    .set({
      status: 'computed',
      computed_at: new Date(),
    })
    .where('id', '=', runId)
    .execute();

  await writeAudit(trx, {
    actorUserId,
    entity: 'pay.payroll_runs',
    entityId: runId,
    action: 'payroll_run_computed',
    newValue: JSON.stringify({
      employeeCount: computedCount,
      totalGrossRupees: toRupees(totalGrossPaise),
      totalNetRupees: toRupees(totalNetPaise),
      negativeNetCount,
    }),
  });

  return {
    employeeCount: computedCount,
    grossPaise: totalGrossPaise,
    netPaise: totalNetPaise,
    negativeNetCount,
  };
}
