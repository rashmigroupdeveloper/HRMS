/** Holiday calendar (group, company, plant or location — C-35). Upsert by scope + date. */
import { z } from 'zod';
import { writeAudit } from '../../../core/audit/audit.service.js';
import { upsertScopedHoliday } from '../../../core/db/holiday-calendar.js';
import type { BulkImporter } from '../../../core/bulk/index.js';
import { hasRowError, opt, rowError, str } from '../helpers.js';

const noContext = z.object({}).strict();
type NoCtx = z.infer<typeof noContext>;

export const holidaysImporter: BulkImporter<NoCtx> = {
  key: 'holidays',
  title: 'Holiday calendar',
  description: 'Public and company holidays for the whole group, one company, one plant or one location. Existing dates for the same scope are renamed, not duplicated.',
  permission: 'admin.settings',
  contextSchema: noContext,
  contextFields: [],
  columns: [
    { key: 'date', header: 'Date', aliases: ['holiday date'], type: 'date', required: true, help: 'Holiday date.' },
    { key: 'name', header: 'Holiday', aliases: ['name', 'holiday name', 'occasion'], type: 'string', required: true, maxLength: 120, help: 'Holiday name shown on the calendar.' },
    { key: 'company', header: 'Company', aliases: ['entity', 'company code'], type: 'string', help: 'Company code or name. Blank (with no plant or location) = every company in the group.' },
    { key: 'plant', header: 'Plant', aliases: ['plant code', 'unit'], type: 'string', help: 'Optional plant code or name — the holiday applies only to that plant.' },
    { key: 'location', header: 'Location', aliases: ['work location', 'site'], type: 'string', help: 'Optional location name — the holiday applies only to that location.' },
  ],
  instructions: [
    'Blank Company, Plant and Location = holiday for the whole group.',
    'Company only = every employee of that company; Plant or Location narrows it further.',
    'Uploading a date again for the same scope updates its name.',
  ],
  samples: [
    { date: '2027-01-26', name: 'Republic Day', company: null, plant: null, location: null },
    { date: '2027-10-20', name: 'Durga Puja (Dashami)', company: 'RML', plant: null, location: 'Kharagpur' },
    { date: '2027-11-08', name: 'Plant maintenance holiday', company: 'RML', plant: 'KGP1', location: null },
  ],
  dynamicOptions: async (db) => ({
    company: (await db.selectFrom('core.companies').select('code').orderBy('code').execute()).map((c) => c.code),
    plant: (await db.selectFrom('core.plants').select('plant_code').where('is_active', '=', true).orderBy('plant_code').execute()).map((p) => p.plant_code),
    location: (await db.selectFrom('core.locations').select('name').orderBy('name').execute()).map((l) => l.name),
  }),
  rowKey: (v) => `${str(v['date'])}|${str(v['company']).toLowerCase()}|${str(v['plant']).toLowerCase()}|${str(v['location']).toLowerCase()}`,
  contextKey: () => 'calendar',
  authorize: () => Promise.resolve(null),
  validate: async ({ db, actor }, rows) => {
    const companies = await db.selectFrom('core.companies').select(['id', 'code', 'name']).execute();
    const plants = await db.selectFrom('core.plants').select(['id', 'plant_code', 'name', 'company_id']).execute();
    const locations = await db.selectFrom('core.locations').select(['id', 'name', 'company_id']).execute();
    const units = await db.selectFrom('core.org_units').select(['id', 'company_id']).execute();
    const myCompanies = new Set(units.filter((u) => actor.scope.orgUnitIds.includes(u.id)).map((u) => u.company_id));
    const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
    for (const row of rows) {
      if (hasRowError(row)) continue;
      const companyName = opt(row.values['company']);
      const plantName = opt(row.values['plant']);
      const locationName = opt(row.values['location']);
      let companyId: number | null = null;
      if (companyName !== null) {
        const company = companies.find((c) => same(c.code, companyName) || same(c.name, companyName));
        if (!company) { rowError(row, 'Company', `Unknown company "${companyName}"`); continue; }
        companyId = company.id;
      }
      let plantId: number | null = null;
      if (plantName !== null) {
        const matches = plants.filter((p) => (same(p.plant_code, plantName) || same(p.name, plantName)) && (companyId === null || p.company_id === companyId));
        const plant = matches[0];
        if (!plant) { rowError(row, 'Plant', `Unknown plant "${plantName}"${companyId === null ? '' : ' for this company'}`); continue; }
        if (matches.length > 1) { rowError(row, 'Plant', `Plant "${plantName}" exists in several companies; fill Company`); continue; }
        companyId = plant.company_id;
        plantId = plant.id;
      }
      let locationId: number | null = null;
      if (locationName !== null) {
        const loc = locations.find((l) => same(l.name, locationName));
        if (!loc) { rowError(row, 'Location', `Unknown location "${locationName}"`); continue; }
        if (companyId !== null && loc.company_id !== companyId) { rowError(row, 'Location', `${loc.name} belongs to a different company`); continue; }
        companyId = loc.company_id;
        locationId = loc.id;
      }
      if (companyId === null) {
        if (!actor.scope.all) { rowError(row, 'Company', 'Only a group-level admin can add a holiday for the whole group; choose your company'); continue; }
      } else if (!actor.scope.all && !myCompanies.has(companyId)) {
        rowError(row, 'Company', 'That company is outside your entity');
        continue;
      }
      row.values['company_id'] = companyId;
      row.values['plant_id'] = plantId;
      row.values['location_id'] = locationId;
    }
  },
  commit: async ({ trx, actor }, rows) => {
    let created = 0;
    let updated = 0;
    const id = (v: unknown) => (v === null || v === undefined ? null : Number(v));
    for (const row of rows) {
      const scope = { company_id: id(row.values['company_id']), plant_id: id(row.values['plant_id']), location_id: id(row.values['location_id']) };
      const inserted = await upsertScopedHoliday(trx, scope, str(row.values['date']), str(row.values['name']));
      if (inserted) created++; else updated++;
    }
    await writeAudit(trx, { actorUserId: actor.userId, action: 'bulk_update', entity: 'att.holidays', field: 'holidays', newValue: JSON.stringify({ created, updated }), ip: actor.ip });
    return { created, updated, skipped: 0 };
  },
};
