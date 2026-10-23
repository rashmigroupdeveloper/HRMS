import { expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { apiFetch } from '../../lib/api';
import { renderRouted } from '../../test/render';
import { LeadershipInsights } from './LeadershipInsights';
vi.mock('../../lib/api', async original => ({ ...await original<typeof import('../../lib/api')>(), apiFetch: vi.fn() }));
it('loads consolidated movement once even with thousands of companies', async () => {
  vi.mocked(apiFetch).mockImplementation(path => Promise.resolve(path === '/api/core/companies'
    ? { companies: Array.from({ length: 2000 }, (_, index) => ({ id: index + 1, name: `Company ${String(index + 1)}` })) }
    : path.startsWith('/api/reports/r24-boarding') ? { joins: [], exits: [] } : []));
  renderRouted(<LeadershipInsights user={{ id: 1, email: 'synthetic@hrms.invalid', employeeId: null, roles: [], permissions: ['reports.read'] }} only={['movement']} />);
  await screen.findByText('People movement');
  await waitFor(() => { expect(vi.mocked(apiFetch).mock.calls.filter(call => call[0].startsWith('/api/reports/r24-boarding'))).toHaveLength(1); });
  expect(vi.mocked(apiFetch).mock.calls.length).toBe(3);
});
