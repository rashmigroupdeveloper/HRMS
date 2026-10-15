import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { apiFetch } from '../../lib/api';
import { renderRouted } from '../../test/render';
import { todayISOIST } from '../../ui';
import { AttendanceRequestDrawer } from './AttendanceRequestDrawer';

vi.mock('../../lib/api', async original => ({
  ...await original<typeof import('../../lib/api')>(), apiFetch: vi.fn(),
}));
beforeEach(() => { localStorage.clear(); vi.mocked(apiFetch).mockReset().mockResolvedValue({ id: 1, workflowRequestId: 2 }); });

describe('ATT-07 short permission form', () => {
  it('submits both bounded times and one date through the real attendance contract', async () => {
    const submitted = vi.fn();
    renderRouted(<AttendanceRequestDrawer open initialDate={todayISOIST()} onClose={vi.fn()} onSubmitted={submitted} />);
    fireEvent.click(screen.getByRole('combobox', { name: 'What do you need?' }));
    fireEvent.click(screen.getByRole('option', { name: /Short permission/ }));
    fireEvent.change(screen.getByLabelText(/Permission from/), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText(/Permission to/), { target: { value: '11:00' } });
    fireEvent.change(screen.getByLabelText(/Why should this be approved/), { target: { value: 'Personal appointment during this hour' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send to my manager' }));
    await waitFor(() => { expect(submitted).toHaveBeenCalledOnce(); });
    expect(apiFetch).toHaveBeenCalledWith('/api/attendance/requests', {
      method: 'POST', body: JSON.stringify({ kind: 'PERMISSION', fromDate: todayISOIST(), toDate: todayISOIST(),
        reason: 'Personal appointment during this hour', fromTime: '10:00', toTime: '11:00' }),
    });
  });
});
