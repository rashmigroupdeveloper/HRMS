/** Asset register (create or update by asset number). */
import { z } from 'zod';
import type { BulkImporter } from '../../../core/bulk/index.js';
import { upsertAsset } from '../../assets/index.js';
import { companyCodes, hasRowError, opt, rowError, str } from '../helpers.js';

const noContext = z.object({}).strict();
type NoCtx = z.infer<typeof noContext>;

export const assetsImporter: BulkImporter<NoCtx> = {
  key: 'assets',
  title: 'Asset register',
  description: 'Laptops, phones, SIMs, vehicles and other kit. Existing asset numbers are updated.',
  permission: 'assets.manage',
  contextSchema: noContext,
  contextFields: [],
  columns: [
    { key: 'asset_no', header: 'Asset no', aliases: ['asset number', 'asset tag', 'tag'], type: 'string', required: true, maxLength: 40, help: 'Unique asset number / tag.' },
    { key: 'category', header: 'Category', aliases: ['type', 'asset type'], type: 'string', required: true, maxLength: 60, help: 'Laptop, Mobile, SIM, Vehicle…' },
    { key: 'description', header: 'Description', aliases: ['model', 'make model'], type: 'string', maxLength: 200, help: 'Make / model.' },
    { key: 'serial_no', header: 'Serial no', aliases: ['serial', 'serial number', 'imei'], type: 'string', maxLength: 80, help: 'Manufacturer serial / IMEI.' },
    { key: 'purchase_date', header: 'Purchase date', type: 'date', help: 'Optional.' },
    { key: 'warranty_till', header: 'Warranty till', aliases: ['warranty', 'warranty end'], type: 'date', help: 'Optional; past dates allowed.' },
    { key: 'company', header: 'Company', aliases: ['company code', 'entity'], type: 'string', required: true, help: 'Owning company code (RML, RGH…).' },
    { key: 'location', header: 'Location', type: 'string', help: 'Optional location name.' },
  ],
  instructions: ['Asset numbers are unique across the group; an existing number is updated in place.'],
  samples: [{ asset_no: 'AST-LT-0451', category: 'Laptop', description: 'Dell Latitude 5440', serial_no: 'DL5440X91', purchase_date: '2025-04-12', warranty_till: '2028-04-11', company: 'RML', location: 'Kharagpur' }],
  dynamicOptions: async (db) => ({ company: await companyCodes(db) }),
  rowKey: (v) => str(v['asset_no']).toUpperCase(),
  contextKey: () => 'register',
  authorize: () => Promise.resolve(null),
  validate: async ({ db, actor }, rows) => {
    const companies = await db.selectFrom('core.companies').select(['id', 'code']).execute();
    const locations = await db.selectFrom('core.locations').select(['id', 'name', 'company_id']).execute();
    const units = await db.selectFrom('core.org_units').select(['id', 'company_id']).execute();
    const mine = new Set(units.filter((u) => actor.scope.orgUnitIds.includes(u.id)).map((u) => u.company_id));
    const existing = await db.selectFrom('ast.assets').select(['asset_no', 'company_id']).where('asset_no', 'in', rows.map((r) => str(r.values['asset_no'])).concat([''])).execute();
    for (const row of rows) {
      if (hasRowError(row)) continue;
      const company = companies.find((c) => c.code.toUpperCase() === str(row.values['company']).toUpperCase());
      if (!company) { rowError(row, 'Company', 'Unknown company code'); continue; }
      if (!actor.scope.all && !mine.has(company.id)) { rowError(row, 'Company', `${company.code} is outside your entity`); continue; }
      const prior = existing.find((e) => e.asset_no === str(row.values['asset_no']));
      if (prior && !actor.scope.all && !mine.has(prior.company_id)) { rowError(row, 'Asset no', 'This asset belongs to another entity'); continue; }
      row.values['company_id'] = company.id;
      const locName = opt(row.values['location']);
      if (locName !== null) {
        const loc = locations.find((l) => l.name.toLowerCase() === locName.toLowerCase() && l.company_id === company.id);
        if (!loc) rowError(row, 'Location', `No location "${locName}" in ${company.code}`);
        else row.values['location_id'] = loc.id;
      }
      if (prior) row.issues.push({ column: 'Asset no', severity: 'warning', message: 'Exists — will be updated' });
    }
  },
  commit: async ({ trx, actor }, rows, progress) => {
    let created = 0;
    let updated = 0;
    for (const [i, row] of rows.entries()) {
      const res = await upsertAsset(trx, {
        assetNo: str(row.values['asset_no']), category: str(row.values['category']), description: opt(row.values['description']), serialNo: opt(row.values['serial_no']),
        purchaseDate: opt(row.values['purchase_date']), warrantyTill: opt(row.values['warranty_till']), companyId: Number(row.values['company_id']),
        locationId: row.values['location_id'] === undefined || row.values['location_id'] === null ? null : Number(row.values['location_id']), actorUserId: actor.userId, ip: actor.ip,
      });
      if (res.created) created++; else updated++;
      if ((i + 1) % 200 === 0) await progress(i + 1);
    }
    return { created, updated, skipped: 0 };
  },
};
