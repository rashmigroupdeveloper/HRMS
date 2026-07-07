/**
 * Two-source employee import (CORE-12; strategy per doc 11 §0.1):
 *   Step 1  importEmsSeed     — EMS users: identity, hierarchy, login hashes.
 *   Step 2  importGreythrEnrich — greytHR export: DOB/DOJ/statutory/bank.
 * Nothing is silently dropped: every skipped/suspicious row lands in the
 * exception report for HR review.
 */
import type { Kysely, Transaction } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import {
  COMPANY_ALIASES,
  ECODE_PATTERN,
  emsUserSchema,
  greythrRowSchema,
  type ImportException,
} from './import.schemas.js';

export interface EmsImportSummary {
  imported: number;
  usersCreated: number;
  managersLinked: number;
  exceptions: ImportException[];
}

/** Normalize free-text names: trim + collapse whitespace (dedupe key = lowercase). */
function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

async function getOrCreateByName(
  trx: Transaction<Database>,
  table: 'core.departments' | 'core.designations',
  raw: string,
  cache: Map<string, number>,
): Promise<number> {
  const name = normalizeName(raw);
  const key = name.toLowerCase();
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const existing = await trx
    .selectFrom(table)
    .select('id')
    .where((eb) => eb(eb.fn('lower', ['name']), '=', key))
    .executeTakeFirst();
  if (existing) {
    cache.set(key, existing.id);
    return existing.id;
  }
  const inserted = await trx.insertInto(table).values({ name }).returning('id').executeTakeFirstOrThrow();
  cache.set(key, inserted.id);
  return inserted.id;
}

