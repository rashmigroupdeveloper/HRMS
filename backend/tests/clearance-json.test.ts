/** LC-06 / AST-04: malformed stored evidence must not become a fake clearance. */
import { describe, expect, it } from 'vitest';
import type { Selectable } from 'kysely';
import type { ClearancesTable } from '../src/core/db/types.js';
import { ClearanceService } from '../src/modules/lifecycle/separation/clearance.service.js';

const evidence = [{
  assetId: 2, assetTag: 'FIXTURE-2', modelName: 'Fixture laptop',
  condition: 'unreturned', recoveryAmountRupees: 1000,
}];
function row(value: unknown): Selectable<ClearancesTable> {
  return {
    id: 1, separation_id: 1, department: 'IT', status: 'flagged', remarks: null,
    unreturned_assets: value, recovery_amount: '1000.00', cleared_by: null,
    cleared_at: null, created_at: new Date('2026-10-01'), updated_at: new Date('2026-10-01'),
  };
}

describe('stored asset clearance evidence', () => {
  it('maps native JSONB and legacy serialized evidence identically', () => {
    const native = ClearanceService.prototype.mapClearanceRow(row(evidence));
    const legacy = ClearanceService.prototype.mapClearanceRow(row(JSON.stringify(evidence)));
    expect(native).toEqual(legacy);
    expect(native.unreturnedAssets).toEqual(evidence);
  });
  it('preserves an explicit absence of recovery evidence', () => {
    expect(ClearanceService.prototype.mapClearanceRow(row(null)).unreturnedAssets).toBeNull();
  });
  it.each([{}, '"not an array"', [{ assetId: 1 }], [{ ...evidence[0], condition: 'invented' }]])(
    'refuses malformed recovery evidence %j', value => {
      expect(() => ClearanceService.prototype.mapClearanceRow(row(value))).toThrow();
    },
  );
});
