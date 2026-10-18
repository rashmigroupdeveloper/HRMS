/**
 * Production master seed (acceptance bar: "seed for real company masters without demo data").
 * Reads a JSON file of the client's real masters and upserts them idempotently by natural key.
 * No employees, users or sample transactions are created. Usage:
 *   MASTERS_FILE=deploy/masters.json npm run seed:masters
 * File shape: see docs/deploy/masters.example.json.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import 'dotenv/config';
import { createDatabase } from '../db/database.js';
import type { Database } from '../db/types.js';
import { logger } from '../logger.js';

const code = z.string().trim().min(1).max(40);
const MastersFile = z.object({
  companies: z.array(z.object({ code, name: z.string().min(2), ecodePrefix: code, pan: z.string().optional(), tan: z.string().optional() })).default([]),
  orgUnits: z.array(z.object({ company: code, name: z.string().min(1), parent: z.string().optional() })).default([]),
  locations: z.array(z.object({ company: code, name: z.string().min(1), stateCode: z.string().length(2) })).default([]),
  costCenters: z.array(z.object({ company: code, code, name: z.string().min(1) })).default([]),
  departments: z.array(z.string().min(1)).default([]),
  designations: z.array(z.string().min(1)).default([]),
  grades: z.array(z.object({ code, name: z.string().min(1), rank: z.number().int() })).default([]),
});
export type MastersFileShape = z.input<typeof MastersFile>;

export async function seedMasters(db: Kysely<Database>, input: MastersFileShape): Promise<Record<string, number>> {
  const m = MastersFile.parse(input);
  const n: Record<string, number> = { companies: 0, orgUnits: 0, locations: 0, costCenters: 0, departments: 0, designations: 0, grades: 0 };
  return db.transaction().execute(async (tx) => {
    const companyId = new Map<string, number>();
    for (const c of m.companies) {
      const row = await tx.selectFrom('core.companies').select('id').where('code', '=', c.code).executeTakeFirst();
      if (row) { companyId.set(c.code, row.id); await tx.updateTable('core.companies').set({ name: c.name, ...(c.pan ? { pan: c.pan } : {}), ...(c.tan ? { tan: c.tan } : {}) }).where('id', '=', row.id).execute(); continue; }
      const ins = await tx.insertInto('core.companies').values({ code: c.code, name: c.name, ecode_prefix: c.ecodePrefix, pan: c.pan ?? null, tan: c.tan ?? null }).returning('id').executeTakeFirstOrThrow();
      companyId.set(c.code, ins.id); n['companies'] = (n['companies'] ?? 0) + 1;
    }
    const company = async (codeValue: string) => {
      const known = companyId.get(codeValue);
      if (known !== undefined) return known;
      const row = await tx.selectFrom('core.companies').select('id').where('code', '=', codeValue).executeTakeFirst();
      if (!row) throw new Error(`Unknown company code ${codeValue}`);
      companyId.set(codeValue, row.id); return row.id;
    };
    const bump = (k: string) => { n[k] = (n[k] ?? 0) + 1; };
    for (const u of m.orgUnits) {
      const cid = await company(u.company);
      if (await tx.selectFrom('core.org_units').select('id').where('company_id', '=', cid).where('name', '=', u.name).executeTakeFirst()) continue;
      const parent = u.parent ? (await tx.selectFrom('core.org_units').select('id').where('company_id', '=', cid).where('name', '=', u.parent).executeTakeFirst())?.id ?? null : null;
      if (u.parent && parent === null) throw new Error(`Org unit parent "${u.parent}" must be listed before "${u.name}"`);
      await tx.insertInto('core.org_units').values({ company_id: cid, name: u.name, parent_id: parent }).execute(); bump('orgUnits');
    }
    for (const l of m.locations) {
      const cid = await company(l.company);
      if (await tx.selectFrom('core.locations').select('id').where('company_id', '=', cid).where('name', '=', l.name).executeTakeFirst()) continue;
      await tx.insertInto('core.locations').values({ company_id: cid, name: l.name, state_code: l.stateCode.toUpperCase() }).execute(); bump('locations');
    }
    for (const c of m.costCenters) {
      const cid = await company(c.company);
      if (await tx.selectFrom('core.cost_centers').select('id').where('company_id', '=', cid).where('code', '=', c.code).executeTakeFirst()) continue;
      await tx.insertInto('core.cost_centers').values({ company_id: cid, code: c.code, name: c.name }).execute(); bump('costCenters');
    }
    for (const name of m.departments) {
      if (await tx.selectFrom('core.departments').select('id').where('name', '=', name).executeTakeFirst()) continue;
      await tx.insertInto('core.departments').values({ name }).execute(); bump('departments');
    }
    for (const name of m.designations) {
      if (await tx.selectFrom('core.designations').select('id').where('name', '=', name).executeTakeFirst()) continue;
      await tx.insertInto('core.designations').values({ name }).execute(); bump('designations');
    }
    for (const g of m.grades) {
      if (await tx.selectFrom('core.grades').select('id').where('code', '=', g.code).executeTakeFirst()) continue;
      await tx.insertInto('core.grades').values({ code: g.code, name: g.name, rank: g.rank }).execute(); bump('grades');
    }
    return n;
  });
}

async function main(): Promise<void> {
  const file = process.env['MASTERS_FILE'];
  if (!file) throw new Error('Set MASTERS_FILE to the JSON masters file (see docs/deploy/masters.example.json)');
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is required');
  const db = createDatabase(url);
  try {
    const counts = await seedMasters(db, JSON.parse(readFileSync(resolve(file), 'utf8')) as MastersFileShape);
    logger.info(counts, 'master seed complete (idempotent; no demo data)');
  } finally { await db.destroy(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((e: unknown) => { logger.error({ err: e }, 'master seed failed'); process.exit(1); });
}
