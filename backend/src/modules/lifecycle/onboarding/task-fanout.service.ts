/**
 * Onboarding Task Fan-out & Stakeholder Orchestration (LC-02, SOW crosswalk).
 *
 * Implements:
 * - Automated stakeholder checklist creation across IT, Admin, HR Ops, and Payroll.
 * - Task SLA tracking and +48h auto-escalation engine.
 * - Kent biometric enrollment verification gate.
 */

import { sql, type Kysely } from 'kysely';
import { writeAudit } from '../../../core/audit/audit.service.js';
import { assertEmployeesInScope, type EmployeeScope } from '../../../core/rbac/employee-scope.js';
import type { Database } from '../../../core/db/types.js';
import { inTransaction } from '../../../core/db/database.js';

export class KentEnrollmentUnavailable extends Error {
  constructor() {super('Kent enrollment verification is unavailable until the authorized enrollment integration is connected');this.name='KentEnrollmentUnavailable';}
}

export interface StandardTaskDefinition {
  taskCode: string;
  taskName: string;
  department: 'IT' | 'Admin' | 'HR' | 'Payroll';
  ownerRole: string;
  slaHours: number;
}

const STANDARD_ONBOARDING_TASKS: StandardTaskDefinition[] = [
  {
    taskCode: 'it_email',
    taskName: 'Provision Work Email & SSO Credentials',
    department: 'IT',
    ownerRole: 'it_admin',
    slaHours: 24,
  },
  {
    taskCode: 'it_laptop',
    taskName: 'Hardware Custody & Laptop Setup',
    department: 'IT',
    ownerRole: 'it_admin',
    slaHours: 48,
  },
  {
    taskCode: 'it_biometric',
    taskName: 'Biometric Enrollment on Kent Devices',
    department: 'IT',
    ownerRole: 'it_admin',
    slaHours: 48,
  },
  {
    taskCode: 'admin_id_card',
    taskName: 'Print Plant Safety RFID Access ID Card',
    department: 'Admin',
    ownerRole: 'admin',
    slaHours: 48,
  },
  {
    taskCode: 'hr_induction',
    taskName: 'Plant Safety Induction & Document Verification',
    department: 'HR',
    ownerRole: 'hr_ops',
    slaHours: 72,
  },
];

export const TaskFanoutService = {
  /**
   * Fans out standard onboarding tasks for a newly converted employee.
   */
  async fanoutTasksForEmployee(
    db: Kysely<Database>,
    employeeId: number,
    candidateId?: number | null
  ): Promise<number> {
    const now = new Date();

    for (const def of STANDARD_ONBOARDING_TASKS) {
      const dueDate = new Date(now.getTime() + def.slaHours * 60 * 60 * 1000);

      await db
        .insertInto('core.onboarding_tasks')
        .values({
          employee_id: employeeId,
          candidate_id: candidateId ?? null,
          task_code: def.taskCode,
          task_name: def.taskName,
          department: def.department,
          owner_role: def.ownerRole,
          due_date: new Date(dueDate.toISOString().slice(0, 10)),
          sla_hours: def.slaHours,
          status: 'open',
          updated_at: new Date(),
        })
        .execute();
    }

    return STANDARD_ONBOARDING_TASKS.length;
  },

  /**
   * Completes a stakeholder task.
   */
  async completeTask(
    db: Kysely<Database>, taskId: number, userId: number, notes?: string | null, scope?: EmployeeScope,
  ): Promise<void> {
    const complete=async(db:Kysely<Database>)=>{
      const target=await db.selectFrom('core.onboarding_tasks').select('employee_id').where('id','=',taskId).executeTakeFirst();
      if(!target) throw new Error('Onboarding task not found');
      if(scope) await assertEmployeesInScope(db,scope,[target.employee_id]);
      await db.selectFrom('core.employees').select('id').where('id','=',target.employee_id).forUpdate().executeTakeFirstOrThrow();
      const task=await db.selectFrom('core.onboarding_tasks').selectAll().where('id','=',taskId).forUpdate().executeTakeFirstOrThrow();
      if(task.task_code==='it_biometric') throw new KentEnrollmentUnavailable();
      if(task.status==='completed') return;
      const now=new Date();
      await db.updateTable('core.onboarding_tasks').set({status:'completed',done_by:userId,done_at:now,notes:notes??null,updated_at:now}).where('id','=',taskId).execute();
      await writeAudit(db,{actorUserId:userId,subjectEmployeeId:target.employee_id,action:'update',entity:'core.onboarding_tasks',entityId:taskId,field:'status',oldValue:task.status,newValue:'completed'});
    };
    return db.isTransaction?complete(db):inTransaction(db, complete);
  },

  /**
   * Sweeps open tasks and escalates those past SLA due date.
   */
  async checkTaskEscalations(
    db: Kysely<Database>,
    currentDate: Date = new Date()
  ): Promise<number> {
    const todayStr = currentDate.toISOString().slice(0, 10);
    const now = new Date();

    const overdueTasks = await db
      .selectFrom('core.onboarding_tasks')
      .select(['id', 'due_date'])
      .where('status', '=', 'open')
      .where('due_date', '<', sql<Date>`${todayStr}::date`)
      .execute();

    for (const t of overdueTasks) {
      await db
        .updateTable('core.onboarding_tasks')
        .set({
          status: 'escalated',
          escalated_at: now,
          updated_at: now,
        })
        .where('id', '=', t.id)
        .execute();
    }

    return overdueTasks.length;
  },

  /**
   * Explicitly verifies Kent biometric registration for an employee.
   */
  verifyBiometricRegistration(
    _db: Kysely<Database>, _employeeId: number, _verifiedByUserId: number,
  ): Promise<void> {
    void _db; void _employeeId; void _verifiedByUserId;
    // A local button press or an old swipe is not proof of enrollment.
    // No enrollment adapter/contract is configured in the application yet.
    return Promise.reject(new KentEnrollmentUnavailable());
  },
};
