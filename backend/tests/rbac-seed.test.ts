/**
 * RBAC seed consistency — the docs/08 §2 hard rules, machine-checked.
 */
import { describe, expect, it } from 'vitest';
import { PERMISSIONS, ROLES, ROLE_GRANTS } from '../src/core/rbac/seed-data.js';

describe('RBAC seed integrity', () => {
  it('has exactly the ten roles of docs/08 §1', () => {
    expect(ROLES.map((r) => r.code)).toEqual([
      'employee',
      'manager',
      'senior_manager',
      'hr_ops',
      'hr_head',
      'payroll_admin',
      'plant_head',
      'ceo_cell',
      'it_admin',
      'super_admin',
    ]);
  });

  it('every grant references a declared permission and a declared role', () => {
    const permSet = new Set<string>(PERMISSIONS);
    const roleSet = new Set(ROLES.map((r) => r.code));
    for (const [role, grantList] of Object.entries(ROLE_GRANTS)) {
      expect(roleSet.has(role as (typeof ROLES)[number]['code'])).toBe(true);
      for (const g of grantList) expect(permSet.has(g.permission)).toBe(true);
    }
  });

  it('no role has duplicate grants for the same permission', () => {
    for (const [role, grantList] of Object.entries(ROLE_GRANTS)) {
      const seen = new Set(grantList.map((g) => g.permission));
      expect(seen.size, `${role} has duplicate grants`).toBe(grantList.length);
    }
  });

  describe('docs/08 §2 hard rules', () => {
    const has = (role: keyof typeof ROLE_GRANTS, perm: string): boolean =>
      ROLE_GRANTS[role].some((g) => g.permission === perm);

    it('it_admin NEVER reads compensation (separation of duties)', () => {
      expect(has('it_admin', 'employee.compensation.read')).toBe(false);
      expect(has('it_admin', 'employee.statutory_ids.read')).toBe(false);
    });

    it('managers NEVER hold attendance.manual_override (PP-v2-18)', () => {
      expect(has('manager', 'attendance.manual_override')).toBe(false);
      expect(has('senior_manager', 'attendance.manual_override')).toBe(false);
    });

    it('payroll.run.reopen is super_admin only', () => {
      for (const role of ROLES.map((r) => r.code)) {
        expect(has(role, 'payroll.run.reopen'), role).toBe(role === 'super_admin');
      }
    });

    it('finalize requires two people: payroll_admin initiates, hr_head co-signs', () => {
      expect(has('payroll_admin', 'payroll.run.finalize')).toBe(true);
      expect(has('hr_head', 'payroll.run.finalize')).toBe(true);
      expect(has('hr_ops', 'payroll.run.finalize')).toBe(false);
      expect(has('it_admin', 'payroll.run.finalize')).toBe(false);
    });

    it('unmasked statutory IDs: only own, payroll_admin, super_admin', () => {
      const holders = ROLES.map((r) => r.code).filter((r) => has(r, 'employee.statutory_ids.read'));
      expect(holders.sort()).toEqual(['employee', 'payroll_admin', 'super_admin']);
    });

    it('every employee-facing role can at least manage own attendance', () => {
      for (const role of ROLES.map((r) => r.code)) {
        expect(has(role, 'attendance.own'), role).toBe(true);
      }
    });
  });
});
