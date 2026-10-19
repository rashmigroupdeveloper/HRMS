import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { ShiftEditor, BLANK_SHIFT, type ShiftRecord } from './ShiftEditor';
import { apiFetch } from '../../lib/api';
import { renderRouted } from '../../test/render';
vi.mock('../../lib/api', async original => ({ ...await original<typeof import('../../lib/api')>(), apiFetch: vi.fn() }));
const shift: ShiftRecord = { ...BLANK_SHIFT, id: 1, code: 'SYN', name: 'Synthetic shift',
  lateSlabs: [{ fromMin: 0, toMin: 15, effect: 'none' }, { fromMin: 31, toMin: null, effect: 'half_day' }],
  earlyExitSlabs: [{ fromMin: 10, toMin: 20, effect: 'late' }],
};
beforeEach(() => { vi.mocked(apiFetch).mockReset(); vi.mocked(apiFetch).mockResolvedValue({ ok: true }); });
describe('SHF-01 shift policy editor', () => {
  it('preserves exact custom rules when saving a different field', async () => {
    const saved = vi.fn();
    renderRouted(<ShiftEditor shift={shift} onClose={vi.fn()} onSaved={saved} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Renamed shift' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save shift' }));
    await waitFor(() => { expect(saved).toHaveBeenCalledOnce(); });
    const body = vi.mocked(apiFetch).mock.calls[0]?.[1]?.body;
    expect(typeof body).toBe('string');
    if (typeof body !== 'string') throw new Error('Expected JSON shift payload');
    const payload = JSON.parse(body) as { name: string; lateSlabs: unknown; earlyExitSlabs: unknown };
    expect(payload).toMatchObject({ name: 'Renamed shift', lateSlabs: shift.lateSlabs, earlyExitSlabs: shift.earlyExitSlabs });
  });
  it('changes only the explicitly edited cause and preserves the other custom rules', async () => {
    renderRouted(<ShiftEditor shift={shift} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Late half-day after (min)'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save shift' }));
    await waitFor(() => { expect(apiFetch).toHaveBeenCalledOnce(); });
    const body = vi.mocked(apiFetch).mock.calls[0]?.[1]?.body;
    if (typeof body !== 'string') throw new Error('Expected JSON shift payload');
    const payload = JSON.parse(body) as { lateSlabs: unknown; earlyExitSlabs: unknown };
    expect(payload.lateSlabs).toEqual([{ fromMin: 1, toMin: 40, effect: 'late' }, { fromMin: 41, toMin: null, effect: 'half_day' }]);
    expect(payload.earlyExitSlabs).toEqual(shift.earlyExitSlabs);
  });
  it('shows threshold validation locally and sends no request for overlapping rules', async () => {
    renderRouted(<ShiftEditor shift={shift} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Late until (min after grace)'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save shift' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Half-day threshold must follow');
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
