/**
 * Stage 5.3 — processing register + DPO contact + masked export (PRV-02/05/10).
 */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { getTypedSetting } from '../../core/settings/read.js';

export interface RegisterEntry {
  dataClass: string;
  purpose: string;
  lawfulBasis: string;
  retentionDays: number;
  recipients: string;
}

/** Last-4 visible; never put the raw value into the pack or audit logs. */
export function maskStatutory(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value.length <= 4) return '****';
  return `${'*'.repeat(Math.min(value.length - 4, 12))}${value.slice(-4)}`;
}

export async function listProcessingRegister(db: Kysely<Database>): Promise<RegisterEntry[]> {
  const rows = await db
    .selectFrom('prv.processing_register')
    .selectAll()
    .orderBy('data_class')
    .execute();
  return rows.map((row) => ({
    dataClass: row.data_class,
    purpose: row.purpose,
    lawfulBasis: row.lawful_basis,
    retentionDays: row.retention_days,
    recipients: row.recipients,
  }));
}

export async function dpoContact(
  db: Kysely<Database>,
): Promise<{ name: string; email: string; phone: string | null; responseSlaDays: number }> {
  const responseSlaDays = await getTypedSetting(db, 'prv.rights_sla_days', 'number', 15);
  return {
    name: 'Data Protection Officer',
    email: 'dpo@rashmigroup.com',
    phone: null,
    responseSlaDays,
  };
}

/** PRV-05 access pack — statutory IDs are masked, never raw. */
export async function buildAccessPack(
  db: Kysely<Database>,
  employeeId: number,
  actorUserId?: number,
): Promise<Record<string, unknown>> {
  const employee = await db
    .selectFrom('core.employees')
    .select([
      'id',
      'ecode',
      'first_name',
      'last_name',
      'work_email',
      'personal_email',
      'mobile',
      'pan',
      'aadhaar',
      'bank_account',
      'status',
      'doj',
    ])
    .where('id', '=', employeeId)
    .executeTakeFirst();
  if (employee === undefined) return { error: 'not_found' };

  const [consents, acks] = await Promise.all([
    db.selectFrom('prv.consents').selectAll().where('employee_id', '=', employeeId).execute(),
    db
      .selectFrom('prv.notice_acks as a')
      .innerJoin('core.users as u', 'u.id', 'a.user_id')
      .select(['a.notice_id', 'a.acknowledged_at'])
      .where('u.employee_id', '=', employeeId)
      .execute(),
  ]);

  let accessEvents:
    | {
        occurredAt: string;
        resource: string;
        fieldClass: string;
        purpose: string;
        recordCount: number;
      }[]
    | null = null;
  try {
    const events = await db
      .selectFrom('sec.access_events')
      .select(['occurred_at', 'resource', 'field_class', 'purpose', 'record_count'])
      .where('subject_employee_id', '=', employeeId)
      .orderBy('occurred_at', 'desc')
      .limit(500)
      .execute();
    accessEvents = events.map((e) => ({
      occurredAt: e.occurred_at.toISOString(),
      resource: e.resource,
      fieldClass: e.field_class,
      purpose: e.purpose,
      recordCount: e.record_count,
    }));
  } catch {
    accessEvents = null;
  }

  if (actorUserId !== undefined) {
    await writeAudit(db, {
      actorUserId,
      action: 'privacy_export',
      entity: 'prv.export_pack',
      entityId: employeeId,
      subjectEmployeeId: employeeId,
      newValue: 'masked_pack',
    });
  }

  return {
    exportedAt: new Date().toISOString(),
    employee: {
      id: employee.id,
      ecode: employee.ecode,
      name: [employee.first_name, employee.last_name].filter(Boolean).join(' '),
      workEmail: employee.work_email,
      personalEmail: employee.personal_email,
      mobile: employee.mobile,
      status: employee.status,
      doj: employee.doj,
      pan: maskStatutory(employee.pan),
      aadhaar: maskStatutory(employee.aadhaar),
      bankAccount: maskStatutory(employee.bank_account),
    },
    consents,
    noticeAcks: acks,
    accessEvents,
  };
}
