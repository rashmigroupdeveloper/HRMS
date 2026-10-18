import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { apiFetch } from '../../lib/api';
import { useOnboardingReferences } from './useOnboardingReferences';
import type { ReferenceCatalog } from './onboarding-types';
vi.mock('../../lib/api', () => ({ apiFetch: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const catalog = (id: number): ReferenceCatalog => ({
  companies: [{ id, name: `Entity ${String(id)}`, ecodePrefix: 'REAL' }],
  orgUnits: [],
  departments: [],
  designations: [],
  locations: [{ id, name: 'Actual location' }],
  salaryStructures: [],
});
it('clears the previous entity choices immediately and ignores late results', async () => {
  let finishFirst: ((data: ReferenceCatalog) => void) | undefined;
  vi.mocked(apiFetch).mockImplementation((path) =>
    path.endsWith('companyId=1')
      ? new Promise((resolve) => {
          finishFirst = resolve;
        })
      : Promise.resolve(catalog(2)),
  );
  const { result, rerender } = renderHook(({ companyId }) => useOnboardingReferences(companyId), {
    initialProps: { companyId: '1' },
  });
  rerender({ companyId: '2' });
  expect(result.current.data).toBeNull();
  expect(result.current.loading).toBe(true);
  await waitFor(() => {
    expect(result.current.data?.locations[0]?.id).toBe(2);
  });
  await act(async () => {
    finishFirst?.(catalog(1));
    await Promise.resolve();
  });
  expect(result.current.data?.locations[0]?.id).toBe(2);
});
it('does not reuse prior choices after a new entity lookup fails', async () => {
  vi.mocked(apiFetch)
    .mockResolvedValueOnce(catalog(1))
    .mockRejectedValueOnce(new Error('Not permitted'));
  const { result, rerender } = renderHook(({ companyId }) => useOnboardingReferences(companyId), {
    initialProps: { companyId: '1' },
  });
  await waitFor(() => {
    expect(result.current.data).not.toBeNull();
  });
  rerender({ companyId: '2' });
  expect(result.current.data).toBeNull();
  await waitFor(() => {
    expect(result.current.error).toBe('Not permitted');
  });
  expect(result.current.data).toBeNull();
});
