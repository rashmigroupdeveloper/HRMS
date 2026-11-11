import { beforeEach, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { apiFetch } from '../../lib/api';
import { renderRouted } from '../../test/render';
import { LeadershipInsights } from './LeadershipInsights';
beforeEach(() => { vi.mocked(apiFetch).mockReset(); });
vi.mock('../../lib/api', async original => ({ ...await original<typeof import('../../lib/api')>(), apiFetch: vi.fn() }));
it('loads consolidated movement once even with thousands of companies', async () => {
  vi.mocked(apiFetch).mockImplementation(path => Promise.resolve(path === '/api/core/companies'
    ? { companies: Array.from({ length: 2000 }, (_, index) => ({ id: index + 1, name: `Company ${String(index + 1)}` })) }
    : path.startsWith('/api/reports/r24-boarding') ? { joins: [], exits: [] } : []));
  renderRouted(<LeadershipInsights user={{ id: 1, email: 'synthetic@hrms.invalid', employeeId: null, roles: [], permissions: ['reports.hr'] }} only={['movement']} />);
  await screen.findByText('People movement');
  await waitFor(() => { expect(vi.mocked(apiFetch).mock.calls.filter(call => call[0].startsWith('/api/reports/r24-boarding'))).toHaveLength(1); });
  expect(vi.mocked(apiFetch).mock.calls.length).toBe(3);
});

it.each([['payroll_admin',['payroll.run.view']],['plant_head',['reports.bu']],['ceo_cell',['reports.ceo']]] as const)('does not probe APIs forbidden to %s', async (role, permissions) => {
  vi.mocked(apiFetch).mockImplementation(path => Promise.resolve(path === '/api/core/companies' ? {companies:[]} : path.startsWith('/api/reports/r24-boarding') ? {joins:[],exits:[]} : path.includes('/probation/alerts') ? {d30ReviewIds:[],d14ReviewIds:[],d7ReviewIds:[]} : []));
  renderRouted(<LeadershipInsights user={{id:1,email:'test@hrms.invalid',employeeId:null,roles:[role],permissions:[...permissions]}} />);
  await waitFor(() => { expect(apiFetch).toHaveBeenCalled(); });
  const paths=vi.mocked(apiFetch).mock.calls.map(call=>call[0]);
  expect(paths).not.toContain('/api/lifecycle/probation/alerts');
  if (role !== 'payroll_admin') expect(paths).not.toContain('/api/payroll/runs/list');
  if (role === 'payroll_admin') expect(paths.some(path=>path.startsWith('/api/reports/r2'))).toBe(false);
});
