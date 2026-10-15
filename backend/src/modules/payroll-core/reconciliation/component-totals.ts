/** PAY-04/R20: repeated component lines are additive facts, never replacements. */
import { add, paise, parseRupees, type Paise } from '../../../core/money/index.js';

export function componentTotals(
  lines: readonly {
    employee_id: number;
    component_code: string;
    amount: string;
  }[],
): Map<number, Map<string, Paise>> {
  const result = new Map<number, Map<string, Paise>>();
  for (const line of lines) {
    let employee = result.get(line.employee_id);
    if (!employee) {
      employee = new Map();
      result.set(line.employee_id, employee);
    }
    employee.set(
      line.component_code,
      add(employee.get(line.component_code) ?? paise(0), parseRupees(line.amount)),
    );
  }
  return result;
}
