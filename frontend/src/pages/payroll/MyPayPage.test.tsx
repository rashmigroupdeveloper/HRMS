import { expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRouted } from '../../test/render';
import { apiFetch } from '../../lib/api';
import { MyPayPage } from './MyPayPage';
vi.mock('../../lib/api', async original => ({ ...await original<typeof import('../../lib/api')>(), apiFetch: vi.fn() }));
it('keeps investment declarations reachable before the first finalized payslip',async()=>{
  vi.mocked(apiFetch).mockResolvedValue(null);
  renderRouted(<MyPayPage />);
  expect(screen.getByRole('link',{name:'Investment declaration'})).toHaveAttribute('href','/my/tax');
  expect(await screen.findByText('No payslip yet')).toBeInTheDocument();
});
