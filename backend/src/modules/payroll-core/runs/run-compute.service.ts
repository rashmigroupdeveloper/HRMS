/** PAY-03/04/08/16: compute results inside the caller's locked run transaction. */
import { epsEligibility } from '../statutory/eps-eligibility.js';
import type { Kysely, Selectable } from 'kysely';
import { sql } from 'kysely';
import type { Database, PayrollRunsTable } from '../../../core/db/types.js';
import { addDaysIso, formatDbDate } from '../../../core/dates.js';
import { writeAudit } from '../../../core/audit/audit.service.js';
import { DomainError } from '../../../core/errors/index.js';
import { type Paise, paise, toRupees, parseRupees, decimalRupees, add } from '../../../core/money/index.js';
import { getTypedSetting } from '../../settings/index.js';
import { validateRunTransition } from './run-state-machine.js';
import { assertIndiaPayroll } from './run-country.js';
import { readLockedDayFacts } from './attendance.repository.js';
import { evaluatePayableDays, parseLopDivisor } from './payable-days.js';
import { resolveAttendanceWindow } from '../../../core/db/attendance-cycle.js';
import { readPlannedOffDays } from '../../../core/db/holiday-calendar.js';
import { computeEmployeePayroll, computeProfessionalTax, type ComponentMetadata, type RecoveryInput } from '../engine/compute-engine.js';
import { SalaryHoldsService } from '../holds/holds.service.js';
import { salarySnapshotToPaise } from '../salaries/salary-snapshot.js';
import { isApprentice } from '../statutory/apprentice.js';
import { computeLwf } from '../statutory/lwf.js';
import { roundMonthlyTds } from '../../../core/money/rounding-policy.js';
import {
  esicPeriodStart,
  financialYear,
  loadPtSlabs,
  loadStatutoryRates,
  projectAnnualTax,
  resolvePfWageBasis,
} from './statutory-context.js';

export interface RunComputationResult {
  employeeCount: number;
  grossPaise: Paise;
  netPaise: Paise;
  negativeNetCount: number;
  employerCostPaise: Paise;
  /** Employees left out of the run, with the reason (fix the data and recompute). */
  exceptions: { employeeId: number; ecode: string; reason: string }[];
}

/** Monthly interest on a reducing balance; zero-interest loans recover principal only. */
export function loanInstalment(loan: { outstanding: string; emi: string; interest_rate: string; loan_type: string }): { principalPaise: Paise; interestPaise: Paise } {
  const outstanding = parseRupees(loan.outstanding);
  const emi = parseRupees(loan.emi);
  const rate = Number(loan.interest_rate);
  const interest = loan.loan_type === 'loan_diminishing' && rate > 0 ? Math.round((outstanding * rate) / 1200) : 0;
  const principal = Math.max(0, Math.min(outstanding, emi - interest));
  return { principalPaise: paise(principal), interestPaise: paise(interest) };
}

