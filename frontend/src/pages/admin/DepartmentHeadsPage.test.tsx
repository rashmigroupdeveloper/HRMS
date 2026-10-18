import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiFetch } from '../../lib/api';
import { DepartmentHeadsPage } from './DepartmentHeadsPage';

vi.mock('../../lib/api', () => ({ apiFetch: vi.fn(), ApiError: class ApiError extends Error { status = 400; } }));

const head = {
  id: 9, departmentId: 3, departmentName: 'Quality', companyId: null, companyCode: null,
  employeeId: 41, employeeCode: 'RML000041', employeeName: 'Asha Rao',
};

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(apiFetch).mockImplementation((path: string) => {
    if (path === '/api/core/department-heads') return Promise.resolve({ heads: [head] });
    if (path === '/api/core/departments') return Promise.resolve({ departments: [{ id: 3, name: 'Quality' }] });
    if (path === '/api/core/companies') return Promise.resolve({ companies: [{ id: 1, name: 'Rashmi Metaliks', code: 'RML' }] });
    return Promise.resolve({ ok: true });
  });
});

it('lists designations (group-wide shown as all entities) and keeps Add disabled until the form is complete', async () => {
  render(<DepartmentHeadsPage />);
  expect(await screen.findByText('Asha Rao (RML000041)')).toBeInTheDocument();
  expect(screen.getByText('All entities')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add head' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Employee code'), { target: { value: 'RML000099' } });
  expect(screen.getByRole('button', { name: 'Add head' })).toBeDisabled(); // department and entity still empty
});

it('removes a designation through the scoped API and reloads', async () => {
  render(<DepartmentHeadsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
  await waitFor(() => {
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/api/core/department-heads/9/remove', { method: 'POST', body: '{}' });
  });
});
