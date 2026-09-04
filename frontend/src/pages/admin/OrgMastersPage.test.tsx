/** Stage 2.0 UI → API contract for the missing Departments mapping tab. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SessionUser } from '../../lib/session';
import { renderRouted } from '../../test/render';
import { AttendanceMastersPage } from './AttendanceMastersPage';

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal('fetch', fetchMock);

const admin: SessionUser = {
  id: 1,
  email: 'admin@example.test',
  employeeId: 1,
  roles: ['admin'],
  permissions: ['admin.settings'],
  mfa: { enrolled: true, required: true, enforcement: 'required' },
  steppedUpUntil: null,
};

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('OrgMastersPage', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation((request, init) => {
      const path =
        typeof request === 'string'
          ? request
          : request instanceof URL
            ? request.toString()
            : request.url;
      if (path === '/api/attendance/config/shifts') return Promise.resolve(json([]));
      if (path === '/api/org/companies') return Promise.resolve(json({ rows: [] }));
      if (path === '/api/org/departments' && init?.method !== 'PUT') {
        return Promise.resolve(
          json({
            rows: [
              {
                id: 11,
                name: 'Operations',
                misCodeId: null,
                misCode: null,
                misName: null,
                misCompanyCode: null,
              },
            ],
          }),
        );
      }
      if (path === '/api/org/mis-codes/admin') {
        return Promise.resolve(
          json({ rows: [{ id: 21, companyCode: 'RML', code: 'HM', name: 'Hot Mill' }] }),
        );
      }
      if (path === '/api/org/departments/11/mis-code' && init?.method === 'PUT') {
        return Promise.resolve(
          json({
            id: 11,
            name: 'Operations',
            misCodeId: 21,
            misCode: 'HM',
            misName: 'Hot Mill',
            misCompanyCode: 'RML',
          }),
        );
      }
      return Promise.resolve(new Response('Not found', { status: 404 }));
    });
  });

  it('shows the required Departments tab and sends the selected MIS id without inventing a code', async () => {
    const user = userEvent.setup();
    renderRouted(<AttendanceMastersPage user={admin} />);

    await user.click(screen.getByRole('tab', { name: 'Departments' }));
    const row = await screen.findByRole('row', { name: /Operations/ });
    expect(row).toHaveTextContent('Unmapped');

    await user.click(row);
    await user.click(screen.getByRole('combobox', { name: 'Finance MIS code' }));
    await user.click(screen.getByRole('option', { name: 'RML · HM — Hot Mill' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/org/departments/11/mis-code',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ departmentId: 11, misCodeId: 21 }),
        }),
      );
    });
  });
});
