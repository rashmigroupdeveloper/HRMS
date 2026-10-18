/** LC-01: a candidate supplies their own facts and receives a truthful server-confirmed receipt. */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PrejoinPortalPage } from './PrejoinPortalPage';
import { THEMES, renderThemed } from '../../test/render';
import { runAxe } from '../../test/axe';
const request = vi.fn<typeof fetch>();
const valid = {
  isValid: true,
  candidateId: 99,
  candidateName: 'Synthetic Candidate',
  positionTitle: 'Engineer',
};
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
beforeEach(() => {
  vi.stubGlobal('fetch', request);
  request
    .mockReset()
    .mockImplementation((_url, options) =>
      Promise.resolve(
        response(options?.method === 'POST' ? { success: true, candidateId: 99 } : valid),
      ),
    );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function open() {
  render(
    <MemoryRouter initialEntries={['/onboard/prejoin?token=synthetic-link']}>
      <PrejoinPortalPage />
    </MemoryRouter>,
  );
  await screen.findByLabelText('Present Address (Current Residence)');
}
function complete() {
  for (const [label, value] of [
    ['Present Address (Current Residence)', 'Submitted current address'],
    ['Permanent Address (As per Aadhaar)', 'Submitted permanent address'],
    ['Emergency Contact Name', 'Synthetic contact'],
    ['Emergency Contact Phone', '9000000001'],
    ['Relationship', 'Parent'],
    ['PAN Number (10 characters)', 'ABCDE1234F'],
    ['Aadhaar Number (12 numeric digits)', '123456789012'],
    ['Bank Name', 'Synthetic bank'],
    ['IFSC Code (11 alphanumeric characters)', 'ABCD0123456'],
    ['Savings Bank Account Number', '12345678'],
  ])
    fireEvent.change(screen.getByLabelText(label ?? ''), { target: { value } });
}
const submissions = () => request.mock.calls.filter(([, options]) => options?.method === 'POST');
it('leaves blood group and emergency relationship blank until the candidate supplies them', async () => {
  await open();
  expect(screen.getByRole('combobox', { name: 'Blood Group' })).toHaveTextContent('Select…');
  expect(screen.getByLabelText('Relationship')).toHaveValue('');
});
it('uses an actual submit button so the completed form can be sent', async () => {
  await open();
  expect(screen.getByRole('button', { name: 'Submit Onboarding Information' })).toHaveAttribute(
    'type',
    'submit',
  );
});
it('submits candidate-entered facts without inventing optional medical data or immediate employee creation', async () => {
  await open();
  complete();
  fireEvent.click(screen.getByRole('button', { name: 'Submit Onboarding Information' }));
  expect(await screen.findByText('Details Submitted!')).toBeInTheDocument();
  expect(submissions()).toHaveLength(1);
  const rawBody = submissions()[0]?.[1]?.body;
  if (typeof rawBody !== 'string') throw new Error('Expected JSON request body');
  const body = JSON.parse(rawBody) as {
    data: { bloodGroup?: string; emergencyContactRelation: string };
  };
  expect(body.data.bloodGroup).toBeUndefined();
  expect(body.data.emergencyContactRelation).toBe('Parent');
  expect(screen.getByText(/HR will review your application/)).toBeInTheDocument();
});
it.each(THEMES)('keeps the candidate form accessible in %s', async (theme) => {
  renderThemed(
    <MemoryRouter initialEntries={['/onboard/prejoin?token=synthetic-link']}>
      <main>
        <PrejoinPortalPage />
      </main>
    </MemoryRouter>,
    theme,
  );
  await screen.findByLabelText('Present Address (Current Residence)');
  expect(await runAxe(document.body)).toHaveNoViolations();
});
it('preserves supplied values after rejection and does not show a success receipt', async () => {
  request.mockImplementation((_url, options) =>
    Promise.resolve(
      response(
        options?.method === 'POST' ? { message: 'The link was already used' } : valid,
        options?.method === 'POST' ? 400 : 200,
      ),
    ),
  );
  await open();
  complete();
  fireEvent.click(screen.getByRole('button', { name: 'Submit Onboarding Information' }));
  expect(await screen.findByText('The link was already used')).toBeInTheDocument();
  expect(screen.getByLabelText('Bank Name')).toHaveValue('Synthetic bank');
  expect(screen.queryByText('Details Submitted!')).not.toBeInTheDocument();
});