export async function computeLockedRun(
  trx: Kysely<Database>,
  run: Selectable<PayrollRunsTable>,
  actorUserId: number,
): Promise<RunComputationResult> {
  const runId = run.id;
  const validation = validateRunTransition({ fromStatus: run.status, toStatus: 'computed', attendanceLockId: run.attendance_lock_id, actorUserId });
  if (!validation.valid) throw new DomainError(validation.error ?? 'Run cannot be computed now', 'CONFLICT');
  await assertIndiaPayroll(trx, run.company_id);

  const monthStr = formatDbDate(run.month);
  const [year = 0, month = 0] = monthStr.split('-').map(Number);
  const calendarDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthUntil = addDaysIso(monthStr, calendarDays);
  const attendanceLock = await trx
    .selectFrom('att.month_locks')
    .select('id')
    .where('id', '=', run.attendance_lock_id)
    .where('company_id', '=', run.company_id)
    .where('month', '=', sql<Date>`${monthStr}::date`)
    .executeTakeFirst();
  if (!attendanceLock) throw new DomainError('Payroll attendance lock must belong to this company and month.', 'CONFLICT');

  // Policy and statutory data for the month (never hardcoded).
  const rates = await loadStatutoryRates(trx, monthStr);
  const ptByState = await loadPtSlabs(trx, monthStr);
  const pfSetting = await getTypedSetting<string>(trx, 'pay.pf_wage_base', 'string', 'ACTUAL');
  const lwfInPayroll = await getTypedSetting<boolean>(trx, 'pay.lwf_deduct_in_payroll', 'boolean', false);
  const negativeNetPolicy = await getTypedSetting<string>(trx, 'pay.negative_net_policy', 'string', 'carry_forward');
  // Item 4 (C-16/C-17/C-28): LOP divisor, attendance cycle and sandwich policy.
  const lopDivisor = parseLopDivisor(await getTypedSetting<string>(trx, 'pay.lop_divisor', 'string', 'CALENDAR'));
  const sandwichRule = await getTypedSetting<boolean>(trx, 'att.sandwich_rule', 'boolean', false);
  const attWindow = await resolveAttendanceWindow(trx, run.company_id, monthStr);
  const company = await trx.selectFrom('core.companies').select(['pf_wage_basis']).where('id', '=', run.company_id).executeTakeFirstOrThrow();
  const fy = financialYear(monthStr);
  const esicStart = esicPeriodStart(monthStr);

  const employees = await trx
    .selectFrom('core.employees as e')
    .leftJoin('core.locations as l', 'l.id', 'e.location_id')
    .select(['e.id', 'e.ecode', 'e.doj', 'e.dol', 'e.status', 'e.category', 'e.contract_type', 'e.pf_applicable', 'e.esic_applicable', 'e.pf_wage_basis', 'e.tax_regime', 'l.state_code',
      'e.dob', 'e.eps_eligible', 'e.epf_member_before_sep2014', 'e.epf_first_enrolled_on', 'e.epf_first_wages', 'e.international_worker'])
    .where('e.company_id', '=', run.company_id)
    .where('e.status', 'in', ['active', 'on_notice', 'exited'])
    .where((eb) => eb.or([eb('e.doj', 'is', null), eb('e.doj', '<', sql<Date>`${monthUntil}::date`)]))
    .where((eb) => eb.or([eb('e.dol', 'is', null), eb('e.dol', '>=', sql<Date>`${monthStr}::date`)]))
    .orderBy('e.id')
    .execute();

  const rawComponents = await trx.selectFrom('pay.salary_components').selectAll().execute();
  const catalog = new Map<string, ComponentMetadata>();
  for (const c of rawComponents) {
    catalog.set(c.code, { code: c.code, name: c.name, kind: c.kind, partOfGross: c.part_of_gross, partOfPfWages: c.part_of_pf_wages, prorateOnLop: c.prorate_on_lop, displayOrder: c.display_order });
  }

  // REQ-003: PF wages at joining (earliest revision) stand in for Form 11 "first EPF wages" when not captured.
  const firstRevisions = employees.length === 0 ? [] : await trx.selectFrom('pay.employee_salaries')
    .distinctOn('employee_id').select(['employee_id', 'component_amounts'])
    .where('employee_id', 'in', employees.map((e) => e.id)).orderBy('employee_id').orderBy('effective_from').execute();
  const joiningPfWages = new Map<number, number>();
  for (const rev of firstRevisions) {
    const amounts = salarySnapshotToPaise(rev.component_amounts);
    joiningPfWages.set(rev.employee_id, Object.entries(amounts).reduce((s, [code, v]) => (catalog.get(code)?.partOfPfWages ? s + Number(v) : s), 0));
  }

  const variableInputs = await trx.selectFrom('pay.inputs').selectAll().where('run_id', '=', runId).execute();
  const inputsByEmp = new Map<number, { componentCode: string; amountPaise: Paise; note: string }[]>();
  for (const inp of variableInputs) {
    const list = inputsByEmp.get(inp.employee_id) ?? [];
    list.push({ componentCode: inp.component_code, amountPaise: parseRupees(inp.amount), note: inp.note });
    inputsByEmp.set(inp.employee_id, list);
  }

  const arrearsRows = await trx
    .selectFrom('pay.arrears')
    .selectAll()
    .where((eb) => eb.or([eb('paid_in_run_id', '=', runId), eb('paid_in_run_id', 'is', null).and('for_month', '<=', sql<Date>`${monthStr}::date`)]))
    .execute();
  const arrearsByEmp = new Map<number, { componentCode: string; amountPaise: Paise; note?: string }[]>();
  for (const arr of arrearsRows) {
    const list = arrearsByEmp.get(arr.employee_id) ?? [];
    list.push({ componentCode: arr.component_code, amountPaise: parseRupees(arr.amount), note: `Arrears for ${formatDbDate(arr.for_month)}` });
    arrearsByEmp.set(arr.employee_id, list);
  }

  // Recompute is idempotent: release what a previous compute of this run consumed.
  const priorItems = trx.selectFrom('pay.payroll_items').select('id').where('run_id', '=', runId);
  await trx.updateTable('att.overtime_entries').set({ payroll_item_id: null }).where('payroll_item_id', 'in', priorItems).execute();
  await trx.updateTable('pay.recovery_carry_forwards').set({ consumed_run_id: null }).where('consumed_run_id', '=', runId).execute();
  await trx.deleteFrom('pay.payroll_items').where('run_id', '=', runId).execute();
  await trx.deleteFrom('pay.recovery_carry_forwards').where('from_run_id', '=', runId).execute();

  // A provisional short-recovery is not a settled debt. Keep earlier settled
  // origins stable until this run has claimed their balances; reopen takes
  // the same origin-before-carry lock order.
  const recoveryOrigins = await trx.selectFrom('pay.payroll_runs').select('id')
    .where('company_id', '=', run.company_id).where('status', 'in', ['finalized', 'paid'])
    .where('month', '<', sql<Date>`${monthStr}::date`).orderBy('month', 'desc').orderBy('id')
    .forShare().execute();
  const recoveryOriginIds = recoveryOrigins.map(origin => origin.id);

  let totalGrossPaise = paise(0);
  let totalNetPaise = paise(0);
  let totalEmployerPaise = paise(0);
  let negativeNetCount = 0;
  let computedCount = 0;
  const exceptions: RunComputationResult['exceptions'] = [];

  for (const emp of employees) {
    const skip = (reason: string): void => { exceptions.push({ employeeId: emp.id, ecode: emp.ecode, reason }); };
    if (!emp.doj) { skip('No joining date on record'); continue; }
    const doj = formatDbDate(emp.doj);
    const from = doj > monthStr ? doj : monthStr;
    const exitUntil = emp.dol ? addDaysIso(formatDbDate(emp.dol), 1) : monthUntil;
    const until = exitUntil < monthUntil ? exitUntil : monthUntil;

    // P-03: a leaver whose F&F already pays these days is not paid again here.
    const fnf = await trx
      .selectFrom('pay.fnf_settlements')
      .select(['id', 'days_payable', 'run_id'])
      .where('employee_id', '=', emp.id)
      .where('status', 'in', ['computed', 'approved', 'paid'])
      .where('last_working_day', '>=', sql<Date>`${monthStr}::date`)
      .where('last_working_day', '<', sql<Date>`${monthUntil}::date`)
      .executeTakeFirst();
    if (fnf && Number(fnf.days_payable) > 0 && fnf.run_id !== runId) {
      skip(`Final month is paid through F&F settlement #${String(fnf.id)}`);
      continue;
    }

    const salaries = await trx
      .selectFrom('pay.employee_salaries')
      .selectAll()
      .where('employee_id', '=', emp.id)
      .where('effective_from', '<', sql<Date>`${until}::date`)
      .where('effective_to', '>', sql<Date>`${from}::date`)
      .execute();
    const salaryRow = salaries[0];
    if (salaries.length !== 1 || !salaryRow || formatDbDate(salaryRow.effective_from) > from || formatDbDate(salaryRow.effective_to) < until) {
      skip(`Needs exactly one effective salary covering ${from} to ${until}`);
      continue;
    }
    if (Object.keys(salaryRow.component_amounts).length === 0) { skip('Salary has no components'); continue; }
    const componentAmountsPaise = salarySnapshotToPaise(salaryRow.component_amounts);
    const contractedGross = Object.entries(componentAmountsPaise).reduce((s, [code, v]) => {
      const m = catalog.get(code);
      return m?.kind === 'earning' && m.partOfGross ? add(s, v) : s;
    }, paise(0));
    // Attendance facts come from the cycle window (clipped to employment); pay-month
    // days after the cycle cut-off are paid as assumed present.
    const attFrom = doj > attWindow.from ? doj : attWindow.from;
    const attUntil = exitUntil < attWindow.until ? exitUntil : attWindow.until;
    const facts = await readLockedDayFacts(trx, emp.id, attFrom, attUntil);
    const needsCalendar = lopDivisor === 'FIXED_26' || lopDivisor === 'WORKING_DAYS';
    const { daysInMonth, payableDays } = evaluatePayableDays({
      divisor: lopDivisor,
      sandwich: sandwichRule,
      monthFrom: monthStr,
      monthUntil,
      employedFrom: from,
      employedUntil: until,
      facts,
      plannedOffDays: needsCalendar ? await readPlannedOffDays(trx, emp.id, monthStr, monthUntil) : new Set<string>(),
    });

    // P-06: approved, unconsumed OT in the period is paid and consumed.
    const otRows = await trx
      .selectFrom('att.overtime_entries')
      .select(['id', 'approved_minutes'])
      .where('employee_id', '=', emp.id)
      .where('status', '=', 'approved')
      .where('payroll_item_id', 'is', null)
      .where('comp_off_credit_id', 'is', null)
      .where('work_date', '>=', sql<Date>`${attFrom}::date`)
      .where('work_date', '<', sql<Date>`${attUntil}::date`)
      .execute();
    const otMinutes = otRows.reduce((s, r) => s + (r.approved_minutes ?? 0), 0);

    // P-08: active loans recover their instalment from the start month.
    const loans = await trx
      .selectFrom('pay.loans')
      .select(['id', 'outstanding', 'emi', 'interest_rate', 'loan_type'])
      .where('employee_id', '=', emp.id)
      .where('status', '=', 'active')
      .where('start_month', '<=', sql<Date>`${monthStr}::date`)
      .where('outstanding', '>', '0')
      .orderBy('id')
      .execute();
    const recoveries: RecoveryInput[] = loans.map((l) => {
      const inst = loanInstalment(l);
      return {
        componentCode: 'LOAN_EMI',
        amountPaise: paise(inst.principalPaise + inst.interestPaise),
        note: `Loan #${String(l.id)} instalment (principal ₹${String(toRupees(inst.principalPaise))}, interest ₹${String(toRupees(inst.interestPaise))})`,
        source: { kind: 'loan', loanId: l.id },
      };
    });
    const carried = recoveryOriginIds.length === 0 ? [] : await trx
      .selectFrom('pay.recovery_carry_forwards')
      .selectAll()
      .where('employee_id', '=', emp.id)
      .where('consumed_run_id', 'is', null)
      .where('from_run_id', 'in', recoveryOriginIds)
      .orderBy('id').forUpdate()
      .execute();
    for (const c of carried) {
      recoveries.push({ componentCode: c.component_code, amountPaise: parseRupees(c.amount), note: `Carried forward: ${c.note}`, source: { kind: 'carry_forward', carryId: c.id } });
    }

    const apprentice = isApprentice(emp.category ?? '', emp.contract_type ?? '');
    const stateCode = emp.state_code ?? 'WB';
    const ptSlabs = ptByState.get(stateCode) ?? [];

    // P-05: ESIC only for covered employees whose wages at the start of the
    // contribution period were within the ceiling; coverage then holds for the period.
    let esicCovered = false;
    if (emp.esic_applicable && !apprentice) {
      const periodRef = doj > esicStart ? doj : esicStart;
      const atStart = await trx
        .selectFrom('pay.employee_salaries')
        .select('component_amounts')
        .where('employee_id', '=', emp.id)
        .where('effective_from', '<=', sql<Date>`${periodRef}::date`)
        .orderBy('effective_from', 'desc')
        .executeTakeFirst();
      const basis = atStart ? salarySnapshotToPaise(atStart.component_amounts) : componentAmountsPaise;
      const grossAtStart = Object.entries(basis).reduce((s, [code, v]) => {
        const m = catalog.get(code);
        return m?.kind === 'earning' && m.partOfGross && code !== 'OT' ? s + v : s;
      }, 0);
      esicCovered = grossAtStart <= rates.esicCeilingPaise;
    }

    // P-04 / PAY-14: TDS applies when the stipend is taxable. PF, ESIC and bonus do not (docs/10 §9).
    const ptMonthly = computeProfessionalTax(contractedGross, contractedGross, ptSlabs);
    const annualTax = await projectAnnualTax(trx, { employeeId: emp.id, regime: emp.tax_regime, contractedMonthlyGrossPaise: contractedGross, monthlyPtPaise: ptMonthly, fy });
    const effectiveDays = Math.min(daysInMonth, payableDays);
    const monthlyTdsPaise = roundMonthlyTds(paise(Math.round((annualTax / 12) * (effectiveDays / daysInMonth))));

    const lwfPaise = lwfInPayroll ? computeLwf(month, stateCode).eeLwfPaise : paise(0);
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
        otherDeductions: recoveries,
        hold,
        rates,
        pf: {
          applicable: emp.pf_applicable,
          wageBasis: resolvePfWageBasis(pfSetting, company.pf_wage_basis, emp.pf_wage_basis),
          internationalWorker: emp.international_worker,
          epsEligible: epsEligibility({
            monthStart: monthStr, dob: emp.dob ? formatDbDate(emp.dob) : null, doj: formatDbDate(emp.doj),
            epsEligible: emp.eps_eligible, memberBeforeSep2014: emp.epf_member_before_sep2014,
            firstEnrolledOn: emp.epf_first_enrolled_on ? formatDbDate(emp.epf_first_enrolled_on) : null,
            firstEnrolmentPfWagesPaise: emp.epf_first_wages !== null ? Math.round(Number(emp.epf_first_wages) * 100) : null,
            joiningPfWagesPaise: joiningPfWages.get(emp.id) ?? null,
          }).eligible,
        },
        esicCovered,
        ptSlabs,
        stateCode,
        monthlyTdsPaise,
        lwfPaise,
        apprentice,
        negativeNetPolicy: negativeNetPolicy === 'flag' ? 'flag' : 'carry_forward',
      },
      catalog,
    );

    if (computed.isNegativeNet) negativeNetCount++;
    totalGrossPaise = add(totalGrossPaise, computed.grossPaise);
    totalNetPaise = add(totalNetPaise, computed.netPayPaise);
    totalEmployerPaise = add(totalEmployerPaise, computed.employerCostPaise);
    computedCount++;

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
        employer_cost: decimalRupees(computed.employerCostPaise),
        payment_status: computed.paymentStatus,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    if (computed.lines.length > 0) {
      await trx
        .insertInto('pay.payroll_item_lines')
        .values(computed.lines.map((l) => ({
          item_id: item.id,
          component_code: l.componentCode,
          amount: decimalRupees(l.amountPaise),
          calc_note: l.calcNote,
          loan_id: l.source?.kind === 'loan' ? l.source.loanId : null,
          carry_forward_id: l.source?.kind === 'carry_forward' ? l.source.carryId : null,
        })))
        .execute();
    }
    if (computed.paymentStatus !== 'hold_process') {
      if (otRows.length > 0) {
        await trx.updateTable('att.overtime_entries').set({ payroll_item_id: item.id }).where('id', 'in', otRows.map((r) => r.id)).execute();
      }
      if (carried.length > 0) {
        await trx.updateTable('pay.recovery_carry_forwards').set({ consumed_run_id: runId }).where('id', 'in', carried.map((c) => c.id)).execute();
      }
      // Trimmed non-loan recoveries become next run's opening recovery (loans simply stay outstanding).
      const carryRows = new Map<string, Paise>();
      for (const cf of computed.carryForward) {
        if (cf.source?.kind === 'loan') continue;
        carryRows.set(cf.componentCode, add(carryRows.get(cf.componentCode) ?? paise(0), cf.amountPaise));
      }
      for (const [code, amount] of carryRows) {
        await trx.insertInto('pay.recovery_carry_forwards').values({ employee_id: emp.id, component_code: code, amount: decimalRupees(amount), from_run_id: runId, note: `${code} short-recovered in ${monthStr}` }).execute();
      }
    }
  }

  await trx.updateTable('pay.payroll_runs').set({ status: 'computed', computed_at: new Date() }).where('id', '=', runId).execute();
  await writeAudit(trx, {
    actorUserId,
    entity: 'pay.payroll_runs',
    entityId: runId,
    action: 'payroll_run_computed',
    newValue: JSON.stringify({
      employeeCount: computedCount,
      totalGrossRupees: toRupees(totalGrossPaise),
      totalNetRupees: toRupees(totalNetPaise),
      employerCostRupees: toRupees(totalEmployerPaise),
      negativeNetCount,
      exceptions,
    }),
  });

  return { employeeCount: computedCount, grossPaise: totalGrossPaise, netPaise: totalNetPaise, negativeNetCount, employerCostPaise: totalEmployerPaise, exceptions };
}
