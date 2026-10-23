import { scheduleFixture } from '../../test/attendance-schedule';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { apiFetch } from '../../lib/api';
import { renderRouted } from '../../test/render';
import { todayISOIST } from '../../ui';
import { AttendanceRequestDrawer } from './AttendanceRequestDrawer';

vi.mock('../../lib/api', async original => ({
  ...await original<typeof import('../../lib/api')>(), apiFetch: vi.fn(),
}));
beforeEach(() => { localStorage.clear(); vi.mocked(apiFetch).mockReset().mockImplementation(path => Promise.resolve(
  path.startsWith('/api/attendance/requests/schedule')
    ? scheduleFixture(new URL(path, 'http://hrms.invalid').searchParams.get('date') ?? todayISOIST())
    : path.startsWith('/api/workflows/preview')
      ? []
      : { id: 1, workflowRequestId: 2, routingHeld: false },
)); });

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


describe('ATT-06/07 half-wise requests', () => {
  it.each([['AR', 'Attendance regularisation', 'first_half', 'First half'], ['OD', 'Official duty', 'second_half', 'Second half']])('submits %s for only the selected half', async (kind, kindLabel, portion, label) => {
      const submitted = vi.fn();
      renderRouted(<AttendanceRequestDrawer open initialDate={todayISOIST()} onClose={vi.fn()} onSubmitted={submitted} />);
      if (kind === 'OD') {
        fireEvent.click(screen.getByRole('combobox', { name: 'What do you need?' }));
        fireEvent.click(screen.getByRole('option', { name: new RegExp(kindLabel) }));
      }
      await waitFor(() => { expect(screen.getByRole('combobox', { name: 'Which part of each day?' })).not.toBeDisabled(); });
      fireEvent.click(screen.getByRole('combobox', { name: 'Which part of each day?' }));
      fireEvent.click(screen.getByRole('option', { name: new RegExp(label) }));
      fireEvent.change(screen.getByLabelText(/Why should this be approved/), { target: { value: 'Client work during the selected half' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send to my manager' }));
      await waitFor(() => { expect(submitted).toHaveBeenCalledOnce(); });
      const call = vi.mocked(apiFetch).mock.calls.find(call => call[1]?.method === 'POST');
      const body = call?.[1]?.body;
      if (typeof body !== 'string') throw new Error('Missing JSON request body');
      const payload = JSON.parse(body) as { kind: string; dayPortion: string };
      expect(payload).toMatchObject({ kind, dayPortion: portion });
    });
});

it('keeps a saved reason with its owner across account transitions', () => {
  const props = { open: true, initialDate: todayISOIST(), onClose: vi.fn(), onSubmitted: vi.fn() };
  const view = renderRouted(<AttendanceRequestDrawer {...props} ownerId={101} />);
  fireEvent.change(screen.getByLabelText(/Why should this be approved/), { target: { value: 'Private missing punch reason' } });
  view.rerender(<AttendanceRequestDrawer {...props} ownerId={202} />);
  expect(screen.getByLabelText(/Why should this be approved/)).toHaveValue('');
  view.rerender(<AttendanceRequestDrawer {...props} ownerId={101} />);
  expect(screen.getByLabelText(/Why should this be approved/)).toHaveValue('Private missing punch reason');
});

it('does not claim a different month has no posted attendance', async () => {
  renderRouted(<AttendanceRequestDrawer open initialDate="2026-09-24" loadedMonth="2026-10" postedDates={[]} onClose={vi.fn()} onSubmitted={vi.fn()} />);
  expect(screen.getByText(/Attendance for this period is not loaded/)).toBeInTheDocument();
  expect(screen.queryByText(/No attendance is posted for these dates yet/)).not.toBeInTheDocument();
  await screen.findByText(/Assigned shift timings/);
});
