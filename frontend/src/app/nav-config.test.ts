/**
 * Per-role navigation (docs/08 §3).
 *
 * Nav is the permission-driven shell: an item appears only when the user holds
 * the permission guarding the surface behind it. That makes this file security-
 * adjacent — it is not the enforcement point (the API is), but a rail offering
 * a screen the user will be refused on is a defect, and a rail HIDING a screen
 * they need is a support ticket.
 *
 * These tests pin both directions.
 */
import { describe, expect, it } from 'vitest';
import { mobileTabs, navForUser, splitNav } from './nav-config';
import type { SessionUser } from '../lib/session';

function user(roles: string[], permissions: string[]): SessionUser {
  return { id: 1, email: 'a@b.test', employeeId: 1, roles, permissions };
}

const paths = (u: SessionUser): string[] => navForUser(u).map((item) => item.to);

describe('navForUser', () => {
  it('gives a bare employee self-service only — never an admin or ops surface', () => {
    const nav = paths(user(['employee'], ['attendance.own', 'leave.own', 'employee.read']));

    expect(nav).toContain('/my/attendance');
    expect(nav).toContain('/my/leave');

    for (const forbidden of [
      '/approvals',
      '/admin/users',
      '/admin/settings',
      '/admin/workflows',
      '/admin/masters',
      '/admin/audit',
      '/payroll',
      '/leave',
      '/executive',
    ]) {
      expect(nav, `a plain employee must not be offered ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('does not send a bare employee to the approvals inbox', () => {
    const nav = paths(user(['employee'], ['attendance.own', 'leave.own', 'employee.read']));
    expect(nav).not.toContain('/approvals');
    expect(nav).toContain('/my/leave');
  });

  it('shows Approvals to a manager who holds leave.approve', () => {
    const items = navForUser(user(['manager'], ['leave.approve']));
    expect(items.some((item) => item.to === '/approvals' && item.label === 'Approvals')).toBe(true);
  });

  it('leaves ESS ungrouped and sections the ops rail', () => {
    const ess = navForUser(user(['employee'], ['attendance.own', 'employee.read']));
    expect(ess.every((item) => item.group === undefined)).toBe(true);

    const ops = navForUser(
      user(
        ['hr_ops'],
        [
          'employee.read',
          'attendance.muster.export',
          'admin.users',
          'assets.manage',
          'helpdesk.agent',
        ],
      ),
    );
    expect(ops.find((item) => item.to === '/people')?.group).toBe('People');
    expect(ops.find((item) => item.to === '/attendance')?.group).toBe('Attendance');
    expect(ops.find((item) => item.to === '/policies')?.group).toBe('Workplace');
    expect(ops.find((item) => item.to === '/helpdesk')?.group).toBe('Workplace');
    expect(ops.find((item) => item.to === '/assets')?.group).toBe('Workplace');
    expect(ops.find((item) => item.to === '/admin/users')?.group).toBe('Admin');
  });

  it('offers each master-control surface only with the permission that guards its write path', () => {
    const withoutSettings = paths(user(['it_admin'], ['admin.users']));
    expect(withoutSettings).toContain('/admin/users');
    expect(withoutSettings).not.toContain('/admin/workflows');
    expect(withoutSettings).not.toContain('/admin/masters');
    expect(withoutSettings).not.toContain('/admin/settings');

    const withSettings = paths(user(['it_admin'], ['admin.users', 'admin.settings']));
    expect(withSettings).toContain('/admin/workflows');
    expect(withSettings).toContain('/admin/masters');
    expect(withSettings).toContain('/admin/settings');
  });

  it('shows the audit log to audit.read holders and to nobody else', () => {
    expect(paths(user(['hr_ops'], ['employee.read']))).not.toContain('/admin/audit');
    expect(paths(user(['hr_head'], ['audit.read']))).toContain('/admin/audit');
  });

  it('gates payroll on the payroll permissions, not on a role name', () => {
    expect(paths(user(['payroll_admin'], []))).not.toContain('/payroll');
    expect(paths(user(['payroll_admin'], ['payroll.run.view']))).toContain('/payroll');
  });

  it('gates loans and claims administration on payroll permissions', () => {
    const nav = paths(user(['payroll_admin'], ['payroll.run.manage']));
    expect(nav).toContain('/loans');
    expect(nav).toContain('/claims');

    expect(paths(user(['manager'], ['attendance.team.read']))).not.toContain('/loans');
  });

  it('sends CEO cell to the executive dashboard as its home', () => {
    const nav = paths(user(['ceo_cell'], ['reports.ceo']));
    expect(nav[0]).toBe('/executive');
  });

  it('gives managers their team surfaces', () => {
    const nav = paths(user(['manager'], ['attendance.team.read', 'leave.approve', 'ot.approve']));
    expect(nav).toContain('/my/team');
    expect(nav).toContain('/approvals');
    expect(nav).toContain('/my/team/overtime');
  });

  it('never emits a duplicate destination', () => {
    const nav = paths(
      user(
        ['hr_ops', 'hr_head', 'manager', 'super_admin'],
        [
          'attendance.own',
          'attendance.team.read',
          'leave.approve',
          'employee.read',
          'admin.settings',
          'admin.users',
          'audit.read',
          'payroll.run.view',
          'reports.hr',
        ],
      ),
    );
    expect(new Set(nav).size).toBe(nav.length);
  });

  it('gives every item a label and an icon (pills, More, and the mobile bar all use them)', () => {
    const items = navForUser(
      user(['super_admin'], ['admin.settings', 'admin.users', 'audit.read', 'employee.read']),
    );
    expect(items.length).toBeGreaterThan(3);
    for (const item of items) {
      expect(item.label, `${item.to} needs a label`).toBeTruthy();
      expect(item.icon, `${item.to} needs an icon`).toBeTruthy();
    }
  });

  it('pins Settings and Gallery as secondary (More menu, not the pill strip)', () => {
    const items = navForUser(user(['super_admin'], ['admin.settings']));
    const settings = items.find((i) => i.to === '/admin/settings');
    const gallery = items.find((i) => i.to === '/dev/gallery');
    expect(settings?.section).toBe('secondary');
    expect(gallery?.section).toBe('secondary');
  });
});

describe('splitNav — Crextio pill strip (docs/05 §3, 08 §3)', () => {
  const labels = (items: ReturnType<typeof navForUser>): string[] => items.map((item) => item.label);

  it('keeps a bare employee to the 08 ESS set; Policies/Travel/Letters go to More', () => {
    const { pills, more } = splitNav(
      navForUser(
        user(['employee'], ['attendance.own', 'leave.own', 'employee.read', 'employee.compensation.read']),
      ),
    );

    expect(labels(pills)).toEqual([
      'Home',
      'My Attendance',
      'My Leave',
      'My Pay',
      'My Claims',
      'Helpdesk',
      'Directory',
    ]);
    expect(labels(more)).toEqual(expect.arrayContaining(['Policies', 'Travel', 'My Letters']));
    expect(labels(pills)).not.toContain('Policies');
    expect(labels(pills)).not.toContain('Travel');
    expect(pills.length).toBeLessThanOrEqual(8);
  });

  it('never spends a pill on Approvals — the masthead badge owns that click (docs/05 §3)', () => {
    const { pills, more } = splitNav(
      navForUser(
        user(['manager'], ['attendance.own', 'attendance.team.read', 'leave.approve', 'ot.approve']),
      ),
    );
    expect(labels(pills)).toContain('My Team');
    expect(labels(pills)).not.toContain('Approvals');
    expect(labels(more)).toContain('Approvals');
    expect(labels(more)).toContain('OT Decisions');
  });

  it('gives HR ops the module-noun strip; admin surfaces sit in More', () => {
    const { pills, more } = splitNav(
      navForUser(
        user(
          ['hr_ops'],
          [
            'employee.read',
            'attendance.muster.export',
            'leave.admin',
            'assets.manage',
            'helpdesk.agent',
            'admin.users',
            'admin.settings',
            'reports.hr',
          ],
        ),
      ),
    );
    expect(labels(pills)[0]).toBe('Dashboard');
    expect(labels(pills)).toEqual(
      expect.arrayContaining(['People', 'Attendance', 'Leave', 'Helpdesk', 'Reports']),
    );
    expect(labels(pills)).not.toContain('Users & Roles');
    expect(labels(pills)).not.toContain('Settings');
    expect(labels(more)).toEqual(expect.arrayContaining(['Users & Roles', 'Settings', 'Policies']));
    expect(pills.length).toBeLessThanOrEqual(8);
  });

  it('keeps CEO cell to Executive + Reports', () => {
    const { pills, more } = splitNav(navForUser(user(['ceo_cell'], ['reports.ceo', 'employee.read'])));
    expect(labels(pills)).toEqual(['Executive', 'Reports']);
    expect(labels(more)).toContain('Directory');
  });

  it('picks four daily tabs for the mobile bar, Home first', () => {
    const { pills, more } = splitNav(
      navForUser(user(['employee'], ['attendance.own', 'employee.read', 'employee.compensation.read'])),
    );
    const tabs = mobileTabs(pills);
    expect(tabs.map((item) => item.to)).toEqual(['/', '/my/attendance', '/my/leave', '/my/pay']);
    expect(more.length).toBeGreaterThan(0);
  });
});
