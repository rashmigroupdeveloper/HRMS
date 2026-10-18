import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiFetch } from '../../lib/api';
import { BulkUploadDrawer } from './BulkUploadDrawer';
import type { BulkJob } from './bulk-types';

vi.mock('../../lib/api', () => ({ apiFetch: vi.fn(), ApiError: class ApiError extends Error { status = 400; } }));

const base: BulkJob = {
  jobId: 7, importer: 'payroll-inputs', filename: 'inputs.xlsx', status: 'previewed', sheet: 'Data', layout: 'standard',
  totalRows: 2, validRows: 1, errorRows: 1, warningRows: 0, processedRows: 0, fileIssues: [], duplicateOfJobId: null,
  issues: [{ rowNumber: 3, column: 'Amount', severity: 'error', message: 'Amount must be a number (got "abc")' }],
  preview: [], result: null, error: null, createdAt: '2026-10-18T18:00:00Z', committedAt: null,
};

beforeEach(() => { vi.mocked(apiFetch).mockReset(); });

function upload(name: string) {
  const input = screen.getByLabelText('Choose a .xlsx or .csv file to upload');
  fireEvent.change(input, { target: { files: [new File(['x'], name)] } });
}

it('shows row/column errors and blocks the import until the file is clean', async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce(base);
  render(<BulkUploadDrawer importer="payroll-inputs" title="Upload inputs" open onClose={() => undefined} context={{ runId: 4 }} />);
  upload('inputs.xlsx');
  expect(await screen.findByText('Amount must be a number (got "abc")')).toBeInTheDocument();
  expect(screen.getByText('1 with errors')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Import 2 rows/ })).toBeDisabled();
  const [path, init] = vi.mocked(apiFetch).mock.calls[0] ?? [];
  expect(path).toBe('/api/bulk/payroll-inputs/preview');
  expect(JSON.parse(init?.body as string)).toMatchObject({ filename: 'inputs.xlsx', context: { runId: 4 } });
});

it('commits a clean file and reports the result; refuses .xls before uploading', async () => {
  const onCommitted = vi.fn();
  vi.mocked(apiFetch)
    .mockResolvedValueOnce({ ...base, errorRows: 0, validRows: 2, issues: [] })
    .mockResolvedValueOnce({ ...base, status: 'committed', errorRows: 0, validRows: 2, issues: [], result: { created: 2, updated: 0, skipped: 0 } });
  render(<BulkUploadDrawer importer="payroll-inputs" title="Upload inputs" open onClose={() => undefined} onCommitted={onCommitted} />);
  upload('old.xls');
  expect(apiFetch).not.toHaveBeenCalled();
  upload('inputs.csv');
  const btn = await screen.findByRole('button', { name: /Import 2 rows/ });
  expect(btn).toBeEnabled();
  fireEvent.click(btn);
  await waitFor(() => { expect(onCommitted).toHaveBeenCalled(); });
  expect(await screen.findByText(/Imported: 2 created/)).toBeInTheDocument();
});
