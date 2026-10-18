/**
 * Employee master: creates new employees (e-code allocated when blank) and
 * updates existing ones by e-code. Only columns present with a value are
 * changed on update — a blank cell never wipes data. Statutory and bank IDs
 * are validated per the entity's country; duplicates of PAN / Aadhaar / UAN /
 * ESIC / work e-mail against other employees (and within the file) are errors.
 */
import { sql } from 'kysely';
import { z } from 'zod';
import { writeAudit } from '../../../core/audit/audit.service.js';
import type { BulkImporter, BulkRow } from '../../../core/bulk/index.js';
import { allocateEmployeeCode } from '../../../core/employee-code.js';
import { ageOn, normalizeIdentity, validateIdentity, type IdentityField } from '../../../core/validation/identity.js';
import { companyCodes, hasRowError, opt, rowError, rowWarning, str } from '../helpers.js';

const noContext = z.object({}).strict();
type NoCtx = z.infer<typeof noContext>;

const CONTRACT = ['permanent', 'temporary', 'probationary', 'consultant', 'fixed_term', 'apprentice'] as const;
const CATEGORY = ['white_collar', 'blue_collar', 'trainee', 'consultant', 'contract'] as const;
const IDS: readonly [string, IdentityField, string, 'pan' | 'aadhaar' | 'uan' | 'esic_ip_number' | 'bank_ifsc' | 'bank_account' | 'mobile'][] = [
  ['pan', 'pan', 'PAN', 'pan'],
  ['aadhaar', 'aadhaar', 'Aadhaar', 'aadhaar'],
  ['uan', 'uan', 'UAN', 'uan'],
  ['esic_no', 'esic', 'ESIC IP no', 'esic_ip_number'],
  ['bank_ifsc', 'ifsc', 'IFSC', 'bank_ifsc'],
  ['bank_account', 'bank_account', 'Bank account', 'bank_account'],
  ['mobile', 'mobile', 'Mobile', 'mobile'],
];
const UNIQUE_IDS = ['pan', 'aadhaar', 'uan', 'esic_ip_number'] as const;

interface Masters {
  companies: { id: number; code: string; country_code: string }[];
  units: { id: number; name: string; company_id: number }[];
  locations: { id: number; name: string; company_id: number }[];
  departments: { id: number; name: string }[];
  designations: { id: number; name: string }[];
  grades: { id: number; name: string }[];
}

async function loadMasters(db: Parameters<BulkImporter['validate']>[0]['db']): Promise<Masters> {
  return {
    companies: await db.selectFrom('core.companies').select(['id', 'code', 'country_code']).execute(),
    units: await db.selectFrom('core.org_units').select(['id', 'name', 'company_id']).execute(),
    locations: await db.selectFrom('core.locations').select(['id', 'name', 'company_id']).execute(),
    departments: await db.selectFrom('core.departments').select(['id', 'name']).execute(),
    designations: await db.selectFrom('core.designations').select(['id', 'name']).execute(),
    grades: await db.selectFrom('core.grades').select(['id', 'name']).execute(),
  };
}

