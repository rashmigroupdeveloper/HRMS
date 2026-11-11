import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderRouted } from '../test/render';
import { apiFetch } from '../lib/api';
import { ChangePasswordDrawer } from './ChangePasswordDrawer';
import { AccountMenu } from './AccountMenu';
vi.mock('../lib/api', async original => ({ ...await original<typeof import('../lib/api')>(), apiFetch: vi.fn() }));
beforeEach(()=>{vi.mocked(apiFetch).mockReset();});
it('opens Change password from the account menu',()=>{
  renderRouted(<AccountMenu user={{id:1,email:'employee@hrms.invalid',employeeId:1,roles:['employee'],permissions:[]}} onSignedOut={()=>undefined} />);
  fireEvent.click(screen.getByRole('button',{name:/account menu/}));
  fireEvent.click(screen.getByRole('menuitem',{name:'Change password'}));
  expect(screen.getByRole('dialog',{name:'Change password'})).toBeInTheDocument();
});
it('requires matching confirmation and sends only the current and new passwords',async()=>{
  vi.mocked(apiFetch).mockResolvedValue({ok:true});
  const close=vi.fn(); renderRouted(<ChangePasswordDrawer onClose={close} />);
  fireEvent.change(screen.getByLabelText('Current password'),{target:{value:'SyntheticOld#2026'}});
  fireEvent.change(screen.getByLabelText('New password'),{target:{value:'SyntheticNew#2026'}});
  expect(screen.getByRole('button',{name:'Save password'})).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Confirm new password'),{target:{value:'SyntheticNew#2026'}});
  fireEvent.click(screen.getByRole('button',{name:'Save password'}));
  await vi.waitFor(()=>{expect(close).toHaveBeenCalledOnce();});
  expect(apiFetch).toHaveBeenCalledWith('/api/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword:'SyntheticOld#2026',newPassword:'SyntheticNew#2026'})});
});
it('keeps the form open and shows the authoritative server policy error',async()=>{
  vi.mocked(apiFetch).mockRejectedValue(new Error('Password does not satisfy configured policy'));
  const close=vi.fn(); renderRouted(<ChangePasswordDrawer onClose={close} />);
  for(const label of ['Current password','New password','Confirm new password']) fireEvent.change(screen.getByLabelText(label),{target:{value:'SyntheticAttempt#2026'}});
  fireEvent.click(screen.getByRole('button',{name:'Save password'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('configured policy'); expect(close).not.toHaveBeenCalled();
});
