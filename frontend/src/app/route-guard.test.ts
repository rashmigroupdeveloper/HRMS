import { describe, expect, it } from 'vitest';
import type { SessionUser } from '../lib/session';
import { canAccessRoute } from './route-guard';

const u = (roles: string[], permissions: string[]): SessionUser => ({ id: 1, email: 'x@y', employeeId: 1, roles, permissions });
const employee = u(['employee'], ['employee.read', 'employee.compensation.read', 'attendance.own', 'leave.own']);
const manager = u(['manager'], ['employee.read', 'attendance.own', 'leave.own', 'attendance.team.read', 'lifecycle.probation.view', 'lifecycle.confirmation.approve']);
const payroll = u(['payroll_admin'], ['payroll.run.view', 'payroll.run.manage', 'payroll.reports', 'salary.write']);
const ceo = u(['ceo_cell'], ['reports.ceo']);

describe('canAccessRoute (E2E-001)', () => {
  it('blocks the screens the e2e suite found open', () => {
    expect(canAccessRoute(employee, '/payroll/structures')).toBe(false);
    expect(canAccessRoute(employee, '/executive')).toBe(false);
    expect(canAccessRoute(manager, '/attendance/month-lock')).toBe(false);
    expect(canAccessRoute(payroll, '/admin/workflows')).toBe(false);
    expect(canAccessRoute(ceo, '/payroll/structures')).toBe(false);
    expect(canAccessRoute(employee, '/admin/users')).toBe(false);
    expect(canAccessRoute(employee, '/reports/r5-ot')).toBe(false);
  });
  it('keeps self-service and permitted screens open', () => {
    expect(canAccessRoute(employee, '/')).toBe(true);
    expect(canAccessRoute(employee, '/my/pay')).toBe(true);
    expect(canAccessRoute(employee, '/my/tax/')).toBe(true);
    expect(canAccessRoute(employee, '/lifecycle/separation')).toBe(true);
    expect(canAccessRoute(employee, '/people/RML1')).toBe(true);
    expect(canAccessRoute(manager, '/lifecycle/probation')).toBe(true);
    expect(canAccessRoute(manager, '/my/team')).toBe(true);
    expect(canAccessRoute(payroll, '/payroll/structures')).toBe(true);
    expect(canAccessRoute(payroll, '/payroll/tds')).toBe(true);
    expect(canAccessRoute(ceo, '/executive')).toBe(true);
    expect(canAccessRoute(u(['super_admin'], []), '/anything')).toBe(true);
  });
});
