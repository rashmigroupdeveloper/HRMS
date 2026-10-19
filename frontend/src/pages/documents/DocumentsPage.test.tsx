/** DOC-02: recoverable uploads and actual download requests, using the shared UI kit. */
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderThemed, THEMES } from '../../test/render';
import { runAxe } from '../../test/axe';
import { apiFetch } from '../../lib/api';
import { downloadBase64, fileToBase64 } from '../../lib/files';
import { DocumentsPage } from './DocumentsPage';
vi.mock('../../lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('../../lib/files', () => ({ fileToBase64: vi.fn(), downloadBase64: vi.fn() }));
const row = {
  id: 42,
  employeeId: 1,
  ecode: 'SYN001',
  employeeName: 'Synthetic Person',
  typeName: 'Appointment',
  originalName: 'appointment.pdf',
  uploadedAt: '2026-10-19T07:00:00Z',
  expiresOn: null,
  status: 'active',
  expiry: { state: 'perpetual', daysRemaining: null },
};
const types = {
  types: [{ code: 'appointment', name: 'Appointment', typicallyExpires: false }],
  maxUploadBytes: 8000000,
};
function setup(managed = false, initial = '/my/documents') {
  return renderThemed(
    <MemoryRouter initialEntries={[initial]}>
      <DocumentsPage managed={managed} />
    </MemoryRouter>,
  );
}
function NavigateEmployee() {
  const navigate = useNavigate();
  return <button onClick={() => { void navigate('/documents?employeeCode=SYN002'); }}>Choose another employee</button>;
}
afterEach(() => {
  vi.resetAllMocks();
});
describe('document vault', () => {
  it('keeps a selected file after upload failure and clears it after a successful retry', async () => {
    let attempts = 0;
    vi.mocked(apiFetch).mockImplementation((path, init) => {
      if (init?.method === 'POST') {
        attempts += 1;
        return attempts === 1
          ? Promise.reject(new Error('Storage unavailable'))
          : Promise.resolve({ id: 42 });
      }
      return Promise.resolve(path.includes('/types') ? types : { rows: [] });
    });
    vi.mocked(fileToBase64).mockResolvedValue('JVBERi0xLjQ=');
    setup();
    await screen.findByRole('combobox', { name: /Document type/ });
    const file = new File(['%PDF-1.4'], 'appointment.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText('File');
    await userEvent.upload(input, file);
    await userEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage unavailable');
    expect((input as HTMLInputElement).files?.[0]).toBe(file);
    await userEvent.click(screen.getByRole('button', { name: 'Upload' }));
    await vi.waitFor(() => {
      expect((input as HTMLInputElement).value).toBe('');
    });
    expect(attempts).toBe(2);
  });
  it('never carries a selected identity file to a different employee', async () => {
    vi.mocked(apiFetch).mockImplementation(path => Promise.resolve(path.includes('/catalog') ? types : { rows: [] }));
    renderThemed(<MemoryRouter initialEntries={['/documents?employeeCode=SYN001']}><NavigateEmployee /><DocumentsPage managed /></MemoryRouter>);
    await screen.findByRole('combobox', { name: /Document type/ });
    await userEvent.upload(screen.getByLabelText('File'), new File(['%PDF-1.4'], 'identity.pdf', { type: 'application/pdf' }));
    await userEvent.click(screen.getByRole('button', { name: 'Choose another employee' }));
    await vi.waitFor(() => { expect(screen.getByLabelText('Employee code')).toHaveValue('SYN002'); });
    expect(screen.getByLabelText('File')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
  });

  it('downloads with the stated purpose and uses the response filename and type', async () => {
    vi.mocked(apiFetch).mockImplementation((path) =>
      Promise.resolve(
        path.includes('/types')
          ? types
          : path.includes('/content?')
            ? { fileName: 'appointment.pdf', mime: 'application/pdf', base64: 'JVBERi0=' }
            : { rows: [row] },
      ),
    );
    setup();
    await screen.findByText('appointment.pdf');
    await userEvent.type(screen.getByLabelText('Reason for download'), 'Personal records');
    await userEvent.click(screen.getByRole('button', { name: 'Download' }));
    await vi.waitFor(() => {
      expect(downloadBase64).toHaveBeenCalledWith('appointment.pdf', 'JVBERi0=', 'application/pdf');
    });
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/documents/mine/42/content?purpose=Personal%20records',
    );
  });
  it('uses the HR catalog permission and the employee e-code in the list filter', async () => {
    vi.mocked(apiFetch).mockImplementation((path) =>
      Promise.resolve(path.includes('/catalog') ? types : { rows: [] }),
    );
    setup(true, '/documents?employeeCode=SYN001');
    await screen.findByRole('combobox', { name: /Document type/ });
    expect(apiFetch).toHaveBeenCalledWith('/api/documents/catalog');
    expect(
      vi.mocked(apiFetch).mock.calls.some(([path]) => path.includes('employeeCode=SYN001')),
    ).toBe(true);
  });
  it.each(THEMES)('is accessible in %s without relying on status colors', async theme => {
    vi.mocked(apiFetch).mockImplementation((path) =>
      Promise.resolve(path.includes('/types') ? types : { rows: [row] }),
    );
    const { container } = renderThemed(<MemoryRouter><DocumentsPage /></MemoryRouter>, theme);
    await screen.findByText('No expiry');
    expect(await runAxe(container)).toHaveNoViolations();
  });
});