export async function importEmsSeed(db: Kysely<Database>, rawRows: unknown[]): Promise<EmsImportSummary> {
  const exceptions: ImportException[] = [];
  let imported = 0;
  let usersCreated = 0;
  let managersLinked = 0;

  await db.transaction().execute(async (trx) => {
    const companies = await trx.selectFrom('core.companies').select(['id', 'name', 'ecode_prefix']).execute();
    const companyByName = new Map(companies.map((c) => [c.name, c]));
    const deptCache = new Map<string, number>();
    const desigCache = new Map<string, number>();
    const managerLinks: { ecode: string; rm: string | null; hod: string | null }[] = [];

    for (const [index, raw] of rawRows.entries()) {
      const parsed = emsUserSchema.safeParse(raw);
      if (!parsed.success) {
        exceptions.push({ userid: `row#${index}`, issue: `invalid row: ${parsed.error.issues[0]?.message ?? '?'}` });
        continue;
      }
      const row = parsed.data;

      const canonicalName = COMPANY_ALIASES[row.company.trim()];
      const company = canonicalName ? companyByName.get(canonicalName) : undefined;
      if (!company) {
        exceptions.push({ userid: row.userid, issue: `unknown company: ${row.company}` });
        continue;
      }

      // Strict series check: canonical prefix followed by digits ONLY —
      // catches 'EIPLL366' (double L) where a startsWith would not.
      const seriesPattern = new RegExp(`^${company.ecode_prefix}\\d{3,7}$`);
      if (!ECODE_PATTERN.test(row.userid) || !seriesPattern.test(row.userid)) {
        exceptions.push({
          userid: row.userid,
          issue: `userid does not match ${company.ecode_prefix} series — verify with HR (doc 11 §0.1 typo list)`,
        });
        continue;
      }

      if (!row.phone) {
        exceptions.push({ userid: row.userid, issue: 'missing phone (imported without mobile)' });
      }

      const [firstName, ...rest] = normalizeName(row.username).split(' ');
      const employee = await trx
        .insertInto('core.employees')
        .values({
          ecode: row.userid,
          company_id: company.id,
          first_name: firstName ?? row.userid,
          last_name: rest.length > 0 ? rest.join(' ') : null,
          gender: row.gender ?? null,
          mobile: row.phone ?? null,
          work_email: row.email ?? null,
          department_id: row.department ? await getOrCreateByName(trx, 'core.departments', row.department, deptCache) : null,
          designation_id: row.designation
            ? await getOrCreateByName(trx, 'core.designations', row.designation, desigCache)
            : null,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      imported += 1;

      if (row.email && row.encrypted_password) {
        // Re-imports RELINK an existing account (EMS is the identity source at
        // seed time): fresh hash, fresh employee link, reactivated.
        await trx
          .insertInto('core.users')
          .values({ email: row.email, password_hash: row.encrypted_password, employee_id: employee.id })
          .onConflict((oc) =>
            oc.column('email').doUpdateSet({
              password_hash: row.encrypted_password ?? '',
              employee_id: employee.id,
              is_active: true,
            }),
          )
          .execute();
        usersCreated += 1;
      } else {
        exceptions.push({ userid: row.userid, issue: 'no email or password hash — login account not created' });
      }

      managerLinks.push({ ecode: row.userid, rm: row.reporting_manager_userid ?? null, hod: row.hod_userid ?? null });
    }

    // Second pass — resolve manager/HOD e-codes now that everyone exists.
    const all = await trx.selectFrom('core.employees').select(['id', 'ecode']).execute();
    const idByEcode = new Map(all.map((e) => [e.ecode, e.id]));

    for (const link of managerLinks) {
      const selfId = idByEcode.get(link.ecode);
      if (selfId === undefined) continue;
      const rmId = link.rm ? idByEcode.get(link.rm) : undefined;
      const hodId = link.hod ? idByEcode.get(link.hod) : undefined;

      if (link.rm && rmId === undefined) {
        exceptions.push({ userid: link.ecode, issue: `reporting manager not found: ${link.rm}` });
      }
      if (link.hod && hodId === undefined) {
        exceptions.push({ userid: link.ecode, issue: `HOD not found: ${link.hod}` });
      }
      if (rmId !== undefined || hodId !== undefined) {
        await trx
          .updateTable('core.employees')
          .set({
            ...(rmId !== undefined ? { reporting_manager_id: rmId } : {}),
            ...(hodId !== undefined ? { functional_manager_id: hodId } : {}),
          })
          .where('id', '=', selfId)
          .execute();
        managersLinked += 1;
      }
    }

    await writeAudit(trx, {
      action: 'create',
      entity: 'core.employees',
      field: 'ems_seed_import',
      newValue: JSON.stringify({ imported, usersCreated, exceptions: exceptions.length }),
    });
  });

  return { imported, usersCreated, managersLinked, exceptions };
}

export interface EnrichSummary {
  updated: number;
  unmatched: string[];
}

export async function importGreythrEnrich(db: Kysely<Database>, rawRows: unknown[]): Promise<EnrichSummary> {
  const unmatched: string[] = [];
  let updated = 0;

  await db.transaction().execute(async (trx) => {
    for (const raw of rawRows) {
      const parsed = greythrRowSchema.safeParse(raw);
      if (!parsed.success) {
        unmatched.push(`invalid row: ${parsed.error.issues[0]?.message ?? '?'}`);
        continue;
      }
      const row = parsed.data;

      const employee = await trx
        .selectFrom('core.employees')
        .select('id')
        .where('ecode', '=', row.userid)
        .executeTakeFirst();
      if (!employee) {
        unmatched.push(row.userid);
        continue;
      }

      await trx
        .updateTable('core.employees')
        .set({
          ...(row.dob ? { dob: new Date(row.dob) } : {}),
          ...(row.doj ? { doj: new Date(row.doj) } : {}),
          ...(row.gender ? { gender: row.gender } : {}),
          ...(row.category ? { category: row.category } : {}),
          ...(row.pan ? { pan: row.pan } : {}),
          ...(row.aadhaar ? { aadhaar: row.aadhaar } : {}),
          ...(row.uan ? { uan: row.uan } : {}),
          ...(row.pf_number ? { pf_number: row.pf_number } : {}),
          ...(row.esic_ip_number ? { esic_ip_number: row.esic_ip_number } : {}),
          ...(row.bank_name ? { bank_name: row.bank_name } : {}),
          ...(row.bank_account ? { bank_account: row.bank_account } : {}),
          ...(row.bank_ifsc ? { bank_ifsc: row.bank_ifsc } : {}),
        })
        .where('id', '=', employee.id)
        .execute();
      updated += 1;
    }

    await writeAudit(trx, {
      action: 'update',
      entity: 'core.employees',
      field: 'greythr_enrich_import',
      newValue: JSON.stringify({ updated, unmatched: unmatched.length }),
    });
  });

  return { updated, unmatched };
}
