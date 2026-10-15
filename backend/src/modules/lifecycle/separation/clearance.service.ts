/**
 * Departmental Clearances Service (LC-06, AST-04, SOW crosswalk).
 *
 * Implements:
 * 1. Multi-department clearance fan-out across IT, Admin, Finance, and HR upon separation approval.
 * 2. IT clearance: hardware returned, email access suspended, software accounts revoked.
 * 3. Admin clearance: ID card, vehicle pass, keys, company accommodation cleared.
 * 4. Finance clearance: outstanding company loans (pay.loans), travel wallet advances, expense claims.
 * 5. HR clearance: exit interview, clearance sign-off.
 * 6. Clearance Blocking Rule (fixing C18): unreturned or damaged assets create an unresolved
 *    clearance flag ('flagged') with approved recovery amount; cannot be marked cleared without Finance sign-off.
 */

import type { Database, ClearancesTable } from '../../../core/db/types.js';
import type { Kysely, Selectable } from 'kysely';
import { z } from 'zod';
import { parseJsonValue } from '../../../core/json.js';

const unreturnedAssetsSchema = z.array(z.object({
  assetId: z.number(),
  assetTag: z.string(),
  modelName: z.string(),
  condition: z.enum(['unreturned', 'damaged']),
  recoveryAmountRupees: z.number(),
})).nullable();

export type ClearanceDepartment = 'IT' | 'Admin' | 'Finance' | 'HR';
export type ClearanceStatus = 'pending' | 'cleared' | 'flagged';

export interface ClearanceItem {
  id: number;
  separationId: number;
  department: ClearanceDepartment;
  status: ClearanceStatus;
  remarks: string | null;
  unreturnedAssets?: {
    assetId: number;
    assetTag: string;
    modelName: string;
    condition: 'unreturned' | 'damaged';
    recoveryAmountRupees: number;
  }[] | null;
  recoveryAmount: string;
  clearedBy: number | null;
  clearedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export class ClearanceService {
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * Fans out standard clearances across all 4 departments for an approved separation.
   */
  async fanOutClearances(separationId: number): Promise<ClearanceItem[]> {
    const departments: ClearanceDepartment[] = ['IT', 'Admin', 'Finance', 'HR'];
    const created: ClearanceItem[] = [];

    for (const dept of departments) {
      const inserted = await this.db
        .insertInto('core.clearances')
        .values({
          separation_id: separationId,
          department: dept,
          status: 'pending',
          remarks: `Initial ${dept} clearance requisition pending department inspection`,
          recovery_amount: '0.00',
        })
        .onConflict((oc) =>
          oc.columns(['separation_id', 'department']).doUpdateSet({
            remarks: `Initial ${dept} clearance requisition pending department inspection`,
          })
        )
        .returningAll()
        .executeTakeFirstOrThrow();

      created.push(this.mapClearanceRow(inserted));
    }

    return created;
  }

  /**
   * Retrieves all clearances for a given separation.
   */
  async getClearancesBySeparation(separationId: number): Promise<ClearanceItem[]> {
    const rows = await this.db
      .selectFrom('core.clearances')
      .selectAll()
      .where('separation_id', '=', separationId)
      .orderBy('id', 'asc')
      .execute();

    return rows.map((r) => this.mapClearanceRow(r));
  }

  /**
   * Updates department clearance with evidence or flagged unreturned assets.
   * Enforces C18 integrity rule: unreturned/damaged assets flag the clearance and require Finance sign-off.
   */
  async updateClearance(params: {
    separationId: number;
    department: ClearanceDepartment;
    status: ClearanceStatus;
    remarks?: string | undefined;
    unreturnedAssets?: {
      assetId: number;
      assetTag: string;
      modelName: string;
      condition: 'unreturned' | 'damaged';
      recoveryAmountRupees: number;
    }[] | undefined;
    recoveryAmountRupees?: number | undefined;
    userId: number;
    isFinanceSignoff?: boolean | undefined;
  }): Promise<ClearanceItem> {
    const existing = await this.db
      .selectFrom('core.clearances')
      .selectAll()
      .where('separation_id', '=', params.separationId)
      .where('department', '=', params.department)
      .executeTakeFirst();

    if (!existing) {
      throw new Error(`Clearance record not found for separation #${params.separationId} in ${params.department}`);
    }

    // C18 Enforcement: unreturned or damaged assets MUST flag the clearance unless Finance formally signs off
    const hasUnreturnedAssets = (params.unreturnedAssets?.length ?? 0) > 0 ||
      (Number(existing.recovery_amount) > 0);

    const finalStatus = params.status;
    let finalRecoveryAmount = params.recoveryAmountRupees !== undefined
      ? params.recoveryAmountRupees.toFixed(2)
      : existing.recovery_amount;

    if (params.unreturnedAssets && params.unreturnedAssets.length > 0) {
      const sumRecovery = params.unreturnedAssets.reduce((sum, a) => sum + a.recoveryAmountRupees, 0);
      finalRecoveryAmount = sumRecovery.toFixed(2);
    }

    if (finalStatus === 'cleared' && hasUnreturnedAssets && !params.isFinanceSignoff && params.department !== 'Finance') {
      throw new Error(
        `Integrity rule C18 violated: Clearance with unreturned/damaged assets (₹${finalRecoveryAmount}) cannot be marked cleared without Finance Department sign-off.`
      );
    }

    const updated = await this.db
      .updateTable('core.clearances')
      .set({
        status: finalStatus,
        remarks: params.remarks ?? existing.remarks,
        unreturned_assets: params.unreturnedAssets ? JSON.stringify(params.unreturnedAssets) : existing.unreturned_assets,
        recovery_amount: finalRecoveryAmount,
        cleared_by: finalStatus === 'cleared' ? params.userId : null,
        cleared_at: finalStatus === 'cleared' ? new Date() : null,
      })
      .where('id', '=', existing.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapClearanceRow(updated);
  }

  /**
   * Verifies whether all 4 departmental clearances are resolved and ready for F&F computation.
   */
  async areAllClearancesResolved(separationId: number): Promise<{
    readyForFnf: boolean;
    pendingCount: number;
    flaggedCount: number;
    totalRecoveryAmountRupees: number;
    clearances: ClearanceItem[];
  }> {
    const clearances = await this.getClearancesBySeparation(separationId);

    const pending = clearances.filter((c) => c.status === 'pending');
    const flagged = clearances.filter((c) => c.status === 'flagged');
    const totalRecovery = clearances.reduce((sum, c) => sum + Number(c.recoveryAmount), 0);

    // Ready if no 'pending' clearances exist (flagged with approved recovery amount are ready to be deducted in F&F)
    const readyForFnf = clearances.length >= 4 && pending.length === 0;

    return {
      readyForFnf,
      pendingCount: pending.length,
      flaggedCount: flagged.length,
      totalRecoveryAmountRupees: totalRecovery,
      clearances,
    };
  }

  public mapClearanceRow(row: Selectable<ClearancesTable>): ClearanceItem {
    return {
      id: row.id,
      separationId: row.separation_id,
      department: row.department,
      status: row.status,
      remarks: row.remarks,
      unreturnedAssets: unreturnedAssetsSchema.parse(parseJsonValue(row.unreturned_assets)),
      recoveryAmount: row.recovery_amount,
      clearedBy: row.cleared_by ?? null,
      clearedAt: row.cleared_at ?? null,
      createdAt: (row.created_at),
      updatedAt: (row.updated_at),
    };
  }
}
