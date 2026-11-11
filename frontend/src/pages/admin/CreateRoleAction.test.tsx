import { expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderRouted } from '../../test/render';
import { apiFetch } from '../../lib/api';
import { CreateRoleAction } from './CreateRoleAction';
vi.mock('../../lib/api', async original => ({ ...await original<typeof import('../../lib/api')>(), apiFetch: vi.fn() }));
it('creates an empty named role through the protected API and reloads the matrix', async () => {
  vi.mocked(apiFetch).mockResolvedValue({code:'payroll_delegate',name:'Payroll delegate'});
  const onCreated=vi.fn();
  renderRouted(<CreateRoleAction onCreated={onCreated} />);
  fireEvent.click(screen.getByRole('button',{name:'Create role'}));
  expect(screen.getByRole('button',{name:'Create empty role'})).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Role code'),{target:{value:'payroll_delegate'}});
  fireEvent.change(screen.getByLabelText('Role name'),{target:{value:'Payroll delegate'}});
  fireEvent.click(screen.getByRole('button',{name:'Create empty role'}));
  await vi.waitFor(()=>{expect(onCreated).toHaveBeenCalledOnce();});
  expect(apiFetch).toHaveBeenCalledWith('/api/rbac/roles',expect.objectContaining({method:'POST',body:JSON.stringify({code:'payroll_delegate',name:'Payroll delegate'})}));
});
