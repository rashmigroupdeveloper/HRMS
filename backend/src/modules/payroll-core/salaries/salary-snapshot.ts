/** PAY-02/04: salary assignment persists monthly integer paise, not rupees. */
import { paise, type Paise } from '../../../core/money/index.js';

export function salarySnapshotToPaise(snapshot: Record<string, number>): Record<string, Paise> {
  const result: Record<string, Paise> = {};
  for (const [code, amount] of Object.entries(snapshot)) {
    result[code] = paise(amount);
  }
  return result;
}
