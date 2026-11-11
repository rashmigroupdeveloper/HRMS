/** PAY-15: payroll-owned eligibility and the cap effective on the approved exit date. */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../core/db/types.js';
import { DomainError } from '../../../core/errors/index.js';
import { parseRupees, type Paise } from '../../../core/money/index.js';
import { getTypedSetting } from '../../settings/index.js';
import type { GratuityEligibilityMode } from './gratuity-calculator.js';

export async function loadGratuityPolicy(db: Kysely<Database>, exitDate: string): Promise<{ mode: GratuityEligibilityMode; capPaise: Paise }> {
  const mode = await getTypedSetting<string>(db, 'pay.gratuity_eligibility_mode', 'string', 'LIBERAL_4Y240D');
  if (mode !== 'STRICT_5Y' && mode !== 'LIBERAL_4Y240D')
    throw new DomainError('Configure a valid gratuity eligibility mode before computing F&F');
  const cap = await db.selectFrom('pay.statutory_rates').select('value')
    .where('scheme', '=', 'GRATUITY').where('param', '=', 'cap')
    .where('effective_from', '<=', sql<Date>`${exitDate}::date`)
    .orderBy('effective_from', 'desc').executeTakeFirst();
  // Compatibility with installations predating configurable gratuity; never changes an existing rate.
  const capPaise = cap ? parseRupees(cap.value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')) : parseRupees('2000000');
  if (capPaise <= 0) throw new DomainError('Configure a positive gratuity cap before computing F&F');
  return { mode, capPaise };
}
