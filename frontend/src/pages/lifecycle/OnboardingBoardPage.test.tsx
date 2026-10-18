/** LC-01/02: actual joining confirmation, real master choices and truthful failures. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { apiFetch, ApiError } from '../../lib/api';
import { OnboardingBoardPage } from './OnboardingBoardPage';
import { runAxe } from '../../test/axe';
import { THEMES, renderThemed } from '../../test/render';
vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof import('../../lib/api')>()),
  apiFetch: vi.fn(),
}));
const candidate = {
  id: 91,
  fullName: 'Synthetic Candidate',
  personalEmail: 'candidate@hrms.invalid',
  mobile: '9000000000',
  positionTitle: 'Engineer',
  department: null,
  companyId: 71,
  offeredCtc: '450000',
  proposedDoj: '1998-09-30',
  status: 'prejoin_done',
  hasPrejoinData: true,
};
const catalog = {
  companies: [{ id: 71, name: 'Configured Legal Entity', ecodePrefix: 'KOIL' }],
  departments: [{ id: 801, name: 'Configured Department' }],
  designations: [{ id: 802, name: 'Configured Designation' }],
  orgUnits: [{ id: 805, name: 'Configured Unit' }],
  locations: [{ id: 803, name: 'Configured Location' }],
  salaryStructures: [{ id: 804, name: 'Approved Structure' }],
};
function reply(path: string): Promise<unknown> {
  if (path.endsWith('/application'))
    return Promise.resolve({
      candidateId: 91,
      submittedAt: '2026-10-17T10:00:00Z',
      profile: {
        presentAddress: 'Submitted current address',
        permanentAddress: 'Submitted permanent address',
        emergencyContactName: 'Submitted emergency contact',
        emergencyContactPhone: '9000000001',
        emergencyContactRelation: 'Parent',
        bloodGroup: null,
        panProvided: true,
        aadhaarProvided: true,
        uanProvided: false,
        bankDetailsProvided: true,
      },
    });
  if (path.includes('onboarding-reference-data')) return Promise.resolve(catalog);
  if (path.endsWith('/candidates')) return Promise.resolve({ candidates: [candidate] });
  if (path.endsWith('/tasks')) return Promise.resolve({ tasks: [] });
  if (path.endsWith('/check-duplicate')) return Promise.resolve({ hasDuplicate: false });
  return Promise.resolve({ employeeId: 123, ecode: 'KOIL000099' });
}
beforeEach(() => {
  vi.mocked(apiFetch)
    .mockReset()
    .mockImplementation((path) => reply(path));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function show() {
  return render(
    <MemoryRouter>
      <OnboardingBoardPage />
    </MemoryRouter>,
  );
}
async function open(waitForApplication = true) {
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'Review joining' }));
  await screen.findByRole('combobox', { name: 'Department' });
  if (waitForApplication) await screen.findByText('Submitted current address');
}
async function choose(label: string, name: string) {
  fireEvent.click(screen.getByRole('combobox', { name: label }));
  fireEvent.click(await screen.findByRole('option', { name }));
}
async function prepared() {
  await open();
  await choose('Organisational unit', 'Configured Unit');
  await choose('Department', 'Configured Department');
  await choose('Designation', 'Configured Designation');
  await choose('Work Location', 'Configured Location');
  await choose('Salary Structure Assignment', 'Approved Structure');
  await waitFor(() => {
    expect(screen.getByRole('checkbox', { name: /HR has reviewed/ })).toBeEnabled();
  });
  fireEvent.click(screen.getByRole('checkbox', { name: /HR has reviewed/ }));
}
const submissions = () =>
  vi.mocked(apiFetch).mock.calls.filter(([path]) => path.endsWith('/convert'));
describe('LC-01 actual joining UI', () => {
  it.each(THEMES)('has an accessible confirmation form in %s', async (theme) => {
    renderThemed(
      <MemoryRouter>
        <main>
          <OnboardingBoardPage />
        </main>
      </MemoryRouter>,
      theme,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Review joining' }));
    await screen.findByText('Submitted current address');
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /HR has reviewed/ })).toBeEnabled();
    });
    expect(await runAxe(document.body)).toHaveNoViolations();
  });
  it('shows errors without inventing candidates or tasks', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('Access denied'));
    show();
    await screen.findByRole('button', { name: 'Retry onboarding data' });
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Review joining' })).not.toBeInTheDocument();
    expect(screen.queryByText('Rahul Sen')).not.toBeInTheDocument();
  });
  it('loads the configured prefix and actual masters without changing the accepted entity', async () => {
    await open();
    expect(await screen.findByRole('combobox', { name: 'Employing Company' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Employing Company' })).toHaveTextContent(
      'Configured Legal Entity (KOIL…)',
    );
    expect(
      screen.getByRole('button', { name: 'Confirm joining & create employee' }),
    ).toBeDisabled();
    expect(screen.getByLabelText('Corporate Work Email')).toHaveValue('');
    expect(submissions()).toHaveLength(0);
  });
  it('requires the actual application to load before HR can attest to review', async () => {
    vi.mocked(apiFetch).mockImplementation((path) =>
      path.endsWith('/application')
        ? Promise.reject(new ApiError('Application inaccessible', 403))
        : reply(path),
    );
    await open(false);
    expect(await screen.findByRole('alert')).toHaveTextContent('Application inaccessible');
    expect(screen.getByRole('checkbox', { name: /HR has reviewed/ })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Confirm joining & create employee' }),
    ).toBeDisabled();
    expect(submissions()).toHaveLength(0);
  });
  it('shows a no-show accurately and does not offer employee creation', async () => {
    vi.mocked(apiFetch).mockImplementation((path) =>
      path.endsWith('/candidates')
        ? Promise.resolve({ candidates: [{ ...candidate, status: 'no_show' }] })
        : reply(path),
    );
    show();
    expect(await screen.findByText('Did not join')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review joining' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByText('Awaiting Link')).not.toBeInTheDocument();
  });
  it('uses the API email field and scopes the duplicate-check result truthfully', async () => {
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Check Dup' }));
    expect(
      await screen.findByText(/No matching employee found within your permitted data scope/),
    ).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/api/lifecycle/candidates/check-duplicate', {
      method: 'POST',
      body: JSON.stringify({ email: candidate.personalEmail, mobile: candidate.mobile }),
    });
    expect(screen.queryByText(/1,066/)).not.toBeInTheDocument();
  });
  it('submits confirmed actual joining and chosen master IDs without inventing a work email', async () => {
    await prepared();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm joining & create employee' }));
    await waitFor(() => {
      expect(submissions()).toHaveLength(1);
    });
    expect(JSON.parse(submissions()[0]?.[1]?.body as string)).toEqual({
      candidateId: 91,
      joiningConfirmed: true,
      companyId: 71,
      designationId: 802,
      departmentId: 801,
      locationId: 803,
      orgUnitId: 805,
      doj: '1998-09-30',
      salaryStructureId: 804,
    });
  });
  it('blocks future actual joining before making a mutation', async () => {
    await prepared();
    fireEvent.change(screen.getByLabelText('Actual Date of Joining'), {
      target: { value: '2099-01-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm joining & create employee' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('today or earlier');
    expect(submissions()).toHaveLength(0);
  });
  it('keeps the form and confirmed date after a server rejection', async () => {
    vi.mocked(apiFetch).mockImplementation((path) =>
      path.endsWith('/convert')
        ? Promise.reject(new Error('Application needs HR correction'))
        : reply(path),
    );
    await prepared();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm joining & create employee' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Application needs HR correction');
    expect(screen.getByLabelText('Actual Date of Joining')).toHaveValue('1998-09-30');
    expect(screen.getByRole('checkbox', { name: /HR has reviewed/ })).toBeChecked();
  });
  it('prevents repeated submissions and dismissal during conversion', async () => {
    let finish: ((value: unknown) => void) | undefined;
    const pending = new Promise((resolve) => {
      finish = resolve;
    });
    vi.mocked(apiFetch).mockImplementation((path) =>
      path.endsWith('/convert') ? pending : reply(path),
    );
    await prepared();
    const button = screen.getByRole('button', { name: 'Confirm joining & create employee' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(submissions()).toHaveLength(1);
    expect(button).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await act(async () => {
      finish?.({ employeeId: 123, ecode: 'KOIL000099' });
      await pending;
    });
    await waitFor(() =>
      expect(screen.queryByRole('checkbox', { name: /HR has reviewed/ })).not.toBeInTheDocument(),
    );
  });
  it('does not allow conversion when a claimed submitted candidate has no application', async () => {
    vi.mocked(apiFetch).mockImplementation((path) =>
      path.endsWith('/candidates')
        ? Promise.resolve({ candidates: [{ ...candidate, hasPrejoinData: false }] })
        : reply(path),
    );
    await open();
    fireEvent.click(screen.getByRole('checkbox', { name: /HR has reviewed/ }));
    expect(
      screen.getByRole('button', { name: 'Confirm joining & create employee' }),
    ).toBeDisabled();
  });
});