function fmt(x: unknown): string {
  if (x === null || x === undefined) return '';
  if (x instanceof Date) return x.toISOString().slice(0, 10);
  if (typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean' || typeof x === 'bigint') return String(x);
  return JSON.stringify(x);
}

function byName<T extends { name: string }>(list: readonly T[], name: string): T | undefined {
  return list.find((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase());
}

export const employeesImporter: BulkImporter<NoCtx> = {
  key: 'employees',
  title: 'Employee master',
  description: 'Create new employees or update existing ones (by e-code): personal, job, statutory and bank details.',
  permission: 'employee.write',
  contextSchema: noContext,
  contextFields: [],
  columns: [
    { key: 'ecode', header: 'Employee code', aliases: ['ecode', 'employee no', 'employeeno', 'emp code'], type: 'string', maxLength: 32, help: 'Blank = new employee (code allocated). Existing code = update.' },
    { key: 'company', header: 'Company', aliases: ['company code', 'entity'], type: 'string', required: true, help: 'Company code (RML, RGH…).' },
    { key: 'first_name', header: 'First name', aliases: ['first name', 'name'], type: 'string', maxLength: 80, help: 'Required for new employees.' },
    { key: 'last_name', header: 'Last name', aliases: ['surname'], type: 'string', maxLength: 80, help: 'Optional.' },
    { key: 'gender', header: 'Gender', type: 'enum', options: ['Male', 'Female', 'Other'], help: 'Optional.' },
    { key: 'dob', header: 'Date of birth', aliases: ['dob', 'birth date'], type: 'date', help: 'Must be 18+ on the joining date.' },
    { key: 'doj', header: 'Date of joining', aliases: ['doj', 'join date', 'joining date'], type: 'date', help: 'Required for new employees.' },
    { key: 'org_unit', header: 'Org unit', aliases: ['ou', 'unit', 'org unit'], type: 'string', help: 'Required for new employees (e.g. RML Kharagpur).' },
    { key: 'location', header: 'Work location', aliases: ['location', 'worklocation'], type: 'string', help: 'Location name.' },
    { key: 'department', header: 'Department', type: 'string', help: 'Existing department name.' },
    { key: 'designation', header: 'Designation', type: 'string', help: 'Existing designation name.' },
    { key: 'grade', header: 'Grade', type: 'string', help: 'Existing grade name.' },
    { key: 'category', header: 'Category', type: 'enum', options: CATEGORY, help: 'Employment category.' },
    { key: 'contract_type', header: 'Contract type', type: 'enum', options: CONTRACT, help: 'Default probationary for new employees.' },
    { key: 'manager_ecode', header: 'Reporting manager code', aliases: ['rm', 'manager', 'reporting manager'], type: 'string', help: 'E-code of the reporting manager.' },
    { key: 'hod_ecode', header: 'HOD code', aliases: ['hod', 'department head'], type: 'string', help: 'E-code of the department head (second approver).' },
    { key: 'work_email', header: 'Work e-mail', aliases: ['email', 'official email'], type: 'string', maxLength: 120, help: 'Unique.' },
    { key: 'mobile', header: 'Mobile', aliases: ['phone', 'contact'], type: 'string', help: '10-digit mobile (India).' },
    { key: 'pan', header: 'PAN', type: 'string', help: 'ABCDE1234F.' },
    { key: 'aadhaar', header: 'Aadhaar', type: 'string', help: '12 digits (checksum verified).' },
    { key: 'uan', header: 'UAN', type: 'string', help: '12 digits; unique.' },
    { key: 'esic_no', header: 'ESIC IP no', aliases: ['esi number', 'esic number'], type: 'string', help: '10 digits; unique.' },
    { key: 'bank_name', header: 'Bank name', aliases: ['bankname'], type: 'string', maxLength: 80, help: 'Bank name.' },
    { key: 'bank_account', header: 'Bank account', aliases: ['bank account no', 'account number'], type: 'string', help: '9–18 digits.' },
    { key: 'bank_ifsc', header: 'IFSC', aliases: ['ifsc code'], type: 'string', help: 'e.g. HDFC0001234.' },
  ],
  instructions: [
    'Leave Employee code blank to create a new employee; the next code for the company is allocated on confirm.',
    'On update, only filled cells change; blank cells keep the current value.',
    'Department, designation, grade, unit and location must already exist (Org masters).',
  ],
  samples: [
    { ecode: null, company: 'RML', first_name: 'Ananya', last_name: 'Ghosh', gender: 'Female', dob: '1998-07-14', doj: '2026-11-02', org_unit: 'RML Kharagpur', location: 'Kharagpur', department: 'ERP-CELL', designation: 'Junior Graduate Engineer', category: 'white_collar', contract_type: 'probationary', manager_ecode: 'RML033625', work_email: 'ananya.ghosh@rashmigroup.example', mobile: '9876543210', pan: 'ABCPG1234K', bank_name: 'HDFC Bank', bank_account: '50100491230000', bank_ifsc: 'HDFC0009686' },
    { ecode: 'RML033901', company: 'RML', mobile: '9123456780', bank_ifsc: 'SBIN0001234' },
  ],
  dynamicOptions: async (db) => ({ company: await companyCodes(db) }),
  rowKey: (v) => (str(v['ecode']) === '' ? `new|${str(v['company'])}|${str(v['first_name']).toLowerCase()}|${str(v['last_name']).toLowerCase()}|${str(v['dob'])}` : str(v['ecode']).toUpperCase()),
  contextKey: () => 'employees',
  authorize: () => Promise.resolve(null),
  validate: async ({ db, actor }, rows) => {
    const m = await loadMasters(db);
    const codes = rows.map((r) => str(r.values['ecode']).toUpperCase()).filter((c) => c !== '');
    const refs = rows.flatMap((r) => [str(r.values['manager_ecode']), str(r.values['hod_ecode'])]).map((c) => c.toUpperCase()).filter((c) => c !== '');
    const known = await db.selectFrom('core.employees as e').select(['e.id', 'e.ecode', 'e.company_id', 'e.org_unit_id', 'e.doj', 'e.dob'])
      .where(sql<string>`upper(e.ecode)`, 'in', [...codes, ...refs, '__none__']).execute();
    const byCode = new Map(known.map((k) => [k.ecode.toUpperCase(), k]));
    const seen = new Map<string, number>();
    for (const row of rows) {
      if (hasRowError(row)) continue;
      const v = row.values;
      const company = m.companies.find((c) => c.code.toUpperCase() === str(v['company']).toUpperCase());
      if (!company) { rowError(row, 'Company', 'Unknown company code'); continue; }
      v['company_id'] = company.id;
      const code = str(v['ecode']).toUpperCase();
      const existing = code === '' ? undefined : byCode.get(code);
      if (code !== '' && !existing) { rowError(row, 'Employee code', `No employee ${code}; leave the code blank to create a new employee`); continue; }
      if (existing && existing.company_id !== company.id) { rowError(row, 'Company', 'Changing company is a transfer — use Lifecycle → Transfers'); continue; }
      v['employee_id'] = existing?.id ?? null;
      v['action'] = existing ? 'update' : 'create';
      if (!existing) {
        for (const [key, label] of [['first_name', 'First name'], ['doj', 'Date of joining'], ['org_unit', 'Org unit']] as const) {
          if (opt(v[key]) === null) rowError(row, label, `${label} is required for a new employee`);
        }
      }
      // Scope: the target unit (new or current) must be inside the uploader's scope.
      const unitName = opt(v['org_unit']);
      const unit = unitName === null ? undefined : m.units.find((u) => u.name.toLowerCase() === unitName.toLowerCase() && u.company_id === company.id);
      if (unitName !== null && !unit) rowError(row, 'Org unit', `No org unit "${unitName}" in ${company.code}`);
      const unitId = unit?.id ?? existing?.org_unit_id ?? null;
      if (!actor.scope.all && (unitId === null || !actor.scope.orgUnitIds.includes(unitId))) { rowError(row, 'Org unit', 'Outside your data scope'); continue; }
      if (unit) v['org_unit_id'] = unit.id;
      for (const [key, label, list] of [['location', 'Work location', m.locations], ['department', 'Department', m.departments], ['designation', 'Designation', m.designations], ['grade', 'Grade', m.grades]] as const) {
        const name = opt(v[key]);
        if (name === null) continue;
        const hit = byName<{ id: number; name: string; company_id?: number }>(list, name);
        if (!hit || (key === 'location' && hit.company_id !== company.id)) rowError(row, label, `Unknown ${label.toLowerCase()} "${name}"`);
        else v[`${key}_id`] = hit.id;
      }
      for (const [key, label] of [['manager_ecode', 'Reporting manager code'], ['hod_ecode', 'HOD code']] as const) {
        const ref = str(v[key]).toUpperCase();
        if (ref === '') continue;
        const hit = byCode.get(ref);
        if (!hit) rowError(row, label, `No employee ${ref}`);
        else if (hit.id === existing?.id) rowError(row, label, 'An employee cannot report to themselves');
        else v[`${key}_id`] = hit.id;
      }
      const doj = opt(v['doj']) ?? (existing?.doj ? new Date(existing.doj).toISOString().slice(0, 10) : null);
      const dob = opt(v['dob']);
      if (dob !== null && doj !== null) {
        if (dob >= doj) rowError(row, 'Date of birth', 'Must be before the joining date');
        else if (ageOn(dob, doj) < 18) rowError(row, 'Date of birth', `Employee would be ${String(ageOn(dob, doj))} on joining — minors cannot be employed`);
        else if (ageOn(dob, doj) > 65) rowWarning(row, 'Date of birth', 'Over 65 on joining — check the date');
      }
      const email = opt(v['work_email']);
      if (email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) rowError(row, 'Work e-mail', 'Not a valid e-mail address');
      for (const [key, field, label] of IDS) {
        const raw = opt(v[key]);
        if (raw === null) continue;
        const problem = validateIdentity(company.country_code, field, raw);
        if (problem) rowError(row, label, problem);
        else v[key] = normalizeIdentity(field, raw);
      }
      for (const key of ['pan', 'aadhaar', 'uan', 'esic_no', 'work_email'] as const) {
        const val = opt(v[key]);
        if (val === null) continue;
        const k = `${key}|${val.toLowerCase()}`;
        const first = seen.get(k);
        if (first !== undefined) rowError(row, key.toUpperCase(), `Same ${key.replace('_', ' ')} as row ${String(first)}`);
        else seen.set(k, row.rowNumber);
      }
    }
    // Duplicates against other employees in the database.
    const valid = rows.filter((r) => !hasRowError(r));
    for (const col of [...UNIQUE_IDS, 'work_email'] as const) {
      const key = col === 'esic_ip_number' ? 'esic_no' : col;
      const vals = valid.map((r) => opt(r.values[key])).filter((x): x is string => x !== null);
      if (vals.length === 0) continue;
      const clash = await db.selectFrom('core.employees').select(['id', 'ecode', col]).where(col, 'in', vals).execute();
      for (const row of valid) {
        const val = opt(row.values[key]);
        const other = clash.find((c) => String(c[col]) === val && c.id !== row.values['employee_id']);
        if (val !== null && other) rowError(row, key.toUpperCase(), `Already used by ${other.ecode}`);
      }
    }
  },
  commit: async ({ trx, actor }, rows: readonly BulkRow[], progress) => {
    let created = 0;
    let updated = 0;
    for (const [i, row] of rows.entries()) {
      const v = row.values;
      const set: Record<string, unknown> = {};
      const put = (col: string, val: unknown) => { if (val !== null && val !== undefined && val !== '') set[col] = val; };
      put('first_name', opt(v['first_name'])); put('last_name', opt(v['last_name'])); put('gender', opt(v['gender']));
      put('dob', opt(v['dob'])); put('doj', opt(v['doj'])); put('org_unit_id', v['org_unit_id']); put('location_id', v['location_id']);
      put('department_id', v['department_id']); put('designation_id', v['designation_id']); put('grade_id', v['grade_id']);
      put('category', opt(v['category'])); put('contract_type', opt(v['contract_type'])); put('reporting_manager_id', v['manager_ecode_id']);
      put('hod_employee_id', v['hod_ecode_id']); put('work_email', opt(v['work_email'])?.toLowerCase()); put('mobile', opt(v['mobile']));
      put('pan', opt(v['pan'])); put('aadhaar', opt(v['aadhaar'])); put('uan', opt(v['uan'])); put('esic_ip_number', opt(v['esic_no']));
      put('bank_name', opt(v['bank_name'])); put('bank_account', opt(v['bank_account'])); put('bank_ifsc', opt(v['bank_ifsc']));
      if (v['action'] === 'update') {
        const id = Number(v['employee_id']);
        const before = await trx.selectFrom('core.employees').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
        if (Object.keys(set).length > 0) await trx.updateTable('core.employees').set(set).where('id', '=', id).execute();
        const changed = Object.keys(set).filter((k) => fmt((before as Record<string, unknown>)[k]) !== fmt(set[k]));
        await writeAudit(trx, { actorUserId: actor.userId, action: 'update', entity: 'core.employees', entityId: id, field: `bulk:${changed.join(',')}`.slice(0, 200), oldValue: null, newValue: `${String(changed.length)} field(s) via bulk import`, ip: actor.ip });
        updated++;
      } else {
        const companyId = Number(v['company_id']);
        const ecode = await allocateEmployeeCode(trx, companyId);
        const inserted = await trx.insertInto('core.employees').values({
          ...set, ecode, company_id: companyId, first_name: str(v['first_name']), doj: str(v['doj']) as unknown as Date,
          status: 'active', contract_type: (opt(v['contract_type']) ?? 'probationary') as 'probationary',
        } as never).returning('id').executeTakeFirstOrThrow();
        await writeAudit(trx, { actorUserId: actor.userId, action: 'create', entity: 'core.employees', entityId: inserted.id, field: ecode, newValue: 'created via bulk import', ip: actor.ip });
        v['created_ecode'] = ecode;
        created++;
      }
      if ((i + 1) % 100 === 0) await progress(i + 1);
    }
    return { created, updated, skipped: 0 };
  },
};
