/** D3/PAY-03: India statutory payroll is opt-in on the legal-entity master. */
import type { Kysely } from 'kysely';
import type { Database } from '../../../core/db/types.js';
import { DomainError, NotFoundError } from '../../../core/errors/index.js';

export async function assertIndiaPayroll(db: Kysely<Database>, companyId: number): Promise<void> {
  const company = await db.selectFrom('core.companies').select('is_india_payroll')
    .where('id', '=', companyId).forShare().executeTakeFirst();
  if (!company) throw new NotFoundError('Payroll company not found');
  if (!company.is_india_payroll) throw new DomainError('This legal entity is not enabled for India payroll', 'CONFLICT');
}
