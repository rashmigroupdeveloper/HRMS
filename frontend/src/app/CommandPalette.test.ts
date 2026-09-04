/**
 * ⌘K palette — permission-gated extras (error prevention) + people search
 * (hunters, not tourists). Destinations the user cannot open must not be
 * offered; people must come from the directory API, never invented.
 */
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SessionUser } from '../lib/session';
import { renderRouted } from '../test/render';
import { CommandPalette, filterExtras } from './CommandPalette';

function session(permissions: string[], roles: string[] = ['employee']): SessionUser {
  return {
    id: 1,
    email: 'a@b.test',
    employeeId: 1,
    roles,
    permissions,
    mfa: { enrolled: false, required: false, enforcement: 'grace' },
    steppedUpUntil: null,
  };
}

function extrasTos(permissions: string[]): string[] {
  return filterExtras(session(permissions)).map((c) => c.to);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const ZORBLAX = {
  ecode: 'RML035384',
  name: 'Zorblax Sen',
  designation: 'Fitter',
  department: 'SMS',
  entity: 'RML',
  entityName: 'Rashmi Metaliks',
  status: 'active',
  statusLabel: 'Confirmed',
};

describe('filterExtras', () => {
  it('always offers Policies and nothing gated to a permission-less user', () => {
    const tos = extrasTos([]);
    expect(tos).toEqual(['/policies']);
  });

  it('adds ESS self-service when the user holds attendance.own', () => {
    const tos = extrasTos(['attendance.own']);
    expect(tos).toEqual(['/my/attendance', '/my/leave', '/my/letters', '/policies']);
  });

  it('gates muster on attendance.muster.export', () => {
    expect(extrasTos(['attendance.own'])).not.toContain('/attendance/muster');
    expect(extrasTos(['attendance.muster.export'])).toContain('/attendance/muster');
  });

  it('offers absence cases to reports.hr OR attendance.team.read', () => {
    expect(extrasTos([])).not.toContain('/attendance/absence-cases');
    expect(extrasTos(['reports.hr'])).toContain('/attendance/absence-cases');
    expect(extrasTos(['attendance.team.read'])).toContain('/attendance/absence-cases');
  });

  it('gates devices, month-lock and boarding-exit on their route permissions', () => {
    const none = extrasTos([]);
    expect(none).not.toContain('/attendance/devices');
    expect(none).not.toContain('/attendance/month-lock');
    expect(none).not.toContain('/reports/boarding-exit');

    expect(extrasTos(['admin.devices'])).toContain('/attendance/devices');
    expect(extrasTos(['attendance.month_lock'])).toContain('/attendance/month-lock');
    expect(extrasTos(['reports.hr'])).toContain('/reports/boarding-exit');
  });
});

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('uses the hunter placeholder and hides gated extras from a bare employee', () => {
    renderRouted(
      createElement(CommandPalette, {
        open: true,
        onClose: vi.fn(),
        user: session(['attendance.own']),
      }),
    );

    expect(screen.getByPlaceholderText('Jump to a page or a person…')).toBeInTheDocument();
    expect(screen.queryByText('Muster summary')).not.toBeInTheDocument();
    expect(screen.queryByText('Device health')).not.toBeInTheDocument();
    expect(screen.queryByText('Month lock')).not.toBeInTheDocument();
    expect(screen.queryByText('Boarding & exits (R24)')).not.toBeInTheDocument();
    expect(screen.queryByText('Absence cases')).not.toBeInTheDocument();
  });

  it('offers muster when the user can export it', () => {
    renderRouted(
      createElement(CommandPalette, {
        open: true,
        onClose: vi.fn(),
        user: session(['attendance.muster.export']),
      }),
    );
    expect(screen.getByText('Muster summary')).toBeInTheDocument();
  });

  it('does not search people without employee.read', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [ZORBLAX], total: 1, page: 1, pageSize: 8 }));
    vi.stubGlobal('fetch', fetchMock);

    renderRouted(
      createElement(CommandPalette, {
        open: true,
        onClose: vi.fn(),
        user: session(['attendance.own']),
      }),
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'zo' } });
    await vi.advanceTimersByTimeAsync(400);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Zorblax Sen')).not.toBeInTheDocument();
  });

  it('does not search people for a one-character query', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [ZORBLAX], total: 1, page: 1, pageSize: 8 }));
    vi.stubGlobal('fetch', fetchMock);

    renderRouted(
      createElement(CommandPalette, {
        open: true,
        onClose: vi.fn(),
        user: session(['employee.read']),
      }),
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'z' } });
    await vi.advanceTimersByTimeAsync(400);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('debounces directory search and lists people above destinations', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ items: [ZORBLAX], total: 1, page: 1, pageSize: 8 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderRouted(
      createElement(CommandPalette, {
        open: true,
        onClose: vi.fn(),
        user: session(['employee.read']),
      }),
    );

    await userEvent.type(screen.getByRole('textbox'), 'zo');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/employees?q=zo&pageSize=8&activeOnly=true');

    const person = await screen.findByText('Zorblax Sen');
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toContainElement(person);
    expect(rows[0]).toHaveTextContent('People');
    expect(screen.queryByText('Invented Person')).not.toBeInTheDocument();
  });

  it('swallows ApiError and keeps destination matches', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ message: 'forbidden' }, 403),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderRouted(
      createElement(CommandPalette, {
        open: true,
        onClose: vi.fn(),
        user: session(['employee.read']),
      }),
    );

    await userEvent.type(screen.getByRole('textbox'), 'zo');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    expect(screen.queryByText('Zorblax Sen')).not.toBeInTheDocument();
    expect(screen.getByText('No pages or people match')).toBeInTheDocument();
  });
});
