import { expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderRouted } from '../../test/render';
import { apiFetch } from '../../lib/api';
import { TravelPage } from './TravelPage';
vi.mock('../../lib/api', async original => ({ ...await original<typeof import('../../lib/api')>(), apiFetch: vi.fn() }));
it('opens the existing trip budget form from Plan new trip',async()=>{
  vi.mocked(apiFetch).mockImplementation(path=>Promise.resolve(path.endsWith('/ledger')?{transactions:[]}:path.endsWith('/wallet')?{balancePaise:0}:{items:[]}));
  renderRouted(<TravelPage />);
  fireEvent.click(screen.getByRole('button',{name:'Plan new trip'}));
  expect(await screen.findByRole('dialog',{name:'Create budget'})).toBeInTheDocument();
});
