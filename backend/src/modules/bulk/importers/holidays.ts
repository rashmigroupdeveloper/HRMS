/** Holiday calendar (company-wide or per location). Upsert by location + date. */
import { sql } from 'kysely';
import { z } from 'zod';
import { writeAudit } from '../../../core/audit/audit.service.js';
import type { BulkImporter } from '../../../core/bulk/index.js';
import { hasRowError, opt, rowError, str } from '../helpers.js';

const noContext = z.object({}).strict();
type NoCtx = z.infer<typeof noContext>;

export const holidaysImporter: BulkImporter<NoCtx> = {
  key: 'holidays',
  title: 'Holiday calendar',
  description: 'Public and company holidays, for all locations or one location. Existing dates are renamed, not duplicated.',
  permission: 'admin.settings',
  contextSchema: noContext,
  contextFields: [],
  columns: [
    { key: 'date', header: 'Date', aliases: ['holiday date'], type: 'date', required: true, help: 'Holiday date.' },
    { key: 'name', header: 'Holiday', aliases: ['name', 'holiday name', 'occasion'], type: 'string', required: true, maxLength: 120, help: 'Holiday name shown on the calendar.' },
    { key: 'location', header: 'Location', aliases: ['work location', 'site'], type: 'string', help: 'Leave blank for every location, or give a location name.' },
  ],
  instructions: ['Blank Location = holiday for every location.', 'Uploading a date again for the same location updates its name.'],
  samples: [
    { date: '2027-01-26', name: 'Republic Day', location: null },
    { date: '2027-10-20', name: 'Durga Puja (Dashami)', location: 'Kharagpur' },
  ],
  dynamicOptions: async (db) => ({ location: (await db.selectFrom('core.locations').select('name').orderBy('name').execute()).map((l) => l.name) }),
  rowKey: (v) => `${str(v['date'])}|${str(v['location']).toLowerCase()}`,
  contextKey: () => 'calendar',
  authorize: () => Promise.resolve(null),
  validate: async ({ db, actor }, rows) => {
    const locations = await db.selectFrom('core.locations').select(['id', 'name', 'company_id']).execute();
    const units = await db.selectFrom('core.org_units').select(['id', 'company_id']).execute();
    const myCompanies = new Set(units.filter((u) => actor.scope.orgUnitIds.includes(u.id)).map((u) => u.company_id));
    for (const row of rows) {
      if (hasRowError(row)) continue;
      const name = opt(row.values['location']);
      if (name === null) {
        if (!actor.scope.all) rowError(row, 'Location', 'Only a group-level admin can add a holiday for every location; choose your location');
        row.values['location_id'] = null;
        continue;
      }
      const loc = locations.find((l) => l.name.toLowerCase() === name.toLowerCase());
      if (!loc) { rowError(row, 'Location', `Unknown location "${name}"`); continue; }
      if (!actor.scope.all && !myCompanies.has(loc.company_id)) { rowError(row, 'Location', `${loc.name} is outside your entity`); continue; }
      row.values['location_id'] = loc.id;
    }
  },
  commit: async ({ trx, actor }, rows) => {
    let created = 0;
    let updated = 0;
    for (const row of rows) {
      const locationId = row.values['location_id'] === null ? null : Number(row.values['location_id']);
      const date = str(row.values['date']);
      const name = str(row.values['name']);
      const res = await trx.insertInto('att.holidays')
        .values({ holiday_date: sql<Date>`${date}::date` as unknown as Date, name, location_id: locationId })
        .onConflict((oc) => oc.columns(['location_id', 'holiday_date']).doUpdateSet({ name }))
        .returning(sql<boolean>`(xmax = 0)`.as('inserted')).executeTakeFirstOrThrow();
      if (res.inserted) created++; else updated++;
    }
    await writeAudit(trx, { actorUserId: actor.userId, action: 'bulk_update', entity: 'att.holidays', field: 'holidays', newValue: JSON.stringify({ created, updated }), ip: actor.ip });
    return { created, updated, skipped: 0 };
  },
};
