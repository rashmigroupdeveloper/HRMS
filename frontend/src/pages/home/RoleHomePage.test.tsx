import { beforeAll, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import type { SessionUser } from '../../lib/session';
import { RoleHomePage } from './RoleHomePage';
import { renderRouted } from '../../test/render';

beforeAll(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('offline'))),
  );
});

function user(overrides: Partial<SessionUser>): SessionUser {
  return {
    id: 1,
    email: 'anoop@rashmi.test',
    employeeId: null,
    roles: ['employee'],
    permissions: [],
    mfa: { enrolled: false, required: false, enforcement: 'grace' },
    steppedUpUntil: null,
    ...overrides,
  };
}

describe('RoleHomePage', () => {
  it('does not call ESS when the login has no employee profile', () => {
    renderRouted(
      <RoleHomePage user={user({ permissions: ['attendance.own'] })} />,
    );
    expect(screen.getByText(/No employee profile on this login/)).toBeInTheDocument();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('does not call the team grid when a manager login has no employee profile', () => {
    renderRouted(
      <RoleHomePage
        user={user({
          roles: ['manager'],
          permissions: ['attendance.team.read', 'attendance.own'],
          mfa: { enrolled: false, required: false, enforcement: 'grace' },
          steppedUpUntil: null,
        })}
      />,
    );
    expect(screen.getByText(/No employee profile on this login/)).toBeInTheDocument();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});
